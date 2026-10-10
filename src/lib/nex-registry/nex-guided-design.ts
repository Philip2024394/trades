// src/lib/nex-registry/nex-guided-design.ts
//
// NEX Guided Design (Ledger B · Zero LLM)
//
// Founder principle:
//   "The customer should never need to know what a hero, container,
//    section, CTA, breadcrumb, drawer, or responsive breakpoint means.
//    They describe what they want. NEX translates their intent into
//    design decisions and teaches them through the interface."
//
// This module supplies FOUR primitives that make that loop possible:
//   1. Bidirectional vocabulary translation
//        customer phrase ↔ system region/component
//   2. Design Map · numbered markers over a real layout
//        ①/②/③... with customer labels the user can point at
//   3. ChoiceSet · "give me three options"
//        enforces 2-4 alternatives · never 1 · never 5+
//        every choice must describe a REAL structural change
//   4. PageCompletenessGate · Rule 4 enforcement
//        no half-built pages · no "coming later" · placeholders rejected
//
// The module is pure logic · no UI · no browser · no LLM.
// Downstream (Workstation Live) can consume these for the overlay UI.

import type { LayoutSpec, RegionKind } from "./layout-types";
import { assertRule4NoHalfBuiltPages } from "./capability-rule";

export const NEX_GUIDED_DESIGN_VERSION = "nex-guided-design.v1.2026-09-19";

// ── ChoiceSet size limits (founder-directed clarification) ────────────
// The 2-4 constraint is a governance choice, NOT a proven UX finding.
// Labelling it correctly so downstream code and reports do not present
// a design hypothesis as scientific fact.
export const CHOICESET_LIMITS = Object.freeze({
  min: 2,
  max: 4,
  min_rationale: "one option is not a choice · at least two alternatives required for a real decision",
  max_rationale: "governance heuristic · more than four options may overwhelm the customer",
  max_rationale_evidence_status: "DESIGN_HYPOTHESIS" as const,
  //   ↑ label per founder directive: "keep the structural limit for now,
  //   but label its origin correctly · later, actual user testing can
  //   determine whether 3, 4, 5 or adaptive choices work better."
  origin: "GOVERNANCE_RULE" as const,
  frozen: true,
});

// ═══════════════════════════════════════════════════════════════════
// 1 · VOCABULARY TRANSLATION (Rule 3)
// ═══════════════════════════════════════════════════════════════════

// System regions (from layout-types) → customer-friendly phrases.
// The customer sees the RIGHT-hand phrases · never the LEFT-hand ones.
const REGION_TO_CUSTOMER: Readonly<Record<RegionKind, string>> = Object.freeze({
  primary_navigation:  "the main menu",
  top_bar:             "the top of the page",
  primary_content:     "the main area",
  secondary_content:   "the extra content",
  detail_panel:        "the details area",
  inspector:           "the side panel",
  canvas:              "the drawing area",
  timeline:            "the timeline",
  asset_browser:       "the pictures and files area",
  contextual_actions:  "the actions",
  filters:             "the filters",
  search:              "the search",
  conversation:        "the messages area",
  feed:                "the feed",
  footer:              "the bottom of the page",
  install_prompt:      "the install banner",
  offline_indicator:   "the offline notice",
});

// Customer phrases → system regions.
// Deliberately generous · a single customer phrase can map to multiple regions.
const CUSTOMER_TO_REGIONS: Readonly<Record<string, readonly RegionKind[]>> = Object.freeze({
  "menu":             ["primary_navigation"],
  "main menu":        ["primary_navigation"],
  "navigation":       ["primary_navigation"],
  "nav":              ["primary_navigation"],
  "top":              ["top_bar", "primary_navigation"],
  "top of the page":  ["top_bar"],
  "header":           ["top_bar", "primary_navigation"],
  "middle":           ["primary_content"],
  "main":             ["primary_content"],
  "main area":        ["primary_content"],
  "content":          ["primary_content"],
  "extra":            ["secondary_content"],
  "sidebar":          ["primary_navigation", "inspector"],
  "side panel":       ["inspector"],
  "details":          ["detail_panel"],
  "detail":           ["detail_panel"],
  "actions":          ["contextual_actions"],
  "buttons":          ["contextual_actions"],
  "filters":          ["filters"],
  "filter":           ["filters"],
  "search":           ["search"],
  "messages":         ["conversation"],
  "chat":             ["conversation"],
  "feed":             ["feed"],
  "footer":           ["footer"],
  "bottom":           ["footer"],
  "bottom of the page": ["footer"],
  "install":          ["install_prompt"],
  "offline":          ["offline_indicator"],
  "pictures":         ["asset_browser"],
  "images":           ["asset_browser"],
  "files":            ["asset_browser"],
  "canvas":           ["canvas"],
  "timeline":         ["timeline"],
});

