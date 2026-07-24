"use client";

import { useEffect, useState } from "react";
import { BUTTON_PRIMARY, BUTTON_SECONDARY, INPUT_CLASS, fetchModule, newId, saveModule } from "./_helpers";

const UNITS = ["hours", "gbp_pence", "metres", "each", "square_metres", "cubic_metres"] as const;
type Unit = typeof UNITS[number];

type PricingRule = {
  id: string; rule_key: string; unit: Unit;
  applies_when: Record<string, unknown>;
  base_value: number;
  regional_multipliers: Record<string, number>;
  evidence: Array<{ source: string }>;
  confidence: "low" | "medium" | "high";
};
type PricingModule = {
  header: { version: string; authored_by: string; authored_at: string; regions: string[] };
  rules: PricingRule[];
};

export function PricingModelEditor({ slug }: { slug: string }) {
  const [mod, setMod] = useState<PricingModule | null>(null);
  const [status, setStatus] = useState<"loading" | "ready" | "saving" | "error">("loading");
  const [msg, setMsg] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      const res = await fetchModule<PricingModule>(slug, "pricing_model");
      if (!res.ok) { setStatus("error"); setMsg(res.error); return; }
      setMod(res.payload); setStatus("ready");
    })();
  }, [slug]);

  function add() {
    if (!mod) return;
    setMod({
      ...mod,
      rules: [...mod.rules, {
        id: newId("rule"), rule_key: "", unit: "hours",
        applies_when: {}, base_value: 0, regional_multipliers: {},
        evidence: [], confidence: "medium"
      }]
    });
  }
  function update(i: number, patch: Partial<PricingRule>) {
    if (!mod) return;
    const next = [...mod.rules];
    next[i] = { ...next[i], ...patch };
    setMod({ ...mod, rules: next });
  }
  function remove(i: number) {
    if (!mod) return;
    setMod({ ...mod, rules: mod.rules.filter((_, idx) => idx !== i) });
  }
  async function save() {
    if (!mod) return;
    setStatus("saving");
    const res = await saveModule<PricingModule>(slug, "pricing_model", mod, mod.header.version);
    if (!res.ok) { setStatus("error"); setMsg(res.error); return; }
    setStatus("ready"); setMsg("Saved.");
  }

  if (status === "loading") return <p className="text-sm text-[#0A0A0A]/60">Loading pricing rules...</p>;
  if (!mod) return <p className="text-sm text-red-700">{msg ?? "Failed to load"}</p>;

  return (
    <div className="space-y-4">
      <h2 className="text-sm font-semibold">Pricing Model</h2>
      <p className="text-xs text-[#0A0A0A]/60">
        Structured pricing rules only. Every rule needs a unit and a base value in that unit.
      </p>
      <div className="space-y-3">
        {mod.rules.map((r, i) => (
          <div key={r.id} className="rounded border border-[#0A0A0A]/10 bg-[#FBF6EC] p-3">
            <div className="flex items-baseline justify-between">
              <span className="text-xs font-mono text-[#0A0A0A]/50">{r.id}</span>
              <button onClick={() => remove(i)} className="text-xs text-red-700 underline">remove</button>
            </div>
            <div className="mt-2 grid grid-cols-2 gap-2">
              <label className="block">
                <span className="text-xs font-medium">Rule key</span>
                <input className={INPUT_CLASS} value={r.rule_key} onChange={(e) => update(i, { rule_key: e.target.value })} placeholder="e.g. labour.per_riser.oak" />
              </label>
              <label className="block">
                <span className="text-xs font-medium">Unit</span>
                <select className={INPUT_CLASS} value={r.unit} onChange={(e) => update(i, { unit: e.target.value as Unit })}>
                  {UNITS.map((u) => <option key={u} value={u}>{u}</option>)}
                </select>
              </label>
              <label className="block">
                <span className="text-xs font-medium">Base value (in unit)</span>
                <input type="number" className={INPUT_CLASS} value={r.base_value} onChange={(e) => update(i, { base_value: Number(e.target.value) })} />
              </label>
              <label className="block">
                <span className="text-xs font-medium">Confidence</span>
                <select className={INPUT_CLASS} value={r.confidence} onChange={(e) => update(i, { confidence: e.target.value as PricingRule["confidence"] })}>
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
        <button className={BUTTON_SECONDARY} onClick={add}>+ Add rule</button>
        <button className={BUTTON_PRIMARY} onClick={save} disabled={status === "saving"}>
          {status === "saving" ? "Saving..." : "Save pricing rules"}
        </button>
        {msg && <span className="text-xs text-[#0A0A0A]/70">{msg}</span>}
      </div>
    </div>
  );
}
