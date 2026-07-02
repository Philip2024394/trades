"use client";

// ShopCategoriesEditor — reorderable list + inline edit rows.
//
// Uses HTML5 drag-and-drop (native, zero-dep) rather than pulling in
// dnd-kit for this one editor. Rows can be added, deleted, toggled,
// labelled, images uploaded (Supabase) or URL-pasted.

import { useState } from "react";

type Cat = {
  slug: string;
  label: string;
  image_url: string | null;
  enabled: boolean;
  sort_order?: number;
};

function slugify(input: string): string {
  return input
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .slice(0, 60);
}

function makeSlug(existing: Cat[], label: string): string {
  const base = slugify(label) || "category";
  const used = new Set(existing.map((c) => c.slug));
  if (!used.has(base)) return base;
  let n = 2;
  while (used.has(`${base}_${n}`)) n++;
  return `${base}_${n}`;
}

export function ShopCategoriesEditor({
  slug,
  token,
  initial
}: {
  slug: string;
  token: string;
  initial: Cat[];
}) {
  const [cats, setCats] = useState<Cat[]>(initial);
  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const [dragIdx, setDragIdx] = useState<number | null>(null);
  const [busyUploadIdx, setBusyUploadIdx] = useState<number | null>(null);

  function update(idx: number, patch: Partial<Cat>) {
    setCats((prev) => prev.map((c, i) => (i === idx ? { ...c, ...patch } : c)));
  }

  function remove(idx: number) {
    if (!confirm("Delete this category? Products already tagged with it stay tagged.")) return;
    setCats((prev) => prev.filter((_, i) => i !== idx));
  }

  function addNew() {
    const label = "New category";
    setCats((prev) => [
      ...prev,
      { slug: makeSlug(prev, `${label} ${prev.length + 1}`), label, image_url: null, enabled: true }
    ]);
  }

  function onDragStart(idx: number) {
    return () => setDragIdx(idx);
  }
  function onDragOver(idx: number) {
    return (e: React.DragEvent) => {
      e.preventDefault();
      if (dragIdx === null || dragIdx === idx) return;
      setCats((prev) => {
        const copy = prev.slice();
        const [moved] = copy.splice(dragIdx, 1);
        copy.splice(idx, 0, moved);
        return copy;
      });
      setDragIdx(idx);
    };
  }
  function onDragEnd() {
    setDragIdx(null);
  }

  async function uploadImage(idx: number, file: File) {
    setBusyUploadIdx(idx);
    try {
      const form = new FormData();
      form.append("file", file);
      const res = await fetch("/api/trade-off/upload-photo", { method: "POST", body: form });
      const j = (await res.json()) as { ok?: boolean; url?: string; error?: string };
      if (!res.ok || !j.ok || !j.url) {
        setToast(j.error ?? "Upload failed");
        return;
      }
      update(idx, { image_url: j.url });
    } catch (e) {
      setToast((e as Error).message);
    } finally {
      setBusyUploadIdx(null);
      window.setTimeout(() => setToast(null), 2500);
    }
  }

  async function save() {
    setSaving(true);
    setToast(null);
    try {
      const res = await fetch("/api/trade-off/shop-categories/save", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ slug, token, categories: cats })
      });
      const j = (await res.json()) as { ok?: boolean; error?: string; categories?: Cat[] };
      if (!res.ok || !j.ok) {
        setToast(j.error ?? "Save failed");
      } else {
        setToast("Saved.");
        if (j.categories) setCats(j.categories);
      }
    } catch (e) {
      setToast((e as Error).message);
    } finally {
      setSaving(false);
      window.setTimeout(() => setToast(null), 3000);
    }
  }

  return (
    <section className="mx-auto max-w-3xl space-y-4 px-4 pb-24">
      {cats.length === 0 && (
        <p className="rounded-2xl border border-dashed border-brand-line bg-brand-surface p-6 text-center text-[13px] text-brand-muted">
          No categories yet. Tap &ldquo;Add category&rdquo; below to start.
        </p>
      )}

      <ul className="space-y-2">
        {cats.map((cat, idx) => (
          <li
            key={`${cat.slug}-${idx}`}
            draggable
            onDragStart={onDragStart(idx)}
            onDragOver={onDragOver(idx)}
            onDragEnd={onDragEnd}
            className="flex items-center gap-3 rounded-2xl border border-brand-line bg-brand-surface p-3"
            style={{ opacity: dragIdx === idx ? 0.5 : 1 }}
          >
            <span
              className="cursor-grab select-none px-1 text-[16px] text-brand-muted"
              aria-label="Drag to reorder"
              title="Drag to reorder"
            >
              ⋮⋮
            </span>

            <span
              className="grid h-14 w-14 shrink-0 place-items-center overflow-hidden rounded-xl border border-brand-line bg-brand-bg"
              aria-hidden="true"
            >
              {cat.image_url ? (
                /* eslint-disable-next-line @next/next/no-img-element */
                <img src={cat.image_url} alt="" className="h-10 w-10 object-contain" />
              ) : (
                <span className="text-[9px] font-extrabold uppercase tracking-widest text-brand-muted">No img</span>
              )}
            </span>

            <div className="flex min-w-0 flex-1 flex-col gap-2">
              <input
                type="text"
                value={cat.label}
                onChange={(e) => {
                  const label = e.target.value;
                  const patch: Partial<Cat> = { label };
                  // Regenerate slug ONLY if the current slug still matches
                  // an old auto-slug of the previous label (user hasn't
                  // hand-tuned the slug).
                  if (cat.slug === slugify(cat.label) || cat.slug === "" || cat.slug.startsWith("new_category")) {
                    patch.slug = makeSlug(cats.filter((_, i) => i !== idx), label);
                  }
                  update(idx, patch);
                }}
                className="h-10 rounded-md border border-brand-line bg-brand-bg px-3 text-[13px] font-bold text-brand-text outline-none focus:border-brand-accent"
                placeholder="Category label"
                maxLength={60}
              />
              <div className="flex flex-wrap items-center gap-2">
                <input
                  type="url"
                  value={cat.image_url ?? ""}
                  onChange={(e) => update(idx, { image_url: e.target.value.trim() || null })}
                  className="h-9 min-w-0 flex-1 rounded-md border border-brand-line bg-brand-bg px-2 font-mono text-[11px] text-brand-text outline-none focus:border-brand-accent"
                  placeholder="Paste image URL"
                />
                <label className="inline-flex h-9 shrink-0 cursor-pointer items-center rounded-md border border-brand-line bg-brand-bg px-3 text-[11px] font-extrabold uppercase tracking-widest text-brand-muted transition hover:border-brand-accent hover:text-brand-text">
                  {busyUploadIdx === idx ? "…" : "Upload"}
                  <input
                    type="file"
                    accept="image/*"
                    className="sr-only"
                    onChange={(e) => {
                      const f = e.target.files?.[0];
                      if (f) uploadImage(idx, f);
                    }}
                  />
                </label>
              </div>
              <p className="font-mono text-[10px] text-brand-muted">
                slug: <code>{cat.slug}</code>
              </p>
            </div>

            <div className="flex shrink-0 flex-col items-end gap-2">
              <button
                type="button"
                onClick={() => update(idx, { enabled: !cat.enabled })}
                aria-pressed={cat.enabled}
                className="inline-flex h-8 w-14 items-center rounded-full border border-brand-line transition"
                style={{ background: cat.enabled ? "#FFB300" : "transparent" }}
                title={cat.enabled ? "Hide from strip" : "Show on strip"}
              >
                <span
                  className="inline-block h-6 w-6 rounded-full bg-white shadow transition"
                  style={{ transform: cat.enabled ? "translateX(24px)" : "translateX(2px)" }}
                />
              </button>
              <button
                type="button"
                onClick={() => remove(idx)}
                className="text-[10px] font-extrabold uppercase tracking-widest text-red-500 transition hover:text-red-300"
              >
                Delete
              </button>
            </div>
          </li>
        ))}
      </ul>

      <button
        type="button"
        onClick={addNew}
        className="inline-flex h-11 items-center rounded-xl border-2 border-dashed border-brand-line px-4 text-[12px] font-extrabold uppercase tracking-widest text-brand-muted transition hover:border-brand-accent hover:text-brand-text"
      >
        + Add category
      </button>

      <div className="flex items-center gap-3 border-t border-brand-line pt-4">
        <button
          type="button"
          onClick={save}
          disabled={saving}
          className="inline-flex h-12 items-center rounded-xl px-6 text-[13px] font-extrabold uppercase tracking-widest text-black transition hover:opacity-90 disabled:opacity-60"
          style={{ background: "#FFB300" }}
        >
          {saving ? "Saving…" : "Save categories"}
        </button>
        {toast && <p className="text-[12px] font-bold text-brand-muted">{toast}</p>}
      </div>
    </section>
  );
}
