# wallet

KashCoin balances, the ledger behind them, and gifting.

- **Double entry.** Every movement writes two rows summing to zero, so
  `SELECT SUM(amount) FROM entries` is always `0`. That invariant is a gate
  test and is surfaced in the CRM as `ledgerBalanced`.
- **Balances are derived** with `SUM()`, never cached in a column.
- **Cost comes from the catalog**, never the request. A client sends a
  `giftId`; a client-supplied price is ignored.
- **Idempotent by reference.** A retried tip replays the original transaction
  instead of charging twice, and emits no second gift banner.
- **Opens at zero.** There is no path that credits an account on creation.

A tip emits a `gift` event through an injected sink. The wallet does not know
the live stage exists; `services/gateway/compose.mjs` wires the two.

Tests: `npm run test:wallet`.
