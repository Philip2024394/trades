"use client";

// Founder ADR-0304 + 2026-09-10 · Lab landing as ONE scrolling page.
// Sticky header with jump buttons scrolls each section into view.
// Every section is a full "room" panel. Innovation Room is the last section.

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { WorkingCog } from "@/components/nex-app/hq/WorkingCog";

interface Room {
  slug: string;
  display_name: string;
  primary_agent_id: string;
  target_records: number;
  harvest_rows: number | null;
  verified_rows: number | null;
  growth_1h_pct: number | null;
  latest_snapshot_iso: string | null;
  last_harvested_age_sec: number | null;
  last_harvested_at_iso: string | null;
}
interface LabStatus {
  ts_iso: string;
  total_rooms: number;
  total_harvest_rows: number;
  total_verified_rows: number;
  pending_promotions: number;
  rooms: Room[];
}

interface Idea {
  idea_id: string;
  category: string;
  title: string;
  user_need: string;
  description: string;
  why_missing: string;
  engineering_brief: string;
  difficulty: string;
  user_value: string;
  status: string;
}
interface IdeasPayload { ideas: Idea[]; counts_by_status: Record<string, number>; }

const CATEGORY_COLORS: Record<string, string> = {
  chat_answer:    "#38bdf8",
  discovery_ui:   "#a78bfa",
  trust_signal:   "#4ade80",
  community_layer:"#f59e0b",
  offline_mode:   "#22d3ee",
  founder_tool:   "#fb7185",
  monetization:   "#facc15",
  accessibility:  "#f472b6",
};

interface LanguageRoomSummarySection {
  language: "english" | "bahasa_indonesia" | "code_switch" | "programming";
  overall_percent: number;
  case_count: number;
  level: string;
  benchmark_complete: boolean;
  benchmark_maturity: "pilot" | "expanding" | "mature" | "proven";
  coverage: { public: number; hidden: number; adversarial: number; regression: number; total: number };
}
interface LanguageRoomSummary {
  at: string;
  registry_version: string;
  regression_pool_size: number;
  regression_clean: boolean;
  regression_failed_ids: string[];
  sections: LanguageRoomSummarySection[];
}

