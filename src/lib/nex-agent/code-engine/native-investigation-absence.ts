// src/lib/nex-agent/code-engine/native-investigation-absence.ts
//
// NEX1 · Native Investigation · Absence-of-Token / Reverse-Pattern Reasoning.
//
// Founder Fix Work Order 2026-09-16: extend investigation from present-evidence
// to present + absence-of-expected-evidence reasoning · WITHIN existing
// deterministic architecture · zero LLM · read-only · bounded.
//
// PIPELINE (§4 · §7):
//   EXPECTED (classifier concepts as expectation source · §5A/§5F)
//        -
//   OBSERVED (File Memory tags · deterministic content scan)
//        =
//   MISSING (candidate absences)
//   +
//   PROVEN absence (locally · via inspected scope) · not GLOBAL
//   +
//   LEVEL A · B · C finding classification (§12)
//
// SAFETY (§17 · §18):
//   · Investigation only · never proposes modifications
//   · Never rebuilds infrastructure · pure CONNECT on existing File Memory tags
//   · Never invents expected behaviour · absence must be evidence-backed
//   · Zero LLM · zero grep-execution · zero writes
//   · Bounded: caller supplies budget · no autonomous loops
//   · Reports LOCAL absence (not GLOBAL) explicitly (§7)

import type { FileMemoryStore, Nex1FileMemoryEntry } from "./capability-m-file-memory";

// ── Finding classification (§12) ───────────────────────────────────────

export type AbsenceLevel = "LEVEL_A_OBSERVED" | "LEVEL_B_INFERRED" | "LEVEL_C_HYPOTHESIS";

export type AbsenceConfidenceBand = "HIGH" | "MEDIUM" | "LOW" | "INSUFFICIENT";

export interface AbsenceCandidate {
  readonly path: string;
  readonly reason: "structural_neighborhood_missing_tokens";
  readonly neighborhood_tags: readonly string[];   // shared tags with reference set
  readonly reference_files: readonly string[];      // files with all expected concepts
  readonly expected_concepts: readonly string[];
  readonly observed_concepts_on_candidate: readonly string[];  // concept tags found on candidate (subset)
  readonly missing_concepts: readonly string[];     // expected − observed
  readonly absence_gap: number;                      // count of missing concepts
  readonly search_scope_notes: string;               // per §7: what scope was inspected
  readonly local_or_global: "LOCAL_SCOPE" | "UNKNOWN_GLOBAL_SCOPE";  // §7 mandatory
  readonly findings: readonly AbsenceFinding[];
  readonly absence_confidence: AbsenceConfidenceBand;
}

export interface AbsenceFinding {
  readonly level: AbsenceLevel;
  readonly claim: string;
  readonly evidence_kind: "TAG_ABSENCE" | "STRUCTURAL_SIBLING" | "REFERENCE_ASYMMETRY" | "DOWNSTREAM_LINK";
  readonly evidence_source: string;
}

// ── Compute absence candidates (deterministic · pure function) ─────────

export interface ComputeAbsenceInput {
  readonly store: FileMemoryStore;
  readonly expected_concepts: readonly string[];       // classifier's coding_concept tokens
  readonly problem_scope_hint?: string;                // optional path prefix from problem
  readonly max_reference_files?: number;               // default 20 · cap 100
  readonly max_candidates?: number;                    // default 20 · cap 100
  readonly min_neighborhood_weight?: number;           // min shared-tags count · default 1
}

export interface ComputeAbsenceResult {
  readonly ok: true;
  readonly expected_concepts: readonly string[];
  readonly reference_files: readonly string[];         // files with ALL expected concepts
  readonly neighborhood_tags: readonly string[];       // tags shared by ≥ min_neighborhood_weight refs
  readonly candidates: readonly AbsenceCandidate[];
  readonly reasoning_trace: readonly string[];
  readonly bounded_by: string;
}

export interface ComputeAbsenceInsufficient {
  readonly ok: false;
  readonly reason: "no_reference_set" | "no_neighborhood" | "no_candidates" | "insufficient_expectation";
  readonly reasoning_trace: readonly string[];
  readonly expected_concepts: readonly string[];
}