export function regionToCustomer(region: RegionKind): string {
  return REGION_TO_CUSTOMER[region];
}

export function customerToRegions(phrase: string): readonly RegionKind[] {
  const norm = phrase.trim().toLowerCase();
  const direct = CUSTOMER_TO_REGIONS[norm];
  if (direct) return direct;
  // Substring fallback · check if the phrase contains a known key
  for (const [key, regions] of Object.entries(CUSTOMER_TO_REGIONS)) {
    if (norm.includes(key)) return regions;
  }
  return Object.freeze([] as RegionKind[]);
}

// ── Element-scale vocabulary (below region) ───────────────────────────
export type ElementLabel =
  | "heading" | "sub_heading" | "body_text" | "button" | "link"
  | "image" | "video" | "icon" | "form" | "input"
  | "list" | "card" | "chart" | "map" | "table"
  | "generic_area";

const CUSTOMER_TO_ELEMENT: Readonly<Record<string, ElementLabel>> = Object.freeze({
  "heading":  "heading",
  "title":    "heading",
  "subtitle": "sub_heading",
  "text":     "body_text",
  "paragraph":"body_text",
  "button":   "button",
  "link":     "link",
  "picture":  "image",
  "image":    "image",
  "video":    "video",
  "icon":     "icon",
  "form":     "form",
  "input":    "input",
  "list":     "list",
  "card":     "card",
  "chart":    "chart",
  "graph":    "chart",
  "map":      "map",
  "table":    "table",
});

export function customerToElement(phrase: string): ElementLabel | null {
  const norm = phrase.trim().toLowerCase();
  const direct = CUSTOMER_TO_ELEMENT[norm];
  if (direct) return direct;
  for (const [key, element] of Object.entries(CUSTOMER_TO_ELEMENT)) {
    if (norm.includes(key)) return element;
  }
  return null;
}

// ═══════════════════════════════════════════════════════════════════
// 2 · DESIGN MAP · numbered overlay markers over a layout
// ═══════════════════════════════════════════════════════════════════

export interface DesignMapMarker {
  readonly ordinal: number;              // 1, 2, 3...
  readonly display_glyph: string;        // "①", "②", "③"…
  readonly region: RegionKind;
  readonly customer_label: string;       // e.g. "the main menu"
  readonly system_label: string;         // e.g. "primary_navigation"
}

export interface DesignMap {
  readonly layout_id: string;
  readonly layout_name: string;
  readonly markers: readonly DesignMapMarker[];
  readonly generated_at_iso: string;
  readonly zero_llm: true;
  readonly ledger: "B";
}

const CIRCLED_GLYPHS = "①②③④⑤⑥⑦⑧⑨⑩⑪⑫⑬⑭⑮⑯⑰⑱⑲⑳";

function glyphFor(ordinal: number): string {
  if (ordinal >= 1 && ordinal <= 20) return CIRCLED_GLYPHS[ordinal - 1];
  return `(${ordinal})`;
}

