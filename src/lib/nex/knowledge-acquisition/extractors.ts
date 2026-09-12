// src/lib/nex/knowledge-acquisition/extractors.ts
//
// P1 REDIRECT · Knowledge Acquisition Capability · extractors
// (Philip 2026-09-05 · corrective authorization)
//
// PRINCIPLE: extractors produce CANDIDATE claims only. They NEVER
// promote to NEX-owned knowledge. Promotion is a separate stage
// gated by verification.
//
// Three v0 extractors:
//
//   · regex.definitional   · deterministic pattern-match on "X is/refers to/means Y"
//   · structured.json      · passes through pre-structured JSON claims
//   · manual.controlled    · human-authored claims explicitly marked
//
// Future extractors (llm.local.qwen25 · dom.html · pdf.text) plug
// into the same interface. LLM-produced claims MUST still be routed
// through verification · they never bypass to promoted knowledge.
//
// Every extractor is DETERMINISTIC where possible (regex + structured
// are pure functions on input). The manual extractor is a pass-through
// for hand-authored fixtures.

import { randomUUID } from "node:crypto";
import type { CandidateClaim, SourceSnapshot } from "./types";

/** Contract every extractor implements. */
export interface Extractor {
  readonly id: string;
  extract(snapshot: SourceSnapshot): CandidateClaim[];
}

// ─── extractor.regex.definitional ─────────────────────────────────
//
// Extracts "SUBJECT is/refers to/means/covers PREDICATE" from prose
// content. Same pattern class used by the P0.2 claim-verifier ·
// re-used here as an extraction primitive.
//
// Conservative by design: false-negatives are acceptable, false-
// positives waste verification budget.

const DEFINITIONAL_PATTERNS: RegExp[] = [
  // "HS code 0304 is/refers to/covers ..." (canonical form)
  /\b((?:HS\s+code\s+\d{2,6}|(?:code|SKU|ID)\s+[A-Z0-9\-]{2,20}))\s+(?:is|refers to|means|covers|represents|denotes|indicates|is for)\s+([^.!?\n]{4,240})/gi,
  // "HS 0303 / HS heading 0304 / HS subheading 0303.42 / HS chapter 03 is/for/refers to/covers ..."
  /\b(HS\s+(?:heading\s+|subheading\s+|code\s+|chapter\s+)?\d{2,6}(?:\.\d{1,4})?)\s+(?:is|refers to|means|covers|represents|denotes|indicates|is for|is the code for)\s+([^.!?\n]{4,240})/gi,
  // "SUBJECT (capitalized 1-3 word proper name) is/refers to/means a/an/the ..."
  /\b([A-Z][a-z]{2,20}(?:\s+[A-Z][a-z]{2,20}){0,3})\s+(?:is|refers to|means|denotes|represents)\s+((?:a|an|the)\s+[a-z][^.!?\n]{5,240})/g,
];

export const regexDefinitionalExtractor: Extractor = {
  id: "regex.definitional",
  extract(snapshot: SourceSnapshot): CandidateClaim[] {
    const content = snapshot.content ?? "";
    if (!content) return [];
    const claims: CandidateClaim[] = [];
    const seen = new Set<string>();
    for (const rx of DEFINITIONAL_PATTERNS) {
      for (const m of content.matchAll(rx)) {
        const subject = m[1].trim();
        const predicate = m[2].trim().replace(/[,;].*$/, "");
        const dedupeKey = `${subject.toLowerCase()}||${predicate.toLowerCase()}`;
        if (seen.has(dedupeKey)) continue;
        seen.add(dedupeKey);
        claims.push({
          claim_id: randomUUID(),
          subject,
          predicate,
          extracted_from: snapshot.snapshot_id,
          extractor_id: "regex.definitional",
          extracted_at: new Date().toISOString(),
          status: "candidate",
        });
      }
    }
    return claims;
  },
};

// ─── extractor.structured.json ────────────────────────────────────
//
// The snapshot's structured payload is a pre-validated array of
// { subject · predicate · qualifiers? · contradictions? }. Used for
// authoritative sources that publish machine-readable data.

type StructuredClaimShape = {
  subject: string;
  predicate: string;
  qualifiers?: Record<string, string>;
  contradictions?: string[];
};

export const structuredJsonExtractor: Extractor = {
  id: "structured.json",
  extract(snapshot: SourceSnapshot): CandidateClaim[] {
    const payload = snapshot.structured;
    if (!Array.isArray(payload)) return [];
    const claims: CandidateClaim[] = [];
    for (const raw of payload) {
      const item = raw as StructuredClaimShape;
      if (!item || typeof item.subject !== "string" || typeof item.predicate !== "string") continue;
      claims.push({
        claim_id: randomUUID(),
        subject: item.subject,
        predicate: item.predicate,
        qualifiers: item.qualifiers,
        contradictions: item.contradictions,
        extracted_from: snapshot.snapshot_id,
        extractor_id: "structured.json",
        extracted_at: new Date().toISOString(),
        status: "candidate",
      });
    }
    return claims;
  },
};

// ─── extractor.manual.controlled ──────────────────────────────────
//
// Explicit human-authored claims. Used ONLY for controlled test
// fixtures. The extractor_id marker makes it clear these came from
// hand-authoring, not machine extraction. Verification still applies.

export const manualControlledExtractor: Extractor = {
  id: "manual.controlled",
  extract(snapshot: SourceSnapshot): CandidateClaim[] {
    // Manual extractor treats snapshot.structured as authoritative
    // human input · same shape as structured.json but with a
    // different extractor_id for provenance visibility.
    const payload = snapshot.structured;
    if (!Array.isArray(payload)) return [];
    const claims: CandidateClaim[] = [];
    for (const raw of payload) {
      const item = raw as StructuredClaimShape;
      if (!item || typeof item.subject !== "string" || typeof item.predicate !== "string") continue;
      claims.push({
        claim_id: randomUUID(),
        subject: item.subject,
        predicate: item.predicate,
        qualifiers: item.qualifiers,
        contradictions: item.contradictions,
        extracted_from: snapshot.snapshot_id,
        extractor_id: "manual.controlled",
        extracted_at: new Date().toISOString(),
        status: "candidate",
      });
    }
    return claims;
  },
};

// ─── Extractor registry ──────────────────────────────────────────

export const EXTRACTORS: readonly Extractor[] = [
  regexDefinitionalExtractor,
  structuredJsonExtractor,
  manualControlledExtractor,
];

export function getExtractor(id: string): Extractor | null {
  return EXTRACTORS.find((e) => e.id === id) ?? null;
}
