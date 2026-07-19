# Safe to Delete — Thenetworkers

_Generated 2026-07-17. Each entry has PROOF (import count from ripgrep across `src/`). Only delete after re-verifying — production code changes daily._

**Confidence legend:** OK-safe (0 imports) · VERIFY (looks orphan but has weak references or side-effects) · DO-NOT-DELETE (still imported)

---

## 1. Explicit deprecation markers

Scanned `src/` for `@deprecated`, `// LEGACY:`, `// DEAD:`, `// TODO: remove`, `// TODO: delete`, `// TO DELETE`, `// REMOVE ME`.

| Path | Marker | Line |
|---|---|---|
| _(none found)_ | — | — |

Zero explicit deprecation markers exist in `src/`. The team has never annotated dead code with a machine-readable marker. Future rule: adopt `@deprecated` in JSDoc so this scan becomes useful.

---

## 2. Backup / WIP files

Globbed `**/*.bak`, `**/*.old`, `**/*.wip.*`, `**/*.deprecated.*` under the repo root.

| Path | Verdict |
|---|---|
| _(none found)_ | — |

Zero backup files at rest. Good hygiene.

---

## 3. Orphan apps in `src/apps/`

For each candidate, ran `rg "apps/<name>"` across `src/`. Manifest.ts presence checked against `src/apps/*/manifest.ts` glob and the App Registry loader at `src/platform/bootstrap.ts` (only `tradecenter`, `orders`, and `live-feed` are hand-registered — the rest self-register via manifest side-effect).

| App | Has manifest.ts? | External imports | Verdict |
|---|---|---|---|
| `src/apps/completer` | NO | 1 (`src/app/tc/jobs/[slug]/page.tsx` line 18 imports `FinishTheJobPanel`) | DO-NOT-DELETE — live route dependency, though App-Registry-invisible. Fix by adding a `manifest.ts`, not deleting. |
| `src/apps/deals` | NO | 1 (`src/app/tc/deals/page.tsx` line 20 imports `allDeals`) | DO-NOT-DELETE — live route dependency. Same fix: add manifest. |
| `src/apps/jobs` | NO | 9 files, incl. `src/app/tc/jobs/page.tsx`, `.../[slug]/page.tsx`, `.../new-site/page.tsx`, `apps/hub/*Rail.tsx` | DO-NOT-DELETE — heavily used. |
| `src/apps/jobBoard` | NO | 4 files (`tc/job-board/*`, `tc/favourites`, `tc/post-job`) | DO-NOT-DELETE — powers the entire `/tc/job-board` surface. |
| `src/apps/tradeCounter` | NO | 5 files (`tc/trade-counter/*`, `hub/LeftMenuRail`, `yard/TradeCounterSlideOut`) | DO-NOT-DELETE — powers `/tc/trade-counter`. |

**Take-away:** none of the manifest-less apps are orphan. All are live via `src/app/tc/*` file-routed pages. The real fix is to add `manifest.ts` files so they show up in the registry — not deletion.

---

## 4. SUPERSEDED memory file

`C:\Users\Victus\.claude\projects\C--Users-Victus\memory\feedback_studio_addon_wrapper_pattern.md`

- Exists: **yes**
- Back-references from other memory files (grepped `studio_addon_wrapper|studio-addon-wrapper` across the memory directory): **0**
- MEMORY.md index entry for it: **no** (not listed in the visible index)

**Verdict:** OK-safe. Not referenced by anything else in the memory folder or the index. Delete to shrink MEMORY.md's implicit surface area.

---

## 5. Random orphan check (`src/components/xrated/*`)

Picked the first 10 files. For each, grepped for both the identifier name and the exact `from "@/components/xrated/<name>"` import path. Counts below are **external** references (self-file mentions excluded).

