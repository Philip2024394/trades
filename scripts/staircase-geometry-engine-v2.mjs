#!/usr/bin/env node
// STAIRCASE GEOMETRY ENGINE V2 — parametric CAD-style model.
// Per Philip's spec (2026-07-25) upgrading V1 with:
//   1. Stable component IDs (TREAD-001, STRING-L-001, etc.)
//   2. Parent/child relationships
//   3. World + local coordinate systems (position, rotation, scale, normal)
//   4. Constraint solver (parameters → derived values with dependency tracking)
//   5. Revision history (no overwriting)
//   6. Manufacturing metadata (status, machine, tool, operation, minutes)
//   7. Dimensional tolerances (nominal ± tolerance → min/max)
//   8. Materials as objects (MAT-001 references)
//   9. Event system (emit on change, subscribers auto-update)
//  10. Fully parametric: change one parameter → whole model updates automatically
//
// Architecture:
//   Parameters (leaf inputs)
//        │
//        ▼
//   Constraint Solver (dependency graph, evaluates derived values)
//        │
//        ▼
//   Geometry Model (components with world+local coords, tolerances, metadata)
//        │
//        ▼
//   Event Bus emits geometry_rebuilt with affected component IDs
//        │
//        ▼
//   Downstream engines (compliance, drawings, CNC, 3D, pricing) subscribe

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const TIMBER_DB = JSON.parse(fs.readFileSync(path.resolve(__dirname, "..", "data", "timber-species.json"), "utf8"));

// ═══════════════════════════════════════════════════════════════
// MATERIAL REGISTRY — materials as first-class objects (MAT-001 refs)
// ═══════════════════════════════════════════════════════════════
export function buildMaterialRegistry() {
  const materials = {};
  TIMBER_DB.species.forEach((s, i) => {
    const id = `MAT-${String(i + 1).padStart(3, "0")}`;
    const [dMin, dMax] = s.density_kg_m3;
    materials[id] = {
      id, species_id: s.id, name: s.name, type: s.type,
      density_kg_m3: Math.round((dMin + dMax) / 2),
      janka_hardness_lbf: s.janka_hardness_lbf,
      moisture_movement: s.moisture_movement,
      cost_band: s.cost_band,
      machining_difficulty: s.machining_difficulty,
      typical_finish: s.typical_finish,
      notes: s.notes
    };
  });
  return materials;
}
const MATERIALS = buildMaterialRegistry();
export function findMaterialBySpecies(speciesId) {
  return Object.values(MATERIALS).find(m => m.species_id === speciesId);
}

// ═══════════════════════════════════════════════════════════════
// DIMENSION with TOLERANCE — nominal ± tol → min/max
// ═══════════════════════════════════════════════════════════════
function dim(nominal, tolerance = 0.5) {
  return {
    nominal,
    tolerance,
    min: Math.round((nominal - tolerance) * 100) / 100,
    max: Math.round((nominal + tolerance) * 100) / 100,
    unit: "mm"
  };
}

// ═══════════════════════════════════════════════════════════════
// EVENT BUS — publisher/subscriber
// ═══════════════════════════════════════════════════════════════
class EventBus {
  constructor() { this.subs = new Map(); }
  on(event, handler) {
    if (!this.subs.has(event)) this.subs.set(event, []);
    this.subs.get(event).push(handler);
    return () => this.off(event, handler);
  }
  off(event, handler) {
    const arr = this.subs.get(event);
    if (arr) this.subs.set(event, arr.filter(h => h !== handler));
  }
  emit(event, payload) {
    const handlers = this.subs.get(event) ?? [];
    for (const h of handlers) { try { h(payload); } catch (e) { /* swallow subscriber errors */ } }
  }
}

// ═══════════════════════════════════════════════════════════════
// PARAMETRIC MODEL — parameters + derived values + constraint solver
// ═══════════════════════════════════════════════════════════════
export class ParametricStairModel {
  constructor(initialParameters = {}) {
    this.bus = new EventBus();
    this.revision = 0;
    this.history = [];
    this.parameters = {};
    this.derivedValues = {};
    this.components = {}; // id → component
    this.dependencyGraph = {}; // derived_id → [dependent parameter ids]
    this.materialRegistry = MATERIALS;

    this._defineParameters();
    this._defineDerivedValues();
    this._defineComponentBuilders();

    for (const [k, v] of Object.entries(initialParameters)) {
      if (this.parameters[k] !== undefined) this.parameters[k].value = v;
    }
    this._rebuild(); // initial build = revision 1
  }

