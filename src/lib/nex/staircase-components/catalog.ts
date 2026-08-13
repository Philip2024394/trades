// NEX Staircase Component Library — Shell catalog (runtime).
//
// Source of truth for humans:
//   data/nex-staircase-components/families/*.yaml
// + data/nex-staircase-components/variants/*.yaml
//
// Master AI Engineer refactor 2026-08-05 (Philip): pre-2026-08-05 this file
// hardcoded `Array.from({length: 15}, ...)` and the catalogue silently drifted
// out of sync with the on-disk YAMLs (shells 16-20 existed on disk but were
// invisible at runtime). The catalogue is now DISCOVERED from the filesystem
// via `scripts/build-nex-staircase-catalog.mjs`, which writes
// `catalog.generated.ts`. Nothing here needs editing when a new shell YAML
// (or a new family YAML) is added — just re-run the script.
//
// This file mirrors just the fields the /staircase-chat 3D-Models drawer
// needs to render tiles and post a share card.

import type { ReviewStatus, StructuralFamilyKind } from "./types";
import { GENERATED_SHELL_CATALOG } from "./catalog.generated";

// ─── Straight-closed tread SOFT cap (Philip 2026-08-05) ─────────────
// UK domestic practice puts a soft cap around 13 treads before an
// intermediate landing becomes preferable (Approved Doc K). This is
// REGULATORY guidance, not a build ceiling — the build ceiling is now
// discovered from the filesystem (add a shell YAML, rerun the codegen
// script, done). Longer flights should introduce an intermediate landing
// via a new structural family (quarter_landing · half_landing) rather
// than more straight treads.
export const STRAIGHT_CLOSED_TREAD_SOFT_CAP = 13;

/** The next structural family to build after the Phase B component
 *  library is deep enough (see the Phase A/B/C/D roadmap doctrine).
 *  Wired here so consumers (UI · docs · admin dashboards) surface the
 *  same next step. */
export const NEXT_STRUCTURAL_FAMILY: StructuralFamilyKind = "quarter_landing";

export interface ShellCatalogVariant {
  /** Full component ID matching the YAML file — e.g. SHELL_STRAIGHT_CLOSED_13. */
  readonly component_id: string;
  /** Tread count. For shells this equals the variant number. */
  readonly treads: number;
  /** Riser count. Engineering invariant: risers = treads + 1. */
  readonly risers: number;
  readonly review_status: ReviewStatus;
}

export interface ShellCatalogFamily {
  readonly family_id: string;
  readonly family_name: string;
  /** Homeowner-friendly layout label (e.g. "Straight flight"). */
  readonly layout_label: string;
  /** Homeowner-friendly construction label (e.g. "Closed string (both sides)"). */
  readonly construction_label: string;
  readonly variants: readonly ShellCatalogVariant[];
}

export const SHELL_CATALOG: readonly ShellCatalogFamily[] = GENERATED_SHELL_CATALOG;

export function getShellFamily(family_id: string): ShellCatalogFamily | undefined {
  return SHELL_CATALOG.find((f) => f.family_id === family_id);
}
