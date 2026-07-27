#!/usr/bin/env node
// scripts/import-wall-side-anti-pattern.mjs
//
// Saves the wall-side balusters ANTI-PATTERN image referenced from
// the customer-education article. Introduces a new content pattern:
// ANTI-PATTERN reference (an image marked in the description as
// showing what NEX advises AGAINST). Downstream retrieval can filter
// or highlight anti-pattern images distinctly from positive examples.

const API = "http://localhost:3008/api/admin/image-tagger/save";

const URL = "https://ik.imagekit.io/5vv5pw26q/ChatGPT%20Image%20Jul%2026,%202026,%2007_29_13%20PM.png";
const ARTICLE = "data/nex-customer-education/wall-side-balusters-and-handrail.md";
const ANNOTATED_URL =
  "https://ik.imagekit.io/5vv5pw26q/ChatGPT%20Image%20Jul%2026,%202026,%2007_29_13%20PM.png?tr=l-text,i-%E2%9C%97,fs-900,co-FF0000,ff-Arial-Black,l-end";

const description = `IMAGE IDENTITY

Image Name:
Wall-Side Balusters + Handrail (ANTI-PATTERN example)

Category:
Customer Education > Design Anti-Patterns > NEX Do-Not-Recommend

Sub Category:
Balusters and handrail fitted against a wall · staircase too close to door frame

Primary Style:
Documentary anti-pattern reference

Secondary Style:
Educational warning image

Photographic Style:
Documentary architectural reference

Recommendation Type:
DO_NOT — NEX advises AGAINST this design choice

Annotated Version (red ✗ overlay via ImageKit):
${ANNOTATED_URL}

Educational Article:
${ARTICLE}

IMAGE DESCRIPTION

A staircase design showing TWO NEX-flagged anti-patterns simultaneously: (1) balusters and a handrail fitted against the wall side, and (2) the staircase positioned too close to the door frame. This image is used in the customer-education article "Should I Install Balusters and a Handrail on the Wall Side of My Staircase?" as a visual reference for what NEX generally recommends against.

Why NEX advises against wall-side balusters:
- Cleaning becomes difficult · small gap collects dust · reaching between spindles scuffs paint
- Decorating is much harder · painting neatly around spindles is time-consuming and costly
- No safety benefit · the wall already provides the barrier balusters would provide
- Visual clutter · disrupts the cleaner spacious appearance a bare wall allows

Why the door-frame proximity is flagged:
- Handrail crashes into door architrave · impacts trim installation
- No swing clearance for the door
- Restricted use of the entrance zone

The NEX-recommended alternative is a wall-mounted handrail (timber · brushed stainless · black matte · round or square profile) with the wall side kept clear of balusters entirely.

OBJECT DETECTION

PRIMARY OBJECTS
- Staircase with balusters against wall (anti-pattern element 1)
- Handrail fixed to wall-side balustrade (anti-pattern element 1)
- Door frame in close proximity (anti-pattern element 2)
- Staircase timber
- Newel post

SECONDARY OBJECTS
- Hallway context
- Adjacent architrave

BACKGROUND OBJECTS
- Wall surface behind balusters

MATERIAL ANALYSIS

Primary Material:
Timber staircase

CAMERA INFORMATION

Image Orientation:
Portrait

Camera Position:
Eye Level

View:
Documentary reference view

Composition:
Anti-pattern documentation composition

LIGHTING

Primary Lighting:
Standard interior lighting

QUALITY

Realism:
Photorealistic documentary reference

Rendering:
Reference photography

SETTING

Primary Setting:
Residential hallway showing design mistake

Secondary Setting:
Entrance-adjacent staircase installation

AI REPRODUCTION RULES

MUST KEEP
- Both anti-pattern elements clearly visible (wall-side balusters AND door-frame proximity)
- Documentary reference framing
- Sense of a real installation rather than a marketing render
- Recognisability as a NEX anti-pattern reference

DO NOT CHANGE
- The anti-pattern framing
- The documentary tone
- Educational purpose

ALLOWED MODIFICATIONS
Users may change:
- Staircase style
- Timber species
- Hallway context

MASTER AI PROMPT

Documentary reference photograph of a residential staircase installation showing two design mistakes commonly flagged by NEX: balusters and a handrail fitted against the wall side of the staircase · AND the staircase positioned uncomfortably close to a door frame. This image is used as an ANTI-PATTERN reference in NEX customer-education material. The image should read as a real installation captured for review · not a marketing image · with both anti-pattern elements clearly visible: (1) the awkward wall-side baluster/handrail arrangement that creates cleaning and decorating problems · (2) the door-frame proximity that restricts the entrance zone. Documentary realism · standard interior lighting · straightforward reference composition · no editorial polish.`;

async function main() {
  console.log("Saving wall-side ANTI-PATTERN reference…\n");
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
            "ANTI-PATTERN reference · wall-side balusters + door-frame proximity · used in customer-education article · red-X annotated version at " +
            ANNOTATED_URL,
        },
      },
    }),
  });
  const data = await res.json();
  console.log(data.ok ? "SAVED" : "ERROR: " + data.error);

  const fs = await import("node:fs/promises");
  const path = await import("node:path");
  const manifestPath = path.join(process.cwd(), "data", "nex-image-manifest.json");
  const manifest = JSON.parse(await fs.readFile(manifestPath, "utf8"));
  const row = manifest.images[URL];
  if (row) {
    console.log("");
    console.log("ANTI-PATTERN ROW STATE:");
    console.log("  score:", row.master_image_score?.master_score, "/ 100");
    console.log("  band:", row.knowledge_band_label);
    console.log("  brain:", row.primary_brain);
    console.log("  collections:", (row.collection_memberships || []).length);
    console.log("");
    console.log("ANNOTATED URL (red ✗ overlay via ImageKit):");
    console.log(" ", ANNOTATED_URL);
  }
}

main().catch((e) => { console.error(e); process.exit(1); });
