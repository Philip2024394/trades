#!/usr/bin/env node
// scripts/import-nex-education-batch-18.mjs
//
// Saves 3 NEW images for the "Floating Stairs – How a Real Installation
// Actually Works" article (Philip 2026-07-27):
//   - wall-fixed installation (primary)
//   - centre-support static reference (variant)
//   - centre-support installation in progress (variant)
//
// The 4th URL Philip supplied (Jul 27 08:14:05 PM) already exists in
// the manifest from batch 17 — not re-saved here.

import fs from "node:fs/promises";
import path from "node:path";

const API = "http://localhost:3008/api/admin/image-tagger/save";

const WALL_FIXED =
  "https://ik.imagekit.io/5vv5pw26q/ChatGPT%20Image%20Jul%2027,%202026,%2008_15_16%20PM.png";
const CENTRE_STATIC =
  "https://ik.imagekit.io/5vv5pw26q/Untitleddasdadvvvsdsdsdasdsdsdassdsdasas.png";
const CENTRE_INSTALL =
  "https://ik.imagekit.io/5vv5pw26q/Untitleddasdadvvvsdsdsdasdsdsdas.png";
const ARTICLE =
  "data/nex-customer-education/floating-stairs-real-installation-from-the-wall.md";

function wallFixedDesc() {
  return `IMAGE IDENTITY

Image Name:
Floating Staircase — Wall-Fixed Installation (realistic UK residential context)

Category:
Customer Education > Staircase Types > Floating / Cantilever > Real Installation > Wall-Fixed

Sub Category:
Wall-fixed cantilever floating staircase installation in progress — plasterboard wall context, unfinished floor, boxed oak treads being slid onto concealed steel arms from the ground upward, powder-coated steel stringer chemically anchored to structural wall.

Primary Style:
Documentary architectural reference (realistic installation)

Secondary Style:
Educational article primary image

Photographic Style:
Realistic architectural interior render / documentary construction photography

Recommendation Type:
EDUCATIONAL — primary reference for the "Floating Stairs – How a Real Installation Actually Works" article

Belongs In:
staircase_brain (INTERNAL staircase types · floating / cantilever · real installation)

Educational Article:
${ARTICLE}

IMAGE DESCRIPTION

Realistic UK residential installation of a wall-fixed floating staircase. The image corrects the impression left by marketing photos: the lower stringer is fixed HARD AGAINST A FLAT STRUCTURAL WALL, installers fit oak treads from the ground upward while kneeling on the floor, and the landing above is supported by the upper structure — not floating unsupported in mid-air.

Visible construction reality:
- Plasterboard wall context (the flat structural wall that carries the cantilever moment)
- Unfinished floor typical of an in-progress installation
- Boxed oak treads (hollow cavity construction) being fitted onto concealed steel arms
- Powder-coated steel stringer chemically anchored to the wall
- Installers on the ground fitting from bottom upward
- Landing frame tied into the upper floor structure

Installation order captured: (1) steel stringer fixed to wall · (2) landing frame installed above · (3) tread support arms checked with laser level · (4) oak treads slid on from the front · (5) hidden fixings tightened (grub screws or threaded inserts from underneath or the side) · (6) final alignment before glass or balustrade fit.

OBJECT DETECTION

PRIMARY OBJECTS
- Wall-fixed steel stringer (powder-coated black typical)
- Concealed steel tread support arms projecting from stringer
- Boxed oak treads (hollow cavity slides over steel arm)
- Landing frame above
- Installer(s) at floor level fitting treads
- Flat structural wall (plasterboard finish over blockwork / concrete / steel frame)

SECONDARY OBJECTS
- Unfinished floor
- Fixings visible during install (grub screws · threaded inserts · chemical anchors)
- Laser level or measuring equipment

BACKGROUND OBJECTS
- UK residential interior mid-construction

MATERIAL ANALYSIS

Primary Material:
Structural steel plate stringer (10-15 mm typical) + powder-coated finish + welded steel tread arms + boxed hollow oak treads

Wall Type:
Flat structural wall (concrete · blockwork · steel frame) with plasterboard finish. Chemically anchored fixings. A pure plasterboard partition cannot carry a floating staircase.

CAMERA INFORMATION

Image Orientation:
Portrait

Camera Position:
Eye Level or slightly lower (documenting install activity from the floor)

View:
Realistic mid-installation reference view

Composition:
Documentary composition emphasising the actual wall-fixed geometry and installation direction

LIGHTING

Primary Lighting:
Neutral construction-site lighting or warm interior render lighting

QUALITY

Realism:
Ultra photorealistic

Rendering:
Realistic architectural interior visualisation

SETTING

Primary Setting:
UK residential interior mid-installation

AI REPRODUCTION RULES

MUST KEEP
- Wall-fixed geometry (lower stringer HARD AGAINST flat structural wall)
- Boxed oak treads with visible construction character
- Installation-in-progress context (unfinished floor · installers at floor level)
- Correct installation direction (bottom-up)
- Realistic UK residential construction context

DO NOT CHANGE
- The wall-fixed principle
- The realistic install-in-progress framing
- Educational purpose

ALLOWED MODIFICATIONS
Users may change:
- Oak variant (American White Oak · European Oak · Walnut)
- Steel finish colour (black · grey · natural mill)
- Wall finish (plasterboard · plaster · concrete face)
- Presence / absence of installers in frame

MASTER AI PROMPT

Ultra photorealistic realistic architectural render of a UK residential floating staircase installation in progress. Wall-fixed geometry — lower stringer fixed HARD against a flat structural wall (plasterboard finish over concrete / blockwork / steel frame with chemical anchors). Powder-coated black steel stringer with concealed welded tread arms. Boxed hollow oak treads being slid onto the steel arms from the ground upward by installers kneeling on the unfinished floor. Landing frame above tied into the upper floor structure. Realistic mid-installation context (unfinished floor · construction lighting · installers present or implied). Corrects the marketing impression that floating stairs assemble in mid-air. Used as the primary reference for the NEX "Floating Stairs – How a Real Installation Actually Works" education article.`;
}

