// /tc/notebook/quote-requests/[requestId]
//
// Trade drills into a single Quote Me request and compares every
// merchant reply side-by-side. Accept accepts the winning reply +
// declines the others; decline just declines that one merchant.

"use client";

import { use, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  ArrowLeft,
  CheckCircle2,
  Clock,
  MapPin,
  Package,
  Repeat,
  ShieldCheck,
  Truck,
  XCircle,
  Ban,
  Loader2
} from "lucide-react";
import { PagePersonaBadge } from "@/apps/hub/components/PagePersonaBadge";

type RequestItem = {
  id: string;
  product_name: string;
  spec: string | null;
  image_url: string | null;
  qty: number;
  unit: string;
  merchant_slug: string;
  merchant_name: string;
  line_total_gbp: number;
  unit_price_gbp: number;
};

type ReplyLine = {
  id: string;
  request_item_id: string;
  unit_price_gbp: number;
  qty: number;
  line_total_gbp: number;
  in_stock: boolean;
  substituted_note: string | null;
};

type Reply = {
  id: string;
  merchant_slug: string;
  status: string;
  total_gbp: number;
  delivery_promise: string | null;
  delivery_date: string | null;
  free_delivery: boolean;
  delivery_charge_gbp: number;
  notes: string | null;
  submitted_at: string | null;
  accepted_at: string | null;
  declined_at: string | null;
  lines: ReplyLine[];
};

type Request = {
  id: string;
  status: string;
  sent_at: string;
  delivery_timing: string;
  delivery_address: string;
  total_gbp: number;
  merchant_slugs: string[];
};

