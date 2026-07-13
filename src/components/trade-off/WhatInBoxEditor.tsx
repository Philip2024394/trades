"use client";

// WhatInBoxEditor — inline editor for a product's "In the delivery"
// bento. Same pattern as PairsWithEditor: mounts inside ShopModeEditor
// once the product row exists, loads current items, lets the merchant
// add/remove/reorder + set label / qty / optional cover image, saves
// via replace-all POST.
//
// Image upload reuses /api/trade-off/upload-photo (the same endpoint
// the yard composer + product gallery use). Auto-set on successful
// upload; can be cleared by removing the row.

import { useEffect, useState } from "react";
import {
  Trash2,
  Save,
  Loader2,
  AlertTriangle,
  Plus,
  Camera,
  X
} from "lucide-react";

type DraftItem = {
  key: string;
  label: string;
  qty: string;
  image_url: string | null;
  uploading: boolean;
};

function randKey(): string {
  return `it_${Math.random().toString(36).slice(2, 10)}`;
}

export function WhatInBoxEditor({
  slug,
  editToken,
  productId
}: {
  slug: string;
  editToken: string;
  productId: string;
}) {
  const [loading, setLoading] = useState(true);
  const [draft, setDraft] = useState<DraftItem[]>([]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [savedNote, setSavedNote] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      setError(null);
      try {
        const url = `/api/trade-off/products/what-in-box?slug=${encodeURIComponent(slug)}&edit_token=${encodeURIComponent(editToken)}&product_id=${encodeURIComponent(productId)}`;
        const res = await fetch(url);
        const json = (await res.json()) as
          | {
              ok: true;
              items: Array<{
                id: string;
                label: string;
                qty: number;
                image_url: string | null;
                sort_order: number;
              }>;
            }
          | { ok: false; error: string };
        if (cancelled) return;
        if (!json.ok) {
          setError(json.error);
          setDraft([]);
        } else {
          setDraft(
            json.items.map((it) => ({
              key: randKey(),
              label: it.label,
              qty: String(it.qty),
              image_url: it.image_url,
              uploading: false
            }))
          );
        }
      } catch {
        if (!cancelled) setError("Network error while loading items.");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [slug, editToken, productId]);

  function addItem() {
    setDraft((prev) => [
      ...prev,
      {
        key: randKey(),
        label: "",
        qty: "1",
        image_url: null,
        uploading: false
      }
    ]);
  }

  function removeItem(key: string) {
    setDraft((prev) => prev.filter((d) => d.key !== key));
  }

  function updateItem(key: string, patch: Partial<DraftItem>) {
    setDraft((prev) =>
      prev.map((d) => (d.key === key ? { ...d, ...patch } : d))
    );
  }

  async function handleUpload(
    key: string,
    e: React.ChangeEvent<HTMLInputElement>
  ) {
    const file = e.target.files?.[0];
    e.currentTarget.value = "";
    if (!file) return;
    updateItem(key, { uploading: true });
    try {
      const fd = new FormData();
      fd.append("file", file);
      fd.append("slug", slug);
      fd.append("edit_token", editToken);
      const res = await fetch("/api/trade-off/upload-photo", {
        method: "POST",
        body: fd
      });
      const json = (await res.json()) as { ok?: boolean; url?: string };
      if (json.ok && json.url) {
        updateItem(key, { image_url: json.url, uploading: false });
      } else {
        updateItem(key, { uploading: false });
        setError("Image upload failed.");
      }
    } catch {
      updateItem(key, { uploading: false });
      setError("Image upload failed.");
    }
  }

  async function save() {
    setSaving(true);
    setError(null);
    setSavedNote(null);
    try {
      const items = draft
        .map((d, i) => ({
          label: d.label.trim().slice(0, 120),
          qty: Math.max(1, Math.min(999, parseInt(d.qty, 10) || 1)),
          image_url: d.image_url,
          sort_order: i
        }))
        .filter((it) => it.label.length > 0);
      const res = await fetch("/api/trade-off/products/what-in-box", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          slug,
          edit_token: editToken,
          product_id: productId,
          items
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
          ? "Cleared — no items in the box."
          : `Saved ${json.saved} item${json.saved === 1 ? "" : "s"}.`
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
            In the delivery
          </h3>
          <p className="mt-0.5 text-[11px] text-brand-muted">
            Bento of items that arrive with this order. Optional per-item
            cover image. Max 30.
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
          Save box
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
              No items yet. Add rows below to build the delivery bento
              shown on the PDP.
            </p>
          ) : (
            <ul className="mt-3 space-y-2">
              {draft.map((d) => (
                <li
                  key={d.key}
                  className="flex items-start gap-3 rounded-xl border border-brand-line bg-black/20 p-3"
                >
                  <div className="relative h-14 w-14 shrink-0">
                    {d.image_url ? (
                      <>
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img
                          src={d.image_url}
                          alt=""
                          className="h-14 w-14 rounded-md border border-brand-line object-contain bg-black p-0.5"
                        />
                        <button
                          type="button"
                          onClick={() => updateItem(d.key, { image_url: null })}
                          aria-label="Remove image"
                          className="absolute -right-1 -top-1 grid h-5 w-5 place-items-center rounded-full bg-red-500 text-white"
                        >
                          <X className="h-3 w-3" aria-hidden />
                        </button>
                      </>
                    ) : (
                      <label className="grid h-14 w-14 cursor-pointer place-items-center rounded-md border border-dashed border-brand-line bg-black text-brand-muted hover:border-brand-accent">
                        {d.uploading ? (
                          <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
                        ) : (
                          <Camera className="h-4 w-4" aria-hidden />
                        )}
                        <input
                          type="file"
                          accept="image/*"
                          className="hidden"
                          disabled={d.uploading}
                          onChange={(e) => handleUpload(d.key, e)}
                        />
                      </label>
                    )}
                  </div>
                  <div className="min-w-0 flex-1 space-y-1.5">
                    <input
                      type="text"
                      placeholder="Item label (e.g. Plaster board, 8ft)"
                      value={d.label}
                      onChange={(e) => updateItem(d.key, { label: e.target.value })}
                      maxLength={120}
                      className="block h-9 w-full rounded-md border border-brand-line bg-brand-surface px-2 text-[12.5px] text-brand-text outline-none focus:border-brand-accent"
                    />
                    <div className="flex items-center gap-2">
                      <label className="text-[11px] font-black uppercase tracking-widest text-brand-muted">
                        Qty
                      </label>
                      <input
                        type="number"
                        inputMode="numeric"
                        min="1"
                        max="999"
                        value={d.qty}
                        onChange={(e) => updateItem(d.key, { qty: e.target.value })}
                        className="block h-8 w-20 rounded-md border border-brand-line bg-brand-surface px-2 text-[12px] text-brand-text outline-none focus:border-brand-accent"
                      />
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => removeItem(d.key)}
                    aria-label={`Remove ${d.label || "item"}`}
                    className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-red-500/40 text-red-500 hover:bg-red-500/10"
                  >
                    <Trash2 className="h-3.5 w-3.5" aria-hidden />
                  </button>
                </li>
              ))}
            </ul>
          )}

          {draft.length < 30 && (
            <button
              type="button"
              onClick={addItem}
              className="mt-3 inline-flex h-9 items-center gap-1.5 rounded-full border border-brand-line bg-brand-bg px-3 text-[12px] font-black text-brand-text hover:border-brand-accent"
            >
              <Plus className="h-3.5 w-3.5" aria-hidden />
              Add item
            </button>
          )}
        </>
      )}
    </section>
  );
}