function centreStaticDesc() {
  return `IMAGE IDENTITY

Image Name:
Floating Staircase — Centre Support (mono-stringer variant)

Category:
Customer Education > Staircase Types > Floating / Cantilever > Real Installation > Centre-Support Variant

Sub Category:
Centre-support (mono-stringer) floating staircase — single stringer running under the centre line of each tread, treads cantilevering left and right of the stringer rather than out from a wall.

Primary Style:
Aspirational architectural reference (finished centre-support staircase)

Secondary Style:
Educational variant reference

Photographic Style:
Architectural interior photography

Recommendation Type:
EDUCATIONAL — variant reference for the "Real Installation" article showing the mono-stringer alternative to wall-fixed cantilever

Belongs In:
staircase_brain (INTERNAL staircase types · floating / cantilever · centre-support variant)

Educational Article:
${ARTICLE}

IMAGE DESCRIPTION

A centre-support floating staircase — the mono-stringer alternative to a wall-fixed cantilever build. A single structural steel stringer runs beneath the centre line of each tread, so each tread cantilevers a short distance both LEFT and RIGHT of the stringer rather than out from a wall.

When centre-support is chosen over wall-fixed:
- No strong wall available for chemical anchoring
- Staircase placed centrally in the room rather than hugged to a wall
- Design intent is a fully sculptural staircase visible from both sides
- Mono-stringer becomes the visible structural feature rather than being hidden

Visible product characteristics of the finished centre-support staircase: single powder-coated steel mono-stringer under the tread centre line · boxed oak treads either side of the stringer · glass balustrades or slim contemporary balusters typical · concealed under-tread LED lighting optional.

OBJECT DETECTION

PRIMARY OBJECTS
- Single powder-coated steel mono-stringer running under tread centre line
- Boxed oak treads cantilevering left and right of the stringer
- Handrail
- Balustrade (glass or slim contemporary)
- Newel or base fixing where the stringer meets floor

SECONDARY OBJECTS
- Concealed LED lighting (if present)
- Interior wall or open-plan context

BACKGROUND OBJECTS
- Contemporary residential interior

MATERIAL ANALYSIS

Primary Material:
Structural steel mono-stringer + boxed hollow oak treads

Finish Character:
Steel: powder-coated typically black or grey. Oak: furniture-grade interior finish.

CAMERA INFORMATION

Image Orientation:
Portrait

Camera Position:
Eye Level

View:
Full centre-support staircase reference view

Composition:
Feature composition emphasising the mono-stringer geometry (single support under the treads visible from below)

LIGHTING

Primary Lighting:
Warm interior ambient light

QUALITY

Realism:
Ultra photorealistic

Rendering:
Architectural interior visualisation

SETTING

Primary Setting:
Contemporary residential interior — the setting typical for a centre-support floating staircase

AI REPRODUCTION RULES

MUST KEEP
- Centre-support mono-stringer geometry (single support under tread centre line)
- Treads cantilevering LEFT and RIGHT of the stringer (not from a wall)
- Boxed oak tread character
- Sense of sculptural centre-of-room placement

DO NOT CHANGE
- The centre-support principle (do NOT change to wall-fixed cantilever)
- Educational variant purpose

ALLOWED MODIFICATIONS
Users may change:
- Oak variant
- Steel finish colour
- Balustrade style (glass · stainless · timber)
- Interior context

MASTER AI PROMPT

Ultra photorealistic architectural interior render of a CENTRE-SUPPORT floating staircase — single powder-coated steel mono-stringer running beneath the centre line of each boxed hollow oak tread, treads cantilevering a short distance both LEFT and RIGHT of the stringer rather than out from a wall. Sculptural centre-of-room placement · optional glass balustrades or slim contemporary balusters · optional concealed under-tread LED lighting · warm interior ambient light · premium architectural interior visualisation. Used as the CENTRE-SUPPORT variant reference alongside the wall-fixed primary in the NEX "Floating Stairs – How a Real Installation Actually Works" education article.`;
}

