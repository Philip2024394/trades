#!/usr/bin/env node
// scripts/import-nex-education-batch-5.mjs
//
// Saves the single primary reference image for the "Alternating Tread
// Staircases (Space Saver Staircases)" article (Philip 2026-07-27).

import fs from "node:fs/promises";
import path from "node:path";

const API = "http://localhost:3008/api/admin/image-tagger/save";

const URL = "https://ik.imagekit.io/5vv5pw26q/ChatGPT%20Image%20Jul%2023,%202026,%2003_34_16%20PM.png";
const ARTICLE = "data/nex-customer-education/alternating-tread-space-saver-staircase.md";

const description = `IMAGE IDENTITY

Image Name:
Alternating Tread / Space Saver Staircase — Primary Reference

Category:
Customer Education > Staircase Types > Alternating Tread (Space Saver)

Sub Category:
Alternating tread staircase (also known as space saver · paddle staircase · paddle steps · alternating step · loft staircase in some applications)

Primary Style:
Aspirational architectural reference

Secondary Style:
Educational article primary image

Photographic Style:
Architectural interior photography

Recommendation Type:
EDUCATIONAL — primary reference for the "Alternating Tread Staircases (Space Saver Staircases)" article

Belongs In:
staircase_brain (staircase type reference)

Educational Article:
${ARTICLE}

IMAGE DESCRIPTION

An alternating tread / space saver staircase — the primary reference image for the paired education article. Each tread has a cut-away section so treads alternate from left to right as the user climbs (left foot on tread 1 · right foot on tread 2 · left foot on tread 3 · etc.). This alternating pattern allows a much steeper rise in a small footprint while still giving each foot a full landing surface.

Typical applications visible or implied: loft conversion · mezzanine floor · tiny home · garden office · home studio · cabin · storage loft · any space where a conventional staircase cannot fit.

Trade aliases: space saver staircase · alternating tread staircase · paddle staircase · paddle steps · alternating step staircase · loft staircase.

OBJECT DETECTION

PRIMARY OBJECTS
- Alternating tread staircase (treads with cut-away sections)
- Left/right alternation pattern visible tread-by-tread
- Handrail or safety rail (if included in the reference)
- Structural framework (timber · steel · mixed material)
- Compact footprint on the floor

SECONDARY OBJECTS
- Landing at the top
- Wall or opening the staircase serves
- Adjacent interior context

BACKGROUND OBJECTS
- Small-space interior environment (loft · mezzanine · compact home)

MATERIAL ANALYSIS

Primary Material:
Timber, steel, or mixed timber+steel (all three are common for alternating tread staircases)

CAMERA INFORMATION

Image Orientation:
Portrait

Camera Position:
Eye Level

View:
Full staircase reference view

Composition:
Feature composition showing the alternating tread pattern clearly

LIGHTING

Primary Lighting:
Warm interior ambient light

QUALITY

Realism:
Ultra photorealistic

Rendering:
Architectural interior visualisation

SETTING

Primary Setting:
Compact interior space (loft · mezzanine · tiny home · garden office)

AI REPRODUCTION RULES

MUST KEEP
- Recognisable alternating tread cut-away pattern (the whole point of the staircase type)
- Steeper pitch than a conventional staircase
- Compact footprint
- Safe access framing (handrail if present)

DO NOT CHANGE
- The alternating tread principle
- Educational purpose

ALLOWED MODIFICATIONS
Users may change:
- Material palette (timber · steel · mixed)
- Interior context (loft · mezzanine · garden office)
- Finish and colour
- Handrail style

MASTER AI PROMPT

Ultra photorealistic architectural interior render of an alternating tread / space saver staircase. Each tread has a cut-away section producing the signature left-right alternation as the user climbs — left foot on tread 1 · right foot on tread 2 · etc. Steeper pitch than a conventional staircase with a compact footprint on the floor. Compact interior context suitable for a loft conversion · mezzanine · tiny home · garden office · cabin or storage loft. Material can be timber · steel · or mixed timber+steel. Warm interior ambient light · premium architectural interior visualisation. Used as the primary reference for the NEX "Alternating Tread Staircases (Space Saver Staircases)" education article.`;

async function main() {
  console.log("Saving alternating tread / space saver primary reference…\n");
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
            "Primary reference · alternating tread / space saver staircase · used in education article",
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
