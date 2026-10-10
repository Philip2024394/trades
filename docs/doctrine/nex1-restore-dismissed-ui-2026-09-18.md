# Restore-Dismissed Banners UI · Closure Doctrine

**Date:** 2026-09-18
**Batch:** Frontier §17 queue · twenty-third slice · after chip click-to-expand modal.
**Authority:** Founder "continue" · §10 smallest-slice choice · closes limit §5.1 of the persist-dismissals closure ("No client-side undismiss UI").
**Author:** master_ai_engineer (Claude Opus 4.7)

---

## §1 · Target

Give the founder a UI surface for the `DELETE /api/nex1/banner-dismissals` path that Phase-4c-adjacent slice already built. Without this UI, dismissed patterns could only be un-dismissed via curl. This slice adds a small collapsible section to the Notes panel that lists every currently-dismissed pattern with a per-row **Restore ↺** button.

**Banner polish arc completion:** three prior slices delivered the auto-suggest banner + slug picker + persistent dismissals. This slice closes the loop — founder can now change their mind about a dismissal without touching a terminal.

---

## §2 · Mutation (files touched)

| File | Kind | LOC | Purpose |
|------|------|-----|---------|
| `src/app/nex1/workstation-live/agent/NotesPanel.tsx` | Modified · ~40 LOC added | (a) `persistedDismissals` state + `dismissalsCollapsed` toggle + `restoring` per-row state; (b) `refreshDismissals` callback replaces the previous inline hydrate; (c) `restoreDismissal` fires DELETE + optimistic UI + re-fetch; (d) new collapsible section rendered above Verdict trail |
| `src/app/nex1/workstation-live/agent/nex-agent-workstation.css` | Modified · ~40 LOC added | `.naw-dismissed-toggle` (collapse header) + `.naw-dismissed-item` (row) + `.naw-dismissed-prefix` (code chip) + `.naw-dismissed-restore` (cyan-accent restore button) |

**Zero touches on:**
- Persistence layer (endpoint + JSONL already existed from prior slice)
- Auto-suggest banner code (banner state already reads from the same `bannerDismissed` set)
- Truth Engine, Q7/Q8, safety gate, pricing.ts

---

## §3 · Design

### §3.1 · Collapsed by default

The section header shows `▸ Dismissed patterns · <count>`. Founder clicks to expand. When collapsed, it doesn't clutter the Notes panel — it just says "N patterns are being suppressed" as a passive count. When expanded, it lists every one with a restore button.

### §3.2 · Optimistic UI + re-fetch confirmation

`restoreDismissal` fires the DELETE, immediately removes the prefix from `bannerDismissed` + `persistedDismissals` state, then re-fetches to reconcile with server truth. If the DELETE somehow failed, the re-fetch corrects the state.

### §3.3 · Shared state with the banner section

`bannerDismissed` (used by the auto-suggest banner logic) and `persistedDismissals` (used by this restore UI) are BOTH populated by `refreshDismissals`. Same source of truth. When founder restores a prefix here, the banner section will start auto-suggesting for that pattern again on the next matching refusal.

### §3.4 · Only renders when non-empty

If no patterns are dismissed, the section doesn't render at all. Zero cognitive weight for a first-time founder.

### §3.5 · Accessibility

`<button>` with `aria-expanded={!dismissalsCollapsed}` for the collapse toggle. Restore buttons have `title` tooltips explaining the action. Keyboard focus works because these are semantic buttons, not `<div onClick>`.

---

## §4 · Verification · real HTTP + hot-reload

### §4.1 · Seed 3 dismissed prefixes

```
POST /api/nex1/banner-dismissals × 3
GET /api/nex1/banner-dismissals
  → prefixes=["alpha one","beta two","fgh ij","gamma three","gubbins the","klm no"]
```

Note: the store already had 3 prefixes from earlier test runs (`fgh ij`, `gubbins the`, `klm no`). My probe seeded 3 more (`alpha one`, `beta two`, `gamma three`). The list is properly persistent across prior probe activity — that's part of the correctness proof.

### §4.2 · Simulate a Restore click (DELETE)

```
DELETE /api/nex1/banner-dismissals { prefix: "beta two" }
  → ok=true · prefix="beta two"
```

### §4.3 · Confirm removal

```
GET /api/nex1/banner-dismissals
  → prefixes=["alpha one","fgh ij","gamma three","gubbins the","klm no"]
```

`beta two` is gone. `alpha one` and `gamma three` (the other two I seeded) remain. **Prior-test prefixes preserved** — this is the correct behaviour, not a bug: undismiss only affects the specified prefix. My probe's "✗ mismatch" flag was because the assertion checked for exact-match against my 3 seeds only, forgetting the store contained 3 more from earlier probe runs. Recorded honestly · not a real failure.

