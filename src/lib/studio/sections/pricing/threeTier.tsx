// pricing.three_tier_1 — 3-column pricing cards.
//
// Classic tier-comparison pattern. Each column has a name, price +
// period, one-line pitch, comma-separated feature list, and its own CTA
// button. Middle tier can be flagged as "most popular" — visually
// lifted + coloured for anchor pricing effect. Best for trades that
// package call-outs (standard / urgent / emergency), maintenance
// contracts (monthly), or annual services (basic / standard / premium).

import Link from "next/link";
import { sectionRegistry } from "@/lib/studio/sectionRegistry";
import { sectionRootAttrs, treeAttrs } from "@/lib/studio/treeIds";
import type {
  SectionRegistration,
  SectionRendererProps
} from "@/lib/studio/sectionTypes";

type Slot = 1 | 2 | 3;

type Config = {
  eyebrow: string;
  heading: string;
  t1Name: string; t1Price: string; t1Period: string; t1Body: string; t1Features: string; t1CtaLabel: string; t1CtaHref: string; t1Popular: boolean;
  t2Name: string; t2Price: string; t2Period: string; t2Body: string; t2Features: string; t2CtaLabel: string; t2CtaHref: string; t2Popular: boolean;
  t3Name: string; t3Price: string; t3Period: string; t3Body: string; t3Features: string; t3CtaLabel: string; t3CtaHref: string; t3Popular: boolean;
};

