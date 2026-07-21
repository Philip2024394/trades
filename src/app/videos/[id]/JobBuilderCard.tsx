"use client";

// JobBuilderCard — collapsible "Plan your own job" wizard.
//
// Sits at the top of the AI container on video pages. Collapsed
// by default (small pill). Click to expand into a 3-step guided
// flow: preset → dimensions + qualifiers → generate → route to
// /job/[id].
//
// Trade-agnostic — reads job types from a small config passed
// in. Concrete first; the same component handles decking, roofing
// etc as new templates come online.

import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  Workflow, ChevronDown, ChevronUp, Loader2, ArrowRight,
  Ruler, Sparkles, Info, AlertTriangle
} from "lucide-react";

const CONCRETE_PRESETS = [
  { slug: "driveway-car",       label: "Driveway (car)",         icon: "🚗", default_thickness_mm: 100 },
  { slug: "driveway-van",       label: "Driveway (van)",         icon: "🚐", default_thickness_mm: 150 },
  { slug: "patio",              label: "Patio",                  icon: "🌤",  default_thickness_mm: 100 },
  { slug: "garden-path",        label: "Garden path",            icon: "🌿", default_thickness_mm:  75 },
  { slug: "shed-base",          label: "Shed base",              icon: "🏠", default_thickness_mm: 100 },
  { slug: "garage-floor",       label: "Garage floor",           icon: "🏚️", default_thickness_mm: 150 },
  { slug: "workshop-floor",     label: "Workshop floor",         icon: "🔨", default_thickness_mm: 200 },
  { slug: "concrete-steps",     label: "Concrete steps",         icon: "🪜", default_thickness_mm: 100 },
  { slug: "fence-posts",        label: "Fence post foundations", icon: "🚧", default_thickness_mm: 600 }
];

type Step = "preset" | "dimensions" | "generating";

type Props = {
  videoId?:  string;
  defaultOpen?: boolean;
};

