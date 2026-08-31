// scripts/nex-ollama/_corpus.mjs
//
// Ground-truth corpus lookup for the vocab pipeline · Philip 2026-08-28.
//
// Layer 1 of the three-layer QA:
//   1. Ground truth (this module)      · corpus/dictionary anchored  · NEX FACT
//   2. Ollama LLM translation           · when Layer 1 has no entry  · needs Layer 3
//   3. Round-trip validation            · verifies Layer 2 output
//
// Reads data/nex-english-indonesian-ground-truth-v1.json (hand-curated 200+
// word/phrase map) and exposes lookup(en) → { id, alternates, note, source }.
//
// Future upgrade: also read the Tatoeba EN-ID download when materialised
// (see the provenance note in the ground-truth JSON).

import { readFileSync } from "node:fs";

const GT_PATH = "data/nex-english-indonesian-ground-truth-v1.json";
const gt = JSON.parse(readFileSync(GT_PATH, "utf8"));

const map = new Map();
for (const [en, entry] of Object.entries(gt.map)) {
  map.set(en.toLowerCase().trim(), entry);
}

export function lookup(englishTerm) {
  if (!englishTerm) return null;
  const key = englishTerm.toLowerCase().trim();
  const hit = map.get(key);
  if (!hit) return null;
  return {
    ...hit,
    source: "hand_curated_ground_truth_v1",
    licence_terms: gt.provenance.licence_terms,
    truth_class: "confirmed_fact", // NEX FACT
    layer: 1,
  };
}

export function size() {
  return map.size;
}
