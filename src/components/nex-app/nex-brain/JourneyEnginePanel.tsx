// NEX Journey Engine · Communications Centre panel · Phase 5.1
//
// MVP UI: list · filter by status · activate/pause/archive · manual
// enter · manual tick · view execution states + event history for any
// contact. Journey authoring (visual builder) lands in a later phase;
// definitions can be created via API today.

"use client";

import { useCallback, useEffect, useMemo, useState } from "react";

type JourneyStatus = "draft" | "active" | "paused" | "archived";
type StateStatus = "active" | "waiting" | "completed" | "stopped" | "failed";

type Journey = {
  journey_id: string; slug: string; name: string; description: string | null;
  version: number; status: JourneyStatus; trigger_type: string;
  trigger_config: Record<string, unknown>; definition: { nodes: unknown[]; start_node_id: string };
  validation_errors: string[] | null;
  created_at: string; updated_at: string; activated_at: string | null;
};
type JourneyState = {
  state_id: string; journey_id: string; contact_id: string;
  current_node_id: string; status: StateStatus;
  entered_at: string; last_transition_at: string; wait_until: string | null;
  completed_at: string | null; stopped_reason: string | null;
};
type JourneyEvent = {
  event_id: string; event_type: string;
  from_node_id: string | null; to_node_id: string | null;
  emitted_command: { kind: string; campaign_id?: string; contact_id?: string } | null;
  metadata: Record<string, unknown>; occurred_at: string;
};
type Metrics = {
  ok: boolean;
  total_journeys: number; by_status: Record<JourneyStatus, number>;
  active_states: number; waiting_states: number;
  completed_last_24h: number; stopped_last_24h: number;
  emitted_commands_last_24h: number;
};

const T = {
  panel: "#12161c", panelHi: "#1a2028", border: "#232b36",
  text: "#e5e9ef", textDim: "#8892a0", textFade: "#5c6572",
  accent: "#4dd0a0", warning: "#f0b45a", danger: "#f0665a",
  info: "#5aa6f0", purple: "#b48cf0",
};

const STATUS_TONE: Record<JourneyStatus, string> = { draft: T.textDim, active: T.accent, paused: T.warning, archived: T.textFade };
const STATE_TONE: Record<StateStatus, string> = { active: T.accent, waiting: T.info, completed: T.purple, stopped: T.warning, failed: T.danger };

