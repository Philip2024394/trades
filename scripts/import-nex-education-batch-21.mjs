#!/usr/bin/env node
// scripts/import-nex-education-batch-21.mjs · direct-to-manifest.
// 3 more staircase back-panel images (Philip 2026-07-27).

import fs from "node:fs/promises";
import path from "node:path";

const ROOT = process.cwd();
const MP = path.join(ROOT, "data", "nex-image-manifest.json");
const BD = path.join(ROOT, "data", ".manifest-backups");

const RAISED_PANEL_DETAIL = "https://ik.imagekit.io/5vv5pw26q/ChatGPT%20Image%20Jul%2026,%202026,%2012_28_47%20PM.png";
const RAISED_PANEL_ONSTAIR = "https://ik.imagekit.io/5vv5pw26q/ChatGPT%20Image%20Jul%2026,%202026,%2012_40_08%20PM.png";
const TG_SHEETING = "https://ik.imagekit.io/5vv5pw26q/Untitledsdfsdfdff-removebg-preview.png";

const ART_RAISED = "data/nex-customer-education/staircase-back-panel-three-panel-raised-fielded.md";
const ART_TG = "data/nex-customer-education/staircase-back-tongue-and-groove-sheeting.md";

const nowIso = () => new Date().toISOString();

async function backup(m) {
  await fs.mkdir(BD, { recursive: true });
  const ts = new Date().toISOString().replace(/[:.]/g, "-").replace("T", "-").slice(0, 23);
  const p = path.join(BD, `manifest-${ts}.json`);
  await fs.writeFile(p, JSON.stringify(m, null, 2), "utf8");
  return p;
}
async function atomicWrite(m) {
  const t = MP + ".tmp." + process.pid + "." + Date.now();
  await fs.writeFile(t, JSON.stringify(m, null, 2), "utf8");
  await fs.rename(t, MP);
}

function base({ description, notes, article, kind = "full" }) {
  return {
    source: "ai_generated",
    description,
    created_at: nowIso(),
    created_by: "philip",
    notes,
    tags: [],
    subject_domain: "staircase",
    staircase_kind: kind,
    staircase_context: "internal",
    verified_by_human: true,
    human_tagged_at: nowIso(),
    human_tagged_by: "philip",
    primary_brain: "staircase_brain",
    educational_article: article,
    // Clear any prior not_a_staircase flag if this URL was previously auto-marked
    not_a_staircase: false,
  };
}

const raisedDetailDesc = `IMAGE IDENTITY
Image Name: Three-Panel Raised and Fielded Timber Back Panel — Design Detail
Category: Customer Education > Staircase Types > Bespoke Feature > Back / Rear Panel > Three-Panel Raised & Fielded
Sub Category: Traditional three-panel raised-and-fielded joinery design suitable as the back / rear panel of a staircase. Solid outer frame (stiles + rails) with three equal-width raised and fielded panels + decorative moulded panel beads + symmetrical proportions.
Recommendation Type: EDUCATIONAL — sibling detail view of the raised-and-fielded back-panel treatment
Belongs In: staircase_brain · staircase_kind: full · internal · bespoke joinery tier
Educational Article: ${ART_RAISED}

Sibling Treatment Variation:
${RAISED_PANEL_ONSTAIR} (same treatment applied to full rear face of a straight-flight staircase)
${TG_SHEETING} (alternative back-treatment: T&G sheeting)

IMAGE DESCRIPTION
Detail view of a three-panel raised and fielded timber panel, showing the traditional joinery adapted for use as a staircase back / rear panel. Design components: solid outer frame (stiles + rails) · three equal-width raised and fielded panels · decorative moulded panel beads surrounding each panel · symmetrical proportions. Vertical panels make the staircase appear taller. Suited to oak / walnut / mahogany / maple / painted hardwood staircases. Timeless proportions complement traditional AND transitional interiors. Same joinery discipline as internal doors · wall panelling · cabinetry · library joinery · traditional entrance halls. Moulded profiles create subtle shadow lines that add depth and craftsmanship. When manufactured from the same timber as the staircase (treads, strings, newel posts, handrails, side panels) the finished staircase reads as one integrated piece of bespoke furniture.`;

const raisedOnStairDesc = `IMAGE IDENTITY
Image Name: Three-Panel Raised Back Panel — Straight-Flight Application
Category: Customer Education > Staircase Types > Bespoke Feature > Back / Rear Panel > Three-Panel Raised & Fielded
Sub Category: Three-panel raised design applied at full height as the rear side panel of a straight-flight staircase. Sibling view to the panel-only detail image.
Recommendation Type: EDUCATIONAL — sibling view showing the raised-panel treatment applied to a real staircase context
Belongs In: staircase_brain · staircase_kind: full · internal · bespoke joinery tier
Educational Article: ${ART_RAISED}

Sibling Treatment Variation:
${RAISED_PANEL_DETAIL} (detail view of the three-panel raised joinery design)
${TG_SHEETING} (alternative back-treatment: T&G sheeting)

IMAGE DESCRIPTION
The rear side panel of a straight-flight staircase enclosed with three full-height raised panels within a solid timber frame. Balanced, timeless, furniture-quality finish complementing both traditional and contemporary homes. Moulded profiles add depth and shadow · symmetrical layout gives the staircase a refined finish. Designed to match internal doors · skirting boards · architraves · newel posts. Available in oak · walnut · mahogany · maple · painted hardwood. Ideal for homes where the back of the staircase is fully visible from adjacent living spaces. Reads as bespoke architectural joinery rather than a plain enclosure.`;

