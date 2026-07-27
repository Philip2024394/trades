#!/usr/bin/env node
// scripts/import-nex-education-batch-16.mjs
//
// Saves the primary reference (exploded-assembly render) for the
// "Floating Stairs – Exploded Assembly, Load Design, and UK Building
// Regulations" article (Philip 2026-07-27).
//
// Companion to batch 15's floating-stairs-hidden-steel-engineering
// primary reference. Same subject family, deeper technical angle.

import fs from "node:fs/promises";
import path from "node:path";

const API = "http://localhost:3008/api/admin/image-tagger/save";

const URL =
  "https://ik.imagekit.io/5vv5pw26q/ChatGPT%20Image%20Jul%2027,%202026,%2008_04_07%20PM.png";
const ARTICLE =
  "data/nex-customer-education/floating-stairs-exploded-assembly-and-regulations.md";

const description = `IMAGE IDENTITY

Image Name:
Floating Staircase — Exploded Assembly (steel stringer · tread support · hollow oak tread · spacer bolts)

Category:
Customer Education > Staircase Types > Floating / Cantilever > Assembly + Regulations

Sub Category:
Exploded assembly reference showing the four load-bearing layers of a modern cantilever staircase: (1) steel stringer plate 10-15 mm bolted or welded to building structure · (2) welded steel tread support projecting from stringer (RHS · box section · laser-cut folded steel · fully welded fabrication) · (3) hollow oak tread box sliding over the steel support and locked with screws / bolts / threaded inserts / epoxy · (4) spacer bolts at the tread front locating and clamping the oak to the steel without carrying vertical load.

Primary Style:
Technical architectural render / exploded-assembly diagram

Secondary Style:
Educational article primary image

Photographic Style:
Architectural detail visualisation (may be render or exploded diagram)

Recommendation Type:
EDUCATIONAL — primary reference for the "Floating Stairs – Exploded Assembly, Load Design, and UK Building Regulations" article

Belongs In:
staircase_brain (INTERNAL staircase types · floating / cantilever engineering + regulations)

Educational Article:
${ARTICLE}

Companion Article:
data/nex-customer-education/floating-stairs-hidden-steel-engineering.md (customer-friendly overview of the four hidden-steel systems)

IMAGE DESCRIPTION

Exploded assembly of a modern cantilever (floating) staircase. The render shows the four load-bearing layers separated so the viewer can see how the timber and steel combine:

1. STEEL STRINGER — the large triangular structural steel plate (typically 10-15 mm, sometimes thicker) bolted or welded to the main building structure. This is the backbone that every tread transfers load back into.
2. STEEL TREAD SUPPORT — welded steel support projecting from the stringer. Rectangular hollow section, box section, laser-cut folded steel, or fully welded fabrication. Designed to resist vertical bending, twisting, deflection, and vibration.
3. HOLLOW OAK TREAD — a box construction with an internal cavity that slides over the steel support. Locked into position with screws, hidden bolts, threaded inserts, or epoxy. Nothing is visible from outside once assembled.
4. SPACER BOLTS — the two front bolts that locate and clamp the oak to the steel but do NOT carry vertical load. Vertical load is carried underneath by the steel support.

Structural load path illustrated: person → oak tread → steel support → steel stringer → wall → building structure. The oak spreads pressure over the steel; the steel carries every kilogram back to the building.

Design load context: UK domestic floating stairs typically designed around 2.0 kN/m² floor loading + 1.5-2.0 kN concentrated tread load with safety factors. A single tread can comfortably support 250-400 kg static load before the steel approaches its design limits.

Building Regulations context: UK Approved Document K (falling / collision / impact) + Approved Document A (structural) apply regardless of the floating appearance. 100 mm sphere rule between treads. Max 220 mm rise · min 220 mm going · pitch ≤ 42° domestic. Structural steelwork designed to relevant Eurocodes.

OBJECT DETECTION

PRIMARY OBJECTS
- Steel stringer (large triangular structural plate)
- Steel tread support (welded cantilever beam)
- Hollow oak tread (box construction with internal cavity)
- Spacer bolts (front-face locating bolts)
- Fixings (bolts / screws / threaded inserts)

SECONDARY OBJECTS
- Wall fixing points on the stringer
- Isolation tape / neoprene between oak and steel (if visible — controls timber shrinkage squeak)
- Powder-coating finish on the steel (if visible)

BACKGROUND OBJECTS
- Neutral studio / technical-render background

MATERIAL ANALYSIS

Primary Material:
Structural steel plate (10-15 mm typical for stringer) + welded steel tread supports (RHS · box section · laser-cut folded · fabricated) + oak hollow tread box

Finish Character:
Steel: powder-coated · often black matte or grey structural. Oak: furniture-grade interior finish (natural lacquered typical for luxury floating designs).

CAMERA INFORMATION

Image Orientation:
Landscape or portrait (exploded assembly view)

Camera Position:
Technical isometric or perspective

View:
Exploded assembly reference view

Composition:
Technical composition separating the layers so the load path can be read

LIGHTING

Primary Lighting:
Neutral technical lighting revealing all four layers clearly

QUALITY

Realism:
Ultra photorealistic technical render OR clean CAD-style assembly diagram

Rendering:
Architectural technical visualisation

SETTING

Primary Setting:
Technical reference render — appropriate for engineering documentation and buyer education

AI REPRODUCTION RULES

MUST KEEP
- Four-layer exploded assembly clearly readable (stringer · steel support · oak box · spacer bolts)
- Steel-does-the-engineering framing (oak is finish, not structure)
- Load path visible or implied (steel supports project from stringer under the treads)
- Hollow oak tread box construction

DO NOT CHANGE
- The exploded / assembly-diagram nature
- Educational purpose
- Internal cantilever staircase framing

ALLOWED MODIFICATIONS
Users may change:
- Oak finish (natural lacquered · oiled · slightly stained)
- Steel finish (powder-coated black · grey · natural mill)
- Angle of the exploded view
- Number of treads shown in the exploded diagram

MASTER AI PROMPT

Ultra photorealistic technical architectural render of an EXPLODED ASSEMBLY of a modern cantilever (floating) staircase. Four layers separated so the load path reads clearly: (1) large triangular structural steel stringer plate 10-15 mm bolted or welded into the building structure · (2) welded steel tread support projecting from the stringer (rectangular hollow section · box section · laser-cut folded steel · fully welded fabrication) · (3) hollow oak tread box construction with internal cavity that slides over the steel support · (4) spacer bolts at the front face of the tread that locate and clamp the oak to the steel without carrying vertical load. Structural load path: person → oak tread → steel support → steel stringer → wall → building structure. Steel does all the engineering; oak is the finished surface. Neutral technical lighting · clean composition allowing all four layers to be identified. Used as the primary reference for the NEX "Floating Stairs – Exploded Assembly, Load Design, and UK Building Regulations" education article.`;

async function main() {
  console.log("Saving floating stairs exploded assembly reference…\n");
  const res = await fetch(API, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      images: {
        [URL]: {
          description,
          source: "ai_generated",
          created_by: "philip",
          notes:
            "Primary reference · floating staircase exploded assembly · steel stringer + tread support + hollow oak tread + spacer bolts · companion to floating-stairs-hidden-steel-engineering.md",
        },
      },
    }),
  });
  const data = await res.json();
  console.log(data.ok ? "SAVED" : "ERROR: " + data.error);

  const manifestPath = path.join(process.cwd(), "data", "nex-image-manifest.json");
  const manifest = JSON.parse(await fs.readFile(manifestPath, "utf8"));
  const row = manifest.images[URL];
  if (row) {
    console.log("");
    console.log("ROW STATE:");
    console.log("  score:", row.master_image_score?.master_score, "/ 100");
    console.log("  band:", row.knowledge_band_label);
    console.log("  brain:", row.primary_brain);
    console.log("  collections:", (row.collection_memberships || []).length);
  }
}

main().catch((e) => { console.error(e); process.exit(1); });
