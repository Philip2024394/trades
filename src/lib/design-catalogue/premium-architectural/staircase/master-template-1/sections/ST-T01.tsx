// NEX Design Catalogue · ST-T01 · Five-Point Trust Bar (Philip 2026-08-14).
//
// SECOND section of Master Template 1. Owner-approval gated: nothing
// else gets built until Philip approves.
//
// Composition (from tmp-design-reference/golden-reference-01.png):
//   - White rounded card, generous horizontal padding.
//   - 5 equal columns: icon + title + micro-caption.
//   - Thin hairline dividers between columns (not around the outer edge).
//   - The card OVERLAPS the hero/collections seam — pulled up 60-90px
//     via negative margin-top on the outer section. Below the card the
//     section provides cream backdrop that becomes the top of the
//     collections region.
//
// Load-bearing detail: the OVERLAP is the visual stitch. It's what turns
// three rectangles (hero → trust → collections) into one composition
// instead of three panels. Do not remove the negative-margin without
// designing an equivalent stitch.

import { MT1_TOKENS as T } from "../tokens";

type PillarConfig = {
  title: string;
  /** One of the built-in icon slugs below. */
  icon: "shield-check" | "diamond" | "compass" | "layout-grid" | "headset" | "wood-plank";
};

type Config = {
  pillars?: PillarConfig[];
};

// Philip 2026-08-14 · single-word titles · icon on top, text under
// (2 rows per pillar: icon row + text row).
const DEFAULT_PILLARS: PillarConfig[] = [
  { icon: "wood-plank",  title: "Materials" },
  { icon: "layout-grid", title: "Gallery" },
  { icon: "compass",     title: "Designs" }
];

