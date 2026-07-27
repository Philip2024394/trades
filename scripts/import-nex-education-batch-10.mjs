#!/usr/bin/env node
// scripts/import-nex-education-batch-10.mjs
//
// Saves 2 primary reference images from Philip 2026-07-27:
//   1. Double closed string staircase (article: double-closed-string-staircase.md)
//   2. Baluster-to-tread joint on a cut string staircase (article:
//      how-balusters-are-fixed-to-cut-string-staircase.md)

import fs from "node:fs/promises";
import path from "node:path";

const API = "http://localhost:3008/api/admin/image-tagger/save";

const DOUBLE_CLOSED_URL = "https://ik.imagekit.io/5vv5pw26q/ChatGPT%20Image%20Jul%2023,%202026,%2010_05_20%20AM.png";
const BALUSTER_JOINT_URL = "https://ik.imagekit.io/5vv5pw26q/ChatGPT%20Image%20Jul%2023,%202026,%2010_00_22%20AM.png";

const ART_DOUBLE = "data/nex-customer-education/double-closed-string-staircase.md";
const ART_JOINT  = "data/nex-customer-education/how-balusters-are-fixed-to-cut-string-staircase.md";

const double_closed_desc = `IMAGE IDENTITY

Image Name:
Double Closed String Staircase — Primary Reference

Category:
Customer Education > Staircase Types > Closed String > Double-Sided

Sub Category:
Continuous closed strings on BOTH sides · treads and risers housed within the strings so none of the step ends are visible · symmetrical smooth uninterrupted profile from bottom to top

Primary Style:
Aspirational architectural reference

Secondary Style:
Educational article primary image

Photographic Style:
Architectural interior photography

Recommendation Type:
EDUCATIONAL — primary reference for the "Double Closed String Staircase — Clean, Strong and Timeless" article

Belongs In:
staircase_brain (staircase type reference)

Educational Article:
${ART_DOUBLE}

IMAGE DESCRIPTION

A double closed string staircase — closed strings on the left and right sides of the staircase. Both strings run in one continuous line from bottom to top, enclosing the ends of the treads and risers. The result is a perfectly symmetrical staircase with straight clean lines and a solid architectural appearance suitable for both traditional and contemporary homes.

Design advantages illustrated: perfect symmetry (both sides mirror each other) · smooth uninterrupted profile · easier maintenance (no stepped profiles or scroll brackets to collect dust) · timeless — adapts as interiors change (walls · flooring · balustrades · décor can all update without dating the staircase).

Common material and finish pairings: glass balustrades · timber balusters · black metal balusters · brushed stainless steel balusters · contemporary handrails · traditional handrails · painted or natural timber finishes. Because the staircase itself has such clean lines, it works equally well in modern, classic, or transitional interiors.

OBJECT DETECTION

PRIMARY OBJECTS
- Closed string on the left side (continuous smooth profile)
- Closed string on the right side (continuous smooth profile — mirror of the left)
- Treads housed within the strings (step ends NOT visible)
- Risers housed within the strings
- Handrail
- Balustrade
- Newel posts

SECONDARY OBJECTS
- Landing at top (if visible)
- Adjacent wall or open-hallway context

BACKGROUND OBJECTS
- Interior environment (contemporary or transitional)

MATERIAL ANALYSIS

Primary Material:
Timber staircase — species can vary widely

CAMERA INFORMATION

Image Orientation:
Portrait

Camera Position:
Eye Level

View:
Full-flight reference view emphasising the smooth uninterrupted string profile on both sides

Composition:
Symmetrical architectural composition

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
Residential interior — the double closed string suits everything from minimalist modern to transitional classic

AI REPRODUCTION RULES

MUST KEEP
- Closed strings on BOTH sides (the defining characteristic)
- Continuous smooth profile from bottom to top (no stepped outline)
- Symmetry across the two sides
- No visible tread ends (they must remain housed within the strings)

DO NOT CHANGE
- The double closed string principle
- The symmetry
- Educational purpose

ALLOWED MODIFICATIONS
Users may change:
- Timber species and finish (Oak · Walnut · Mahogany · Pine · painted · black matte · stained)
- Balustrade style (glass · timber · black metal · brushed stainless)
- Newel post design
- Interior context (modern · classic · transitional)

MASTER AI PROMPT

Ultra photorealistic architectural interior render of a double closed string staircase. Continuous closed strings on BOTH sides of the staircase running in one uninterrupted line from bottom to top · treads and risers housed within the strings with no exposed step ends · perfectly symmetrical construction so both sides mirror each other. Clean, timeless architectural presence suitable for minimalist modern, classic, or transitional interiors. Warm interior ambient light · premium architectural interior visualisation. Used as the primary reference for the NEX "Double Closed String Staircase — Clean, Strong and Timeless" education article.`;

