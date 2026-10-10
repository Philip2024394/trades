// src/lib/nex-registry/layout-registry.ts
//
// NEX Layout Engine · Registry + semantic router (Ledger B · Zero LLM)
//
// Founder mandate: SMALL, EXCELLENT, GOVERNED CORE. No mass imports.
// Every CORE layout must be modern · responsive · registry-compatible.
// The router is deterministic keyword matching · never fabricates when
// ambiguous → returns UNRESOLVED.

import { computeProvenanceHash, type ProvenanceRecord } from "./types";
import {
  computeLayoutId,
  LAYOUT_FAMILIES,
  type DeviceLayoutModel,
  type LayoutFamily,
  type LayoutSpec,
  type NavigationModel,
  type RegionBehaviour,
  type RegionKind,
  type ResponsiveTransformation,
} from "./layout-types";

// ── Storage ────────────────────────────────────────────────────────────
const LAYOUTS = new Map<string, LayoutSpec>();

export function _resetLayoutRegistryForTests(): void {
  LAYOUTS.clear();
}

// ── Registration ──────────────────────────────────────────────────────
export function registerLayout(spec: Omit<LayoutSpec, "layout_id" | "documented_at_iso" | "zero_llm" | "ledger">): LayoutSpec {
  const layout_id = computeLayoutId({ family: spec.layout_family, name: spec.name });
  // Anti-fabrication: outdated/legacy cannot be CORE/APPROVED.
  if ((spec.modernity_status === "outdated" || spec.modernity_status === "legacy")
      && (spec.quality_tier === "CORE" || spec.quality_tier === "APPROVED")) {
    throw new Error(`nex-layout: cannot register ${spec.name} as ${spec.quality_tier} with modernity_status=${spec.modernity_status}`);
  }
  // Anti-fabrication: CORE requires desktop + tablet + mobile explicitly declared.
  if (spec.quality_tier === "CORE" || spec.quality_tier === "APPROVED") {
    if (!spec.responsive.desktop || !spec.responsive.tablet_portrait || !spec.responsive.mobile) {
      throw new Error(`nex-layout: ${spec.quality_tier} layout ${spec.name} must declare desktop + tablet_portrait + mobile responsive models`);
    }
  }
  const full: LayoutSpec = {
    ...spec,
    layout_id,
    documented_at_iso: new Date().toISOString(),
    zero_llm: true,
    ledger: "B",
  };
  LAYOUTS.set(layout_id, full);
  return full;
}

export function getLayout(layout_id: string): LayoutSpec | null {
  return LAYOUTS.get(layout_id) ?? null;
}

export function listByFamily(family: LayoutFamily): readonly LayoutSpec[] {
  const rows: LayoutSpec[] = [];
  for (const l of LAYOUTS.values()) if (l.layout_family === family) rows.push(l);
  return Object.freeze(rows.sort((a, b) => a.name.localeCompare(b.name)));
}

export function listAllLayouts(): readonly LayoutSpec[] {
  return Object.freeze(Array.from(LAYOUTS.values()).sort((a, b) => a.name.localeCompare(b.name)));
}

export function countLayouts(): number {
  return LAYOUTS.size;
}

// ── Helper: build a ProvenanceRecord for a NEX-native layout ──────────
function nexNativeProvenance(): ProvenanceRecord {
  const iso = new Date().toISOString();
  const base = {
    source_repository: null,
    source_url: null,
    source_commit: null,
    source_version: "nex-layout.v1.2026-09-19",
    license: "PROPRIETARY_NEX" as const,
    license_verified: true,
    framework: ["react", "tailwindcss", "next.js"],
    dependencies: [],
    security_status: "clean" as const,
    accessibility_status: "not_assessed" as const,
    visual_quality: "good" as const,
    modernity_status: "current" as const,
    nex_compatibility: "verified" as const,
    nex_modifications: [],
    import_date: iso,
  };
  return { ...base, provenance_hash: computeProvenanceHash(base) };
}

