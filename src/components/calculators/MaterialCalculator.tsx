"use client";

// MaterialCalculator — single entry point for every calculator type.
// Renders the right scenario picker + input panel based on `type`, runs
// the matching compute() from src/lib/calculators/<type>.ts, and hands
// the output to the shared CalculatorOutputPanel + CrossSellPanel.

import { useMemo, useState } from "react";
import {
  computePaint,
  paintComplementarySubcategories,
  PAINT_DEFAULT_INPUTS_BY_SCENARIO,
  PAINT_DEFAULT_SCENARIO,
  PAINT_SCENARIO_LABEL,
  type PaintInputs,
  type PaintScenario
} from "@/lib/calculators/paint";
import {
  computeFlooring,
  flooringComplementarySubcategories,
  FLOORING_DEFAULT_INPUTS_BY_SCENARIO,
  FLOORING_DEFAULT_SCENARIO,
  FLOORING_SCENARIO_LABEL,
  type FlooringInputs,
  type FlooringScenario
} from "@/lib/calculators/flooring";
import {
  computeTiles,
  tilesComplementarySubcategories,
  TILES_DEFAULT_INPUTS_BY_SCENARIO,
  TILES_DEFAULT_SCENARIO,
  TILES_SCENARIO_LABEL,
  type TilesInputs,
  type TilesScenario
} from "@/lib/calculators/tiles";
import {
  computeGravel,
  gravelComplementarySubcategories,
  GRAVEL_DEFAULT_INPUTS_BY_SCENARIO,
  GRAVEL_DEFAULT_SCENARIO,
  GRAVEL_SCENARIO_LABEL,
  type GravelInputs,
  type GravelScenario
} from "@/lib/calculators/gravel";
import {
  computeConcrete,
  concreteComplementarySubcategories,
  CONCRETE_DEFAULT_INPUTS_BY_SCENARIO,
  CONCRETE_DEFAULT_SCENARIO,
  CONCRETE_SCENARIO_LABEL,
  type ConcreteInputs,
  type ConcreteScenario
} from "@/lib/calculators/concrete";
import {
  computeMortar,
  mortarComplementarySubcategories,
  MORTAR_DEFAULT_INPUTS_BY_SCENARIO,
  MORTAR_DEFAULT_SCENARIO,
  MORTAR_SCENARIO_LABEL,
  type MortarInputs,
  type MortarScenario
} from "@/lib/calculators/mortar";
import {
  computeBricks,
  bricksComplementarySubcategories,
  BRICKS_DEFAULT_INPUTS_BY_SCENARIO,
  BRICKS_DEFAULT_SCENARIO,
  BRICKS_SCENARIO_LABEL,
  type BricksInputs,
  type BricksScenario
} from "@/lib/calculators/bricks";
import {
  computePlasterboard,
  plasterboardComplementarySubcategories,
  PLASTERBOARD_DEFAULT_INPUTS_BY_SCENARIO,
  PLASTERBOARD_DEFAULT_SCENARIO,
  PLASTERBOARD_SCENARIO_LABEL,
  type PlasterboardInputs,
  type PlasterboardScenario
} from "@/lib/calculators/plasterboard";
import {
  computeInsulation,
  insulationComplementarySubcategories,
  INSULATION_DEFAULT_INPUTS_BY_SCENARIO,
  INSULATION_DEFAULT_SCENARIO,
  INSULATION_SCENARIO_LABEL,
  type InsulationInputs,
  type InsulationScenario
} from "@/lib/calculators/insulation";
import {
  computeDecking,
  deckingComplementarySubcategories,
  DECKING_DEFAULT_INPUTS_BY_SCENARIO,
  DECKING_DEFAULT_SCENARIO,
  DECKING_SCENARIO_LABEL,
  type DeckingInputs,
  type DeckingScenario
} from "@/lib/calculators/decking";
import {
  computeFencing,
  fencingComplementarySubcategories,
  FENCING_DEFAULT_INPUTS_BY_SCENARIO,
  FENCING_DEFAULT_SCENARIO,
  FENCING_SCENARIO_LABEL,
  type FencingInputs,
  type FencingScenario
} from "@/lib/calculators/fencing";
import {
  computePaving,
  pavingComplementarySubcategories,
  PAVING_DEFAULT_INPUTS_BY_SCENARIO,
  PAVING_DEFAULT_SCENARIO,
  PAVING_SCENARIO_LABEL,
  type PavingInputs,
  type PavingScenario
} from "@/lib/calculators/paving";
import {
  computeSkirting,
  skirtingComplementarySubcategories,
  SKIRTING_DEFAULT_INPUTS_BY_SCENARIO,
  SKIRTING_DEFAULT_SCENARIO,
  SKIRTING_SCENARIO_LABEL,
  type SkirtingInputs,
  type SkirtingScenario
} from "@/lib/calculators/skirting";
import {
  computeRoofTiles,
  roofTilesComplementarySubcategories,
  ROOF_TILES_DEFAULT_INPUTS_BY_SCENARIO,
  ROOF_TILES_DEFAULT_SCENARIO,
  ROOF_TILES_SCENARIO_LABEL,
  type RoofTilesInputs,
  type RoofTilesScenario
} from "@/lib/calculators/roof_tiles";
import {
  computeWallpaper,
  wallpaperComplementarySubcategories,
  WALLPAPER_DEFAULT_INPUTS_BY_SCENARIO,
  WALLPAPER_DEFAULT_SCENARIO,
  WALLPAPER_SCENARIO_LABEL,
  type WallpaperInputs,
  type WallpaperScenario
} from "@/lib/calculators/wallpaper";
import {
  computeRender,
  renderComplementarySubcategories,
  RENDER_DEFAULT_INPUTS_BY_SCENARIO,
  RENDER_DEFAULT_SCENARIO,
  RENDER_SCENARIO_LABEL,
  type RenderInputs,
  type RenderScenario
} from "@/lib/calculators/render";
import {
  computeTurf,
  turfComplementarySubcategories,
  TURF_DEFAULT_INPUTS_BY_SCENARIO,
  TURF_DEFAULT_SCENARIO,
  TURF_SCENARIO_LABEL,
  type TurfInputs,
  type TurfScenario
} from "@/lib/calculators/turf";
import type {
  CalculatorInputs,
  CalculatorOutput,
  CalculatorProductRef,
  CalculatorType
} from "@/lib/calculators/types";
import { CalculatorOutputPanel } from "./CalculatorOutputPanel";
import { CrossSellPanel } from "./CrossSellPanel";
import type { CrossSellProductRef } from "@/lib/calculators/crossSell";
import { addItem, type CartItem } from "@/lib/xratedCart";

export function MaterialCalculator({
  type, product, listingSlug, productSlug, siblings = []
}: {
  type: CalculatorType;
  product: CalculatorProductRef;
  listingSlug: string;
  productSlug: string;
  siblings?: CrossSellProductRef[];
}) {
  const p = { product, listingSlug, productSlug, siblings };
  if (type === "paint") return <PaintCalc {...p} />;
  if (type === "flooring") return <FlooringCalc {...p} />;
  if (type === "tiles") return <TilesCalc {...p} />;
  if (type === "gravel") return <GravelCalc {...p} />;
  if (type === "concrete") return <ConcreteCalc {...p} />;
  if (type === "mortar") return <MortarCalc {...p} />;
  if (type === "bricks") return <BricksCalc {...p} />;
  if (type === "plasterboard") return <PlasterboardCalc {...p} />;
  if (type === "insulation") return <InsulationCalc {...p} />;
  if (type === "decking") return <DeckingCalc {...p} />;
  if (type === "fencing") return <FencingCalc {...p} />;
  if (type === "paving") return <PavingCalc {...p} />;
  if (type === "skirting") return <SkirtingCalc {...p} />;
  if (type === "roof_tiles") return <RoofTilesCalc {...p} />;
  if (type === "wallpaper") return <WallpaperCalc {...p} />;
  if (type === "render") return <RenderCalc {...p} />;
  if (type === "turf") return <TurfCalc {...p} />;
  return null;
}

type CalcProps = { product: CalculatorProductRef; listingSlug: string; productSlug: string; siblings: CrossSellProductRef[] };

function CalcHeader({ title, sub }: { title: string; sub: string }) {
  return (<div className="mb-3"><p className="text-[10px] font-extrabold uppercase tracking-[0.22em] text-[#FFB300]">Calculator</p><h2 className="mt-1 text-[18px] font-extrabold text-neutral-900">{title}</h2><p className="mt-1 text-[13px] text-neutral-500">{sub}</p></div>);
}

function ScenarioTabs<T extends string>({ labels, value, onChange }: { labels: Record<T, string>; value: T; onChange: (v: T) => void }) {
  return (<div className="-mx-1 mb-4 overflow-x-auto"><div className="flex gap-2 px-1 pb-1 sm:flex-wrap">{(Object.keys(labels) as T[]).map((s) => (<button key={s} type="button" onClick={() => onChange(s)} className={`inline-flex h-10 shrink-0 items-center rounded-full border px-3 text-[12px] font-bold transition ${value === s ? "border-[#FFB300] bg-[#FFB300] text-black" : "border-neutral-300 bg-white text-neutral-700 hover:border-[#FFB300]/60"}`}>{labels[s]}</button>))}</div></div>);
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (<label className="block"><span className="mb-1 block text-[11px] font-bold uppercase tracking-widest text-neutral-500">{label}</span>{children}</label>);
}

const inputClass = "block h-11 w-full rounded-md border border-neutral-300 bg-white px-3 text-sm text-neutral-900 outline-none focus:border-[#FFB300]";

function NumInput({ value, onChange, step = "any", min }: { value: number; onChange: (n: number) => void; step?: string; min?: number }) {
  return <input type="number" inputMode="decimal" step={step} min={min} value={Number.isFinite(value) ? value : ""} onChange={(e) => { const n = Number(e.target.value); onChange(Number.isFinite(n) ? n : 0); }} className={inputClass} />;
}

function PillRow<T extends string>({ options, value, onChange }: { options: { value: T; label: string }[]; value: T; onChange: (v: T) => void }) {
  return (<div className="flex flex-wrap gap-2">{options.map((o) => (<button key={o.value} type="button" onClick={() => onChange(o.value)} className={`inline-flex h-11 items-center rounded-full border px-3 text-[13px] font-bold transition ${value === o.value ? "border-[#FFB300] bg-[#FFB300] text-black" : "border-neutral-300 bg-white text-neutral-700 hover:border-[#FFB300]/60"}`}>{o.label}</button>))}</div>);
}