| File | External import sites | Verdict |
|---|---|---|
| `AvatarFrame.tsx` | 4+ (widely used) | DO-NOT-DELETE |
| `BurgerMenu.tsx` | 1 (`app/trade/[slug]/page.tsx`) | DO-NOT-DELETE |
| `CookieConsentBanner.tsx` | 1 (`app/layout.tsx`) | DO-NOT-DELETE |
| `FollowButton.tsx` | 1+ (`apps/social/components/FollowButton.tsx` is a distinct file — same name, different path) | DO-NOT-DELETE |
| `HeaderCartButton.tsx` | 1 (`app/trade/[slug]/page.tsx`) | DO-NOT-DELETE |
| `HeroStatusStrip.tsx` | 1 (`app/trade/[slug]/page.tsx`) | DO-NOT-DELETE |
| `HeroTextOverlay.tsx` | 1 (`app/trade/[slug]/page.tsx`) | DO-NOT-DELETE |
| `NotebookBell.tsx` | 0 external imports | **OK-safe (verify)** — only self-references. See note below. |
| **`ProfileInfoCard.tsx`** | **0 external imports** | **OK-safe** — only self-references (own `export function` and `export default`). Confirmed orphan. |
| `RunningMarquee.tsx` | 1 (`components/xrated/HeroStatusStrip.tsx`) | DO-NOT-DELETE |

**Confirmed orphans in this random sample:** `ProfileInfoCard.tsx` (4 KB) and likely `NotebookBell.tsx`.

Note on `NotebookBell.tsx`: search returned only its own file (definition + default export). It may still be dynamically imported by string, so classify VERIFY rather than pure safe. Grep the full repo (not just `src/`) before removal.

---

## 6. Duplicate migrations

Globbed `supabase/migrations/*.sql` (232 files total). Looked for `.bak.sql`, `copy`, `duplicate`, and duplicate timestamps.

**No** `.bak` / `copy` / `duplicate` filenames found.

**Duplicate timestamps** (same 14-digit prefix on two files):

| Timestamp | Files | Sizes | Verdict |
|---|---|---|---|
| `20260628080000` | `_slug_redirects.sql`, `_xrated_listings_drift_codify.sql` | 1.6 KB, 2.2 KB | VERIFY — both hold real DDL, ordering ambiguity. Rename one to `20260628080001_` rather than delete. |
| `20260707200000` | `_os_conversations.sql`, `_watermark_registry.sql` | 3.7 KB, 3.2 KB | VERIFY — same story. Rename, don't delete. |

Both collisions are semantic bugs (undefined apply-order), not deletion candidates. Flag for the migration team.

---

## Verified safe-to-delete list (copy-paste ready)

```bash
# Uncomment each line only after a final full-repo grep confirms nothing depends on it.

# Confirmed orphan component (0 external imports, 4 KB)
# rm C:/Users/Victus/trades/src/components/xrated/ProfileInfoCard.tsx

# Likely-orphan component (0 external imports found, but verify string-based dynamic imports first)
# rm C:/Users/Victus/trades/src/components/xrated/NotebookBell.tsx

# Superseded memory file (0 back-references in memory folder)
# rm "C:/Users/Victus/.claude/projects/C--Users-Victus/memory/feedback_studio_addon_wrapper_pattern.md"
```

**Aggregate safe-to-delete size:** ~4 KB confirmed (ProfileInfoCard) + ~small unknown for NotebookBell + memory file. Total on-disk reclaim is trivial — the value of this pass is **surface-area reduction**, not disk saving.

---

## Do NOT delete

- All five "orphan-looking" apps (`completer`, `deals`, `jobs`, `jobBoard`, `tradeCounter`) — they power live `/tc/*` routes. Their real bug is missing `manifest.ts`, not existence. Fix by adding manifests.
- All other `src/components/xrated/*` files sampled — each has at least one live import.
- Both duplicate-timestamp migration pairs — real DDL, non-duplicated content. Rename to disambiguate, don't remove.

---

## Recommended follow-ups (not deletions)

1. **Add `manifest.ts`** to `apps/completer`, `apps/deals`, `apps/jobs`, `apps/jobBoard`, `apps/tradeCounter`, `apps/hub`, `apps/messages`, `apps/onboarding`, `apps/rates`, `apps/routes`, `apps/social`, `apps/identity`, `apps/hero-swap`, `apps/live-edit`, `apps/merchant`, `apps/favourites`, `apps/trades`, `apps/before-after`. Then the App Registry knows they exist and future audits can trust it.
2. **Renumber the two duplicate-timestamp migration collisions.**
3. **Adopt `@deprecated` JSDoc** so the next scan of Section 1 returns real signal.
