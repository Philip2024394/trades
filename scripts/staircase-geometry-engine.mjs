#!/usr/bin/env node
// STAIRCASE GEOMETRY ENGINE — the single source of truth.
// Per Philip's architectural principle (2026-07-25):
//   Floor Height
//        │
//        ▼
//   Geometry Engine       ← THIS FILE
//        │
//        ├── Compliance
//        ├── Drawings
//        ├── Materials
//        ├── Pricing
//        ├── CNC
//        └── 3D Preview
//
// Computes deterministic X, Y, Z coordinates for every component of
// a staircase: every tread, riser, string, newel, spindle, handrail,
// landing. Every other engine reads from this output — never
// recalculates from scratch — so all outputs stay consistent.
//
// Coordinate system:
//   Origin (0, 0, 0) = bottom-left corner of the staircase base
//   X axis: horizontal along the direction of travel (positive UP the flight)
//   Y axis: horizontal across the flight width (positive to the right)
//   Z axis: vertical (positive UP)
//
// All dimensions in mm.
//
// V1 supports: straight, half_turn_landing, quarter_turn_landing.
// Other layouts (winder, spiral, curved) are stub-flagged for future.

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const TIMBER_DB = JSON.parse(fs.readFileSync(path.resolve(__dirname, "..", "data", "timber-species.json"), "utf8"));
const PLAN_DATA = JSON.parse(fs.readFileSync(path.resolve(__dirname, "..", "data", "staircase-plan-sizes.json"), "utf8"));

function v(f) { return f == null ? null : (typeof f === "object" && "value" in f ? f.value : f); }

// ── Look up timber density for weight estimates ──
function timberDensity(speciesId) {
  const sp = TIMBER_DB.species.find(s => s.id === speciesId);
  if (!sp) return 700; // default oak-ish
  const [min, max] = sp.density_kg_m3;
  return (min + max) / 2;
}

// ── Weight from volume + species ──
function weightKg(volumeMm3, speciesId) {
  const density = timberDensity(speciesId);
  const volumeM3 = volumeMm3 / 1e9;
  return Math.round(volumeM3 * density * 10) / 10;
}

// ── Compute effective FTF (finished-floor to finished-floor) ──
function effectiveFtf(structuralFtf, downFinish, upFinish) {
  return structuralFtf + (upFinish ?? 0) - (downFinish ?? 0);
}

