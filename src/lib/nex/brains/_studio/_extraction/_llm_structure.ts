// LLM structuring layer.
//
// Takes raw Author input and produces a set of typed extraction
// candidates. Every candidate is provisional. The layer refuses to
// return candidates that lack either a source_span or an explicit
// needs_author_source flag — that is the zero-fabrication guarantee
// per ADR-0020.

import "server-only";
import { createHash } from "node:crypto";
import { z } from "zod";
import { completeWithUsage } from "@/lib/llm/anthropic";
import { EXTRACTION_SYSTEM, PROMPT_VERSION, buildExtractionUserPrompt } from "./_prompt";
import type { CandidateKind, ExtractionCandidate, ExtractionResult, ExtractionRun } from "./types";

const MAX_INPUT_CHARS   = 24_000;   // Anthropic budget · reasonable cap for one paste
const MAX_CANDIDATES    = 40;       // Cap to prevent runaway output

const KIND_VALUES = [
  "craft.fact", "craft.glossary", "regulations.reg",
  "materials.mat", "workflow.playbook", "defects.defect",
  "pricing_model.rule"
] as const satisfies readonly CandidateKind[];

const CandidateWireSchema = z.object({
  kind:                z.enum(KIND_VALUES),
  payload:             z.unknown(),
  source_span:         z.string().nullable(),
  needs_author_source: z.boolean(),
  reason:              z.string().optional()
});
const CandidateArraySchema = z.object({ candidates: z.array(CandidateWireSchema).max(MAX_CANDIDATES) });

export type StructureInput = {
  brain_slug:  string;
  brain_name:  string;
  author_id:   string;
  author_name: string;
  region_hint?: string;
  raw_input:   string;
  module_hint?: string;
};

