"use client";

// Client-side commission table with row checkboxes + bulk approve /
// bulk mark-paid buttons. Bulk actions POST to
// /api/admin/affiliates/commissions/bulk and the server-side route
// validates the admin cookie + applies the update atomically.
import { useMemo, useState } from "react";
import Link from "next/link";
import { CommissionRowActions } from "./CommissionRowActions";

type Row = {
  id: string;
  affiliate_id: number;
  listing_id: string;
  amount_pence: number;
  status: string;
  created_at: string;
  approved_at: string | null;
  paid_at: string | null;
  stripe_subscription_id: string | null;
  cancelled_reason: string | null;
};

function pounds(pence: number): string {
  return `£${(pence / 100).toFixed(2)}`;
}

function fmt(iso: string | null): string {
  if (!iso) return "—";
  try {
    return new Date(iso).toLocaleDateString("en-GB");
  } catch {
    return iso;
  }
}

export function CommissionsTable({ tab, rows }: { tab: string; rows: Row[] }) {
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const bulkAction =
    tab === "pending"
      ? { label: "Bulk approve", action: "approve" as const }
      : tab === "approved"
        ? { label: "Bulk mark paid", action: "mark_paid" as const }
        : null;

  const allIds = useMemo(() => rows.map((r) => r.id), [rows]);
  const allSelected = allIds.length > 0 && selected.size === allIds.length;

  function toggleOne(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }
  function toggleAll() {
    setSelected((prev) => {
      if (prev.size === allIds.length) return new Set();
      return new Set(allIds);
    });
  }

  async function bulk() {
    if (!bulkAction || selected.size === 0) return;
    if (
      !confirm(
        `${bulkAction.label} — ${selected.size} commission${
          selected.size === 1 ? "" : "s"
        }?`
      )
    ) {
      return;
    }
    setBusy(true);
    setErr(null);
    try {
      const res = await fetch("/api/admin/affiliates/commissions/bulk", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          commission_ids: Array.from(selected),
          action: bulkAction.action
        })
      });
      const body = (await res.json().catch(() => ({}))) as {
        ok?: boolean;
        updated?: number;
        error?: string;
      };
      if (!body.ok) {
        setErr(body.error || "Bulk action failed.");
        return;
      }
      window.location.reload();
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Network error.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      {bulkAction && (
        <div className="flex flex-wrap items-center gap-3 rounded-lg border border-brand-line bg-brand-surface px-3 py-2">
          <button
            type="button"
            onClick={bulk}
            disabled={busy || selected.size === 0}
            className="rounded-lg bg-brand-accent px-4 py-2 text-[13px] font-bold text-black disabled:opacity-60"
          >
            {busy ? "Working…" : `${bulkAction.label} (${selected.size})`}
          </button>
          {err && <span className="text-[13px] text-red-400">{err}</span>}
        </div>
      )}

      <div className="overflow-x-auto rounded-xl border border-brand-line bg-brand-surface">
        <table className="min-w-full text-[13px]">
          <thead className="bg-brand-bg/40 text-left text-[13px] uppercase tracking-wider text-brand-muted">
            <tr>
              <th className="px-3 py-2">
                {bulkAction ? (
                  <input
                    type="checkbox"
                    checked={allSelected}
                    onChange={toggleAll}
                    aria-label="Select all"
                  />
                ) : null}
              </th>
              <th className="px-3 py-2">Affiliate</th>
              <th className="px-3 py-2">Amount</th>
              <th className="px-3 py-2">Listing</th>
              <th className="px-3 py-2">Created</th>
              <th className="px-3 py-2">Approved</th>
              <th className="px-3 py-2">Paid</th>
              <th className="px-3 py-2">Actions</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.id} className="border-t border-brand-line">
                <td className="px-3 py-2">
                  {bulkAction ? (
                    <input
                      type="checkbox"
                      checked={selected.has(r.id)}
                      onChange={() => toggleOne(r.id)}
                      aria-label={`Select commission ${r.id}`}
                    />
                  ) : null}
                </td>
                <td className="px-3 py-2 font-mono">
                  <Link
                    href={`/admin/affiliates/${r.affiliate_id}`}
                    className="text-brand-accent hover:underline"
                  >
                    #{r.affiliate_id}
                  </Link>
                </td>
                <td className="px-3 py-2 font-bold text-brand-accent">
                  {pounds(r.amount_pence)}
                </td>
                <td className="px-3 py-2 font-mono text-[13px] text-brand-muted">
                  {r.listing_id.slice(0, 8)}
                </td>
                <td className="px-3 py-2 text-brand-muted">{fmt(r.created_at)}</td>
                <td className="px-3 py-2 text-brand-muted">{fmt(r.approved_at)}</td>
                <td className="px-3 py-2 text-brand-muted">{fmt(r.paid_at)}</td>
                <td className="px-3 py-2">
                  <CommissionRowActions id={r.id} status={r.status} />
                </td>
              </tr>
            ))}
            {rows.length === 0 && (
              <tr>
                <td
                  colSpan={8}
                  className="px-3 py-6 text-center text-brand-muted"
                >
                  Nothing in {tab}.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </>
  );
}
