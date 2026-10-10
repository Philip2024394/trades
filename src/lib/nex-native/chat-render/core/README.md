# chat-render/core · NEVER FORKED

Everything in this folder MUST work identically for every theme.

If a chrome tries to weaken any invariant here, it is a doctrine
violation — reject the PR and file a doctrine amendment instead.

## What belongs in core

- E2E decrypt boundary (`_e2e-decryptor.tsx` in the existing tree)
- Presence roster (`_presence-client.tsx`)
- WebRTC signalling for calls
- Push notifications + service worker glue
- Message send / receive / ack / delete plumbing
- Unread counters + read-receipt propagation
- Gateway audit hooks (Bridge 91/94/95)
- Attachment upload progress + envelope encryption (when Bridge 81
  lands per the phone-is-database doctrine)

## What does NOT belong in core

- Colour palettes → chrome
- Message bubble/row shape → chrome
- Composer shape → chrome
- Header identity glyph → chrome
- Shop slider chrome → chrome
- Product page chrome → chrome
- Bottom-tabs presence → chrome (or omit)

## Phase 1 status

Core code still lives in its historical locations
(`_portrait-bloom-shell.tsx`, `_presence-client.tsx`,
`_e2e-decryptor.tsx`, etc.). Phase 2 lifts the truly-cross-cutting
concerns into this folder as import barrels. For Phase 1 this
folder exists to record the doctrine — no code moves.
