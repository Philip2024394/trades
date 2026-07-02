"use client";

// StudioComponentLibrary — merchant library UI.
//
// Fetches /api/studio/saved-components on mount, renders each as a
// card with the section's actual renderer at 25% scale (same
// pixel-fidelity pattern as StudioTemplatesLibrary). Merchant actions:
//   • Insert into a page — small modal picks target page, POST fires,
//     merchant lands on the page editor with the section already added.
//   • Delete — one-tap with confirm.
//
// Empty state coaches the merchant to save a section from any page
// editor's Save toolbar action.

import { useEffect, useState } from "react";
import Link from "next/link";
import "@/lib/studio/sections"; // populate registry client-side
import { sectionRegistry } from "@/lib/studio/sectionRegistry";
import { DEFAULT_TOKENS } from "@/lib/studio/tokens";

const YELLOW = "#FFB300";
const RED = "#DC2626";
const GREEN = "#10B981";

type SavedItem = {
  id: string;
  kind: string;
  name: string;
  scope: "personal" | "company";
  usage_count: number;
  created_at: string;
  config_json: {
    registrationId?: string | null;
    config?: Record<string, unknown>;
    tokenOverrides?: Record<string, unknown>;
  };
};

type Props = {
  brandName: string;
  merchantSlug: string;
  availablePages: { id: string; name: string }[];
};

export function StudioComponentLibrary({
  brandName,
  merchantSlug,
  availablePages
}: Props) {
  const [items, setItems] = useState<SavedItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [insertModal, setInsertModal] = useState<SavedItem | null>(null);

  async function refresh() {
    setLoading(true);
    try {
      const res = await fetch("/api/studio/saved-components");
      const json = (await res.json()) as {
        ok: boolean;
        items?: SavedItem[];
      };
      if (json.ok && json.items) setItems(json.items);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void refresh();
  }, []);

  async function handleDelete(item: SavedItem) {
    const confirmed = window.confirm(
      `Delete "${item.name}"? This can't be undone.`
    );
    if (!confirmed) return;
    setItems((prev) => prev.filter((x) => x.id !== item.id));
    try {
      await fetch(`/api/studio/saved-components/${item.id}`, {
        method: "DELETE"
      });
    } catch {
      // Refresh on failure so the deleted item comes back if the API
      // actually failed.
      void refresh();
    }
  }

  return (
    <div className="mx-auto max-w-6xl px-6 py-10 sm:py-14">
      <p
        className="text-[10px] font-extrabold uppercase tracking-widest"
        style={{ color: YELLOW }}
      >
        {brandName} · Library
      </p>
      <h1 className="mt-2 text-3xl font-extrabold leading-tight text-neutral-900 sm:text-4xl">
        My saved sections
      </h1>
      <p className="mt-3 max-w-2xl text-[14px] leading-relaxed text-neutral-600">
        Every section you&rsquo;ve saved from a page editor. Drop them into any
        page — text edits, image swaps, and colour overrides come with the
        saved copy.
      </p>

      {loading ? (
        <p className="mt-12 text-center text-[13px] text-neutral-500">
          Loading…
        </p>
      ) : items.length === 0 ? (
        <EmptyState />
      ) : (
        <ul className="mt-8 grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {items.map((item) => (
            <li key={item.id}>
              <SavedCard
                item={item}
                merchantSlug={merchantSlug}
                onInsert={() => setInsertModal(item)}
                onDelete={() => handleDelete(item)}
              />
            </li>
          ))}
        </ul>
      )}

      {insertModal && (
        <InsertModal
          item={insertModal}
          pages={availablePages}
          onClose={() => setInsertModal(null)}
        />
      )}
    </div>
  );
}

// ─── Card ───────────────────────────────────────────────────

