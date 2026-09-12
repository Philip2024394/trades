// src/lib/nex/language/guardian.ts
//
// Founder BEGIN 2026-09-11 · Step 5 of ADR-0308 · NEX Language Guardian.
//
// Deterministic validator that runs BEFORE any write to nex.concepts /
// concept_senses / questions / answers / relationships / contexts.
//
// Guardian NEVER writes. It emits a verdict. The E1/E2/E3 workers respect it.
//
// Zero LLM. Zero third-party. Pure schema + duplicate + terminology checks.

import { Client } from "pg";

function pgUrl(): string {
  return process.env.NEX_LANGUAGE_POSTGRES_URL
    ?? process.env.NEX_TAXONOMY_POSTGRES_URL
    ?? process.env.NEX_POSTGRES_URL
    ?? "postgresql://postgres:Admin1phil@localhost:5433/nex_dev";
}
async function withClient<T>(fn: (c: Client) => Promise<T>): Promise<T> {
  const c = new Client({ connectionString: pgUrl(), connectionTimeoutMillis: 5000 });
  await c.connect();
  try { return await fn(c); } finally { try { await c.end(); } catch { /* ignore */ } }
}

export type GuardianVerdict =
  | { ok: true; warnings: readonly string[] }
  | { ok: false; reasons: readonly string[]; warnings: readonly string[] };

export interface ConceptDraft {
  canonical_key: string;
  display_name: string;
  layer?: 1 | 2 | 3 | 4 | 5;
}
export interface SenseDraft {
  concept_canonical_key: string;
  sense_key: string;
  description: string;
  domain_hint?: readonly string[];
  examples?: unknown[];
  confidence?: number;
}
export interface AnswerDraft {
  sense_key: string;                   // reference by (concept_canonical_key, sense_key)
  concept_canonical_key: string;
  body: string;
  answer_kind: "definition" | "steps" | "list" | "fact" | "clarify" | "unknown";
  confidence?: number;
  source_ref: string;                  // evidence · required
}

const SENSE_KEY_RE = /^[a-z][a-z0-9_]*$/;
const CANONICAL_KEY_RE = /^[a-z][a-z0-9_]*$/;

// ═══════════════════════════════════════════════════════════════════
// Concept validation
// ═══════════════════════════════════════════════════════════════════

export async function validateConcept(draft: ConceptDraft): Promise<GuardianVerdict> {
  const reasons: string[] = [];
  const warnings: string[] = [];
  if (!draft.canonical_key || typeof draft.canonical_key !== "string") reasons.push("canonical_key_missing");
  if (draft.canonical_key && !CANONICAL_KEY_RE.test(draft.canonical_key)) reasons.push(`canonical_key_format_invalid:${draft.canonical_key}`);
  if (!draft.display_name || typeof draft.display_name !== "string") reasons.push("display_name_missing");
  if (draft.canonical_key && draft.canonical_key.length > 60) reasons.push("canonical_key_too_long");
  if (draft.display_name && draft.display_name.length > 120) warnings.push("display_name_long_may_hurt_ui");
  if (draft.layer !== undefined && (draft.layer < 1 || draft.layer > 5)) reasons.push("layer_out_of_range");
  if (reasons.length === 0 && draft.canonical_key) {
    const existing = await withClient(c =>
      c.query<{ concept_id: string }>(`SELECT concept_id FROM nex.concepts WHERE canonical_key=$1`, [draft.canonical_key])
    );
    if (existing.rows.length > 0) warnings.push(`concept_canonical_key_already_exists:${draft.canonical_key}`);
  }
  return reasons.length === 0 ? { ok: true, warnings } : { ok: false, reasons, warnings };
}

// ═══════════════════════════════════════════════════════════════════
// Sense validation
// ═══════════════════════════════════════════════════════════════════

