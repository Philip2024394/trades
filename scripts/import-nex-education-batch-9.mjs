#!/usr/bin/env node
// scripts/import-nex-education-batch-9.mjs
//
// Saves the single primary reference image for the "Understanding the
// Difference Between a Closed String and a Cut String Staircase"
// article (Philip 2026-07-27).
//
// This image is a SPLIT DEMONSTRATION — a single image showing both
// string styles on one staircase (closed on the nearest side, cut on
// the far side). Different from a sibling pair: the comparison is
// embedded in ONE image rather than distributed across two.
// It doubles as a reference for the popular hybrid design pattern
// (closed string wall side + cut string open side).

import fs from "node:fs/promises";
import path from "node:path";

const API = "http://localhost:3008/api/admin/image-tagger/save";

const URL = "https://ik.imagekit.io/5vv5pw26q/ChatGPT%20Image%20Jul%2023,%202026,%2010_09_14%20AM.png";
const ARTICLE = "data/nex-customer-education/closed-string-vs-cut-string-comparison.md";

const description = `IMAGE IDENTITY

Image Name:
Closed String vs Cut String — Split Demonstration Primary Reference

Category:
Customer Education > Staircase Types > String Comparison

Sub Category:
Single-image split demonstration — closed string on the NEAREST (left) side · cut string on the FAR (right) side · only the string design changes across the two sides

Primary Style:
Educational split demonstration reference

Secondary Style:
Real-world hybrid design pattern reference (closed string wall side + cut string open side)

Photographic Style:
Architectural interior photography

Recommendation Type:
EDUCATIONAL — primary reference for the "Closed vs Cut String" comparison article · AND design reference for the "Best of Both Worlds" hybrid pattern

Belongs In:
staircase_brain (staircase type reference · construction knowledge)

Educational Article:
${ARTICLE}

IMAGE DESCRIPTION

A single staircase image acting as a SPLIT DEMONSTRATION of the two most common staircase string styles. The NEAREST (left) side uses a CLOSED STRING — a continuous line running from bottom to top, enclosing the ends of the treads and risers, giving a smooth uninterrupted profile. The FAR (right) side uses a CUT STRING — the string follows the outline of every tread and riser, exposing the stepped profile of each individual step.

Only the string design changes between the two sides — everything else about the staircase (treads · risers · handrail · balustrade · timber · finish · proportions) is identical. This makes the image an unusually clean teaching tool: readers see the exact same staircase, presented two different ways, in one glance.

This is ALSO a real design pattern reference — the "Best of Both Worlds" hybrid staircase where the closed string sits on the wall side (practical, clean where it meets the wall) and the cut string sits on the visible / open side (decorative feature side). This hybrid is one of the most popular bespoke staircase configurations.

Closed String Benefits (nearest side):
- Clean modern appearance
- Conceals the ends of the treads and risers
- Ideal for minimalist interiors
- Excellent for staircases installed against a wall
- Strong architectural look

Cut String Benefits (far side):
- Displays the full shape of every step
- Adds depth and character
- Traditional handcrafted appearance
- Can be left plain OR fitted with decorative scroll brackets beneath each tread for Victorian / Edwardian / Georgian character

OBJECT DETECTION

PRIMARY OBJECTS
- Closed string on the nearest (left) side — continuous smooth profile
- Cut string on the far (right) side — stepped profile following each tread
- Treads (identical on both sides — only the strings differ)
- Risers
- Handrail
- Balustrade
- Newel posts

SECONDARY OBJECTS
- Landing at top (if visible)
- Adjacent wall or open-hallway context

BACKGROUND OBJECTS
- Interior environment

MATERIAL ANALYSIS

Primary Material:
Timber staircase — species and finish consistent across both sides so the string profile is the only visible variable

CAMERA INFORMATION

Image Orientation:
Portrait

Camera Position:
Eye Level

View:
Full-flight reference view chosen so both string styles read clearly in one glance

Composition:
Comparison composition — nearest side foregrounded to teach the closed string, far side visible in perspective to teach the cut string

LIGHTING

Primary Lighting:
Neutral interior light — should reveal the stepped-profile shadow of the cut string clearly

QUALITY

Realism:
Ultra photorealistic

Rendering:
Architectural interior visualisation

SETTING

Primary Setting:
Residential interior showing an open-hallway staircase suitable for demonstrating both string styles side-by-side

AI REPRODUCTION RULES

MUST KEEP
- Closed string on the nearest side (smooth continuous profile)
- Cut string on the far side (stepped profile following each tread and riser)
- All other staircase details identical across the two sides (this is the whole point of the split demonstration)
- Both string styles clearly readable in one glance
- Neutral lighting that reveals the cut-string stepped shadow

DO NOT CHANGE
- The split demonstration principle (one image, two string styles)
- The nearest / far side assignment (closed nearest, cut far — matches the article body)
- Educational purpose

ALLOWED MODIFICATIONS
Users may change:
- Timber species and finish (as long as consistent across both sides)
- Balustrade style
- Newel post design
- Interior context (contemporary or transitional)

MASTER AI PROMPT

Ultra photorealistic architectural interior render of a single staircase acting as a SPLIT DEMONSTRATION of the two most common staircase string styles. Nearest (left) side: CLOSED STRING — continuous smooth profile from bottom to top enclosing the ends of the treads and risers. Far (right) side: CUT STRING — stepped profile following the outline of every tread and riser. Everything else about the staircase is identical between the two sides — same timber · same finish · same treads / risers / handrail / balustrade / newel proportions — so the only visible variable is the string profile. Also serves as a real-design reference for the popular "closed string wall side + cut string open side" hybrid staircase. Neutral interior lighting that reveals the cut-string stepped shadow · premium architectural interior visualisation. Used as the primary reference for the NEX "Understanding the Difference Between a Closed String and a Cut String Staircase" education article.`;

async function main() {
  console.log("Saving closed-vs-cut string split demonstration…\n");
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
            "Split demonstration · closed string (nearest) vs cut string (far) on ONE staircase · doubles as reference for the 'best of both worlds' hybrid pattern · used in education article",
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
