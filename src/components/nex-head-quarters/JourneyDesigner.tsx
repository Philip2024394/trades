// NEX Journey Engine · Visual DAG Builder · Phase 5.1.3
//
// Doctrine: the editor produces a validated JourneyDefinition JSON
// and NEVER executes. All execution flows through the existing
// runtime (charter §7, §11, invariants #11-12).
//
// Canvas nodes: Start · Wait · Send Campaign · Send Campaign & Wait
// · Branch · Goal · Stop
//
// Save → POST /api/nex/journeys (existing publish endpoint) which
// runs the parser + validator + creates a new draft version.
//
// Simulate → POST /api/nex/journeys/{id}/simulate (pure dry-run).

"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";

// ── Mirror the runtime types (kept opaque via string types) ──────
type NodeType = "start" | "wait" | "send_campaign" | "send_campaign_and_wait" | "branch" | "goal" | "stop";
type Pos = { x: number; y: number };
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type EditorNode = { id: string; type: NodeType; label?: string; position: Pos; [k: string]: any };
type EditorDefinition = { nodes: EditorNode[]; start_node_id: string };

type Campaign = { campaign_id: string; name: string };
type Segment = { segment_id: string; name: string };

type SimStep = { node_id: string; node_type: string; outcome: string; detail: string; next?: string };
type SimResult = { ok: boolean; reason: string; steps: SimStep[]; terminal_node_id: string | null; branch_overrides_used: Record<string, "yes" | "no"> };

const T = {
  panel: "#12161c", panelHi: "#1a2028", border: "#232b36", canvasBg: "#0d1015",
  text: "#e5e9ef", textDim: "#8892a0", textFade: "#5c6572",
  accent: "#4dd0a0", warning: "#f0b45a", danger: "#f0665a", info: "#5aa6f0", purple: "#b48cf0",
};

const NODE_W = 180;
const NODE_H = 68;
const CANVAS_W = 1400;
const CANVAS_H = 720;

const NODE_TONES: Record<NodeType, string> = {
  start: T.accent, wait: T.info, send_campaign: T.purple, send_campaign_and_wait: T.purple,
  branch: T.warning, goal: T.accent, stop: T.danger,
};
const NODE_LABELS: Record<NodeType, string> = {
  start: "Start", wait: "Wait", send_campaign: "Send Campaign",
  send_campaign_and_wait: "Send + Wait", branch: "Branch", goal: "Goal", stop: "Stop",
};

const inputStyle: React.CSSProperties = { background: T.panel, borderColor: T.border, color: T.text };

// ── Default nodes when adding from palette ──────────────────────
function defaultNode(type: NodeType, position: Pos): EditorNode {
  const id = `n_${Date.now().toString(36)}_${Math.floor(Math.random() * 1e6).toString(36)}`;
  switch (type) {
    case "start":                  return { id, type, position, next: "" };
    case "wait":                   return { id, type, position, next: "", wait_seconds: 3600 };
    case "send_campaign":          return { id, type, position, next: "", campaign_id: "" };
    case "send_campaign_and_wait": return { id, type, position, next_on_completion: "", next_on_failure: "", campaign_id: "", poll_interval_seconds: 30, timeout_seconds: 86400 };
    case "branch":                 return { id, type, position, condition: "opened", within_seconds: 3600, branches: { yes: "", no: "" } };
    case "goal":                   return { id, type, position, goal_key: "goal_1", next: "" };
    case "stop":                   return { id, type, position, reason: "" };
  }
}

// Extract outgoing edges from a node · used for connection rendering + simulate
function edgesFrom(n: EditorNode): Array<{ target: string; kind: "next" | "yes" | "no" | "completion" | "failure" }> {
  if (n.type === "start" || n.type === "wait" || n.type === "send_campaign") return n.next ? [{ target: n.next, kind: "next" }] : [];
  if (n.type === "goal") return n.next ? [{ target: n.next, kind: "next" }] : [];
  if (n.type === "branch") {
    const out: Array<{ target: string; kind: "yes" | "no" }> = [];
    if (n.branches?.yes) out.push({ target: n.branches.yes, kind: "yes" });
    if (n.branches?.no)  out.push({ target: n.branches.no,  kind: "no" });
    return out;
  }
  if (n.type === "send_campaign_and_wait") {
    const out: Array<{ target: string; kind: "completion" | "failure" }> = [];
    if (n.next_on_completion) out.push({ target: n.next_on_completion, kind: "completion" });
    if (n.next_on_failure)    out.push({ target: n.next_on_failure,    kind: "failure" });
    return out;
  }
  return [];
}

