// /tc/merchant-admin/quote-inbox
//
// Merchant sees every trade-initiated quote request that named them.
// One expandable card per request. Inline price entry per line item
// + delivery promise. Submit changes the reply status to 'submitted'
// and emits notebook.quote_request.quoted on the event bus.

"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { ArrowLeft, Send, Clock, MapPin, Package, Loader2, CheckCircle2 } from "lucide-react";
import { PagePersonaBadge } from "@/apps/hub/components/PagePersonaBadge";
import { HowItWorksButton } from "@/apps/hub/components/HowItWorksButton";

type InboxItem = {
  id: string;
  request_id: string;
  product_name: string;
  spec: string | null;
  image_url: string | null;
  qty: number;
  unit: string;
  unit_price_gbp: number;
  line_total_gbp: number;
};

type InboxRequest = {
  requestId: string;
  tradeId: string;
  projectId: string | null;
  deliveryAddress: string;
  deliveryTiming: string;
  requestStatus: string;
  sentAt: string;
  expiresAt: string | null;
  merchantSubtotalGbp: number;
  merchantItemCount: number;
  items: InboxItem[];
};

const TIMING_LABEL: Record<string, string> = {
  "same-day": "Same day",
  tomorrow:   "Tomorrow",
  "3-days":   "3 days",
  "5-days":   "5 days",
  "1-week":   "1 week"
};

