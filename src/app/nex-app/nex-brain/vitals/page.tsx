// /nex-app/nex-brain/vitals — permanent NEX Brain observability strip
// (Philip 2026-08-14 · four numbers always visible).
//
// GOAL is NOT "get to 100/100". GOAL is:
//   Grow Size → Enrich → Validate → Activate new Brains.

import { redirect } from "next/navigation";
import { isAdminAuthed } from "@/lib/adminAuth";
import { computeBrainVitals, NEX_BASELINE_2026_08_14 } from "@/lib/nex/brain-metrics";

export const dynamic = "force-dynamic";
export const metadata = { title: "NEX Brain · Vitals", robots: { index: false } };

export default async function BrainVitalsPage() {
  if (!(await isAdminAuthed())) {
    redirect(`/admin/login?next=${encodeURIComponent("/nex-app/nex-brain/vitals")}`);
  }
  const v = await computeBrainVitals();

  return (
    <div className="mx-auto max-w-5xl px-4 py-8">
      <div className="mb-6">
        <div className="text-[10px] font-black uppercase tracking-[0.28em] text-orange-600">
          NEX Brain · Vitals · read-only
        </div>
        <h1 className="mt-1 text-2xl font-black leading-tight tracking-tight">
          The four numbers
        </h1>
        <p className="mt-2 max-w-2xl text-sm text-black/60">
          Permanent observability strip · locked 2026-08-14. Computed from live
          data · never fabricated. The goal is <b>Grow → Enrich → Validate →
          Activate</b>, not 100/100.
        </p>
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <MetricCard
          label="NEX Brain Size"
          value={`${v.size.score}/100`}
          delta={v.size.score - NEX_BASELINE_2026_08_14.size}
          subline={`base ${v.size.base} · +${v.size.diversity_bonus} domain-diversity (${v.size.unique_populated_domains} populated)`}
          formula={v.size.formula}
          tone="emerald"
        />
        <MetricCard
          label="NEX Brain Enrichment"
          value={`${v.enrichment.score}/100`}
          delta={v.enrichment.score - NEX_BASELINE_2026_08_14.enrichment}
          subline={`images ${v.enrichment.image_pct}% · seeds ${v.enrichment.seed_pct}% · knowledge ${v.enrichment.knowledge_pct}%`}
          formula={v.enrichment.formula}
          tone="orange"
        />
        <MetricCard
          label="Active Brains"
          value={v.active_brains.summary}
          subline={
            <>
              <div><b>Major:</b> {v.active_brains.major.join(", ") || "(none yet)"}</div>
              <div><b>Future:</b> {v.active_brains.future.join(", ") || "(none)"}</div>
              <div><b>Cross-cutting:</b> {v.active_brains.cross_cutting.join(", ") || "(none)"}</div>
            </>
          }
          formula={`MAJOR ≥ 100 rows · FUTURE 1-99 · cross-cutting (marketing_design_brain) surfaced separately`}
          tone="indigo"
        />
        <MetricCard
          label="Total Knowledge Assets"
          value={v.total_knowledge_assets.total.toLocaleString("en-GB")}
          delta={v.total_knowledge_assets.total - NEX_BASELINE_2026_08_14.total_knowledge_assets.total}
          subline={v.total_knowledge_assets.label}
          formula="images + knowledge_files + trade_records"
          tone="slate"
        />
      </div>

      <div className="mt-6 rounded-2xl border border-black/10 bg-white p-4">
        <div className="text-[10px] font-black uppercase tracking-wider text-black/60">Goal ladder (permanent)</div>
        <div className="mt-1 text-sm">
          <span className="rounded bg-emerald-100 px-2 py-0.5 font-bold text-emerald-900">Grow Size</span>{" → "}
          <span className="rounded bg-orange-100 px-2 py-0.5 font-bold text-orange-900">Enrich</span>{" → "}
          <span className="rounded bg-indigo-100 px-2 py-0.5 font-bold text-indigo-900">Validate</span>{" → "}
          <span className="rounded bg-black px-2 py-0.5 font-bold text-white">Activate new Brains</span>
        </div>
        <p className="mt-2 text-[11.5px] leading-relaxed text-black/60">
          Success is NOT 100/100 completion. Success is: every record has an
          honest state, every legitimate piece of available evidence has been
          processed, and nothing has been fabricated or silently discarded.
          Growth comes from opening new brains, not forcing every existing
          record into the current one.
        </p>
      </div>

      <div className="mt-6 rounded-2xl border border-black/10 bg-neutral-50 p-4">
        <div className="text-[10px] font-black uppercase tracking-wider text-black/60">Baseline · locked 2026-08-14</div>
        <div className="mt-2 grid grid-cols-2 gap-2 text-[11.5px] sm:grid-cols-4">
          <div><b>SIZE:</b> {NEX_BASELINE_2026_08_14.size}/100</div>
          <div><b>ENRICHMENT:</b> {NEX_BASELINE_2026_08_14.enrichment}/100</div>
          <div><b>Brains:</b> {NEX_BASELINE_2026_08_14.active_brains.major}·M / {NEX_BASELINE_2026_08_14.active_brains.future}·F / {NEX_BASELINE_2026_08_14.active_brains.cross_cutting}·X</div>
          <div><b>Assets:</b> {NEX_BASELINE_2026_08_14.total_knowledge_assets.total.toLocaleString("en-GB")}</div>
        </div>
        <p className="mt-2 text-[10.5px] leading-snug text-black/60">
          First mature Brain: <b>{NEX_BASELINE_2026_08_14.first_mature_brain}</b> · Foundation Brains for next activation: <b>{NEX_BASELINE_2026_08_14.foundation_brains_for_next_activation.join(" · ")}</b>. See doctrine at <code>{NEX_BASELINE_2026_08_14.reference_memory}</code>.
        </p>
      </div>

      <div className="mt-4 text-[10px] uppercase tracking-widest text-black/40">
        observed at {new Date(v.observed_at).toLocaleString("en-GB", { hour12: false })}
      </div>
    </div>
  );
}

