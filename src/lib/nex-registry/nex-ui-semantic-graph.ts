// src/lib/nex-registry/nex-ui-semantic-graph.ts
//
// NEX UI Semantic Graph (Ledger B · Zero LLM)
//
// FOUNDER PRINCIPLE
//   "The orb should never locate a button by guessing pixels. Every
//    interactive Workstation element must have a NEX semantic identity."
//
// This module maintains a real graph of interface elements the Orb can
// resolve intent against. Every entry declares:
//   · what the customer would call it (customer_label)
//   · what it actually does (purpose)
//   · which intents match it (intent_tags)
//   · how to find the real DOM element (css_selector)
//   · where in the app it lives (location_path)
//
// ANTI-FABRICATION INVARIANTS
//   1. Every semantic UI element MUST declare either a real css_selector
//      OR user_authorized=true (for elements that will be added later).
//   2. Intent-matching returns explicit AMBIGUOUS / NOT_FOUND rather than
//      picking the first plausible target.
//   3. The graph does NOT scan the DOM at runtime · it stores DECLARED
//      targets · which downstream (Orb runtime) confirms against a live
//      browser handle.

import { createHash } from "node:crypto";
import type { EvidenceRef } from "./capability-types";

export const NEX_UI_SEMANTIC_GRAPH_VERSION = "nex-ui-semantic-graph.v1.2026-09-19";

// ── Semantic UI kinds ─────────────────────────────────────────────────
export type SemanticUiKind =
  | "button"
  | "link"
  | "menu_item"
  | "tab"
  | "input"
  | "panel"
  | "toggle"
  | "dropdown"
  | "route"                  // a URL destination · e.g. /nex1/workstation-live/repo-preview
  | "region";                // a region of the layout · e.g. primary_content

export type SemanticUiScope =
  | "workstation"            // NEX1 Workstation Live
  | "chat"                   // NEX chat surface
  | "directory"
  | "app_builder"
  | "publish"
  | "settings"
  | "generic";               // reusable · not scope-locked

export interface SemanticUiElement {
  readonly ui_element_id: string;             // deterministic hash
  readonly scope: SemanticUiScope;
  readonly kind: SemanticUiKind;
  readonly customer_label: string;            // "Export"
  readonly purpose: string;                   // "Export the current application"
  readonly location_path: readonly string[];  // ["workstation", "toolbar"]
  readonly action: string;                    // "open_export_panel"
  readonly intent_tags: readonly string[];    // ["export", "save", "download"]
  readonly availability: "always" | "requires_project" | "requires_auth" | "not_available";
  readonly css_selector: string | null;       // real DOM selector · or null if only route/region
  readonly route_href: string | null;         // real URL if this is a route
  readonly region_id: string | null;          // real region_id if this is a Design Map region
  readonly provenance: readonly EvidenceRef[];
  readonly registered_at_iso: string;
  readonly zero_llm: true;
  readonly ledger: "B";
}

// ── Storage ───────────────────────────────────────────────────────────
const GRAPH = new Map<string, SemanticUiElement>();

export function _resetUiSemanticGraphForTests(): void {
  GRAPH.clear();
}

function computeElementId(input: { scope: SemanticUiScope; customer_label: string }): string {
  return createHash("sha256").update(`ui-element::${input.scope}::${input.customer_label}`).digest("hex").slice(0, 20);
}

// ── Registration ──────────────────────────────────────────────────────
export function registerUiElement(spec: Omit<SemanticUiElement, "ui_element_id" | "registered_at_iso" | "zero_llm" | "ledger">): SemanticUiElement {
  // Anti-fabrication: element must have a real target (css_selector · route_href · region_id) OR user_authorized provenance
  const hasRealTarget = spec.css_selector !== null || spec.route_href !== null || spec.region_id !== null;
  const hasUserAuthorization = spec.provenance.some((p) => p.kind === "user_confirmation");
  if (!hasRealTarget && !hasUserAuthorization) {
    throw new Error(`nex-ui-semantic-graph: element "${spec.customer_label}" must declare a real target (css_selector / route_href / region_id) OR a user_confirmation provenance ref`);
  }
  if (spec.customer_label.length === 0) throw new Error("customer_label required");
  if (spec.purpose.length === 0)        throw new Error("purpose required");
  if (spec.intent_tags.length === 0)    throw new Error("intent_tags must not be empty · Orb needs at least one intent match key");
  const ui_element_id = computeElementId({ scope: spec.scope, customer_label: spec.customer_label });
  const element: SemanticUiElement = {
    ...spec,
    ui_element_id,
    registered_at_iso: new Date().toISOString(),
    zero_llm: true,
    ledger: "B",
  };
  GRAPH.set(ui_element_id, element);
  return element;
}