  // ── Parameter definitions (leaf inputs, user-controlled)
  _defineParameters() {
    this.parameters = {
      ftf:                { id: "P-FTF",        value: 2500, unit: "mm",  min: 1500, max: 5000, tolerance: 2, label: "Structural floor-to-floor height" },
      downFinish:         { id: "P-DOWN-FIN",   value: 20,   unit: "mm",  min: 0,    max: 60,   tolerance: 1, label: "Downstairs floor finish thickness" },
      upFinish:           { id: "P-UP-FIN",     value: 20,   unit: "mm",  min: 0,    max: 60,   tolerance: 1, label: "Upstairs floor finish thickness" },
      width:              { id: "P-WIDTH",      value: 900,  unit: "mm",  min: 760,  max: 1500, tolerance: 3, label: "Flight width" },
      chosenGoing:        { id: "P-GOING",      value: 250,  unit: "mm",  min: 220,  max: 320,  tolerance: 1, label: "Chosen going" },
      maxRise:            { id: "P-MAX-RISE",   value: 220,  unit: "mm",  min: 150,  max: 220,  tolerance: 1, label: "Max allowed rise (Doc K)" },
      treadThickness:     { id: "P-TREAD-TH",   value: 40,   unit: "mm",  min: 25,   max: 60,   tolerance: 0.5, label: "Tread thickness" },
      riserThickness:     { id: "P-RISER-TH",   value: 18,   unit: "mm",  min: 12,   max: 25,   tolerance: 0.5, label: "Riser thickness" },
      stringThickness:    { id: "P-STRING-TH",  value: 32,   unit: "mm",  min: 25,   max: 50,   tolerance: 0.5, label: "String thickness" },
      stringDepth:        { id: "P-STRING-DP",  value: 300,  unit: "mm",  min: 220,  max: 400,  tolerance: 2, label: "String depth" },
      nosingProjection:   { id: "P-NOSING",     value: 22,   unit: "mm",  min: 15,   max: 30,   tolerance: 1, label: "Nosing overhang" },
      spindleSpacing:     { id: "P-SP-SPACE",   value: 95,   unit: "mm",  min: 60,   max: 99,   tolerance: 1, label: "Spindle spacing (100mm sphere)" },
      spindleWidth:       { id: "P-SP-WIDTH",   value: 40,   unit: "mm",  min: 25,   max: 60,   tolerance: 0.5, label: "Spindle width" },
      newelSize:          { id: "P-NEWEL",      value: 90,   unit: "mm",  min: 60,   max: 120,  tolerance: 1, label: "Newel post size" },
      handrailHeight:     { id: "P-HR-HEIGHT",  value: 950,  unit: "mm",  min: 900,  max: 1000, tolerance: 5, label: "Handrail height (Doc K 900-1000)" },
      timberSpeciesId:    { id: "P-TIMBER",     value: "european_oak", unit: "species", label: "Timber species" },
      layout:             { id: "P-LAYOUT",     value: "straight",     unit: "layout",  label: "Staircase layout type" }
    };
  }