// ── Region helpers ────────────────────────────────────────────────────
function regions(entries: Record<RegionKind, RegionBehaviour>): Readonly<Record<RegionKind, RegionBehaviour>> {
  return Object.freeze({ ...entries }) as Readonly<Record<RegionKind, RegionBehaviour>>;
}

// ── CORE layout seeds (§5 · 7 patterns · deliberately small) ──────────
export function seedCoreLayouts(): void {
  _resetLayoutRegistryForTests();

  // 1. FOCUSED DASHBOARD · Family C · desktop-primary but genuine responsive
  {
    const desktop: DeviceLayoutModel = {
      columns: 12,
      navigation: "left_sidebar_expanded",
      density: "medium",
      regions: regions({
        primary_navigation: "persistent_expanded",
        top_bar: "sticky_top",
        primary_content: "inline",
        secondary_content: "inline",
        detail_panel: "collapsible",
        inspector: "hidden",
        canvas: "hidden",
        timeline: "hidden",
        asset_browser: "hidden",
        contextual_actions: "sticky_top",
        filters: "sticky_top",
        search: "sticky_top",
        conversation: "hidden",
        feed: "hidden",
        footer: "hidden",
        install_prompt: "hidden",
        offline_indicator: "hidden",
      }),
    };
    const tablet: DeviceLayoutModel = { ...desktop, columns: 8, navigation: "left_sidebar_compact", regions: regions({ ...desktop.regions, primary_navigation: "persistent_compact", detail_panel: "collapsible" }) };
    const mobile: DeviceLayoutModel = { ...desktop, columns: 1, navigation: "bottom_navigation", density: "compact", regions: regions({ ...desktop.regions, primary_navigation: "bottom_bar", top_bar: "sticky_top", detail_panel: "sheet", contextual_actions: "sticky_bottom", filters: "sheet", search: "sticky_top" }) };
    registerLayout({
      layout_family: "dashboard",
      name: "focused-dashboard",
      description: "Focused dashboard with left navigation, sticky command bar, and a collapsible detail panel. Mobile switches navigation to bottom bar and detail panel to sheet.",
      product_context: ["saas", "operational_dashboard"],
      primary_goal: "monitor and act on live operational state",
      regions: ["primary_navigation", "top_bar", "primary_content", "detail_panel", "contextual_actions", "filters", "search"],
      component_slots: {
        primary_navigation: ["Sheet", "Tabs"],
        top_bar: ["Input", "Button", "Avatar"],
        primary_content: ["Card"],
        secondary_content: [],
        detail_panel: ["Sheet"],
        inspector: [],
        canvas: [],
        timeline: [],
        asset_browser: [],
        contextual_actions: ["Button", "DropdownMenu"],
        filters: ["Select", "Popover"],
        search: ["Input"],
        conversation: [],
        feed: [],
        footer: [],
        install_prompt: [],
        offline_indicator: [],
      },
      responsive: { desktop, tablet_landscape: tablet, tablet_portrait: tablet, mobile },
      device_support: { desktop: true, tablet: true, mobile: true, pwa: true },
      design_system_requirements: ["NexHudTheme", "shadcn/ui"],
      accessibility_requirements: ["keyboard_navigable", "aria_landmarks", "focus_visible"],
      motion_requirements: ["prefers_reduced_motion_respected"],
      modernity_status: "current",
      quality_tier: "CORE",
      visual_probes: [],
    });
  }

  // 2. ANALYTICAL DASHBOARD · alternative dashboard structure (different from focused)
  {
    const desktop: DeviceLayoutModel = {
      columns: 12, navigation: "top_bar_with_command", density: "comfortable",
      regions: regions({
        primary_navigation: "sticky_top", top_bar: "sticky_top",
        primary_content: "inline", secondary_content: "inline",
        detail_panel: "hidden", inspector: "hidden", canvas: "hidden",
        timeline: "hidden", asset_browser: "hidden",
        contextual_actions: "sticky_top", filters: "inline",
        search: "sticky_top", conversation: "hidden", feed: "hidden",
        footer: "hidden", install_prompt: "hidden", offline_indicator: "hidden",
      }),
    };
    const tablet: DeviceLayoutModel = { ...desktop, columns: 8, density: "medium" };
    const mobile: DeviceLayoutModel = { columns: 1, navigation: "bottom_navigation", density: "compact",
      regions: regions({ ...desktop.regions, primary_navigation: "bottom_bar", filters: "sheet", search: "sticky_top", contextual_actions: "sticky_bottom" }) };
    registerLayout({
      layout_family: "dashboard",
      name: "analytical-dashboard",
      description: "Analytical dashboard using a top command bar rather than a sidebar. Chart-forward composition. Mobile compresses to bottom navigation with a search-first header.",
      product_context: ["analytics", "reporting"],
      primary_goal: "explore metrics and drill down",
      regions: ["primary_navigation", "top_bar", "primary_content", "secondary_content", "contextual_actions", "filters", "search"],
      component_slots: {
        primary_navigation: ["Tabs"],
        top_bar: ["Input", "Button", "DropdownMenu"],
        primary_content: ["Card"],
        secondary_content: ["Card"],
        detail_panel: [],
        inspector: [],
        canvas: [],
        timeline: [],
        asset_browser: [],
        contextual_actions: ["Button", "Popover"],
        filters: ["Select"],
        search: ["Input"],
        conversation: [],
        feed: [],
        footer: [],
        install_prompt: [],
        offline_indicator: [],
      },
      responsive: { desktop, tablet_landscape: tablet, tablet_portrait: tablet, mobile },
      device_support: { desktop: true, tablet: true, mobile: true, pwa: true },
      design_system_requirements: ["NexHudTheme", "shadcn/ui"],
      accessibility_requirements: ["keyboard_navigable", "aria_landmarks", "focus_visible", "screen_reader_labels"],
      motion_requirements: ["prefers_reduced_motion_respected"],
      modernity_status: "current",
      quality_tier: "CORE",
      visual_probes: [],
    });
  }

  // 3. EDITOR CANVAS + INSPECTOR · Family E
  {
    const desktop: DeviceLayoutModel = {
      columns: 12, navigation: "no_persistent_navigation", density: "comfortable",
      regions: regions({
        primary_navigation: "hidden", top_bar: "sticky_top",
        primary_content: "hidden", secondary_content: "hidden",
        detail_panel: "hidden", inspector: "persistent_expanded",
        canvas: "inline", timeline: "hidden", asset_browser: "persistent_compact",
        contextual_actions: "sticky_top", filters: "hidden", search: "hidden",
        conversation: "hidden", feed: "hidden", footer: "hidden",
        install_prompt: "hidden", offline_indicator: "hidden",
      }),
    };
    const tablet: DeviceLayoutModel = { ...desktop, columns: 8, regions: regions({ ...desktop.regions, inspector: "collapsible", asset_browser: "drawer" }) };
    const mobile: DeviceLayoutModel = { columns: 1, navigation: "sheet_navigation", density: "compact",
      regions: regions({ ...desktop.regions, top_bar: "sticky_top", inspector: "sheet", asset_browser: "sheet", contextual_actions: "sticky_bottom", canvas: "inline" }) };
    registerLayout({
      layout_family: "editor_creative",
      name: "editor-canvas-inspector",
      description: "Editor with a central canvas, a persistent inspector on desktop, and an asset browser. Mobile promotes inspector and assets to sheets.",
      product_context: ["creative", "editor"],
      primary_goal: "author or manipulate a work-piece",
      regions: ["top_bar", "canvas", "inspector", "asset_browser", "contextual_actions"],
      component_slots: {
        primary_navigation: [],
        top_bar: ["Button", "DropdownMenu"],
        primary_content: [],
        secondary_content: [],
        detail_panel: [],
        inspector: ["Card", "Tabs", "Input", "Select"],
        canvas: [],
        timeline: [],
        asset_browser: ["Card", "Input"],
        contextual_actions: ["Button", "Sheet"],
        filters: [],
        search: [],
        conversation: [],
        feed: [],
        footer: [],
        install_prompt: [],
        offline_indicator: [],
      },
      responsive: { desktop, tablet_landscape: tablet, tablet_portrait: tablet, mobile },
      device_support: { desktop: true, tablet: true, mobile: true, pwa: false },
      design_system_requirements: ["NexHudTheme", "shadcn/ui"],
      accessibility_requirements: ["keyboard_navigable", "focus_visible"],
      motion_requirements: ["prefers_reduced_motion_respected"],
      modernity_status: "current",
      quality_tier: "CORE",
      visual_probes: [],
    });
  }

  // 4. SEARCHABLE DIRECTORY · Family D
  {
    const desktop: DeviceLayoutModel = {
      columns: 12, navigation: "top_bar", density: "medium",
      regions: regions({
        primary_navigation: "sticky_top", top_bar: "sticky_top",
        primary_content: "inline", secondary_content: "inline",
        detail_panel: "persistent_expanded", inspector: "hidden",
        canvas: "hidden", timeline: "hidden", asset_browser: "hidden",
        contextual_actions: "inline", filters: "sticky_top",
        search: "sticky_top", conversation: "hidden", feed: "hidden",
        footer: "hidden", install_prompt: "hidden", offline_indicator: "hidden",
      }),
    };
    const tablet: DeviceLayoutModel = { ...desktop, columns: 8, regions: regions({ ...desktop.regions, detail_panel: "collapsible" }) };
    const mobile: DeviceLayoutModel = { columns: 1, navigation: "bottom_navigation", density: "compact",
      regions: regions({ ...desktop.regions, primary_navigation: "bottom_bar", detail_panel: "sheet", filters: "sheet", search: "sticky_top", contextual_actions: "sticky_bottom" }) };
    registerLayout({
      layout_family: "data_directory",
      name: "searchable-directory",
      description: "Directory with persistent detail on desktop, collapsible on tablet, and a sheet-based detail flow on mobile. Filters live in a sheet on mobile.",
      product_context: ["directory", "search", "marketplace"],
      primary_goal: "discover and open a specific item",
      regions: ["primary_navigation", "top_bar", "primary_content", "detail_panel", "filters", "search", "contextual_actions"],
      component_slots: {
        primary_navigation: ["Tabs"],
        top_bar: ["Input"],
        primary_content: ["Card"],
        secondary_content: [],
        detail_panel: ["Sheet"],
        inspector: [],
        canvas: [],
        timeline: [],
        asset_browser: [],
        contextual_actions: ["Button"],
        filters: ["Select", "Popover"],
        search: ["Input"],
        conversation: [],
        feed: [],
        footer: [],
        install_prompt: [],
        offline_indicator: [],
      },
      responsive: { desktop, tablet_landscape: tablet, tablet_portrait: tablet, mobile },
      device_support: { desktop: true, tablet: true, mobile: true, pwa: true },
      design_system_requirements: ["NexHudTheme", "shadcn/ui"],
      accessibility_requirements: ["keyboard_navigable", "aria_landmarks", "focus_visible"],
      motion_requirements: ["prefers_reduced_motion_respected"],
      modernity_status: "current",
      quality_tier: "CORE",
      visual_probes: [],
    });
  }

  // 5. BOTTOM-NAV MOBILE APP · Family G · mobile-first
  {
    const desktop: DeviceLayoutModel = {
      columns: 8, navigation: "left_sidebar_compact", density: "medium",
      regions: regions({
        primary_navigation: "persistent_compact", top_bar: "sticky_top",
        primary_content: "inline", secondary_content: "hidden",
        detail_panel: "hidden", inspector: "hidden",
        canvas: "hidden", timeline: "hidden", asset_browser: "hidden",
        contextual_actions: "inline", filters: "hidden", search: "sticky_top",
        conversation: "hidden", feed: "hidden", footer: "hidden",
        install_prompt: "hidden", offline_indicator: "hidden",
      }),
    };
    const tablet: DeviceLayoutModel = { ...desktop, columns: 4, density: "medium" };
    const mobile: DeviceLayoutModel = { columns: 1, navigation: "bottom_navigation", density: "compact",
      regions: regions({ ...desktop.regions, primary_navigation: "bottom_bar", top_bar: "sticky_top", contextual_actions: "sticky_bottom" }) };
    registerLayout({
      layout_family: "mobile_first",
      name: "bottom-nav-mobile-app",
      description: "Mobile-first application shell with bottom navigation on phones, compact sidebar on tablets, and a slim compact sidebar on desktop. Not shrunk desktop.",
      product_context: ["consumer", "mobile_first"],
      primary_goal: "primary task on the move",
      regions: ["primary_navigation", "top_bar", "primary_content", "contextual_actions", "search"],
      component_slots: {
        primary_navigation: ["Tabs"],
        top_bar: ["Button"],
        primary_content: ["Card"],
        secondary_content: [],
        detail_panel: [],
        inspector: [],
        canvas: [],
        timeline: [],
        asset_browser: [],
        contextual_actions: ["Button"],
        filters: [],
        search: ["Input"],
        conversation: [],
        feed: [],
        footer: [],
        install_prompt: [],
        offline_indicator: [],
      },
      responsive: { desktop, tablet_landscape: tablet, tablet_portrait: tablet, mobile },
      device_support: { desktop: true, tablet: true, mobile: true, pwa: true },
      design_system_requirements: ["NexHudTheme", "shadcn/ui"],
      accessibility_requirements: ["keyboard_navigable", "focus_visible", "touch_targets_44px"],
      motion_requirements: ["prefers_reduced_motion_respected"],
      modernity_status: "current",
      quality_tier: "CORE",
      visual_probes: [],
    });
  }

  // 6. INSTALLABLE PWA SHELL · Family H
  {
    const desktop: DeviceLayoutModel = {
      columns: 12, navigation: "installable_shell_navigation", density: "medium",
      regions: regions({
        primary_navigation: "persistent_expanded", top_bar: "sticky_top",
        primary_content: "inline", secondary_content: "inline",
        detail_panel: "collapsible", inspector: "hidden",
        canvas: "hidden", timeline: "hidden", asset_browser: "hidden",
        contextual_actions: "inline", filters: "sticky_top",
        search: "sticky_top", conversation: "hidden", feed: "hidden",
        footer: "hidden", install_prompt: "sticky_top",
        offline_indicator: "sticky_top",
      }),
    };
    const tablet: DeviceLayoutModel = { ...desktop, columns: 8, navigation: "left_sidebar_compact", regions: regions({ ...desktop.regions, primary_navigation: "persistent_compact" }) };
    const mobile: DeviceLayoutModel = { columns: 1, navigation: "bottom_navigation", density: "compact",
      regions: regions({ ...desktop.regions, primary_navigation: "bottom_bar", detail_panel: "sheet", filters: "sheet", install_prompt: "sticky_bottom", offline_indicator: "sticky_top" }) };
    registerLayout({
      layout_family: "pwa",
      name: "installable-pwa-shell",
      description: "PWA application shell with an install prompt band, an offline indicator, and responsive navigation that becomes bottom navigation on mobile.",
      product_context: ["pwa", "field_work"],
      primary_goal: "work reliably online and offline",
      regions: ["primary_navigation", "top_bar", "primary_content", "detail_panel", "filters", "search", "install_prompt", "offline_indicator"],
      component_slots: {
        primary_navigation: ["Tabs"],
        top_bar: ["Input", "Button"],
        primary_content: ["Card"],
        secondary_content: ["Card"],
        detail_panel: ["Sheet"],
        inspector: [],
        canvas: [],
        timeline: [],
        asset_browser: [],
        contextual_actions: ["Button"],
        filters: ["Select"],
        search: ["Input"],
        conversation: [],
        feed: [],
        footer: [],
        install_prompt: ["Alert", "Button"],
        offline_indicator: ["Alert"],
      },
      responsive: { desktop, tablet_landscape: tablet, tablet_portrait: tablet, mobile },
      device_support: { desktop: true, tablet: true, mobile: true, pwa: true },
      design_system_requirements: ["NexHudTheme", "shadcn/ui"],
      accessibility_requirements: ["keyboard_navigable", "aria_landmarks", "focus_visible", "offline_indication"],
      motion_requirements: ["prefers_reduced_motion_respected"],
      modernity_status: "current",
      quality_tier: "CORE",
      visual_probes: [],
    });
  }

  // 7. FOCUSED PRODUCT LANDING · Family A · minimal restrained
  {
    const desktop: DeviceLayoutModel = {
      columns: 12, navigation: "top_bar", density: "comfortable",
      regions: regions({
        primary_navigation: "sticky_top", top_bar: "sticky_top",
        primary_content: "inline", secondary_content: "inline",
        detail_panel: "hidden", inspector: "hidden",
        canvas: "hidden", timeline: "hidden", asset_browser: "hidden",
        contextual_actions: "inline", filters: "hidden", search: "hidden",
        conversation: "hidden", feed: "hidden", footer: "inline",
        install_prompt: "hidden", offline_indicator: "hidden",
      }),
    };
    const tablet: DeviceLayoutModel = { ...desktop, columns: 8 };
    const mobile: DeviceLayoutModel = { columns: 1, navigation: "sheet_navigation", density: "compact",
      regions: regions({
        ...desktop.regions,
        primary_navigation: "sheet",
        top_bar: "sticky_top",
        secondary_content: "hidden",
        contextual_actions: "sticky_bottom",
        footer: "inline",
      }) };
    registerLayout({
      layout_family: "product_landing",
      name: "focused-product-landing",
      description: "Restrained composition around a single primary action. Rejects the hero-plus-three-cards-plus-testimonials cliché in favour of hierarchy and typography.",
      product_context: ["landing", "conversion"],
      primary_goal: "communicate value and drive one action",
      regions: ["primary_navigation", "primary_content", "secondary_content", "contextual_actions", "footer"],
      component_slots: {
        primary_navigation: ["Button"],
        top_bar: ["Button"],
        primary_content: ["Card", "Button"],
        secondary_content: ["Card"],
        detail_panel: [],
        inspector: [],
        canvas: [],
        timeline: [],
        asset_browser: [],
        contextual_actions: ["Button"],
        filters: [],
        search: [],
        conversation: [],
        feed: [],
        footer: [],
        install_prompt: [],
        offline_indicator: [],
      },
      responsive: { desktop, tablet_landscape: tablet, tablet_portrait: tablet, mobile },
      device_support: { desktop: true, tablet: true, mobile: true, pwa: false },
      design_system_requirements: ["NexHudTheme", "shadcn/ui"],
      accessibility_requirements: ["keyboard_navigable", "aria_landmarks", "focus_visible"],
      motion_requirements: ["prefers_reduced_motion_respected"],
      modernity_status: "current",
      quality_tier: "CORE",
      visual_probes: [],
    });
  }
}