const baluster_joint_desc = `IMAGE IDENTITY

Image Name:
Baluster-to-Tread Joint on a Cut String Staircase — Primary Reference

Category:
Customer Education > Construction Knowledge > Joinery Detail > Baluster Fixing

Sub Category:
Baluster-to-tread joint detail on a cut string staircase · covers both traditional hardwood dowelled joints and modern softwood haunched joints

Primary Style:
Educational joinery reference

Secondary Style:
Construction knowledge detail

Photographic Style:
Architectural detail photography / joinery close-up

Recommendation Type:
EDUCATIONAL — primary reference for the "How Are Balusters Fixed to a Cut String Staircase?" article

Belongs In:
staircase_brain (joinery / construction knowledge)

Educational Article:
${ART_JOINT}

IMAGE DESCRIPTION

The point where a baluster meets the top surface of a tread on a cut string staircase — the joint detail is the subject of the paired article. Depending on the staircase build, two fixing methods are commonly used:

TRADITIONAL DOWEL METHOD (historically standard on 19th-century and earlier hardwood staircases · still widely used on modern hardwood staircases):
- Baluster manufactured with a round dowel at its base
- Matching round hole bored into the tread at exactly the same diameter
- Baluster glued and driven into position
- Extremely reliable because well-seasoned hardwood (oak · elm · ash · mahogany) is stable with minimal movement after installation

MODERN HAUNCHED JOINT (introduced to handle softwood staircases that will be painted, where the timber can experience small seasonal movement):
- A small square or rectangular recess is carefully formed around the baluster location on the tread
- The base of the baluster is shaped to match this recess
- Hides any minor timber movement
- Prevents small gaps appearing around the base of the baluster
- Cleaner finished appearance
- Increased bearing surface between baluster and tread
- Provides additional mechanical location for the baluster

Timbers historically used: oak · elm · ash · mahogany (hardwoods · stable). Modern softwoods used where the staircase will be painted (requires haunched joint for long-term neatness).

OBJECT DETECTION

PRIMARY OBJECTS
- Baluster (upright timber component)
- Base of baluster (where the joint sits)
- Tread top surface (where the joint is machined)
- Joint detail (dowel or haunched)

SECONDARY OBJECTS
- Cut string profile visible along the side
- Riser between treads
- Handrail (if visible)

BACKGROUND OBJECTS
- Staircase context

MATERIAL ANALYSIS

Primary Material:
Timber staircase — species-agnostic (the same joint principles apply to hardwood dowelled and softwood haunched builds)

CAMERA INFORMATION

Image Orientation:
Portrait or landscape (close-up detail view)

Camera Position:
Angled close-up on the tread-and-baluster joint

View:
Joint detail view

Composition:
Educational detail composition emphasising the baluster base and its meeting with the tread

LIGHTING

Primary Lighting:
Even neutral light suitable for revealing the joint detail

QUALITY

Realism:
Photorealistic joinery reference

Rendering:
Architectural detail photography

SETTING

Primary Setting:
Cut string staircase detail context

AI REPRODUCTION RULES

MUST KEEP
- Baluster meeting the tread clearly readable
- Joint detail visible (dowel or haunched)
- Cut string profile in supporting context
- Sense of a real joinery joint rather than an abstract render

DO NOT CHANGE
- The joint detail is the whole point of the image — never obscure it
- Educational purpose

ALLOWED MODIFICATIONS
Users may change:
- Timber species (the joint principles apply across species)
- Finish (natural · painted · stained)
- Baluster style (turned · square · plain · decorative)

MASTER AI PROMPT

Photorealistic close-up architectural detail render of the joint where a baluster meets the top of a tread on a cut string staircase. The joint detail is the subject — either the traditional round dowel method (baluster manufactured with a round dowel at the base, driven and glued into a matching hole bored into the tread — historically standard for hardwood staircases such as oak · elm · ash · mahogany) OR the modern haunched joint (a small square or rectangular recess formed around the baluster location on the tread, with the baluster base shaped to match — used on modern softwood staircases that will be painted, to hide seasonal timber movement and keep the joint neat over time). Even neutral light revealing the joint detail cleanly · photorealistic joinery reference · cut string profile visible in supporting context. Used as the primary reference for the NEX "How Are Balusters Fixed to a Cut String Staircase?" education article.`;

async function save(url, description, notes) {
  const res = await fetch(API, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      images: {
        [url]: { description, source: "ai_generated", created_by: "philip", notes },
      },
    }),
  });
  return await res.json();
}

async function main() {
  console.log("NEX Education Batch 10 — 2 primary references\n=============================================\n");

  const rows = [
    {
      url: DOUBLE_CLOSED_URL,
      desc: double_closed_desc,
      notes: "Primary reference · double closed string staircase · used in education article",
      label: "double_closed_string ",
    },
    {
      url: BALUSTER_JOINT_URL,
      desc: baluster_joint_desc,
      notes: "Primary reference · baluster-to-tread joint on cut string staircase · covers traditional dowel + modern haunched methods · used in education article",
      label: "baluster_tread_joint ",
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
  console.log("\nBatch 10 complete.");
}

main().catch((e) => { console.error(e); process.exit(1); });