  // ── Derived value definitions (with dependency declarations)
  _defineDerivedValues() {
    const p = () => this.parameters;
    this.derivedValues = {
      effectiveFtf: { id: "D-EFF-FTF", label: "Effective FTF after flooring", depends_on: ["P-FTF", "P-DOWN-FIN", "P-UP-FIN"],
        compute: () => p().ftf.value + p().upFinish.value - p().downFinish.value },
      numRises: { id: "D-NUM-RISES", label: "Number of rises", depends_on: ["D-EFF-FTF", "P-MAX-RISE"],
        compute: () => Math.ceil(this.derivedValues.effectiveFtf.value / p().maxRise.value) },
      actualRise: { id: "D-ACT-RISE", label: "Actual rise per step", depends_on: ["D-EFF-FTF", "D-NUM-RISES"],
        compute: () => Math.round(this.derivedValues.effectiveFtf.value / this.derivedValues.numRises.value) },
      numGoings: { id: "D-NUM-GOINGS", label: "Number of goings", depends_on: ["D-NUM-RISES"],
        compute: () => this.derivedValues.numRises.value - 1 },
      flightLength: { id: "D-FLIGHT-LEN", label: "Flight horizontal length", depends_on: ["D-NUM-GOINGS", "P-GOING"],
        compute: () => this.derivedValues.numGoings.value * p().chosenGoing.value },
      totalRise: { id: "D-TOTAL-RISE", label: "Total vertical rise", depends_on: ["D-NUM-RISES", "D-ACT-RISE"],
        compute: () => this.derivedValues.numRises.value * this.derivedValues.actualRise.value },
      pitchDeg: { id: "D-PITCH", label: "Stair pitch (degrees)", depends_on: ["D-ACT-RISE", "P-GOING"],
        compute: () => Math.round(Math.atan(this.derivedValues.actualRise.value / p().chosenGoing.value) * 180 / Math.PI * 10) / 10 },
      stringDiagonal: { id: "D-STR-DIAG", label: "String diagonal length", depends_on: ["D-FLIGHT-LEN", "D-TOTAL-RISE"],
        compute: () => Math.round(Math.sqrt(Math.pow(this.derivedValues.flightLength.value, 2) + Math.pow(this.derivedValues.totalRise.value, 2))) },
      twoRG: { id: "D-2R-G", label: "2R+G comfort formula", depends_on: ["D-ACT-RISE", "P-GOING"],
        compute: () => 2 * this.derivedValues.actualRise.value + p().chosenGoing.value }
    };
  }

  // ── Component builders (called during rebuild)
  _defineComponentBuilders() {
    this.componentBuilders = { straight: this._buildStraight.bind(this), half_turn_landing: this._buildHalfTurn.bind(this) };
  }

  // ── The rebuild pipeline
  _rebuild(reason = "initial build") {
    // 1. Evaluate all derived values in dependency order
    for (const dv of Object.values(this.derivedValues)) {
      dv.value = dv.compute();
    }
    // 2. Rebuild all components
    this.components = {};
    const builder = this.componentBuilders[this.parameters.layout.value];
    if (!builder) throw new Error(`Unsupported layout: ${this.parameters.layout.value}`);
    builder();
    // 3. Bump revision + snapshot
    this.revision += 1;
    this.history.push({ revision: this.revision, timestamp: new Date().toISOString(), reason,
      parameters: JSON.parse(JSON.stringify(this.parameters)),
      derived_values: Object.fromEntries(Object.entries(this.derivedValues).map(([k, v]) => [k, { id: v.id, value: v.value }])),
      component_count: Object.keys(this.components).length });
    // 4. Emit event
    this.bus.emit("geometry_rebuilt", { revision: this.revision, reason, component_ids: Object.keys(this.components) });
  }

  // ── Public parameter setter — triggers full rebuild + event
  setParameter(paramName, newValue) {
    if (!this.parameters[paramName]) throw new Error(`Unknown parameter: ${paramName}`);
    const oldValue = this.parameters[paramName].value;
    this.parameters[paramName].value = newValue;
    this.bus.emit("parameter_changed", { id: this.parameters[paramName].id, name: paramName, oldValue, newValue });
    this._rebuild(`Parameter ${paramName} changed from ${oldValue} to ${newValue}`);
  }

  // ── Snapshot access
  getRevision(rev) { return this.history.find(h => h.revision === rev); }
  getCurrentSnapshot() { return { revision: this.revision, parameters: this.parameters, derived_values: this.derivedValues, components: this.components }; }

  // ═══════════════════════════════════════════════════════════════
  // COMPONENT BUILDERS — construct the geometry with stable IDs +
  // parent/child + world+local coords + tolerances + manufacturing meta
  // ═══════════════════════════════════════════════════════════════
  _addComponent(id, spec) {
    this.components[id] = spec;
    return spec;
  }

  _defaultMaterial() {
    return findMaterialBySpecies(this.parameters.timberSpeciesId.value)?.id ?? "MAT-001";
  }

  _weight(volumeMm3, materialId) {
    const mat = this.materialRegistry[materialId];
    if (!mat) return 0;
    return Math.round((volumeMm3 / 1e9) * mat.density_kg_m3 * 10) / 10;
  }

