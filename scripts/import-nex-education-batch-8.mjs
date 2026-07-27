#!/usr/bin/env node
// scripts/import-nex-education-batch-8.mjs
//
// Saves the single primary reference image for the "Double-Sided Cut
// String Staircase" article (Philip 2026-07-27).

import fs from "node:fs/promises";
import path from "node:path";

const API = "http://localhost:3008/api/admin/image-tagger/save";

const URL = "https://ik.imagekit.io/5vv5pw26q/ChatGPT%20Image%20Jul%2023,%202026,%2010_18_10%20AM.png";
const ARTICLE = "data/nex-customer-education/double-sided-cut-string-staircase.md";

const description = `IMAGE IDENTITY

Image Name:
Double-Sided Cut String Staircase — Primary Reference

Category:
Customer Education > Staircase Types > Cut String > Double-Sided

Sub Category:
Cut strings on BOTH sides of the staircase (same detailed appearance from either side) · mitred string edges · heavy feature treads · PLAIN (no scroll brackets under treads)

Primary Style:
Aspirational architectural reference

Secondary Style:
Educational article primary image

Photographic Style:
Architectural interior photography

Recommendation Type:
EDUCATIONAL — primary reference for the "Double-Sided Cut String Staircase – Clean Lines with Bold Craftsmanship" article

Belongs In:
staircase_brain (staircase type reference · construction knowledge · design detail)

Educational Article:
${ARTICLE}

IMAGE DESCRIPTION

A double-sided cut string staircase — shaped side strings on BOTH sides following the stepped outline of every tread and riser, giving the staircase the same detailed appearance from either side. Suited to open hallways and feature staircases where both sides are visible.

Key design details visible / implied:
- Cut strings on both sides (not closed strings)
- Mitred string edges (crisp mitred top edge instead of a square exposed edge — cleaner joins, sharper shadow lines, premium handcrafted appearance)
- Heavy feature treads (deeper / thicker than standard treads for a substantial luxury bespoke feel; particularly effective in larger homes where a standard tread can appear too light)
- Plain cut strings (no decorative scroll brackets beneath the treads — a deliberate contemporary reading of a traditionally-detailed staircase form)
- Scroll brackets remain retrofit-able if the homeowner later wants a Victorian / Edwardian / Georgian reading

Historical / stylistic context: cut string staircases with scroll brackets are traditionally associated with Victorian, Edwardian and Georgian homes. Removing the scroll brackets modernises the form while preserving the mitred string edge + stepped-profile character.

Material and finish flexibility: European Oak · American Black Walnut · Mahogany · Pine · painted timber · black matte finishes · natural clear lacquer · light or dark wood stains. Pairs well with timber balusters · glass panels · wrought iron · brushed stainless steel · modern black metal balusters.

OBJECT DETECTION

PRIMARY OBJECTS
- Cut side strings on both sides (stepped profile following each tread/riser outline)
- Heavy feature treads (thicker than standard)
- Risers between treads
- Mitred string edges (top edge of the string mitred crisply)
- Handrail
- Balustrade (timber · glass · metal — varies)
- Newel posts

SECONDARY OBJECTS
- Landing at the top (if visible)
- Adjacent hallway
- Wall or open-hallway context

BACKGROUND OBJECTS
- Interior context (period or modern)

MATERIAL ANALYSIS

Primary Material:
Timber staircase — species can vary widely (Oak · Walnut · Mahogany · Pine · painted · black matte)

Finish Character:
Craftsmanship-focused. Mitred edges + heavy treads + plain strings put the emphasis on timber quality and joinery precision, not applied ornament.

CAMERA INFORMATION

Image Orientation:
Portrait

Camera Position:
Eye Level

View:
Full staircase reference view showing the cut-string profile and both sides where possible

Composition:
Feature composition emphasising the stepped cut-string outline · mitred edge crispness · heavy tread depth

LIGHTING

Primary Lighting:
Interior daylight or warm ambient light — should show the mitred edge shadow and tread thickness clearly

QUALITY

Realism:
Ultra photorealistic

Rendering:
Architectural interior visualisation

SETTING

Primary Setting:
Residential interior with an open hallway or feature staircase context — suits both period properties and modern homes

AI REPRODUCTION RULES

MUST KEEP
- Cut strings on both sides (double-sided is the defining characteristic)
- Stepped string profile following each tread and riser
- Mitred string edges (crisp mitred top edge)
- Heavy feature tread depth (deeper than standard)
- PLAIN string undersides — no scroll brackets in the primary reference (retrofittable)
- Craftsmanship-first reading of the staircase

DO NOT CHANGE
- The double-sided cut-string principle
- The mitred string edge detail
- The heavy tread character
- Educational purpose

ALLOWED MODIFICATIONS
Users may change:
- Timber species and finish (Oak · Walnut · Mahogany · Pine · painted · black matte · stained)
- Balustrade style (timber · glass · wrought iron · brushed stainless · black metal)
- Newel post design
- Interior context (period property or modern home)
- Later addition of scroll brackets for a Victorian / Edwardian / Georgian reading

MASTER AI PROMPT

Ultra photorealistic architectural interior render of a double-sided cut string staircase. Shaped cut strings on BOTH sides following the stepped outline of every tread and riser · mitred string edges giving a crisp shadow line along the top of each string · heavy feature treads (thicker than standard) creating a substantial luxury bespoke feel · PLAIN cut strings (no decorative scroll brackets beneath the treads) delivering a clean contemporary reading of a traditional joinery form. Craftsmanship-first composition · interior daylight or warm ambient light showing the mitred edge shadow and tread thickness clearly · premium architectural interior visualisation. Used as the primary reference for the NEX "Double-Sided Cut String Staircase – Clean Lines with Bold Craftsmanship" education article.`;

async function main() {
  console.log("Saving double-sided cut-string primary reference…\n");
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
            "Primary reference · double-sided cut string staircase with mitred edges + heavy feature treads + plain (no scroll brackets) · used in education article",
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