// ═══════════════════════════════════════════════════════════════
// LAYOUT: STRAIGHT FLIGHT
// ═══════════════════════════════════════════════════════════════
function buildStraight(cfg) {
  const {
    numRises, actualRise, numGoings, chosenGoing, width,
    treadThickness = 40, riserThickness = 18, stringThickness = 32,
    stringDepth = 300, nosingProjection = 22,
    spindleSpacingCentres = 95, spindleWidth = 40,
    newelSize = 90, handrailHeight = 950,
    timberSpecies = "european_oak"
  } = cfg;

  const parts = { treads: [], risers: [], strings: [], newels: [], spindles: [], handrails: [] };

  // ── Treads: each at x = going_index * chosen_going, z = (rise_index * rise) ──
  // For a flight with N rises and N-1 goings, treads are indexed 0..N-1
  // Tread 0 is the first step you land on (at first rise level).
  for (let i = 0; i < numGoings; i++) {
    const xStart = i * chosenGoing - nosingProjection;
    const xEnd = xStart + chosenGoing + nosingProjection;
    const z = (i + 1) * actualRise;
    parts.treads.push({
      id: `T${String(i + 1).padStart(2, "0")}`,
      component: "tread",
      timber: timberSpecies,
      position: { x_start: xStart, x_end: xEnd, y_start: 0, y_end: width, z_top: z, z_bottom: z - treadThickness },
      dimensions_mm: { length: chosenGoing + nosingProjection, width: width, thickness: treadThickness },
      volume_mm3: (chosenGoing + nosingProjection) * width * treadThickness,
      weight_kg: weightKg((chosenGoing + nosingProjection) * width * treadThickness, timberSpecies),
      notes: `Nosing projects ${nosingProjection}mm past riser front (not counted in going).`
    });
  }

  // ── Risers (if closed-riser design; caller can strip these for open-riser) ──
  for (let i = 0; i < numRises; i++) {
    const x = i * chosenGoing;
    const zBottom = i * actualRise;
    const zTop = zBottom + actualRise;
    parts.risers.push({
      id: `R${String(i + 1).padStart(2, "0")}`,
      component: "riser",
      timber: timberSpecies,
      position: { x_start: x, x_end: x + riserThickness, y_start: 0, y_end: width, z_bottom: zBottom, z_top: zTop },
      dimensions_mm: { length: actualRise, width: width, thickness: riserThickness },
      volume_mm3: actualRise * width * riserThickness,
      weight_kg: weightKg(actualRise * width * riserThickness, timberSpecies)
    });
  }

  // ── Strings (left and right — parallel to X axis, following the pitch line) ──
  const flightLength = (numGoings - 1) * chosenGoing + chosenGoing; // horizontal
  const totalRise = numRises * actualRise;
  const stringDiagonal = Math.sqrt(flightLength * flightLength + totalRise * totalRise);
  for (const side of [{ name: "left", y: 0 }, { name: "right", y: width - stringThickness }]) {
    parts.strings.push({
      id: `S-${side.name.toUpperCase()}`,
      component: "string",
      side: side.name,
      timber: timberSpecies,
      position: { x_start: 0, x_end: flightLength, y_start: side.y, y_end: side.y + stringThickness, z_bottom: 0, z_top: totalRise + stringDepth },
      dimensions_mm: { length_diagonal: Math.round(stringDiagonal), depth: stringDepth, thickness: stringThickness },
      pitch_deg: Math.round(Math.atan(actualRise / chosenGoing) * 180 / Math.PI * 10) / 10,
      volume_mm3: stringDiagonal * stringDepth * stringThickness,
      weight_kg: weightKg(stringDiagonal * stringDepth * stringThickness, timberSpecies),
      housings: numGoings + numRises,
      notes: `Housings for ${numGoings} treads + ${numRises} risers. Bottom edge rebated for skirting continuation.`
    });
  }

  // ── Newel posts (bottom, top; left and right) ──
  const newelPositions = [
    { id: "N-BL", label: "bottom-left",  x: 0, y: 0 },
    { id: "N-BR", label: "bottom-right", x: 0, y: width - newelSize },
    { id: "N-TL", label: "top-left",     x: flightLength, y: 0 },
    { id: "N-TR", label: "top-right",    x: flightLength, y: width - newelSize }
  ];
  const newelHeight = totalRise + handrailHeight + 50; // reach above top step + some
  for (const np of newelPositions) {
    parts.newels.push({
      id: np.id,
      component: "newel",
      timber: timberSpecies,
      label: np.label,
      position: { x_start: np.x, x_end: np.x + newelSize, y_start: np.y, y_end: np.y + newelSize, z_bottom: 0, z_top: newelHeight },
      dimensions_mm: { width: newelSize, depth: newelSize, height: newelHeight },
      volume_mm3: newelSize * newelSize * newelHeight,
      weight_kg: weightKg(newelSize * newelSize * newelHeight, timberSpecies)
    });
  }

  // ── Spindles (one per tread, both sides, evenly spaced) ──
  // Approximation: 1 spindle per tread on each open side, plus intermediate spindles
  // as needed to keep spacing under the 100mm sphere rule.
  const spindlesPerTread = Math.max(1, Math.ceil(chosenGoing / spindleSpacingCentres));
  const spindleLen = handrailHeight - 50; // between base rail and handrail
  let spindleCount = 0;
  for (let i = 0; i < numGoings; i++) {
    for (let s = 0; s < spindlesPerTread; s++) {
      const xLocal = i * chosenGoing + (s + 1) * chosenGoing / (spindlesPerTread + 1);
      // one on each side (assume both sides open; caller can filter for wall-side closed)
      for (const side of [{ name: "left", y: 0 }, { name: "right", y: width - spindleWidth }]) {
        spindleCount++;
        parts.spindles.push({
          id: `SP-${side.name[0].toUpperCase()}${String(spindleCount).padStart(3, "0")}`,
          component: "spindle",
          side: side.name,
          timber: timberSpecies,
          position: { x_start: xLocal, x_end: xLocal + spindleWidth, y_start: side.y, y_end: side.y + spindleWidth, z_bottom: i * actualRise + actualRise, z_top: i * actualRise + actualRise + spindleLen },
          dimensions_mm: { width: spindleWidth, depth: spindleWidth, length: spindleLen },
          volume_mm3: spindleWidth * spindleWidth * spindleLen,
          weight_kg: weightKg(spindleWidth * spindleWidth * spindleLen, timberSpecies)
        });
      }
    }
  }

  // ── Handrails (left and right, following the pitch) ──
  const handrailDiag = stringDiagonal;
  for (const side of [{ name: "left", y: 0 }, { name: "right", y: width - 50 }]) {
    parts.handrails.push({
      id: `HR-${side.name.toUpperCase()}`,
      component: "handrail",
      side: side.name,
      timber: timberSpecies,
      position: { x_start: 0, x_end: flightLength, y_start: side.y, y_end: side.y + 50, z_bottom: handrailHeight, z_top: handrailHeight + 50 },
      dimensions_mm: { length_diagonal: Math.round(handrailDiag), width: 50, thickness: 50 },
      pitch_deg: Math.round(Math.atan(actualRise / chosenGoing) * 180 / Math.PI * 10) / 10,
      volume_mm3: handrailDiag * 50 * 50,
      weight_kg: weightKg(handrailDiag * 50 * 50, timberSpecies)
    });
  }

  return {
    parts,
    boundingBox: {
      min: { x: 0, y: 0, z: 0 },
      max: { x: flightLength, y: width, z: totalRise + handrailHeight + 50 }
    },
    metrics: {
      total_treads: parts.treads.length,
      total_risers: parts.risers.length,
      total_strings: parts.strings.length,
      total_newels: parts.newels.length,
      total_spindles: parts.spindles.length,
      total_handrails: parts.handrails.length,
      flight_length_mm: flightLength,
      total_rise_mm: totalRise,
      string_diagonal_mm: Math.round(stringDiagonal),
      pitch_deg: Math.round(Math.atan(actualRise / chosenGoing) * 180 / Math.PI * 10) / 10,
      total_volume_mm3: [...parts.treads, ...parts.risers, ...parts.strings, ...parts.newels, ...parts.spindles, ...parts.handrails].reduce((a, p) => a + (p.volume_mm3 ?? 0), 0),
      total_weight_kg: Math.round([...parts.treads, ...parts.risers, ...parts.strings, ...parts.newels, ...parts.spindles, ...parts.handrails].reduce((a, p) => a + (p.weight_kg ?? 0), 0) * 10) / 10
    }
  };
}

