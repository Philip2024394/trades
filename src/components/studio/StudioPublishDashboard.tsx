"use client";

// StudioPublishDashboard — the merchant-facing publish home screen.
//
// Fetches per-page publish state, shows pending change summaries, and
// lets the merchant:
//   • jump into a page's editor
//   • publish a page one-click from here
//   • create + copy shareable preview links for reviewers
//   • see recent preview links across the brand + revoke them
//
// All server-authoritative — the dashboard never mutates client state
// without a subsequent refetch.

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";

const YELLOW = "#FFB300";
const GREEN = "#10B981";
const RED = "#DC2626";
const AMBER = "#F59E0B";

type PageStatus = {
  pageId: string;
  name: string;
  isHome: boolean;
  hasDraft: boolean;
  hasPublished: boolean;
  latestPublishAt: string | null;
  latestPublishedVersion: number | null;
  pending: {
    summary: {
      added: number;
      removed: number;
      modified: number;
      swapped: number;
      total: number;
    };
    rowsChanged: boolean;
    changes: unknown[];
  } | null;
};

type PreviewLink = {
  id: string;
  page_id: string;
  token: string;
  source_kind: "draft" | "live" | "version";
  note: string | null;
  created_at: string;
  expires_at: string | null;
  view_count: number;
  last_viewed_at: string | null;
};