export function LabLandingClient() {
  const [lab, setLab] = useState<LabStatus | null>(null);
  const [ideas, setIdeas] = useState<IdeasPayload | null>(null);
  const [language, setLanguage] = useState<LanguageRoomSummary | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [ping, setPing] = useState(0);
  const [expandedIdea, setExpandedIdea] = useState<string | null>(null);
  const [modalBrief, setModalBrief] = useState<{ title: string; brief: string } | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const sectionsRef = useRef<Record<string, HTMLElement | null>>({});

  useEffect(() => {
    let cancelled = false;
    const ac = new AbortController();
    const tick = async () => {
      if (cancelled) return;
      try {
        const [labR, ideasR, langR] = await Promise.all([
          fetch("/api/nex/lab/status", { cache: "no-store", signal: ac.signal }),
          fetch("/api/nex/lab/ideas?status=proposed", { cache: "no-store", signal: ac.signal }),
          fetch("/api/nex/lab/language-room/status", { cache: "no-store", signal: ac.signal }),
        ]);
        if (cancelled) return;
        if (!labR.ok) throw new Error(`lab_http_${labR.status}`);
        const labJson = await labR.json();
        const ideasJson = ideasR.ok ? await ideasR.json() : { ideas: [], counts_by_status: {} };
        const langJson = langR.ok ? await langR.json() : null;
        if (!cancelled) { setLab(labJson); setIdeas(ideasJson); setLanguage(langJson); setErr(null); }
      } catch (e) {
        if (cancelled) return;
        if (e instanceof DOMException && e.name === "AbortError") return;
        setErr(e instanceof Error ? e.message.slice(0, 80) : "err");
      } finally { if (!cancelled) setPing((n) => n + 1); }
    };
    void tick();
    const iv = setInterval(tick, 8000);
    return () => { cancelled = true; ac.abort(); clearInterval(iv); };
  }, []);

  const scrollTo = (slug: string) => {
    const el = sectionsRef.current[slug];
    if (el) el.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  async function approveIdea(idea: Idea) {
    setBusy(idea.idea_id);
    try {
      const r = await fetch(`/api/nex/lab/ideas/${idea.idea_id}/approve`, {
        method: "POST", headers: { "content-type": "application/json" },
        body: JSON.stringify({ decided_by: "founder" }),
      });
      const j = await r.json();
      if (j.ok && j.brief) { setModalBrief({ title: idea.title, brief: j.brief }); setCopied(false); }
      else alert("approve failed: " + (j.error ?? "unknown"));
    } finally { setBusy(null); }
  }
  async function copyBrief() {
    if (!modalBrief) return;
    try { await navigator.clipboard.writeText(modalBrief.brief); setCopied(true); setTimeout(() => setCopied(false), 3000); }
    catch { alert("clipboard unavailable · select all + copy manually"); }
  }

  const rooms = lab?.rooms ?? [];
  const proposedIdeas = ideas?.ideas ?? [];

  return (
    <div style={page}>
      <header style={header}>
        <div style={{ display: "flex", alignItems: "center", gap: 10, minWidth: 0 }}>
          <div style={{ width: 10, height: 10, borderRadius: 5, background: "#22c55e", boxShadow: "0 0 8px #22c55e88", flexShrink: 0 }} />
          <div style={{ fontSize: 14, fontWeight: 700, whiteSpace: "nowrap" }}>NEX · LAB</div>
          <div style={{ fontSize: 11, color: "#94a3b8", fontFamily: "monospace", whiteSpace: "nowrap" }}>{ping ? `tick ${ping}` : "connecting…"}</div>
        </div>
        <nav style={navBar}>
          {rooms.map((r) => (
            <button
              key={r.slug} onClick={() => scrollTo(r.slug)}
              style={{
                ...navBtn,
                borderColor: (r.harvest_rows ?? 0) > 0 ? "#334155" : "#1e293b",
                color: (r.harvest_rows ?? 0) > 0 ? "#cbd5e1" : "#64748b",
              }}
              title={`${r.display_name} · ${(r.harvest_rows ?? 0).toLocaleString()} rows`}
            >
              {r.display_name.replace(/ Lab$/, "").replace(/ & Rentals/, "")}
              <span style={navBtnCount}>{(r.harvest_rows ?? 0) > 0 ? (r.harvest_rows ?? 0).toLocaleString() : "0"}</span>
            </button>
          ))}
          <button onClick={() => scrollTo("innovation")} style={{ ...navBtn, borderColor: "#4c1d95", color: "#c4b5fd" }}
            title={`Innovation Room · ${proposedIdeas.length} proposed ideas`}>
            💡 Ideas
            <span style={navBtnCount}>{proposedIdeas.length}</span>
          </button>
          <button onClick={() => scrollTo("language-room")} style={{ ...navBtn, borderColor: "#164e63", color: "#67e8f9" }}
            title={`Language Room · ${language?.sections.length ?? 0} tracks · registry ${language?.registry_version ?? "…"}`}>
            🧠 Language
            <span style={navBtnCount}>{language ? `${language.sections.length}×` : "…"}</span>
          </button>
          <button onClick={() => scrollTo("agent-room")} style={{ ...navBtn, borderColor: "#5b21b6", color: "#c4b5fd" }}
            title="Agent Room · pipeline diagram">
            🧭 Agent
            <span style={navBtnCount}>flow</span>
          </button>
          <button onClick={() => scrollTo("self-model")} style={{ ...navBtn, borderColor: "#7c2d12", color: "#fdba74" }}
            title="Self-Model Room · introspective reporter">
            🪞 Self-Model
            <span style={navBtnCount}>v0</span>
          </button>
          <button onClick={() => scrollTo("origin-canon")} style={{ ...navBtn, borderColor: "#7f1d1d", color: "#fca5a5" }}
            title="Origin Canon · founder-internal">
            🕯 Origin Canon
            <span style={navBtnCount}>internal</span>
          </button>
          <button onClick={() => scrollTo("shadow-mode")} style={{ ...navBtn, borderColor: "#78350f", color: "#fdba74" }}
            title="Shadow Mode · founder-only observation">
            👁 Shadow
            <span style={navBtnCount}>obs</span>
          </button>
        </nav>
        <div style={{ display: "flex", gap: 8, alignItems: "center", flexShrink: 0 }}>
          <span style={statChip}><span style={statLabel}>harvest </span>{lab?.total_harvest_rows?.toLocaleString() ?? "—"}</span>
          <span style={statChip}><span style={statLabel}>verified </span>{lab?.total_verified_rows?.toLocaleString() ?? "—"}</span>
          <Link href="/nexapp/lab/brief" style={navLink}>brief →</Link>
          <Link href="/nexapp/lab/promotions" style={navLink}>promotions →</Link>
          <Link href="/nexapp/hq" style={navLink}>HQ →</Link>
          {err && <span style={{ color: "#f87171", fontSize: 11 }}>err · {err}</span>}
        </div>
      </header>

      <div style={{ padding: "24px 24px 80px" }}>
        {rooms.map((r) => <RoomSection key={r.slug} room={r} sectionRef={(el) => { sectionsRef.current[r.slug] = el; }} />)}

        {/* Language Brain has moved · founder 2026-09-12 · now lives on /nexapp/hq */}
        <section
          id="language-room"
          ref={(el) => { sectionsRef.current["language-room"] = el; }}
          style={{ ...sectionBase, borderLeft: "4px solid #06b6d4", scrollMarginTop: 72 }}
        >
          <div style={sectionHeader}>
            <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
              <div style={{ fontSize: 22 }}>🧠</div>
              <div>
                <div style={{ fontSize: 18, fontWeight: 700 }}>Language Brain</div>
                <div style={{ fontSize: 12, color: "#64748b", fontFamily: "monospace" }}>
                  moved to <b style={{ color: "#67e8f9" }}>Live HQ</b> · founder 2026-09-12
                </div>
              </div>
            </div>
            <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
              <Link href="/nexapp/hq" style={navLink}>open HQ live →</Link>
              <Link href="/nexapp/lab/language-room" style={navLink}>full room →</Link>
            </div>
          </div>
          <div style={{ marginTop: 8, fontSize: 12, color: "#94a3b8" }}>
            The Language Brain live section is now under the Live HQ Lab area, with the WorkingCog animation, consumer-pipeline diagram, and all countries × language readiness table.
          </div>
        </section>

        {/* Agent Room · pipeline diagram · founder directive 2026-09-12 */}
        <section
          id="agent-room"
          ref={(el) => { sectionsRef.current["agent-room"] = el; }}
          style={{ ...sectionBase, borderLeft: "4px solid #a78bfa", scrollMarginTop: 72 }}
        >
          <div style={sectionHeader}>
            <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
              <div style={{ fontSize: 22 }}>🧭</div>
              <div>
                <div style={{ fontSize: 18, fontWeight: 700 }}>Agent Room · Pipeline Diagram</div>
                <div style={{ fontSize: 12, color: "#64748b", fontFamily: "monospace" }}>
                  visualises the deterministic NEX1 flow · user → normalise → safety → detect → intent → outcome → handoff
                </div>
              </div>
            </div>
            <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
              <Link href="/nexapp/lab/agent-room" style={navLink}>full diagram →</Link>
            </div>
          </div>
          <div style={{
            marginTop: 12,
            padding: "14px 18px",
            background: "linear-gradient(180deg, #0a1013 0%, #0d1418 100%)",
            border: "1px solid #1e293b",
            borderRadius: 10,
            display: "grid",
            gridTemplateColumns: "1fr auto 1fr auto 1fr auto 1fr auto 1fr",
            gap: 8,
            alignItems: "center",
            fontSize: 11,
            fontFamily: "monospace",
          }}>
            <FlowNode label="user" body="utterance" tone="cyan" />
            <FlowArrow />
            <FlowNode label="pre-proc" body="normalise · safety · detect" tone="cyan" />
            <FlowArrow />
            <FlowNode label="intent bridge" body={`registry ${language?.registry_version ?? "…"} · ${language?.sections.length ?? 0} tracks`} tone="cyan" />
            <FlowArrow />
            <FlowNode label="outcome" body="clarify · refuse · recognised" tone="amber" />
            <FlowArrow />
            <FlowNode label="handoff" body="IPT · engineering · master AI · marketplace" tone="violet" />
          </div>
          <div style={{ marginTop: 10, fontSize: 10, color: "#64748b", fontFamily: "monospace" }}>
            every stage fails-closed · no LLM · deterministic Path A · click "full diagram →" for detailed view with live counters
          </div>
        </section>

        {/* Self-Model Room · founder-authorised Sprint A + D · 2026-09-12 */}
        <section
          id="self-model"
          ref={(el) => { sectionsRef.current["self-model"] = el; }}
          style={{ ...sectionBase, borderLeft: "4px solid #c2410c", scrollMarginTop: 72 }}
        >
          <div style={sectionHeader}>
            <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
              <div style={{ fontSize: 22 }}>🪞</div>
              <div>
                <div style={{ fontSize: 18, fontWeight: 700 }}>Self-Model Room · NEX1 introspective reporter</div>
                <div style={{ fontSize: 12, color: "#64748b", fontFamily: "monospace" }}>
                  read-only · 7 endpoints · SM-1…SM-10 pinned · no phenomenal claims
                </div>
              </div>
            </div>
            <Link href="/nexapp/lab/self-model" style={navLink}>open room →</Link>
          </div>
          <div style={{ marginTop: 8, display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: 8 }}>
            {[
              { p: "/api/nex/self-model/who-am-i",             label: "who_am_i",           note: "identity · pins · attribution constants" },
              { p: "/api/nex/self-model/what-can-i-do",        label: "what_can_i_do",      note: "cannot_yet FIRST · then can · SM-5" },
              { p: "/api/nex/self-model/what-do-i-know",       label: "what_do_i_know",     note: "substrate pointers · SM-6" },
              { p: "/api/nex/self-model/what-am-i-doing-now",  label: "what_am_i_doing_now",note: "founder-authored open items" },
              { p: "/api/nex/self-model/how-sure-am-i",        label: "how_sure_am_i",      note: "composite uncertainty" },
              { p: "/api/nex/self-model/what-did-i-decide",    label: "what_did_i_decide",  note: "evidence pointers" },
              { p: "/api/nex/self-model/what-have-i-learned",  label: "what_have_i_learned",note: "honestly Sprint G · not built" },
            ].map((ep) => (
              <a key={ep.p} href={ep.p} target="_blank" rel="noreferrer" style={{ textDecoration: "none" }}>
                <div style={{ padding: "10px 12px", background: "#0f1418", border: "1px solid #1e293b", borderRadius: 6 }}>
                  <div style={{ fontSize: 11, fontFamily: "monospace", color: "#fdba74", fontWeight: 700 }}>{ep.label} →</div>
                  <div style={{ fontSize: 10, color: "#94a3b8", marginTop: 3, lineHeight: 1.4 }}>{ep.note}</div>
                </div>
              </a>
            ))}
          </div>
          <div style={{ marginTop: 8, fontSize: 10, color: "#64748b", fontFamily: "monospace" }}>
            Sprint A + D built · Sprint B (Constitutional Enforcer runtime gate) requires explicit AUTHORISE · Sprints C/E/F/G/H deferred
          </div>
        </section>

        {/* Origin Canon Room · founder-internal · authorised 2026-09-12 · reveal cadence HOLD */}
        <section
          id="origin-canon"
          ref={(el) => { sectionsRef.current["origin-canon"] = el; }}
          style={{ ...sectionBase, borderLeft: "4px solid #b91c1c", scrollMarginTop: 72 }}
        >
          <div style={sectionHeader}>
            <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
              <div style={{ fontSize: 22 }}>🕯</div>
              <div>
                <div style={{ fontSize: 18, fontWeight: 700 }}>Origin Canon · founder-internal room</div>
                <div style={{ fontSize: 12, color: "#64748b", fontFamily: "monospace" }}>
                  canon v0.1.0 · working canon · 7 layers · 7 knowledge states · 33 origin-protection rules · semantic-only claims
                </div>
              </div>
            </div>
            <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
              <span style={{ padding: "3px 8px", background: "#3a2810", border: "1px solid #78350f", color: "#fbbf24", fontSize: 10, fontFamily: "monospace", borderRadius: 4 }}>reveal cadence HOLD</span>
              <Link href="/nexapp/lab/origin-canon" style={navLink}>open room →</Link>
            </div>
          </div>
          <div style={{ marginTop: 8, fontSize: 12, color: "#cbd5e1", lineHeight: 1.5 }}>
            Founder-authored working canon for NEX identity + origin. Origin Protection Rule OP-1..OP-4 locked into the Identity Store. Deterministic classifier detects direct + indirect + multi-turn + roleplay + hypothetical + translation + encoding extraction attempts by information objective. Golden Response Pattern produces semantic slots; Language Brain composes natural phrasing. Never fabricates to protect the mystery.
          </div>
          <div style={{ marginTop: 8, display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: 8 }}>
            {[
              { p: "/api/nex/origin-canon/status",   label: "GET /status",   note: "canon counts · layers · states · projection" },
              { p: "/api/nex/origin-canon/classify", label: "POST /classify", note: "test the classifier + golden response · session_id supported" },
            ].map((ep) => (
              <div key={ep.p} style={{ padding: "10px 12px", background: "#0f1418", border: "1px solid #1e293b", borderRadius: 6 }}>
                <div style={{ fontSize: 11, fontFamily: "monospace", color: "#fca5a5", fontWeight: 700 }}>{ep.label}</div>
                <div style={{ fontSize: 10, color: "#94a3b8", marginTop: 3, lineHeight: 1.4 }}>{ep.note}</div>
              </div>
            ))}
          </div>
          <div style={{ marginTop: 8, fontSize: 10, color: "#64748b", fontFamily: "monospace" }}>
            Genesis Question permanently UNRESOLVED · The Long Fragmentation is a canon phrase · reveal cadence HOLD · working canon (not immutable) · semantic-only claim-ids · Language Brain composes phrasing at emission
          </div>
        </section>

        {/* Shadow Mode Room · founder-only · authorised 2026-09-12 */}
        <section
          id="shadow-mode"
          ref={(el) => { sectionsRef.current["shadow-mode"] = el; }}
          style={{ ...sectionBase, borderLeft: "4px solid #ea580c", scrollMarginTop: 72 }}
        >
          <div style={sectionHeader}>
            <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
              <div style={{ fontSize: 22 }}>👁</div>
              <div>
                <div style={{ fontSize: 18, fontWeight: 700 }}>Shadow Mode · founder-only observation</div>
                <div style={{ fontSize: 12, color: "#64748b", fontFamily: "monospace" }}>
                  the integration pipeline runs in parallel · never alters live chat · 4 evaluation states · fire-and-forget
                </div>
              </div>
            </div>
            <Link href="/nexapp/lab/shadow-mode" style={navLink}>open shadow room →</Link>
          </div>
          <div style={{ marginTop: 8, fontSize: 12, color: "#cbd5e1", lineHeight: 1.5 }}>
            SH-1..SH-6 pinned into the Identity Store. Observer is fire-and-forget · returns void · never throws into the caller · never delays the live response. Records land in append-only JSONL at `data/nex1-shadow/records/`. Founder-only promotion queue at `data/nex1-shadow/founder-promotion-queue/` · no auto-learning · no auto-mutation.
          </div>
          <div style={{ marginTop: 8, display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: 8 }}>
            {[
              { p: "/api/nex/shadow/observe",     m: "POST", note: "fire-and-forget observation · 202 accepted" },
              { p: "/api/nex/shadow/stats",       m: "GET",  note: "aggregate counts + failures by layer/rule" },
              { p: "/api/nex/shadow/records",     m: "GET",  note: "recent records · filter by evaluation" },
              { p: "/api/nex/shadow/adversarial", m: "GET",  note: "isolation checks + adversarial suite" },
              { p: "/api/nex/shadow/promote",     m: "POST", note: "founder-authored candidate for regression review" },
            ].map((ep) => (
              <div key={ep.p} style={{ padding: "10px 12px", background: "#0f1418", border: "1px solid #1e293b", borderRadius: 6 }}>
                <div style={{ fontSize: 11, fontFamily: "monospace", color: "#fdba74", fontWeight: 700 }}>{ep.m} {ep.p}</div>
                <div style={{ fontSize: 10, color: "#94a3b8", marginTop: 3, lineHeight: 1.4 }}>{ep.note}</div>
              </div>
            ))}
          </div>
        </section>

        {/* Innovation Room section */}
        <section
          id="innovation"
          ref={(el) => { sectionsRef.current["innovation"] = el; }}
          style={{ ...sectionBase, borderLeft: "4px solid #a78bfa", scrollMarginTop: 72 }}
        >
          <div style={sectionHeader}>
            <div style={{ display: "flex", alignItems: "flex-start", gap: 12, maxWidth: 780 }}>
              <div style={{ fontSize: 22, marginTop: 2 }}>💡</div>
              <div>
                <div style={{ fontSize: 18, fontWeight: 700 }}>Innovation Room · Ideas for NEX</div>
                <div style={{ fontSize: 12.5, color: "#cbd5e1", lineHeight: 1.55, marginTop: 4 }}>
                  Robot helpers looked at NEX and thought of new things it could do for people. Every card below is one idea. Click a card to read the full story of what the idea is and why it&apos;s not built yet. If you like an idea, press <b style={{ color: "#c4b5fd" }}>Approve &amp; Copy Engineer Brief</b>. NEX gives you a page of instructions you can send to a builder — the builder uses those instructions to make the idea real.
                </div>
              </div>
            </div>
            <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
              <span style={statChip}><span style={statLabel}>proposed </span>{ideas?.counts_by_status?.proposed ?? 0}</span>
              <span style={statChip}><span style={statLabel}>approved </span>{ideas?.counts_by_status?.approved ?? 0}</span>
              <span style={statChip}><span style={statLabel}>shipped </span>{ideas?.counts_by_status?.shipped ?? 0}</span>
              <Link href="/nexapp/lab/ideas" style={navLink}>full page →</Link>
            </div>
          </div>
          {proposedIdeas.length === 0 && !ideas && <div style={{ color: "#64748b" }}>loading ideas…</div>}
          {proposedIdeas.length === 0 && ideas && (
            <div style={{ color: "#64748b", padding: 40, textAlign: "center", background: "#0f1418", borderRadius: 8, border: "1px dashed #334155" }}>
              No proposed ideas. Creative agents can be re-run to populate.
            </div>
          )}
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(440px, 1fr))", gap: 12 }}>
            {proposedIdeas.map((idea) => {
              const isOpen = expandedIdea === idea.idea_id;
              const colour = CATEGORY_COLORS[idea.category] ?? "#94a3b8";
              return (
                <div key={idea.idea_id} onClick={() => setExpandedIdea(isOpen ? null : idea.idea_id)}
                  style={{ background: "#0f1418", border: "1px solid #1e293b", borderLeft: `4px solid ${colour}`, borderRadius: 8, padding: 14, cursor: "pointer" }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 6, gap: 10 }}>
                    <div style={{ fontSize: 14, fontWeight: 700, color: "#f1f5f9", lineHeight: 1.3 }}>{idea.title}</div>
                    <div style={{ display: "flex", gap: 5, flexShrink: 0 }}>
                      <span style={{ fontSize: 9.5, color: colour, fontFamily: "monospace", padding: "2px 6px", background: colour + "22", borderRadius: 3 }}>{idea.category}</span>
                      <span style={{ fontSize: 9.5, color: "#94a3b8", fontFamily: "monospace", padding: "2px 6px", background: "#1e293b", borderRadius: 3 }}>{idea.difficulty}·{idea.user_value}</span>
                    </div>
                  </div>
                  <div style={{ fontSize: 11.5, color: "#94a3b8", marginBottom: 6, fontStyle: "italic" }}>{idea.user_need}</div>
                  <div style={{ fontSize: 12.5, color: "#cbd5e1", lineHeight: 1.5 }}>{idea.description}</div>
                  {isOpen && (
                    <div style={{ marginTop: 10, paddingTop: 10, borderTop: "1px solid #1e293b" }}>
                      <div style={{ fontSize: 10, color: "#64748b", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 3 }}>Why missing</div>
                      <div style={{ fontSize: 11.5, color: "#e2e8f0", marginBottom: 8 }}>{idea.why_missing}</div>
                      <div style={{ fontSize: 10, color: "#64748b", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 3 }}>Engineering brief</div>
                      <div style={{ fontSize: 11.5, color: "#e2e8f0", marginBottom: 10, whiteSpace: "pre-wrap" }}>{idea.engineering_brief}</div>
                      <button
                        onClick={(e) => { e.stopPropagation(); void approveIdea(idea); }}
                        disabled={busy === idea.idea_id}
                        style={{ background: busy === idea.idea_id ? "#312e81" : "#4c1d95", color: "#fff", padding: "7px 12px", fontSize: 12, borderRadius: 4, border: "1px solid #7c3aed", cursor: busy === idea.idea_id ? "wait" : "pointer", fontWeight: 600 }}
                      >{busy === idea.idea_id ? "Approving…" : "Approve & Copy Engineer Brief →"}</button>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </section>
      </div>

      {modalBrief && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.75)", display: "flex", alignItems: "center", justifyContent: "center", padding: 20, zIndex: 100 }} onClick={() => setModalBrief(null)}>
          <div onClick={(e) => e.stopPropagation()} style={{ background: "#0f172a", border: "1px solid #4c1d95", borderRadius: 10, maxWidth: 900, width: "100%", maxHeight: "90vh", display: "flex", flexDirection: "column" }}>
            <div style={{ padding: 16, borderBottom: "1px solid #1e293b", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <div>
                <div style={{ fontSize: 11, color: "#a78bfa" }}>ENGINEERING BRIEF</div>
                <div style={{ fontSize: 15, fontWeight: 700 }}>{modalBrief.title}</div>
              </div>
              <div style={{ display: "flex", gap: 8 }}>
                <button onClick={() => void copyBrief()} style={{ background: copied ? "#166534" : "#4c1d95", color: "#fff", padding: "8px 14px", fontSize: 13, borderRadius: 4, border: "1px solid " + (copied ? "#22c55e" : "#7c3aed"), cursor: "pointer", fontWeight: 600 }}>{copied ? "✓ Copied!" : "Copy to clipboard"}</button>
                <button onClick={() => setModalBrief(null)} style={{ background: "#1e293b", color: "#cbd5e1", padding: "8px 14px", fontSize: 13, borderRadius: 4, border: "1px solid #334155", cursor: "pointer" }}>Close</button>
              </div>
            </div>
            <div style={{ padding: 16, overflowY: "auto", flex: 1 }}>
              <pre style={{ whiteSpace: "pre-wrap", wordBreak: "break-word", margin: 0, fontFamily: "'SF Mono', Monaco, Consolas, monospace", fontSize: 12, color: "#e2e8f0", lineHeight: 1.55 }}>{modalBrief.brief}</pre>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function FlowNode({ label, body, tone }: { label: string; body: string; tone: "cyan" | "amber" | "violet" }) {
  const border = tone === "cyan" ? "#164e63" : tone === "amber" ? "#78350f" : "#5b21b6";
  const titleColor = tone === "cyan" ? "#67e8f9" : tone === "amber" ? "#fbbf24" : "#c4b5fd";
  return (
    <div style={{ padding: "10px 12px", background: "#0f1418", border: `1px solid ${border}`, borderRadius: 8 }}>
      <div style={{ fontSize: 10, letterSpacing: "0.1em", textTransform: "uppercase", color: titleColor, marginBottom: 4 }}>{label}</div>
      <div style={{ fontSize: 11, color: "#cbd5e1" }}>{body}</div>
    </div>
  );
}
function FlowArrow() {
  return <div style={{ color: "#475569", fontSize: 16, textAlign: "center" }}>→</div>;
}

function RoomSection({ room, sectionRef }: { room: Room; sectionRef: (el: HTMLElement | null) => void }) {
  const pct = room.target_records > 0 && room.harvest_rows != null
    ? Math.min(100, (room.harvest_rows / room.target_records) * 100) : 0;
  const growth = room.growth_1h_pct == null ? "—" : (room.growth_1h_pct >= 0 ? "+" : "") + room.growth_1h_pct.toFixed(1) + "%/h";
  const hasData = (room.harvest_rows ?? 0) > 0;
  const border = hasData ? "#22c55e" : "#475569";
  return (
    <section id={room.slug} ref={sectionRef} style={{ ...sectionBase, borderLeft: `4px solid ${border}` }}>
      <div style={sectionHeader}>
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <WorkingCog signals={{ last_harvested_age_sec: room.last_harvested_age_sec, growth_1h_pct: room.growth_1h_pct }} size={26} />
          <div>
            <div style={{ fontSize: 18, fontWeight: 700 }}>{room.display_name}</div>
            <div style={{ fontSize: 12, color: "#64748b", fontFamily: "monospace" }}>{room.primary_agent_id}</div>
          </div>
        </div>
        <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
          <span style={statChip}><span style={statLabel}>harvest </span>{(room.harvest_rows ?? 0).toLocaleString()}</span>
          <span style={statChip}><span style={statLabel}>verified </span>{(room.verified_rows ?? 0).toLocaleString()}</span>
          <span style={statChip}><span style={statLabel}>target </span>{room.target_records.toLocaleString()}</span>
          <span style={{ ...statChip, color: (room.growth_1h_pct ?? 0) > 0 ? "#4ade80" : "#94a3b8" }}>{growth}</span>
          <Link href={`/nexapp/lab/${room.slug}`} style={navLink}>drill in →</Link>
        </div>
      </div>
      <div style={{ height: 8, background: "#0a0d10", borderRadius: 4, overflow: "hidden", marginTop: 4 }}>
        <div style={{ width: `${pct}%`, height: "100%", background: hasData ? "#22c55e" : "transparent", transition: "width 0.6s" }} />
      </div>
      <div style={{ marginTop: 6, fontSize: 11, color: "#64748b", fontFamily: "monospace" }}>
        {pct.toFixed(3)}% of target
        {room.last_harvested_at_iso && ` · last harvest ${room.last_harvested_at_iso.slice(0, 16).replace("T", " ")} UTC`}
        {!hasData && " · empty — no data landing yet"}
      </div>
    </section>
  );
}

// ─── styles ─────────────────────────────────────────────────────
const page: React.CSSProperties = {
  minHeight: "100vh", background: "#0a0d10", color: "#e2e8f0",
  fontFamily: "system-ui, -apple-system, Segoe UI, Roboto, sans-serif",
};
const header: React.CSSProperties = {
  padding: "10px 20px", display: "flex", alignItems: "center", gap: 16,
  borderBottom: "1px solid #1e293b", background: "#080b0d",
  position: "sticky", top: 0, zIndex: 10,
  flexWrap: "wrap",
};
const navBar: React.CSSProperties = {
  display: "flex", gap: 4, flex: "1 1 auto", flexWrap: "wrap", justifyContent: "center",
};
const navBtn: React.CSSProperties = {
  padding: "5px 10px", fontSize: 11, borderRadius: 4,
  background: "#0f172a", cursor: "pointer",
  border: "1px solid #1e293b", color: "#cbd5e1",
  display: "inline-flex", gap: 6, alignItems: "center", whiteSpace: "nowrap",
};
const navBtnCount: React.CSSProperties = { fontSize: 10, color: "#64748b", fontFamily: "monospace" };
const navLink: React.CSSProperties = {
  padding: "5px 10px", borderRadius: 4, background: "#0f172a",
  color: "#94a3b8", textDecoration: "none", fontSize: 11, border: "1px solid #1e293b",
  whiteSpace: "nowrap",
};
const statChip: React.CSSProperties = { fontFamily: "monospace", fontSize: 11.5, color: "#e2e8f0", whiteSpace: "nowrap" };
const statLabel: React.CSSProperties = { color: "#64748b" };
const sectionBase: React.CSSProperties = {
  background: "#0f1418", border: "1px solid #1e293b", borderRadius: 10,
  padding: 18, marginBottom: 14,
  scrollMarginTop: 72,
};
const sectionHeader: React.CSSProperties = {
  display: "flex", justifyContent: "space-between", alignItems: "center",
  marginBottom: 10, gap: 12, flexWrap: "wrap",
};
