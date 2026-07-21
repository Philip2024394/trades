"use client";

// Client shell for the scheduled-posts dashboard tab. Three lists —
// pending, posted, failed — with cancel and reschedule actions on
// pending rows. Everything renders in the merchant's saved timezone.

import { useState, useTransition, useMemo } from "react";
import { Clock, Calendar, X, Send, AlertTriangle, RefreshCw, CheckCircle2 } from "lucide-react";

type Row = {
  id:             string;
  scheduled_for:  string;
  kind:           string;
  body:           string | null;
  photo_urls:     string[] | null;
  target_canteen: boolean;
  target_yard:    boolean;
  status:         string;
  posted_at:      string | null;
  failure_reason: string | null;
  created_at:     string;
};

const BRAND_YELLOW = "#FFB300";
const BRAND_BLACK  = "#0A0A0A";

function formatInTz(iso: string, tz: string): string {
  try {
    return new Intl.DateTimeFormat("en-GB", {
      timeZone:  tz,
      weekday:   "short",
      day:       "numeric",
      month:     "short",
      hour:      "2-digit",
      minute:    "2-digit"
    }).format(new Date(iso));
  } catch {
    return new Date(iso).toLocaleString();
  }
}

function relativeFromNow(iso: string): string {
  const ms = new Date(iso).getTime() - Date.now();
  if (ms <= 0) return "any moment";
  const s = Math.floor(ms / 1000);
  if (s < 60)      return `in ${s}s`;
  const m = Math.floor(s / 60);
  if (m < 60)      return `in ${m} min`;
  const h = Math.floor(m / 60);
  if (h < 24)      return `in ${h}h ${m % 60}m`;
  const d = Math.floor(h / 24);
  return `in ${d}d ${h % 24}h`;
}

