# NEX Chat · Entity-Disappearance Trace Audit

**Author:** Philip (owner) + Claude (execution)
**Date:** 2026-09-06
**Mode:** **READ-ONLY · trace only · no src/ changes · no accommodation-workforce touch · no visual-design changes.**
**Trigger:** Philip's screen — "need hotel tonight" → "Yep — found 3." → "can i see details" → "Yep — found 3." Same reply. No landscape cards visible.

---

## §1 · Question asked

Which of the following is happening?

- **A** · Directory returns 3 hotels, but they are discarded before the response
- **B** · Directory returns only a count
- **C** · Structured entities reach the frontend but the renderer isn't displaying them
- **D** · Result-follow-up state isn't retaining the result set

---

## §2 · Verdict

**C · with a specific twist that also produces the appearance of D.**

The screen at `/nex-app/chat` calls a **different HTTP endpoint** from the one that serves the conversation orchestrator's structured entities. The screen's endpoint returns text but strips `world_cards`, `entity_result_cards`, and `voice_reply` from its response shape. The client-side page then only reads `{ reply, suggestions, card }` from the response — so even if the endpoint added those fields, the current client would ignore them.

**A · false** · directory does return 3 hotels
**B · false** · directory returns full records
**C · true (specific)** · entities exist server-side but never leave the general-chat endpoint
**D · secondary effect** · without cards to memoize into a client-visible result set, follow-ups like "can i see details" cannot re-anchor

---

## §3 · Live trace evidence

Runner: `tests/fixtures/conversation-followup-proof/_wave5_audit_trace.mjs`
Output: `tests/fixtures/conversation-followup-proof/_wave5_audit_trace.json`

### T1 · "need hotel tonight" via `/api/nex-conv/chat` (the RIGHT endpoint)

```
world_cards        : PRESENT
  vertical         : accommodation
  cards.length     : 3
  totalAvailable   : 521
  headline         : "Showing 3 of 521 real stays."
  card[0].name     : Gaotama Hotel
  card[0].refId    : #AC-2026-0000D
  card[0].keys     : id, vertical, name, subline, location, amenities,
                     verified, provenanceLabel, ownershipState, actions
entity_result_cards: PRESENT · vertical=accommodation · cards.length=3
card (payload)     : kind=accommodation_discovery · payload.hits.length=5
voice_reply.en     : "Yep — found 3."
voice_reply.intent : discovery_hit
reply (long form)  : "I've got 521 real listings for hotels — Gaotama Hotel,
                     Selaras Inn Hotel Yogyakarta, Indonesia Hotel, and more.
                     These are OpenStreetMap community listings so they're for
                     discovery, not live booking..."
```

**Entities exist. Count of 3 is correct. Names carry through. Ref-ids present.**

### T2 · "can i see details" via `/api/nex-conv/chat`

Identical shape to T1: `world_cards.cards.length = 3`, same `voice_reply.en = "Yep — found 3."`, same `reply`. The follow-up is not classified as a result-display request; it just re-runs discovery.

`composition_meta.capability_display_act = "NONE"` — the capability-display gate did NOT fire on "can i see details" (it was designed for "can I book?" / "what you mean I can't book" / "ok show me them", not "can i see details" specifically).

---

## §4 · Where the entities disappear

**Two disappearance points, both in the visible chat surface — NOT in the orchestrator or the accommodation workforce.**

### D-1 · The visible page calls a different endpoint

`src/app/nex-app/chat/page.tsx:4298`

```ts
const res = await fetch("/api/nex/general-chat", { ... });
```

This is **not** `/api/nex-conv/chat`. The `/api/nex-conv/chat` endpoint (the one my trace hits above) is the full conversational orchestrator that returns `world_cards`, `entity_result_cards`, `voice_reply`, and 30+ other fields. `/api/nex/general-chat` is a slimmer wrapper that also calls `orchestrateChatTurn()` internally — but strips the response.

### D-2 · The general-chat endpoint strips the entity fields

`src/app/api/nex/general-chat/route.ts:112-123`

```ts
return NextResponse.json({
  ok: true,
  reply,
  suggestions,
  card,
  theme_command,
  theme_persisted,
  conversation_id: conversationId,
  served_by: "nex-general-chat-v2",
  intent: intent ?? null,
  intent_reason: intent_reason ?? null,
});
```

Fields **present** in `composed` (returned by `orchestrateChatTurn`) but **omitted** from this response:

