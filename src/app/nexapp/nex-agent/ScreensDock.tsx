"use client";

// src/app/nexapp/nex-agent/ScreensDock.tsx
//
// Screens dock · lists every page/route in the project as a phone-shaped
// tile with URL bar on top + editable URL + Continue prompt starter.
//
// Two data sources unified:
//   1. Task-derived · from plan.proposed_files of every history task
//   2. On-disk scan · walks src/app/**/page.tsx via /api/nex/agent/screens/scan
//        · founder sees ALL existing app pages, not just NEX1-built ones
//        · NEX1 can reference them for theme + UI consistency
//
// Founder can:
//   - Click tile → LEFT preview loads that route
//   - Click ✎ Edit URL → rename via inline text input (persisted via API alias)
//   - Click ✎ Continue → prompt textarea gets a continue-building starter
//   - Filter by section (nexapp · nex-head-quarters · api · etc.)

import { useEffect, useMemo, useState } from "react";

export interface DetectedScreen {
  readonly route: string;         // original derived route (immutable)
  readonly filePath: string;
  readonly taskId: string;
  readonly taskPrompt: string;
  readonly source?: "task" | "scan";
  readonly section?: string;
  readonly modifiedAt?: string;
}

export interface ScreensDockProps {
  readonly screens: readonly DetectedScreen[];
  readonly currentUrl: string;
  readonly onOpen: (effectiveRoute: string, filePath: string) => void;
  readonly onContinuePrompt: (screen: DetectedScreen, effectiveRoute: string) => void;
}

interface Alias { newRoute: string; renamedAt: string; renamedBy: string; }