function centreInstallDesc() {
  return `IMAGE IDENTITY

Image Name:
Centre-Support Floating Staircase — Installation In Progress (metal + wooden step assembly)

Category:
Customer Education > Staircase Types > Floating / Cantilever > Real Installation > Centre-Support Variant > Installation

Sub Category:
In-progress installation of a centre-support floating staircase — mono-stringer being set, wooden steps being assembled onto the metal supports.

Primary Style:
Documentary architectural reference (in-progress installation)

Secondary Style:
Educational variant reference

Photographic Style:
Realistic architectural interior render / documentary construction photography

Recommendation Type:
EDUCATIONAL — variant reference showing the installation reality of the centre-support system

Belongs In:
staircase_brain (INTERNAL staircase types · floating / cantilever · centre-support variant · installation)

Educational Article:
${ARTICLE}

IMAGE DESCRIPTION

Installation-in-progress view of a centre-support floating staircase. The single mono-stringer is being set into the floor and structural connections, and wooden steps are being assembled onto the metal supports that project from the stringer. Companion in-progress view alongside the finished centre-support reference.

Visible construction reality:
- Single mono-stringer under construction / being positioned
- Metal step supports projecting from the stringer
- Wooden (oak typical) steps being fitted onto the supports
- Realistic construction context (fixings visible · unfinished surrounding surfaces · installer activity)

Serves to reinforce that centre-support builds share the same "boxed oak tread over steel arm" mechanism as wall-fixed builds — only the stringer geometry changes.

OBJECT DETECTION

PRIMARY OBJECTS
- Mono-stringer being set
- Metal step supports projecting from stringer
- Wooden steps being fitted
- Installation fixings (bolts · welds · anchors)

SECONDARY OBJECTS
- Installer activity or tools
- Adjacent wall / floor context

BACKGROUND OBJECTS
- Residential interior mid-installation

MATERIAL ANALYSIS

Primary Material:
Structural steel mono-stringer + welded steel step supports + wooden (oak typical) steps

CAMERA INFORMATION

Image Orientation:
Portrait or landscape (documentary install view)

Camera Position:
Angled construction reference

View:
Installation-in-progress view

Composition:
Documentary composition showing the mono-stringer geometry being assembled

LIGHTING

Primary Lighting:
Construction-site or realistic render lighting

QUALITY

Realism:
Ultra photorealistic

Rendering:
Realistic architectural interior visualisation

SETTING

Primary Setting:
Residential interior mid-installation of a centre-support floating staircase

AI REPRODUCTION RULES

MUST KEEP
- Centre-support mono-stringer geometry
- Installation-in-progress context (not a finished marketing shot)
- Metal + wooden step assembly clearly readable
- Companion role to the finished centre-support reference

DO NOT CHANGE
- The centre-support principle
- The in-progress framing
- Educational purpose

ALLOWED MODIFICATIONS
Users may change:
- Oak variant
- Steel finish colour
- Interior context

MASTER AI PROMPT

Ultra photorealistic realistic architectural render of a centre-support floating staircase installation in progress. Single powder-coated steel mono-stringer being set into position, welded metal step supports projecting from the stringer, wooden (oak typical) steps being assembled onto the supports. Realistic residential mid-installation context (fixings visible · installer activity · surrounding surfaces unfinished). Companion in-progress reference alongside the finished centre-support variant in the NEX "Floating Stairs – How a Real Installation Actually Works" education article.`;
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
  console.log("NEX Education Batch 18 — Real Installation (wall-fixed + centre-support variant)\n=============================================================================\n");

  const rows = [
    { url: WALL_FIXED,      desc: wallFixedDesc(),     notes: "Primary reference · wall-fixed floating staircase realistic installation · used in real-installation article", label: "wall_fixed         " },
    { url: CENTRE_STATIC,   desc: centreStaticDesc(),  notes: "Variant reference · centre-support (mono-stringer) floating staircase · finished view", label: "centre_static      " },
    { url: CENTRE_INSTALL,  desc: centreInstallDesc(), notes: "Variant reference · centre-support (mono-stringer) floating staircase · installation in progress", label: "centre_install     " },
  ];

  for (const r of rows) {
    const res = await save(r.url, r.desc, r.notes);
    console.log("  " + r.label, res.ok ? "SAVED" : `ERROR: ${res.error}`);
  }

  console.log("\nFinal row states:\n");
  const manifestPath = path.join(process.cwd(), "data", "nex-image-manifest.json");
  const manifest = JSON.parse(await fs.readFile(manifestPath, "utf8"));
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
  console.log("\nBatch 18 complete.");
}

main().catch((e) => { console.error(e); process.exit(1); });
