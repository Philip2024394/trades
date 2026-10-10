"use client";

// src/app/nexapp/nex-agent/LearningPanel.tsx
//
// Learning ledger panel · sidebar section · shows nex1/2/3 skills leveling up ·
// patterns learned · anti-patterns avoided this week. Weekly digest at top.

import { useEffect, useState } from "react";

interface Skill {
  skill: string;
  level: "bronze" | "silver" | "gold" | "mythic";
  xp: number;
  successes: number;
  failures: number;
  lastExercisedAt: string;
}
interface Pattern { id: string; title: string; skills: string[]; capturedAt: string; taskId: string; reusedCount: number; }
interface AntiPattern { id: string; title: string; rejectionCode: string | null; capturedAt: string; taskId: string; avoidedCount: number; }
interface Digest {
  skillsLevelledUp: string[];
  patternsLearned: number;
  antiPatternsAvoided: number;
  grade: "A+" | "A" | "B" | "C" | "no-data";
  reasoning: string;
}

export function LearningPanel() {
  const [expanded, setExpanded] = useState<boolean>(true);
  const [digest, setDigest] = useState<Digest | null>(null);
  const [skills, setSkills] = useState<Skill[]>([]);
  const [patterns, setPatterns] = useState<Pattern[]>([]);
  const [anti, setAnti] = useState<AntiPattern[]>([]);

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      try {
        const r = await fetch("/api/nex/agent/learning", { cache: "no-store" });
        const j = await r.json();
        if (cancelled || !j.ok) return;
        setDigest(j.digest);
        setSkills(j.skills ?? []);
        setPatterns(j.patterns ?? []);
        setAnti(j.antiPatterns ?? []);
      } catch { /* transient */ }
    };
    void load();
    const iv = setInterval(load, 20_000);
    return () => { cancelled = true; clearInterval(iv); };
  }, []);

  const gradeColor = digest?.grade === "A+" ? "var(--naw-cyan)"
    : digest?.grade === "A" ? "var(--naw-success)"
    : digest?.grade === "B" ? "var(--naw-warning)"
    : digest?.grade === "C" ? "var(--naw-danger)"
    : "var(--naw-slate)";

  return (
    <section className="naw-side-section">
      <button
        type="button"
        className="naw-side-section-header"
        onClick={() => setExpanded((v) => !v)}
        aria-expanded={expanded}
      >
        <span className="naw-side-section-icon" style={{ color: "#A855F7" }}>◊</span>
        <span className="naw-side-section-title">Learning</span>
        {digest && digest.grade !== "no-data" && (
          <span className="naw-side-section-count" style={{ color: gradeColor, background: `${gradeColor}22` }}>{digest.grade}</span>
        )}
        <span className="naw-side-section-toggle">{expanded ? "▼" : "▶"}</span>
      </button>
      {expanded && (
        <div className="naw-side-section-body">
          {!digest ? (
            <div className="naw-seo-empty">Loading learning ledger…</div>
          ) : digest.grade === "no-data" ? (
            <div className="naw-seo-empty">No skill activity yet · finish a task to start the ledger.</div>
          ) : (
            <>
              <div className="naw-learning-item">
                <div className="naw-learning-item-title">Weekly digest · <span style={{ color: gradeColor }}>{digest.grade}</span></div>
                <div className="naw-learning-item-meta">{digest.reasoning}</div>
              </div>

              {skills.length > 0 && (
                <>
                  <div className="naw-side-label" style={{ marginTop: 8 }}>Skills</div>
                  {skills.slice(0, 6).map((s) => (
                    <div key={s.skill} className="naw-learning-item">
                      <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                        <span className="naw-learning-item-title" style={{ flex: 1, minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{s.skill}</span>
                        <span className={`naw-learning-badge ${s.level}`}>{s.level}</span>
                      </div>
                      <div className="naw-learning-item-meta">
                        <span>xp {s.xp}/100</span>
                        <span>✓ {s.successes}</span>
                        {s.failures > 0 && <span style={{ color: "var(--naw-danger)" }}>✗ {s.failures}</span>}
                      </div>
                      <div style={{
                        height: 3, background: "rgba(148,163,184,0.14)",
                        borderRadius: 2, overflow: "hidden",
                      }}>
                        <div style={{
                          height: "100%", width: `${s.xp}%`,
                          background: s.level === "mythic" ? "#A855F7"
                            : s.level === "gold" ? "var(--naw-gold)"
                            : s.level === "silver" ? "#e0e0e6"
                            : "#d0946a",
                          transition: "width 0.3s ease",
                        }} />
                      </div>
                    </div>
                  ))}
                </>
              )}

              {patterns.length > 0 && (
                <>
                  <div className="naw-side-label" style={{ marginTop: 8 }}>Patterns learned</div>
                  {patterns.slice(0, 4).map((p) => (
                    <div key={p.id} className="naw-learning-item">
                      <div className="naw-learning-item-title">{p.title.slice(0, 50)}</div>
                      <div className="naw-learning-item-meta">
                        <span className="naw-learning-badge pattern">pattern</span>
                        {p.reusedCount > 0 && <span>reused ×{p.reusedCount}</span>}
                      </div>
                    </div>
                  ))}
                </>
              )}

              {anti.length > 0 && (
                <>
                  <div className="naw-side-label" style={{ marginTop: 8 }}>Anti-patterns avoided</div>
                  {anti.slice(0, 4).map((a) => (
                    <div key={a.id} className="naw-learning-item">
                      <div className="naw-learning-item-title">{a.title.slice(0, 50)}</div>
                      <div className="naw-learning-item-meta">
                        <span className="naw-learning-badge antipattern">anti</span>
                        {a.rejectionCode && <code style={{ color: "var(--naw-danger)", fontSize: 9 }}>{a.rejectionCode}</code>}
                      </div>
                    </div>
                  ))}
                </>
              )}
            </>
          )}
        </div>
      )}
    </section>
  );
}
