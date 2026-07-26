// Batch 24 — Regs/safety gaps only. 90% of what Philip sent is already
// covered (Doc K 104 hits, 2R+G formula in entry 540, headroom 30,
// handrail height 13, sphere/100mm 17/20, toughened glass 14, open riser 11).
// This batch adds the 6 genuinely novel angles that had 0-1 existing hits.

import { readFileSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";

const HERE = dirname(fileURLToPath(import.meta.url));
const FILE = resolve(HERE, "..", "..", "knowledge", "staircase.json");

const raw = JSON.parse(readFileSync(FILE, "utf8"));
const arr = Array.isArray(raw) ? raw : raw.entries || raw.faqs || Object.values(raw).find((v) => Array.isArray(v));

const baseTemplate = (id, question, answer, opts = {}) => ({
  id: `staircase-faq-${id}`,
  kind: "faq",
  question,
  answer,
  category_tag: "staircase",
  audience_level: opts.level ?? 2,
  classification: opts.cls ?? "safety_advice",
  safety_note: opts.safety ?? null,
  source_verified_at: null,
  fact_check_flag: null,
  diagram: null,
});

let nextId = 1923;
const add = (q, a, opts) => arr.push(baseTemplate(nextId++, q, a, opts));

add(
  "What is a 'climbable' balustrade and why is it a child-safety problem?",
  "A balustrade design that gives a small child hand and foot holds — most commonly horizontal rails or wide horizontal glass fixings — so the balustrade itself becomes a ladder to the drop it was supposed to prevent. UK Approved Doc K guidance and most European codes therefore favour vertical spindles with the 100mm-sphere rule, and warn against horizontal or ranch-rail balustrades in homes with young children.",
  { cls: "safety_advice", level: 2 },
);
add(
  "Why are horizontal-rail balustrades warned against on domestic staircases?",
  "Because the horizontal members function as a climbing ladder for a child. A design that looks clean and architectural to the customer is a fall risk to a two-year-old. Vertical spindles at maximum 99mm centres (so a 100mm sphere cannot pass) are the safer default. If a horizontal rail balustrade is specified, the customer should be explicitly informed of the climbing risk and it should be documented in the specification.",
  { cls: "safety_advice", level: 2 },
);
add(
  "What is an alternating-tread staircase and when is it used?",
  "A space-saving stair where each tread is cut on alternating left/right halves, so the user climbs one foot per tread rather than one foot per step-plane. Legal only for loft access to a single habitable room under Doc K in the UK, never as a main staircase. Steep, harder to descend, and unsuitable for elderly or young children — a compromise design accepted only where a full staircase will not fit.",
  { cls: "safety_advice", level: 2 },
);
add(
  "Should a staircase design consider a future stairlift installation?",
  "Yes if the household is planning to age in place or serves an elderly resident. Considerations: minimum straight-run width for stairlift rail (typically 720mm clear on standard flights, more for curved), a plan for electrical supply at the top and bottom of the flight, and the choice of newel and handrail on the wall side that stairlift brackets can attach to. Retrofitting a stairlift onto a stair that ignored this is possible but expensive.",
  { cls: "professional_recommendation", level: 2 },
);
add(
  "What accessibility considerations should a new staircase design include?",
  "Handrails on both sides of the flight (not just one), contrast nosings on the tread edges for visually-impaired users, no open risers if any user has visual impairment (open risers cause disorientation), consistent stair pitch (never a mix of shallow and steep in the same run), and adequate warm lighting at both landings and along the flight. Not all mandatory in domestic Doc K but all reduce fall risk for older users.",
  { cls: "safety_advice", level: 2 },
);
add(
  "Where do commercial staircase requirements differ from domestic Doc K?",
  "Commercial buildings under Approved Doc K Category 1 (public buildings) and Doc M (accessibility) have stricter dimensions: minimum going 250mm (vs 220mm domestic), maximum pitch 38° (vs 42°), handrails on both sides mandatory, contrast strips on nosings, and specific requirements for landing dimensions and stair widths based on occupancy. A staircase designed to domestic Doc K cannot legally be used in a public building — different envelope, different quote.",
  { cls: "safety_advice", level: 3 },
);

writeFileSync(FILE, JSON.stringify(arr, null, 2));
console.log(`Added entries up to staircase-faq-${nextId - 1}. Total entries: ${arr.length}`);