export type JourneyDesignerProps = {
  journeyId?: string;                                              // when editing an existing journey
  slug: string;
  name: string;
  initialDefinition?: EditorDefinition;
  triggerConfig?: Record<string, unknown>;
  onPublished?: (newJourneyId: string) => void;
};

export function JourneyDesigner(p: JourneyDesignerProps) {
  const [nodes, setNodes] = useState<EditorNode[]>(() => (p.initialDefinition?.nodes ?? []).map((n, i) => ({ ...n, position: n.position ?? { x: 80 + (i % 5) * (NODE_W + 40), y: 80 + Math.floor(i / 5) * (NODE_H + 60) } })));
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [linkFromId, setLinkFromId] = useState<string | null>(null);
  const [linkFromKind, setLinkFromKind] = useState<"next" | "yes" | "no" | "completion" | "failure">("next");
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [segments, setSegments] = useState<Segment[]>([]);
  const [saving, setSaving] = useState(false);
  const [saveMsg, setSaveMsg] = useState<string>("");
  const [sim, setSim] = useState<SimResult | null>(null);
  const [triggerSegmentId, setTriggerSegmentId] = useState<string>(String(p.triggerConfig?.segment_id ?? ""));
  const canvasRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    void fetch("/api/nex/campaigns").then((r) => r.json()).then((d: { campaigns: Campaign[] }) => setCampaigns(d.campaigns ?? []));
    void fetch("/api/nex/segments").then((r) => r.json()).then((d: { segments: Segment[] }) => setSegments(d.segments ?? []));
  }, []);

  const selected = useMemo(() => nodes.find((n) => n.id === selectedId) ?? null, [nodes, selectedId]);
  const startNode = useMemo(() => nodes.find((n) => n.type === "start") ?? null, [nodes]);

  // ── Node ops ────────────────────────────────────────────────
  const addNode = (type: NodeType) => {
    const rect = canvasRef.current?.getBoundingClientRect();
    const centerX = rect ? Math.max(20, Math.min(CANVAS_W - NODE_W - 20, rect.width / 2 - NODE_W / 2)) : 200;
    const n = defaultNode(type, { x: centerX, y: 60 + nodes.length * 20 });
    setNodes((cur) => [...cur, n]);
    setSelectedId(n.id);
  };
  const updateNode = (id: string, patch: Partial<EditorNode>) => setNodes((cur) => cur.map((n) => n.id === id ? { ...n, ...patch } : n));
  const deleteNode = (id: string) => {
    if (!confirm("Delete this node? All connections to/from it will be removed.")) return;
    setNodes((cur) => cur.filter((n) => n.id !== id).map((n) => {
      // Strip outgoing edges that pointed to the deleted node
      const clone: EditorNode = { ...n };
      if (clone.next === id) clone.next = "";
      if (clone.next_on_completion === id) clone.next_on_completion = "";
      if (clone.next_on_failure === id) clone.next_on_failure = "";
      if (clone.branches) {
        clone.branches = { ...clone.branches };
        if (clone.branches.yes === id) clone.branches.yes = "";
        if (clone.branches.no === id)  clone.branches.no  = "";
      }
      return clone;
    }));
    if (selectedId === id) setSelectedId(null);
  };

  // ── Dragging ────────────────────────────────────────────────
  const dragRef = useRef<{ id: string; offsetX: number; offsetY: number } | null>(null);
  const onNodeMouseDown = (e: React.MouseEvent, n: EditorNode) => {
    if (linkFromId) return;                            // in linking mode · handled by click
    const rect = canvasRef.current?.getBoundingClientRect();
    if (!rect) return;
    dragRef.current = { id: n.id, offsetX: e.clientX - rect.left - n.position.x, offsetY: e.clientY - rect.top - n.position.y };
    setSelectedId(n.id);
  };
  useEffect(() => {
    const onMove = (e: MouseEvent) => {
      if (!dragRef.current || !canvasRef.current) return;
      const rect = canvasRef.current.getBoundingClientRect();
      const nx = Math.max(4, Math.min(CANVAS_W - NODE_W - 4, e.clientX - rect.left - dragRef.current.offsetX));
      const ny = Math.max(4, Math.min(CANVAS_H - NODE_H - 4, e.clientY - rect.top - dragRef.current.offsetY));
      const id = dragRef.current.id;
      setNodes((cur) => cur.map((n) => n.id === id ? { ...n, position: { x: nx, y: ny } } : n));
    };
    const onUp = () => { dragRef.current = null; };
    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);
    return () => { window.removeEventListener("mousemove", onMove); window.removeEventListener("mouseup", onUp); };
  }, []);

  // ── Linking mode · click source handle → click target node ──
  const beginLink = (n: EditorNode, kind: "next" | "yes" | "no" | "completion" | "failure") => {
    setLinkFromId(n.id);
    setLinkFromKind(kind);
  };
  const completeLink = (target: EditorNode) => {
    if (!linkFromId || linkFromId === target.id) { setLinkFromId(null); return; }
    setNodes((cur) => cur.map((n) => {
      if (n.id !== linkFromId) return n;
      const clone: EditorNode = { ...n };
      if (linkFromKind === "next") clone.next = target.id;
      else if (linkFromKind === "yes") clone.branches = { ...clone.branches, yes: target.id };
      else if (linkFromKind === "no")  clone.branches = { ...clone.branches, no:  target.id };
      else if (linkFromKind === "completion") clone.next_on_completion = target.id;
      else if (linkFromKind === "failure")    clone.next_on_failure    = target.id;
      return clone;
    }));
    setLinkFromId(null);
  };

  // ── Save (publish new draft) ────────────────────────────────
  const save = async () => {
    if (!startNode) { setSaveMsg("FAILED · add a Start node"); return; }
    setSaving(true); setSaveMsg("");
    try {
      const definition: EditorDefinition = { nodes, start_node_id: startNode.id };
      const body = {
        slug: p.slug, name: p.name,
        trigger_type: "segment_join",
        trigger_config: triggerSegmentId ? { segment_id: triggerSegmentId } : {},
        definition,
      };
      const r = await fetch("/api/nex/journeys", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) });
      const data = await r.json() as { ok: boolean; journey?: { journey_id: string; version: number }; errors?: string[] };
      if (data.ok && data.journey) {
        setSaveMsg(`SAVED · draft v${data.journey.version}`);
        p.onPublished?.(data.journey.journey_id);
      } else {
        setSaveMsg(`FAILED · ${(data.errors ?? ["unknown"]).join(" · ")}`);
      }
    } catch (e) {
      setSaveMsg(`FAILED · ${e instanceof Error ? e.message : "save_failed"}`);
    } finally { setSaving(false); }
  };

  // ── Simulate ────────────────────────────────────────────────
  const simulate = async () => {
    // Local simulate (no journey_id required — for unsaved drafts)
    // Uses the same simulator library the API uses.
    if (!startNode) { setSim({ ok: false, reason: "no_start_node", steps: [], terminal_node_id: null, branch_overrides_used: {} }); return; }
    const definition: EditorDefinition = { nodes, start_node_id: startNode.id };
    // Post to the simulate endpoint if this journey is saved · else run locally
    if (p.journeyId) {
      const r = await fetch(`/api/nex/journeys/${p.journeyId}/simulate`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({}) });
      const data = await r.json() as SimResult & { ok: boolean };
      setSim(data);
      return;
    }
    // Client-side · match the server simulator's default happy-path behaviour
    setSim(localSimulate(definition));
  };

  // ── Render ──────────────────────────────────────────────────
  return (
    <div className="rounded-md border" style={{ background: T.panel, borderColor: T.border }}>
      {/* Toolbar */}
      <div className="flex items-center gap-2 border-b p-2" style={{ borderColor: T.border }}>
        <span className="text-[10px] font-black uppercase tracking-widest" style={{ color: T.accent }}>NEX Journey Designer</span>
        <div className="flex gap-1">
          {(["start","wait","send_campaign","send_campaign_and_wait","branch","goal","stop"] as const).map((t) => (
            <button key={t} type="button" onClick={() => addNode(t)}
              className="rounded-md border px-2 py-1 text-[10px] font-semibold"
              style={{ background: T.panelHi, borderColor: NODE_TONES[t], color: NODE_TONES[t] }}>
              + {NODE_LABELS[t]}
            </button>
          ))}
        </div>
        <div className="ml-auto flex items-center gap-2">
          <label className="text-[10px]" style={{ color: T.textFade }}>Trigger segment
            <select className="ml-1 rounded-md border px-2 py-1 text-[10px]" style={{ background: T.panel, borderColor: T.border, color: T.text }}
              value={triggerSegmentId} onChange={(e) => setTriggerSegmentId(e.target.value)}>
              <option value="">— none —</option>
              {segments.map((s) => <option key={s.segment_id} value={s.segment_id}>{s.name}</option>)}
            </select>
          </label>
          <button type="button" onClick={simulate}
            className="rounded-md border px-3 py-1 text-[10px] font-semibold"
            style={{ background: T.purple, borderColor: T.purple, color: T.panel }}>
            ▶ Test Journey
          </button>
          <button type="button" onClick={save} disabled={saving}
            className="rounded-md border px-3 py-1 text-[10px] font-semibold"
            style={{ background: T.accent, borderColor: T.accent, color: T.panel, opacity: saving ? 0.6 : 1 }}>
            {saving ? "Saving…" : "Save · publish draft"}
          </button>
          {saveMsg ? <span className="text-[9.5px]" style={{ color: saveMsg.startsWith("FAILED") ? T.danger : T.accent }}>{saveMsg}</span> : null}
        </div>
      </div>

      {/* Linking hint */}
      {linkFromId ? (
        <div className="border-b p-2 text-[10.5px]" style={{ borderColor: T.border, background: `${T.info}20`, color: T.info }}>
          Linking · <span style={{ color: T.text }}>{linkFromKind}</span> from <span className="font-mono">{linkFromId.slice(0, 8)}…</span> · click a target node · <button type="button" onClick={() => setLinkFromId(null)} className="ml-2 underline">cancel</button>
        </div>
      ) : null}

      {/* Canvas + config */}
      <div className="grid" style={{ gridTemplateColumns: "1fr 320px" }}>
        <div className="relative overflow-auto" style={{ background: T.canvasBg, maxHeight: 720 }}>
          <div ref={canvasRef} className="relative" style={{ width: CANVAS_W, height: CANVAS_H, backgroundImage: `radial-gradient(${T.border} 1px, transparent 1px)`, backgroundSize: "20px 20px" }}>
            {/* Connections */}
            <svg width={CANVAS_W} height={CANVAS_H} style={{ position: "absolute", top: 0, left: 0, pointerEvents: "none" }}>
              <defs>
                <marker id="arrow" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="8" markerHeight="8" orient="auto-start-reverse">
                  <path d="M0 0L10 5L0 10Z" fill={T.textDim} />
                </marker>
              </defs>
              {nodes.flatMap((n) => edgesFrom(n).map((e) => {
                const target = nodes.find((x) => x.id === e.target);
                if (!target) return null;
                const from = { x: n.position.x + NODE_W / 2, y: n.position.y + NODE_H };
                const to   = { x: target.position.x + NODE_W / 2, y: target.position.y };
                const midY = (from.y + to.y) / 2;
                const color = e.kind === "yes" || e.kind === "completion" ? T.accent : e.kind === "no" || e.kind === "failure" ? T.warning : T.textDim;
                return (
                  <g key={`${n.id}:${e.kind}:${target.id}`}>
                    <path d={`M ${from.x} ${from.y} C ${from.x} ${midY} ${to.x} ${midY} ${to.x} ${to.y}`}
                      fill="none" stroke={color} strokeWidth={1.5} markerEnd="url(#arrow)" />
                    {e.kind !== "next" ? (
                      <text x={(from.x + to.x) / 2 + 4} y={midY - 4} fill={color} fontSize="9" fontFamily="monospace">{e.kind}</text>
                    ) : null}
                  </g>
                );
              }))}
            </svg>

            {/* Node cards */}
            {nodes.map((n) => {
              const isSelected = n.id === selectedId;
              const isLinkTarget = !!linkFromId && linkFromId !== n.id;
              return (
                <div key={n.id}
                  onMouseDown={(e) => onNodeMouseDown(e, n)}
                  onClick={(e) => { e.stopPropagation(); if (isLinkTarget) completeLink(n); else setSelectedId(n.id); }}
                  className="absolute select-none rounded-md border"
                  style={{
                    left: n.position.x, top: n.position.y, width: NODE_W, height: NODE_H,
                    background: isSelected ? T.panel : T.panelHi,
                    borderColor: isSelected ? T.info : NODE_TONES[n.type],
                    boxShadow: isLinkTarget ? `0 0 0 2px ${T.info}` : "none",
                    cursor: linkFromId ? "crosshair" : "grab",
                  }}>
                  <div className="flex items-center justify-between border-b px-2 py-1" style={{ borderColor: T.border }}>
                    <span className="text-[9px] font-black uppercase tracking-widest" style={{ color: NODE_TONES[n.type] }}>{NODE_LABELS[n.type]}</span>
                    <span className="font-mono text-[8px]" style={{ color: T.textFade }}>{n.id.slice(0, 8)}</span>
                  </div>
                  <div className="px-2 py-1 text-[10px]" style={{ color: T.text }}>
                    {n.label ?? summarise(n)}
                  </div>
                  {/* Outgoing handles */}
                  {(n.type === "start" || n.type === "wait" || n.type === "send_campaign" || n.type === "goal") && (
                    <button type="button" onClick={(e) => { e.stopPropagation(); beginLink(n, "next"); }}
                      className="absolute -bottom-2 left-1/2 -translate-x-1/2 rounded-full border px-1.5 text-[8px]"
                      style={{ background: T.panel, borderColor: T.info, color: T.info }}>+ next</button>
                  )}
                  {n.type === "branch" && (
                    <>
                      <button type="button" onClick={(e) => { e.stopPropagation(); beginLink(n, "yes"); }}
                        className="absolute -bottom-2 left-1/4 -translate-x-1/2 rounded-full border px-1.5 text-[8px]"
                        style={{ background: T.panel, borderColor: T.accent, color: T.accent }}>+ yes</button>
                      <button type="button" onClick={(e) => { e.stopPropagation(); beginLink(n, "no"); }}
                        className="absolute -bottom-2 left-3/4 -translate-x-1/2 rounded-full border px-1.5 text-[8px]"
                        style={{ background: T.panel, borderColor: T.warning, color: T.warning }}>+ no</button>
                    </>
                  )}
                  {n.type === "send_campaign_and_wait" && (
                    <>
                      <button type="button" onClick={(e) => { e.stopPropagation(); beginLink(n, "completion"); }}
                        className="absolute -bottom-2 left-1/4 -translate-x-1/2 rounded-full border px-1.5 text-[8px]"
                        style={{ background: T.panel, borderColor: T.accent, color: T.accent }}>+ done</button>
                      <button type="button" onClick={(e) => { e.stopPropagation(); beginLink(n, "failure"); }}
                        className="absolute -bottom-2 left-3/4 -translate-x-1/2 rounded-full border px-1.5 text-[8px]"
                        style={{ background: T.panel, borderColor: T.warning, color: T.warning }}>+ fail</button>
                    </>
                  )}
                </div>
              );
            })}
          </div>
        </div>

        {/* Right rail · config + simulate result */}
        <div className="border-l" style={{ borderColor: T.border, background: T.panelHi }}>
          {selected ? (
            <NodeConfig node={selected} campaigns={campaigns}
              onChange={(patch) => updateNode(selected.id, patch)}
              onDelete={() => deleteNode(selected.id)} />
          ) : (
            <div className="p-3 text-[11px]" style={{ color: T.textFade }}>Select a node to edit its configuration · drag nodes to reposition · click a coloured handle to draw a connection.</div>
          )}
          {sim ? (
            <div className="border-t p-3" style={{ borderColor: T.border }}>
              <div className="mb-1 flex items-baseline justify-between">
                <div className="text-[10px] font-black uppercase tracking-widest" style={{ color: T.purple }}>Test run · {sim.reason}</div>
                <span className="rounded-full px-1.5 py-0.5 text-[9px] font-black uppercase tracking-widest"
                  style={{ background: sim.ok ? `${T.accent}20` : `${T.danger}20`, color: sim.ok ? T.accent : T.danger }}>
                  {sim.ok ? "PASS" : "FAIL"}
                </span>
              </div>
              <div className="max-h-[320px] overflow-auto rounded-md border" style={{ borderColor: T.border, background: T.panel }}>
                {sim.steps.map((s, i) => (
                  <div key={i} className="grid items-baseline gap-2 border-b px-2 py-1 text-[10px]" style={{ borderColor: T.border, gridTemplateColumns: "60px 100px 1fr" }}>
                    <span className="font-mono text-[9px]" style={{ color: T.textFade }}>#{i + 1}</span>
                    <span className="rounded-full px-1.5 py-0.5 text-center text-[8.5px] font-black uppercase tracking-widest"
                      style={{ background: `${NODE_TONES[s.node_type as NodeType] ?? T.text}20`, color: NODE_TONES[s.node_type as NodeType] ?? T.text }}>{s.node_type}</span>
                    <span style={{ color: T.text }}>{s.detail}</span>
                  </div>
                ))}
              </div>
              {sim.terminal_node_id ? <div className="mt-1 text-[9.5px]" style={{ color: T.textFade }}>Ended at <span className="font-mono" style={{ color: T.text }}>{sim.terminal_node_id.slice(0, 8)}…</span></div> : null}
            </div>
          ) : null}
        </div>
      </div>

      <div className="border-t p-2 text-[9.5px] italic" style={{ borderColor: T.border, color: T.textFade }}>
        Editor produces a validated JourneyDefinition · never executes. Save creates a new draft version through the existing publish endpoint (parser + validator + versioning). Test Journey is a pure dry-run — no DB writes, no send commands. Charter §7 · invariants #11 &amp; #12.
      </div>
    </div>
  );
}

