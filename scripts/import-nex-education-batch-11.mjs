#!/usr/bin/env node
// scripts/import-nex-education-batch-11.mjs
//
// Saves the 2 sibling finishing-variation images for the "Finishing the
// Side of a Cut String Staircase" article (Philip 2026-07-27).
//
// New sibling type: sibling_finishing_variation — same staircase TYPE
// (cut string), different side FINISH (scroll bracket vs flush mitred).

import fs from "node:fs/promises";
import path from "node:path";

const API = "http://localhost:3008/api/admin/image-tagger/save";

const SCROLL_BRACKET_URL =
  "https://ik.imagekit.io/5vv5pw26q/ChatGPT%20Image%20Jul%2023,%202026,%2009_49_36%20AM.png";
const FLUSH_MITRED_URL =
  "https://ik.imagekit.io/5vv5pw26q/ChatGPT%20Image%20Jul%2023,%202026,%2009_35_26%20AM.png";
const ARTICLE = "data/nex-customer-education/finishing-the-side-of-a-cut-string-staircase.md";

const scroll_bracket_desc = `IMAGE IDENTITY

Image Name:
Cut String with Carved Scroll Bracket (sibling A · traditional finish)

Category:
Customer Education > Staircase Types > Cut String > Side Finishing

Sub Category:
Cut string staircase side finish — carved scroll bracket beneath each tread (also called cut string bracket · gingerbread bracket)

Primary Style:
Traditional / heritage staircase finish

Secondary Style:
Educational sibling comparison

Photographic Style:
Architectural interior photography

Recommendation Type:
EDUCATIONAL — traditional finishing option for the side of a cut string staircase

Belongs In:
staircase_brain (staircase side-finishing knowledge)

Educational Article:
${ARTICLE}

Sibling Image (sibling_finishing_variation):
${FLUSH_MITRED_URL}

IMAGE DESCRIPTION

A cut string staircase with carved SCROLL BRACKETS fitted beneath each tread, following the profile of the cut string. Scroll brackets (also known as cut string brackets or gingerbread brackets) have been used for centuries and remain a hallmark of traditional staircase craftsmanship. They add elegance · handcrafted appearance · visual depth · character · and enhance period properties.

Historical / style associations: Victorian · Edwardian · Georgian staircase character. Manufacturers commonly offer a range of standard scroll designs from simple curves to highly decorative carvings; fully bespoke scrolls can be produced for individual homes (Victorian scrolls · Georgian-inspired · contemporary curved profiles · simple geometric shapes · one-of-a-kind carvings).

Used as the FIRST of a paired sibling set. Comparison partner: flush face cut string with mitred edge and slightly extended tread/riser (contemporary finish). Purpose of the pair: show how the SAME cut string staircase type reads as either heritage or contemporary depending purely on how the SIDE is finished.

OBJECT DETECTION

PRIMARY OBJECTS
- Cut string profile (stepped outline following each tread and riser)
- Carved scroll bracket beneath each tread
- Tread ends visible through the cut string
- Riser
- Handrail
- Balustrade (turned balusters typical of the traditional finish)
- Newel post (classic profile typical of the traditional finish)

SECONDARY OBJECTS
- Moulded handrail detail
- Adjacent hallway trim

BACKGROUND OBJECTS
- Period-property interior or transitional interior context

MATERIAL ANALYSIS

Primary Material:
Timber staircase — species varies. Scroll brackets themselves are carved timber, typically matched to the rest of the staircase.

Finish Character:
Traditional / heritage — the carved scroll brackets are the defining feature.

CAMERA INFORMATION

Image Orientation:
Portrait

Camera Position:
Eye Level

View:
Full staircase reference view emphasising the side profile

Composition:
Composition matched to the sibling for direct comparison

LIGHTING

Primary Lighting:
Warm interior ambient light — should reveal the scroll bracket detail clearly

QUALITY

Realism:
Ultra photorealistic

Rendering:
Architectural interior visualisation

SETTING

Primary Setting:
Period property or transitional interior where traditional detailing is welcome

AI REPRODUCTION RULES

MUST KEEP
- Cut string profile (stepped outline) clearly visible
- Carved scroll bracket beneath each tread as the defining detail
- Sibling-pair relationship with the flush mitred variant
- Traditional / heritage character (turned balusters + classic newel + moulded handrail typical)

DO NOT CHANGE
- The scroll-bracket finishing principle
- The sibling-pair relationship
- Educational purpose

ALLOWED MODIFICATIONS
Users may change:
- Timber species and finish
- Scroll bracket design (Victorian · Georgian · bespoke curve · geometric)
- Interior context (period property · transitional)

MASTER AI PROMPT

Ultra photorealistic architectural interior render of a CUT STRING STAIRCASE FINISHED WITH CARVED SCROLL BRACKETS beneath each tread. The scroll brackets (cut string brackets / gingerbread brackets) follow the stepped profile of the cut string and give the staircase a traditional / heritage character associated with Victorian · Edwardian · Georgian homes. Turned balusters · classic newel post · moulded handrail typical of the traditional finish. Warm interior ambient light revealing the scroll bracket carving clearly · premium architectural interior visualisation. Used as the TRADITIONAL sibling in the paired finishing-variation set from the "Finishing the Side of a Cut String Staircase" NEX education article.`;

