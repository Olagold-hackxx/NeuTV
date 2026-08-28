# gateway

Owns sockets, and only sockets.

- resolves the bearer token to a session via `identity`
- enforces the auth level the **contract** declares for each route, including
  the admin gate — once, here, rather than in eleven handlers
- applies per-route rate limits keyed by user or address
- parses JSON bodies with a 1 MB cap, or hands raw streams to upload routes
- serves SSE for `/live/stream`
- serves the frontend and `/media/*` with byte-range support and path-traversal
  refusal

`compose.mjs` is the composition root: the only file that knows every service
exists. It builds them, gives them their stores, and wires the cross-service
edges (`wallet.events` → live's gift banner, admin's CRM ports). Deleting a
service from that file removes it from the deployment without touching any
other service.

Tests: `npm run test:gateway` — contract conformance, platform primitives, and
an HTTP suite that runs against a real listening server, because auth, ranges,
uploads and SSE only misbehave once a socket is involved.
