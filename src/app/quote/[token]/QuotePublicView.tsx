// Public quote view — mobile-first. Homeowner opens this from WhatsApp
// or email. No auth required.

"use client";

import { useState } from "react";
import {
  CheckCircle2,
  XCircle,
  Loader2,
  MessageCircle,
  Mail,
  Building2,
  Clock,
  Sparkles
} from "lucide-react";
import { SurfaceCard } from "@/platform/ui";

type QuoteItem = {
  position: number;
  kind: string;
  label: string;
  description: string | null;
  qty: number;
  unit: string | null;
  unit_price_pence: number | null;
  total_pence: number;
};

type Quote = {
  id: string;
  title: string;
  status: string;
  materialsPence: number;
  labourPence: number;
  vatPence: number;
  discountPence: number;
  totalPence: number;
  depositPence: number | null;
  timelineEstimate: string | null;
  notes: string | null;
  expiresAt: string | null;
  acceptedAt: string | null;
  rejectedAt: string | null;
};

type Merchant = {
  id: string;
  display_name: string;
  trading_name: string | null;
  avatar_url: string | null;
  whatsapp: string | null;
  email: string;
  city: string;
  postcode_prefix: string | null;
  bio: string | null;
} | null;

function gbp(pence: number): string {
  return `£${(pence / 100).toLocaleString(undefined, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  })}`;
}

