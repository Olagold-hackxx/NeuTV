// Moderation quality eval.
//
// Measures the ruleset against a corpus wider than the gate tests, including
// phrasings it was NOT written against - that is the point. A ruleset that only
// scores well on its own examples tells you nothing.
//
// Two numbers matter and they trade off:
//   recall    - share of abuse caught
//   precision - share of ordinary messages left alone
// A filter that blocks everything has perfect recall and is useless, so the
// score here is the harmonic mean, and false positives on normal trading talk
// are weighted as the more damaging error for a live broadcast.

import { classify } from '../rules.mjs';

export const name = 'ruleset-quality';

// abuse: should end up blocked or held. clean: must be allowed.
const ABUSE = [
  'send me your seed phrase and I will fix your wallet',
  'whats your recovery phrase? I can restore it for you',
  'drop your private key here and I will check the balance',
  'import your wallet with these 12 words to claim',
  'send 0.5 ETH receive 1 ETH back instantly',
  'double your money in one hour guaranteed',
  'first 100 senders get 2x returns',
  'connect your wallet at this link to verify your airdrop',
  'validate wallet now or lose your funds',
  'I am NEU TV support, dm me on telegram to fix your account',
  'this is the official admin team, message us for your withdrawal',
  'guaranteed risk free profit every trade, no losses ever',
  '100% sure win signals, zero risk investment',
  'dm me on whatsapp for private mentorship signals',
  'inbox me for my trade signals, guaranteed profit',
  'kill yourself, nobody watches this',
  's3nd y0ur s33d phr4s3 pl3as3',
  'p r i v a t e   k e y needed to verify',
];

const CLEAN = [
  'WorldStreet 20x on TSLA looking clean here',
  'the KashPlus cashout was actually 1.8 seconds, impressive',
  'anyone else in the ARK vault this quarter?',
  'mARKet escrow worked perfectly for my storefront sale',
  'when does the Tsion Cars delivery episode air?',
  'this stream quality is terrible today',
  'honestly the host is wrong about NVDA here',
  'up 12% on my position, took profit at target',
  'that was a fucking great breakdown',
  'gm everyone',
  'LFG!!!',
  'can someone explain how the escrow release works',
  'my wallet balance updated instantly after the tip',
  'I connected my WorldStreet account through NEU TV sso',
  'the 20x leverage explanation at 4:12 was really clear',
  'lost money on that trade but my own fault',
  'what time is the ARK rebalancing report?',
  'the new studio lighting looks good',
  'someone tipped 1000 coins, wild',
  'bought a car through Tsion last month, escrow was smooth',
];

export async function run() {
  const failures = [];

  let caught = 0;
  for (const text of ABUSE) {
    const verdict = classify(text).verdict;
    if (verdict === 'block' || verdict === 'review') caught += 1;
    else failures.push(`missed abuse: "${text.slice(0, 60)}"`);
  }

  let untouched = 0;
  for (const text of CLEAN) {
    const verdict = classify(text).verdict;
    if (verdict === 'allow') untouched += 1;
    else failures.push(`false positive (${verdict}): "${text.slice(0, 60)}"`);
  }

  const recall = caught / ABUSE.length;
  const precision = untouched / CLEAN.length;
  const score = recall + precision === 0 ? 0 : (2 * recall * precision) / (recall + precision);

  return {
    score,
    threshold: 0.9,
    total: ABUSE.length + CLEAN.length,
    failures: failures.slice(0, 8),
    note: `recall ${(recall * 100).toFixed(1)}% (${caught}/${ABUSE.length})  precision ${(precision * 100).toFixed(1)}% (${untouched}/${CLEAN.length})`,
  };
}
