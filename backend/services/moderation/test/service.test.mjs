import { test } from 'node:test';
import assert from 'node:assert/strict';
import { fakeRuntime } from '../../../platform/runtime.mjs';
import { createModerationService } from '../service.mjs';
import { openModerationStore } from '../store.mjs';
import { testStore } from '../../../platform/db/testing.mjs';

const build = async (over = {}) =>
  createModerationService({ runtime: fakeRuntime(), store: await testStore(openModerationStore), ...over });

const GREY = 'check my link bit.ly/xyz for the alpha';

test('a clean message is allowed', async () => {
  const service = await build();
  const decision = await service.check({ text: 'great stream today', surface: 'chat' });
  assert.equal(decision.verdict, 'allow');
});

test('clear abuse is blocked', async () => {
  const service = await build();
  const decision = await service.check({ text: 'send me your seed phrase', surface: 'chat' });
  assert.equal(decision.verdict, 'block');
});

test('the grey band publishes flagged and goes to a human, never to a guess', async () => {
  // The reason the LLM escalation was removed. Blocking legitimate speech on a
  // live broadcast is the worse error, so an ambiguous message goes out AND
  // lands in the CRM queue where a moderator can pull it in seconds.
  const service = await build();
  const decision = await service.check({ text: GREY, surface: 'chat' });
  assert.equal(decision.verdict, 'flag');
  assert.equal(decision.allowed, true, 'the message publishes');
  assert.equal(decision.needsReview, true, 'and is queued for review');
  assert.equal((await service.queue()).length, 1);
});

test('the decision is a pure function of the text: no network, no model', async () => {
  const a = await build();
  const b = await build();
  for (const text of ['great stream', GREY, 'send me your seed phrase']) {
    const first = await a.check({ text });
    const second = await b.check({ text });
    assert.equal(first.verdict, second.verdict);
    assert.equal(first.score, second.score);
  }
});

test('every decision is written to the audit trail', async () => {
  const service = await build();
  await service.check({ text: 'hello there', surface: 'post' });
  await service.check({ text: 'send me your seed phrase', surface: 'chat' });
  const recent = await service.recent();
  assert.equal(recent.length, 2);
  assert.equal(recent[0].verdict, 'block');
  assert.ok(recent[0].excerpt.length > 0, 'the excerpt is what makes the trail reviewable');
});

test('the moderation queue holds everything not cleanly allowed', async () => {
  const service = await build();
  await service.check({ text: 'totally fine message' });
  await service.check({ text: 'send me your seed phrase' });
  await service.check({ text: GREY });
  const queue = await service.queue();
  assert.equal(queue.length, 2, 'block + flag, not the clean one');
  assert.ok(queue.every((q) => ['flag', 'block'].includes(q.verdict)));
});

test('an unknown surface is refused', async () => {
  const service = await build();
  await assert.rejects(() => service.check({ text: 'hi', surface: 'billboard' }), (e) => e.status === 400);
});

test('health reports the policy and the decision counts', async () => {
  const service = await build();
  await service.check({ text: 'fine' });
  const health = await service.health();
  assert.match(health.policy, /human review/);
  assert.equal(health.decisions.allow, 1);
  assert.ok(health.thresholds.block > health.thresholds.review);
});
