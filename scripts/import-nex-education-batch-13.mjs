#!/usr/bin/env node
// scripts/import-nex-education-batch-13.mjs
//
// Saves the 2 ALTERNATE-reference images for the "Small Holes in a
// Hardwood Staircase – Is It Really Woodworm?" article (Philip 2026-07-27).
//
// NEW relationship pattern: alternate_reference — two images that serve
// the same reference purpose but MUST NEVER be displayed together.
// Retrieval / rendering picks ONE at a time (random / rotating).
//
// Distinct from sibling_* (which teaches comparison and IS shown
// together) and split_demonstration (one image with both variants
// in-frame). Alternate is the ONLY family-tree relationship that
// FORBIDS joint display.
//
// See feedback_nex_alternate_reference_images_never_show_together.md
// (HARD LAW 2026-07-27).

import fs from "node:fs/promises";
import path from "node:path";

const API = "http://localhost:3008/api/admin/image-tagger/save";

const ALTERNATE_A =
  "https://ik.imagekit.io/5vv5pw26q/ChatGPT%20Image%20Jul%2027,%202026,%2007_39_27%20PM.png";
const ALTERNATE_B =
  "https://ik.imagekit.io/5vv5pw26q/ChatGPT%20Image%20Jul%2027,%202026,%2007_40_29%20PM.png";
const ARTICLE =
  "data/nex-customer-education/small-holes-in-hardwood-staircase-is-it-woodworm.md";