function CheckRow({ label, checked, onChange }: { label: string; checked: boolean; onChange: (v: boolean) => void }) {
  return (<label className="inline-flex h-11 items-center gap-2 rounded-md border border-neutral-300 bg-white px-3"><input type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} className="h-5 w-5 accent-[#FFB300]" /><span className="text-[13px] font-bold text-neutral-900">{label}</span></label>);
}

function useCalcActions<T extends CalculatorType>({ type, output, inputs, listingSlug, productSlug, product }: { type: T; output: CalculatorOutput; inputs: CalculatorInputs; listingSlug: string; productSlug: string; product: CalculatorProductRef }) {
  async function onAddToCart() {
    for (const line of output.lines) {
      if (!line.cart) continue;
      const item: CartItem = { product_id: line.cart.product_id ?? product.id, name: line.cart.cart_label, price_pence: line.cart.price_pence, cover_url: line.cart.cover_url ?? null, qty: line.cart.qty, added_at: new Date().toISOString() };
      addItem(listingSlug, item);
    }
    return true;
  }
  async function onShare(): Promise<{ url: string } | null> {
    try {
      const res = await fetch("/api/trade-off/calc-estimate/create", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ listing_slug: listingSlug, product_slug: productSlug, calculator_type: type, inputs, output }) });
      const json: { ok?: boolean; url?: string } = await res.json();
      if (json.ok && json.url) return { url: json.url };
    } catch { /* ignore */ }
    return null;
  }
  return { onAddToCart, onShare };
}

function Shell({ type, scenarioLabels, scenario, setScenario, output, inputs, props, complementary, children }: { type: CalculatorType; scenarioLabels: Record<string, string>; scenario: string; setScenario: (s: string) => void; output: CalculatorOutput; inputs: CalculatorInputs; props: CalcProps; complementary: string[]; children: React.ReactNode }) {
  const { onAddToCart, onShare } = useCalcActions({ type, output, inputs, listingSlug: props.listingSlug, productSlug: props.productSlug, product: props.product });
  return (<div className="rounded-2xl border border-neutral-200 bg-neutral-50 p-4 sm:p-5"><ScenarioTabs labels={scenarioLabels} value={scenario} onChange={setScenario} />{children}<div className="mt-4"><CalculatorOutputPanel type={type} inputs={inputs} output={output} productSlug={props.productSlug} listingSlug={props.listingSlug} onAddToCart={onAddToCart} onShare={onShare} /></div><CrossSellPanel listingSlug={props.listingSlug} currentProductId={props.product.id} siblings={props.siblings} requiredSubcategories={complementary} /></div>);
}

function PaintCalc(props: CalcProps) {
  const [scenario, setScenario] = useState<PaintScenario>(PAINT_DEFAULT_SCENARIO);
  const [allInputs, setAllInputs] = useState(PAINT_DEFAULT_INPUTS_BY_SCENARIO);
  const inputs = allInputs[scenario] as PaintInputs;
  const output = useMemo(() => computePaint(inputs, props.product), [inputs, props.product]);
  function update<S extends PaintScenario>(s: S, patch: Partial<Extract<PaintInputs, { scenario: S }>>) { setAllInputs((a) => ({ ...a, [s]: { ...a[s], ...patch } })); }
  const coats = (cur: 1 | 2, on: (c: 1 | 2) => void) => <Field label="Coats"><PillRow options={[{ value: "1", label: "1 coat" }, { value: "2", label: "2 coats (recommended)" }]} value={String(cur) as "1" | "2"} onChange={(v) => on(Number(v) as 1 | 2)} /></Field>;
  const sides = <T extends "one" | "both">(cur: T, on: (v: T) => void) => <Field label="Sides"><PillRow options={[{ value: "one" as T, label: "One side" }, { value: "both" as T, label: "Both sides" }]} value={cur} onChange={on} /></Field>;
  return (<><CalcHeader title="Paint calculator" sub="Pick what you're painting — UK 12 m²/L real coverage." /><Shell type="paint" scenarioLabels={PAINT_SCENARIO_LABEL} scenario={scenario} setScenario={(s) => setScenario(s as PaintScenario)} output={output} inputs={inputs as unknown as CalculatorInputs} props={props} complementary={paintComplementarySubcategories(scenario)}>
    {scenario === "quick_estimate" && (() => { const i = allInputs.quick_estimate; return (<div className="space-y-3"><Field label="Room size"><PillRow options={[{ value: "small", label: "Small" }, { value: "medium", label: "Medium" }, { value: "large", label: "Large" }]} value={i.room_type} onChange={(v) => update("quick_estimate", { room_type: v })} /></Field>{coats(i.coats, (c) => update("quick_estimate", { coats: c }))}</div>); })()}
    {scenario === "full_room" && (() => { const i = allInputs.full_room; return (<div className="space-y-3"><div className="grid gap-3 sm:grid-cols-3"><Field label="Length (m)"><NumInput value={i.length_m} onChange={(v) => update("full_room", { length_m: v })} /></Field><Field label="Width (m)"><NumInput value={i.width_m} onChange={(v) => update("full_room", { width_m: v })} /></Field><Field label="Height (m)"><NumInput value={i.height_m} onChange={(v) => update("full_room", { height_m: v })} /></Field></div><div className="grid gap-3 sm:grid-cols-2"><Field label="Doors"><NumInput value={i.doors} onChange={(v) => update("full_room", { doors: Math.max(0, Math.round(v)) })} step="1" min={0} /></Field><Field label="Door size"><PillRow options={[{ value: "standard", label: "Standard" }, { value: "tall", label: "Tall" }]} value={i.door_size} onChange={(v) => update("full_room", { door_size: v })} /></Field><Field label="Windows"><NumInput value={i.windows} onChange={(v) => update("full_room", { windows: Math.max(0, Math.round(v)) })} step="1" min={0} /></Field><Field label="Window size"><PillRow options={[{ value: "small", label: "Small" }, { value: "standard", label: "Standard" }, { value: "large", label: "Large" }]} value={i.window_size} onChange={(v) => update("full_room", { window_size: v })} /></Field></div><Field label="Surface"><PillRow options={[{ value: "smooth", label: "Smooth (12 m²/L)" }, { value: "textured", label: "Textured (10 m²/L)" }, { value: "fresh_plaster", label: "Fresh plaster (8 m²/L)" }]} value={i.surface} onChange={(v) => update("full_room", { surface: v })} /></Field>{coats(i.coats, (c) => update("full_room", { coats: c }))}<div className="flex flex-wrap gap-2"><CheckRow label="Include ceiling" checked={i.include_ceiling} onChange={(b) => update("full_room", { include_ceiling: b })} /><CheckRow label="Include floor paint" checked={i.include_floor_paint} onChange={(b) => update("full_room", { include_floor_paint: b })} /><CheckRow label="Add gloss for doors+windows" checked={i.paint_doors_and_windows} onChange={(b) => update("full_room", { paint_doors_and_windows: b })} /><CheckRow label="+10% waste" checked={i.waste_10pct} onChange={(b) => update("full_room", { waste_10pct: b })} /></div></div>); })()}
    {scenario === "single_wall" && (() => { const i = allInputs.single_wall; return (<div className="space-y-3"><div className="grid gap-3 sm:grid-cols-2"><Field label="Length (m)"><NumInput value={i.length_m} onChange={(v) => update("single_wall", { length_m: v })} /></Field><Field label="Height (m)"><NumInput value={i.height_m} onChange={(v) => update("single_wall", { height_m: v })} /></Field></div><Field label="Surface"><PillRow options={[{ value: "smooth", label: "Smooth" }, { value: "textured", label: "Textured" }, { value: "fresh_plaster", label: "Fresh plaster" }]} value={i.surface} onChange={(v) => update("single_wall", { surface: v })} /></Field>{coats(i.coats, (c) => update("single_wall", { coats: c }))}<CheckRow label="+10% waste" checked={i.waste_10pct} onChange={(b) => update("single_wall", { waste_10pct: b })} /></div>); })()}
    {scenario === "external_masonry" && (() => { const i = allInputs.external_masonry; return (<div className="space-y-3"><div className="grid gap-3 sm:grid-cols-2"><Field label="Length (m)"><NumInput value={i.length_m} onChange={(v) => update("external_masonry", { length_m: v })} /></Field><Field label="Height (m)"><NumInput value={i.height_m} onChange={(v) => update("external_masonry", { height_m: v })} /></Field></div><Field label="Surface"><PillRow options={[{ value: "smooth", label: "Smooth (6 m²/L)" }, { value: "textured", label: "Pebble-dash (5 m²/L)" }]} value={i.surface} onChange={(v) => update("external_masonry", { surface: v })} /></Field>{coats(i.coats, (c) => update("external_masonry", { coats: c }))}<CheckRow label="+10% waste" checked={i.waste_10pct} onChange={(b) => update("external_masonry", { waste_10pct: b })} /></div>); })()}
    {scenario === "doors_only" && (() => { const i = allInputs.doors_only; return (<div className="space-y-3"><div className="grid gap-3 sm:grid-cols-3"><Field label="Doors"><NumInput value={i.count} onChange={(v) => update("doors_only", { count: Math.max(0, Math.round(v)) })} step="1" min={0} /></Field><Field label="Size"><PillRow options={[{ value: "standard", label: "Standard" }, { value: "tall", label: "Tall" }]} value={i.door_size} onChange={(v) => update("doors_only", { door_size: v })} /></Field>{sides(i.sides, (v) => update("doors_only", { sides: v }))}</div><CheckRow label="Include frame" checked={i.include_frame} onChange={(b) => update("doors_only", { include_frame: b })} />{coats(i.coats, (c) => update("doors_only", { coats: c }))}</div>); })()}
    {scenario === "windows_only" && (() => { const i = allInputs.windows_only; return (<div className="space-y-3"><div className="grid gap-3 sm:grid-cols-3"><Field label="Windows"><NumInput value={i.count} onChange={(v) => update("windows_only", { count: Math.max(0, Math.round(v)) })} step="1" min={0} /></Field><Field label="Size"><PillRow options={[{ value: "small", label: "Small" }, { value: "standard", label: "Standard" }, { value: "large", label: "Large" }]} value={i.window_size} onChange={(v) => update("windows_only", { window_size: v })} /></Field>{sides(i.sides, (v) => update("windows_only", { sides: v }))}</div>{coats(i.coats, (c) => update("windows_only", { coats: c }))}</div>); })()}
    {scenario === "timber_fence" && (() => { const i = allInputs.timber_fence; return (<div className="space-y-3"><div className="grid gap-3 sm:grid-cols-3"><Field label="Length (m)"><NumInput value={i.length_m} onChange={(v) => update("timber_fence", { length_m: v })} /></Field><Field label="Height (m)"><NumInput value={i.height_m} onChange={(v) => update("timber_fence", { height_m: v })} /></Field>{sides(i.sides, (v) => update("timber_fence", { sides: v }))}</div>{coats(i.coats, (c) => update("timber_fence", { coats: c }))}</div>); })()}
    {scenario === "metal_railing" && (() => { const i = allInputs.metal_railing; return (<div className="space-y-3"><div className="grid gap-3 sm:grid-cols-3"><Field label="Length (m)"><NumInput value={i.length_m} onChange={(v) => update("metal_railing", { length_m: v })} /></Field><Field label="Height (m)"><NumInput value={i.height_m} onChange={(v) => update("metal_railing", { height_m: v })} /></Field><Field label="Profile"><PillRow options={[{ value: "plain", label: "Plain bars" }, { value: "decorative", label: "Decorative" }]} value={i.profile} onChange={(v) => update("metal_railing", { profile: v })} /></Field></div>{coats(i.coats, (c) => update("metal_railing", { coats: c }))}</div>); })()}
    {scenario === "skirting_trim" && (() => { const i = allInputs.skirting_trim; return (<div className="space-y-3"><Field label="Total length (m)"><NumInput value={i.linear_m} onChange={(v) => update("skirting_trim", { linear_m: v })} /></Field>{coats(i.coats, (c) => update("skirting_trim", { coats: c }))}</div>); })()}
  </Shell></>);
}

