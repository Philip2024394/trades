// NEX Knowledge Factory — /nex-head-quarters/factory
//
// Phase 12.4 · The dedicated visual Knowledge Factory Philip authorised
// after 12.3 proved real worker liveness.
//
// Task #72 Step 2 (2026-08-22 · Philip constitutional rule "one HQ · one
// worker registry"): Factory no longer renders its own worker-health grid.
// The Workers · Reliability page (/nex-head-quarters/workers) is the ONE
// canonical worker view. Factory keeps the pipeline visual:
//
//   INBOX  →  WAREHOUSE  →  VAULT   (+ Activity Stream sidebar)
//
// Every visual element is driven by real backend state — there is no
// decorative animation, no random ticker, no simulated counters. If
// nothing is happening, the factory sits visibly idle. When a job
// lands in the warehouse, the stage barrel's count increments; when
// it reaches the vault, one of the vault shelves ticks up. Framer
// Motion animates the DIFFS returned by the endpoints — never
// fabricated motion.
//
// Endpoints polled every 5s (workers-live REMOVED in Step 2 · Workers
// page reads reliability data directly from nex.worker_health_status):
//   /api/nex/brain/warehouse          ← stage barrels + vault shelves
//   /api/nex/knowledge-inbox/list     ← inbox tile
//   /api/nex/brain/timeline           ← activity stream
//
// Guardrails held:
//   · No Math.random. No setInterval-driven counters. No decorative
//     idle motion.
//   · Quality-checker semantics untouched (still governed by 10.4/10.7).
//   · No storage backend flip.
//   · Frozen systems (Predictive · Comms Social · Hammerex Social ·
//     v1.0.0 kernel) not touched.
//   · Worker-status interpretation lives in EXACTLY ONE surface
//     (/nex-head-quarters/workers) — this file must never re-create it.

"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { AnimatePresence, motion } from "framer-motion";
import "../../nex-app/nex-app.css";

// ─────────────────────────────────────────────────────────────────
// API response shapes (mirror the JSON handlers exactly)
// ─────────────────────────────────────────────────────────────────

// Task #72 Step 2 (2026-08-22): WorkerLive + WorkersLiveResponse types
// removed with WorkersPanel/WorkerCard. Worker-status shape lives in
// /nex-head-quarters/workers · not duplicated here.

type WarehouseStage = {
  key: string;
  label: string;
  glyph: string;
  count: number;
  oldest_at: string | null;
  oldest_age_ms: number | null;
};

type WarehouseResponse = {
  ok: true;
  stages: WarehouseStage[];
  vault_records: {
    authoritative: number;
    awaiting_review: number;
    draft_rejected: number;
    draft_awaiting_check: number;
    deprecated: number;
  };
  source: string;
};

type InboxItem = {
  id: string;
  title: string;
  kind: string;
  status: "waiting" | "processing" | "review" | "processed";
  source: string;
  createdAt: number;
};

type InboxResponse = {
  ok: true;
  items: InboxItem[];
};

type TimelineEvent = {
  id: string;
  entity_type: string;
  entity_id: string;
  action: string;
  actor: string;
  before_state: Record<string, unknown> | null;
  after_state: Record<string, unknown> | null;
  notes: string | null;
  created_at: string;
};

type TimelineResponse = { ok: true; events: TimelineEvent[] };

// ─────────────────────────────────────────────────────────────────
// Palette · re-uses the Operations Centre tokens for visual coherence.
// ─────────────────────────────────────────────────────────────────

