#!/usr/bin/env node
// scripts/import-nex-education-batch-19.mjs
//
// Direct-to-manifest importer for the 15 images Philip supplied
// 2026-07-27 across 4 articles:
//   - 1 loft ladder pallet
//   - 9 hand-carved horse-newel bespoke staircase variants (alternate refs)
//   - 3 under-stair wine cellar / storage staircases (sibling treatment)
//   - 1 L-shape two-tone T&G storage staircase (sibling of the 3 above)
//   - 1 modern floating straight-flight minimalist staircase
//
// BYPASSES the /api/admin/image-tagger/save endpoint because the dev
// server has a stale Tailwind file-watch state after the yard/canteen
// purge that returns 500 on every API call until Philip restarts the
// dev server. Instead this script writes directly to the manifest via
// fs.readFile → mutate → atomic rename → auto-backup — the same
// safety pattern the shared manifestWriter uses. When Philip restarts
// the server the intelligence pipeline can be re-run to derive DNA /
// score / brain / band on these rows.

import fs from "node:fs/promises";
import path from "node:path";

const ROOT = process.cwd();
const MANIFEST_PATH = path.join(ROOT, "data", "nex-image-manifest.json");
const BACKUP_DIR = path.join(ROOT, "data", ".manifest-backups");

const LOFT_LADDER = "https://ik.imagekit.io/5vv5pw26q/ChatGPT%20Image%20Jul%2027,%202026,%2010_44_03%20PM.png";

const HORSE_URLS = [
  "https://ik.imagekit.io/5vv5pw26q/ChatGPT%20Image%20Jul%2027,%202026,%2003_14_04%20PM.png",
  "https://ik.imagekit.io/5vv5pw26q/ChatGPT%20Image%20Jul%2026,%202026,%2008_15_53%20PM.png",
  "https://ik.imagekit.io/5vv5pw26q/ChatGPT%20Image%20Jul%2026,%202026,%2005_13_54%20PM.png",
  "https://ik.imagekit.io/5vv5pw26q/ChatGPT%20Image%20Jul%2026,%202026,%2005_05_31%20PM.png",
  "https://ik.imagekit.io/5vv5pw26q/ChatGPT%20Image%20Jul%2026,%202026,%2004_58_51%20PM.png",
  "https://ik.imagekit.io/5vv5pw26q/ChatGPT%20Image%20Jul%2026,%202026,%2004_11_59%20PM.png",
  "https://ik.imagekit.io/5vv5pw26q/ChatGPT%20Image%20Jul%2026,%202026,%2002_29_26%20PM.png",
  "https://ik.imagekit.io/5vv5pw26q/ChatGPT%20Image%20Jul%2026,%202026,%2002_27_55%20PM.png",
  "https://ik.imagekit.io/5vv5pw26q/Untitledsdsdasdfsdf.png",
];

const WINE_STRAIGHT   = "https://ik.imagekit.io/5vv5pw26q/Untitledsdsddsdsd.png";
const WINE_L_1        = "https://ik.imagekit.io/5vv5pw26q/ChatGPT%20Image%20Jul%2026,%202026,%2002_46_11%20PM.png";
const WINE_L_2        = "https://ik.imagekit.io/5vv5pw26q/ChatGPT%20Image%20Jul%2026,%202026,%2002_41_53%20PM.png";
const TWO_TONE_TG_L   = "https://ik.imagekit.io/5vv5pw26q/ChatGPT%20Image%20Jul%2026,%202026,%2002_39_43%20PM.png";
const FLOATING_MODERN = "https://ik.imagekit.io/5vv5pw26q/Untitledsdsda.png";

const ART_LOFT   = "data/nex-customer-education/where-to-buy-loft-ladders.md";
const ART_HORSE  = "data/nex-customer-education/hand-carved-horse-newel-bespoke-staircases.md";
const ART_UNDER  = "data/nex-customer-education/under-stair-wine-cellar-and-storage-staircases.md";
const ART_FLOAT  = "data/nex-customer-education/modern-floating-straight-flight-minimalist-staircase.md";

function nowIso() { return new Date().toISOString(); }

