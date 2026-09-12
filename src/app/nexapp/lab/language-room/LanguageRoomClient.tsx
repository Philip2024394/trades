"use client";

// NEX Lab · Language Room · always-visible dashboard for NEX1's Language
// Brain. Polls the deterministic scorecard endpoint every 10 seconds. Shows
// per-language score, level band, benchmark maturity, coverage indicator
// (public / hidden / adversarial / regression / total), and per-dimension
// bars. Follows NEX Visual DNA (deep navy · cyan info · orange action ·
// glass surfaces · monospace numerics · 13px text floor).
//
// Golden discipline surfaced in the UI:
//   · external_llm_used = false (badge visible at all times)
//   · independent_authorship_percent = 0 (badge visible at all times)
//   · Regression pool status pinned at top · red banner if not clean
//   · "Fluent" only claimable when maturity === "proven" AND percent === 100
//   · Coverage indicator sits BEFORE percent so no one reads score without
//     seeing the maturity floor it stands on.

import Link from "next/link";
import React, { useEffect, useMemo, useState } from "react";

interface CoverageBlock {
  public: number;
  hidden: number;
  adversarial: number;
  regression: number;
  total: number;
}
interface DimensionEntry {
  dimension: string;
  points: number;
  max_points: number;
  percent: number;
  case_count: number;
}
type Maturity = "pilot" | "expanding" | "mature" | "proven";
interface SectionEntry {
  language: "english" | "bahasa_indonesia" | "code_switch" | "programming";
  overall_percent: number;
  case_count: number;
  level: string;
  benchmark_complete: boolean;
  benchmark_maturity: Maturity;
  coverage: CoverageBlock;
  dimensions: DimensionEntry[];
  weak_dimensions: string[];
}
interface LanguageRoomStatus {
  at: string;
  registry_version: string;
  regression_pool_size: number;
  regression_clean: boolean;
  regression_failed_ids: string[];
  hidden_included: boolean;
  external_llm_used: false;
  independent_authorship_percent: 0;
  sections: SectionEntry[];
}

interface RegistryEntry {
  id: string;
  display_name: string;
  iso_639_1: string;
  script: string;
  direction: "ltr" | "rtl";
  morphology: string;
  status: "active" | "scaffolded";
  primary_countries: string[];
  notes?: string;
  gate: { allowed: boolean; reason: string; refusal_class?: string };
  has_scorecard: boolean;
}
interface LanguageRegistryPayload {
  version: string;
  progression_gate: {
    rule: string;
    next_priority: string;
    next_priority_rationale: string;
    cannot_advance_before: Record<string, { level: string; benchmark_complete: boolean; maturity: string }>;
  };
  languages: RegistryEntry[];
  foundation_state: {
    english: any;
    bahasa_indonesia: any;
    foundation_ready: boolean;
  };
}

interface CountryCandidate {
  id: string;
  display_name: string;
  flag: string;
  primary_languages: string[];
  next_priority: boolean;
  founder_note: string;
  dimensions: Record<string, number>;
}
interface CountryPayload {
  version: string;
  dimensions: Array<{ id: string; label: string; weight_hint: number }>;
  candidates: CountryCandidate[];
}

const FLAG: Record<SectionEntry["language"], string> = {
  english: "🇬🇧",
  bahasa_indonesia: "🇮🇩",
  code_switch: "🔄",
  programming: "💻",
};
const LANG_LABEL: Record<SectionEntry["language"], string> = {
  english: "English",
  bahasa_indonesia: "Bahasa Indonesia",
  code_switch: "Code-Switch (EN + ID)",
  programming: "Programming Communication",
};

const MATURITY_TONE: Record<Maturity, string> = {
  pilot: "#64748b",
  expanding: "#67e8f9",
  mature: "#fbbf24",
  proven: "#4ade80",
};

