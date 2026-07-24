// Vision answer router. Every route requires at least one image URL —
// when the caller passes none, the router replies honestly instead of
// pretending to analyse.

import { analyzeConstructionImage } from "./analyze";
import { analyzeDamage }   from "./damage";
import { analyzeSafety }   from "./safety";
import { compareImages }   from "./compare";
import { estimateMeasurements } from "./measure";
import { extractDocument } from "./ocr";
import type {
  AnalysisContext,
  DamageReport,
  ImageComparison,
  MeasurementEstimate,
  OCRResult,
  SafetyReport,
  VisionAnalysis
} from "./types";

export type VisionQuestion =
  | { kind: "analyze" }
  | { kind: "damage" }
  | { kind: "safety" }
  | { kind: "measure" }
  | { kind: "ocr" }
  | { kind: "compare" }
  | { kind: "none" };

export function classifyVisionQuestion(text: string): VisionQuestion {
  const t = text.toLowerCase().trim();
  if (!t) return { kind: "none" };

  if (/\bcompare\s+(these|the)\s+(photos?|images?|pictures?)\b|\bbefore\s+and\s+after\b|\bbefore\/after\b/.test(t)) return { kind: "compare" };
  if (/\bread\s+(this|the)\s+(receipt|invoice|certificate|delivery\s+note|document)\b|\bextract\s+text\b|\bocr\b/.test(t)) return { kind: "ocr" };
  if (/\bwhat'?s\s+wrong\s+with\b|\bdamage\b|\bany\s+defects?\b|\bany\s+problems?\s+with\s+this\b|\bwhat\s+(are\s+)?the\s+defects?\b/.test(t)) return { kind: "damage" };
  if (/\bis\s+this\s+safe\b|\bsafety\s+check\b|\binspect\s+this\s+for\s+safety\b|\bany\s+safety\b/.test(t)) return { kind: "safety" };
  if (/\bmeasure\b|\bestimate\s+(the\s+)?(size|dimensions|area|quantit)|how\s+big\s+is\b/.test(t)) return { kind: "measure" };
  if (/\banaly[sz]e\s+(this|the)\s+(image|photo)\b|\bwhat\s+do\s+you\s+think\b|\binspect\s+this\b|\bwhat'?s\s+in\s+(this|the)\s+(image|photo)\b|\bidentify\b/.test(t)) return { kind: "analyze" };

  return { kind: "none" };
}

// ─── Dispatch ────────────────────────────────────────────────

export type AnswerVisionInput = {
  question:  VisionQuestion;
  imageUrl?: string;
  imageUrls?: string[];               // for compare
  hint?:     string;
  context?:  AnalysisContext;
};

export type AnswerVisionResult = {
  speak: string;
  data?:
    | { kind: "analyze"; analysis: VisionAnalysis }
    | { kind: "damage";  report:   DamageReport   }
    | { kind: "safety";  report:   SafetyReport   }
    | { kind: "measure"; estimate: MeasurementEstimate }
    | { kind: "ocr";     result:   OCRResult      }
    | { kind: "compare"; result:   ImageComparison };
};

export async function answerVision(input: AnswerVisionInput): Promise<AnswerVisionResult> {
  const q = input.question;
  const url = input.imageUrl;

  if (q.kind === "none") return { speak: "" };

  if (q.kind === "compare") {
    const urls = input.imageUrls ?? [];
    if (urls.length < 2) return { speak: "For compare I need two images — attach a BEFORE and an AFTER, then ask again." };
    const result = await compareImages({ beforeUrl: urls[0], afterUrl: urls[1], hint: input.hint });
    return { speak: formatCompare(result), data: { kind: "compare", result } };
  }

  if (!url) {
    return { speak: "Attach an image and ask again — I need something to look at." };
  }

  switch (q.kind) {
    case "analyze": {
      const analysis = await analyzeConstructionImage({ imageUrl: url, context: input.context });
      return { speak: formatAnalyze(analysis), data: { kind: "analyze", analysis } };
    }
    case "damage": {
      const report = await analyzeDamage({ imageUrl: url, hint: input.hint });
      return { speak: formatDamage(report), data: { kind: "damage", report } };
    }
    case "safety": {
      const report = await analyzeSafety({ imageUrl: url, hint: input.hint });
      return { speak: formatSafety(report), data: { kind: "safety", report } };
    }
    case "measure": {
      const estimate = await estimateMeasurements({ imageUrl: url, hint: input.hint });
      return { speak: formatMeasure(estimate), data: { kind: "measure", estimate } };
    }
    case "ocr": {
      const result = await extractDocument({ imageUrl: url, hint: input.hint });
      return { speak: formatOCR(result), data: { kind: "ocr", result } };
    }
  }
}

// ─── Reply builders ────────────────────────────────────────────

const CONF_LABEL: Record<"low" | "medium" | "high", string> = {
  low:    "low confidence",
  medium: "medium confidence",
  high:   "high confidence"
};

export function formatAnalyze(a: VisionAnalysis): string {
  if (a.error) return `${a.summary}\n\n${a.disclaimer}`;
  const lines: string[] = [];
  lines.push(a.summary);
  lines.push(`Overall: ${CONF_LABEL[a.overall_confidence]}${a.primary_trade ? ` · trade looks like ${a.primary_trade}` : ""} · stage: ${a.stage}.`);
  if (a.detected.length > 0) {
    lines.push("");
    lines.push("Detected:");
    for (const d of a.detected.slice(0, 6)) lines.push(`- ${d.label} (${d.category}, ${CONF_LABEL[d.confidence]})`);
  }
  if (a.observations.length > 0) {
    lines.push("");
    lines.push("Observations:");
    for (const o of a.observations.slice(0, 4)) lines.push(`- ${o.headline} (${CONF_LABEL[o.confidence]})`);
  }
  if (a.defects.length > 0) {
    lines.push("");
    lines.push("Possible defects:");
    for (const d of a.defects.slice(0, 4)) lines.push(`- ${d.headline} (${CONF_LABEL[d.confidence]})`);
  }
  if (a.safety.length > 0) {
    lines.push("");
    lines.push("Safety notes:");
    for (const s of a.safety.slice(0, 4)) lines.push(`- [${s.severity}] ${s.hazard} — ${s.recommended_action}`);
  }
  if (a.next_steps.length > 0) {
    lines.push("");
    lines.push("Suggested next steps:");
    for (const n of a.next_steps.slice(0, 4)) lines.push(`- ${n.action} — because: ${n.reason}`);
  }
  lines.push("");
  lines.push(a.disclaimer);
  return lines.join("\n");
}

export function formatDamage(d: DamageReport): string {
  if (d.error) return `${d.summary}\n\n${d.disclaimer}`;
  const lines: string[] = [d.summary];
  if (d.damage.length > 0) {
    lines.push("");
    for (const x of d.damage) lines.push(`- [${x.severity}] ${x.label} — likely cause: ${x.likely_cause} (${CONF_LABEL[x.confidence]})`);
  } else {
    lines.push("Nothing that looked like damage jumped out — but low confidence, verify in person.");
  }
  lines.push("");
  lines.push(`Recommended: ${d.recommended_action}`);
  lines.push("");
  lines.push(d.disclaimer);
  return lines.join("\n");
}

export function formatSafety(s: SafetyReport): string {
  if (s.error) return `${s.summary}\n\n${s.disclaimer}`;
  const lines: string[] = [s.summary];
  if (s.observations.length > 0) {
    lines.push("");
    for (const o of s.observations) lines.push(`- [${o.severity}] ${o.hazard} — ${o.recommended_action} (${CONF_LABEL[o.confidence]})`);
  } else {
    lines.push("No visible safety concerns in the frame — but the frame is a moment in time.");
  }
  lines.push("");
  lines.push(s.disclaimer);
  return lines.join("\n");
}

export function formatMeasure(m: MeasurementEstimate): string {
  if (m.error) return `${m.summary}\n\n${m.disclaimer}`;
  const lines: string[] = [m.summary];
  if (!m.scaled) lines.push("No scale reference visible — estimates below are ratios only, not absolute measurements.");
  if (m.scale_reference) lines.push(`Scale reference used: ${m.scale_reference}`);
  if (m.estimates.length > 0) {
    lines.push("");
    for (const e of m.estimates) lines.push(`- ${e.label}: ${e.value} (${CONF_LABEL[e.confidence]})`);
  }
  lines.push("");
  lines.push(m.disclaimer);
  return lines.join("\n");
}

export function formatOCR(r: OCRResult): string {
  if (r.error) return `${r.summary}\n\n${r.disclaimer}`;
  const lines: string[] = [`${r.summary} (looks like: ${r.document_kind}).`];
  if (r.fields.length > 0) {
    lines.push("");
    for (const f of r.fields) lines.push(`- ${f.key}: ${f.value} (${CONF_LABEL[f.confidence]})`);
  }
  lines.push("");
  lines.push(r.disclaimer);
  return lines.join("\n");
}

export function formatCompare(c: ImageComparison): string {
  if (c.error) return `${c.summary}\n\n${c.disclaimer}`;
  const lines: string[] = [c.summary];
  if (c.changes.length > 0) {
    lines.push("");
    lines.push("Changes:");
    for (const ch of c.changes) lines.push(`- ${ch.label}${ch.detail && ch.detail !== ch.label ? ` — ${ch.detail}` : ""} (${CONF_LABEL[ch.confidence]})`);
  }
  if (c.improvements.length > 0) {
    lines.push("");
    lines.push("Improvements:");
    for (const i of c.improvements) lines.push(`- ${i}`);
  }
  if (c.concerns.length > 0) {
    lines.push("");
    lines.push("Concerns:");
    for (const x of c.concerns) lines.push(`- ${x}`);
  }
  lines.push("");
  lines.push(c.disclaimer);
  return lines.join("\n");
}
