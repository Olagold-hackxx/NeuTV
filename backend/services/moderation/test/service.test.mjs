import { test } from 'node:test';
import assert from 'node:assert/strict';
import { fakeRuntime } from '../../../platform/runtime.mjs';
import { createModerationService } from '../service.mjs';

const build = (over = {}) => createModerationService({ runtime: fakeRuntime(), ...over });
const GREY = 'check my link bit.ly/xyz for the alpha';

test('a clean message is allowed', () => {
  assert.equal(build().check({ text: 'great stream today', surface: 'chat' }).verdict, 'allow');
});

test('clear abuse is blocked', () => {
  assert.equal(build().check({ text: 'send me your seed phrase', surface: 'chat' }).verdict, 'block');
});

test('the grey band publishes flagged and goes to a human, never to a guess', () => {
  // The whole reason the LLM escalation was removed. Blocking legitimate speech
  // on a live broadcast is the worse error, so an ambiguous message goes out
  // AND lands in the CRM queue where a moderator can pull it in seconds.
  const service = build();
  const d = service.check({ text: GREY, surface: 'chat' });
  assert.equal(d.verdict, 'flag');
  assert.equal(d.allowed, true, 'the message publishes');
  assert.equal(d.needsReview, true, 'and is queued for review');
  assert.equal(service.queue().length, 1);
});

test('the decision is a pure function of the text: no network, no model, no clock drift', () => {
  const a = build();
  const b = build();
  for (const text of ['great stream', GREY, 'send me your seed phrase']) {
    const first = a.check({ text });
    const second = b.check({ text });
    assert.equal(first.verdict, second.verdict);
    assert.equal(first.score, second.score);
  }
});

test('every decision is written to the audit trail', () => {
  const service = build();
  service.check({ text: 'hello there', surface: 'post' });
  service.check({ text: 'send me your seed phrase', surface: 'chat' });
  const recent = service.recent();
  assert.equal(recent.length, 2);
  assert.equal(recent[0].verdict, 'block');
  assert.ok(recent[0].excerpt.length > 0, 'the excerpt is what makes the trail reviewable');
});

test('the moderation queue holds everything not cleanly allowed', () => {
  const service = build();
  service.check({ text: 'totally fine message' });
  service.check({ text: 'send me your seed phrase' });
  service.check({ text: GREY });
  const queue = service.queue();
  assert.equal(queue.length, 2, 'block + flag, not the clean one');
  assert.ok(queue.every((q) => ['flag', 'block'].includes(q.verdict)));
});

test('an unknown surface is refused', () => {
  assert.throws(() => build().check({ text: 'hi', surface: 'billboard' }), (e) => e.status === 400);
});

test('health reports the policy and the decision counts', () => {
  const service = build();
  service.check({ text: 'fine' });
  const health = service.health();
  assert.match(health.policy, /human review/);
  assert.equal(health.decisions.allow, 1);
  assert.ok(health.thresholds.block > health.thresholds.review);
});
