"use client";

// CostLedgerView — the deep view that shows every cost + payment for
// ONE project. Swaps the feed area on /sitebook when ?view=costs is
// present. Private to the homeowner.
//
// Layout: back link · project title · rows (trade, kind, agreed,
// paid state, method) · totals footer (agreed / paid / outstanding).
// Each row has quick actions: Mark paid · Edit · Delete.

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, Check, MoreHorizontal, Trash2, Pencil, X } from "lucide-react";
import type { CostWithPayments, PaymentMethod } from "@/lib/homeowners/costs";
import type { CostDocument } from "@/lib/homeowners/costDocuments";
import { CostDocumentUpload } from "./CostDocumentUpload";
import { CostDocumentThumbs } from "./CostDocumentThumbs";

const BRAND_GREEN = "#166534";

const KIND_LABEL: Record<string, string> = {
  labour:    "Labour",
  materials: "Materials",
  deposit:   "Deposit",
  final:     "Final payment",
  extra:     "Extra / variation",
  supplier:  "Supplier",
  other:     "Other"
};

const STATUS_STYLE: Record<string, { bg: string; fg: string; label: string }> = {
  draft:     { bg: "#F5F5F5", fg: "#525252", label: "Draft" },
  agreed:    { bg: "#FEF3C7", fg: "#92400E", label: "Due" },
  part_paid: { bg: "#DBEAFE", fg: "#1D4ED8", label: "Part-paid" },
  paid:      { bg: "#DCFCE7", fg: "#166534", label: "Paid" },
  cancelled: { bg: "#F5F5F5", fg: "#525252", label: "Cancelled" }
};

function formatGbp(pence: number): string {
  return new Intl.NumberFormat("en-GB", {
    style: "currency", currency: "GBP",
    minimumFractionDigits: 0, maximumFractionDigits: 0
  }).format(pence / 100);
}

