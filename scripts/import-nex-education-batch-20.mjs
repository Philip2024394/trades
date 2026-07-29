#!/usr/bin/env node
// scripts/import-nex-education-batch-20.mjs · direct-to-manifest.
// 3 more staircase images (Philip 2026-07-27):
//   - Modern straight-flight cut-string with stainless steel balusters
//   - Walnut geometric side panels with hidden storage door
//   - Cross-braced X-panel oak staircase side

import fs from "node:fs/promises";
import path from "node:path";

const ROOT = process.cwd();
const MP = path.join(ROOT, "data", "nex-image-manifest.json");
const BD = path.join(ROOT, "data", ".manifest-backups");

const URLS = {
  cut_string_metal: "https://ik.imagekit.io/5vv5pw26q/ChatGPT%20Image%20Jul%2026,%202026,%2010_44_59%20PM.png",
  geometric_walnut: "https://ik.imagekit.io/5vv5pw26q/ChatGPT%20Image%20Jul%2026,%202026,%2001_34_36%20PM.png",
  cross_braced_oak: "https://ik.imagekit.io/5vv5pw26q/ChatGPT%20Image%20Jul%2026,%202026,%2001_06_01%20PM.png",
};

const ARTS = {
  cut_string_metal: "data/nex-customer-education/modern-straight-flight-cut-string-metal-balusters.md",
  geometric_walnut: "data/nex-customer-education/staircase-side-panels-with-hidden-storage-door.md",
  cross_braced_oak: "data/nex-customer-education/cross-braced-x-panel-staircase-side.md",
};

const nowIso = () => new Date().toISOString();

async function backup(manifest) {
  await fs.mkdir(BD, { recursive: true });
  const ts = new Date().toISOString().replace(/[:.]/g, "-").replace("T", "-").slice(0, 23);
  const p = path.join(BD, `manifest-${ts}.json`);
  await fs.writeFile(p, JSON.stringify(manifest, null, 2), "utf8");
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
  };
}

const cutStringMetalDesc = `IMAGE IDENTITY
Image Name: Modern Straight-Flight Cut-String Staircase with Stainless Steel Balusters
Category: Customer Education > Staircase Types > Straight Flight > Cut String + Metal Balusters
Sub Category: Modern straight-flight cut-string staircase · deep mahogany/walnut hardwood + brushed stainless steel square balusters + large square hardwood newel post with stainless steel base sleeve.
Recommendation Type: EDUCATIONAL — primary reference for the modern cut-string + metal balusters article
Belongs In: staircase_brain · staircase_kind: full · internal · contemporary hardwood + metal tier
Educational Article: ${ARTS.cut_string_metal}

IMAGE DESCRIPTION
A modern straight-flight cut-string staircase combining traditional timber joinery with contemporary materials. Rich hardwood treads / risers / strings finished in deep mahogany or walnut stain. Cut-string construction exposes the profile of each tread. Brushed stainless steel square balusters give the balustrade a modern architectural appearance. Matching timber handrail with continuous clean lines. Large square hardwood newel post with brushed stainless steel base sleeve. Minimal detailing so the timber grain is the focal point. Recessed LED wall lighting. White walls contrast the timber staircase.

Design detail: newel size is a design decision — 90 mm reads lighter/minimalist · 120 mm reads bolder/architectural. Both are structurally functional.`;

const geometricWalnutDesc = `IMAGE IDENTITY
Image Name: Walnut Geometric Side Panels with Hidden Storage Door
Category: Customer Education > Staircase Types > Bespoke Feature > Under-Stair Side Panels > Geometric Walnut
Sub Category: Solid walnut side panels beneath a staircase in mixed vertical / horizontal / angled orientations. Central panel is a concealed storage door. Matching walnut on handrail · newel posts · balusters · string · side panels · storage door · flooring · internal doors.
Recommendation Type: EDUCATIONAL — primary reference for the geometric-walnut side panels article
Belongs In: staircase_brain · staircase_kind: full · internal · bespoke joinery tier
Educational Article: ${ARTS.geometric_walnut}

IMAGE DESCRIPTION
Solid walnut side panel system beneath a staircase. Multiple panel orientations divide the large under-stair area into well-proportioned sections: vertical tongue-and-groove-style boards at the front for height, horizontal panels across the lower section for width and balance, angled panels following the pitch of the staircase. Central panel doubles as a concealed access door with hidden hinges — visually integrated into the panel design so it almost disappears. Matching walnut across every component (handrail · newel posts · balusters · string · side panels · storage door · flooring · internal doors) makes the staircase read as one continuous bespoke fitted furniture piece rather than a standalone structure. Suits modern homes · contemporary farmhouse · luxury family homes · updated traditional properties · high-end bespoke projects.`;

const crossBracedOakDesc = `IMAGE IDENTITY
Image Name: Cross-Braced X-Panel Oak Staircase Side
Category: Customer Education > Staircase Types > Bespoke Feature > Under-Stair Side Panels > Cross-Braced X
Sub Category: Full-height oak side panel beneath a straight-flight staircase. Divided by substantial timber mouldings into a bold cross-braced "X" pattern inspired by traditional timber framing and barn-door joinery.
Recommendation Type: EDUCATIONAL — primary reference for the cross-braced X-panel article
Belongs In: staircase_brain · staircase_kind: full · internal · traditional-framing decorative tier
Educational Article: ${ARTS.cross_braced_oak}

IMAGE DESCRIPTION
Full-height oak side panel enclosing the under-stair area of a straight-flight staircase, following the angle of the staircase from base moulding to the underside of the string. Substantial timber mouldings divide the panel into a bold cross-braced "X" pattern reminiscent of traditional timber framing and barn-door detailing. Natural oak with clear satin finish · coordinated with oak flooring · internal doors · staircase components. Large square newel posts. Slim square balusters. Neutral walls. The diagonal X divides the panel into four well-proportioned sections; the angled top rail follows the pitch. Distinctive alternative to plain flat side cladding — reads handcrafted, elegant, custom-built with the home. Behind the panel can host a concealed under-stair cupboard with push-to-open hardware for shoe / cleaning-equipment / vacuum / household / toy / seasonal storage. Suits modern farmhouse · country house · traditional interior · high-end bespoke projects.`;

async function main() {
  console.log("═════ NEX Education Batch 20 — 3 staircase images (direct-to-manifest) ═════\n");
  const m = JSON.parse(await fs.readFile(MP, "utf8"));
  if (!m.images) m.images = {};
  const bp = await backup(m);
  console.log("  Backup:", bp, "\n");

  m.images[URLS.cut_string_metal] = base({
    description: cutStringMetalDesc,
    notes: "Modern straight-flight cut-string with stainless steel balusters + stainless newel base sleeve",
    article: ARTS.cut_string_metal,
  });
  console.log("  ✓ cut_string_metal");

  m.images[URLS.geometric_walnut] = base({
    description: geometricWalnutDesc,
    notes: "Walnut geometric side panels beneath staircase · central panel is hidden storage door",
    article: ARTS.geometric_walnut,
  });
  console.log("  ✓ geometric_walnut");

  m.images[URLS.cross_braced_oak] = base({
    description: crossBracedOakDesc,
    notes: "Cross-braced X-panel oak staircase side · traditional framing inspiration · straight-flight",
    article: ARTS.cross_braced_oak,
  });
  console.log("  ✓ cross_braced_oak");

  m.generated_at = nowIso();
  await atomicWrite(m);

  console.log("\n═════ Total manifest rows: " + Object.keys(m.images).length + " ═════");
}
main().catch((e) => { console.error(e); process.exit(1); });