const T = {
  bg:            "var(--nex-cream)",
  bgGradient:    "linear-gradient(180deg, var(--nex-cream) 0%, var(--nex-cream-elev) 100%)",
  panel:         "var(--nex-neutral-0)",
  panelElev:     "var(--nex-cream-elev)",
  border:        "var(--nex-neutral-200)",
  borderStrong:  "var(--nex-neutral-300, var(--nex-neutral-200))",
  text:          "var(--nex-neutral-900)",
  textDim:       "var(--nex-neutral-700)",
  textFade:      "var(--nex-neutral-500)",
  textGhost:     "var(--nex-neutral-400, var(--nex-neutral-500))",
  accent:        "var(--nex-accent-500)",
  accentSoft:    "var(--nex-accent-50)",
  success:       "var(--nex-success-500)",
  info:          "var(--nex-info-500)",
  warning:       "var(--nex-warning-500)",
  danger:        "#DC2626",
  wallDark:      "#A6835A",
  floor:         "#F5EAD5",
  shadowMd:      "var(--nex-shadow-md)",
  shadowLg:      "var(--nex-shadow-lg)",
} as const;

// Task #72 Step 2 (2026-08-22): STATUS_COLOR palette removed with the
// WorkersPanel. Worker status colours + labels live in the single
// canonical /nex-head-quarters/workers surface.

const POLL_MS = 5_000;

// ─────────────────────────────────────────────────────────────────
// Poll hook · fetches all four endpoints in parallel every POLL_MS.
// AbortController on unmount. Any single endpoint failing does NOT
// clear the others — stale-until-refresh keeps the UI stable.
// ─────────────────────────────────────────────────────────────────

// Task #72 Step 2 (2026-08-22): workers/workerTotals/livenessMs removed
// with WorkersPanel. Factory data now covers only Inbox · Warehouse ·
// Vault · Activity Stream. Worker-status data lives at /nex-head-quarters/workers.
type FactoryData = {
  warehouse: WarehouseStage[] | null;
  vault: WarehouseResponse["vault_records"] | null;
  inbox: InboxItem[] | null;
  timeline: TimelineEvent[] | null;
  lastUpdatedAt: string | null;
  pollError: string | null;
};

function useFactoryPoll(): { data: FactoryData; refresh: () => void; isPolling: boolean } {
  const [data, setData] = useState<FactoryData>({
    warehouse: null, vault: null,
    inbox: null, timeline: null,
    lastUpdatedAt: null, pollError: null,
  });
  const [isPolling, setIsPolling] = useState(false);
  const abortRef = useRef<AbortController | null>(null);

  const refresh = useCallback(async () => {
    abortRef.current?.abort();
    const ac = new AbortController();
    abortRef.current = ac;
    setIsPolling(true);
    try {
      // Task #72 Step 2: /api/nex/brain/workers-live removed from the
      // Factory poll. The Workers · Reliability page reads worker health
      // directly from nex.worker_health_status via a server component.
      const [wh, ib, tl] = await Promise.all([
        fetch("/api/nex/brain/warehouse",             { cache: "no-store", signal: ac.signal }).then((r) => r.json()).catch(() => null),
        fetch("/api/nex/knowledge-inbox/list",        { cache: "no-store", signal: ac.signal }).then((r) => r.json()).catch(() => null),
        fetch("/api/nex/brain/timeline?limit=25",     { cache: "no-store", signal: ac.signal }).then((r) => r.json()).catch(() => null),
      ]);
      if (ac.signal.aborted) return;
      setData((prev) => ({
        warehouse:     wh?.ok ? (wh as WarehouseResponse).stages           : prev.warehouse,
        vault:         wh?.ok ? (wh as WarehouseResponse).vault_records    : prev.vault,
        inbox:         ib?.ok ? (ib as InboxResponse).items                : prev.inbox,
        timeline:      tl?.ok ? (tl as TimelineResponse).events            : prev.timeline,
        lastUpdatedAt: new Date().toISOString(),
        pollError:     null,
      }));
    } catch (err) {
      if ((err as Error).name === "AbortError") return;
      setData((prev) => ({ ...prev, pollError: (err as Error).message }));
    } finally {
      if (!ac.signal.aborted) setIsPolling(false);
    }
  }, []);

  useEffect(() => {
    refresh();
    const id = window.setInterval(refresh, POLL_MS);
    return () => {
      window.clearInterval(id);
      abortRef.current?.abort();
    };
  }, [refresh]);

  return { data, refresh, isPolling };
}