export async function structureAuthorKnowledge(input: StructureInput): Promise<ExtractionResult> {
  const raw = input.raw_input.trim();
  if (raw.length === 0) return { ok: false, reason: "empty_input", detail: "Author input is empty." };
  if (raw.length > MAX_INPUT_CHARS) {
    return { ok: false, reason: "input_too_long", detail: `Input is ${raw.length} chars (max ${MAX_INPUT_CHARS}). Split it into smaller passes.` };
  }

  const inputHash = createHash("sha256").update(raw).digest("hex").slice(0, 16);
  const userPrompt = buildExtractionUserPrompt({
    brain_slug:  input.brain_slug,
    brain_name:  input.brain_name,
    author_name: input.author_name,
    region_hint: input.region_hint,
    raw_input:   raw,
    module_hint: input.module_hint
  });

  const model = "claude-opus-4-7";
  const result = await completeWithUsage({
    system:      EXTRACTION_SYSTEM,
    messages:    [{ role: "user", content: userPrompt }],
    maxTokens:   16384,
    // temperature omitted · opus-4-7 deprecates the parameter
    model
  });

  if (!result) {
    return { ok: false, reason: "no_llm_key", detail: "ANTHROPIC_API_KEY missing or LLM call failed. Author will need to write candidates manually via Studio editors." };
  }

  let parsed: z.infer<typeof CandidateArraySchema>;
  try {
    const json = extractJson(result.text);
    parsed = CandidateArraySchema.parse(json);
  } catch (err) {
    // Surface useful diagnostics: LLM response length + first/last
    // snippets so the Author can see WHY parsing failed (truncation
    // vs schema mismatch vs empty response).
    const rawLen = result.text.length;
    const head   = result.text.slice(0, 180).replace(/\s+/g, " ");
    const tail   = result.text.slice(-180).replace(/\s+/g, " ");
    const errMsg = err instanceof Error ? err.message : String(err);
    return {
      ok: false,
      reason: "parse_error",
      detail: `${errMsg} · LLM response ${rawLen} chars · head: "${head}" · tail: "${tail}"`
    };
  }

  const now = new Date().toISOString();
  const runId = `run_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;

  const candidates: ExtractionCandidate[] = parsed.candidates.map((c, i) => ({
    id:                  `${runId}_c${i}`,
    brain_slug:          input.brain_slug,
    kind:                c.kind,
    payload:             normaliseCandidatePayload(c.kind, c.payload, `${runId}_c${i}`, c.source_span == null, c.source_span, input.author_name),
    // Enforce provenance discipline: even if the LLM tried to return
    // needs_author_source=false without a span, we override.
    source_span:         c.source_span,
    needs_author_source: c.source_span === null ? true : c.needs_author_source,
    provenance: {
      llm_model:      model,
      proposed_at:    now,
      prompt_version: PROMPT_VERSION,
      input_hash:     inputHash
    },
    status:         "pending" as const,
    admin_status:   "unreviewed" as const,
    review_history: []
  }));

  const run: ExtractionRun = {
    run_id:       runId,
    brain_slug:   input.brain_slug,
    author_id:    input.author_id,
    input_hash:   inputHash,
    input_length: raw.length,
    llm_model:    model,
    created_at:   now,
    candidates
  };

  return { ok: true, run };
}

/** Normalise a candidate payload to fill in required schema fields
 *  the LLM might have omitted. This is NOT fabrication — it is
 *  applying defensive defaults so the Author is not blocked by
 *  missing scaffold fields:
 *   • id — auto-generated from candidate id if missing
 *   • confidence — defaults to "medium" if missing
 *   • evidence — defaults to [] · with author_source_needed forced
 *     to true when the LLM did not supply any evidence at all
 *   • other minor shape defaults per kind
 *  The Author still Accepts / Rejects / Edits every item · nothing
 *  gets Author's name on it without a click. */
function normaliseCandidatePayload(
  kind: CandidateKind,
  raw: unknown,
  candidateId: string,
  noSourceSpan: boolean,
  sourceSpan: string | null,
  authorName: string
): unknown {
  if (raw == null || typeof raw !== "object" || Array.isArray(raw)) {
    // Payload was missing / malformed · return the minimal shape for
    // the kind so the Author can see it and edit it.
    return minimalPayload(kind, candidateId, noSourceSpan, sourceSpan, authorName);
  }
  const p = raw as Record<string, unknown>;

  const defaultId         = `cand.${kind.replace(/\./g, "_")}.${candidateId.slice(-6)}`;
  const defaultConfidence = "medium";
  const evidenceIsEmpty   = !Array.isArray(p.evidence) || (p.evidence as unknown[]).length === 0;

  // When the LLM did not populate evidence AND the Author has a
  // source_span from their own paste, treat the Author as the
  // evidence source. This is not fabrication — the Author has quoted
  // their own words and their name is on the Brain per ADR-0017 §4.
  // When source_span is null (needs_author_source = true), evidence
  // stays empty · Author must supply a citation via edit before Accept.
  const evidenceFromAuthor = sourceSpan != null && sourceSpan.trim() !== ""
    ? [{ source: `${authorName} · own experience`, note: sourceSpan.length > 220 ? sourceSpan.slice(0, 220) + "..." : sourceSpan }]
    : [];

  switch (kind) {
    case "craft.fact":
      return {
        id:         (typeof p.id === "string" && p.id) ? p.id : defaultId,
        statement:  typeof p.statement === "string" ? p.statement : "",
        evidence:   evidenceIsEmpty ? evidenceFromAuthor : p.evidence,
        confidence: isValidConfidence(p.confidence) ? p.confidence : defaultConfidence,
        ...optionalCommon(p)
      };
    case "craft.glossary":
      return {
        term:       typeof p.term === "string" ? p.term : "",
        definition: typeof p.definition === "string" ? p.definition : "",
        aliases:    Array.isArray(p.aliases) ? p.aliases : [],
        evidence:   Array.isArray(p.evidence) && p.evidence.length > 0 ? p.evidence : evidenceFromAuthor
      };
    case "regulations.reg":
      return {
        id:            (typeof p.id === "string" && p.id) ? p.id : defaultId,
        country:       typeof p.country === "string" ? p.country : "UK",
        title:         (typeof p.title === "string" && p.title.trim() !== "") ? p.title : titleFromContext(p, sourceSpan, "Untitled regulation"),
        section:       typeof p.section === "string" ? p.section : undefined,
        requirement:   (typeof p.requirement === "string" && p.requirement.trim() !== "") ? p.requirement : titleFromContext(p, sourceSpan, "Requirement pending Author"),
        applies_to:    Array.isArray(p.applies_to) ? p.applies_to : [],
        evidence:      evidenceIsEmpty ? [] : p.evidence,
        confidence:    isValidConfidence(p.confidence) ? p.confidence : defaultConfidence,
        ...optionalCommon(p)
      };
    case "materials.mat":
      return {
        id:                (typeof p.id === "string" && p.id) ? p.id : defaultId,
        family:            (typeof p.family === "string" && p.family.trim() !== "") ? p.family : "unspecified",
        name:              (typeof p.name === "string" && p.name.trim() !== "") ? p.name : titleFromContext(p, sourceSpan, "Unnamed material"),
        grades:            Array.isArray(p.grades) ? p.grades : [],
        pack_sizes:        Array.isArray(p.pack_sizes) ? p.pack_sizes : [],
        defect_risk:       isDefectRisk(p.defect_risk) ? p.defect_risk : "medium",
        waste_factor_pct:  typeof p.waste_factor_pct === "number" ? p.waste_factor_pct : 10,
        compatible_with:   Array.isArray(p.compatible_with) ? p.compatible_with : [],
        incompatible_with: Array.isArray(p.incompatible_with) ? p.incompatible_with : [],
        evidence:          Array.isArray(p.evidence) && p.evidence.length > 0 ? p.evidence : evidenceFromAuthor,
        confidence:        isValidConfidence(p.confidence) ? p.confidence : defaultConfidence
      };
    case "workflow.playbook":
      return {
        id:          (typeof p.id === "string" && p.id) ? p.id : defaultId,
        title:       (typeof p.title === "string" && p.title.trim() !== "") ? p.title : titleFromContext(p, sourceSpan, "Untitled playbook"),
        applies_to:  Array.isArray(p.applies_to) ? p.applies_to : [],
        steps:       coerceSteps(p.steps),
        checkpoints: coerceCheckpoints(p.checkpoints),
        evidence:    Array.isArray(p.evidence) && p.evidence.length > 0 ? p.evidence : evidenceFromAuthor,
        confidence:  isValidConfidence(p.confidence) ? p.confidence : defaultConfidence,
        ...optionalCommon(p)
      };
    case "defects.defect":
      return {
        id:           (typeof p.id === "string" && p.id) ? p.id : defaultId,
        name:         (typeof p.name === "string" && p.name.trim() !== "") ? p.name : titleFromContext(p, sourceSpan, "Unnamed defect"),
        applies_to:   Array.isArray(p.applies_to) ? p.applies_to : [],
        symptoms:     Array.isArray(p.symptoms) && p.symptoms.length > 0 ? p.symptoms : [""],
        causes:       Array.isArray(p.causes) ? p.causes : [],
        fixes:        Array.isArray(p.fixes) ? p.fixes : [],
        severity:     isSeverity(p.severity) ? p.severity : "functional",
        vision_hints: Array.isArray(p.vision_hints) ? p.vision_hints : [],
        evidence:     Array.isArray(p.evidence) && p.evidence.length > 0 ? p.evidence : evidenceFromAuthor,
        confidence:   isValidConfidence(p.confidence) ? p.confidence : defaultConfidence,
        ...optionalCommon(p)
      };
    case "pricing_model.rule":
      return {
        id:                   (typeof p.id === "string" && p.id) ? p.id : defaultId,
        rule_key:             typeof p.rule_key === "string" ? p.rule_key : "",
        unit:                 isUnit(p.unit) ? p.unit : "each",
        applies_when:         (p.applies_when && typeof p.applies_when === "object") ? p.applies_when : {},
        base_value:           typeof p.base_value === "number" ? p.base_value : 0,
        regional_multipliers: (p.regional_multipliers && typeof p.regional_multipliers === "object") ? p.regional_multipliers : {},
        evidence:             Array.isArray(p.evidence) && p.evidence.length > 0 ? p.evidence : evidenceFromAuthor,
        confidence:           isValidConfidence(p.confidence) ? p.confidence : defaultConfidence,
        ...optionalCommon(p)
      };
  }
}

function optionalCommon(p: Record<string, unknown>) {
  const out: Record<string, unknown> = {};
  if (typeof p.audience_level === "number" && p.audience_level >= 1 && p.audience_level <= 5) out.audience_level = p.audience_level;
  if (typeof p.classification === "string") out.classification = p.classification;
  if (typeof p.safety_note === "string" && p.safety_note.trim() !== "") out.safety_note = p.safety_note;
  if (typeof p.risk_level === "string" && ["low","medium","high"].includes(p.risk_level)) out.risk_level = p.risk_level;
  return out;
}

/** Derive a title from context when the LLM omits one. Not
 *  fabrication — this is a placeholder the Author can rewrite in the
 *  Studio editor. Prefers the reason field, then a short source_span
 *  slice, then the caller-supplied fallback. */
function titleFromContext(p: Record<string, unknown>, sourceSpan: string | null, fallback: string): string {
  if (typeof p.reason === "string" && p.reason.trim() !== "") {
    return p.reason.slice(0, 80);
  }
  if (sourceSpan && sourceSpan.trim() !== "") {
    const first = sourceSpan.trim().split(/[.!?\n]/)[0] ?? sourceSpan;
    return first.slice(0, 80).trim() || fallback;
  }
  return fallback;
}

/** LLM commonly emits playbook steps as bare strings. Coerce each
 *  step into { order, action, notes? }. Order is auto-numbered from
 *  the position in the array when not supplied. */
function coerceSteps(v: unknown): Array<{ order: number; action: string; notes?: string }> {
  if (!Array.isArray(v) || v.length === 0) return [{ order: 0, action: "" }];
  return v.map((step, i) => {
    if (typeof step === "string") {
      return { order: i, action: step };
    }
    if (step && typeof step === "object" && !Array.isArray(step)) {
      const s = step as Record<string, unknown>;
      const order  = typeof s.order === "number" ? s.order : i;
      const action = typeof s.action === "string" ? s.action
                   : typeof s.step === "string"   ? s.step
                   : typeof s.description === "string" ? s.description
                   : "";
      const notes  = typeof s.notes === "string" ? s.notes : undefined;
      return notes ? { order, action, notes } : { order, action };
    }
    return { order: i, action: "" };
  });
}

/** Coerce checkpoints similarly. */
function coerceCheckpoints(v: unknown): Array<{ after_step: number; verify: string }> {
  if (!Array.isArray(v)) return [];
  return v.map((cp, i) => {
    if (typeof cp === "string") {
      return { after_step: i, verify: cp };
    }
    if (cp && typeof cp === "object" && !Array.isArray(cp)) {
      const c = cp as Record<string, unknown>;
      const after_step = typeof c.after_step === "number" ? c.after_step : i;
      const verify     = typeof c.verify === "string" ? c.verify
                       : typeof c.check === "string"  ? c.check
                       : "";
      return { after_step, verify };
    }
    return { after_step: i, verify: "" };
  }).filter((c) => c.verify.length > 0);
}

function isValidConfidence(v: unknown): v is "low" | "medium" | "high" {
  return v === "low" || v === "medium" || v === "high";
}
function isDefectRisk(v: unknown): v is "low" | "medium" | "high" {
  return v === "low" || v === "medium" || v === "high";
}
function isSeverity(v: unknown): v is "cosmetic" | "functional" | "safety_critical" {
  return v === "cosmetic" || v === "functional" || v === "safety_critical";
}
function isUnit(v: unknown): v is "hours" | "gbp_pence" | "metres" | "each" | "square_metres" | "cubic_metres" {
  return v === "hours" || v === "gbp_pence" || v === "metres" || v === "each" || v === "square_metres" || v === "cubic_metres";
}
function minimalPayload(kind: CandidateKind, candidateId: string, noSourceSpan: boolean, sourceSpan: string | null, authorName: string): unknown {
  return normaliseCandidatePayload(kind, {}, candidateId, noSourceSpan, sourceSpan, authorName);
}

/** Anthropic sometimes wraps JSON in ```json fences even when told
 *  not to. Strip any leading/trailing fences before parsing.
 *
 *  Also handles the two most common LLM JSON mistakes:
 *   1. Trailing commas before ] or }
 *   2. Truncated / malformed tail — recovers by locating the last
 *      complete top-level candidate object inside the "candidates"
 *      array and truncating the JSON to just before that break.
 *
 *  If nothing salvageable, throws the underlying SyntaxError. */
