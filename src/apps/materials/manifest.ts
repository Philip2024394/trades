// Materials Application Module manifest
//
// This is an Application Module (Layer 2) — NOT a Reference Brain (Layer 1)
// and NOT a Print/Design Studio app. Philip 2026-07-28.
//
// We intentionally do NOT reuse `StudioAppManifest` here: that shape
// exists for AI generation studios (business cards · flyers · social
// tiles) and its fields (generator · exporters · pricing per one-shot)
// don't fit a business workflow module. Instead we declare our own
// minimal workflow-module manifest shape.

export type WorkflowAppManifest = {
  readonly id: string;
  readonly name: string;
  readonly version: string;
  readonly layer: "application_module";           // Locks the classification.
  readonly category: "inventory" | "crm" | "projects" | "estimator" | "portal";
  readonly description: string;
  readonly icon: string;
  readonly status: "planning" | "alpha" | "beta" | "stable";
  readonly ownsTables: readonly string[];         // Layer 2 tables owned.
  readonly readsTables: readonly string[];        // Layer 2 tables read but not owned.
  readonly dependencies: readonly string[];       // Other app IDs relied on.
  readonly externalSurfaces: readonly {
    readonly kind: "worker_portal" | "customer_portal" | "public_api";
    readonly route: string;
    readonly auth: "token" | "session" | "none";
  }[];
};

export const manifest: WorkflowAppManifest = {
  id:          "materials",
  name:        "Materials Manager",
  version:     "1.0.0",
  layer:       "application_module",
  category:    "inventory",
  description: "Physical stock tracking · timber packs · individual boards · measurements · allocations · offcuts. Hardwood is the founding provider; other materials follow the same provider pattern.",
  icon:        "TreePine",
  status:      "alpha",
  ownsTables: [
    "nex_materials_species",
    "nex_materials_suppliers",
    "nex_materials_hardwood_packs",
    "nex_materials_hardwood_boards",
    "nex_materials_hardwood_board_measurements",
    "nex_materials_hardwood_board_defects",
    "nex_materials_worker_links",
    "nex_materials_hardwood_allocations",
    "nex_materials_hardwood_offcuts",
    "nex_materials_audit_log",
  ],
  readsTables:  ["hammerex_nex_users"],   // for owner identity resolution
  dependencies: [],
  externalSurfaces: [
    { kind: "worker_portal", route: "/w/[token]",              auth: "token"   },
    { kind: "public_api",    route: "/api/worker/[token]/*",   auth: "token"   },
    { kind: "public_api",    route: "/api/materials/*",        auth: "session" },
  ],
};