- `world_cards` (the PresentedCardSet for landscape carousel)
- `world_recommendation`
- `world_comparison`
- `world_reasoning`
- `world_plan`
- `world_expanded_page`
- `voice_reply` (the friend-voice rendering — "Yep — found 3.")
- `entity_result_cards` (Universal Entity Cards)
- `meta_cognition.whatIKnow.entitiesSeen` (session entity roll-up)
- Every Stage-3.14 through Stage-3.41 artifact

The single `card` field IS emitted — but it's the **legacy** `accommodation_discovery` payload with `.payload.hits[]`, not the vertical-agnostic `PresentedCardSet` the modern landscape carousel expects.

### D-3 · The client further ignores what little it gets

`src/app/nex-app/chat/page.tsx:4317-4321`

```ts
const reply = typeof data?.reply === "string" ? data.reply : ...;
const suggestions = Array.isArray(data?.suggestions) ? data.suggestions : undefined;
const card = data?.card && typeof data.card === "object" ? (data.card as CardData) : undefined;
```

Only `reply`, `suggestions`, `card` are read. The client does NOT reference `worldCards`, `WorldCardsInline`, `voice_reply`, `entity_result_cards`, or `chat-artifacts.ts` anywhere in the 10,045-line file.

Grep confirmation (see §7).

### D-4 · The renderer IS available — just not wired in this page

`src/components/nex-app/shell/WorldCardsInline.tsx` exists and is consumed by:

- `src/components/nex-app/shell/ChatSurface.tsx:300` — full production chat surface
- `src/components/nex-app/shell/FriendChatSurface.tsx:244` — friend-voice surface

Both of these are ALREADY correctly wired: they render `<WorldCardsInline cards={nexArtifacts.worldCards} />` when the artifacts extractor returns entities. The chat-artifacts mapper at `src/components/nex-app/shell/chat-artifacts.ts:64-70` extracts `worldCards` from `json.world_cards` — exactly what `/api/nex-conv/chat` emits.

**So the render component is production-ready. It's not mounted on this page.**

---

## §5 · Why "Yep — found 3." on the screen (paraphrase vs literal)

Both endpoints call `orchestrateChatTurn()` internally, so both compute `voice_reply.en = "Yep — found 3."` server-side. The difference is which fields survive to the client:

- `/api/nex-conv/chat` returns `voice_reply` on the JSON payload — the chat-artifacts mapper picks `voice_reply.en` as the visible text
- `/api/nex/general-chat` does NOT return `voice_reply` — the client falls back to `data.reply`, which is the long-form composer text ("I've got 521 real listings for hotels — Gaotama Hotel, Selaras Inn Hotel Yogyakarta, Indonesia Hotel, and more...")

If Philip's screen literally showed "Yep — found 3." (verbatim), his surface is NOT the `/nex-app/chat/page.tsx` code path — it's one of the ChatSurface / FriendChatSurface / nex-app talk paths that already consume `/api/nex-conv/chat`.

If Philip was paraphrasing what he saw (long-form "I've got 521 real listings…" repeated verbatim across two turns), then his surface IS `/nex-app/chat` and the disappearance points are D-1, D-2, D-3 above.

Either way, the client on the current screen does not render a landscape card carousel because the endpoint it calls does not emit the entity payload.

---

## §6 · Follow-up "can i see details" — why the same text repeats

Two independent causes, either of which produces the observed pattern:

1. **Result-set is never memoized on the client** because it never arrived as a structured payload. A follow-up cannot re-anchor to a result set it was never given.

2. Even on the server: the capability-display gate has explicit recognisers for "can I book?" / "ok show me them" / "what you mean I can't book" (see `src/lib/nex/brain/capability-display-intelligence.ts:9-10`) but does NOT currently recognise "can i see details" as `RESULT_DISPLAY_REQUEST`. So the server treats the follow-up as a fresh accommodation intent and re-runs discovery, producing the same reply.

The second cause is a genuine gap in the display-request recognizer, but the first is the primary defect for THIS screen.

---

## §7 · Grep evidence

**Does the visible page ever reference the landscape-card path?**

```
$ grep -n "worldCards\|WorldCards\|world_cards\|artifacts\|voice_reply" \
    src/app/nex-app/chat/page.tsx
[no matches]
```

**Does the general-chat endpoint emit `world_cards` in its response?**

```
$ grep -n "world_cards\|voice_reply\|entity_result_cards" \
    src/app/api/nex/general-chat/route.ts
[no matches]
```

**Does the production endpoint emit them?**