export type ComputeAbsenceOutput = ComputeAbsenceResult | ComputeAbsenceInsufficient;

/** Confidence: HIGH = ≥ 2 neighborhood tags AND ≥ 2 concepts missing AND ≥ 2 reference files;
 *  MEDIUM = 1 neighborhood tag OR 1 concept missing; LOW otherwise; INSUFFICIENT = < 1 of each. */
function bandConfidence(neighborhoodOverlap: number, missingCount: number, refCount: number): AbsenceConfidenceBand {
  if (neighborhoodOverlap >= 2 && missingCount >= 2 && refCount >= 2) return "HIGH";
  if (neighborhoodOverlap >= 1 && missingCount >= 1 && refCount >= 1) return "MEDIUM";
  if (neighborhoodOverlap >= 1 || missingCount >= 1) return "LOW";
  return "INSUFFICIENT";
}

/** Deterministic absence detection · pure over File Memory state · zero LLM.
 *
 *  Algorithm (§4 · §5A · §7):
 *    1. Get the "reference set" of files that carry ALL expected concepts.
 *       These files anchor the expected-behaviour context.
 *    2. Extract the "neighborhood" = tags shared by ≥ N reference files
 *       (typically directory tags). Neighborhood defines the scope of expected behaviour.
 *    3. Find "candidates" = files that share any neighborhood tag AND
 *       have strictly fewer expected concepts than the reference set carries.
 *       These are structural siblings that appear incomplete relative to the reference.
 *    4. For each candidate emit LEVEL A (OBSERVED absence) + LEVEL B (INFERRED sibling)
 *       findings + optional LEVEL C hypothesis if downstream evidence supports it.
 *    5. Confidence banded HIGH / MEDIUM / LOW / INSUFFICIENT.
 *
 *  Absence is proven ONLY within the inspected scope · never asserted globally (§7). */
