// ProjectCostCard v2 — right-rail project-cost tiles.
//
// Answers ONE question: "How much has each project cost, and who's
// owed what?" (Rule 1). Replaces pen-and-paper cost tracking
// (Rule 2). Advanced ledger view stays hidden until a project row is
// tapped (Rule 3).
//
// v2 redesign (Philip 2026-07-19): each project renders as its own
// compact card — square photo LEFT + content RIGHT (title, paid/
// agreed, status pill, progress bar). Scans faster than a stacked
// row list; the photo makes each project instantly recognisable.
//
// Photo comes from hammerex_sitebook_projects.cover_photo_url.
// Falls back to a yellow-tinted tile with a Home icon.

import Link from "next/link";
import { Home, Wallet, ChevronRight, AlertCircle, CheckCircle2, Paperclip } from "lucide-react";
import type { ProjectCostSummary } from "@/lib/homeowners/costs";

const TONE_STYLE = {
  empty:   { bar: "#E5E5E5", chipBg: "#F5F5F5", chipFg: "#525252", label: "Set price" },
  healthy: { bar: "#22C55E", chipBg: "#DCFCE7", chipFg: "#166534", label: "Paid up"   },
  watch:   { bar: "#F59E0B", chipBg: "#FEF3C7", chipFg: "#92400E", label: "Due"       },
  overdue: { bar: "#DC2626", chipBg: "#FEE2E2", chipFg: "#991B1B", label: "Overdue"   }
} as const;

function formatGbp(pence: number): string {
  return new Intl.NumberFormat("en-GB", {
    style: "currency", currency: "GBP",
    minimumFractionDigits: 0, maximumFractionDigits: 0
  }).format(pence / 100);
}

export function ProjectCostCard({
  summaries,
  hrefBase = "/sitebook"
}: {
  summaries: ProjectCostSummary[];
  /** Route base for the row links — defaults to real /sitebook. Mock
   *  overrides to /sitebook-showcase/the-old-rectory so previews
   *  navigate within the mock surface. */
  hrefBase?: string;
}) {
  return (
    <div
      className="rounded-2xl border-2 bg-white p-3 shadow-sm"
      style={{ borderColor: "rgba(0,0,0,0.08)" }}
    >
      <div className="mb-3 flex items-baseline justify-between px-1">
        <p className="text-[10.5px] font-black uppercase tracking-[0.22em] text-neutral-500">
          Project Cost
        </p>
        <span className="text-[10px] font-black uppercase tracking-wider text-neutral-500">
          {summaries.length} project{summaries.length === 1 ? "" : "s"}
        </span>
      </div>

      {summaries.length === 0 ? (
        <div className="rounded-xl bg-neutral-50 px-3 py-4 text-center">
          <span
            className="inline-flex h-8 w-8 items-center justify-center rounded-full text-neutral-500"
            style={{ backgroundColor: "rgba(0,0,0,0.04)" }}
          >
            <Wallet size={16} strokeWidth={2.4}/>
          </span>
          <p className="mt-2 text-[12.5px] font-black text-neutral-900">
            No projects yet
          </p>
          <p className="mt-0.5 text-[11px] leading-snug text-neutral-600">
            Start a project and log agreed prices from any post — we&rsquo;ll track it here.
          </p>
        </div>
      ) : (
        <ul className="space-y-2">
          {summaries.map((s) => (
            <li key={s.project_id}>
              <ProjectTile summary={s} hrefBase={hrefBase}/>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function ProjectTile({ summary: s, hrefBase }: { summary: ProjectCostSummary; hrefBase: string }) {
  const t   = TONE_STYLE[s.status];
  const pct = s.agreed_pence > 0 ? Math.min(100, Math.round((s.paid_pence / s.agreed_pence) * 100)) : 0;
  const isEmpty = s.status === "empty";

  return (
    <Link
      href={`${hrefBase}?project=${s.project_id}&view=costs`}
      className="group flex items-stretch gap-3 rounded-xl border bg-white p-2 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md"
      style={{ borderColor: "rgba(0,0,0,0.06)" }}
    >
      {/* Square image (or icon fallback) — LEFT */}
      <div
        className="relative h-16 w-16 shrink-0 overflow-hidden rounded-lg"
        style={{
          backgroundColor: s.project_image ? "transparent" : "rgba(255,179,0,0.15)"
        }}
      >
        {s.project_image ? (
          /* eslint-disable-next-line @next/next/no-img-element */
          <img
            src={s.project_image}
            alt=""
            className="h-full w-full object-cover"
            loading="lazy"
          />
        ) : (
          <div className="flex h-full w-full items-center justify-center" style={{ color: "#B45309" }}>
            <Home size={22} strokeWidth={2.2}/>
          </div>
        )}
      </div>

      {/* Content — RIGHT */}
      <div className="flex min-w-0 flex-1 flex-col justify-between py-0.5">
        <div>
          <div className="flex items-baseline justify-between gap-2">
            <p className="truncate text-[12.5px] font-black text-neutral-900">{s.project_title}</p>
            <div className="flex shrink-0 items-center gap-1">
              {s.activated && (
                <span
                  className="inline-flex items-center gap-0.5 rounded-full px-1.5 py-0.5 text-[9px] font-black uppercase tracking-wider"
                  style={{ backgroundColor: "rgba(255,179,0,0.18)", color: "#7A4E00" }}
                  title="Quote or invoice attached"
                >
                  <Paperclip size={8} strokeWidth={2.8}/>
                  Activated
                </span>
              )}
              <span
                className="inline-flex items-center gap-1 rounded-full px-1.5 py-0.5 text-[9px] font-black uppercase tracking-wider"
                style={{ backgroundColor: t.chipBg, color: t.chipFg }}
              >
                {s.status === "overdue" && <AlertCircle size={9} strokeWidth={2.6}/>}
                {s.status === "healthy" && <CheckCircle2 size={9} strokeWidth={2.6}/>}
                {t.label}
              </span>
            </div>
          </div>
          {isEmpty ? (
            <p className="mt-0.5 flex items-center gap-1 text-[10.5px] text-neutral-500">
              <ChevronRight size={10} strokeWidth={2.5}/> Add a cost from any post
            </p>
          ) : (
            <p className="mt-0.5 text-[11px] text-neutral-600 tabular-nums">
              <span className="font-black text-neutral-900">{formatGbp(s.paid_pence)}</span>
              <span className="text-neutral-500"> of {formatGbp(s.agreed_pence)}</span>
              <span className="ml-1 text-neutral-400">· {pct}%</span>
            </p>
          )}
        </div>

        {/* Progress bar — flush along the bottom for a card-feel */}
        {!isEmpty && (
          <div className="mt-1.5 h-1.5 w-full overflow-hidden rounded-full bg-neutral-100" aria-hidden>
            <div
              className="h-full transition-all"
              style={{ width: `${pct}%`, backgroundColor: t.bar }}
            />
          </div>
        )}
      </div>
    </Link>
  );
}