export function generateDesignMap(layout: LayoutSpec): DesignMap {
  const markers: DesignMapMarker[] = [];
  let ordinal = 1;
  for (const region of layout.regions) {
    // Skip regions that are hidden on desktop (not relevant to the overlay)
    const desktopBehaviour = layout.responsive.desktop.regions[region];
    if (desktopBehaviour === "hidden") continue;
    markers.push({
      ordinal,
      display_glyph: glyphFor(ordinal),
      region,
      customer_label: regionToCustomer(region),
      system_label: region,
    });
    ordinal += 1;
  }
  return {
    layout_id: layout.layout_id,
    layout_name: layout.name,
    markers: Object.freeze(markers),
    generated_at_iso: new Date().toISOString(),
    zero_llm: true,
    ledger: "B",
  };
}

// ═══════════════════════════════════════════════════════════════════
// 3 · CHOICE SET · "give me three options"
// ═══════════════════════════════════════════════════════════════════

export interface DesignChoice {
  readonly id: "A" | "B" | "C" | "D";
  readonly customer_label: string;       // e.g. "Clean & Compact"
  readonly preview_description: string;  // one-line summary the customer reads
  readonly applies_to_regions: readonly RegionKind[];
  readonly structural_change: string;    // machine-readable summary · used by builder
  readonly is_placeholder: false;        // Rule 4: must be false · a real change
}

export type ChoiceSetOutcome =
  | { readonly outcome: "OK"; readonly choice_set: ChoiceSet }
  | { readonly outcome: "REJECTED"; readonly reason: string };

export interface ChoiceSet {
  readonly question: string;             // customer-facing question
  readonly choices: readonly DesignChoice[];
  readonly target_customer_phrase: string;  // what the customer said
  readonly target_region: RegionKind | null;
  readonly generated_at_iso: string;
  readonly zero_llm: true;
  readonly ledger: "B";
}

export function makeChoiceSet(input: {
  question: string;
  choices: readonly DesignChoice[];
  target_customer_phrase: string;
}): ChoiceSetOutcome {
  // Structural limits · labelled as DESIGN_HYPOTHESIS · see CHOICESET_LIMITS
  if (input.choices.length < CHOICESET_LIMITS.min) return { outcome: "REJECTED", reason: `ChoiceSet must offer at least ${CHOICESET_LIMITS.min} alternatives · ${CHOICESET_LIMITS.min_rationale}` };
  if (input.choices.length > CHOICESET_LIMITS.max) return { outcome: "REJECTED", reason: `ChoiceSet must not exceed ${CHOICESET_LIMITS.max} alternatives · ${CHOICESET_LIMITS.max_rationale} · evidence_status=${CHOICESET_LIMITS.max_rationale_evidence_status}` };
  // Every choice must be a real change (Rule 4)
  for (const c of input.choices) {
    if (c.is_placeholder as unknown !== false) return { outcome: "REJECTED", reason: `choice ${c.id} is marked as placeholder · Rule 4 forbids placeholder choices` };
    if (!c.structural_change || c.structural_change.trim().length === 0) return { outcome: "REJECTED", reason: `choice ${c.id} has no structural_change · would appear as a design change but do nothing` };
  }
  // IDs must be unique and start from A
  const seenIds = new Set(input.choices.map((c) => c.id));
  if (seenIds.size !== input.choices.length) return { outcome: "REJECTED", reason: "ChoiceSet contains duplicate choice IDs" };
  const targetRegions = customerToRegions(input.target_customer_phrase);
  return {
    outcome: "OK",
    choice_set: {
      question: input.question,
      choices: Object.freeze([...input.choices]),
      target_customer_phrase: input.target_customer_phrase,
      target_region: targetRegions.length > 0 ? targetRegions[0] : null,
      generated_at_iso: new Date().toISOString(),
      zero_llm: true,
      ledger: "B",
    },
  };
}

// ═══════════════════════════════════════════════════════════════════
// 4 · PAGE COMPLETENESS GATE (Rule 4)
// ═══════════════════════════════════════════════════════════════════

export interface PageRegionStatus {
  readonly region: string;
  readonly requested_by_customer: boolean;
  readonly implemented: boolean;
  readonly explicitly_deferred: boolean;
  readonly evidence_ref: string | null;  // path to the code / component that implements it
}

