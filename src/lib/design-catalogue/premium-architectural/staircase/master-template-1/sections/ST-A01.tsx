// NEX Design Catalogue · ST-A01 · Craftsmanship + Statistics + Enquiry.
// (Philip 2026-08-14 · fifth section of Master Template 1.)
//
// "use client" · the enquiry form has an onSubmit handler.

"use client";

// ST-A01 is a SPLIT composition. Left column carries the brand story,
// stat quad, and a decorative anchor. Right column carries the enquiry
// form (ST-Q01) as an inline module. When we later want ST-Q01 on its
// own (e.g. a dedicated Contact page), the form gets extracted into its
// own file; for now it lives inline so the visual composition stays as
// one file that's easy to review.
//
// Composition (from tmp-design-reference/golden-reference-01.png):
//   - Section sits on a warm-cream card that visually feels distinct
//     from the page cream by a shade — it's the "chapter break" before
//     the footer.
//   - Left column ~55% · decorative flourish + editorial heading (roman
//     + italic tan) + short story paragraph + 4-stat quad (2x2).
//   - Right column ~45% · white/near-white form panel with heading +
//     subtitle + 4 form fields + solid tan submit CTA.

import { MT1_TOKENS as T } from "../tokens";

type StatConfig = {
  icon: "bar-rise" | "ribbon" | "heart" | "user";
  value: string;
  label: string;
};

const DEFAULT_STATS: StatConfig[] = [
  { icon: "bar-rise", value: "500+", label: "Projects Completed" },
  { icon: "ribbon",   value: "15+",  label: "Years Experience"  },
  { icon: "heart",    value: "98%",  label: "Customer Satisfaction" },
  { icon: "user",     value: "20+",  label: "Skilled Craftsmen" }
];

type Config = {
  headlineTop?: string;
  headlineBottom?: string;
  storyCopy?: string;
  stats?: StatConfig[];
  formHeadline?: string;
  formSubtitle?: string;
  formCtaLabel?: string;
};

const DEFAULTS: Required<Config> = {
  headlineTop: "Where Craftsmanship",
  headlineBottom: "Meets Innovation",
  storyCopy: "We combine traditional techniques with modern innovation to create staircases that are as functional as they are beautiful.",
  stats: DEFAULT_STATS,
  formHeadline: "Let's Build Something Beautiful",
  formSubtitle: "Get your free, no-obligation quote today.",
  formCtaLabel: "Get Your Free Quote"
};

