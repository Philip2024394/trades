// src/lib/nex-registry/layout-types.ts
//
// NEX Layout Engine · Typed layout specification (Ledger B · Zero LLM)
//
// A LayoutSpec is NOT a template. It is a structural + responsive contract
// describing regions, navigation model, and semantic transformations across
// desktop → tablet → mobile. Templates fill regions with content; a spec
// only declares SLOTS and how they must transform. Founder mandate §6, §7,
// §13.

import { createHash } from "node:crypto";
import type { DeviceSupport, LibraryEntry } from "./types";

export const NEX_LAYOUT_VERSION = "nex-layout.v1.2026-09-19";

// ── Layout families (§5 A-H) ──────────────────────────────────────────
export type LayoutFamily =
  | "product_landing"
  | "application_workspace"
  | "dashboard"
  | "data_directory"
  | "editor_creative"
  | "communication"
  | "mobile_first"
  | "pwa";

export const LAYOUT_FAMILIES: readonly LayoutFamily[] = Object.freeze([
  "product_landing",
  "application_workspace",
  "dashboard",
  "data_directory",
  "editor_creative",
  "communication",
  "mobile_first",
  "pwa",
]);

// ── Navigation models (§7 semantic transformation) ────────────────────
export type NavigationModel =
  | "left_sidebar_expanded"
  | "left_sidebar_compact"
  | "top_bar"
  | "top_bar_with_command"
  | "bottom_navigation"
  | "sheet_navigation"
  | "contextual_toolbar"
  | "no_persistent_navigation"        // e.g. editor canvases
  | "installable_shell_navigation";

// ── Region kinds (semantic slots) ─────────────────────────────────────
export type RegionKind =
  | "primary_navigation"
  | "top_bar"
  | "primary_content"
  | "secondary_content"
  | "detail_panel"
  | "inspector"
  | "canvas"
  | "timeline"
  | "asset_browser"
  | "contextual_actions"
  | "filters"
  | "search"
  | "conversation"
  | "feed"
  | "footer"
  | "install_prompt"
  | "offline_indicator";

// ── Region behaviour on a specific device ─────────────────────────────
export type RegionBehaviour =
  | "persistent_expanded"
  | "persistent_compact"
  | "collapsible"
  | "sheet"
  | "drawer"
  | "bottom_bar"
  | "inline"
  | "hidden"
  | "sticky_top"
  | "sticky_bottom";

// ── One device layout model ───────────────────────────────────────────
export interface DeviceLayoutModel {
  readonly columns: number;              // grid columns · 1..12
  readonly navigation: NavigationModel;
  readonly regions: Readonly<Record<RegionKind, RegionBehaviour>>;
  readonly density: "comfortable" | "medium" | "compact";
}

// ── Responsive transformation (§7) ────────────────────────────────────
export interface ResponsiveTransformation {
  readonly desktop: DeviceLayoutModel;
  readonly tablet_landscape: DeviceLayoutModel;
  readonly tablet_portrait: DeviceLayoutModel;
  readonly mobile: DeviceLayoutModel;
}

// ── Visual probe evidence (three-viewport minimum for PASS_MODERN) ────
export interface ScreenshotProbe {
  readonly screenshot_hash: string;
  readonly viewport: "desktop" | "tablet-portrait" | "tablet-landscape" | "mobile-portrait" | "mobile-landscape";
  readonly rendered_ok: boolean;
  readonly overflow_detected: boolean;
  readonly missing_icons: boolean;
  readonly broken_images: boolean;
  readonly interaction_targets_meet_minimum_size: boolean;
  readonly primary_action_visible: boolean;
  readonly probed_at_iso: string;
}

// ── The main LayoutSpec (§13 · deliberately compact) ──────────────────
export interface LayoutSpec {
  readonly layout_id: string;                 // deterministic hash
  readonly layout_family: LayoutFamily;
  readonly name: string;
  readonly description: string;
  readonly product_context: readonly string[];   // e.g. ["saas", "operational"]
  readonly primary_goal: string;                 // one-line semantic goal
  readonly regions: readonly RegionKind[];       // regions this layout occupies
  readonly component_slots: Readonly<Record<RegionKind, readonly string[]>>;
    // Map region → allowed registry entry_ids / names (references to Component Registry)
  readonly responsive: ResponsiveTransformation;
  readonly device_support: DeviceSupport;
  readonly design_system_requirements: readonly string[];
    // e.g. ["NexHudTheme", "shadcn/ui"]
  readonly accessibility_requirements: readonly string[];
    // e.g. ["keyboard_navigable", "aria_landmarks", "focus_visible"]
  readonly motion_requirements: readonly string[];
    // e.g. ["prefers_reduced_motion_respected"]
  readonly modernity_status: "current" | "modern" | "legacy" | "outdated" | "not_assessed";
  readonly quality_tier: "CORE" | "APPROVED" | "ALTERNATIVE" | "SPECIALIST" | "EXPERIMENTAL" | "LEGACY" | "QUARANTINED" | "DO_NOT_USE";
  readonly visual_probes: readonly ScreenshotProbe[];
  readonly documented_at_iso: string;
  readonly zero_llm: true;
  readonly ledger: "B";
}

// ── Deterministic layout_id ───────────────────────────────────────────
export function computeLayoutId(input: { family: LayoutFamily; name: string }): string {
  return createHash("sha256").update(`layout::${input.family}::${input.name}`).digest("hex").slice(0, 20);
}

// ── Type guards ────────────────────────────────────────────────────────
export function isCoreLayout(spec: LayoutSpec): boolean {
  return spec.quality_tier === "CORE";
}

export function hasThreeViewportEvidence(probes: readonly ScreenshotProbe[]): boolean {
  const seen = new Set(probes.filter((p) => p.rendered_ok && !p.overflow_detected && !p.missing_icons && !p.broken_images).map((p) => p.viewport));
  return seen.has("desktop") && (seen.has("tablet-portrait") || seen.has("tablet-landscape")) && (seen.has("mobile-portrait") || seen.has("mobile-landscape"));
}

// ── Bridge to the base LibraryEntry (§11 registry compatibility) ──────
export function libraryEntryForLayout(spec: LayoutSpec, provenance: LibraryEntry["provenance"]): LibraryEntry {
  return {
    entry_id: spec.layout_id,
    category: "layout",
    name: spec.name,
    description: spec.description,
    quality_tier: spec.quality_tier,
    provenance,
    usage_context: spec.product_context,
    variants: spec.regions.map((r) => r as string),
    device_support: spec.device_support,
    path_in_repo: null,
    proxy_target: null,
    documented_at_iso: spec.documented_at_iso,
    zero_llm: true,
    ledger: "B",
  };
}
