"use client";

// Payment orders dashboard — reconciliation surface.
//
// Table of every payment session for this brand. Filters by status +
// provider. "Refund" action fires the per-provider refund flow (real
// for Stripe, marked-only for others in v1).

import { useCallback, useEffect, useState } from "react";
import { fetchWithRetry } from "@/lib/studio/fetchWithRetry";

const YELLOW = "#FFB300";
const GREEN = "#10B981";
const AMBER = "#F59E0B";
const RED = "#DC2626";
const BLUE = "#2563EB";
const NEUTRAL = "#525252";

type Order = {
  id: string;
  providerId: string;
  externalRef: string | null;
  orderRef: string | null;
  amountMinor: number;
  currency: string;
  description: string | null;
  status: "created" | "pending" | "paid" | "failed" | "cancelled" | "refunded";
  customerEmail: string | null;
  createdAt: string;
  updatedAt: string;
  completedAt: string | null;
  metadata: Record<string, unknown>;
};

const STATUS_COLOR: Record<Order["status"], string> = {
  created: NEUTRAL,
  pending: BLUE,
  paid: GREEN,
  failed: RED,
  cancelled: NEUTRAL,
  refunded: AMBER
};

export function PaymentOrdersDashboard() {
  const [orders, setOrders] = useState<Order[] | null>(null);
  const [status, setStatus] = useState<"all" | Order["status"]>("all");
  const [provider, setProvider] = useState<string>("all");
  const [error, setError] = useState<string | null>(null);
  const [refunding, setRefunding] = useState<string | null>(null);

  const load = useCallback(async () => {
    setError(null);
    try {
      const url = new URL("/api/studio/payments/orders", window.location.origin);
      url.searchParams.set("status", status);
      url.searchParams.set("provider", provider);
      const res = await fetch(url.toString());
      const json = (await res.json()) as
        | { ok: true; orders: Order[] }
        | { ok: false; error: string };
      if (!json.ok) throw new Error(json.error);
      setOrders(json.orders);
    } catch (err) {
      setError((err as Error).message ?? "network");
    }
  }, [status, provider]);

  useEffect(() => {
    void load();
  }, [load]);

  const providers = orders
    ? Array.from(new Set(orders.map((o) => o.providerId))).sort()
    : [];

  const totalPaid = orders
    ? orders
        .filter((o) => o.status === "paid")
        .reduce((sum, o) => sum + o.amountMinor, 0)
    : 0;
  const totalCurrency = orders?.find((o) => o.status === "paid")?.currency ?? "USD";

  async function refund(order: Order) {
    if (
      !window.confirm(
        `Refund ${formatAmount(order.amountMinor, order.currency)} to ${order.customerEmail ?? "customer"}?`
      )
    ) {
      return;
    }
    setRefunding(order.id);
    try {
      const res = await fetchWithRetry(
        `/api/studio/payments/orders/${order.id}/refund`,
        { method: "POST" }
      );
      const json = (await res.json()) as {
        ok: boolean;
        providerRefundOk?: boolean;
        providerRefundError?: string;
        error?: string;
      };
      if (!json.ok) throw new Error(json.error ?? "refund-failed");
      await load();
      if (json.providerRefundError) {
        setError(
          `Order marked refunded but provider call failed: ${json.providerRefundError}`
        );
      }
    } catch (err) {
      setError((err as Error).message ?? "refund-failed");
    } finally {
      setRefunding(null);
    }
  }

  return (
    <div className="mx-auto max-w-7xl px-6 py-10 sm:py-14">
      <p
        className="text-[10px] font-extrabold uppercase tracking-widest"
        style={{ color: YELLOW }}
      >
        Payment orders
      </p>
      <h1 className="mt-2 text-3xl font-extrabold leading-tight text-neutral-900 sm:text-4xl">
        Every transaction. One reconciliation surface.
      </h1>
      <p className="mt-3 max-w-2xl text-[14px] leading-relaxed text-neutral-600">
        View every payment session, filter by status or provider, refund
        completed orders. Stripe refunds fire through their API; other
        providers are marked refunded and reconciled from your side.
      </p>

      {/* Summary bar */}
      {orders && orders.length > 0 && (
        <div className="mt-8 grid grid-cols-2 gap-4 sm:grid-cols-4">
          <SummaryCard label="Total (visible)" value={String(orders.length)} accent={NEUTRAL} />
          <SummaryCard
            label="Paid"
            value={String(orders.filter((o) => o.status === "paid").length)}
            accent={GREEN}
          />
          <SummaryCard
            label="Refunded"
            value={String(orders.filter((o) => o.status === "refunded").length)}
            accent={AMBER}
          />
          <SummaryCard
            label={`Volume (${totalCurrency})`}
            value={formatAmount(totalPaid, totalCurrency)}
            accent={YELLOW}
          />
        </div>
      )}

      {/* Filters */}
      <div className="mt-6 flex flex-wrap items-center gap-2">
        <label className="text-[10px] font-extrabold uppercase tracking-widest text-neutral-500">
          Status
        </label>
        <select
          value={status}
          onChange={(e) => setStatus(e.target.value as typeof status)}
          className="rounded-lg border border-neutral-300 bg-white px-3 py-1.5 text-[12px] font-bold outline-none focus:border-neutral-900"
        >
          <option value="all">All</option>
          <option value="paid">Paid</option>
          <option value="pending">Pending</option>
          <option value="created">Created</option>
          <option value="failed">Failed</option>
          <option value="cancelled">Cancelled</option>
          <option value="refunded">Refunded</option>
        </select>
        <label className="ml-4 text-[10px] font-extrabold uppercase tracking-widest text-neutral-500">
          Provider
        </label>
        <select
          value={provider}
          onChange={(e) => setProvider(e.target.value)}
          className="rounded-lg border border-neutral-300 bg-white px-3 py-1.5 text-[12px] font-bold outline-none focus:border-neutral-900"
        >
          <option value="all">All</option>
          {providers.map((p) => (
            <option key={p} value={p}>
              {p}
            </option>
          ))}
        </select>
      </div>

      {error && (
        <p role="alert" className="mt-6 rounded-lg bg-red-50 px-3 py-2 text-[12px] font-bold text-red-700">
          {error}
        </p>
      )}

      {/* Table */}
      {orders === null ? (
        <p className="mt-8 text-[13px] text-neutral-500">Loading…</p>
      ) : orders.length === 0 ? (
        <p className="mt-8 rounded-2xl border-2 border-dashed border-neutral-300 bg-neutral-50 p-16 text-center text-[13px] font-bold text-neutral-500">
          No orders yet — payment button clicks land here.
        </p>
      ) : (
        <div className="mt-6 overflow-x-auto rounded-2xl border border-neutral-200 bg-white">
          <table className="w-full text-left text-[12px]">
            <thead className="border-b border-neutral-200 bg-neutral-50">
              <tr>
                <Th>Date</Th>
                <Th>Provider</Th>
                <Th>Amount</Th>
                <Th>Order ref</Th>
                <Th>Customer</Th>
                <Th>Status</Th>
                <Th>Action</Th>
              </tr>
            </thead>
            <tbody>
              {orders.map((o) => (
                <tr key={o.id} className="border-b border-neutral-100 last:border-none">
                  <Td>{formatDate(o.createdAt)}</Td>
                  <Td>
                    <code className="text-[11px] text-neutral-700">
                      {o.providerId}
                    </code>
                  </Td>
                  <Td>
                    <span className="font-mono font-extrabold text-neutral-900">
                      {formatAmount(o.amountMinor, o.currency)}
                    </span>
                  </Td>
                  <Td>
                    <span className="font-mono text-[10px] text-neutral-500">
                      {o.orderRef ?? "—"}
                    </span>
                  </Td>
                  <Td>
                    <span className="text-neutral-600">
                      {o.customerEmail ?? "—"}
                    </span>
                  </Td>
                  <Td>
                    <span
                      className="rounded-full px-2 py-0.5 text-[9px] font-extrabold uppercase tracking-widest text-white"
                      style={{ background: STATUS_COLOR[o.status] }}
                    >
                      {o.status}
                    </span>
                  </Td>
                  <Td>
                    {o.status === "paid" && (
                      <button
                        type="button"
                        onClick={() => refund(o)}
                        disabled={refunding === o.id}
                        className="rounded-md px-2 py-1 text-[10px] font-extrabold uppercase tracking-widest text-white disabled:opacity-50"
                        style={{ background: AMBER }}
                      >
                        {refunding === o.id ? "Refunding…" : "Refund"}
                      </button>
                    )}
                  </Td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

function SummaryCard({
  label,
  value,
  accent
}: {
  label: string;
  value: string;
  accent: string;
}) {
  return (
    <div className="rounded-xl border border-neutral-200 bg-white p-4">
      <p
        className="text-[9px] font-extrabold uppercase tracking-widest"
        style={{ color: accent }}
      >
        {label}
      </p>
      <p className="mt-1 text-[18px] font-extrabold text-neutral-900">
        {value}
      </p>
    </div>
  );
}

function Th({ children }: { children: React.ReactNode }) {
  return (
    <th className="px-3 py-2 text-left text-[9px] font-extrabold uppercase tracking-widest text-neutral-500">
      {children}
    </th>
  );
}
function Td({ children }: { children: React.ReactNode }) {
  return <td className="px-3 py-2 align-middle">{children}</td>;
}

function formatAmount(minor: number, currency: string): string {
  const value = (minor ?? 0) / 100;
  try {
    return new Intl.NumberFormat(undefined, {
      style: "currency",
      currency: currency ?? "USD"
    }).format(value);
  } catch {
    return `${currency ?? ""} ${value.toFixed(2)}`;
  }
}
function formatDate(iso: string): string {
  try {
    return new Date(iso).toLocaleDateString(undefined, {
      day: "2-digit",
      month: "short",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit"
    });
  } catch {
    return iso;
  }
}
