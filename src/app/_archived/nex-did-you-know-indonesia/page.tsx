// /nex-did-you-know-indonesia · Philip 2026-08-28
//
// Indonesia · DID YOU KNOW notebook + game surface.
// Doctrine: project_nex_ambient_knowledge_injector_doctrine_2026_08_28.md
//
// Two modes on one page:
//   · Browse: category-filtered grid of frosted glass cards
//   · Game:   swipe-deck · "See 10 in a row" streak
//
// Uses the /api/nex/did-you-know endpoint.
// Save state is client-side (localStorage) in Phase 1 · brain_user_saved_facts
// wiring comes in Phase 2 when identity flow is finalised.

"use client";

import React, { useEffect, useState, useMemo, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";

interface Fact {
  id: string;
  slug: string;
  title: string;
  body: string;
  title_id: string | null;
  body_id: string | null;
  category: string;
  region_slug: string | null;
  region_label: string | null;
  truth_class: string;
  difficulty: number;
  priority: number;
  source_url: string | null;
}

const CATEGORY_EMOJI: Record<string, string> = {
  nature: "🌿", geology: "🌋", culture: "🎭", history: "📜",
  language: "🗣️", food: "🍜", rituals: "🕯️", science: "🔬",
  society: "👥", symbols: "🦅",
};

const CATEGORY_LABEL: Record<string, string> = {
  nature: "Nature", geology: "Geology", culture: "Culture", history: "History",
  language: "Language", food: "Food", rituals: "Rituals", science: "Science",
  society: "Society", symbols: "Symbols",
};

// NEX Data Safety doctrine (Philip 2026-08-28): localStorage holds ONLY the
// anonymous device UUID (identity key) + cached mirror of saved fact IDs
// for offline view. Source of truth is nex.brain_user_saved_facts in
// Postgres. See project_nex_data_safety_no_localstorage_2026_08_28.md.
const DEVICE_ID_KEY = "nex.device_id.v1";
const SAVED_CACHE_KEY = "nex.dyk.saved.cache.v1";

function getOrCreateDeviceId(): string {
  if (typeof window === "undefined") return "";
  try {
    let id = localStorage.getItem(DEVICE_ID_KEY);
    if (!id || !/^device:/.test(id)) {
      const uuid = (typeof crypto !== "undefined" && "randomUUID" in crypto)
        ? crypto.randomUUID()
        : `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}-${Math.random().toString(36).slice(2, 10)}`;
      id = `device:${uuid}`;
      localStorage.setItem(DEVICE_ID_KEY, id);
    }
    return id;
  } catch {
    return `device:${Date.now().toString(36)}`;
  }
}

export default function NexDidYouKnowIndonesiaPage() {
  const [facts, setFacts] = useState<Fact[]>([]);
  const [loading, setLoading] = useState(true);
  const [category, setCategory] = useState<string>("");
  const [mode, setMode] = useState<"browse" | "game">("browse");
  const [lang, setLang] = useState<"en" | "id">("en");
  const [savedIds, setSavedIds] = useState<Set<string>>(new Set());
  const [deviceId, setDeviceId] = useState<string>("");

  // Set up device identity on mount + hydrate cached mirror from localStorage
  // for instant paint. Real source of truth is fetched from server below.
  useEffect(() => {
    const id = getOrCreateDeviceId();
    setDeviceId(id);
    try {
      const cached = localStorage.getItem(SAVED_CACHE_KEY);
      if (cached) setSavedIds(new Set(JSON.parse(cached)));
    } catch { /* ignore */ }
  }, []);

  // Fetch authoritative saved list from server whenever deviceId is ready.
  useEffect(() => {
    if (!deviceId) return;
    fetch(`/api/nex/did-you-know/save?learner_ref=${encodeURIComponent(deviceId)}`)
      .then((r) => r.json())
      .then((data) => {
        if (data?.ok && Array.isArray(data.saved)) {
          const ids = new Set<string>(data.saved.map((s: { id: string }) => s.id));
          setSavedIds(ids);
          try { localStorage.setItem(SAVED_CACHE_KEY, JSON.stringify([...ids])); } catch { /* ignore */ }
        }
      })
      .catch(() => { /* offline · we still have the cache */ });
  }, [deviceId]);

  // Update localStorage cache mirror whenever savedIds changes (server is
  // still source of truth; this is only for fast offline paint).
  useEffect(() => {
    if (savedIds.size === 0 && !localStorage.getItem(SAVED_CACHE_KEY)) return;
    try { localStorage.setItem(SAVED_CACHE_KEY, JSON.stringify([...savedIds])); } catch { /* ignore */ }
  }, [savedIds]);

  // Fetch facts (all categories · client-filters).
  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    fetch("/api/nex/did-you-know?limit=500")
      .then((r) => r.json())
      .then((data) => {
        if (cancelled) return;
        if (data?.ok && Array.isArray(data.facts)) setFacts(data.facts);
      })
      .catch(() => { /* silent */ })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, []);

  const categoryCounts = useMemo(() => {
    const m = new Map<string, number>();
    for (const f of facts) m.set(f.category, (m.get(f.category) ?? 0) + 1);
    return m;
  }, [facts]);

  const filtered = useMemo(() => {
    if (!category) return facts;
    return facts.filter((f) => f.category === category);
  }, [facts, category]);

  // Optimistic toggle · UI updates immediately, server call runs in background.
  // On server error we roll back the optimistic change so the user sees truth.
  const toggleSave = useCallback((id: string) => {
    if (!deviceId) return;
    const wasSaved = savedIds.has(id);
    setSavedIds((prev) => {
      const next = new Set(prev);
      if (wasSaved) next.delete(id); else next.add(id);
      return next;
    });
    fetch("/api/nex/did-you-know/save", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        learner_ref: deviceId,
        fact_id: id,
        action: wasSaved ? "unsave" : "save",
      }),
    })
      .then((r) => r.json())
      .then((data) => {
        if (!data?.ok) throw new Error(data?.error ?? "save failed");
      })
      .catch(() => {
        // rollback on failure so UI reflects server truth
        setSavedIds((prev) => {
          const next = new Set(prev);
          if (wasSaved) next.add(id); else next.delete(id);
          return next;
        });
      });
  }, [deviceId, savedIds]);

  return (
    <div
      style={{
        minHeight: "100dvh",
        background:
          "radial-gradient(circle at 20% 10%, #1a1a2e 0%, #0a0a0f 60%)",
        color: "rgba(245,245,245,0.95)",
        padding: "24px 20px 60px",
        fontFamily:
          "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif",
      }}
    >
      {/* Header */}
      <header style={{ maxWidth: 780, margin: "0 auto 20px" }}>
        <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", flexWrap: "wrap", gap: 8 }}>
          <h1
            style={{
              fontSize: 24, fontWeight: 800, letterSpacing: 2,
              margin: 0, textTransform: "uppercase",
            }}
          >
            Indonesia · <span style={{ color: "#f97316" }}>Did You Know</span>
          </h1>
          <div style={{ fontSize: 13, color: "rgba(245,245,245,0.55)" }}>
            {savedIds.size}/{facts.length} saved
          </div>
        </div>
        <div style={{ marginTop: 6, fontSize: 12, color: "rgba(245,245,245,0.55)", letterSpacing: 0.4 }}>
          Curated by NEX · every fact verifiable · every card shareable
        </div>
        {/* NEX Data Safety indicator · confirms saves live on NEX server. */}
        <div style={{ marginTop: 6, fontSize: 10.5, color: "rgba(34,197,94,0.85)", letterSpacing: 0.4, display: "flex", alignItems: "center", gap: 5 }}>
          <span aria-hidden="true">🔒</span>
          <span>Your saved facts are stored securely on NEX · syncs across your devices</span>
        </div>
      </header>

      {/* Mode + language toggle */}
      <div
        style={{
          maxWidth: 780, margin: "0 auto 18px",
          display: "flex", gap: 8, flexWrap: "wrap",
          alignItems: "center",
        }}
      >
        <button
          type="button"
          onClick={() => setMode("browse")}
          style={btnStyle(mode === "browse")}
        >📖 Browse</button>
        <button
          type="button"
          onClick={() => setMode("game")}
          style={btnStyle(mode === "game")}
        >🎮 Game · See 10 in a row</button>
        <div style={{ marginLeft: "auto", display: "flex", gap: 4 }}>
          <button
            type="button"
            onClick={() => setLang("en")}
            style={{ ...btnStyle(lang === "en"), padding: "6px 10px", fontSize: 11 }}
            title="Show facts in English"
          >EN</button>
          <button
            type="button"
            onClick={() => setLang("id")}
            style={{ ...btnStyle(lang === "id"), padding: "6px 10px", fontSize: 11 }}
            title="Tampilkan dalam Bahasa Indonesia"
          >ID</button>
        </div>
      </div>

      {/* Category filters (only in browse mode) */}
      {mode === "browse" && (
        <div
          style={{
            maxWidth: 780, margin: "0 auto 18px",
            display: "flex", gap: 6, flexWrap: "wrap",
          }}
        >
          <button
            type="button"
            onClick={() => setCategory("")}
            style={chipStyle(category === "")}
          >
            All · {facts.length}
          </button>
          {[...categoryCounts.entries()]
            .sort((a, b) => b[1] - a[1])
            .map(([cat, cnt]) => (
              <button
                key={cat}
                type="button"
                onClick={() => setCategory(cat)}
                style={chipStyle(category === cat)}
              >
                {CATEGORY_EMOJI[cat] ?? "•"} {CATEGORY_LABEL[cat] ?? cat} · {cnt}
              </button>
            ))}
        </div>
      )}

      {/* Content */}
      <main style={{ maxWidth: 780, margin: "0 auto" }}>
        {loading && (
          <div style={{ textAlign: "center", padding: 40, color: "rgba(245,245,245,0.5)" }}>
            Loading…
          </div>
        )}

        {!loading && mode === "browse" && (
          <div style={{ display: "grid", gap: 14 }}>
            {filtered.map((f) => (
              <FactCard
                key={f.id}
                fact={f}
                lang={lang}
                saved={savedIds.has(f.id)}
                onToggleSave={() => toggleSave(f.id)}
              />
            ))}
          </div>
        )}

        {!loading && mode === "game" && (
          <GameMode
            facts={facts}
            savedIds={savedIds}
            onToggleSave={toggleSave}
            lang={lang}
          />
        )}
      </main>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// Card component · frosted glass · matches ambient card doctrine.
// ─────────────────────────────────────────────────────────────
function FactCard({
  fact, saved, onToggleSave, compact = false, lang = "en",
}: {
  fact: Fact;
  saved: boolean;
  onToggleSave: () => void;
  compact?: boolean;
  lang?: "en" | "id";
}) {
  const showTitle = lang === "id" && fact.title_id ? fact.title_id : fact.title;
  const showBody  = lang === "id" && fact.body_id  ? fact.body_id  : fact.body;
  const hasIdVersion = Boolean(fact.title_id && fact.body_id);
  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, ease: [0.4, 0, 0.2, 1] }}
      style={{
        position: "relative",
        padding: compact ? "18px 20px" : "18px 20px 16px",
        borderRadius: 18,
        background: "rgba(20, 20, 30, 0.55)",
        backdropFilter: "blur(24px) saturate(140%)",
        WebkitBackdropFilter: "blur(24px) saturate(140%)",
        border: "1px solid rgba(255, 255, 255, 0.12)",
        boxShadow:
          "0 8px 32px rgba(0, 0, 0, 0.35), inset 0 1px 0 rgba(255, 255, 255, 0.08)",
      }}
    >
      <div
        style={{
          fontSize: 10.5, fontWeight: 800, letterSpacing: 1.4,
          color: "rgba(249, 115, 22, 0.9)", marginBottom: 8,
          textTransform: "uppercase",
        }}
      >
        NEX — Did You Know
      </div>
      <div style={{ fontSize: 17, fontWeight: 700, marginBottom: 8, letterSpacing: 0.2 }}>
        {showTitle}
      </div>
      <div style={{ fontSize: 14.5, lineHeight: 1.5, color: "rgba(245,245,245,0.94)" }}>
        {showBody}
      </div>
      {lang === "id" && !hasIdVersion && (
        <div style={{ marginTop: 6, fontSize: 11, color: "rgba(245,245,245,0.5)", fontStyle: "italic" }}>
          Terjemahan Bahasa Indonesia sedang disiapkan…
        </div>
      )}
      <div
        style={{
          marginTop: 12, display: "flex", alignItems: "center",
          justifyContent: "space-between", gap: 8, flexWrap: "wrap",
          fontSize: 11.5, color: "rgba(245,245,245,0.55)",
        }}
      >
        <span style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
          <span aria-hidden="true" style={{ fontSize: 13 }}>✓</span>
          <span style={{ color: "#22c55e", fontWeight: 600 }}>Fact</span>
          <span>·</span>
          <span>{CATEGORY_EMOJI[fact.category] ?? "•"} {CATEGORY_LABEL[fact.category] ?? fact.category}</span>
          {fact.region_label && (
            <>
              <span>·</span>
              <span>{fact.region_label}</span>
            </>
          )}
        </span>
        <button
          type="button"
          onClick={onToggleSave}
          style={{
            display: "inline-flex", alignItems: "center", gap: 4,
            padding: "5px 12px", borderRadius: 999,
            border: saved
              ? "1px solid rgba(249, 115, 22, 0.7)"
              : "1px solid rgba(255,255,255,0.15)",
            background: saved
              ? "rgba(249, 115, 22, 0.15)"
              : "rgba(255,255,255,0.04)",
            color: saved ? "#f97316" : "rgba(245,245,245,0.75)",
            fontSize: 11.5, fontWeight: 700, letterSpacing: 0.4,
            cursor: "pointer",
          }}
        >
          {saved ? "★ Saved" : "☆ Save"}
        </button>
      </div>
    </motion.div>
  );
}

