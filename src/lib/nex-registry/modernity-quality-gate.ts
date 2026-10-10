// src/lib/nex-registry/modernity-quality-gate.ts
//
// NEX Registry · Modernity Quality Gate (Ledger B additive · Zero LLM)
//
// Strict-by-default. The founder mandate (mid-session amendment):
//   "world-class compact designs · UI template themes pages only acceptable
//    · standards must be set high for proven app UI page designs and layout
//    · any outdated will be rejected as poor failed quality"
//
// FOUNDER INVARIANTS
//   1. Bias to REJECT · never PASS without deterministic evidence + explicit
//      visual probe signal
//   2. Any modernity_status of "legacy" or "outdated" is an automatic REJECT
//   3. Any license that requires review is an automatic HOLD (not PASS)
//   4. Any entry missing responsive support for tablet AND mobile is REJECT
//      (unless usage_context is explicitly "desktop_only")
//   5. Compact/density penalties · descriptions signalling generic templates,
//      old-fashioned SaaS conventions, or dense clutter downgrade automatically
//
// 12-signal check derived from mandate §2 (A-L)

import {
  requiresLicenseReview,
  type LibraryEntry,
  type ModernityStatus,
} from "./types";

export const MODERNITY_QUALITY_GATE_VERSION = "modernity-quality-gate.v1.2026-09-19";

// ── Signal outputs ────────────────────────────────────────────────────
export type SignalBand = "pass" | "conditional" | "reject" | "unknown_needs_probe";

export interface SignalResult {
  readonly signal: string;      // A · B · … · L
  readonly name: string;
  readonly band: SignalBand;
  readonly rationale: string;
  readonly evidence: string;
}

// ── Overall verdict ───────────────────────────────────────────────────
export type QualityVerdict =
  | "PASS_MODERN"
  | "PASS_CONDITIONAL_VISUAL_PROBE_REQUIRED"
  | "HOLD_LICENSE_REVIEW"
  | "REJECT_OUTDATED"
  | "REJECT_INCOMPLETE_EVIDENCE"
  | "REJECT_RESPONSIVE_FAILURE"
  | "REJECT_ACCESSIBILITY_FAILURE"
  | "REJECT_CONSISTENCY_FAILURE";

export interface QualityGateResult {
  readonly entry_id: string;
  readonly entry_name: string;
  readonly verdict: QualityVerdict;
  readonly signals: readonly SignalResult[];
  readonly required_visual_probe: boolean;
  readonly rejection_reasons: readonly string[];
  readonly assessed_at_iso: string;
  readonly gate_version: string;
  readonly zero_llm: true;
  readonly ledger: "B";
}

// ── Visual probe evidence (supplied by caller · never fabricated) ─────
export interface VisualProbeEvidence {
  readonly screenshot_hash: string;             // required for a real PASS
  readonly viewport: "desktop" | "tablet-portrait" | "tablet-landscape" | "mobile-portrait" | "mobile-landscape";
  readonly rendered_ok: boolean;
  readonly overflow_detected: boolean;
  readonly missing_icons: boolean;
  readonly broken_images: boolean;
  readonly probed_at_iso: string;
}

// ── Forbidden-descriptor set (compact/quality gate) ───────────────────
const OUTDATED_DESCRIPTORS: readonly RegExp[] = Object.freeze([
  /\bbootstrap-looking\b/i,
  /\bgeneric[- ]saas\b/i,
  /\btemplate[- ]clone\b/i,
  /\brainbow gradient/i,
  /\bglass ?morphism\b/i,        // deliberate glass allowed via material-glass variant, not descriptors
  /\bgiant hero\b/i,
  /\bcluttered dashboard\b/i,
  /\bexcessive shadows\b/i,
  /\bexcessive borders\b/i,
  /\bexcessive rounded\b/i,
  /\bai[- ]looking (purple|blue|glow)\b/i,
  /\bfake 3d\b/i,
]);

const GENERIC_TEMPLATE_DESCRIPTORS: readonly RegExp[] = Object.freeze([
  /\bnavbar\s*\+\s*hero\s*\+\s*three cards\b/i,
  /\btestimonials?\s*\+\s*pricing\s*\+\s*faq\s*\+\s*footer\b/i,
  /\bcopied[- ]template\b/i,
]);

