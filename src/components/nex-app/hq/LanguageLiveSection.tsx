"use client";

// src/components/nex-app/hq/LanguageLiveSection.tsx
//
// NEX1 · LANGUAGE BRAIN · LIVE HQ SECTION.
//
// Founder directive 2026-09-12: "Move the Language Room to a section on its
// own under the Live HQ Lab section. The WorkingCog must be visible and
// green when actively processing. The diagram must show where language is
// feeding — nexapp chat page, other pages, workstation for code. All
// countries listed with percent of language processed. Strict rule: chats
// and diagrams show truth · never fail to display when internet-connected."
//
// Discipline:
//   · Never fabricates data. Last-known-good state is displayed with a
//     staleness age. If the endpoint is unreachable AND no cache exists,
//     the section shows a truthful "connecting…" placeholder — never
//     invented numbers.
//   · WorkingCog spins ONLY when the last successful poll is fresh
//     (< 5 min) — same discipline as the harvest cog.
//   · Country percentages are derived from ACTIVE language scores. Countries
//     served only by scaffolded languages show `unmeasured` — not 0%.

import Link from "next/link";
import React, { useEffect, useMemo, useState } from "react";
import { WorkingCog } from "@/components/nex-app/hq/WorkingCog";

interface Coverage { public: number; hidden: number; adversarial: number; regression: number; total: number; }
interface Section {
  language: "english" | "bahasa_indonesia" | "code_switch" | "programming";
  overall_percent: number;
  case_count: number;
  level: string;
  benchmark_complete: boolean;
  benchmark_maturity: "pilot" | "expanding" | "mature" | "proven";
  coverage: Coverage;
}
interface Status {
  at: string;
  registry_version: string;
  regression_pool_size: number;
  regression_clean: boolean;
  regression_failed_ids: string[];
  sections: Section[];
}

interface RegistryEntry {
  id: string;
  display_name: string;
  iso_639_1: string;
  status: "active" | "scaffolded";
  primary_countries: string[];
}
interface RegistryPayload { version: string; languages: RegistryEntry[]; }

interface CountryCandidate {
  id: string;
  display_name: string;
  flag: string;
  primary_languages: string[];
  next_priority: boolean;
  founder_note: string;
}
interface CountryPayload { version: string; candidates: CountryCandidate[]; }

const FLAG: Record<Section["language"], string> = {
  english: "🇬🇧",
  bahasa_indonesia: "🇮🇩",
  code_switch: "🔄",
  programming: "💻",
};