export function computeAbsenceCandidates(input: ComputeAbsenceInput): ComputeAbsenceOutput {
  const trace: string[] = [];
  const expected = Array.from(new Set(input.expected_concepts.map((c) => c.trim().toLowerCase()).filter((c) => c.length > 0)));
  const maxRefs = Math.min(input.max_reference_files ?? 20, 100);
  const maxCands = Math.min(input.max_candidates ?? 20, 100);
  const minWeight = Math.max(input.min_neighborhood_weight ?? 1, 1);

  trace.push(`expected_concepts=[${expected.join(", ")}]`);
  trace.push(`max_reference_files=${maxRefs} · max_candidates=${maxCands} · min_neighborhood_weight=${minWeight}`);

  if (expected.length === 0) {
    trace.push("insufficient_expectation: zero concepts");
    return { ok: false, reason: "insufficient_expectation", reasoning_trace: trace, expected_concepts: expected };
  }

  // Step 1 · reference set (files containing ALL expected concepts).
  // Deterministic: intersect listFiles({tag}) results across all expected concepts.
  const perConcept: Map<string, Set<string>> = new Map();
  for (const tag of expected) {
    let list;
    try {
      list = input.store.listFiles({ tag, limit: 200 });
    } catch (e) {
      trace.push(`listFiles(${tag}) threw · treating as empty`);
      perConcept.set(tag, new Set());
      continue;
    }
    perConcept.set(tag, new Set(list.entries.map((e: Nex1FileMemoryEntry) => e.path)));
    trace.push(`listFiles(tag=${tag}) → ${list.entries.length} entries`);
  }

  // Intersect
  const conceptTags = Array.from(perConcept.keys());
  let refPaths: Set<string> = new Set(perConcept.get(conceptTags[0]) ?? []);
  for (let i = 1; i < conceptTags.length; i++) {
    const next = perConcept.get(conceptTags[i]) ?? new Set();
    refPaths = new Set([...refPaths].filter((p) => next.has(p)));
  }
  trace.push(`reference_intersection · ${refPaths.size} files carry ALL ${conceptTags.length} concepts`);

  if (refPaths.size === 0) {
    // Fallback · use files that have the MOST of the expected concepts (not all)
    // This handles cases where the corpus has no file with the complete set.
    // Deterministic ranking: files by count of matched concepts (descending).
    const scoreByPath = new Map<string, number>();
    for (const [_, paths] of perConcept.entries()) {
      for (const p of paths) {
        scoreByPath.set(p, (scoreByPath.get(p) ?? 0) + 1);
      }
    }
    const maxScore = Math.max(0, ...Array.from(scoreByPath.values()));
    if (maxScore < 1) {
      trace.push("no_reference_set · no file in corpus carries any expected concept");
      return { ok: false, reason: "no_reference_set", reasoning_trace: trace, expected_concepts: expected };
    }
    // Take files with score == maxScore as partial-reference set
    for (const [p, s] of scoreByPath.entries()) {
      if (s === maxScore) refPaths.add(p);
    }
    trace.push(`fallback reference set: ${refPaths.size} files with max score=${maxScore}/${expected.length}`);
  }

  const referenceFiles = Array.from(refPaths).slice(0, maxRefs).sort();

  // Step 2 · neighborhood tags (tags shared by ≥ minWeight reference files).
  const tagCounts = new Map<string, number>();
  for (const p of referenceFiles) {
    const r = input.store.recallFile(p);
    if (r.kind === "found") {
      for (const t of r.entry.tags) {
        // Exclude the expected-concept tags themselves · we want STRUCTURAL tags
        if (expected.includes(t)) continue;
        tagCounts.set(t, (tagCounts.get(t) ?? 0) + 1);
      }
    }
  }

  // Priority: directory tags (typically non-verb non-language)
  const neighborhoodTags = Array.from(tagCounts.entries())
    .filter(([, c]) => c >= minWeight)
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
    .map(([t]) => t)
    .slice(0, 30);

  trace.push(`neighborhood_tags=[${neighborhoodTags.join(", ")}]`);

  if (neighborhoodTags.length === 0) {
    trace.push("no_neighborhood · reference files share no structural tags");
    return {
      ok: false, reason: "no_neighborhood", reasoning_trace: trace,
      expected_concepts: expected,
    };
  }

  // Step 3 · candidates · files that share neighborhood tags but have FEWER expected concepts.
  const candidateMap = new Map<string, {
    entry: Nex1FileMemoryEntry;
    sharedNeighborhoodTags: Set<string>;
    observedExpected: Set<string>;
  }>();

  for (const nTag of neighborhoodTags) {
    let list;
    try {
      list = input.store.listFiles({ tag: nTag, limit: 200 });
    } catch {
      continue;
    }
    for (const entry of list.entries) {
      if (referenceFiles.includes(entry.path)) continue;  // skip reference set itself
      // count expected concepts present on this candidate
      const observed = new Set(entry.tags.filter((t) => expected.includes(t)));
      // absence gap: how many expected concepts are missing
      const missing = expected.length - observed.size;
      // Only interested if candidate has strictly fewer than reference set
      // (reference set has expected.length by definition)
      if (missing <= 0) continue;
      const bucket = candidateMap.get(entry.path);
      if (!bucket) {
        candidateMap.set(entry.path, {
          entry,
          sharedNeighborhoodTags: new Set([nTag]),
          observedExpected: observed,
        });
      } else {
        bucket.sharedNeighborhoodTags.add(nTag);
      }
    }
  }

  const rawCandidates = Array.from(candidateMap.values());
  // Rank: absence_gap DESC · then neighborhood overlap DESC · then path ASC
  const sortedCandidates = rawCandidates
    .map((b) => ({
      bucket: b,
      absence_gap: expected.length - b.observedExpected.size,
      overlap: b.sharedNeighborhoodTags.size,
    }))
    .sort((a, b) =>
      (b.absence_gap - a.absence_gap) ||
      (b.overlap - a.overlap) ||
      a.bucket.entry.path.localeCompare(b.bucket.entry.path),
    )
    .slice(0, maxCands);

  trace.push(`candidates_found=${sortedCandidates.length}`);

  if (sortedCandidates.length === 0) {
    return {
      ok: false, reason: "no_candidates", reasoning_trace: trace,
      expected_concepts: expected,
    };
  }

  // Step 4 · emit findings
  const candidates: AbsenceCandidate[] = sortedCandidates.map(({ bucket, absence_gap, overlap }) => {
    const missing = expected.filter((c) => !bucket.observedExpected.has(c));
    const observed = Array.from(bucket.observedExpected).sort();
    const neighborhood = Array.from(bucket.sharedNeighborhoodTags).sort();
    const confidence = bandConfidence(overlap, missing.length, referenceFiles.length);
    const findings: AbsenceFinding[] = [];

    // Level A · OBSERVED absence in inspected scope
    findings.push({
      level: "LEVEL_A_OBSERVED",
      claim:
        `File ${bucket.entry.path} has ${observed.length}/${expected.length} expected concept tokens ` +
        `(missing: ${missing.join(", ")}). Content-scan is deterministic (CODING_LEXEME_INDEX whole-token match).`,
      evidence_kind: "TAG_ABSENCE",
      evidence_source: `FileMemoryStore.recallFile(${bucket.entry.path}) · seed-from-content deterministic tag emission`,
    });

    // Level B · EVIDENCE-BACKED INFERENCE (structural sibling)
    findings.push({
      level: "LEVEL_B_INFERRED",
      claim:
        `File shares ${overlap} structural tag(s) [${neighborhood.slice(0, 5).join(", ")}] ` +
        `with ${referenceFiles.length} reference file(s) that carry all ${expected.length} expected concept(s). ` +
        `This structural sibling relationship suggests the file is in the same architectural context but appears asymmetric.`,
      evidence_kind: "STRUCTURAL_SIBLING",
      evidence_source: `File Memory tag intersection · reference files: ${referenceFiles.slice(0, 3).join(", ")}${referenceFiles.length > 3 ? "..." : ""}`,
    });

    // Level C · HYPOTHESIS (only if strongly supported)
    if (confidence === "HIGH") {
      findings.push({
        level: "LEVEL_C_HYPOTHESIS",
        claim:
          `HYPOTHESIS (unverified · requires source inspection to confirm): the absence of ` +
          `[${missing.join(", ")}] in this file within the ${neighborhood[0] ?? "shared"} neighborhood may ` +
          `explain why downstream consumers that depend on this file's construction miss those requirements. ` +
          `Root-cause candidate · not established without direct source inspection.`,
        evidence_kind: "REFERENCE_ASYMMETRY",
        evidence_source: `Asymmetric tag profile within ${neighborhood[0] ?? "shared neighborhood"}`,
      });
    }

    return {
      path: bucket.entry.path,
      reason: "structural_neighborhood_missing_tokens",
      neighborhood_tags: neighborhood,
      reference_files: referenceFiles.slice(0, 5),
      expected_concepts: expected,
      observed_concepts_on_candidate: observed,
      missing_concepts: missing,
      absence_gap,
      search_scope_notes:
        `Scope: File Memory listFiles({tag}) intersection over ${expected.length} concepts. ` +
        `Reference set intersection cardinality: ${referenceFiles.length}. ` +
        `Neighborhood tags shared with ≥${minWeight} references: ${neighborhoodTags.length}. ` +
        `Content search was NOT executed for this candidate · absence is proven ONLY at tag-index level.`,
      local_or_global: "LOCAL_SCOPE",  // per §7 · never GLOBAL without deeper search
      findings,
      absence_confidence: confidence,
    };
  });

  return {
    ok: true,
    expected_concepts: expected,
    reference_files: referenceFiles,
    neighborhood_tags: neighborhoodTags,
    candidates,
    reasoning_trace: trace,
    bounded_by:
      `File Memory tag-index only · ref cap=${maxRefs} · cand cap=${maxCands} · ` +
      `min neighborhood weight=${minWeight} · zero LLM · zero grep · zero fs read outside File Memory`,
  };
}