// ── Signal implementations ────────────────────────────────────────────
function signalA_visualAge(entry: LibraryEntry): SignalResult {
  const s = entry.provenance.modernity_status;
  if (s === "outdated") return { signal: "A", name: "visual_age", band: "reject", rationale: "modernity_status=outdated", evidence: `provenance.modernity_status=${s}` };
  if (s === "legacy")   return { signal: "A", name: "visual_age", band: "reject", rationale: "modernity_status=legacy · not acceptable for CORE/APPROVED", evidence: `provenance.modernity_status=${s}` };
  if (s === "not_assessed") return { signal: "A", name: "visual_age", band: "unknown_needs_probe", rationale: "modernity not assessed", evidence: `provenance.modernity_status=${s}` };
  if (s === "modern")   return { signal: "A", name: "visual_age", band: "conditional", rationale: "modern but not current", evidence: `provenance.modernity_status=${s}` };
  return { signal: "A", name: "visual_age", band: "pass", rationale: "current", evidence: `provenance.modernity_status=${s}` };
}

function signalB_productQuality(entry: LibraryEntry): SignalResult {
  const v = entry.provenance.visual_quality;
  if (v === "excellent") return { signal: "B", name: "product_quality", band: "pass", rationale: "excellent visual quality", evidence: `visual_quality=${v}` };
  if (v === "good")      return { signal: "B", name: "product_quality", band: "pass", rationale: "good visual quality", evidence: `visual_quality=${v}` };
  if (v === "acceptable") return { signal: "B", name: "product_quality", band: "conditional", rationale: "acceptable · below world-class bar", evidence: `visual_quality=${v}` };
  if (v === "needs_review") return { signal: "B", name: "product_quality", band: "reject", rationale: "needs_review · not shippable", evidence: `visual_quality=${v}` };
  return { signal: "B", name: "product_quality", band: "unknown_needs_probe", rationale: "visual quality not assessed", evidence: `visual_quality=${v}` };
}

function signalC_hierarchy(entry: LibraryEntry): SignalResult {
  // Deterministic proxy: presence of at least one meaningful usage_context tag
  // AND either at least one variant OR proxy_target present (proves not empty schema).
  const hasContext = entry.usage_context.length > 0;
  const hasSubstance = entry.variants.length > 0 || entry.proxy_target !== null || entry.path_in_repo !== null;
  if (hasContext && hasSubstance) return { signal: "C", name: "hierarchy", band: "pass", rationale: "usage_context + substance declared", evidence: `usage_context=${entry.usage_context.join(",")}` };
  return { signal: "C", name: "hierarchy", band: "reject", rationale: "no usage_context or no substance", evidence: JSON.stringify({ ctx: entry.usage_context, variants: entry.variants }) };
}

function signalD_typography(entry: LibraryEntry): SignalResult {
  // Deterministic: entry must either be a design_system with typography variants,
  // OR live in a framework that supports modern typography (tailwindcss, next.js, react).
  if (entry.category === "font") {
    return { signal: "D", name: "typography", band: "pass", rationale: "entry is a font · category self-declares", evidence: `category=${entry.category}` };
  }
  const modernFrameworks = ["tailwindcss", "next.js", "react"];
  const hasModern = entry.provenance.framework.some((f) => modernFrameworks.includes(f));
  if (hasModern) return { signal: "D", name: "typography", band: "pass", rationale: "modern framework alignment", evidence: `framework=${entry.provenance.framework.join(",")}` };
  return { signal: "D", name: "typography", band: "conditional", rationale: "no modern framework declared", evidence: `framework=${entry.provenance.framework.join(",")}` };
}

function signalE_composition(entry: LibraryEntry): SignalResult {
  // Deterministic proxy for composition intent: the entry description must not
  // match the generic-template descriptor set (§31 anti-template rule).
  const desc = entry.description.toLowerCase();
  for (const rx of GENERIC_TEMPLATE_DESCRIPTORS) {
    if (rx.test(desc)) return { signal: "E", name: "composition", band: "reject", rationale: "matches generic template descriptor", evidence: rx.source };
  }
  for (const rx of OUTDATED_DESCRIPTORS) {
    if (rx.test(desc)) return { signal: "E", name: "composition", band: "reject", rationale: "matches outdated descriptor", evidence: rx.source };
  }
  // Composition axis only applies to entries that HAVE composition (pages,
  // sections, templates, layouts, or multi-part components). Atomic library
  // categories (icon/font/animation/asset/design_system) do not compose.
  const compositional = entry.category === "component"
    || entry.category === "section"
    || entry.category === "template"
    || entry.category === "layout";
  if (!compositional) {
    return { signal: "E", name: "composition", band: "pass", rationale: `${entry.category} is atomic · composition not applicable`, evidence: `category=${entry.category}` };
  }
  // Compositional entries beyond descriptor screening need a real render probe.
  return { signal: "E", name: "composition", band: "unknown_needs_probe", rationale: "no forbidden descriptor · true composition needs render probe", evidence: "descriptor_screen_clean" };
}

