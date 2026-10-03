// src/app/nex-head-quarters/surface-health/page.tsx
//
// §12 Item 3 · NEX HQ · Surface-Health administrative view.
//
// Server component. Reads from the Item 1 nex_surface_health_event
// table via src/lib/nex-native/surface-health-admin.ts (read-only
// wrapper) and from the theme kill-switch service. All mutations are
// Server Actions in _actions.ts and go through the sealed Item 1
// lifecycle contract + the theme-kill-switch service.
//
// Doctrine coverage:
//   §4 user continuity   · HQ never surfaces private conversation content
//   §5a boundary scope   · HQ consumes Item 1 state; it does not catch
//                          render failures
//   §7.2 lifecycle       · displays all 7 states; grouping by state
//   §7.3 legal transitions · uses Item 1 service · DB trigger enforces
//   §9 reuse             · reuses surface-health-service, event bus,
//                          HQ layout; no new observability
//   §12 Item 3           · ongoing → investigating control + theme
//                          kill-switch (via nex_chat_theme.is_active)

import { listByLifecycleState, listRecentSurfaceHealthEvents, type NexSurfaceHealthEventRow } from "@/lib/nex-native/surface-health-admin";
import { listThemeKillSwitchStatus, type ThemeKillSwitchStatus } from "@/lib/nex-native/theme-kill-switch";
import { TransitionButton, KillSwitchToggle } from "./_controls-client";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const BOX: React.CSSProperties = {
  padding: 16,
  borderRadius: 10,
  border: "1px solid rgba(0,0,0,0.08)",
  background: "#fff",
  display: "flex",
  flexDirection: "column",
  gap: 8,
};

const COL_HEADER: React.CSSProperties = {
  fontSize: 10,
  letterSpacing: "0.14em",
  textTransform: "uppercase",
  color: "rgba(0,0,0,0.55)",
  fontWeight: 700,
};

const ROW: React.CSSProperties = {
  padding: "10px 12px",
  borderRadius: 8,
  background: "rgba(0,0,0,0.025)",
  display: "flex",
  flexDirection: "column",
  gap: 4,
  fontSize: 12,
};