function SavedCard({
  item,
  merchantSlug,
  onInsert,
  onDelete
}: {
  item: SavedItem;
  merchantSlug: string;
  onInsert: () => void;
  onDelete: () => void;
}) {
  const registrationId = item.config_json.registrationId ?? "";
  const reg = registrationId ? sectionRegistry.get(registrationId) : undefined;
  const config = item.config_json.config ?? {};
  const tokenOverrides = item.config_json.tokenOverrides ?? {};
  const effectiveTokens = { ...DEFAULT_TOKENS, ...tokenOverrides };
  const data = {
    merchantId: "preview",
    slug: merchantSlug,
    merchantName: "Your business",
    city: "Your city",
    whatsappHref: null,
    brandName: "Main brand",
    domain: {}
  };

  return (
    <article className="flex flex-col overflow-hidden rounded-2xl border border-neutral-200 bg-white shadow-sm transition hover:border-neutral-400 hover:shadow-md">
      <div className="relative h-40 w-full overflow-hidden bg-neutral-100">
        {reg ? (
          <div
            style={{
              position: "absolute",
              top: 0,
              left: 0,
              width: "400%",
              height: "400%",
              transform: "scale(0.25)",
              transformOrigin: "top left",
              pointerEvents: "none"
            }}
          >
            {(() => {
              const Renderer = reg.renderer;
              return (
                <Renderer
                  instanceId="preview"
                  config={config}
                  tokens={effectiveTokens}
                  data={data}
                  mode="preview"
                />
              );
            })()}
          </div>
        ) : (
          <div className="flex h-full items-center justify-center text-[11px] font-bold text-neutral-400">
            Registration unavailable
          </div>
        )}
      </div>
      <div className="flex flex-1 flex-col gap-3 p-4">
        <div>
          <p
            className="text-[9px] font-extrabold uppercase tracking-widest"
            style={{ color: YELLOW }}
          >
            {item.kind}
          </p>
          <p className="mt-0.5 truncate text-[14px] font-extrabold text-neutral-900">
            {item.name}
          </p>
          <p className="mt-0.5 text-[10px] text-neutral-400">
            Saved {formatDate(item.created_at)} · Used {item.usage_count}× ·
            <code className="ml-1 font-mono text-[9px]">
              {registrationId || "—"}
            </code>
          </p>
        </div>
        <div className="mt-auto flex gap-2">
          <button
            type="button"
            onClick={onInsert}
            className="inline-flex h-9 flex-1 items-center justify-center rounded-xl px-3 text-[11px] font-extrabold uppercase tracking-widest text-neutral-900 transition hover:brightness-95"
            style={{ background: YELLOW }}
          >
            Add to page →
          </button>
          <button
            type="button"
            onClick={onDelete}
            aria-label={`Delete ${item.name}`}
            title="Delete"
            className="inline-flex h-9 items-center justify-center rounded-xl border px-3 text-[11px] font-extrabold uppercase tracking-widest transition hover:brightness-95"
            style={{ background: "transparent", color: RED, borderColor: RED }}
          >
            ✕
          </button>
        </div>
      </div>
    </article>
  );
}

// ─── Insert modal ───────────────────────────────────────────