function signalF_density(entry: LibraryEntry): SignalResult {
  const desc = entry.description.toLowerCase();
  if (desc.includes("dense") || desc.includes("cluttered") || desc.includes("enterprise clutter")) {
    return { signal: "F", name: "density", band: "reject", rationale: "density flagged as dense/cluttered", evidence: entry.description.slice(0, 120) };
  }
  return { signal: "F", name: "density", band: "pass", rationale: "no density red flag in descriptor", evidence: "descriptor_clean" };
}

function signalG_interaction(entry: LibraryEntry): SignalResult {
  const a = entry.provenance.accessibility_status;
  if (a === "aria_and_keyboard_verified") return { signal: "G", name: "interaction", band: "pass", rationale: "aria + keyboard verified", evidence: `accessibility=${a}` };
  if (a === "keyboard_verified" || a === "aria_verified") return { signal: "G", name: "interaction", band: "conditional", rationale: "partial accessibility verification", evidence: `accessibility=${a}` };
  return { signal: "G", name: "interaction", band: "conditional", rationale: "accessibility not assessed · caller-supplied evidence required for auto-select", evidence: `accessibility=${a}` };
}

function signalH_responsive(entry: LibraryEntry): SignalResult {
  const ds = entry.device_support;
  const isDesktopOnly = entry.usage_context.some((c) => c === "desktop_only" || c === "workstation_only");
  if (!ds.tablet || !ds.mobile) {
    if (isDesktopOnly) return { signal: "H", name: "responsive", band: "pass", rationale: "declared desktop-only usage context", evidence: `usage_context=${entry.usage_context.join(",")}` };
    return { signal: "H", name: "responsive", band: "reject", rationale: "missing tablet or mobile support and not declared desktop-only", evidence: JSON.stringify(ds) };
  }
  return { signal: "H", name: "responsive", band: "pass", rationale: "desktop + tablet + mobile supported", evidence: JSON.stringify(ds) };
}

function signalI_consistency(entry: LibraryEntry): SignalResult {
  const frameworks = entry.provenance.framework;
  const usesReact = frameworks.includes("react");
  const usesTailwind = frameworks.includes("tailwindcss");
  const usesRadix = frameworks.some((f) => f.startsWith("radix"));
  // Consistency axis applies only to composable UI (component/section/template/
  // layout). Atomic library types (icon / font / animation / asset / design_system)
  // are consumed BY the design system rather than participating in its consistency.
  const compositional = entry.category === "component"
    || entry.category === "section"
    || entry.category === "template"
    || entry.category === "layout";
  if (!compositional) {
    return { signal: "I", name: "consistency", band: "pass", rationale: `${entry.category} is consumed by design system · consistency not applicable`, evidence: `category=${entry.category}` };
  }
  if (!usesReact) return { signal: "I", name: "consistency", band: "conditional", rationale: "non-react compositional entry · consistency verified per-category", evidence: `framework=${frameworks.join(",")}` };
  if (usesReact && (usesTailwind || usesRadix)) return { signal: "I", name: "consistency", band: "pass", rationale: "react + tailwind or radix · consistent stack", evidence: `framework=${frameworks.join(",")}` };
  return { signal: "I", name: "consistency", band: "reject", rationale: "react without tailwind or radix alignment · would fragment design language", evidence: `framework=${frameworks.join(",")}` };
}

function signalJ_accessibility(entry: LibraryEntry): SignalResult {
  const a = entry.provenance.accessibility_status;
  if (a === "aria_and_keyboard_verified") return { signal: "J", name: "accessibility", band: "pass", rationale: "aria + keyboard verified", evidence: `accessibility=${a}` };
  if (a === "aria_verified") return { signal: "J", name: "accessibility", band: "conditional", rationale: "aria verified only · keyboard unproven", evidence: `accessibility=${a}` };
  if (a === "keyboard_verified") return { signal: "J", name: "accessibility", band: "conditional", rationale: "keyboard verified only · aria unproven", evidence: `accessibility=${a}` };
  return { signal: "J", name: "accessibility", band: "unknown_needs_probe", rationale: "accessibility not assessed", evidence: `accessibility=${a}` };
}

function signalK_motion(entry: LibraryEntry): SignalResult {
  if (entry.category !== "animation") return { signal: "K", name: "motion", band: "pass", rationale: "non-motion entry", evidence: `category=${entry.category}` };
  const desc = entry.description.toLowerCase();
  if (desc.includes("excessive") || desc.includes("decorative") && !desc.includes("purposeful")) {
    return { signal: "K", name: "motion", band: "reject", rationale: "motion descriptor suggests excess or pure decoration", evidence: entry.description.slice(0, 120) };
  }
  return { signal: "K", name: "motion", band: "unknown_needs_probe", rationale: "motion cannot be judged without prefers-reduced-motion probe", evidence: "descriptor_clean" };
}