  _buildStraight() {
    const p = this.parameters, d = this.derivedValues;
    const matId = this._defaultMaterial();

    // Strings (left + right) — parents of treads/risers
    for (const side of [{ n: "L", y: 0 }, { n: "R", y: p.width.value - p.stringThickness.value }]) {
      const id = `STRING-${side.n}-001`;
      this._addComponent(id, {
        id, parent: null, children: [],
        component: "string", side: side.n.toLowerCase() === "l" ? "left" : "right",
        material_id: matId,
        world_position: { x: 0, y: side.y, z: 0 },
        local_position: { x: 0, y: side.y, z: 0 },
        rotation: { pitch_deg: d.pitchDeg.value, yaw_deg: 0, roll_deg: 0 },
        scale: { x: 1, y: 1, z: 1 },
        normal: { x: 0, y: side.n === "L" ? 1 : -1, z: 0 },
        dimensions: {
          length_diagonal: dim(d.stringDiagonal.value, 1),
          depth: dim(p.stringDepth.value, 2),
          thickness: dim(p.stringThickness.value, 0.5)
        },
        volume_mm3: d.stringDiagonal.value * p.stringDepth.value * p.stringThickness.value,
        weight_kg: this._weight(d.stringDiagonal.value * p.stringDepth.value * p.stringThickness.value, matId),
        manufacturing: { status: "READY", machine: "CNC", tool: "12mm router", operation: "housing_cut",
          estimated_minutes: 45 + d.numRises.value + d.numGoings.value },
        notes: `${d.numGoings.value} tread housings + ${d.numRises.value} riser grooves`
      });
    }

    // Treads (each parented to left string)
    for (let i = 0; i < d.numGoings.value; i++) {
      const id = `TREAD-${String(i + 1).padStart(3, "0")}`;
      const parentId = "STRING-L-001";
      const xStart = i * p.chosenGoing.value - p.nosingProjection.value;
      const xEnd = xStart + p.chosenGoing.value + p.nosingProjection.value;
      const z = (i + 1) * d.actualRise.value;
      const length = p.chosenGoing.value + p.nosingProjection.value;
      const volume = length * p.width.value * p.treadThickness.value;
      this._addComponent(id, {
        id, parent: parentId, children: [],
        component: "tread",
        material_id: matId,
        world_position: { x: xStart, y: 0, z: z - p.treadThickness.value },
        local_position: { x: xStart, y: 0, z: z - p.treadThickness.value },
        rotation: { pitch_deg: 0, yaw_deg: 0, roll_deg: 0 },
        scale: { x: 1, y: 1, z: 1 },
        normal: { x: 0, y: 0, z: 1 },
        dimensions: {
          length: dim(length, 0.5),
          width: dim(p.width.value, 1),
          thickness: dim(p.treadThickness.value, 0.5)
        },
        bounding_box_world: { x_start: xStart, x_end: xEnd, y_start: 0, y_end: p.width.value, z_top: z, z_bottom: z - p.treadThickness.value },
        volume_mm3: volume,
        weight_kg: this._weight(volume, matId),
        manufacturing: { status: "READY", machine: "CNC", tool: "12mm router",
          operation: "tread_machining", estimated_minutes: 8 },
        notes: `Nosing projects ${p.nosingProjection.value}mm past riser (not counted in going)`
      });
      this.components[parentId].children.push(id);
    }

    // Risers (parented to left string, sibling to nearest tread)
    for (let i = 0; i < d.numRises.value; i++) {
      const id = `RISER-${String(i + 1).padStart(3, "0")}`;
      const parentId = "STRING-L-001";
      const x = i * p.chosenGoing.value;
      const zBottom = i * d.actualRise.value;
      const zTop = zBottom + d.actualRise.value;
      const volume = d.actualRise.value * p.width.value * p.riserThickness.value;
      this._addComponent(id, {
        id, parent: parentId, children: [],
        component: "riser",
        material_id: matId,
        world_position: { x, y: 0, z: zBottom },
        local_position: { x, y: 0, z: zBottom },
        rotation: { pitch_deg: 0, yaw_deg: 0, roll_deg: 0 },
        scale: { x: 1, y: 1, z: 1 },
        normal: { x: -1, y: 0, z: 0 },
        dimensions: {
          length: dim(d.actualRise.value, 0.5),
          width: dim(p.width.value, 1),
          thickness: dim(p.riserThickness.value, 0.5)
        },
        volume_mm3: volume,
        weight_kg: this._weight(volume, matId),
        manufacturing: { status: "READY", machine: "CNC", tool: "12mm router", operation: "riser_cut", estimated_minutes: 4 }
      });
      this.components[parentId].children.push(id);
    }

    // Newels (4 corners) — top-level components (no parent)
    const newelH = d.totalRise.value + p.handrailHeight.value + 50;
    for (const np of [
      { id: "NEWEL-001", label: "bottom-left",  x: 0, y: 0 },
      { id: "NEWEL-002", label: "bottom-right", x: 0, y: p.width.value - p.newelSize.value },
      { id: "NEWEL-003", label: "top-left",     x: d.flightLength.value, y: 0 },
      { id: "NEWEL-004", label: "top-right",    x: d.flightLength.value, y: p.width.value - p.newelSize.value }
    ]) {
      const volume = p.newelSize.value * p.newelSize.value * newelH;
      this._addComponent(np.id, {
        id: np.id, parent: null, children: [],
        component: "newel",
        label: np.label,
        material_id: matId,
        world_position: { x: np.x, y: np.y, z: 0 },
        local_position: { x: np.x, y: np.y, z: 0 },
        rotation: { pitch_deg: 0, yaw_deg: 0, roll_deg: 0 },
        scale: { x: 1, y: 1, z: 1 },
        normal: { x: 0, y: 0, z: 1 },
        dimensions: {
          width: dim(p.newelSize.value, 0.5),
          depth: dim(p.newelSize.value, 0.5),
          height: dim(newelH, 2)
        },
        volume_mm3: volume,
        weight_kg: this._weight(volume, matId),
        manufacturing: { status: "READY", machine: "CNC", tool: "16mm router", operation: "newel_mortising", estimated_minutes: 30 }
      });
    }

    // Handrails — parented to newels
    for (const side of [{ n: "L", y: 0, parent: "NEWEL-001" }, { n: "R", y: p.width.value - 50, parent: "NEWEL-002" }]) {
      const id = `HANDRAIL-${side.n}-001`;
      const volume = d.stringDiagonal.value * 50 * 50;
      this._addComponent(id, {
        id, parent: side.parent, children: [],
        component: "handrail", side: side.n === "L" ? "left" : "right",
        material_id: matId,
        world_position: { x: 0, y: side.y, z: p.handrailHeight.value },
        local_position: { x: 0, y: side.y, z: p.handrailHeight.value },
        rotation: { pitch_deg: d.pitchDeg.value, yaw_deg: 0, roll_deg: 0 },
        scale: { x: 1, y: 1, z: 1 },
        normal: { x: 0, y: side.n === "L" ? 1 : -1, z: 0 },
        dimensions: {
          length_diagonal: dim(d.stringDiagonal.value, 1),
          width: dim(50, 0.5),
          thickness: dim(50, 0.5)
        },
        volume_mm3: volume,
        weight_kg: this._weight(volume, matId),
        manufacturing: { status: "READY", machine: "CNC", tool: "moulding cutter", operation: "handrail_profile", estimated_minutes: 25 }
      });
      this.components[side.parent].children.push(id);
    }

    // Spindles — parented to their nearest tread
    const spindlesPerTread = Math.max(1, Math.ceil(p.chosenGoing.value / p.spindleSpacing.value));
    const spindleLen = p.handrailHeight.value - 50;
    let spindleCounter = 0;
    for (let i = 0; i < d.numGoings.value; i++) {
      const treadId = `TREAD-${String(i + 1).padStart(3, "0")}`;
      for (let s = 0; s < spindlesPerTread; s++) {
        for (const side of [{ n: "L", y: 0 }, { n: "R", y: p.width.value - p.spindleWidth.value }]) {
          spindleCounter++;
          const spId = `SPINDLE-${side.n}${String(spindleCounter).padStart(3, "0")}`;
          const xLocal = i * p.chosenGoing.value + (s + 1) * p.chosenGoing.value / (spindlesPerTread + 1);
          const zBottom = i * d.actualRise.value + d.actualRise.value;
          const volume = p.spindleWidth.value * p.spindleWidth.value * spindleLen;
          this._addComponent(spId, {
            id: spId, parent: treadId, children: [],
            component: "spindle", side: side.n === "L" ? "left" : "right",
            material_id: matId,
            world_position: { x: xLocal, y: side.y, z: zBottom },
            local_position: { x: xLocal - i * p.chosenGoing.value, y: side.y, z: 0 },
            rotation: { pitch_deg: 0, yaw_deg: 0, roll_deg: 0 },
            scale: { x: 1, y: 1, z: 1 },
            normal: { x: 0, y: 0, z: 1 },
            dimensions: {
              width: dim(p.spindleWidth.value, 0.5),
              depth: dim(p.spindleWidth.value, 0.5),
              length: dim(spindleLen, 1)
            },
            volume_mm3: volume,
            weight_kg: this._weight(volume, matId),
            manufacturing: { status: "READY", machine: "lathe", tool: "spindle turning", operation: "spindle_turn", estimated_minutes: 5 }
          });
          this.components[treadId].children.push(spId);
        }
      }
    }
  }