export function STA01(props: Config = {}) {
  const c = { ...DEFAULTS, ...props };

  return (
    <section
      data-section-id="ST-A01"
      data-master-template="1"
      data-vertical="staircase"
      data-family="premium-architectural"
      style={{
        background: T.color.surface,
        color: T.color.ink,
        fontFamily: T.font.sans,
        paddingBlock: T.spacing.sectionPaddingBlock
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
          style={{
            background: T.color.surfaceSoft,      // warm cream chapter-break card
            borderRadius: T.radius.card,
            padding: "clamp(28px, 4vw, 56px)",
            display: "grid",
            alignItems: "center",
            gridTemplateColumns: "minmax(0, 1.15fr) minmax(0, 1fr)",
            gap: "clamp(28px, 4vw, 56px)"
          }}
          className="mt1-craft-grid"
        >
          {/* ── LEFT · craftsmanship + stats ───────────────────────── */}
          <div style={{ minWidth: 0, display: "grid", gridTemplateColumns: "auto minmax(0, 1fr)", gap: "clamp(16px, 2.4vw, 32px)", alignItems: "start" }} className="mt1-craft-left">
            {/* Decorative flourish column · vase + botanical outline */}
            <div
              aria-hidden
              style={{ width: 92, flexShrink: 0, display: "flex", justifyContent: "center" }}
              className="mt1-craft-decor"
            >
              <BotanicalFlourish tone={T.color.accent} inkTone={T.color.inkFaint} />
            </div>

            {/* Copy + stats column */}
            <div style={{ minWidth: 0 }}>
              <h2
                style={{
                  margin: 0,
                  fontFamily: T.font.serif,
                  fontWeight: 400,
                  color: T.color.ink,
                  fontSize: "clamp(32px, 3.6vw, 52px)",
                  lineHeight: 1.05,
                  letterSpacing: "-0.01em"
                }}
              >
                <span style={{ display: "block" }}>{c.headlineTop}</span>
                <span style={{ display: "block", fontStyle: "italic", color: T.color.accent, marginTop: 4 }}>
                  {c.headlineBottom}
                </span>
              </h2>

              <p
                style={{
                  margin: "24px 0 0",
                  maxWidth: 480,
                  fontSize: 15,
                  lineHeight: 1.65,
                  color: T.color.inkMuted
                }}
              >
                {c.storyCopy}
              </p>

              {/* 4-stat quad · 2x2 */}
              <div
                style={{
                  marginTop: "clamp(28px, 3.6vw, 44px)",
                  display: "grid",
                  gridTemplateColumns: "repeat(2, minmax(0, 1fr))",
                  gap: "clamp(16px, 2vw, 28px)"
                }}
                className="mt1-craft-stats"
              >
                {c.stats.map((s) => (
                  <div key={s.label} style={{ display: "grid", gridTemplateColumns: "auto minmax(0, 1fr)", gap: 14, alignItems: "center" }}>
                    <div
                      aria-hidden
                      style={{
                        width: 40,
                        height: 40,
                        color: T.color.accent,
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        flexShrink: 0
                      }}
                    >
                      <StatIcon slug={s.icon} />
                    </div>
                    <div style={{ minWidth: 0 }}>
                      <div style={{ fontFamily: T.font.serif, fontSize: "clamp(24px, 2.4vw, 32px)", color: T.color.ink, lineHeight: 1, fontWeight: 500 }}>
                        {s.value}
                      </div>
                      <div style={{ fontSize: 12, color: T.color.inkMuted, marginTop: 6, lineHeight: 1.35 }}>
                        {s.label}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* ── RIGHT · enquiry form (ST-Q01 embedded) ─────────────── */}
          <div
            data-section-id="ST-Q01"
            style={{
              background: T.color.surfaceCard,
              borderRadius: T.radius.card,
              padding: "clamp(24px, 3vw, 40px)",
              boxShadow: T.shadow.softCard
            }}
            className="mt1-craft-form"
          >
            <div style={{ marginBottom: 20 }}>
              <h3
                style={{
                  margin: 0,
                  fontFamily: T.font.sans,
                  fontWeight: 700,
                  color: T.color.ink,
                  fontSize: "clamp(20px, 1.9vw, 26px)",
                  letterSpacing: "-0.01em"
                }}
              >
                {c.formHeadline}
              </h3>
              <p style={{ margin: "8px 0 0", fontSize: 13, color: T.color.inkMuted }}>
                {c.formSubtitle}
              </p>
            </div>

            {/* Form is inert in the design catalogue — mutations wire
                onSubmit when the template is instantiated for a real
                business. */}
            <form
              onSubmit={(e) => e.preventDefault()}
              style={{ display: "grid", gap: 12 }}
            >
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }} className="mt1-form-row">
                <FormField placeholder="Your Name"    name="name"  type="text"  />
                <FormField placeholder="Phone Number" name="phone" type="tel"   />
              </div>
              <FormField placeholder="Email Address"          name="email"   type="email" />
              <FormField placeholder="Tell us about your project" name="message" type="textarea" />

              <button
                type="submit"
                style={{
                  marginTop: 6,
                  padding: "14px 20px",
                  background: T.color.accent,
                  color: "#FFFFFF",
                  border: "none",
                  borderRadius: T.radius.button,
                  fontWeight: 600,
                  fontSize: 14,
                  letterSpacing: "0.02em",
                  cursor: "pointer",
                  display: "inline-flex",
                  alignItems: "center",
                  justifyContent: "center",
                  gap: 10,
                  boxShadow: "0 10px 24px -12px rgba(181, 143, 94, 0.6)"
                }}
              >
                {c.formCtaLabel}
                <svg width={14} height={14} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.25} strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                  <path d="m9 18 6-6-6-6" />
                </svg>
              </button>
            </form>
          </div>
        </div>
      </div>

      <style>{`
        @media (max-width: 900px) {
          .mt1-craft-grid { grid-template-columns: 1fr !important; }
          .mt1-craft-decor { display: none !important; }
        }
        @media (max-width: 560px) {
          .mt1-craft-stats { grid-template-columns: 1fr !important; }
          .mt1-form-row { grid-template-columns: 1fr !important; }
        }
        .mt1-form-input:focus { outline: none; border-color: ${T.color.accent} !important; box-shadow: 0 0 0 3px rgba(181,143,94,0.15) !important; }
      `}</style>
    </section>
  );
}

// ── Form field · inline so ST-Q01 stays visually consistent ──────────

function FormField({ placeholder, name, type }: { placeholder: string; name: string; type: "text" | "email" | "tel" | "textarea" }) {
  const common = {
    name,
    placeholder,
    className: "mt1-form-input",
    style: {
      width: "100%",
      padding: "14px 16px",
      fontSize: 14,
      fontFamily: T.font.sans,
      color: T.color.ink,
      background: T.color.surfaceSoft,
      border: `1px solid ${T.color.hairline}`,
      borderRadius: T.radius.button,
      transition: "border-color 120ms, box-shadow 120ms",
      resize: "vertical" as const
    }
  };
  if (type === "textarea") return <textarea rows={4} {...common} />;
  return <input type={type} {...common} />;
}

// ── Icons ────────────────────────────────────────────────────────────

function StatIcon({ slug }: { slug: StatConfig["icon"] }) {
  const props = { width: 28, height: 28, viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: 1.4, strokeLinecap: "round" as const, strokeLinejoin: "round" as const, "aria-hidden": true };
  switch (slug) {
    case "bar-rise":
      return (
        <svg {...props}>
          <path d="M4 20h16" />
          <path d="M7 20V15" />
          <path d="M11 20V11" />
          <path d="M15 20V7" />
          <path d="M19 20V4" />
          <path d="m6 12 5-4 4 3 5-6" strokeDasharray="1.5 1.5" />
        </svg>
      );
    case "ribbon":
      return (
        <svg {...props}>
          <circle cx="12" cy="9" r="5.5" />
          <path d="M9 13 6.5 20l3.5-2 2 2 2-2 3.5 2L15 13" />
        </svg>
      );
    case "heart":
      return (
        <svg {...props}>
          <path d="M12 20s-7-4.4-7-10a4 4 0 0 1 7-2.6A4 4 0 0 1 19 10c0 5.6-7 10-7 10Z" />
        </svg>
      );
    case "user":
      return (
        <svg {...props}>
          <circle cx="12" cy="8.5" r="3.6" />
          <path d="M5 20a7 7 0 0 1 14 0" />
        </svg>
      );
  }
}

function BotanicalFlourish({ tone, inkTone }: { tone: string; inkTone: string }) {
  return (
    <svg width="76" height="240" viewBox="0 0 76 240" fill="none" aria-hidden>
      {/* stems */}
      <g stroke={inkTone} strokeWidth="1" strokeLinecap="round" fill="none">
        <path d="M38 240 Q40 180 34 120 Q28 70 40 40" />
        <path d="M38 240 Q42 200 48 170 Q52 140 46 100" />
        <path d="M38 240 Q34 200 28 170 Q24 140 30 100" />
      </g>
      {/* leaves · tan */}
      <g fill={tone} opacity="0.55">
        <ellipse cx="46" cy="140" rx="10" ry="5" transform="rotate(-30 46 140)" />
        <ellipse cx="30" cy="140" rx="10" ry="5" transform="rotate(30 30 140)" />
        <ellipse cx="48" cy="110" rx="10" ry="5" transform="rotate(-45 48 110)" />
        <ellipse cx="28" cy="110" rx="10" ry="5" transform="rotate(45 28 110)" />
        <ellipse cx="46" cy="80" rx="9" ry="4" transform="rotate(-40 46 80)" />
        <ellipse cx="30" cy="80" rx="9" ry="4" transform="rotate(40 30 80)" />
      </g>
      {/* small blossoms */}
      <g fill={tone} opacity="0.75">
        <circle cx="40" cy="46" r="3" />
        <circle cx="44" cy="52" r="2.5" />
        <circle cx="36" cy="52" r="2.5" />
      </g>
      {/* vase */}
      <g fill={tone} opacity="0.18" stroke={tone} strokeWidth="1">
        <path d="M26 232 Q24 200 30 190 Q38 186 46 190 Q52 200 50 232 Z" />
      </g>
    </svg>
  );
}
