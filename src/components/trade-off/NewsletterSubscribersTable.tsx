"use client";

// Dashboard table for the Newsletter editor surface.
//
// Renders one row per active subscriber with: email, subscribed at,
// status pill, copy-to-clipboard button for the per-row unsubscribe
// URL. Empty state explains how subscribers land in the list. CSV
// export button up top hits /api/trade-off/newsletter/export.
//
// All static rendering — there's no row-level mutation (the merchant
// doesn't manage the list from this surface; subscribers self-manage
// via the unsubscribe link). Future: bounce / complaint webhooks
// from the merchant's email tool would flip status server-side.

import { useState } from "react";
import type { HammerexXratedNewsletterSubscriber } from "@/lib/supabase";

function fmtDate(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleString("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit"
  });
}

function unsubscribeUrl(token: string): string {
  if (typeof window === "undefined") {
    return `/newsletter/unsubscribe/${token}`;
  }
  return `${window.location.origin}/newsletter/unsubscribe/${token}`;
}

export function NewsletterSubscribersTable({
  slug,
  subscribers,
  exportHref
}: {
  slug: string;
  subscribers: HammerexXratedNewsletterSubscriber[];
  exportHref: string;
}) {
  const [copiedId, setCopiedId] = useState<string | null>(null);

  async function copyUnsub(id: string, token: string) {
    const url = unsubscribeUrl(token);
    try {
      await navigator.clipboard.writeText(url);
      setCopiedId(id);
      setTimeout(() => setCopiedId((cur) => (cur === id ? null : cur)), 1600);
    } catch {
      // Clipboard API blocked — fall back to prompt-style select.
      window.prompt("Copy this URL:", url);
    }
  }

  if (subscribers.length === 0) {
    return (
      <div className="rounded-2xl border border-brand-line bg-brand-surface p-6">
        <p className="text-[15px] font-extrabold text-brand-text">
          No subscribers yet
        </p>
        <p className="mt-2 text-[13px] text-brand-muted">
          As customers find your profile at{" "}
          <code className="rounded bg-brand-bg px-1.5 py-0.5 text-[12px]">
            /{slug}
          </code>{" "}
          and tap Subscribe in the footer, their emails will appear here. We
          store the consent text + timestamp + a hashed IP per row so your
          GDPR audit trail is complete.
        </p>
      </div>
    );
  }

  return (
    <div className="rounded-2xl border border-brand-line bg-brand-surface">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-brand-line p-4">
        <p className="text-[13px] font-bold text-brand-text">
          {subscribers.length} active subscriber
          {subscribers.length === 1 ? "" : "s"}
          {subscribers.length === 1000 ? " (showing latest 1,000)" : ""}
        </p>
        <a
          href={exportHref}
          className="inline-flex h-11 items-center rounded-xl bg-brand-accent px-4 text-[13px] font-extrabold text-black transition hover:opacity-90"
        >
          Export CSV &darr;
        </a>
      </div>

      {/* Mobile cards (≤sm) — table reads poorly on narrow phones. */}
      <ul className="divide-y divide-brand-line sm:hidden">
        {subscribers.map((s) => (
          <li key={s.id} className="p-4">
            <p className="break-all text-[13px] font-bold text-brand-text">
              {s.email}
            </p>
            <p className="mt-1 text-[12px] text-brand-muted">
              Subscribed {fmtDate(s.consent_at)}
            </p>
            <div className="mt-2 flex items-center gap-2">
              <StatusPill status={s.status} />
              <button
                type="button"
                onClick={() => copyUnsub(s.id, s.unsubscribe_token)}
                className="inline-flex h-9 items-center rounded-lg border border-brand-line bg-brand-bg px-3 text-[12px] font-bold text-brand-text transition hover:border-brand-accent hover:text-brand-accent"
              >
                {copiedId === s.id ? "Copied!" : "Copy unsubscribe URL"}
              </button>
            </div>
          </li>
        ))}
      </ul>

      {/* Desktop table */}
      <div className="hidden sm:block">
        <table className="w-full table-fixed border-collapse text-left">
          <thead>
            <tr className="border-b border-brand-line text-[12px] font-bold uppercase tracking-widest text-brand-muted">
              <th className="w-[45%] px-4 py-3">Email</th>
              <th className="w-[25%] px-4 py-3">Subscribed</th>
              <th className="w-[15%] px-4 py-3">Status</th>
              <th className="w-[15%] px-4 py-3 text-right">Unsubscribe</th>
            </tr>
          </thead>
          <tbody>
            {subscribers.map((s) => (
              <tr
                key={s.id}
                className="border-b border-brand-line last:border-b-0"
              >
                <td className="break-all px-4 py-3 text-[13px] font-semibold text-brand-text">
                  {s.email}
                </td>
                <td className="px-4 py-3 text-[13px] text-brand-muted">
                  {fmtDate(s.consent_at)}
                </td>
                <td className="px-4 py-3">
                  <StatusPill status={s.status} />
                </td>
                <td className="px-4 py-3 text-right">
                  <button
                    type="button"
                    onClick={() => copyUnsub(s.id, s.unsubscribe_token)}
                    className="inline-flex h-9 items-center rounded-lg border border-brand-line bg-brand-bg px-3 text-[12px] font-bold text-brand-text transition hover:border-brand-accent hover:text-brand-accent"
                  >
                    {copiedId === s.id ? "Copied!" : "Copy URL"}
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function StatusPill({
  status
}: {
  status: HammerexXratedNewsletterSubscriber["status"];
}) {
  const map: Record<
    HammerexXratedNewsletterSubscriber["status"],
    { label: string; cls: string }
  > = {
    active: {
      label: "Active",
      cls: "border-emerald-500/50 bg-emerald-500/10 text-emerald-300"
    },
    unsubscribed: {
      label: "Unsubscribed",
      cls: "border-brand-line bg-brand-bg text-brand-muted"
    },
    bounced: {
      label: "Bounced",
      cls: "border-amber-500/50 bg-amber-500/10 text-amber-300"
    },
    complained: {
      label: "Complained",
      cls: "border-red-500/50 bg-red-500/10 text-red-300"
    }
  };
  const meta = map[status];
  return (
    <span
      className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[11px] font-bold uppercase tracking-widest ${meta.cls}`}
    >
      {meta.label}
    </span>
  );
}
