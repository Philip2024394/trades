#!/usr/bin/env node
// Ingest scanned intake observations into data/staircase-renovations/manifest.json.
//
// Reads:  data/staircase-renovations/intake/observations.json  (per-image structured extraction)
// Reads:  data/staircase-renovations/manifest.json             (existing images_v3[] + categories[])
// Writes: data/staircase-renovations/manifest.json             (in-place · new whole_staircase entries + category attachments)
// Writes: data/staircase-renovations/intake/ingest-report.md   (coverage matrix + missing types)
//
// Dedup logic: fingerprint each observation from its structured composition (tread material+sub,
// riser material+sub, baluster material+sub+style, newel material+sub+style+feature, handrail material+sub,
// distinctive-feature bucket). Skip if fingerprint matches an existing images_v3 whole_staircase entry.
// Existing entries' fingerprints are derived from their material_composition[] (all 34 have it) plus
// their alt text (for runner/carpet/inlay features that aren't in material_composition).

import { readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";

const ROOT      = process.cwd();
const OBS_PATH  = join(ROOT, "data", "staircase-renovations", "intake", "observations.json");
const MAN_PATH  = join(ROOT, "data", "staircase-renovations", "manifest.json");
const REPORT    = join(ROOT, "data", "staircase-renovations", "intake", "ingest-report.md");
const INTAKE_DIR_PUBLIC = "/staircase-renovations/intake-2026-08-13";

const NOW = new Date().toISOString();

// -------------------------------------------------------------------- helpers

function norm(s) {
  return String(s || "").toLowerCase().trim().replace(/\s+/g, "-");
}

// Build a canonical fingerprint from an observation.
// Groups near-identical variants together (turned vs turned-traditional collapse to 'turned').
function fingerprintObs(obs) {
  const treadFeat = norm(obs.tread?.feature).replace(/(brass-rods|beige|tan|grey|herringbone|woven|diamond)/g, "runner");
  return [
    "T:",  norm(obs.tread?.material), "/", norm(obs.tread?.sub),
    treadFeat ? "+" + (treadFeat.includes("runner") ? "runner" : treadFeat) : "",
    "|R:", norm(obs.riser?.material), "/", norm(obs.riser?.sub),
    "|B:", norm(obs.baluster?.style).replace(/-traditional|-decorated|-clear|-panel/g,""), "/",
           norm(obs.baluster?.material), "/", norm(obs.baluster?.sub),
    "|N:", norm(obs.newel?.style).replace(/-minimal|-capped|-classic|-topped/g,""), "/",
           norm(obs.newel?.material), "/", norm(obs.newel?.sub),
    "|H:", norm(obs.handrail?.material), "/", norm(obs.handrail?.sub),
  ].join("");
}

function fingerprintExisting(entry) {
  const byRole = {};
  for (const c of entry.material_composition ?? []) {
    byRole[c.component_role] = { material: c.material, sub: c.sub_material, style: c.style, feature: c.feature };
  }
  const tread    = byRole.tread    || { material: entry.material, sub: entry.sub_material };
  const riser    = byRole.riser    || {};
  const baluster = byRole.baluster || {};
  const newel    = byRole.newel    || {};
  const handrail = byRole.handrail || {};
  const alt      = (entry.alt || "").toLowerCase();
  // Feature/runner detection: prefer explicit feature field on tread, fall back to alt text.
  const treadFeature = byRole.tread?.feature || (/(runner|herringbone|carpet)/.test(alt) ? "runner" : "");
  // Baluster style: prefer explicit stored style, else infer from alt.
  const balusterStyle = baluster.style
    ? norm(baluster.style).replace(/-traditional|-decorated|-clear|-panel/g,"")
    : (/branch|iron|wrought|art-nouveau/.test(alt) ? "branch"
      : /glass/.test(alt)                          ? "glass"
      : /square/.test(alt)                         ? "square"
      : /turned/.test(alt)                         ? "turned"
      : /chrome-spindle|metal-spindle/.test(alt)   ? "thin-metal-spindles"
      : "turned");
  // Newel style: prefer explicit stored style, else infer from alt.
  const newelStyle = newel.style
    ? norm(newel.style).replace(/-minimal|-capped|-classic|-topped/g,"")
    : (/ball newel|turned newel/.test(alt) ? "turned-ball" : "square");
  return [
    "T:",  norm(tread.material),    "/", norm(tread.sub),
    treadFeature ? "+" + (treadFeature.includes("runner") ? "runner" : treadFeature) : "",
    "|R:", norm(riser.material),    "/", norm(riser.sub),
    "|B:", balusterStyle, "/", norm(baluster.material), "/", norm(baluster.sub),
    "|N:", newelStyle, "/", norm(newel.material), "/", norm(newel.sub),
    "|H:", norm(handrail.material), "/", norm(handrail.sub),
  ].join("");
}

// Choose which category slugs the new entry should attach to.
function targetCategories(obs) {
  const out = new Set();
  const t  = norm(obs.tread?.sub);
  const th = norm(obs.tread?.material);
  const alt = (obs.distinctive || "").toLowerCase();
  const styles = (obs.style || []).map(norm);
  const balMat = norm(obs.baluster?.material);
  const newelMat = norm(obs.newel?.material);
  // wood species → its slug (oak/walnut/mahogany/maple/light-oak → mapped)
  if (t.includes("oak"))       out.add("oak");
  if (t.includes("walnut"))    out.add("walnut");
  if (t.includes("mahogany"))  out.add("walnut"); // no mahogany category — nearest is walnut
  if (t.includes("maple"))     out.add("oak");    // no maple category — attach to oak with tag
  // painted / white
  if (th === "painted")        out.add("painted");
  if (th === "painted" && norm(obs.tread?.sub) === "white") out.add("white");
  // material / style-based
  if (balMat === "glass")      out.add("glass");
  if (styles.includes("modern") || styles.includes("industrial") || styles.includes("statement"))
                               out.add("modern");
  if (styles.includes("traditional") || styles.includes("classic"))
                               out.add("traditional");
  return [...out];
}

// Material tags for categories[].images[].materials[] (drives resolveHeroPool).
function categoryMaterialsTags(obs) {
  const tags = new Set();
  const t = norm(obs.tread?.sub);
  if (t === "oak" || t === "light-oak" || t === "mid-oak" || t === "rustic-knotty-oak" || t === "dark-rustic-oak")
    tags.add("oak");
  if (t === "walnut") tags.add("walnut");
  if (t === "mahogany") { tags.add("mahogany"); tags.add("walnut"); } // shows up under walnut too
  if (t === "maple") tags.add("maple");
  if (norm(obs.tread?.material) === "painted") tags.add("painted");
  if (norm(obs.baluster?.material) === "glass") tags.add("glass");
  if (norm(obs.baluster?.material) === "metal") tags.add("metal");
  return [...tags];
}

function altFromObs(obs) {
  const parts = [];
  const treadDesc = `${norm(obs.tread?.sub)} ${norm(obs.tread?.material)} tread`;
  parts.push(treadDesc);
  const balusterDesc = `${norm(obs.baluster?.style)} ${norm(obs.baluster?.sub)} balustrade`;
  parts.push(balusterDesc);
  if (obs.distinctive) parts.push(obs.distinctive);
  return `NEX Trade Center whole-staircase — ${parts.join(", ")}`;
}

function imageIdFromObs(obs) {
  const hash = obs.file.replace(/^intake-\d+-/, "").replace(/\.png$/, "");
  return `img_intake_${String(obs.seq).padStart(3,"0")}_${hash.slice(0,8)}`;
}

function buildV3Entry(obs) {
  const src = `${INTAKE_DIR_PUBLIC}/${obs.file}`;
  return {
    image_id: imageIdFromObs(obs),
    src,
    alt: altFromObs(obs),
    component_role: "whole_staircase",
    component_role_confidence: "observed",
    material: obs.tread?.material || "wood",
    material_confidence: "observed",
    sub_material: obs.tread?.sub || "unknown",
    sub_material_confidence: "observed",
    governance: {
      owner_type: "nex_curated",
      owner_id: "nex",
      visibility_label: "INSPIRATION_LIBRARY",
      created_at: NOW,
      updated_at: NOW,
      superseded_by: null,
      retention_class: "long_term",
      source_batch: "intake-2026-08-13"
    },
    style: obs.style || [],
    style_confidence: "observed",
    mood: obs.mood || [],
    mood_confidence: "observed",
    scene: {
      scenario: "nex-trade-center",
      geometry: "straight-flight-bullnose",
      camera: "eye-level-portrait",
      talent_present: true
    },
    distinctive: obs.distinctive || null,
    material_composition: [
      { component_role: "tread",    material: obs.tread?.material,    sub_material: obs.tread?.sub,    feature: obs.tread?.feature ?? null, confidence: "observed" },
      { component_role: "riser",    material: obs.riser?.material,    sub_material: obs.riser?.sub,    confidence: "observed" },
      { component_role: "baluster", material: obs.baluster?.material, sub_material: obs.baluster?.sub, style: obs.baluster?.style, confidence: "observed" },
      { component_role: "newel",    material: obs.newel?.material,    sub_material: obs.newel?.sub,    style: obs.newel?.style, feature: obs.newel?.feature ?? null, confidence: "observed" },
      { component_role: "handrail", material: obs.handrail?.material, sub_material: obs.handrail?.sub, confidence: "observed" },
      { component_role: "string_left",  material: obs.string_L?.material, sub_material: obs.string_L?.sub, confidence: "observed" },
      { component_role: "string_right", material: obs.string_R?.material, sub_material: obs.string_R?.sub, confidence: "observed" },
      { component_role: "baserail", material: obs.baserail?.material, sub_material: obs.baserail?.sub, confidence: "observed" },
      { component_role: "starting_step", type: obs.starting_step ?? "bullnose", confidence: "observed" }
    ]
  };
}

// -------------------------------------------------------------------- main

const obsFile = JSON.parse(await readFile(OBS_PATH, "utf8"));
const man     = JSON.parse(await readFile(MAN_PATH, "utf8"));

// Pre-compute fingerprints of existing whole_staircase entries — but SKIP entries
// already in this intake batch (identified by governance.source_batch), so a re-run
// doesn't self-dedup against its own prior output.
const existingFP = new Map(); // fp -> image_id
const existingBySrc = new Set();
for (const e of man.images_v3 ?? []) {
  existingBySrc.add(e.src);
  if (e.component_role !== "whole_staircase") continue;
  existingFP.set(fingerprintExisting(e), e.image_id);
}

const newEntries = [];
const skipped    = [];
const seenNewFP  = new Set();

for (const obs of obsFile.observations) {
  const src = `${INTAKE_DIR_PUBLIC}/${obs.file}`;
  if (existingBySrc.has(src)) {
    skipped.push({ seq: obs.seq, file: obs.file, reason: `already present in manifest (idempotent re-run)`, fp: "n/a" });
    continue;
  }
  const fp = fingerprintObs(obs);
  const dupOfExisting = existingFP.get(fp);
  if (dupOfExisting) {
    skipped.push({ seq: obs.seq, file: obs.file, reason: `metadata-dup of existing ${dupOfExisting}`, fp });
    continue;
  }
  if (seenNewFP.has(fp)) {
    skipped.push({ seq: obs.seq, file: obs.file, reason: `metadata-dup of earlier intake in this batch`, fp });
    continue;
  }
  seenNewFP.add(fp);
  newEntries.push(buildV3Entry(obs));
}

// Attach to categories[].images[].
const catIndex = new Map(man.categories.map(c => [c.slug, c]));
for (const obs of obsFile.observations) {
  // only attach if we actually created a v3 entry for it
  if (skipped.some(s => s.file === obs.file)) continue;
  const entry = newEntries.find(e => e.src.endsWith(obs.file));
  if (!entry) continue;
  const cats = targetCategories(obs);
  const tags = categoryMaterialsTags(obs);
  for (const slug of cats) {
    const cat = catIndex.get(slug);
    if (!cat) continue;
    cat.images ||= [];
    if (cat.images.some(i => i.src === entry.src)) continue;
    cat.images.push({
      src: entry.src,
      alt: entry.alt,
      sort: (cat.images.at(-1)?.sort ?? 0) + 1,
      materials: tags.length ? tags : undefined
    });
  }
}

// Append to images_v3[].
man.images_v3 = [...(man.images_v3 ?? []), ...newEntries];

// Preserve provenance note.
man.notes = man.notes || [];
if (!man.notes.some(n => n.includes("intake-2026-08-13"))) {
  man.notes.push(
    "Intake batch 2026-08-13: 58 whole-staircase hero photos ingested from ImageKit into public/staircase-renovations/intake-2026-08-13/ · fingerprint-deduped against existing whole_staircase entries · full per-component observations at data/staircase-renovations/intake/observations.json · ingest report at data/staircase-renovations/intake/ingest-report.md · component_role='whole_staircase' with material_composition[] covering tread/riser/baluster/newel/handrail/string_L/string_R/baserail/starting_step."
  );
}
man.updated_at = NOW.slice(0,10);

await writeFile(MAN_PATH, JSON.stringify(man, null, 2) + "\n", "utf8");

// -------------------------------------------------------------------- coverage matrix + missing report

// Coverage vocabulary tracks the DENORMALISED shape after material grouping.
const TREAD_SUBS = ["light-oak","mid-oak","oak","rustic-knotty-oak","dark-rustic-oak","walnut","mahogany","maple","painted:white","carpet:grey-full-cover"];
const BALUSTER   = ["turned:painted:white","turned:wood:light-oak","turned:wood:walnut","turned:wood:mahogany","thin-metal:chrome","twisted-iron:black","art-nouveau-branch:black","glass:clear-frameless","glass:clear-with-bronze-leaf-motif","perforated-metal:brushed-silver","perforated-metal:black","thin-square:painted:white"];
const NEWEL      = ["square:wood:oak","square:wood:light-oak","square:wood:mid-oak","square:wood:walnut","square:wood:mahogany","square:painted:white","turned-ball:wood:oak","turned-ball:wood:light-oak","turned-ball:wood:mid-oak","turned-ball:wood:walnut","turned-ball:wood:mahogany","turned-ball:painted:white"];
const HANDRAIL   = ["oak","light-oak","mid-oak","walnut","mahogany","painted:white"];

function coverage(subs, extractor) {
  const seen = new Set();
  for (const o of obsFile.observations) seen.add(extractor(o));
  return subs.map(k => ({ k, present: seen.has(k) }));
}

const treadCov = coverage(TREAD_SUBS, o => {
  const mat = norm(o.tread?.material);
  const sub = norm(o.tread?.sub);
  if (mat === "painted") return `painted:${sub}`;
  if (mat === "carpet")  return `carpet:${sub}`;
  return sub;
});
const balusterCov = coverage(BALUSTER, o => {
  const st  = norm(o.baluster?.style);
  const mat = norm(o.baluster?.material);
  const sub = norm(o.baluster?.sub);
  if (st.includes("turned"))          return `turned:${mat}:${sub}`;
  if (st.includes("thin-metal"))      return `thin-metal:${sub}`;
  if (st.includes("twisted"))         return `twisted-iron:${sub}`;
  if (st.includes("branch") || st.includes("art-nouveau")) return `art-nouveau-branch:${sub}`;
  if (st.includes("glass"))           return `glass:${sub}`;
  if (st.includes("perforated"))      return `perforated-metal:${sub}`;
  if (st.includes("square"))          return `thin-square:${mat}:${sub}`;
  return `${st}:${mat}:${sub}`;
});
const newelCov = coverage(NEWEL, o => {
  const st = norm(o.newel?.style);
  const mat= norm(o.newel?.material);
  const sub= norm(o.newel?.sub);
  const isBall = st.includes("turned") || st.includes("ball") || o.newel?.feature === "ball-top";
  const prefix = isBall ? "turned-ball" : "square";
  return `${prefix}:${mat}:${sub}`;
});
const handrailCov = coverage(HANDRAIL, o => {
  const mat = norm(o.handrail?.material);
  const sub = norm(o.handrail?.sub);
  return mat === "painted" ? `painted:${sub}` : sub;
});

const kept   = newEntries.length;
const total  = obsFile.observations.length;
const skips  = skipped.length;

const report = `# NEX Trade Center intake · 2026-08-13 · ingest report

**Total observations**: ${total}
**Kept (new whole_staircase entries)**: ${kept}
**Skipped (dedup)**: ${skips}
**Existing whole_staircase entries pre-batch**: ${[...existingFP.keys()].length}

## Coverage matrix

### Tread subs
${treadCov.map(r => `- [${r.present ? "x" : " "}] ${r.k}`).join("\n")}

### Baluster (style + material)
${balusterCov.map(r => `- [${r.present ? "x" : " "}] ${r.k}`).join("\n")}

### Newel (style + material)
${newelCov.map(r => `- [${r.present ? "x" : " "}] ${r.k}`).join("\n")}

### Handrail sub
${handrailCov.map(r => `- [${r.present ? "x" : " "}] ${r.k}`).join("\n")}

## Skipped observations

${skipped.map(s => `- **seq ${s.seq}** (${s.file}) — ${s.reason}\n  fp: \`${s.fp}\``).join("\n\n") || "_none_"}

## Missing type combinations (suggested regeneration list)

The following coverage gaps were identified. Reference images should be regenerated at the same
NEX Trade Center scenario (same person + pose + backdrop + straight-flight-bullnose geometry).

${[
  ...treadCov.filter(r => !r.present).map(r => `- tread: **${r.k}** — regenerate with same balustrade family used in the closest existing sibling`),
  ...balusterCov.filter(r => !r.present).map(r => `- baluster: **${r.k}** — regenerate against light-oak + walnut + white-only tread bodies`),
  ...newelCov.filter(r => !r.present).map(r => `- newel: **${r.k}** — regenerate with each tread species (oak/walnut/mahogany/white)`),
  ...handrailCov.filter(r => !r.present).map(r => `- handrail: **${r.k}** — regenerate as accent variant on matching-family staircase`),
].join("\n") || "_no gaps detected in the enumerated axes_"}

_Generated: ${NOW}_
`;

await writeFile(REPORT, report, "utf8");

console.log(`kept ${kept}/${total} · skipped ${skips} · manifest updated · report at ${REPORT}`);
