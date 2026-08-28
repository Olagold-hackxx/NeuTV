import { test } from 'node:test';
import assert from 'node:assert/strict';
import { fakeRuntime } from '../../../platform/runtime.mjs';
import { createLlmService, parseCliOutput, DEFAULT_MODEL } from '../service.mjs';
import { discoverClaude } from '../discover.mjs';

const found = { available: true, bin: '/fake/claude', source: 'test', searched: [] };
const build = (exec, over = {}) => createLlmService({ runtime: fakeRuntime(), discover: () => found, exec, ...over });
const okExec = (stdout) => async () => ({ code: 0, killed: false, stdout, stderr: '', error: null });

test('discovery reports where it looked when nothing is installed', () => {
  const res = discoverClaude({ paths: ['/nope/claude'], which: () => null, exists: () => false });
  assert.equal(res.available, false);
  assert.ok(res.searched.includes('/nope/claude'));
  assert.ok(res.hint.includes('NEUTV_CLAUDE_BIN'), 'tells the operator how to fix it');
});

test('discovery prefers an explicit path over PATH', () => {
  const res = discoverClaude({ paths: ['/opt/claude'], which: () => '/usr/bin/claude', exists: (p) => p === '/opt/claude' });
  assert.equal(res.bin, '/opt/claude');
  assert.equal(res.source, 'path-probe');
});

test('discovery falls back to PATH', () => {
  const res = discoverClaude({ paths: [], which: () => '/usr/bin/claude', exists: () => false });
  assert.equal(res.bin, '/usr/bin/claude');
  assert.equal(res.source, 'PATH');
});

test('a missing local Claude Code is a clean 503, never a crash', async () => {
  const service = createLlmService({
    runtime: fakeRuntime(),
    discover: () => ({ available: false, bin: null, searched: ['/a'], hint: 'install it' }),
  });
  assert.equal(service.health().available, false);
  await assert.rejects(() => service.complete({ prompt: 'hi' }), (e) => e.status === 503);
});

test('the best model is the default and no call silently downgrades it', async () => {
  let args = null;
  const service = build(async (_bin, a) => { args = a; return { code: 0, killed: false, stdout: '{"result":"ok"}', stderr: '' }; });
  await service.complete({ prompt: 'hi' });
  assert.ok(args.includes('--model'));
  assert.equal(args[args.indexOf('--model') + 1], DEFAULT_MODEL);
  assert.equal(DEFAULT_MODEL, 'claude-opus-5');
});

test('it shells out to local Claude Code, not to any hosted API', () => {
  assert.equal(build(okExec('{"result":"x"}')).health().transport, 'local-claude-code');
});

test('the prompt is passed as an argument, never interpolated into a shell', async () => {
  let bin = null; let args = null;
  const service = build(async (b, a) => { bin = b; args = a; return { code: 0, killed: false, stdout: '{"result":"ok"}', stderr: '' }; });
  await service.complete({ prompt: 'hi"; rm -rf /; echo "' });
  assert.equal(bin, '/fake/claude');
  assert.ok(args.includes('hi"; rm -rf /; echo "'), 'passed as one argv entry, so the shell never sees it');
});

test('CLI output is parsed in both JSON and plain shapes', () => {
  assert.equal(parseCliOutput('{"result":"hello"}').text, 'hello');
  assert.equal(parseCliOutput('{"text":"hello"}').text, 'hello');
  assert.equal(parseCliOutput('plain text reply').text, 'plain text reply');
  assert.equal(parseCliOutput('').text, '');
  assert.equal(parseCliOutput('   ').text, '');
});

test('a timeout and a non-zero exit both surface as 503', async () => {
  const timedOut = build(async () => ({ code: null, killed: true, stdout: '', stderr: '' }));
  await assert.rejects(() => timedOut.complete({ prompt: 'hi' }), (e) => e.status === 503 && /timed out/.test(e.message));
  const failed = build(async () => ({ code: 2, killed: false, stdout: '', stderr: 'boom' }));
  await assert.rejects(() => failed.complete({ prompt: 'hi' }), (e) => e.status === 503);
});

test('an empty reply is an error, not an empty success', async () => {
  await assert.rejects(() => build(okExec('')).complete({ prompt: 'hi' }), (e) => e.status === 503);
});

test('completeJson digs the object out of prose and code fences', async () => {
  const fenced = build(okExec(JSON.stringify({ result: '```json\n{"verdict":"allow"}\n```' })));
  assert.deepEqual((await fenced.completeJson({ prompt: 'x' })).json, { verdict: 'allow' });
  const chatty = build(okExec(JSON.stringify({ result: 'Sure! {"verdict":"block"} hope that helps' })));
  assert.deepEqual((await chatty.completeJson({ prompt: 'x' })).json, { verdict: 'block' });
});

test('completeJson refuses to invent structure when there is none', async () => {
  await assert.rejects(() => build(okExec('{"result":"no json here"}')).completeJson({ prompt: 'x' }), (e) => e.status === 400);
  await assert.rejects(() => build(okExec('{"result":"{broken json"}')).completeJson({ prompt: 'x' }), (e) => e.status === 400);
});

test('prompt input is validated before a process is ever spawned', async () => {
  let spawned = 0;
  const service = build(async () => { spawned += 1; return { code: 0, killed: false, stdout: '{"result":"x"}', stderr: '' }; });
  await assert.rejects(() => service.complete({ prompt: '' }), (e) => e.status === 400);
  await assert.rejects(() => service.complete({ prompt: 'x'.repeat(20_001) }), (e) => e.status === 400);
  assert.equal(spawned, 0);
});