export async function validateSense(draft: SenseDraft): Promise<GuardianVerdict> {
  const reasons: string[] = [];
  const warnings: string[] = [];
  if (!draft.sense_key || !SENSE_KEY_RE.test(draft.sense_key)) reasons.push(`sense_key_format_invalid:${draft.sense_key}`);
  if (!draft.description || draft.description.trim().length < 4) reasons.push("description_too_short");
  if (!draft.concept_canonical_key) reasons.push("concept_canonical_key_missing");
  if (draft.confidence !== undefined && (draft.confidence < 0 || draft.confidence > 1)) reasons.push("confidence_out_of_range");
  if (reasons.length > 0) return { ok: false, reasons, warnings };

  // Concept must exist
  const parent = await withClient(c =>
    c.query<{ concept_id: string }>(`SELECT concept_id FROM nex.concepts WHERE canonical_key=$1`, [draft.concept_canonical_key])
  );
  if (parent.rows.length === 0) {
    return { ok: false, reasons: [`parent_concept_not_found:${draft.concept_canonical_key}`], warnings };
  }
  // Duplicate sense_key on same concept
  const dup = await withClient(c =>
    c.query<{ sense_id: string }>(
      `SELECT sense_id FROM nex.concept_senses WHERE concept_id=$1 AND sense_key=$2`,
      [parent.rows[0].concept_id, draft.sense_key]
    )
  );
  if (dup.rows.length > 0) return { ok: false, reasons: [`sense_already_exists:${draft.concept_canonical_key}.${draft.sense_key}`], warnings };
  return { ok: true, warnings };
}

// ═══════════════════════════════════════════════════════════════════
// Answer validation
// ═══════════════════════════════════════════════════════════════════

export async function validateAnswer(draft: AnswerDraft): Promise<GuardianVerdict> {
  const reasons: string[] = [];
  const warnings: string[] = [];
  if (!draft.body || draft.body.trim().length < 8) reasons.push("answer_body_too_short");
  if (!draft.answer_kind) reasons.push("answer_kind_missing");
  if (!draft.source_ref) reasons.push("source_ref_missing_evidence_required");
  if (draft.confidence !== undefined && (draft.confidence < 0 || draft.confidence > 1)) reasons.push("confidence_out_of_range");
  if (reasons.length > 0) return { ok: false, reasons, warnings };

  // Sense must exist
  const sense = await withClient(c =>
    c.query<{ sense_id: string }>(
      `SELECT s.sense_id FROM nex.concept_senses s JOIN nex.concepts c ON c.concept_id=s.concept_id WHERE c.canonical_key=$1 AND s.sense_key=$2`,
      [draft.concept_canonical_key, draft.sense_key]
    )
  );
  if (sense.rows.length === 0) return { ok: false, reasons: [`sense_not_found_for_answer:${draft.concept_canonical_key}.${draft.sense_key}`], warnings };
  return { ok: true, warnings };
}

// ═══════════════════════════════════════════════════════════════════
// Contradiction detection · looks for authoritative senses whose descriptions
// negate each other (heuristic · flags for human)
// ═══════════════════════════════════════════════════════════════════

export async function detectContradictions(): Promise<Array<{ concept_id: string; canonical_key: string; senses: Array<{ sense_key: string; description: string }> }>> {
  const contradictionMarkers = /\b(never|not|no)\b.*\b(is|are)\b|opposite of|contrary to/i;
  return withClient(async c => {
    const r = await c.query<{ concept_id: string; canonical_key: string; sense_key: string; description: string }>(
      `SELECT c.concept_id, c.canonical_key, s.sense_key, s.description
         FROM nex.concept_senses s
         JOIN nex.concepts c ON c.concept_id = s.concept_id
         WHERE s.status IN ('authoritative','truth_engine_ok','guardian_ok')`
    );
    const byConcept = new Map<string, { canonical_key: string; senses: Array<{ sense_key: string; description: string }> }>();
    for (const row of r.rows) {
      const arr = byConcept.get(row.concept_id) ?? { canonical_key: row.canonical_key, senses: [] };
      arr.senses.push({ sense_key: row.sense_key, description: row.description });
      byConcept.set(row.concept_id, arr);
    }
    const flagged: Array<{ concept_id: string; canonical_key: string; senses: Array<{ sense_key: string; description: string }> }> = [];
    for (const [concept_id, v] of byConcept) {
      const anyContradictionText = v.senses.some(s => contradictionMarkers.test(s.description));
      if (v.senses.length > 1 && anyContradictionText) flagged.push({ concept_id, ...v });
    }
    return flagged;
  });
}
