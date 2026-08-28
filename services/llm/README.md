# llm

The only place in this backend that reaches latent space, and the only place
that spawns a process.

**Local Claude Code, never a hosted API.** No `ANTHROPIC_API_KEY`, no HTTP call
to an inference endpoint. The service discovers the Claude Code binary
(`NEUTV_CLAUDE_BIN`, then common install paths, then `PATH`) and shells out to
it.

- The default model is `claude-opus-5` and nothing downgrades it silently.
- The prompt is passed as an argv entry, never interpolated into a shell.
- Discovery never throws. If Claude Code is not installed, `/llm/health`
  reports `available: false` with everywhere it looked, and callers take their
  deterministic fallback.
- Timeouts, non-zero exits and empty replies all surface as `503`.
- `completeJson()` digs an object out of prose or a code fence, and refuses to
  invent structure when there is none.

**Verification note:** the CLI argument shape is exercised through an injected
`exec`, so parsing, timeouts, and error handling are all covered by tests. The
handshake against a real `claude` binary is *unverified on this machine* —
Claude Code is not installed here. Run `curl localhost:4173/api/v1/llm/health`
on a host that has it to confirm.

Tests: `npm run test:llm`.
