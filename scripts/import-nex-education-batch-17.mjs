#!/usr/bin/env node
// scripts/import-nex-education-batch-17.mjs
//
// Saves the primary reference (installation illustration) for the
// "Floating Stairs – Installation Sequence, Cost, and Choosing Your
// Timber" article (Philip 2026-07-27).
//
// Third article in the floating-stairs sub-cluster:
//   - floating-stairs-hidden-steel-engineering.md
//   - floating-stairs-exploded-assembly-and-regulations.md
//   - floating-stairs-installation-cost-and-timber-choice.md ← this

import fs from "node:fs/promises";
import path from "node:path";

const API = "http://localhost:3008/api/admin/image-tagger/save";

const URL =
  "https://ik.imagekit.io/5vv5pw26q/Jul%2027,%202026,%2008_14_05%20PM.png";
const ARTICLE =
  "data/nex-customer-education/floating-stairs-installation-cost-and-timber-choice.md";

const description = `IMAGE IDENTITY

Image Name:
Floating Staircase — Installation Sequence Illustration (steel stringer · half landing · oak treads · glass balustrade)

Category:
Customer Education > Staircase Types > Floating / Cantilever > Installation + Cost + Timber

Sub Category:
Rendered installation-sequence illustration showing a modern floating staircase with a half landing being installed on site. Depicts the 4-stage sequence: (1) steel stringers positioned and anchored · (2) landing installed as the structural platform between flights · (3) oak treads slid onto concealed steel supports · (4) glass balustrades and handrails fitted last.

Primary Style:
Aspirational architectural rendered illustration

Secondary Style:
Educational installation-sequence reference

Photographic Style:
Architectural interior visualisation

Recommendation Type:
EDUCATIONAL — primary reference for the "Floating Stairs – Installation Sequence, Cost, and Choosing Your Timber" article

Belongs In:
staircase_brain (INTERNAL staircase types · floating / cantilever installation + cost + timber choice)

Educational Article:
${ARTICLE}

Companion Articles in the Floating Sub-Cluster:
- data/nex-customer-education/floating-stairs-hidden-steel-engineering.md (customer-friendly overview of the four hidden-steel systems)
- data/nex-customer-education/floating-stairs-exploded-assembly-and-regulations.md (exploded assembly + UK Building Regs)

IMAGE DESCRIPTION

Rendered illustration of a modern floating staircase installation with a half landing. The article's opening acknowledges honestly that the image is a rendered illustration rather than a real installation, but it represents the process well.

Illustrated installation sequence:
1. STEEL — black powder-coated steel stringers positioned first, bolted or chemically anchored into the concrete floor or structural steel of the building, upper section fixed to the upper floor structure, laser-levelled for perfect alignment (millimetres matter — misaligned steel means treads won't fit correctly).
2. LANDING — heavy structural platform between the two flights, transferring loads into the building, keeping the staircase rigid, often requiring two or more installers to position safely.
3. OAK TREADS — each hollow oak tread slid onto its concealed steel support, secured with hidden bolts or threaded inserts, fit checked for level and spacing. No visible screws on a premium build.
4. FINAL — tread spacing adjusted, all fixings tightened, pitch checked, oak cleaned, glass balustrades or handrails fitted only after everything is perfectly aligned.

Typical timings visible from the article: site survey 1-2 hours · manufacturing 6-10 weeks · steel install 1 day · landing 1 day · oak treads 1 day · glass balustrades 1 day · final finishing half day · total on-site 2-4 days.

UK cost context anchored by the article: softwood £2-4k · hardwood closed-string £5-10k · oak feature £8-15k · floating steel & oak £12-30k+ · luxury floating with glass £20-50k+. Floating costs 50-200% more than a traditional timber staircase because of the engineering (calculations · CNC laser-cut steel · precision welding · powder coating · hidden fixings · CNC-machined treads · factory trial assembly · specialist installers).

Timber palette typically offered: American White Oak (most popular · durable · stable · many stains) · European Oak · American Black Walnut · Ash · Sapele · Maple · Beech. Finishes: clear lacquer · hardwax oil · stain · painted (species-dependent).

Turnkey customer journey (10 steps): consultation + site survey → design + quote → approval → timber selection → structural engineering → manufacturing → factory QA + trial assembly → delivery → 2-4 day install → inspection + handover.

OBJECT DETECTION

PRIMARY OBJECTS
- Black powder-coated steel stringers (upper + lower flights)
- Half landing platform between flights
- Oak treads on both flights
- Handrail
- Glass balustrade panels
- Newel or vertical structural post supporting the landing
- Concealed steel supports beneath each tread (implied)

SECONDARY OBJECTS
- Adjacent wall
- Floor finish
- Ceiling above

BACKGROUND OBJECTS
- Interior context — likely contemporary residential

MATERIAL ANALYSIS

Primary Material:
Structural steel stringers (powder-coated black typical for premium floating designs) + oak treads (American White Oak most popular, or European Oak / Walnut / Ash / Sapele / Maple / Beech) + glass balustrade panels

Finish Character:
Steel: powder-coated black · matte or satin. Oak: clear lacquer, hardwax oil, stain, or painted finish depending on species and desired look.

CAMERA INFORMATION

Image Orientation:
Portrait

Camera Position:
Eye Level

View:
Full floating staircase reference view with the half landing clearly visible

Composition:
Feature composition showing both flights and the structural landing

LIGHTING

Primary Lighting:
Warm interior ambient light typical for a rendered aspirational visualisation

QUALITY

Realism:
Ultra photorealistic rendered illustration (acknowledged in the article as a render, not a photograph)

Rendering:
Architectural interior visualisation

SETTING

Primary Setting:
Contemporary residential interior — the setting typical for a luxury floating staircase installation

AI REPRODUCTION RULES

MUST KEEP
- Floating staircase with half landing configuration
- Black powder-coated steel stringers visible
- Oak treads on both flights
- Glass balustrade panels
- Sense of a mid-installation or freshly-installed illustration
- Aspirational quality that supports the cost + timber choice content

DO NOT CHANGE
- The floating principle (steel does the structure, oak is the finish)
- The half-landing configuration
- Educational purpose

ALLOWED MODIFICATIONS
Users may change:
- Oak variant (American White Oak · European Oak · Walnut · Ash · Sapele · Maple · Beech)
- Steel finish colour (black · grey · natural mill)
- Balustrade style (glass panels · stainless steel · timber handrail)
- Interior context (contemporary · loft · modern extension)

MASTER AI PROMPT

Ultra photorealistic rendered architectural interior illustration of a modern floating staircase with a half landing being installed. Black powder-coated steel stringers form the structural skeleton on both flights · half landing between the two flights transferring loads into the building · hollow oak treads slid onto concealed steel supports on both flights · glass balustrade panels ready to be fitted. Contemporary residential interior · warm interior ambient light · premium aspirational architectural visualisation. Represents a typical installation sequence (steel first · landing second · oak treads third · balustrade last) for a UK domestic floating staircase installation over 2-4 days. Used as the primary reference for the NEX "Floating Stairs – Installation Sequence, Cost, and Choosing Your Timber" education article.`;

async function main() {
  console.log("Saving floating stairs installation-sequence reference…\n");
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
            "Primary reference · floating staircase installation-sequence illustration · third article in the floating-stairs sub-cluster",
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