// ── Semantic router (§14 · deterministic · never fabricates) ──────────
export interface RouterInput {
  readonly text: string;              // raw user request
  readonly n_alternatives?: number;   // §15 · give-me-three mode
}

export type RouterResolution =
  | { readonly resolution: "resolved"; readonly primary: LayoutFamily; readonly alternatives: readonly LayoutFamily[]; readonly signals: readonly string[] }
  | { readonly resolution: "unresolved"; readonly reason: string; readonly signals: readonly string[] };

// ── Deterministic keyword tables ──────────────────────────────────────
const FAMILY_KEYWORDS: Readonly<Record<LayoutFamily, readonly string[]>> = Object.freeze({
  product_landing: ["landing", "marketing site", "product page", "homepage", "brochure"],
  application_workspace: ["workspace", "workbench", "cockpit"],
  dashboard: ["dashboard", "kpi", "monitor", "metrics", "analytics dashboard", "operational"],
  data_directory: ["directory", "catalogue", "catalog", "marketplace", "search results", "listing"],
  editor_creative: ["editor", "canvas", "media workspace", "creative tool", "image edit", "video edit", "design tool"],
  communication: ["chat", "messaging", "inbox", "conversation", "feed", "social", "community"],
  mobile_first: ["mobile-first", "mobile app", "phone-first"],
  pwa: ["pwa", "offline", "installable", "progressive web app"],
});

