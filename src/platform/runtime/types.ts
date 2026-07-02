// Platform Runtime — types.
//
// Types the Runtime uses to describe install/uninstall operations,
// installed-app rows, composed navigation trees, and slot resolutions.
// Kept separate from the concrete implementations so the SDK (thin
// developer-facing adapters) can import types without pulling in the
// full Runtime module graph.

import type { NavEntry } from "../manifest/types";

// ─── Installed App ledger row ──────────────────────────────────────

/** Shape of a row in public.installed_apps. */
export type InstalledAppRow = {
  id: string;
  merchant_id: string;
  app_slug: string;
  version: string;
  config_json: Record<string, unknown>;
  installed_at: string;
  upgraded_at: string | null;
  uninstalled_at: string | null;
  /** studio_pages.slug values this install materialised. */
  created_pages: string[];
};

// ─── Install ────────────────────────────────────────────────────────

export type InstallOptions = {
  merchantId: string;
  /** Defaults to the merchant's default brand when omitted. */
  brandId?: string;
  /** Per-install App config. Written to installed_apps.config_json. */
  config?: Record<string, unknown>;
  /** Skip dependency + conflict + plan preflight. The Industry Pack
   *  installer sets this so it can resolve a bundle of Apps in a
   *  single transaction without preflight rejecting an intermediate
   *  state. */
  skipPreflight?: boolean;
};

export type InstallOk = {
  ok: true;
  installedApp: InstalledAppRow;
  createdPages: string[];
};

export type InstallErr = {
  ok: false;
  error: InstallError;
};

export type InstallResult = InstallOk | InstallErr;

export type InstallError =
  | { code: "unknown-app"; slug: string }
  | { code: "already-installed"; slug: string }
  | { code: "missing-dependency"; slug: string; missing: string }
  | { code: "conflicting-app"; slug: string; conflictsWith: string }
  | { code: "insufficient-plan"; slug: string; required: string }
  | {
      code: "lifecycle-hook-failed";
      slug: string;
      hook: string;
      reason: string;
    }
  | { code: "no-default-brand"; slug: string }
  | { code: "db-error"; slug: string; reason: string };

// ─── Uninstall ─────────────────────────────────────────────────────

export type UninstallOptions = {
  merchantId: string;
  /** Default: false. Soft-uninstall preserves the installed_apps row,
   *  keeps app-owned tables intact, and hides created_pages via
   *  hidden_at. Purge is destructive — hard DELETE + table drops. */
  purgeData?: boolean;
};

export type UninstallOk = {
  ok: true;
  slug: string;
  preservedPages: string[];
  purged: boolean;
};

export type UninstallErr = {
  ok: false;
  error: UninstallError;
};

export type UninstallResult = UninstallOk | UninstallErr;

export type UninstallError =
  | { code: "not-installed"; slug: string }
  | { code: "required-by-other"; slug: string; requiredBy: string[] }
  | {
      code: "lifecycle-hook-failed";
      slug: string;
      hook: string;
      reason: string;
    }
  | { code: "db-error"; slug: string; reason: string };

// ─── Navigation composition ────────────────────────────────────────

/** A NavEntry annotated with the App that contributed it. */
export type ComposedNavEntry = NavEntry & {
  contributedBy: string;
  children?: ComposedNavEntry[];
};

export type ComposedNavigation = {
  entries: ComposedNavEntry[];
};

// ─── Slot resolution ───────────────────────────────────────────────

/** Slot naming convention: `<pageId>.<slotName>`.
 *
 *  Well-known slot names v1:
 *    • hero    — top of page, single-section slot
 *    • body    — middle of page, many-section slot (default landing)
 *    • footer  — bottom of page, single-section slot
 *
 *  Apps declare `slotHints: ["home.body"]` in their manifest. The
 *  installer uses hints to decide where a section's default row lands
 *  when the App is installed. Hints are advisory — merchants can move
 *  sections between rows freely after install.
 *
 *  Enforced slot constraints (single vs many) are a Runtime v2
 *  concern — v1 treats them as convention. */
export type SlotConstraint = "one" | "many";

export type SlotDefinition = {
  id: string;
  pageId: string;
  name: string;
  constraint: SlotConstraint;
};

export type SlotResolution = {
  slotId: string;
  pageId: string;
  slotName: string;
  /** null when the slot is empty. */
  instanceId: string | null;
  sectionKey: string | null;
  contributedByApp: string | null;
};
