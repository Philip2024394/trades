"use client";

// DraftPreviewCard — renders inline with NEX's chat reply when the
// last turn created a product draft. Provides the merchant's one-click
// path to Publish or discard.
//
// Phase 7 · Increment 3. Deliberately minimal styling — Increment 7
// polish pass will match the NEX design language properly.

import { useState } from "react";

export type Draft = {
  canonical_id: string;
  offer_id: string;
  name: string;
  brand_name: string;
  slug: string;
  price_pence: number;
  lifecycle_status: "draft";
};

type Props = {
  draft: Draft;
  onPublished?: () => void;
  onEditRequested?: () => void;
};

function formatPrice(pence: number): string {
  return new Intl.NumberFormat("en-GB", {
    style: "currency",
    currency: "GBP",
    minimumFractionDigits: pence % 100 === 0 ? 0 : 2,
  }).format(pence / 100);
}

export function DraftPreviewCard({ draft, onPublished, onEditRequested }: Props) {
  const [publishing, setPublishing] = useState(false);
  const [published, setPublished] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handlePublish() {
    setError(null);
    setPublishing(true);
    try {
      const res = await fetch("/api/nex/merchant-assistant/approve", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ product_id: draft.canonical_id }),
      });
      const data = (await res.json()) as { ok: boolean; error?: string };
      if (!res.ok || !data.ok) {
        setError(data.error ?? "Publish failed");
        setPublishing(false);
        return;
      }
      setPublished(true);
      setPublishing(false);
      onPublished?.();
    } catch {
      setError("Network error — try again.");
      setPublishing(false);
    }
  }

  return (
    <div className="my-3 max-w-[80%] rounded-2xl border border-black/10 bg-white shadow-sm">
      <div className="px-4 py-3">
        <div className="flex items-center justify-between">
          <div className="text-[10px] font-semibold uppercase tracking-wider text-orange-600">
            Draft — not public
          </div>
          <div className="text-[10px] text-black/40">
            {draft.slug}
          </div>
        </div>
        <div className="mt-2">
          <div className="text-sm text-black/60">{draft.brand_name}</div>
          <div className="mt-1 text-base font-semibold text-black">
            {draft.name}
          </div>
          <div className="mt-2 text-lg font-semibold text-black">
            {formatPrice(draft.price_pence)}
          </div>
        </div>
      </div>

      {published ? (
        <div className="border-t border-emerald-100 bg-emerald-50 px-4 py-3 text-xs text-emerald-800">
          ✓ Published. NEX Centre will show this listing shortly.
        </div>
      ) : (
        <div className="flex items-center justify-end gap-2 border-t border-black/10 px-3 py-2">
          <button
            type="button"
            onClick={onEditRequested}
            className="rounded-full px-3 py-1.5 text-xs font-medium text-black/70 hover:bg-black/5"
            disabled={publishing}
          >
            Edit
          </button>
          <button
            type="button"
            onClick={handlePublish}
            disabled={publishing}
            className="rounded-full bg-black px-4 py-1.5 text-xs font-medium text-white disabled:bg-black/30"
          >
            {publishing ? "Publishing…" : "Publish"}
          </button>
        </div>
      )}

      {error && (
        <div className="border-t border-red-200 bg-red-50 px-4 py-2 text-xs text-red-700">
          {error}
        </div>
      )}
    </div>
  );
}
