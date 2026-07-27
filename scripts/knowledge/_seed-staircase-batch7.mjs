#!/usr/bin/env node
// Batch 7 staircase seed — WHOLE-STAIRCASE MATERIAL CHOICE for new builds.
// Full timber vs mixed steel-and-timber (steel frame + timber treads) vs
// full metal. Different from Batch 4 (which was about timber SPECIES —
// oak vs ash vs walnut vs pine).
//
// Source: Philip's own authored expert commentary (2026-07-25). Encodes
// his professional ranking (steel+timber first for most new builds, full
// timber second for traditional homes, full metal third for industrial
// interiors) as Nex opinion — framed as "many joiners feel" or "the
// common professional view" rather than absolute claims.
//
// Voice: Nex workshop-warm, direct-you, contractions, UK context.

import fs from "node:fs";
import path from "node:path";

const FILE = path.resolve("knowledge/staircase.json");
if (!fs.existsSync(FILE)) { console.error("missing knowledge/staircase.json"); process.exit(1); }

const NEW = [
  { q: "For a new build, should I choose a full wood staircase, a mixed steel-and-timber staircase, or a full metal one?",
    a: "There's no wrong answer — they create very different feelings. FULL WOOD suits traditional and period-style homes where warmth and craftsmanship are the priority. STEEL FRAME WITH TIMBER TREADS is the strongest all-round pick for most modern UK new builds — it combines the strength and clean lines of steel with the warmth of timber and works brilliantly with glass balustrading. FULL METAL is a specialist choice for genuinely industrial-styled interiors. Match the staircase to the house you're building, not to what's trending.",
    audience: 2, classification: "professional_recommendation" },

  { q: "When does a full wood staircase suit a new build?",
    a: "When the house has a traditional, period or country style — Georgian, Victorian, cottage, farmhouse, or any 'warm luxury' interior where natural materials do the talking. Full timber also works when the staircase is meant to blend into the joinery of the house (matching internal doors, skirting, wooden floors) rather than stand out as a modern feature. If the hallway's on show and you want quiet, warm, timeless — go full wood.",
    audience: 2, classification: "expert_observation" },

  { q: "What are the main advantages of a full wood staircase?",
    a: "Natural warmth that manufactured materials can't fake, a timeless appearance that stays right for the life of the house, and the fact that quality hardwood can be sanded and refinished decades later — a 40-year-old oak staircase can look brand-new after a proper refinish. It matches the rest of the natural timber in the house (floors, doors, joinery), and it gives the whole hallway a premium furniture-like feel that steel never quite achieves.",
    audience: 2, classification: "expert_observation" },

  { q: "What are the practical considerations of a full wood staircase?",
    a: "Higher cost for quality hardwood (oak/ash/walnut are noticeably more expensive than painted softwood), natural timber movement with humidity (so a properly-designed staircase, not a bargain one), and you're relying entirely on the finish to protect it from foot traffic — the wrong lacquer wears through on the walking line within a couple of years. Get the timber grade, finish spec and installation right and it'll outlast most other things in the house.",
    audience: 2, classification: "expert_observation" },

  { q: "What is a steel-frame-plus-timber-tread staircase?",
    a: "A staircase built with a structural steel frame — usually a central spine or two side stringers — that carries solid timber treads on top, often paired with glass panels or slim black balusters for the balustrade. It's one of the most popular designs in contemporary UK new builds because it combines the clean architectural strength of steel with the warmth of timber. Common combinations: black steel + oak treads, powder-coated steel + walnut, painted steel + ash.",
    audience: 2, classification: "expert_observation" },

  { q: "What are the advantages of a steel-frame staircase with timber treads?",
    a: "Modern architectural look that suits open-plan spaces and large entrance halls; genuinely strong structure (steel does the load work, so treads can be thinner and more elegant); enables floating and cantilevered designs that pure-timber construction can't easily achieve; pairs beautifully with glass balustrading; lets natural light through the staircase rather than blocking it. You keep the warmth of wood exactly where you touch it (treads and handrail) while the structure gets out of the way.",
    audience: 2, classification: "expert_observation" },

  { q: "What are the considerations of a mixed steel-and-timber staircase?",
    a: "Metal fabrication demands precision — the frame's welded and machined off-site to your exact drawing, so there's less on-site adjustment room than a pure-timber staircase. Repairs later can need specialist welding or powder-coating, not just a joiner. Most importantly, structural planning has to happen EARLY in the build: the fixing points into floor structure, wall or landing beam often need coordination with the structural engineer BEFORE first-fix. Not a decision to leave to the plastering stage.",
    audience: 3, classification: "professional_recommendation" },

  { q: "When does a full metal staircase suit a new build?",
    a: "Genuinely industrial-styled interiors — warehouse conversions, loft-style apartments, some commercial spaces, or homes where the whole design language is exposed steel, concrete, glass and black finishes. A full metal staircase in the middle of a traditional country cottage looks wrong; the same staircase in a converted 19th-century warehouse looks perfect. Match to the house.",
    audience: 2, classification: "expert_observation" },

  { q: "What are the drawbacks of a full metal staircase in a home?",
    a: "Can feel visually cold in a family home where the rest of the interior isn't industrial. Footfall noise is meaningfully higher than timber — you'll hear every step — which often needs acoustic underlay or fitted timber inserts to control. Less traditional warmth. And unlike timber, metal doesn't age or develop character; it just wears. Great for the right interior; wrong for most family homes.",
    audience: 2, classification: "expert_observation" },

  { q: "What material combination gives the best all-round new-build staircase?",
    a: "For most modern UK new builds, the strongest all-round pick is a powder-coated or black-painted steel frame + solid oak (or walnut) treads + a matching oak handrail + glass panels or slim black balusters. You get the strength and clean lines of steel, the warmth and premium feel of timber, and a lightness the whole staircase inherits from the metal structure and glass. It reads as 'expensive designer home' without feeling cold, and it works with almost every modern interior scheme.",
    audience: 2, classification: "professional_recommendation" },

  { q: "Does it matter whether my staircase is visible from the front door when choosing materials?",
    a: "Yes — a lot. If the staircase is the first feature people see when they walk in, it's worth investing more because it sets the tone for the whole house. Focal-point staircases in prominent hallways are where a mixed steel-and-timber design with glass balustrading really earns its keep. If the staircase is tucked away out of sight from the entrance, budget can shift towards other priorities without hurting the finished look of the home.",
    audience: 2, classification: "expert_observation" },

  { q: "How does having young children affect the staircase material choice?",
    a: "It affects the balustrade choice more than the tread material. Glass panels look stunning but show every fingerprint — a family with young kids will clean them a lot, and thicker glass shows less. Slim metal balusters at compliant 100 mm spacing work well and are easier to keep clean than turned timber spindles. Handrail comfort matters: a warm timber handrail is nicer for small hands than cold steel. Structurally, all three material approaches are equally safe when built to Approved Doc K — the choice is about upkeep and comfort, not safety.",
    audience: 1, classification: "safety_advice" }
];