const tgSheetingDesc = `IMAGE IDENTITY
Image Name: T&G Sheeting — Straight-Flight Staircase Back Panel
Category: Customer Education > Staircase Types > Bespoke Feature > Back / Rear Panel > Tongue & Groove Sheeting
Sub Category: Vertical tongue-and-groove timber sheeting fitted as the rear face of a straight-flight staircase. Alternative back-panel treatment to raised-and-fielded joinery — cleaner, more contemporary, warmer feel.
Recommendation Type: EDUCATIONAL — primary reference for the T&G back-panel article · alternative to the raised-panel treatment
Belongs In: staircase_brain · staircase_kind: full · internal · bespoke joinery tier
Educational Article: ${ART_TG}

Alternative Back-Panel Treatment (raised & fielded):
${RAISED_PANEL_DETAIL}
${RAISED_PANEL_ONSTAIR}

IMAGE DESCRIPTION
Vertical tongue-and-groove (T&G) timber sheeting fitted as the rear face of a straight-flight staircase. Interlocking T&G profile allows each board to fit tightly together for a seamless timber finish with minimal visible gaps. Fixed to a timber framework behind the staircase string or directly to supporting battens. Vertical orientation enhances the perception of ceiling height and gives the staircase a modern architectural look. Timber species commonly used: Yellow Pine · American Oak · Tasmanian Oak · Walnut · Cedar · engineered timber products. Finish options: natural · stained · lacquered · painted. Boards must be acclimatised before installation and finished with an appropriate coating to protect against moisture, wear, and everyday use. Cleaner, warmer alternative to the raised-and-fielded three-panel treatment. Suits both traditional and contemporary interiors.`;

async function main() {
  console.log("═════ NEX Education Batch 21 — 3 back-panel images (direct-to-manifest) ═════\n");
  const m = JSON.parse(await fs.readFile(MP, "utf8"));
  const bp = await backup(m);
  console.log("  Backup:", bp, "\n");

  m.images[RAISED_PANEL_DETAIL] = {
    ...base({
      description: raisedDetailDesc,
      notes: "Three-panel raised & fielded back panel · detail view · sibling with the on-staircase view",
      article: ART_RAISED,
    }),
    family_tree: {
      parent_url: undefined,
      children: [
        { type: "sibling_treatment_variation", url: RAISED_PANEL_ONSTAIR, generated_at: nowIso(), generated_by: "philip", notes: "Same three-panel raised design applied to full rear face of a straight-flight staircase" },
        { type: "sibling_treatment_variation", url: TG_SHEETING, generated_at: nowIso(), generated_by: "philip", notes: "Alternative back-panel treatment: T&G sheeting" },
      ],
    },
  };
  console.log("  ✓ raised_panel_detail");

  m.images[RAISED_PANEL_ONSTAIR] = {
    ...base({
      description: raisedOnStairDesc,
      notes: "Three-panel raised back panel · straight-flight application · sibling with the detail view",
      article: ART_RAISED,
    }),
    family_tree: {
      parent_url: undefined,
      children: [
        { type: "sibling_treatment_variation", url: RAISED_PANEL_DETAIL, generated_at: nowIso(), generated_by: "philip", notes: "Detail view of the same three-panel raised joinery" },
        { type: "sibling_treatment_variation", url: TG_SHEETING, generated_at: nowIso(), generated_by: "philip", notes: "Alternative back-panel treatment: T&G sheeting" },
      ],
    },
  };
  console.log("  ✓ raised_panel_onstair");

  m.images[TG_SHEETING] = {
    ...base({
      description: tgSheetingDesc,
      notes: "T&G sheeting straight-flight back panel · alternative to raised-panel treatment",
      article: ART_TG,
    }),
    family_tree: {
      parent_url: undefined,
      children: [
        { type: "sibling_treatment_variation", url: RAISED_PANEL_DETAIL, generated_at: nowIso(), generated_by: "philip", notes: "Alternative back-panel treatment: raised & fielded three-panel design detail" },
        { type: "sibling_treatment_variation", url: RAISED_PANEL_ONSTAIR, generated_at: nowIso(), generated_by: "philip", notes: "Alternative back-panel treatment: raised & fielded on straight-flight" },
      ],
    },
  };
  console.log("  ✓ tg_sheeting");

  m.generated_at = nowIso();
  await atomicWrite(m);

  console.log("\n═════ Total manifest rows: " + Object.keys(m.images).length + " ═════");
}
main().catch((e) => { console.error(e); process.exit(1); });
