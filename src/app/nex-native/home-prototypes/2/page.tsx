import Link from "next/link";
import { PROTO } from "../_mock";

// Prototype 02 · Editorial Magazine
// Vogue-cover energy. Massive serif-feel display headline, slim phone inset
// to the right, numbered design row along the bottom. Caption-styled nav.

export default function HomePrototype2() {
  return (
    <main
      style={{
        minHeight: "100dvh",
        background: "#FAF2F7",
        color: "#120A14",
        fontFamily: "'Playfair Display', Georgia, 'Times New Roman', serif",
      }}
    >
      <div style={{ maxWidth: 440, margin: "0 auto", padding: "24px 24px 48px" }}>
        {/* Header */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            paddingBottom: 14,
            borderBottom: `1px solid ${PROTO.themeAccent}44`,
          }}
        >
          <div style={{ fontSize: 10, letterSpacing: "0.4em", textTransform: "uppercase", fontWeight: 700, color: PROTO.themeAccent }}>
            Issue 01 · {PROTO.themeName}
          </div>
          <div style={{ fontSize: 10, letterSpacing: "0.2em", textTransform: "uppercase", color: "#120A14" }}>
            {new Date().toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" })}
          </div>
        </div>

        {/* Masthead headline */}
        <div style={{ marginTop: 28 }}>
          <div style={{ fontSize: 11, letterSpacing: "0.3em", textTransform: "uppercase", color: "#6E4157", fontWeight: 600 }}>
            Welcome back, {PROTO.userName}
          </div>
          <h1
            style={{
              margin: "8px 0 0",
              fontSize: 84,
              fontWeight: 900,
              letterSpacing: "-0.045em",
              lineHeight: 0.88,
              color: PROTO.themeAccent,
              fontStyle: "italic",
            }}
          >
            Pink<br />
            <span style={{ color: "#120A14", fontStyle: "normal" }}>Dream</span>
          </h1>
          <div
            style={{
              marginTop: 16,
              fontSize: 13.5,
              lineHeight: 1.6,
              color: "#4A2E3B",
              fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
              maxWidth: 320,
            }}
          >
            A world painted in rose. Your identity, your chat, and everything you
            make share one atmosphere — the one you chose.
          </div>
          <Link
            href="/nex-native/chat-themes-library"
            style={{
              marginTop: 16,
              display: "inline-block",
              fontSize: 10,
              letterSpacing: "0.3em",
              textTransform: "uppercase",
              fontWeight: 700,
              color: PROTO.themeAccent,
              borderBottom: `2px solid ${PROTO.themeAccent}`,
              paddingBottom: 2,
              textDecoration: "none",
              fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
            }}
          >
            Change the atmosphere →
          </Link>
        </div>

        {/* Slanted phone inset */}
        <div style={{ marginTop: 36, display: "flex", justifyContent: "center" }}>
          <div
            style={{
              width: 220,
              height: 440,
              borderRadius: 32,
              background: "#120A14",
              border: `2px solid ${PROTO.themeAccent}`,
              boxShadow: `18px 18px 0 ${PROTO.themeAccent}22, 36px 36px 60px rgba(255,79,165,0.3)`,
              transform: "rotate(-3deg)",
              padding: 10,
              overflow: "hidden",
            }}
          >
            <div
              style={{
                height: "100%",
                borderRadius: 22,
                background: `linear-gradient(170deg, ${PROTO.themeAccent}, ${PROTO.themePeach})`,
                padding: 20,
                display: "flex",
                flexDirection: "column",
                justifyContent: "space-between",
                color: "#120A14",
              }}
            >
              <div style={{ fontSize: 10, letterSpacing: "0.3em", textTransform: "uppercase", fontWeight: 700, fontFamily: "-apple-system, sans-serif" }}>
                Live cover
              </div>
              <div
                style={{
                  fontSize: 36,
                  fontWeight: 900,
                  lineHeight: 0.95,
                  letterSpacing: "-0.03em",
                  fontStyle: "italic",
                }}
              >
                Philip&apos;s<br />NEX
              </div>
              <div style={{ fontSize: 11, fontFamily: "-apple-system, sans-serif", opacity: 0.75 }}>
                Open · chat · shop · everything.
              </div>
            </div>
          </div>
        </div>

        {/* Numbered design row */}
        <div
          style={{
            marginTop: 36,
            paddingTop: 20,
            borderTop: `1px solid ${PROTO.themeAccent}44`,
            fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
          }}
        >
          <div
            style={{
              fontSize: 10,
              letterSpacing: "0.3em",
              textTransform: "uppercase",
              fontWeight: 700,
              color: PROTO.themeAccent,
              marginBottom: 12,
            }}
          >
            In this issue
          </div>
          <div style={{ display: "grid", gap: 10 }}>
            {PROTO.slides.map((s, i) => (
              <Link
                key={s.id}
                href={`/nex-native/cover/preview/${s.kind.toLowerCase()}`}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 14,
                  padding: "12px 2px",
                  borderBottom: "1px solid rgba(18,10,20,0.1)",
                  textDecoration: "none",
                  color: "#120A14",
                }}
              >
                <div style={{ fontFamily: "'Playfair Display', serif", fontSize: 32, fontWeight: 900, color: PROTO.themeAccent, letterSpacing: "-0.04em", fontStyle: "italic" }}>
                  {String(i + 1).padStart(2, "0")}
                </div>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 14, fontWeight: 600 }}>{s.label}</div>
                  <div style={{ fontSize: 11, color: "#6E4157" }}>Preview this cover layout</div>
                </div>
                <div style={{ color: PROTO.themeAccent }}>→</div>
              </Link>
            ))}
          </div>
        </div>

        {/* Nav as caption strip */}
        <div
          style={{
            marginTop: 24,
            display: "grid",
            gridTemplateColumns: "repeat(3, 1fr)",
            gap: 14,
            paddingTop: 20,
            borderTop: `1px solid ${PROTO.themeAccent}44`,
            fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
          }}
        >
          {PROTO.navTiles.map((t) => (
            <Link
              key={t.href}
              href={t.href}
              style={{
                textDecoration: "none",
                color: "#120A14",
                textAlign: "center",
              }}
            >
              <div style={{ fontSize: 26, lineHeight: 1 }}>{t.emoji}</div>
              <div style={{ marginTop: 8, fontSize: 11, fontWeight: 700, letterSpacing: "0.14em", textTransform: "uppercase" }}>{t.title}</div>
              <div style={{ marginTop: 2, fontSize: 10, color: "#6E4157" }}>{t.caption}</div>
            </Link>
          ))}
        </div>

        <Link
          href="/nex-native/home-prototypes"
          style={{
            display: "block",
            marginTop: 32,
            textAlign: "center",
            fontSize: 10,
            letterSpacing: "0.3em",
            textTransform: "uppercase",
            color: "#6E4157",
            textDecoration: "none",
            fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
          }}
        >
          ← back to prototypes
        </Link>
      </div>
    </main>
  );
}