const flush_mitred_desc = `IMAGE IDENTITY

Image Name:
Cut String with Flush Face + Mitred Edge (sibling B · contemporary finish)

Category:
Customer Education > Staircase Types > Cut String > Side Finishing

Sub Category:
Cut string staircase side finish — flush face, no scroll bracket, tread and riser extended slightly to offer subtle detail, top edge of string finished as a mitred edge (the normal choice for a clean contemporary reading)

Primary Style:
Contemporary / minimalist staircase finish

Secondary Style:
Educational sibling comparison

Photographic Style:
Architectural interior photography

Recommendation Type:
EDUCATIONAL — contemporary finishing option for the side of a cut string staircase

Belongs In:
staircase_brain (staircase side-finishing knowledge)

Educational Article:
${ARTICLE}

Sibling Image (sibling_finishing_variation):
${SCROLL_BRACKET_URL}

IMAGE DESCRIPTION

A cut string staircase with a FLUSH FACE — no carved scroll brackets beneath the treads. Instead, the tread and riser are extended slightly beyond the face of the cut string to offer subtle visible detail, and the top edge of the string is finished with a MITRED EDGE (the normal choice for a clean contemporary reading). The result is a minimalist appearance · clean architectural lines · easier preparation for painting · less visual clutter · a refined modern finish. Without decorative carving, the staircase relies on its proportions and craftsmanship rather than ornamentation.

Used as the SECOND of a paired sibling set. Comparison partner: cut string with carved scroll bracket (traditional finish). Purpose of the pair: show how the SAME cut string staircase type reads as either heritage or contemporary depending purely on how the SIDE is finished.

Contemporary finishing package that typically accompanies this variant: square balusters · flush cut strings · square newel posts · straight contemporary handrails. Combined with the traditional cut string construction beneath, this is the "traditional structure, modern character" reading — perfect for modern or semi-modern homes and often preferred where the staircase will later be painted.

OBJECT DETECTION

PRIMARY OBJECTS
- Cut string profile with flush face (no scroll bracket beneath treads)
- Tread and riser extended slightly beyond the string face (offering subtle detail)
- Mitred edge on top of the string (crisp mitred line following the stepped profile)
- Handrail (straight contemporary typical)
- Balustrade (square balusters typical of the contemporary finish)
- Newel post (square / minimalist typical of the contemporary finish)

SECONDARY OBJECTS
- Adjacent contemporary hallway trim
- Painted or natural-timber finish

BACKGROUND OBJECTS
- Contemporary or semi-modern interior context

MATERIAL ANALYSIS

Primary Material:
Timber staircase — species varies. Often painted (the flush face is particularly suited to a painted contemporary finish).

Finish Character:
Contemporary / minimalist — the flush face with mitred edge and slight tread/riser extension is the defining detail.

CAMERA INFORMATION

Image Orientation:
Portrait

Camera Position:
Eye Level

View:
Full staircase reference view emphasising the side profile

Composition:
Composition matched to the sibling for direct comparison

LIGHTING

Primary Lighting:
Neutral interior light — should reveal the mitred edge shadow and slight tread/riser projection

QUALITY

Realism:
Ultra photorealistic

Rendering:
Architectural interior visualisation

SETTING

Primary Setting:
Contemporary or semi-modern interior where minimalist detailing is preferred

AI REPRODUCTION RULES

MUST KEEP
- Cut string profile (stepped outline) still readable
- NO scroll brackets beneath treads (the whole point of the contemporary sibling)
- Tread and riser extended slightly beyond the string face for subtle detail
- Mitred edge on top of the string
- Sibling-pair relationship with the scroll-bracket variant
- Contemporary character (square balusters + square newel + straight contemporary handrail typical)

DO NOT CHANGE
- The flush-face + mitred-edge principle
- The sibling-pair relationship
- Educational purpose

ALLOWED MODIFICATIONS
Users may change:
- Timber species and finish (natural timber or painted)
- Balustrade style
- Newel post design
- Interior context (contemporary · semi-modern · transitional)

MASTER AI PROMPT

Ultra photorealistic architectural interior render of a CUT STRING STAIRCASE FINISHED WITH A FLUSH FACE. No scroll brackets beneath the treads. The tread and riser are extended slightly beyond the face of the cut string to offer subtle visible detail. The top edge of the string is finished with a MITRED EDGE (the normal choice for a clean contemporary reading — a crisp mitred line following the stepped profile). Square balusters · square newel post · straight contemporary handrail typical of the contemporary finish. Minimalist architectural presence · often painted for a fully contemporary reading · neutral interior light revealing the mitred edge shadow and the slight tread/riser projection · premium architectural interior visualisation. Used as the CONTEMPORARY sibling in the paired finishing-variation set from the "Finishing the Side of a Cut String Staircase" NEX education article.`;

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
  console.log("NEX Education Batch 11 — Cut String Finishing Sibling Pair\n==========================================================\n");

  const rows = [
    {
      url: SCROLL_BRACKET_URL,
      desc: scroll_bracket_desc,
      notes:
        "Cut string side finish · TRADITIONAL scroll bracket · sibling finishing variation with flush mitred variant · used in education article",
      label: "scroll_bracket    ",
    },
    {
      url: FLUSH_MITRED_URL,
      desc: flush_mitred_desc,
      notes:
        "Cut string side finish · CONTEMPORARY flush face + mitred edge + slight tread/riser extension · sibling finishing variation with scroll bracket variant · used in education article",
      label: "flush_mitred_edge ",
    },
  ];

  for (const r of rows) {
    const res = await save(r.url, r.desc, r.notes);
    console.log("  " + r.label, res.ok ? "SAVED" : `ERROR: ${res.error}`);
  }

  console.log("\nWiring sibling_finishing_variation (scroll bracket ↔ flush mitred)…");
  const manifestPath = path.join(process.cwd(), "data", "nex-image-manifest.json");
  const manifest = JSON.parse(await fs.readFile(manifestPath, "utf8"));
  const a = manifest.images[SCROLL_BRACKET_URL];
  const b = manifest.images[FLUSH_MITRED_URL];
  if (a && b) {
    a.family_tree = a.family_tree || { parent_url: undefined, children: [] };
    b.family_tree = b.family_tree || { parent_url: undefined, children: [] };
    const stampA = {
      type: "sibling_finishing_variation",
      url: FLUSH_MITRED_URL,
      generated_at: new Date().toISOString(),
      generated_by: "philip",
      notes:
        "Contemporary finish sibling — flush face + mitred edge + slight tread/riser extension · same cut string type, different side finish",
    };
    const stampB = {
      type: "sibling_finishing_variation",
      url: SCROLL_BRACKET_URL,
      generated_at: new Date().toISOString(),
      generated_by: "philip",
      notes:
        "Traditional finish sibling — carved scroll bracket beneath each tread · same cut string type, different side finish",
    };
    if (!a.family_tree.children.some((c) => c.url === FLUSH_MITRED_URL)) a.family_tree.children.push(stampA);
    if (!b.family_tree.children.some((c) => c.url === SCROLL_BRACKET_URL)) b.family_tree.children.push(stampB);
    manifest.generated_at = new Date().toISOString();
    await fs.writeFile(manifestPath, JSON.stringify(manifest, null, 2), "utf8");
    console.log("  ✓ Scroll bracket knows about flush mitred");
    console.log("  ✓ Flush mitred knows about scroll bracket");
  }

  console.log("\nFinal row states:\n");
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
  console.log("\nBatch 11 complete.");
}

main().catch((e) => { console.error(e); process.exit(1); });
