"use client";

import { useEffect, useState } from "react";
import { BUTTON_PRIMARY, BUTTON_SECONDARY, INPUT_CLASS, fetchModule, newId, saveModule } from "./_helpers";

type Defect = {
  id: string; name: string; applies_to: string[];
  symptoms: string[]; causes: string[]; fixes: string[];
  severity: "cosmetic" | "functional" | "safety_critical";
  vision_hints: string[];
  evidence: Array<{ source: string }>; confidence: "low" | "medium" | "high";
};
type DefectsModule = {
  header: { version: string; authored_by: string; authored_at: string; regions: string[] };
  defects: Defect[];
};

export function DefectsEditor({ slug }: { slug: string }) {
  const [mod, setMod] = useState<DefectsModule | null>(null);
  const [status, setStatus] = useState<"loading" | "ready" | "saving" | "error">("loading");
  const [msg, setMsg] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      const res = await fetchModule<DefectsModule>(slug, "defects");
      if (!res.ok) { setStatus("error"); setMsg(res.error); return; }
      setMod(res.payload); setStatus("ready");
    })();
  }, [slug]);

  function add() {
    if (!mod) return;
    setMod({
      ...mod,
      defects: [...mod.defects, {
        id: newId("def"), name: "", applies_to: [],
        symptoms: [""], causes: [], fixes: [],
        severity: "cosmetic", vision_hints: [], evidence: [], confidence: "medium"
      }]
    });
  }
  function update(i: number, patch: Partial<Defect>) {
    if (!mod) return;
    const next = [...mod.defects];
    next[i] = { ...next[i], ...patch };
    setMod({ ...mod, defects: next });
  }
  function remove(i: number) {
    if (!mod) return;
    setMod({ ...mod, defects: mod.defects.filter((_, idx) => idx !== i) });
  }
  async function save() {
    if (!mod) return;
    setStatus("saving");
    const res = await saveModule<DefectsModule>(slug, "defects", mod, mod.header.version);
    if (!res.ok) { setStatus("error"); setMsg(res.error); return; }
    setStatus("ready"); setMsg("Saved.");
  }

  if (status === "loading") return <p className="text-sm text-[#0A0A0A]/60">Loading defects...</p>;
  if (!mod) return <p className="text-sm text-red-700">{msg ?? "Failed to load"}</p>;

  return (
    <div className="space-y-4">
      <h2 className="text-sm font-semibold">Defects</h2>
      <div className="space-y-3">
        {mod.defects.map((d, i) => (
          <div key={d.id} className="rounded border border-[#0A0A0A]/10 bg-[#FBF6EC] p-3">
            <div className="flex items-baseline justify-between">
              <span className="text-xs font-mono text-[#0A0A0A]/50">{d.id}</span>
              <button onClick={() => remove(i)} className="text-xs text-red-700 underline">remove</button>
            </div>
            <div className="mt-2 grid grid-cols-2 gap-2">
              <label className="block">
                <span className="text-xs font-medium">Name</span>
                <input className={INPUT_CLASS} value={d.name} onChange={(e) => update(i, { name: e.target.value })} />
              </label>
              <label className="block">
                <span className="text-xs font-medium">Severity</span>
                <select className={INPUT_CLASS} value={d.severity} onChange={(e) => update(i, { severity: e.target.value as Defect["severity"] })}>
                  <option value="cosmetic">cosmetic</option>
                  <option value="functional">functional</option>
                  <option value="safety_critical">safety_critical</option>
                </select>
              </label>
            </div>
            <label className="mt-2 block">
              <span className="text-xs font-medium">Symptoms (comma-separated)</span>
              <input className={INPUT_CLASS} value={d.symptoms.join(", ")} onChange={(e) => update(i, { symptoms: e.target.value.split(",").map((s) => s.trim()).filter(Boolean) })} />
            </label>
            <label className="mt-2 block">
              <span className="text-xs font-medium">Vision hints (for image-based detection)</span>
              <input className={INPUT_CLASS} value={d.vision_hints.join(", ")} onChange={(e) => update(i, { vision_hints: e.target.value.split(",").map((s) => s.trim()).filter(Boolean) })} />
            </label>
          </div>
        ))}
      </div>
      <div className="flex items-center gap-2">
        <button className={BUTTON_SECONDARY} onClick={add}>+ Add defect</button>
        <button className={BUTTON_PRIMARY} onClick={save} disabled={status === "saving"}>
          {status === "saving" ? "Saving..." : "Save defects"}
        </button>
        {msg && <span className="text-xs text-[#0A0A0A]/70">{msg}</span>}
      </div>
    </div>
  );
}