export default async function SurfaceHealthPage() {
  const [ongoing, fallbackActive, investigating, fixed, recent, themes] =
    await Promise.all([
      listByLifecycleState(["ongoing"], 50),
      listByLifecycleState(["fallback-active"], 50),
      listByLifecycleState(["investigating"], 50),
      listByLifecycleState(["fixed"], 50),
      listRecentSurfaceHealthEvents(25),
      listThemeKillSwitchStatus(),
    ]);

  const envTokenConfigured =
    typeof process.env.NEX_HQ_ADMIN_TOKEN === "string" &&
    process.env.NEX_HQ_ADMIN_TOKEN.length >= 8;

  return (
    <main
      style={{
        padding: "20px 24px",
        display: "flex",
        flexDirection: "column",
        gap: 24,
        fontFamily:
          "system-ui, -apple-system, Segoe UI, Roboto, Helvetica, Arial, sans-serif",
        color: "#111",
        maxWidth: 1400,
        margin: "0 auto",
      }}
    >
      <header style={{ display: "flex", flexDirection: "column", gap: 4 }}>
        <h1 style={{ margin: 0, fontSize: 20, fontWeight: 700 }} data-testid="hq-surface-health-title">
          NEX HQ · Surface Health
        </h1>
        <p style={{ margin: 0, fontSize: 13, color: "rgba(0,0,0,0.6)" }}>
          §12 Item 3 · lifecycle control for chat-surface / visual-theme failures and theme kill-switch.
        </p>
        {!envTokenConfigured && (
          <p
            style={{
              marginTop: 6,
              padding: "6px 10px",
              borderRadius: 6,
              background: "#fff3cd",
              color: "#664d03",
              fontSize: 12,
            }}
            data-testid="hq-admin-token-missing"
          >
            NEX_HQ_ADMIN_TOKEN is not set in this environment · mutations will be rejected.
          </p>
        )}
      </header>

      {/* ── Lifecycle kanban ─────────────────────────────────────── */}
      <section
        style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 16 }}
        data-testid="hq-lifecycle-kanban"
      >
        <LifecycleColumn
          label="fallback-active"
          rows={fallbackActive}
          allowTransitionTo="ongoing"
          actionable={false}
        />
        <LifecycleColumn
          label="ongoing"
          rows={ongoing}
          allowTransitionTo="investigating"
          actionable={true}
        />
        <LifecycleColumn
          label="investigating"
          rows={investigating}
          allowTransitionTo={null}
          actionable={false}
        />
        <LifecycleColumn
          label="fixed"
          rows={fixed}
          allowTransitionTo={null}
          actionable={false}
        />
      </section>

      {/* ── Recent events (read-only) ───────────────────────────── */}
      <section style={BOX} data-testid="hq-recent-events">
        <div style={COL_HEADER}>Recent events · 25</div>
        {recent.length === 0 ? (
          <div style={{ fontSize: 12, color: "rgba(0,0,0,0.55)" }}>
            No surface-health events recorded yet.
          </div>
        ) : (
          <ol style={{ listStyle: "none", padding: 0, margin: 0, display: "flex", flexDirection: "column", gap: 4 }}>
            {recent.map((row) => (
              <li key={row.id} style={ROW} data-testid={`event-${row.id}`}>
                <EventSummary row={row} />
              </li>
            ))}
          </ol>
        )}
      </section>

      {/* ── Theme kill-switch controls ──────────────────────────── */}
      <section style={BOX} data-testid="hq-kill-switch-panel">
        <div style={COL_HEADER}>Theme kill-switch</div>
        <p style={{ margin: 0, fontSize: 12, color: "rgba(0,0,0,0.6)" }}>
          Disabling a theme toggles <code>nex_chat_theme.is_active</code>. Essential
          chat remains available via the Safe Fallback Renderer. Audit event
          emitted to <code>/api/nex/events</code>.
        </p>
        <ul style={{ listStyle: "none", padding: 0, margin: 0, display: "flex", flexDirection: "column", gap: 8 }}>
          {themes.map((t) => (
            <li
              key={t.theme_id}
              style={ROW}
              data-testid={`theme-row-${t.theme_id}`}
              data-active={t.is_active ? "true" : "false"}
            >
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12 }}>
                <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
                  <strong style={{ fontSize: 13 }}>{t.theme_name}</strong>
                  <span style={{ fontSize: 11, color: "rgba(0,0,0,0.55)" }}>
                    {t.theme_id} · {t.is_kill_switched ? "DISABLED (kill-switched)" : "active"}
                  </span>
                </div>
                <KillSwitchToggle
                  themeId={t.theme_id}
                  themeName={t.theme_name}
                  disabled={t.is_kill_switched}
                />
              </div>
            </li>
          ))}
        </ul>
      </section>
    </main>
  );
}

function LifecycleColumn({
  label,
  rows,
  allowTransitionTo,
  actionable,
}: {
  label: string;
  rows: NexSurfaceHealthEventRow[];
  allowTransitionTo: "investigating" | "ongoing" | null;
  actionable: boolean;
}) {
  return (
    <div style={BOX} data-testid={`lifecycle-column-${label}`}>
      <div style={COL_HEADER}>
        {label} · {rows.length}
      </div>
      {rows.length === 0 ? (
        <div style={{ fontSize: 12, color: "rgba(0,0,0,0.55)" }}>None.</div>
      ) : (
        <ol style={{ listStyle: "none", padding: 0, margin: 0, display: "flex", flexDirection: "column", gap: 6 }}>
          {rows.map((row) => (
            <li key={row.id} style={ROW} data-testid={`lifecycle-row-${row.id}`}>
              <EventSummary row={row} />
              {actionable && allowTransitionTo === "investigating" && (
                <TransitionButton rowId={row.id} />
              )}
            </li>
          ))}
        </ol>
      )}
    </div>
  );
}

function EventSummary({ row }: { row: NexSurfaceHealthEventRow }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
      <div>
        <strong>{row.error_classification}</strong>
        <span style={{ color: "rgba(0,0,0,0.55)" }}>
          {" · "}
          {row.surface} / {row.visual_theme} / {row.component_module}
        </span>
      </div>
      <div style={{ fontSize: 11, color: "rgba(0,0,0,0.55)" }}>
        signature {row.failure_signature.slice(0, 10)}… · occurrences {row.occurrence_count} · recovery {row.recovery_action} · {new Date(row.occurred_at).toISOString()}
      </div>
    </div>
  );
}