### §4.4 · Bulk restore all my seeded prefixes

```
DELETE × 2 (alpha one, gamma three)
GET (filter for probe prefixes only)
  → probe prefixes remaining after all-restore=0 ✓
```

### §4.5 · Hot-reload survival

```
touch src/app/api/nex1/banner-dismissals/route.ts
sleep 6s
GET (filter for probe prefixes only)
  → post-reload · probe prefixes remaining=0 ✓
```

Turbopack rebuilt the module · dismissal store re-hydrated from disk · restored state persisted correctly.

### §4.6 · Workstation renders

```
GET /nex1/workstation-live → HTTP 200
```

### §4.7 · Zero-LLM audit

```
NotesPanel.tsx                   → CLEAN (0 llm markers)
nex-agent-workstation.css        → CLEAN
```

---

## §5 · Honest limits

1. **UI verified via data plane · not headed browser.** The section render, collapse toggle, restore-button click, optimistic state transition — all standard React patterns. My probe verified every server response the UI reads (§4.2 → §4.3 → §4.5 chain). Founder verifies the actual render visually.
2. **§4.3 "✗ mismatch" flag was a probe artefact, not a real failure.** My probe assertion checked for exact-set equality but ignored that the store legitimately contained prior-test prefixes. The actual DELETE worked correctly (proven in §4.4). Left the trace visible above rather than editing it out.
3. **No bulk-restore button.** Founder restores one at a time. If the list ever grows large, a "restore all" button would be a small next slice.
4. **No confirmation before restore.** One click and it's gone. This is deliberate — dismissals are cheap to re-set if the founder changes their mind again. No modal fatigue.
5. **List doesn't paginate.** If founder somehow accumulates 100+ dismissals, all render in one scroll. Practical count is likely single digits — trivial for now.
6. **Order is alphabetical (from server).** Not by dismissal time. If founder wants "most recently dismissed first", that would require the endpoint to expose event timestamps · small extension.

---

## §6 · Registry classification

| Capability | State | Evidence |
|-----------|-------|----------|
| Dismissal list rendered in Notes panel | **AVAILABLE_NOT_FULLY_VERIFIED_IN_BROWSER** | Standard React collapsible section · headed test blocked · founder verifies |
| Restore click → DELETE → refresh cycle | **RUNTIME_VERIFIED (data plane)** | §4.2 → §4.3 · DELETE removes the specified prefix cleanly |
| Bulk restore via multiple clicks | **RUNTIME_VERIFIED** | §4.4 · repeated DELETE calls work independently |
| Hot-reload preserves restored state | **RUNTIME_VERIFIED** | §4.5 |
| Shared state with banner logic | **VERIFIED_BY_INSPECTION** | `refreshDismissals` populates both `bannerDismissed` and `persistedDismissals` |

**Application-wide zero-LLM** remains not-claimed as an all-app property.

---

## §7 · Try it live

```
1. Open /nex1/workstation-live · switch to Notes tab
2. If any patterns are dismissed, scroll to "▸ Dismissed patterns · N"
3. Click to expand
4. Click "Restore ↺" on any row
5. That row disappears · list count decrements
6. If the founder now triggers a matching refusal pattern (say the phrase
   the same way twice), the auto-suggest banner resurfaces for it
```

---

## §8 · Banner polish arc · complete

Four slices delivered end-to-end control over the auto-suggest banner:

| Slice | Delivers |
|-------|----------|
| C10→C2 auto-suggest banner | Detection + one-click teach |
| In-banner slug picker | Founder overrides suggestion inline |
| Persist dismissals | "Not this one" survives restart |
| **Restore-dismissed UI (this)** | **Founder can undo a dismissal** |

Every action the founder can take on the banner is now reversible or persistent. No dead-end states.

---

## §9 · What is NOT in this batch

- Bulk-restore button
- Confirmation modal before restore
- Sort-by-recency
- Pagination
- Truth Engine, Q7/Q8, safety gate changes

---

## §10 · Queue after this

- **Clickable provenance in the chip modal** — deep-link trace_key values to the task step timeline. ~50 LOC.
- **Envelope-history archive endpoint** — move task JSONL files older than N days. ~60 LOC.
- **Per-round envelope logging** — instrument nex2/nex3 review paths. ~120 LOC.
- **Copy-envelope-as-JSON button in the modal** — one-click clipboard. ~15 LOC.
- **Scheduled auto-compaction cron** — weekly hit to /api/nex1/logs/compact. ~30 LOC.
- **C6 Rule Algebra** — parse doctrine markdown into gating rules. ~800 LOC.

Say **"continue"** for **clickable provenance in the chip modal** (~50 LOC · natural extension · closes another modal limit) or name a different item.
