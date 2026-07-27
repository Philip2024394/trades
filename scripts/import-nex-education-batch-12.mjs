#!/usr/bin/env node
// scripts/import-nex-education-batch-12.mjs
//
// Saves the 2 sibling drawer-storage-staircase images for the "Drawer
// Storage Staircases" article (Philip 2026-07-27).
//
// New sibling type: sibling_state_variation — same design, different
// angle/state (used to teach that the drawers virtually disappear when
// closed while showing the storage capability of the design).
//
// Article 2 ("When Is the Right Time to Replace Your Garden Staircase")
// has no paired image supplied — no manifest entry required (per
// ADR-0024, only images with a URL are catalogued).

import fs from "node:fs/promises";
import path from "node:path";

const API = "http://localhost:3008/api/admin/image-tagger/save";

const DRAWERS_A =
  "https://ik.imagekit.io/5vv5pw26q/ChatGPT%20Image%20Jul%2027,%202026,%2003_07_43%20PM.png";
const DRAWERS_B =
  "https://ik.imagekit.io/5vv5pw26q/ChatGPT%20Image%20Jul%2027,%202026,%2007_21_48%20PM.png";
const ARTICLE = "data/nex-customer-education/drawer-storage-staircases.md";

const commonKnowledge = `Design pattern: pull-out drawers integrated into the riser section of each step, transforming otherwise wasted riser cavity into hidden storage for everyday items (shoes · slippers · children's toys · dog leads · gloves and hats · cleaning cloths · tools · keys and household essentials).

Why the drawers don't open while walking:
- Slight DOWNWARD angle towards the back of the staircase — gravity naturally keeps each drawer closed
- FOUR concealed magnetic catches per drawer provide a strong holding force
- Combined rearward angle + multiple magnets keeps drawers firmly shut under the vibrations of everyday foot traffic

Tread thickness increase required (structural + drawer mechanism accommodation):
- Standard painted softwood staircase: ~35 mm tread
- Hardwood walnut staircase with storage: 40–45 mm tread (walnut is denser, needs less added thickness)
- Softwood staircase with storage: 45–55 mm tread (softwoods need more thickness for same rigidity)
- Mahogany falls between walnut and softwood depending on span
- Final dimensions depend on design · timber species · span · loading · drawer system

Drawer front finishing options (all coordinated with the staircase):
- Oak · Walnut · Mahogany · Pine · painted finishes · modern matte colours

Best-fit contexts: hallways · townhouses · apartments · family homes · loft conversions · under-stair storage projects · any home where storage space is limited and the staircase can carry a second function.

Opening mechanism: concealed finger pull or integrated handle · quality drawer runners for smooth glide · magnets automatically engage on close.`;

