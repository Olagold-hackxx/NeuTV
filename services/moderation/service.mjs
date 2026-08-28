// Moderation service: the gate every piece of user-authored text passes.
//
// The split this codebase insists on, made concrete:
//   deterministic - RULES in rules.mjs. Free, microseconds, same verdict every
//                   time, and the only lane the gate tests depend on.
//   latent        - local Claude Code, and ONLY for the grey band the rules
//                   score between REVIEW and BLOCK. Novel phrasing is exactly
//                   what patterns cannot cover.
//
// Escalation policy when the LLM is unreachable: a grey-band message is
// published but marked needsReview. Blocking legitimate speech because a
// side-channel is down is the worse failure for a live broadcast, and every
// such decision is written to the audit trail either way.

import { validate } from '../../platform/validate.mjs';
import { classify, RULESET_VERSION, BLOCK_THRESHOLD, REVIEW_THRESHOLD } from './rules.mjs';
import { openModerationStore } from './store.mjs';

const SURFACES = ['post', 'comment', 'live_comment', 'chat', 'profile'];

const ESCALATION_SYSTEM = `You are the moderation escalation for NEU TV, a 24/7 Web3 finance broadcast network.
A deterministic ruleset already scored this message in the grey band and needs a judgement call.
Block only: wallet seed-phrase or private-key phishing, send-to-receive scams, impersonation of NEU TV staff,
targeted harassment, or guaranteed-return investment fraud.
Allow: ordinary trading talk, strong opinions, profanity that is not aimed at a person, hype, and criticism of the network.
Respond with {"verdict":"allow"|"block","reason":"<12 words or fewer>"}.`;

export function createModerationService({
  runtime,
  store = openModerationStore(':memory:'),
  llm = null,                 // contract client for the llm service, or null
  escalationEnabled = true,
}) {
  const escalate = async (text) => {
    if (!escalationEnabled || !llm) return null;
    try {
      const res = await llm.call('llm', 'POST', '/llm/complete', {
        auth: { internal: true },
        body: {
          prompt: `Message to judge:\n<<<${text.slice(0, 2000)}>>>`,
          system: ESCALATION_SYSTEM,
        },
      });
      if (res.status !== 200) return null;
      const raw = String(res.body?.text ?? '');
      const start = raw.indexOf('{');
      const end = raw.lastIndexOf('}');
      if (start === -1 || end <= start) return null;
      const parsed = JSON.parse(raw.slice(start, end + 1));
      if (parsed.verdict !== 'allow' && parsed.verdict !== 'block') return null;
      return { verdict: parsed.verdict, reason: String(parsed.reason || '').slice(0, 120) };
    } catch {
      // A latent-space failure must never take down a live chat.
      return null;
    }
  };

  const record = (decision, surface, userId, text, matches) => {
    store.run(
      `INSERT INTO decisions (id, surface, user_id, verdict, score, escalated, rule_ids, excerpt, ruleset, decided_at)
       VALUES (?,?,?,?,?,?,?,?,?,?)`,
      `mod_${runtime.uuid()}`, surface, userId ?? null, decision.verdict, decision.score,
      decision.escalated ? 1 : 0, JSON.stringify(matches.map((m) => m.id)),
      String(text).slice(0, 280), RULESET_VERSION, runtime.now(),
    );
  };

  return {
    async check(input, { userId = null } = {}) {
      const { text, surface } = validate(input, {
        text: { type: 'string', required: true, min: 1, max: 5_000 },
        surface: { type: 'string', required: false, default: 'chat', enum: SURFACES },
      });

      const rules = classify(text);
      let verdict = rules.verdict === 'review' ? 'flag' : rules.verdict;
      let escalated = false;
      let escalationReason = null;

      if (rules.verdict === 'review') {
        const judged = await escalate(text);
        if (judged) {
          escalated = true;
          verdict = judged.verdict;
          escalationReason = judged.reason;
        }
      }

      const decision = {
        verdict,                                  // 'allow' | 'flag' | 'block'
        allowed: verdict !== 'block',
        needsReview: verdict === 'flag',
        score: rules.score,
        escalated,
        escalationReason,
        matches: rules.matches,
        rulesetVersion: RULESET_VERSION,
        thresholds: { block: BLOCK_THRESHOLD, review: REVIEW_THRESHOLD },
        decidedAt: runtime.now(),
      };

      record(decision, surface, userId, text, rules.matches);
      return decision;
    },

    health() {
      const counts = store.all('SELECT verdict, COUNT(*) AS n FROM decisions GROUP BY verdict');
      return {
        rulesetVersion: RULESET_VERSION,
        thresholds: { block: BLOCK_THRESHOLD, review: REVIEW_THRESHOLD },
        escalation: {
          enabled: escalationEnabled,
          wired: Boolean(llm),
          policy: 'grey-band only; on failure the message publishes flagged for review',
        },
        decisions: Object.fromEntries(counts.map((c) => [c.verdict, c.n])),
      };
    },

    recent: (limit = 50) => store.all('SELECT * FROM decisions ORDER BY decided_at DESC LIMIT ?', limit),

    // --- read ports for the admin CRM (see services/admin/ports.mjs) ------

    summary() {
      const rows = store.all('SELECT verdict, COUNT(*) AS n FROM decisions GROUP BY verdict');
      const counts = Object.fromEntries(rows.map((r) => [r.verdict, r.n]));
      return {
        allow: counts.allow ?? 0,
        flag: counts.flag ?? 0,
        block: counts.block ?? 0,
        escalated: store.get('SELECT COUNT(*) AS n FROM decisions WHERE escalated = 1').n,
        rulesetVersion: RULESET_VERSION,
      };
    },

    // The queue the back office actually works: anything held for review.
    queue({ limit = 50 } = {}) {
      return store.all(
        `SELECT id, surface, user_id AS userId, verdict, score, escalated, rule_ids AS ruleIds,
                excerpt, decided_at AS decidedAt
         FROM decisions WHERE verdict IN ('flag', 'block') ORDER BY decided_at DESC LIMIT ?`,
        Math.min(limit, 200),
      ).map((r) => ({ ...r, escalated: Boolean(r.escalated), ruleIds: JSON.parse(r.ruleIds) }));
    },
    close: () => store.close(),
  };
}
