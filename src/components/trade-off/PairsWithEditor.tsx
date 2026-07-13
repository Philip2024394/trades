"use client";

// PairsWithEditor — inline editor for a product's "Pairs well with"
// rail. Mounted inside ShopModeEditor's per-product form; hidden until
// the product row exists (so the anchor id is stable). Loads current
// pairs on mount, lets the merchant add/remove/reorder + write a short
// reason, saves via replace-all POST.
//
// Load + save both go through /api/trade-off/products/pair-with. Save
// is manual (Save button) so the merchant can bail without side
// effects. State is local; parent doesn't need to plumb pairs through
// FormState.
//
// The picker is a plain <select> populated with the trade's own
// catalogue (siblings). Simpler than a search modal and matches the
// small catalogue size most trades have. Anchor product itself and
// already-picked accessories are excluded from the options.

import { useEffect, useState } from "react";
import { Trash2, Save, Loader2, AlertTriangle, Plus } from "lucide-react";

type SavedPair = {
  id: string;
  accessory_product_id: string;
  accessory_name: string;
  accessory_cover_url: string | null;
  reason: string | null;
  sort_order: number;
};

type DraftPair = {
  accessory_product_id: string;
  accessory_name: string;
  accessory_cover_url: string | null;
  reason: string;
  sort_order: number;
};