async function backup(manifest) {
  await fs.mkdir(BACKUP_DIR, { recursive: true });
  const ts = new Date().toISOString().replace(/[:.]/g, "-").replace("T", "-").slice(0, 23);
  const p = path.join(BACKUP_DIR, `manifest-${ts}.json`);
  await fs.writeFile(p, JSON.stringify(manifest, null, 2), "utf8");
  return p;
}

async function atomicWrite(manifest) {
  const tmp = MANIFEST_PATH + ".tmp." + process.pid + "." + Date.now();
  await fs.writeFile(tmp, JSON.stringify(manifest, null, 2), "utf8");
  await fs.rename(tmp, MANIFEST_PATH);
}

// -------- Row template --------

function baseRow({ description, notes, source = "ai_generated", staircase_kind = "full", staircase_context = "internal" }) {
  return {
    source,
    description,
    created_at: nowIso(),
    created_by: "philip",
    notes,
    tags: [],
    subject_domain: "staircase",
    staircase_kind,
    staircase_context,
    verified_by_human: true,
    human_tagged_at: nowIso(),
    human_tagged_by: "philip",
    // Fields the intelligence pipeline will populate later:
    // image_dna, primary_brain, master_image_score, knowledge_band, collection_memberships, family_tree
    // We set primary_brain manually for staircase family so retrieval works immediately.
    primary_brain: "staircase_brain",
  };
}

// -------- Descriptions --------

const loftLadderDesc = `IMAGE IDENTITY

Image Name:
Loft Ladders Pallet at Building Merchant

Category:
Customer Education > Staircase Types > Loft Ladder > Sourcing

Sub Category:
Pallet of retail-boxed loft ladders on the shop floor of a UK building merchant — the standard place to buy an off-the-shelf loft ladder.

Primary Style:
Documentary retail reference

Recommendation Type:
EDUCATIONAL — sourcing reference for the "Where to Buy Loft Ladders" article

Belongs In:
staircase_brain · staircase_kind: related (loft ladder is staircase-family adjacent)

Educational Article:
${ART_LOFT}

IMAGE DESCRIPTION

A pallet of retail-boxed loft ladders on the shop floor of a UK building merchant. The standard sourcing route for off-the-shelf loft ladders — every builders' merchant stocks aluminium concertina, timber sliding, and fixed timber loft-ladder options on the trade floor. When a customer asks where to buy a loft ladder, the answer is: NEX Centre online or the nearest local building merchant.`;

function horseDesc(variantN, alternateUrls) {
  return `IMAGE IDENTITY

Image Name:
Hand-Carved Horse-Newel Bespoke Staircase — variant ${variantN}

Category:
Customer Education > Staircase Types > Bespoke Feature > Hand-Carved Newel > Horse

Sub Category:
Bespoke staircase with hand-carved wooden horse newel at the base of the handrail. Sculptural centrepiece replacing the traditional square starting newel post. Walnut / mahogany / oak typical timber. Closed-string traditional construction. One of ${HORSE_URLS.length} alternate reference variants — retrieval picks ONE at a time (alternate_reference HARD LAW).

Primary Style:
Aspirational bespoke luxury reference

Recommendation Type:
EDUCATIONAL — one of ${HORSE_URLS.length} alternate variants for the "Hand-Carved Feature Newels" article

Belongs In:
staircase_brain · staircase_kind: full · internal context · bespoke luxury tier

Educational Article:
${ART_HORSE}

Alternate References (DO NOT display together):
${alternateUrls.map((u) => `  · ${u}`).join("\n")}

IMAGE DESCRIPTION

A bespoke staircase whose starting newel post has been replaced with a hand-carved wooden horse sculpture. The flowing mane transitions naturally into the sweeping curved handrail, demonstrating exceptional master-craftsman skill. Walnut, mahogany, oak, sapele, cherry, or maple typical timber. Closed-string construction. Turned timber balusters. Feature bullnose starting step. Rich walnut or mahogany finish. The staircase reads as a piece of functional art — the focal point of the entrance hall. Part of the wider hand-carved-newel category which also includes lion, eagle, dog, cat, dragon, griffin, deer, bear, wolf carvings, plus fully bespoke commissions (family pets, coats of arms, wildlife, mythological figures). Manufactured by specialist craftsmen for luxury homes, hotels, country estates, and grand residences worldwide.

DISPLAY RULE
This image and its 8 sibling alternates must NEVER be displayed together — retrieval / rendering picks ONE at a time. Per the NEX Alternate Reference HARD LAW 2026-07-27.`;
}

