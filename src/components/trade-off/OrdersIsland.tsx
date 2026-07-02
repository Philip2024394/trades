"use client";

// OrdersIsland — merchant order list + filters + mark-fulfilled + note
// editor. Server passes the full 200-row window; filtering happens
// client-side (fast, and 200 rows is well under a browser's comfort).

import { useMemo, useState } from "react";

type OrderRow = {
  id: string;
  order_ref: string;
  amount_pence: number;
  currency: string;
  provider: string;
  status: string;
  customer_email: string | null;
  customer_name: string | null;
  cart_items: unknown;
  created_at: string;
  paid_at: string | null;
  fulfilled_at: string | null;
  note: string | null;
};

type StatusFilter = "all" | "paid" | "pending" | "failed" | "cancelled";
type FulfilFilter = "all" | "unfulfilled" | "fulfilled";

function poundsFrom(pence: number): string {
  const pounds = Math.max(0, Math.round(pence)) / 100;
  return `£${pounds.toLocaleString("en-GB", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function providerLabel(p: string): string {
  if (p === "stripe") return "Stripe";
  if (p === "paypal") return "PayPal";
  if (p === "square") return "Square";
  if (p === "payment_link") return "Payment Link";
  return p;
}

function formatDate(iso: string): string {
  try {
    return new Date(iso).toLocaleDateString("en-GB", {
      day: "numeric",
      month: "short",
      hour: "2-digit",
      minute: "2-digit"
    });
  } catch {
    return iso.slice(0, 10);
  }
}

export function OrdersIsland({
  slug,
  token,
  orders: initialOrders,
  focusRef,
  stats
}: {
  slug: string;
  token: string;
  orders: OrderRow[];
  focusRef: string;
  stats: {
    total: number;
    paid: number;
    paid_total_pence: number;
    unfulfilled: number;
  };
}) {
  const [orders, setOrders] = useState<OrderRow[]>(initialOrders);
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [fulfilFilter, setFulfilFilter] = useState<FulfilFilter>("all");
  const [busy, setBusy] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);

  const filtered = useMemo(() => {
    return orders.filter((o) => {
      if (statusFilter !== "all" && o.status !== statusFilter) return false;
      if (fulfilFilter === "fulfilled" && !o.fulfilled_at) return false;
      if (fulfilFilter === "unfulfilled" && o.fulfilled_at) return false;
      return true;
    });
  }, [orders, statusFilter, fulfilFilter]);

  async function toggleFulfilled(order: OrderRow) {
    setBusy(order.id);
    try {
      const res = await fetch("/api/trade-off/orders/toggle-fulfilled", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          slug,
          token,
          order_id: order.id,
          fulfilled: !order.fulfilled_at
        })
      });
      const json = (await res.json()) as { ok?: boolean; fulfilled_at?: string | null; error?: string };
      if (!res.ok || !json.ok) {
        setToast(json.error ?? "Update failed.");
      } else {
        setOrders((rows) =>
          rows.map((r) =>
            r.id === order.id
              ? { ...r, fulfilled_at: json.fulfilled_at ?? null }
              : r
          )
        );
      }
    } catch (e) {
      setToast((e as Error).message);
    } finally {
      setBusy(null);
      window.setTimeout(() => setToast(null), 2500);
    }
  }

  async function saveNote(order: OrderRow, note: string) {
    setBusy(order.id);
    try {
      const res = await fetch("/api/trade-off/orders/set-note", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ slug, token, order_id: order.id, note })
      });
      const json = (await res.json()) as { ok?: boolean; error?: string };
      if (!res.ok || !json.ok) {
        setToast(json.error ?? "Note save failed.");
      } else {
        setOrders((rows) =>
          rows.map((r) => (r.id === order.id ? { ...r, note } : r))
        );
      }
    } catch (e) {
      setToast((e as Error).message);
    } finally {
      setBusy(null);
      window.setTimeout(() => setToast(null), 2000);
    }
  }

  const csvHref = `/api/trade-off/orders/export.csv?slug=${encodeURIComponent(slug)}&token=${encodeURIComponent(token)}`;

  return (
    <section className="mx-auto max-w-4xl space-y-6 px-4 pb-24">
      <StatsRow stats={stats} />

      <div className="flex flex-wrap items-center gap-2">
        <Filter
          label="Status"
          value={statusFilter}
          onChange={(v) => setStatusFilter(v as StatusFilter)}
          options={[
            { v: "all", label: "All" },
            { v: "paid", label: "Paid" },
            { v: "pending", label: "Pending" },
            { v: "failed", label: "Failed" },
            { v: "cancelled", label: "Cancelled" }
          ]}
        />
        <Filter
          label="Fulfilment"
          value={fulfilFilter}
          onChange={(v) => setFulfilFilter(v as FulfilFilter)}
          options={[
            { v: "all", label: "All" },
            { v: "unfulfilled", label: "Unfulfilled" },
            { v: "fulfilled", label: "Fulfilled" }
          ]}
        />
        <a
          href={csvHref}
          className="ml-auto inline-flex h-9 items-center rounded-xl border border-brand-line px-3 text-[12px] font-extrabold uppercase tracking-widest text-brand-text transition hover:border-brand-accent"
        >
          Export CSV
        </a>
      </div>

      {filtered.length === 0 && (
        <div className="rounded-2xl border border-brand-line bg-brand-surface p-8 text-center">
          <p className="text-[14px] font-bold text-brand-muted">
            No orders match these filters.
          </p>
        </div>
      )}

      <ul className="space-y-3">
        {filtered.map((order) => (
          <OrderCard
            key={order.id}
            order={order}
            focus={focusRef === order.order_ref}
            busy={busy === order.id}
            onToggleFulfilled={() => toggleFulfilled(order)}
            onSaveNote={(n) => saveNote(order, n)}
          />
        ))}
      </ul>

      {toast && (
        <p className="fixed bottom-4 left-1/2 -translate-x-1/2 rounded-lg bg-neutral-900 px-4 py-2 text-[13px] font-bold text-white shadow-lg">
          {toast}
        </p>
      )}
    </section>
  );
}

function StatsRow({
  stats
}: {
  stats: { total: number; paid: number; paid_total_pence: number; unfulfilled: number };
}) {
  const cards = [
    { label: "Orders", value: String(stats.total) },
    { label: "Paid", value: String(stats.paid) },
    { label: "Revenue", value: poundsFrom(stats.paid_total_pence) },
    { label: "Unfulfilled", value: String(stats.unfulfilled) }
  ];
  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
      {cards.map((c) => (
        <div key={c.label} className="rounded-2xl border border-brand-line bg-brand-surface p-4">
          <p className="text-[10px] font-extrabold uppercase tracking-widest text-brand-muted">
            {c.label}
          </p>
          <p className="mt-1 text-[20px] font-extrabold text-brand-text sm:text-[24px]">
            {c.value}
          </p>
        </div>
      ))}
    </div>
  );
}

function Filter({
  label,
  value,
  onChange,
  options
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  options: { v: string; label: string }[];
}) {
  return (
    <label className="inline-flex items-center gap-2 rounded-xl border border-brand-line bg-brand-surface px-3 py-1.5">
      <span className="text-[11px] font-bold uppercase tracking-widest text-brand-muted">
        {label}
      </span>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="bg-transparent text-[12px] font-extrabold text-brand-text outline-none"
      >
        {options.map((o) => (
          <option key={o.v} value={o.v}>
            {o.label}
          </option>
        ))}
      </select>
    </label>
  );
}

function OrderCard({
  order,
  focus,
  busy,
  onToggleFulfilled,
  onSaveNote
}: {
  order: OrderRow;
  focus: boolean;
  busy: boolean;
  onToggleFulfilled: () => void;
  onSaveNote: (n: string) => void;
}) {
  const [expanded, setExpanded] = useState(focus);
  const [noteDraft, setNoteDraft] = useState(order.note ?? "");
  const items = Array.isArray(order.cart_items)
    ? (order.cart_items as Array<{ name?: string; qty?: number; price_pence?: number }>)
    : [];
  const statusColor =
    order.status === "paid"
      ? "#0F7A3F"
      : order.status === "pending"
        ? "#B45309"
        : order.status === "failed" || order.status === "cancelled"
          ? "#DC2626"
          : "#525252";

  return (
    <li
      className="rounded-2xl border bg-brand-surface transition"
      style={{ borderColor: focus ? "#FFB300" : undefined }}
    >
      <button
        type="button"
        onClick={() => setExpanded((v) => !v)}
        className="flex w-full items-center gap-3 px-5 py-4 text-left"
      >
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <span
              className="inline-flex items-center rounded-full px-2 py-0.5 text-[9px] font-extrabold uppercase tracking-widest text-white"
              style={{ background: statusColor }}
            >
              ● {order.status}
            </span>
            <span className="font-mono text-[13px] font-extrabold text-brand-text">
              {order.order_ref}
            </span>
            <span className="text-[11px] font-bold text-brand-muted">
              · {providerLabel(order.provider)}
            </span>
            {order.fulfilled_at && (
              <span className="inline-flex items-center rounded-full bg-green-100 px-2 py-0.5 text-[9px] font-extrabold uppercase tracking-widest text-green-800">
                ✓ Fulfilled
              </span>
            )}
          </div>
          <p className="mt-1 text-[12px] text-brand-muted">
            {order.customer_name || order.customer_email || "Anonymous customer"}
            {" · "}
            {formatDate(order.paid_at ?? order.created_at)}
          </p>
        </div>
        <div className="shrink-0 text-right">
          <p className="text-[16px] font-extrabold text-brand-text sm:text-[18px]">
            {poundsFrom(order.amount_pence)}
          </p>
          <p className="text-[10px] uppercase tracking-widest text-brand-muted">
            {expanded ? "Hide" : "Details"}
          </p>
        </div>
      </button>

      {expanded && (
        <div className="border-t border-brand-line px-5 py-4 space-y-4">
          {items.length > 0 && (
            <div>
              <p className="text-[10px] font-extrabold uppercase tracking-widest text-brand-muted">
                Items
              </p>
              <ul className="mt-2 space-y-1 text-[13px]">
                {items.map((it, i) => {
                  const qty = Math.max(1, Math.floor(Number(it.qty) || 1));
                  const total = poundsFrom((it.price_pence ?? 0) * qty);
                  return (
                    <li key={i} className="flex items-center justify-between gap-2">
                      <span className="text-brand-text">
                        {qty} × {it.name ?? "—"}
                      </span>
                      <span className="font-mono font-bold text-brand-text">
                        {total}
                      </span>
                    </li>
                  );
                })}
              </ul>
            </div>
          )}

          {order.customer_email && (
            <div>
              <p className="text-[10px] font-extrabold uppercase tracking-widest text-brand-muted">
                Customer contact
              </p>
              <p className="mt-1 text-[13px] text-brand-text">
                {order.customer_name && (
                  <span className="font-extrabold">{order.customer_name}</span>
                )}{" "}
                &lt;
                <a
                  href={`mailto:${order.customer_email}`}
                  className="text-brand-accent underline"
                >
                  {order.customer_email}
                </a>
                &gt;
              </p>
            </div>
          )}

          <div>
            <p className="text-[10px] font-extrabold uppercase tracking-widest text-brand-muted">
              Private note
            </p>
            <textarea
              rows={2}
              value={noteDraft}
              onChange={(e) => setNoteDraft(e.target.value)}
              placeholder="e.g. Dispatched via DPD, tracking 1Z999..."
              className="mt-2 block w-full rounded-md border border-brand-line bg-brand-bg px-3 py-2 text-[13px] text-brand-text outline-none focus:border-brand-accent"
            />
            <button
              type="button"
              disabled={busy || noteDraft === (order.note ?? "")}
              onClick={() => onSaveNote(noteDraft)}
              className="mt-2 inline-flex h-9 items-center rounded-lg border border-brand-line px-3 text-[11px] font-extrabold uppercase tracking-widest text-brand-text transition hover:border-brand-accent disabled:opacity-40"
            >
              Save note
            </button>
          </div>

          {order.status === "paid" && (
            <div>
              <button
                type="button"
                onClick={onToggleFulfilled}
                disabled={busy}
                className="inline-flex h-11 items-center rounded-xl px-4 text-[12px] font-extrabold uppercase tracking-widest transition disabled:opacity-40"
                style={{
                  background: order.fulfilled_at ? "transparent" : "#0F7A3F",
                  border: order.fulfilled_at ? "1px solid #E5E5E5" : "none",
                  color: order.fulfilled_at ? "#525252" : "#FFFFFF"
                }}
              >
                {order.fulfilled_at ? "Mark unfulfilled" : "✓ Mark fulfilled"}
              </button>
            </div>
          )}
        </div>
      )}
    </li>
  );
}
