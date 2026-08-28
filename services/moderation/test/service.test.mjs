import { test } from 'node:test';
import assert from 'node:assert/strict';
import { fakeRuntime } from '../../../platform/runtime.mjs';
import { createModerationService } from '../service.mjs';

const build = (over = {}) => createModerationService({ runtime: fakeRuntime(), ...over });
const GREY = 'check my link bit.ly/xyz for the alpha';

test('a clean message is allowed without ever calling the LLM', async () => {
  let called = 0;
  const service = build({ llm: { call: async () => { called += 1; return { status: 200, body: {} }; } } });
  const d = await service.check({ text: 'great stream today', surface: 'chat' });
  assert.equal(d.verdict, 'allow');
  assert.equal(called, 0, 'no paid call for an obvious pass');
});

test('clear abuse is blocked without ever calling the LLM', async () => {
  let called = 0;
  const service = build({ llm: { call: async () => { called += 1; return { status: 200, body: {} }; } } });
  const d = await service.check({ text: 'send me your seed phrase', surface: 'chat' });
  assert.equal(d.verdict, 'block');
  assert.equal(called, 0, 'no paid call for an obvious block');
});

test('only the grey band escalates to latent space', async () => {
  let calls = 0;
  const service = build({
    llm: { call: async () => { calls += 1; return { status: 200, body: { text: '{"verdict":"block","reason":"scam funnel"}' } }; } },
  });
  const d = await service.check({ text: GREY, surface: 'chat' });
  assert.equal(calls, 1);
  assert.equal(d.escalated, true);
  assert.equal(d.verdict, 'block');
  assert.equal(d.escalationReason, 'scam funnel');
});

test('the LLM can clear a grey-band message', async () => {
  const service = build({ llm: { call: async () => ({ status: 200, body: { text: '{"verdict":"allow","reason":"harmless"}' } }) } });
  const d = await service.check({ text: GREY });
  assert.equal(d.verdict, 'allow');
  assert.equal(d.allowed, true);
});

test('when the LLM is unreachable the message publishes flagged, never blocked', async () => {
  const service = build({ llm: { call: async () => { throw new Error('claude not installed'); } } });
  const d = await service.check({ text: GREY });
  assert.equal(d.verdict, 'flag');
  assert.equal(d.allowed, true, 'a live chat must not go down because a side channel did');
  assert.equal(d.needsReview, true);
});

test('a malformed or hostile LLM reply is discarded, not obeyed', async () => {
  for (const text of ['not json at all', '{"verdict":"delete_everything"}', '{}', '']) {
    const service = build({ llm: { call: async () => ({ status: 200, body: { text } }) } });
    const d = await service.check({ text: GREY });
    assert.equal(d.verdict, 'flag', `obeyed a bad reply: ${text}`);
    assert.equal(d.escalated, false);
  }
});

test('escalation can be switched off entirely', async () => {
  let called = 0;
  const service = build({
    escalationEnabled: false,
    llm: { call: async () => { called += 1; return { status: 200, body: {} }; } },
  });
  await service.check({ text: GREY });
  assert.equal(called, 0);
});

test('every decision is written to the audit trail', async () => {
  const service = build();
  await service.check({ text: 'hello there', surface: 'post' });
  await service.check({ text: 'send me your seed phrase', surface: 'chat' });
  const recent = service.recent();
  assert.equal(recent.length, 2);
  assert.equal(recent[0].verdict, 'block');
  assert.ok(recent[0].excerpt.length > 0, 'the excerpt is what makes the trail reviewable');
});

test('the moderation queue holds everything not cleanly allowed', async () => {
  const service = build();
  await service.check({ text: 'totally fine message' });
  await service.check({ text: 'send me your seed phrase' });
  await service.check({ text: GREY });
  const queue = service.queue();
  assert.equal(queue.length, 2, 'block + flag, not the clean one');
  assert.ok(queue.every((q) => ['flag', 'block'].includes(q.verdict)));
});

test('an unknown surface is refused', async () => {
  const service = build();
  await assert.rejects(() => service.check({ text: 'hi', surface: 'billboard' }), (e) => e.status === 400);
});

test('health reports the escalation policy honestly', () => {
  assert.equal(build({ llm: null }).health().escalation.wired, false);
  assert.equal(build({ llm: { call: async () => {} } }).health().escalation.wired, true);
});
