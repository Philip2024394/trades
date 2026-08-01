// Staircase Advisor · Kitchen-adjacent redirect handler (Philip 2026-08-01)
//
// When a customer asks a KITCHEN question while using the Staircase Centre,
// Nex intercepts BEFORE the generic scope_redirect and returns a specific
// "Kitchen Centre coming soon" response with ONE kitchen reference image
// attached.
//
// Philip 2026-08-01 governance:
//   - This image is NOT part of the Staircase Visual Brain
//   - It is NOT returned as staircase inspiration
//   - It is NOT matched during staircase design retrieval
//   - It exists ONLY to support this scope-redirect conversation
//
// The kitchen reference image is pulled from the separate Kitchen Brain
// scaffold at data/nex-kitchen-confirmed-images.json (created previous
// cycle). The Staircase Advisor uses only the first record as a stable
// customer-facing example; the rest of the Kitchen Brain remains dormant
// until the Kitchen Centre formally launches.

import "server-only";
import { readFileSync, existsSync } from "node:fs";
import { join } from "node:path";
import type { AdvisorImageAttachment } from "./index";

const KITCHEN_LIBRARY_PATH = "data/nex-kitchen-confirmed-images.json";

// ─── Kitchen intent detection ─────────────────────────────────────
//
// Triggers only on question-shaped or request-shaped kitchen mentions
// so incidental phrases ("my staircase is in the kitchen") don't fire.

const KITCHEN_INTENT_PATTERNS: RegExp[] = [
  // "design/help/do/create/plan a kitchen"
  /\b(design|plan|do|create|help|advise|show|need|want|make)(\s+(me|us|my|a|the|an))?\s+(a\s+)?kitchen\b/i,
  // "kitchen design/layout/advice/help/ideas/inspiration/planning/island/cabinets"
  /\bkitchen\s+(design|layout|advice|help|ideas|inspiration|planning|island|cabinets|centre|center)\b/i,
  // "do you do kitchen / do you handle kitchen / do you offer kitchen"
  /\bdo\s+you\s+(do|design|handle|offer|provide|help\s+with|work\s+on)\s+(a\s+|any\s+)?kitchen/i,
  // "can you design/create/help/do/make a kitchen / my kitchen"
  /\bcan\s+you\s+(design|create|help|do|make|plan|advise)\s+(a\s+|my\s+|me\s+with\s+)?(kitchen|kitchens)/i,
  // "help me with my kitchen"
  /\bhelp\s+me\s+(with\s+|design\s+|plan\s+)?(a\s+|my\s+|the\s+)?kitchen\b/i,
  // Philip 2026-08-01 · "i need help with my kitchen" · "i want help with my kitchen"
  /\bi\s+(need|want|would\s+like)\s+(some\s+)?(help|advice|guidance|assistance)\s+(with|for|on|about)\s+(a\s+|my\s+|the\s+|our\s+)?kitchen/i,
  // "kitchen centre / kitchen center" as a direct product enquiry
  /\bkitchen\s+(centre|center)\b/i,
];

export function isKitchenAdjacent(message: string): boolean {
  return KITCHEN_INTENT_PATTERNS.some((p) => p.test(message));
}

// ─── Redirect response ────────────────────────────────────────────

export const KITCHEN_REDIRECT_MESSAGE =
  "The NEX Kitchen Centre is currently in development and isn't available yet. " +
  "At the moment I'm dedicated to staircase design and can help with staircase layouts, " +
  "materials, styles and construction. The Kitchen Centre will become available in a future release.";

// ─── Kitchen reference image loader ───────────────────────────────
//
// Returns ONE image attachment shaped like Staircase Visual Brain output so
// the client UI renders it the same way. NEVER touches the staircase library.

type KitchenRecord = {
  design_id?:           string;
  title?:               string;
  design_family?:       string;
  url:                  string;
  additional_views?:    string[];
  view_types?:          string[];
  kitchen_type?:        string;
  customer_description?: string;
  design_style?:        string;
};

type KitchenLibrary = {
  version:    number;
  brain?:     string;
  updated_at: string;
  confirmed:  KitchenRecord[];
};

let _cache: KitchenLibrary | null = null;
let _cacheKey = "";

function loadKitchenLibrary(): KitchenLibrary | null {
  const path = join(process.cwd(), KITCHEN_LIBRARY_PATH);
  if (!existsSync(path)) return null;
  try {
    const raw = readFileSync(path, "utf8");
    if (raw === _cacheKey && _cache) return _cache;
    _cache = JSON.parse(raw) as KitchenLibrary;
    _cacheKey = raw;
    return _cache;
  } catch {
    return null;
  }
}

/**
 * Return the ONE kitchen reference image attached to the redirect response.
 * Returns [] if the Kitchen Brain scaffold is missing or empty.
 * Always uses the FIRST record — deterministic customer-facing example.
 */
export function kitchenReferenceAttachment(): AdvisorImageAttachment[] {
  const lib = loadKitchenLibrary();
  if (!lib || !Array.isArray(lib.confirmed) || lib.confirmed.length === 0) return [];
  const r = lib.confirmed[0];
  const design_id = r.design_id ?? "NEX-KITCHEN-000001";
  return [{
    design_id,
    title:                r.title ?? "Kitchen Design Concept · Coming Soon",
    design_family:        r.design_family ?? "Modern",
    image_id:             design_id,
    url:                  r.url,
    additional_views:     r.additional_views,
    view_types:           r.view_types,
    caption:              r.customer_description ?? "Kitchen design concept · NEX Kitchen Centre is coming soon.",
    staircase_type:       r.kitchen_type ?? "kitchen reference · not a staircase design",
    design_style:         r.design_style ?? "modern kitchen design",
    confidence:           1,               // deterministic redirect · not a retrieval score
    matched_attributes:   ["intent:kitchen_redirect"],
    // Philip 2026-08-02 · Visual Brain Connection v1 transparency fields
    // (safest default · this is a coming-soon reference, not a real product).
    image_state:          "concept",
    image_state_badge:    "Concept",
    transparency_caption: "Nex generated design concept — Kitchen Centre coming soon.",
  }];
}