export function STT01({ pillars = DEFAULT_PILLARS }: Config = {}) {
  return (
    <section
      data-section-id="ST-T01"
      data-master-template="1"
      data-vertical="staircase"
      data-family="premium-architectural"
      className="mt1-trust-section"
      style={{
        background: T.color.surface,
        color: T.color.ink,
        fontFamily: T.font.sans,
        paddingBlock: "clamp(20px, 4vw, 72px) clamp(20px, 4vw, 72px)",
        position: "relative",
        zIndex: 2
      }}
    >
      <div
        style={{
          maxWidth: 1320,
          margin: "0 auto",
          paddingInline: "clamp(20px, 4vw, 40px)"
        }}
      >
        <div
          role="list"
          aria-label="Materials, gallery, designs"
          style={{
            background: T.color.surfaceCard,
            // Philip 2026-08-14 · landscape container, square corners.
            borderRadius: 0,
            boxShadow: T.shadow.softCard,
            display: "grid",
            gridTemplateColumns: "repeat(3, minmax(0, 1fr))",
            alignItems: "center",
            paddingBlock: "clamp(20px, 2.4vw, 32px)",
            paddingInline: "clamp(16px, 2vw, 24px)"
          }}
          className="mt1-trust-row"
        >
          {pillars.map((p, i) => (
            <div
              key={p.title}
              role="listitem"
              style={{
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                justifyContent: "center",
                gap: 10,
                paddingInline: "clamp(8px, 1.4vw, 20px)",
                borderInlineStart: i === 0 ? "none" : `1px solid ${T.color.hairline}`,
                textAlign: "center"
              }}
              className={`mt1-trust-pillar mt1-trust-pillar--${i}`}
            >
              <div
                aria-hidden
                style={{
                  width: 40,
                  height: 40,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  color: T.color.accent,
                  flexShrink: 0
                }}
              >
                <PillarIcon slug={p.icon} />
              </div>

              <div
                style={{
                  fontSize: 13,
                  fontWeight: 700,
                  color: T.color.ink,
                  lineHeight: 1.2,
                  letterSpacing: "-0.005em",
                  whiteSpace: "nowrap"
                }}
              >
                {p.title}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Responsive collapse — on narrow viewports the 5-column row
          becomes a 2-column grid, then a single column, without losing
          the card treatment or the overlap. Dividers are suppressed on
          the wrap rows so the borders don't look orphaned. */}
      <style>{`
        /* Card sits 15% onto the hero image (Philip 2026-08-14) · the
           inner card is translated up by 15% of its own height so the
           top 15% overlaps the hero. Works at every viewport. */
        .mt1-trust-row { transform: translateY(-10%); }
        @media (min-width: 720px) {
          .mt1-trust-section { margin-top: 0; padding-block: 0 clamp(48px, 8vw, 96px); }
        }
        /* Philip 2026-08-14 · 3-in-a-row at every viewport including
           mobile. Dividers stay. Padding tightens for narrow screens. */
        @media (max-width: 720px) {
          .mt1-trust-row {
            padding-block: 16px !important;
            padding-inline: 8px !important;
          }
        }
        @media (max-width: 380px) {
          .mt1-trust-pillar { padding-inline: 4px !important; }
        }
      `}</style>
    </section>
  );
}

// Inlined so the <style> tag's template literal above can interpolate
// without React re-parsing token access on every render.
const MT1_HAIRLINE = T.color.hairline;

// ── Icon glyphs · 1px outlined · tan tint via currentColor ──────────

function PillarIcon({ slug }: { slug: PillarConfig["icon"] }) {
  const props = { width: 28, height: 28, viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: 1.4, strokeLinecap: "round" as const, strokeLinejoin: "round" as const, "aria-hidden": true };
  switch (slug) {
    case "shield-check":
      return (
        <svg {...props}>
          <path d="M12 3 4 6v6c0 5 3.5 8.5 8 9 4.5-.5 8-4 8-9V6l-8-3Z" />
          <path d="m9 12 2 2 4-4" />
        </svg>
      );
    case "diamond":
      return (
        <svg {...props}>
          <path d="M6 3h12l3 5-9 13L3 8Z" />
          <path d="M6 3 9 8h6l3-5" />
          <path d="M9 8h6" />
        </svg>
      );
    case "compass":
      return (
        <svg {...props}>
          <circle cx="12" cy="12" r="9" />
          <path d="m14.5 9.5-2.5 6-3.5 1.5 1.5-3.5 6-2.5Z" />
        </svg>
      );
    case "layout-grid":
      return (
        <svg {...props}>
          <rect x="3.5" y="3.5" width="7" height="7" rx="1.5" />
          <rect x="13.5" y="3.5" width="7" height="7" rx="1.5" />
          <rect x="3.5" y="13.5" width="7" height="7" rx="1.5" />
          <rect x="13.5" y="13.5" width="7" height="7" rx="1.5" />
        </svg>
      );
    case "headset":
      return (
        <svg {...props}>
          <path d="M4 13v-1a8 8 0 0 1 16 0v1" />
          <rect x="3" y="13" width="4" height="7" rx="1.5" />
          <rect x="17" y="13" width="4" height="7" rx="1.5" />
          <path d="M20 20a4 4 0 0 1-4 4h-2" />
        </svg>
      );
    case "wood-plank":
      // Stack of oak planks · Materials icon.
      return (
        <svg {...props}>
          <rect x="3.5" y="5.5" width="17" height="4" rx="1" />
          <rect x="3.5" y="10.5" width="17" height="4" rx="1" />
          <rect x="3.5" y="15.5" width="17" height="4" rx="1" />
          <path d="M7 5.5v4" opacity="0.55" />
          <path d="M13 5.5v4" opacity="0.55" />
          <path d="M17 5.5v4" opacity="0.55" />
          <path d="M6 10.5v4" opacity="0.55" />
          <path d="M11 10.5v4" opacity="0.55" />
          <path d="M15.5 10.5v4" opacity="0.55" />
          <path d="M8 15.5v4" opacity="0.55" />
          <path d="M14 15.5v4" opacity="0.55" />
          <path d="M18 15.5v4" opacity="0.55" />
        </svg>
      );
  }
}
