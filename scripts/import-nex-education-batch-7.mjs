#!/usr/bin/env node
// scripts/import-nex-education-batch-7.mjs
//
// Saves the single primary reference image for the "Closed String
// Open Riser Staircases" article (Philip 2026-07-27).

import fs from "node:fs/promises";
import path from "node:path";

const API = "http://localhost:3008/api/admin/image-tagger/save";

const URL = "https://ik.imagekit.io/5vv5pw26q/ChatGPT%20Image%20Jul%2023,%202026,%2010_21_24%20AM.png";
const ARTICLE = "data/nex-customer-education/closed-string-open-riser-staircase.md";

const description = `IMAGE IDENTITY

Image Name:
Closed String Open Riser Staircase — Primary Reference

Category:
Customer Education > Staircase Types > Closed String Open Riser

Sub Category:
Closed side strings housing the treads · no risers between the treads · modern floating effect while retaining a traditional closed-string structural profile

Primary Style:
Aspirational architectural reference

Secondary Style:
Educational article primary image

Photographic Style:
Architectural interior photography

Recommendation Type:
EDUCATIONAL — primary reference for the "Closed String Open Riser Staircases" article

Belongs In:
staircase_brain (staircase type reference)

Educational Article:
${ARTICLE}

IMAGE DESCRIPTION

A closed string open riser staircase — treads housed inside solid side strings while the risers between the treads are omitted so light and views pass through. Combines the structural strength and clean lines of a traditional closed-string staircase with the light-flow and contemporary floating effect of open risers.

Design advantages illustrated: light travels through each open riser · hallway feels brighter · sense of openness · works particularly well in darker hallways, contemporary homes, open-plan living spaces, modern extensions, minimalist interiors, and timber+glass staircase designs.

Safety caution embedded in the article: where headroom under the flight allows walk-under access (especially by young children), open risers must comply with local building regulations for opening size. The lower portion of the staircase is often left enclosed until the underside is above normal head height, then transitions into open risers above.

Common material pairings: European Oak · American Black Walnut · Mahogany · Pine · painted timber · black matte finishes · glass balustrades · stainless steel balusters · contemporary timber handrails.

OBJECT DETECTION

PRIMARY OBJECTS
- Closed side strings (solid stringers running along each side)
- Treads housed within the strings
- OPEN gap between treads (no riser)
- Handrail
- Balustrade (often glass or slim metal for modern homes)
- Newel post

SECONDARY OBJECTS
- Adjacent wall or opening
- Landing at top
- Feature lighting (if included)

BACKGROUND OBJECTS
- Contemporary interior context
- Light passing through the open risers

MATERIAL ANALYSIS

Primary Material:
Timber staircase — species can vary (Oak · Walnut · Mahogany · Pine · painted · black matte)

Balustrade Options:
Glass panels · stainless steel balusters · black metal · contemporary timber

CAMERA INFORMATION

Image Orientation:
Portrait

Camera Position:
Eye Level

View:
Full staircase reference view showing the open risers clearly against a light background

Composition:
Feature composition emphasising the light-through-open-riser effect and the closed-string profile

LIGHTING

Primary Lighting:
Bright natural daylight (essential — the open riser effect is defined by the light that passes through it)

QUALITY

Realism:
Ultra photorealistic

Rendering:
Architectural interior visualisation

SETTING

Primary Setting:
Contemporary residential interior with an open-plan or naturally-lit hallway

AI REPRODUCTION RULES

MUST KEEP
- Closed side strings (this is a closed-string type, not a cut-string or floating tread)
- Open risers clearly visible (light and views passing through the gaps between treads)
- Sense of natural light travelling through the staircase
- Contemporary design context
- Structural clarity — the string profile still reads as traditional despite the open risers

DO NOT CHANGE
- The open riser principle
- The closed-string structural profile
- Educational purpose

ALLOWED MODIFICATIONS
Users may change:
- Timber species and finish (Oak · Walnut · Mahogany · Pine · painted · black matte)
- Balustrade style (glass panels · stainless steel · black metal · timber)
- Newel post design
- Interior context (contemporary home · open-plan · modern extension · minimalist)
- Enclosed-then-open transition treatment where head-height requires it

MASTER AI PROMPT

Ultra photorealistic architectural interior render of a closed-string open-riser staircase. Solid side strings running along each side housing the treads · OPEN gaps between the treads (no risers) letting bright natural daylight and interior views pass through the staircase · modern floating effect layered on top of a traditional closed-string structural profile. Contemporary residential interior · bright natural daylight essential to showcase the open riser effect · optional glass balustrade or slim contemporary metal balusters · premium architectural interior visualisation. Used as the primary reference for the NEX "Closed String Open Riser Staircases" education article.`;

async function main() {
  console.log("Saving closed-string open-riser primary reference…\n");
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
            "Primary reference · closed-string open-riser staircase · used in education article",
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
