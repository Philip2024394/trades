#!/usr/bin/env node
// Batch 20 staircase seed — IMAGE-SELECTION TRANSPARENCY.
// Nine entries anticipating exactly the objections a user will raise
// when Nex shows a luxury or lit reference image in response to a
// question about an ordinary staircase. Nex needs graceful, honest,
// adviser-toned answers to these objections — not defeatism ("sorry
// I don't have plain ones") or dismissal ("just an example, ignore
// the details").
//
// Also gives Nex the FACTUAL description of what a genuinely-average
// UK new-build staircase actually looks like — because right now the
// brain has 21 reference photos and every single one is aspirational.

import fs from "node:fs";
import path from "node:path";

const FILE = path.resolve("knowledge/staircase.json");
const raw = fs.readFileSync(FILE, "utf8");
const stamp = new Date().toISOString().replace(/[:.]/g, "-");
fs.writeFileSync(`${FILE}.bak.${stamp}`, raw, "utf8");

const doc = JSON.parse(raw);

const NEW = [
  { q: "Why are you showing me a luxury villa or hotel staircase when I asked about a normal home staircase?",
    a: "Fair question — I show the highest-value expression of a design idea so you can see every possible feature (materials, lighting, finish details) in one image. The design language and structural approach transfer to an ordinary home staircase; the premium finishes are optional. If you'd rather see a plain builder-standard example, just say — the same design works perfectly well without the marble floor, the chandelier, or the LED under every tread.",
    audience: 1, classification: "expert_observation" },

  { q: "Why do all your example staircase images have LED lighting on?",
    a: "Because integrated LED lighting is a genuine, popular staircase feature that a plain image would hide from you. Showing the lit version lets you see the option; you can absolutely have the same staircase without any LED and it'll still look great. If a lit example is misleading for your project (no budget for lighting, or you don't want it), let me know and I'll describe the same staircase without it. The lighting is a feature, not a requirement.",
    audience: 1, classification: "expert_observation" },

  { q: "I don't want a spiral or curved staircase — what does an AVERAGE UK home staircase actually look like?",
    a: "The typical UK new-build or renovation staircase is a straight flight or a simple half-turn with a small landing, softwood or oak treads, closed risers, plain painted or oak strings, turned or plain-square painted spindles at 100 mm centres, painted or oak newel posts at top and bottom, and an oak or painted handrail. Roughly 13-14 steps between floors, around 850-900 mm wide. That's what fits in most terraced, semi and small detached homes — perfectly good, safe, complies with Doc K, and does the job without drama. The luxury examples I show elsewhere are the top-end versions of the same basic design.",
    audience: 1, classification: "expert_observation" },

  { q: "Do I actually need LED lighting on my staircase?",
    a: "No — most UK homes have never had it and function perfectly well with a normal hall ceiling light and standard switches. LED under-tread lighting is a design feature and a night-time convenience, not a requirement. Skip it if the budget's tight, if you don't want the electrician's cable-planning at manufacture stage, or if the aesthetic doesn't call for it. A well-designed staircase looks good with or without integrated lighting.",
    audience: 1, classification: "professional_recommendation" },

  { q: "The staircase in the example image looks nothing like anything I can afford. Can you show me a realistic budget example?",
    a: "Absolutely — tell me your rough budget and the property type (terrace, semi, detached, new-build, renovation) and I'll describe what a good staircase looks like at that level. As a rough guide: a compliant painted-softwood staircase for a straightforward opening starts around a few thousand pounds installed; oak with turned spindles is meaningfully more; bespoke steel-and-glass or curved designs are into five figures. The examples I show are usually the design vocabulary rather than the price bracket — the same principles apply at every budget level.",
    audience: 1, classification: "professional_recommendation" },

  { q: "Can Nex show me a plain, ordinary staircase example instead of a designer one?",
    a: "Yes — just ask. I default to fully-featured examples because they show every option in one image, but plainer builder-standard staircases are equally valid and often exactly right for a house. If you can tell me your property type, budget range, and whether you want painted or natural timber, I'll describe (or find an image of) something realistic for your project rather than a magazine-cover version.",
    audience: 1, classification: "expert_observation" },

  { q: "What does a genuinely standard UK developer-built new-build house staircase look like?",
    a: "Usually: softwood carcass painted white for the strings and risers, oak or oak-veneered treads (or fully carpeted), plain-square or lightly-turned painted spindles at 100 mm centres, painted newel posts with simple caps, and an oak-topped painted handrail. Closed-riser straight flight or simple half-turn. No LED lighting, no glass, no bespoke features. Costs the developer a few hundred to a couple of thousand pounds per staircase. It's not exciting but it's compliant, safe, and stays out of the way — which is exactly what most volume house-builder specifications want it to do.",
    audience: 2, classification: "expert_observation" },

  { q: "Why doesn't Nex show more modest, everyday staircase photos?",
    a: "Honest answer: the reference photos currently in my brain are mostly aspirational examples chosen to demonstrate the full range of what a design language can support — every image shows premium materials or integrated lighting or a luxury setting. That's a genuine gap. Plainer builder-standard staircase images would be valuable and I'll add them as they become available. In the meantime, when the image doesn't match your project, tell me — I'll describe the same design in plainer terms so the underlying idea still transfers.",
    audience: 1, classification: "expert_observation" },

  { q: "How do I ask Nex to show me a design that matches MY budget rather than a magazine example?",
    a: "Just tell me the budget range and the property. 'I'm looking at a straight staircase for a 3-bed semi with a budget around £X including installation' gives me enough to focus on realistic options rather than showpieces. Similar for style: 'traditional painted with oak treads, no glass, no LED' or 'modern minimum-cost oak' both narrow the answer usefully. The more you can tell me about the real constraints of your project, the more useful my answer becomes — you don't have to accept the aspirational default.",
    audience: 1, classification: "professional_recommendation" }
];

// Add new entries
const nextN = doc.entries.reduce((a, e) => {
  const m = String(e.id ?? "").match(/-(\d+)$/);
  return m ? Math.max(a, parseInt(m[1], 10)) : a;
}, 0) + 1;

const norm = (q) => String(q ?? "").toLowerCase().replace(/[?.!,;:'"]/g, "").replace(/\s+/g, " ").trim();
const existing = new Set(doc.entries.map((e) => norm(e.question)));

let added = 0, skipped = 0;
for (const item of NEW) {
  if (existing.has(norm(item.q))) { skipped += 1; continue; }
  const id = `staircase-faq-${String(nextN + added).padStart(3, "0")}`;
  doc.entries.push({
    id, kind: "faq",
    question: item.q,
    answer: item.a,
    category_tag: "staircase",
    audience_level: item.audience ?? null,
    classification: item.classification ?? "industry_good_practice",
    safety_note: item.safety ?? null,
    source_verified_at: null,
    fact_check_flag: null
  });
  existing.add(norm(item.q));
  added += 1;
}

doc.count = doc.entries.length;
doc.generated_at = new Date().toISOString();
fs.writeFileSync(FILE, JSON.stringify(doc, null, 2) + "\n", "utf8");

console.log(`✅ Batch 20 (image-selection transparency): Added ${added} new entries (${skipped} skipped).`);
console.log(`   Total: ${doc.entries.length} entries`);
console.log(`   backup: knowledge/staircase.json.bak.${stamp}`);
