// Universal Q&A · Geometry batch · Philip 2026-08-02.
// Adds rise · going · angle · pitch · headroom · site measurement principles.
// Every answer verbatim from Philip's Geometry Brain expansion (Parts 10-13).
// Universal because these principles apply to EVERY staircase type.

import { readFileSync, writeFileSync } from "node:fs";

const PATH = "data/nex-universal-qa.json";
const d = JSON.parse(readFileSync(PATH, "utf8"));

const GEOMETRY_QA = [
  {
    q: "How is a staircase angle calculated?",
    a: "The staircase angle (also called pitch) is calculated from the relationship between rise (the vertical height climbed) and going (the horizontal distance travelled). The formula is Angle = tan⁻¹(Rise ÷ Going). For example, a floor height of 3000mm over a horizontal run of 3600mm gives 3000 ÷ 3600 = 0.833, and tan⁻¹(0.833) ≈ 40°.",
  },
  {
    q: "What is stair rise?",
    a: "Rise is the vertical height of each step, or the total vertical distance the staircase must climb from finished floor to finished floor. A comfortable staircase balances riser height with tread depth and stair angle.",
  },
  {
    q: "What is stair going?",
    a: "Going is the horizontal depth where the foot lands on each step, or the total horizontal distance the staircase travels. Rise and going together define the staircase angle.",
  },
  {
    q: "What is stair pitch?",
    a: "Stair pitch is the angle of the staircase — the slope between the horizontal floor and the sloping stair line. It is created by the relationship between rise and going: steeper pitch means a more compact staircase with more effort to climb; shallower pitch means a more comfortable staircase that needs more floor space.",
  },
  {
    q: "What is a typical residential staircase angle?",
    a: "A standard residential staircase is typically in the range of approximately 35°–42°, which feels comfortable and is common in homes. Very steep stairs (around 45° and above) feel compact and almost ladder-like. Gentle stairs (approximately 30°–35°) feel luxurious but need more space. Very shallow stairs (below 30°) are ramp-like and take a large footprint. Final acceptable pitch depends on local building regulations.",
  },
  {
    q: "Can Nex tell me the exact angle of a staircase from a photo?",
    a: "No. A photo alone cannot give exact degrees unless there is a known reference. Nex will not say a staircase is exactly a specific angle without measurements. Nex can estimate whether the pitch appears steep, standard or gentle from the visible relationship between tread depth and riser height, but exact figures require site measurements.",
  },
  {
    q: "Do all staircase types use the same geometry?",
    a: "Yes. All staircases — straight, quarter turn, half turn, spiral, helical, open riser, floating, steel, timber, glass, concrete — use the same underlying geometry: rise, going and pitch. The shape and construction change; the mathematical relationship does not. The staircase type packages the geometry differently, but the rise-going-pitch principle is universal.",
  },
  {
    q: "Do curved staircases use different rise and going calculations?",
    a: "No. The shape changes, but the principles remain the same. A curved staircase still needs the correct vertical rise between floors and the correct walking-line going to be comfortable and safe. For curved stairs the going is measured along the walking line, not simply the inside edge — the tread depth at the centre of the walking path is what controls comfort." ,
  },
  {
    q: "What is staircase headroom?",
    a: "Headroom is the vertical clear distance measured above the staircase walking line — from the tread nosing (pitch line) upward to the lowest obstruction (ceiling · floor edge · beam · bulkhead). Headroom follows the person walking up the staircase, not the staircase itself, so the measurement is taken along the route of travel." ,
  },
  {
    q: "How is staircase headroom measured?",
    a: "Establish the staircase geometry (number of risers · tread going · pitch angle · position), identify the walking line (normally the centre of a straight staircase), then measure vertically upward from the pitch line to any obstruction above at every point along the staircase. The staircase can have good headroom at the bottom and fail higher up, so the whole path must be checked.",
  },
  {
    q: "Why does headroom matter?",
    a: "Because a staircase is not only about fitting steps between two floors — it must allow a person to walk up without their head contacting ceilings, beams, floor structures, bulkheads or architectural features. Headroom is the invisible connection between staircase geometry and architectural structure.",
  },
  {
    q: "Where do headroom problems usually appear?",
    a: "Most commonly near the top of the staircase — the person has risen the maximum amount while still under the floor structure. Other common trouble spots are under a beam, under the floor opening edge, and at landings where the person changes direction. The 'headroom control point' is the location where the staircase comes closest to the structure above.",
  },
  {
    q: "Why do headroom problems happen?",
    a: "Common causes: the stair opening is too small (the floor opening does not allow enough space); the stair angle is too steep (the staircase rises faster under the floor); the stair position has moved during construction; the building has changed (thicker flooring · dropped ceilings · added beams · new insulation).",
  },
  {
    q: "How can headroom be improved?",
    a: "Possible solutions include increasing the opening length (allows the staircase to travel further before reaching the upper floor), reducing the staircase angle (creates a shallower climb), adjusting the tread and riser relationship (changes geometry), or modifying the building structure (moving a beam · adjusting the opening). Any solution must protect comfort, safety and structure. Never make steps uneven, excessively increase riser height, or reduce tread depth too much — these create trip risks and unsafe walking.",
  },
  {
    q: "What information does a staircase manufacturer need before making a staircase?",
    a: "Floor-to-floor height, number of risers, riser height, tread going, total run, stair width, opening size, headroom, landing position, wall positions, and finished floor thicknesses. A photo provides style and design inspiration — a site survey provides the dimensions, structure and installation reality needed for manufacturing.",
  },
  {
    q: "Can a staircase be manufactured from a picture alone?",
    a: "No. A staircase is not manufactured from a picture alone. A picture provides style, design and inspiration. A site survey provides the dimensions, structure and installation reality. Rise, going, opening size, headroom, wall positions and finished floor levels must all be measured on site before the staircase can be manufactured.",
  },
  {
    q: "Do finished floor levels affect staircase calculations?",
    a: "Yes. Stair calculations begin and end at the FINAL finished floor levels — not the concrete slab or unfinished floor. Adding a thick carpet, underlay, timber flooring or tiles changes the finished level, which changes the first riser, last riser and headroom. Correct measurements must be based on the final finished surfaces.",
  },
  {
    q: "What is a stair trimmer?",
    a: "A trimmer is the structural member around a staircase opening — it supports the landing edge, the staircase connection, and the floor opening. The staircase does not exist separately from the building; it transfers loads into the floor structure through the trimmer. When a newel post is 'cut down' over the landing edge, the trimmer is the structural element that provides the strong fixing." ,
  },
];

const existingByQ = new Map(d.qa.map((x, i) => [x.q.toLowerCase().trim(), i]));
let added = 0, updated = 0;

for (const item of GEOMETRY_QA) {
  const key = item.q.toLowerCase().trim();
  if (existingByQ.has(key)) { d.qa[existingByQ.get(key)] = item; updated++; }
  else                      { d.qa.push(item); added++; }
}

d.updated_at = new Date().toISOString();
writeFileSync(PATH, JSON.stringify(d, null, 2), "utf8");

const authored = d.qa.filter((x) => x.a && x.a.trim().length > 0).length;
console.log("Universal Q&A · geometry batch");
console.log("  added:   ", added);
console.log("  updated: ", updated);
console.log("  total Qs:", d.qa.length);
console.log("  authored:", authored);
