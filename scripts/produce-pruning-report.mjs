// Produce a pruning MOVE PROPOSAL for the 4 library designs.
// Philip 2026-08-02 · rule: "Never delete authored knowledge. Every removed
// question must have a destination." Every image-layer Q is classified into
// one of: universal · family:{id} · component:{id} · image-keep · duplicate.
//
// This script WRITES A REPORT ONLY. It does NOT mutate any qa arrays.
// Philip reviews the report · then a separate script applies the moves.
//
// Output: data/nex-pruning-report.json

import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { join } from "node:path";

const LIB_PATH = "data/nex-confirmed-images.json";
const UNIV_PATH = "data/nex-universal-qa.json";
const FAM_DIR   = "data/nex-family-qa";
const COMP_DIR  = "data/nex-component-qa";

const lib = JSON.parse(readFileSync(LIB_PATH, "utf8"));
const univ = JSON.parse(readFileSync(UNIV_PATH, "utf8"));

function readJsonQa(path) {
  if (!existsSync(path)) return [];
  try {
    const parsed = JSON.parse(readFileSync(path, "utf8"));
    return Array.isArray(parsed.qa) ? parsed.qa : [];
  } catch { return []; }
}

function normQ(q) { return String(q ?? "").toLowerCase().replace(/[^a-z0-9]+/g, " ").trim(); }

// Preload every layer file's Qs · used to detect exact duplicates
const universalQs = new Set(univ.qa.map((x) => normQ(x.q)));
const familyQs    = new Map();   // family_id → Set<normalisedQ>
const componentQs = new Map();   // component_id → Set<normalisedQ>

function loadFamilyOrComponent(dir, targetMap) {
  if (!existsSync(dir)) return;
  const files = readdirSyncSafe(dir);
  for (const f of files) {
    if (!f.endsWith(".json")) continue;
    const id = f.replace(/\.json$/, "");
    const arr = readJsonQa(join(dir, f));
    targetMap.set(id, new Set(arr.map((x) => normQ(x.q))));
  }
}
function readdirSyncSafe(dir) {
  try { return require("node:fs").readdirSync(dir); } catch { return []; }
}
loadFamilyOrComponent(FAM_DIR,  familyQs);
loadFamilyOrComponent(COMP_DIR, componentQs);

// ─── Classification heuristics ──────────────────────────────
//
// Each classifier returns a destination string or null. The FIRST classifier
// that returns non-null wins (in order): duplicate → universal → component
// → family → image-keep.
//
// Rules are CONSERVATIVE · when unsure, keep the Q at image layer. Philip
// reviews the report and can re-classify anything.

// Universal keywords · questions that apply to any staircase
const UNIVERSAL_KEYWORDS = [
  // Trust rules
  /^is nex/i, /^can nex/i, /is this an? (ai|artificial)/i, /is this a real staircase or/i,
  /^are you an? ai\b/i,
  // Pricing
  /how much (does|do|would)/i, /rough estimate/i, /ballpark/i, /budget realistic/i,
  /hiding the (cost|price)/i, /why (can'?t you|don'?t you) tell me the price/i,
  // Trust · can it be built
  /can (this|it) actually be (made|built)/i, /is this just an ai/i,
  /can someone really build/i, /is this impossible/i, /can (this|it) be built exactly/i,
  /has (this exact staircase|anyone) built/i, /guarantee (this|the) staircase (can be|will be) built/i,
  /can nex speak to a manufacturer/i, /nex introduce me/i, /prepare an? (enquiry|brief)/i,
  // Supplier connection
  /can nex (find|recommend|introduce)/i, /can i speak.*manufacturer/i, /who builds staircases/i,
  /is there a manufacturer near/i, /how do i choose (the right )?manufacturer/i,
  // General staircase concepts
  /^what is (oak|walnut|ash|maple|toughened|laminated|powder)/i,
  /can i (change|choose) (the )?(timber|paint|colour|finish|steel)/i,
  /timber move|timber shrink|does timber move|will timber crack/i,
  /is a staircase (structural|safe for children|safe for elderly)/i,
  /^do i need (planning permission|building regulations|building regs|structural drawings)/i,
  /will i receive drawings/i, /can i approve the design/i,
  // Property / value / delivery / warranty (universal)
  /increase (my )?(property|home).*value/i, /make a house easier to sell/i,
  /how (long|is).*warranty/i, /is (there|a) warranty/i,
  /how (is|does).*delivered/i, /can (this|it) be shipped international/i,
  /can i visit (a|the) (showroom|factory)/i, /can i see one before/i,
  /how (many|long) installers/i, /do i need scaffolding/i,
  // Insurance
  /home insurance/i, /tell my insurer/i,
];

