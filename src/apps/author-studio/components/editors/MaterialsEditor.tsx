"use client";

import { useEffect, useState } from "react";
import { BUTTON_PRIMARY, BUTTON_SECONDARY, INPUT_CLASS, fetchModule, newId, saveModule } from "./_helpers";

type Material = {
  id: string; family: string; name: string;
  grades: string[]; pack_sizes: string[]; defect_risk: "low" | "medium" | "high";
  waste_factor_pct: number; compatible_with: string[]; incompatible_with: string[];
  evidence: Array<{ source: string }>; confidence: "low" | "medium" | "high";
};
type MaterialsModule = {
  header: { version: string; authored_by: string; authored_at: string; regions: string[] };
  materials: Material[];
};

export function MaterialsEditor({ slug }: { slug: string }) {
  const [mod, setMod] = useState<MaterialsModule | null>(null);
  const [status, setStatus] = useState<"loading" | "ready" | "saving" | "error">("loading");
  const [msg, setMsg] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      const res = await fetchModule<MaterialsModule>(slug, "materials");
      if (!res.ok) { setStatus("error"); setMsg(res.error); return; }
      setMod(res.payload); setStatus("ready");
    })();
  }, [slug]);

  function add() {
    if (!mod) return;
    setMod({
      ...mod,
      materials: [...mod.materials, {
        id: newId("mat"), family: "", name: "", grades: [], pack_sizes: [],
        defect_risk: "low", waste_factor_pct: 10, compatible_with: [],
        incompatible_with: [], evidence: [], confidence: "medium"
      }]
    });
  }
  function update(i: number, patch: Partial<Material>) {
    if (!mod) return;
    const next = [...mod.materials];
    next[i] = { ...next[i], ...patch };
    setMod({ ...mod, materials: next });
  }
  function remove(i: number) {
    if (!mod) return;
    setMod({ ...mod, materials: mod.materials.filter((_, idx) => idx !== i) });
  }
  async function save() {
    if (!mod) return;
    setStatus("saving");
    const res = await saveModule<MaterialsModule>(slug, "materials", mod, mod.header.version);
    if (!res.ok) { setStatus("error"); setMsg(res.error); return; }
    setStatus("ready"); setMsg("Saved.");
  }

  if (status === "loading") return <p className="text-sm text-[#0A0A0A]/60">Loading materials...</p>;
  if (!mod) return <p className="text-sm text-red-700">{msg ?? "Failed to load"}</p>;

  return (
    <div className="space-y-4">
      <h2 className="text-sm font-semibold">Materials</h2>
      <div className="space-y-3">
        {mod.materials.map((m, i) => (
          <div key={m.id} className="rounded border border-[#0A0A0A]/10 bg-[#FBF6EC] p-3">
            <div className="flex items-baseline justify-between">
              <span className="text-xs font-mono text-[#0A0A0A]/50">{m.id}</span>
              <button onClick={() => remove(i)} className="text-xs text-red-700 underline">remove</button>
            </div>
            <div className="mt-2 grid grid-cols-2 gap-2">
              <label className="block">
                <span className="text-xs font-medium">Family</span>
                <input className={INPUT_CLASS} value={m.family} onChange={(e) => update(i, { family: e.target.value })} placeholder="wood · metal · concrete" />
              </label>
              <label className="block">
                <span className="text-xs font-medium">Name</span>
                <input className={INPUT_CLASS} value={m.name} onChange={(e) => update(i, { name: e.target.value })} placeholder="e.g. European oak, PAR" />
              </label>
              <label className="block">
                <span className="text-xs font-medium">Defect risk</span>
                <select className={INPUT_CLASS} value={m.defect_risk} onChange={(e) => update(i, { defect_risk: e.target.value as Material["defect_risk"] })}>
                  <option value="low">low</option>
                  <option value="medium">medium</option>
                  <option value="high">high</option>
                </select>
              </label>
              <label className="block">
                <span className="text-xs font-medium">Waste factor %</span>
                <input type="number" min={0} max={100} className={INPUT_CLASS} value={m.waste_factor_pct} onChange={(e) => update(i, { waste_factor_pct: Number(e.target.value) })} />
              </label>
            </div>
          </div>
        ))}
      </div>
      <div className="flex items-center gap-2">
        <button className={BUTTON_SECONDARY} onClick={add}>+ Add material</button>
        <button className={BUTTON_PRIMARY} onClick={save} disabled={status === "saving"}>
          {status === "saving" ? "Saving..." : "Save materials"}
        </button>
        {msg && <span className="text-xs text-[#0A0A0A]/70">{msg}</span>}
      </div>
    </div>
  );
}
