// src/lib/nex/research-signals/dedup-cascade.ts
//
// UWI · Wave 4 · M17 · Six-layer deterministic dedup cascade
// Founder-authorised programme.
//
// Founder-locked doctrine (CRII synthesis §19):
//   Layer 1: canonical-id / SHA-256 exact match → already_known
//   Layer 2: SimHash near-duplicate (Hamming ≤ 3 on 64-bit)
//   Layer 3: MinHash-LSH candidate + estimated Jaccard ≥ 0.7
//   Layer 4: Token Jaccard (word shingles) ≥ 0.5
//   Layer 5: Citation-graph coupling (shared source_refs ≥ N + evidence_refs ≥ M)
//   Layer 6: Wardley-cell match (same evolution_stage × value_chain_position)
//
// Three-way verdict:
//   - already_known         · early-layer strong match
//   - same_idea_new_evidence · deeper-layer match + differing content
//   - genuinely_new          · no layer fires above threshold
//
// NO EMBEDDINGS. All deterministic. Rule 5c preserved.

import { createHash } from "node:crypto";
import type { DedupVerdict, WardleyClassification } from "./types";
import { simhashText, hammingDistance64, toHex64 } from "./simhash";
import { minhashSignature, MinHashLshIndex, estimatedJaccardFromMinHash } from "./minhash-lsh";
import { wordShingles, jaccard } from "./token-jaccard";
import { positionalKey } from "./wardley-classifier";

export interface DedupCandidate {
  readonly id: string;
  readonly text: string;
  readonly source_refs?: readonly string[];
  readonly evidence_refs?: readonly string[];
  readonly wardley?: WardleyClassification;
}

export interface DedupCascadeConfig {
  readonly simhash_hamming_threshold: number;  // default 3 · Hamming ≤ N counts as near-dup
  readonly minhash_bands: number;              // 32 default (× 4 rows = 128 signature length)
  readonly minhash_rows: number;               // 4 default
  readonly minhash_jaccard_threshold: number;  // 0.7 default
  readonly token_jaccard_threshold: number;    // 0.5 default
  readonly citation_min_shared: number;        // 3 default
}

export const DEFAULT_DEDUP_CASCADE: DedupCascadeConfig = {
  simhash_hamming_threshold: 3,
  minhash_bands: 32,
  minhash_rows: 4,
  minhash_jaccard_threshold: 0.7,
  token_jaccard_threshold: 0.5,
  citation_min_shared: 3,
};

export function sha256Hex(s: string): string {
  return createHash("sha256").update(s).digest("hex");
}

/** Stateful cascade · call `check` for each new candidate. Registers
 *  the candidate internally so future calls can detect duplicates. */
export class DedupCascade {
  private sha_index = new Map<string, string>();                       // sha → id
  private simhash_index: Array<{ id: string; fp: [number, number] }> = [];
  private minhash_index: MinHashLshIndex;
  private token_shingles = new Map<string, string[]>();                // id → shingles
  private candidates = new Map<string, DedupCandidate>();

  constructor(public readonly config: DedupCascadeConfig = DEFAULT_DEDUP_CASCADE) {
    this.minhash_index = new MinHashLshIndex(config.minhash_bands, config.minhash_rows);
  }

  /** Check a new candidate through all layers · returns verdict.
   *  Does NOT register the candidate; caller does so via `register`. */
  check(cand: DedupCandidate): DedupVerdict {
    const sha = sha256Hex(cand.text);

    // Layer 1 · SHA-256 exact
    const exact_id = this.sha_index.get(sha);
    if (exact_id) {
      return { kind: "already_known", layer: "sha256_exact", duplicate_of: exact_id, confidence: 1.0 };
    }

    // Layer 2 · SimHash near-duplicate
    const fp = simhashText(cand.text);
    for (const { id, fp: prior_fp } of this.simhash_index) {
      const dist = hammingDistance64(fp, prior_fp);
      if (dist <= this.config.simhash_hamming_threshold) {
        return {
          kind: "already_known",
          layer: "simhash_near",
          duplicate_of: id,
          confidence: 1 - dist / 64,
        };
      }
    }

    // Layer 3 · MinHash-LSH candidate + estimated Jaccard
    const sig_length = this.config.minhash_bands * this.config.minhash_rows;
    const query_sig = minhashSignature(wordShingles(cand.text, 3), sig_length);
    const best = this.minhash_index.queryBest(query_sig);
    if (best && best.estimated_jaccard >= this.config.minhash_jaccard_threshold) {
      return {
        kind: "same_idea_new_evidence",
        layer: "minhash_lsh",
        duplicate_of: best.doc_id,
        similarity: best.estimated_jaccard,
      };
    }

    // Layer 4 · Token Jaccard on word shingles
    const q_shingles = wordShingles(cand.text, 3);
    for (const [prior_id, prior_shingles] of this.token_shingles) {
      const jac = jaccard(q_shingles, prior_shingles);
      if (jac >= this.config.token_jaccard_threshold) {
        return {
          kind: "same_idea_new_evidence",
          layer: "token_jaccard",
          duplicate_of: prior_id,
          similarity: jac,
        };
      }
    }

    // Layer 5 · Citation-graph coupling
    if (cand.source_refs && cand.source_refs.length > 0) {
      for (const [prior_id, prior] of this.candidates) {
        if (!prior.source_refs) continue;
        const shared = intersectionCount(cand.source_refs, prior.source_refs);
        if (shared >= this.config.citation_min_shared) {
          return {
            kind: "same_idea_new_evidence",
            layer: "citation_graph",
            duplicate_of: prior_id,
            similarity: shared / Math.max(cand.source_refs.length, prior.source_refs.length),
          };
        }
      }
    }

    // Layer 6 · Wardley cell match
    if (cand.wardley) {
      const q_cell = positionalKey(cand.wardley);
      for (const [prior_id, prior] of this.candidates) {
        if (!prior.wardley) continue;
        if (positionalKey(prior.wardley) === q_cell) {
          return {
            kind: "same_idea_new_evidence",
            layer: "wardley_position",
            duplicate_of: prior_id,
            similarity: 0.5, // cell-match is a weak signal
          };
        }
      }
    }

    return { kind: "genuinely_new" };
  }

  /** Register a candidate so future checks see it. */
  register(cand: DedupCandidate): void {
    const sha = sha256Hex(cand.text);
    this.sha_index.set(sha, cand.id);
    this.simhash_index.push({ id: cand.id, fp: simhashText(cand.text) });
    const sig_length = this.config.minhash_bands * this.config.minhash_rows;
    this.minhash_index.add(cand.id, minhashSignature(wordShingles(cand.text, 3), sig_length));
    this.token_shingles.set(cand.id, wordShingles(cand.text, 3));
    this.candidates.set(cand.id, cand);
  }

  /** Check + register in one call · common path for "process new candidate". */
  processCandidate(cand: DedupCandidate): DedupVerdict {
    const verdict = this.check(cand);
    // Only register if genuinely_new (or same_idea_new_evidence → we do NOT dedup, we increment; simplest is not to re-register)
    if (verdict.kind === "genuinely_new") this.register(cand);
    return verdict;
  }

  size(): number { return this.candidates.size; }
}

function intersectionCount(a: ReadonlyArray<string>, b: ReadonlyArray<string>): number {
  const setA = new Set(a);
  let n = 0;
  for (const v of b) if (setA.has(v)) n++;
  return n;
}
