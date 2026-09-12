// src/app/nexapp/founder-window/FounderWindowClient.tsx
//
// Founder's Window · client component.
//
// Live SSE subscription to /api/nex/founder-window/stream · polling for
// status probes + flow counts every 5s. Every displayed number is real.

"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";

type Subsystem = {
  subsystem: string;
  status: "green" | "yellow" | "red" | "unknown" | "not_implemented";
  reason: string;
  metrics: Record<string, unknown>;
  reference: Record<string, unknown>;
};

type StageCount = {
  stage: number;
  name: string;
  count_1h: number;
  count_24h: number;
  count_total: number;
  source_tables: string[];
  note: string | null;
};

type EventRow = {
  event_id: string;
  emitted_at: string;
  subsystem: string;
  event_kind: string;
  status: "info" | "ok" | "warning" | "error" | "critical";
  request_id: string | null;
  actor: string | null;
  subject_ref: string | null;
  message: string | null;
  reference: Record<string, unknown> | null;
  duration_ms: number | null;
};

const STATUS_COLOR: Record<string, string> = {
  green: "bg-emerald-500/20 border-emerald-500/60 text-emerald-300",
  yellow: "bg-amber-500/20 border-amber-500/60 text-amber-300",
  red: "bg-rose-500/20 border-rose-500/60 text-rose-300",
  unknown: "bg-neutral-500/20 border-neutral-500/60 text-neutral-300",
  not_implemented: "bg-neutral-800 border-neutral-700 text-neutral-500",
};

const EVENT_STATUS_COLOR: Record<string, string> = {
  info: "text-neutral-400",
  ok: "text-emerald-400",
  warning: "text-amber-400",
  error: "text-rose-400",
  critical: "text-rose-500 font-semibold",
};

const SUBSYSTEM_LABEL: Record<string, string> = {
  code_execution: "Code Execution",
  voice: "Voice",
  ocr: "OCR",
  api_mcp: "API / MCP",
  storage: "Storage",
};

