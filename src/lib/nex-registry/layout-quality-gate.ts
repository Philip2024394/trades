// src/lib/nex-registry/layout-quality-gate.ts
//
// NEX Layout Quality Gate · L1-L10 signals (Ledger B · Zero LLM)
//
// Strict-by-default. Extends the modernity-quality-gate with layout-specific
// signals per founder mandate §9. Founder rule: outdated → REJECT. No
// PASS_MODERN without three-viewport visual probe evidence.

import type { LayoutSpec, ScreenshotProbe, RegionKind, RegionBehaviour } from "./layout-types";
import { hasThreeViewportEvidence } from "./layout-types";

export const LAYOUT_QUALITY_GATE_VERSION = "layout-quality-gate.v1.2026-09-19";

export type LayoutSignalBand = "pass" | "conditional" | "reject" | "unknown_needs_probe";

export interface LayoutSignalResult {
  readonly signal: string;   // L1 · L2 · … · L10
  readonly name: string;
  readonly band: LayoutSignalBand;
  readonly rationale: string;
  readonly evidence: string;
}

export type LayoutQualityVerdict =
  | "PASS_MODERN"
  | "PASS_CONDITIONAL_VISUAL_PROBE_REQUIRED"
  | "REJECT_OUTDATED"
  | "REJECT_RESPONSIVE_FAILURE"
  | "REJECT_ACCESSIBILITY_FAILURE"
  | "REJECT_CONSISTENCY_FAILURE"
  | "REJECT_COMPOSITION_FAILURE"
  | "REJECT_INSUFFICIENT_EVIDENCE";

export interface LayoutQualityResult {
  readonly layout_id: string;
  readonly layout_name: string;
  readonly verdict: LayoutQualityVerdict;
  readonly signals: readonly LayoutSignalResult[];
  readonly rejection_reasons: readonly string[];
  readonly required_visual_probe: boolean;
  readonly assessed_at_iso: string;
  readonly gate_version: string;
  readonly zero_llm: true;
  readonly ledger: "B";
}

// ── Descriptor screens (§10) ──────────────────────────────────────────
const OUTDATED_LAYOUT_DESCRIPTORS: readonly RegExp[] = Object.freeze([
  /\bgeneric[- ]saas\b/i,
  /\bobsolete admin template\b/i,
  /\bbootstrap[- ]era\b/i,
  /\bgiant hero by default\b/i,
  /\bexcessive card grid\b/i,
  /\bexcessive pill ui\b/i,
  /\bexcessive rounded containers?\b/i,
  /\bexcessive shadows?\b/i,
  /\brainbow gradient/i,
  /\bfake glass\b/i,
  /\bai[- ]purple[- ]glow\b/i,
  /\bmobile desktop[- ]shrink\b/i,
  /\bdense enterprise clutter\b/i,
  /\btemplate[- ]looking\b/i,
]);

// ── Signal implementations ────────────────────────────────────────────

// L1 · hierarchy — Does the primary action have a distinct region and slot?
function signalL1_hierarchy(spec: LayoutSpec): LayoutSignalResult {
  const hasPrimaryContent = spec.regions.includes("primary_content") || spec.regions.includes("canvas") || spec.regions.includes("feed");
  const hasActionsOrNav = spec.regions.includes("contextual_actions") || spec.regions.includes("primary_navigation") || spec.regions.includes("top_bar");
  if (hasPrimaryContent && hasActionsOrNav) {
    return { signal: "L1", name: "hierarchy", band: "pass", rationale: "primary content + actions/nav declared", evidence: `regions=${spec.regions.join(",")}` };
  }
  return { signal: "L1", name: "hierarchy", band: "reject", rationale: "missing primary content or action region", evidence: `regions=${spec.regions.join(",")}` };
}

// L2 · composition — Any forbidden descriptor?
function signalL2_composition(spec: LayoutSpec): LayoutSignalResult {
  const desc = spec.description.toLowerCase();
  for (const rx of OUTDATED_LAYOUT_DESCRIPTORS) {
    if (rx.test(desc)) return { signal: "L2", name: "composition", band: "reject", rationale: "descriptor matches outdated layout pattern", evidence: rx.source };
  }
  // Otherwise composition is only truly checkable via render probe.
  return { signal: "L2", name: "composition", band: "unknown_needs_probe", rationale: "no forbidden descriptor · composition needs render probe", evidence: "descriptor_clean" };
}

// L3 · density — Does the mobile model use compact density?
function signalL3_density(spec: LayoutSpec): LayoutSignalResult {
  if (spec.responsive.mobile.density !== "compact") {
    return { signal: "L3", name: "density", band: "reject", rationale: "mobile density is not compact · likely desktop-shrunk", evidence: `mobile.density=${spec.responsive.mobile.density}` };
  }
  return { signal: "L3", name: "density", band: "pass", rationale: "mobile density is compact", evidence: `mobile.density=${spec.responsive.mobile.density}` };
}