function FlooringCalc(props: CalcProps) {
  const [scenario, setScenario] = useState<FlooringScenario>(FLOORING_DEFAULT_SCENARIO);
  const [allInputs, setAllInputs] = useState(FLOORING_DEFAULT_INPUTS_BY_SCENARIO);
  const inputs = allInputs[scenario] as FlooringInputs;
  const output = useMemo(() => computeFlooring(inputs, props.product), [inputs, props.product]);
  function update<S extends FlooringScenario>(s: S, p: Partial<Extract<FlooringInputs, { scenario: S }>>) { setAllInputs((a) => ({ ...a, [s]: { ...a[s], ...p } })); }
  const layoutOpts: Array<{ value: "straight" | "diagonal" | "herringbone"; label: string }> = [{ value: "straight", label: "Straight (+10%)" }, { value: "diagonal", label: "Diagonal (+15%)" }, { value: "herringbone", label: "Herringbone (+20%)" }];
  return (<><CalcHeader title="Flooring calculator" sub="Boxes + underlay + beading — pick the room shape." /><Shell type="flooring" scenarioLabels={FLOORING_SCENARIO_LABEL} scenario={scenario} setScenario={(s) => setScenario(s as FlooringScenario)} output={output} inputs={inputs as unknown as CalculatorInputs} props={props} complementary={flooringComplementarySubcategories(scenario)}>
    {scenario === "rectangular" && (() => { const i = allInputs.rectangular; return (<div className="space-y-3"><div className="grid gap-3 sm:grid-cols-2"><Field label="Length (m)"><NumInput value={i.length_m} onChange={(v) => update("rectangular", { length_m: v })} /></Field><Field label="Width (m)"><NumInput value={i.width_m} onChange={(v) => update("rectangular", { width_m: v })} /></Field></div><Field label="Layout"><PillRow options={layoutOpts} value={i.layout} onChange={(v) => update("rectangular", { layout: v })} /></Field></div>); })()}
    {scenario === "l_shape" && (() => { const i = allInputs.l_shape; return (<div className="space-y-3"><p className="text-[12px] text-neutral-500">Split the L into rectangles A + B.</p><div className="grid gap-3 sm:grid-cols-2"><Field label="A length (m)"><NumInput value={i.part_a_length_m} onChange={(v) => update("l_shape", { part_a_length_m: v })} /></Field><Field label="A width (m)"><NumInput value={i.part_a_width_m} onChange={(v) => update("l_shape", { part_a_width_m: v })} /></Field><Field label="B length (m)"><NumInput value={i.part_b_length_m} onChange={(v) => update("l_shape", { part_b_length_m: v })} /></Field><Field label="B width (m)"><NumInput value={i.part_b_width_m} onChange={(v) => update("l_shape", { part_b_width_m: v })} /></Field></div></div>); })()}
    {scenario === "stairs" && (() => { const i = allInputs.stairs; return (<div className="space-y-3"><div className="grid gap-3 sm:grid-cols-3"><Field label="Treads"><NumInput value={i.treads} onChange={(v) => update("stairs", { treads: Math.max(1, Math.round(v)) })} step="1" min={1} /></Field><Field label="Tread depth (m)"><NumInput value={i.tread_depth_m} onChange={(v) => update("stairs", { tread_depth_m: v })} /></Field><Field label="Stair width (m)"><NumInput value={i.stair_width_m} onChange={(v) => update("stairs", { stair_width_m: v })} /></Field></div><CheckRow label="Include risers" checked={i.include_risers} onChange={(b) => update("stairs", { include_risers: b })} /></div>); })()}
    {scenario === "hallway" && (() => { const i = allInputs.hallway; return (<div className="grid gap-3 sm:grid-cols-2"><Field label="Length (m)"><NumInput value={i.length_m} onChange={(v) => update("hallway", { length_m: v })} /></Field><Field label="Width (m)"><NumInput value={i.width_m} onChange={(v) => update("hallway", { width_m: v })} /></Field></div>); })()}
    {scenario === "multi_room" && (() => { const i = allInputs.multi_room; return (<div className="space-y-3">{i.zones.map((z, idx) => (<div key={idx} className="grid gap-3 rounded-lg border border-neutral-200 bg-white p-3 sm:grid-cols-[1.5fr_1fr_1fr_auto]"><Field label={`Room ${idx + 1}`}><input type="text" value={z.name} onChange={(e) => update("multi_room", { zones: i.zones.map((zz, j) => j === idx ? { ...zz, name: e.target.value } : zz) })} className={inputClass} /></Field><Field label="L (m)"><NumInput value={z.length_m} onChange={(v) => update("multi_room", { zones: i.zones.map((zz, j) => j === idx ? { ...zz, length_m: v } : zz) })} /></Field><Field label="W (m)"><NumInput value={z.width_m} onChange={(v) => update("multi_room", { zones: i.zones.map((zz, j) => j === idx ? { ...zz, width_m: v } : zz) })} /></Field><div className="flex items-end"><button type="button" onClick={() => update("multi_room", { zones: i.zones.filter((_, j) => j !== idx) })} className="inline-flex h-11 items-center rounded-lg border border-red-300 bg-red-50 px-3 text-[12px] font-bold text-red-700">×</button></div></div>))}<button type="button" onClick={() => update("multi_room", { zones: [...i.zones, { name: `Room ${i.zones.length + 1}`, length_m: 3, width_m: 3 }] })} className="inline-flex h-11 items-center rounded-lg border border-[#FFB300] bg-[#FFB300]/10 px-3 text-[13px] font-bold">+ Add room</button><Field label="Layout"><PillRow options={layoutOpts} value={i.layout} onChange={(v) => update("multi_room", { layout: v })} /></Field></div>); })()}
  </Shell></>);
}

function TilesCalc(props: CalcProps) {
  const [scenario, setScenario] = useState<TilesScenario>(TILES_DEFAULT_SCENARIO);
  const [allInputs, setAllInputs] = useState(TILES_DEFAULT_INPUTS_BY_SCENARIO);
  const inputs = allInputs[scenario] as TilesInputs;
  const output = useMemo(() => computeTiles(inputs, props.product), [inputs, props.product]);
  function update<S extends TilesScenario>(s: S, p: Partial<Extract<TilesInputs, { scenario: S }>>) { setAllInputs((a) => ({ ...a, [s]: { ...a[s], ...p } })); }
  const tileFields = <S extends TilesScenario>(_s: S, w: number, h: number, j: number, onW: (v: number) => void, onH: (v: number) => void, onJ: (v: number) => void) => { void _s; return (<div className="grid gap-3 sm:grid-cols-3"><Field label="Tile W (mm)"><NumInput value={w} onChange={(v) => onW(Math.round(v))} step="1" min={1} /></Field><Field label="Tile H (mm)"><NumInput value={h} onChange={(v) => onH(Math.round(v))} step="1" min={1} /></Field><Field label="Joint (mm)"><NumInput value={j} onChange={(v) => onJ(v)} step="0.5" min={1} /></Field></div>); };
  return (<><CalcHeader title="Tile calculator" sub="Tiles + adhesive + grout — pick what you're tiling." /><Shell type="tiles" scenarioLabels={TILES_SCENARIO_LABEL} scenario={scenario} setScenario={(s) => setScenario(s as TilesScenario)} output={output} inputs={inputs as unknown as CalculatorInputs} props={props} complementary={tilesComplementarySubcategories(scenario)}>
    {scenario === "bathroom_floor" && (() => { const i = allInputs.bathroom_floor; return (<div className="space-y-3"><div className="grid gap-3 sm:grid-cols-2"><Field label="Length (m)"><NumInput value={i.length_m} onChange={(v) => update("bathroom_floor", { length_m: v })} /></Field><Field label="Width (m)"><NumInput value={i.width_m} onChange={(v) => update("bathroom_floor", { width_m: v })} /></Field></div>{tileFields("bathroom_floor", i.tile_w_mm, i.tile_h_mm, i.joint_mm, (v) => update("bathroom_floor", { tile_w_mm: v }), (v) => update("bathroom_floor", { tile_h_mm: v }), (v) => update("bathroom_floor", { joint_mm: v }))}</div>); })()}
    {scenario === "shower_walls" && (() => { const i = allInputs.shower_walls; return (<div className="space-y-3"><div className="grid gap-3 sm:grid-cols-3"><Field label="Wall A (m)"><NumInput value={i.wall_a_m} onChange={(v) => update("shower_walls", { wall_a_m: v })} /></Field><Field label="Wall B (m)"><NumInput value={i.wall_b_m} onChange={(v) => update("shower_walls", { wall_b_m: v })} /></Field><Field label="Height (m)"><NumInput value={i.height_m} onChange={(v) => update("shower_walls", { height_m: v })} /></Field></div>{tileFields("shower_walls", i.tile_w_mm, i.tile_h_mm, i.joint_mm, (v) => update("shower_walls", { tile_w_mm: v }), (v) => update("shower_walls", { tile_h_mm: v }), (v) => update("shower_walls", { joint_mm: v }))}<CheckRow label="Diagonal lay" checked={i.diagonal} onChange={(b) => update("shower_walls", { diagonal: b })} /></div>); })()}
    {scenario === "splashback" && (() => { const i = allInputs.splashback; return (<div className="space-y-3"><div className="grid gap-3 sm:grid-cols-2"><Field label="Length (m)"><NumInput value={i.length_m} onChange={(v) => update("splashback", { length_m: v })} /></Field><Field label="Height (m)"><NumInput value={i.height_m} onChange={(v) => update("splashback", { height_m: v })} /></Field></div>{tileFields("splashback", i.tile_w_mm, i.tile_h_mm, i.joint_mm, (v) => update("splashback", { tile_w_mm: v }), (v) => update("splashback", { tile_h_mm: v }), (v) => update("splashback", { joint_mm: v }))}</div>); })()}
    {scenario === "whole_bathroom" && (() => { const i = allInputs.whole_bathroom; return (<div className="space-y-3"><div className="grid gap-3 sm:grid-cols-3"><Field label="Floor L (m)"><NumInput value={i.floor_length_m} onChange={(v) => update("whole_bathroom", { floor_length_m: v })} /></Field><Field label="Floor W (m)"><NumInput value={i.floor_width_m} onChange={(v) => update("whole_bathroom", { floor_width_m: v })} /></Field><Field label="Wall H (m)"><NumInput value={i.wall_height_m} onChange={(v) => update("whole_bathroom", { wall_height_m: v })} /></Field></div>{tileFields("whole_bathroom", i.tile_w_mm, i.tile_h_mm, i.joint_mm, (v) => update("whole_bathroom", { tile_w_mm: v }), (v) => update("whole_bathroom", { tile_h_mm: v }), (v) => update("whole_bathroom", { joint_mm: v }))}<CheckRow label="Include bath surround" checked={i.bath_surround} onChange={(b) => update("whole_bathroom", { bath_surround: b })} /></div>); })()}
    {scenario === "outdoor_patio" && (() => { const i = allInputs.outdoor_patio; return (<div className="space-y-3"><div className="grid gap-3 sm:grid-cols-2"><Field label="Length (m)"><NumInput value={i.length_m} onChange={(v) => update("outdoor_patio", { length_m: v })} /></Field><Field label="Width (m)"><NumInput value={i.width_m} onChange={(v) => update("outdoor_patio", { width_m: v })} /></Field></div>{tileFields("outdoor_patio", i.tile_w_mm, i.tile_h_mm, i.joint_mm, (v) => update("outdoor_patio", { tile_w_mm: v }), (v) => update("outdoor_patio", { tile_h_mm: v }), (v) => update("outdoor_patio", { joint_mm: v }))}<CheckRow label="Diagonal lay" checked={i.diagonal} onChange={(b) => update("outdoor_patio", { diagonal: b })} /></div>); })()}
  </Shell></>);
}

