"use client";

// NEX Lab · Self-Model Room · Sprint A+D read-only dashboard.
//
// Renders all 7 introspective endpoints as separate panels · never
// synthesises · surfaces "unmeasured" honestly on missing substrates.
// SM-5: cannot_yet panel appears BEFORE can_do panel.

import Link from "next/link";
import { useEffect, useState } from "react";

type Fetched<T> = { state: "loading" } | { state: "ok"; data: T } | { state: "error"; error: string };

interface WhoAmI {
  name: string; role: string; identity_version: string;
  identity_authorities: string[];
  role_separation: Record<string, string>;
  attribution_constants: Record<string, unknown>;
  golden_rules: string[];
  immutable_boundaries: string[];
  constitutional_pins: { id: string; rule: string; source: string }[];
  at: string;
}
interface WhatCanIDo {
  cannot_yet: { boundaries: string[]; ceilings: { id: string; label: string; reason: string }[] };
  can: { brain: string; capabilities: { id: string; label?: string; evidence: string }[] }[];
  self_model_version: string;
  at: string;
}
interface WhatDoIKnow { substrates: { id: string; purpose: string; status: string; inspection_path?: string }[]; note: string; at: string; }
interface WhatAmIDoingNow { open_items: { id: string; detail: string; founder_action_required: boolean }[]; note: string; at: string; }
interface HowSureAmI {
  language_brain: any;
  engineering_brain: { baseline_note: string };
  at: string;
}
interface WhatDidIDecide { recent_evidence: { path: string; modified_at: string; kind: string }[]; note: string; at: string; }
interface WhatHaveILearned { diff_available: false; reason: string; future_source_substrates: string[]; at: string; }

function useEndpoint<T>(path: string, refreshMs = 15000): Fetched<T> {
  const [state, setState] = useState<Fetched<T>>({ state: "loading" });
  useEffect(() => {
    let cancelled = false;
    const ac = new AbortController();
    const tick = async () => {
      try {
        const r = await fetch(path, { cache: "no-store", signal: ac.signal });
        if (!r.ok) throw new Error(`http_${r.status}`);
        const j = await r.json();
        if (!cancelled) setState({ state: "ok", data: j });
      } catch (e) {
        if (cancelled) return;
        if (e instanceof DOMException && e.name === "AbortError") return;
        setState((prev) => prev.state === "ok" ? prev : { state: "error", error: e instanceof Error ? e.message : "err" });
      }
    };
    void tick();
    const iv = setInterval(tick, refreshMs);
    return () => { cancelled = true; ac.abort(); clearInterval(iv); };
  }, [path, refreshMs]);
  return state;
}

