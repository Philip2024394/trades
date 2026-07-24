"use client";

import { useEffect, useState } from "react";
import { BUTTON_PRIMARY, BUTTON_SECONDARY, INPUT_CLASS, fetchModule, newId, saveModule } from "./_helpers";

type EvidenceCite = { source: string; url?: string; note?: string };
type Fact = { id: string; statement: string; evidence: EvidenceCite[]; confidence: "low" | "medium" | "high" };
type CraftModule = {
  header: { version: string; authored_by: string; authored_at: string; regions: string[] };
  facts: Fact[];
  techniques: unknown[];
  glossary: unknown[];
};

export function CraftEditor({ slug }: { slug: string }) {
  const [mod, setMod]     = useState<CraftModule | null>(null);
  const [status, setStatus] = useState<"loading" | "ready" | "saving" | "error">("loading");
  const [msg, setMsg]     = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      const res = await fetchModule<CraftModule>(slug, "craft");
      if (!res.ok) { setStatus("error"); setMsg(res.error); return; }
      setMod(res.payload);
      setStatus("ready");
    })();
  }, [slug]);

  function addFact() {
    if (!mod) return;
    setMod({
      ...mod,
      facts: [...mod.facts, { id: newId("fact"), statement: "", evidence: [{ source: "" }], confidence: "medium" }]
    });
  }

  function updateFact(idx: number, patch: Partial<Fact>) {
    if (!mod) return;
    const next = [...mod.facts];
    next[idx] = { ...next[idx], ...patch };
    setMod({ ...mod, facts: next });
  }

  function removeFact(idx: number) {
    if (!mod) return;
    setMod({ ...mod, facts: mod.facts.filter((_, i) => i !== idx) });
  }

  async function save() {
    if (!mod) return;
    setStatus("saving");
    const res = await saveModule<CraftModule>(slug, "craft", mod, mod.header.version);
    if (!res.ok) { setStatus("error"); setMsg(res.error); return; }
    setStatus("ready"); setMsg("Saved.");
  }

  if (status === "loading") return <p className="text-sm text-[#0A0A0A]/60">Loading craft module...</p>;
  if (!mod) return <p className="text-sm text-red-700">{msg ?? "Failed to load"}</p>;

  return (
    <div className="space-y-4">
      <h2 className="text-sm font-semibold">Craft · facts + glossary</h2>
      <p className="text-xs text-[#0A0A0A]/60">
        Each fact needs at least one evidence source. Confidence is your own judgement.
      </p>

      <div className="space-y-3">
        {mod.facts.map((f, i) => (
          <div key={f.id} className="rounded border border-[#0A0A0A]/10 bg-[#FBF6EC] p-3">
            <div className="flex items-baseline justify-between">
              <span className="text-xs font-mono text-[#0A0A0A]/50">{f.id}</span>
              <button onClick={() => removeFact(i)} className="text-xs text-red-700 underline">remove</button>
            </div>
            <label className="mt-2 block">
              <span className="text-xs font-medium">Statement</span>
              <textarea rows={2} className={INPUT_CLASS} value={f.statement} onChange={(e) => updateFact(i, { statement: e.target.value })} />
            </label>
            <div className="mt-2 grid grid-cols-2 gap-2">
              <label className="block">
                <span className="text-xs font-medium">Evidence source</span>
                <input className={INPUT_CLASS} value={f.evidence[0]?.source ?? ""} onChange={(e) => updateFact(i, { evidence: [{ ...(f.evidence[0] ?? {}), source: e.target.value }] })} placeholder="e.g. BS 5395-1:2010 §6.1" />
              </label>
              <label className="block">
                <span className="text-xs font-medium">Confidence</span>
                <select className={INPUT_CLASS} value={f.confidence} onChange={(e) => updateFact(i, { confidence: e.target.value as Fact["confidence"] })}>
                  <option value="low">low</option>
                  <option value="medium">medium</option>
                  <option value="high">high</option>
                </select>
              </label>
            </div>
          </div>
        ))}
      </div>

      <div className="flex items-center gap-2">
        <button className={BUTTON_SECONDARY} onClick={addFact}>+ Add fact</button>
        <button className={BUTTON_PRIMARY} onClick={save} disabled={status === "saving"}>
          {status === "saving" ? "Saving..." : "Save craft module"}
        </button>
        {msg && <span className="text-xs text-[#0A0A0A]/70">{msg}</span>}
      </div>
    </div>
  );
}
