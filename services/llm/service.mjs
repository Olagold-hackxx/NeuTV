// LLM service: the only place in this backend that reaches latent space.
//
// Contract rule: every other service calls /llm/complete. Nothing else spawns a
// process, and nothing anywhere calls a hosted API. Swapping how latent work is
// executed is a change to this one file.

import { execFile } from 'node:child_process';
import { validate } from '../../platform/validate.mjs';
import { unavailable, badRequest } from '../../platform/errors.mjs';
import { discoverClaude } from './discover.mjs';

// "Always use the best available model by default" - no silent downgrade to a
// cheaper model. Override deliberately per call, never for cost.
export const DEFAULT_MODEL = 'claude-opus-5';

const defaultExec = (bin, args, opts) => new Promise((resolve) => {
  execFile(bin, args, opts, (err, stdout, stderr) => {
    resolve({
      code: err ? (err.code ?? 1) : 0,
      killed: Boolean(err && err.killed),
      stdout: String(stdout ?? ''),
      stderr: String(stderr ?? ''),
      error: err ? err.message : null,
    });
  });
});

// Claude Code's --output-format json wraps the answer; older/plain output does
// not. Accept both rather than pinning to one CLI generation.
export function parseCliOutput(stdout) {
  const raw = String(stdout ?? '').trim();
  if (!raw) return { text: '', parsed: null };
  try {
    const json = JSON.parse(raw);
    if (typeof json === 'string') return { text: json, parsed: null };
    const text = json.result ?? json.text ?? json.content ?? json.completion ?? '';
    return { text: typeof text === 'string' ? text : JSON.stringify(text), parsed: json };
  } catch {
    return { text: raw, parsed: null };
  }
}

export function createLlmService({
  runtime,
  exec = defaultExec,
  discover = discoverClaude,
  defaultModel = DEFAULT_MODEL,
  timeoutMs = 30_000,
  maxOutputBytes = 512 * 1024,
} = {}) {
  let cached = null;
  const location = () => (cached ??= discover());

  return {
    health() {
      const found = location();
      return {
        available: found.available,
        bin: found.bin,
        source: found.source,
        model: defaultModel,
        transport: 'local-claude-code',
        searched: found.searched,
        ...(found.hint ? { hint: found.hint } : {}),
      };
    },

    // Re-probe after an install, without a restart.
    refresh() { cached = null; return this.health(); },

    async complete(input) {
      const { prompt, system, model, maxTurns } = validate(input, {
        prompt: { type: 'string', required: true, min: 1, max: 20_000 },
        system: { type: 'string', required: false, max: 8_000 },
        model: { type: 'string', required: false, default: defaultModel, max: 60 },
        maxTurns: { type: 'int', required: false, default: 1, min: 1, max: 5 },
      });

      const found = location();
      if (!found.available) {
        throw unavailable('Local Claude Code is not installed on this host.', {
          searched: found.searched, hint: found.hint,
        });
      }

      const args = ['-p', prompt, '--output-format', 'json', '--model', model, '--max-turns', String(maxTurns)];
      if (system) args.push('--append-system-prompt', system);

      const startedAt = runtime.now();
      const res = await exec(found.bin, args, { timeout: timeoutMs, maxBuffer: maxOutputBytes });

      if (res.killed) throw unavailable(`Local Claude Code timed out after ${timeoutMs}ms.`);
      if (res.code !== 0) {
        throw unavailable('Local Claude Code exited non-zero.', {
          code: res.code, stderr: res.stderr.slice(0, 500),
        });
      }

      const { text, parsed } = parseCliOutput(res.stdout);
      if (!text) throw unavailable('Local Claude Code returned an empty response.');

      return {
        text,
        model,
        transport: 'local-claude-code',
        durationMs: runtime.now() - startedAt,
        usage: parsed?.usage ?? null,
      };
    },

    // Convenience for callers that need machine-readable output. Tolerates a
    // model that wraps its JSON in prose or a fenced block.
    async completeJson(input) {
      const res = await this.complete({
        ...input,
        system: [input.system, 'Reply with a single JSON object and nothing else.'].filter(Boolean).join('\n'),
      });
      const fenced = /```(?:json)?\s*([\s\S]*?)```/.exec(res.text);
      const candidate = (fenced ? fenced[1] : res.text).trim();
      const start = candidate.indexOf('{');
      const end = candidate.lastIndexOf('}');
      if (start === -1 || end <= start) throw badRequest('Model did not return JSON.', { text: res.text.slice(0, 300) });
      try {
        return { ...res, json: JSON.parse(candidate.slice(start, end + 1)) };
      } catch (err) {
        throw badRequest('Model returned malformed JSON.', { reason: err.message, text: candidate.slice(0, 300) });
      }
    },
  };
}