function GravelCalc(props: CalcProps) {
  const [scenario, setScenario] = useState<GravelScenario>(GRAVEL_DEFAULT_SCENARIO);
  const [allInputs, setAllInputs] = useState(GRAVEL_DEFAULT_INPUTS_BY_SCENARIO);
  const inputs = allInputs[scenario] as GravelInputs;
  const output = useMemo(() => computeGravel(inputs, props.product), [inputs, props.product]);
  function update<S extends GravelScenario>(s: S, p: Partial<Extract<GravelInputs, { scenario: S }>>) { setAllInputs((a) => ({ ...a, [s]: { ...a[s], ...p } })); }
  const stoneOpts: Array<{ value: "gravel" | "pebbles" | "cobbles" | "sharp_sand" | "building_sand" | "ballast"; label: string }> = [{ value: "gravel", label: "Gravel" }, { value: "pebbles", label: "Pebbles" }, { value: "cobbles", label: "Cobbles" }, { value: "sharp_sand", label: "Sharp sand" }, { value: "building_sand", label: "Building sand" }, { value: "ballast", label: "Ballast" }];
  return (<><CalcHeader title="Gravel / aggregates calculator" sub="UK densities + depth presets per scenario." /><Shell type="gravel" scenarioLabels={GRAVEL_SCENARIO_LABEL} scenario={scenario} setScenario={(s) => setScenario(s as GravelScenario)} output={output} inputs={inputs as unknown as CalculatorInputs} props={props} complementary={gravelComplementarySubcategories(scenario)}>
    {(scenario === "driveway" || scenario === "garden_path" || scenario === "decorative_border") && (() => { const i = allInputs[scenario]; return (<div className="space-y-3"><div className="grid gap-3 sm:grid-cols-3"><Field label="Length (m)"><NumInput value={i.length_m} onChange={(v) => update(scenario, { length_m: v })} /></Field><Field label="Width (m)"><NumInput value={i.width_m} onChange={(v) => update(scenario, { width_m: v })} /></Field><Field label="Depth (mm)"><select value={i.depth_mm} onChange={(e) => update(scenario, { depth_mm: Number(e.target.value) })} className={inputClass}><option value={25}>25 mm</option><option value={40}>40 mm</option><option value={50}>50 mm</option><option value={75}>75 mm</option><option value={100}>100 mm</option></select></Field></div><Field label="Stone type"><PillRow options={stoneOpts} value={i.stone_type} onChange={(v) => update(scenario, { stone_type: v })} /></Field><CheckRow label="+10% waste" checked={i.waste_10pct} onChange={(b) => update(scenario, { waste_10pct: b })} /></div>); })()}
    {scenario === "french_drain" && (() => { const i = allInputs.french_drain; return (<div className="space-y-3"><div className="grid gap-3 sm:grid-cols-3"><Field label="Length (m)"><NumInput value={i.length_m} onChange={(v) => update("french_drain", { length_m: v })} /></Field><Field label="Width (m)"><NumInput value={i.trench_width_m} onChange={(v) => update("french_drain", { trench_width_m: v })} /></Field><Field label="Depth (m)"><NumInput value={i.trench_depth_m} onChange={(v) => update("french_drain", { trench_depth_m: v })} /></Field></div><CheckRow label="+10% waste" checked={i.waste_10pct} onChange={(b) => update("french_drain", { waste_10pct: b })} /></div>); })()}
    {scenario === "custom_l_shape" && (() => { const i = allInputs.custom_l_shape; return (<div className="space-y-3"><div className="grid gap-3 sm:grid-cols-2"><Field label="A length (m)"><NumInput value={i.part_a_length_m} onChange={(v) => update("custom_l_shape", { part_a_length_m: v })} /></Field><Field label="A width (m)"><NumInput value={i.part_a_width_m} onChange={(v) => update("custom_l_shape", { part_a_width_m: v })} /></Field><Field label="B length (m)"><NumInput value={i.part_b_length_m} onChange={(v) => update("custom_l_shape", { part_b_length_m: v })} /></Field><Field label="B width (m)"><NumInput value={i.part_b_width_m} onChange={(v) => update("custom_l_shape", { part_b_width_m: v })} /></Field></div><Field label="Depth (mm)"><NumInput value={i.depth_mm} onChange={(v) => update("custom_l_shape", { depth_mm: Math.round(v) })} step="1" min={10} /></Field><Field label="Stone type"><PillRow options={stoneOpts} value={i.stone_type} onChange={(v) => update("custom_l_shape", { stone_type: v })} /></Field><CheckRow label="+10% waste" checked={i.waste_10pct} onChange={(b) => update("custom_l_shape", { waste_10pct: b })} /></div>); })()}
  </Shell></>);
}

function ConcreteCalc(props: CalcProps) {
  const [scenario, setScenario] = useState<ConcreteScenario>(CONCRETE_DEFAULT_SCENARIO);
  const [allInputs, setAllInputs] = useState(CONCRETE_DEFAULT_INPUTS_BY_SCENARIO);
  const inputs = allInputs[scenario] as ConcreteInputs;
  const output = useMemo(() => computeConcrete(inputs, props.product), [inputs, props.product]);
  function update<S extends ConcreteScenario>(s: S, p: Partial<Extract<ConcreteInputs, { scenario: S }>>) { setAllInputs((a) => ({ ...a, [s]: { ...a[s], ...p } })); }
  const mixOpts: Array<{ value: "general" | "structural" | "mass"; label: string }> = [{ value: "general", label: "General 1:2:4" }, { value: "structural", label: "Structural 1:1.5:3" }, { value: "mass", label: "Mass 1:3:6" }];
  return (<><CalcHeader title="Concrete calculator" sub="Pour volume + pre-mix bags or cement/sand/ballast." /><Shell type="concrete" scenarioLabels={CONCRETE_SCENARIO_LABEL} scenario={scenario} setScenario={(s) => setScenario(s as ConcreteScenario)} output={output} inputs={inputs as unknown as CalculatorInputs} props={props} complementary={concreteComplementarySubcategories(scenario)}>
    {(scenario === "patio_slab" || scenario === "path" || scenario === "shed_base" || scenario === "driveway") && (() => { const i = allInputs[scenario]; return (<div className="space-y-3"><div className="grid gap-3 sm:grid-cols-3"><Field label="Length (m)"><NumInput value={i.length_m} onChange={(v) => update(scenario, { length_m: v })} /></Field><Field label="Width (m)"><NumInput value={i.width_m} onChange={(v) => update(scenario, { width_m: v })} /></Field><Field label="Depth (mm)"><select value={i.depth_mm} onChange={(e) => update(scenario, { depth_mm: Number(e.target.value) })} className={inputClass}><option value={50}>50 mm</option><option value={75}>75 mm</option><option value={100}>100 mm</option><option value={150}>150 mm</option><option value={200}>200 mm</option></select></Field></div><Field label="Mix"><PillRow options={mixOpts} value={i.mix} onChange={(v) => update(scenario, { mix: v })} /></Field><CheckRow label="+10% waste" checked={i.waste_10pct} onChange={(b) => update(scenario, { waste_10pct: b })} /></div>); })()}
    {scenario === "fence_post_bases" && (() => { const i = allInputs.fence_post_bases; return (<div className="space-y-3"><div className="grid gap-3 sm:grid-cols-3"><Field label="Posts"><NumInput value={i.count} onChange={(v) => update("fence_post_bases", { count: Math.max(1, Math.round(v)) })} step="1" min={1} /></Field><Field label="Hole Ø (mm)"><NumInput value={i.hole_diameter_mm} onChange={(v) => update("fence_post_bases", { hole_diameter_mm: Math.round(v) })} step="10" min={150} /></Field><Field label="Hole depth (mm)"><NumInput value={i.hole_depth_mm} onChange={(v) => update("fence_post_bases", { hole_depth_mm: Math.round(v) })} step="50" min={300} /></Field></div><CheckRow label="+10% waste" checked={i.waste_10pct} onChange={(b) => update("fence_post_bases", { waste_10pct: b })} /></div>); })()}
  </Shell></>);
}