export function CostLedgerView({
  projectId,
  projectTitle,
  costs,
  documents = [],
  hrefBase = "/sitebook",
  demoMode = false
}: {
  projectId:    string;
  projectTitle: string;
  costs:        CostWithPayments[];
  /** Every doc attached to any cost in this project. Rendered inline
   *  underneath its parent cost row + as a project-orphan pile when
   *  cost_id is null. */
  documents?:   CostDocument[];
  /** Route base for the back link — real /sitebook by default, mock
   *  overrides to /sitebook-showcase/the-old-rectory. */
  hrefBase?:    string;
  /** Disables live upload/delete for the mock preview. */
  demoMode?:    boolean;
}) {
  const router = useRouter();
  const [busyId, setBusyId] = useState<string | null>(null);

  // Bucket documents by cost — orphans (cost_id null) get shown at the top
  const docsByCost = new Map<string, CostDocument[]>();
  const orphanDocs: CostDocument[] = [];
  for (const d of documents) {
    if (!d.cost_id) { orphanDocs.push(d); continue; }
    const arr = docsByCost.get(d.cost_id) ?? [];
    arr.push(d);
    docsByCost.set(d.cost_id, arr);
  }

  const totals = costs.reduce(
    (acc, c) => {
      if (c.status === "cancelled") return acc;
      acc.agreed += c.agreed_pence;
      acc.paid   += c.paid_pence;
      return acc;
    },
    { agreed: 0, paid: 0 }
  );
  const outstanding = totals.agreed - totals.paid;

  async function markPaid(costId: string, method: PaymentMethod = "bank") {
    setBusyId(costId);
    try {
      await fetch(`/api/homeowner/costs/${costId}/payments`, {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify({ markPaid: true, method })
      });
      router.refresh();
    } finally {
      setBusyId(null);
    }
  }

  async function deleteCost(costId: string) {
    if (!confirm("Delete this cost and its payments? This can't be undone.")) return;
    setBusyId(costId);
    try {
      await fetch(`/api/homeowner/costs/${costId}`, { method: "DELETE" });
      router.refresh();
    } finally {
      setBusyId(null);
    }
  }

  return (
    <section>
      {/* Header — back link + project title */}
      <div className="mb-4 flex items-center gap-2">
        <Link
          href={hrefBase}
          className="inline-flex h-8 items-center gap-1 rounded-full border border-neutral-300 bg-white px-3 text-[10.5px] font-black uppercase tracking-wider text-neutral-700 hover:bg-neutral-50"
        >
          <ArrowLeft size={11} strokeWidth={2.5}/> Back to feed
        </Link>
      </div>

      <h1 className="text-[22px] font-black leading-tight text-neutral-900">
        {projectTitle} · cost ledger
      </h1>
      <p className="mt-1 text-[12.5px] text-neutral-600">
        Private to you. Trades never see other trades&rsquo; amounts or the running total.
      </p>

      {/* Orphan docs — uploaded from a post before a cost row existed */}
      {orphanDocs.length > 0 && (
        <div className="mt-4 rounded-2xl border-2 bg-white p-3 shadow-sm" style={{ borderColor: "rgba(0,0,0,0.08)" }}>
          <p className="text-[10.5px] font-black uppercase tracking-[0.22em] text-neutral-500">
            Documents not yet tagged to a cost
          </p>
          <CostDocumentThumbs documents={orphanDocs} demoMode={demoMode}/>
        </div>
      )}

      {/* Rows */}
      <div className="mt-5 overflow-hidden rounded-2xl border-2 bg-white shadow-sm" style={{ borderColor: "rgba(0,0,0,0.08)" }}>
        {costs.length === 0 ? (
          <div className="p-8 text-center">
            <p className="text-[14px] font-black text-neutral-900">No costs logged yet</p>
            <p className="mx-auto mt-1 max-w-md text-[12px] text-neutral-600">
              Every post card in this project has a &ldquo;Log agreed price&rdquo; button that appears once a trade has replied.
            </p>
          </div>
        ) : (
          <ul className="divide-y" style={{ borderColor: "rgba(0,0,0,0.06)" }}>
            {costs.map((c) => {
              const st  = STATUS_STYLE[c.status] ?? STATUS_STYLE.agreed;
              const due = c.agreed_pence - c.paid_pence;
              const busy = busyId === c.id;
              return (
                <li key={c.id} className="p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0 flex-1">
                      <div className="flex items-baseline gap-1.5">
                        <p className="truncate text-[13.5px] font-black text-neutral-900">
                          {c.trade_name || "Unnamed trade"}
                        </p>
                        <span
                          className="shrink-0 rounded-full px-1.5 py-0.5 text-[9.5px] font-black uppercase tracking-wider"
                          style={{ backgroundColor: st.bg, color: st.fg }}
                        >
                          {st.label}
                        </span>
                      </div>
                      <p className="mt-0.5 text-[11.5px] text-neutral-600">
                        <span className="font-bold text-neutral-800">{KIND_LABEL[c.kind] ?? c.kind}</span>
                        {c.description ? ` · ${c.description}` : ""}
                      </p>
                      <p className="mt-1 text-[12.5px] tabular-nums text-neutral-700">
                        <span className="font-black text-neutral-900">{formatGbp(c.paid_pence)}</span>
                        <span className="text-neutral-500"> paid of {formatGbp(c.agreed_pence)}</span>
                        {due > 0 && (
                          <span className="ml-1 font-black" style={{ color: "#B91C1C" }}>
                            · {formatGbp(due)} due
                          </span>
                        )}
                      </p>
                      {/* Payment history compact */}
                      {c.payments.length > 0 && (
                        <ul className="mt-2 space-y-0.5 text-[10.5px] text-neutral-500">
                          {c.payments.map((p) => (
                            <li key={p.id} className="flex items-center gap-1.5 tabular-nums">
                              <Check size={9} strokeWidth={2.5} className="text-green-700"/>
                              {formatGbp(p.amount_pence)} · {p.method} · {new Date(p.paid_at).toLocaleDateString("en-GB", { day: "2-digit", month: "short" })}
                              {p.note && <span className="text-neutral-400"> · {p.note}</span>}
                            </li>
                          ))}
                        </ul>
                      )}

                      {/* Document thumbnails + upload chip */}
                      <CostDocumentThumbs documents={docsByCost.get(c.id) ?? []} demoMode={demoMode}/>
                      <div className="mt-2">
                        <CostDocumentUpload
                          projectId={projectId}
                          costId={c.id}
                          variant="chip"
                          label={
                            (docsByCost.get(c.id)?.length ?? 0) > 0
                              ? "Attach another"
                              : "Attach quote / invoice"
                          }
                          demoMode={demoMode}
                        />
                      </div>
                    </div>

                    {/* Actions */}
                    <div className="flex shrink-0 flex-col items-end gap-1">
                      {due > 0 && (
                        <button
                          type="button"
                          onClick={() => markPaid(c.id)}
                          disabled={busy}
                          className="inline-flex h-8 items-center gap-1 rounded-full px-3 text-[10.5px] font-black uppercase tracking-wider text-white shadow-sm transition hover:brightness-95 disabled:opacity-50"
                          style={{ backgroundColor: BRAND_GREEN }}
                        >
                          <Check size={11} strokeWidth={2.5}/>
                          {busy ? "…" : "Mark paid"}
                        </button>
                      )}
                      <RowMenu
                        onDelete={() => deleteCost(c.id)}
                        disabled={busy}
                      />
                    </div>
                  </div>
                </li>
              );
            })}
          </ul>
        )}

        {/* Totals footer */}
        {costs.length > 0 && (
          <div className="border-t bg-neutral-50 p-4" style={{ borderColor: "rgba(0,0,0,0.06)" }}>
            <dl className="grid grid-cols-3 gap-3 text-center">
              <div>
                <dt className="text-[9.5px] font-black uppercase tracking-wider text-neutral-500">Agreed total</dt>
                <dd className="mt-0.5 text-[15px] font-black text-neutral-900 tabular-nums">{formatGbp(totals.agreed)}</dd>
              </div>
              <div>
                <dt className="text-[9.5px] font-black uppercase tracking-wider text-neutral-500">Paid</dt>
                <dd className="mt-0.5 text-[15px] font-black tabular-nums" style={{ color: BRAND_GREEN }}>{formatGbp(totals.paid)}</dd>
              </div>
              <div>
                <dt className="text-[9.5px] font-black uppercase tracking-wider text-neutral-500">Outstanding</dt>
                <dd
                  className="mt-0.5 text-[15px] font-black tabular-nums"
                  style={{ color: outstanding > 0 ? "#B91C1C" : BRAND_GREEN }}
                >
                  {formatGbp(outstanding)}
                </dd>
              </div>
            </dl>
          </div>
        )}
      </div>
    </section>
  );
}

function RowMenu({ onDelete, disabled }: { onDelete: () => void; disabled?: boolean }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        disabled={disabled}
        className="inline-flex h-8 w-8 items-center justify-center rounded-full text-neutral-500 hover:bg-neutral-100"
        aria-label="More"
      >
        {open ? <X size={13} strokeWidth={2.5}/> : <MoreHorizontal size={14}/>}
      </button>
      {open && (
        <div className="absolute right-0 top-full z-10 mt-1 min-w-[140px] overflow-hidden rounded-lg border bg-white shadow-lg" style={{ borderColor: "rgba(0,0,0,0.08)" }}>
          <button
            type="button"
            disabled
            className="flex w-full items-center gap-2 px-3 py-2 text-left text-[11.5px] text-neutral-400"
          >
            <Pencil size={11}/> Edit (soon)
          </button>
          <button
            type="button"
            onClick={() => { setOpen(false); onDelete(); }}
            className="flex w-full items-center gap-2 px-3 py-2 text-left text-[11.5px] font-black text-red-800 hover:bg-red-50"
          >
            <Trash2 size={11}/> Delete
          </button>
        </div>
      )}
    </div>
  );
}
