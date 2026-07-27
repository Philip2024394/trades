#!/usr/bin/env node
// scripts/import-nex-before-after-pair.mjs
//
// Saves the paired before/after images from the customer-education
// article "I Don't Like My New Staircase Yet" (Philip 2026-07-27).
//
// Introduces a NEW relationship pattern for NEX: the before/after
// transformation pair. Family_tree parent = the "before" image;
// child = the "after" image; both cross-reference the education article.

const API = "http://localhost:3008/api/admin/image-tagger/save";

const BEFORE_URL =
  "https://ik.imagekit.io/5vv5pw26q/Untitledasdasdasdassddsdds.png";
const AFTER_URL =
  "https://ik.imagekit.io/5vv5pw26q/ChatGPT%20Image%20Jul%2026,%202026,%2008_31_06%20PM.png";
const ARTICLE = "data/nex-customer-education/i-dont-like-my-new-staircase-yet.md";

const beforeDescription = `IMAGE IDENTITY

Image Name:
Staircase Post-Installation (before finishing)

Category:
Customer Education > Installation Journey > Before State

Sub Category:
Bare staircase after installers leave · pre-decoration state

Primary Style:
Documentary reference image for customer support

Secondary Style:
Educational before/after pair

Photographic Style:
Documentary architectural photography

Paired With:
${AFTER_URL} (after finishing)

Educational Article:
${ARTICLE}

IMAGE DESCRIPTION

A newly installed timber staircase photographed in the customer's home in the moments right after the installers have left. The stairs are structurally complete but the surrounding hallway is undecorated · no carpet or runner has been fitted · walls are not yet painted or dressed · no lighting features have been added.

This image is used by NEX to reassure post-installation customers experiencing "buyer's remorse" that what they're seeing is NOT the finished product. The paired after-image shows the same conceptual staircase once decoration · flooring · lighting · and finishing touches come together.

OBJECT DETECTION

PRIMARY OBJECTS
- Newly installed timber staircase
- Bare treads and risers
- Undressed handrail and balustrade
- Bare hallway walls
- Uncovered floor

SECONDARY OBJECTS
- Installation debris or protective materials
- Adjacent unfinished trim

BACKGROUND OBJECTS
- Undecorated hallway context

MATERIAL ANALYSIS

Primary Material:
Timber staircase (species unspecified — educational reference)

CAMERA INFORMATION

Image Orientation:
Portrait

Camera Position:
Eye Level

View:
Straight-on installation reference view

Composition:
Documentary reference composition

LIGHTING

Primary Lighting:
Neutral existing interior light (no feature lighting yet)

QUALITY

Realism:
Documentary photorealistic

Rendering:
Reference photography

SETTING

Primary Setting:
Residential hallway · post-installation state

AI REPRODUCTION RULES

MUST KEEP
- Bare / unfinished hallway context
- Newly installed staircase clearly visible
- Sense of "just after installers left" moment
- Absence of decorative finishing touches

DO NOT CHANGE
- The unfinished character of the image
- Educational before-state framing
- Documentary tone

ALLOWED MODIFICATIONS
Users may change:
- Timber species shown
- Staircase style
- Hallway proportions

MASTER AI PROMPT

Documentary reference photograph of a newly installed timber staircase in a residential hallway captured in the moments immediately after installation. Bare timber treads and risers · undressed handrail and balustrade · walls are not yet painted or decorated · no carpet or runner has been fitted · no feature lighting installed. The image should feel real and unfinished · a genuine "just after installers left" moment · used by NEX as the "before" half of a before/after educational pair that reassures customers their staircase is not yet in its final form. Photorealistic documentary rendering · natural existing interior light · neutral tones · no editorial polish.`;