function description(alternate_url, label) {
  return `IMAGE IDENTITY

Image Name:
Hardwood Staircase Small-Holes Reference — ${label}

Category:
Customer Education > Construction Knowledge > Timber Character > Small Holes / Historical Insect Marks

Sub Category:
Hardwood (oak · walnut · ash · mahogany) staircase reference used in the "Small Holes in a Hardwood Staircase – Is It Really Woodworm?" article. INTERNAL staircase context.

Primary Style:
Documentary construction reference

Secondary Style:
Educational article reference (alternate — never displayed alongside the sibling alternate)

Photographic Style:
Architectural interior / timber close-up

Recommendation Type:
EDUCATIONAL — one of two ALTERNATE reference views for the paired article. Retrieval / rendering picks ONE at a time; NEVER display both together.

Belongs In:
staircase_brain (INTERNAL staircase construction knowledge)

Educational Article:
${ARTICLE}

Alternate Reference (do NOT display together):
${alternate_url}

Display Rule:
alternate_reference · display_together = false · Retrieval picks exactly one · never both in the same view

IMAGE DESCRIPTION

Reference image for the "Small Holes in a Hardwood Staircase – Is It Really Woodworm?" education article — one of two interchangeable views. The paired article explains that small holes in newly installed hardwood are frequently NOT signs of active woodworm; they are more often historical insect marks left from the tree's life before felling, preserved through kiln drying and manufacturing.

Subject knowledge carried by this image:
- Applies to hardwoods: oak · walnut · ash · mahogany
- Kiln drying process removes moisture and kills any living insects / larvae / eggs
- Small holes visible after machining and sanding are often historical, not active
- Manufacturer inspection stages: rough-sawn timber → machining → sanding → repair or reject
- Isolated holes are typically filled with colour-matched wood filler or specialist repair compound
- Multiple clustered holes → the affected section is rejected or cut around
- Active infestation signals: fresh frass · new holes appearing · clustered concentration · weak crumbly timber · beetle emergence in season
- Cosmetic vs structural distinction — sound dry timber with no fresh frass is usually cosmetic

CRITICAL DISPLAY RULE (Philip 2026-07-27 HARD LAW): This image and its alternate ${alternate_url} are ALTERNATE references. They must NEVER be displayed together. Any retrieval surface / renderer / brain-chat answer picks ONE at a time.

OBJECT DETECTION

PRIMARY OBJECTS
- Hardwood staircase tread / riser / stringer surface (oak / walnut / ash / mahogany characteristic grain)
- Small hole(s) or timber-character marks
- Sanded / finished surface reveal (the same finish used on staircase treads, risers, handrails)

SECONDARY OBJECTS
- Timber grain
- Growth lines
- Filler or natural mark contrast

BACKGROUND OBJECTS
- Interior context (this is an INTERNAL staircase / hardwood surface)

MATERIAL ANALYSIS

Primary Material:
Kiln-dried hardwood (oak · walnut · ash · mahogany typical for staircases)

Finish Character:
Furniture-grade interior surface — machined, sanded, ready for or already carrying interior finish (lacquer · oil · natural clear).

CAMERA INFORMATION

Image Orientation:
Portrait or close-up detail

Camera Position:
Close-up detail position

View:
Detail view revealing the small-hole character of hardwood

Composition:
Documentary detail composition — allows the reader to see what the article describes

LIGHTING

Primary Lighting:
Neutral interior light suitable for revealing surface detail

QUALITY

Realism:
Photorealistic timber reference

Rendering:
Timber-detail photography / render

SETTING

Primary Setting:
Interior hardwood staircase context

AI REPRODUCTION RULES

MUST KEEP
- Hardwood character (oak / walnut / ash / mahogany grain)
- Small hole(s) or timber-character marks visible
- Interior staircase context (furniture-grade internal hallway subject)
- Alternate-reference relationship with ${alternate_url}
- display_together flag as false

DO NOT CHANGE
- The alternate-reference display rule (retrieval picks one at a time)
- The internal-hardwood-staircase framing
- Educational purpose

ALLOWED MODIFICATIONS
Users may change:
- Hardwood species within the internal-staircase family (oak · walnut · ash · mahogany)
- Finish variant (natural · lacquered · oiled · stained)
- Close-up angle

MASTER AI PROMPT

Documentary architectural detail render of a hardwood staircase surface showing small holes / historical insect marks characteristic of natural kiln-dried timber (oak · walnut · ash · mahogany). Furniture-grade interior surface — machined, sanded, appropriate for interior finish. Neutral interior light revealing the small-hole detail cleanly · photorealistic timber reference. Used as one of TWO alternate reference views in the NEX "Small Holes in a Hardwood Staircase – Is It Really Woodworm?" education article. CRITICAL DISPLAY RULE: this image and its alternate must never be displayed together — retrieval picks one at a time.`;
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
  console.log("NEX Education Batch 13 — Alternate Reference Pair (never shown together)\n=======================================================================\n");

  const rows = [
    {
      url: ALTERNATE_A,
      desc: description(ALTERNATE_B, "alternate_a"),
      notes: "ALTERNATE reference · never display together with " + ALTERNATE_B + " · retrieval picks ONE at a time · HARD LAW 2026-07-27",
      label: "alternate_a       ",
    },
    {
      url: ALTERNATE_B,
      desc: description(ALTERNATE_A, "alternate_b"),
      notes: "ALTERNATE reference · never display together with " + ALTERNATE_A + " · retrieval picks ONE at a time · HARD LAW 2026-07-27",
      label: "alternate_b       ",
    },
  ];

  for (const r of rows) {
    const res = await save(r.url, r.desc, r.notes);
    console.log("  " + r.label, res.ok ? "SAVED" : `ERROR: ${res.error}`);
  }

  console.log("\nWiring alternate_reference (A ⇔ B · DO NOT display together)…");
  const manifestPath = path.join(process.cwd(), "data", "nex-image-manifest.json");
  const manifest = JSON.parse(await fs.readFile(manifestPath, "utf8"));
  const a = manifest.images[ALTERNATE_A];
  const b = manifest.images[ALTERNATE_B];
  if (a && b) {
    a.family_tree = a.family_tree || { parent_url: undefined, children: [] };
    b.family_tree = b.family_tree || { parent_url: undefined, children: [] };
    const stampA = {
      type: "alternate_reference",
      url: ALTERNATE_B,
      generated_at: new Date().toISOString(),
      generated_by: "philip",
      notes: "ALTERNATE REFERENCE · never display together with sibling · retrieval picks one at a time",
    };
    const stampB = {
      type: "alternate_reference",
      url: ALTERNATE_A,
      generated_at: new Date().toISOString(),
      generated_by: "philip",
      notes: "ALTERNATE REFERENCE · never display together with sibling · retrieval picks one at a time",
    };
    if (!a.family_tree.children.some((c) => c.url === ALTERNATE_B && c.type === "alternate_reference")) a.family_tree.children.push(stampA);
    if (!b.family_tree.children.some((c) => c.url === ALTERNATE_A && c.type === "alternate_reference")) b.family_tree.children.push(stampB);

    // Also set the new top-level alternate_of field on each row so
    // retrieval logic that filters "never show together" can check
    // one field rather than iterating children.
    a.alternate_of = Array.from(new Set([...(a.alternate_of || []), ALTERNATE_B]));
    b.alternate_of = Array.from(new Set([...(b.alternate_of || []), ALTERNATE_A]));

    manifest.generated_at = new Date().toISOString();
    await fs.writeFile(manifestPath, JSON.stringify(manifest, null, 2), "utf8");
    console.log("  ✓ A knows B is its alternate (do not co-render)");
    console.log("  ✓ B knows A is its alternate (do not co-render)");
    console.log("  ✓ alternate_of field set on both rows for fast filter");
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
        "· collections:", (row.collection_memberships || []).length,
        "· alternate_of:", (row.alternate_of || []).length
      );
    }
  }
  console.log("\nBatch 13 complete.");
}

main().catch((e) => { console.error(e); process.exit(1); });
