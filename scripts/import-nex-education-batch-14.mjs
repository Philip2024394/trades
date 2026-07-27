#!/usr/bin/env node
// scripts/import-nex-education-batch-14.mjs
//
// Saves 3 images for the internal-staircase woodworm education cluster
// (Philip 2026-07-27):
//   - 2 images for "Woodworm Around the World – Where It's Found and
//     How It Survives" (primary + secondary references)
//   - 1 image for "What to Do If You See Woodworm Holes" (primary)
//
// All INTERNAL context → staircase_brain. Descriptions use the classifier
// lessons from batch 13:
//   - Positive-only language (no "not garden", "not outdoor")
//   - Use "types" / "varieties" instead of "species" (species regex is
//     for wood-sample material library)
//   - Include explicit staircase component words (tread, riser, stringer,
//     newel, handrail) so staircase_brain wins decisively vs any
//     structural section headers that fire other brains

import fs from "node:fs/promises";
import path from "node:path";

const API = "http://localhost:3008/api/admin/image-tagger/save";

const WORLDWIDE_A =
  "https://ik.imagekit.io/5vv5pw26q/ChatGPT%20Image%20Jul%2027,%202026,%2007_42_54%20PM.png";
const WORLDWIDE_B =
  "https://ik.imagekit.io/5vv5pw26q/Untitledasdasdfdsfdfsdasdasdads.png";
const HOLES_REFERENCE =
  "https://ik.imagekit.io/5vv5pw26q/Untitledasdasdfdsfdfsdasdasdadsasdasdfsdf.png";

const ART_WORLDWIDE = "data/nex-customer-education/woodworm-worldwide-and-biology.md";
const ART_HOLES     = "data/nex-customer-education/what-to-do-if-you-see-woodworm-holes.md";

function commonWoodwormDescription(role, article, pairedWith) {
  return `IMAGE IDENTITY

Image Name:
Woodworm Reference — ${role}

Category:
Customer Education > Construction Knowledge > Timber Character > Woodworm

Sub Category:
Woodworm / wood-boring beetle education reference for internal hardwood staircase context (oak · walnut · ash · mahogany · teak · pine typical). Part of the internal woodworm sub-cluster of NEX customer education.

Primary Style:
Documentary construction / timber-detail reference

Secondary Style:
Educational article reference

Photographic Style:
Timber close-up / infographic

Recommendation Type:
EDUCATIONAL — reference for the paired woodworm education article

Belongs In:
staircase_brain (INTERNAL hardwood staircase family · woodworm education)

Educational Article:
${article}

Paired With:
${pairedWith}

IMAGE DESCRIPTION

Reference image for the internal-staircase woodworm education cluster. Applies to hardwood staircase timber (oak · walnut · ash · mahogany · teak) and softwood staircase timber (pine typical). Supports the article that explains woodworm biology, the beetle life cycle, and the difference between old inactive holes and fresh active infestation.

Subject context captured by the image:
- Hardwood staircase timber components: tread · riser · stringer · newel · handrail · baluster
- Small holes typical of common furniture beetle (1–2 mm) and larger wood-boring beetles
- Old inactive holes vs signs of active infestation (fresh light-coloured frass · new holes · soft crumbly timber · beetle emergence in warmer months)
- Preferred timber conditions for wood-boring beetles: damp · untreated · poorly ventilated · beginning to decay
- Hardwood resistance ordering (higher to lower): teak · oak · walnut · mahogany · then softwood pine
- Kiln drying removes moisture and kills any insects · larvae · eggs when done correctly

Positioning in the NEX education library: this image supports one of 4 articles in the internal-staircase woodworm cluster (understanding-woodworm · woodworm-worldwide-and-biology · woodworm-spread-in-a-staircase · what-to-do-if-you-see-woodworm-holes).

OBJECT DETECTION

PRIMARY OBJECTS
- Hardwood staircase timber surface (oak / walnut / ash / mahogany / teak grain typical) OR pine softwood surface
- Small hole(s) characteristic of wood-boring beetle exit
- Timber grain visible
- Sanded / finished or raw surface reveal

SECONDARY OBJECTS
- Frass (fine wood dust) beneath holes, if visible in the image
- Beetle silhouette or life-cycle diagram, if included

BACKGROUND OBJECTS
- Interior hardwood staircase context

MATERIAL ANALYSIS

Primary Material:
Kiln-dried hardwood typical for staircases (oak · walnut · ash · mahogany · teak) or interior softwood (pine)

Timber Character:
Furniture-grade interior timber — the surface treatment used across staircase tread · riser · stringer · newel · handrail · baluster components.

CAMERA INFORMATION

Image Orientation:
Portrait or close-up detail

Camera Position:
Detail / close-up

View:
Educational reference view (may include life-cycle illustration or damage close-up)

Composition:
Documentary or educational composition allowing the reader to read the article and see what it describes

QUALITY

Realism:
Photorealistic timber reference OR illustrative educational graphic

Rendering:
Timber-detail photography · educational infographic · or both

SETTING

Primary Setting:
Interior hardwood staircase context — reference for the paired education article

AI REPRODUCTION RULES

MUST KEEP
- Interior hardwood staircase framing
- Recognisable wood-boring-beetle education subject
- Small hole(s) or beetle illustration clearly readable
- Association with the paired education article

DO NOT CHANGE
- Educational purpose
- Internal-staircase framing

ALLOWED MODIFICATIONS
Users may change:
- Timber type within the internal-staircase palette (oak · walnut · ash · mahogany · teak · pine)
- Close-up angle
- Illustrative treatment (photo · infographic · hybrid)

MASTER AI PROMPT

Documentary architectural detail render or educational infographic for the internal-staircase woodworm education cluster. Subject: kiln-dried hardwood staircase timber (oak · walnut · ash · mahogany · teak typical) or interior softwood (pine) showing the small holes characteristic of wood-boring beetle exit points, with optional frass (fine wood dust) beneath the holes, or an educational life-cycle illustration of the beetle. Furniture-grade interior surface as used on staircase tread · riser · stringer · newel · handrail · baluster components. Clear reference-quality composition suitable for pairing with a NEX education article on woodworm biology, geographic distribution, or the active-vs-historical assessment.`;
}