// ─────────────────────────────────────────────────────────────────
// Formatters
// ─────────────────────────────────────────────────────────────────

function fmtAge(ms: number | null | undefined): string {
  if (ms == null || !Number.isFinite(ms)) return "—";
  const s = Math.max(0, Math.round(ms / 1000));
  if (s < 60)     return `${s}s`;
  const m = Math.floor(s / 60);
  if (m < 60)     return `${m}m ${s % 60}s`;
  const h = Math.floor(m / 60);
  if (h < 24)     return `${h}h ${m % 60}m`;
  const d = Math.floor(h / 24);
  return `${d}d ${h % 24}h`;
}

function fmtTime(iso: string | null | undefined): string {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toTimeString().slice(0, 8);
}

function shortRef(ref: string | null | undefined, max = 34): string {
  if (!ref) return "—";
  return ref.length > max ? ref.slice(0, max - 1) + "…" : ref;
}

// ─────────────────────────────────────────────────────────────────
// InboxPanel — the intake tile. Count is REAL inbox size + status
// breakdown so operators can see waiting vs processing at a glance.
// ─────────────────────────────────────────────────────────────────

function InboxPanel({ inbox }: { inbox: InboxItem[] | null }) {
  const total = inbox?.length ?? null;
  const byStatus = useMemo(() => {
    const b: Record<string, number> = { waiting: 0, processing: 0, review: 0, processed: 0 };
    for (const it of inbox ?? []) b[it.status] = (b[it.status] ?? 0) + 1;
    return b;
  }, [inbox]);

  return (
    <section
      aria-label="Inbox"
      style={{
        background: T.panel, border: `1px solid ${T.border}`, borderRadius: 20,
        padding: 20, boxShadow: T.shadowMd, minWidth: 220, display: "flex", flexDirection: "column", gap: 10,
      }}
    >
      <header style={{ display: "flex", alignItems: "baseline", gap: 8 }}>
        <span style={{ fontSize: 22 }}>📥</span>
        <h2 style={{ margin: 0, fontSize: 15, fontWeight: 700, color: T.textDim, letterSpacing: 0.5 }}>INBOX</h2>
      </header>
      <div style={{ display: "flex", alignItems: "baseline", gap: 8 }}>
        <div style={{ fontSize: 40, fontWeight: 800, color: T.text, lineHeight: 1 }}>
          {total ?? "—"}
        </div>
        <div style={{ fontSize: 12, color: T.textFade }}>items</div>
      </div>
      <dl style={{ display: "grid", gridTemplateColumns: "auto auto", gap: "2px 12px", margin: 0, fontSize: 12 }}>
        <dt style={{ color: T.textFade }}>Waiting</dt>       <dd style={{ margin: 0, color: T.text, fontVariantNumeric: "tabular-nums", justifySelf: "end" }}>{byStatus.waiting}</dd>
        <dt style={{ color: T.textFade }}>Processing</dt>    <dd style={{ margin: 0, color: T.text, fontVariantNumeric: "tabular-nums", justifySelf: "end" }}>{byStatus.processing}</dd>
        <dt style={{ color: T.textFade }}>In review</dt>     <dd style={{ margin: 0, color: T.text, fontVariantNumeric: "tabular-nums", justifySelf: "end" }}>{byStatus.review}</dd>
        <dt style={{ color: T.textFade }}>Processed</dt>     <dd style={{ margin: 0, color: T.text, fontVariantNumeric: "tabular-nums", justifySelf: "end" }}>{byStatus.processed}</dd>
      </dl>
    </section>
  );
}

// ─────────────────────────────────────────────────────────────────
// WorkerLinkCard — Task #72 Step 2 (2026-08-22).
//
// Replaces the removed WorkersPanel/WorkerCard. Factory does NOT show
// worker health · that is the sole responsibility of
// /nex-head-quarters/workers. This card is a signpost, not a status
// surface. Renders zero live data · no polling · no derived state ·
// no coloured indicators. It exists so an operator arriving at the
// Factory looking for "how are the workers doing?" is pointed at the
// canonical answer instead of finding a competing view.
// ─────────────────────────────────────────────────────────────────

