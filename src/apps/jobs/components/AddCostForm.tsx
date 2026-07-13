// Quick "add cost line" panel. Lives inside the job detail page; when
// the trade adds a line the local state updates immediately so the
// margin bar re-renders in real time — the "live" feel Philip briefed.

"use client";

import { useState } from "react";
import { Plus } from "lucide-react";
import type { CostCategory, JobCostLine } from "../data/jobs";

type Props = {
  jobId: string;
  onAdd: (line: JobCostLine) => void;
};

const CATEGORIES: Array<{ key: CostCategory; label: string }> = [
  { key: "materials",     label: "Materials"     },
  { key: "labour",        label: "Labour"        },
  { key: "subcontractor", label: "Subcontractor" },
  { key: "transport",     label: "Transport"     },
  { key: "waste",         label: "Waste"         },
  { key: "hire",          label: "Plant hire"    },
  { key: "other",         label: "Other"         }
];

export function AddCostForm({ jobId, onAdd }: Props) {
  const [category, setCategory] = useState<CostCategory>("materials");
  const [description, setDescription] = useState("");
  const [total, setTotal] = useState("");

  function submit(e: React.FormEvent) {
    e.preventDefault();
    const t = parseFloat(total);
    if (!description.trim() || isNaN(t) || t <= 0) return;
    onAdd({
      id: `c-local-${Date.now()}`,
      jobId,
      category,
      description: description.trim(),
      totalGbp: t,
      incurredAtIso: new Date().toISOString()
    });
    setDescription("");
    setTotal("");
  }

  return (
    <form
      onSubmit={submit}
      className="rounded-xl border bg-white p-4 shadow-sm"
      style={{ borderColor: "rgba(139,69,19,0.15)" }}
    >
      <div className="text-[10px] font-black uppercase tracking-[0.15em] text-neutral-500">
        Add cost — live margin updates instantly
      </div>
      <div className="mt-3 flex flex-col gap-2 md:flex-row">
        <select
          value={category}
          onChange={(e) => setCategory(e.target.value as CostCategory)}
          className="min-h-[44px] rounded-md border bg-white px-3 text-[13px] md:w-40"
          style={{ borderColor: "rgba(139,69,19,0.15)" }}
        >
          {CATEGORIES.map((c) => (
            <option key={c.key} value={c.key}>{c.label}</option>
          ))}
        </select>
        <input
          type="text"
          placeholder="Description (e.g. Multi-Finish 40 bags)"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          className="min-h-[44px] flex-1 rounded-md border bg-white px-3 text-[13px]"
          style={{ borderColor: "rgba(139,69,19,0.15)" }}
        />
        <input
          type="number"
          inputMode="decimal"
          step={0.01}
          min={0}
          placeholder="£ amount"
          value={total}
          onChange={(e) => setTotal(e.target.value)}
          className="min-h-[44px] rounded-md border bg-white px-3 text-[13px] md:w-32"
          style={{ borderColor: "rgba(139,69,19,0.15)" }}
        />
        <button
          type="submit"
          className="inline-flex min-h-[44px] items-center justify-center gap-1 rounded-full px-5 text-[11.5px] font-black uppercase tracking-wider text-white shadow-sm"
          style={{ backgroundColor: "#166534" }}
        >
          <Plus size={13}/>
          Add
        </button>
      </div>
    </form>
  );
}
