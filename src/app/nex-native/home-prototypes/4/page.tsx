import Link from "next/link";
import { PROTO } from "../_mock";

// Prototype 04 · Minimalist Zen
// Apple-store calm. Centred single column. No panels. No borders.
// Breathing room. One idea per screen.

export default function HomePrototype4() {
  return (
    <main
      style={{
        minHeight: "100dvh",
        background: "#0A0509",
        color: PROTO.textPrimary,
        padding: "48px 24px 64px",
        fontFamily:
          "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, Cantarell, sans-serif",
      }}
    >
      <div style={{ maxWidth: 420, margin: "0 auto", textAlign: "center" }}>
        {/* Minimal mark */}
        <div style={{ fontSize: 18, fontWeight: 700, letterSpacing: "0.08em", color: PROTO.textPrimary }}>
          NE<span style={{ color: PROTO.themeAccent }}>X</span>
        </div>

        {/* Tiny chip */}
        <div
          style={{
            marginTop: 56,
            fontSize: 10,
            letterSpacing: "0.4em",
            textTransform: "uppercase",
            color: PROTO.themeAccent,
            fontWeight: 600,
          }}
        >
          {PROTO.themeName}
        </div>

        {/* Huge single-word hero */}
        <h1
          style={{
            margin: "20px 0 0",
            fontSize: 72,
            fontWeight: 700,
            letterSpacing: "-0.045em",
            lineHeight: 0.92,
            color: PROTO.textPrimary,
          }}
        >
          Your NEX.
        </h1>

        {/* Single supporting line */}
        <p
          style={{
            margin: "22px auto 0",
            maxWidth: 300,
            fontSize: 15,
            lineHeight: 1.55,
            color: PROTO.textSecondary,
            fontWeight: 400,
          }}
        >
          One identity. One atmosphere. Everywhere you show up.
        </p>

        {/* Phone — large, no border, floats */}
        <div style={{ marginTop: 64, display: "flex", justifyContent: "center" }}>
          <div
            style={{
              width: 220,
              height: 440,
              borderRadius: 44,
              background: "#000",
              padding: 8,
              boxShadow: `0 60px 80px -40px ${PROTO.themeAccent}50`,
              position: "relative",
            }}
          >
            <div
              style={{
                position: "absolute",
                top: 10,
                left: "50%",
                transform: "translateX(-50%)",
                width: 70,
                height: 16,
                borderRadius: 999,
                background: "#000",
              }}
            />
            <div
              style={{
                width: "100%",
                height: "100%",
                borderRadius: 36,
                background: `linear-gradient(180deg, ${PROTO.themeAccent} 0%, ${PROTO.themePeach} 100%)`,
                display: "flex",
                alignItems: "flex-end",
                justifyContent: "center",
                padding: 32,
              }}
            >
              <div
                style={{
                  color: "#120A14",
                  fontSize: 28,
                  fontWeight: 700,
                  letterSpacing: "-0.02em",
                  lineHeight: 1,
                }}
              >
                {PROTO.userName}
              </div>
            </div>
          </div>
        </div>

        {/* Change theme — single underlined link */}
        <Link
          href="/nex-native/chat-themes-library"
          style={{
            display: "inline-block",
            marginTop: 40,
            fontSize: 14,
            fontWeight: 500,
            color: PROTO.themeAccent,
            textDecoration: "none",
            borderBottom: `1px solid ${PROTO.themeAccent}66`,
            paddingBottom: 2,
          }}
        >
          Change theme
        </Link>

        {/* Three subtle links */}
        <div
          style={{
            marginTop: 72,
            display: "flex",
            justifyContent: "center",
            gap: 32,
          }}
        >
          {PROTO.navTiles.map((t) => (
            <Link
              key={t.href}
              href={t.href}
              style={{
                textDecoration: "none",
                color: PROTO.textPrimary,
                textAlign: "center",
              }}
            >
              <div style={{ fontSize: 24, opacity: 0.8 }}>{t.emoji}</div>
              <div style={{ marginTop: 10, fontSize: 12, color: PROTO.textSecondary, letterSpacing: "0.04em" }}>{t.title}</div>
            </Link>
          ))}
        </div>

        <Link
          href="/nex-native/home-prototypes"
          style={{
            display: "inline-block",
            marginTop: 72,
            fontSize: 10,
            letterSpacing: "0.3em",
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
