// "use client" · nav links use onMouseEnter/onMouseLeave for hover tint.

"use client";

// NEX Design Catalogue · ST-F01 · Signature + Heritage Footer
// (Philip 2026-08-14 · hybrid of brainstorm options 1 + 6).
//
// Composition:
//   Row 1  · big serif wordmark left · 3-column nav right
//   Row 2  · heritage signature strip · flourish + credentials line,
//            centred between hairlines
//   Row 3  · slim bottom bar · copyright + legal
//
// Palette · deep warm brown for visual finality, warm-white text,
// tan accents. Mobile stacks columns cleanly; signature row keeps its
// prominence with thin dividers.

import { MT1_TOKENS as T } from "../tokens";

type Credential = { label: string; short?: string };
type SocialLink = { label: string; href: string; icon: "facebook" | "instagram" | "tiktok" };

type Config = {
  brandName?: string;
  brandStrapline?: string;
  heritageLead?: string;
  credentials?: Credential[];
  socials?: SocialLink[];
  poweredBy?: string;
  poweredByHref?: string;
  rightsLine?: string;
};

const DEFAULTS: Required<Config> = {
  brandName:       "Summit",
  brandStrapline:  "Staircase Solutions",
  heritageLead:    "Handmade in the UK · Est. 1998",
  credentials: [
    { label: "BWF Stair Scheme" },
    { label: "FMB Member" },
    { label: "TrustMark Registered" }
  ],
  socials: [
    { label: "Facebook",  href: "#facebook",  icon: "facebook"  },
    { label: "Instagram", href: "#instagram", icon: "instagram" },
    { label: "TikTok",    href: "#tiktok",    icon: "tiktok"    }
  ],
  poweredBy:     "asknexapp.com",
  poweredByHref: "https://asknexapp.com",
  rightsLine:    "All Rights Reserved"
};

export function STF01(props: Config = {}) {
  const c = { ...DEFAULTS, ...props };

  const bgDark         = "#2A241C";
  const inkOnDark      = "#F5EBDA";
  const inkMutedOnDark = "#C4B69F";
  const inkFaintOnDark = "#8A7B62";
  const hairlineOnDark = "rgba(245, 235, 218, 0.12)";

  return (
    <footer
      data-section-id="ST-F01"
      data-master-template="1"
      data-vertical="staircase"
      data-family="premium-architectural"
      style={{
        background: bgDark,
        color: inkOnDark,
        fontFamily: T.font.sans,
        paddingBlock: "clamp(40px, 5vw, 72px) 0"
      }}
    >
      <div
        style={{
          maxWidth: 1320,
          margin: "0 auto",
          paddingInline: "clamp(20px, 4vw, 40px)"
        }}
      >
        {/* ── ROW 1 · wordmark only (nav + contact removed per
              Philip 2026-08-14 · signature imprint centred). ───────── */}
        <div
          style={{
            display: "flex",
            justifyContent: "center",
            paddingBottom: "clamp(28px, 4vw, 48px)"
          }}
          className="mt1-footer-top"
        >
          <a
            href="#top"
            aria-label={`${c.brandName} — back to top`}
            className="mt1-footer-brand"
            style={{
              display: "inline-flex",
              flexDirection: "column",
              alignItems: "center",
              textDecoration: "none",
              color: inkOnDark,
              lineHeight: 1
            }}
          >
            <span
              style={{
                fontFamily: T.font.serif,
                fontWeight: 400,
                fontSize: "clamp(48px, 5.4vw, 84px)",
                letterSpacing: "-0.02em",
                color: inkOnDark
              }}
            >
              {c.brandName}
            </span>
            <span
              style={{
                fontSize: 11,
                letterSpacing: "0.28em",
                textTransform: "uppercase",
                color: inkFaintOnDark,
                marginTop: 12,
                fontWeight: 600
              }}
            >
              {c.brandStrapline}
            </span>
          </a>
        </div>

        {/* Social icons · under the wordmark · Facebook / Instagram / TikTok */}
        {c.socials.length > 0 && (
          <div
            style={{
              display: "flex",
              justifyContent: "center",
              gap: 10,
              paddingBottom: "clamp(24px, 4vw, 40px)"
            }}
          >
            {c.socials.map((s) => (
              <a
                key={s.label}
                href={s.href}
                aria-label={s.label}
                target="_blank"
                rel="noopener noreferrer"
                style={{
                  width: 42,
                  height: 42,
                  borderRadius: 10,
                  border: `1px solid ${hairlineOnDark}`,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  color: inkOnDark,
                  textDecoration: "none",
                  transition: "border-color 120ms, color 120ms, transform 120ms"
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.borderColor = T.color.accent;
                  e.currentTarget.style.color = T.color.accent;
                  e.currentTarget.style.transform = "translateY(-2px)";
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.borderColor = hairlineOnDark;
                  e.currentTarget.style.color = inkOnDark;
                  e.currentTarget.style.transform = "translateY(0)";
                }}
              >
                <SocialIcon slug={s.icon} />
              </a>
            ))}
          </div>
        )}

        {/* ── ROW 2 · heritage signature strip ────────────────────── */}
        <div
          style={{
            borderTop: `1px solid ${hairlineOnDark}`,
            borderBottom: `1px solid ${hairlineOnDark}`,
            paddingBlock: "clamp(22px, 3vw, 32px)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            gap: "clamp(14px, 2vw, 26px)",
            flexWrap: "wrap"
          }}
          className="mt1-footer-heritage"
        >
          <Flourish tone={T.color.accent} side="left" />
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: "clamp(10px, 1.6vw, 22px)",
              flexWrap: "wrap",
              justifyContent: "center",
              fontSize: 12,
              color: inkMutedOnDark,
              letterSpacing: "0.02em"
            }}
          >
            <span style={{ fontFamily: T.font.serif, fontStyle: "italic", fontSize: 15, color: inkOnDark }}>
              {c.heritageLead}
            </span>
            {c.credentials.map((cr, i) => (
              <span key={cr.label} style={{ display: "inline-flex", alignItems: "center", gap: 8 }}>
                <span aria-hidden style={{ width: 4, height: 4, borderRadius: "50%", background: T.color.accent, opacity: 0.75 }} />
                {cr.short ?? cr.label}
              </span>
            ))}
          </div>
          <Flourish tone={T.color.accent} side="right" />
        </div>

        {/* ── ROW 3 · slim bottom bar · Powered By + Back-to-top + Rights ── */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            gap: 16,
            flexWrap: "wrap",
            paddingBlock: "clamp(20px, 2.4vw, 28px) clamp(28px, 4vw, 40px)",
            fontSize: 12,
            color: inkFaintOnDark
          }}
          className="mt1-footer-bottom"
        >
          <div>
            Powered By{" "}
            <a
              href={c.poweredByHref}
              target="_blank"
              rel="noopener noreferrer"
              style={{ color: inkOnDark, textDecoration: "none", fontWeight: 600 }}
            >
              {c.poweredBy}
            </a>
          </div>

          <a
            href="#top"
            aria-label="Back to top"
            className="mt1-footer-top-btn"
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: 8,
              padding: "8px 14px",
              borderRadius: 999,
              border: `1px solid ${hairlineOnDark}`,
              color: inkMutedOnDark,
              textDecoration: "none",
              fontSize: 11.5,
              letterSpacing: "0.14em",
              textTransform: "uppercase",
              fontWeight: 600,
              transition: "border-color 140ms, color 140ms"
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.borderColor = T.color.accent;
              e.currentTarget.style.color = inkOnDark;
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.borderColor = hairlineOnDark;
              e.currentTarget.style.color = inkMutedOnDark;
            }}
          >
            <svg
              width={12}
              height={12}
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth={2}
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden
            >
              <path d="m6 15 6-6 6 6" />
            </svg>
            Back to top
          </a>

          <div>{c.rightsLine}</div>
        </div>
      </div>

      <style>{`
        @media (max-width: 900px) {
          .mt1-footer-top {
            grid-template-columns: 1fr 1fr !important;
            row-gap: 40px !important;
          }
          .mt1-footer-brand { grid-column: 1 / -1 !important; }
        }
        @media (max-width: 560px) {
          .mt1-footer-top { grid-template-columns: 1fr !important; }
          .mt1-footer-brand { grid-column: auto !important; }
          .mt1-footer-bottom {
            justify-content: flex-start !important;
            flex-direction: column;
            align-items: flex-start !important;
            gap: 10px !important;
          }
        }
      `}</style>
    </footer>
  );
}

