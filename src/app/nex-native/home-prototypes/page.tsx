import Link from "next/link";

const PROTOTYPES = [
  {
    n: 1,
    name: "Cinematic Showcase",
    tag: "Hollywood poster",
    desc: "Full-bleed theme glow · phone floats at centre · huge name mark · nav as pills.",
  },
  {
    n: 2,
    name: "Editorial Magazine",
    tag: "Vogue cover",
    desc: "Oversized display headline · phone slanted inset · numbered design row · caption-styled nav.",
  },
  {
    n: 3,
    name: "Control Center",
    tag: "Live dashboard",
    desc: "Two-column grid · status tiles · quick-action grid · phone as live preview.",
  },
  {
    n: 4,
    name: "Minimalist Zen",
    tag: "Apple-quiet",
    desc: "Centred single column · tiny chip · huge h1 · phone · underlined links · nothing else.",
  },
];

export default function HomePrototypesIndex() {
  return (
    <main
      style={{
        minHeight: "100dvh",
        background: "#06040A",
        color: "#F2F5F8",
        padding: "32px 20px 48px",
        fontFamily:
          "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, Cantarell, sans-serif",
      }}
    >
      <div style={{ maxWidth: 540, margin: "0 auto" }}>
        <div
          style={{
            fontSize: 10,
            letterSpacing: "0.2em",
            textTransform: "uppercase",
            color: "#7D9BC0",
            fontWeight: 700,
          }}
        >
          /nex-native/home-prototypes
        </div>
        <h1 style={{ margin: "8px 0 6px", fontSize: 28, fontWeight: 600 }}>
          Home · four directions.
        </h1>
        <p style={{ margin: 0, color: "#9DB4CF", fontSize: 14, lineHeight: 1.55 }}>
          Four distinct world-class takes on the home screen. All use Pink Dream
          mock data so you can compare apples to apples. Tap one to open.
        </p>

        <div style={{ marginTop: 26, display: "grid", gap: 14 }}>
          {PROTOTYPES.map((p) => (
            <Link
              key={p.n}
              href={`/nex-native/home-prototypes/${p.n}`}
              style={{
                display: "block",
                padding: "18px 20px",
                borderRadius: 14,
                background: "#0E1420",
                border: "1px solid rgba(255,79,165,0.3)",
                boxShadow: "0 0 0 1px rgba(255,79,165,0.08), 0 10px 28px rgba(0,0,0,0.4)",
                textDecoration: "none",
                color: "#F2F5F8",
              }}
            >
              <div
                style={{
                  display: "flex",
                  alignItems: "baseline",
                  justifyContent: "space-between",
                  gap: 12,
                }}
              >
                <div style={{ fontSize: 10, color: "#FF4FA5", fontWeight: 700, letterSpacing: "0.14em", textTransform: "uppercase" }}>
                  Prototype {String(p.n).padStart(2, "0")}
                </div>
                <div style={{ fontSize: 10, color: "#B38EA2", letterSpacing: "0.08em", textTransform: "uppercase" }}>
                  {p.tag}
                </div>
              </div>
              <div style={{ marginTop: 6, fontSize: 19, fontWeight: 600, letterSpacing: "-0.005em" }}>
                {p.name}
              </div>
              <div style={{ marginTop: 6, fontSize: 12.5, color: "#9DB4CF", lineHeight: 1.5 }}>
                {p.desc}
              </div>
            </Link>
          ))}
        </div>

        <p style={{ marginTop: 32, fontSize: 11, color: "#7D9BC0", textAlign: "center", lineHeight: 1.5 }}>
          Prototypes render static mock data. Real theme / user / slide data lives
          in the production route at <code>/nex-native/home</code>.
        </p>
      </div>
    </main>
  );
}
