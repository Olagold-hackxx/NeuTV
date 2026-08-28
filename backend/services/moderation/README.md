# moderation

The gate every piece of user-authored text passes through. **Entirely
deterministic** — no model, no network call, no per-message cost.

## Rules

Seed-phrase phishing, doubling scams, wallet connect bait, staff impersonation,
guaranteed-return fraud, off-platform funnels, link shorteners, targeted abuse,
shouting, flooding. Scored, thresholded, and identical every time.

## Three outcomes

| Verdict | Score | What happens |
| --- | --- | --- |
| `allow` | < 35 | Publishes. |
| `flag` | 35-69 | **Publishes AND queues for a human** in the CRM. |
| `block` | >= 70 | Never lands. |

The middle row is the design decision worth knowing. An earlier version sent the
grey band to an LLM for a judgement call. That was removed: the ruleset already
scores 100% recall and 100% precision on the eval corpus without it, and
ambiguous speech is better judged by a person than guessed at by a model. A
moderator pulls a bad message from `/admin/crm/moderation` in seconds; a model
would have cost tokens on every ambiguous message forever and disagreed with
itself on re-runs.

Blocking legitimate speech on a live broadcast is the worse error, so the grey
band publishes rather than holds.

## Evasion passes

Each pass undoes one trick, and a rule hits if *any* pass matches, so a pass can
only add coverage:

| Pass | Defeats |
| --- | --- |
| `normalize` | case, zero-width padding, Cyrillic homoglyphs |
| `deleet` | `pr1v4te k3y` |
| `despace` | `p r i v a t e   k e y` |

`normalize` deliberately leaves digits alone. Folding `1`->`i` and `0`->`o` as
the only pass destroyed every numeric rule, and `send 1 ETH get 2 back` walked
straight through.

Every decision is written to an audit trail that the CRM reads as its queue.

Eval: recall on an abuse corpus and precision on a clean corpus of ordinary
trading talk, scored as the harmonic mean, threshold 90%. Currently 100/100.

Tests: `npm run test:moderation`.