export function JobBuilderCard({ videoId, defaultOpen = false }: Props) {
  const router = useRouter();
  const [expanded, setExpanded]           = useState(defaultOpen);
  const [step, setStep]                   = useState<Step>("preset");
  const [preset, setPreset]               = useState<string | null>(null);
  const [thicknessMm, setThicknessMm]     = useState(100);
  const [lengthM, setLengthM]             = useState(4);
  const [widthM, setWidthM]               = useState(3);
  const [vehicleWeight, setVehicleWeight] = useState<string>("none");
  const [softGround, setSoftGround]       = useState(false);
  const [reinforcement, setReinforcement] = useState(false);
  const [readyMix, setReadyMix]           = useState(true);
  const [busy, setBusy]                   = useState(false);
  const [error, setError]                 = useState<string | null>(null);

  function pickPreset(p: typeof CONCRETE_PRESETS[number]) {
    setPreset(p.slug);
    setThicknessMm(p.default_thickness_mm);
    if (p.slug === "driveway-car")      setVehicleWeight("car");
    if (p.slug === "driveway-van")      setVehicleWeight("van");
    setReinforcement(p.default_thickness_mm >= 100 && p.slug !== "patio" && p.slug !== "garden-path");
    setStep("dimensions");
  }

  async function generate() {
    if (!preset) return;
    setBusy(true);
    setError(null);
    setStep("generating");
    try {
      const res = await fetch("/api/jobs/create", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          job_type: "concrete",
          preset,
          dimensions: { length_m: lengthM, width_m: widthM, thickness_mm: thicknessMm },
          qualifiers: {
            use_case: preset,
            vehicle_weight: vehicleWeight,
            soft_ground: softGround,
            reinforcement_planned: reinforcement,
            ready_mix_preferred: readyMix
          },
          linked_video_id: videoId ?? undefined
        })
      });
      const json = await res.json();
      if (!json.ok) {
        setError(json.message || json.error || "Something went wrong");
        setBusy(false);
        setStep("dimensions");
        return;
      }
      router.push(`/job/${json.job_id}`);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
      setBusy(false);
      setStep("dimensions");
    }
  }

  const areaM2   = lengthM * widthM;
  const volumeM3 = areaM2 * (thicknessMm / 1000);

  return (
    <section
      className="rounded-2xl border-2 shadow-sm"
      style={{ borderColor: "#0A0A0A", backgroundColor: "#0A0A0A" }}
    >
      {/* Header — always visible, click to expand */}
      <button
        type="button"
        onClick={() => setExpanded(!expanded)}
        className="flex w-full items-center justify-between px-5 py-3 md:px-6"
      >
        <div className="flex items-center gap-2.5">
          <div className="flex h-8 w-8 items-center justify-center rounded-full" style={{ backgroundColor: "#FFB300" }}>
            <Workflow size={14} strokeWidth={2.6} className="text-neutral-900"/>
          </div>
          <div className="text-left">
            <p className="text-[9.5px] font-black uppercase tracking-[0.28em]" style={{ color: "#FFB300" }}>
              Plan your own job
            </p>
            <p className="text-[13px] font-black text-white">
              {expanded ? "Choose your project type" : "Concrete driveway, patio, slab, foundation…"}
            </p>
          </div>
        </div>
        <div className="inline-flex h-8 items-center gap-1 rounded-full px-3 text-[10.5px] font-black uppercase tracking-wider text-neutral-900" style={{ backgroundColor: "#FFB300" }}>
          {expanded ? "Close" : "Start"} {expanded ? <ChevronUp size={11}/> : <ChevronDown size={11}/>}
        </div>
      </button>

      {expanded && (
        <div className="border-t px-5 pb-5 pt-4 md:px-6 md:pb-6" style={{ borderColor: "rgba(255,179,0,0.30)" }}>
          {/* STEP 1 — preset */}
          {step === "preset" && (
            <div>
              <p className="text-[11px] font-black uppercase tracking-wider text-neutral-400">
                Step 1 of 2 — what are you building?
              </p>
              <ul className="mt-3 grid grid-cols-2 gap-2 md:grid-cols-3">
                {CONCRETE_PRESETS.map(p => (
                  <li key={p.slug}>
                    <button
                      type="button"
                      onClick={() => pickPreset(p)}
                      className="flex w-full items-center gap-2 rounded-xl border-2 bg-white px-3 py-3 text-left hover:-translate-y-0.5 transition"
                      style={{ borderColor: "rgba(255,179,0,0.30)" }}
                    >
                      <span className="text-[20px]">{p.icon}</span>
                      <span className="text-[12.5px] font-black text-neutral-900">{p.label}</span>
                    </button>
                  </li>
                ))}
              </ul>
              <p className="mt-3 text-[10.5px] text-neutral-500">
                Not sure? Pick the closest — you can change anything on the next step.
              </p>
            </div>
          )}

          {/* STEP 2 — dimensions + qualifiers */}
          {step === "dimensions" && (
            <div>
              <div className="flex items-baseline justify-between">
                <p className="text-[11px] font-black uppercase tracking-wider text-neutral-400">
                  Step 2 of 2 — dimensions + details
                </p>
                <button
                  type="button"
                  onClick={() => setStep("preset")}
                  className="text-[10.5px] font-black uppercase tracking-wider text-neutral-500 hover:text-white"
                >
                  ← Change project
                </button>
              </div>

              {/* Dimension row */}
              <div className="mt-3 grid grid-cols-3 gap-2">
                <NumberField label="Length (m)"    value={lengthM}     onChange={setLengthM}    step={0.5} min={0.5} max={100}/>
                <NumberField label="Width (m)"     value={widthM}      onChange={setWidthM}     step={0.5} min={0.5} max={100}/>
                <NumberField label="Thickness (mm)" value={thicknessMm} onChange={setThicknessMm} step={25}  min={50}  max={800}/>
              </div>

              {/* Live preview */}
              <div className="mt-2 flex flex-wrap items-center gap-2 rounded-lg bg-neutral-800 px-3 py-2">
                <Ruler size={11} className="text-yellow-400"/>
                <span className="text-[11px] font-black uppercase tracking-wider text-yellow-400">Volume</span>
                <span className="text-[12.5px] font-black text-white tabular-nums">{volumeM3.toFixed(2)} m³</span>
                <span className="text-[10.5px] text-neutral-400">· {areaM2.toFixed(1)} m² floor area</span>
              </div>

              {/* Qualifiers */}
              <div className="mt-3 space-y-2">
                <ChoiceField
                  label="Any vehicle drives on it?"
                  value={vehicleWeight}
                  onChange={setVehicleWeight}
                  options={[
                    { value: "none",  label: "No vehicles" },
                    { value: "car",   label: "Car" },
                    { value: "van",   label: "Van/light" },
                    { value: "truck", label: "Truck/heavy" }
                  ]}
                />
                <div className="grid grid-cols-1 gap-2 md:grid-cols-3">
                  <BooleanField label="Soft ground?"       value={softGround}     onChange={setSoftGround}/>
                  <BooleanField label="Add steel mesh?"    value={reinforcement}  onChange={setReinforcement}/>
                  <BooleanField label="Ready-mix delivery?" value={readyMix}      onChange={setReadyMix}/>
                </div>
              </div>

              {error && (
                <div className="mt-3 flex items-start gap-2 rounded-lg border-2 p-2.5" style={{ borderColor: "#EF4444", backgroundColor: "#7F1D1D" }}>
                  <AlertTriangle size={12} className="mt-0.5 shrink-0 text-red-200"/>
                  <p className="text-[11px] font-black text-red-100">{error}</p>
                </div>
              )}

              <div className="mt-4 flex items-center gap-2 rounded-lg border-2 px-3 py-2" style={{ borderColor: "rgba(255,179,0,0.30)" }}>
                <Info size={11} className="text-yellow-400"/>
                <p className="text-[10.5px] text-neutral-300">
                  Estimates depend on ground conditions, loading + local Building Regs. For structural work, get engineer sign-off.
                </p>
              </div>

              <button
                type="button"
                onClick={generate}
                disabled={busy}
                className="mt-4 inline-flex h-11 w-full items-center justify-center gap-1.5 rounded-lg text-[12.5px] font-black uppercase tracking-wider text-neutral-900 shadow-sm active:scale-[0.98] disabled:opacity-60"
                style={{ backgroundColor: "#FFB300" }}
              >
                {busy ? <Loader2 size={14} className="animate-spin"/> : <Sparkles size={14} strokeWidth={2.6}/>}
                Generate my job
                <ArrowRight size={13}/>
              </button>
            </div>
          )}

          {/* STEP 3 — generating */}
          {step === "generating" && (
            <div className="flex flex-col items-center py-10 text-center">
              <Loader2 size={28} className="animate-spin text-yellow-400"/>
              <p className="mt-3 text-[13px] font-black text-white">Building your job…</p>
              <p className="mt-1 text-[11px] text-neutral-400">Calculating materials, matching KB knowledge, finding local trades</p>
            </div>
          )}
        </div>
      )}
    </section>
  );
}

