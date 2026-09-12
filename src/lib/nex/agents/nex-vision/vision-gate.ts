// src/lib/nex/agents/nex-vision/vision-gate.ts
//
// WAVE-S-1 · Vision request classifier + safety detector
// Founder BEGIN WAVE-S-1 · 2026-09-08
//
// Deterministic · keyword-based · no LLM inference in Phase 3.
// Real vision-model inference is Phase 4 · will route through gateway.

import type {
  VisionRequest,
  VisionRequestKind,
  VisionConfidenceBand,
  VisionResponse,
  VisionSafetySignal,
} from "./types";

// ─── Kind classification ────────────────────────────────────────

export function classifyRequestKind(text: string): VisionRequestKind {
  const t = (text ?? "").toLowerCase();
  if (!t) return "unknown";
  // Order matters · check most specific patterns first.
  if (/\b(extract text|ocr|read text|transcribe|what does .* say)\b/.test(t)) return "ocr";
  if (/\b(source|provenance|where .* from|where did .* come from|who made|edited|altered|original)\b/.test(t)) return "provenance";
  if (/\b(safe|appropriate|content warning|nsfw|moderat)\b/.test(t)) return "safety_check";
  if (/\b(change|swap|replace|modify|update|alter|redesign|rebuild)\b.*(material|colour|color|texture|look|layout|structure|staircase)/.test(t)) return "modification";
  if (/\b(generate|create|make|design|render|produce)\b.*(banner|hero|version|variation|edition|copy)/.test(t)) return "generation";
  if (/\b(categoriz|categorize|classif|which type|label as|tag as|tagged as)/.test(t)) return "classification";
  if (/\b(what.*in this|what is in|describe|caption|identify|tell me about)\b/.test(t)) return "understanding";
  return "unknown";
}

// ─── Confidence band (deterministic Phase 3 approximation) ─────
// In Phase 3 (no real vision model), confidence bands are keyword-signalled.
// Every kind that requires Phase-4 model integration is FLAGGED for human
// review in Phase 3 · never auto-answered.

export function assessConfidenceBand(kind: VisionRequestKind, has_image: boolean, is_manifest_known: boolean): VisionConfidenceBand {
  // Any request without an image reference · confidence is unknown
  if (!has_image) return "unknown";

  // Known manifest entry + safety check or provenance = we can be confident from metadata alone
  if (is_manifest_known && (kind === "safety_check" || kind === "provenance")) return "good";

  // Understanding / OCR / classification / modification / generation ALL need
  // real inference in Phase 4 · Phase 3 flags for human review
  if (kind === "understanding" || kind === "ocr" || kind === "classification" ||
      kind === "modification" || kind === "generation") {
    return "flag_human";
  }

  return "unknown";
}

// ─── Safety signal detection ───────────────────────────────────

const CONTENT_SAFETY_KEYWORDS: Record<string, VisionSafetySignal["kind"] | "content_safety"> = {};
// intentionally not defining a broad denylist here · Phase 3 focuses on the
// STRUCTURAL safety concerns from ADR-0028 · not content classification
// (which requires real vision model · Phase 4).

export function detectSafetySignals(req: VisionRequest, kind: VisionRequestKind): VisionSafetySignal[] {
  const out: VisionSafetySignal[] = [];
  const text = (req.request_text ?? "").toLowerCase();

  // Rule 13 · geometry preservation for modifications
  if (kind === "modification") {
    // Detect risky modification asks that would violate geometry preservation
    if (/\b(redesign|rebuild|different design|new (staircase|layout|structure))\b/.test(text)) {
      out.push({
        kind: "geometry_violation_risk",
        description: "modification request implies structural change · Rule 13 requires geometry preservation for material/colour swaps only",
      });
    }
  }

  // Rule 14 · provenance missing
  if (req.image_reference && !req.image_metadata?.known_manifest_entry) {
    out.push({
      kind: "provenance_missing",
      description: "image not registered in NEX manifest (ADR-0024) · unknown provenance · confidence must reflect this",
    });
  }

  // Rule 11 · generation-beyond-permission
  if (kind === "generation" && req.image_metadata && !req.image_metadata.image_type) {
    out.push({
      kind: "generation_beyond_permission",
      description: "image_type not declared · cannot know what this image is allowed to become (Rule 11)",
    });
  }

  // Content safety · flag ONLY as an ADVISORY when text explicitly asks
  // for safety_check · Phase 3 cannot actually inspect pixels
  if (kind === "safety_check" && !req.image_metadata?.known_manifest_entry) {
    out.push({
      kind: "content_safety_concern",
      category: "hate",  // placeholder · deterministic signal that a real check is needed
      severity: "low",
    });
  }

  if (out.length === 0) out.push({ kind: "no_safety_concern" });
  return out;
}

// ─── Compose response ──────────────────────────────────────────

export function respondVision(req: VisionRequest): VisionResponse {
  const kind = classifyRequestKind(req.request_text);
  const has_image = !!req.image_reference;
  const known = !!req.image_metadata?.known_manifest_entry;
  const band = assessConfidenceBand(kind, has_image, known);
  const signals = detectSafetySignals(req, kind);
  const has_serious_signal = signals.some((s) => s.kind !== "no_safety_concern");
  const requires_human_review = band === "flag_human" || band === "unknown" || has_serious_signal;
  const deferred_to_phase_4 = ["understanding", "ocr", "classification", "modification", "generation"].includes(kind);

  const advisoryLines: string[] = [];
  advisoryLines.push(`Vision request classified as: ${kind}.`);
  if (band === "flag_human") advisoryLines.push("Confidence below 85% · flagged for human review per ADR-0028.");
  if (deferred_to_phase_4) advisoryLines.push("Phase 3 specialist cannot perform this operation · deferred to Phase 4 (real vision model via gateway).");
  for (const s of signals) {
    if (s.kind === "no_safety_concern") continue;
    if (s.kind === "content_safety_concern") advisoryLines.push(`Safety flag: content category ${s.category} · severity ${s.severity}.`);
    else advisoryLines.push(`Safety flag: ${s.kind} · ${s.description}`);
  }
  if (advisoryLines.length === 1 && band === "good") advisoryLines.push("Deterministic classification only · no image content inspected.");

  const advisory_text = advisoryLines.join(" ");

  return {
    request_id: req.request_id,
    detected_kind: kind,
    confidence_band: band,
    safety_signals: signals,
    advisory_text,
    requires_human_review,
    deferred_to_phase_4,
  };
}
