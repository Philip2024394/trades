"use client";

// StudioFindReplaceModal — global text find/replace across every page
// of the current brand.
//
// Two-step flow:
//   1. Find + Replace + toggles (case, whole word) → Preview button →
//      shows every hit grouped by page.
//   2. Confirm → Apply — persists the replacement server-side; on
//      return, hits are re-listed with `applied: true`.
//
// The modal explicitly does NOT touch the editor's in-memory layout —
// applying is a server-side mutation. When the modal closes, the
// editor recommends refreshing the page so the DB and in-memory
// layouts don't diverge.

import { useState } from "react";

const YELLOW = "#FFB300";
const GREEN = "#10B981";
const RED = "#DC2626";

type Hit = {
  pageId: string;
  path: string;
  before: string;
  after: string;
  count: number;
};

type Props = {
  onClose: () => void;
  onApplied?: () => void;
};

export function StudioFindReplaceModal({ onClose, onApplied }: Props) {
  const [find, setFind] = useState("");
  const [replace, setReplace] = useState("");
  const [caseSensitive, setCaseSensitive] = useState(false);
  const [matchWord, setMatchWord] = useState(false);
  const [hits, setHits] = useState<Hit[] | null>(null);
  const [applied, setApplied] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function run(mode: "preview" | "apply") {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/studio/pages/find-replace", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ find, replace, caseSensitive, matchWord, mode })
      });
      const json = (await res.json()) as
        | { ok: true; hits: Hit[]; applied: boolean }
        | { ok: false; error: string };
      if (!res.ok || !json.ok) {
        setError("error" in json ? json.error : `HTTP ${res.status}`);
        setBusy(false);
        return;
      }
      setHits(json.hits);
      if (json.applied) {
        setApplied(true);
        onApplied?.();
      }
    } catch (err) {
      setError((err as Error)?.message ?? "network");
    } finally {
      setBusy(false);
    }
  }

  const byPage = new Map<string, Hit[]>();
  for (const h of hits ?? []) {
    const arr = byPage.get(h.pageId) ?? [];
    arr.push(h);
    byPage.set(h.pageId, arr);
  }

  const totalMatches =
    hits?.reduce((n, h) => n + h.count, 0) ?? 0;

  return (
    <div
      className="fixed inset-0 z-[300] flex items-start justify-center overflow-y-auto bg-black/60 p-4 pt-[6vh] backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
      aria-label="Find and replace"
      onClick={onClose}
    >
      <div
        className="w-full max-w-2xl overflow-hidden rounded-2xl bg-white shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <header className="border-b border-neutral-200 p-5">
          <p
            className="text-[10px] font-extrabold uppercase tracking-widest"
            style={{ color: YELLOW }}
          >
            ⌕ Find and replace
          </p>
          <h2 className="mt-1 text-[18px] font-extrabold text-neutral-900">
            Change text across every page
          </h2>
          <p className="mt-1 text-[12px] text-neutral-500">
            Searches string content in every section on every page of this
            brand. Preview matches before applying.
          </p>
        </header>

        <div className="p-5">
          <div className="grid gap-2 sm:grid-cols-2">
            <label className="block">
              <span className="text-[10px] font-extrabold uppercase tracking-widest text-neutral-500">
                Find
              </span>
              <input
                type="text"
                autoFocus
                value={find}
                onChange={(e) => setFind(e.target.value)}
                className="mt-1 h-10 w-full rounded-lg border border-neutral-300 bg-white px-3 text-[13px] font-medium"
              />
            </label>
            <label className="block">
              <span className="text-[10px] font-extrabold uppercase tracking-widest text-neutral-500">
                Replace with
              </span>
              <input
                type="text"
                value={replace}
                onChange={(e) => setReplace(e.target.value)}
                className="mt-1 h-10 w-full rounded-lg border border-neutral-300 bg-white px-3 text-[13px] font-medium"
              />
            </label>
          </div>

          <div className="mt-3 flex flex-wrap gap-4">
            <label className="inline-flex items-center gap-2 text-[12px] font-bold text-neutral-700">
              <input
                type="checkbox"
                checked={caseSensitive}
                onChange={(e) => setCaseSensitive(e.target.checked)}
              />
              Match case
            </label>
            <label className="inline-flex items-center gap-2 text-[12px] font-bold text-neutral-700">
              <input
                type="checkbox"
                checked={matchWord}
                onChange={(e) => setMatchWord(e.target.checked)}
              />
              Whole word only
            </label>
          </div>

          {error && (
            <p
              role="alert"
              className="mt-3 rounded-xl px-3 py-2 text-[12px] font-bold"
              style={{ background: "rgba(220,38,38,0.08)", color: RED }}
            >
              {error}
            </p>
          )}

          <div className="mt-4 flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => void run("preview")}
              disabled={busy || !find}
              className="inline-flex h-10 items-center rounded-xl px-4 text-[12px] font-extrabold uppercase tracking-widest text-neutral-900 transition disabled:cursor-not-allowed disabled:opacity-50 hover:enabled:brightness-95"
              style={{ background: YELLOW }}
            >
              {busy ? "Working…" : "Preview matches →"}
            </button>
            {hits && hits.length > 0 && !applied && (
              <button
                type="button"
                onClick={() => void run("apply")}
                disabled={busy}
                className="inline-flex h-10 items-center rounded-xl px-4 text-[12px] font-extrabold uppercase tracking-widest text-white transition disabled:cursor-not-allowed disabled:opacity-50 hover:enabled:brightness-110"
                style={{ background: GREEN }}
              >
                Apply {totalMatches} replacement{totalMatches === 1 ? "" : "s"} →
              </button>
            )}
          </div>

          {hits && (
            <div className="mt-6">
              {applied && (
                <p
                  className="mb-3 rounded-xl px-3 py-2 text-[12px] font-bold"
                  style={{
                    background: "rgba(16,185,129,0.08)",
                    color: GREEN
                  }}
                >
                  ✓ Applied {totalMatches} replacement
                  {totalMatches === 1 ? "" : "s"} — reload the editor to see
                  changes in the preview.
                </p>
              )}

              <p className="text-[10px] font-extrabold uppercase tracking-widest text-neutral-500">
                {hits.length === 0
                  ? "No matches"
                  : `${totalMatches} match${totalMatches === 1 ? "" : "es"} across ${byPage.size} page${byPage.size === 1 ? "" : "s"}`}
              </p>

              {Array.from(byPage.entries()).map(([pageId, pageHits]) => (
                <div key={pageId} className="mt-3">
                  <p className="font-mono text-[11px] font-bold text-neutral-500">
                    /{pageId}
                  </p>
                  <ul className="mt-1 space-y-1">
                    {pageHits.map((h, i) => (
                      <li
                        key={`${h.path}-${i}`}
                        className="rounded-lg border border-neutral-200 bg-white px-3 py-2 text-[11px]"
                      >
                        <p className="font-mono text-[10px] text-neutral-500">
                          {h.path}
                        </p>
                        <div className="mt-1 grid grid-cols-2 gap-2">
                          <p
                            className="rounded px-2 py-1 text-[11px]"
                            style={{
                              background: "rgba(220,38,38,0.05)",
                              color: RED,
                              textDecoration: "line-through"
                            }}
                          >
                            {truncate(h.before, 140)}
                          </p>
                          <p
                            className="rounded px-2 py-1 text-[11px] font-bold"
                            style={{
                              background: "rgba(16,185,129,0.06)",
                              color: GREEN
                            }}
                          >
                            {truncate(h.after, 140)}
                          </p>
                        </div>
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>
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

function truncate(s: string, n: number): string {
  if (s.length <= n) return s;
  return `${s.slice(0, n - 1)}…`;
}