// ── Node config panel ────────────────────────────────────────
function NodeConfig({ node, campaigns, onChange, onDelete }: { node: EditorNode; campaigns: Campaign[]; onChange: (p: Partial<EditorNode>) => void; onDelete: () => void }) {
  const setField = <K extends keyof EditorNode>(k: K, v: EditorNode[K]) => onChange({ [k]: v } as Partial<EditorNode>);
  const setBranch = (side: "yes" | "no", v: string) => onChange({ branches: { ...node.branches, [side]: v } });
  return (
    <div className="p-3">
      <div className="mb-2 flex items-baseline justify-between">
        <div>
          <div className="text-[10px] font-black uppercase tracking-widest" style={{ color: NODE_TONES[node.type] }}>{NODE_LABELS[node.type]}</div>
          <div className="font-mono text-[9px]" style={{ color: T.textFade }}>{node.id}</div>
        </div>
        <button type="button" onClick={onDelete}
          className="rounded-md border px-2 py-1 text-[9.5px]" style={{ background: T.panel, borderColor: T.border, color: T.danger }}>Delete</button>
      </div>

      <Field label="Label (optional · displayed on card)"><input className="w-full rounded-md border px-2 py-1 text-[11px]" style={inputStyle} value={node.label ?? ""} onChange={(e) => setField("label", e.target.value || undefined)} /></Field>

      {node.type === "wait" && (
        <Field label="Wait seconds">
          <input type="number" min={0} className="w-full rounded-md border px-2 py-1 text-[11px]" style={inputStyle}
            value={node.wait_seconds ?? 0} onChange={(e) => setField("wait_seconds", Number(e.target.value))} />
        </Field>
      )}

      {(node.type === "send_campaign" || node.type === "send_campaign_and_wait") && (
        <Field label="Campaign">
          <select className="w-full rounded-md border px-2 py-1 text-[11px]" style={inputStyle}
            value={node.campaign_id ?? ""} onChange={(e) => setField("campaign_id", e.target.value)}>
            <option value="">— pick a campaign —</option>
            {campaigns.map((c) => <option key={c.campaign_id} value={c.campaign_id}>{c.name}</option>)}
          </select>
        </Field>
      )}

      {node.type === "send_campaign_and_wait" && (
        <>
          <Field label="Poll interval seconds">
            <input type="number" min={5} max={3600} className="w-full rounded-md border px-2 py-1 text-[11px]" style={inputStyle}
              value={node.poll_interval_seconds ?? 30} onChange={(e) => setField("poll_interval_seconds", Number(e.target.value))} />
          </Field>
          <Field label="Timeout seconds">
            <input type="number" min={60} className="w-full rounded-md border px-2 py-1 text-[11px]" style={inputStyle}
              value={node.timeout_seconds ?? 86400} onChange={(e) => setField("timeout_seconds", Number(e.target.value))} />
          </Field>
        </>
      )}

      {node.type === "branch" && (
        <>
          <Field label="Condition">
            <select className="w-full rounded-md border px-2 py-1 text-[11px]" style={inputStyle}
              value={node.condition ?? "opened"} onChange={(e) => setField("condition", e.target.value)}>
              {["opened","clicked","delivered","not_opened","not_clicked"].map((c) => <option key={c} value={c}>{c}</option>)}
            </select>
          </Field>
          <Field label="Within seconds">
            <input type="number" min={0} className="w-full rounded-md border px-2 py-1 text-[11px]" style={inputStyle}
              value={node.within_seconds ?? 3600} onChange={(e) => setField("within_seconds", Number(e.target.value))} />
          </Field>
          <div className="mt-2 grid gap-1" style={{ gridTemplateColumns: "1fr 1fr" }}>
            <div><div className="text-[9px] uppercase tracking-widest" style={{ color: T.accent }}>Yes branch</div><input readOnly value={node.branches?.yes ?? ""} className="w-full rounded-md border px-2 py-1 font-mono text-[10px]" style={inputStyle} onChange={(e) => setBranch("yes", e.target.value)} /></div>
            <div><div className="text-[9px] uppercase tracking-widest" style={{ color: T.warning }}>No branch</div><input readOnly value={node.branches?.no ?? ""} className="w-full rounded-md border px-2 py-1 font-mono text-[10px]" style={inputStyle} onChange={(e) => setBranch("no", e.target.value)} /></div>
          </div>
          <div className="mt-1 text-[9px]" style={{ color: T.textFade }}>Draw yes/no connections using the coloured handles on the node card.</div>
        </>
      )}

      {node.type === "goal" && (
        <Field label="Goal key">
          <input className="w-full rounded-md border px-2 py-1 text-[11px]" style={inputStyle}
            value={node.goal_key ?? ""} onChange={(e) => setField("goal_key", e.target.value)} />
        </Field>
      )}

      {node.type === "stop" && (
        <Field label="Reason (optional)">
          <input className="w-full rounded-md border px-2 py-1 text-[11px]" style={inputStyle}
            value={node.reason ?? ""} onChange={(e) => setField("reason", e.target.value)} />
        </Field>
      )}

      {/* Read-only next fields · edited via connection handles */}
      {(node.type === "start" || node.type === "wait" || node.type === "send_campaign" || node.type === "goal") && (
        <div className="mt-2 text-[9.5px]" style={{ color: T.textFade }}>Next: <span className="font-mono" style={{ color: T.text }}>{node.next || "— unlinked —"}</span></div>
      )}
      {node.type === "send_campaign_and_wait" && (
        <div className="mt-2 space-y-0.5 text-[9.5px]">
          <div style={{ color: T.textFade }}>On completion: <span className="font-mono" style={{ color: T.accent }}>{node.next_on_completion || "— unlinked —"}</span></div>
          <div style={{ color: T.textFade }}>On failure: <span className="font-mono" style={{ color: T.warning }}>{node.next_on_failure || "— not set · will Stop —"}</span></div>
        </div>
      )}
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="mt-2 block">
      <div className="mb-0.5 text-[9px] font-black uppercase tracking-widest" style={{ color: T.textFade }}>{label}</div>
      {children}
    </label>
  );
}

