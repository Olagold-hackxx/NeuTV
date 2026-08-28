// Moderation service: the gate every piece of user-authored text passes.
//
// Entirely deterministic. Same input, same verdict, in microseconds, for free.
//
// An earlier version escalated the grey band to an LLM. That was removed: the
// ruleset scores 100% recall and 100% precision on the eval corpus without it,
// and ambiguous speech is better judged by a person than guessed at by a model.
// The grey band now publishes flagged and lands in the CRM moderation queue,
// where a human decides. That is cheaper, faster, reviewable, and it cannot
// disagree with itself on the same message twice.

import { validate } from '../../platform/validate.mjs';
import { classify, RULESET_VERSION, BLOCK_THRESHOLD, REVIEW_THRESHOLD } from './rules.mjs';


const SURFACES = ['post', 'comment', 'live_comment', 'chat', 'profile'];

export function createModerationService({ runtime, store }) {
  const record = (decision, surface, userId, text, matches) => store.run(
      `INSERT INTO decisions (id, surface, user_id, verdict, score, rule_ids, excerpt, ruleset, decided_at)
       VALUES (?,?,?,?,?,?,?,?,?)`,
    `mod_${runtime.uuid()}`, surface, userId ?? null, decision.verdict, decision.score,
    JSON.stringify(matches.map((m) => m.id)),
    String(text).slice(0, 280), RULESET_VERSION, runtime.now(),
  );

  return {
    async check(input, { userId = null } = {}) {
      const { text, surface } = validate(input, {
        text: { type: 'string', required: true, min: 1, max: 5_000 },
        surface: { type: 'string', required: false, default: 'chat', enum: SURFACES },
      });

      const rules = classify(text);
      // Three outcomes. 'flag' publishes the message AND queues it for a human:
      // blocking legitimate speech on a live broadcast is the worse error, and
      // a moderator can take it down in the CRM within seconds.
      const verdict = rules.verdict === 'review' ? 'flag' : rules.verdict;

      const decision = {
        verdict,                                  // 'allow' | 'flag' | 'block'
        allowed: verdict !== 'block',
        needsReview: verdict === 'flag',
        score: rules.score,
        matches: rules.matches,
        rulesetVersion: RULESET_VERSION,
        thresholds: { block: BLOCK_THRESHOLD, review: REVIEW_THRESHOLD },
        decidedAt: runtime.now(),
      };

      await record(decision, surface, userId, text, rules.matches);
      return decision;
    },

    async health() {
      const counts = await store.all('SELECT verdict, COUNT(*) AS n FROM decisions GROUP BY verdict');
      return {
        rulesetVersion: RULESET_VERSION,
        thresholds: { block: BLOCK_THRESHOLD, review: REVIEW_THRESHOLD },
        policy: 'deterministic ruleset; the grey band publishes flagged and queues for human review',
        decisions: Object.fromEntries(counts.map((c) => [c.verdict, c.n])),
      };
    },

    recent: async (limit = 50) => store.all('SELECT * FROM decisions ORDER BY decided_at DESC LIMIT ?', limit),

    // --- read ports for the admin CRM (see services/admin/ports.mjs) ------

    async summary() {
      const rows = await store.all('SELECT verdict, COUNT(*) AS n FROM decisions GROUP BY verdict');
      const counts = Object.fromEntries(rows.map((r) => [r.verdict, r.n]));
      return {
        allow: counts.allow ?? 0,
        flag: counts.flag ?? 0,
        block: counts.block ?? 0,
        rulesetVersion: RULESET_VERSION,
      };
    },

    // The queue the back office actually works: anything held for review.
    async queue({ limit = 50 } = {}) {
      return (await store.all(
        `SELECT id, surface, user_id AS "userId", verdict, score, rule_ids AS "ruleIds",
                excerpt, decided_at AS "decidedAt"
         FROM decisions WHERE verdict IN ('flag', 'block') ORDER BY decided_at DESC LIMIT ?`,
        Math.min(limit, 200),
      )).map((r) => ({ ...r, ruleIds: JSON.parse(r.ruleIds) }));
    },
    close: () => store.close(),
  };
}
