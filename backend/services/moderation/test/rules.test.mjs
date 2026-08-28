// Table-driven ruleset tests.
//
// The corpus is the point: a moderation ruleset that is only tested on the
// abuse it was written for will happily block half the legitimate traffic on a
// trading channel. Every "allow" case here is a real thing a viewer says.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { classify, normalize, deleet, despace, RULESET_VERSION } from '../rules.mjs';

const BLOCK = [
  ['seed phrase', 'DM me your 12 word seed phrase and I will restore your wallet'],
  ['private key', 'send me your private key and I unlock the funds'],
  ['leetspeak key', 's3nd me your pr1v4te k3y'],
  ['doubling, numeric', 'Send 1 ETH to this address and get 2 ETH back, first 50 viewers only'],
  ['doubling, worded', 'double your kash balance instantly, guaranteed'],
  ['wallet connect bait', 'connect your wallet here to validate your airdrop'],
  ['staff impersonation', 'I am the official NEU TV support admin, message me on telegram for your profit signals'],
  ['targeted abuse', 'kill yourself you worthless streamer'],
  ['decimal amounts', 'send 0.5 ETH receive 1 ETH back instantly'],
  ['letter spacing', 'p r i v a t e   k e y needed to verify'],
];

const ALLOW = [
  ['ordinary trading talk', 'WorldStreet 20x on TSLA looking clean here, nice entry'],
  ['vault talk', 'ARK vault rebalanced my portfolio overnight, up 3% this week'],
  ['product question', 'Anyone know when the Tsion Cars escrow delivery episode airs?'],
  ['untargeted profanity', 'this is fucking great, love the KashPlus cashout demo'],
  ['criticism of the network', 'honestly this broadcast has been boring today, bring back the trading desk'],
  ['excited caps in a short message', 'LFG!!'],
  ['legit wallet mention', 'my NEU TV wallet shows the tip already, that was instant'],
  ['numbers and percentages', 'up 12% on NVDA, took profit at 100% of my target'],
];

const REVIEW = [
  ['guaranteed returns', 'Guaranteed risk-free 100% profit every single trade, no risk at all'],
  ['link shortener', 'check my link bit.ly/xyz for the alpha'],
  ['off-platform funnel', 'dm me on whatsapp for my private trade signals'],
  ['flooding', 'gm gm gm gm gm gm gm gm gm gm gm gm'],
];

test('known abuse is blocked outright', () => {
  for (const [label, text] of BLOCK) {
    const r = classify(text);
    assert.equal(r.verdict, 'block', `${label}: expected block, got ${r.verdict} (${r.score})`);
  }
});

test('ordinary viewers are never blocked', () => {
  for (const [label, text] of ALLOW) {
    const r = classify(text);
    assert.equal(r.verdict, 'allow', `${label}: expected allow, got ${r.verdict} via ${r.matches.map((m) => m.id)}`);
  }
});

test('the grey band is held for review rather than guessed at', () => {
  for (const [label, text] of REVIEW) {
    const r = classify(text);
    assert.equal(r.verdict, 'review', `${label}: expected review, got ${r.verdict} (${r.score})`);
  }
});

test('classification is deterministic', () => {
  for (const [, text] of [...BLOCK, ...ALLOW, ...REVIEW]) {
    const a = classify(text);
    const b = classify(text);
    assert.deepEqual(a.verdict, b.verdict);
    assert.deepEqual(a.score, b.score);
  }
});

test('normalisation preserves digits, folding preserves letters', () => {
  // The bug this pins: folding 1 -> i and 0 -> o destroyed every numeric rule,
  // so "send 1 get 2 back" and "first 50 viewers" stopped matching.
  assert.ok(normalize('Send 1 ETH get 2 back').includes('1'), 'digits survive normalisation');
  assert.ok(normalize('first 50 viewers').includes('50'));
  assert.equal(deleet('pr1v4te k3y'), 'private key', 'folding still catches leetspeak');
});

test('letter spacing does not smuggle a phrase past the rules', () => {
  assert.equal(despace(normalize('p r i v a t e k e y')), 'privatekey');
  assert.equal(despace(normalize('this is a normal sentence')), 'this is a normal sentence',
    'ordinary prose is left alone');
  assert.equal(classify('s e e d p h r a s e please').verdict, 'block');
});

test('an amount with a decimal point does not break the scam patterns', () => {
  // "[^.]" in the doubling rule could not cross the "." in "0.5", so this exact
  // message walked straight through. Found by the eval corpus, pinned here.
  assert.equal(classify('send 0.5 ETH receive 1 ETH back instantly').verdict, 'block');
  assert.equal(classify('send 2.5 eth and receive 5 eth back').verdict, 'block');
});

test('zero-width padding and homoglyphs do not smuggle abuse through', () => {
  assert.equal(classify('se​ed phra​se please send it').verdict, 'block');
  assert.equal(classify('private kеy').verdict, 'block'); // Cyrillic е
});

test('repetition is graded, so chanting is not treated as flooding', () => {
  assert.equal(classify('gm gm gm gm gm gm gm gm gm gm gm gm').verdict, 'review');
  assert.equal(classify('lets go worldstreet lets go worldstreet lets go worldstreet').verdict, 'allow');
});

test('empty and absurd input do not throw', () => {
  for (const input of ['', ' ', null, undefined, 'x'.repeat(5000), '🔥'.repeat(200)]) {
    assert.doesNotThrow(() => classify(input));
  }
});

test('the score is bounded and the ruleset version is reported', () => {
  const r = classify('seed phrase private key double your money connect your wallet');
  assert.ok(r.score <= 100);
  assert.equal(r.rulesetVersion, RULESET_VERSION);
});
