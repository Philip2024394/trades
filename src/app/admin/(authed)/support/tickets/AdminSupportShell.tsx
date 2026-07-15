"use client";

// Admin support-ticket queue. Left column: list ordered by severity
// (urgent first) + SLA deadline. Right column: focused ticket with
// resolve / close / mark-spam actions + restore-content toggle for
// auto-hidden targets.

import { useCallback, useMemo, useState } from "react";
import Link from "next/link";
import { ArrowLeft, AlertTriangle, Check, ChevronLeft, ChevronRight, Clock, Loader2, X } from "lucide-react";
import type { SupportTicket, TicketStatus } from "@/lib/supportTickets";

const CREAM = "#FBF6EC";
const BRAND_BLACK = "#0A0A0A";
const BRAND_YELLOW = "#FFB300";
const GREEN = "#166534";
const RED = "#B91C1C";

const SEVERITY_COLOR: Record<string, string> = {
  urgent: RED,
  high:   "#B45309",
  normal: BRAND_YELLOW,
  low:    "#6B7280"
};

export function AdminSupportShell({ initialTickets }: { initialTickets: SupportTicket[] }) {
  const [tickets, setTickets] = useState<SupportTicket[]>(initialTickets);
  const [index, setIndex] = useState(0);
  const [pending, setPending] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [noteDraft, setNoteDraft] = useState("");
  const [resolutionDraft, setResolutionDraft] = useState("");
  const [restoreContent, setRestoreContent] = useState(false);

  const current = tickets[Math.min(index, tickets.length - 1)] ?? null;

  const goto = useCallback((next: number) => {
    if (tickets.length === 0) return;
    setIndex(((next % tickets.length) + tickets.length) % tickets.length);
    setNoteDraft("");
    setResolutionDraft("");
    setRestoreContent(false);
    setError(null);
  }, [tickets.length]);

  const decide = useCallback(async (status: TicketStatus) => {
    if (!current || pending) return;
    setPending(current.id);
    setError(null);
    try {
      const res = await fetch(`/api/admin/support/tickets/${encodeURIComponent(current.id)}/moderate`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          status,
          resolution: resolutionDraft.trim() || null,
          moderatorNote: noteDraft.trim() || null,
          restoreContent
        })
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data.ok) {
        setError(data.error ?? "moderate-failed");
        return;
      }
      setTickets((prev) => prev.filter((t) => t.id !== current.id));
      setIndex((i) => (i >= tickets.length - 1 ? Math.max(0, tickets.length - 2) : i));
      setNoteDraft("");
      setResolutionDraft("");
      setRestoreContent(false);
    } finally {
      setPending(null);
    }
  }, [current, pending, noteDraft, resolutionDraft, restoreContent, tickets.length]);

  const overdue = useMemo(() => (t: SupportTicket) => Date.parse(t.slaDeadlineAt) < Date.now(), []);

  return (
    <main className="min-h-screen" style={{ backgroundColor: CREAM }}>
      <header className="border-b bg-white" style={{ borderColor: "rgba(139,69,19,0.15)" }}>
        <div className="mx-auto flex max-w-7xl items-center gap-3 px-4 py-3 md:px-6">
          <Link href="/admin/support" className="inline-flex items-center gap-1 text-[11px] font-black uppercase tracking-wider text-neutral-500 hover:text-neutral-900">
            <ArrowLeft size={12}/> Support
          </Link>
          <span className="text-neutral-300">/</span>
          <h1 className="text-[15px] font-black text-neutral-900">Ticket queue</h1>
          <span className="rounded-full bg-neutral-900 px-2 py-0.5 text-[10px] font-black text-white">{tickets.length}</span>
        </div>
      </header>

      {tickets.length === 0 ? (
        <div className="mx-auto max-w-3xl px-4 py-16 text-center md:px-6">
          <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full" style={{ backgroundColor: `${GREEN}18` }}>
            <Check size={22} strokeWidth={2.6} style={{ color: GREEN }}/>
          </div>
          <h2 className="mt-3 text-[20px] font-black text-neutral-900">All clear.</h2>
          <p className="mt-1 text-[13px] text-neutral-600">No open tickets in the queue.</p>
        </div>
      ) : (
        <div className="mx-auto grid max-w-7xl gap-4 px-4 py-6 md:grid-cols-[minmax(0,280px)_minmax(0,1fr)] md:px-6">
          <aside className="max-h-[calc(100vh-140px)] overflow-y-auto rounded-2xl border bg-white p-2" style={{ borderColor: "rgba(139,69,19,0.15)" }}>
            <ul className="flex flex-col gap-1">
              {tickets.map((t, i) => (
                <li key={t.id}>
                  <button
                    type="button"
                    onClick={() => setIndex(i)}
                    className="flex w-full items-start gap-2 rounded-lg p-1.5 text-left transition"
                    style={{
                      backgroundColor: i === index ? "rgba(184,134,11,0.12)" : "transparent",
                      borderLeft: i === index ? `3px solid ${BRAND_YELLOW}` : "3px solid transparent"
                    }}
                  >
                    <span className="mt-1 inline-block h-2 w-2 flex-shrink-0 rounded-full" style={{ backgroundColor: SEVERITY_COLOR[t.severity] ?? BRAND_YELLOW }} aria-hidden/>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-baseline justify-between gap-2">
                        <span className="text-[10px] font-black uppercase tracking-wider text-neutral-500">{t.kind.replace(/_/g, " ")}</span>
                        {overdue(t) && <span className="inline-flex items-center gap-0.5 text-[9px] font-black uppercase tracking-wider" style={{ color: RED }}><AlertTriangle size={8}/>OVERDUE</span>}
                      </div>
                      <div className="truncate text-[11.5px] font-black text-neutral-900">{t.subject}</div>
                      <div className="truncate text-[10px] text-neutral-500">{t.reporterName}</div>
                    </div>
                  </button>
                </li>
              ))}
            </ul>
          </aside>

          <section className="flex min-h-[calc(100vh-140px)] flex-col rounded-2xl border bg-white p-4 shadow-sm md:p-6" style={{ borderColor: "rgba(139,69,19,0.15)" }}>
            {current && (
              <>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <button type="button" onClick={() => goto(index - 1)} className="flex h-8 w-8 items-center justify-center rounded-full border" style={{ borderColor: "rgba(139,69,19,0.15)" }} aria-label="Previous"><ChevronLeft size={14}/></button>
                    <span className="text-[11px] font-black uppercase tracking-wider text-neutral-500">{index + 1} / {tickets.length}</span>
                    <button type="button" onClick={() => goto(index + 1)} className="flex h-8 w-8 items-center justify-center rounded-full border" style={{ borderColor: "rgba(139,69,19,0.15)" }} aria-label="Next"><ChevronRight size={14}/></button>
                  </div>
                  <span className="inline-flex items-center gap-1 rounded-full px-2 py-1 text-[10px] font-black uppercase tracking-wider" style={{ backgroundColor: `${SEVERITY_COLOR[current.severity]}18`, color: SEVERITY_COLOR[current.severity] }}>
                    <AlertTriangle size={10}/>{current.severity}
                  </span>
                </div>

                <div className="mt-3">
                  <div className="text-[10px] font-black uppercase tracking-[0.14em] text-neutral-500">
                    {current.kind.replace(/_/g, " ")}
                    <span className="mx-1.5">·</span>
                    <Clock size={10} className="inline"/>{" "}
                    SLA {new Date(current.slaDeadlineAt).toLocaleString()}
                  </div>
                  <h2 className="mt-1 text-[19px] font-black leading-tight text-neutral-900">{current.subject}</h2>
                </div>

                <div className="mt-3 grid gap-3 md:grid-cols-[minmax(0,1fr)_minmax(0,260px)]">
                  <div className="rounded-xl border p-3 text-[12.5px] leading-relaxed text-neutral-800 whitespace-pre-wrap" style={{ borderColor: "rgba(139,69,19,0.15)" }}>
                    {current.description}
                  </div>
                  <div className="flex flex-col gap-2 text-[11.5px]">
                    <MetaRow label="Reporter" value={`${current.reporterName} <${current.reporterEmail}>`}/>
                    {current.reporterPhone && <MetaRow label="Phone" value={current.reporterPhone}/>}
                    {current.reporterSlug && <MetaRow label="Signed in as" value={current.reporterSlug}/>}
                    {current.reporterIp && <MetaRow label="IP" value={current.reporterIp} mono/>}
                    {current.targetKind && <MetaRow label="Target" value={`${current.targetKind} · ${current.targetId ?? "—"}`} mono/>}
                    {current.targetUrl && <MetaRow label="URL" value={current.targetUrl} link/>}
                    {current.claimedOwnership && <MetaRow label="Ownership claim" value={current.claimedOwnership}/>}
                    {current.swornStatement && <span className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-black uppercase tracking-wider" style={{ backgroundColor: `${GREEN}18`, color: GREEN }}><Check size={9}/>Sworn</span>}
                    <MetaRow label="Received" value={new Date(current.createdAt).toLocaleString()}/>
                    {current.attachmentUrls.length > 0 && (
                      <div>
                        <div className="text-[9.5px] font-black uppercase tracking-[0.14em] text-neutral-500">Attachments</div>
                        <ul className="mt-1 flex flex-col gap-0.5">
                          {current.attachmentUrls.map((u, i) => (
                            <li key={i}><a href={u} target="_blank" rel="noopener noreferrer" className="text-[11px] underline">{u.split("/").pop()}</a></li>
                          ))}
                        </ul>
                      </div>
                    )}
                  </div>
                </div>

                <div className="mt-4 flex flex-col gap-2">
                  <input type="text" value={resolutionDraft} onChange={(e) => setResolutionDraft(e.target.value.slice(0, 500))} placeholder="Resolution (one-liner, visible to reporter)" className="rounded-lg border bg-white px-3 py-2 text-[12.5px] focus:outline-none focus:ring-2" style={{ borderColor: "rgba(139,69,19,0.15)" }}/>
                  <input type="text" value={noteDraft} onChange={(e) => setNoteDraft(e.target.value.slice(0, 500))} placeholder="Admin note (internal only)" className="rounded-lg border bg-white px-3 py-2 text-[12.5px] focus:outline-none focus:ring-2" style={{ borderColor: "rgba(139,69,19,0.15)" }}/>
                  {(current.kind === "csam_report" || current.kind === "sexual_content") && (
                    <label className="flex cursor-pointer items-center gap-2 text-[11.5px] text-neutral-700">
                      <input type="checkbox" checked={restoreContent} onChange={(e) => setRestoreContent(e.target.checked)} className="h-4 w-4"/>
                      Restore auto-hidden content (report was false / malicious)
                    </label>
                  )}
                </div>

                {error && (
                  <div className="mt-2 rounded-lg bg-red-50 px-3 py-2 text-[11.5px] font-black" style={{ color: RED }}>{error}</div>
                )}

                <div className="mt-auto flex gap-2 pt-4">
                  <button type="button" onClick={() => decide("spam")} disabled={pending === current.id} className="inline-flex items-center gap-1 rounded-full border px-3 py-2 text-[10.5px] font-black uppercase tracking-wider text-neutral-700 hover:bg-neutral-50 disabled:opacity-50" style={{ borderColor: "rgba(139,69,19,0.15)" }}>
                    Mark spam
                  </button>
                  <button type="button" onClick={() => decide("closed")} disabled={pending === current.id} className="inline-flex items-center gap-1 rounded-full border px-3 py-2 text-[10.5px] font-black uppercase tracking-wider text-neutral-700 hover:bg-neutral-50 disabled:opacity-50" style={{ borderColor: "rgba(139,69,19,0.15)" }}>
                    <X size={11}/>Close
                  </button>
                  <button type="button" onClick={() => decide("resolved")} disabled={pending === current.id} className="ml-auto inline-flex items-center gap-1 rounded-full px-4 py-2 text-[11px] font-black uppercase tracking-wider text-white shadow-md disabled:opacity-50" style={{ backgroundColor: GREEN }}>
                    {pending === current.id ? <Loader2 size={11} className="animate-spin"/> : <Check size={11}/>}
                    Resolve
                  </button>
                </div>
              </>
            )}
          </section>
        </div>
      )}
    </main>
  );
}

function MetaRow({ label, value, mono, link }: { label: string; value: string; mono?: boolean; link?: boolean }) {
  return (
    <div>
      <div className="text-[9.5px] font-black uppercase tracking-[0.14em] text-neutral-500">{label}</div>
      {link ? (
        <a href={value} target="_blank" rel="noopener noreferrer" className="mt-0.5 block break-all text-[12px] text-neutral-800 underline">{value}</a>
      ) : (
        <div className={`mt-0.5 break-all text-[12px] text-neutral-800 ${mono ? "font-mono text-[11.5px]" : ""}`}>{value}</div>
      )}
    </div>
  );
}