// ═══════════════════════════════════════════════════════════════
// LAYOUT: HALF-TURN with LANDING (compact — two flights doubled back)
// ═══════════════════════════════════════════════════════════════
function buildHalfTurnLanding(cfg) {
  const { numRises, actualRise, chosenGoing, width } = cfg;
  const halfPointRises = Math.ceil(numRises / 2);
  const upperFlightRises = numRises - halfPointRises;
  const flight1 = buildStraight({ ...cfg, numRises: halfPointRises, numGoings: halfPointRises - 1 });
  const flight2 = buildStraight({ ...cfg, numRises: upperFlightRises, numGoings: upperFlightRises - 1 });

  // Landing sits at Z = halfPointRises * actualRise, size = width x (2 * width)
  const landingSize = { length: 2 * width, depth: width, thickness: 40 };
  const landingZ = halfPointRises * actualRise;

  // Translate flight2 so it runs the opposite direction on the OTHER side of the landing
  // Simplified: flight2 X-flipped and offset so origin is at end of landing
  const flight2FlightLength = (upperFlightRises - 1) * chosenGoing + chosenGoing;
  const offsetForFlight2 = { x: -flight2FlightLength, y: width, z: landingZ };

  const landing = {
    id: "L-HALF",
    component: "landing",
    timber: cfg.timberSpecies ?? "european_oak",
    position: { x_start: 0, x_end: width, y_start: 0, y_end: 2 * width, z_bottom: landingZ - landingSize.thickness, z_top: landingZ },
    dimensions_mm: landingSize,
    volume_mm3: landingSize.length * landingSize.depth * landingSize.thickness,
    weight_kg: weightKg(landingSize.length * landingSize.depth * landingSize.thickness, cfg.timberSpecies ?? "european_oak")
  };

  return {
    parts: {
      flight1: flight1.parts,
      landing,
      flight2: { ...flight2.parts, _offset: offsetForFlight2 }
    },
    boundingBox: {
      min: { x: offsetForFlight2.x, y: 0, z: 0 },
      max: { x: flight1.boundingBox.max.x, y: 2 * width, z: flight1.boundingBox.max.z + flight2.boundingBox.max.z }
    },
    metrics: {
      layout: "half_turn_landing",
      flight_1: flight1.metrics,
      landing_area_m2: (landingSize.length * landingSize.depth) / 1e6,
      flight_2: flight2.metrics,
      combined_weight_kg: Math.round((flight1.metrics.total_weight_kg + flight2.metrics.total_weight_kg + landing.weight_kg) * 10) / 10
    }
  };
}