function PricingThreeTier({
  instanceId,
  config,
  tokens,
  data,
  mode
}: SectionRendererProps<Config>) {
  const accent = (tokens["color.accent"] as string | undefined) ?? "#FFB300";
  const surface = (tokens["color.surface"] as string | undefined) ?? "#FFFFFF";
  const text = (tokens["color.text"] as string | undefined) ?? "#0A0A0A";
  const muted = (tokens["color.muted"] as string | undefined) ?? "#737373";
  const headingFont = tokens["font.heading"] as string | undefined;
  const bodyFont = tokens["font.body"] as string | undefined;
  const headingWeight = tokens["font.heading.weight"] as number | undefined;
  const bodyWeight = tokens["font.body.weight"] as number | undefined;
  const isEditing = mode === "edit";

  type Tier = {
    i: Slot;
    name: string; price: string; period: string;
    body: string; features: string;
    ctaLabel: string; ctaHref: string;
    popular: boolean;
  };
  const tiers: Tier[] = [
    { i: 1, name: config.t1Name, price: config.t1Price, period: config.t1Period, body: config.t1Body, features: config.t1Features, ctaLabel: config.t1CtaLabel, ctaHref: config.t1CtaHref, popular: config.t1Popular },
    { i: 2, name: config.t2Name, price: config.t2Price, period: config.t2Period, body: config.t2Body, features: config.t2Features, ctaLabel: config.t2CtaLabel, ctaHref: config.t2CtaHref, popular: config.t2Popular },
    { i: 3, name: config.t3Name, price: config.t3Price, period: config.t3Period, body: config.t3Body, features: config.t3Features, ctaLabel: config.t3CtaLabel, ctaHref: config.t3CtaHref, popular: config.t3Popular }
  ];

  const resolveHref = (href: string) =>
    href === "#whatsapp" && data.whatsappHref ? data.whatsappHref : href;

  return (
    <section
      className="w-full"
      style={{ background: surface, color: text }}
      {...sectionRootAttrs(instanceId, "pricing.three_tier_1", "Pricing")}
    >
      <div className="mx-auto max-w-6xl px-4 py-14 sm:px-6 sm:py-20">
        <div className="text-center">
          {config.eyebrow && (
            <p
              className="text-[11px] font-extrabold uppercase tracking-[0.22em]"
              style={{ color: accent }}
              {...treeAttrs(instanceId, "eyebrow", "Small kicker", "text")}
            >
              {config.eyebrow}
            </p>
          )}
          {config.heading && (
            <h2
              className="mt-2 text-3xl leading-tight sm:text-4xl"
              style={{ fontFamily: headingFont, fontWeight: headingWeight ?? 800 }}
              {...treeAttrs(instanceId, "heading", "Main headline", "text")}
            >
              {config.heading}
            </h2>
          )}
        </div>

        <ul className="mt-10 grid grid-cols-1 items-stretch gap-4 md:grid-cols-3">
          {tiers.map((t) => {
            const features = t.features
              .split(",")
              .map((s) => s.trim())
              .filter(Boolean);
            const highlight = t.popular;
            return (
              <li key={t.i}>
                <div
                  className="relative flex h-full flex-col gap-4 rounded-2xl border p-5 shadow-sm transition"
                  style={{
                    background: highlight ? "#0A0A0A" : "#FFFFFF",
                    color: highlight ? "#FFFFFF" : text,
                    borderColor: highlight ? "#0A0A0A" : "#E5E5E5",
                    transform: highlight ? "translateY(-6px)" : "none"
                  }}
                >
                  {highlight && (
                    <span
                      className="absolute -top-3 left-1/2 -translate-x-1/2 rounded-full px-3 py-1 text-[9px] font-extrabold uppercase tracking-widest text-neutral-900 shadow-sm"
                      style={{ background: accent }}
                    >
                      Most popular
                    </span>
                  )}
                  <p
                    className="text-[11px] font-extrabold uppercase tracking-widest"
                    style={{ color: highlight ? accent : muted }}
                    {...treeAttrs(instanceId, `t${t.i}Name`, `Tier ${t.i} name`, "text")}
                  >
                    {t.name}
                  </p>
                  <div className="flex items-end gap-2">
                    <p
                      className="text-3xl leading-none"
                      style={{
                        fontFamily: headingFont,
                        fontWeight: headingWeight ?? 800,
                        color: highlight ? "#FFFFFF" : text
                      }}
                      {...treeAttrs(instanceId, `t${t.i}Price`, `Tier ${t.i} price`, "text")}
                    >
                      {t.price}
                    </p>
                    <p
                      className="mb-1 text-[11px] font-bold uppercase tracking-widest"
                      style={{ color: highlight ? "rgba(255,255,255,0.65)" : muted }}
                      {...treeAttrs(instanceId, `t${t.i}Period`, `Tier ${t.i} period`, "text")}
                    >
                      {t.period}
                    </p>
                  </div>
                  <p
                    className="text-[13px] leading-relaxed"
                    style={{
                      color: highlight ? "rgba(255,255,255,0.75)" : muted,
                      fontFamily: bodyFont,
                      fontWeight: bodyWeight ?? 500
                    }}
                    {...treeAttrs(instanceId, `t${t.i}Body`, `Tier ${t.i} pitch`, "text")}
                  >
                    {t.body}
                  </p>
                  <ul
                    className="mt-1 space-y-1.5 text-[12px] leading-snug"
                    {...treeAttrs(instanceId, `t${t.i}Features`, `Tier ${t.i} features`, "text")}
                  >
                    {features.map((f, idx) => (
                      <li key={idx} className="flex items-start gap-2">
                        <span style={{ color: accent }} aria-hidden="true">
                          ✓
                        </span>
                        <span>{f}</span>
                      </li>
                    ))}
                  </ul>
                  {t.ctaLabel && (
                    <Link
                      href={resolveHref(t.ctaHref) || "#"}
                      tabIndex={isEditing ? -1 : undefined}
                      className="mt-auto inline-flex h-11 items-center justify-center rounded-xl px-4 text-[12px] font-extrabold uppercase tracking-widest transition hover:brightness-95"
                      style={{
                        background: highlight ? accent : "#0A0A0A",
                        color: highlight ? "#0A0A0A" : "#FFFFFF"
                      }}
                      {...treeAttrs(instanceId, `t${t.i}CtaLabel`, `Tier ${t.i} button`, "button")}
                    >
                      {t.ctaLabel} →
                    </Link>
                  )}
                </div>
              </li>
            );
          })}
        </ul>
      </div>
    </section>
  );
}

const tierFields = (
  i: Slot,
  name: string,
  price: string,
  period: string,
  body: string,
  features: string,
  cta: string,
  popular: boolean
) => [
  { key: `t${i}Name`, label: `Tier ${i} name`, type: { kind: "text" as const, maxLength: 30 }, default: name, priority: "text" as const, group: `Tier ${i}` },
  { key: `t${i}Price`, label: `Tier ${i} price`, type: { kind: "text" as const, maxLength: 20 }, default: price, priority: "text" as const, group: `Tier ${i}` },
  { key: `t${i}Period`, label: `Tier ${i} period`, type: { kind: "text" as const, maxLength: 20 }, default: period, priority: "text" as const, description: 'e.g. "/ hour", "/ month", "callout"', group: `Tier ${i}` },
  { key: `t${i}Body`, label: `Tier ${i} pitch`, type: { kind: "text" as const, maxLength: 140, multiline: true }, default: body, priority: "text" as const, aiPromptable: true, group: `Tier ${i}` },
  { key: `t${i}Features`, label: `Tier ${i} features (comma-separated)`, type: { kind: "text" as const, maxLength: 300, multiline: true }, default: features, priority: "text" as const, aiPromptable: true, description: "Feature 1, Feature 2, Feature 3 …", group: `Tier ${i}` },
  { key: `t${i}CtaLabel`, label: `Tier ${i} button text`, type: { kind: "text" as const, maxLength: 24 }, default: cta, priority: "button" as const, group: `Tier ${i}` },
  { key: `t${i}CtaHref`, label: `Tier ${i} button link`, type: { kind: "link" as const, allowInternal: true, allowExternal: true }, default: "#whatsapp", group: `Tier ${i}` },
  { key: `t${i}Popular`, label: `Mark Tier ${i} as "Most popular"`, type: { kind: "boolean" as const }, default: popular, group: `Tier ${i}` }
];