export function StudioPublishDashboard({ brandName }: { brandName: string }) {
  const [pages, setPages] = useState<PageStatus[] | null>(null);
  const [links, setLinks] = useState<PreviewLink[] | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setError(null);
    try {
      const [pagesRes, linksRes] = await Promise.all([
        fetch("/api/studio/publish/status"),
        fetch("/api/studio/publish/preview-links")
      ]);
      const pagesJson = (await pagesRes.json()) as
        | { ok: true; pages: PageStatus[] }
        | { ok: false; error: string };
      const linksJson = (await linksRes.json()) as
        | { ok: true; links: PreviewLink[] }
        | { ok: false; error: string };
      if (!pagesJson.ok) throw new Error(pagesJson.error);
      if (!linksJson.ok) throw new Error(linksJson.error);
      setPages(pagesJson.pages);
      setLinks(linksJson.links);
    } catch (err) {
      setError((err as Error)?.message ?? "network");
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  async function publish(pageId: string) {
    if (busy) return;
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/studio/publish", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ pageId })
      });
      const json = (await res.json()) as { ok: boolean; error?: string };
      if (!res.ok || !json.ok) {
        setError(json.error ?? `HTTP ${res.status}`);
        setBusy(false);
        return;
      }
      await load();
    } catch (err) {
      setError((err as Error)?.message ?? "network");
    } finally {
      setBusy(false);
    }
  }

  async function createShareLink(pageId: string, sourceKind: "draft" | "live") {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/studio/publish/preview-links", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ pageId, sourceKind })
      });
      const json = (await res.json()) as
        | { ok: true; link: PreviewLink }
        | { ok: false; error: string };
      if (!res.ok || !json.ok) {
        setError("error" in json ? json.error : `HTTP ${res.status}`);
        setBusy(false);
        return;
      }
      await load();
      // Auto-copy the fresh URL to clipboard so the merchant can paste
      // it into WhatsApp / email straight away.
      await copyLink(json.link.token);
    } catch (err) {
      setError((err as Error)?.message ?? "network");
    } finally {
      setBusy(false);
    }
  }

  async function revokeLink(linkId: string) {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/studio/publish/preview-links/${linkId}`, {
        method: "DELETE"
      });
      const json = (await res.json()) as { ok: boolean; error?: string };
      if (!res.ok || !json.ok) {
        setError(json.error ?? `HTTP ${res.status}`);
        setBusy(false);
        return;
      }
      await load();
    } catch (err) {
      setError((err as Error)?.message ?? "network");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="mx-auto max-w-5xl px-6 py-10 sm:py-14">
      <p
        className="text-[10px] font-extrabold uppercase tracking-widest"
        style={{ color: YELLOW }}
      >
        Publish
      </p>
      <h1 className="mt-2 text-3xl font-extrabold leading-tight text-neutral-900 sm:text-4xl">
        Ship what&rsquo;s ready
      </h1>
      <p className="mt-2 max-w-2xl text-[14px] leading-relaxed text-neutral-600">
        Every page for {brandName}. Publish promotes your current draft
        into a new immutable snapshot — restorable from version history
        any time.
      </p>

      {error && (
        <p
          role="alert"
          className="mt-4 rounded-xl px-3 py-2 text-[12px] font-bold"
          style={{ background: "rgba(220,38,38,0.08)", color: RED }}
        >
          {error}
        </p>
      )}

      <section className="mt-8">
        <h2 className="text-[10px] font-extrabold uppercase tracking-widest text-neutral-500">
          Pages
        </h2>
        {!pages ? (
          <p className="mt-3 text-[13px] font-bold text-neutral-500">Loading…</p>
        ) : (
          <ul className="mt-3 space-y-2">
            {pages.map((p) => (
              <li key={p.pageId}>
                <PageStatusRow
                  page={p}
                  busy={busy}
                  onPublish={() => void publish(p.pageId)}
                  onShareDraft={() => void createShareLink(p.pageId, "draft")}
                  onShareLive={() => void createShareLink(p.pageId, "live")}
                />
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="mt-10">
        <h2 className="text-[10px] font-extrabold uppercase tracking-widest text-neutral-500">
          Recent reviewer links
        </h2>
        {!links ? (
          <p className="mt-3 text-[13px] font-bold text-neutral-500">Loading…</p>
        ) : links.length === 0 ? (
          <p className="mt-3 text-[12px] italic text-neutral-500">
            No active reviewer links. Use &ldquo;Share draft&rdquo; or &ldquo;Share live&rdquo;
            on a page to mint one.
          </p>
        ) : (
          <ul className="mt-3 space-y-2">
            {links.map((l) => (
              <li key={l.id}>
                <PreviewLinkRow link={l} onRevoke={() => void revokeLink(l.id)} busy={busy} />
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}

// ─── Rows ────────────────────────────────────────────────────

function PageStatusRow({
  page,
  busy,
  onPublish,
  onShareDraft,
  onShareLive
}: {
  page: PageStatus;
  busy: boolean;
  onPublish: () => void;
  onShareDraft: () => void;
  onShareLive: () => void;
}) {
  const pending = page.pending?.summary.total ?? 0;
  const pill =
    pending > 0
      ? { bg: AMBER, label: `${pending} change${pending === 1 ? "" : "s"} pending` }
      : page.hasPublished
        ? { bg: GREEN, label: "Up to date" }
        : { bg: "#404040", label: "Not published" };

  return (
    <div className="rounded-2xl border border-neutral-200 bg-white p-4 shadow-sm">
      <div className="flex flex-wrap items-center gap-3">
        <div className="min-w-0 flex-1">
          <p className="text-[15px] font-extrabold text-neutral-900">
            {page.name}
            {page.isHome && (
              <span
                className="ml-2 rounded-full px-2 py-0.5 text-[9px] font-extrabold uppercase tracking-widest text-neutral-900"
                style={{ background: YELLOW }}
              >
                Home
              </span>
            )}
          </p>
          <p className="font-mono text-[11px] text-neutral-500">/{page.pageId}</p>
        </div>
        <span
          className="rounded-full px-2.5 py-1 text-[10px] font-extrabold uppercase tracking-widest text-white"
          style={{ background: pill.bg }}
        >
          {pill.label}
        </span>
      </div>

      <div className="mt-3 flex flex-wrap items-center gap-4 text-[11px] text-neutral-600">
        {page.latestPublishAt ? (
          <span>
            Last published{" "}
            <span className="font-bold text-neutral-900">
              {new Date(page.latestPublishAt).toLocaleString()}
            </span>{" "}
            (v{page.latestPublishedVersion})
          </span>
        ) : (
          <span className="italic">Never published</span>
        )}
        {page.pending && page.pending.summary.total > 0 && (
          <PendingBreakdown summary={page.pending.summary} rowsChanged={page.pending.rowsChanged} />
        )}
      </div>

      <div className="mt-4 flex flex-wrap gap-2">
        <Link
          href={`/studio/pages/${page.pageId}`}
          className="inline-flex h-9 items-center rounded-lg border border-neutral-300 px-3 text-[11px] font-extrabold uppercase tracking-widest text-neutral-700 transition hover:bg-neutral-50"
        >
          Open editor
        </Link>
        <button
          type="button"
          onClick={onPublish}
          disabled={busy || pending === 0}
          className="inline-flex h-9 items-center rounded-lg px-3 text-[11px] font-extrabold uppercase tracking-widest text-white transition disabled:cursor-not-allowed disabled:opacity-50 hover:enabled:brightness-110"
          style={{ background: pending > 0 ? GREEN : "#404040" }}
        >
          Publish this page →
        </button>
        <button
          type="button"
          onClick={onShareDraft}
          disabled={busy || !page.hasDraft}
          className="inline-flex h-9 items-center rounded-lg border border-neutral-300 px-3 text-[11px] font-extrabold uppercase tracking-widest text-neutral-700 transition disabled:cursor-not-allowed disabled:opacity-50 hover:enabled:bg-neutral-50"
        >
          Share draft
        </button>
        <button
          type="button"
          onClick={onShareLive}
          disabled={busy || !page.hasPublished}
          className="inline-flex h-9 items-center rounded-lg border border-neutral-300 px-3 text-[11px] font-extrabold uppercase tracking-widest text-neutral-700 transition disabled:cursor-not-allowed disabled:opacity-50 hover:enabled:bg-neutral-50"
        >
          Share live
        </button>
      </div>
    </div>
  );
}

function PendingBreakdown({
  summary,
  rowsChanged
}: {
  summary: PageStatus["pending"] extends infer T ? (T extends null ? never : T extends { summary: infer S } ? S : never) : never;
  rowsChanged: boolean;
}) {
  const bits: { label: string; count: number; colour: string }[] = [
    { label: "added", count: summary.added, colour: GREEN },
    { label: "modified", count: summary.modified, colour: AMBER },
    { label: "swapped", count: summary.swapped, colour: YELLOW },
    { label: "removed", count: summary.removed, colour: RED }
  ];
  return (
    <span className="flex items-center gap-2">
      {bits
        .filter((b) => b.count > 0)
        .map((b) => (
          <span key={b.label} className="font-bold" style={{ color: b.colour }}>
            {b.count} {b.label}
          </span>
        ))}
      {rowsChanged && (
        <span className="rounded-full bg-neutral-100 px-2 py-0.5 text-[10px] font-extrabold uppercase tracking-widest text-neutral-700">
          Row order changed
        </span>
      )}
    </span>
  );
}

function PreviewLinkRow({
  link,
  onRevoke,
  busy
}: {
  link: PreviewLink;
  onRevoke: () => void;
  busy: boolean;
}) {
  const [copied, setCopied] = useState(false);
  const url =
    typeof window !== "undefined"
      ? `${window.location.origin}/studio/share/${link.token}`
      : `/studio/share/${link.token}`;

  async function copy() {
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      /* noop */
    }
  }

  const kindLabel =
    link.source_kind === "draft"
      ? "Draft"
      : link.source_kind === "live"
        ? "Live"
        : "Historical";

  return (
    <div className="rounded-xl border border-neutral-200 bg-white p-3">
      <div className="flex items-center gap-3">
        <span
          className="rounded-full px-2 py-0.5 text-[9px] font-extrabold uppercase tracking-widest text-white"
          style={{ background: link.source_kind === "live" ? GREEN : "#0A0A0A" }}
        >
          {kindLabel}
        </span>
        <div className="min-w-0 flex-1">
          <p className="truncate font-mono text-[11px] text-neutral-900">
            /studio/share/{link.token}
          </p>
          <p className="text-[10px] text-neutral-500">
            /{link.page_id} · created{" "}
            {new Date(link.created_at).toLocaleDateString()}
            {link.expires_at && (
              <> · expires {new Date(link.expires_at).toLocaleDateString()}</>
            )}
            {link.last_viewed_at
              ? ` · last opened ${new Date(link.last_viewed_at).toLocaleDateString()}`
              : " · never opened"}
          </p>
        </div>
        <button
          type="button"
          onClick={copy}
          className="inline-flex h-8 items-center rounded-lg px-3 text-[11px] font-extrabold uppercase tracking-widest text-neutral-900 transition hover:brightness-95"
          style={{ background: YELLOW }}
        >
          {copied ? "Copied ✓" : "Copy URL"}
        </button>
        <button
          type="button"
          onClick={onRevoke}
          disabled={busy}
          className="rounded-md px-2 py-1 text-[10px] font-extrabold uppercase tracking-widest text-neutral-500 hover:bg-neutral-100 disabled:opacity-50"
        >
          Revoke
        </button>
      </div>
    </div>
  );
}

async function copyLink(token: string): Promise<void> {
  if (typeof window === "undefined") return;
  const url = `${window.location.origin}/studio/share/${token}`;
  try {
    await navigator.clipboard.writeText(url);
  } catch {
    /* noop */
  }
}