const AMBIGUITY_TERMS: readonly string[] = Object.freeze([
  "modern app", "modern application", "modern site", "modern product", "beautiful app",
]);

export function routeRequest(input: RouterInput): RouterResolution {
  const t = input.text.toLowerCase();
  const hits: LayoutFamily[] = [];
  const signals: string[] = [];

  for (const family of LAYOUT_FAMILIES) {
    for (const kw of FAMILY_KEYWORDS[family]) {
      if (t.includes(kw)) {
        hits.push(family);
        signals.push(`kw:${kw} → ${family}`);
        break;
      }
    }
  }

  // Deduplicate hits, preserve order
  const uniq: LayoutFamily[] = [];
  for (const h of hits) if (!uniq.includes(h)) uniq.push(h);

  if (uniq.length === 0) {
    for (const term of AMBIGUITY_TERMS) if (t.includes(term)) signals.push(`ambiguity:${term}`);
    return { resolution: "unresolved", reason: "no family keyword matched · request too ambiguous", signals };
  }

  // If mobile-first or pwa modifier co-occurs with another family, that family becomes primary and mobile/pwa becomes a support signal
  const modifiers = ["mobile_first", "pwa"] as const;
  const nonModifierHits = uniq.filter((f) => !modifiers.includes(f as typeof modifiers[number]));
  const modifierHits = uniq.filter((f) => modifiers.includes(f as typeof modifiers[number]));
  let primary: LayoutFamily;
  if (nonModifierHits.length > 0) {
    primary = nonModifierHits[0];
    for (const m of modifierHits) signals.push(`modifier:${m}`);
  } else {
    primary = uniq[0];
  }
  const alternatives = uniq.filter((f) => f !== primary);
  return { resolution: "resolved", primary, alternatives, signals };
}

// ── Layout selection · pick real registered layouts for a family ──────
export function selectLayoutsForFamily(family: LayoutFamily, max: number = 3): readonly LayoutSpec[] {
  const rows = listByFamily(family);
  return rows.slice(0, Math.max(1, max));
}

// ── Registry manifest ─────────────────────────────────────────────────
export function exportLayoutManifest(): { version: string; total: number; by_family: Record<LayoutFamily, number>; generated_at_iso: string; zero_llm: true; ledger: "B" } {
  const by_family = Object.fromEntries(LAYOUT_FAMILIES.map((f) => [f, 0])) as Record<LayoutFamily, number>;
  for (const l of LAYOUTS.values()) by_family[l.layout_family] += 1;
  return {
    version: "nex-layout.v1.2026-09-19",
    total: LAYOUTS.size,
    by_family,
    generated_at_iso: new Date().toISOString(),
    zero_llm: true,
    ledger: "B",
  };
}

// Re-export the native provenance helper for tests
export { nexNativeProvenance };