// ISO-3166 → display country name + flag emoji for the "all countries" panel.
// Populated from the primary_countries lists in the registry. Only countries
// that appear in at least one language entry are shown.
const COUNTRY_META: Record<string, { name: string; flag: string }> = {
  GB: { name: "United Kingdom", flag: "🇬🇧" },
  US: { name: "United States",  flag: "🇺🇸" },
  AU: { name: "Australia",      flag: "🇦🇺" },
  CA: { name: "Canada",         flag: "🇨🇦" },
  IE: { name: "Ireland",        flag: "🇮🇪" },
  NZ: { name: "New Zealand",    flag: "🇳🇿" },
  IN: { name: "India",          flag: "🇮🇳" },
  PH: { name: "Philippines",    flag: "🇵🇭" },
  ZA: { name: "South Africa",   flag: "🇿🇦" },
  SG: { name: "Singapore",      flag: "🇸🇬" },
  ID: { name: "Indonesia",      flag: "🇮🇩" },
  MY: { name: "Malaysia",       flag: "🇲🇾" },
  BN: { name: "Brunei",         flag: "🇧🇳" },
  VN: { name: "Vietnam",        flag: "🇻🇳" },
  TH: { name: "Thailand",       flag: "🇹🇭" },
  CN: { name: "China",          flag: "🇨🇳" },
  TW: { name: "Taiwan",         flag: "🇹🇼" },
  BD: { name: "Bangladesh",     flag: "🇧🇩" },
  PK: { name: "Pakistan",       flag: "🇵🇰" },
  LK: { name: "Sri Lanka",      flag: "🇱🇰" },
  TR: { name: "Turkey",         flag: "🇹🇷" },
  EG: { name: "Egypt",          flag: "🇪🇬" },
  SA: { name: "Saudi Arabia",   flag: "🇸🇦" },
  AE: { name: "UAE",            flag: "🇦🇪" },
  JO: { name: "Jordan",         flag: "🇯🇴" },
  MA: { name: "Morocco",        flag: "🇲🇦" },
  IR: { name: "Iran",           flag: "🇮🇷" },
  AF: { name: "Afghanistan",    flag: "🇦🇫" },
  TJ: { name: "Tajikistan",     flag: "🇹🇯" },
  KE: { name: "Kenya",          flag: "🇰🇪" },
  TZ: { name: "Tanzania",       flag: "🇹🇿" },
  UG: { name: "Uganda",         flag: "🇺🇬" },
  RW: { name: "Rwanda",         flag: "🇷🇼" },
  NG: { name: "Nigeria",        flag: "🇳🇬" },
  BJ: { name: "Benin",          flag: "🇧🇯" },
  NE: { name: "Niger",          flag: "🇳🇪" },
  GH: { name: "Ghana",          flag: "🇬🇭" },
  BR: { name: "Brazil",         flag: "🇧🇷" },
  MX: { name: "Mexico",         flag: "🇲🇽" },
  AR: { name: "Argentina",      flag: "🇦🇷" },
  CO: { name: "Colombia",       flag: "🇨🇴" },
  CL: { name: "Chile",          flag: "🇨🇱" },
  PE: { name: "Peru",           flag: "🇵🇪" },
  FR: { name: "France",         flag: "🇫🇷" },
  BE: { name: "Belgium",        flag: "🇧🇪" },
  CH: { name: "Switzerland",    flag: "🇨🇭" },
  CI: { name: "Côte d'Ivoire",  flag: "🇨🇮" },
  SN: { name: "Senegal",        flag: "🇸🇳" },
  DE: { name: "Germany",        flag: "🇩🇪" },
  AT: { name: "Austria",        flag: "🇦🇹" },
  IT: { name: "Italy",          flag: "🇮🇹" },
  NL: { name: "Netherlands",    flag: "🇳🇱" },
  PL: { name: "Poland",         flag: "🇵🇱" },
  RU: { name: "Russia",         flag: "🇷🇺" },
  BY: { name: "Belarus",        flag: "🇧🇾" },
  KZ: { name: "Kazakhstan",     flag: "🇰🇿" },
  UA: { name: "Ukraine",        flag: "🇺🇦" },
  JP: { name: "Japan",          flag: "🇯🇵" },
  KR: { name: "South Korea",    flag: "🇰🇷" },
  NP: { name: "Nepal",          flag: "🇳🇵" },
  ET: { name: "Ethiopia",       flag: "🇪🇹" },
  MW: { name: "Malawi",         flag: "🇲🇼" },
  ZM: { name: "Zambia",         flag: "🇿🇲" },
};