// ─── Field primitives ──────────────────────────────────────────────

function NumberField({ label, value, onChange, step, min, max }: {
  label: string; value: number; onChange: (n: number) => void;
  step: number; min: number; max: number;
}) {
  return (
    <label className="block">
      <span className="text-[9.5px] font-black uppercase tracking-wider text-neutral-400">{label}</span>
      <input
        type="number"
        value={value}
        min={min}
        max={max}
        step={step}
        onChange={(e) => onChange(Number(e.target.value) || 0)}
        className="mt-1 h-10 w-full rounded-lg border-2 bg-white px-2 text-[13.5px] font-black text-neutral-900 tabular-nums"
        style={{ borderColor: "rgba(255,179,0,0.30)" }}
      />
    </label>
  );
}

function ChoiceField({ label, value, onChange, options }: {
  label: string; value: string; onChange: (v: string) => void;
  options: Array<{ value: string; label: string }>;
}) {
  return (
    <div>
      <p className="text-[9.5px] font-black uppercase tracking-wider text-neutral-400">{label}</p>
      <ul className="mt-1 flex flex-wrap gap-1.5">
        {options.map(o => {
          const active = value === o.value;
          return (
            <li key={o.value}>
              <button
                type="button"
                onClick={() => onChange(o.value)}
                className="inline-flex h-8 items-center rounded-full border-2 px-3 text-[11px] font-black transition"
                style={active
                  ? { backgroundColor: "#FFB300", color: "#0A0A0A", borderColor: "#FFB300" }
                  : { backgroundColor: "transparent", color: "#FFFFFF", borderColor: "rgba(255,179,0,0.30)" }}
              >
                {o.label}
              </button>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

function BooleanField({ label, value, onChange }: {
  label: string; value: boolean; onChange: (v: boolean) => void;
}) {
  return (
    <button
      type="button"
      onClick={() => onChange(!value)}
      className="flex h-10 w-full items-center justify-between rounded-lg border-2 px-3 text-left transition"
      style={value
        ? { backgroundColor: "#FFB300", color: "#0A0A0A", borderColor: "#FFB300" }
        : { backgroundColor: "transparent", color: "#FFFFFF", borderColor: "rgba(255,179,0,0.30)" }}
    >
      <span className="text-[11px] font-black">{label}</span>
      <span className="text-[10.5px] font-black uppercase tracking-wider">{value ? "Yes" : "No"}</span>
    </button>
  );
}