export default function FounderWindowClient() {
  const [subsystems, setSubsystems] = useState<Subsystem[]>([]);
  const [stages, setStages] = useState<StageCount[]>([]);
  const [events, setEvents] = useState<EventRow[]>([]);
  const [connected, setConnected] = useState(false);
  const [filterSubsystem, setFilterSubsystem] = useState<string>("all");
  const [filterStatus, setFilterStatus] = useState<string>("all");
  const [lastRefresh, setLastRefresh] = useState<string>("");

  const eventsRef = useRef<EventRow[]>([]);
  eventsRef.current = events;

  // Poll status + flow-counts every 5s
  const pollHealth = useCallback(async () => {
    try {
      const [s, f] = await Promise.all([
        fetch("/api/nex/founder-window/status", { cache: "no-store" }).then((r) => r.json()),
        fetch("/api/nex/founder-window/flow-counts", { cache: "no-store" }).then((r) => r.json()),
      ]);
      if (Array.isArray(s.subsystems)) setSubsystems(s.subsystems);
      if (Array.isArray(f.stages)) setStages(f.stages);
      setLastRefresh(new Date().toLocaleTimeString());
    } catch { /* keep last known values */ }
  }, []);

  useEffect(() => {
    pollHealth();
    const t = setInterval(pollHealth, 5000);
    return () => clearInterval(t);
  }, [pollHealth]);

  // Bootstrap event list + subscribe to SSE
  useEffect(() => {
    let disposed = false;
    (async () => {
      try {
        const r = await fetch("/api/nex/founder-window/events?limit=100", { cache: "no-store" });
        const j = await r.json();
        if (!disposed && Array.isArray(j.events)) setEvents(j.events);
      } catch { /* ignore */ }
    })();

    const es = new EventSource("/api/nex/founder-window/stream");
    es.addEventListener("hello", () => setConnected(true));
    es.addEventListener("heartbeat", () => setConnected(true));
    es.addEventListener("event", (ev) => {
      try {
        const row = JSON.parse((ev as MessageEvent).data) as EventRow;
        setEvents((prev) => [row, ...prev].slice(0, 500));
      } catch { /* ignore malformed */ }
    });
    es.onerror = () => setConnected(false);
    return () => { disposed = true; es.close(); };
  }, []);

  const filteredEvents = useMemo(() => {
    return events.filter((e) => {
      if (filterSubsystem !== "all" && e.subsystem !== filterSubsystem) return false;
      if (filterStatus !== "all" && e.status !== filterStatus) return false;
      return true;
    });
  }, [events, filterSubsystem, filterStatus]);

  const uniqueSubsystems = useMemo(() =>
    [...new Set(events.map((e) => e.subsystem))].sort(), [events]);

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3 text-xs text-neutral-500">
        <span className={`inline-block h-2 w-2 rounded-full ${connected ? "bg-emerald-500" : "bg-neutral-600"}`} />
        <span>SSE: {connected ? "live" : "reconnecting…"}</span>
        <span>·</span>
        <span>Health refresh: {lastRefresh || "…"}</span>
      </div>

      {/* Status pills */}
      <section>
        <h2 className="mb-3 text-sm font-medium uppercase tracking-wider text-neutral-400">Subsystem status</h2>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-5">
          {subsystems.map((s) => (
            <div key={s.subsystem}
                 className={`rounded-lg border p-4 ${STATUS_COLOR[s.status] ?? STATUS_COLOR.unknown}`}>
              <div className="flex items-center justify-between">
                <div className="text-sm font-medium">{SUBSYSTEM_LABEL[s.subsystem] ?? s.subsystem}</div>
                <div className="text-[10px] uppercase tracking-wider opacity-75">{s.status}</div>
              </div>
              <div className="mt-2 text-xs opacity-80 line-clamp-3">{s.reason}</div>
              {Object.entries(s.metrics).slice(0, 3).map(([k, v]) => (
                <div key={k} className="mt-2 flex justify-between text-[11px] opacity-70">
                  <span className="truncate">{k}</span>
                  <span className="font-mono">{typeof v === "boolean" ? (v ? "✓" : "✗") : String(v).slice(0, 20)}</span>
                </div>
              ))}
            </div>
          ))}
          {subsystems.length === 0 && (
            <div className="col-span-full rounded-lg border border-neutral-800 p-6 text-center text-sm text-neutral-500">
              Probing subsystems…
            </div>
          )}
        </div>
      </section>

      {/* Data flow */}
      <section>
        <h2 className="mb-3 text-sm font-medium uppercase tracking-wider text-neutral-400">Data flow · last 1h / 24h / total</h2>
        <div className="overflow-hidden rounded-lg border border-neutral-800">
          <div className="grid grid-cols-10 divide-x divide-neutral-800 bg-neutral-900">
            {stages.map((st) => (
              <div key={st.stage} className="px-2 py-3 text-center">
                <div className="text-[10px] uppercase tracking-wider text-neutral-500">Stage {st.stage}</div>
                <div className="mt-1 text-[11px] font-medium text-neutral-200">{st.name}</div>
                <div className="mt-2 font-mono text-lg tabular-nums">
                  {st.count_1h.toLocaleString()}
                </div>
                <div className="text-[10px] text-neutral-500">last 1h</div>
                <div className="mt-1 font-mono text-xs tabular-nums text-neutral-400">
                  {st.count_24h.toLocaleString()} / 24h
                </div>
                <div className="mt-1 font-mono text-[10px] tabular-nums text-neutral-600">
                  {st.count_total.toLocaleString()} total
                </div>
                {st.note && (
                  <div className="mt-2 text-[9px] text-amber-500/80" title={st.note}>
                    ⚠ needs wire
                  </div>
                )}
              </div>
            ))}
            {stages.length === 0 && (
              <div className="col-span-10 py-6 text-center text-sm text-neutral-500">Computing…</div>
            )}
          </div>
        </div>
      </section>

      {/* Live event stream */}
      <section>
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-sm font-medium uppercase tracking-wider text-neutral-400">
            Live activity ({filteredEvents.length} shown)
          </h2>
          <div className="flex items-center gap-2 text-xs">
            <select value={filterSubsystem} onChange={(e) => setFilterSubsystem(e.target.value)}
                    className="rounded border border-neutral-800 bg-neutral-900 px-2 py-1 text-neutral-200">
              <option value="all">all subsystems</option>
              {uniqueSubsystems.map((s) => <option key={s} value={s}>{s}</option>)}
            </select>
            <select value={filterStatus} onChange={(e) => setFilterStatus(e.target.value)}
                    className="rounded border border-neutral-800 bg-neutral-900 px-2 py-1 text-neutral-200">
              <option value="all">all status</option>
              <option value="info">info</option>
              <option value="ok">ok</option>
              <option value="warning">warning</option>
              <option value="error">error</option>
              <option value="critical">critical</option>
            </select>
          </div>
        </div>
        <div className="max-h-[600px] overflow-y-auto rounded-lg border border-neutral-800 bg-neutral-950">
          <table className="w-full text-xs">
            <thead className="sticky top-0 bg-neutral-900 text-neutral-400">
              <tr>
                <th className="px-3 py-2 text-left font-normal">Time</th>
                <th className="px-3 py-2 text-left font-normal">Subsystem</th>
                <th className="px-3 py-2 text-left font-normal">Kind</th>
                <th className="px-3 py-2 text-left font-normal">Status</th>
                <th className="px-3 py-2 text-left font-normal">Message</th>
                <th className="px-3 py-2 text-right font-normal">Ref</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-neutral-900">
              {filteredEvents.map((e) => (
                <tr key={e.event_id} className="hover:bg-neutral-900/50">
                  <td className="px-3 py-1.5 font-mono text-[10px] text-neutral-500 tabular-nums whitespace-nowrap">
                    {new Date(e.emitted_at).toLocaleTimeString()}
                  </td>
                  <td className="px-3 py-1.5 text-neutral-300 whitespace-nowrap">{e.subsystem}</td>
                  <td className="px-3 py-1.5 text-neutral-400 whitespace-nowrap">{e.event_kind}</td>
                  <td className={`px-3 py-1.5 whitespace-nowrap ${EVENT_STATUS_COLOR[e.status] ?? ""}`}>{e.status}</td>
                  <td className="px-3 py-1.5 text-neutral-200">{e.message ?? "—"}</td>
                  <td className="px-3 py-1.5 text-right font-mono text-[10px] text-neutral-600">
                    {e.subject_ref ? e.subject_ref.slice(0, 12) : ""}
                  </td>
                </tr>
              ))}
              {filteredEvents.length === 0 && (
                <tr>
                  <td colSpan={6} className="px-3 py-8 text-center text-neutral-500">
                    No events matching filters. Waiting for signal…
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