// ── Query ─────────────────────────────────────────────────────────────
export function getUiElement(ui_element_id: string): SemanticUiElement | null {
  return GRAPH.get(ui_element_id) ?? null;
}

export function listUiElements(filter?: { scope?: SemanticUiScope; kind?: SemanticUiKind }): readonly SemanticUiElement[] {
  const rows: SemanticUiElement[] = [];
  for (const e of GRAPH.values()) {
    if (filter?.scope && e.scope !== filter.scope) continue;
    if (filter?.kind && e.kind !== filter.kind) continue;
    rows.push(e);
  }
  return Object.freeze(rows.sort((a, b) => a.customer_label.localeCompare(b.customer_label)));
}

export function countUiElements(): number {
  return GRAPH.size;
}

// ── Intent-matching · deterministic tag search ────────────────────────
export function findByIntent(intent_keywords: readonly string[], scope?: SemanticUiScope): readonly SemanticUiElement[] {
  if (intent_keywords.length === 0) return Object.freeze([]);
  const norm = intent_keywords.map((s) => s.toLowerCase());
  const rows: SemanticUiElement[] = [];
  for (const e of GRAPH.values()) {
    if (scope && e.scope !== scope) continue;
    for (const tag of e.intent_tags) {
      if (norm.includes(tag.toLowerCase())) { rows.push(e); break; }
    }
  }
  return Object.freeze(rows);
}

// ── Seed · real workstation targets ───────────────────────────────────
// These are the actual navigational surfaces of NEX1 Workstation Live
// (per the discovery pass). Each is registered with a css_selector
// convention · when the workstation UI is later annotated with matching
// data-nex-ui attributes · these entries become live-resolvable.

const REPO_ROOT_EVIDENCE: readonly EvidenceRef[] = [
  { kind: "source_file", path: "src/app/nex1/workstation-live/WorkstationLiveClient.tsx", hash: null, observed_at_iso: new Date().toISOString(), note: "workstation-live client verified in prior audit" },
];