export default function QuoteRequestDetailPage({
  params
}: {
  params: Promise<{ requestId: string }>;
}) {
  const { requestId } = use(params);
  const router = useRouter();
  const [data, setData] = useState<{
    request: Request;
    items: RequestItem[];
    replies: Reply[];
  } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busyReplyId, setBusyReplyId] = useState<string | null>(null);
  const [busyAction, setBusyAction] = useState<"resubmit" | "withdraw" | null>(null);
  const [actionMessage, setActionMessage] = useState<string | null>(null);

  async function resubmit() {
    setBusyAction("resubmit");
    setActionMessage(null);
    try {
      const res = await fetch(`/api/apps/notebook/quote-requests/${requestId}/resubmit`, { method: "POST" });
      if (!res.ok) {
        const json = await res.json().catch(() => ({}));
        throw new Error(json.error ?? String(res.status));
      }
      router.push("/tc/notebook?quoteme=1");
    } catch (err) {
      setActionMessage(err instanceof Error ? err.message : "resubmit_failed");
    } finally {
      setBusyAction(null);
    }
  }

  async function withdraw() {
    if (!confirm("Withdraw this quote request? Merchants who haven't priced it will be told to stop.")) return;
    setBusyAction("withdraw");
    setActionMessage(null);
    try {
      const res = await fetch(`/api/apps/notebook/quote-requests/${requestId}/withdraw`, { method: "POST" });
      if (!res.ok) {
        const json = await res.json().catch(() => ({}));
        throw new Error(json.error ?? String(res.status));
      }
      await load();
    } catch (err) {
      setActionMessage(err instanceof Error ? err.message : "withdraw_failed");
    } finally {
      setBusyAction(null);
    }
  }

  async function load() {
    try {
      const res = await fetch(`/api/apps/notebook/quote-requests/${requestId}`, { cache: "no-store" });
      if (!res.ok) {
        const json = await res.json().catch(() => ({}));
        throw new Error(json.error ?? String(res.status));
      }
      setData(await res.json());
    } catch (err) {
      setError(err instanceof Error ? err.message : "load_failed");
    }
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [requestId]);

  async function respondToReply(replyId: string, action: "accept" | "decline") {
    setBusyReplyId(replyId);
    try {
      const res = await fetch(`/api/apps/notebook/quote-requests/${requestId}/replies/${replyId}/${action}`, {
        method: "POST"
      });
      if (!res.ok) {
        const json = await res.json().catch(() => ({}));
        throw new Error(json.error ?? String(res.status));
      }
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "action_failed");
    } finally {
      setBusyReplyId(null);
    }
  }

  if (error) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#FBF6EC] p-6">
        <div className="rounded-2xl border bg-white p-6 text-center shadow-sm" style={{ borderColor: "rgba(139,69,19,0.15)" }}>
          <XCircle size={26} className="mx-auto text-red-500"/>
          <p className="mt-2 text-[13px] font-black text-neutral-900">Couldn&apos;t load</p>
          <p className="mt-1 text-[11.5px] text-neutral-500">{error}</p>
          <button
            type="button"
            onClick={() => router.push("/tc/notebook?section=quotes")}
            className="mt-4 inline-flex min-h-[40px] items-center gap-1 rounded-full px-4 text-[11px] font-black uppercase tracking-wider shadow-sm"
            style={{ backgroundColor: "#0A0A0A", color: "#FFB300" }}
          >
            Back to notebook
          </button>
        </div>
      </div>
    );
  }

  if (!data) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#FBF6EC]">
        <Loader2 size={20} className="animate-spin text-neutral-500"/>
      </div>
    );
  }

  const { request, items, replies } = data;
  const cheapest = replies.reduce<Reply | null>(
    (best, r) => (best === null || r.total_gbp < best.total_gbp ? r : best),
    null
  );
  const accepted = replies.find((r) => r.accepted_at);

  return (
    <div className="min-h-screen bg-[#FBF6EC]">
      <PagePersonaBadge persona="trade" label="Quote Request · Trade"/>
      <header className="mx-auto flex w-full max-w-4xl items-center justify-between px-4 py-4">
        <Link
          href="/tc/notebook?section=quotes"
          className="inline-flex min-h-[36px] items-center gap-1 rounded-full border bg-white px-3 text-[10.5px] font-black uppercase tracking-wider text-neutral-700 shadow-sm hover:bg-neutral-50"
          style={{ borderColor: "rgba(139,69,19,0.15)" }}
        >
          <ArrowLeft size={12}/>
          Notebook
        </Link>
        <div className="text-[10px] font-black uppercase tracking-[0.16em] text-neutral-500">
          TC · Quote Request
        </div>
      </header>

      <main className="mx-auto flex w-full max-w-4xl flex-col gap-5 px-4 pb-16">
        {/* Request summary */}
        <section
          className="rounded-2xl border bg-white p-5 shadow-sm"
          style={{ borderColor: "rgba(139,69,19,0.12)" }}
        >
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <div className="text-[10px] font-black uppercase tracking-wider text-neutral-500">
                Sent · {new Date(request.sent_at).toLocaleString("en-GB", { dateStyle: "medium", timeStyle: "short" })}
              </div>
              <h1 className="mt-1 text-[22px] font-black leading-tight text-neutral-900 md:text-[26px]">
                Quote request
              </h1>
              <div className="mt-1 flex flex-wrap items-center gap-2 text-[11.5px] text-neutral-600">
                <span className="inline-flex items-center gap-1">
                  <MapPin size={11}/>
                  {request.delivery_address}
                </span>
                <span className="text-neutral-300">·</span>
                <span className="inline-flex items-center gap-1">
                  <Truck size={11}/>
                  {request.delivery_timing}
                </span>
                <span className="text-neutral-300">·</span>
                <span>{items.length} items</span>
              </div>
            </div>
            <div className="text-right">
              <div className="text-[10px] font-black uppercase tracking-wider text-neutral-500">Estimate</div>
              <div className="text-[18px] font-black text-neutral-900">£{Number(request.total_gbp).toFixed(2)}</div>
              <div className="mt-1 text-[10px] uppercase tracking-wider" style={{ color: accepted ? "#166534" : "#525252" }}>
                {accepted ? "Accepted" : `${replies.length}/${request.merchant_slugs.length} merchants replied`}
              </div>
            </div>
          </div>

          {/* Actions row: Resubmit + Withdraw */}
          <div className="mt-4 flex flex-wrap items-center gap-2 border-t pt-3" style={{ borderColor: "rgba(139,69,19,0.08)" }}>
            <button
              type="button"
              onClick={resubmit}
              disabled={busyAction !== null}
              className="inline-flex min-h-[40px] items-center gap-1 rounded-full px-4 text-[11px] font-black uppercase tracking-wider shadow-sm disabled:opacity-40"
              style={{ backgroundColor: "#FFB300", color: "#0A0A0A" }}
            >
              <Repeat size={12}/>
              {busyAction === "resubmit" ? "Loading basket…" : "Reorder this quote"}
            </button>
            {request.status !== "won" && request.status !== "cancelled" && (
              <button
                type="button"
                onClick={withdraw}
                disabled={busyAction !== null}
                className="inline-flex min-h-[40px] items-center gap-1 rounded-full border bg-white px-4 text-[11px] font-black uppercase tracking-wider text-neutral-700 shadow-sm disabled:opacity-40 hover:bg-neutral-50"
                style={{ borderColor: "rgba(139,69,19,0.18)" }}
              >
                <Ban size={12}/>
                {busyAction === "withdraw" ? "Withdrawing…" : "Withdraw request"}
              </button>
            )}
            {request.status === "cancelled" && (
              <span className="text-[10.5px] font-black uppercase tracking-wider text-red-600">
                Withdrawn
              </span>
            )}
            {actionMessage && (
              <span className="text-[10.5px] text-red-700">{actionMessage}</span>
            )}
          </div>

          {/* Per-merchant breakdown — helps trades see what each merchant is quoting on */}
          {(() => {
            const bySlug = new Map<string, { count: number; total: number }>();
            for (const it of items) {
              const cur = bySlug.get(it.merchant_slug) ?? { count: 0, total: 0 };
              cur.count += 1;
              cur.total += Number(it.line_total_gbp);
              bySlug.set(it.merchant_slug, cur);
            }
            if (bySlug.size <= 1) return null;
            return (
              <div className="mt-4 border-t pt-3" style={{ borderColor: "rgba(139,69,19,0.08)" }}>
                <div className="mb-2 text-[10px] font-black uppercase tracking-wider text-neutral-500">
                  Split by merchant
                </div>
                <ul className="grid grid-cols-1 gap-1.5 md:grid-cols-2">
                  {Array.from(bySlug.entries()).map(([slug, agg]) => (
                    <li
                      key={slug}
                      className="flex items-center justify-between rounded-lg border bg-neutral-50 px-3 py-2 text-[11.5px]"
                      style={{ borderColor: "rgba(139,69,19,0.10)" }}
                    >
                      <span className="min-w-0 truncate font-bold text-neutral-800">{slug}</span>
                      <span className="text-neutral-500">{agg.count} items · <strong className="text-neutral-900">£{agg.total.toFixed(2)}</strong></span>
                    </li>
                  ))}
                </ul>
              </div>
            );
          })()}
        </section>

        {/* Replies */}
        {replies.length === 0 ? (
          <div
            className="rounded-2xl border-2 border-dashed p-8 text-center"
            style={{ borderColor: "rgba(139,69,19,0.20)" }}
          >
            <Clock size={26} className="mx-auto text-neutral-400"/>
            <p className="mt-3 text-[13px] font-black text-neutral-900">Waiting on merchant replies</p>
            <p className="mx-auto mt-1 max-w-md text-[11px] text-neutral-500">
              Verified merchants typically respond within 24 hours. You&apos;ll get a notification the moment one lands.
            </p>
          </div>
        ) : (
          <div className="flex flex-col gap-4">
            {replies.map((rep) => (
              <ReplyCard
                key={rep.id}
                reply={rep}
                items={items.filter((i) => i.merchant_slug === rep.merchant_slug)}
                isCheapest={cheapest?.id === rep.id}
                anyAccepted={Boolean(accepted)}
                busy={busyReplyId === rep.id}
                onAccept={() => respondToReply(rep.id, "accept")}
                onDecline={() => respondToReply(rep.id, "decline")}
              />
            ))}
          </div>
        )}
      </main>
    </div>
  );
}

