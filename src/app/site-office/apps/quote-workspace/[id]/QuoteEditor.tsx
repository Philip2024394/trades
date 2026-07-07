// Quote editor — mobile-first line-item table + totals + send controls.

"use client";

import { useState } from "react";
import Link from "next/link";
import {
  ArrowLeft,
  Plus,
  Trash2,
  Send,
  Loader2,
  ExternalLink,
  Save,
  MessageCircle,
  Mail
} from "lucide-react";
import { SurfaceCard } from "@/platform/ui";

type Item = {
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
  shareToken: string;
  notes: string | null;
  timelineEstimate: string | null;
  depositPence: number | null;
  materialsPence: number;
  labourPence: number;
  discountPence: number;
  vatPence: number;
  totalPence: number;
  expiresAt: string | null;
  sentChannel: string | null;
};

type Homeowner = {
  full_name: string;
  email: string;
  whatsapp_e164: string;
  postcode: string;
} | null;

function gbp(pence: number): string {
  return `£${(pence / 100).toFixed(2)}`;
}

function penceFromInput(v: string): number | null {
  const num = parseFloat(v);
  if (!Number.isFinite(num)) return null;
  return Math.round(num * 100);
}

export function QuoteEditor({
  quote,
  items: initialItems,
  project,
  homeowner,
  render
}: {
  quote: Quote;
  items: Item[];
  project: { title: string; leaf_slug: string | null } | null;
  homeowner: Homeowner;
  render: { render_url: string | null; source_photo_url: string | null } | null;
}) {
  const [items, setItems] = useState<Item[]>(initialItems);
  const [title, setTitle] = useState(quote.title);
  const [notes, setNotes] = useState(quote.notes || "");
  const [timelineEstimate, setTimelineEstimate] = useState(
    quote.timelineEstimate || ""
  );
  const [savingItems, setSavingItems] = useState(false);
  const [savingHeader, setSavingHeader] = useState(false);
  const [sending, setSending] = useState<null | "whatsapp" | "email">(null);
  const [status, setStatus] = useState(quote.status);
  const [error, setError] = useState<string | null>(null);
  const [waUrl, setWaUrl] = useState<string | null>(null);

  const isDraft = status === "draft";
  const totals = calcTotals(items);

  function updateItem(idx: number, patch: Partial<Item>) {
    setItems((current) => {
      const next = current.slice();
      const merged = { ...next[idx], ...patch };
      // Recompute total for this row
      merged.total_pence =
        merged.unit_price_pence != null
          ? Math.round(merged.unit_price_pence * merged.qty)
          : 0;
      next[idx] = merged;
      return next;
    });
  }

  function addItem(kind: Item["kind"]) {
    setItems((current) => [
      ...current,
      {
        position: current.length + 1,
        kind,
        label: kind === "labour" ? "Labour" : "New item",
        description: null,
        qty: 1,
        unit: kind === "labour" ? "days" : "each",
        unit_price_pence: null,
        total_pence: 0
      }
    ]);
  }

  function removeItem(idx: number) {
    setItems((current) => current.filter((_, i) => i !== idx));
  }

  async function saveItems() {
    setSavingItems(true);
    setError(null);
    try {
      const res = await fetch(`/api/apps/quote-workspace/${quote.id}/items`, {
        method: "PUT",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          items: items.map((i) => ({
            position: i.position,
            kind: i.kind,
            label: i.label,
            description: i.description,
            qty: i.qty,
            unit: i.unit,
            unitPricePence: i.unit_price_pence
          }))
        })
      });
      const data: { ok: boolean; error?: string } = await res.json();
      if (!data.ok) setError(data.error || "Save failed.");
    } finally {
      setSavingItems(false);
    }
  }

  async function saveHeader() {
    setSavingHeader(true);
    setError(null);
    try {
      const res = await fetch(`/api/apps/quote-workspace/${quote.id}`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          title,
          notes,
          timelineEstimate
        })
      });
      const data: { ok: boolean; error?: string } = await res.json();
      if (!data.ok) setError(data.error || "Save failed.");
    } finally {
      setSavingHeader(false);
    }
  }

  async function send(channel: "whatsapp" | "email") {
    setSending(channel);
    setError(null);
    setWaUrl(null);
    try {
      // Save items + header first so what we send is what's on screen
      await saveItems();
      await saveHeader();
      const res = await fetch(`/api/apps/quote-workspace/${quote.id}/send`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ channel })
      });
      const data: {
        ok: boolean;
        error?: string;
        channel?: string;
        wa_url?: string;
      } = await res.json();
      if (!data.ok) {
        setError(data.error || "Send failed.");
        return;
      }
      setStatus("sent");
      if (data.wa_url) {
        setWaUrl(data.wa_url);
      }
    } finally {
      setSending(null);
    }
  }

  const publicUrl =
    typeof window !== "undefined"
      ? `${window.location.origin}/quote/${quote.shareToken}`
      : `/quote/${quote.shareToken}`;

  return (
    <>
      <div className="mb-4">
        <Link
          href="/site-office/apps/quote-workspace"
          className="inline-flex items-center gap-1 text-[13px] font-semibold text-neutral-600 hover:text-neutral-900"
        >
          <ArrowLeft className="h-3.5 w-3.5" aria-hidden />
          Back to pipeline
        </Link>
      </div>

      <header className="mb-4">
        <p className="text-[13px] font-semibold uppercase tracking-wide text-neutral-500">
          Quote · <span className="capitalize">{status}</span>
        </p>
        {isDraft ? (
          <input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            className="mt-1 block w-full border-0 border-b border-transparent bg-transparent px-0 py-1 text-2xl font-bold outline-none focus:border-neutral-300 md:text-3xl"
          />
        ) : (
          <h1 className="mt-1 text-2xl font-bold md:text-3xl">{quote.title}</h1>
        )}
        {project ? (
          <p className="mt-1 text-[13px] text-neutral-600">
            {project.title} {project.leaf_slug ? `· ${project.leaf_slug.replace(/_/g, " ")}` : ""}
          </p>
        ) : null}
      </header>

      {render?.render_url ? (
        <SurfaceCard variant="primary" padding="none" className="mb-4 overflow-hidden">
          <img
            src={render.render_url}
            alt=""
            className="w-full object-cover"
            style={{ aspectRatio: "16/9" }}
          />
        </SurfaceCard>
      ) : null}

      {homeowner ? (
        <SurfaceCard variant="secondary" padding="md" className="mb-4">
          <div className="text-[13px] font-semibold uppercase tracking-wide text-neutral-500">
            For
          </div>
          <div className="mt-1 text-[14px] font-semibold text-neutral-900">
            {homeowner.full_name} · {homeowner.postcode}
          </div>
          <div className="text-[13px] text-neutral-600">
            {homeowner.email} · {homeowner.whatsapp_e164}
          </div>
        </SurfaceCard>
      ) : null}

      {/* LINE ITEMS */}
      <SurfaceCard variant="primary" padding="md" className="mb-4">
        <div className="mb-3 flex items-baseline justify-between">
          <div className="text-[13px] font-semibold uppercase tracking-wide text-neutral-500">
            Line items
          </div>
          {isDraft ? (
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => addItem("material")}
                className="inline-flex min-h-[36px] items-center gap-1 rounded-lg border border-neutral-200 bg-white px-2.5 text-[13px] font-semibold text-neutral-800 hover:border-neutral-400"
              >
                <Plus className="h-3.5 w-3.5" aria-hidden />
                Material
              </button>
              <button
                type="button"
                onClick={() => addItem("labour")}
                className="inline-flex min-h-[36px] items-center gap-1 rounded-lg border border-neutral-200 bg-white px-2.5 text-[13px] font-semibold text-neutral-800 hover:border-neutral-400"
              >
                <Plus className="h-3.5 w-3.5" aria-hidden />
                Labour
              </button>
            </div>
          ) : null}
        </div>
        <ul className="divide-y divide-neutral-100">
          {items.map((i, idx) => (
            <li key={idx} className="grid grid-cols-12 gap-2 py-2">
              {isDraft ? (
                <>
                  <input
                    className="col-span-6 min-h-[36px] rounded border border-neutral-200 px-2 text-[13px]"
                    value={i.label}
                    onChange={(e) => updateItem(idx, { label: e.target.value })}
                    placeholder="Label"
                  />
                  <input
                    className="col-span-2 min-h-[36px] rounded border border-neutral-200 px-2 text-right text-[13px]"
                    value={i.qty}
                    onChange={(e) => updateItem(idx, { qty: parseFloat(e.target.value) || 0 })}
                    inputMode="decimal"
                  />
                  <input
                    className="col-span-3 min-h-[36px] rounded border border-neutral-200 px-2 text-right text-[13px]"
                    value={i.unit_price_pence != null ? (i.unit_price_pence / 100).toString() : ""}
                    onChange={(e) => updateItem(idx, { unit_price_pence: penceFromInput(e.target.value) })}
                    placeholder="0.00"
                    inputMode="decimal"
                  />
                  <button
                    type="button"
                    onClick={() => removeItem(idx)}
                    aria-label="Remove line"
                    className="col-span-1 flex items-center justify-center text-neutral-400 hover:text-red-600"
                  >
                    <Trash2 className="h-4 w-4" aria-hidden />
                  </button>
                </>
              ) : (
                <>
                  <div className="col-span-8">
                    <div className="text-[13px] font-semibold text-neutral-900">
                      {i.label}
                    </div>
                    <div className="text-[13px] text-neutral-500">
                      {i.qty} {i.unit || ""}
                      {i.unit_price_pence != null
                        ? ` × ${gbp(i.unit_price_pence)}`
                        : ""}
                    </div>
                  </div>
                  <div className="col-span-4 text-right text-[14px] font-semibold">
                    {gbp(i.total_pence)}
                  </div>
                </>
              )}
            </li>
          ))}
        </ul>
      </SurfaceCard>

      {/* HEADER TEXT */}
      <SurfaceCard variant="primary" padding="md" className="mb-4">
        <label className="block text-[13px] font-semibold uppercase tracking-wide text-neutral-500">
          Timeline estimate
        </label>
        <input
          value={timelineEstimate}
          onChange={(e) => setTimelineEstimate(e.target.value)}
          placeholder="e.g. 2 weeks, starting Feb"
          className="mt-1 block min-h-[40px] w-full rounded-lg border border-neutral-200 bg-white px-3 text-[14px] outline-none focus:border-neutral-900"
        />
        <label className="mt-4 block text-[13px] font-semibold uppercase tracking-wide text-neutral-500">
          Notes / cover copy
        </label>
        <textarea
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          rows={4}
          placeholder="Anything you want the customer to know."
          className="mt-1 block w-full rounded-lg border border-neutral-200 bg-white px-3 py-2 text-[14px] outline-none focus:border-neutral-900"
        />
      </SurfaceCard>

      {/* TOTALS */}
      <SurfaceCard variant="highlight" padding="md" className="mb-4">
        <dl className="space-y-1 text-[14px]">
          <div className="flex justify-between text-neutral-700">
            <dt>Materials</dt>
            <dd>{gbp(totals.materialsPence)}</dd>
          </div>
          <div className="flex justify-between text-neutral-700">
            <dt>Labour</dt>
            <dd>{gbp(totals.labourPence)}</dd>
          </div>
          <div className="flex justify-between text-neutral-700">
            <dt>VAT (20%)</dt>
            <dd>{gbp(totals.vatPence)}</dd>
          </div>
          <div className="mt-2 flex items-baseline justify-between border-t border-amber-200 pt-2">
            <dt className="text-[13px] font-semibold uppercase tracking-wide">
              Total (inc VAT)
            </dt>
            <dd className="text-2xl font-bold">{gbp(totals.totalPence)}</dd>
          </div>
        </dl>
      </SurfaceCard>

      {error ? (
        <p className="mb-3 text-[13px] text-red-600">{error}</p>
      ) : null}

      {waUrl ? (
        <SurfaceCard variant="success" padding="md" className="mb-4">
          <div className="text-[13px] font-semibold">Ready to send on WhatsApp</div>
          <p className="mt-1 text-[13px]">
            Tap below to open WhatsApp with the message pre-filled.
          </p>
          <a
            href={waUrl}
            target="_blank"
            rel="noreferrer"
            className="mt-2 inline-flex min-h-[40px] items-center gap-1.5 rounded-lg bg-emerald-600 px-3 text-[13px] font-semibold text-white hover:bg-emerald-500"
          >
            <ExternalLink className="h-3.5 w-3.5" aria-hidden />
            Open WhatsApp
          </a>
        </SurfaceCard>
      ) : null}

      {/* ACTIONS */}
      <div className="grid grid-cols-1 gap-2 md:grid-cols-3">
        {isDraft ? (
          <>
            <button
              type="button"
              onClick={saveItems}
              disabled={savingItems}
              className="inline-flex min-h-[48px] items-center justify-center gap-2 rounded-lg border border-neutral-200 bg-white px-4 text-[14px] font-semibold text-neutral-900 hover:border-neutral-400 disabled:opacity-60"
            >
              {savingItems ? (
                <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
              ) : (
                <Save className="h-4 w-4" aria-hidden />
              )}
              Save draft
            </button>
            <button
              type="button"
              onClick={() => send("whatsapp")}
              disabled={sending !== null || !homeowner?.whatsapp_e164}
              className="inline-flex min-h-[48px] items-center justify-center gap-2 rounded-lg bg-emerald-600 px-4 text-[14px] font-semibold text-white hover:bg-emerald-500 disabled:opacity-60"
            >
              {sending === "whatsapp" ? (
                <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
              ) : (
                <MessageCircle className="h-4 w-4" aria-hidden />
              )}
              Send WhatsApp
            </button>
            <button
              type="button"
              onClick={() => send("email")}
              disabled={sending !== null || !homeowner?.email}
              className="inline-flex min-h-[48px] items-center justify-center gap-2 rounded-lg bg-neutral-900 px-4 text-[14px] font-semibold text-white hover:bg-neutral-800 disabled:opacity-60"
            >
              {sending === "email" ? (
                <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
              ) : (
                <Send className="h-4 w-4" aria-hidden />
              )}
              Email quote
            </button>
          </>
        ) : (
          <>
            <button
              type="button"
              onClick={saveHeader}
              disabled={savingHeader}
              className="inline-flex min-h-[48px] items-center justify-center gap-2 rounded-lg border border-neutral-200 bg-white px-4 text-[14px] font-semibold text-neutral-900 hover:border-neutral-400 disabled:opacity-60"
            >
              {savingHeader ? (
                <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
              ) : (
                <Save className="h-4 w-4" aria-hidden />
              )}
              Save notes
            </button>
            <a
              href={publicUrl}
              target="_blank"
              rel="noreferrer"
              className="inline-flex min-h-[48px] items-center justify-center gap-2 rounded-lg bg-neutral-900 px-4 text-[14px] font-semibold text-white hover:bg-neutral-800"
            >
              <ExternalLink className="h-4 w-4" aria-hidden />
              Preview as customer
            </a>
          </>
        )}
      </div>
    </>
  );
}

function calcTotals(items: Item[]) {
  const materialsPence = items
    .filter((i) => i.kind === "material" || i.kind === "fee")
    .reduce((acc, i) => acc + i.total_pence, 0);
  const labourPence = items
    .filter((i) => i.kind === "labour")
    .reduce((acc, i) => acc + i.total_pence, 0);
  const subtotal = materialsPence + labourPence;
  const vatPence = Math.round(subtotal * 0.2);
  const totalPence = subtotal + vatPence;
  return {
    materialsPence: Math.max(0, materialsPence),
    labourPence,
    vatPence,
    totalPence
  };
}
