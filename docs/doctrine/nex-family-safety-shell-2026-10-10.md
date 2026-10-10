# NEX Family Safety · Shell + Entry · FS-1 Scope

> 2026-10-10 · authored by FS-1 agent · branch `nex/directory-work`
> No git commits · no pushes · dev server at localhost:3008 live.

## Purpose

This doc is the contract between FS-1 (shell + home + Settings entry)
and FS-2 / FS-3 / FS-4. Read it before mounting any surface under
`/nex-native/family-safety/`.

## What FS-1 provides

### UI primitives (import from `@/components/nex-native/family-safety/*`)

| Export | Path | Role |
|---|---|---|
| `FamilySafetyShell` | `FamilySafetyShell.tsx` | Shell layout wrapper · header + nav chips + content region · pass `activeNav` |
| `FamilySafetyNav` | `FamilySafetyNav.tsx` | Nav chip strip · usually only used via the shell |
| `FamilySafeChatEntryCard` | `FamilySafeChatEntryCard.tsx` | Settings entry card · uses reserved tile |
| `StatusChip` | `StatusChip.tsx` | Pending / active / revoked / expired / suspended / info / neutral chips |
| `SimulatedPilotBadge` | `SimulatedPilotBadge.tsx` | Universal "SIMULATED · PILOT" chip |
| `EmptyState` | `EmptyState.tsx` | Honest empty-state primitive |
| `FAMILY_SAFETY_PALETTE` | `_palette.ts` | Single-source palette · navy + cyan + `familyGreen` |
| `FAMILY_SAFETY_FONT` | `_palette.ts` | Font family · matches product default |

### Types (import from `@/components/nex-native/family-safety/types`)

- `FamilyMembershipState` · `"none" \| "pending_invitation" \| "active_guardian" \| "active_child" \| "suspended" \| "revoked"`
- `FamilyRelationshipRole` · UI mirror of the sealed server-side role tokens
- `FamilySafetyNavKey` · `"home" \| "setup" \| "dashboard" \| "safechat" \| "subscription"`
- `FamilySafetyShellProps` · `{ children, activeNav?, subtitle? }`
- `StatusChipTone` · `"neutral" \| "info" \| "pending" \| "active" \| "revoked" \| "expired" \| "suspended"`
- `StatusChipProps` · `{ tone, label, glyph?, testId? }`
- `FamilyHomeSnapshot` · viewer-centric shape returned by `getFamilyHomeSnapshot`
- `FAMILY_HOME_SNAPSHOT_SAFE_DEFAULT` · the fail-closed shape
- `FAMILY_SAFETY_PILOT_LABEL` · the sealed `"SIMULATED · PILOT"` constant

### Service layer (import from `@/lib/nex-native/family-safety/*`)

| Export | Path | Role |
|---|---|---|
| `isFamilySafetyEnabled()` | `feature-flag.ts` | Default TRUE · false only on literal `"false"` |
| `isFamilySafetyProductionAuthorised()` | `feature-flag.ts` | Default FALSE · true only on literal `"true"` |
| `getFamilyHomeSnapshot({ viewerAccountId })` | `home-service.ts` | Read-only viewer-centric snapshot · default-closed on error |

### Layout + routes

- `src/app/nex-native/family-safety/layout.tsx`
  - Enforces signed-in session (redirects to `/sign-in` otherwise).
  - Enforces `isFamilySafetyEnabled()` (renders inline "not available" UI when FALSE).
  - Does NOT mount the shell · each page mounts its own.
- `src/app/nex-native/family-safety/page.tsx` · the home page.
- `src/app/nex-native/family-safety/not-available/page.tsx` · the honest "unavailable" page for direct linking.

## Contracts for FS-2 / FS-3 / FS-4

### 1 · Always wrap your top-level page in `FamilySafetyShell`

```tsx
import { FamilySafetyShell } from "@/components/nex-native/family-safety/FamilySafetyShell";

export default async function MyPage() {
  // ... session resolution, data fetches
  return (
    <FamilySafetyShell activeNav="setup" subtitle="Optional single-line subtitle">
      {/* your content */}
    </FamilySafetyShell>
  );
}
```

The shell renders: NexPageHeader → back-to-Settings → title + SIMULATED · PILOT → nav chips → your content.

### 2 · Always import types from `types.ts`

