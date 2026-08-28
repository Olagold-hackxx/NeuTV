// Deterministic moderation ruleset.
//
// This is the deterministic half of the latent/deterministic split. Known abuse
// on a 24/7 trading broadcast is pattern-shaped - seed-phrase phishing, doubling
// scams, guaranteed-return claims, off-platform contact funnels - and the same
// message must always get the same verdict, for free, in microseconds. Novel
// phrasing that scores in the grey band is what the LLM escalation is for.
//
// Bump RULESET_VERSION on any rule change; the eval suite pins scores to it.

export const RULESET_VERSION = '1.0.0';

export const BLOCK_THRESHOLD = 70;
export const REVIEW_THRESHOLD = 35;

// weight: contribution to the risk score. A single 70+ rule blocks on its own.
// A rule's test() may return true (use `weight`) or a number (a graded weight),
// so a rule like repetition can separate "a bit repetitive" from "flooding".
export const RULES = [
  {
    id: 'seed_phrase_solicitation',
    weight: 100,
    category: 'phishing',
    reason: 'Asks for a wallet seed phrase, recovery words or private key.',
    test: (t) => /\b(seed|recovery|mnemonic|secret)\s*(phrase|words?|key)\b/.test(t)
      || /\bprivate\s*key\b/.test(t)
      || /\b12\s*(or\s*24\s*)?word(s)?\b.*\b(wallet|phrase|recover)/.test(t),
  },
  {
    id: 'doubling_scam',
    weight: 100,
    category: 'scam',
    reason: 'Send-to-receive doubling scam.',
    // "send 1 ETH get 2 back" carries no doubling *word*, so the amounts have to
    // be matched directly, and the scarcity hook lands on either side of the verb.
    // The character class excludes sentence enders but NOT the period, because
    // amounts contain decimals: "[^.]" made "send 0.5 ETH receive 1 ETH back"
    // unmatchable. The length bounds are what keep the match local.
    test: (t) => /\bsend\b[^!?]{0,60}\b(get|receive)\b[^!?]{0,40}\bback\b/.test(t)
      || /\bsend\b[^!?]{0,40}\b(get|receive|back)\b[^!?]{0,20}\b(double|2x|twice|x2)\b/.test(t)
      || /\b(double|triple)\s+your\s+(coins?|money|crypto|kash|balance|deposit)\b/.test(t)
      || (/\bfirst\s+\d+\s+(people|viewers|users|senders)\b/.test(t)
          && /\b(get|claim|receive|send|only)\b/.test(t)),
  },
  {
    id: 'wallet_connect_bait',
    weight: 90,
    category: 'phishing',
    reason: 'Directs viewers to connect or validate a wallet off-platform.',
    test: (t) => /\b(connect|validate|verify|sync|restore|import)\s+(your\s+)?wallet\b/.test(t)
      && !/\bneu\s*tv\b/.test(t),
  },
  {
    id: 'impersonation',
    weight: 80,
    category: 'impersonation',
    reason: 'Claims to be NEU TV staff, support or an admin.',
    test: (t) => /\b(i\s*am|i'?m|this\s+is)\b[^.]{0,20}\b(admin|support|moderator|staff|official)\b/.test(t)
      || /\b(neu\s*tv|worldstreet|kashplus|market|ark|tsion)\s+(support|admin|team)\b.*\b(dm|message|contact|whatsapp|telegram)\b/.test(t),
  },
  {
    id: 'guaranteed_returns',
    weight: 55,
    category: 'financial_promise',
    reason: 'Promises guaranteed or risk-free returns.',
    test: (t) => /\b(guarantee[ds]?|risk[-\s]?free|no\s+risk|100%\s+(profit|win|sure))\b/.test(t)
      && /\b(profit|return|gain|roi|pip|trade|invest|yield|apy)/.test(t),
  },
  {
    id: 'offplatform_funnel',
    weight: 45,
    category: 'spam',
    reason: 'Pushes viewers to a private off-platform channel.',
    test: (t) => /\b(telegram|whatsapp|t\.me|wa\.me|signal\s+group|dm\s+me|inbox\s+me)\b/.test(t)
      && /\b(profit|signal|trade|invest|mentor|coach|expert|manager|account)/.test(t),
  },
  {
    id: 'link_shortener',
    weight: 40,
    category: 'spam',
    reason: 'Shortened link hiding its destination.',
    test: (t) => /\b(bit\.ly|tinyurl\.com|cutt\.ly|t\.co|is\.gd|rebrand\.ly|shorturl)\b/.test(t),
  },
  {
    id: 'slur_or_harassment',
    weight: 100,
    category: 'harassment',
    reason: 'Targeted abuse or a slur.',
    // Deliberately narrow: targeted abuse, not profanity in general. A broadcast
    // chat that blocks "this is fucking great" is a broken broadcast chat.
    test: (t) => /\b(kill|kys)\s+(yourself|urself)\b/.test(t)
      || /\byou'?re?\s+(a\s+)?(retard|faggot|nigger)/.test(t)
      || /\b(retard|faggot|nigger)s?\b/.test(t),
  },
  {
    id: 'shouting',
    weight: 20,
    category: 'spam',
    reason: 'Sustained all-caps shouting.',
    test: (t, raw) => raw.length >= 20
      && (raw.replace(/[^A-Za-z]/g, '').length > 0)
      && (raw.replace(/[^A-Z]/g, '').length / Math.max(raw.replace(/[^A-Za-z]/g, '').length, 1)) > 0.8,
  },
  {
    id: 'character_flood',
    weight: 25,
    category: 'spam',
    reason: 'Character or emoji flooding.',
    test: (t, raw) => /(.)\1{9,}/.test(raw) || (raw.match(/\p{Extended_Pictographic}/gu) || []).length > 20,
  },
  {
    id: 'repetition',
    weight: 25,
    category: 'spam',
    reason: 'The same phrase repeated to fill the ticker.',
    test: (t) => {
      // Short tokens ("gm", "lfg") are precisely what floods a live ticker, so
      // they count too.
      const words = t.split(/\s+/).filter(Boolean);
      if (words.length < 8) return false;
      const ratio = new Set(words).size / words.length;
      if (ratio < 0.2) return 40;   // flooding: one phrase on repeat
      if (ratio < 0.35) return 20;  // chanting: noisy, not abusive
      return false;
    },
  },
];

// Two passes, deliberately.
//
// normalize() lowercases, strips zero-width padding and folds Cyrillic
// homoglyphs, but leaves digits alone - rules that count ("send 1 get 2 back",
// "first 50 viewers") need real numbers.
//
// deleet() additionally folds digits and symbols to letters to catch
// "pr1v4te k3y". Running it as the only pass would rewrite 1 -> i and 0 -> o and
// destroy every numeric rule, so classify() tests both strings and takes a hit
// on either.
export function normalize(text) {
  return String(text)
    .toLowerCase()
    .replace(/[​-‍﻿]/g, '')
    .replace(/а/g, 'a').replace(/о/g, 'o').replace(/е/g, 'e')
    .replace(/р/g, 'p').replace(/с/g, 'c').replace(/х/g, 'x')
    .replace(/\s+/g, ' ')
    .trim();
}

// "p r i v a t e   k e y" -> "privatekey". Letter-spacing is a standard way to
// walk a phrase past literal matching.
//
// normalize() has already collapsed runs of whitespace, so the word boundary
// between "private" and "key" is gone by the time this runs and the whole run
// fuses into one token. That is fine and deliberate: the rules that need to
// survive this evasion join their words with \s* rather than \s+, so they match
// the fused form too. Guarded on a 4+ character run so ordinary prose is
// untouched.
export function despace(normalized) {
  if (!/(?:\b\w\s){3,}\w\b/.test(normalized)) return normalized;
  return normalized.replace(/\b(?:\w\s){3,}\w\b/g, (run) => run.replace(/\s+/g, ''));
}

export function deleet(normalized) {
  return normalized
    .replace(/[4@]/g, 'a').replace(/3/g, 'e').replace(/0/g, 'o')
    .replace(/[1!|]/g, 'i').replace(/[$5]/g, 's').replace(/7/g, 't');
}

export function classify(text) {
  const raw = String(text ?? '');
  const normalized = normalize(raw);
  // Each pass undoes one evasion. A rule hits if ANY pass matches, so a pass
  // can only ever add coverage - it cannot mask a match the plain text made.
  const variants = [...new Set([normalized, deleet(normalized), despace(normalized), deleet(despace(normalized))])];
  const matches = [];
  let score = 0;

  for (const rule of RULES) {
    let hit = false;
    try {
      for (const variant of variants) {
        const result = rule.test(variant, raw);
        if (result !== false && result !== undefined && result !== null) { hit = result; break; }
      }
    } catch { hit = false; }
    if (hit === false || hit === undefined || hit === null) continue;
    const weight = typeof hit === 'number' ? hit : rule.weight;
    matches.push({ id: rule.id, category: rule.category, weight, reason: rule.reason });
    score += weight;
  }

  score = Math.min(score, 100);
  const verdict = score >= BLOCK_THRESHOLD ? 'block' : score >= REVIEW_THRESHOLD ? 'review' : 'allow';

  return { verdict, score, matches, rulesetVersion: RULESET_VERSION, normalized };
}