export function LanguageRoomClient() {
  const [state, setState] = useState<LanguageRoomStatus | null>(null);
  const [registry, setRegistry] = useState<LanguageRegistryPayload | null>(null);
  const [countries, setCountries] = useState<CountryPayload | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [lastPollMs, setLastPollMs] = useState(0);

  useEffect(() => {
    let cancelled = false;
    const ac = new AbortController();
    const tick = async () => {
      try {
        const [statusR, regR, cRes] = await Promise.all([
          fetch("/api/nex/lab/language-room/status", { cache: "no-store", signal: ac.signal }),
          fetch("/api/nex/lab/language-room/registry", { cache: "no-store", signal: ac.signal }),
          fetch("/api/nex/lab/language-room/countries", { cache: "no-store", signal: ac.signal }),
        ]);
        if (!statusR.ok) throw new Error(`status_http_${statusR.status}`);
        const j: LanguageRoomStatus = await statusR.json();
        const reg = regR.ok ? await regR.json() : null;
        const co = cRes.ok ? await cRes.json() : null;
        if (!cancelled) {
          setState(j);
          setRegistry(reg);
          setCountries(co);
          setErr(null);
          setLastPollMs(Date.now());
        }
      } catch (e) {
        if (cancelled) return;
        if (e instanceof DOMException && e.name === "AbortError") return;
        setErr(e instanceof Error ? e.message.slice(0, 80) : "err");
      }
    };
    void tick();
    const iv = setInterval(tick, 10_000);
    return () => { cancelled = true; ac.abort(); clearInterval(iv); };
  }, []);

  const ageSec = useMemo(() => (lastPollMs === 0 ? null : Math.round((Date.now() - lastPollMs) / 1000)), [lastPollMs, state]);

  return (
    <div style={page}>
      <header style={header}>
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <Link href="/nexapp/lab" style={{ color: "#94a3b8", textDecoration: "none", fontSize: 12 }}>← Lab</Link>
          <div style={{ width: 10, height: 10, borderRadius: 5, background: err ? "#ef4444" : "#22c55e" }} />
          <div style={{ fontSize: 15, fontWeight: 700, letterSpacing: "0.02em" }}>NEX1 · Language Brain · Room</div>
          <div style={{ fontSize: 11, color: "#94a3b8", fontFamily: "monospace" }}>
            registry {state?.registry_version ?? "…"} · {state ? new Date(state.at).toLocaleTimeString() : "loading"}
            {ageSec !== null ? ` · ${ageSec}s ago` : ""}
          </div>
        </div>
        <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
          <Badge tone="dim" label={`llm=false`} />
          <Badge tone="dim" label={`independent_authorship=0%`} />
          <Badge tone="dim" label={`taught_by=master_ai_engineer`} />
        </div>
      </header>

      <div style={{ padding: "16px 24px", display: "flex", flexDirection: "column", gap: 16 }}>
        {err && <div style={errorBar}>error · {err}</div>}

        {state && !state.regression_clean && (
          <div style={regressionAlert}>
            ⚠  REGRESSION DETECTED · {state.regression_failed_ids.length} case(s) failing ·{" "}
            {state.regression_failed_ids.slice(0, 6).join(" · ")}
            {state.regression_failed_ids.length > 6 ? " · …" : ""}
          </div>
        )}

        {state && state.regression_clean && (
          <div style={regressionOk}>
            ✔  regression pool clean · {state.regression_pool_size} historically-passing cases still pass · hidden set{" "}
            {state.hidden_included ? "included" : "not yet defined"}
          </div>
        )}

        {state && (
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(360px, 1fr))", gap: 14 }}>
            {state.sections.map((s) => (
              <LanguageCard key={s.language} section={s} />
            ))}
          </div>
        )}

        {/* ── Language Registry · 32 languages · progression-gate honest state ── */}
        {registry && (
          <section style={{ marginTop: 12 }}>
            <div style={sectionLabel}>Language registry v{registry.version} · progression gate</div>
            <div style={{ marginTop: 6, marginBottom: 10, padding: "10px 14px", background: registry.foundation_state.foundation_ready ? "#052e17" : "#0b1216", border: `1px solid ${registry.foundation_state.foundation_ready ? "#14532d" : "#1e293b"}`, borderRadius: 8, fontSize: 12, fontFamily: "monospace", color: registry.foundation_state.foundation_ready ? "#86efac" : "#cbd5e1" }}>
              {registry.foundation_state.foundation_ready
                ? "✔ foundation ready · EN + ID both at fluent + proven maturity · scaffolded languages may now be activated via founder AUTHORISE"
                : "foundation NOT yet ready · EN + ID must both reach level=fluent + benchmark_complete + maturity=proven before any scaffolded language activates"}
              {" · next priority: "}<b style={{ color: "#67e8f9" }}>{registry.progression_gate.next_priority}</b>
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(180px, 1fr))", gap: 6 }}>
              {registry.languages.map((l) => (
                <div key={l.id} style={{
                  padding: "8px 10px",
                  background: l.status === "active" ? "#0b2434" : "#0b1216",
                  border: `1px solid ${l.status === "active" ? "#164e63" : "#1e293b"}`,
                  borderRadius: 6,
                  fontFamily: "monospace",
                  fontSize: 10.5,
                  color: "#cbd5e1",
                }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 3 }}>
                    <div style={{ color: l.status === "active" ? "#67e8f9" : "#e2e8f0", fontWeight: 700 }}>{l.display_name}</div>
                    <div style={{ fontSize: 9, color: l.status === "active" ? "#4ade80" : "#64748b", textTransform: "uppercase", letterSpacing: "0.06em" }}>{l.status}</div>
                  </div>
                  <div style={{ color: "#64748b", fontSize: 9.5 }}>iso={l.iso_639_1} · {l.script} · {l.morphology}</div>
                  <div style={{ color: "#64748b", fontSize: 9.5, marginTop: 2 }}>countries: {l.primary_countries.slice(0, 3).join(", ")}{l.primary_countries.length > 3 ? "…" : ""}</div>
                </div>
              ))}
            </div>
            <div style={{ marginTop: 8, fontSize: 10, color: "#64748b", fontFamily: "monospace" }}>
              32 languages · 2 ACTIVE · 30 SCAFFOLDED · scaffolded entries honestly report `status: scaffolded · score: unmeasured` (no fake 0%)
            </div>
          </section>
        )}

        {/* ── Country candidates · panel · country ≠ language ── */}
        {countries && (
          <section style={{ marginTop: 12 }}>
            <div style={sectionLabel}>Country candidates · founder-authored analysis (country ≠ language)</div>
            <div style={{ marginTop: 6, display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(320px, 1fr))", gap: 10 }}>
              {countries.candidates.map((c) => (
                <div key={c.id} style={{
                  padding: "12px 14px",
                  background: c.next_priority ? "#052e17" : "#0f1418",
                  border: `1px solid ${c.next_priority ? "#14532d" : "#1e293b"}`,
                  borderRadius: 8,
                }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                      <div style={{ fontSize: 20 }}>{c.flag}</div>
                      <div style={{ fontSize: 13, fontWeight: 700 }}>{c.display_name}</div>
                    </div>
                    {c.next_priority && (
                      <div style={{ fontSize: 9, letterSpacing: "0.1em", textTransform: "uppercase", color: "#4ade80", padding: "2px 6px", background: "#052e17", border: "1px solid #14532d", borderRadius: 3, fontFamily: "monospace" }}>
                        NEXT PRIORITY
                      </div>
                    )}
                  </div>
                  <div style={{ fontSize: 10.5, color: "#94a3b8", fontFamily: "monospace", marginBottom: 6 }}>
                    languages: {c.primary_languages.join(" · ")}
                  </div>
                  <div style={{ fontSize: 11, color: "#cbd5e1", lineHeight: 1.4, marginBottom: 8 }}>
                    {c.founder_note}
                  </div>
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 20px", gap: 4, fontSize: 10, fontFamily: "monospace" }}>
                    {countries.dimensions.map((d) => (
                      <React.Fragment key={d.id}>
                        <div style={{ color: "#64748b" }}>{d.label}</div>
                        <div style={{ textAlign: "right", color: dimensionColor(c.dimensions[d.id], d.weight_hint) }}>
                          {c.dimensions[d.id] ?? "-"}
                        </div>
                      </React.Fragment>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </section>
        )}

        {state && (
          <section style={{ marginTop: 12 }}>
            <div style={sectionLabel}>Doctrine · pinned</div>
            <ul style={doctrineList}>
              <li>Benchmark size is NEVER the definition of intelligence · pilot → expanding → mature → proven</li>
              <li>Fluent requires percent === 100 AND benchmark_complete AND maturity === "proven"</li>
              <li>Regression pool is authoritative · any regression fails the whole run regardless of new scores</li>
              <li>External LLM is prohibited · Path A (deterministic) only</li>
              <li>Coverage indicator sits BEFORE the score so no one reads the number without the floor</li>
            </ul>
          </section>
        )}

        {state && (
          <section style={{ fontSize: 10, color: "#64748b", fontFamily: "monospace" }}>
            attribution · teaching_infrastructure=src/lib/nex-language-brain/* · challenge_authorship=examiner ·
            novel_execution=attempted_by=nex1 · teaching_assistance=true
          </section>
        )}
      </div>
    </div>
  );
}

function LanguageCard({ section: s }: { section: SectionEntry }) {
  const isFluent = s.level === "fluent";
  return (
    <div style={card}>
      <div style={{ display: "flex", alignItems: "baseline", gap: 10, marginBottom: 6 }}>
        <div style={{ fontSize: 22 }}>{FLAG[s.language]}</div>
        <div style={{ fontSize: 14, fontWeight: 700 }}>{LANG_LABEL[s.language]}</div>
        <div style={{ marginLeft: "auto", display: "flex", gap: 6 }}>
          <Badge tone={s.benchmark_maturity === "proven" ? "green" : s.benchmark_maturity === "mature" ? "amber" : "dim"}
                 label={`maturity: ${s.benchmark_maturity}`} />
          <Badge tone={isFluent ? "green" : "dim"} label={`level: ${s.level.replace(/_/g, " ")}`} />
        </div>
      </div>

      {/* Coverage BEFORE score */}
      <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginBottom: 8 }}>
        <CoverageChip label="public" value={s.coverage.public} />
        <CoverageChip label="hidden" value={s.coverage.hidden} highlight={s.coverage.hidden === 0} />
        <CoverageChip label="adversarial" value={s.coverage.adversarial} highlight={s.coverage.adversarial === 0} />
        <CoverageChip label="regression" value={s.coverage.regression} highlight={s.coverage.regression === 0} />
        <CoverageChip label="total" value={s.coverage.total} tone="strong" />
      </div>

      {/* Score */}
      <div style={{ display: "flex", alignItems: "baseline", gap: 12, marginBottom: 6 }}>
        <div style={{ fontSize: 34, fontFamily: "monospace", color: pickScoreColor(s.overall_percent), fontWeight: 700 }}>
          {s.overall_percent.toFixed(1)}%
        </div>
        <div style={{ fontSize: 11, color: "#94a3b8", fontFamily: "monospace" }}>
          intent-bridge score · n={s.case_count} · benchmark_complete={String(s.benchmark_complete)}
        </div>
      </div>

      {/* Dimensions */}
      <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
        {s.dimensions.map((d) => (
          <div key={d.dimension} style={{ display: "grid", gridTemplateColumns: "150px 40px 1fr 44px", gap: 8, alignItems: "center", fontSize: 11, fontFamily: "monospace" }}>
            <div style={{ color: "#cbd5e1" }}>{d.dimension}</div>
            <div style={{ color: pickScoreColor(d.percent), textAlign: "right" }}>{d.percent.toFixed(0)}%</div>
            <div style={{ background: "#0b1216", borderRadius: 3, height: 8, overflow: "hidden", border: "1px solid #1e293b" }}>
              <div style={{
                width: `${Math.round(d.percent)}%`,
                height: "100%",
                background: pickScoreColor(d.percent),
                transition: "width 200ms linear",
              }} />
            </div>
            <div style={{ color: "#64748b", textAlign: "right" }}>n={d.case_count}</div>
          </div>
        ))}
      </div>

      {/* Weak dimensions warning */}
      {s.weak_dimensions.length > 0 && (
        <div style={{ marginTop: 6, fontSize: 11, color: "#fbbf24", fontFamily: "monospace" }}>
          ⚠  weak: {s.weak_dimensions.join(", ")}
        </div>
      )}
    </div>
  );
}

function CoverageChip({ label, value, tone, highlight }: { label: string; value: number; tone?: "strong"; highlight?: boolean }) {
  return (
    <div style={{
      padding: "3px 8px",
      background: tone === "strong" ? "#0b2434" : "#0b1216",
      border: `1px solid ${highlight ? "#7f1d1d" : "#1e293b"}`,
      borderRadius: 4,
      fontSize: 10,
      fontFamily: "monospace",
      color: highlight ? "#fca5a5" : tone === "strong" ? "#67e8f9" : "#cbd5e1",
      letterSpacing: "0.04em",
    }}>
      {label}={value}
    </div>
  );
}

function Badge({ label, tone }: { label: string; tone: "dim" | "green" | "amber" | "red" }) {
  const bg =
    tone === "green" ? "#052e17" :
    tone === "amber" ? "#3a2810" :
    tone === "red"   ? "#450a0a" :
                       "#0b1216";
  const fg =
    tone === "green" ? "#4ade80" :
    tone === "amber" ? "#fbbf24" :
    tone === "red"   ? "#f87171" :
                       "#94a3b8";
  return (
    <div style={{ padding: "2px 8px", background: bg, color: fg, borderRadius: 4, fontSize: 10, fontFamily: "monospace", border: "1px solid #1e293b" }}>
      {label}
    </div>
  );
}

function dimensionColor(value: number | undefined, weightHint: number): string {
  if (value === undefined) return "#475569";
  // Negative-weighted dimensions (governance_risk): higher is WORSE.
  const isNeg = weightHint < 0;
  const norm = isNeg ? 10 - value : value;
  if (norm >= 8) return "#4ade80";
  if (norm >= 6) return "#a3e635";
  if (norm >= 4) return "#fbbf24";
  return "#f87171";
}

function pickScoreColor(p: number): string {
  if (p >= 95) return "#4ade80";
  if (p >= 80) return "#a3e635";
  if (p >= 60) return "#fbbf24";
  if (p >= 40) return "#f97316";
  return "#f87171";
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
const errorBar: React.CSSProperties = {
  padding: "8px 12px",
  background: "#450a0a",
  color: "#f87171",
  borderRadius: 6,
  fontSize: 12,
  fontFamily: "monospace",
};
const regressionAlert: React.CSSProperties = {
  padding: "10px 14px",
  background: "#450a0a",
  color: "#fca5a5",
  border: "1px solid #7f1d1d",
  borderRadius: 6,
  fontSize: 12,
  fontFamily: "monospace",
};
const regressionOk: React.CSSProperties = {
  padding: "8px 12px",
  background: "#052e17",
  color: "#86efac",
  border: "1px solid #14532d",
  borderRadius: 6,
  fontSize: 12,
  fontFamily: "monospace",
};
const card: React.CSSProperties = {
  padding: "14px 16px",
  background: "linear-gradient(180deg, #0d1418 0%, #0a1013 100%)",
  border: "1px solid #1e293b",
  borderRadius: 10,
  boxShadow: "inset 0 1px 0 rgba(255,255,255,0.02)",
};
const sectionLabel: React.CSSProperties = {
  fontSize: 11,
  color: "#64748b",
  letterSpacing: "0.1em",
  textTransform: "uppercase",
};
const doctrineList: React.CSSProperties = {
  marginTop: 6,
  paddingLeft: 20,
  color: "#94a3b8",
  fontSize: 12,
  lineHeight: 1.8,
};