export function PairsWithEditor({
  slug,
  editToken,
  productId,
  siblings
}: {
  slug: string;
  editToken: string;
  productId: string;
  /** Other products in this trade's catalogue that could be picked as
   *  accessories. Anchor + already-selected rows are filtered out in
   *  the picker. Pass every sibling — the component handles filtering. */
  siblings: Array<{ id: string; name: string; cover_url: string | null }>;
}) {
  const [loading, setLoading] = useState(true);
  const [draft, setDraft] = useState<DraftPair[]>([]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [savedNote, setSavedNote] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      setError(null);
      try {
        const url = `/api/trade-off/products/pair-with?slug=${encodeURIComponent(slug)}&edit_token=${encodeURIComponent(editToken)}&product_id=${encodeURIComponent(productId)}`;
        const res = await fetch(url);
        const json = (await res.json()) as
          | { ok: true; pairs: SavedPair[] }
          | { ok: false; error: string };
        if (cancelled) return;
        if (!json.ok) {
          setError(json.error);
          setDraft([]);
        } else {
          setDraft(
            json.pairs.map((p) => ({
              accessory_product_id: p.accessory_product_id,
              accessory_name: p.accessory_name,
              accessory_cover_url: p.accessory_cover_url,
              reason: p.reason ?? "",
              sort_order: p.sort_order
            }))
          );
        }
      } catch {
        if (!cancelled) setError("Network error while loading pairs.");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [slug, editToken, productId]);

  const takenIds = new Set(draft.map((d) => d.accessory_product_id));
  const options = siblings.filter(
    (s) => s.id !== productId && !takenIds.has(s.id)
  );

  function addPair(accId: string) {
    const sib = siblings.find((s) => s.id === accId);
    if (!sib) return;
    setDraft((prev) => [
      ...prev,
      {
        accessory_product_id: sib.id,
        accessory_name: sib.name,
        accessory_cover_url: sib.cover_url,
        reason: "",
        sort_order: prev.length
      }
    ]);
  }

  function removePair(idx: number) {
    setDraft((prev) => prev.filter((_, i) => i !== idx).map((p, i) => ({
      ...p,
      sort_order: i
    })));
  }

  function updateReason(idx: number, next: string) {
    setDraft((prev) =>
      prev.map((p, i) => (i === idx ? { ...p, reason: next.slice(0, 140) } : p))
    );
  }

  async function save() {
    setSaving(true);
    setError(null);
    setSavedNote(null);
    try {
      const res = await fetch("/api/trade-off/products/pair-with", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          slug,
          edit_token: editToken,
          product_id: productId,
          pairs: draft.map((d, i) => ({
            accessory_product_id: d.accessory_product_id,
            reason: d.reason.trim().length > 0 ? d.reason.trim() : null,
            sort_order: i
          }))
        })
      });
      const json = (await res.json()) as
        | { ok: true; saved: number }
        | { ok: false; error: string };
      if (!json.ok) {
        setError(json.error);
        return;
      }
      setSavedNote(
        json.saved === 0
          ? "Cleared — no pairs on this product."
          : `Saved ${json.saved} pair${json.saved === 1 ? "" : "s"}.`
      );
    } catch {
      setError("Network error while saving.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <section className="rounded-2xl border border-brand-line bg-brand-surface p-4">
      <header className="flex items-center justify-between gap-3">
        <div>
          <h3 className="text-sm font-semibold text-brand-text">
            Pairs well with
          </h3>
          <p className="mt-0.5 text-[11px] text-brand-muted">
            Curated picks from your own catalogue shown as a rail on this
            product&apos;s PDP. Max 12.
          </p>
        </div>
        <button
          type="button"
          onClick={save}
          disabled={saving || loading}
          className="inline-flex h-9 items-center gap-1.5 rounded-full bg-brand-accent px-3 text-[12px] font-black text-black disabled:opacity-60"
        >
          {saving ? (
            <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden />
          ) : (
            <Save className="h-3.5 w-3.5" aria-hidden />
          )}
          Save pairs
        </button>
      </header>

      {loading ? (
        <p className="mt-3 text-[12px] text-brand-muted">Loading…</p>
      ) : (
        <>
          {error && (
            <p
              role="alert"
              className="mt-3 flex items-start gap-1.5 rounded-lg border border-red-500/40 bg-red-500/10 px-2 py-1.5 text-[12px] text-red-500"
            >
              <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden />
              {error}
            </p>
          )}
          {savedNote && !error && (
            <p className="mt-3 rounded-lg border border-green-500/40 bg-green-500/10 px-2 py-1.5 text-[12px] text-green-500">
              {savedNote}
            </p>
          )}

          {draft.length === 0 ? (
            <p className="mt-3 rounded-lg border border-dashed border-brand-line px-3 py-3 text-[12px] text-brand-muted">
              No pairs yet. Add one below to build the rail on this
              product&apos;s PDP.
            </p>
          ) : (
            <ul className="mt-3 space-y-2">
              {draft.map((p, idx) => (
                <li
                  key={p.accessory_product_id}
                  className="flex items-start gap-3 rounded-xl border border-brand-line bg-black/20 p-3"
                >
                  {p.accessory_cover_url ? (
                    /* eslint-disable-next-line @next/next/no-img-element */
                    <img
                      src={p.accessory_cover_url}
                      alt=""
                      className="h-12 w-12 shrink-0 rounded-md border border-brand-line object-contain p-0.5"
                    />
                  ) : (
                    <div
                      aria-hidden
                      className="grid h-12 w-12 shrink-0 place-items-center rounded-md border border-brand-line bg-black text-brand-muted"
                    >
                      —
                    </div>
                  )}
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-[12.5px] font-black text-brand-text">
                      {p.accessory_name}
                    </p>
                    <input
                      type="text"
                      placeholder="Why they pair (optional, 140 chars)"
                      value={p.reason}
                      onChange={(e) => updateReason(idx, e.target.value)}
                      maxLength={140}
                      className="mt-1 block h-8 w-full rounded-md border border-brand-line bg-brand-surface px-2 text-[12px] text-brand-text outline-none focus:border-brand-accent"
                    />
                  </div>
                  <button
                    type="button"
                    onClick={() => removePair(idx)}
                    aria-label={`Remove ${p.accessory_name}`}
                    className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-red-500/40 text-red-500 hover:bg-red-500/10"
                  >
                    <Trash2 className="h-3.5 w-3.5" aria-hidden />
                  </button>
                </li>
              ))}
            </ul>
          )}

          {draft.length < 12 && options.length > 0 && (
            <div className="mt-3">
              <label className="text-[11px] font-black uppercase tracking-widest text-brand-muted">
                Add pair
              </label>
              <div className="mt-1 flex items-center gap-2">
                <select
                  onChange={(e) => {
                    const v = e.target.value;
                    e.currentTarget.value = "";
                    if (v) addPair(v);
                  }}
                  defaultValue=""
                  className="block h-9 flex-1 rounded-md border border-brand-line bg-brand-surface px-2 text-[12.5px] text-brand-text outline-none focus:border-brand-accent"
                >
                  <option value="">Pick a product from your catalogue…</option>
                  {options.map((o) => (
                    <option key={o.id} value={o.id}>
                      {o.name}
                    </option>
                  ))}
                </select>
                <span
                  aria-hidden
                  className="inline-flex h-9 w-9 items-center justify-center rounded-full bg-brand-accent text-black"
                >
                  <Plus className="h-3.5 w-3.5" aria-hidden />
                </span>
              </div>
            </div>
          )}
          {draft.length < 12 && options.length === 0 && (
            <p className="mt-3 text-[11px] text-brand-muted">
              No more products in your catalogue to pair with.
            </p>
          )}
        </>
      )}
    </section>
  );
}
