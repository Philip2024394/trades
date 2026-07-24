"use client";

import { useEffect, useState } from "react";
import { BUTTON_PRIMARY, BUTTON_SECONDARY, INPUT_CLASS, fetchModule, newId, saveModule } from "./_helpers";

type EvidenceCite = { source: string; url?: string };
type RegRef = {
  id: string; country: string; title: string; section?: string;
  requirement: string; applies_to: string[]; evidence: EvidenceCite[];
  confidence: "low" | "medium" | "high";
};
type RegulationsModule = {
  header: { version: string; authored_by: string; authored_at: string; regions: string[] };
  regulations: RegRef[];
  rules: unknown[];
};

export function RegulationsEditor({ slug }: { slug: string }) {
  const [mod, setMod] = useState<RegulationsModule | null>(null);
  const [status, setStatus] = useState<"loading" | "ready" | "saving" | "error">("loading");
  const [msg, setMsg] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      const res = await fetchModule<RegulationsModule>(slug, "regulations");
      if (!res.ok) { setStatus("error"); setMsg(res.error); return; }
      setMod(res.payload); setStatus("ready");
    })();
  }, [slug]);

  function addReg() {
    if (!mod) return;
    setMod({
      ...mod,
      regulations: [...mod.regulations, {
        id: newId("reg"), country: "UK", title: "", requirement: "",
        applies_to: [], evidence: [{ source: "" }], confidence: "high"
      }]
    });
  }
  function updateReg(i: number, patch: Partial<RegRef>) {
    if (!mod) return;
    const next = [...mod.regulations];
    next[i] = { ...next[i], ...patch };
    setMod({ ...mod, regulations: next });
  }
  function removeReg(i: number) {
    if (!mod) return;
    setMod({ ...mod, regulations: mod.regulations.filter((_, idx) => idx !== i) });
  }
  async function save() {
    if (!mod) return;
    setStatus("saving");
    const res = await saveModule<RegulationsModule>(slug, "regulations", mod, mod.header.version);
    if (!res.ok) { setStatus("error"); setMsg(res.error); return; }
    setStatus("ready"); setMsg("Saved.");
  }

  if (status === "loading") return <p className="text-sm text-[#0A0A0A]/60">Loading regulations...</p>;
  if (!mod) return <p className="text-sm text-red-700">{msg ?? "Failed to load"}</p>;

  return (
    <div className="space-y-4">
      <h2 className="text-sm font-semibold">Regulations</h2>
      <p className="text-xs text-[#0A0A0A]/60">Each entry needs a citation and country scope.</p>
      <div className="space-y-3">
        {mod.regulations.map((r, i) => (
          <div key={r.id} className="rounded border border-[#0A0A0A]/10 bg-[#FBF6EC] p-3">
            <div className="flex items-baseline justify-between">
              <span className="text-xs font-mono text-[#0A0A0A]/50">{r.id}</span>
              <button onClick={() => removeReg(i)} className="text-xs text-red-700 underline">remove</button>
            </div>
            <div className="mt-2 grid grid-cols-2 gap-2">
              <label className="block">
                <span className="text-xs font-medium">Country</span>
                <input className={INPUT_CLASS} value={r.country} onChange={(e) => updateReg(i, { country: e.target.value })} />
              </label>
              <label className="block">
                <span className="text-xs font-medium">Title</span>
                <input className={INPUT_CLASS} value={r.title} onChange={(e) => updateReg(i, { title: e.target.value })} placeholder="e.g. Building Regulations Part K" />
              </label>
            </div>
            <label className="mt-2 block">
              <span className="text-xs font-medium">Requirement</span>
              <textarea rows={2} className={INPUT_CLASS} value={r.requirement} onChange={(e) => updateReg(i, { requirement: e.target.value })} />
            </label>
            <label className="mt-2 block">
              <span className="text-xs font-medium">Evidence source</span>
              <input className={INPUT_CLASS} value={r.evidence[0]?.source ?? ""} onChange={(e) => updateReg(i, { evidence: [{ source: e.target.value }] })} />
            </label>
          </div>
        ))}
      </div>
      <div className="flex items-center gap-2">
        <button className={BUTTON_SECONDARY} onClick={addReg}>+ Add regulation</button>
        <button className={BUTTON_PRIMARY} onClick={save} disabled={status === "saving"}>
          {status === "saving" ? "Saving..." : "Save regulations"}
        </button>
        {msg && <span className="text-xs text-[#0A0A0A]/70">{msg}</span>}
      </div>
    </div>
  );
}