function MortarCalc(props: CalcProps) {
  const [scenario, setScenario] = useState<MortarScenario>(MORTAR_DEFAULT_SCENARIO);
  const [allInputs, setAllInputs] = useState(MORTAR_DEFAULT_INPUTS_BY_SCENARIO);
  const inputs = allInputs[scenario] as MortarInputs;
  const output = useMemo(() => computeMortar(inputs, props.product), [inputs, props.product]);
  function update<S extends MortarScenario>(s: S, p: Partial<Extract<MortarInputs, { scenario: S }>>) { setAllInputs((a) => ({ ...a, [s]: { ...a[s], ...p } })); }
  const mixOpts: Array<{ value: "general_1_4" | "lime_1_1_6" | "structural_1_3"; label: string }> = [{ value: "general_1_4", label: "1:4 general" }, { value: "lime_1_1_6", label: "1:1:6 lime" }, { value: "structural_1_3", label: "1:3 structural" }];
  return (<><CalcHeader title="Mortar calculator" sub="Cement + sand for any wall area." /><Shell type="mortar" scenarioLabels={MORTAR_SCENARIO_LABEL} scenario={scenario} setScenario={(s) => setScenario(s as MortarScenario)} output={output} inputs={inputs as unknown as CalculatorInputs} props={props} complementary={mortarComplementarySubcategories(scenario)}>
    {(scenario === "brickwork" || scenario === "blockwork") && (() => { const i = allInputs[scenario]; return (<div className="space-y-3"><Field label="Wall area (m²)"><NumInput value={i.wall_area_m2} onChange={(v) => update(scenario, { wall_area_m2: v })} /></Field><Field label="Mix"><PillRow options={mixOpts} value={i.mix} onChange={(v) => update(scenario, { mix: v })} /></Field><CheckRow label="+10% waste" checked={i.waste_10pct} onChange={(b) => update(scenario, { waste_10pct: b })} /></div>); })()}
    {scenario === "repointing" && (() => { const i = allInputs.repointing; return (<div className="space-y-3"><div className="grid gap-3 sm:grid-cols-2"><Field label="Wall area (m²)"><NumInput value={i.wall_area_m2} onChange={(v) => update("repointing", { wall_area_m2: v })} /></Field><Field label="Joint thickness (mm)"><NumInput value={i.joint_thickness_mm} onChange={(v) => update("repointing", { joint_thickness_mm: Math.round(v) })} step="1" min={5} /></Field></div><Field label="Mix"><PillRow options={mixOpts} value={i.mix} onChange={(v) => update("repointing", { mix: v })} /></Field><CheckRow label="+10% waste" checked={i.waste_10pct} onChange={(b) => update("repointing", { waste_10pct: b })} /></div>); })()}
  </Shell></>);
}

function BricksCalc(props: CalcProps) {
  const [scenario, setScenario] = useState<BricksScenario>(BRICKS_DEFAULT_SCENARIO);
  const [allInputs, setAllInputs] = useState(BRICKS_DEFAULT_INPUTS_BY_SCENARIO);
  const inputs = allInputs[scenario] as BricksInputs;
  const output = useMemo(() => computeBricks(inputs, props.product), [inputs, props.product]);
  function update<S extends BricksScenario>(s: S, p: Partial<Extract<BricksInputs, { scenario: S }>>) { setAllInputs((a) => ({ ...a, [s]: { ...a[s], ...p } })); }
  const unitOpts: Array<{ value: "brick" | "block" | "aircrete"; label: string }> = [{ value: "brick", label: "Brick" }, { value: "block", label: "Block" }, { value: "aircrete", label: "Aircrete" }];
  return (<><CalcHeader title="Bricks & blocks calculator" sub="60 bricks/m², 10 blocks/m² UK standard." /><Shell type="bricks" scenarioLabels={BRICKS_SCENARIO_LABEL} scenario={scenario} setScenario={(s) => setScenario(s as BricksScenario)} output={output} inputs={inputs as unknown as CalculatorInputs} props={props} complementary={bricksComplementarySubcategories(scenario)}>
    {(scenario === "garden_wall" || scenario === "cavity_wall") && (() => { const i = allInputs[scenario]; return (<div className="space-y-3"><div className="grid gap-3 sm:grid-cols-2"><Field label="Length (m)"><NumInput value={i.length_m} onChange={(v) => update(scenario, { length_m: v })} /></Field><Field label="Height (m)"><NumInput value={i.height_m} onChange={(v) => update(scenario, { height_m: v })} /></Field></div><Field label="Unit"><PillRow options={unitOpts} value={i.unit} onChange={(v) => update(scenario, { unit: v })} /></Field><CheckRow label="+10% waste" checked={i.waste_10pct} onChange={(b) => update(scenario, { waste_10pct: b })} /></div>); })()}
    {scenario === "boundary_wall" && (() => { const i = allInputs.boundary_wall; return (<div className="space-y-3"><div className="grid gap-3 sm:grid-cols-2"><Field label="Length (m)"><NumInput value={i.length_m} onChange={(v) => update("boundary_wall", { length_m: v })} /></Field><Field label="Height (m)"><NumInput value={i.height_m} onChange={(v) => update("boundary_wall", { height_m: v })} /></Field><Field label="Skins"><PillRow options={[{ value: "1", label: "Single" }, { value: "2", label: "Double" }]} value={String(i.skins) as "1" | "2"} onChange={(v) => update("boundary_wall", { skins: Number(v) as 1 | 2 })} /></Field><Field label="Piers"><NumInput value={i.piers_count} onChange={(v) => update("boundary_wall", { piers_count: Math.max(0, Math.round(v)) })} step="1" min={0} /></Field></div><Field label="Unit"><PillRow options={unitOpts} value={i.unit} onChange={(v) => update("boundary_wall", { unit: v })} /></Field><CheckRow label="+10% waste" checked={i.waste_10pct} onChange={(b) => update("boundary_wall", { waste_10pct: b })} /></div>); })()}
  </Shell></>);
}

function PlasterboardCalc(props: CalcProps) {
  const [scenario, setScenario] = useState<PlasterboardScenario>(PLASTERBOARD_DEFAULT_SCENARIO);
  const [allInputs, setAllInputs] = useState(PLASTERBOARD_DEFAULT_INPUTS_BY_SCENARIO);
  const inputs = allInputs[scenario] as PlasterboardInputs;
  const output = useMemo(() => computePlasterboard(inputs, props.product), [inputs, props.product]);
  function update<S extends PlasterboardScenario>(s: S, p: Partial<Extract<PlasterboardInputs, { scenario: S }>>) { setAllInputs((a) => ({ ...a, [s]: { ...a[s], ...p } })); }
  const boardOpts: Array<{ value: "1200x2400" | "1200x1800"; label: string }> = [{ value: "1200x2400", label: "1200×2400 (2.88 m²)" }, { value: "1200x1800", label: "1200×1800 (2.16 m²)" }];
  return (<><CalcHeader title="Plasterboard calculator" sub="Boards + screws + scrim + filler — UK 1200×2400." /><Shell type="plasterboard" scenarioLabels={PLASTERBOARD_SCENARIO_LABEL} scenario={scenario} setScenario={(s) => setScenario(s as PlasterboardScenario)} output={output} inputs={inputs as unknown as CalculatorInputs} props={props} complementary={plasterboardComplementarySubcategories(scenario)}>
    {scenario === "walls" && (() => { const i = allInputs.walls; return (<div className="space-y-3"><Field label="Wall area (m²)"><NumInput value={i.wall_area_m2} onChange={(v) => update("walls", { wall_area_m2: v })} /></Field><Field label="Sheet size"><PillRow options={boardOpts} value={i.board_size} onChange={(v) => update("walls", { board_size: v })} /></Field><CheckRow label="+10% waste" checked={i.waste_10pct} onChange={(b) => update("walls", { waste_10pct: b })} /></div>); })()}
    {scenario === "ceilings" && (() => { const i = allInputs.ceilings; return (<div className="space-y-3"><Field label="Ceiling area (m²)"><NumInput value={i.ceiling_area_m2} onChange={(v) => update("ceilings", { ceiling_area_m2: v })} /></Field><Field label="Sheet size"><PillRow options={boardOpts} value={i.board_size} onChange={(v) => update("ceilings", { board_size: v })} /></Field><CheckRow label="Moisture-resistant board" checked={i.moisture_resistant} onChange={(b) => update("ceilings", { moisture_resistant: b })} /><CheckRow label="+10% waste" checked={i.waste_10pct} onChange={(b) => update("ceilings", { waste_10pct: b })} /></div>); })()}
    {scenario === "whole_room" && (() => { const i = allInputs.whole_room; return (<div className="space-y-3"><div className="grid gap-3 sm:grid-cols-3"><Field label="Length (m)"><NumInput value={i.length_m} onChange={(v) => update("whole_room", { length_m: v })} /></Field><Field label="Width (m)"><NumInput value={i.width_m} onChange={(v) => update("whole_room", { width_m: v })} /></Field><Field label="Height (m)"><NumInput value={i.height_m} onChange={(v) => update("whole_room", { height_m: v })} /></Field></div><Field label="Sheet size"><PillRow options={boardOpts} value={i.board_size} onChange={(v) => update("whole_room", { board_size: v })} /></Field><CheckRow label="Include ceiling" checked={i.include_ceiling} onChange={(b) => update("whole_room", { include_ceiling: b })} /><CheckRow label="+10% waste" checked={i.waste_10pct} onChange={(b) => update("whole_room", { waste_10pct: b })} /></div>); })()}
  </Shell></>);
}

