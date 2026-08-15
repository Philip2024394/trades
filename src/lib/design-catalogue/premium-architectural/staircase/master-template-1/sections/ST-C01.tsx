// NEX Design Catalogue · ST-C01 · Four Collection Cards (Philip 2026-08-14).
//
// THIRD section of Master Template 1. Owner-approval gated.
//
// Composition (from tmp-design-reference/golden-reference-01.png):
//   - Centred "OUR COLLECTIONS" eyebrow (tan · tracked uppercase)
//   - Centred serif headline "Find Your Perfect Staircase"
//   - 4 equal-width cards in a row · gap ~24px
//   - Each card:
//       · Photo area (top ~60%) — customer content in production;
//         cream-to-tan gradient placeholder here so the composition is
//         judgeable without fabricated imagery
//       · Circular category badge overlapping the photo/text seam
//         (green / blue / orange / green per reference)
//       · Category name in serif
//       · 2-line caption in muted ink
//
// Placeholder photos — the CONTENT this section renders belongs to the
// customer. For the design-catalogue review we render soft-gradient
// placeholders labelled with the category name so the composition is
// judgeable without any fabricated photo pretending to be that
// customer's real work.

import { MT1_TOKENS as T } from "../tokens";

type CardConfig = {
  slug: "modern" | "traditional" | "industrial" | "bespoke";
  name: string;
  caption: string;
  /** Circular badge background — deliberately varied per reference. */
  badgeColour: string;
  /** Which icon glyph to render inside the badge (fallback when
   *  badgeImage is absent). */
  icon: "layout-grid" | "column" | "brick" | "compass-circle";
  /** Optional badge image URL — when set, renders the transparent PNG
   *  inside the badge circle instead of the SVG icon. Philip 2026-08-14. */
  badgeImage?: string;
  /** Placeholder gradient — used only when photoUrl is absent. */
  photoGradient: string;
  /** Real photo URL. When present, renders the image and hides the
   *  placeholder watermark. Picked from the NEX ImageKit staircase
   *  gallery (a_plus, subject_domain=staircase). */
  photoUrl?: string;
};

const DEFAULT_CARDS: CardConfig[] = [
  {
    slug: "modern",
    name: "Modern",
    caption: "Sleek designs for contemporary homes",
    badgeColour: "#A5BFA1",
    icon: "layout-grid",
    badgeImage: "https://ik.imagekit.io/5vv5pw26q/sadsdsdssdd-removebg-preview.png",
    photoGradient: "linear-gradient(160deg, #F1E7D2 0%, #D8B98A 55%, #B58F5E 100%)",
    photoUrl: "https://ik.imagekit.io/5vv5pw26q/ChatGPT%20Image%20Aug%203,%202026,%2006_09_43%20AM.png"
  },
  {
    slug: "traditional",
    name: "Traditional",
    caption: "Timeless elegance for classic spaces",
    badgeColour: "#8EA3B8",
    icon: "column",
    badgeImage: "https://ik.imagekit.io/5vv5pw26q/sadsdsds-removebg-preview.png",
    photoGradient: "linear-gradient(160deg, #F5EEDC 0%, #E1CFA6 55%, #A9855A 100%)",
    photoUrl: "https://ik.imagekit.io/5vv5pw26q/ChatGPT%20Image%20Aug%201,%202026,%2012_42_43%20AM.png?updatedAt=1785519783075"
  },
  {
    slug: "industrial",
    name: "Industrial",
    caption: "Bold & strong for urban living",
    badgeColour: "#C6906F",
    icon: "brick",
    badgeImage: "https://ik.imagekit.io/5vv5pw26q/sadsd-removebg-preview.png",
    photoGradient: "linear-gradient(160deg, #E9DDC5 0%, #A18871 50%, #4E3F35 100%)",
    photoUrl: "https://ik.imagekit.io/5vv5pw26q/Untitledsxzxzx.png?updatedAt=1786003211213"
  },
  {
    slug: "bespoke",
    name: "Bespoke",
    caption: "Custom made to match your vision",
    badgeColour: "#A5BFA1",
    icon: "compass-circle",
    badgeImage: "https://ik.imagekit.io/5vv5pw26q/sad-removebg-preview.png",
    photoGradient: "linear-gradient(160deg, #F7EED9 0%, #DEC79E 55%, #C9A876 100%)",
    // Swapped 2026-08-14 (was landing-rail image · now full staircase)
    photoUrl: "https://ik.imagekit.io/5vv5pw26q/ChatGPT%20Image%20Aug%2012,%202026,%2006_47_09%20PM.png?updatedAt=1786535244511"
  }
];

type Config = {
  eyebrow?: string;
  headline?: string;
  cards?: CardConfig[];
};