export function JourneyEnginePanel() {
  const [journeys, setJourneys] = useState<Journey[]>([]);
  const [metrics, setMetrics] = useState<Metrics | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [selectedStates, setSelectedStates] = useState<JourneyState[]>([]);
  const [selectedState, setSelectedState] = useState<JourneyState | null>(null);
  const [selectedEvents, setSelectedEvents] = useState<JourneyEvent[]>([]);
  const [filter, setFilter] = useState<JourneyStatus | "all">("all");
  const [ticking, setTicking] = useState(false);
  const [lastTick, setLastTick] = useState<string>("");
  const [entering, setEntering] = useState(false);

  const load = useCallback(async () => {
    const [j, m] = await Promise.all([
      fetch("/api/nex/journeys").then((r) => r.json()) as Promise<{ ok: boolean; journeys: Journey[] }>,
      fetch("/api/nex/journeys/metrics").then((r) => r.json()) as Promise<Metrics>,
    ]);
    if (j.ok) setJourneys(j.journeys);
    if (m.ok) setMetrics(m);
  }, []);

  useEffect(() => { void load(); const t = setInterval(load, 15_000); return () => clearInterval(t); }, [load]);

  useEffect(() => {
    if (!selectedId) { setSelectedStates([]); setSelectedState(null); setSelectedEvents([]); return; }
    void fetch(`/api/nex/journeys/${selectedId}`).then((r) => r.json()).then((d: { ok: boolean; states: JourneyState[] }) => { if (d.ok) setSelectedStates(d.states); });
  }, [selectedId]);

  useEffect(() => {
    if (!selectedState) { setSelectedEvents([]); return; }
    void fetch(`/api/nex/journeys/states/${selectedState.state_id}`).then((r) => r.json()).then((d: { ok: boolean; events: JourneyEvent[] }) => { if (d.ok) setSelectedEvents(d.events); });
  }, [selectedState]);

  const selected = useMemo(() => journeys.find((j) => j.journey_id === selectedId) ?? null, [journeys, selectedId]);
  const visible = useMemo(() => filter === "all" ? journeys : journeys.filter((j) => j.status === filter), [journeys, filter]);

  const changeStatus = async (journey: Journey, to: JourneyStatus) => {
    const r = await fetch(`/api/nex/journeys/${journey.journey_id}/status`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ to }) });
    const data = await r.json() as { ok: boolean; error?: string };
    if (!data.ok) { window.alert(`Failed: ${data.error}`); return; }
    await load();
  };
  const enterNow = async (journey: Journey) => {
    setEntering(true);
    try {
      const r = await fetch(`/api/nex/journeys/${journey.journey_id}/enter`, { method: "POST" });
      const data = await r.json() as { ok: boolean; entered: number; skipped_existing: number; errors: string[] };
      window.alert(data.ok ? `Entered ${data.entered} contacts · skipped ${data.skipped_existing} already-entered` : `Failed: ${data.errors.join(" · ")}`);
      if (selectedId === journey.journey_id) await fetch(`/api/nex/journeys/${journey.journey_id}`).then((r0) => r0.json()).then((d: { states: JourneyState[] }) => setSelectedStates(d.states));
      await load();
    } finally { setEntering(false); }
  };
  const runTick = async () => {
    setTicking(true);
    try {
      const r = await fetch("/api/nex/journeys/tick", { method: "POST" });
      const data = await r.json() as { states_evaluated: number; advanced: number; errors: number };
      setLastTick(`states=${data.states_evaluated} · advanced=${data.advanced} · errors=${data.errors}`);
      await load();
      if (selectedId) await fetch(`/api/nex/journeys/${selectedId}`).then((r0) => r0.json()).then((d: { states: JourneyState[] }) => setSelectedStates(d.states));
    } finally { setTicking(false); }
  };

  return (
    <div className="space-y-3">
      {/* Ops row */}
      <div className="grid gap-2" style={{ gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))" }}>
        <Kpi label="Journeys" value={metrics?.total_journeys ?? 0} tone="neutral"
          hint={metrics ? `${metrics.by_status.active} active · ${metrics.by_status.draft} draft · ${metrics.by_status.paused} paused · ${metrics.by_status.archived} archived` : ""} />
        <Kpi label="Active states" value={metrics?.active_states ?? 0} tone={(metrics?.active_states ?? 0) > 0 ? "good" : "unset"} />
        <Kpi label="Waiting states" value={metrics?.waiting_states ?? 0} tone={(metrics?.waiting_states ?? 0) > 0 ? "neutral" : "unset"} />
        <Kpi label="Completed · 24h" value={metrics?.completed_last_24h ?? 0} tone={(metrics?.completed_last_24h ?? 0) > 0 ? "good" : "unset"} />
        <Kpi label="Stopped · 24h" value={metrics?.stopped_last_24h ?? 0} tone={(metrics?.stopped_last_24h ?? 0) > 0 ? "warn" : "unset"} />
        <Kpi label="Commands · 24h" value={metrics?.emitted_commands_last_24h ?? 0} tone="neutral" hint="CampaignCommandEmitted events" />
      </div>

      {/* Controls */}
      <div className="flex items-center gap-2 rounded-md border p-2" style={{ background: T.panelHi, borderColor: T.border }}>
        <span className="text-[10px] uppercase tracking-widest" style={{ color: T.textFade }}>Manual tick (dev)</span>
        <button type="button" onClick={runTick} disabled={ticking}
          className="rounded-md border px-3 py-1 text-[10px] font-semibold"
          style={{ background: T.accent, borderColor: T.accent, color: T.panel, opacity: ticking ? 0.6 : 1 }}>
          {ticking ? "Ticking…" : "Run tick"}
        </button>
        {lastTick ? <span className="ml-2 text-[10px]" style={{ color: T.accent }}>last: {lastTick}</span> : null}
        <span className="ml-auto text-[9.5px] italic" style={{ color: T.textFade }}>
          Production: cron POSTs /api/nex/journeys/tick every 30-60s.
        </span>
      </div>

      {/* Journeys list + detail */}
      <div className="grid gap-2" style={{ gridTemplateColumns: "1fr 1.4fr" }}>
        {/* LEFT · list */}
        <div className="rounded-md border" style={{ background: T.panelHi, borderColor: T.border }}>
          <div className="flex items-center gap-2 border-b p-2" style={{ borderColor: T.border }}>
            <div className="text-[9px] font-black uppercase tracking-widest" style={{ color: T.textFade }}>Journeys · {visible.length}</div>
            {(["all","draft","active","paused","archived"] as const).map((f) => (
              <button key={f} type="button" onClick={() => setFilter(f)}
                className="rounded-md border px-2 py-0.5 text-[10px]"
                style={{ background: filter === f ? T.info : T.panel, borderColor: filter === f ? T.info : T.border, color: filter === f ? T.panel : T.textDim }}>
                {f}
              </button>
            ))}
          </div>
          <div className="max-h-[520px] overflow-auto">
            {visible.length === 0 ? (
              <div className="p-3 text-[10.5px]" style={{ color: T.textFade }}>
                {journeys.length === 0 ? "No journeys yet · publish one via POST /api/nex/journeys (visual builder in a later phase)." : "No journeys in this filter."}
              </div>
            ) : visible.map((j) => {
              const on = j.journey_id === selectedId;
              return (
                <button key={j.journey_id} type="button" onClick={() => { setSelectedId(j.journey_id); setSelectedState(null); }}
                  className="grid w-full items-baseline gap-1 border-b px-2 py-2 text-left text-[11px]"
                  style={{
                    borderColor: T.border,
                    background: on ? T.panel : "transparent",
                    borderLeft: on ? `3px solid ${STATUS_TONE[j.status]}` : "3px solid transparent",
                  }}>
                  <div className="flex items-center justify-between">
                    <span className="truncate font-semibold" style={{ color: T.text }}>{j.name}</span>
                    <span className="ml-2 rounded-full px-1.5 py-0.5 text-[8.5px] font-black uppercase tracking-widest"
                      style={{ background: `${STATUS_TONE[j.status]}20`, color: STATUS_TONE[j.status] }}>
                      {j.status}
                    </span>
                  </div>
                  <div className="flex justify-between text-[9.5px]" style={{ color: T.textFade }}>
                    <span className="font-mono">{j.slug} · v{j.version}</span>
                    <span>{j.trigger_type} · {j.definition.nodes.length} nodes</span>
                  </div>
                  {j.validation_errors && j.validation_errors.length > 0 ? (
                    <div className="text-[9.5px]" style={{ color: T.danger }}>{j.validation_errors[0]}{j.validation_errors.length > 1 ? ` (+${j.validation_errors.length - 1} more)` : ""}</div>
                  ) : null}
                </button>
              );
            })}
          </div>
        </div>

        {/* RIGHT · detail */}
        <div className="rounded-md border" style={{ background: T.panelHi, borderColor: T.border }}>
          {!selected ? (
            <div className="p-3 text-[11px]" style={{ color: T.textFade }}>Select a journey on the left.</div>
          ) : (
            <div className="p-3">
              <div className="mb-2 flex items-baseline justify-between">
                <div>
                  <div className="font-semibold" style={{ color: T.text }}>{selected.name}</div>
                  <div className="font-mono text-[9.5px]" style={{ color: T.textFade }}>{selected.slug} · v{selected.version} · trigger {selected.trigger_type}</div>
                </div>
                <span className="rounded-full px-2 py-0.5 text-[9px] font-black uppercase tracking-widest"
                  style={{ background: `${STATUS_TONE[selected.status]}20`, color: STATUS_TONE[selected.status] }}>
                  {selected.status}
                </span>
              </div>

              {selected.description ? <div className="mb-2 text-[10.5px]" style={{ color: T.textDim }}>{selected.description}</div> : null}

              {selected.validation_errors && selected.validation_errors.length > 0 ? (
                <div className="mb-2 rounded-md border p-2 text-[10px]" style={{ background: T.panel, borderColor: T.danger, color: T.danger }}>
                  Validation errors:
                  <ul className="mt-1 list-disc pl-4">{selected.validation_errors.map((e, i) => <li key={i}>{e}</li>)}</ul>
                </div>
              ) : null}

              <div className="mb-2 flex flex-wrap gap-1">
                {selected.status === "draft" ? (
                  <button type="button" onClick={() => changeStatus(selected, "active")} disabled={!!(selected.validation_errors && selected.validation_errors.length > 0)}
                    className="rounded-md border px-2 py-1 text-[10px]"
                    style={{ background: T.accent, borderColor: T.accent, color: T.panel, opacity: (selected.validation_errors && selected.validation_errors.length > 0) ? 0.5 : 1 }}>
                    Activate
                  </button>
                ) : null}
                {selected.status === "active" ? (
                  <button type="button" onClick={() => changeStatus(selected, "paused")}
                    className="rounded-md border px-2 py-1 text-[10px]" style={{ background: T.warning, borderColor: T.warning, color: T.panel }}>Pause</button>
                ) : null}
                {(selected.status === "draft" || selected.status === "paused") ? (
                  <button type="button" onClick={() => changeStatus(selected, "archived")}
                    className="rounded-md border px-2 py-1 text-[10px]" style={{ background: T.panel, borderColor: T.border, color: T.danger }}>Archive</button>
                ) : null}
                {selected.status === "active" ? (
                  <button type="button" onClick={() => enterNow(selected)} disabled={entering}
                    className="rounded-md border px-2 py-1 text-[10px]" style={{ background: T.info, borderColor: T.info, color: T.panel, opacity: entering ? 0.6 : 1 }}>
                    {entering ? "Entering…" : "Enter eligible contacts"}
                  </button>
                ) : null}
              </div>

              <div className="mb-1 text-[9px] font-black uppercase tracking-widest" style={{ color: T.textFade }}>Execution · {selectedStates.length} contacts</div>
              <div className="max-h-[240px] overflow-auto rounded-md border" style={{ borderColor: T.border, background: T.panel }}>
                {selectedStates.length === 0 ? (
                  <div className="p-2 text-[10.5px]" style={{ color: T.textFade }}>No contacts have entered this journey yet.</div>
                ) : selectedStates.map((s) => (
                  <button key={s.state_id} type="button" onClick={() => setSelectedState(s)}
                    className="grid w-full items-baseline gap-1 border-b px-2 py-1.5 text-left text-[10.5px]"
                    style={{ borderColor: T.border, background: selectedState?.state_id === s.state_id ? T.panelHi : "transparent" }}>
                    <div className="flex items-center justify-between">
                      <span className="truncate font-mono" style={{ color: T.text }}>{s.contact_id.slice(0, 8)}…</span>
                      <span className="rounded-full px-1.5 py-0.5 text-[8.5px] font-black uppercase tracking-widest"
                        style={{ background: `${STATE_TONE[s.status]}20`, color: STATE_TONE[s.status] }}>
                        {s.status}
                      </span>
                    </div>
                    <div className="flex justify-between text-[9.5px]" style={{ color: T.textFade }}>
                      <span>at <span className="font-mono" style={{ color: T.textDim }}>{s.current_node_id}</span></span>
                      <span>{s.wait_until ? `waits ${new Date(s.wait_until).toLocaleTimeString()}` : new Date(s.last_transition_at).toLocaleTimeString()}</span>
                    </div>
                  </button>
                ))}
              </div>

              {selectedState ? (
                <div className="mt-2">
                  <div className="mb-1 text-[9px] font-black uppercase tracking-widest" style={{ color: T.textFade }}>Event history · {selectedEvents.length}</div>
                  <div className="max-h-[200px] overflow-auto rounded-md border" style={{ borderColor: T.border, background: T.panel }}>
                    {selectedEvents.length === 0 ? (
                      <div className="p-2 text-[10.5px]" style={{ color: T.textFade }}>No events yet.</div>
                    ) : selectedEvents.map((e) => (
                      <div key={e.event_id} className="grid items-center gap-2 border-b px-2 py-1 text-[10px]"
                        style={{ borderColor: T.border, gridTemplateColumns: "180px 1fr 120px" }}>
                        <span className="font-mono" style={{ color: T.info }}>{e.event_type}</span>
                        <span style={{ color: T.textDim }}>{e.from_node_id ?? "—"} → {e.to_node_id ?? "—"}{e.emitted_command ? ` · cmd:${e.emitted_command.kind}` : ""}</span>
                        <span className="font-mono text-[9px]" style={{ color: T.textFade }}>{new Date(e.occurred_at).toLocaleTimeString()}</span>
                      </div>
                    ))}
                  </div>
                </div>
              ) : null}
            </div>
          )}
        </div>
      </div>

      <div className="text-[9.5px] italic" style={{ color: T.textFade }}>
        Journey Runtime is an orchestration layer · emits commands · never sends, picks providers, writes compliance, or executes campaigns. See docs/JOURNEY_ENGINE_CHARTER.md.
      </div>
    </div>
  );
}

function Kpi({ label, value, tone = "neutral", hint }: { label: string; value: string | number; tone?: "neutral" | "good" | "warn" | "bad" | "unset"; hint?: string }) {
  const color = tone === "good" ? T.accent : tone === "warn" ? T.warning : tone === "bad" ? T.danger : tone === "unset" ? T.textFade : T.text;
  return (
    <div className="rounded-md border p-3" style={{ background: T.panelHi, borderColor: T.border }}>
      <div className="text-[9px] font-black uppercase tracking-widest" style={{ color: T.textFade }}>{label}</div>
      <div className="mt-1 font-mono text-[16px] font-black leading-none" style={{ color }}>{value}</div>
      {hint ? <div className="mt-1 text-[9.5px] truncate" style={{ color: T.textFade }} title={hint}>{hint}</div> : null}
    </div>
  );
}