export interface PageResponsiveStatus {
  readonly desktop_implemented: boolean;
  readonly tablet_implemented: boolean;
  readonly mobile_implemented: boolean;
}

export interface PageInteractionStates {
  readonly loading_state_implemented: boolean;
  readonly empty_state_implemented: boolean;
  readonly error_state_implemented: boolean;
}

export interface PageCompletenessAssessment {
  readonly page_id: string;
  readonly regions: readonly PageRegionStatus[];
  readonly responsive: PageResponsiveStatus;
  readonly interaction_states: PageInteractionStates;
  readonly page_summary: string;   // NEX's own summary text · scanned for "coming later" etc.
  readonly interactive: boolean;   // is this an interactive page?
  readonly has_list_or_search: boolean;
}

export type PageCompletenessVerdict =
  | { readonly outcome: "COMPLETE"; readonly evidence_summary: string }
  | { readonly outcome: "INCOMPLETE"; readonly violations: readonly string[]; readonly missing_regions: readonly string[]; readonly missing_responsive: readonly string[]; readonly missing_states: readonly string[] };

export function assessPageCompleteness(assessment: PageCompletenessAssessment): PageCompletenessVerdict {
  const violations: string[] = [];
  const missing_regions: string[] = [];
  const missing_responsive: string[] = [];
  const missing_states: string[] = [];

  // Rule 4 · forbidden completion signals in the page summary
  const r4Region = assessment.regions.map((r) => ({ region: r.region, implemented: r.implemented, explicitly_deferred: r.explicitly_deferred }));
  const r4Violations = assertRule4NoHalfBuiltPages({ page_summary: assessment.page_summary, region_manifest: r4Region });
  for (const v of r4Violations) violations.push(v);

  // Missing regions the customer explicitly requested
  for (const r of assessment.regions) {
    if (r.requested_by_customer && !r.implemented && !r.explicitly_deferred) {
      missing_regions.push(r.region);
    }
  }

  // Responsive · all three viewports mandatory (§20 · founder mandate)
  if (!assessment.responsive.desktop_implemented) missing_responsive.push("desktop");
  if (!assessment.responsive.tablet_implemented)  missing_responsive.push("tablet");
  if (!assessment.responsive.mobile_implemented)  missing_responsive.push("mobile");

  // Interaction states · only mandatory if the page is interactive
  if (assessment.interactive) {
    if (!assessment.interaction_states.loading_state_implemented) missing_states.push("loading_state");
    if (!assessment.interaction_states.error_state_implemented)   missing_states.push("error_state");
  }
  if (assessment.has_list_or_search) {
    if (!assessment.interaction_states.empty_state_implemented) missing_states.push("empty_state");
  }

  const anyMissing = missing_regions.length + missing_responsive.length + missing_states.length + violations.length > 0;
  if (anyMissing) {
    return {
      outcome: "INCOMPLETE",
      violations: Object.freeze(violations),
      missing_regions: Object.freeze(missing_regions),
      missing_responsive: Object.freeze(missing_responsive),
      missing_states: Object.freeze(missing_states),
    };
  }
  const totalImplemented = assessment.regions.filter((r) => r.implemented).length;
  return {
    outcome: "COMPLETE",
    evidence_summary: `${totalImplemented} regions implemented · desktop+tablet+mobile responsive · required interaction states present`,
  };
}

// ═══════════════════════════════════════════════════════════════════
// 5 · CUSTOMER-FACING EXPLANATION TEMPLATES (Rule 3)
// ═══════════════════════════════════════════════════════════════════

// When NEX explains an area to the customer, use these templates.
// They never use forbidden design jargon (Rule 3).

export function explainRegionToCustomer(region: RegionKind): string {
  const label = regionToCustomer(region);
  return `This is ${label}. You can simply say "${label}" to me · you don't need to remember any technical name.`;
}

export function explainChoiceSetToCustomer(choiceSet: ChoiceSet): string {
  const parts: string[] = [choiceSet.question];
  for (const c of choiceSet.choices) parts.push(`${c.id} · ${c.customer_label}`);
  parts.push("Which direction would you like?");
  return parts.join("\n");
}
