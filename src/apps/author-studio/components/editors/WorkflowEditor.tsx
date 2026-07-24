"use client";

import { useEffect, useState } from "react";
import { BUTTON_PRIMARY, BUTTON_SECONDARY, INPUT_CLASS, fetchModule, newId, saveModule } from "./_helpers";

type Step = { order: number; action: string; notes?: string };
type Playbook = {
  id: string; title: string; applies_to: string[];
  steps: Step[]; checkpoints: Array<{ after_step: number; verify: string }>;
  evidence: Array<{ source: string }>; confidence: "low" | "medium" | "high";
};
type WorkflowModule = {
  header: { version: string; authored_by: string; authored_at: string; regions: string[] };
  playbooks: Playbook[];
};

export function WorkflowEditor({ slug }: { slug: string }) {
  const [mod, setMod] = useState<WorkflowModule | null>(null);
  const [status, setStatus] = useState<"loading" | "ready" | "saving" | "error">("loading");
  const [msg, setMsg] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      const res = await fetchModule<WorkflowModule>(slug, "workflow");
      if (!res.ok) { setStatus("error"); setMsg(res.error); return; }
      setMod(res.payload); setStatus("ready");
    })();
  }, [slug]);

  function addPlaybook() {
    if (!mod) return;
    setMod({
      ...mod,
      playbooks: [...mod.playbooks, {
        id: newId("pb"), title: "", applies_to: [],
        steps: [{ order: 0, action: "" }], checkpoints: [], evidence: [], confidence: "medium"
      }]
    });
  }
  function updatePlaybook(i: number, patch: Partial<Playbook>) {
    if (!mod) return;
    const next = [...mod.playbooks];
    next[i] = { ...next[i], ...patch };
    setMod({ ...mod, playbooks: next });
  }
  function addStep(i: number) {
    if (!mod) return;
    const pb = mod.playbooks[i];
    updatePlaybook(i, { steps: [...pb.steps, { order: pb.steps.length, action: "" }] });
  }
  function updateStep(pbIdx: number, sIdx: number, patch: Partial<Step>) {
    if (!mod) return;
    const pb = mod.playbooks[pbIdx];
    const nextSteps = [...pb.steps];
    nextSteps[sIdx] = { ...nextSteps[sIdx], ...patch };
    updatePlaybook(pbIdx, { steps: nextSteps });
  }
  function removePlaybook(i: number) {
    if (!mod) return;
    setMod({ ...mod, playbooks: mod.playbooks.filter((_, idx) => idx !== i) });
  }
  async function save() {
    if (!mod) return;
    setStatus("saving");
    const res = await saveModule<WorkflowModule>(slug, "workflow", mod, mod.header.version);
    if (!res.ok) { setStatus("error"); setMsg(res.error); return; }
    setStatus("ready"); setMsg("Saved.");
  }

  if (status === "loading") return <p className="text-sm text-[#0A0A0A]/60">Loading workflow...</p>;
  if (!mod) return <p className="text-sm text-red-700">{msg ?? "Failed to load"}</p>;

  return (
    <div className="space-y-4">
      <h2 className="text-sm font-semibold">Workflow · playbooks</h2>
      <div className="space-y-3">
        {mod.playbooks.map((pb, i) => (
          <div key={pb.id} className="rounded border border-[#0A0A0A]/10 bg-[#FBF6EC] p-3">
            <div className="flex items-baseline justify-between">
              <span className="text-xs font-mono text-[#0A0A0A]/50">{pb.id}</span>
              <button onClick={() => removePlaybook(i)} className="text-xs text-red-700 underline">remove</button>
            </div>
            <label className="mt-2 block">
              <span className="text-xs font-medium">Title</span>
              <input className={INPUT_CLASS} value={pb.title} onChange={(e) => updatePlaybook(i, { title: e.target.value })} />
            </label>
            <div className="mt-2 space-y-2">
              {pb.steps.map((s, sIdx) => (
                <div key={sIdx} className="flex gap-2">
                  <span className="mt-1.5 text-xs text-[#0A0A0A]/50 w-6">#{s.order}</span>
                  <input className={INPUT_CLASS} value={s.action} onChange={(e) => updateStep(i, sIdx, { action: e.target.value })} placeholder="step action" />
                </div>
              ))}
              <button className={BUTTON_SECONDARY} onClick={() => addStep(i)}>+ Add step</button>
            </div>
          </div>
        ))}
      </div>
      <div className="flex items-center gap-2">
        <button className={BUTTON_SECONDARY} onClick={addPlaybook}>+ Add playbook</button>
        <button className={BUTTON_PRIMARY} onClick={save} disabled={status === "saving"}>
          {status === "saving" ? "Saving..." : "Save workflow"}
        </button>
        {msg && <span className="text-xs text-[#0A0A0A]/70">{msg}</span>}
      </div>
    </div>
  );
}
