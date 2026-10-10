# NEX Family Safety · Reserved UI Assets
> 2026-10-10 · founder-provided tile artwork · reserved for the future authorised builds

## Family SafeChat entry tile
**Asset:** `public/nex-family-safety/family-safe-chat-entry-icon.png`
**Content:** 3D-rendered tile · navy background · cyan outer border · parent/child family silhouette on a shield, with a chat bubble (orange + white) · "FAMILY SAFE" (white) and "CHAT" (cyan) wordmark baked in · square aspect.
**Reserved for:** the future Family SafeChat UI entry card (not yet authorised). When the SafeChat Phase 2+ UI wave is authorised, the implementing agent MUST use this file as the hero icon for the Family SafeChat entry point.
**Visual language:** same tile family as `nex-emergency/safety-concern.png` and `nex-emergency/medical-concern.png` and `nex-emergency/emergency-help-entry-icon.png`. The tile is complete with its own baked-in text label — the entry card must not add a redundant text title on top of the tile; use `aria-label` for accessibility and leave the visual to the image.
**Do not:** resize below 72×72 (baked-in text becomes illegible), recolour, or use for any other feature.
**Phase gating:** SafeChat UI remains NOT AUTHORISED. This asset is RESERVED only — do not mount it in any surface until a separate build authorisation is granted.

## NEX Emergency Help entry tile
**Asset:** `public/nex-emergency/emergency-help-entry-icon.png`
**Content:** 3D-rendered tile · navy background · cyan outer border · red emergency beacon/siren with white cross (medical) + light-rays halo · "EMERGENCY" (white) and "HELP" (orange) wordmark baked in · square aspect.
**Current usage:** mounted in `src/components/nex-native/emergency/EmergencyHelpEntryCard.tsx` at 80×80 inside the Settings pinned-top entry card. Pulses via the sealed `nex-emergency-pulse` keyframe. Replaced the prior ❤ unicode glyph.
**Do not:** remove the pulse animation (sealed), resize below 72×72, or decouple from the sealed `/nex-native/emergency-help` destination route.

## Prior sealed assets (reaffirmed · untouched by this reservation)
- `public/nex-emergency/medical-concern.png` · Medical concern category button on the confirmation screen · 2-tap flow
- `public/nex-emergency/safety-concern.png` · Safety concern category button on the confirmation screen · 2-tap flow

## Doctrine for future tile additions
All NEX Family Safety / Emergency tiles share:
- Navy background (`#020914`)
- Cyan outer border (`#00AFFF` outline + glow)
- 3D-rendered central glyph with baked-in text label
- Square or near-square aspect
- No vendor branding
- Dignified · never alarming beyond what the function warrants

Any new tile proposed outside this file must be adopted via a founder-approved asset reservation addendum.