function summarise(n: EditorNode): string {
  switch (n.type) {
    case "start": return "Journey starts here";
    case "wait": return `Wait ${n.wait_seconds ?? 0}s`;
    case "send_campaign":          return n.campaign_id ? `Send campaign ${String(n.campaign_id).slice(0, 8)}…` : "Send campaign · pick one";
    case "send_campaign_and_wait": return n.campaign_id ? `Send + wait for completion` : "Send + wait · pick a campaign";
    case "branch": return `Branch on ${n.condition ?? "opened"}`;
    case "goal": return `Goal: ${n.goal_key ?? "—"}`;
    case "stop": return n.reason || "Stop";
  }
}

// ── Client-side simulator (matches server logic for unsaved drafts) ─
function localSimulate(def: EditorDefinition): SimResult {
  const byId = new Map(def.nodes.map((n) => [n.id, n] as const));
  const start = def.nodes.find((n) => n.type === "start");
  if (!start) return { ok: false, reason: "invalid_definition · no Start", steps: [], terminal_node_id: null, branch_overrides_used: {} };
  const steps: SimStep[] = [];
  const branch_overrides_used: Record<string, "yes" | "no"> = {};
  const visited = new Map<string, number>();
  let cur: string | undefined = start.id;
  let n = 0;
  while (cur && n < 200) {
    n++;
    const v = visited.get(cur) ?? 0;
    if (v > 3) { steps.push({ node_id: cur, node_type: "cycle", outcome: "failed", detail: "cycle guard" }); return { ok: false, reason: "cycle_guard_hit", steps, terminal_node_id: cur, branch_overrides_used }; }
    visited.set(cur, v + 1);
    const node = byId.get(cur);
    if (!node) { steps.push({ node_id: cur, node_type: "missing", outcome: "failed", detail: "node missing" }); return { ok: false, reason: "failed", steps, terminal_node_id: cur, branch_overrides_used }; }
    if (node.type === "start")                    { steps.push({ node_id: node.id, node_type: node.type, outcome: "advanced", detail: `Start → ${node.next}`, next: node.next }); cur = node.next || undefined; continue; }
    if (node.type === "wait")                     { steps.push({ node_id: node.id, node_type: node.type, outcome: "waited_collapsed", detail: `Wait ${node.wait_seconds}s (collapsed)`, next: node.next }); cur = node.next || undefined; continue; }
    if (node.type === "send_campaign")            { steps.push({ node_id: node.id, node_type: node.type, outcome: "sent_assumed", detail: `Emit enqueue_send_batch · ${String(node.campaign_id).slice(0,8) || "campaign not set"}…`, next: node.next }); cur = node.next || undefined; continue; }
    if (node.type === "send_campaign_and_wait")   { steps.push({ node_id: node.id, node_type: node.type, outcome: "sent_and_wait_completed", detail: `Emit + wait · assumed sent → ${node.next_on_completion}`, next: node.next_on_completion }); cur = node.next_on_completion || undefined; continue; }
    if (node.type === "branch")                   { branch_overrides_used[node.id] = "yes"; steps.push({ node_id: node.id, node_type: node.type, outcome: "branch_taken", detail: `Branch on '${node.condition}' · assumed=yes → ${node.branches?.yes}`, next: node.branches?.yes }); cur = node.branches?.yes || undefined; continue; }
    if (node.type === "goal")                     { steps.push({ node_id: node.id, node_type: node.type, outcome: node.next ? "advanced" : "goal", detail: `Goal reached · ${node.goal_key}${node.next ? ` → ${node.next}` : " · terminal"}`, next: node.next }); if (!node.next) return { ok: true, reason: "completed", steps, terminal_node_id: node.id, branch_overrides_used }; cur = node.next; continue; }
    if (node.type === "stop")                     { steps.push({ node_id: node.id, node_type: node.type, outcome: "stopped", detail: node.reason || "Stop node" }); return { ok: true, reason: "stopped", steps, terminal_node_id: node.id, branch_overrides_used }; }
    break;
  }
  return { ok: false, reason: "max_steps_reached", steps, terminal_node_id: cur ?? null, branch_overrides_used };
}