export function STC01({
  eyebrow = "OUR COLLECTIONS",
  headline = "Find Your Perfect Staircase",
  cards = DEFAULT_CARDS
}: Config = {}) {
  return (
    <section
      data-section-id="ST-C01"
      data-master-template="1"
      data-vertical="staircase"
      data-family="premium-architectural"
      style={{
        background: T.color.surface,
        color: T.color.ink,
        fontFamily: T.font.sans,
        // Philip 2026-08-14 · reduced top padding · heading sits close
        // under the trust bar container. Bottom tightened so the
        // fitting service band sits closer to the cards.
        paddingBlock: "clamp(20px, 3vw, 40px) clamp(16px, 2vw, 24px)"
      }}
    >
      <div
        style={{
          maxWidth: 1320,
          margin: "0 auto",
          paddingInline: "clamp(20px, 4vw, 40px)"
        }}
      >
        {/* Header · centred · tightened top margin per Philip 2026-08-14 */}
        <div style={{ textAlign: "center", marginBottom: "clamp(28px, 4vw, 48px)" }}>
          <div
            style={{
              fontSize: 11,
              letterSpacing: "0.28em",
              textTransform: "uppercase",
              color: T.color.accent,
              fontWeight: 600
            }}
          >
            {eyebrow}
          </div>
          <h2
            style={{
              margin: "16px 0 0",
              fontFamily: T.font.serif,
              fontWeight: 400,
              color: T.color.ink,
              fontSize: "clamp(32px, 4.4vw, 56px)",
              lineHeight: 1.1,
              letterSpacing: "-0.01em"
            }}
          >
            {headline}
          </h2>
        </div>

        {/* Card grid */}
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(4, minmax(0, 1fr))",
            gap: "clamp(16px, 2vw, 28px)"
          }}
          className="mt1-collections-grid"
        >
          {cards.map((card) => (
            <article
              key={card.slug}
              data-card-slug={card.slug}
              className="mt1-collection-card"
              style={{
                background: T.color.surfaceCard,
                borderRadius: T.radius.card,
                overflow: "hidden",
                display: "flex",
                flexDirection: "column",
                border: `1px solid ${T.color.hairline}`,
                boxShadow: "0 4px 18px -8px rgba(58, 52, 40, 0.16), 0 1px 3px -1px rgba(58, 52, 40, 0.06)",
                // Philip 2026-08-14 · hover lift · transitions the whole card
                transition: "transform 320ms cubic-bezier(0.22, 1, 0.36, 1), box-shadow 320ms ease"
              }}
            >
              {/* Photo area · real image when photoUrl set, gradient
                  placeholder otherwise (Philip 2026-08-14). */}
              <div
                style={{
                  position: "relative",
                  aspectRatio: "4 / 3",
                  background: card.photoUrl ? "#000" : card.photoGradient,
                  overflow: "hidden"
                }}
              >
                {card.photoUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={card.photoUrl}
                    alt={`${card.name} staircase`}
                    className="mt1-collection-photo"
                    style={{
                      display: "block",
                      width: "100%",
                      height: "100%",
                      objectFit: "cover",
                      // Philip 2026-08-14 · slow ken-burns zoom on card hover
                      transition: "transform 900ms cubic-bezier(0.22, 1, 0.36, 1)"
                    }}
                  />
                ) : (
                  <>
                    <StaircaseLineMotif tone={T.color.surfaceCard} opacity={0.15} />
                    <div
                      style={{
                        position: "absolute",
                        left: 12,
                        top: 12,
                        fontSize: 9,
                        letterSpacing: "0.25em",
                        textTransform: "uppercase",
                        color: "rgba(255,255,255,0.72)",
                        fontWeight: 700
                      }}
                    >
                      {card.name} · Photo
                    </div>
                  </>
                )}
              </div>

              {/* Badge · overlaps the photo/text seam · white circle 60px */}
              <div
                style={{
                  position: "relative",
                  display: "flex",
                  justifyContent: "center",
                  marginTop: -30,
                  marginBottom: 8
                }}
              >
                {card.badgeImage ? (
                  // Philip 2026-08-14 · white circle behind the supplied
                  // badge PNGs · no coloured background.
                  <div
                    aria-hidden
                    style={{
                      width: 60,
                      height: 60,
                      borderRadius: "50%",
                      background: "#FFFFFF",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      overflow: "hidden",
                      boxShadow: "0 4px 12px -4px rgba(58, 52, 40, 0.18)"
                    }}
                  >
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={card.badgeImage}
                      alt=""
                      style={{ width: "78%", height: "78%", objectFit: "contain" }}
                    />
                  </div>
                ) : (
                  <div
                    aria-hidden
                    style={{
                      width: 56,
                      height: 56,
                      borderRadius: "50%",
                      background: card.badgeColour,
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      color: "#FFFFFF",
                      overflow: "hidden",
                      boxShadow: `0 4px 12px -4px rgba(0,0,0,0.15), 0 0 0 4px ${T.color.surfaceCard}`
                    }}
                  >
                    <CardIcon slug={card.icon} />
                  </div>
                )}
              </div>

              {/* Name + caption · centred */}
              <div
                style={{
                  padding: "6px 20px 28px",
                  textAlign: "center"
                }}
              >
                <h3
                  style={{
                    margin: "0 0 8px",
                    fontFamily: T.font.serif,
                    fontWeight: 500,
                    fontSize: "clamp(18px, 1.5vw, 22px)",
                    color: T.color.ink,
                    letterSpacing: "-0.005em"
                  }}
                >
                  {card.name}
                </h3>
                <p
                  style={{
                    margin: 0,
                    fontSize: 13,
                    lineHeight: 1.5,
                    color: T.color.inkMuted
                  }}
                >
                  {card.caption}
                </p>
              </div>
            </article>
          ))}
        </div>
      </div>

      <style>{`
        @media (max-width: 980px) {
          .mt1-collections-grid { grid-template-columns: repeat(2, minmax(0, 1fr)) !important; gap: 12px !important; }
        }
        /* Philip 2026-08-14 · card hover lift + slow image ken-burns */
        .mt1-collection-card:hover {
          transform: translateY(-6px);
          box-shadow: 0 20px 40px -18px rgba(58, 52, 40, 0.28), 0 6px 14px -6px rgba(58, 52, 40, 0.10);
        }
        .mt1-collection-card:hover .mt1-collection-photo {
          transform: scale(1.06);
        }
        @media (prefers-reduced-motion: reduce) {
          .mt1-collection-card, .mt1-collection-photo { transition: none !important; }
          .mt1-collection-card:hover { transform: none !important; }
          .mt1-collection-card:hover .mt1-collection-photo { transform: none !important; }
        }
      `}</style>
    </section>
  );
}