export default function MerchantQuoteInboxPage() {
  const [requests, setRequests] = useState<InboxRequest[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const res = await fetch("/api/apps/notebook/merchant-inbox", { cache: "no-store" });
      if (!res.ok) {
        const json = await res.json().catch(() => ({}));
        throw new Error(json.error ?? String(res.status));
      }
      const json = (await res.json()) as { requests: InboxRequest[] };
      setRequests(json.requests);
    } catch (err) {
      setError(err instanceof Error ? err.message : "load_failed");
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  return (
    <div className="min-h-screen bg-[#FBF6EC]">
      <PagePersonaBadge persona="merchant" label="Quote Inbox · Merchant"/>
      <header className="mx-auto flex w-full max-w-4xl items-center justify-between px-4 py-4">
        <Link
          href="/tc/hub"
          className="inline-flex min-h-[36px] items-center gap-1 rounded-full border bg-white px-3 text-[10.5px] font-black uppercase tracking-wider text-neutral-700 shadow-sm hover:bg-neutral-50"
          style={{ borderColor: "rgba(139,69,19,0.15)" }}
        >
          <ArrowLeft size={12}/>
          Hub
        </Link>
        <div className="flex items-center gap-2">
          <div className="text-[10px] font-black uppercase tracking-[0.16em] text-neutral-500">
            TC · Merchant · Quote Inbox
          </div>
          <HowItWorksButton topic="merchant-inbox"/>
        </div>
      </header>

      <main className="mx-auto flex w-full max-w-4xl flex-col gap-4 px-4 pb-16">
        <div>
          <h1 className="text-[24px] font-black leading-tight text-neutral-900 md:text-[28px]">
            Incoming Quote Requests
          </h1>
          <p className="mt-1 text-[12.5px] leading-snug text-neutral-500">
            Trades in your area sent these to their nearest verified merchants. First to price wins.
            Zero commission on the winning quote.
          </p>
        </div>

        {error && (
          <div className="rounded-md bg-red-50 p-3 text-[11.5px] text-red-700">
            Couldn&apos;t load: {error}. {error === "not_authenticated" ? "Sign in as a merchant first." : "Try again."}
          </div>
        )}

        {requests === null && !error && (
          <div className="flex items-center gap-2 rounded-2xl border bg-white p-6 text-[12px] text-neutral-500" style={{ borderColor: "rgba(139,69,19,0.12)" }}>
            <Loader2 size={14} className="animate-spin"/>
            Loading incoming requests…
          </div>
        )}

        {requests?.length === 0 && (
          <div className="rounded-2xl border-2 border-dashed p-8 text-center" style={{ borderColor: "rgba(139,69,19,0.20)" }}>
            <Package size={26} className="mx-auto text-neutral-400"/>
            <p className="mt-3 text-[13px] font-black text-neutral-900">Nothing yet</p>
            <p className="mx-auto mt-1 max-w-md text-[11px] text-neutral-500">
              When a trade in your area sends a Quote Me request that names you, it lands here.
            </p>
          </div>
        )}

        {requests?.map((r) => (
          <QuoteRequestCard key={r.requestId} request={r} onSubmitted={load}/>
        ))}
      </main>
    </div>
  );
}

function QuoteRequestCard({
  request,
  onSubmitted
}: {
  request: InboxRequest;
  onSubmitted: () => void;
}) {
  const [prices, setPrices] = useState<Record<string, string>>({});
  const [deliveryPromise, setDeliveryPromise] = useState("Tomorrow before 11am");
  const [freeDelivery, setFreeDelivery] = useState(true);
  const [deliveryCharge, setDeliveryCharge] = useState<string>("");
  const [notes, setNotes] = useState("");
  const [saving, setSaving] = useState<null | "draft" | "submitted">(null);
  const [sent, setSent] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const totalItems = request.items.reduce((s, it) => {
    const p = Number(prices[it.id] ?? "");
    if (!Number.isFinite(p)) return s;
    return s + p * it.qty;
  }, 0);
  const grandTotal = totalItems + (freeDelivery ? 0 : Number(deliveryCharge || 0));

  async function submit(status: "draft" | "submitted") {
    setSaving(status);
    setErr(null);
    try {
      const res = await fetch(`/api/apps/notebook/merchant-inbox/${request.requestId}/reply`, {
        method:  "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          status,
          deliveryPromise,
          freeDelivery,
          deliveryChargeGbp: freeDelivery ? 0 : Number(deliveryCharge || 0),
          notes,
          items: request.items.map((it) => ({
            requestItemId: it.id,
            unitPriceGbp:  Number(prices[it.id] ?? 0),
            qty:           it.qty
          }))
        })
      });
      if (!res.ok) {
        const json = await res.json().catch(() => ({}));
        throw new Error(json.error ?? String(res.status));
      }
      if (status === "submitted") {
        setSent(true);
        onSubmitted();
      }
    } catch (e) {
      setErr(e instanceof Error ? e.message : "submit_failed");
    } finally {
      setSaving(null);
    }
  }

  if (sent) {
    return (
      <div
        className="rounded-2xl border p-5 text-center shadow-sm"
        style={{ borderColor: "rgba(22,101,52,0.35)", backgroundColor: "#F0FDF4" }}
      >
        <CheckCircle2 size={26} className="mx-auto text-[#166534]"/>
        <p className="mt-2 text-[13px] font-black text-neutral-900">Quote submitted</p>
        <p className="mx-auto mt-1 max-w-md text-[11px] text-neutral-600">
          The trade will see your price and delivery promise in their Notebook.
        </p>
      </div>
    );
  }

  return (
    <section
      className="rounded-2xl border bg-white shadow-sm"
      style={{ borderColor: "rgba(139,69,19,0.12)" }}
    >
      {/* Header */}
      <div className="flex items-start justify-between gap-3 border-b p-4" style={{ borderColor: "rgba(139,69,19,0.08)" }}>
        <div>
          <div className="text-[10px] font-black uppercase tracking-wider text-neutral-500">
            Request · {new Date(request.sentAt).toLocaleString("en-GB", { dateStyle: "medium", timeStyle: "short" })}
          </div>
          <div className="mt-1 flex flex-wrap items-center gap-2 text-[11px] text-neutral-700">
            <span className="inline-flex items-center gap-1">
              <MapPin size={11}/>
              {request.deliveryAddress}
            </span>
            <span className="text-neutral-300">·</span>
            <span className="inline-flex items-center gap-1">
              <Clock size={11}/>
              {TIMING_LABEL[request.deliveryTiming] ?? request.deliveryTiming}
            </span>
            <span className="text-neutral-300">·</span>
            <span>
              {request.merchantItemCount} item{request.merchantItemCount === 1 ? "" : "s"}
            </span>
          </div>
        </div>
        <div className="text-right">
          <div className="text-[10px] font-black uppercase tracking-wider text-neutral-500">Trade estimate</div>
          <div className="text-[15px] font-black text-neutral-900">
            £{Number(request.merchantSubtotalGbp ?? 0).toFixed(2)}
          </div>
        </div>
      </div>

      {/* Line items — merchant enters unit price */}
      <ul className="divide-y" style={{ borderColor: "rgba(139,69,19,0.06)" }}>
        {request.items.map((it) => (
          <li key={it.id} className="flex items-center gap-3 p-3">
            <div
              className="relative aspect-square h-12 w-12 flex-shrink-0 overflow-hidden rounded-lg"
              style={{ backgroundColor: "#F5F0E4" }}
            >
              {it.image_url ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={it.image_url} alt="" className="h-full w-full object-contain p-1"/>
              ) : (
                <div className="absolute inset-0 flex items-center justify-center">
                  <Package size={14} className="text-neutral-400"/>
                </div>
              )}
            </div>
            <div className="min-w-0 flex-1">
              <div className="line-clamp-1 text-[12.5px] font-black text-neutral-900">{it.product_name}</div>
              <div className="line-clamp-1 text-[10.5px] text-neutral-500">
                {it.qty} × {it.unit}
                {it.spec && <> · {it.spec}</>}
              </div>
            </div>
            <div className="flex flex-shrink-0 items-center gap-1">
              <span className="text-[11px] font-black text-neutral-500">£</span>
              <input
                type="number"
                min="0"
                step="0.01"
                inputMode="decimal"
                value={prices[it.id] ?? ""}
                onChange={(e) => setPrices((p) => ({ ...p, [it.id]: e.target.value }))}
                placeholder="0.00"
                className="w-24 rounded-md border bg-white px-2 py-1.5 text-right text-[13px] font-black text-neutral-900 outline-none placeholder:text-neutral-300"
                style={{ borderColor: "rgba(139,69,19,0.18)" }}
              />
              <span className="text-[9.5px] uppercase tracking-wider text-neutral-500">/{it.unit}</span>
            </div>
          </li>
        ))}
      </ul>

      {/* Delivery + notes */}
      <div className="grid grid-cols-1 gap-3 border-t p-4 md:grid-cols-2" style={{ borderColor: "rgba(139,69,19,0.08)" }}>
        <label className="flex flex-col gap-1">
          <span className="text-[10px] font-black uppercase tracking-wider text-neutral-600">Delivery promise</span>
          <input
            type="text"
            value={deliveryPromise}
            onChange={(e) => setDeliveryPromise(e.target.value)}
            placeholder="Tomorrow before 11am"
            className="min-h-[40px] rounded-md border bg-white px-3 text-[12.5px] text-neutral-900 outline-none placeholder:text-neutral-400"
            style={{ borderColor: "rgba(139,69,19,0.18)" }}
          />
        </label>
        <div>
          <label className="mb-1 flex items-center gap-2 text-[10px] font-black uppercase tracking-wider text-neutral-600">
            <input
              type="checkbox"
              checked={freeDelivery}
              onChange={(e) => setFreeDelivery(e.target.checked)}
            />
            Free delivery
          </label>
          {!freeDelivery && (
            <div className="flex items-center gap-1">
              <span className="text-[11px] font-black text-neutral-500">£</span>
              <input
                type="number"
                min="0"
                step="0.01"
                value={deliveryCharge}
                onChange={(e) => setDeliveryCharge(e.target.value)}
                placeholder="0.00"
                className="w-24 rounded-md border bg-white px-2 py-1.5 text-right text-[12.5px] text-neutral-900 outline-none placeholder:text-neutral-300"
                style={{ borderColor: "rgba(139,69,19,0.18)" }}
              />
            </div>
          )}
        </div>
        <label className="flex flex-col gap-1 md:col-span-2">
          <span className="text-[10px] font-black uppercase tracking-wider text-neutral-600">Notes (optional)</span>
          <textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            rows={2}
            placeholder="Substitutions, stock hold, delivery window."
            className="rounded-md border bg-white p-3 text-[12.5px] text-neutral-900 outline-none placeholder:text-neutral-400"
            style={{ borderColor: "rgba(139,69,19,0.18)" }}
          />
        </label>
      </div>

      {/* Total + submit */}
      <div className="flex items-center justify-between gap-3 border-t p-4" style={{ borderColor: "rgba(139,69,19,0.08)" }}>
        <div>
          <div className="text-[10px] font-black uppercase tracking-wider text-neutral-500">Your quote total</div>
          <div className="text-[18px] font-black text-neutral-900">£{grandTotal.toFixed(2)}</div>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => submit("draft")}
            disabled={saving !== null}
            className="inline-flex min-h-[44px] items-center gap-1 rounded-full border bg-white px-4 text-[10.5px] font-black uppercase tracking-wider text-neutral-800 shadow-sm disabled:opacity-40 hover:bg-neutral-50"
            style={{ borderColor: "rgba(139,69,19,0.18)" }}
          >
            {saving === "draft" ? "Saving…" : "Save draft"}
          </button>
          <button
            type="button"
            onClick={() => submit("submitted")}
            disabled={saving !== null || totalItems <= 0}
            className="inline-flex min-h-[44px] items-center gap-1 rounded-full px-5 text-[11px] font-black uppercase tracking-wider shadow-sm disabled:opacity-40"
            style={{ backgroundColor: "#166534", color: "#FFFFFF" }}
          >
            <Send size={12}/>
            {saving === "submitted" ? "Sending…" : "Send quote"}
          </button>
        </div>
      </div>

      {err && (
        <div className="rounded-b-2xl bg-red-50 px-4 py-2 text-[10.5px] text-red-700">
          {err}
        </div>
      )}
    </section>
  );
}
