"use client";

// StudioPagesManager — page catalog UI: list, create, rename, delete.
//
// Cards are click-through to the visual editor. Inline "New page" form
// creates a page (POST /api/studio/pages) then routes into the editor
// so the merchant starts editing immediately.

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import type { StudioPage } from "@/lib/studio/pagesLoader";

const YELLOW = "#FFB300";
const RED = "#DC2626";

type Props = { initialPages: StudioPage[] };

export function StudioPagesManager({ initialPages }: Props) {
  const [pages, setPages] = useState<StudioPage[]>(initialPages);
  const [creating, setCreating] = useState(false);
  const [newSlug, setNewSlug] = useState("");
  const [newName, setNewName] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();

  async function create() {
    if (busy) return;
    setError(null);
    setBusy(true);
    try {
      const res = await fetch("/api/studio/pages", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ slug: newSlug, name: newName })
      });
      const json = (await res.json()) as
        | { ok: true; page: StudioPage }
        | { ok: false; error: string };
      if (!res.ok || !json.ok) {
        setError("error" in json ? json.error : `HTTP ${res.status}`);
        setBusy(false);
        return;
      }
      setPages((prev) => [...prev, json.page]);
      // Straight into the editor for the freshly created page.
      router.push(`/studio/pages/${json.page.slug}`);
    } catch (err) {
      setError((err as Error)?.message ?? "network");
    } finally {
      setBusy(false);
    }
  }

  async function remove(page: StudioPage) {
    if (page.is_home) return;
    if (typeof window !== "undefined") {
      const ok = window.confirm(
        `Delete "${page.name}"? Layouts for this page will be permanently removed.`
      );
      if (!ok) return;
    }
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/studio/pages/${page.id}`, {
        method: "DELETE"
      });
      const json = (await res.json()) as { ok: boolean; error?: string };
      if (!res.ok || !json.ok) {
        setError(json.error ?? `HTTP ${res.status}`);
        setBusy(false);
        return;
      }
      setPages((prev) => prev.filter((p) => p.id !== page.id));
    } catch (err) {
      setError((err as Error)?.message ?? "network");
    } finally {
      setBusy(false);
    }
  }

  async function rename(page: StudioPage, nextName: string) {
    if (busy || !nextName || nextName === page.name) return;
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/studio/pages/${page.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: nextName })
      });
      const json = (await res.json()) as
        | { ok: true; page: StudioPage }
        | { ok: false; error: string };
      if (!res.ok || !json.ok) {
        setError("error" in json ? json.error : `HTTP ${res.status}`);
        setBusy(false);
        return;
      }
      setPages((prev) =>
        prev.map((p) => (p.id === page.id ? json.page : p))
      );
    } catch (err) {
      setError((err as Error)?.message ?? "network");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="mt-8">
      <ul className="grid gap-3 sm:grid-cols-2">
        {pages.map((p) => (
          <li key={p.id}>
            <PageCard
              page={p}
              onRename={(name) => void rename(p, name)}
              onDelete={() => void remove(p)}
              busy={busy}
            />
          </li>
        ))}
      </ul>

      {error && (
        <p
          role="alert"
          className="mt-4 rounded-xl px-3 py-2 text-[12px] font-bold"
          style={{ background: "rgba(220,38,38,0.08)", color: RED }}
        >
          {error}
        </p>
      )}

      {!creating ? (
        <button
          type="button"
          onClick={() => setCreating(true)}
          className="mt-6 inline-flex h-11 items-center rounded-xl border-2 border-dashed border-neutral-300 px-4 text-[12px] font-extrabold uppercase tracking-widest text-neutral-700 transition hover:border-neutral-500 hover:bg-neutral-50"
        >
          + New page
        </button>
      ) : (
        <div className="mt-6 rounded-2xl border border-neutral-200 bg-white p-5 shadow-sm">
          <p
            className="text-[10px] font-extrabold uppercase tracking-widest"
            style={{ color: YELLOW }}
          >
            New page
          </p>
          <div className="mt-3 grid gap-2 sm:grid-cols-2">
            <label className="block">
              <span className="text-[10px] font-extrabold uppercase tracking-widest text-neutral-500">
                Page name
              </span>
              <input
                type="text"
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                placeholder="About us"
                className="mt-1 h-10 w-full rounded-lg border border-neutral-300 bg-white px-3 text-[13px] font-medium"
              />
            </label>
            <label className="block">
              <span className="text-[10px] font-extrabold uppercase tracking-widest text-neutral-500">
                URL slug
              </span>
              <input
                type="text"
                value={newSlug}
                onChange={(e) =>
                  setNewSlug(e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, "-"))
                }
                placeholder="about"
                className="mt-1 h-10 w-full rounded-lg border border-neutral-300 bg-white px-3 text-[13px] font-mono"
              />
            </label>
          </div>
          <div className="mt-3 flex justify-end gap-2">
            <button
              type="button"
              onClick={() => {
                setCreating(false);
                setNewSlug("");
                setNewName("");
                setError(null);
              }}
              className="inline-flex h-10 items-center rounded-xl border border-neutral-300 px-3 text-[11px] font-extrabold uppercase tracking-widest text-neutral-700 transition hover:bg-neutral-50"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={create}
              disabled={busy || !newSlug || !newName}
              className="inline-flex h-10 items-center rounded-xl px-4 text-[12px] font-extrabold uppercase tracking-widest text-neutral-900 transition disabled:cursor-not-allowed disabled:opacity-50 hover:enabled:brightness-95"
              style={{ background: YELLOW }}
            >
              {busy ? "Creating…" : "Create page →"}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

function PageCard({
  page,
  onRename,
  onDelete,
  busy
}: {
  page: StudioPage;
  onRename: (name: string) => void;
  onDelete: () => void;
  busy: boolean;
}) {
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState(page.name);

  return (
    <div className="group flex h-full flex-col justify-between gap-4 rounded-2xl border border-neutral-200 bg-white p-5 shadow-sm transition hover:-translate-y-0.5 hover:border-neutral-400 hover:shadow-md">
      <div>
        {editing ? (
          <input
            type="text"
            value={name}
            autoFocus
            onChange={(e) => setName(e.target.value)}
            onBlur={() => {
              setEditing(false);
              onRename(name.trim());
            }}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                setEditing(false);
                onRename(name.trim());
              } else if (e.key === "Escape") {
                setEditing(false);
                setName(page.name);
              }
            }}
            className="h-10 w-full rounded-lg border border-neutral-300 bg-white px-3 text-[15px] font-extrabold"
          />
        ) : (
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0">
              <p className="text-[16px] font-extrabold leading-tight text-neutral-900">
                {page.name}
                {page.is_home && (
                  <span
                    className="ml-2 rounded-full px-2 py-0.5 text-[9px] font-extrabold uppercase tracking-widest text-neutral-900"
                    style={{ background: YELLOW }}
                  >
                    Home
                  </span>
                )}
              </p>
              <p className="mt-1 font-mono text-[11px] text-neutral-500">
                /{page.slug}
              </p>
              {page.description && (
                <p className="mt-1 text-[12px] leading-relaxed text-neutral-600">
                  {page.description}
                </p>
              )}
            </div>
            <button
              type="button"
              onClick={() => setEditing(true)}
              className="rounded-md px-2 py-1 text-[10px] font-extrabold uppercase tracking-widest text-neutral-500 hover:bg-neutral-100"
            >
              Rename
            </button>
          </div>
        )}
      </div>

      <div className="flex items-center gap-2">
        <Link
          href={`/studio/pages/${page.slug}`}
          className="inline-flex h-10 items-center rounded-xl px-3 text-[11px] font-extrabold uppercase tracking-widest text-neutral-900 transition group-hover:brightness-95"
          style={{ background: YELLOW }}
        >
          Open editor →
        </Link>
        {!page.is_home && (
          <button
            type="button"
            onClick={onDelete}
            disabled={busy}
            className="ml-auto rounded-md px-2 py-1 text-[10px] font-extrabold uppercase tracking-widest text-neutral-500 hover:bg-neutral-100 disabled:opacity-50"
          >
            Delete
          </button>
        )}
      </div>
    </div>
  );
}
