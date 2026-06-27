"use client";

// Dashboard — Captured emails tab. Fetches /api/trade-off/downloads/leads
// on mount, renders a table grouped by source file with a per-file
// filter and a client-side CSV export.

import { useEffect, useMemo, useState } from "react";

type Lead = {
  id: string;
  download_id: string;
  customer_email: string;
  customer_name: string | null;
  ip_hash: string | null;
  downloaded_at: string;
};
type DownloadStub = { id: string; name: string };

export function DownloadsLeadsTable({
  slug,
  editToken
}: {
  slug: string;
  editToken: string;
}) {
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);
  const [downloads, setDownloads] = useState<DownloadStub[]>([]);
  const [leads, setLeads] = useState<Lead[]>([]);
  const [filterId, setFilterId] = useState<string>("");

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch(
          `/api/trade-off/downloads/leads?slug=${encodeURIComponent(slug)}&edit_token=${encodeURIComponent(editToken)}`
        );
        const json = await res.json();
        if (cancelled) return;
        if (!json.ok) {
          setErr(json.error ?? "Couldn't load leads.");
          return;
        }
        setDownloads(json.downloads ?? []);
        setLeads(json.leads ?? []);
      } catch {
        if (!cancelled) setErr("Network error — refresh to try again.");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [slug, editToken]);

  const nameById = useMemo(() => {
    const m = new Map<string, string>();
    for (const d of downloads) m.set(d.id, d.name);
    return m;
  }, [downloads]);

  const visibleLeads = useMemo(() => {
    if (!filterId) return leads;
    return leads.filter((l) => l.download_id === filterId);
  }, [leads, filterId]);

  function exportCsv() {
    const header = ["File", "Email", "Name", "IP hash", "Downloaded at"];
    const rows = visibleLeads.map((l) => [
      nameById.get(l.download_id) ?? "(deleted)",
      l.customer_email,
      l.customer_name ?? "",
      (l.ip_hash ?? "").slice(0, 6),
      l.downloaded_at
    ]);
    const csv = [header, ...rows]
      .map((r) =>
        r
          .map((cell) => {
            const v = String(cell ?? "");
            return /[",\n]/.test(v) ? `"${v.replace(/"/g, '""')}"` : v;
          })
          .join(",")
      )
      .join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `downloads-leads-${slug}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }

  if (loading) {
    return (
      <p className="rounded-lg border border-dashed border-brand-line bg-brand-bg px-4 py-6 text-center text-[13px] text-brand-muted">
        Loading captured emails&hellip;
      </p>
    );
  }
  if (err) {
    return (
      <p className="rounded-lg border border-red-500/40 bg-red-500/10 px-3 py-2 text-[13px] font-semibold text-red-300">
        {err}
      </p>
    );
  }
  if (leads.length === 0) {
    return (
      <p className="rounded-lg border border-dashed border-brand-line bg-brand-bg px-4 py-6 text-center text-[13px] text-brand-muted">
        No emails captured yet. Turn on the email-gate for one of your
        files to start collecting leads.
      </p>
    );
  }

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <label className="flex items-center gap-2 text-[13px] font-bold text-brand-text">
          <span>Filter:</span>
          <select
            value={filterId}
            onChange={(e) => setFilterId(e.target.value)}
            className="block h-11 rounded-md border border-brand-line bg-brand-surface px-3 text-[13px] text-brand-text outline-none focus:border-brand-accent"
          >
            <option value="">All files</option>
            {downloads.map((d) => (
              <option key={d.id} value={d.id}>
                {d.name}
              </option>
            ))}
          </select>
        </label>
        <button
          type="button"
          onClick={exportCsv}
          className="inline-flex h-11 items-center rounded-lg border border-brand-line bg-brand-surface px-4 text-[13px] font-bold text-brand-text transition hover:border-brand-accent hover:text-brand-accent"
        >
          Export CSV
        </button>
      </div>

      <div className="overflow-x-auto rounded-lg border border-brand-line bg-brand-bg">
        <table className="w-full text-left text-[13px] text-brand-text">
          <thead className="bg-brand-surface text-[10px] font-bold uppercase tracking-widest text-brand-muted">
            <tr>
              <th className="px-3 py-2">File</th>
              <th className="px-3 py-2">Email</th>
              <th className="px-3 py-2">Name</th>
              <th className="px-3 py-2">IP</th>
              <th className="px-3 py-2">When</th>
            </tr>
          </thead>
          <tbody>
            {visibleLeads.map((l) => (
              <tr key={l.id} className="border-t border-brand-line">
                <td className="px-3 py-2 align-top">
                  {nameById.get(l.download_id) ?? (
                    <span className="text-brand-muted">(deleted)</span>
                  )}
                </td>
                <td className="px-3 py-2 align-top font-mono">{l.customer_email}</td>
                <td className="px-3 py-2 align-top">{l.customer_name ?? ""}</td>
                <td className="px-3 py-2 align-top text-brand-muted">
                  {(l.ip_hash ?? "").slice(0, 6)}
                </td>
                <td className="px-3 py-2 align-top text-brand-muted">
                  {new Date(l.downloaded_at).toLocaleString("en-GB")}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