function InsulationCalc(props: CalcProps) {
  const [scenario, setScenario] = useState<InsulationScenario>(INSULATION_DEFAULT_SCENARIO);
  const [allInputs, setAllInputs] = useState(INSULATION_DEFAULT_INPUTS_BY_SCENARIO);
  const inputs = allInputs[scenario] as InsulationInputs;
  const output = useMemo(() => computeInsulation(inputs, props.product), [inputs, props.product]);
  function update<S extends InsulationScenario>(s: S, p: Partial<Extract<InsulationInputs, { scenario: S }>>) { setAllInputs((a) => ({ ...a, [s]: { ...a[s], ...p } })); }
  return (<><CalcHeader title="Insulation calculator" sub="UK Part L 2025 U-value targets." /><Shell type="insulation" scenarioLabels={INSULATION_SCENARIO_LABEL} scenario={scenario} setScenario={(s) => setScenario(s as InsulationScenario)} output={output} inputs={inputs as unknown as CalculatorInputs} props={props} complementary={insulationComplementarySubcategories(scenario)}>
    {scenario === "loft" && (() => { const i = allInputs.loft; return (<div className="space-y-3"><div className="grid gap-3 sm:grid-cols-2"><Field label="Loft length (m)"><NumInput value={i.loft_length_m} onChange={(v) => update("loft", { loft_length_m: v })} /></Field><Field label="Loft width (m)"><NumInput value={i.loft_width_m} onChange={(v) => update("loft", { loft_width_m: v })} /></Field></div><CheckRow label="Cross-lay (double layer)" checked={i.cross_lay} onChange={(b) => update("loft", { cross_lay: b })} /><CheckRow label="+5% waste" checked={i.waste_5pct} onChange={(b) => update("loft", { waste_5pct: b })} /></div>); })()}
    {scenario === "wall_cavity" && (() => { const i = allInputs.wall_cavity; return (<div className="space-y-3"><div className="grid gap-3 sm:grid-cols-2"><Field label="Wall area (m²)"><NumInput value={i.wall_area_m2} onChange={(v) => update("wall_cavity", { wall_area_m2: v })} /></Field><Field label="Cavity (mm)"><NumInput value={i.cavity_mm} onChange={(v) => update("wall_cavity", { cavity_mm: Math.round(v) })} step="10" min={50} /></Field></div><CheckRow label="+5% waste" checked={i.waste_5pct} onChange={(b) => update("wall_cavity", { waste_5pct: b })} /></div>); })()}
    {scenario === "solid_floor" && (() => { const i = allInputs.solid_floor; return (<div className="space-y-3"><div className="grid gap-3 sm:grid-cols-2"><Field label="Floor area (m²)"><NumInput value={i.floor_area_m2} onChange={(v) => update("solid_floor", { floor_area_m2: v })} /></Field><Field label="Depth (mm)"><NumInput value={i.depth_mm} onChange={(v) => update("solid_floor", { depth_mm: Math.round(v) })} step="10" min={50} /></Field></div><CheckRow label="+5% waste" checked={i.waste_5pct} onChange={(b) => update("solid_floor", { waste_5pct: b })} /></div>); })()}
    {scenario === "pitched_roof" && (() => { const i = allInputs.pitched_roof; return (<div className="space-y-3"><div className="grid gap-3 sm:grid-cols-2"><Field label="Roof area (m²)"><NumInput value={i.roof_area_m2} onChange={(v) => update("pitched_roof", { roof_area_m2: v })} /></Field><Field label="Rafter centres (mm)"><NumInput value={i.rafter_centres_mm} onChange={(v) => update("pitched_roof", { rafter_centres_mm: Math.round(v) })} step="50" min={300} /></Field></div><CheckRow label="+5% waste" checked={i.waste_5pct} onChange={(b) => update("pitched_roof", { waste_5pct: b })} /></div>); })()}
  </Shell></>);
}

function DeckingCalc(props: CalcProps) {
  const [scenario, setScenario] = useState<DeckingScenario>(DECKING_DEFAULT_SCENARIO);
  const [allInputs, setAllInputs] = useState(DECKING_DEFAULT_INPUTS_BY_SCENARIO);
  const inputs = allInputs[scenario] as DeckingInputs;
  const output = useMemo(() => computeDecking(inputs, props.product), [inputs, props.product]);
  function update<S extends DeckingScenario>(s: S, p: Partial<Extract<DeckingInputs, { scenario: S }>>) { setAllInputs((a) => ({ ...a, [s]: { ...a[s], ...p } })); }
  return (<><CalcHeader title="Decking calculator" sub="Boards + joists + screws + bearers." /><Shell type="decking" scenarioLabels={DECKING_SCENARIO_LABEL} scenario={scenario} setScenario={(s) => setScenario(s as DeckingScenario)} output={output} inputs={inputs as unknown as CalculatorInputs} props={props} complementary={deckingComplementarySubcategories(scenario)}>
    {scenario === "simple" && (() => { const i = allInputs.simple; return (<div className="space-y-3"><div className="grid gap-3 sm:grid-cols-3"><Field label="Length (m)"><NumInput value={i.length_m} onChange={(v) => update("simple", { length_m: v })} /></Field><Field label="Width (m)"><NumInput value={i.width_m} onChange={(v) => update("simple", { width_m: v })} /></Field><Field label="Board width (mm)"><NumInput value={i.board_width_mm} onChange={(v) => update("simple", { board_width_mm: Math.round(v) })} step="1" min={50} /></Field></div><CheckRow label="+10% waste" checked={i.waste_10pct} onChange={(b) => update("simple", { waste_10pct: b })} /></div>); })()}
    {scenario === "l_shape" && (() => { const i = allInputs.l_shape; return (<div className="space-y-3"><div className="grid gap-3 sm:grid-cols-2"><Field label="A length (m)"><NumInput value={i.a_length_m} onChange={(v) => update("l_shape", { a_length_m: v })} /></Field><Field label="A width (m)"><NumInput value={i.a_width_m} onChange={(v) => update("l_shape", { a_width_m: v })} /></Field><Field label="B length (m)"><NumInput value={i.b_length_m} onChange={(v) => update("l_shape", { b_length_m: v })} /></Field><Field label="B width (m)"><NumInput value={i.b_width_m} onChange={(v) => update("l_shape", { b_width_m: v })} /></Field></div><Field label="Board width (mm)"><NumInput value={i.board_width_mm} onChange={(v) => update("l_shape", { board_width_mm: Math.round(v) })} step="1" min={50} /></Field><CheckRow label="+10% waste" checked={i.waste_10pct} onChange={(b) => update("l_shape", { waste_10pct: b })} /></div>); })()}
    {scenario === "multi_level" && (() => { const i = allInputs.multi_level; return (<div className="space-y-3"><div className="grid gap-3 sm:grid-cols-2"><Field label="Upper L (m)"><NumInput value={i.upper_length_m} onChange={(v) => update("multi_level", { upper_length_m: v })} /></Field><Field label="Upper W (m)"><NumInput value={i.upper_width_m} onChange={(v) => update("multi_level", { upper_width_m: v })} /></Field><Field label="Lower L (m)"><NumInput value={i.lower_length_m} onChange={(v) => update("multi_level", { lower_length_m: v })} /></Field><Field label="Lower W (m)"><NumInput value={i.lower_width_m} onChange={(v) => update("multi_level", { lower_width_m: v })} /></Field></div><div className="grid gap-3 sm:grid-cols-3"><Field label="Steps"><NumInput value={i.step_count} onChange={(v) => update("multi_level", { step_count: Math.max(0, Math.round(v)) })} step="1" min={0} /></Field><Field label="Step width (m)"><NumInput value={i.step_width_m} onChange={(v) => update("multi_level", { step_width_m: v })} /></Field><Field label="Board width (mm)"><NumInput value={i.board_width_mm} onChange={(v) => update("multi_level", { board_width_mm: Math.round(v) })} step="1" min={50} /></Field></div><CheckRow label="+10% waste" checked={i.waste_10pct} onChange={(b) => update("multi_level", { waste_10pct: b })} /></div>); })()}
  </Shell></>);
}

function FencingCalc(props: CalcProps) {
  const [scenario, setScenario] = useState<FencingScenario>(FENCING_DEFAULT_SCENARIO);
  const [allInputs, setAllInputs] = useState(FENCING_DEFAULT_INPUTS_BY_SCENARIO);
  const inputs = allInputs[scenario] as FencingInputs;
  const output = useMemo(() => computeFencing(inputs, props.product), [inputs, props.product]);
  function update<S extends FencingScenario>(s: S, p: Partial<Extract<FencingInputs, { scenario: S }>>) { setAllInputs((a) => ({ ...a, [s]: { ...a[s], ...p } })); }
  return (<><CalcHeader title="Fencing calculator" sub="UK 6ft (1.83m) panels, posts at 1.83m centres." /><Shell type="fencing" scenarioLabels={FENCING_SCENARIO_LABEL} scenario={scenario} setScenario={(s) => setScenario(s as FencingScenario)} output={output} inputs={inputs as unknown as CalculatorInputs} props={props} complementary={fencingComplementarySubcategories(scenario)}>
    {scenario === "straight" && (() => { const i = allInputs.straight; return (<div className="space-y-3"><div className="grid gap-3 sm:grid-cols-2"><Field label="Run length (m)"><NumInput value={i.run_length_m} onChange={(v) => update("straight", { run_length_m: v })} /></Field><Field label="Panel width (m)"><NumInput value={i.panel_width_m} onChange={(v) => update("straight", { panel_width_m: v })} /></Field></div><CheckRow label="Include gravel boards" checked={i.include_gravel_boards} onChange={(b) => update("straight", { include_gravel_boards: b })} /></div>); })()}
    {scenario === "l_corner" && (() => { const i = allInputs.l_corner; return (<div className="space-y-3"><div className="grid gap-3 sm:grid-cols-3"><Field label="A length (m)"><NumInput value={i.run_a_length_m} onChange={(v) => update("l_corner", { run_a_length_m: v })} /></Field><Field label="B length (m)"><NumInput value={i.run_b_length_m} onChange={(v) => update("l_corner", { run_b_length_m: v })} /></Field><Field label="Panel width (m)"><NumInput value={i.panel_width_m} onChange={(v) => update("l_corner", { panel_width_m: v })} /></Field></div><CheckRow label="Include gravel boards" checked={i.include_gravel_boards} onChange={(b) => update("l_corner", { include_gravel_boards: b })} /></div>); })()}
    {scenario === "gated" && (() => { const i = allInputs.gated; return (<div className="space-y-3"><div className="grid gap-3 sm:grid-cols-2"><Field label="Total run (m)"><NumInput value={i.run_length_m} onChange={(v) => update("gated", { run_length_m: v })} /></Field><Field label="Panel width (m)"><NumInput value={i.panel_width_m} onChange={(v) => update("gated", { panel_width_m: v })} /></Field><Field label="Gate width (m)"><NumInput value={i.gate_width_m} onChange={(v) => update("gated", { gate_width_m: v })} /></Field><Field label="Gates"><PillRow options={[{ value: "1", label: "1" }, { value: "2", label: "2" }]} value={String(i.gate_count) as "1" | "2"} onChange={(v) => update("gated", { gate_count: Number(v) as 1 | 2 })} /></Field></div><CheckRow label="Include gravel boards" checked={i.include_gravel_boards} onChange={(b) => update("gated", { include_gravel_boards: b })} /></div>); })()}
  </Shell></>);
}