function extractJson(text: string): unknown {
  const trimmed = text.trim();
  const fenced  = trimmed.match(/```(?:json)?\s*([\s\S]*?)\s*```/);
  let body      = fenced ? fenced[1] : trimmed;

  // Cheap fix: strip trailing commas before ] or }
  body = body.replace(/,(\s*[\]}])/g, "$1");

  try {
    return JSON.parse(body);
  } catch (initialErr) {
    // Try partial recovery: find the last complete candidate object.
    const salvaged = salvageCandidatesJson(body);
    if (salvaged) return salvaged;
    throw initialErr;
  }
}

/** Walk the "candidates" array left-to-right tracking brace depth
 *  inside a top-level string-aware parser. Returns { candidates:
 *  [complete objects up to the last balanced one] } as a valid JSON
 *  string re-parsed. Returns null when nothing salvageable. */
function salvageCandidatesJson(body: string): { candidates: unknown[] } | null {
  const arrayStart = body.indexOf('"candidates"');
  if (arrayStart < 0) return null;
  const bracketStart = body.indexOf("[", arrayStart);
  if (bracketStart < 0) return null;

  const objects: string[] = [];
  let depth      = 0;
  let currentStart = -1;
  let inString     = false;
  let escape       = false;

  for (let i = bracketStart + 1; i < body.length; i++) {
    const ch = body[i];
    if (inString) {
      if (escape)          { escape = false; continue; }
      if (ch === "\\")     { escape = true;  continue; }
      if (ch === '"')      { inString = false; }
      continue;
    }
    if (ch === '"')        { inString = true; continue; }
    if (ch === "{") {
      if (depth === 0) currentStart = i;
      depth++;
      continue;
    }
    if (ch === "}") {
      depth--;
      if (depth === 0 && currentStart >= 0) {
        objects.push(body.slice(currentStart, i + 1));
        currentStart = -1;
      }
      continue;
    }
    if (ch === "]" && depth === 0) break;
  }

  if (objects.length === 0) return null;

  const candidates: unknown[] = [];
  for (const obj of objects) {
    try { candidates.push(JSON.parse(obj)); }
    catch { /* skip any that fail to parse individually */ }
  }
  if (candidates.length === 0) return null;
  return { candidates };
}