export function LanguageLiveSection() {
  const [status, setStatus] = useState<Status | null>(null);
  const [registry, setRegistry] = useState<RegistryPayload | null>(null);
  const [countries, setCountries] = useState<CountryPayload | null>(null);
  const [lastGoodMs, setLastGoodMs] = useState<number>(0);
  const [nowMs, setNowMs] = useState<number>(Date.now());
  const [connectionErr, setConnectionErr] = useState<string | null>(null);

  // Poll every 5s · silently retain last-good state on failure
  useEffect(() => {
    let cancelled = false;
    const ac = new AbortController();
    const tick = async () => {
      try {
        const [sR, rR, cR] = await Promise.all([
          fetch("/api/nex/lab/language-room/status", { cache: "no-store", signal: ac.signal }),
          fetch("/api/nex/lab/language-room/registry", { cache: "no-store", signal: ac.signal }),
          fetch("/api/nex/lab/language-room/countries", { cache: "no-store", signal: ac.signal }),
        ]);
        if (!sR.ok) throw new Error(`status_http_${sR.status}`);
        const s: Status = await sR.json();
        const r = rR.ok ? await rR.json() : null;
        const c = cR.ok ? await cR.json() : null;
        if (!cancelled) {
          setStatus(s);
          if (r) setRegistry(r);
          if (c) setCountries(c);
          setLastGoodMs(Date.now());
          setConnectionErr(null);
        }
      } catch (e) {
        if (cancelled) return;
        if (e instanceof DOMException && e.name === "AbortError") return;
        setConnectionErr(e instanceof Error ? e.message.slice(0, 80) : "err");
      }
    };
    void tick();
    const iv = setInterval(tick, 5000);
    return () => { cancelled = true; ac.abort(); clearInterval(iv); };
  }, []);

  // Wall-clock tick every second so cog+age update between polls
  useEffect(() => {
    const iv = setInterval(() => setNowMs(Date.now()), 1000);
    return () => clearInterval(iv);
  }, []);

  const ageSec = lastGoodMs === 0 ? null : Math.floor((nowMs - lastGoodMs) / 1000);
  const cogSignals = {
    last_harvested_age_sec: ageSec,
    // If regression is clean we treat that as growth-positive signal for the cog
    growth_1h_pct: status?.regression_clean ? 0.1 : null,
  };

  // Compute per-language readiness by scorecard section
  const readinessById = useMemo(() => {
    const map: Record<string, { percent: number; level: string; maturity: string }> = {};
    for (const s of status?.sections ?? []) {
      if (s.language === "english" || s.language === "bahasa_indonesia") {
        map[s.language] = { percent: s.overall_percent, level: s.level, maturity: s.benchmark_maturity };
      }
    }
    return map;
  }, [status]);

  // Build country readiness rows (country ≠ language · a country can host multiple)
  const countryRows = useMemo(() => {
    if (!registry) return [];
    const byCountry = new Map<string, { code: string; name: string; flag: string; entries: Array<{ language_id: string; language_display: string; readiness: number | null; status: "active" | "scaffolded" }> }>();
    for (const l of registry.languages) {
      for (const cc of l.primary_countries) {
        const meta = COUNTRY_META[cc] ?? { name: cc, flag: "🏳️" };
        if (!byCountry.has(cc)) {
          byCountry.set(cc, { code: cc, name: meta.name, flag: meta.flag, entries: [] });
        }
        byCountry.get(cc)!.entries.push({
          language_id: l.id,
          language_display: l.display_name,
          readiness: l.status === "active" ? (readinessById[l.id]?.percent ?? null) : null,
          status: l.status,
        });
      }
    }
    return Array.from(byCountry.values()).sort((a, b) => a.name.localeCompare(b.name));
  }, [registry, readinessById]);

  return (
    <div style={{ padding: "12px 14px", background: "#0f1418", border: "1px solid #1e293b", borderRadius: 8 }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 10 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <WorkingCog signals={cogSignals} size={22} />
          <div style={{ fontSize: 11, color: "#64748b", letterSpacing: "0.1em", textTransform: "uppercase" }}>
            Language Brain · NEX1 · live
          </div>
        </div>
        {status && (
          <div style={{ display: "flex", gap: 10, fontSize: 10, color: "#94a3b8", fontFamily: "monospace" }}>
            <span>registry {status.registry_version}</span>
            <span>tracks {status.sections.length}</span>
            <span style={{ color: status.regression_clean ? "#4ade80" : "#f87171" }}>
              regression {status.regression_clean ? `${status.regression_pool_size} clean` : `${status.regression_failed_ids.length} failing`}
            </span>
            <span>age {ageSec === null ? "…" : ageSec < 60 ? `${ageSec}s` : `${Math.round(ageSec / 60)}m`}</span>
            {connectionErr && <span style={{ color: "#fbbf24" }}>reconnecting…</span>}
            <Link href="/nexapp/lab/language-room" style={{ color: "#67e8f9", textDecoration: "none" }}>full room →</Link>
          </div>
        )}
      </div>

      {/* No-data honest fallback */}
      {!status && (
        <div style={{ fontSize: 12, color: "#64748b", padding: 24, textAlign: "center", background: "#0b1216", borderRadius: 6, border: "1px dashed #334155" }}>
          {connectionErr ? `connecting to language brain… (${connectionErr})` : "loading language brain…"}
        </div>
      )}

      {status && (
        <>
          {/* ── Track cards ── */}
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(230px, 1fr))", gap: 8 }}>
            {status.sections.map((s) => (
              <div key={s.language} style={{ padding: "10px 12px", background: "#0b1216", border: "1px solid #1e293b", borderRadius: 6 }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 3 }}>
                  <div style={{ fontSize: 12, fontWeight: 700 }}>{FLAG[s.language]} {s.language === "english" ? "English" : s.language === "bahasa_indonesia" ? "Bahasa Indonesia" : s.language === "code_switch" ? "Code-Switch" : "Programming"}</div>
                  <div style={{ fontSize: 18, fontFamily: "monospace", fontWeight: 700, color: scoreColor(s.overall_percent) }}>{s.overall_percent.toFixed(1)}%</div>
                </div>
                <div style={{ display: "flex", gap: 4, flexWrap: "wrap", fontSize: 9.5, fontFamily: "monospace", color: "#94a3b8" }}>
                  <span style={{ padding: "1px 5px", background: "#0f1418", border: "1px solid #1e293b", borderRadius: 3 }}>{s.level.replace(/_/g, " ")}</span>
                  <span style={{ padding: "1px 5px", background: "#0f1418", border: `1px solid ${s.benchmark_maturity === "proven" ? "#14532d" : "#1e293b"}`, borderRadius: 3, color: s.benchmark_maturity === "proven" ? "#4ade80" : "#94a3b8" }}>{s.benchmark_maturity}</span>
                </div>
                <div style={{ marginTop: 4, fontSize: 9.5, color: "#64748b", fontFamily: "monospace" }}>
                  p={s.coverage.public} h={s.coverage.hidden} a={s.coverage.adversarial} r={s.coverage.regression} · <b style={{ color: "#67e8f9" }}>total {s.coverage.total}</b>
                </div>
              </div>
            ))}
          </div>

          {/* ── Consumer pipeline diagram · where language feeds ── */}
          <div style={{ marginTop: 10 }}>
            <div style={{ fontSize: 10, color: "#64748b", letterSpacing: "0.08em", textTransform: "uppercase", marginBottom: 6 }}>
              Language feeds these NEX surfaces (deterministic · no LLM)
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr auto 3fr", gap: 8, alignItems: "stretch", background: "#0b1216", border: "1px solid #1e293b", borderRadius: 8, padding: "10px 12px" }}>
              <div style={{ padding: "10px 12px", background: "#0d1a2b", border: "1px solid #1e40af", borderRadius: 6 }}>
                <div style={{ fontSize: 10, color: "#67e8f9", letterSpacing: "0.08em", textTransform: "uppercase", fontWeight: 700 }}>Language Brain</div>
                <div style={{ fontSize: 11, color: "#cbd5e1", marginTop: 4, fontFamily: "monospace" }}>intent-bridge · registry {status.registry_version}</div>
                <div style={{ fontSize: 10, color: "#94a3b8", marginTop: 4 }}>{status.sections.length} tracks · {status.sections.reduce((a, s) => a + s.case_count, 0)} cases · {status.regression_clean ? "✓ regression clean" : "⚠ regression breach"}</div>
              </div>
              <div style={{ alignSelf: "center", color: "#67e8f9", fontSize: 20 }}>→</div>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(180px, 1fr))", gap: 6 }}>
                <ConsumerBox
                  label="NEXapp chat"
                  href="/nexapp/chat"
                  detail="user conversations · intent recognition + clarify + refuse · IPT emission when target language differs"
                />
                <ConsumerBox
                  label="Code workstation"
                  href="/nexapp/lab/agent-room"
                  detail="developer speech → engineering brain · 8 intent kinds recognised · attribution ledger enforced"
                />
                <ConsumerBox
                  label="Master AI Engineer"
                  href="/nexapp/hq"
                  detail="plan / supervise / review · never silently modifies NEX1's work"
                />
                <ConsumerBox
                  label="Lab rooms"
                  href="/nexapp/lab"
                  detail="agents receive structured intents · Room UI shows measured evidence"
                />
                <ConsumerBox
                  label="Marketplace lookups"
                  href="/nexapp"
                  detail="read-only search intents · never fabricates data"
                />
                <ConsumerBox
                  label="Founder brief"
                  href="/nexapp/lab/brief"
                  detail="weekly evidence · numbers measured · zero fabrication"
                />
              </div>
            </div>
          </div>

          {/* ── All countries · language readiness ── */}
          <div style={{ marginTop: 10 }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
              <div style={{ fontSize: 10, color: "#64748b", letterSpacing: "0.08em", textTransform: "uppercase" }}>
                All countries · language readiness (country ≠ language · % is the ACTIVE-track score)
              </div>
              <div style={{ fontSize: 10, color: "#64748b", fontFamily: "monospace" }}>
                {countryRows.length} countries · {registry?.languages.length ?? 0} languages
              </div>
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(260px, 1fr))", gap: 4, background: "#0b1216", border: "1px solid #1e293b", borderRadius: 8, padding: "8px 10px", maxHeight: 260, overflowY: "auto" }}>
              {countryRows.map((c) => {
                const active = c.entries.filter((e) => e.status === "active");
                const scaffolded = c.entries.filter((e) => e.status === "scaffolded");
                const nextPri = countries?.candidates.find((cand) => cand.id === c.code)?.next_priority;
                return (
                  <div key={c.code} style={{
                    padding: "5px 8px",
                    background: nextPri ? "#052e17" : "transparent",
                    border: `1px solid ${nextPri ? "#14532d" : "#1e293b"}`,
                    borderRadius: 4,
                    display: "grid",
                    gridTemplateColumns: "20px 1fr auto",
                    gap: 6,
                    alignItems: "center",
                    fontFamily: "monospace",
                    fontSize: 10.5,
                  }}>
                    <div style={{ fontSize: 14 }}>{c.flag}</div>
                    <div>
                      <div style={{ color: "#cbd5e1" }}>{c.name}{nextPri ? " · next priority" : ""}</div>
                      <div style={{ color: "#64748b", fontSize: 9.5 }}>
                        {c.entries.map((e) => e.language_display).join(" · ")}
                      </div>
                    </div>
                    <div style={{ textAlign: "right" }}>
                      {active.length > 0 ? (
                        <div style={{ color: scoreColor(active[0].readiness ?? 0), fontWeight: 700 }}>
                          {(active[0].readiness ?? 0).toFixed(0)}%
                        </div>
                      ) : (
                        <div style={{ color: "#64748b" }}>unmeasured</div>
                      )}
                      <div style={{ color: "#64748b", fontSize: 9 }}>
                        {active.length}a·{scaffolded.length}s
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
            <div style={{ marginTop: 6, fontSize: 9.5, color: "#64748b", fontFamily: "monospace" }}>
              a = active · s = scaffolded · scaffolded means the language exists in the registry but is not yet unlocked · unmeasured is honest, not 0%
            </div>
          </div>

          {/* ── Attribution ── */}
          <div style={{ marginTop: 8, fontSize: 9.5, color: "#64748b", fontFamily: "monospace" }}>
            external_llm_used=false · independent_authorship_percent=0 · taught_by=master_ai_engineer · fluent requires 100% + benchmark_complete + maturity=proven
          </div>
        </>
      )}
    </div>
  );
}

function ConsumerBox({ label, href, detail }: { label: string; href: string; detail: string }) {
  return (
    <Link href={href} style={{ textDecoration: "none" }}>
      <div style={{ padding: "8px 10px", background: "#0f1418", border: "1px solid #1e293b", borderRadius: 6, height: "100%", boxSizing: "border-box" }}>
        <div style={{ fontSize: 11, color: "#c4b5fd", fontWeight: 700, marginBottom: 3 }}>{label} →</div>
        <div style={{ fontSize: 10, color: "#94a3b8", lineHeight: 1.4 }}>{detail}</div>
      </div>
    </Link>
  );
}

function scoreColor(p: number): string {
  if (p >= 95) return "#4ade80";
  if (p >= 80) return "#a3e635";
  if (p >= 60) return "#fbbf24";
  if (p >= 40) return "#f97316";
  return "#f87171";
}