// ═══════════════════════════════════════════════════════════════
// MAIN: buildGeometry() — dispatches to the right layout builder
// ═══════════════════════════════════════════════════════════════
export function buildGeometry(inputs) {
  const {
    ftf, downFinish = 0, upFinish = 0,
    layout = "straight", width = 900,
    rise, going, treadThickness = 40, riserThickness = 18,
    stringThickness = 32, stringDepth = 300,
    nosingProjection = 22, spindleSpacingCentres = 95,
    spindleWidth = 40, newelSize = 90, handrailHeight = 950,
    timberSpecies = "european_oak"
  } = inputs;

  const eff = effectiveFtf(ftf, downFinish, upFinish);
  const actualRise = rise ?? Math.round(eff / Math.ceil(eff / 220));
  const numRises = Math.round(eff / actualRise);
  const chosenGoing = going ?? 250;
  const numGoings = numRises - 1;

  const cfg = {
    numRises, actualRise, numGoings, chosenGoing, width,
    treadThickness, riserThickness, stringThickness, stringDepth,
    nosingProjection, spindleSpacingCentres, spindleWidth,
    newelSize, handrailHeight, timberSpecies
  };

  let geom;
  if (layout === "straight") geom = buildStraight(cfg);
  else if (layout === "half_turn_landing") geom = buildHalfTurnLanding(cfg);
  else {
    return {
      engine_version: "1.0",
      status: "UNSUPPORTED_LAYOUT",
      supported_v1: ["straight", "half_turn_landing"],
      requested: layout,
      note: "Layout not yet supported by the geometry engine. Straight and half-turn-landing are V1; winder/spiral/curved layouts need dedicated geometry builders (planned for V2)."
    };
  }

  return {
    engine_version: "1.0",
    inputs: {
      ftf, downFinish, upFinish, layout, width, actualRise, chosenGoing,
      timberSpecies, treadThickness, riserThickness, stringDepth, stringThickness,
      nosingProjection, spindleSpacingCentres, spindleWidth, newelSize, handrailHeight
    },
    effective_ftf_mm: eff,
    computed: {
      num_rises: numRises,
      num_goings: numGoings,
      actual_rise_mm: actualRise,
      chosen_going_mm: chosenGoing,
      pitch_deg: Math.round(Math.atan(actualRise / chosenGoing) * 180 / Math.PI * 10) / 10
    },
    ...geom
  };
}