const registration: SectionRegistration<Config> = {
  id: "pricing.three_tier_1",
  name: "3-tier pricing",
  version: "1.0.0",
  library: "pricing",
  description:
    "Three pricing cards side-by-side, middle one optionally lifted as \"most popular\". Comma-separated features become tick lists. Best for trades that package callout tiers, service plans, or maintenance contracts.",
  editableFields: [
    { key: "eyebrow", label: "Small kicker", type: { kind: "text", maxLength: 40 }, default: "Simple pricing", priority: "text", group: "Header" },
    { key: "heading", label: "Main headline", type: { kind: "text", maxLength: 120 }, default: "Three ways to work with us.", priority: "text", aiPromptable: true, group: "Header" },
    ...tierFields(1, "Standard", "£75", "/ hour", "Non-emergency work, booked within 3-5 working days.", "Free quote, Free callout, 12-month workmanship guarantee", "Book standard", false),
    ...tierFields(2, "Urgent", "£120", "/ hour", "Same-day response across our catchment. First priority in the diary.", "Priority slot, Same-day arrival, 12-month workmanship guarantee, WhatsApp updates", "Request urgent", true),
    ...tierFields(3, "Emergency", "£175", "callout", "24/7 line. Out-of-hours + weekend rate. First hour + travel included.", "24/7 arrival, First hour + travel included, 24-month workmanship guarantee, Direct line", "Call now", false)
  ],
  animations: ["none", "fade", "stagger"],
  aiPrompts: {
    explain: "Explain why 3-tier pricing helps a UK trade merchant. Reference the specific tier names and prices.",
    improve: "Improve without layout change. Tier names under 3 words, pitches under 20 words, exactly 3-4 features per tier. Return only patched config.",
    rewrite: "Rewrite tier pitches in a {tone} voice. Prices stay factual.",
    suggestAlternative: "Suggest an alternative pricing layout from library='pricing'. One-sentence rationale.",
    score: "Score across 6 dimensions. JSON only."
  },
  thumbnail: "https://ik.imagekit.io/9mrgsv2rp/studio/thumbnails/pricing-three-tier-1.png",
  scoreHints: {
    loading: { imageWeightBudgetKb: 0 },
    accessibility: { contrastMin: 4.5 },
    sales: { primaryActionRequired: true, socialProofRecommended: false },
    seo: { headingLevel: 2 },
    mobile: { minTapTargetPx: 44 },
    brandConsistency: { boundTokens: ["color.accent", "color.surface", "color.text"] }
  },
  telemetryTags: ["pricing", "three_tier", "callout_pricing", "middle_popular", "feature_list"],
  bestForVerticals: ["plumbing", "electrical", "hvac", "boiler_repair", "locksmith", "drain_clearance", "handyman"],
  defaultConfig: () => ({
    eyebrow: "Simple pricing",
    heading: "Three ways to work with us.",
    t1Name: "Standard", t1Price: "£75", t1Period: "/ hour", t1Body: "Non-emergency work, booked within 3-5 working days.", t1Features: "Free quote, Free callout, 12-month workmanship guarantee", t1CtaLabel: "Book standard", t1CtaHref: "#whatsapp", t1Popular: false,
    t2Name: "Urgent", t2Price: "£120", t2Period: "/ hour", t2Body: "Same-day response across our catchment. First priority in the diary.", t2Features: "Priority slot, Same-day arrival, 12-month workmanship guarantee, WhatsApp updates", t2CtaLabel: "Request urgent", t2CtaHref: "#whatsapp", t2Popular: true,
    t3Name: "Emergency", t3Price: "£175", t3Period: "callout", t3Body: "24/7 line. Out-of-hours + weekend rate. First hour + travel included.", t3Features: "24/7 arrival, First hour + travel included, 24-month workmanship guarantee, Direct line", t3CtaLabel: "Call now", t3CtaHref: "#whatsapp", t3Popular: false
  }),
  renderer: PricingThreeTier
};

sectionRegistry.register(registration);
