// Consent scopes rendered in the SSO gate's permissions checklist (PRD 4.4).
//
// Every scope a product can grant is declared here and returned to the client
// verbatim, so the checklist a viewer agrees to is the same list the backend
// stores on the grant. A checklist written in JSX and a permission enforced in
// the API that drift apart is how consent becomes a lie.

export const COMMON_SCOPES = [
  { id: 'profile:read',    label: 'Public profile access',            detail: 'Name, handle, avatar and verified badge.', required: true },
  { id: 'broadcast:watch', label: 'Full HD live broadcast streaming', detail: '24/7 linear stage at 1080p with interactive overlays.', required: true },
  { id: 'chat:write',      label: 'Interactive chat and reactions',   detail: 'Post to the live ticker, hub channels and reaction stream.', required: true },
  { id: 'hub:join',        label: 'Official community hub access',    detail: 'Join the product hub and its channels.', required: true },
];

export const PRODUCT_SCOPES = {
  worldstreet: [
    { id: 'trade:mirror', label: 'Automated trade mirroring', detail: 'Mirror verified 20x leverage setups broadcast on the stage.', required: false },
  ],
  market: [
    { id: 'escrow:authorize', label: 'Zero-gas escrow authorization', detail: 'Authorize peer-to-peer smart escrow from storefront cards.', required: false },
  ],
  linkpay: [
    { id: 'offramp:route', label: 'Instant offramp routing', detail: 'Route 2-second USD settlements to a linked bank account.', required: false },
  ],
  ark: [
    { id: 'vault:read', label: 'Vault position telemetry', detail: 'Read algorithmic yield positions for rebalancing reports.', required: false },
  ],
  tsioncars: [
    { id: 'title:verify', label: 'Vehicle title authentication', detail: 'Verify onchain title and escrow delivery status.', required: false },
  ],
};

export const scopesFor = (productId) => [...COMMON_SCOPES, ...(PRODUCT_SCOPES[productId] || [])];

export const scopeIdsFor = (productId) => scopesFor(productId).map((s) => s.id);

export const hasScope = (grantedScopes, scopeId) =>
  Array.isArray(grantedScopes) && grantedScopes.includes(scopeId);