export function ScheduledPostsShell({
  slug,
  timezone,
  merchantName,
  pending: initialPending,
  posted,
  failed
}: {
  slug:         string;
  timezone:     string;
  merchantName: string;
  pending:      Row[];
  posted:       Row[];
  failed:       Row[];
}) {
  const [pending, setPending] = useState<Row[]>(initialPending);
  const [rescheduling, setRescheduling] = useState<string | null>(null);
  const [rescheduleValue, setRescheduleValue] = useState<string>("");
  const [pending2, startTransition] = useTransition();

  const cancel = async (id: string) => {
    const ok = confirm("Cancel this scheduled post?");
    if (!ok) return;
    const res = await fetch(`/api/scheduled-posts/${id}`, { method: "DELETE" });
    if (res.ok) {
      startTransition(() => setPending((cur) => cur.filter((r) => r.id !== id)));
    } else {
      alert("Cancel failed. Please try again.");
    }
  };

  const reschedule = async (id: string) => {
    if (!rescheduleValue) return;
    const iso = new Date(rescheduleValue).toISOString();
    const res = await fetch(`/api/scheduled-posts/${id}`, {
      method:  "PATCH",
      headers: { "Content-Type": "application/json" },
      body:    JSON.stringify({ scheduled_for: iso })
    });
    if (res.ok) {
      startTransition(() => {
        setPending((cur) => cur.map((r) => r.id === id ? { ...r, scheduled_for: iso } : r).sort((a, b) => a.scheduled_for.localeCompare(b.scheduled_for)));
        setRescheduling(null);
        setRescheduleValue("");
      });
    } else {
      const data = await res.json().catch(() => ({} as { detail?: string; error?: string }));
      alert(data.detail ?? data.error ?? "Reschedule failed.");
    }
  };

  const stats = useMemo(() => ({
    pending: pending.length,
    posted:  posted.length,
    failed:  failed.length
  }), [pending.length, posted.length, failed.length]);

  return (
    <div className="mx-auto flex max-w-5xl flex-col gap-6 p-4 sm:p-6">
      {/* Header */}
      <header className="flex flex-col gap-2">
        <div className="flex items-center gap-2">
          <div className="h-2 w-2 rounded-full" style={{ backgroundColor: BRAND_YELLOW }}/>
          <span className="text-[11px] font-black uppercase tracking-[0.18em] text-neutral-500">
            Scheduled posts · {merchantName}
          </span>
        </div>
        <h1 className="text-2xl font-black leading-tight sm:text-3xl" style={{ color: BRAND_BLACK }}>
          Auto-post schedule
        </h1>
        <p className="text-sm text-neutral-600">
          Posts you've queued to drip out. Times shown in <b>{timezone}</b>.
          Every scheduled post appears in your canteen; a subset also lands on the yard feed.
        </p>
        <div className="flex flex-wrap gap-3 text-[12px] font-black uppercase tracking-wider">
          <span className="rounded-full bg-neutral-100 px-3 py-1"><Clock size={11} className="mr-1 inline"/> {stats.pending} pending</span>
          <span className="rounded-full bg-green-50 px-3 py-1 text-green-700"><CheckCircle2 size={11} className="mr-1 inline"/> {stats.posted} posted</span>
          {stats.failed > 0 && (
            <span className="rounded-full bg-red-50 px-3 py-1 text-red-700"><AlertTriangle size={11} className="mr-1 inline"/> {stats.failed} failed</span>
          )}
        </div>
      </header>

      {/* Pending */}
      <section className="flex flex-col gap-3">
        <h2 className="text-sm font-black uppercase tracking-wider text-neutral-700">Upcoming</h2>
        {pending.length === 0 ? (
          <EmptyState text="Nothing scheduled. Compose a post in the Site Editor and pick Schedule for later." />
        ) : (
          <ul className="flex flex-col gap-2">
            {pending.map((row) => (
              <li key={row.id} className="rounded-lg border bg-white p-3">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 text-[11px] font-black uppercase tracking-wider text-neutral-500">
                      <Calendar size={11}/> {formatInTz(row.scheduled_for, timezone)} · {relativeFromNow(row.scheduled_for)}
                    </div>
                    <p className="mt-1 line-clamp-2 text-sm text-neutral-800">{row.body || <em className="text-neutral-400">No caption</em>}</p>
                    <div className="mt-1 flex flex-wrap gap-1 text-[10px] font-black uppercase tracking-wider">
                      {row.target_canteen && <span className="rounded bg-yellow-100 px-1.5 py-0.5 text-yellow-800">Canteen</span>}
                      {row.target_yard    && <span className="rounded bg-green-100 px-1.5 py-0.5 text-green-800">Yard</span>}
                      <span className="rounded bg-neutral-100 px-1.5 py-0.5 text-neutral-700">{row.kind}</span>
                      {row.photo_urls && row.photo_urls.length > 0 && (
                        <span className="rounded bg-neutral-100 px-1.5 py-0.5 text-neutral-700">
                          {row.photo_urls.length} photo{row.photo_urls.length === 1 ? "" : "s"}
                        </span>
                      )}
                    </div>
                  </div>
                  <div className="flex gap-1">
                    <button
                      type="button"
                      onClick={() => { setRescheduling(row.id); setRescheduleValue(row.scheduled_for.slice(0, 16)); }}
                      className="inline-flex h-8 items-center gap-1 rounded-md border px-2 text-[11px] font-black uppercase tracking-wider hover:bg-neutral-50"
                    >
                      <RefreshCw size={11}/> Reschedule
                    </button>
                    <button
                      type="button"
                      onClick={() => cancel(row.id)}
                      disabled={pending2}
                      className="inline-flex h-8 items-center gap-1 rounded-md border border-red-200 px-2 text-[11px] font-black uppercase tracking-wider text-red-700 hover:bg-red-50 disabled:opacity-40"
                    >
                      <X size={11}/> Cancel
                    </button>
                  </div>
                </div>
                {rescheduling === row.id && (
                  <div className="mt-2 flex flex-wrap items-center gap-2 rounded-md bg-neutral-50 p-2">
                    <input
                      type="datetime-local"
                      value={rescheduleValue}
                      onChange={(e) => setRescheduleValue(e.target.value)}
                      className="h-8 rounded-md border px-2 text-[13px]"
                    />
                    <button
                      type="button"
                      onClick={() => reschedule(row.id)}
                      className="inline-flex h-8 items-center gap-1 rounded-md px-3 text-[11px] font-black uppercase tracking-wider"
                      style={{ backgroundColor: BRAND_YELLOW, color: BRAND_BLACK }}
                    >
                      Save
                    </button>
                    <button
                      type="button"
                      onClick={() => { setRescheduling(null); setRescheduleValue(""); }}
                      className="text-[11px] font-black uppercase tracking-wider text-neutral-500"
                    >
                      Discard
                    </button>
                  </div>
                )}
              </li>
            ))}
          </ul>
        )}
      </section>

      {/* Posted */}
      <section className="flex flex-col gap-3">
        <h2 className="text-sm font-black uppercase tracking-wider text-neutral-700">Recently posted</h2>
        {posted.length === 0 ? (
          <EmptyState text="No scheduled posts have gone live yet." />
        ) : (
          <ul className="flex flex-col gap-2">
            {posted.map((row) => (
              <li key={row.id} className="rounded-lg border bg-white p-3">
                <div className="flex items-center gap-2 text-[11px] font-black uppercase tracking-wider text-green-700">
                  <Send size={11}/> Posted · {row.posted_at ? formatInTz(row.posted_at, timezone) : "unknown"}
                </div>
                <p className="mt-1 line-clamp-2 text-sm text-neutral-800">{row.body || <em className="text-neutral-400">No caption</em>}</p>
                <div className="mt-1 flex flex-wrap gap-1 text-[10px] font-black uppercase tracking-wider">
                  {row.target_canteen && <span className="rounded bg-yellow-100 px-1.5 py-0.5 text-yellow-800">Canteen</span>}
                  {row.target_yard    && <span className="rounded bg-green-100 px-1.5 py-0.5 text-green-800">Yard</span>}
                  <span className="rounded bg-neutral-100 px-1.5 py-0.5 text-neutral-700">{row.kind}</span>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>

      {/* Failed */}
      {failed.length > 0 && (
        <section className="flex flex-col gap-3">
          <h2 className="text-sm font-black uppercase tracking-wider text-red-700">Failed</h2>
          <ul className="flex flex-col gap-2">
            {failed.map((row) => (
              <li key={row.id} className="rounded-lg border border-red-200 bg-red-50 p-3">
                <div className="flex items-center gap-2 text-[11px] font-black uppercase tracking-wider text-red-700">
                  <AlertTriangle size={11}/> Failed · scheduled for {formatInTz(row.scheduled_for, timezone)}
                </div>
                <p className="mt-1 line-clamp-2 text-sm text-neutral-800">{row.body || <em className="text-neutral-400">No caption</em>}</p>
                <p className="mt-1 text-[11px] text-red-800">
                  {row.failure_reason ?? "Unknown error"}
                </p>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}

function EmptyState({ text }: { text: string }) {
  return (
    <div className="rounded-lg border-2 border-dashed p-6 text-center text-sm text-neutral-500">
      {text}
    </div>
  );
}