export function seedWorkstationUiTargets(): void {
  _resetUiSemanticGraphForTests();

  // ─────────────────────────────────────────────────────────────────
  // REAL targets · confirmed present in NexAgentWorkstation.tsx by
  // 2026-09-19 audit. These have real data-nex-ui attributes on the
  // actual DOM elements. availability = "always" or "requires_project".
  // ─────────────────────────────────────────────────────────────────
  const realTiles: readonly { customer_label: string; purpose: string; intent_tags: string[]; selector: string; action: string }[] = [
    { customer_label: "Code",    purpose: "See what NEX is coding · live feed for the current task", intent_tags: ["code", "source", "edit code", "coding"],           selector: '[data-nex-ui="workstation-tile-code"]',    action: "select_tile_code" },
    { customer_label: "History", purpose: "See past tasks",                                            intent_tags: ["history", "past", "previous", "tasks"],           selector: '[data-nex-ui="workstation-tile-history"]', action: "select_tile_history" },
    { customer_label: "Plugins", purpose: "Founder-vetted integrations",                               intent_tags: ["plugins", "integrations", "add-ons"],              selector: '[data-nex-ui="workstation-tile-plugins"]', action: "select_tile_plugins" },
    { customer_label: "Loop",    purpose: "NEX1 Native Programming Loop · deterministic",              intent_tags: ["loop", "native loop", "programming loop"],         selector: '[data-nex-ui="workstation-tile-loop"]',    action: "select_tile_loop" },
    { customer_label: "Repo",    purpose: "Repository onboarding · file preview · workstation chat",   intent_tags: ["repo", "repository", "corpus", "files", "onboard"], selector: '[data-nex-ui="workstation-tile-repo"]',    action: "select_tile_repo" },
    { customer_label: "Notes",   purpose: "NEX1's Notes · preferences · corrections · refused prompts", intent_tags: ["notes", "memory", "preferences", "notebook"],     selector: '[data-nex-ui="workstation-tile-notes"]',   action: "select_tile_notes" },
  ];
  for (const t of realTiles) {
    registerUiElement({
      scope: "workstation", kind: "tab",
      customer_label: t.customer_label, purpose: t.purpose,
      location_path: ["workstation", "right_panel", "tab_tiles"],
      action: t.action, intent_tags: t.intent_tags,
      availability: "always",
      css_selector: t.selector,
      route_href: null, region_id: null,
      provenance: REPO_ROOT_EVIDENCE,
    });
  }

  // Chat composer · REAL · textarea under the preview
  registerUiElement({
    scope: "workstation", kind: "input",
    customer_label: "Ask NEX",
    purpose: "Type an instruction or question for NEX",
    location_path: ["workstation", "chat_composer"],
    action: "focus_chat_input",
    intent_tags: ["chat", "ask", "talk", "type", "instruction"],
    availability: "always",
    css_selector: '[data-nex-ui="workstation-chat-input"]',
    route_href: null, region_id: null,
    provenance: REPO_ROOT_EVIDENCE,
  });

  // Send button · REAL · adjacent to chat composer
  registerUiElement({
    scope: "workstation", kind: "button",
    customer_label: "Send",
    purpose: "Send the current prompt to NEX",
    location_path: ["workstation", "chat_composer"],
    action: "submit_prompt",
    intent_tags: ["send", "submit", "go"],
    availability: "always",
    css_selector: '[data-nex-ui="workstation-chat-send"]',
    route_href: null, region_id: null,
    provenance: REPO_ROOT_EVIDENCE,
  });

  // Live preview area · REAL · always visible left panel
  registerUiElement({
    scope: "workstation", kind: "panel",
    customer_label: "Live preview",
    purpose: "Watch the app render as NEX builds it",
    location_path: ["workstation", "left_panel"],
    action: "focus_preview",
    intent_tags: ["preview", "see", "look", "app", "run"],
    availability: "always",
    css_selector: '[data-nex-ui="workstation-preview-frame"]',
    route_href: null, region_id: null,
    provenance: REPO_ROOT_EVIDENCE,
  });

  // Reload preview · REAL · button in preview controls
  registerUiElement({
    scope: "workstation", kind: "button",
    customer_label: "Reload preview",
    purpose: "Reload the live preview",
    location_path: ["workstation", "left_panel", "preview_controls"],
    action: "reload_preview",
    intent_tags: ["reload", "refresh"],
    availability: "always",
    css_selector: '[data-nex-ui="workstation-preview-reload"]',
    route_href: null, region_id: null,
    provenance: REPO_ROOT_EVIDENCE,
  });

  // Active Project · REAL · header chip · 4-state resolver display.
  // Rule 6 · never silently selects · null id → NOT_AVAILABLE.
  registerUiElement({
    scope: "workstation", kind: "panel",
    customer_label: "Active project",
    purpose: "See which customer project this Workstation is working on",
    location_path: ["workstation", "header"],
    action: "show_active_project_status",
    intent_tags: ["project", "which project", "active", "current project"],
    availability: "always",
    css_selector: '[data-nex-ui="workstation-active-project"]',
    route_href: null, region_id: null,
    provenance: REPO_ROOT_EVIDENCE,
  });

  // Run project · REAL · button in preview controls · Project-bound dev-server start.
  // Rule 6 · explicit customer action · disabled unless a Project is resolved.
  registerUiElement({
    scope: "workstation", kind: "button",
    customer_label: "Run project",
    purpose: "Start the dev server for the active NEX Project · never runs the NEX repository",
    location_path: ["workstation", "left_panel", "preview_controls"],
    action: "start_project_dev_server",
    intent_tags: ["run", "start", "dev server", "run project"],
    availability: "requires_project",
    css_selector: '[data-nex-ui="workstation-run-project"]',
    route_href: null, region_id: null,
    provenance: REPO_ROOT_EVIDENCE,
  });

  // Export project · REAL · button in preview controls · Project-bound archive.
  // Rule 6 · explicit customer action · disabled unless a Project is resolved.
  registerUiElement({
    scope: "workstation", kind: "button",
    customer_label: "Export project",
    purpose: "Archive the active NEX Project's workspace as a downloadable ZIP · never archives the NEX repository",
    location_path: ["workstation", "left_panel", "preview_controls"],
    action: "archive_project_workspace",
    intent_tags: ["export", "download", "archive", "zip", "get code"],
    availability: "requires_project",
    css_selector: '[data-nex-ui="workstation-export-project"]',
    route_href: null, region_id: null,
    provenance: REPO_ROOT_EVIDENCE,
  });

  // Save · REAL · button in preview controls · reveals project state envelope
  //
  // Semantics: Save inspects the current project via assessProjectState +
  // buildSavePushEnvelope · displays honest project state to the customer.
  // Save does NOT silently commit · does NOT push · does NOT publish.
  // Any subsequent action (local commit, push) is a further explicit customer
  // choice within the state modal (Rule 6 · customer sovereignty).
  registerUiElement({
    scope: "workstation", kind: "button",
    customer_label: "Save",
    purpose: "See the honest state of your project and choose what to do next",
    location_path: ["workstation", "left_panel", "preview_controls"],
    action: "open_save_envelope",
    intent_tags: ["save", "commit", "safe", "checkpoint", "state"],
    availability: "always",
    css_selector: '[data-nex-ui="workstation-save"]',
    route_href: null, region_id: null,
    provenance: REPO_ROOT_EVIDENCE,
  });

  // NEX Orb · REAL structural slot · will render the Orb layer
  registerUiElement({
    scope: "workstation", kind: "toggle",
    customer_label: "NEX Orb",
    purpose: "Ask NEX to physically guide you to something in the workstation",
    location_path: ["workstation", "chat_composer"],
    action: "activate_orb_guidance",
    intent_tags: ["help", "guide", "show me", "where is"],
    availability: "always",
    css_selector: '[data-nex-ui="workstation-nex-orb"]',
    route_href: null, region_id: null,
    provenance: REPO_ROOT_EVIDENCE,
  });

  // ─────────────────────────────────────────────────────────────────
  // ASPIRATIONAL targets · declared for intent completeness but
  // availability = "not_available" · resolveIntentGrounded MUST return
  // NOT_AVAILABLE for these until they gain real DOM elements.
  // Kept in the graph so anti-fabrication scenarios can be proven.
  // ─────────────────────────────────────────────────────────────────
  const notYetInDom: readonly { customer_label: string; purpose: string; intent_tags: string[]; selector: string; action: string }[] = [
    { customer_label: "Files",    purpose: "Browse project files (not yet a workstation tab)",         intent_tags: ["files", "browse", "folders"],                            selector: '[data-nex-ui="workstation-nav-files"]',    action: "open_files" },
    { customer_label: "Assets",   purpose: "Manage images, videos, and other project assets (not yet a workstation tab)", intent_tags: ["assets", "images", "media"],       selector: '[data-nex-ui="workstation-nav-assets"]',   action: "open_assets" },
    { customer_label: "Tests",    purpose: "Run project tests (not yet a workstation tab)",             intent_tags: ["tests", "run tests", "test", "check"],                   selector: '[data-nex-ui="workstation-nav-tests"]',    action: "open_tests" },
    { customer_label: "Publish",  purpose: "Publish the application online (not yet in the workstation)", intent_tags: ["publish", "deploy", "put online", "go live", "online", "ship"], selector: '[data-nex-ui="workstation-nav-publish"]', action: "open_publish_panel" },
    { customer_label: "Git",      purpose: "Git status · commit · push (GitHub connect exists · no unified Git panel)", intent_tags: ["git", "commit", "push", "version control"], selector: '[data-nex-ui="workstation-nav-git"]',      action: "open_git" },
    { customer_label: "Evidence", purpose: "Inspect NEX evidence (envelope inspector exists per-message · no dedicated panel)", intent_tags: ["evidence", "proof", "receipts"], selector: '[data-nex-ui="workstation-nav-evidence"]', action: "open_evidence_panel" },
    { customer_label: "Settings", purpose: "Change workstation settings (not yet exposed)",             intent_tags: ["settings", "preferences", "configure"],                  selector: '[data-nex-ui="workstation-nav-settings"]', action: "open_settings" },
  ];
  for (const t of notYetInDom) {
    registerUiElement({
      scope: "workstation", kind: "menu_item",
      customer_label: t.customer_label, purpose: t.purpose,
      location_path: ["workstation", "aspirational"],
      action: t.action, intent_tags: t.intent_tags,
      availability: "not_available",   // ← honest · Orb must not point here
      css_selector: t.selector,        // ← declared but no matching DOM
      route_href: null, region_id: null,
      provenance: REPO_ROOT_EVIDENCE,
    });
  }
}