// ═══════════════════════════════════════════════════════════════
// PART GENERATOR — derives structured part list from geometry
// ═══════════════════════════════════════════════════════════════
export function generateParts(geom) {
  if (geom.status === "UNSUPPORTED_LAYOUT") return { status: "UNSUPPORTED_LAYOUT", parts: [] };

  const flatten = (parts) => {
    const out = [];
    for (const [category, items] of Object.entries(parts)) {
      if (Array.isArray(items)) out.push(...items.map(it => ({ ...it, category })));
      else if (items && typeof items === "object" && "id" in items) out.push({ ...items, category });
      else if (items && typeof items === "object") {
        for (const [subcat, subitems] of Object.entries(items)) {
          if (subcat === "_offset") continue;
          if (Array.isArray(subitems)) out.push(...subitems.map(it => ({ ...it, category: `${category}.${subcat}` })));
          else if (subitems && typeof subitems === "object" && "id" in subitems) out.push({ ...subitems, category: `${category}.${subcat}` });
        }
      }
    }
    return out;
  };

  const allParts = flatten(geom.parts);
  const partList = allParts.map((p, i) => ({
    part_number: `PART-${String(i + 1).padStart(3, "0")}`,
    id:          p.id,
    component:   p.component,
    category:    p.category,
    timber:      p.timber,
    dimensions:  p.dimensions_mm,
    volume_mm3:  p.volume_mm3,
    weight_kg:   p.weight_kg,
    status:      "ready_for_cnc",
    notes:       p.notes ?? null
  }));

  const summary = {
    total_parts:            partList.length,
    total_volume_mm3:       partList.reduce((a, p) => a + (p.volume_mm3 ?? 0), 0),
    total_volume_m3:        Math.round(partList.reduce((a, p) => a + (p.volume_mm3 ?? 0), 0) / 1e9 * 1000) / 1000,
    total_weight_kg:        Math.round(partList.reduce((a, p) => a + (p.weight_kg ?? 0), 0) * 10) / 10,
    by_component: partList.reduce((acc, p) => { acc[p.component] = (acc[p.component] ?? 0) + 1; return acc; }, {})
  };

  return { engine_version: "1.0", summary, parts: partList };
}

// ═══════════════════════════════════════════════════════════════
// CLI
// ═══════════════════════════════════════════════════════════════
const invokedAsScript = process.argv[1] && import.meta.url.endsWith(path.basename(process.argv[1]));
if (invokedAsScript) {
  const args = {};
  for (let i = 2; i < process.argv.length; i++) {
    const a = process.argv[i];
    if (a.startsWith("--")) {
      const key = a.slice(2).replace(/-/g, "_");
      const next = process.argv[i + 1];
      if (next && !next.startsWith("--")) { args[key] = isNaN(next) ? next : Number(next); i++; }
      else args[key] = true;
    }
  }
  const opts = {
    ftf: args.ftf, downFinish: args.down_finish, upFinish: args.up_finish,
    layout: args.layout, width: args.width, rise: args.rise, going: args.going,
    timberSpecies: args.timber
  };
  const geom = buildGeometry(opts);
  const parts = generateParts(geom);

  if (args.parts_only) console.log(JSON.stringify(parts, null, 2));
  else if (args.summary) {
    console.log(`\n═══ GEOMETRY ENGINE ═══`);
    console.log(`Layout: ${opts.layout} · Width ${opts.width}mm · FTF ${opts.ftf}mm`);
    console.log(`Effective rise: ${geom.effective_ftf_mm}mm`);
    console.log(`Computed: ${geom.computed?.num_rises} rises at ${geom.computed?.actual_rise_mm}mm · ${geom.computed?.num_goings} goings at ${geom.computed?.chosen_going_mm}mm · pitch ${geom.computed?.pitch_deg}°`);
    console.log(`\nPart summary (${parts.summary.total_parts} parts, ${parts.summary.total_weight_kg}kg total):`);
    for (const [c, n] of Object.entries(parts.summary.by_component)) console.log(`  ${String(n).padStart(3)} × ${c}`);
    console.log();
  } else {
    console.log(JSON.stringify({ geometry: geom, parts }, null, 2));
  }
}