```
$ grep -n "world_cards\|voice_reply\|entity_result_cards" \
    src/app/api/nex-conv/chat/route.ts
1812:  world_cards: composed.world_cards ?? null,
1817:  entity_result_cards: entityResultCardSet,
1848:  voice_reply: (() => {
   ... [30+ more references] ...
```

---

## §8 · Classification of "where entities disappear"

| Layer | Behaviour | Correct? |
|---|---|---|
| Directory / world-adapters | Returns 3 accommodation records | ✓ |
| `orchestrateChatTurn()` in `orchestrate.ts` | Builds `world_cards` from records via `presentRecords()` at line 2915 | ✓ |
| Universal Entity Cards | Built and memoized in composition_meta | ✓ |
| voice-intent-selector | Emits `discovery_hit` with count 3 → "Yep — found 3." | ✓ |
| `/api/nex-conv/chat` response shape | Emits `world_cards`, `entity_result_cards`, `voice_reply` | ✓ |
| `/api/nex/general-chat` response shape | **DROPS `world_cards`, `entity_result_cards`, `voice_reply`** | **✗** |
| `/nex-app/chat/page.tsx` client fetch | **Calls the wrong endpoint (general-chat, not nex-conv)** | **✗** |
| `/nex-app/chat/page.tsx` client destructure | **Reads only `{ reply, suggestions, card }` — no worldCards mapping** | **✗** |
| `ChatSurface.tsx` / `FriendChatSurface.tsx` renderer | Correctly renders `<WorldCardsInline>` when artifacts extracted | ✓ |
| Accommodation Workforce | Not touched · not in this path · NOT to be modified | ✓ |
| Programmer Agent | Not touched · not in this path · NOT to be modified | ✓ |

**The Two-Agent Separation Contract is not implicated. The disappearance is purely in the chat presentation layer.**

---

## §9 · Smallest possible fix (recommended, not applied)

Two small integration changes, both in the presentation layer only:

### Fix option 1 · Route the visible page to the right endpoint

Change `src/app/nex-app/chat/page.tsx:4298` from `/api/nex/general-chat` to `/api/nex-conv/chat`, and adopt the `chat-artifacts.ts` mapper to feed `<WorldCardsInline>`.

- Pros: uses the full existing conversation intelligence (K1/G03/G23/Wave 1-4/Business v1) that the general-chat endpoint doesn't wire
- Cons: many downstream fields differ (`ok`, `theme_command`, etc); risks regressing theme wiring and other client behaviours

### Fix option 2 · Broaden the general-chat endpoint's return

Add `world_cards`, `entity_result_cards`, `voice_reply` to `/api/nex/general-chat/route.ts:112-123` (spread from `composed`) AND wire `<WorldCardsInline>` on the client page after mapping via `chat-artifacts.ts`.

- Pros: minimal change to the client's fetch code; existing `theme_command` / `card` semantics preserved
- Cons: still leaves two divergent endpoints; the smaller "general-chat" starts drifting toward the fuller "nex-conv"

**Neither option touches the accommodation workforce, the programmer agent, or the orchestrator. Both are pure presentation-layer wiring.**

Estimated size of either targeted slice: 2-3 files under a 5-file budget. Requires its own AUTHORIZE.

---

## §10 · What was NOT changed

- Zero src/ file modifications in this audit
- Zero test file modifications
- Zero migrations, zero config, zero dependency changes
- Accommodation Workforce not touched
- Programmer Agent not touched
- Visual design of the chat page not touched

Files created (audit-only):

- `tests/fixtures/conversation-followup-proof/_wave5_audit_trace.mjs` (runner)
- `tests/fixtures/conversation-followup-proof/_wave5_audit_trace.json` (evidence)
- `tests/fixtures/conversation-followup-proof/_wave5_nex_chat_entity_disappearance_audit.md` (this report)

---

## §11 · Recommendation for founder

Authorise a **NEX Chat Presentation Wiring Slice**. Under a 5-file budget:

1. Choose fix option 1 or 2 (recommend option 2 for smaller blast radius — general-chat becomes source-of-truth for that page)
2. Wire `<WorldCardsInline>` on `/nex-app/chat/page.tsx`
3. Extend the capability-display recognizer to include "can i see details" / "let me see them" / "show me the details" as `RESULT_DISPLAY_REQUEST`
4. Verify T2 "can i see details" re-emits entities

**Do not** rewrite the accommodation workforce. **Do not** rebuild the discovery composer. The entities exist and are correct; the plumbing between server response and visible client is what's missing.

---

## §12 · HARD STOP

This is the read-only trace/audit Philip requested. No code changed. Smallest-fix options identified. Awaiting founder authorisation before any src/ modification.