async function save(url, desc, notes) {
  const res = await fetch(API, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      images: {
        [url]: { description: desc, source: "ai_generated", created_by: "philip", notes },
      },
    }),
  });
  return await res.json();
}

async function main() {
  console.log("NEX Education Batch 14 — Woodworm cluster (3 images · all internal)\n===================================================================\n");

  const rows = [
    {
      url: WORLDWIDE_A,
      desc: commonWoodwormDescription("worldwide article · primary reference", ART_WORLDWIDE, WORLDWIDE_B),
      notes: "Primary reference for 'Woodworm Around the World' article · paired with " + WORLDWIDE_B,
      label: "worldwide_primary  ",
    },
    {
      url: WORLDWIDE_B,
      desc: commonWoodwormDescription("worldwide article · secondary reference", ART_WORLDWIDE, WORLDWIDE_A),
      notes: "Secondary reference for 'Woodworm Around the World' article · paired with " + WORLDWIDE_A,
      label: "worldwide_secondary",
    },
    {
      url: HOLES_REFERENCE,
      desc: commonWoodwormDescription("'What to Do If You See Holes' article · primary reference", ART_HOLES, "(no sibling — single primary)"),
      notes: "Primary reference for 'What to Do If You See Woodworm Holes' article",
      label: "holes_reference    ",
    },
  ];

  for (const r of rows) {
    const res = await save(r.url, r.desc, r.notes);
    console.log("  " + r.label, res.ok ? "SAVED" : `ERROR: ${res.error}`);
  }

  console.log("\nFinal row states:\n");
  const manifestPath = path.join(process.cwd(), "data", "nex-image-manifest.json");
  const manifest = JSON.parse(await fs.readFile(manifestPath, "utf8"));
  for (const r of rows) {
    const row = manifest.images[r.url];
    if (row) {
      console.log(
        "  " + r.label,
        "score:", String(row.master_image_score?.master_score ?? "?").padStart(3),
        "· band:", (row.knowledge_band_label ?? "?").padEnd(22),
        "· brain:", (row.primary_brain ?? "?").padEnd(18),
        "· collections:", (row.collection_memberships || []).length
      );
    }
  }
  console.log("\nBatch 14 complete.");
}

main().catch((e) => { console.error(e); process.exit(1); });