// L4 · navigation — Does mobile use bottom_navigation or sheet_navigation
// (not just shrunk left sidebar)?
function signalL4_navigation(spec: LayoutSpec): LayoutSignalResult {
  const acceptedMobileNav = ["bottom_navigation", "sheet_navigation", "top_bar", "installable_shell_navigation", "no_persistent_navigation"];
  if (!acceptedMobileNav.includes(spec.responsive.mobile.navigation)) {
    return { signal: "L4", name: "navigation", band: "reject", rationale: `mobile navigation ${spec.responsive.mobile.navigation} not mobile-appropriate`, evidence: `mobile.navigation=${spec.responsive.mobile.navigation}` };
  }
  return { signal: "L4", name: "navigation", band: "pass", rationale: "mobile navigation is mobile-appropriate", evidence: `mobile.navigation=${spec.responsive.mobile.navigation}` };
}

// L5 · responsive genuineness — Do desktop and mobile actually differ
// structurally? (Navigation OR primary region behaviour must change.)
function signalL5_responsive(spec: LayoutSpec): LayoutSignalResult {
  const d = spec.responsive.desktop;
  const m = spec.responsive.mobile;
  if (d.navigation !== m.navigation) {
    return { signal: "L5", name: "responsive_genuineness", band: "pass", rationale: "navigation model differs desktop → mobile", evidence: `desktop=${d.navigation} · mobile=${m.navigation}` };
  }
  // If navigation is the same, at least one region behaviour must change materially.
  const regionsDiff: string[] = [];
  for (const k of Object.keys(d.regions) as RegionKind[]) {
    const db = d.regions[k];
    const mb = m.regions[k];
    if (db !== mb) regionsDiff.push(`${k}:${db}→${mb}`);
  }
  if (regionsDiff.length >= 2) {
    return { signal: "L5", name: "responsive_genuineness", band: "pass", rationale: "region behaviours differ meaningfully", evidence: regionsDiff.slice(0, 3).join(" · ") };
  }
  return { signal: "L5", name: "responsive_genuineness", band: "reject", rationale: "desktop and mobile models nearly identical · likely desktop-shrunk", evidence: `regions_diff_count=${regionsDiff.length}` };
}

// L6 · interaction hierarchy — Are primary actions declared and distinct?
function signalL6_interactionHierarchy(spec: LayoutSpec): LayoutSignalResult {
  const primarySlot = (spec.component_slots["contextual_actions"] ?? []).length > 0
    || (spec.component_slots["top_bar"] ?? []).some((c) => c === "Button")
    || (spec.component_slots["primary_content"] ?? []).some((c) => c === "Button");
  if (primarySlot) return { signal: "L6", name: "interaction_hierarchy", band: "pass", rationale: "primary action slot present", evidence: "action_slot_declared" };
  return { signal: "L6", name: "interaction_hierarchy", band: "conditional", rationale: "no explicit primary action slot", evidence: "action_slot_absent" };
}

// L7 · consistency — Does the layout require a coherent design system?
function signalL7_consistency(spec: LayoutSpec): LayoutSignalResult {
  const ds = spec.design_system_requirements;
  if (ds.length === 0) return { signal: "L7", name: "consistency", band: "reject", rationale: "no design system declared · would fragment", evidence: "design_system_requirements=[]" };
  return { signal: "L7", name: "consistency", band: "pass", rationale: "design system declared", evidence: `design_system=${ds.join(",")}` };
}

// L8 · modernity — modernity_status must be current or modern
function signalL8_modernity(spec: LayoutSpec): LayoutSignalResult {
  if (spec.modernity_status === "outdated" || spec.modernity_status === "legacy") {
    return { signal: "L8", name: "modernity", band: "reject", rationale: `modernity_status=${spec.modernity_status}`, evidence: `modernity_status=${spec.modernity_status}` };
  }
  if (spec.modernity_status === "not_assessed") {
    return { signal: "L8", name: "modernity", band: "unknown_needs_probe", rationale: "modernity not assessed", evidence: `modernity_status=${spec.modernity_status}` };
  }
  return { signal: "L8", name: "modernity", band: "pass", rationale: `modernity_status=${spec.modernity_status}`, evidence: `modernity_status=${spec.modernity_status}` };
}

// L9 · accessibility — Must declare accessibility requirements
function signalL9_accessibility(spec: LayoutSpec): LayoutSignalResult {
  const a = spec.accessibility_requirements;
  const required = ["keyboard_navigable", "focus_visible"];
  const hasBoth = required.every((r) => a.includes(r));
  if (hasBoth) return { signal: "L9", name: "accessibility", band: "pass", rationale: "keyboard_navigable + focus_visible present", evidence: `accessibility=${a.join(",")}` };
  return { signal: "L9", name: "accessibility", band: "reject", rationale: "missing baseline accessibility requirements", evidence: `accessibility=${a.join(",")}` };
}