// ─── Load + append with dedup ─────────────────────────────────
const doc = JSON.parse(fs.readFileSync(FILE, "utf8"));
if (!Array.isArray(doc.entries)) doc.entries = [];

const nextN = doc.entries.reduce((a, e) => {
  const m = String(e.id ?? "").match(/-(\d+)$/);
  return m ? Math.max(a, parseInt(m[1], 10)) : a;
}, 0) + 1;

const norm = (q) => String(q ?? "").toLowerCase().replace(/[?.!,;:'"]/g, "").replace(/\s+/g, " ").trim();
const existing = new Set(doc.entries.map((e) => norm(e.question)));

let added = 0, skipped = 0;
for (const item of NEW) {
  if (existing.has(norm(item.q))) { skipped += 1; continue; }
  const entry = {
    id: `staircase-faq-${String(nextN + added).padStart(3, "0")}`,
    kind: "faq",
    question: item.q,
    answer: item.a,
    category_tag: "staircase",
    audience_level: item.audience ?? null,
    classification: item.classification ?? "industry_good_practice",
    safety_note: item.safety ?? null,
    source_verified_at: null,
    fact_check_flag: null
  };
  doc.entries.push(entry);
  existing.add(norm(item.q));
  added += 1;
}
doc.count = doc.entries.length;
doc.generated_at = new Date().toISOString();
fs.writeFileSync(FILE, JSON.stringify(doc, null, 2) + "\n", "utf8");
console.log(`✅ Batch 7 (material choice — wood vs steel+timber vs metal): Added ${added} new entries (${skipped} skipped). Total: ${doc.entries.length}`);