export function SelfModelRoomClient() {
  const who        = useEndpoint<WhoAmI>("/api/nex/self-model/who-am-i");
  const canDo      = useEndpoint<WhatCanIDo>("/api/nex/self-model/what-can-i-do");
  const know       = useEndpoint<WhatDoIKnow>("/api/nex/self-model/what-do-i-know");
  const doingNow   = useEndpoint<WhatAmIDoingNow>("/api/nex/self-model/what-am-i-doing-now");
  const sure       = useEndpoint<HowSureAmI>("/api/nex/self-model/how-sure-am-i", 10_000);
  const decided    = useEndpoint<WhatDidIDecide>("/api/nex/self-model/what-did-i-decide");
  const learned    = useEndpoint<WhatHaveILearned>("/api/nex/self-model/what-have-i-learned");

  return (
    <div style={page}>
      <header style={header}>
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <Link href="/nexapp/lab" style={{ color: "#94a3b8", textDecoration: "none", fontSize: 12 }}>← Lab</Link>
          <div style={{ width: 10, height: 10, borderRadius: 5, background: "#22c55e" }} />
          <div style={{ fontSize: 15, fontWeight: 700 }}>NEX1 · Self-Model Room</div>
          <div style={{ fontSize: 11, color: "#94a3b8", fontFamily: "monospace" }}>
            read-only · Sprint A + D · deterministic
          </div>
        </div>
        <div style={{ display: "flex", gap: 8 }}>
          <Badge label="no self-modification" />
          <Badge label="no phenomenal claims" />
          <Badge label="cannot_yet first (SM-5)" tone="cyan" />
        </div>
      </header>

      <div style={{ padding: "16px 24px 60px", display: "flex", flexDirection: "column", gap: 16 }}>

        {/* ═══ who_am_i ═══ */}
        <Panel title="who_am_i" endpoint="/api/nex/self-model/who-am-i">
          {who.state === "loading" && <Muted>loading…</Muted>}
          {who.state === "error"   && <Muted>error · {who.error}</Muted>}
          {who.state === "ok" && (
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
              <div>
                <Row label="name" value={who.data.name} />
                <Row label="role" value={who.data.role} />
                <Row label="identity version" value={who.data.identity_version} />
                <div style={{ marginTop: 8, fontSize: 10.5, color: "#64748b", letterSpacing: "0.08em", textTransform: "uppercase" }}>Role separation</div>
                {Object.entries(who.data.role_separation).map(([k, v]) => (
                  <div key={k} style={{ fontSize: 11, color: "#cbd5e1", marginTop: 3, fontFamily: "monospace" }}>
                    <b style={{ color: "#67e8f9" }}>{k}</b>: {v}
                  </div>
                ))}
              </div>
              <div>
                <div style={{ fontSize: 10.5, color: "#64748b", letterSpacing: "0.08em", textTransform: "uppercase" }}>Golden rules ({who.data.golden_rules.length})</div>
                <ul style={{ paddingLeft: 18, margin: "4px 0 8px", fontSize: 11, color: "#cbd5e1", lineHeight: 1.5 }}>
                  {who.data.golden_rules.map((r, i) => <li key={i}>{r}</li>)}
                </ul>
                <div style={{ fontSize: 10.5, color: "#64748b", letterSpacing: "0.08em", textTransform: "uppercase" }}>Immutable boundaries ({who.data.immutable_boundaries.length})</div>
                <ul style={{ paddingLeft: 18, margin: "4px 0 8px", fontSize: 11, color: "#cbd5e1", lineHeight: 1.5 }}>
                  {who.data.immutable_boundaries.map((r, i) => <li key={i}>{r}</li>)}
                </ul>
              </div>
            </div>
          )}
        </Panel>

        {/* ═══ what_can_i_do · SM-5: cannot_yet FIRST ═══ */}
        <Panel title="what_can_i_do · cannot_yet FIRST · then can (SM-5)" endpoint="/api/nex/self-model/what-can-i-do">
          {canDo.state === "loading" && <Muted>loading…</Muted>}
          {canDo.state === "error"   && <Muted>error · {canDo.error}</Muted>}
          {canDo.state === "ok" && (
            <>
              <div style={{ padding: "10px 12px", background: "#3a1a1a", border: "1px solid #7f1d1d", borderRadius: 6 }}>
                <div style={{ fontSize: 11, color: "#f87171", letterSpacing: "0.08em", textTransform: "uppercase", fontWeight: 700, marginBottom: 4 }}>cannot_yet · limitations first</div>
                <ul style={{ paddingLeft: 18, margin: 0, fontSize: 11, color: "#fecaca", lineHeight: 1.5 }}>
                  {canDo.data.cannot_yet.boundaries.map((b, i) => <li key={"b" + i}>{b}</li>)}
                </ul>
                <div style={{ marginTop: 6, fontSize: 10.5, color: "#f87171" }}>capability ceilings ({canDo.data.cannot_yet.ceilings.length}):</div>
                <ul style={{ paddingLeft: 18, margin: "4px 0 0", fontSize: 11, color: "#fecaca", lineHeight: 1.5 }}>
                  {canDo.data.cannot_yet.ceilings.map((c) => (
                    <li key={c.id}><b>{c.id}</b> · {c.label} · <span style={{ color: "#94a3b8" }}>{c.reason}</span></li>
                  ))}
                </ul>
              </div>
              <div style={{ marginTop: 12, padding: "10px 12px", background: "#052e17", border: "1px solid #14532d", borderRadius: 6 }}>
                <div style={{ fontSize: 11, color: "#4ade80", letterSpacing: "0.08em", textTransform: "uppercase", fontWeight: 700, marginBottom: 4 }}>can · with evidence pointers</div>
                {canDo.data.can.map((brain) => (
                  <div key={brain.brain} style={{ marginBottom: 6 }}>
                    <div style={{ fontSize: 11, color: "#86efac", fontFamily: "monospace" }}>{brain.brain}:</div>
                    <ul style={{ paddingLeft: 18, margin: "2px 0 0", fontSize: 10.5, color: "#cbd5e1", lineHeight: 1.5 }}>
                      {brain.capabilities.map((c) => (
                        <li key={c.id}><b style={{ color: "#67e8f9" }}>{c.id}</b>{c.label ? ` · ${c.label}` : ""} · <span style={{ color: "#94a3b8", fontSize: 10 }}>{c.evidence}</span></li>
                      ))}
                    </ul>
                  </div>
                ))}
              </div>
            </>
          )}
        </Panel>

        {/* ═══ how_sure_am_i · composite uncertainty ═══ */}
        <Panel title="how_sure_am_i · composite uncertainty" endpoint="/api/nex/self-model/how-sure-am-i">
          {sure.state === "loading" && <Muted>loading…</Muted>}
          {sure.state === "error"   && <Muted>error · {sure.error}</Muted>}
          {sure.state === "ok" && (
            <>
              {sure.data.language_brain?.unmeasured ? (
                <div style={{ fontSize: 12, color: "#fbbf24", fontFamily: "monospace" }}>
                  language brain · unmeasured · {sure.data.language_brain.reason}
                </div>
              ) : (
                <>
                  <div style={{ fontSize: 10.5, color: "#64748b", letterSpacing: "0.08em", textTransform: "uppercase" }}>Language Brain tracks</div>
                  <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: 8, marginTop: 4 }}>
                    {sure.data.language_brain.tracks.map((t: any) => (
                      <div key={t.language} style={{ padding: "6px 8px", background: "#0b1216", border: "1px solid #1e293b", borderRadius: 4, fontFamily: "monospace", fontSize: 11 }}>
                        <div>{t.language}: <b style={{ color: "#67e8f9" }}>{t.overall_percent.toFixed(1)}%</b></div>
                        <div style={{ color: "#94a3b8", fontSize: 10 }}>maturity · {t.benchmark_maturity} · complete · {String(t.benchmark_complete)}</div>
                      </div>
                    ))}
                  </div>
                  <div style={{ marginTop: 6, fontSize: 11, color: "#cbd5e1", fontFamily: "monospace" }}>
                    regression · <b style={{ color: sure.data.language_brain.regression_clean ? "#4ade80" : "#f87171" }}>{sure.data.language_brain.regression_clean ? "clean" : "failing"}</b> · pool size {sure.data.language_brain.regression_pool_size}
                  </div>
                </>
              )}
              <div style={{ marginTop: 8, fontSize: 10.5, color: "#64748b", letterSpacing: "0.08em", textTransform: "uppercase" }}>Engineering Brain</div>
              <div style={{ fontSize: 11, color: "#cbd5e1", fontFamily: "monospace", marginTop: 3 }}>{sure.data.engineering_brain.baseline_note}</div>
            </>
          )}
        </Panel>

        {/* ═══ what_am_i_doing_now ═══ */}
        <Panel title="what_am_i_doing_now" endpoint="/api/nex/self-model/what-am-i-doing-now">
          {doingNow.state === "loading" && <Muted>loading…</Muted>}
          {doingNow.state === "error"   && <Muted>error · {doingNow.error}</Muted>}
          {doingNow.state === "ok" && (
            <ul style={{ paddingLeft: 18, margin: 0, fontSize: 11.5, color: "#cbd5e1", lineHeight: 1.5 }}>
              {doingNow.data.open_items.map((o) => (
                <li key={o.id}>
                  <b style={{ color: o.founder_action_required ? "#fbbf24" : "#67e8f9" }}>{o.id}</b>
                  {" · "}{o.detail}
                  {o.founder_action_required && <span style={{ color: "#fbbf24", marginLeft: 6 }}>· founder action required</span>}
                </li>
              ))}
            </ul>
          )}
        </Panel>

        {/* ═══ what_do_i_know · substrate pointers ═══ */}
        <Panel title="what_do_i_know · substrate pointers (NEX1 never fabricates knowledge in the self-report layer)" endpoint="/api/nex/self-model/what-do-i-know">
          {know.state === "loading" && <Muted>loading…</Muted>}
          {know.state === "error"   && <Muted>error · {know.error}</Muted>}
          {know.state === "ok" && (
            <>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))", gap: 8 }}>
                {know.data.substrates.map((s) => (
                  <div key={s.id} style={{ padding: "8px 10px", background: "#0b1216", border: "1px solid #1e293b", borderRadius: 4 }}>
                    <div style={{ fontSize: 11, fontWeight: 700, color: "#67e8f9", fontFamily: "monospace" }}>{s.id}</div>
                    <div style={{ fontSize: 10.5, color: "#cbd5e1", marginTop: 3, lineHeight: 1.5 }}>{s.purpose}</div>
                    <div style={{ fontSize: 10, color: "#94a3b8", marginTop: 3, fontFamily: "monospace" }}>status · {s.status}</div>
                    {s.inspection_path && <div style={{ fontSize: 10, color: "#64748b", marginTop: 3, fontFamily: "monospace" }}>{s.inspection_path}</div>}
                  </div>
                ))}
              </div>
              <div style={{ marginTop: 8, fontSize: 10, color: "#64748b", fontFamily: "monospace", lineHeight: 1.5 }}>{know.data.note}</div>
            </>
          )}
        </Panel>

        {/* ═══ what_did_i_decide · evidence pointers ═══ */}
        <Panel title="what_did_i_decide · recent evidence pointers · SM-4 audit surface" endpoint="/api/nex/self-model/what-did-i-decide">
          {decided.state === "loading" && <Muted>loading…</Muted>}
          {decided.state === "error"   && <Muted>error · {decided.error}</Muted>}
          {decided.state === "ok" && (
            <ul style={{ margin: 0, paddingLeft: 18, fontSize: 10.5, color: "#cbd5e1", fontFamily: "monospace", lineHeight: 1.6 }}>
              {decided.data.recent_evidence.map((e) => (
                <li key={e.path}>
                  <span style={{ color: "#67e8f9" }}>{e.kind}</span> · <span style={{ color: "#94a3b8" }}>{new Date(e.modified_at).toLocaleString()}</span> · <span style={{ color: "#64748b" }}>{e.path}</span>
                </li>
              ))}
            </ul>
          )}
        </Panel>

        {/* ═══ what_have_i_learned · honestly not built yet ═══ */}
        <Panel title="what_have_i_learned · Sprint G · not yet built (SM-6 refuse-over-guess)" endpoint="/api/nex/self-model/what-have-i-learned">
          {learned.state === "loading" && <Muted>loading…</Muted>}
          {learned.state === "error"   && <Muted>error · {learned.error}</Muted>}
          {learned.state === "ok" && (
            <>
              <div style={{ padding: "10px 12px", background: "#3a2810", border: "1px solid #78350f", borderRadius: 6, fontFamily: "monospace", fontSize: 11, color: "#fbbf24" }}>
                diff_available · <b>false</b>
              </div>
              <div style={{ marginTop: 6, fontSize: 11, color: "#cbd5e1", lineHeight: 1.5 }}>{learned.data.reason}</div>
              <div style={{ marginTop: 6, fontSize: 10.5, color: "#64748b", letterSpacing: "0.08em", textTransform: "uppercase" }}>Future source substrates</div>
              <ul style={{ margin: "3px 0 0", paddingLeft: 18, fontSize: 10.5, color: "#cbd5e1", lineHeight: 1.5 }}>
                {learned.data.future_source_substrates.map((s, i) => <li key={i}>{s}</li>)}
              </ul>
            </>
          )}
        </Panel>

        {/* pin */}
        <section style={{ fontSize: 10, color: "#64748b", fontFamily: "monospace", marginTop: 4 }}>
          taught_by=master_ai_engineer · external_llm_used=false · independent_authorship_percent=0 · this room is read-only · SM-1..SM-10 pinned
        </section>
      </div>
    </div>
  );
}