function PavingCalc(props: CalcProps) {
  const [scenario, setScenario] = useState<PavingScenario>(PAVING_DEFAULT_SCENARIO);
  const [allInputs, setAllInputs] = useState(PAVING_DEFAULT_INPUTS_BY_SCENARIO);
  const inputs = allInputs[scenario] as PavingInputs;
  const output = useMemo(() => computePaving(inputs, props.product), [inputs, props.product]);
  function update<S extends PavingScenario>(s: S, p: Partial<Extract<PavingInputs, { scenario: S }>>) { setAllInputs((a) => ({ ...a, [s]: { ...a[s], ...p } })); }
  return (<><CalcHeader title="Paving calculator" sub="Slabs + sub-base MOT Type 1 + sand bed + jointing." /><Shell type="paving" scenarioLabels={PAVING_SCENARIO_LABEL} scenario={scenario} setScenario={(s) => setScenario(s as PavingScenario)} output={output} inputs={inputs as unknown as CalculatorInputs} props={props} complementary={pavingComplementarySubcategories(scenario)}>
    {(scenario === "patio" || scenario === "driveway") && (() => { const i = allInputs[scenario]; return (<div className="space-y-3"><div className="grid gap-3 sm:grid-cols-2"><Field label="Length (m)"><NumInput value={i.length_m} onChange={(v) => update(scenario, { length_m: v })} /></Field><Field label="Width (m)"><NumInput value={i.width_m} onChange={(v) => update(scenario, { width_m: v })} /></Field><Field label="Slab W (mm)"><NumInput value={i.slab_w_mm} onChange={(v) => update(scenario, { slab_w_mm: Math.round(v) })} step="1" min={50} /></Field><Field label="Slab H (mm)"><NumInput value={i.slab_h_mm} onChange={(v) => update(scenario, { slab_h_mm: Math.round(v) })} step="1" min={50} /></Field></div><CheckRow label="+10% waste" checked={i.waste_10pct} onChange={(b) => update(scenario, { waste_10pct: b })} /></div>); })()}
    {scenario === "garden_path" && (() => { const i = allInputs.garden_path; return (<div className="space-y-3"><div className="grid gap-3 sm:grid-cols-2"><Field label="Length (m)"><NumInput value={i.length_m} onChange={(v) => update("garden_path", { length_m: v })} /></Field><Field label="Width (m)"><NumInput value={i.width_m} onChange={(v) => update("garden_path", { width_m: v })} /></Field><Field label="Slab W (mm)"><NumInput value={i.slab_w_mm} onChange={(v) => update("garden_path", { slab_w_mm: Math.round(v) })} step="1" min={50} /></Field><Field label="Slab H (mm)"><NumInput value={i.slab_h_mm} onChange={(v) => update("garden_path", { slab_h_mm: Math.round(v) })} step="1" min={50} /></Field></div><CheckRow label="Curved (+20% waste)" checked={i.curves} onChange={(b) => update("garden_path", { curves: b })} /><CheckRow label="+10% waste" checked={i.waste_10pct} onChange={(b) => update("garden_path", { waste_10pct: b })} /></div>); })()}
  </Shell></>);
}

function SkirtingCalc(props: CalcProps) {
  const [scenario, setScenario] = useState<SkirtingScenario>(SKIRTING_DEFAULT_SCENARIO);
  const [allInputs, setAllInputs] = useState(SKIRTING_DEFAULT_INPUTS_BY_SCENARIO);
  const inputs = allInputs[scenario] as SkirtingInputs;
  const output = useMemo(() => computeSkirting(inputs, props.product), [inputs, props.product]);
  function update<S extends SkirtingScenario>(s: S, p: Partial<Extract<SkirtingInputs, { scenario: S }>>) { setAllInputs((a) => ({ ...a, [s]: { ...a[s], ...p } })); }
  const stockOpts: Array<{ value: "2.4" | "3" | "4.2"; label: string }> = [{ value: "2.4", label: "2.4 m" }, { value: "3", label: "3 m" }, { value: "4.2", label: "4.2 m" }];
  return (<><CalcHeader title="Skirting / coving / architrave calculator" sub="Stock lengths + perimeter + doorway math." /><Shell type="skirting" scenarioLabels={SKIRTING_SCENARIO_LABEL} scenario={scenario} setScenario={(s) => setScenario(s as SkirtingScenario)} output={output} inputs={inputs as unknown as CalculatorInputs} props={props} complementary={skirtingComplementarySubcategories(scenario)}>
    {scenario === "single_room" && (() => { const i = allInputs.single_room; return (<div className="space-y-3"><div className="grid gap-3 sm:grid-cols-2"><Field label="Length (m)"><NumInput value={i.room_length_m} onChange={(v) => update("single_room", { room_length_m: v })} /></Field><Field label="Width (m)"><NumInput value={i.room_width_m} onChange={(v) => update("single_room", { room_width_m: v })} /></Field><Field label="Doorways"><NumInput value={i.doorways} onChange={(v) => update("single_room", { doorways: Math.max(0, Math.round(v)) })} step="1" min={0} /></Field><Field label="Doorway width (m)"><NumInput value={i.doorway_width_m} onChange={(v) => update("single_room", { doorway_width_m: v })} /></Field></div><Field label="Stock length"><PillRow options={stockOpts} value={String(i.stock_length_m) as "2.4" | "3" | "4.2"} onChange={(v) => update("single_room", { stock_length_m: Number(v) as 2.4 | 3 | 4.2 })} /></Field></div>); })()}
    {scenario === "multi_room" && (() => { const i = allInputs.multi_room; return (<div className="space-y-3">{i.rooms.map((r, idx) => (<div key={idx} className="grid gap-3 rounded-lg border border-neutral-200 bg-white p-3 sm:grid-cols-[1.2fr_1fr_1fr_1fr_auto]"><Field label="Name"><input type="text" value={r.name} onChange={(e) => update("multi_room", { rooms: i.rooms.map((rr, j) => j === idx ? { ...rr, name: e.target.value } : rr) })} className={inputClass} /></Field><Field label="L (m)"><NumInput value={r.length_m} onChange={(v) => update("multi_room", { rooms: i.rooms.map((rr, j) => j === idx ? { ...rr, length_m: v } : rr) })} /></Field><Field label="W (m)"><NumInput value={r.width_m} onChange={(v) => update("multi_room", { rooms: i.rooms.map((rr, j) => j === idx ? { ...rr, width_m: v } : rr) })} /></Field><Field label="Doors"><NumInput value={r.doorways} onChange={(v) => update("multi_room", { rooms: i.rooms.map((rr, j) => j === idx ? { ...rr, doorways: Math.max(0, Math.round(v)) } : rr) })} step="1" min={0} /></Field><div className="flex items-end"><button type="button" onClick={() => update("multi_room", { rooms: i.rooms.filter((_, j) => j !== idx) })} className="inline-flex h-11 items-center rounded-lg border border-red-300 bg-red-50 px-3 text-[12px] font-bold text-red-700">×</button></div></div>))}<button type="button" onClick={() => update("multi_room", { rooms: [...i.rooms, { name: `Room ${i.rooms.length + 1}`, length_m: 3, width_m: 3, doorways: 1 }] })} className="inline-flex h-11 items-center rounded-lg border border-[#FFB300] bg-[#FFB300]/10 px-3 text-[13px] font-bold">+ Add room</button><Field label="Doorway width (m)"><NumInput value={i.doorway_width_m} onChange={(v) => update("multi_room", { doorway_width_m: v })} /></Field><Field label="Stock length"><PillRow options={stockOpts} value={String(i.stock_length_m) as "2.4" | "3" | "4.2"} onChange={(v) => update("multi_room", { stock_length_m: Number(v) as 2.4 | 3 | 4.2 })} /></Field></div>); })()}
    {scenario === "coving" && (() => { const i = allInputs.coving; return (<div className="space-y-3"><div className="grid gap-3 sm:grid-cols-2"><Field label="Room length (m)"><NumInput value={i.room_length_m} onChange={(v) => update("coving", { room_length_m: v })} /></Field><Field label="Room width (m)"><NumInput value={i.room_width_m} onChange={(v) => update("coving", { room_width_m: v })} /></Field></div><Field label="Stock length"><PillRow options={stockOpts} value={String(i.stock_length_m) as "2.4" | "3" | "4.2"} onChange={(v) => update("coving", { stock_length_m: Number(v) as 2.4 | 3 | 4.2 })} /></Field></div>); })()}
  </Shell></>);
}

function RoofTilesCalc(props: CalcProps) {
  const [scenario, setScenario] = useState<RoofTilesScenario>(ROOF_TILES_DEFAULT_SCENARIO);
  const [allInputs, setAllInputs] = useState(ROOF_TILES_DEFAULT_INPUTS_BY_SCENARIO);
  const inputs = allInputs[scenario] as RoofTilesInputs;
  const output = useMemo(() => computeRoofTiles(inputs, props.product), [inputs, props.product]);
  function update<S extends RoofTilesScenario>(s: S, p: Partial<Extract<RoofTilesInputs, { scenario: S }>>) { setAllInputs((a) => ({ ...a, [s]: { ...a[s], ...p } })); }
  return (<><CalcHeader title="Roof tiles calculator" sub="Plan area × pitch factor → tiles + battens + felt + nails." /><Shell type="roof_tiles" scenarioLabels={ROOF_TILES_SCENARIO_LABEL} scenario={scenario} setScenario={(s) => setScenario(s as RoofTilesScenario)} output={output} inputs={inputs as unknown as CalculatorInputs} props={props} complementary={roofTilesComplementarySubcategories(scenario)}>
    {scenario === "gable" && (() => { const i = allInputs.gable; return (<div className="space-y-3"><div className="grid gap-3 sm:grid-cols-3"><Field label="Plan area (m²)"><NumInput value={i.plan_area_m2} onChange={(v) => update("gable", { plan_area_m2: v })} /></Field><Field label="Pitch (°)"><select value={i.pitch_deg} onChange={(e) => update("gable", { pitch_deg: Number(e.target.value) as 15 | 22.5 | 30 | 35 | 40 | 45 })} className={inputClass}><option value={15}>15°</option><option value={22.5}>22.5°</option><option value={30}>30°</option><option value={35}>35°</option><option value={40}>40°</option><option value={45}>45°</option></select></Field><Field label="Tile type"><select value={i.tile_type} onChange={(e) => update("gable", { tile_type: e.target.value as "concrete_interlocking" | "plain_clay" | "natural_slate" })} className={inputClass}><option value="concrete_interlocking">Concrete (10/m²)</option><option value="plain_clay">Plain clay (60/m²)</option><option value="natural_slate">Slate (20/m²)</option></select></Field></div><Field label="Ridge length (m)"><NumInput value={i.ridge_length_m} onChange={(v) => update("gable", { ridge_length_m: v })} /></Field><CheckRow label="+5% waste" checked={i.waste_5pct} onChange={(b) => update("gable", { waste_5pct: b })} /></div>); })()}
    {scenario === "hip" && (() => { const i = allInputs.hip; return (<div className="space-y-3"><div className="grid gap-3 sm:grid-cols-3"><Field label="Plan area (m²)"><NumInput value={i.plan_area_m2} onChange={(v) => update("hip", { plan_area_m2: v })} /></Field><Field label="Pitch (°)"><select value={i.pitch_deg} onChange={(e) => update("hip", { pitch_deg: Number(e.target.value) as 15 | 22.5 | 30 | 35 | 40 | 45 })} className={inputClass}><option value={15}>15°</option><option value={22.5}>22.5°</option><option value={30}>30°</option><option value={35}>35°</option><option value={40}>40°</option><option value={45}>45°</option></select></Field><Field label="Tile type"><select value={i.tile_type} onChange={(e) => update("hip", { tile_type: e.target.value as "concrete_interlocking" | "plain_clay" | "natural_slate" })} className={inputClass}><option value="concrete_interlocking">Concrete (10/m²)</option><option value="plain_clay">Plain clay (60/m²)</option><option value="natural_slate">Slate (20/m²)</option></select></Field></div><div className="grid gap-3 sm:grid-cols-2"><Field label="Ridge length (m)"><NumInput value={i.ridge_length_m} onChange={(v) => update("hip", { ridge_length_m: v })} /></Field><Field label="Hip length (m)"><NumInput value={i.hip_length_m} onChange={(v) => update("hip", { hip_length_m: v })} /></Field></div><CheckRow label="+5% waste" checked={i.waste_5pct} onChange={(b) => update("hip", { waste_5pct: b })} /></div>); })()}
  </Shell></>);
}

