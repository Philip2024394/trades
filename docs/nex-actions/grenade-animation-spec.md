# NEX Grenade · Animation Specification

**Status:** Locked · Philip 2026-08-25
**Bar:** Signature NEX-quality interaction. Not a normal delete animation.
**Registry row:** `NEX_ACTIONS` id `grenade` (tier: consumable · cost: 100 Sparks).

## Purpose

The grenade is the first Tier-4 consumable and the flagship demonstration
that the whole NEX Action platform is real end-to-end:

```
mascot → cinematic animation → server action → state change → wallet decrement → audit line
```

If this chain is beautiful, the architecture is proven. If it's cheap, the
whole platform reads as a toy.

## Choreography · exact sequence

The grenade animation runs on the CLIENT as a purely visual representation
of the confirmed server action. The server-authoritative deletion is the
source of truth · the animation is the premium presentation.

Total duration target: **~4 seconds** end to end.

### Frame 1 · Entry (0 → 0.5s)
- Grenade mascot enters the message area with polished cinematic motion.
- Enters from top-right (matching tray direction). Uses `translateY` +
  `translateX` interpolation with soft ease-out.
- Reaches its landing position (centered over the target bubble) with a
  slight bounce (10% overshoot then settle).

### Frame 2 · Impact reaction (0.5 → 0.9s)
- The target bubble VISIBLY REACTS to the impact:
  - Subtle deformation: `scale(1.02, 0.98)` then back to `scale(1)`.
  - Micro-shake: 3-4 px horizontal wobble, 2 cycles at ~60ms each.
- Grenade mascot settles on top of the bubble, tilted ~5° to feel natural.

### Frame 3 · Fuse burn (0.9 → 2.4s · ~1.5s)
- The grenade's fuse burns with animated sparks + a wisp of smoke.
  - 3–5 warm-orange spark particles emit per frame from the fuse tip.
  - Sparks arc outward, fade in ~0.5s.
  - Thin grey smoke trail rises from the fuse.
- Optional: soft cracking sound if audio is enabled (not required for MVP).

### Frame 4 · Explosion (2.4 → 3.2s · ~0.8s)
- **Strong but elegant impact.** Not cartoonish.
- Bubble expands ~15% then bursts:
  - `scale(1.15)` at 2.5s
  - Fragment particles fly outward in 8 directions (small triangular shards).
  - Brief white flash (opacity 0.6 → 0 over 100ms) centered on the bubble.
  - Grenade mascot disappears in the burst.
- Surrounding UI reacts subtly:
  - Adjacent bubbles shake ~2 px for 200ms.
  - Whole chat frame does a barely-perceptible ~4 px shake.

### Frame 5 · Dissipation (3.2 → 4.0s · ~0.8s)
- Smoke particles drift upward and fade.
- Fragment particles decelerate + fade with `opacity` easing.
- Chat layout reflows naturally: subsequent bubbles slide up smoothly
  (~250ms ease) to fill the void.

### Frame 6 · History line appears (4.0s onward · persistent)
- In the EXACT position where the exploded bubble sat, render a small
  understated system line:

```
💣 Philip grenaded this post · 12:07 PM · 23/08/2026
```

## History line specification

**Style:**
- Small: font-size 11px (vs 14px for normal message body).
- Understated: `color: NEX.textFaint` (`#6B7280`).
- Visually integrated: no border · no background · no icon backdrop ·
  centered in the row · left-aligned or centered per surrounding messages.
- Clearly different from a normal user message: no bubble container, no
  avatar, no reactions row.
- Persistent: never fades out after the animation.
- Feels like NEX is recording a memorable action, not a moderation notice.

**Content:**
- The 💣 glyph is text-based, not an image (so the line stays crisp at any
  zoom and adapts to the user's font stack).
- `{actorName}` is the display name of the user who invoked grenade · read
  from the confirmed server response, never hardcoded.
- `{time}` is the actual server-recorded event time in the viewer's local
  timezone. Format: `HH:MM AM/PM` (12-hour · locale-aware).
- `{date}` is the same event's date in the viewer's locale (DD/MM/YYYY
  for GB, MM/DD/YYYY for US, DD MMM YYYY for ID · runtime locale-aware).
- Separator: middle dot ` · ` (Unicode U+00B7).

**Template:**
```
💣 {actorName} grenaded this post · {time} · {date}
```

## Do NOT

- ❌ Do not make the history line look like an error, deleted-message
  warning, or ugly moderation notice.
- ❌ Do not hardcode the timestamp, actor, or date. Always render from the
  confirmed server response.
- ❌ Do not use a red / danger color palette. Warm neutral only.
- ❌ Do not make the explosion cartoonish. Physical, cinematic, controlled.
- ❌ Do not let the animation run BEFORE the server confirms the delete.
  The server response is the trigger. Optimistic UI would risk a rollback
  and there is no elegant way to un-explode a bubble on the client.
- ❌ Do not allow the animation to interrupt or block other chat input.
  It is a visual layer over the deleted bubble's former space.

## Reduced-motion accessibility

Users with `prefers-reduced-motion: reduce` get:
- No entry animation · grenade mascot appears instantly on the bubble.
- No fuse burn · no sparks · no smoke.
- No explosion · bubble fades out over 400ms.
- History line appears as normal.

This preserves the audit-visible outcome without triggering vestibular
sensitivity.

## Server authority

- The client shows the animation ONLY after receiving a confirmed
  `{ ok: true, kind: "message-deleted", messageId, historyLine }` from
  `runNexAction("grenade", ...)`.
- On any failure (insufficient Sparks · rate limit · network) the client
  shows a small toast · no animation runs · target bubble unchanged.
- The audit line format is server-generated so all clients render identical
  history (avoids locale drift between sender's view and recipient's view).

## Sound (optional · post-MVP)

- Fuse: subtle crackle loop (~40dB below max).
- Explosion: single dampened whump (not a boom · not a screech).
- Respected by user's system audio preference.
- Gated behind a per-user setting: `nex.chat.reactionSounds = true|false`.

## Related · not this spec

- Wallet decrement (100 Sparks) is documented in the wallet layer spec.
- Server-side soft-delete + audit table schema is documented in F3.
- Refund on animation failure is documented in the runtime spec.