function WorkerLinkCard() {
  return (
    <Link
      href="/nex-head-quarters/workers"
      style={{ textDecoration: "none" }}
      aria-label="Open Workers · Reliability page"
    >
      <section
        aria-label="Workers pointer"
        style={{
          background: T.panelElev,
          border: `1px solid ${T.border}`,
          borderRadius: 20,
          padding: 20,
          boxShadow: T.shadowMd,
          flex: 1,
          display: "flex",
          flexDirection: "column",
          gap: 10,
          minHeight: 140,
          cursor: "pointer",
        }}
      >
        <header style={{ display: "flex", alignItems: "baseline", gap: 8 }}>
          <span style={{ fontSize: 22 }}>👷</span>
          <h2 style={{ margin: 0, fontSize: 15, fontWeight: 700, color: T.textDim, letterSpacing: 0.5 }}>
            WORKERS
          </h2>
          <span style={{ fontSize: 10, color: T.textFade }}>
            (canonical view · not shown here)
          </span>
        </header>
        <p style={{ margin: 0, fontSize: 13, color: T.textDim, lineHeight: 1.4 }}>
          Worker health lives on the Workers · Reliability page. That is the
          one authoritative surface. Factory only shows the pipeline
          (Inbox → Warehouse → Vault).
        </p>
        <div
          style={{
            marginTop: "auto",
            display: "inline-flex",
            alignItems: "center",
            gap: 6,
            fontSize: 12,
            fontWeight: 600,
            color: T.accent,
          }}
        >
          Open Workers · Reliability →
        </div>
      </section>
    </Link>
  );
}

// ─────────────────────────────────────────────────────────────────
// WarehousePanel — the six stage barrels. Each barrel's fill height
// scales with count (log-relative to the biggest barrel in the row).
// Count animates only when the actual number changes.
// ─────────────────────────────────────────────────────────────────

