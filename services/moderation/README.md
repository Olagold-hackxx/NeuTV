# moderation

The gate every piece of user-authored text passes through.

## Two lanes

**Deterministic** (`rules.mjs`) — seed-phrase phishing, doubling scams, wallet
connect bait, staff impersonation, guaranteed-return fraud, off-platform
funnels, link shorteners, targeted abuse, shouting, flooding. Free,
microseconds, identical verdict every time, and the only lane the gate tests
depend on.

**Latent** — only the grey band between the review (35) and block (70)
thresholds escalates, and only to local Claude Code through the `llm` service.
Obvious passes and obvious blocks never cost a token.

## Evasion passes

Each pass undoes one trick, and a rule hits if *any* pass matches, so a pass can
only add coverage:

| Pass | Defeats |
| --- | --- |
| `normalize` | case, zero-width padding, Cyrillic homoglyphs |
| `deleet` | `pr1v4te k3y` |
| `despace` | `p r i v a t e   k e y` |

`normalize` deliberately leaves digits alone. Folding `1`→`i` and `0`→`o` as the
only pass destroyed every numeric rule, and `send 1 ETH get 2 back` walked
straight through.

## Failure policy

If the LLM is unreachable, a grey-band message **publishes flagged for review**
rather than being blocked. Taking a live chat down because a side channel is
unavailable is the worse failure. A malformed or hostile model reply is
discarded, never obeyed. Every decision is written to an audit trail that the
CRM reads as its queue.

Eval: recall on an abuse corpus and precision on a clean corpus of ordinary
trading talk, scored as the harmonic mean, threshold 90%. Currently 100/100.
