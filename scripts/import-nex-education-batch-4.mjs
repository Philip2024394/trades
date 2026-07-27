#!/usr/bin/env node
// scripts/import-nex-education-batch-4.mjs
//
// Saves the 2 sibling staircase-back reference images from Philip
// 2026-07-27 accompanying the "Understanding the Back of a Traditional
// Timber Staircase" article.
//
// Pattern: sibling_material_variation (same joinery, different build
// material palette — pine lamwood vs MDF+pine) — reassures customers
// worried about MDF appearance from the back.

import fs from "node:fs/promises";
import path from "node:path";

const API = "http://localhost:3008/api/admin/image-tagger/save";

const PINE_LAMWOOD_BACK =
  "https://ik.imagekit.io/5vv5pw26q/ChatGPT%20Image%20Jul%2027,%202026,%2006_02_06%20PM.png";
const MDF_AND_PINE_BACK =
  "https://ik.imagekit.io/5vv5pw26q/Untitledasdasdaaacccddasdas.png";
const ARTICLE =
  "data/nex-customer-education/understanding-the-back-of-a-traditional-timber-staircase.md";

const pine_lamwood_desc = `IMAGE IDENTITY

Image Name:
Staircase Back — Pine Lamwood Build (sibling A)

Category:
Customer Education > Construction Knowledge > Hidden Engineering

Sub Category:
Traditional timber staircase back · pine lamwood strings + treads + risers · reveals wedges + angle blocks

Primary Style:
Documentary construction reference

Secondary Style:
Educational sibling comparison

Photographic Style:
Documentary architectural / joinery reference

Recommendation Type:
EDUCATIONAL — one half of the sibling pair used in the "Understanding the Back of a Traditional Timber Staircase" article

Belongs In:
staircase_brain (hidden engineering + construction knowledge)

Educational Article:
${ARTICLE}

Sibling Image (sibling_material_variation):
${MDF_AND_PINE_BACK}

IMAGE DESCRIPTION

A view of the back (underside / rear) of a traditional timber staircase built using pine lamwood strings, treads and risers. Reveals the hidden engineering discussed in the paired education article:
- Stair strings (main structural members running along each side)
- Treads (horizontal boards)
- Risers (vertical boards)
- Timber wedges (driven into machined housings, locking treads and risers into the strings)
- Angle blocks / glue blocks (small triangular timber blocks reinforcing the tread-to-riser joint)

Used as the FIRST of a paired sibling set alongside the MDF+pine variant. The two together prove that regardless of build material palette, the joinery — wedges, angle blocks, wedged mortice housings — reads the same from behind. Reassures customers worried about how an MDF-back staircase will look.

OBJECT DETECTION

PRIMARY OBJECTS
- Stair strings (pine lamwood)
- Treads (pine lamwood)
- Risers (pine lamwood)
- Timber wedges in machined housings
- Angle blocks / glue blocks at tread-riser joints
- Rear of staircase carcass

SECONDARY OBJECTS
- Rear surface finish
- Joint lines

BACKGROUND OBJECTS
- Under-stair construction environment

MATERIAL ANALYSIS

Primary Material:
Pine lamwood (traditional all-timber staircase back build)

Build Character:
Pine lamwood strings + pine lamwood treads + pine lamwood risers · traditional joinery with visible wedges and angle blocks · premium timber build

CAMERA INFORMATION

Image Orientation:
Landscape or portrait — reference view of the underside/back

Camera Position:
Underside / rear reference position

View:
Structural rear view revealing hidden engineering

Composition:
Documentary joinery reference composition

LIGHTING

Primary Lighting:
Neutral existing light suitable for construction reference

QUALITY

Realism:
Photorealistic joinery reference

Rendering:
Reference photography

SETTING

Primary Setting:
Manufactured staircase back — construction reference context

AI REPRODUCTION RULES

MUST KEEP
- Visible wedges in machined housings
- Visible angle blocks at tread-riser joints
- Recognisable pine lamwood build (colour and grain)
- Sibling-pair relationship with the MDF+pine variant
- Structural joinery clearly readable

DO NOT CHANGE
- Joinery details (wedges + angle blocks must remain visible — they are the subject)
- Sibling-pair relationship

ALLOWED MODIFICATIONS
Users may change:
- Timber species (if generating a variant — but must remain "traditional all-timber back")
- Camera angle within the rear/underside view
- Ambient lighting

MASTER AI PROMPT

Documentary construction reference photograph of the BACK / underside of a traditional timber staircase built with pine lamwood strings, treads and risers. Visible hidden engineering: timber wedges driven into machined housings locking treads and risers into the strings · angle blocks (small triangular glue blocks) reinforcing every tread-to-riser joint · full structural rear view. Neutral existing light · photorealistic joinery detail · reference-photography quality · designed for direct side-by-side comparison with the MDF+pine sibling variant to demonstrate that both builds read the same from behind.`;

