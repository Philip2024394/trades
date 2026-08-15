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

type NavLink = { label: string; href: string };
type Credential = { label: string; short?: string };
type SocialLink = { label: string; href: string; icon: "facebook" | "instagram" | "tiktok" };

type Config = {
  brandName?: string;
  brandStrapline?: string;
  exploreNav?: NavLink[];
  companyNav?: NavLink[];
  contactAddress?: string;
  contactPhone?: string;
  contactEmail?: string;
  heritageLead?: string;
  credentials?: Credential[];
  socials?: SocialLink[];
  poweredBy?: string;
  poweredByHref?: string;
  rightsLine?: string;
  legalLinks?: NavLink[];
};

const DEFAULTS: Required<Config> = {
  brandName:       "Summit",
  brandStrapline:  "Staircase Solutions",
  exploreNav: [
    { label: "Styles",     href: "#styles"    },
    { label: "Materials",  href: "#materials" },
    { label: "Gallery",    href: "#gallery"   },
    { label: "Process",    href: "#process"   }
  ],
  companyNav: [
    { label: "About Us",   href: "#about"     },
    { label: "Craftsmen",  href: "#team"      },
    { label: "Testimonials", href: "#reviews" },
    { label: "Careers",    href: "#careers"   }
  ],
  contactAddress: "The Workshop · Old Mill Lane · Manchester M1 4AZ",
  contactPhone:   "+44 161 000 0000",
  contactEmail:   "hello@summit-staircases.example",
  heritageLead:   "Handmade in Manchester · Est. 1998",
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
  rightsLine:    "All Rights Reserved",
  legalLinks: []
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
            href="#home"
            aria-label={`${c.brandName} — home`}
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

        {/* ── ROW 3 · slim bottom bar · Powered By + All Rights ────── */}
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

function FooterNavColumn({
  title,
  links,
  accent,
  inkMuted,
  inkFaint
}: {
  title: string;
  links: NavLink[];
  accent: string;
  inkMuted: string;
  inkFaint: string;
}) {
  return (
    <div style={{ minWidth: 0 }}>
      <div style={{ fontSize: 11, letterSpacing: "0.22em", textTransform: "uppercase", color: inkFaint, fontWeight: 700, marginBottom: 18 }}>
        {title}
      </div>
      <ul style={{ listStyle: "none", margin: 0, padding: 0, display: "flex", flexDirection: "column", gap: 12 }}>
        {links.map((l) => (
          <li key={l.href}>
            <a
              href={l.href}
              style={{ color: inkMuted, textDecoration: "none", fontSize: 13.5, transition: "color 120ms" }}
              onMouseEnter={(e) => { e.currentTarget.style.color = accent; }}
              onMouseLeave={(e) => { e.currentTarget.style.color = inkMuted; }}
            >
              {l.label}
            </a>
          </li>
        ))}
      </ul>
    </div>
  );
}

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

function FooterIcon({ slug, tone }: { slug: "map-pin" | "phone" | "mail"; tone: string }) {
  const props = { width: 16, height: 16, viewBox: "0 0 24 24", fill: "none", stroke: tone, strokeWidth: 1.5, strokeLinecap: "round" as const, strokeLinejoin: "round" as const, "aria-hidden": true, style: { flexShrink: 0, marginTop: 2 } };
  switch (slug) {
    case "map-pin":
      return (
        <svg {...props}>
          <path d="M12 21c-4-4-7-7-7-11a7 7 0 0 1 14 0c0 4-3 7-7 11Z" />
          <circle cx="12" cy="10" r="2.5" />
        </svg>
      );
    case "phone":
      return (
        <svg {...props}>
          <path d="M22 16.9v3a2 2 0 0 1-2.2 2 19.8 19.8 0 0 1-8.6-3.1 19.5 19.5 0 0 1-6-6A19.8 19.8 0 0 1 2.1 4.2 2 2 0 0 1 4.1 2h3a2 2 0 0 1 2 1.7c.1.9.3 1.8.6 2.6a2 2 0 0 1-.5 2.1L8 9.6a16 16 0 0 0 6 6l1.2-1.2a2 2 0 0 1 2.1-.5c.8.3 1.7.5 2.6.6a2 2 0 0 1 1.7 2Z" />
        </svg>
      );
    case "mail":
      return (
        <svg {...props}>
          <rect x="3" y="5" width="18" height="14" rx="2" />
          <path d="m3 7 9 7 9-7" />
        </svg>
      );
  }
}