// Component keywords · each maps to a component_id
const COMPONENT_KEYWORDS = [
  { id: "tread",  rxs: [/^what (is|are) (a )?tread/i, /how thick (are|is) (the )?tread/i, /how many treads/i, /can treads be replaced/i, /can treads be sanded/i, /can i (fit|add) carpet/i] },
  { id: "handrail", rxs: [/^what is (a|the) handrail/i, /can i (change|remove|add) (a |the )?handrail/i, /is the handrail comfortable/i, /handrail height/i, /can the handrail be (thinner|square|stainless|timber|metal|leather)/i, /led lighting.*handrail/i, /handrail lighting/i] },
  { id: "baluster", rxs: [/^what (is|are) (a )?baluster/i, /baluster spacing/i, /replace.*balusters?.*with glass/i, /vertical (bars|balusters)/i, /horizontal rails.*safer/i, /children climb.*balustrade/i] },
  { id: "balustrade-glass", rxs: [/glass balustrade/i, /^is the glass (safe|toughened|laminated|shatterproof)/i, /how thick is the glass/i, /can (the )?glass be (tinted|smoked|frosted|curved|replaced)/i, /can glass panels? be replaced/i] },
  { id: "stringer", rxs: [/^what is (a|the) stringer/i, /mono[- ]?stringer/i, /twin stringers?/i, /cut string|closed string/i, /steel stringer/i] },
  { id: "newel",    rxs: [/^what (is|are) (a )?newel/i, /newel post/i] },
  { id: "riser",    rxs: [/^what (is|are) (a )?riser/i, /open riser|closed riser/i] },
  { id: "lighting-led", rxs: [/led (lighting|strips?|tread)/i, /can lighting be (dimmed|added|changed)/i, /motion (sensor|activated)/i, /smart home.*lighting/i, /how are the (led )?cables hidden/i] },
  { id: "landing",  rxs: [/^what is (a|the) landing/i, /does the landing/i, /landing shape/i] },
  { id: "fixings-glass", rxs: [/glass (fixings?|bolts?|stand-?offs?|channel)/i, /stainless.*(bolts?|stand-?offs?)/i] },
];

// Family keywords · each maps to a family_id
const FAMILY_KEYWORDS = [
  { id: "spiral",              rxs: [/spiral staircase/i, /central column/i, /how is the (centre|center) column/i] },
  { id: "helical",             rxs: [/helical/i, /double[- ]?curved.*feature/i] },
  { id: "mono-stringer-curved",rxs: [/curved mono[- ]?stringer/i] },
  { id: "floating-cantilever", rxs: [/floating (staircase|steps|treads)/i, /cantilever/i, /really floating/i] },
  { id: "open-riser",          rxs: [/open[- ]?riser/i, /open risers.*legal/i, /slip through.*open risers/i] },
  { id: "straight-flight",     rxs: [/straight[- ]?flight/i] },
  { id: "glass-balustrade",    rxs: [/glass balustrade/i, /frameless glass/i] },
  { id: "steel-balustrade",    rxs: [/steel (balustrade|balusters)/i, /powder[- ]?coated steel/i] },
  { id: "feature-lighting",    rxs: [/feature lighting/i, /integrated (led|lighting)/i] },
];