/* ── Sub-components ─────────────────────────────────────────────── */

/**
 * Signature flourish · a subtle hand-drawn curl in tan. Mirrored on
 * left and right of the heritage strip. Kept simple so it reads as an
 * editorial ornament, not a piece of clip-art.
 */
function Flourish({ tone, side }: { tone: string; side: "left" | "right" }) {
  const flip = side === "right" ? "scale(-1, 1)" : "";
  return (
    <svg
      width="72"
      height="14"
      viewBox="0 0 72 14"
      fill="none"
      aria-hidden
      style={{ transform: flip, opacity: 0.85 }}
    >
      <path
        d="M2 7 Q 18 -1, 34 7 T 66 7"
        stroke={tone}
        strokeWidth="1"
        strokeLinecap="round"
        fill="none"
      />
      <circle cx="70" cy="7" r="1.5" fill={tone} />
    </svg>
  );
}

function SocialIcon({ slug }: { slug: SocialLink["icon"] }) {
  const props = {
    width: 18, height: 18, viewBox: "0 0 24 24",
    fill: "none", stroke: "currentColor",
    strokeWidth: 1.6,
    strokeLinecap: "round" as const,
    strokeLinejoin: "round" as const,
    "aria-hidden": true
  };
  switch (slug) {
    case "facebook":
      return (
        <svg {...props}>
          <path d="M18 3h-3a4 4 0 0 0-4 4v3H8v4h3v7h4v-7h3l1-4h-4V7a1 1 0 0 1 1-1h3V3Z" />
        </svg>
      );
    case "instagram":
      return (
        <svg {...props}>
          <rect x="3" y="3" width="18" height="18" rx="5" />
          <circle cx="12" cy="12" r="4" />
          <circle cx="17.5" cy="6.5" r="0.8" fill="currentColor" stroke="none" />
        </svg>
      );
    case "tiktok":
      return (
        <svg {...props}>
          <path d="M14 3v11a3.5 3.5 0 1 1-3.5-3.5" />
          <path d="M14 3c.6 2.7 2.4 4.5 5 5" />
        </svg>
      );
  }
}