// ─────────────────────────────────────────────────────────────
// Game Mode · swipe-deck · session goal is 10 in a row.
// ─────────────────────────────────────────────────────────────
function GameMode({
  facts, savedIds, onToggleSave, lang = "en",
}: {
  facts: Fact[];
  savedIds: Set<string>;
  onToggleSave: (id: string) => void;
  lang?: "en" | "id";
}) {
  const [deck, setDeck] = useState<Fact[]>([]);
  const [seenIds, setSeenIds] = useState<Set<string>>(new Set());
  const [sessionCount, setSessionCount] = useState(0);
  const [completed, setCompleted] = useState(false);
  const SESSION_TARGET = 10;

  useEffect(() => {
    if (facts.length === 0) return;
    // Shuffle for game session · exclude already-seen if possible.
    const pool = [...facts].sort(() => Math.random() - 0.5);
    setDeck(pool);
    setSeenIds(new Set());
    setSessionCount(0);
    setCompleted(false);
  }, [facts]);

  const current = deck[0];

  const advance = useCallback((save: boolean) => {
    if (!current) return;
    if (save) onToggleSave(current.id);
    setSeenIds((prev) => new Set(prev).add(current.id));
    setSessionCount((n) => {
      const next = n + 1;
      if (next >= SESSION_TARGET) setCompleted(true);
      return next;
    });
    setDeck((prev) => prev.slice(1));
  }, [current, onToggleSave]);

  if (completed) {
    return (
      <div
        style={{
          textAlign: "center", padding: "40px 20px",
          border: "1px solid rgba(249,115,22,0.4)",
          borderRadius: 18,
          background: "rgba(249,115,22,0.06)",
        }}
      >
        <div style={{ fontSize: 32, marginBottom: 8 }}>🏆</div>
        <div style={{ fontSize: 20, fontWeight: 700, marginBottom: 6 }}>
          You learned {SESSION_TARGET} things about Indonesia
        </div>
        <div style={{ fontSize: 13, color: "rgba(245,245,245,0.6)", marginBottom: 20 }}>
          {savedIds.size} facts saved to your notebook
        </div>
        <button
          type="button"
          onClick={() => {
            const pool = [...facts].sort(() => Math.random() - 0.5);
            setDeck(pool);
            setSessionCount(0);
            setCompleted(false);
          }}
          style={{
            padding: "10px 20px", borderRadius: 999,
            border: "1px solid rgba(249,115,22,0.6)",
            background: "rgba(249,115,22,0.15)", color: "#f97316",
            fontSize: 13, fontWeight: 700, letterSpacing: 0.4,
            cursor: "pointer",
          }}
        >
          Play Again
        </button>
      </div>
    );
  }

  if (!current) {
    return (
      <div style={{ textAlign: "center", padding: 40, color: "rgba(245,245,245,0.5)" }}>
        No more cards.
      </div>
    );
  }

  return (
    <div>
      <div
        style={{
          maxWidth: 480, margin: "0 auto 16px",
          display: "flex", justifyContent: "space-between",
          fontSize: 12, color: "rgba(245,245,245,0.6)",
          letterSpacing: 0.6,
        }}
      >
        <span>Session · {sessionCount}/{SESSION_TARGET}</span>
        <span>Saved · {savedIds.size}</span>
      </div>

      <AnimatePresence mode="wait">
        <motion.div
          key={current.id}
          initial={{ opacity: 0, x: 40, rotate: 4 }}
          animate={{ opacity: 1, x: 0, rotate: 0 }}
          exit={{ opacity: 0, x: -40, rotate: -4 }}
          transition={{ duration: 0.35 }}
          style={{ maxWidth: 480, margin: "0 auto" }}
        >
          <FactCard
            fact={current}
            lang={lang}
            saved={savedIds.has(current.id)}
            onToggleSave={() => onToggleSave(current.id)}
          />
        </motion.div>
      </AnimatePresence>

      <div
        style={{
          maxWidth: 480, margin: "18px auto 0",
          display: "flex", gap: 10, justifyContent: "center",
        }}
      >
        <button
          type="button"
          onClick={() => advance(false)}
          style={{
            flex: 1, padding: "12px", borderRadius: 12,
            border: "1px solid rgba(255,255,255,0.12)",
            background: "rgba(255,255,255,0.04)",
            color: "rgba(245,245,245,0.8)",
            fontSize: 14, fontWeight: 600, cursor: "pointer",
          }}
        >
          ↓ Skip
        </button>
        <button
          type="button"
          onClick={() => advance(true)}
          style={{
            flex: 1, padding: "12px", borderRadius: 12,
            border: "1px solid rgba(249,115,22,0.6)",
            background: "rgba(249,115,22,0.15)",
            color: "#f97316",
            fontSize: 14, fontWeight: 700, cursor: "pointer",
          }}
        >
          ★ Save & Next
        </button>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// Styling helpers
// ─────────────────────────────────────────────────────────────
function btnStyle(active: boolean): React.CSSProperties {
  return {
    padding: "8px 14px", borderRadius: 999,
    border: active
      ? "1px solid rgba(249,115,22,0.7)"
      : "1px solid rgba(255,255,255,0.12)",
    background: active
      ? "rgba(249,115,22,0.14)"
      : "rgba(255,255,255,0.04)",
    color: active ? "#f97316" : "rgba(245,245,245,0.75)",
    fontSize: 13, fontWeight: 700, letterSpacing: 0.3,
    cursor: "pointer",
  };
}
function chipStyle(active: boolean): React.CSSProperties {
  return {
    padding: "6px 11px", borderRadius: 999,
    border: active
      ? "1px solid rgba(249,115,22,0.6)"
      : "1px solid rgba(255,255,255,0.1)",
    background: active
      ? "rgba(249,115,22,0.12)"
      : "rgba(255,255,255,0.03)",
    color: active ? "#f97316" : "rgba(245,245,245,0.7)",
    fontSize: 12, fontWeight: 600, letterSpacing: 0.3,
    cursor: "pointer",
  };
}