function WallpaperCalc(props: CalcProps) {
  const [scenario, setScenario] = useState<WallpaperScenario>(WALLPAPER_DEFAULT_SCENARIO);
  const [allInputs, setAllInputs] = useState(WALLPAPER_DEFAULT_INPUTS_BY_SCENARIO);
  const inputs = allInputs[scenario] as WallpaperInputs;
  const output = useMemo(() => computeWallpaper(inputs, props.product), [inputs, props.product]);
  function update<S extends WallpaperScenario>(s: S, p: Partial<Extract<WallpaperInputs, { scenario: S }>>) { setAllInputs((a) => ({ ...a, [s]: { ...a[s], ...p } })); }
  const patternOpts: Array<{ value: "plain_or_small" | "large_repeat"; label: string }> = [{ value: "plain_or_small", label: "Plain / small repeat" }, { value: "large_repeat", label: "Large repeat" }];
  return (<><CalcHeader title="Wallpaper calculator" sub="UK std roll 10.05m × 0.52m." /><Shell type="wallpaper" scenarioLabels={WALLPAPER_SCENARIO_LABEL} scenario={scenario} setScenario={(s) => setScenario(s as WallpaperScenario)} output={output} inputs={inputs as unknown as CalculatorInputs} props={props} complementary={wallpaperComplementarySubcategories(scenario)}>
    {scenario === "feature_wall" && (() => { const i = allInputs.feature_wall; return (<div className="space-y-3"><div className="grid gap-3 sm:grid-cols-2"><Field label="Wall length (m)"><NumInput value={i.wall_length_m} onChange={(v) => update("feature_wall", { wall_length_m: v })} /></Field><Field label="Wall height (m)"><NumInput value={i.wall_height_m} onChange={(v) => update("feature_wall", { wall_height_m: v })} /></Field></div><Field label="Pattern"><PillRow options={patternOpts} value={i.pattern} onChange={(v) => update("feature_wall", { pattern: v })} /></Field></div>); })()}
    {scenario === "whole_room" && (() => { const i = allInputs.whole_room; return (<div className="space-y-3"><div className="grid gap-3 sm:grid-cols-3"><Field label="Length (m)"><NumInput value={i.length_m} onChange={(v) => update("whole_room", { length_m: v })} /></Field><Field label="Width (m)"><NumInput value={i.width_m} onChange={(v) => update("whole_room", { width_m: v })} /></Field><Field label="Height (m)"><NumInput value={i.height_m} onChange={(v) => update("whole_room", { height_m: v })} /></Field></div><div className="grid gap-3 sm:grid-cols-2"><Field label="Doors"><NumInput value={i.doors} onChange={(v) => update("whole_room", { doors: Math.max(0, Math.round(v)) })} step="1" min={0} /></Field><Field label="Windows"><NumInput value={i.windows} onChange={(v) => update("whole_room", { windows: Math.max(0, Math.round(v)) })} step="1" min={0} /></Field></div><Field label="Pattern"><PillRow options={patternOpts} value={i.pattern} onChange={(v) => update("whole_room", { pattern: v })} /></Field></div>); })()}
    {scenario === "stairwell" && (() => { const i = allInputs.stairwell; return (<div className="space-y-3"><div className="grid gap-3 sm:grid-cols-2"><Field label="Tallest height (m)"><NumInput value={i.tallest_wall_height_m} onChange={(v) => update("stairwell", { tallest_wall_height_m: v })} /></Field><Field label="Stair run (m)"><NumInput value={i.stair_run_m} onChange={(v) => update("stairwell", { stair_run_m: v })} /></Field></div><Field label="Pattern"><PillRow options={patternOpts} value={i.pattern} onChange={(v) => update("stairwell", { pattern: v })} /></Field></div>); })()}
  </Shell></>);
}

function RenderCalc(props: CalcProps) {
  const [scenario, setScenario] = useState<RenderScenario>(RENDER_DEFAULT_SCENARIO);
  const [allInputs, setAllInputs] = useState(RENDER_DEFAULT_INPUTS_BY_SCENARIO);
  const inputs = allInputs[scenario] as RenderInputs;
  const output = useMemo(() => computeRender(inputs, props.product), [inputs, props.product]);
  function update<S extends RenderScenario>(s: S, p: Partial<Extract<RenderInputs, { scenario: S }>>) { setAllInputs((a) => ({ ...a, [s]: { ...a[s], ...p } })); }
  const sysOpts: Array<{ value: "sand_cement" | "k_rend_silicone"; label: string }> = [{ value: "sand_cement", label: "Sand:cement 1:5" }, { value: "k_rend_silicone", label: "K Rend / silicone" }];
  return (<><CalcHeader title="Render calculator" sub="Bags + reinforcement mesh." /><Shell type="render" scenarioLabels={RENDER_SCENARIO_LABEL} scenario={scenario} setScenario={(s) => setScenario(s as RenderScenario)} output={output} inputs={inputs as unknown as CalculatorInputs} props={props} complementary={renderComplementarySubcategories(scenario)}>
    {scenario === "external_wall" && (() => { const i = allInputs.external_wall; return (<div className="space-y-3"><Field label="Wall area (m²)"><NumInput value={i.wall_area_m2} onChange={(v) => update("external_wall", { wall_area_m2: v })} /></Field><Field label="System"><PillRow options={sysOpts} value={i.system} onChange={(v) => update("external_wall", { system: v })} /></Field><CheckRow label="Include mesh" checked={i.include_mesh} onChange={(b) => update("external_wall", { include_mesh: b })} /><CheckRow label="+10% waste" checked={i.waste_10pct} onChange={(b) => update("external_wall", { waste_10pct: b })} /></div>); })()}
    {scenario === "chimney_stack" && (() => { const i = allInputs.chimney_stack; return (<div className="space-y-3"><div className="grid gap-3 sm:grid-cols-2"><Field label="Perimeter (m)"><NumInput value={i.stack_perimeter_m} onChange={(v) => update("chimney_stack", { stack_perimeter_m: v })} /></Field><Field label="Height (m)"><NumInput value={i.stack_height_m} onChange={(v) => update("chimney_stack", { stack_height_m: v })} /></Field></div><Field label="System"><PillRow options={sysOpts} value={i.system} onChange={(v) => update("chimney_stack", { system: v })} /></Field><CheckRow label="Include mesh" checked={i.include_mesh} onChange={(b) => update("chimney_stack", { include_mesh: b })} /><CheckRow label="+10% waste" checked={i.waste_10pct} onChange={(b) => update("chimney_stack", { waste_10pct: b })} /></div>); })()}
  </Shell></>);
}

function TurfCalc(props: CalcProps) {
  const [scenario, setScenario] = useState<TurfScenario>(TURF_DEFAULT_SCENARIO);
  const [allInputs, setAllInputs] = useState(TURF_DEFAULT_INPUTS_BY_SCENARIO);
  const inputs = allInputs[scenario] as TurfInputs;
  const output = useMemo(() => computeTurf(inputs, props.product), [inputs, props.product]);
  function update<S extends TurfScenario>(s: S, p: Partial<Extract<TurfInputs, { scenario: S }>>) { setAllInputs((a) => ({ ...a, [s]: { ...a[s], ...p } })); }
  return (<><CalcHeader title="Turf calculator" sub="UK 1m × 410mm rolls (0.41 m² each)." /><Shell type="turf" scenarioLabels={TURF_SCENARIO_LABEL} scenario={scenario} setScenario={(s) => setScenario(s as TurfScenario)} output={output} inputs={inputs as unknown as CalculatorInputs} props={props} complementary={turfComplementarySubcategories(scenario)}>
    {scenario === "simple" && (() => { const i = allInputs.simple; return (<div className="space-y-3"><div className="grid gap-3 sm:grid-cols-2"><Field label="Length (m)"><NumInput value={i.lawn_length_m} onChange={(v) => update("simple", { lawn_length_m: v })} /></Field><Field label="Width (m)"><NumInput value={i.lawn_width_m} onChange={(v) => update("simple", { lawn_width_m: v })} /></Field></div><CheckRow label="+5% waste" checked={i.waste_5pct} onChange={(b) => update("simple", { waste_5pct: b })} /></div>); })()}
    {scenario === "full_prep" && (() => { const i = allInputs.full_prep; return (<div className="space-y-3"><div className="grid gap-3 sm:grid-cols-3"><Field label="Length (m)"><NumInput value={i.lawn_length_m} onChange={(v) => update("full_prep", { lawn_length_m: v })} /></Field><Field label="Width (m)"><NumInput value={i.lawn_width_m} onChange={(v) => update("full_prep", { lawn_width_m: v })} /></Field><Field label="Topsoil depth (mm)"><NumInput value={i.topsoil_depth_mm} onChange={(v) => update("full_prep", { topsoil_depth_mm: Math.round(v) })} step="10" min={10} /></Field></div><CheckRow label="Include levelling sand" checked={i.include_levelling_sand} onChange={(b) => update("full_prep", { include_levelling_sand: b })} /><CheckRow label="+5% waste" checked={i.waste_5pct} onChange={(b) => update("full_prep", { waste_5pct: b })} /></div>); })()}
  </Shell></>);
}