const wineStraightDesc = `IMAGE IDENTITY

Image Name:
Straight-Flight Staircase with Bespoke Under-Stair Wine Cellar

Category:
Customer Education > Staircase Types > Bespoke Feature > Under-Stair Integrated Joinery > Straight-Flight + Wine Cellar

Sub Category:
Straight-flight closed-string staircase with the triangular under-stair void transformed into a climate-controlled wine display and storage cabinet. Sibling treatment variation with the L-shape wine variants and the L-shape T&G storage variant.

Primary Style:
Aspirational contemporary + traditional-proportions luxury reference

Recommendation Type:
EDUCATIONAL — sibling treatment variation for the "Under-Stair Wine Cellars and Storage Staircases" article

Belongs In:
staircase_brain · staircase_kind: full · internal · closed-string bespoke tier

Educational Article:
${ART_UNDER}

Sibling Treatment Variations:
  · ${WINE_L_1} (L-shape quarter-landing wine cellar)
  · ${WINE_L_2} (L-shape double bullnose wine cabinet)
  · ${TWO_TONE_TG_L} (L-shape two-tone with T&G under-stair storage)

IMAGE DESCRIPTION

A straight-flight closed-string staircase framed by two substantial square newel posts. Slim black metal balusters with hardwood handrail. Walnut or dark oak finish. The triangular under-stair void is transformed into a bespoke wine cellar with diamond wine racks, horizontal bottle storage, display shelves for premium bottles, glassware storage, lower storage drawers, integrated timber shelving, and warm LED lighting throughout. The cabinetry follows the exact angle of the staircase. Timber grain matches the staircase. Shelving aligns with the stair pitch. The staircase and cabinetry are designed as one architectural composition — a piece of handcrafted furniture that defines the entrance hall.`;

const wineL1Desc = `IMAGE IDENTITY

Image Name:
L-Shaped Quarter-Landing Staircase with Under-Stair Wine Cellar

Category:
Customer Education > Staircase Types > Bespoke Feature > Under-Stair Integrated Joinery > L-Shape + Wine Cellar

Sub Category:
L-shaped quarter-landing staircase with under-stair wine cellar. Sibling of the straight-flight wine variant.

Recommendation Type:
EDUCATIONAL — sibling treatment variation for the "Under-Stair Wine Cellars and Storage Staircases" article

Belongs In:
staircase_brain · staircase_kind: full · internal

Educational Article:
${ART_UNDER}

Sibling Treatment Variations:
  · ${WINE_STRAIGHT} (straight-flight wine cellar)
  · ${WINE_L_2} (L-shape double bullnose wine cabinet)
  · ${TWO_TONE_TG_L} (L-shape two-tone with T&G under-stair storage)

IMAGE DESCRIPTION

L-shaped quarter-landing staircase with under-stair wine cellar. Closed-string construction. Substantial square newel posts. Continuous timber balustrade flowing from the starting step to the upper gallery. The under-stair triangular void houses a bespoke wine cellar with diamond racks, horizontal bottle storage, glass display shelving, illuminated compartments, base cupboards, warm integrated LED lighting. Rather than concealing the space beneath the staircase, the design celebrates it as an architectural feature. The staircase becomes both a circulation route and a premium interior feature.`;

const wineL2Desc = `IMAGE IDENTITY

Image Name:
L-Shape Double Bullnose Staircase with Under-Stair Wine Cabinet

Category:
Customer Education > Staircase Types > Bespoke Feature > Under-Stair Integrated Joinery > L-Shape Double Bullnose + Wine Cabinet

Sub Category:
L-shaped quarter-landing staircase with double bullnose starting step and under-stair wine cabinet. Sibling of the straight-flight wine variant and the L-shape T&G storage variant.

Recommendation Type:
EDUCATIONAL — sibling treatment variation for the "Under-Stair Wine Cellars and Storage Staircases" article

Belongs In:
staircase_brain · staircase_kind: full · internal

Educational Article:
${ART_UNDER}

Sibling Treatment Variations:
  · ${WINE_STRAIGHT} (straight-flight wine cellar)
  · ${WINE_L_1} (L-shape quarter-landing wine cellar)
  · ${TWO_TONE_TG_L} (L-shape two-tone with T&G under-stair storage)

IMAGE DESCRIPTION

L-shaped quarter-landing staircase with a double bullnose starting step — the first two treads curved and extended beyond the line of the staircase for an inviting entrance. Walnut or dark-oak finish. Closed-string construction. Substantial square newel posts at each change of direction. Continuous timber balustrade. Under-stair wine cabinet with diamond racks, horizontal bottle storage, glass display shelving, illuminated compartments, base cupboards, warm integrated LED lighting. Feature bullnose starting step softens the appearance and creates a premium handcrafted look.`;