function WarehousePanel({ stages }: { stages: WarehouseStage[] | null }) {
  const list = stages ?? [];
  const maxCount = Math.max(1, ...list.map((s) => s.count));

  return (
    <section
      aria-label="Warehouse"
      style={{
        background: T.panel, border: `1px solid ${T.border}`, borderRadius: 20,
        padding: 20, boxShadow: T.shadowLg,
        display: "flex", flexDirection: "column", gap: 14,
      }}
    >
      <header style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between" }}>
        <div style={{ display: "flex", alignItems: "baseline", gap: 8 }}>
          <span style={{ fontSize: 22 }}>🛢️</span>
          <h2 style={{ margin: 0, fontSize: 15, fontWeight: 700, color: T.textDim, letterSpacing: 0.5 }}>WAREHOUSE</h2>
        </div>
        <span style={{ fontSize: 11, color: T.textFade }}>
          in-flight records at every pipeline stage
        </span>
      </header>
      <div
        style={{
          display: "grid",
          gridTemplateColumns: `repeat(${Math.max(1, list.length)}, minmax(0, 1fr))`,
          gap: 12,
          alignItems: "end",
          minHeight: 180,
        }}
      >
        {list.map((s) => {
          const fill = Math.min(1, Math.log10(1 + s.count) / Math.log10(1 + maxCount || 1));
          const filled = s.count > 0;
          return (
            <div key={s.key} style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 6 }}>
              <div
                style={{
                  position: "relative", width: "100%", maxWidth: 96, height: 160,
                  border: `2px solid ${T.borderStrong}`, borderRadius: 12,
                  background: T.panelElev, overflow: "hidden",
                }}
                aria-label={`${s.label} · ${s.count} items`}
              >
                <motion.div
                  layout
                  initial={false}
                  animate={{ height: `${(filled ? fill : 0) * 100}%` }}
                  transition={{ type: "spring", stiffness: 160, damping: 24 }}
                  style={{
                    position: "absolute", left: 0, right: 0, bottom: 0,
                    background: filled
                      ? `linear-gradient(180deg, ${T.accentSoft} 0%, ${T.accent} 100%)`
                      : "transparent",
                    borderTop: filled ? `2px solid ${T.accent}` : "none",
                  }}
                />
                <div
                  style={{
                    position: "absolute", inset: 0,
                    display: "flex", alignItems: "flex-start", justifyContent: "center",
                    paddingTop: 8, fontSize: 22,
                  }}
                  aria-hidden
                >
                  {s.glyph}
                </div>
                <div
                  style={{
                    position: "absolute", bottom: 6, left: 0, right: 0,
                    textAlign: "center", fontSize: 22, fontWeight: 800,
                    color: filled ? "#FFFFFF" : T.textGhost,
                    textShadow: filled ? "0 1px 2px rgba(0,0,0,0.35)" : "none",
                    fontVariantNumeric: "tabular-nums",
                  }}
                >
                  <motion.span
                    key={s.count}
                    initial={{ y: -6, opacity: 0 }}
                    animate={{ y: 0, opacity: 1 }}
                    transition={{ duration: 0.25 }}
                  >
                    {s.count}
                  </motion.span>
                </div>
              </div>
              <div style={{ textAlign: "center", maxWidth: 120 }}>
                <div style={{ fontSize: 12, fontWeight: 600, color: T.text, lineHeight: 1.2 }}>{s.label}</div>
                <div style={{ fontSize: 10, color: T.textFade, marginTop: 2 }}>
                  {s.oldest_age_ms != null ? `oldest ${fmtAge(s.oldest_age_ms)}` : "—"}
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}

// ─────────────────────────────────────────────────────────────────
// VaultPanel — final resting places for finished records. Five
// shelves, ordered good-to-bad. Awaiting_review is emphasised because
// that is where operator attention converts backlog to authoritative.
// ─────────────────────────────────────────────────────────────────

function VaultPanel({ vault }: { vault: WarehouseResponse["vault_records"] | null }) {
  const shelves: Array<{ key: keyof WarehouseResponse["vault_records"]; label: string; glyph: string; href: string | null; emphasise: boolean }> = [
    { key: "authoritative",        label: "Authoritative",         glyph: "✅", href: "/nex-head-quarters/records?filter=authoritative", emphasise: false },
    { key: "awaiting_review",      label: "Awaiting your review",  glyph: "👀", href: "/nex-head-quarters/review",                        emphasise: true  },
    { key: "draft_awaiting_check", label: "Draft · awaiting check",glyph: "⏳", href: null, emphasise: false },
    { key: "draft_rejected",       label: "Rejected drafts",       glyph: "🗑️", href: null, emphasise: false },
    { key: "deprecated",           label: "Deprecated",            glyph: "📜", href: null, emphasise: false },
  ];

  return (
    <section
      aria-label="Vault"
      style={{
        background: T.panel, border: `1px solid ${T.border}`, borderRadius: 20,
        padding: 20, boxShadow: T.shadowMd, display: "flex", flexDirection: "column", gap: 14,
      }}
    >
      <header style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between" }}>
        <div style={{ display: "flex", alignItems: "baseline", gap: 8 }}>
          <span style={{ fontSize: 22 }}>📦</span>
          <h2 style={{ margin: 0, fontSize: 15, fontWeight: 700, color: T.textDim, letterSpacing: 0.5 }}>VAULT</h2>
        </div>
        <span style={{ fontSize: 11, color: T.textFade }}>terminal states · final storage</span>
      </header>
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))",
          gap: 12,
        }}
      >
        {shelves.map((s) => {
          const count = vault?.[s.key] ?? null;
          const content = (
            <article
              style={{
                background: s.emphasise ? T.accentSoft : T.panelElev,
                border: `1px solid ${s.emphasise ? T.accent : T.border}`,
                borderRadius: 12,
                padding: "14px 16px",
                display: "flex", flexDirection: "column", gap: 4,
                minHeight: 96,
                cursor: s.href ? "pointer" : "default",
              }}
            >
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <span aria-hidden style={{ fontSize: 20 }}>{s.glyph}</span>
                  <span style={{ fontSize: 13, fontWeight: 600, color: T.text }}>{s.label}</span>
                </div>
                {s.emphasise && count != null && count > 0 && (
                  <span style={{ fontSize: 10, fontWeight: 700, color: T.accent, textTransform: "uppercase", letterSpacing: 0.4 }}>
                    review →
                  </span>
                )}
              </div>
              <div style={{ fontSize: 32, fontWeight: 800, color: T.text, fontVariantNumeric: "tabular-nums", lineHeight: 1 }}>
                <motion.span key={count ?? "n"} initial={{ y: -6, opacity: 0 }} animate={{ y: 0, opacity: 1 }} transition={{ duration: 0.25 }}>
                  {count ?? "—"}
                </motion.span>
              </div>
            </article>
          );
          return s.href
            ? <Link key={s.key} href={s.href} style={{ textDecoration: "none" }}>{content}</Link>
            : <div key={s.key}>{content}</div>;
        })}
      </div>
    </section>
  );
}