function MetricCard({
  label,
  value,
  delta,
  subline,
  formula,
  tone,
}: {
  label: string;
  value: React.ReactNode;
  delta?: number;
  subline: React.ReactNode;
  formula: string;
  tone: "emerald" | "orange" | "indigo" | "slate";
}) {
  const cls =
    tone === "emerald" ? "border-emerald-200 bg-emerald-50" :
    tone === "orange"  ? "border-orange-200 bg-orange-50"   :
    tone === "indigo"  ? "border-indigo-200 bg-indigo-50"   :
                         "border-slate-200 bg-slate-50";
  const deltaLabel = typeof delta === "number"
    ? delta === 0 ? "at baseline"
    : delta > 0 ? `+${delta.toLocaleString("en-GB")} vs baseline 2026-08-14`
                : `${delta.toLocaleString("en-GB")} vs baseline 2026-08-14`
    : null;
  const deltaColor = typeof delta === "number"
    ? delta > 0 ? "text-emerald-800" : delta < 0 ? "text-rose-800" : "text-black/50"
    : "text-black/50";
  return (
    <div className={`rounded-2xl border p-5 ${cls}`}>
      <div className="text-[10px] font-black uppercase tracking-[0.24em] text-black/60">{label}</div>
      <div className="mt-2 text-3xl font-black leading-none tracking-tight text-black">{value}</div>
      {deltaLabel && <div className={`mt-1 text-[10.5px] font-semibold ${deltaColor}`}>{deltaLabel}</div>}
      <div className="mt-2 text-[11.5px] text-black/70">{subline}</div>
      <details className="mt-3">
        <summary className="cursor-pointer text-[10px] font-semibold uppercase tracking-wider text-black/50 hover:text-black/70">
          formula
        </summary>
        <div className="mt-1 font-mono text-[10.5px] leading-snug text-black/60">{formula}</div>
      </details>
    </div>
  );
}
