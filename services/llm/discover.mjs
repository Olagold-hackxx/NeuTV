// Locate the local Claude Code binary.
//
// Per the LLM access rule this backend never calls a hosted inference endpoint.
// Every latent-space call shells out to the Claude Code already installed on the
// machine. Discovery is best-effort and never throws: if no binary is found the
// service reports unavailable and callers take their deterministic fallback.

import { existsSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { homedir } from 'node:os';
import { join } from 'node:path';

export const CANDIDATE_PATHS = () => [
  process.env.NEUTV_CLAUDE_BIN,
  join(homedir(), '.claude', 'local', 'claude'),
  '/usr/local/bin/claude',
  '/opt/homebrew/bin/claude',
  join(homedir(), '.bun', 'bin', 'claude'),
  join(homedir(), '.local', 'bin', 'claude'),
].filter(Boolean);

export function discoverClaude({ paths = CANDIDATE_PATHS(), which = defaultWhich, exists = existsSync } = {}) {
  const searched = [];
  for (const p of paths) {
    searched.push(p);
    if (exists(p)) return { available: true, bin: p, source: 'path-probe', searched };
  }
  const onPath = which('claude');
  searched.push('$PATH');
  if (onPath) return { available: true, bin: onPath, source: 'PATH', searched };
  return {
    available: false,
    bin: null,
    source: null,
    searched,
    hint: 'Install Claude Code, or set NEUTV_CLAUDE_BIN to its absolute path.',
  };
}

function defaultWhich(cmd) {
  try {
    return execFileSync('sh', ['-c', `command -v ${cmd}`], { encoding: 'utf8' }).trim() || null;
  } catch {
    return null;
  }
}
