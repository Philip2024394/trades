"use client";

// Feed Tile library admin — list rows with inline edit, add new,
// soft-delete (deactivate). Hard-delete gated behind a confirm to
// protect against accidental purges of shared images.

import Image from "next/image";
import { useState } from "react";

type Row = {
  id:          string;
  slug:        string;
  url:         string;
  alt:         string;
  trade_slugs: string[];
  text_tone:   "white" | "black" | "gray";
  active:      boolean;
  posted_by:   string;
  updated_at:  string;
};

export function FeedTileLibraryAdmin({ initialRows }: { initialRows: Row[] }) {
  const [rows, setRows] = useState<Row[]>(initialRows);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function refresh() {
    const res = await fetch("/api/admin/feed-tile-library", { cache: "no-store" });
    const data = await res.json().catch(() => ({}));
    if (data?.ok) setRows(data.rows as Row[]);
  }

  async function create(entry: Omit<Row, "id" | "updated_at" | "posted_by">) {
    setBusy("create");
    setError(null);
    try {
      const res = await fetch("/api/admin/feed-tile-library", {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify({
          slug:        entry.slug,
          url:         entry.url,
          alt:         entry.alt,
          trade_slugs: entry.trade_slugs,
          text_tone:   entry.text_tone,
          active:      entry.active
        })
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data.ok) {
        setError(`Create failed: ${data.error ?? res.status} — ${data.detail ?? ""}`);
        return;
      }
      await refresh();
    } finally {
      setBusy(null);
    }
  }

  async function patch(id: string, patch: Partial<Row>) {
    setBusy(id);
    setError(null);
    try {
      const res = await fetch(`/api/admin/feed-tile-library/${encodeURIComponent(id)}`, {
        method:  "PATCH",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify(patch)
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data.ok) {
        setError(`Update failed: ${data.error ?? res.status} — ${data.detail ?? ""}`);
        return;
      }
      await refresh();
    } finally {
      setBusy(null);
    }
  }

  async function del(id: string, hard = false) {
    if (hard && !confirm("HARD delete — the row is removed permanently. Continue?")) return;
    if (!hard && !confirm("Deactivate this image? It disappears from the picker but stays in the DB.")) return;
    setBusy(id);
    setError(null);
    try {
      const qs = hard ? "?hard=1" : "";
      const res = await fetch(`/api/admin/feed-tile-library/${encodeURIComponent(id)}${qs}`, {
        method: "DELETE"
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data.ok) {
        setError(`Delete failed: ${data.error ?? res.status}`);
        return;
      }
      await refresh();
    } finally {
      setBusy(null);
    }
  }

  return (
    <>
      {error && (
        <div className="mt-4 rounded-md border border-red-500 bg-red-50 px-3 py-2 text-xs text-red-700">
          {error}
        </div>
      )}

      <NewEntryForm onCreate={create} busy={busy === "create"}/>

      <div className="mt-8 space-y-3">
        {rows.length === 0 && (
          <div className="rounded-lg border border-dashed border-brand-line p-6 text-center text-xs text-brand-muted">
            No entries yet. Add your first image above.
          </div>
        )}
        {rows.map((r) => (
          <RowEditor
            key={r.id}
            row={r}
            busy={busy === r.id}
            onSave={(p) => patch(r.id, p)}
            onDeactivate={() => del(r.id, false)}
            onHardDelete={() => del(r.id, true)}
            onReactivate={() => patch(r.id, { active: true })}
          />
        ))}
      </div>
    </>
  );
}

function NewEntryForm({
  onCreate,
  busy
}: {
  onCreate: (entry: Omit<Row, "id" | "updated_at" | "posted_by">) => void;
  busy: boolean;
}) {
  const [slug, setSlug] = useState("");
  const [url, setUrl] = useState("");
  const [alt, setAlt] = useState("");
  const [trades, setTrades] = useState("");
  const [tone, setTone] = useState<"white" | "black" | "gray">("white");

  function submit(e: React.FormEvent) {
    e.preventDefault();
    onCreate({
      slug: slug.trim(),
      url:  url.trim(),
      alt:  alt.trim(),
      trade_slugs: trades.split(",").map((s) => s.trim()).filter(Boolean),
      text_tone: tone,
      active: true
    });
    if (!busy) {
      setSlug(""); setUrl(""); setAlt(""); setTrades(""); setTone("white");
    }
  }

  return (
    <form onSubmit={submit} className="mt-6 rounded-lg border border-brand-line p-4">
      <h2 className="text-sm font-semibold text-brand-text">Add new library image</h2>
      <p className="mt-1 text-xs text-brand-muted">
        Upload the image to Supabase Storage first (or use an ImageKit URL), then paste the public URL here.
      </p>
      <div className="mt-3 grid gap-3 md:grid-cols-2">
        <label className="block">
          <span className="text-[10px] font-semibold uppercase tracking-wide text-brand-muted">Slug (kebab-case)</span>
          <input required value={slug} onChange={(e) => setSlug(e.target.value)} placeholder="e.g. plumbing-02"
            className="mt-1 block w-full rounded-md border border-brand-line bg-brand-surface px-2 py-1.5 text-sm text-brand-text"/>
        </label>
        <label className="block">
          <span className="text-[10px] font-semibold uppercase tracking-wide text-brand-muted">Text tone</span>
          <select value={tone} onChange={(e) => setTone(e.target.value as "white" | "black" | "gray")}
            className="mt-1 block w-full rounded-md border border-brand-line bg-brand-surface px-2 py-1.5 text-sm text-brand-text">
            <option value="white">White (dark scrim)</option>
            <option value="black">Black (light scrim)</option>
            <option value="gray">Gray</option>
          </select>
        </label>
        <label className="block md:col-span-2">
          <span className="text-[10px] font-semibold uppercase tracking-wide text-brand-muted">Image URL</span>
          <input required value={url} onChange={(e) => setUrl(e.target.value)} placeholder="https://ik.imagekit.io/... or https://….supabase.co/storage/..."
            className="mt-1 block w-full rounded-md border border-brand-line bg-brand-surface px-2 py-1.5 text-sm text-brand-text"/>
        </label>
        <label className="block md:col-span-2">
          <span className="text-[10px] font-semibold uppercase tracking-wide text-brand-muted">Alt / description</span>
          <input required value={alt} onChange={(e) => setAlt(e.target.value)} placeholder="Short description shown as hover title"
            className="mt-1 block w-full rounded-md border border-brand-line bg-brand-surface px-2 py-1.5 text-sm text-brand-text"/>
        </label>
        <label className="block md:col-span-2">
          <span className="text-[10px] font-semibold uppercase tracking-wide text-brand-muted">Trade slugs (comma-separated)</span>
          <input required value={trades} onChange={(e) => setTrades(e.target.value)} placeholder="e.g. plumber, plumbing-merchant"
            className="mt-1 block w-full rounded-md border border-brand-line bg-brand-surface px-2 py-1.5 text-sm text-brand-text"/>
        </label>
      </div>
      <div className="mt-3 flex items-center gap-2">
        <button type="submit" disabled={busy}
          className="rounded-md border border-brand-line bg-brand-text px-3 py-1.5 text-xs font-semibold text-brand-surface transition hover:opacity-90 disabled:opacity-40">
          {busy ? "Saving…" : "Add image"}
        </button>
      </div>
    </form>
  );
}

function RowEditor({
  row, busy, onSave, onDeactivate, onHardDelete, onReactivate
}: {
  row: Row;
  busy: boolean;
  onSave: (patch: Partial<Row>) => void;
  onDeactivate: () => void;
  onHardDelete: () => void;
  onReactivate: () => void;
}) {
  const [editing, setEditing] = useState(false);
  const [alt, setAlt] = useState(row.alt);
  const [trades, setTrades] = useState(row.trade_slugs.join(", "));
  const [tone, setTone] = useState(row.text_tone);

  return (
    <div className={`flex items-start gap-4 rounded-lg border p-3 ${row.active ? "border-brand-line" : "border-brand-line/50 opacity-60"}`}>
      <div className="h-16 w-24 flex-shrink-0 overflow-hidden rounded border border-brand-line bg-brand-surface">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={row.url} alt={row.alt} className="h-full w-full object-cover"/>
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex items-baseline gap-2">
          <span className="font-mono text-xs text-brand-text">{row.slug}</span>
          <span className={`rounded px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-wide ${row.active ? "bg-green-500/20 text-green-500" : "bg-red-500/20 text-red-500"}`}>
            {row.active ? "active" : "inactive"}
          </span>
          <span className={`rounded px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-wide bg-brand-surface text-brand-muted`}>
            tone: {row.text_tone}
          </span>
        </div>
        {editing ? (
          <div className="mt-2 space-y-2">
            <label className="block">
              <span className="text-[9px] font-semibold uppercase tracking-wide text-brand-muted">Alt</span>
              <input value={alt} onChange={(e) => setAlt(e.target.value)}
                className="mt-0.5 block w-full rounded-md border border-brand-line bg-brand-surface px-2 py-1 text-xs text-brand-text"/>
            </label>
            <label className="block">
              <span className="text-[9px] font-semibold uppercase tracking-wide text-brand-muted">Trade slugs (comma-separated)</span>
              <input value={trades} onChange={(e) => setTrades(e.target.value)}
                className="mt-0.5 block w-full rounded-md border border-brand-line bg-brand-surface px-2 py-1 text-xs text-brand-text"/>
            </label>
            <label className="block">
              <span className="text-[9px] font-semibold uppercase tracking-wide text-brand-muted">Text tone</span>
              <select value={tone} onChange={(e) => setTone(e.target.value as "white" | "black" | "gray")}
                className="mt-0.5 block rounded-md border border-brand-line bg-brand-surface px-2 py-1 text-xs text-brand-text">
                <option value="white">White</option>
                <option value="black">Black</option>
                <option value="gray">Gray</option>
              </select>
            </label>
            <div className="flex items-center gap-2">
              <button type="button" disabled={busy}
                onClick={() => {
                  onSave({
                    alt: alt.trim(),
                    trade_slugs: trades.split(",").map((s) => s.trim()).filter(Boolean),
                    text_tone: tone
                  });
                  setEditing(false);
                }}
                className="rounded-md border border-brand-line bg-brand-text px-2.5 py-1 text-xs font-semibold text-brand-surface disabled:opacity-40">
                {busy ? "Saving…" : "Save"}
              </button>
              <button type="button" onClick={() => setEditing(false)}
                className="rounded-md border border-brand-line px-2.5 py-1 text-xs text-brand-muted">
                Cancel
              </button>
            </div>
          </div>
        ) : (
          <>
            <p className="mt-1 text-xs text-brand-muted">{row.alt}</p>
            <p className="mt-1 text-[11px] text-brand-muted">
              trades: <span className="font-mono">{row.trade_slugs.join(", ") || "—"}</span>
            </p>
          </>
        )}
      </div>
      <div className="flex flex-col items-end gap-1.5">
        {!editing && (
          <button type="button" onClick={() => setEditing(true)}
            className="rounded-md border border-brand-line px-2 py-1 text-[10px] font-semibold text-brand-text">
            Edit
          </button>
        )}
        {row.active ? (
          <button type="button" onClick={onDeactivate} disabled={busy}
            className="rounded-md border border-brand-line px-2 py-1 text-[10px] font-semibold text-brand-muted disabled:opacity-40">
            Deactivate
          </button>
        ) : (
          <button type="button" onClick={onReactivate} disabled={busy}
            className="rounded-md border border-brand-line px-2 py-1 text-[10px] font-semibold text-green-500 disabled:opacity-40">
            Reactivate
          </button>
        )}
        <button type="button" onClick={onHardDelete} disabled={busy}
          className="rounded-md border border-red-500/40 px-2 py-1 text-[10px] font-semibold text-red-500 disabled:opacity-40">
          Delete
        </button>
      </div>
    </div>
  );
}