const mdf_and_pine_desc = `IMAGE IDENTITY

Image Name:
Staircase Back — MDF Treads + Risers with Pine Strings (sibling B)

Category:
Customer Education > Construction Knowledge > Hidden Engineering

Sub Category:
Traditional timber staircase back · MDF treads + MDF risers + pine strings · reveals wedges + angle blocks

Primary Style:
Documentary construction reference

Secondary Style:
Educational sibling comparison

Photographic Style:
Documentary architectural / joinery reference

Recommendation Type:
EDUCATIONAL — one half of the sibling pair used in the "Understanding the Back of a Traditional Timber Staircase" article. Directly addresses the concern "how will an MDF-back staircase look?"

Belongs In:
staircase_brain (hidden engineering + construction knowledge)

Educational Article:
${ARTICLE}

Sibling Image (sibling_material_variation):
${PINE_LAMWOOD_BACK}

IMAGE DESCRIPTION

A view of the back (underside / rear) of a traditional timber staircase built using MDF treads and risers combined with pine strings — a widely used cost-conscious construction. Reveals the same hidden engineering as the paired pine-lamwood sibling:
- Stair strings (pine)
- Treads (MDF)
- Risers (MDF)
- Timber wedges (same joinery method — driven into machined housings locking treads and risers into the pine strings)
- Angle blocks / glue blocks (same reinforcement of the tread-to-riser joint)

Used as the SECOND of a paired sibling set alongside the pine lamwood variant. The two together prove that regardless of build material palette, the joinery reads the same from behind. Purpose: reassure customers worried about how an MDF-back staircase will look — the visual result from behind is effectively identical to the traditional all-timber build.

OBJECT DETECTION

PRIMARY OBJECTS
- Stair strings (pine)
- Treads (MDF)
- Risers (MDF)
- Timber wedges in machined housings
- Angle blocks / glue blocks at tread-riser joints
- Rear of staircase carcass

SECONDARY OBJECTS
- Rear surface finish
- Joint lines

BACKGROUND OBJECTS
- Under-stair construction environment

MATERIAL ANALYSIS

Primary Material:
MDF treads + MDF risers + pine strings (cost-conscious traditional build)

Build Character:
Pine strings + MDF treads + MDF risers · same traditional joinery with visible wedges and angle blocks · cost-conscious construction that still uses full mortice-and-wedge assembly

CAMERA INFORMATION

Image Orientation:
Landscape or portrait — reference view of the underside/back

Camera Position:
Underside / rear reference position

View:
Structural rear view revealing hidden engineering

Composition:
Documentary joinery reference composition — matched to sibling for direct comparison

LIGHTING

Primary Lighting:
Neutral existing light suitable for construction reference

QUALITY

Realism:
Photorealistic joinery reference

Rendering:
Reference photography

SETTING

Primary Setting:
Manufactured staircase back — construction reference context

AI REPRODUCTION RULES

MUST KEEP
- Visible wedges in machined housings
- Visible angle blocks at tread-riser joints
- Recognisable MDF-tread + MDF-riser + pine-string build (MDF has smoother uniform character than pine lamwood)
- Sibling-pair relationship with the pine lamwood variant
- Structural joinery clearly readable

DO NOT CHANGE
- Joinery details (wedges + angle blocks must remain visible — they are the subject)
- Sibling-pair relationship
- The comparison intent (this image exists to reassure customers about MDF appearance)

ALLOWED MODIFICATIONS
Users may change:
- Camera angle within the rear/underside view
- Ambient lighting

MASTER AI PROMPT

Documentary construction reference photograph of the BACK / underside of a traditional timber staircase built with MDF treads and MDF risers combined with pine strings — a widely used cost-conscious build. Visible hidden engineering: timber wedges driven into machined housings locking the MDF treads and MDF risers into the pine strings · angle blocks (small triangular glue blocks) reinforcing every tread-to-riser joint · full structural rear view. Neutral existing light · photorealistic joinery detail · reference-photography quality · designed for direct side-by-side comparison with the pine lamwood sibling variant to prove that both builds read effectively the same from behind.`;

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
  console.log("NEX Education Batch 4 — Staircase Back Sibling Pair\n===================================================\n");

  const rows = [
    {
      url: PINE_LAMWOOD_BACK,
      desc: pine_lamwood_desc,
      notes:
        "Staircase back · pine lamwood build · sibling material variation with MDF+pine variant · used in Understanding the Back article",
      label: "pine_lamwood_back ",
    },
    {
      url: MDF_AND_PINE_BACK,
      desc: mdf_and_pine_desc,
      notes:
        "Staircase back · MDF treads + risers with pine strings · sibling material variation with pine lamwood variant · used in Understanding the Back article · reassures MDF-appearance concerns",
      label: "mdf_and_pine_back ",
    },
  ];

  for (const r of rows) {
    const res = await save(r.url, r.desc, r.notes);
    console.log("  " + r.label, res.ok ? "SAVED" : `ERROR: ${res.error}`);
  }

  console.log("\nWiring sibling_material_variation (pine lamwood ↔ MDF+pine)…");
  const manifestPath = path.join(process.cwd(), "data", "nex-image-manifest.json");
  const manifest = JSON.parse(await fs.readFile(manifestPath, "utf8"));
  const a = manifest.images[PINE_LAMWOOD_BACK];
  const b = manifest.images[MDF_AND_PINE_BACK];
  if (a && b) {
    a.family_tree = a.family_tree || { parent_url: undefined, children: [] };
    b.family_tree = b.family_tree || { parent_url: undefined, children: [] };
    const stampA = {
      type: "sibling_material_variation",
      url: MDF_AND_PINE_BACK,
      generated_at: new Date().toISOString(),
      generated_by: "philip",
      notes: "MDF treads + risers + pine strings variant · same joinery · same look from behind",
    };
    const stampB = {
      type: "sibling_material_variation",
      url: PINE_LAMWOOD_BACK,
      generated_at: new Date().toISOString(),
      generated_by: "philip",
      notes: "Pine lamwood variant · traditional all-timber build · same joinery · same look from behind",
    };
    if (!a.family_tree.children.some((c) => c.url === MDF_AND_PINE_BACK)) a.family_tree.children.push(stampA);
    if (!b.family_tree.children.some((c) => c.url === PINE_LAMWOOD_BACK)) b.family_tree.children.push(stampB);
    manifest.generated_at = new Date().toISOString();
    await fs.writeFile(manifestPath, JSON.stringify(manifest, null, 2), "utf8");
    console.log("  ✓ Pine lamwood knows about MDF+pine");
    console.log("  ✓ MDF+pine knows about pine lamwood");
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
  console.log("\nBatch 4 complete.");
}

main().catch((e) => { console.error(e); process.exit(1); });