  _buildHalfTurn() {
    // For V2 initial implementation, use the straight builder logic with a note.
    // Full half-turn parametric geometry (with landing as a proper first-class parented component)
    // is Batch 29+ work. For now, indicate the layout as under development.
    this._buildStraight();
    this._addComponent("LANDING-001", {
      id: "LANDING-001", parent: null, children: [],
      component: "landing",
      material_id: this._defaultMaterial(),
      world_position: { x: 0, y: 0, z: this.derivedValues.totalRise.value / 2 },
      local_position: { x: 0, y: 0, z: this.derivedValues.totalRise.value / 2 },
      rotation: { pitch_deg: 0, yaw_deg: 0, roll_deg: 0 },
      scale: { x: 1, y: 1, z: 1 },
      normal: { x: 0, y: 0, z: 1 },
      dimensions: {
        length: dim(this.parameters.width.value * 2, 1),
        width: dim(this.parameters.width.value, 1),
        thickness: dim(this.parameters.treadThickness.value, 0.5)
      },
      volume_mm3: this.parameters.width.value * this.parameters.width.value * 2 * this.parameters.treadThickness.value,
      weight_kg: 0,
      manufacturing: { status: "READY", machine: "CNC", tool: "12mm router", operation: "landing_assembly", estimated_minutes: 60 },
      notes: "V2 half-turn is a stub — landing added as placeholder; full parametric half-turn geometry is a follow-up build."
    });
  }