export function QuotePublicView({
  token,
  quote,
  items,
  merchant,
  project,
  render
}: {
  token: string;
  quote: Quote;
  items: QuoteItem[];
  merchant: Merchant;
  project: { title: string; leaf_slug: string | null } | null;
  render: { render_url: string | null; source_photo_url: string | null } | null;
}) {
  const [status, setStatus] = useState(quote.status);
  const [busy, setBusy] = useState<null | "accept" | "reject">(null);
  const [rejectReason, setRejectReason] = useState("");
  const [rejectOpen, setRejectOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const accepted = status === "accepted";
  const rejected = status === "rejected";
  const decided = accepted || rejected;
  const expired = quote.expiresAt
    ? new Date(quote.expiresAt).getTime() < Date.now()
    : false;

  async function accept() {
    setBusy("accept");
    setError(null);
    try {
      const res = await fetch(`/api/quote/${token}/accept`, { method: "POST" });
      const data: { ok: boolean; error?: string } = await res.json();
      if (!data.ok) {
        setError(data.error || "Could not accept the quote.");
        return;
      }
      setStatus("accepted");
    } catch {
      setError("Network error.");
    } finally {
      setBusy(null);
    }
  }

  async function reject() {
    setBusy("reject");
    setError(null);
    try {
      const res = await fetch(`/api/quote/${token}/reject`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ reason: rejectReason || undefined })
      });
      const data: { ok: boolean; error?: string } = await res.json();
      if (!data.ok) {
        setError(data.error || "Could not decline the quote.");
        return;
      }
      setStatus("rejected");
      setRejectOpen(false);
    } catch {
      setError("Network error.");
    } finally {
      setBusy(null);
    }
  }

  const waDigits = merchant?.whatsapp?.replace(/\D/g, "") || "";
  const merchantName =
    merchant?.trading_name || merchant?.display_name || "the trade";

  return (
    <div className="min-h-screen bg-neutral-50">
      <header className="border-b border-neutral-200 bg-white">
        <div className="mx-auto max-w-3xl px-4 py-4">
          <p className="text-[13px] font-semibold uppercase tracking-wide text-neutral-500">
            Quote from {merchantName}
          </p>
          <h1 className="mt-1 text-2xl font-bold leading-tight md:text-3xl">
            {quote.title}
          </h1>
        </div>
      </header>

      <main className="mx-auto max-w-3xl space-y-4 px-4 py-6">
        {/* PREVIEW */}
        {render?.render_url ? (
          <SurfaceCard variant="primary" padding="none" className="overflow-hidden">
            <img
              src={render.render_url}
              alt=""
              className="w-full object-cover"
              style={{ aspectRatio: "16/10" }}
            />
            <div className="p-4">
              <div className="flex items-center gap-2 text-[13px] font-semibold text-neutral-500">
                <Sparkles className="h-3.5 w-3.5" aria-hidden />
                Design preview
              </div>
              {project?.leaf_slug ? (
                <p className="mt-1 text-[14px] text-neutral-700">
                  {project.leaf_slug.replace(/_/g, " ")}
                </p>
              ) : null}
            </div>
          </SurfaceCard>
        ) : null}

        {/* STATUS BANNER */}
        {accepted ? (
          <SurfaceCard variant="success" padding="md">
            <div className="flex items-center gap-2 text-[13px] font-semibold">
              <CheckCircle2 className="h-4 w-4" aria-hidden />
              You've accepted this quote. {merchantName} will be in touch to book you in.
            </div>
          </SurfaceCard>
        ) : rejected ? (
          <SurfaceCard variant="secondary" padding="md">
            <div className="flex items-center gap-2 text-[13px] font-semibold text-neutral-700">
              <XCircle className="h-4 w-4" aria-hidden />
              You declined this quote.
            </div>
          </SurfaceCard>
        ) : expired ? (
          <SurfaceCard variant="warning" padding="md">
            <div className="text-[13px] font-semibold">
              This quote has expired. Ask {merchantName} for a fresh one.
            </div>
          </SurfaceCard>
        ) : null}

        {/* LINE ITEMS */}
        <SurfaceCard variant="primary" padding="md">
          <div className="text-[13px] font-semibold uppercase tracking-wide text-neutral-500">
            Included
          </div>
          <ul className="mt-3 divide-y divide-neutral-100">
            {items.length === 0 ? (
              <li className="py-2 text-[13px] text-neutral-600">
                No line items yet.
              </li>
            ) : (
              items.map((i) => (
                <li key={i.position} className="flex items-start justify-between gap-3 py-3">
                  <div>
                    <div className="text-[14px] font-semibold text-neutral-900">
                      {i.label}
                    </div>
                    {i.description ? (
                      <div className="mt-0.5 text-[13px] text-neutral-600">
                        {i.description}
                      </div>
                    ) : null}
                    <div className="mt-0.5 text-[13px] text-neutral-500">
                      {i.qty} {i.unit || ""}
                      {i.unit_price_pence != null
                        ? ` × ${gbp(i.unit_price_pence)}`
                        : ""}
                    </div>
                  </div>
                  <div className="text-[14px] font-semibold text-neutral-900">
                    {gbp(i.total_pence)}
                  </div>
                </li>
              ))
            )}
          </ul>
        </SurfaceCard>

        {/* TOTALS */}
        <SurfaceCard variant="primary" padding="md">
          <dl className="space-y-1.5 text-[14px]">
            <div className="flex justify-between text-neutral-600">
              <dt>Materials</dt>
              <dd>{gbp(quote.materialsPence)}</dd>
            </div>
            <div className="flex justify-between text-neutral-600">
              <dt>Labour</dt>
              <dd>{gbp(quote.labourPence)}</dd>
            </div>
            {quote.discountPence > 0 ? (
              <div className="flex justify-between text-neutral-600">
                <dt>Discount</dt>
                <dd>-{gbp(quote.discountPence)}</dd>
              </div>
            ) : null}
            <div className="flex justify-between text-neutral-600">
              <dt>VAT</dt>
              <dd>{gbp(quote.vatPence)}</dd>
            </div>
            <div className="mt-2 flex items-baseline justify-between border-t border-neutral-200 pt-2">
              <dt className="text-[13px] font-semibold uppercase tracking-wide text-neutral-700">
                Total (inc VAT)
              </dt>
              <dd className="text-2xl font-bold">{gbp(quote.totalPence)}</dd>
            </div>
            {quote.depositPence ? (
              <div className="flex justify-between text-[13px] text-neutral-600">
                <dt>Deposit</dt>
                <dd>{gbp(quote.depositPence)}</dd>
              </div>
            ) : null}
          </dl>
        </SurfaceCard>

        {/* TIMELINE + NOTES */}
        {quote.timelineEstimate || quote.notes ? (
          <SurfaceCard variant="primary" padding="md">
            {quote.timelineEstimate ? (
              <div className="mb-3">
                <div className="text-[13px] font-semibold uppercase tracking-wide text-neutral-500">
                  Timeline
                </div>
                <div className="mt-1 flex items-center gap-1.5 text-[14px] text-neutral-900">
                  <Clock className="h-4 w-4" aria-hidden />
                  {quote.timelineEstimate}
                </div>
              </div>
            ) : null}
            {quote.notes ? (
              <div>
                <div className="text-[13px] font-semibold uppercase tracking-wide text-neutral-500">
                  Notes
                </div>
                <p className="mt-1 whitespace-pre-wrap text-[14px] text-neutral-800">
                  {quote.notes}
                </p>
              </div>
            ) : null}
          </SurfaceCard>
        ) : null}

        {/* MERCHANT */}
        {merchant ? (
          <SurfaceCard variant="primary" padding="md">
            <div className="flex items-start gap-3">
              {merchant.avatar_url ? (
                <img
                  src={merchant.avatar_url}
                  alt=""
                  className="h-12 w-12 rounded-full object-cover"
                />
              ) : (
                <div className="flex h-12 w-12 items-center justify-center rounded-full bg-neutral-100">
                  <Building2 className="h-6 w-6 text-neutral-500" aria-hidden />
                </div>
              )}
              <div className="flex-1">
                <div className="text-[15px] font-semibold text-neutral-900">
                  {merchantName}
                </div>
                <div className="text-[13px] text-neutral-500">
                  {merchant.city}
                  {merchant.postcode_prefix ? ` · ${merchant.postcode_prefix}` : ""}
                </div>
              </div>
            </div>
            <div className="mt-3 flex flex-wrap gap-2">
              {waDigits ? (
                <a
                  href={`https://wa.me/${waDigits}`}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex min-h-[40px] items-center gap-1.5 rounded-lg bg-emerald-600 px-3 text-[13px] font-semibold text-white hover:bg-emerald-500"
                >
                  <MessageCircle className="h-3.5 w-3.5" aria-hidden />
                  Message on WhatsApp
                </a>
              ) : null}
              <a
                href={`mailto:${merchant.email}`}
                className="inline-flex min-h-[40px] items-center gap-1.5 rounded-lg border border-neutral-200 bg-white px-3 text-[13px] font-semibold text-neutral-800 hover:border-neutral-400"
              >
                <Mail className="h-3.5 w-3.5" aria-hidden />
                Email
              </a>
            </div>
          </SurfaceCard>
        ) : null}

        {/* ACCEPT / REJECT */}
        {!decided && !expired ? (
          <div className="sticky bottom-2 z-10">
            <SurfaceCard variant="dark" padding="md">
              <div className="mb-2 text-[13px] font-semibold text-white/80">
                Ready to go ahead?
              </div>
              <div className="grid grid-cols-1 gap-2 md:grid-cols-2">
                <button
                  type="button"
                  onClick={accept}
                  disabled={busy !== null}
                  className="inline-flex min-h-[48px] items-center justify-center gap-2 rounded-lg bg-emerald-500 px-4 text-[14px] font-bold text-white transition hover:bg-emerald-400 disabled:opacity-60"
                >
                  {busy === "accept" ? (
                    <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
                  ) : (
                    <CheckCircle2 className="h-4 w-4" aria-hidden />
                  )}
                  Accept quote
                </button>
                <button
                  type="button"
                  onClick={() => setRejectOpen((o) => !o)}
                  disabled={busy !== null}
                  className="inline-flex min-h-[48px] items-center justify-center gap-2 rounded-lg border border-white/20 bg-transparent px-4 text-[14px] font-semibold text-white transition hover:bg-white/10"
                >
                  Decline
                </button>
              </div>
              {rejectOpen ? (
                <div className="mt-3 space-y-2">
                  <textarea
                    value={rejectReason}
                    onChange={(e) => setRejectReason(e.target.value)}
                    placeholder="Optional — a short reason helps the trade improve future quotes."
                    rows={3}
                    className="block w-full rounded-lg border border-white/20 bg-black/30 p-2 text-[13px] text-white placeholder:text-white/50"
                  />
                  <button
                    type="button"
                    onClick={reject}
                    disabled={busy !== null}
                    className="inline-flex min-h-[40px] items-center gap-1.5 rounded-lg bg-red-500 px-3 text-[13px] font-semibold text-white hover:bg-red-400 disabled:opacity-60"
                  >
                    {busy === "reject" ? (
                      <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden />
                    ) : null}
                    Send decline
                  </button>
                </div>
              ) : null}
              {error ? (
                <p className="mt-2 text-[13px] text-red-200">{error}</p>
              ) : null}
            </SurfaceCard>
          </div>
        ) : null}

        <p className="pt-2 text-center text-[13px] text-neutral-500">
          Sent via <b>Xrated Trades</b> · Every quote lands on your property's Home Timeline.
        </p>
      </main>
    </div>
  );
}
