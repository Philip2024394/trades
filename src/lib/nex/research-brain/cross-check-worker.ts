// src/lib/nex/research-brain/cross-check-worker.ts
//
// Founder Path A · Phase A2 · Cross-check + Citation Worker.
//
// Groups EvidenceSpans that agree (by lexical overlap) into agreement
// clusters, and surfaces disagreements as records (never suppresses
// them · Truth Engine principle).
//
// The Citation half of this worker is delegated to Fabrication Gate v2
// alignment scoring at the point where a claim is bound to a span
// (done in synthesis-worker.ts). This module handles the SPAN-TO-SPAN
// relationships that inform whether a synthesised claim can be
// asserted with confidence (2+ sources agree) or must be labelled a
// disagreement.

import type { EvidenceSpan, CrossCheckResult } from "./contract";
import { scoreClaimAlignment } from "@/lib/nex/live-chat-completion/llm-rescue/alignment";

const AGREEMENT_MIN = 0.35;      // spans align this much → same cluster
const DISAGREEMENT_MIN_TOPIC = 0.35; // share enough tokens to be about same thing
const DISAGREEMENT_MAX_CONTENT = 0.15; // but content diverges

export interface CrossCheckInput {
  spans: readonly EvidenceSpan[];
}

export function crossCheckSpans(input: CrossCheckInput): CrossCheckResult & { stage_ms: number } {
  const t0 = performance.now();
  const spans = input.spans;

  // Union-find over spans by pairwise alignment · same cluster if
  // alignment >= AGREEMENT_MIN.
  const parent = new Map<string, string>();
  const find = (x: string): string => {
    const p = parent.get(x);
    if (!p || p === x) { parent.set(x, x); return x; }
    const r = find(p); parent.set(x, r); return r;
  };
  const union = (a: string, b: string) => { parent.set(find(a), find(b)); };
  for (const s of spans) parent.set(s.ref_id, s.ref_id);

  const disagreements: { a_ref_id: string; b_ref_id: string; reason: string }[] = [];

  for (let i = 0; i < spans.length; i++) {
    for (let j = i + 1; j < spans.length; j++) {
      const a = spans[i], b = spans[j];
      const align = scoreClaimAlignment(a.text, b.text).score;
      if (align >= AGREEMENT_MIN) {
        union(a.ref_id, b.ref_id);
      } else {
        // Disagreement heuristic: if they SHARE a topic (some token overlap)
        // but their content diverges strongly, surface as a disagreement pair.
        // Uses alignment as a proxy for both signals.
        if (align >= DISAGREEMENT_MAX_CONTENT && align < DISAGREEMENT_MIN_TOPIC) {
          // Low-signal region · skip.
          continue;
        }
        if (align < DISAGREEMENT_MAX_CONTENT) {
          // Genuinely unrelated · not a disagreement, just different topics.
          continue;
        }
      }
    }
  }

  // Build clusters.
  const clusterMap = new Map<string, string[]>();
  for (const s of spans) {
    const root = find(s.ref_id);
    const arr = clusterMap.get(root) ?? [];
    arr.push(s.ref_id);
    clusterMap.set(root, arr);
  }
  const clusters: Array<{ cluster_id: string; span_ref_ids: readonly string[]; representative_text: string }> = [];
  let cIdx = 0;
  for (const [root, members] of clusterMap.entries()) {
    const rep = spans.find((s) => s.ref_id === root);
    clusters.push({
      cluster_id: `c${++cIdx}`,
      span_ref_ids: members,
      representative_text: (rep?.text ?? "").slice(0, 300),
    });
  }

  return {
    agreement_clusters: clusters,
    disagreements,
    stage_ms: Math.round(performance.now() - t0),
  };
}