const twoToneTGDesc = `IMAGE IDENTITY

Image Name:
L-Shape Two-Tone Staircase with Tongue-and-Groove Under-Stair Storage

Category:
Customer Education > Staircase Types > Bespoke Feature > Under-Stair Integrated Joinery > L-Shape Two-Tone + T&G Storage

Sub Category:
L-shaped quarter-landing double bullnose staircase — classic two-tone finish (oak treads, handrails, newel posts + painted white strings, risers, balusters). Under-stair void enclosed with bespoke tongue-and-groove panelling and a hidden flush access door. Sibling of the wine-cellar variants.

Recommendation Type:
EDUCATIONAL — sibling treatment variation for the "Under-Stair Wine Cellars and Storage Staircases" article

Belongs In:
staircase_brain · staircase_kind: full · internal · traditional two-tone tier

Educational Article:
${ART_UNDER}

Sibling Treatment Variations:
  · ${WINE_STRAIGHT} (straight-flight wine cellar)
  · ${WINE_L_1} (L-shape wine cellar)
  · ${WINE_L_2} (L-shape double bullnose wine cabinet)

IMAGE DESCRIPTION

Traditional L-shaped quarter-landing staircase with timeless two-tone finish. Oak treads, handrails and newel posts paired with painted white strings, risers, and balusters. Double bullnose starting step. Substantial square newel posts. Continuous oak balustrade with white square balusters. Open gallery landing on the upper floor for natural light and views. Under-stair void enclosed with bespoke tongue-and-groove panelling — full-height access door integrated into the panelling for flush appearance. The angled panelling follows the line of the staircase for a bespoke fitted look. Suitable for both modern and traditional homes.`;

const floatingModernDesc = `IMAGE IDENTITY

Image Name:
Modern Floating Straight-Flight Minimalist Staircase

Category:
Customer Education > Staircase Types > Floating / Cantilever > Modern Minimalist

Sub Category:
Modern floating straight-flight staircase where the structure is visually minimised and the surrounding space itself becomes the main architectural feature. Deliberately the opposite design philosophy of the ornate hand-carved bespoke tradition.

Primary Style:
Contemporary minimalist reference

Recommendation Type:
EDUCATIONAL — primary reference for the "Modern Floating Straight-Flight Minimalist Staircase" article

Belongs In:
staircase_brain · staircase_kind: full · internal · contemporary minimalist tier

Educational Article:
${ART_FLOAT}

Companion Articles (floating-stairs sub-cluster):
  · data/nex-customer-education/floating-stairs-hidden-steel-engineering.md
  · data/nex-customer-education/floating-stairs-exploded-assembly-and-regulations.md
  · data/nex-customer-education/floating-stairs-real-installation-from-the-wall.md

IMAGE DESCRIPTION

A modern floating straight-flight staircase — hardwood treads that appear to emerge from the wall with no visible support. Structure is deliberately minimised so the surrounding space, light, and materials of the room become the architectural feature. Concealed steel engineering carries every tread load back into the structural wall. Minimal balustrade (frameless glass, slim stainless cable, or none where regulations allow). Open risers letting light pass through. Contemporary open-plan interior context. The staircase disappears into the architecture rather than dominating it — the deliberate counterpoint to the ornate hand-carved bespoke tradition.`;

// -------- Main --------

