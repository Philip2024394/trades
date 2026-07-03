"use client";

// TemplatePagePicker — small modal on top of the preview modal that
// asks the merchant which page the section should be added to.
//
// Fetches pages from /api/studio/pages, defaults selection to the
// Home page, warns if the target page already has a section from the
// same library (e.g. picking a Hero when Home already has one).
// Confirming POSTs to /api/studio/templates/use and redirects to the
// page editor on success.

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";

const YELLOW = "#FFB300";
const BLACK = "#0A0A0A";
const GREEN = "#10B981";
const RED = "#DC2626";

type StudioPage = {
  id: string;
  slug: string;
  name: string;
  is_home: boolean;
};

type PagesResponse =
  | { ok: true; pages: StudioPage[] }
  | { ok: false; error: string };

type UseResponse =
  | { ok: true; layoutId: string; instanceId: string; version: number }
  | { ok: false; error: string };

type Status =
  | { kind: "loading-pages" }
  | { kind: "picking" }
  | { kind: "creating-page" }
  | { kind: "installing" }
  | { kind: "success"; pageSlug: string; instanceId: string }
  | { kind: "error"; message: string };

export function TemplatePagePicker({
  sectionId,
  sectionName,
  sectionLibrary,
  onClose
}: {
  sectionId: string;
  sectionName: string;
  sectionLibrary: string;
  onClose: () => void;
}) {
  const router = useRouter();
  const [status, setStatus] = useState<Status>({ kind: "loading-pages" });
  const [pages, setPages] = useState<StudioPage[]>([]);
  const [selectedPageSlug, setSelectedPageSlug] = useState<string>("");
  const [newPageName, setNewPageName] = useState("");
  const [creatingNewPage, setCreatingNewPage] = useState(false);

  // Fetch merchant's pages on open
  useEffect(() => {
    let cancelled = false;
    async function fetchPages() {
      try {
        const res = await fetch("/api/studio/pages");
        const json = (await res.json()) as PagesResponse;
        if (cancelled) return;
        if (!json.ok) {
          setStatus({
            kind: "error",
            message: `Couldn't load your pages — ${json.error}`
          });
          return;
        }
        setPages(json.pages);
        // Default to home page, or the first available
        const home = json.pages.find((p) => p.is_home);
        setSelectedPageSlug(home?.slug ?? json.pages[0]?.slug ?? "");
        setStatus({ kind: "picking" });
      } catch (err) {
        if (cancelled) return;
        setStatus({
          kind: "error",
          message: (err as Error).message ?? "Network error"
        });
      }
    }
    void fetchPages();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  async function addToPage(pageSlug: string) {
    setStatus({ kind: "installing" });
    try {
      const res = await fetch("/api/studio/templates/use", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sectionId, pageId: pageSlug })
      });
      const json = (await res.json()) as UseResponse;
      if (!res.ok || !json.ok) {
        setStatus({
          kind: "error",
          message:
            "error" in json ? json.error : `Failed with status ${res.status}`
        });
        return;
      }
      setStatus({
        kind: "success",
        pageSlug,
        instanceId: json.instanceId
      });
    } catch (err) {
      setStatus({
        kind: "error",
        message: (err as Error).message ?? "Network error"
      });
    }
  }

  async function createPageAndAdd() {
    const name = newPageName.trim();
    if (!name) return;
    setStatus({ kind: "creating-page" });
    // Auto-slug from name: lowercase, dashes
    const slug = name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 60);
    if (!slug) {
      setStatus({
        kind: "error",
        message: "That page name didn't produce a valid URL slug — try another."
      });
      return;
    }
    try {
      const create = await fetch("/api/studio/pages", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ slug, name })
      });
      const createJson = (await create.json()) as
        | { ok: true; page: StudioPage }
        | { ok: false; error: string };
      if (!create.ok || !createJson.ok) {
        setStatus({
          kind: "error",
          message: `Couldn't create the page — ${"error" in createJson ? createJson.error : create.statusText}`
        });
        return;
      }
      await addToPage(createJson.page.slug);
    } catch (err) {
      setStatus({
        kind: "error",
        message: (err as Error).message ?? "Network error"
      });
    }
  }

  const selectedPage = useMemo(
    () => pages.find((p) => p.slug === selectedPageSlug) ?? null,
    [pages, selectedPageSlug]
  );

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Choose a page for this template"
      className="fixed inset-0 z-[600] flex items-center justify-center bg-black/70 p-4"
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
            Use template
          </p>
          <h2 className="mt-1 text-[18px] font-extrabold text-neutral-900">
            Where should this {sectionLibrary} go?
          </h2>
          <p className="mt-1 text-[11px] text-neutral-500">
            {sectionName}
          </p>
        </header>

        <div className="p-5">
          {status.kind === "loading-pages" && (
            <p className="text-[13px] text-neutral-500">Loading your pages…</p>
          )}

          {status.kind === "picking" && (
            <>
              {pages.length === 0 && (
                <div className="rounded-xl border border-amber-200 bg-amber-50 p-3 text-[12px] text-amber-900">
                  You don&rsquo;t have any pages yet. Create one below and
                  we&rsquo;ll add this {sectionLibrary} to it.
                </div>
              )}

              {pages.length > 0 && !creatingNewPage && (
                <ul className="flex max-h-64 flex-col gap-1.5 overflow-y-auto">
                  {pages.map((p) => {
                    const isSelected = p.slug === selectedPageSlug;
                    return (
                      <li key={p.id}>
                        <button
                          type="button"
                          onClick={() => setSelectedPageSlug(p.slug)}
                          className="flex w-full items-center justify-between gap-3 rounded-xl border p-3 text-left transition"
                          style={{
                            borderColor: isSelected ? BLACK : "#E5E5E5",
                            background: isSelected ? "#FFFBEB" : "#FFFFFF"
                          }}
                        >
                          <div className="min-w-0">
                            <p className="text-[13px] font-extrabold text-neutral-900">
                              {p.name}
                              {p.is_home && (
                                <span
                                  className="ml-2 rounded-full px-2 py-0.5 text-[9px] font-extrabold uppercase tracking-widest"
                                  style={{ background: YELLOW, color: BLACK }}
                                >
                                  Home
                                </span>
                              )}
                            </p>
                            <p className="mt-0.5 font-mono text-[10px] text-neutral-500">
                              /{p.slug}
                            </p>
                          </div>
                          <span
                            className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full border-2"
                            style={{
                              borderColor: isSelected ? BLACK : "#D4D4D4",
                              background: isSelected ? BLACK : "transparent"
                            }}
                            aria-hidden="true"
                          >
                            {isSelected && (
                              <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="#FFFFFF" strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round">
                                <path d="M20 6 9 17l-5-5" />
                              </svg>
                            )}
                          </span>
                        </button>
                      </li>
                    );
                  })}
                </ul>
              )}

              {creatingNewPage && (
                <div className="space-y-3">
                  <label className="block">
                    <span className="text-[11px] font-extrabold uppercase tracking-widest text-neutral-600">
                      New page name
                    </span>
                    <input
                      type="text"
                      value={newPageName}
                      onChange={(e) => setNewPageName(e.target.value)}
                      placeholder="e.g. Services"
                      autoFocus
                      className="mt-1 w-full rounded-lg border border-neutral-300 bg-white px-3 py-2 text-[13px] outline-none focus:border-neutral-900"
                      maxLength={80}
                    />
                    <p className="mt-1 text-[10px] text-neutral-400">
                      Becomes{" "}
                      <code className="rounded bg-neutral-50 px-1 py-0.5 font-mono">
                        /
                        {newPageName
                          .toLowerCase()
                          .replace(/[^a-z0-9]+/g, "-")
                          .replace(/^-+|-+$/g, "") || "your-page"}
                      </code>
                    </p>
                  </label>
                  <button
                    type="button"
                    onClick={() => setCreatingNewPage(false)}
                    className="text-[11px] font-bold underline text-neutral-500"
                  >
                    ← Back to existing pages
                  </button>
                </div>
              )}

              {pages.length > 0 && !creatingNewPage && (
                <button
                  type="button"
                  onClick={() => setCreatingNewPage(true)}
                  className="mt-3 inline-flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-widest text-neutral-500 underline transition hover:text-neutral-900"
                >
                  + Create a new page instead
                </button>
              )}
            </>
          )}

          {status.kind === "creating-page" && (
            <p className="text-[13px] font-bold text-neutral-600">
              Creating page…
            </p>
          )}
          {status.kind === "installing" && (
            <p className="text-[13px] font-bold text-neutral-600">
              Adding to your page…
            </p>
          )}

          {status.kind === "success" && (
            <div
              className="rounded-xl border p-4"
              style={{ borderColor: GREEN, background: "rgba(16,185,129,0.08)" }}
            >
              <p
                className="text-[10px] font-extrabold uppercase tracking-widest"
                style={{ color: GREEN }}
              >
                Added ✓
              </p>
              <p className="mt-1 text-[13px] font-extrabold text-neutral-900">
                {sectionName} is on your{" "}
                <code className="rounded bg-white px-1 py-0.5 font-mono text-[11px]">
                  /{status.pageSlug}
                </code>{" "}
                page.
              </p>
            </div>
          )}

          {status.kind === "error" && (
            <div
              role="alert"
              className="rounded-xl px-3 py-2 text-[12px] font-bold"
              style={{ background: "rgba(220,38,38,0.08)", color: RED }}
            >
              {status.message}
            </div>
          )}
        </div>

        <footer className="flex items-center justify-end gap-2 border-t border-neutral-200 p-4">
          {status.kind === "success" ? (
            <>
              <button
                type="button"
                onClick={onClose}
                className="inline-flex h-10 items-center rounded-xl px-4 text-[12px] font-extrabold uppercase tracking-widest text-neutral-700 transition hover:bg-neutral-100"
              >
                Keep browsing
              </button>
              <button
                type="button"
                onClick={() => {
                  router.push(`/studio/pages/${status.pageSlug}`);
                }}
                className="inline-flex h-10 items-center gap-2 rounded-xl px-4 text-[12px] font-extrabold uppercase tracking-widest transition"
                style={{ background: YELLOW, color: BLACK }}
              >
                Open editor →
              </button>
            </>
          ) : (
            <>
              <button
                type="button"
                onClick={onClose}
                className="inline-flex h-10 items-center rounded-xl px-4 text-[12px] font-extrabold uppercase tracking-widest text-neutral-700 transition hover:bg-neutral-100"
                disabled={
                  status.kind === "installing" ||
                  status.kind === "creating-page"
                }
              >
                Cancel
              </button>
              {status.kind === "picking" && creatingNewPage && (
                <button
                  type="button"
                  onClick={() => void createPageAndAdd()}
                  disabled={newPageName.trim().length === 0}
                  className="inline-flex h-10 items-center gap-2 rounded-xl px-4 text-[12px] font-extrabold uppercase tracking-widest text-neutral-900 transition disabled:opacity-50"
                  style={{ background: YELLOW }}
                >
                  Create + add
                </button>
              )}
              {status.kind === "picking" && !creatingNewPage && pages.length > 0 && (
                <button
                  type="button"
                  onClick={() => void addToPage(selectedPageSlug)}
                  disabled={!selectedPageSlug}
                  className="inline-flex h-10 items-center gap-2 rounded-xl px-4 text-[12px] font-extrabold uppercase tracking-widest text-neutral-900 transition disabled:opacity-50"
                  style={{ background: YELLOW }}
                >
                  {selectedPage
                    ? `Add to ${selectedPage.name}`
                    : "Add to page"}
                </button>
              )}
              {status.kind === "picking" && pages.length === 0 && (
                <button
                  type="button"
                  onClick={() => setCreatingNewPage(true)}
                  className="inline-flex h-10 items-center gap-2 rounded-xl px-4 text-[12px] font-extrabold uppercase tracking-widest text-neutral-900 transition"
                  style={{ background: YELLOW }}
                >
                  Create a page →
                </button>
              )}
            </>
          )}
        </footer>
      </div>
    </div>
  );
}
