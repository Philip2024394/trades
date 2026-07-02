// Add-on section registrations — single import point.
//
// Importing this module side-effect-registers every add-on wrapper with
// the Studio section registry. Kept separate from ../index.ts so add-ons
// can grow independently of the built-in sections index and so tests
// can register add-ons in isolation.
//
// New add-on: add a wrapper file next to this one and import it below.

import "./team";
import "./newsletter";
import "./trade_connections";

// ─── Add Library descriptor list ──────────────────────────────────
//
// Powers the Studio Add Library UI. Each descriptor maps an addon slug
// to the Studio section id it registers as, plus a short marketing
// blurb for the library card. The AddOn catalogue in
// `@/lib/xratedAddons` remains the source of truth for pricing,
// benefits, and tier gating — this list only names which addons are
// wired to a Studio section right now.

export type StudioAddonDescriptor = {
  /** Addon slug from XRATED_ADDONS. */
  slug: string;
  /** Namespaced Studio section id (matches the registration). */
  sectionId: string;
  /** Recommended library bucket for filtering in the Add Library UI. */
  library:
    | "business"
    | "trade"
    | "sales"
    | "products"
    | "services"
    | "information";
  /** Which studio_pages this addon is meaningful on. Empty = any page. */
  compatiblePageIds?: string[];
};

export const STUDIO_ADDON_DESCRIPTORS: StudioAddonDescriptor[] = [
  {
    slug: "meet_the_team",
    sectionId: "addon.meet_the_team",
    library: "business",
    compatiblePageIds: ["home"]
  },
  {
    slug: "newsletter",
    sectionId: "addon.newsletter",
    library: "sales",
    compatiblePageIds: ["home", "shop"]
  },
  {
    slug: "trade_connections",
    sectionId: "addon.trade_connections",
    library: "products",
    compatiblePageIds: ["home", "shop", "product"]
  }
];

export {};