// ─────────────────────────────────────────────────────────────────
// ActivityStream — real audit trail. Each row is a real transition
// pulled from /timeline. New rows fade in when they appear at the top
// (AnimatePresence keyed by event.id). No decorative ticker.
// ─────────────────────────────────────────────────────────────────

function summariseEvent(ev: TimelineEvent): { verb: string; from: string | null; to: string | null } {
  const bs = (ev.before_state ?? {}) as { status?: string };
  const as = (ev.after_state  ?? {}) as { status?: string };
  return { verb: ev.action, from: bs.status ?? null, to: as.status ?? null };
}

function ActivityStream({ events }: { events: TimelineEvent[] | null }) {
  const list = (events ?? []).slice(0, 25);
  return (
    <section
      aria-label="Recent movement"
      style={{
        background: T.panel, border: `1px solid ${T.border}`, borderRadius: 20,
        padding: 20, boxShadow: T.shadowMd,
        display: "flex", flexDirection: "column", gap: 12, minHeight: 320,
      }}
    >
      <header style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between" }}>
        <div style={{ display: "flex", alignItems: "baseline", gap: 8 }}>
          <span style={{ fontSize: 20 }}>⏱️</span>
          <h2 style={{ margin: 0, fontSize: 15, fontWeight: 700, color: T.textDim, letterSpacing: 0.5 }}>RECENT ACTIVITY · HISTORY</h2>
          <span style={{ fontSize: 10, color: T.textFade }}>(past events · newest first · NOT current worker state)</span>
        </div>
      </header>
      {list.length === 0 ? (
        <div style={{ padding: 20, color: T.textGhost, fontSize: 13, textAlign: "center" }}>
          No transitions in the current window. Factory is quiet.
        </div>
      ) : (
        <ol style={{ listStyle: "none", padding: 0, margin: 0, display: "flex", flexDirection: "column", gap: 6 }}>
          <AnimatePresence initial={false}>
            {list.map((ev) => {
              const s = summariseEvent(ev);
              return (
                <motion.li
                  key={ev.id}
                  layout
                  initial={{ opacity: 0, y: -6 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0 }}
                  transition={{ duration: 0.25 }}
                  style={{
                    display: "grid",
                    gridTemplateColumns: "72px 1fr",
                    gap: 10,
                    padding: "6px 8px",
                    borderRadius: 8,
                    background: T.panelElev,
                    fontSize: 12,
                    alignItems: "baseline",
                  }}
                >
                  <span style={{ color: T.textFade, fontFamily: "var(--nex-font-mono, monospace)", fontVariantNumeric: "tabular-nums" }}>
                    {fmtTime(ev.created_at)}
                  </span>
                  <span style={{ color: T.text, lineHeight: 1.35 }}>
                    <span style={{ color: T.textDim, marginRight: 4 }}>{ev.actor}</span>
                    <span style={{ marginRight: 4 }}>·</span>
                    <span style={{ color: T.text, fontWeight: 600 }}>{s.verb}</span>
                    {s.from && s.to && (
                      <span style={{ color: T.textFade, marginLeft: 4 }}>
                        {s.from} → {s.to}
                      </span>
                    )}
                    <span style={{ display: "block", color: T.textDim, fontFamily: "var(--nex-font-mono, monospace)", fontSize: 11 }} title={ev.entity_id}>
                      {ev.entity_type} · {shortRef(ev.entity_id, 46)}
                    </span>
                  </span>
                </motion.li>
              );
            })}
          </AnimatePresence>
        </ol>
      )}
    </section>
  );
}