Do NOT define a parallel `FamilyMembershipState` in FS-2/3/4. If you need a new state, add it here first.

### 3 · Always import `StatusChip` for status chrome

Red/green/amber chips must come from `StatusChip`. Do NOT inline semantic status colours in your surface — tone semantics are sealed.

### 4 · Honour the feature flag

Server code that materially changes behaviour based on authorised vs. simulated MUST call `isFamilySafetyProductionAuthorised()`. In Phase 1 this always returns FALSE and the SIMULATED · PILOT badge stays visible.

### 5 · Never leak counterparty data on the home page

FS-1's home snapshot is INTENTIONALLY thin · counts + booleans only. If FS-3 wants to show "Elena is linked", FS-3 computes that from its own dashboard service, not from FS-1's snapshot.

## Settings integration

The Settings landing (`src/app/nex-native/settings/page.tsx`) now mounts the Family SafeChat entry via `_family-safe-chat-entry.tsx`. Placement:

```
[ NexPageHeader ]
[ Title · Signed in as … ]
[ EmergencyHelpEntry · pinned-top · UNCHANGED ]
[ FamilySafeChatEntry · NEW · section between pinned-top and groups ]
[ Settings rows grid ]
[ Sign out ]
```

- The 7-group `SETTINGS_GROUPS` IA from `_sections.ts` is untouched. The `_settings-ia.test.ts` seal remains intact.
- The Family SafeChat entry section is OUTSIDE `SETTINGS_GROUPS`, mirroring the `EmergencyHelpEntry` pattern.
- When `isFamilySafetyEnabled()` returns FALSE, `FamilySafeChatEntry` returns `null` and Settings is visually unchanged from before.

## Reserved tile usage

- Asset: `public/nex-family-safety/family-safe-chat-entry-icon.png`
- Mounted at `96×96` by `FamilySafeChatEntryCard` (above the sealed `72×72` floor).
- No redundant text title alongside · `aria-label="NEX Family SafeChat"` is the accessible name.
- Pulse animation is NOT applied (that is sealed to Emergency Help).

## Test coverage shipped by FS-1

- `src/lib/nex-native/family-safety/feature-flag.test.ts` · flag defaults + env parsing
- `src/lib/nex-native/family-safety/home-service.test.ts` · home snapshot resolution + fail-closed
- `src/components/nex-native/family-safety/__tests__/FamilySafeChatEntryCard.test.tsx`
- `src/components/nex-native/family-safety/__tests__/FamilySafetyShell.test.tsx`
- `src/components/nex-native/family-safety/__tests__/StatusChip.test.tsx`
- `tests/e2e/nex-family-safety-shell.spec.ts` · Settings → entry → home · desktop + mobile · asset load

## Prior-art reservation state change

The sealed `nex-family-safety-reserved-ui-assets-2026-10-10.md` doctrine said the reserved tile must NOT be mounted until SafeChat UI is authorised. The founder authorised Family Safety on 2026-10-10. The reservation is now consumed. The reserved asset doctrine remains correct for all OTHER NEX surfaces (do not reuse this tile elsewhere).

As a direct consequence, one subtest in `tests/e2e/nex-emergency-help-entry-asset.spec.ts` has been inverted to assert the ACTIVE mounting instead of the prior reservation-only state. The sealed Emergency Help pinned-top card remains untouched. No emergency source file was modified. No other emergency test was modified.

## What FS-1 did NOT touch

- No FS-2 files (setup, invite, accept, link, pressure signal).
- No FS-3 files (dashboard, safechat, contact visibility).
- No FS-4 files (subscription, end-to-end spec).
- No `src/lib/nex-native/family-links/*` (sealed primitives).
- No `src/lib/nex-native/safechat/*` (sealed classifier).
- No `src/app/nex-native/emergency-help` or any file under `src/components/nex-native/emergency/*` or `src/lib/nex-native/emergency/*`.
- No new npm dependency.
- No migration.
- No git commit, no git push.

## Open follow-ups for the orchestrator

- FS-2 / FS-3 / FS-4 ship their routes under `/nex-native/family-safety/*`. Each should wrap its top-level page in `FamilySafetyShell` with the correct `activeNav`.
- When Phase 2 is authorised, flip `isFamilySafetyProductionAuthorised()` via env; the SimulatedPilotBadge honours the `live` prop so sub-surfaces can suppress it from a server-side check at that time.