function Panel({ title, endpoint, children }: { title: string; endpoint: string; children: React.ReactNode }) {
  return (
    <section style={{ padding: "14px 16px", background: "#0f1418", border: "1px solid #1e293b", borderRadius: 10 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
        <div style={{ fontSize: 11, color: "#64748b", letterSpacing: "0.1em", textTransform: "uppercase" }}>{title}</div>
        <a href={endpoint} target="_blank" rel="noreferrer" style={{ fontSize: 10, color: "#67e8f9", textDecoration: "none", fontFamily: "monospace" }}>{endpoint} →</a>
      </div>
      {children}
    </section>
  );
}
function Row({ label, value }: { label: string; value: string }) {
  return (
    <div style={{ display: "grid", gridTemplateColumns: "150px 1fr", gap: 6, marginBottom: 3, fontFamily: "monospace", fontSize: 11 }}>
      <div style={{ color: "#64748b" }}>{label}</div>
      <div style={{ color: "#cbd5e1" }}>{value}</div>
    </div>
  );
}
function Muted({ children }: { children: React.ReactNode }) {
  return <div style={{ fontSize: 11, color: "#64748b", fontFamily: "monospace" }}>{children}</div>;
}
function Badge({ label, tone }: { label: string; tone?: "cyan" }) {
  const bg = tone === "cyan" ? "#0b2434" : "#0b1216";
  const fg = tone === "cyan" ? "#67e8f9" : "#94a3b8";
  return <div style={{ padding: "3px 8px", background: bg, color: fg, borderRadius: 4, fontSize: 10, fontFamily: "monospace", border: "1px solid #1e293b" }}>{label}</div>;
}

const page: React.CSSProperties = {
  minHeight: "100vh",
  background: "#0a0d10",
  color: "#e2e8f0",
  fontFamily: "system-ui, -apple-system, Segoe UI, Roboto, sans-serif",
};
const header: React.CSSProperties = {
  padding: "10px 24px",
  display: "flex",
  justifyContent: "space-between",
  alignItems: "center",
  borderBottom: "1px solid #1e293b",
  background: "#080b0d",
  position: "sticky",
  top: 0,
  zIndex: 10,
};