// ─────────────────────────────────────────────────────────────────
// FactoryPage — composition. Header is sticky; sections below.
// ─────────────────────────────────────────────────────────────────

export default function FactoryPage() {
  const { data, refresh, isPolling } = useFactoryPoll();
  const nowKey = data.lastUpdatedAt ?? "";

  return (
    <main
      style={{
        minHeight: "100vh",
        background: T.bgGradient,
        color: T.text,
        fontFamily: "var(--nex-font-body, system-ui, sans-serif)",
        padding: "16px 20px 80px",
      }}
    >
      {/* Sticky header */}
      <header
        style={{
          position: "sticky", top: 0, zIndex: 10,
          margin: "0 -20px 20px",
          padding: "14px 20px",
          background: "rgba(245,234,213,0.92)", backdropFilter: "blur(8px)",
          borderBottom: `1px solid ${T.border}`,
          display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, flexWrap: "wrap",
        }}
      >
        <div style={{ display: "flex", alignItems: "baseline", gap: 12 }}>
          <span style={{ fontSize: 22 }}>🏭</span>
          <h1 style={{ margin: 0, fontSize: 20, fontWeight: 800, letterSpacing: 0.2, color: T.text }}>
            NEX Knowledge Factory
          </h1>
          <span style={{ fontSize: 12, color: T.textFade }}>
            Inbox → Warehouse → Vault · workers on /workers
          </span>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <span style={{ fontSize: 11, color: T.textFade, fontVariantNumeric: "tabular-nums" }}>
            Last poll: {fmtTime(data.lastUpdatedAt)} · {POLL_MS / 1000}s cadence
          </span>
          <button
            type="button"
            onClick={refresh}
            disabled={isPolling}
            style={{
              padding: "6px 12px", borderRadius: 999,
              background: T.accent, color: "#FFFFFF", border: "none",
              fontSize: 12, fontWeight: 600, cursor: isPolling ? "wait" : "pointer",
              opacity: isPolling ? 0.7 : 1,
            }}
          >
            {isPolling ? "Refreshing…" : "Refresh"}
          </button>
        </div>
      </header>

      {/* INBOX  ·  WORKERS-LINK row (Task #72 Step 2 · 2026-08-22).
          WorkersPanel removed · WorkerLinkCard is a signpost only ·
          worker health lives on /nex-head-quarters/workers. */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "minmax(220px, 260px) 1fr",
          gap: 20,
          marginBottom: 20,
          alignItems: "stretch",
        }}
      >
        <InboxPanel inbox={data.inbox} />
        <WorkerLinkCard />
      </div>

      {/* WAREHOUSE row (full width) */}
      <div style={{ marginBottom: 20 }} key={`wh-${nowKey}`}>
        <WarehousePanel stages={data.warehouse} />
      </div>

      {/* VAULT + ACTIVITY STREAM row */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "minmax(0, 2fr) minmax(0, 1fr)",
          gap: 20,
        }}
      >
        <VaultPanel vault={data.vault} />
        <ActivityStream events={data.timeline} />
      </div>

      {data.pollError && (
        <div
          role="alert"
          style={{
            marginTop: 20, padding: "10px 14px", borderRadius: 10,
            background: "rgba(220,38,38,0.06)", border: `1px solid ${T.danger}`, color: T.danger, fontSize: 12,
          }}
        >
          Poll error: {data.pollError}
        </div>
      )}
    </main>
  );
}