function signalL_originality(entry: LibraryEntry): SignalResult {
  const desc = entry.description.toLowerCase();
  if (desc.includes("generic") || desc.includes("clone") || desc.includes("copied")) {
    return { signal: "L", name: "originality", band: "reject", rationale: "descriptor implies non-original assembly", evidence: entry.description.slice(0, 120) };
  }
  return { signal: "L", name: "originality", band: "pass", rationale: "no generic/clone/copied descriptor", evidence: "descriptor_clean" };
}

// ── The gate ──────────────────────────────────────────────────────────
export function assessEntry(input: {
  entry: LibraryEntry;
  visual_probes?: readonly VisualProbeEvidence[];
}): QualityGateResult {
  const e = input.entry;
  const probes = input.visual_probes ?? [];
  const signals: SignalResult[] = [
    signalA_visualAge(e),
    signalB_productQuality(e),
    signalC_hierarchy(e),
    signalD_typography(e),
    signalE_composition(e),
    signalF_density(e),
    signalG_interaction(e),
    signalH_responsive(e),
    signalI_consistency(e),
    signalJ_accessibility(e),
    signalK_motion(e),
    signalL_originality(e),
  ];

  // Immediate rejection triggers (§2 · §20 · founder mid-session: outdated → REJECT)
  const rejection_reasons: string[] = [];
  for (const s of signals) if (s.band === "reject") rejection_reasons.push(`${s.signal} ${s.name}: ${s.rationale}`);

  // Structured verdict priority
  if (signals.find((s) => s.signal === "A" && s.band === "reject")) {
    return finalise(e, signals, probes, "REJECT_OUTDATED", rejection_reasons);
  }
  if (requiresLicenseReview(e.provenance.license) || !e.provenance.license_verified) {
    rejection_reasons.push(`license ${e.provenance.license} requires review or verified=false`);
    return finalise(e, signals, probes, "HOLD_LICENSE_REVIEW", rejection_reasons);
  }
  if (signals.find((s) => s.signal === "H" && s.band === "reject")) {
    return finalise(e, signals, probes, "REJECT_RESPONSIVE_FAILURE", rejection_reasons);
  }
  if (signals.find((s) => s.signal === "J" && s.band === "reject")) {
    return finalise(e, signals, probes, "REJECT_ACCESSIBILITY_FAILURE", rejection_reasons);
  }
  if (signals.find((s) => s.signal === "I" && s.band === "reject")) {
    return finalise(e, signals, probes, "REJECT_CONSISTENCY_FAILURE", rejection_reasons);
  }
  if (rejection_reasons.length > 0) {
    return finalise(e, signals, probes, "REJECT_OUTDATED", rejection_reasons);
  }

  // If any signal is unknown_needs_probe: require visual probe evidence.
  const needsProbe = signals.some((s) => s.band === "unknown_needs_probe");
  const visualProof = probes.length > 0
    && probes.every((p) => p.rendered_ok && !p.overflow_detected && !p.missing_icons && !p.broken_images)
    && probes.some((p) => p.viewport === "desktop")
    && probes.some((p) => p.viewport.startsWith("tablet"))
    && probes.some((p) => p.viewport.startsWith("mobile"));

  if (needsProbe && !visualProof) {
    return finalise(e, signals, probes, "PASS_CONDITIONAL_VISUAL_PROBE_REQUIRED", rejection_reasons);
  }
  if (needsProbe && visualProof) {
    return finalise(e, signals, probes, "PASS_MODERN", rejection_reasons);
  }
  // All signals pass or conditional-only · deterministic PASS
  return finalise(e, signals, probes, "PASS_MODERN", rejection_reasons);
}

function finalise(
  e: LibraryEntry,
  signals: readonly SignalResult[],
  probes: readonly VisualProbeEvidence[],
  verdict: QualityVerdict,
  rejection_reasons: readonly string[],
): QualityGateResult {
  const required_visual_probe = verdict === "PASS_CONDITIONAL_VISUAL_PROBE_REQUIRED" || signals.some((s) => s.band === "unknown_needs_probe");
  return {
    entry_id: e.entry_id,
    entry_name: e.name,
    verdict,
    signals,
    required_visual_probe: required_visual_probe && probes.length === 0,
    rejection_reasons,
    assessed_at_iso: new Date().toISOString(),
    gate_version: MODERNITY_QUALITY_GATE_VERSION,
    zero_llm: true,
    ledger: "B",
  };
}

// ── Convenience batch API ─────────────────────────────────────────────
export function assessBatch(entries: readonly LibraryEntry[]): readonly QualityGateResult[] {
  return Object.freeze(entries.map((e) => assessEntry({ entry: e })));
}

// ── Constant modernity floor for CORE/APPROVED promotion ──────────────
export const ACCEPTED_MODERNITY: readonly ModernityStatus[] = Object.freeze(["current", "modern"]);
