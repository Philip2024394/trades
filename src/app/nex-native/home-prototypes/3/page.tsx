import Link from "next/link";
import { PROTO } from "../_mock";

// Prototype 03 · Control Center
// Operator dashboard: live stats · quick actions · phone as a monitored
// surface. Dense but not cluttered. Monospace numerics.

const STATS = [
  { label: "Visitors today", value: "248", delta: "+18%" },
  { label: "Active chats", value: "12", delta: "+3" },
  { label: "Orders pending", value: "3", delta: "0" },
  { label: "Signals green", value: "100%", delta: "stable" },
];

const QUICK = [
  { href: "/nex-native/manage/products/new", emoji: "➕", title: "Add product" },
  { href: "/nex-native/manage/banners", emoji: "📣", title: "New banner" },
  { href: "/nex-native/manage/live", emoji: "🔴", title: "Go live" },
  { href: "/nex-native/manage/analytics", emoji: "📊", title: "Analytics" },
];

export default function HomePrototype3() {
  return (
    <main
      style={{
        minHeight: "100dvh",
        background: PROTO.bg,
        color: PROTO.textPrimary,
        padding: "20px 16px 40px",
        fontFamily:
          "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, Cantarell, sans-serif",
      }}
    >
      <div style={{ maxWidth: 440, margin: "0 auto" }}>
        {/* Compact header bar */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            padding: "10px 14px",
            borderRadius: 12,
            background: PROTO.panel,
            border: `1px solid ${PROTO.themeAccent}33`,
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <div
              style={{
                width: 10,
                height: 10,
                borderRadius: "50%",
                background: "#3AE26B",
                boxShadow: "0 0 8px #3AE26B",
              }}
            />
            <div>
              <div style={{ fontSize: 13, fontWeight: 600 }}>{PROTO.userName}</div>
              <div style={{ fontSize: 10, color: PROTO.textSecondary, letterSpacing: "0.08em", textTransform: "uppercase" }}>
                {PROTO.themeName} · live
              </div>
            </div>
          </div>
          <Link
            href="/nex-native/chat-themes-library"
            style={{
              fontSize: 10,
              letterSpacing: "0.14em",
              textTransform: "uppercase",
              fontWeight: 700,
              color: PROTO.themeAccent,
              textDecoration: "none",
              padding: "6px 10px",
              borderRadius: 999,
              background: `${PROTO.themeAccent}18`,
            }}
          >
            Theme
          </Link>
        </div>

        {/* Hero: phone + status column, grid */}
        <div
          style={{
            marginTop: 14,
            display: "grid",
            gridTemplateColumns: "180px 1fr",
            gap: 12,
          }}
        >
          {/* Phone */}
          <div
            style={{
              aspectRatio: "180 / 360",
              borderRadius: 24,
              background: "#000",
              border: `1px solid ${PROTO.themeAccent}55`,
              boxShadow: `0 20px 40px -16px ${PROTO.themeAccent}66`,
              padding: 8,
              position: "relative",
              overflow: "hidden",
            }}
          >
            <div
              style={{
                position: "absolute",
                top: 10,
                left: "50%",
                transform: "translateX(-50%)",
                width: 70,
                height: 14,
                borderRadius: 999,
                background: "#000",
                border: `1px solid ${PROTO.panel}`,
              }}
            />
            <div
              style={{
                width: "100%",
                height: "100%",
                borderRadius: 18,
                background: `linear-gradient(170deg, ${PROTO.themeAccent}, ${PROTO.themePeach})`,
                display: "flex",
                flexDirection: "column",
                justifyContent: "flex-end",
                padding: 12,
                color: "#120A14",
              }}
            >
              <div style={{ fontSize: 14, fontWeight: 700 }}>Live preview</div>
              <div style={{ fontSize: 9, letterSpacing: "0.14em", textTransform: "uppercase", opacity: 0.7 }}>
                As a visitor sees it
              </div>
            </div>
          </div>

          {/* Status tiles */}
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
            {STATS.map((s) => (
              <div
                key={s.label}
                style={{
                  padding: 12,
                  borderRadius: 12,
                  background: PROTO.panel,
                  border: `1px solid ${PROTO.themeAccent}2a`,
                }}
              >
                <div style={{ fontSize: 9, letterSpacing: "0.14em", textTransform: "uppercase", color: PROTO.textSecondary, fontWeight: 700 }}>
                  {s.label}
                </div>
                <div
                  style={{
                    marginTop: 6,
                    fontSize: 22,
                    fontWeight: 700,
                    fontVariantNumeric: "tabular-nums",
                    color: PROTO.textPrimary,
                    letterSpacing: "-0.02em",
                  }}
                >
                  {s.value}
                </div>
                <div style={{ fontSize: 10, color: PROTO.themeAccent, marginTop: 2, fontWeight: 600 }}>
                  {s.delta}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Quick actions */}
        <div style={{ marginTop: 18 }}>
          <div style={{ fontSize: 10, letterSpacing: "0.18em", textTransform: "uppercase", fontWeight: 700, color: PROTO.textSecondary }}>
            Quick actions
          </div>
          <div style={{ marginTop: 10, display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 8 }}>
            {QUICK.map((q) => (
              <Link
                key={q.href}
                href={q.href}
                style={{
                  padding: "14px 6px",
                  borderRadius: 12,
                  background: `linear-gradient(180deg, ${PROTO.themeAccent}22, transparent)`,
                  border: `1px solid ${PROTO.themeAccent}44`,
                  textDecoration: "none",
                  color: PROTO.textPrimary,
                  textAlign: "center",
                }}
              >
                <div style={{ fontSize: 22, lineHeight: 1 }}>{q.emoji}</div>
                <div style={{ marginTop: 6, fontSize: 10, fontWeight: 600, letterSpacing: "0.02em" }}>{q.title}</div>
              </Link>
            ))}
          </div>
        </div>

        {/* Primary surfaces */}
        <div style={{ marginTop: 18 }}>
          <div style={{ fontSize: 10, letterSpacing: "0.18em", textTransform: "uppercase", fontWeight: 700, color: PROTO.textSecondary }}>
            Surfaces
          </div>
          <div style={{ marginTop: 10, display: "grid", gap: 8 }}>
            {PROTO.navTiles.map((t) => (
              <Link
                key={t.href}
                href={t.href}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 12,
                  padding: "12px 14px",
                  borderRadius: 12,
                  background: PROTO.panel,
                  border: `1px solid ${PROTO.themeAccent}2a`,
                  textDecoration: "none",
                  color: PROTO.textPrimary,
                }}
              >
                <div style={{ fontSize: 22 }}>{t.emoji}</div>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 14, fontWeight: 600 }}>{t.title}</div>
                  <div style={{ fontSize: 11, color: PROTO.textSecondary }}>{t.caption}</div>
                </div>
                <div style={{ color: PROTO.themeAccent, fontSize: 18 }}>→</div>
              </Link>
            ))}
          </div>
        </div>

        {/* Footer */}
        <div style={{ marginTop: 24, display: "flex", justifyContent: "space-between", alignItems: "center", fontSize: 10, color: PROTO.textSecondary }}>
          <div style={{ fontVariantNumeric: "tabular-nums" }}>uptime 99.98% · 24h</div>
          <Link href="/nex-native/home-prototypes" style={{ color: PROTO.textSecondary, textDecoration: "none", letterSpacing: "0.18em", textTransform: "uppercase", fontWeight: 700 }}>
            ← prototypes
          </Link>
        </div>
      </div>
    </main>
  );
}
