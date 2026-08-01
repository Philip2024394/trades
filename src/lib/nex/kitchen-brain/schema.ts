// Kitchen Brain · Schema (Philip 2026-08-01 · SCAFFOLD ONLY)
//
// STATUS: types + constants only · zero runtime behaviour · zero imports
// from any live routing/retrieval/chat path.
//
// This file exists so that whenever Philip (or a future Kitchen Advisor
// implementation) needs to work with Kitchen Brain records, the type
// contract is already defined and stable. It mirrors the Staircase Visual
// Brain shape at src/lib/nex/images/confirmed-library.ts but uses
// kitchen-domain fields (kitchen_type · cabinet_style · worktop · island
// · appliances · sink · lighting · colour_scheme) instead of staircase
// fields (balustrade_style · handrail_style · newel_style).
//
// ADR-0033 Brain Isolation:
//   - This module is NOT imported by any staircase code path
//   - Kitchen retrieval, routing, prompts, chat endpoint = NOT BUILT
//   - Data lives in data/nex-kitchen-brain/ (except the legacy top-level
//     confirmed file · see README in that folder)

// ─── Kitchen design families ─────────────────────────────────────
//
// These are the *kitchen* families · a completely separate list from the
// staircase DesignFamily union. When the Kitchen Advisor is built, its
// customer-default allowlist will exclude specialty families like
// "Components" the same way the Staircase Brain does.

export type KitchenFamily =
  | "Modern"
  | "Traditional"
  | "Shaker"
  | "Contemporary"
  | "Industrial"
  | "Minimalist"
  | "Farmhouse"
  | "Coastal"
  | "Scandinavian"
  | "Country"
  | "Components";                                    // specialty · hinges · runners · handles · appliance connectors · plinths

// Which families answer "show me a kitchen" queries when the Kitchen
// Advisor eventually launches. Components is opt-in only.
export const KITCHEN_CUSTOMER_DEFAULT_FAMILIES: readonly KitchenFamily[] = [
  "Modern", "Traditional", "Shaker", "Contemporary", "Industrial",
  "Minimalist", "Farmhouse", "Coastal", "Scandinavian", "Country",
];

// ─── View types ──────────────────────────────────────────────────
//
// One kitchen design = many views. Same pattern as staircase but with
// kitchen-appropriate view labels.

export type KitchenViewType =
  | "hero"
  | "island-detail"
  | "cabinet-detail"
  | "worktop-detail"
  | "appliance-detail"
  | "sink-detail"
  | "tap-detail"
  | "lighting"
  | "open-view"
  | "close-view"
  | "plan-drawing"
  | "render"
  | "before-after"
  | "installation"
  | "alt"
  | "detail";

// ─── Confirmed kitchen record ────────────────────────────────────
//
// Mirrors ConfirmedImage from src/lib/nex/images/confirmed-library.ts
// but replaces staircase-specific fields with kitchen-domain fields.
// Common v2 fields (design_id · title · design_family · view_types etc.)
// are preserved to keep the two brains structurally compatible.

export type ConfirmedKitchen = {
  // Visual Brain v2 · permanent identifiers
  design_id?:           string;                  // NEX-KITCHEN-000012 · single canonical id across Knowledge · Estimator · CRM · Projects
  title?:               string;                  // short display name · e.g. "Modern Shaker · Island Kitchen with Quartz Worktop"
  design_family?:       KitchenFamily;           // Modern | Traditional | Shaker | Contemporary | Industrial | Minimalist | Farmhouse | Coastal | Scandinavian | Country | Components
  primary_brain?:       "kitchen";               // ADR-0033 · always "kitchen" for records in this library
  image_id?:            string;                  // legacy alias · retained for backwards compat

  // Views (one design = many images · one staircase = one design rule applies)
  url:                  string;                  // primary/hero URL · used as the key
  additional_views?:    string[];                // other angles/renders of the SAME kitchen · merged as one record per Image Set rule
  view_labels?:         string[];                // optional labels corresponding to url + additional_views
  view_types?:          KitchenViewType[];       // why each image exists · parallel to [url, ...additional_views]

  // Kitchen-specific design metadata (Philip 2026-08-01 spec)
  kitchen_type:         string;                  // island layout · galley · L-shape · U-shape · one-wall · peninsula · broken-plan · open-plan
  cabinet_style:        string;                  // shaker · flat-front · handleless · in-frame · glazed · slab · panelled
  layout:               string;                  // physical arrangement + zones (prep · cook · clean · social)
  worktop:              string;                  // quartz · granite · timber · laminate · stainless steel · marble · Corian
  island?:              string;                  // island details if present · seating count · overhang · integrated features
  appliances:           string[];                // integrated oven · induction hob · dishwasher · fridge · wine cooler · warming drawer · etc.
  sink:                 string;                  // undermount · inset · Belfast/butler · double bowl · one-and-a-half · workstation
  lighting:             string;                  // pendant · under-cabinet · plinth · task · ambient · cove · statement fitting
  colour_scheme:        string;                  // colour palette + finish tones
  design_style:         string;                  // free-text style description (may overlap with design_family for reinforcement)
  materials:            string[];                // timber species · stone types · metal finishes · glass · handles
  project_suitability:  string[];                // new_build_kitchen · kitchen_renovation · extension · open_plan · self_build

  // Knowledge Brain links (v2 · explicit connection)
  related_articles:     string[];                // article slugs · knowledge_links

  // Descriptions
  customer_description: string;                  // used as caption in Kitchen Visual Brain output
  designer_notes:       string;                  // internal · never shown to customer

  // Provenance
  confirmed_at:         string;
  confirmed_by:         string;
};

