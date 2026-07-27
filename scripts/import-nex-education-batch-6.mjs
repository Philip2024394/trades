#!/usr/bin/env node
// scripts/import-nex-education-batch-6.mjs
//
// Saves the single primary reference image for the "Extending the
// Starting Steps of an L-Shaped Staircase" article (Philip 2026-07-27).

import fs from "node:fs/promises";
import path from "node:path";

const API = "http://localhost:3008/api/admin/image-tagger/save";

const URL = "https://ik.imagekit.io/5vv5pw26q/ChatGPT%20Image%20Jul%2023,%202026,%2002_05_55%20PM.png";
const ARTICLE = "data/nex-customer-education/extending-starting-steps-l-shaped-staircase.md";

const description = `IMAGE IDENTITY

Image Name:
L-Shaped Staircase with Extended Starting Steps — Primary Reference

Category:
Customer Education > Staircase Design Techniques > Extended Starting Steps

Sub Category:
L-shaped staircase where the lower section is restricted by a wall or narrow hallway, and the first one/two/three steps are extended beyond the wall line to project into the room

Primary Style:
Aspirational architectural reference

Secondary Style:
Educational article primary image

Photographic Style:
Architectural interior photography

Recommendation Type:
EDUCATIONAL — primary reference for the "Extending the Starting Steps of an L-Shaped Staircase" article

Belongs In:
staircase_brain (staircase design techniques)

Educational Article:
${ARTICLE}

IMAGE DESCRIPTION

An L-shaped timber staircase in which the lower section's starting step (or first few steps) extends beyond the face of the wall, projecting into the room rather than finishing flush with the wall line. Demonstrates the NEX design solution for narrow hallways / restricted-lower-section L-shapes: extending the first one, two, or even three steps to gain valuable extra floor space exactly where people begin using the staircase, while creating an elegant architectural feature.

Common design details that pair well with extended starting steps: wider statement treads · bullnose or curved starting steps · feature newel posts · decorative balustrades · glass panels · timber or metal detailing · LED feature lighting.

Especially useful in: narrow entrance halls · hallways with limited depth · renovation projects · Victorian and Edwardian homes · modern extensions · any home where structural walls restrict the staircase layout.

OBJECT DETECTION

PRIMARY OBJECTS
- L-shaped staircase (change-of-direction layout)
- Extended starting step(s) projecting beyond the wall line
- Newel post at the base
- Handrail
- Balustrade
- Treads and risers
- Adjacent wall (restricting the lower section)

SECONDARY OBJECTS
- Landing at the change of direction
- Skirting and trim
- Floor covering

BACKGROUND OBJECTS
- Entrance hallway
- Adjacent doorways / rooms

MATERIAL ANALYSIS

Primary Material:
Timber staircase (species varies — the design technique is the subject, not the material)

CAMERA INFORMATION

Image Orientation:
Portrait

Camera Position:
Eye Level

View:
Full staircase reference view showing extended starting steps clearly

Composition:
Feature composition emphasising the projection of the starting steps into the room

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
Residential entrance hallway with an L-shaped staircase and constrained lower section

AI REPRODUCTION RULES

MUST KEEP
- L-shaped staircase layout
- Starting steps clearly projecting beyond the wall line (the whole point of the article)
- Visible design detail on the extended starting steps (bullnose or wider tread reads best)
- Sense that the design gains space where a flush-to-wall alternative would feel tight

DO NOT CHANGE
- The extended-starting-step design principle
- Educational purpose

ALLOWED MODIFICATIONS
Users may change:
- Timber species and finish
- Balustrade style (timber · metal · glass)
- Newel post design
- Hallway proportions
- Lighting treatment

MASTER AI PROMPT

Ultra photorealistic architectural interior render of an L-shaped timber staircase where the lower section's starting step (or first few steps) extends beyond the face of the wall, projecting into the entrance hallway rather than finishing flush with the wall line. The extended starting steps read as a deliberate architectural feature — often paired with wider statement treads · bullnose or curved starting steps · a feature newel post · decorative or glass balustrade · optional LED feature lighting. Warm interior ambient light · premium architectural interior visualisation. Used as the primary reference for the NEX "Extending the Starting Steps of an L-Shaped Staircase" education article.`;

async function main() {
  console.log("Saving L-shaped extended starting step primary reference…\n");
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
            "Primary reference · L-shaped staircase with extended starting steps · used in education article",
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
