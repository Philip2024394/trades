# Kitchen Confirmed Library

**Canonical file location:** `data/nex-kitchen-confirmed-images.json` (top level, `data/` root).

Not `data/nex-kitchen-brain/confirmed/confirmed-images.json`.

**Why:** the confirmed file was created before this folder scaffold existed, and is currently read by the `kitchen_redirect` handler in the Staircase Advisor (`src/lib/nex/staircase-advisor/kitchen-redirect.ts`). Per Philip's scaffold-only directive (2026-08-01), live routing files are not modified. The path stays at the top level until the Kitchen Centre formally launches.

**When Kitchen Centre launches:**

1. Move `data/nex-kitchen-confirmed-images.json` → `data/nex-kitchen-brain/confirmed/confirmed-images.json`
2. Update `KITCHEN_LIBRARY_PATH` in `src/lib/nex/staircase-advisor/kitchen-redirect.ts`
3. Point any new Kitchen Advisor code at the new location
4. Delete this README

Until then: **treat the top-level file as this folder's contents.**