function classify(q, designRecord) {
  const nq = normQ(q);

  // (1) Duplicate check · already exists at a higher layer
  if (universalQs.has(nq)) return { dest: "universal", reason: "already exists in universal-qa · duplicate · will be merged" };
  for (const [famId, s] of familyQs) {
    if (s.has(nq) && (designRecord.families ?? []).includes(famId)) {
      return { dest: `family:${famId}`, reason: `already exists in family-qa/${famId}.json · will be merged` };
    }
  }
  for (const [compId, s] of componentQs) {
    if (s.has(nq) && (designRecord.components ?? []).includes(compId)) {
      return { dest: `component:${compId}`, reason: `already exists in component-qa/${compId}.json · will be merged` };
    }
  }

  // (2) Universal keyword match
  for (const rx of UNIVERSAL_KEYWORDS) {
    if (rx.test(q)) return { dest: "universal", reason: `universal-keyword match: ${rx}` };
  }

  // (3) Component keyword match · restrict to components the design has
  for (const { id, rxs } of COMPONENT_KEYWORDS) {
    if (!(designRecord.components ?? []).includes(id)) continue;
    for (const rx of rxs) {
      if (rx.test(q)) return { dest: `component:${id}`, reason: `component-keyword match: ${rx}` };
    }
  }

  // (4) Family keyword match · restrict to families the design has
  for (const { id, rxs } of FAMILY_KEYWORDS) {
    if (!(designRecord.families ?? []).includes(id)) continue;
    for (const rx of rxs) {
      if (rx.test(q)) return { dest: `family:${id}`, reason: `family-keyword match: ${rx}` };
    }
  }

  // (5) Default · keep at image layer · genuinely design-specific
  return { dest: "image-keep", reason: "no higher-layer match · genuinely image-specific" };
}

// ─── Build the report ───────────────────────────────────────
const LIBRARY_IDS = ["NEX-DESIGN-000005","NEX-DESIGN-000020","NEX-DESIGN-000025","NEX-DESIGN-000026"];
const report = {
  generated_at: new Date().toISOString(),
  rule:         "Prune by moving · never delete authored knowledge · Philip 2026-08-02",
  applied:      false,
  note:         "Every image-layer Q is proposed for exactly one destination. Nothing is deleted. Philip reviews then approves. A separate apply script performs the moves with backups + audit log.",
  designs:      [],
};

const rollup = {
  total:        0,
  universal:    0,
  component:    {},
  family:       {},
  image_keep:   0,
};

for (const designId of LIBRARY_IDS) {
  const rec = lib.confirmed.find((r) => r.design_id === designId);
  if (!rec) continue;

  const per = { design_id: designId, families: rec.families ?? [], components: rec.components ?? [], moves: [] };
  const qa = Array.isArray(rec.qa) ? rec.qa : [];
  for (const item of qa) {
    if (!item?.q) continue;
    const { dest, reason } = classify(item.q, rec);
    per.moves.push({
      q:      item.q,
      a_authored: !!(item.a && item.a.trim().length > 0),
      dest,
      reason,
    });
    rollup.total++;
    if (dest === "universal")            rollup.universal++;
    else if (dest === "image-keep")      rollup.image_keep++;
    else if (dest.startsWith("component:")) rollup.component[dest.slice(10)] = (rollup.component[dest.slice(10)] || 0) + 1;
    else if (dest.startsWith("family:"))    rollup.family[dest.slice(7)]     = (rollup.family[dest.slice(7)]     || 0) + 1;
  }
  report.designs.push(per);
}

report.rollup = rollup;

writeFileSync("data/nex-pruning-report.json", JSON.stringify(report, null, 2), "utf8");

console.log("Pruning MOVE PROPOSAL generated · data/nex-pruning-report.json");
console.log("");
console.log("Summary across 4 library designs · total Qs:", rollup.total);
console.log("  → universal:  ", rollup.universal);
console.log("  → image-keep: ", rollup.image_keep);
console.log("  → components: ", Object.entries(rollup.component).sort((a,b)=>b[1]-a[1]).map(([k,v])=>`${k}(${v})`).join(", ") || "(none)");
console.log("  → families:   ", Object.entries(rollup.family).sort((a,b)=>b[1]-a[1]).map(([k,v])=>`${k}(${v})`).join(", ") || "(none)");
console.log("");
console.log("Per-design breakdown:");
for (const d of report.designs) {
  const breakdown = {};
  for (const m of d.moves) {
    breakdown[m.dest] = (breakdown[m.dest] || 0) + 1;
  }
  const summary = Object.entries(breakdown).sort((a,b)=>b[1]-a[1]).map(([k,v])=>`${k}=${v}`).join(", ");
  console.log(`  ${d.design_id} · ${d.moves.length} Qs · ${summary}`);
}
