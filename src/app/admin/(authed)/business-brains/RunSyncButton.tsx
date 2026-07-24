"use client";

// Small client component — POSTs to the manual-sync endpoint and
// reflects the outcome in a toast + refresh.

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";

export default function RunSyncButton({ brainId }: { brainId: string }) {
  const router = useRouter();
  const [, startTransition] = useTransition();
  const [busy, setBusy] = useState<null | "sync" | "reextract">(null);
  const [msg, setMsg] = useState<string | null>(null);

  async function runSync() {
    if (busy) return;
    setBusy("sync");
    setMsg("Crawling — this may take a few minutes…");
    try {
      const res = await fetch(`/api/admin/business-brains/${brainId}/sync`, { method: "POST" });
      const json = await res.json();
      if (!res.ok || !json.ok) { setMsg(`Failed: ${json.error ?? res.statusText}`); return; }
      setMsg(
        `Synced · ${json.pagesCrawled} pages (${json.pagesAdded} new, ${json.pagesChanged} changed) · ` +
        `${json.productsFound} products · ${json.servicesFound} services · ${json.faqsFound} FAQs`
      );
      startTransition(() => router.refresh());
    } catch (e) {
      setMsg(`Error: ${e instanceof Error ? e.message : "unknown"}`);
    } finally { setBusy(null); }
  }

  async function reextract() {
    if (busy) return;
    setBusy("reextract");
    setMsg("Re-running extractors on stored pages…");
    try {
      const res = await fetch(`/api/admin/business-brains/${brainId}/reextract`, { method: "POST" });
      const json = await res.json();
      if (!res.ok || !json.ok) { setMsg(`Failed: ${json.error ?? res.statusText}`); return; }
      setMsg(
        `Re-extracted · ${json.pagesScanned} pages scanned · ${json.productsFound} products · ` +
        `${json.servicesFound} services · ${json.faqsFound} FAQs`
      );
      startTransition(() => router.refresh());
    } catch (e) {
      setMsg(`Error: ${e instanceof Error ? e.message : "unknown"}`);
    } finally { setBusy(null); }
  }

  return (
    <div className="flex flex-col items-end gap-1">
      <div className="flex gap-1">
        <button
          type="button"
          onClick={runSync}
          disabled={busy !== null}
          className="rounded border border-slate-300 bg-white px-2 py-1 text-[11px] font-medium text-slate-700 hover:bg-slate-100 disabled:opacity-50"
        >
          {busy === "sync" ? "Syncing…" : "Run sync"}
        </button>
        <button
          type="button"
          onClick={reextract}
          disabled={busy !== null}
          title="Re-run extractors on stored pages (no re-crawl)"
          className="rounded border border-slate-300 bg-white px-2 py-1 text-[11px] font-medium text-slate-700 hover:bg-slate-100 disabled:opacity-50"
        >
          {busy === "reextract" ? "Re-extracting…" : "Re-extract"}
        </button>
      </div>
      {msg && <span className="max-w-xs text-right text-[10px] text-slate-500">{msg}</span>}
    </div>
  );
}