function description(sibling_url, side_label) {
  return `IMAGE IDENTITY

Image Name:
Drawer Storage Staircase — ${side_label}

Category:
Customer Education > Staircase Design Techniques > Storage Integration > Riser Drawers

Sub Category:
Hidden pull-out drawers integrated into the riser of each staircase step · thicker treads · rearward angle + 4 magnetic catches for accidental-open prevention

Primary Style:
Aspirational architectural reference with construction knowledge overlay

Secondary Style:
Educational sibling comparison (same design, different angle/state)

Photographic Style:
Architectural interior photography

Recommendation Type:
EDUCATIONAL — one of two reference views for the "Drawer Storage Staircases" article

Belongs In:
staircase_brain (staircase design techniques + under-stair storage adjacency)

Educational Article:
${ARTICLE}

Sibling Image (sibling_state_variation):
${sibling_url}

IMAGE DESCRIPTION

Reference view of a drawer-storage staircase — the design where each riser conceals a shallow pull-out drawer. ${side_label === "context A" ? "First" : "Second"} of a paired sibling set showing the design from a different angle / state, used together in the paired education article to teach both the storage capability and the hidden-when-closed appearance.

${commonKnowledge}

OBJECT DETECTION

PRIMARY OBJECTS
- Staircase treads (thicker than standard — 40-55 mm depending on species)
- Staircase risers with integrated drawer fronts
- Handrail
- Balustrade
- Newel post
- Coordinated timber finish on drawer fronts (indistinguishable from ordinary risers when closed)

SECONDARY OBJECTS
- Concealed finger pull / integrated handle on drawer fronts
- Adjacent hallway context

BACKGROUND OBJECTS
- Interior environment (hallway · townhouse · apartment · loft conversion · family home)

MATERIAL ANALYSIS

Primary Material:
Timber staircase — species can vary (Oak · Walnut · Mahogany · Pine · painted finishes · matte modern colours). Drawer fronts finished to match the rest of the staircase for the hidden-in-plain-sight effect.

Structural Note:
Treads are noticeably thicker than a standard 35 mm tread — 40-55 mm depending on timber species — because the drawer mechanism requires added strength and rigidity. This heavier tread character is often celebrated as a premium appearance advantage.

CAMERA INFORMATION

Image Orientation:
Portrait

Camera Position:
Eye Level

View:
Full staircase reference view with drawer detail readable

Composition:
Feature composition suitable for direct comparison with the sibling view

LIGHTING

Primary Lighting:
Warm interior ambient light — should reveal drawer-front lines and finger-pull detail

QUALITY

Realism:
Ultra photorealistic

Rendering:
Architectural interior visualisation

SETTING

Primary Setting:
Residential interior (hallway · townhouse · apartment · loft conversion) where storage space is limited

AI REPRODUCTION RULES

MUST KEEP
- Drawer-in-riser design pattern clearly present
- Thicker-than-standard tread character
- Drawer fronts finished to match the rest of the staircase
- Sibling-pair relationship with the companion state view
- Sense of the drawers being an intentional design feature, not an afterthought

DO NOT CHANGE
- The drawer-storage design pattern
- The sibling-pair relationship
- Educational purpose

ALLOWED MODIFICATIONS
Users may change:
- Timber species and finish (Oak · Walnut · Mahogany · Pine · painted · matte modern)
- Balustrade style
- Newel post design
- Interior context (hallway · townhouse · apartment · loft conversion)
- Drawer count or arrangement across risers

MASTER AI PROMPT

Ultra photorealistic architectural interior render of a drawer-storage staircase — the design where each riser conceals a shallow pull-out drawer. Treads are noticeably thicker than a standard 35 mm tread (40-55 mm depending on timber species) because the drawer mechanism requires added strength and rigidity. Each drawer sits at a slight downward rearward angle so gravity keeps it closed, backed up by four concealed magnetic catches per drawer. Drawer fronts finished to match the rest of the staircase timber so they read as ordinary risers when closed. Warm interior ambient light revealing drawer-front lines and finger-pull detail · premium architectural interior visualisation. Used as ${side_label} of a paired sibling set (sibling_state_variation) in the NEX "Drawer Storage Staircases – Hidden Storage in Every Step" education article.`;
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
  console.log("NEX Education Batch 12 — Drawer Storage Staircase Sibling Pair\n==============================================================\n");

  const rows = [
    {
      url: DRAWERS_A,
      desc: description(DRAWERS_B, "context A"),
      notes: "Drawer storage staircase · sibling state variation A · paired with " + DRAWERS_B,
      label: "drawers_context_a ",
    },
    {
      url: DRAWERS_B,
      desc: description(DRAWERS_A, "context B"),
      notes: "Drawer storage staircase · sibling state variation B · paired with " + DRAWERS_A,
      label: "drawers_context_b ",
    },
  ];

  for (const r of rows) {
    const res = await save(r.url, r.desc, r.notes);
    console.log("  " + r.label, res.ok ? "SAVED" : `ERROR: ${res.error}`);
  }

  console.log("\nWiring sibling_state_variation (drawers A ↔ B)…");
  const manifestPath = path.join(process.cwd(), "data", "nex-image-manifest.json");
  const manifest = JSON.parse(await fs.readFile(manifestPath, "utf8"));
  const a = manifest.images[DRAWERS_A];
  const b = manifest.images[DRAWERS_B];
  if (a && b) {
    a.family_tree = a.family_tree || { parent_url: undefined, children: [] };
    b.family_tree = b.family_tree || { parent_url: undefined, children: [] };
    const stampA = {
      type: "sibling_state_variation",
      url: DRAWERS_B,
      generated_at: new Date().toISOString(),
      generated_by: "philip",
      notes: "Companion view of the drawer-storage staircase design · same design, different angle/state",
    };
    const stampB = {
      type: "sibling_state_variation",
      url: DRAWERS_A,
      generated_at: new Date().toISOString(),
      generated_by: "philip",
      notes: "Companion view of the drawer-storage staircase design · same design, different angle/state",
    };
    if (!a.family_tree.children.some((c) => c.url === DRAWERS_B)) a.family_tree.children.push(stampA);
    if (!b.family_tree.children.some((c) => c.url === DRAWERS_A)) b.family_tree.children.push(stampB);
    manifest.generated_at = new Date().toISOString();
    await fs.writeFile(manifestPath, JSON.stringify(manifest, null, 2), "utf8");
    console.log("  ✓ Context A knows about Context B");
    console.log("  ✓ Context B knows about Context A");
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
  console.log("\nBatch 12 complete.");
}

main().catch((e) => { console.error(e); process.exit(1); });