function InsertModal({
  item,
  pages,
  onClose
}: {
  item: SavedItem;
  pages: { id: string; name: string }[];
  onClose: () => void;
}) {
  const [status, setStatus] = useState<
    | { kind: "idle" }
    | { kind: "inserting"; pageId: string }
    | { kind: "success"; pageId: string; instanceId: string }
    | { kind: "error"; message: string }
  >({ kind: "idle" });

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  async function insert(pageId: string) {
    setStatus({ kind: "inserting", pageId });
    try {
      const res = await fetch(
        `/api/studio/saved-components/${item.id}/insert`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ pageId })
        }
      );
      const json = (await res.json()) as
        | { ok: true; instanceId: string }
        | { ok: false; error: string };
      if (!res.ok || !json.ok) {
        setStatus({
          kind: "error",
          message: "error" in json ? json.error : "insert failed"
        });
        return;
      }
      setStatus({ kind: "success", pageId, instanceId: json.instanceId });
    } catch (err) {
      setStatus({
        kind: "error",
        message: (err as Error)?.message ?? "network"
      });
    }
  }

  return (
    <div
      className="fixed inset-0 z-[300] flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
      aria-label={`Add "${item.name}" to a page`}
      onClick={onClose}
    >
      <div
        className="w-full max-w-md overflow-hidden rounded-2xl bg-white shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <header className="border-b border-neutral-200 p-5">
          <p
            className="text-[10px] font-extrabold uppercase tracking-widest"
            style={{ color: YELLOW }}
          >
            Add to page
          </p>
          <h2 className="mt-1 text-[18px] font-extrabold text-neutral-900">
            Where should &ldquo;{item.name}&rdquo; go?
          </h2>
          <p className="mt-1 truncate text-[11px] font-mono text-neutral-400">
            {item.kind} · {item.config_json.registrationId}
          </p>
        </header>

        <div className="space-y-2 p-5">
          {pages.map((p) => {
            const busy =
              status.kind === "inserting" && status.pageId === p.id;
            const succeeded =
              status.kind === "success" && status.pageId === p.id;
            return (
              <div
                key={p.id}
                className="flex items-center justify-between gap-3 rounded-xl border border-neutral-200 p-3"
              >
                <div className="min-w-0 flex-1">
                  <p className="text-[13px] font-extrabold text-neutral-900">
                    {p.name}
                  </p>
                  <p className="font-mono text-[10px] text-neutral-400">
                    /studio/pages/{p.id}
                  </p>
                </div>
                {succeeded ? (
                  <Link
                    href={`/studio/pages/${p.id}`}
                    className="inline-flex h-9 items-center rounded-lg px-3 text-[11px] font-extrabold uppercase tracking-widest text-white"
                    style={{ background: GREEN }}
                  >
                    ✓ Open →
                  </Link>
                ) : (
                  <button
                    type="button"
                    onClick={() => insert(p.id)}
                    disabled={busy || status.kind === "inserting"}
                    className="inline-flex h-9 items-center rounded-lg px-3 text-[11px] font-extrabold uppercase tracking-widest text-neutral-900 disabled:cursor-not-allowed disabled:opacity-50"
                    style={{ background: YELLOW }}
                  >
                    {busy ? "Adding…" : "Add"}
                  </button>
                )}
              </div>
            );
          })}
          {status.kind === "error" && (
            <p
              role="alert"
              className="rounded-xl px-3 py-2 text-[12px] font-bold"
              style={{ background: "rgba(220,38,38,0.08)", color: RED }}
            >
              Failed to add — {status.message}
            </p>
          )}
        </div>

        <footer className="flex items-center justify-end border-t border-neutral-200 p-4">
          <button
            type="button"
            onClick={onClose}
            className="inline-flex h-10 items-center rounded-xl px-4 text-[12px] font-extrabold uppercase tracking-widest text-neutral-700 transition hover:bg-neutral-100"
          >
            Close
          </button>
        </footer>
      </div>
    </div>
  );
}

// ─── Empty state ────────────────────────────────────────────

function EmptyState() {
  return (
    <div className="mt-12 flex flex-col items-center justify-center gap-3 rounded-2xl border-2 border-dashed border-neutral-300 bg-neutral-50 p-16 text-center">
      <p className="text-[14px] font-bold text-neutral-700">
        Nothing saved yet.
      </p>
      <p className="max-w-md text-[12px] leading-relaxed text-neutral-500">
        In any page editor, select a section → click the ☆ Save button
        in the toolbar → give it a name. It&rsquo;ll appear here, ready to
        drop into any other page.
      </p>
      <Link
        href="/studio/pages"
        className="inline-flex h-11 items-center rounded-xl px-4 text-[12px] font-extrabold uppercase tracking-widest text-white"
        style={{ background: "#0A0A0A" }}
      >
        Open a page →
      </Link>
    </div>
  );
}

// ─── Helpers ────────────────────────────────────────────────

function formatDate(iso: string): string {
  try {
    return new Date(iso).toLocaleDateString("en-GB", {
      day: "numeric",
      month: "short",
      year: "numeric"
    });
  } catch {
    return iso.slice(0, 10);
  }
}
