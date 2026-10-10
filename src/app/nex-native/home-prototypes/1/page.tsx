import Link from "next/link";
import { PROTO } from "../_mock";

// Prototype 01 · Cinematic Showcase
// Full-bleed theme glow. Phone floats dead-centre with a halo. User name
// and theme name as oversized typographic marks. Nav as big accent pills.

export default function HomePrototype1() {
  return (
    <main
      style={{
        minHeight: "100dvh",
        background: PROTO.bg,
        color: PROTO.textPrimary,
        position: "relative",
        overflow: "hidden",
        fontFamily:
          "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, Cantarell, sans-serif",
      }}
    >
      {/* Cinematic backdrop */}
      <div
        aria-hidden
        style={{
          position: "absolute",
          inset: 0,
          background: `
            radial-gradient(60% 48% at 50% 24%, ${PROTO.themeAccent}44, transparent 72%),
            radial-gradient(80% 60% at 50% 100%, ${PROTO.themePeach}20, transparent 72%),
            radial-gradient(circle at 20% 10%, ${PROTO.themeAccent}22, transparent 50%)
          `,
          pointerEvents: "none",
        }}
      />
      <div
        aria-hidden
        style={{
          position: "absolute",
          inset: 0,
          backgroundImage: `linear-gradient(${PROTO.themeAccent}08 1px, transparent 1px), linear-gradient(90deg, ${PROTO.themeAccent}08 1px, transparent 1px)`,
          backgroundSize: "32px 32px",
          mask: "radial-gradient(70% 50% at 50% 50%, black 10%, transparent 85%)",
          WebkitMask: "radial-gradient(70% 50% at 50% 50%, black 10%, transparent 85%)",
          pointerEvents: "none",
        }}
      />

      <div style={{ position: "relative", maxWidth: 440, margin: "0 auto", padding: "24px 20px 40px" }}>
        {/* Minimal header */}
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <div style={{ fontSize: 18, fontWeight: 700, letterSpacing: "0.08em" }}>
            NE<span style={{ color: PROTO.themeAccent }}>X</span>
          </div>
          <Link
            href="/nex-native/settings"
            style={{
              fontSize: 10,
              letterSpacing: "0.18em",
              textTransform: "uppercase",
              fontWeight: 700,
              color: PROTO.textSecondary,
              textDecoration: "none",
            }}
          >
            Settings
          </Link>
        </div>

        {/* Oversized greeting */}
        <div style={{ marginTop: 36, textAlign: "center" }}>
          <div
            style={{
              fontSize: 11,
              letterSpacing: "0.3em",
              textTransform: "uppercase",
              color: PROTO.themeAccent,
              fontWeight: 700,
            }}
          >
            Welcome home, {PROTO.userName}
          </div>
          <h1
            style={{
              margin: "14px 0 0",
              fontSize: 56,
              fontWeight: 800,
              letterSpacing: "-0.03em",
              lineHeight: 0.95,
              background: `linear-gradient(180deg, ${PROTO.textPrimary} 0%, ${PROTO.themeAccent} 100%)`,
              WebkitBackgroundClip: "text",
              WebkitTextFillColor: "transparent",
              backgroundClip: "text",
            }}
          >
            {PROTO.themeName}
          </h1>
          <div
            style={{
              marginTop: 10,
              fontSize: 12.5,
              color: PROTO.textSecondary,
              letterSpacing: "0.04em",
            }}
          >
            is live across every surface of your NEX.
          </div>
        </div>

        {/* Three round quick-action buttons · hero-level, badges carry counts */}
        <div
          style={{
            marginTop: 28,
            display: "flex",
            justifyContent: "center",
            gap: 24,
          }}
        >
          {PROTO.navTiles.map((t) => (
            <Link
              key={t.href}
              href={t.href}
              aria-label={`${t.title} · ${t.count} new`}
              style={{
                position: "relative",
                width: 60,
                height: 60,
                borderRadius: "50%",
                background: `linear-gradient(145deg, ${PROTO.themeAccent}33, ${PROTO.themeAccent}0a)`,
                border: `1px solid ${PROTO.themeAccent}66`,
                boxShadow: `0 0 0 1px ${PROTO.themeAccent}22, 0 12px 28px ${PROTO.themeAccent}30`,
                display: "grid",
                placeItems: "center",
                fontSize: 24,
                textDecoration: "none",
                color: PROTO.textPrimary,
              }}
            >
              <span aria-hidden>{t.emoji}</span>
              {t.count > 0 && (
                <span
                  aria-hidden
                  style={{
                    position: "absolute",
                    top: -4,
                    right: -4,
                    minWidth: 22,
                    height: 22,
                    padding: "0 6px",
                    borderRadius: 999,
                    background: "#FF3B5C",
                    color: "#fff",
                    fontSize: 11,
                    fontWeight: 800,
                    display: "grid",
                    placeItems: "center",
                    boxShadow: `0 0 0 2px ${PROTO.bg}, 0 6px 14px rgba(255,59,92,0.5)`,
                    fontVariantNumeric: "tabular-nums",
                    lineHeight: 1,
                  }}
                >
                  {t.count > 99 ? "99+" : t.count}
                </span>
              )}
            </Link>
          ))}
        </div>

        {/* Floating phone */}
        <div style={{ marginTop: 36, display: "flex", justifyContent: "center", perspective: 1200 }}>
          <div
            style={{
              position: "relative",
              width: 240,
              height: 480,
              borderRadius: 36,
              background: `linear-gradient(145deg, ${PROTO.panel}, #000)`,
              border: `1px solid ${PROTO.themeAccent}66`,
              boxShadow: `
                0 0 0 1px ${PROTO.themeAccent}30,
                0 40px 90px -20px ${PROTO.themeAccent}80,
                0 20px 60px rgba(0,0,0,0.6)
              `,
              transform: "rotateX(2deg)",
              overflow: "hidden",
            }}
          >
            <div
              aria-hidden
              style={{
                position: "absolute",
                top: 12,
                left: "50%",
                transform: "translateX(-50%)",
                width: 90,
                height: 20,
                borderRadius: 999,
                background: "#000",
              }}
            />
            <div
              style={{
                position: "absolute",
                inset: 10,
                borderRadius: 28,
                background: `linear-gradient(170deg, ${PROTO.themeAccent}22, transparent 60%), ${PROTO.panel}`,
                padding: 22,
                display: "flex",
                flexDirection: "column",
                gap: 14,
              }}
            >
              <div style={{ height: 24 }} />
              <div
                style={{
                  fontSize: 22,
                  fontWeight: 700,
                  letterSpacing: "-0.02em",
                  color: PROTO.textPrimary,
                }}
              >
                {PROTO.userName}&apos;s NEX
              </div>
              <div style={{ fontSize: 11, color: PROTO.textSecondary }}>Live cover</div>
              <div
                style={{
                  marginTop: 4,
                  height: 90,
                  borderRadius: 14,
                  background: `linear-gradient(135deg, ${PROTO.themeAccent}, ${PROTO.themePeach})`,
                  boxShadow: `inset 0 0 60px ${PROTO.themeAccent}66`,
                }}
              />
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
                <div style={{ height: 70, borderRadius: 10, background: `${PROTO.themeAccent}1a`, border: `1px solid ${PROTO.themeAccent}33` }} />
                <div style={{ height: 70, borderRadius: 10, background: `${PROTO.themeAccent}1a`, border: `1px solid ${PROTO.themeAccent}33` }} />
                <div style={{ height: 70, borderRadius: 10, background: `${PROTO.themeAccent}1a`, border: `1px solid ${PROTO.themeAccent}33` }} />
                <div style={{ height: 70, borderRadius: 10, background: `${PROTO.themeAccent}1a`, border: `1px solid ${PROTO.themeAccent}33` }} />
              </div>
            </div>
          </div>
        </div>

        <Link
          href="/nex-native/home-prototypes"
          style={{
            display: "block",
            marginTop: 40,
            textAlign: "center",
            fontSize: 10,
            letterSpacing: "0.2em",
            textTransform: "uppercase",
            color: PROTO.textSecondary,
            textDecoration: "none",
          }}
        >
          ← back to prototypes
        </Link>
      </div>
    </main>
  );
}
