#!/usr/bin/env node
// Batch 15b — no new entries, just diagram attachments.
// Attaches Philip's three additional style-reference photos to the
// three Batch 15 style entries that were left without images:
//   - Rustic farmhouse / country cottage
//   - Coastal / Scandinavian
//   - Georgian / Victorian period home
// Also does a light one-line refinement to the rustic entry to
// acknowledge the black-iron-spindle variant shown in image D
// (a popular modern-farmhouse sub-style not covered in the
// Batch 15 wording).

import fs from "node:fs";
import path from "node:path";

const FILE = path.resolve("knowledge/staircase.json");
const raw = fs.readFileSync(FILE, "utf8");
const stamp = new Date().toISOString().replace(/[:.]/g, "-");
fs.writeFileSync(`${FILE}.bak.${stamp}`, raw, "utf8");

const doc = JSON.parse(raw);

// ─── Diagrams ─────────────────────────────────────────────
const DIAGRAM_D = {
  url:      "https://ik.imagekit.io/5vv5pw26q/ChatGPT%20Image%20Jul%2025,%202026,%2003_33_21%20PM.png",
  alt:      "Rustic farmhouse staircase with chunky dark stained oak newel posts, turned black wrought-iron spindles, warm oak treads, exposed timber ceiling beams, shiplap wall panelling, wide plank timber flooring, lantern-style pendant lights, small under-tread LED strips",
  title:    "Rustic farmhouse staircase with dark oak newels and black iron spindles",
  caption:  "The modern farmhouse variant of a rustic staircase: chunky dark-stained oak newel posts, decoratively-turned black wrought-iron spindles (instead of turned timber ones), warm oak treads, and honest character detailing that matches the exposed timber beams and shiplap walls around it.",
  labels:   [],
  footnote: "Traditional rustic staircases usually pair oak with either turned oak spindles or square-section timber ones — the black iron spindle variant shown here is the modern-farmhouse look that's become popular in the last decade. Both are legitimate; the black iron adds an industrial-craft edge that suits homes with exposed structural steelwork or metal-framed windows."
};

const DIAGRAM_E = {
  url:      "https://ik.imagekit.io/5vv5pw26q/ChatGPT%20Image%20Jul%2025,%202026,%2003_34_03%20PM.png",
  alt:      "Coastal or English cottage staircase fully painted in cream or white with traditional turned painted spindles, oak handrail on top, jute or hessian stair runner along the treads, warm cream walls, sisal rug at the base, botanical prints and natural-timber chair with knit throw, window with garden view",
  title:    "Coastal/cottage staircase — painted turned spindles with oak handrail",
  caption:  "The classic English coastal-cottage look: fully painted cream/white staircase with traditional turned spindles left painted rather than natural, contrasted with a warm oak handrail. A jute or sisal stair runner adds texture and protects the tread. Reads as light, gentle and unshowy — right for cottages, coastal homes and softly-decorated country properties.",
  labels:   [],
  footnote: "This is the alternative to a fully pale-timber Scandinavian staircase — same coastal-light palette but with traditional turned joinery detail instead of Scandinavian minimalism. The oak handrail is what stops the all-white feeling clinical; the jute runner adds warmth underfoot and cuts down on tread wear."
};

const DIAGRAM_F = {
  url:      "https://ik.imagekit.io/5vv5pw26q/ChatGPT%20Image%20Jul%2025,%202026,%2003_35_02%20PM.png",
  alt:      "Classic traditional oak staircase in a period-style home with turned oak spindles, turned oak newel posts with ball finials, warm honey-toned oak treads and handrails, gallery landing above with matching turned oak balustrade, French doors visible to another room, painted period furniture, stone tile flooring, botanical and map prints",
  title:    "Classic traditional oak staircase with turned spindles and ball finials",
  caption:  "The archetypal traditional oak staircase: honey-toned natural oak throughout, turned spindles at regular spacing, chunky turned newel posts topped with classic ball finials, moulded handrails, and a matching gallery-landing balustrade above. Sits perfectly in Georgian, Victorian and Edwardian homes and equally well in a traditional-styled new-build.",
  labels:   [],
  footnote: "This is what most people picture when they hear 'proper oak staircase'. The turned newel with ball finial is a period detail that ages beautifully — every generation of homeowner treats these as heirloom joinery rather than replaceable fittings. Under-tread LED strips are the only concession to modern detailing on an otherwise wholly traditional design."
};

const norm = (q) => String(q ?? "").toLowerCase().replace(/[?.!,;:'"]/g, "").replace(/\s+/g, " ").trim();

const ATTACHMENTS = [
  { q: "What staircase style suits a rustic farmhouse or country cottage?",     diagram: DIAGRAM_D },
  { q: "What staircase style suits a coastal or Scandinavian-inspired home?",   diagram: DIAGRAM_E },
  { q: "What staircase style suits a Georgian, Victorian or Edwardian period home?", diagram: DIAGRAM_F }
];

let attached = 0;
const notFound = [];
for (const a of ATTACHMENTS) {
  const target = doc.entries.find(e => norm(e.question) === norm(a.q));
  if (!target) { notFound.push(a.q); continue; }
  target.diagram = a.diagram;
  attached += 1;
  console.log(`  ✓ attached to ${target.id}: ${target.question}`);
}
if (notFound.length) {
  console.warn(`⚠ Not found: ${notFound.join(", ")}`);
}

// ─── Light refinement: acknowledge black-iron-spindle variant in rustic entry ─
const rustic = doc.entries.find(e => norm(e.question) === norm("What staircase style suits a rustic farmhouse or country cottage?"));
if (rustic) {
  rustic.answer = "Character-grade oak with visible knots and grain, exposed cut-string on the show side, chunky newel posts, and either an oiled natural finish or a soft-painted string (heritage green, grey, off-white) with natural-timber treads. Spindles can go two ways depending on the era you're aiming for: traditional TURNED OAK for a classic country cottage feel, or turned BLACK WROUGHT-IRON for the modern farmhouse look (chunky dark oak newels + black iron spindles is one of the strongest rustic-industrial combinations of the last decade). Avoid glossy modern lacquers and glass balustrades — both feel forced in a stone-and-beams setting. Character oak on a rustic staircase is one place where the knots and imperfections ARE the design.";
  console.log(`  ✎ refined rustic entry to acknowledge black-iron-spindle variant`);
}

doc.generated_at = new Date().toISOString();
fs.writeFileSync(FILE, JSON.stringify(doc, null, 2) + "\n", "utf8");

console.log(`\n✅ Batch 15b:`);
console.log(`   ${attached} diagram attachments to previously-imageless Batch 15 style entries`);
console.log(`   1 answer refined (rustic entry — black-iron-spindle variant acknowledged)`);
console.log(`   total: ${doc.entries.length} entries (unchanged)`);
console.log(`   backup: knowledge/staircase.json.bak.${stamp}`);