export function ScreensDock({ screens, currentUrl, onOpen, onContinuePrompt }: ScreensDockProps) {
  const [expanded, setExpanded] = useState<boolean>(true);
  const [aliases, setAliases] = useState<Record<string, Alias>>({});
  const [editingRoute, setEditingRoute] = useState<string | null>(null);
  const [editInput, setEditInput] = useState<string>("");
  const [editMsg, setEditMsg] = useState<string | null>(null);
  const [scanned, setScanned] = useState<DetectedScreen[]>([]);
  const [sectionFilter, setSectionFilter] = useState<string>("all");
  const [availableSections, setAvailableSections] = useState<string[]>([]);

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      try {
        const r = await fetch("/api/nex/agent/screens/rename", { cache: "no-store" });
        const j = await r.json();
        if (!cancelled && j.ok) setAliases(j.aliases ?? {});
      } catch { /* transient */ }
    };
    void load();
    const iv = setInterval(load, 30_000);
    return () => { cancelled = true; clearInterval(iv); };
  }, []);

  // Fetch the on-disk scan of every src/app/**/page.tsx
  useEffect(() => {
    let cancelled = false;
    const scan = async () => {
      try {
        const r = await fetch("/api/nex/agent/screens/scan", { cache: "no-store" });
        const j = await r.json();
        if (cancelled || !j.ok) return;
        interface ScannedRow { route: string; filePath: string; section: string; modifiedAt: string; }
        const rows = (j.screens ?? []) as ScannedRow[];
        setScanned(rows.map((s) => ({
          route: s.route,
          filePath: s.filePath,
          taskId: "on-disk",
          taskPrompt: `On-disk page · ${s.filePath}`,
          source: "scan" as const,
          section: s.section,
          modifiedAt: s.modifiedAt,
        })));
        setAvailableSections(j.sections ?? []);
      } catch { /* transient */ }
    };
    void scan();
    const iv = setInterval(scan, 60_000);
    return () => { cancelled = true; clearInterval(iv); };
  }, []);

  const effectiveRouteFor = (original: string) => aliases[original]?.newRoute ?? original;

  const dedup = useMemo(() => {
    const map = new Map<string, DetectedScreen>();
    for (const s of screens) if (!map.has(s.route)) map.set(s.route, { ...s, source: s.source ?? "task" });
    for (const s of scanned) if (!map.has(s.route)) map.set(s.route, s);
    let arr = Array.from(map.values());
    if (sectionFilter !== "all") {
      arr = arr.filter((s) => (s.section ?? s.route.split("/").filter(Boolean)[0] ?? "root") === sectionFilter);
    }
    return arr.sort((a, b) => a.route.localeCompare(b.route));
  }, [screens, scanned, sectionFilter]);

  const startEdit = (route: string) => { setEditingRoute(route); setEditInput(effectiveRouteFor(route)); setEditMsg(null); };
  const cancelEdit = () => { setEditingRoute(null); setEditInput(""); setEditMsg(null); };
  const commitEdit = async () => {
    if (!editingRoute) return;
    const trimmed = editInput.trim();
    if (!trimmed.startsWith("/")) { setEditMsg("URL must start with /"); return; }
    if (trimmed === editingRoute) { cancelEdit(); return; }
    try {
      const r = await fetch("/api/nex/agent/screens/rename", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ originalRoute: editingRoute, newRoute: trimmed, renamedBy: "founder" }),
      });
      const j = await r.json();
      if (j.ok) { setAliases(j.aliases ?? {}); setEditMsg(null); setEditingRoute(null); }
      else setEditMsg(j.detail || j.error || "rename failed");
    } catch (e) { setEditMsg(e instanceof Error ? e.message : "rename failed"); }
  };
  const resetAlias = async (originalRoute: string) => {
    if (!confirm(`Reset "${originalRoute}" back to its original URL? Alias will be removed.`)) return;
    try {
      const r = await fetch(`/api/nex/agent/screens/rename?originalRoute=${encodeURIComponent(originalRoute)}`, { method: "DELETE" });
      const j = await r.json();
      if (j.ok) setAliases(j.aliases ?? {});
    } catch { /* */ }
  };

  return (
    <section className="naw-side-section">
      <button
        type="button"
        className="naw-side-section-header"
        onClick={() => setExpanded((v) => !v)}
        aria-expanded={expanded}
      >
        <span className="naw-side-section-icon" style={{ color: "#22D3EE" }}>◧</span>
        <span className="naw-side-section-title">Screens</span>
        <span className="naw-side-section-count">{dedup.length}</span>
        <span className="naw-side-section-toggle">{expanded ? "▼" : "▶"}</span>
      </button>
      {expanded && (
        <div className="naw-side-section-body naw-screens-scroll">
          {availableSections.length > 0 && (
            <div style={{ marginBottom: 8, display: "flex", flexWrap: "wrap", gap: 4 }}>
              <button
                type="button"
                className={`naw-screen-tiny-btn ${sectionFilter === "all" ? "active-filter" : ""}`}
                onClick={() => setSectionFilter("all")}
                style={sectionFilter === "all" ? { background: "rgba(34,211,238,0.16)", color: "var(--naw-cyan)" } : undefined}
              >all</button>
              {availableSections.map((sec) => (
                <button
                  key={sec}
                  type="button"
                  className={`naw-screen-tiny-btn ${sectionFilter === sec ? "active-filter" : ""}`}
                  onClick={() => setSectionFilter(sec)}
                  style={sectionFilter === sec ? { background: "rgba(34,211,238,0.16)", color: "var(--naw-cyan)" } : undefined}
                >{sec}</button>
              ))}
            </div>
          )}
          {dedup.length === 0 ? (
            <div className="naw-screens-empty">
              No pages detected · scan is loading or src/app/ is empty.
            </div>
          ) : (
            <ul className="naw-screens-list">
              {dedup.map((s) => {
                const eff = effectiveRouteFor(s.route);
                const isRenamed = eff !== s.route;
                const isActive = currentUrl === eff || currentUrl.startsWith(eff + "?");
                const isEditing = editingRoute === s.route;
                const label = eff === "/" ? "HOME"
                  : (eff.split("/").filter(Boolean).slice(-1)[0] ?? "PAGE").replace(/[-_:]/g, " ").toUpperCase().slice(0, 14);
                return (
                  <li key={s.route} className={`naw-screen-tile-v2 ${isActive ? "active" : ""}`}>
                    <button
                      type="button"
                      className="naw-screen-phone"
                      onClick={() => onOpen(eff, s.filePath)}
                      title={`Open ${eff} in LEFT preview`}
                      aria-label={`Open ${eff}`}
                    >
                      <div className="naw-screen-phone-urlbar">
                        <span className="naw-screen-phone-urldot" />
                        <span className="naw-screen-phone-urltext">{eff}</span>
                        {isRenamed && <span className="naw-screen-renamed-dot" title="Renamed by founder">●</span>}
                      </div>
                      <div className="naw-screen-phone-screen">
                        <span className="naw-screen-phone-label">{label}</span>
                        <span className="naw-screen-phone-file">{s.filePath.split("/").slice(-2).join("/")}</span>
                        <div style={{ marginTop: 4, display: "flex", gap: 3, fontSize: 8, color: "var(--naw-slate)" }}>
                          {s.source === "scan" && <span className="naw-screen-badge scan">◈ ON-DISK</span>}
                          {s.source === "task" && <span className="naw-screen-badge task">◧ NEX1</span>}
                        </div>
                      </div>
                    </button>

                    {isEditing ? (
                      <div className="naw-screen-edit-row">
                        <input
                          autoFocus
                          className="naw-mobile-dim-input"
                          style={{ flex: 1, width: "auto", textAlign: "left", fontFamily: "'JetBrains Mono', monospace" }}
                          value={editInput}
                          onChange={(e) => setEditInput(e.target.value)}
                          onKeyDown={(e) => {
                            if (e.key === "Enter") void commitEdit();
                            if (e.key === "Escape") cancelEdit();
                          }}
                          placeholder="/new-url-here"
                          spellCheck={false}
                        />
                        <button type="button" className="naw-screen-tiny-btn naw-screen-tiny-btn-ok" onClick={commitEdit}>✓</button>
                        <button type="button" className="naw-screen-tiny-btn naw-screen-tiny-btn-cancel" onClick={cancelEdit}>×</button>
                      </div>
                    ) : (
                      <div className="naw-screen-actions">
                        <button
                          type="button"
                          className="naw-screen-tiny-btn"
                          onClick={() => startEdit(s.route)}
                          title="Rename this screen's URL"
                        >✎ Edit URL</button>
                        <button
                          type="button"
                          className="naw-screen-tiny-btn naw-screen-tiny-btn-orange"
                          onClick={() => onContinuePrompt(s, eff)}
                          title="Focus the prompt with a continue-building starter for this screen"
                        >✎ Continue</button>
                        {isRenamed && (
                          <button
                            type="button"
                            className="naw-screen-tiny-btn naw-screen-tiny-btn-reset"
                            onClick={() => void resetAlias(s.route)}
                            title={`Reset alias · original was ${s.route}`}
                          >↺</button>
                        )}
                      </div>
                    )}
                    {isEditing && editMsg && (
                      <div style={{ fontSize: 10, color: "var(--naw-danger)", marginTop: 2 }}>{editMsg}</div>
                    )}
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      )}
    </section>
  );
}