  // ═══════════════════════════════════════════════════════════════
  // EVENT ACCESS
  // ═══════════════════════════════════════════════════════════════
  on(event, handler) { return this.bus.on(event, handler); }
}

// ═══════════════════════════════════════════════════════════════
// CLI DEMO
// ═══════════════════════════════════════════════════════════════
const invokedAsScript = process.argv[1] && import.meta.url.endsWith(path.basename(process.argv[1]));
if (invokedAsScript) {
  const model = new ParametricStairModel({ ftf: 2500, width: 900, chosenGoing: 250 });
  console.log(`═══ PARAMETRIC MODEL V2 ═══`);
  console.log(`Revision ${model.revision} · ${Object.keys(model.components).length} components`);
  console.log(`\nDerived values:`);
  for (const [name, dv] of Object.entries(model.derivedValues)) {
    console.log(`  ${dv.id.padEnd(15)} = ${dv.value}   (${dv.label})`);
  }
  console.log(`\nSample components:`);
  for (const id of ["STRING-L-001", "TREAD-001", "RISER-001", "NEWEL-001", "HANDRAIL-L-001", "SPINDLE-L001"]) {
    const c = model.components[id];
    if (!c) continue;
    console.log(`  ${id.padEnd(18)} parent=${(c.parent ?? "-").padEnd(14)} material=${c.material_id}  ${c.weight_kg}kg  status=${c.manufacturing.status}`);
  }

  // Demonstrate event system + parametric propagation
  console.log(`\n═══ CHANGING PARAMETER: width 900 → 1000 ═══`);
  const unsub = model.on("geometry_rebuilt", (payload) => {
    console.log(`  event: geometry_rebuilt → revision ${payload.revision} (${payload.component_ids.length} components), reason: ${payload.reason}`);
  });
  model.setParameter("width", 1000);
  console.log(`  new revision: ${model.revision}`);
  console.log(`  TREAD-001 width is now: ${model.components["TREAD-001"].dimensions.width.nominal}mm (was 900mm before)`);
  console.log(`  effective_ftf: ${model.derivedValues.effectiveFtf.value}mm · num_rises: ${model.derivedValues.numRises.value} · actual_rise: ${model.derivedValues.actualRise.value}mm`);
  console.log(`  history has ${model.history.length} revisions preserved`);
}