// ── Card badge icons (24×24, currentColor stroke) ────────────────────

function CardIcon({ slug }: { slug: CardConfig["icon"] }) {
  const props = { width: 24, height: 24, viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: 1.6, strokeLinecap: "round" as const, strokeLinejoin: "round" as const, "aria-hidden": true };
  switch (slug) {
    case "layout-grid":
      return (
        <svg {...props}>
          <rect x="4" y="4" width="7" height="7" rx="1.2" />
          <rect x="13" y="4" width="7" height="7" rx="1.2" />
          <rect x="4" y="13" width="7" height="7" rx="1.2" />
          <rect x="13" y="13" width="7" height="7" rx="1.2" />
        </svg>
      );
    case "column":
      return (
        <svg {...props}>
          <path d="M8 4h8" />
          <path d="M9 4v16" />
          <path d="M15 4v16" />
          <path d="M8 20h8" />
          <path d="M11 4v16" />
          <path d="M13 4v16" />
        </svg>
      );
    case "brick":
      return (
        <svg {...props}>
          <rect x="3" y="4" width="7" height="6" rx="0.6" />
          <rect x="10" y="4" width="11" height="6" rx="0.6" />
          <rect x="3" y="10" width="11" height="6" rx="0.6" />
          <rect x="14" y="10" width="7" height="6" rx="0.6" />
          <rect x="3" y="16" width="7" height="4" rx="0.6" />
          <rect x="10" y="16" width="11" height="4" rx="0.6" />
        </svg>
      );
    case "compass-circle":
      return (
        <svg {...props}>
          <circle cx="12" cy="12" r="8.5" />
          <path d="M4 12h16" />
        </svg>
      );
  }
}

// A very light staircase-line motif over the placeholder gradient.
// Purely decorative; disappears in production when a real photo is supplied.
function StaircaseLineMotif({ tone, opacity }: { tone: string; opacity: number }) {
  return (
    <svg
      width="100%"
      height="100%"
      viewBox="0 0 100 75"
      preserveAspectRatio="none"
      aria-hidden
      style={{ position: "absolute", inset: 0 }}
    >
      <g stroke={tone} strokeWidth="0.6" fill="none" opacity={opacity}>
        {/* Diagonal stepped rise */}
        <path d="M10 65 L25 65 L25 55 L40 55 L40 45 L55 45 L55 35 L70 35 L70 25 L85 25 L85 15" />
        {/* Supporting rail line */}
        <path d="M10 62 L85 12" strokeDasharray="1.5 2" />
      </g>
    </svg>
  );
}
