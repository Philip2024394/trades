// Industry Pack Manifest v1 — the canonical descriptor for a Pack.
//
// A Pack is a curated bundle: Apps to install + brand tokens to seed
// + home page starter layout. Everything an installer needs to hand
// a merchant a professionally-configured business application on
// first login.
//
// Design principles:
//   • Zero duplication of App runtime. Pack install orchestrates
//     runtime.installApp calls in dependency order; it never inserts
//     into installed_apps directly.
//   • Seeders are preservation-oriented. Brand tokens + layouts are
//     only written when the merchant slot is empty — reinstalling a
//     pack never wipes merchant customisations.
//   • No hardcoded App or Section slugs in the runtime. The pack
//     manifest names them; the runtime looks them up in appRegistry
//     + sectionRegistry.

import type { BrandTokenKind } from "@/lib/studio/schema";

export type PackManifestVersion = 1;

export type PackManifest = {
  manifestVersion: PackManifestVersion;

  // ─── Identity ─────────────────────────────────────────
  slug: string;
  name: string;
  tagline: string;
  description: string;
  icon: string;
  version: string;

  publisher: {
    name: string;
    verified: boolean;
    contactUrl?: string;
  };

  // ─── Target vertical ───────────────────────────────
  /** primary_trade slug this pack targets. `"*"` = every industry
   *  (rare — Packs are usually vertical-specific). */
  industry: string;

  // ─── Apps this pack installs ───────────────────────
  /** Apps to install in this order. Dependency resolution is still
   *  enforced by the runtime — this list gives the installer a
   *  deterministic sequence when multiple valid orderings exist. */
  apps: PackAppEntry[];

  // ─── Brand token seeds ─────────────────────────────
  theme?: PackThemeSeed;

  // ─── Home page starter layout ──────────────────────
  homeLayout?: PackHomeLayoutSeed;

  // ─── Pack Store marketing ──────────────────────────
  packStore: {
    screenshots: string[];
    benefits: string[];
    /** e.g. "Free", "£29 one-off", "Included in Merchant Pro". */
    priceLabel: string;
  };
};

export type PackAppEntry = {
  /** App slug in the App Registry. */
  slug: string;
  /** Per-App config passed through to runtime.installApp. Useful when
   *  a pack wants to install Newsletter with pre-configured heading
   *  copy without editing the App itself. */
  config?: Record<string, unknown>;
};

/** Brand token seed — writes to studio_brand_tokens. Preservation
 *  rule: only insert when no row exists for the (brand, kind, key)
 *  tuple, so a merchant who tuned their primary colour before
 *  reinstalling never loses it. */
export type PackThemeSeed = {
  tokens: PackThemeToken[];
};

export type PackThemeToken = {
  kind: BrandTokenKind;
  key: string;
  /** JSON-serialisable value. Colour tokens are hex strings; radius
   *  tokens are pixel numbers; button tokens are objects. */
  value: unknown;
};

/** Home-page layout seed — writes to studio_layouts (page_id=home,
 *  status=draft). Preservation rule: only insert when no draft or
 *  published row exists for the (merchant, brand, home) tuple, so a
 *  merchant who has already published anything on their home page
 *  never loses it. */
export type PackHomeLayoutSeed = {
  sections: PackSeedSection[];
};

export type PackSeedSection = {
  /** Section registration id. Can reference:
   *    - a built-in Studio section (e.g. "hero.plant_hire_bold_1")
   *    - an App-registered section (e.g. "app.meet-the-team.team-grid")
   *  The installer validates the section is registered before
   *  writing the layout row. */
  key: string;
  /** Per-instance starter config. Merged over the section's
   *  defaultConfig() so partial overrides are cheap to write. */
  config?: Record<string, unknown>;
  /** Advisory hint for future slot enforcement. v1 uses append order. */
  slotHint?: "hero" | "body" | "footer";
};

/** Frozen manifest — what the registry returns to callers. */
export type FrozenPackManifest = Readonly<PackManifest>;
