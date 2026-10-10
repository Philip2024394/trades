// §36-W-2 · WAVE-W2 · 2026-09-14 · nex-mission-priority-viewer
// NEX bounded infrastructure · MAI-authored UI shell · 2026-09-14
//
// This page is a bounded UI SHELL for the small-app demonstration.
// The data contract it displays (MissionPriorityContract) was authored by
// NEX1 via typed_data_contract. The shell itself is MAI infrastructure —
// this page cannot be authored by NEX1's current authoring primitive
// (React components are outside the closed grammar). This distinction is
// preserved by header provenance.

import {
  MISSION_PRIORITY_BOUNDS,
  MissionPriorityBand_MEMBERS,
} from "@/lib/nex-agent-runtime/mission-priority-contract/mission-priority-contract";

export const dynamic = "force-static";

const bandTone: Record<string, string> = {
  low: "text-emerald-700 bg-emerald-50 ring-emerald-200",
  medium: "text-amber-700 bg-amber-50 ring-amber-200",
  high: "text-orange-700 bg-orange-50 ring-orange-200",
  critical: "text-red-700 bg-red-50 ring-red-200",
};

export default function MissionPriorityViewerPage() {
  return (
    <main className="mx-auto max-w-3xl px-6 py-10 font-mono text-[13px] leading-6 text-slate-800">
      <header className="mb-6">
        <div className="mb-1 text-[11px] uppercase tracking-widest text-slate-500">
          §36-W-2 · NEX Mission Priority Viewer
        </div>
        <h1 className="text-xl font-semibold text-slate-900">Mission Priority Contract</h1>
        <p className="mt-2 text-[12px] text-slate-600">
          This page renders a real NEX1-authored data contract. The data contract file at
          <code className="mx-1 rounded bg-slate-100 px-1">src/lib/nex-agent-runtime/mission-priority-contract/mission-priority-contract.ts</code>
          was emitted by the <code className="mx-1 rounded bg-slate-100 px-1">authorTypedDataContract</code> primitive from a spec.
          This UI shell is MAI-authored bounded infrastructure. Provenance is explicit.
        </p>
      </header>

      <section className="mb-6 rounded border border-slate-200 bg-white p-4">
        <div className="mb-2 text-[11px] uppercase tracking-widest text-slate-500">Numeric range constant</div>
        <div className="text-[13px] text-slate-800">
          <code>MISSION_PRIORITY_BOUNDS</code> ={" "}
          <span className="text-slate-700">
            {"{ min: "}{MISSION_PRIORITY_BOUNDS.min}{", max: "}{MISSION_PRIORITY_BOUNDS.max}{" }"}
          </span>
        </div>
        <div className="mt-1 text-[11px] text-slate-500">
          Source: NEX1 emitted this constant deterministically. min/max are the closed inclusive range.
        </div>
      </section>

      <section className="mb-6 rounded border border-slate-200 bg-white p-4">
        <div className="mb-2 text-[11px] uppercase tracking-widest text-slate-500">Literal union · MissionPriorityBand</div>
        <ul className="flex flex-wrap gap-2">
          {MissionPriorityBand_MEMBERS.map((b) => (
            <li
              key={b}
              className={`rounded px-2 py-1 text-[12px] ring-1 ${bandTone[b] ?? "text-slate-700 bg-slate-50 ring-slate-200"}`}
            >
              {b}
            </li>
          ))}
        </ul>
        <div className="mt-2 text-[11px] text-slate-500">
          Locked vocabulary emitted by NEX1. Adding or removing a band requires a spec edit and a re-emission.
        </div>
      </section>

      <section className="rounded border border-slate-200 bg-white p-4">
        <div className="mb-2 text-[11px] uppercase tracking-widest text-slate-500">Provenance</div>
        <div className="text-[12px] text-slate-700">
          <div>
            <span className="text-slate-500">NEX1-authored bytes: </span>
            <code className="rounded bg-slate-100 px-1">src/lib/nex-agent-runtime/mission-priority-contract/mission-priority-contract.ts</code>
          </div>
          <div className="mt-1">
            <span className="text-slate-500">MAI infrastructure spec: </span>
            <code className="rounded bg-slate-100 px-1">src/lib/nex-agent-runtime/workstation-cockpit/mission-priority-spec.ts</code>
          </div>
          <div className="mt-1">
            <span className="text-slate-500">MAI infrastructure UI shell: </span>
            <code className="rounded bg-slate-100 px-1">src/app/nex-mission-priority-viewer/page.tsx</code>
          </div>
        </div>
      </section>
    </main>
  );
}