const afterDescription = `IMAGE IDENTITY

Image Name:
Staircase Fully Finished (transformation complete)

Category:
Customer Education > Installation Journey > After State

Sub Category:
Fully decorated staircase · post-finishing state

Primary Style:
Aspirational finished-project photography

Secondary Style:
Educational before/after pair

Photographic Style:
Architectural interior photography

Paired With:
${BEFORE_URL} (before finishing · parent)

Parent Image:
${BEFORE_URL}

Educational Article:
${ARTICLE}

IMAGE DESCRIPTION

The same conceptual staircase from the paired before-image · now shown after all decoration · flooring · lighting · and finishing touches have been applied. Walls are painted and dressed · carpet or runner is fitted · lighting is installed · surrounding décor completes the picture. The staircase reads as the intentional architectural feature it was designed to be.

This image is the "after" half of the transformation pair used in the NEX customer-education article "I Don't Like My New Staircase — Even Though It's Exactly What I Chose". It demonstrates that the moment right after install is not the finished product — the staircase completes as the room comes together around it.

OBJECT DETECTION

PRIMARY OBJECTS
- Fully finished timber staircase
- Runner or carpet on treads
- Painted or decorated hallway walls
- Dressed handrail with finishing touches
- Feature lighting integrated
- Wall décor / artwork

SECONDARY OBJECTS
- Skirting and trim complete
- Coordinated floor covering
- Ambient interior lighting

BACKGROUND OBJECTS
- Completed hallway / entrance context

MATERIAL ANALYSIS

Primary Material:
Timber staircase with applied finish (paint · stain · lacquer · or clear satin)

Secondary Materials:
Carpet / runner · painted walls · fitted skirting · installed lighting

CAMERA INFORMATION

Image Orientation:
Portrait

Camera Position:
Eye Level

View:
Interior architectural photography view

Composition:
Aspirational finished-interior composition

LIGHTING

Primary Lighting:
Warm interior illumination with feature accents

Characteristics:
- Soft shadows
- Warm ambient light
- Integrated feature lighting visible

QUALITY

Realism:
Ultra photorealistic

Rendering:
Architectural interior visualisation

SETTING

Primary Setting:
Residential hallway · fully finished state

AI REPRODUCTION RULES

MUST KEEP
- Fully decorated hallway context
- Coordinated colour palette across walls · flooring · staircase
- Sense of "completed transformation" from the paired before-image
- Warm ambient lighting or feature lighting present
- Finishing details on skirting and trim

DO NOT CHANGE
- The finished · decorated character
- Educational after-state framing
- Warm aspirational tone

ALLOWED MODIFICATIONS
Users may change:
- Timber species and finish
- Wall colour
- Runner or carpet choice
- Lighting style

MASTER AI PROMPT

Ultra photorealistic architectural interior photograph of a residential staircase shown in its fully finished state — the same conceptual staircase as the paired before-image but now with all finishing touches applied. Painted or decorated hallway walls · fitted carpet or runner on the treads · coordinated colour palette across walls flooring and staircase · integrated feature lighting or ambient warm illumination · finished skirting and trim · dressed handrail · complete wall décor. The staircase reads as an intentional architectural feature — the centrepiece of a finished home entrance. Ultra photorealistic interior visualisation with warm ambient lighting · realistic shadows · soft feature accents · premium finished-project photography quality.`;

async function save(url, description, notes) {
  const res = await fetch(API, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      images: {
        [url]: {
          description,
          source: "ai_generated",
          created_by: "philip",
          notes,
        },
      },
    }),
  });
  const data = await res.json();
  return data;
}

async function main() {
  console.log("Saving before/after educational pair\n=====================================\n");
  const beforeRes = await save(
    BEFORE_URL,
    beforeDescription,
    "Before/after pair · BEFORE state · post-install, pre-finishing"
  );
  console.log("BEFORE saved:", beforeRes.ok ? "ok" : `error: ${beforeRes.error}`);
  const afterRes = await save(
    AFTER_URL,
    afterDescription,
    "Before/after pair · AFTER state · fully finished · parent = " + BEFORE_URL
  );
  console.log("AFTER saved: ", afterRes.ok ? "ok" : `error: ${afterRes.error}`);
  console.log("");
  console.log("Wiring family_tree before/after relationship…");

  // Direct manifest edit for the family_tree pair
  const fs = await import("node:fs/promises");
  const path = await import("node:path");
  const manifestPath = path.join(process.cwd(), "data", "nex-image-manifest.json");
  const manifest = JSON.parse(await fs.readFile(manifestPath, "utf8"));

  const before = manifest.images[BEFORE_URL];
  const after = manifest.images[AFTER_URL];
  if (before && after) {
    before.family_tree = {
      parent_url: undefined,
      children: [
        {
          type: "product_shot",
          url: AFTER_URL,
          generated_at: new Date().toISOString(),
          generated_by: "philip",
          notes:
            "AFTER state · fully finished · same conceptual staircase after decoration/flooring/lighting completes",
        },
      ],
    };
    after.family_tree = {
      parent_url: BEFORE_URL,
      children: [],
    };
    manifest.generated_at = new Date().toISOString();
    await fs.writeFile(manifestPath, JSON.stringify(manifest, null, 2), "utf8");
    console.log("  ✓ BEFORE knows about AFTER child");
    console.log("  ✓ AFTER knows its BEFORE parent");
  }
  console.log("\nBefore/after pair complete.");
}

main().catch((e) => { console.error(e); process.exit(1); });
