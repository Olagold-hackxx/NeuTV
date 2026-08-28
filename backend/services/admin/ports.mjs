// CRM read ports.
//
// The admin service aggregates numbers that live in other services' databases.
// It must not open them, and exposing "list every viewer" or "dump the
// moderation log" as public contract routes would widen the API for one
// back-office screen. So the reads arrive as injected capability objects, wired
// at the composition root (services/gateway/compose.mjs) from each service's
// own read-only methods.
//
// Every port is optional. An unwired port yields null in the rollup rather than
// an error, so the CRM degrades to "what it can see" instead of failing whole.
//
//   viewers.summary()        -> { total, newLast7d, byProduct: {..} }
//   viewers.list({ limit })  -> [{ id, name, handle, badge, productId, createdAt }]
//   spend.summary()          -> { coinsSpent, gifts, topGift }
//   spend.byUser()           -> { [userId]: { spent, gifts } }
//   moderation.summary()     -> { allow, flag, block, escalated }
//   moderation.queue({limit})-> [{ id, surface, verdict, excerpt, decidedAt }]
//   engagement.summary()     -> { posts, comments, upvotes }

export const PORT_NAMES = ['viewers', 'spend', 'moderation', 'engagement'];