// ─── Working / Pending / Vision-Scan records ────────────────────
//
// Same shape idea as staircase equivalents · minimal metadata until
// promoted through the pipeline.

export type WorkingKitchenImage = {
  id:            string;               // e.g. NEX-KITCHEN-WORKING-000001
  url:           string;
  source?:       string;               // manifest reference / upload origin
  added_at:      string;
  notes?:        string;               // free-text observations before analysis
};

export type PendingKitchenReview = {
  id:               string;               // e.g. NEX-KITCHEN-PENDING-000001
  url:              string;
  drafted_at:       string;
  drafted_by:       "vision_scan_importer" | "manual" | string;
  proposed_metadata: Partial<ConfirmedKitchen>;
  notes?:            string;
};

export type KitchenVisionScan = {
  id:            string;               // e.g. NEX-KITCHEN-SCAN-000001
  url:           string;               // image URL the scan describes
  scan_text:     string;               // raw vision-analysis text
  scanned_at:    string;
  scanned_by:    string;               // "openai-gpt-vision" | "claude-vision" | "manual" | etc.
  extracted?:    boolean;              // has this scan been promoted into a Pending Review record yet?
};

// ─── Components (kitchen specialty family) ──────────────────────
//
// Kitchen hardware · hinges · runners · handles · appliance connectors ·
// plinths · end panels · cornices etc. Parallel to the Components + Fixings
// families in the staircase Visual Brain. Excluded from customer default
// queries when the Kitchen Advisor eventually launches.

export type KitchenComponent = {
  id:              string;
  title:           string;
  category:        "hinge" | "drawer_runner" | "handle" | "appliance_connector" | "plinth" | "end_panel" | "cornice" | "corbel" | "worktop_edging" | "sink_accessory" | string;
  url?:            string;
  description:     string;
  typical_use:     string;
  materials?:      string[];
  brands?:         string[];
  confirmed_at:    string;
  confirmed_by:    string;
};

// ─── Bucket wrappers ─────────────────────────────────────────────
//
// Shape of each JSON file in data/nex-kitchen-brain/*.

export type ConfirmedKitchenLibrary = {
  version:    number;
  brain:      "kitchen";
  updated_at: string;
  confirmed:  ConfirmedKitchen[];
};

export type WorkingKitchenLibrary = {
  version:         number;
  brain:           "kitchen";
  bucket:          "working";
  purpose?:        string;
  isolation_note?: string;
  updated_at:      string;
  images:          WorkingKitchenImage[];
};

export type PendingKitchenReviewLibrary = {
  version:         number;
  brain:           "kitchen";
  bucket:          "pending_review";
  purpose?:        string;
  isolation_note?: string;
  updated_at:      string;
  images:          PendingKitchenReview[];
};

export type KitchenVisionScanLibrary = {
  version:         number;
  brain:           "kitchen";
  bucket:          "vision_scans";
  purpose?:        string;
  isolation_note?: string;
  updated_at:      string;
  scans:           KitchenVisionScan[];
};

export type KitchenComponentsLibrary = {
  version:         number;
  brain:           "kitchen";
  bucket:          "components";
  purpose?:        string;
  isolation_note?: string;
  updated_at:      string;
  records:         KitchenComponent[];
};
