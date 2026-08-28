// Bump MINOR for additive routes/fields. Bump MAJOR for any breaking change,
// and update both sides in the same commit (services-first rule: a coordinated
// cross-service edit IS a contract change and gets called out explicitly).
//
// 2.0.0 - BREAKING: removed the llm service and the moderation escalation that
//         used it. The deterministic ruleset scores 100% recall and 100%
//         precision on the eval corpus without it, and ambiguous speech now
//         goes to the CRM moderation queue for a human rather than to a model.
//         Nothing else calls /llm/*, so no caller needs migrating.
// 1.1.0 - additive: the admin/CRM service (video library, programming, CRM
//         rollups), the broadcast stage state machine on live, and a `role`
//         claim on the identity session. No existing route changed shape.
export const CONTRACT_VERSION = '2.0.0';
export const API_PREFIX = '/api/v1';