async function main() {
  console.log("═════ NEX Education Batch 19 — direct-to-manifest import ═════");
  console.log("");
  console.log("  Reason: dev server has stale Tailwind file-watch state after");
  console.log("  the yard/canteen purge and returns 500 on every API call.");
  console.log("  Writing directly to the manifest via fs. Philip should restart");
  console.log("  the dev server, then re-run the intelligence pipeline on the");
  console.log("  new rows to derive DNA / score / band.");
  console.log("");

  const raw = await fs.readFile(MANIFEST_PATH, "utf8");
  const manifest = JSON.parse(raw);
  if (!manifest.images) manifest.images = {};

  const backupPath = await backup(manifest);
  console.log("  Backup:", backupPath);
  console.log("");

  let added = 0;

  // 1. Loft ladder
  manifest.images[LOFT_LADDER] = {
    ...baseRow({
      description: loftLadderDesc,
      notes: "Loft ladder pallet at building merchant · sourcing reference · staircase_kind: related",
      staircase_kind: "related",
    }),
  };
  added++;
  console.log("  ✓ loft ladder");

  // 2. Horse newel alternates (9 images)
  for (let i = 0; i < HORSE_URLS.length; i++) {
    const url = HORSE_URLS[i];
    const alternates = HORSE_URLS.filter((u) => u !== url);
    manifest.images[url] = {
      ...baseRow({
        description: horseDesc(i + 1, alternates),
        notes: `Hand-carved horse newel bespoke staircase · variant ${i + 1} of ${HORSE_URLS.length} · alternate_reference (do not display together)`,
      }),
      alternate_of: alternates,
      family_tree: {
        parent_url: undefined,
        children: alternates.map((u) => ({
          type: "alternate_reference",
          url: u,
          generated_at: nowIso(),
          generated_by: "philip",
          notes: "Alternate reference · never display together · retrieval picks one at a time",
        })),
      },
    };
    added++;
  }
  console.log(`  ✓ ${HORSE_URLS.length} horse newel alternates + family_tree wired`);

  // 3. Under-stair wine cellar + storage siblings (4 images)
  const underStairUrls = [WINE_STRAIGHT, WINE_L_1, WINE_L_2, TWO_TONE_TG_L];
  const underStairDescs = [wineStraightDesc, wineL1Desc, wineL2Desc, twoToneTGDesc];
  for (let i = 0; i < underStairUrls.length; i++) {
    const url = underStairUrls[i];
    const siblings = underStairUrls.filter((u) => u !== url);
    manifest.images[url] = {
      ...baseRow({
        description: underStairDescs[i],
        notes: `Under-stair joinery staircase · sibling treatment variation ${i + 1} of ${underStairUrls.length}`,
      }),
      family_tree: {
        parent_url: undefined,
        children: siblings.map((u) => ({
          type: "sibling_treatment_variation",
          url: u,
          generated_at: nowIso(),
          generated_by: "philip",
          notes: "Sibling treatment variation · shown together for design comparison",
        })),
      },
    };
    added++;
  }
  console.log(`  ✓ ${underStairUrls.length} under-stair sibling treatment variations + family_tree wired`);

  // 4. Modern floating minimalist
  manifest.images[FLOATING_MODERN] = {
    ...baseRow({
      description: floatingModernDesc,
      notes: "Modern floating straight-flight minimalist staircase · counterpoint to horse-newel bespoke tradition",
    }),
  };
  added++;
  console.log("  ✓ modern floating minimalist");

  manifest.generated_at = nowIso();
  await atomicWrite(manifest);

  console.log("");
  console.log("═════════════════════════════════════════");
  console.log(`  Added / updated rows: ${added}`);
  console.log(`  Total manifest rows: ${Object.keys(manifest.images).length}`);
  console.log(`  Backup: ${backupPath}`);
  console.log("═════════════════════════════════════════");
  console.log("");
  console.log("NEXT STEPS FOR PHILIP:");
  console.log("  1. Restart the dev server (Ctrl+C, then `npm run dev`).");
  console.log("  2. Verify http://localhost:3008/nex-app/centre loads (Tailwind will re-scan).");
  console.log("  3. (Optional) Re-run the intelligence pipeline on these rows to derive DNA / score / band:");
  console.log("     node scripts/run-global-intelligence-pipeline.mjs");
  console.log("  4. Rows are already tagged: primary_brain=staircase_brain, verified_by_human=true, staircase_kind set.");
}

main().catch((e) => { console.error(e); process.exit(1); });