// L10 · visual evidence — Requires three-viewport screenshot probes
function signalL10_visualEvidence(spec: LayoutSpec): LayoutSignalResult {
  if (spec.visual_probes.length === 0) {
    return { signal: "L10", name: "visual_evidence", band: "unknown_needs_probe", rationale: "no visual probes attached", evidence: "probes=[]" };
  }
  if (!hasThreeViewportEvidence(spec.visual_probes)) {
    return { signal: "L10", name: "visual_evidence", band: "reject", rationale: "visual probes present but do not cover desktop + tablet + mobile", evidence: `probes=${spec.visual_probes.map((p) => p.viewport).join(",")}` };
  }
  return { signal: "L10", name: "visual_evidence", band: "pass", rationale: "three-viewport visual evidence present and clean", evidence: `probes=${spec.visual_probes.map((p) => p.viewport).join(",")}` };
}

// ── The gate ──────────────────────────────────────────────────────────
export function assessLayout(spec: LayoutSpec): LayoutQualityResult {
  const signals: LayoutSignalResult[] = [
    signalL1_hierarchy(spec),
    signalL2_composition(spec),
    signalL3_density(spec),
    signalL4_navigation(spec),
    signalL5_responsive(spec),
    signalL6_interactionHierarchy(spec),
    signalL7_consistency(spec),
    signalL8_modernity(spec),
    signalL9_accessibility(spec),
    signalL10_visualEvidence(spec),
  ];

  const rejection_reasons: string[] = [];
  for (const s of signals) if (s.band === "reject") rejection_reasons.push(`${s.signal} ${s.name}: ${s.rationale}`);

  // Priority-ordered verdict resolution
  if (signals.find((s) => s.signal === "L8" && s.band === "reject")) {
    return finalise(spec, signals, "REJECT_OUTDATED", rejection_reasons);
  }
  if (signals.find((s) => s.signal === "L2" && s.band === "reject")) {
    return finalise(spec, signals, "REJECT_OUTDATED", rejection_reasons);
  }
  if (signals.find((s) => (s.signal === "L3" || s.signal === "L4" || s.signal === "L5") && s.band === "reject")) {
    return finalise(spec, signals, "REJECT_RESPONSIVE_FAILURE", rejection_reasons);
  }
  if (signals.find((s) => s.signal === "L9" && s.band === "reject")) {
    return finalise(spec, signals, "REJECT_ACCESSIBILITY_FAILURE", rejection_reasons);
  }
  if (signals.find((s) => s.signal === "L7" && s.band === "reject")) {
    return finalise(spec, signals, "REJECT_CONSISTENCY_FAILURE", rejection_reasons);
  }
  if (signals.find((s) => s.signal === "L1" && s.band === "reject")) {
    return finalise(spec, signals, "REJECT_COMPOSITION_FAILURE", rejection_reasons);
  }
  if (rejection_reasons.length > 0) {
    return finalise(spec, signals, "REJECT_INSUFFICIENT_EVIDENCE", rejection_reasons);
  }

  // Visual evidence gate: L10 must be pass for PASS_MODERN
  const l10 = signals.find((s) => s.signal === "L10")!;
  if (l10.band === "pass") {
    return finalise(spec, signals, "PASS_MODERN", rejection_reasons);
  }
  return finalise(spec, signals, "PASS_CONDITIONAL_VISUAL_PROBE_REQUIRED", rejection_reasons);
}

function finalise(spec: LayoutSpec, signals: readonly LayoutSignalResult[], verdict: LayoutQualityVerdict, rejection_reasons: readonly string[]): LayoutQualityResult {
  return {
    layout_id: spec.layout_id,
    layout_name: spec.name,
    verdict,
    signals,
    rejection_reasons,
    required_visual_probe: spec.visual_probes.length === 0 || !hasThreeViewportEvidence(spec.visual_probes),
    assessed_at_iso: new Date().toISOString(),
    gate_version: LAYOUT_QUALITY_GATE_VERSION,
    zero_llm: true,
    ledger: "B",
  };
}

// ── Batch API ─────────────────────────────────────────────────────────
export function assessLayoutBatch(specs: readonly LayoutSpec[]): readonly LayoutQualityResult[] {
  return Object.freeze(specs.map(assessLayout));
}

// ── Visual probe attachment helper (used by real render pipeline) ─────
export function attachVisualProbes(spec: LayoutSpec, probes: readonly ScreenshotProbe[]): LayoutSpec {
  return { ...spec, visual_probes: Object.freeze([...spec.visual_probes, ...probes]) };
}
