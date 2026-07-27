#!/usr/bin/env node
// scripts/import-nex-education-batch-15.mjs
//
// Saves the primary reference for the "Floating Stairs – The Hidden
// Steel Engineering That Makes Them Possible" article (Philip 2026-07-27).

import fs from "node:fs/promises";
import path from "node:path";

const API = "http://localhost:3008/api/admin/image-tagger/save";

const URL =
  "https://ik.imagekit.io/5vv5pw26q/Untitledasdasdfdsfdfsdasdasdadsasdasdfsdfzxc.png";
const ARTICLE =
  "data/nex-customer-education/floating-stairs-hidden-steel-engineering.md";

const description = `IMAGE IDENTITY

Image Name:
Floating Staircase — Hidden Steel Engineering Reference

Category:
Customer Education > Staircase Types > Floating / Cantilever > Engineering

Sub Category:
Floating staircase primary reference · hardwood treads apparently emerging from the wall with concealed steel support inside the wall structure

Primary Style:
Aspirational architectural reference

Secondary Style:
Educational article primary image

Photographic Style:
Architectural interior photography

Recommendation Type:
EDUCATIONAL — primary reference for the "Floating Stairs – The Hidden Steel Engineering That Makes Them Possible" article

Belongs In:
staircase_brain (INTERNAL staircase types · floating / cantilever engineering)

Educational Article:
${ARTICLE}

IMAGE DESCRIPTION

A floating staircase — hardwood treads that appear to emerge directly from the wall with nothing visible supporting them. In reality the support comes from one of four hidden steel systems documented in the paired article:

1. Hidden steel spine fixed deep into reinforced concrete wall, steel frame, or structural timber wall system — timber tread slides over the concealed steel arm.
2. Cantilever steel frame per step — bracket rooted deep into the structure resisting pulling forces on the wall side and supporting the tread on the outside.
3. Steel staircase skeleton — one large hidden steel spine plus side steel plates and concealed brackets, with the timber treads as the outer finish only.
4. Concrete wall support — chemically fixed anchors into concrete allowing the steel frame to become part of the structure. Standard plasterboard partition walls CANNOT carry a floating staircase by themselves.

Typical high-end floating build features: hidden steel cantilever frame · hardwood treads 40–80 mm thick (oak · walnut · mahogany typical for luxury interiors) · concealed LED lighting under each step · glass balustrades or stainless steel balusters.

Load capacity considerations: tread length · steel thickness · fixing depth · wall type · number of supports · vibration + movement.

OBJECT DETECTION

PRIMARY OBJECTS
- Floating staircase treads (hardwood — oak / walnut / mahogany typical)
- Wall face the treads emerge from
- Concealed steel support system (invisible in the image, subject of the paired article)
- Balustrade (glass or stainless steel typical for floating builds)
- Handrail

SECONDARY OBJECTS
- Concealed LED lighting under treads (if visible)
- Landing at the top
- Adjacent interior finishes

BACKGROUND OBJECTS
- Contemporary interior context — often open-plan, modern, luxury

MATERIAL ANALYSIS

Primary Material:
Hardwood staircase treads (oak · walnut · mahogany typical for luxury interior floating designs) · hidden structural steel (mild steel · stainless steel · structural steel box sections)

Wall Type:
Reinforced concrete OR steel frame OR structural timber wall system — plasterboard partition cannot carry a floating staircase.

CAMERA INFORMATION

Image Orientation:
Portrait

Camera Position:
Eye Level

View:
Full floating staircase reference view

Composition:
Feature composition emphasising the "floating" visual effect (treads emerging from wall with no visible support)

LIGHTING

Primary Lighting:
Warm interior ambient light — often paired with concealed LED under-tread lighting for the "floating" effect

QUALITY

Realism:
Ultra photorealistic

Rendering:
Architectural interior visualisation

SETTING

Primary Setting:
Contemporary residential interior (open-plan · modern · luxury typical for floating designs)

AI REPRODUCTION RULES

MUST KEEP
- Floating visual effect (treads appear to emerge from wall)
- No visible support beneath the treads
- Hardwood tread character (40-80 mm thick typical for luxury)
- Contemporary interior context
- Sense of engineered luxury

DO NOT CHANGE
- The floating principle
- Educational purpose
- Internal-staircase framing

ALLOWED MODIFICATIONS
Users may change:
- Hardwood type (oak · walnut · mahogany)
- Balustrade style (glass · stainless steel · black metal)
- Interior context (open-plan · loft · modern extension)
- Presence / absence of LED under-tread lighting
- Wall finish (paint · cladding · concrete)

MASTER AI PROMPT

Ultra photorealistic architectural interior render of a floating staircase — hardwood treads (oak · walnut · mahogany 40-80 mm thick typical) that appear to emerge directly from the wall with no visible support underneath. The engineering that makes this possible sits concealed inside the wall (hidden steel cantilever · steel spine · steel skeleton · or concrete-anchored steel frame). Contemporary residential interior · open-plan / modern / luxury context · optional concealed LED under-tread lighting reinforcing the floating effect · optional glass balustrade or stainless steel balusters · warm interior ambient light · premium architectural interior visualisation. Used as the primary reference for the "Floating Stairs – The Hidden Steel Engineering That Makes Them Possible" education article.`;

async function main() {
  console.log("Saving floating stairs primary reference…\n");
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
            "Primary reference · floating staircase with hidden steel engineering · used in education article",
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