function ReplyCard({
  reply,
  items,
  isCheapest,
  anyAccepted,
  busy,
  onAccept,
  onDecline
}: {
  reply: Reply;
  items: RequestItem[];
  isCheapest: boolean;
  anyAccepted: boolean;
  busy: boolean;
  onAccept: () => void;
  onDecline: () => void;
}) {
  const linesByRequestItem = new Map(reply.lines.map((l) => [l.request_item_id, l]));
  const accepted = Boolean(reply.accepted_at);
  const declined = Boolean(reply.declined_at);

  return (
    <section
      className="rounded-2xl border bg-white shadow-sm"
      style={{
        borderColor: accepted ? "rgba(22,101,52,0.35)" : declined ? "rgba(220,38,38,0.20)" : "rgba(139,69,19,0.12)"
      }}
    >
      <div className="flex flex-wrap items-start justify-between gap-3 border-b p-4" style={{ borderColor: "rgba(139,69,19,0.08)" }}>
        <div>
          <div className="text-[13px] font-black leading-tight text-neutral-900">{reply.merchant_slug}</div>
          <div className="mt-0.5 flex flex-wrap items-center gap-2 text-[10.5px] text-neutral-500">
            {reply.submitted_at && (
              <span className="inline-flex items-center gap-1">
                <Clock size={10}/>
                {new Date(reply.submitted_at).toLocaleString("en-GB", { dateStyle: "medium", timeStyle: "short" })}
              </span>
            )}
            {reply.delivery_promise && (
              <>
                <span className="text-neutral-300">·</span>
                <span className="inline-flex items-center gap-1 font-bold text-neutral-700">
                  <Truck size={10}/>
                  {reply.delivery_promise}
                </span>
              </>
            )}
            {reply.free_delivery ? (
              <span
                className="rounded-full px-1.5 py-0.5 text-[9px] font-black uppercase tracking-wider"
                style={{ backgroundColor: "#166534", color: "#FFFFFF" }}
              >
                Free delivery
              </span>
            ) : (
              <>
                <span className="text-neutral-300">·</span>
                <span>Delivery £{Number(reply.delivery_charge_gbp).toFixed(2)}</span>
              </>
            )}
          </div>
        </div>
        <div className="text-right">
          <div className="text-[10px] font-black uppercase tracking-wider text-neutral-500">Their quote</div>
          <div className="text-[18px] font-black text-neutral-900">£{Number(reply.total_gbp).toFixed(2)}</div>
          {isCheapest && !accepted && !declined && (
            <div
              className="mt-1 inline-flex items-center gap-1 rounded-full px-1.5 py-0.5 text-[9px] font-black uppercase tracking-wider"
              style={{ backgroundColor: "#166534", color: "#FFFFFF" }}
            >
              <ShieldCheck size={9}/>
              Cheapest
            </div>
          )}
          {accepted && (
            <div className="mt-1 inline-flex items-center gap-1 text-[10px] font-black uppercase tracking-wider" style={{ color: "#166534" }}>
              <CheckCircle2 size={11}/>
              Accepted
            </div>
          )}
          {declined && (
            <div className="mt-1 inline-flex items-center gap-1 text-[10px] font-black uppercase tracking-wider text-red-600">
              <XCircle size={11}/>
              Declined
            </div>
          )}
        </div>
      </div>

      {/* Items */}
      <ul className="divide-y" style={{ borderColor: "rgba(139,69,19,0.06)" }}>
        {items.map((it) => {
          const line = linesByRequestItem.get(it.id);
          return (
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
                  {line?.substituted_note && (
                    <>
                      {" · "}
                      <span className="italic text-amber-700">{line.substituted_note}</span>
                    </>
                  )}
                </div>
              </div>
              <div className="text-right">
                {line ? (
                  <>
                    <div className="text-[13px] font-black text-neutral-900">£{Number(line.line_total_gbp).toFixed(2)}</div>
                    <div className="text-[10px] text-neutral-500">£{Number(line.unit_price_gbp).toFixed(2)}/{it.unit}</div>
                    {!line.in_stock && <div className="text-[10px] font-black uppercase tracking-wider text-amber-700">out of stock</div>}
                  </>
                ) : (
                  <div className="text-[10.5px] text-neutral-400">no line</div>
                )}
              </div>
            </li>
          );
        })}
      </ul>

      {reply.notes && (
        <div className="border-t p-3 text-[11px] leading-snug text-neutral-600" style={{ borderColor: "rgba(139,69,19,0.06)" }}>
          <strong className="text-neutral-800">Merchant note:</strong> {reply.notes}
        </div>
      )}

      {!accepted && !declined && (
        <div className="flex items-center justify-end gap-2 border-t p-3" style={{ borderColor: "rgba(139,69,19,0.06)" }}>
          <button
            type="button"
            onClick={onDecline}
            disabled={busy}
            className="inline-flex min-h-[40px] items-center gap-1 rounded-full border bg-white px-4 text-[10.5px] font-black uppercase tracking-wider text-neutral-700 shadow-sm disabled:opacity-40 hover:bg-neutral-50"
            style={{ borderColor: "rgba(139,69,19,0.18)" }}
          >
            Decline
          </button>
          <button
            type="button"
            onClick={onAccept}
            disabled={busy || anyAccepted}
            className="inline-flex min-h-[40px] items-center gap-1 rounded-full px-5 text-[10.5px] font-black uppercase tracking-wider shadow-sm disabled:opacity-40"
            style={{ backgroundColor: "#166534", color: "#FFFFFF" }}
          >
            <CheckCircle2 size={12}/>
            {busy ? "Working…" : "Accept quote"}
          </button>
        </div>
      )}
    </section>
  );
}
