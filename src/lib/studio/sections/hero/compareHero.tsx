// hero.compare_hero_1 — Independent-vs-Corporate Compare Hero.
//
// Positioning hero for independent trades competing with corporate
// chains (British Gas, Homeserve, Dyno-Rod, Domestic & General).
// Renders a side-by-side compare card contrasting "Us" (green ticks)
// with "The chains" (grey crosses). Every row is a real customer
// pain point.
//
// Design principles applied:
//   • Positions the trade against a known-worse alternative
//   • 5-6 rows keeps it scannable, not a wall of text
//   • Green tick / grey cross semantics = universally readable
//   • Merchant edits rows so it fits their trade
//   • Optional "not affiliated with" disclaimer for safety

"use client";

import Link from "next/link";
import { sectionRegistry } from "@/lib/studio/sectionRegistry";
import { sectionRootAttrs, treeAttrs } from "@/lib/studio/treeIds";
import type {
  SectionRegistration,
  SectionRendererProps
} from "@/lib/studio/sectionTypes";

type Config = {
  eyebrow: string;
  heading: string;
  subheading: string;
  usColumnLabel: string;
  themColumnLabel: string;
  row1: string;
  row2: string;
  row3: string;
  row4: string;
  row5: string;
  row6: string;
  primaryCtaLabel: string;
  primaryCtaHref: string;
  disclaimer: string;
};

function CompareHero({
  instanceId,
  config,
  tokens,
  data
}: SectionRendererProps<Config>) {
  const accent = (tokens["color.accent"] as string) ?? "#FFB300";
  const green = "#10B981";
  const bg = "linear-gradient(180deg, #0A0A0A 0%, #141414 100%)";
  const ink = "#FFFFFF";
  const muted = "rgba(255,255,255,0.7)";
  const border = "rgba(255,255,255,0.12)";
  const cardBg = "rgba(255,255,255,0.04)";
  const headingFont = (tokens["font.heading"] as string) ?? "inherit";
  const bodyFont = (tokens["font.body"] as string) ?? "inherit";

  const primaryHref =
    config.primaryCtaHref === "#whatsapp" && data.whatsappHref
      ? data.whatsappHref
      : config.primaryCtaHref;

  const rows = [
    config.row1,
    config.row2,
    config.row3,
    config.row4,
    config.row5,
    config.row6
  ].filter((r) => r && r.trim().length > 0);

  return (
    <section
      className="relative isolate w-full overflow-hidden"
      style={{ background: bg, color: ink, fontFamily: bodyFont }}
      {...sectionRootAttrs(instanceId, "hero.compare_hero_1", "Compare Hero")}
    >
      <div className="mx-auto max-w-5xl px-5 py-16 sm:px-6 sm:py-24">
        {/* Header */}
        <div className="text-center">
          {config.eyebrow && (
            <p
              className="text-[11px] font-extrabold uppercase tracking-[0.28em]"
              style={{ color: accent }}
              {...treeAttrs(instanceId, "eyebrow", "Eyebrow", "text")}
            >
              {config.eyebrow}
            </p>
          )}
          <h1
            className="mt-4 text-4xl font-extrabold leading-[0.95] sm:text-5xl md:text-6xl"
            style={{ fontFamily: headingFont, letterSpacing: "-0.02em" }}
            {...treeAttrs(instanceId, "heading", "Headline", "text")}
          >
            {config.heading}
          </h1>
          {config.subheading && (
            <p
              className="mx-auto mt-5 max-w-2xl text-[15px] leading-relaxed sm:text-[17px]"
              style={{ color: muted }}
              {...treeAttrs(instanceId, "subheading", "Subheading", "text")}
            >
              {config.subheading}
            </p>
          )}
        </div>

        {/* Compare card */}
        <div
          className="mt-10 overflow-hidden rounded-3xl border"
          style={{
            borderColor: border,
            background: cardBg,
            boxShadow: "0 20px 60px rgba(0,0,0,0.4)"
          }}
        >
          {/* Column headers */}
          <div
            className="grid grid-cols-[1fr_120px_120px] items-center gap-3 border-b px-4 py-4 sm:grid-cols-[1fr_160px_160px] sm:px-6"
            style={{ borderColor: border }}
          >
            <span className="text-[10px] font-bold uppercase tracking-[0.24em] text-white/50">
              What matters
            </span>
            <span
              className="text-center text-[11px] font-extrabold uppercase tracking-widest"
              style={{ color: accent }}
              {...treeAttrs(instanceId, "usColumnLabel", "Us column label", "text")}
            >
              {config.usColumnLabel}
            </span>
            <span
              className="text-center text-[11px] font-bold uppercase tracking-widest text-white/45"
              {...treeAttrs(instanceId, "themColumnLabel", "Them column label", "text")}
            >
              {config.themColumnLabel}
            </span>
          </div>

          {/* Rows */}
          <ul className="divide-y" style={{ borderColor: border }}>
            {rows.map((r, i) => (
              <li
                key={i}
                className="grid grid-cols-[1fr_120px_120px] items-center gap-3 border-t px-4 py-4 sm:grid-cols-[1fr_160px_160px] sm:px-6"
                style={{ borderColor: border }}
              >
                <span className="text-[14px] font-semibold text-white">
                  {r}
                </span>
                <span className="flex justify-center">
                  <span
                    className="inline-flex h-8 w-8 items-center justify-center rounded-full"
                    style={{ background: `${green}22` }}
                    aria-label="Yes"
                  >
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke={green} strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                      <path d="M20 6 9 17l-5-5" />
                    </svg>
                  </span>
                </span>
                <span className="flex justify-center">
                  <span
                    className="inline-flex h-8 w-8 items-center justify-center rounded-full"
                    style={{ background: "rgba(255,255,255,0.05)" }}
                    aria-label="No"
                  >
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,0.4)" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                      <path d="M18 6 6 18" />
                      <path d="m6 6 12 12" />
                    </svg>
                  </span>
                </span>
              </li>
            ))}
          </ul>

          {/* CTA row */}
          <div
            className="grid grid-cols-1 border-t px-4 py-6 sm:px-6"
            style={{ borderColor: border }}
          >
            <div className="text-center">
              <Link
                href={primaryHref || "#"}
                className="inline-flex h-14 items-center justify-center gap-2 rounded-xl px-6 text-[13px] font-extrabold uppercase tracking-widest transition active:scale-[0.98]"
                style={{
                  background: accent,
                  color: "#0A0A0A",
                  boxShadow: `0 8px 24px ${accent}55`
                }}
                {...treeAttrs(instanceId, "primaryCtaLabel", "Primary CTA", "button")}
              >
                <span>{config.primaryCtaLabel}</span>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                  <path d="m9 18 6-6-6-6" />
                </svg>
              </Link>
            </div>
          </div>
        </div>

        {config.disclaimer && (
          <p
            className="mt-6 text-center text-[10px] italic text-white/40"
            {...treeAttrs(instanceId, "disclaimer", "Disclaimer", "text")}
          >
            {config.disclaimer}
          </p>
        )}
      </div>
    </section>
  );
}

const registration: SectionRegistration<Config> = {
  id: "hero.compare_hero_1",
  name: "Independent-vs-Corporate Compare Hero",
  version: "1.0.0",
  library: "hero",
  description:
    "Side-by-side comparison hero for independent trades competing with corporate chains. Every row is a real customer pain point solved by using an independent.",
  editableFields: [
    { key: "eyebrow", label: "Eyebrow", type: { kind: "text", maxLength: 60 }, default: "The independent difference", priority: "text", aiPromptable: true, group: "Copy" },
    { key: "heading", label: "Headline", type: { kind: "text", maxLength: 100 }, default: "Why customers leave the big names.", priority: "text", aiPromptable: true, group: "Copy" },
    { key: "subheading", label: "Subheading", type: { kind: "text", maxLength: 200, multiline: true }, default: "Same qualifications, better service, half the drama. Here's what changes when you switch to a local independent.", priority: "text", aiPromptable: true, group: "Copy" },
    { key: "usColumnLabel", label: "Us column label", type: { kind: "text", maxLength: 30 }, default: "Us", priority: "text", group: "Table" },
    { key: "themColumnLabel", label: "Them column label", type: { kind: "text", maxLength: 30 }, default: "The chains", priority: "text", group: "Table" },
    { key: "row1", label: "Row 1", type: { kind: "text", maxLength: 80 }, default: "You get through to a real engineer, not a call centre", group: "Rows" },
    { key: "row2", label: "Row 2", type: { kind: "text", maxLength: 80 }, default: "Fixed price on the phone — no surprise callout fees", group: "Rows" },
    { key: "row3", label: "Row 3", type: { kind: "text", maxLength: 80 }, default: "Same engineer, start to finish", group: "Rows" },
    { key: "row4", label: "Row 4", type: { kind: "text", maxLength: 80 }, default: "No upsell to a service plan you don't need", group: "Rows" },
    { key: "row5", label: "Row 5", type: { kind: "text", maxLength: 80 }, default: "Photos of the job in your inbox, warts and all", group: "Rows" },
    { key: "row6", label: "Row 6", type: { kind: "text", maxLength: 80 }, default: "12-month written guarantee, not fine-print excuses", group: "Rows" },
    { key: "primaryCtaLabel", label: "Primary CTA label", type: { kind: "text", maxLength: 30 }, default: "Switch to us", priority: "button", aiPromptable: true, group: "CTA" },
    { key: "primaryCtaHref", label: "Primary CTA link", type: { kind: "link" }, default: "#whatsapp", group: "CTA" },
    { key: "disclaimer", label: "Disclaimer", type: { kind: "text", maxLength: 200, multiline: true }, default: "Not affiliated with any named provider. Comparison based on published price lists + customer feedback.", priority: "text", group: "Legal" }
  ],
  animations: ["none", "fade-in"],
  aiPrompts: {
    explain: "Explain when the Compare Hero converts best.",
    improve: "Suggest which comparison rows land hardest for this trade.",
    rewrite: "Rewrite the comparison rows for this trade's actual pain points.",
    suggestAlternative: "Which hero would work for a merchant that doesn't want to name competitors?",
    score: "Score this hero on the six standard axes."
  },
  thumbnail: "",
  telemetryTags: ["hero", "compare", "positioning", "independent"],
  bestForVerticals: ["boiler-engineer", "plumber", "electrician", "locksmith", "drainage", "damp-proofing", "glazier"],
  defaultConfig: () => ({
    eyebrow: "The independent difference",
    heading: "Why customers leave the big names.",
    subheading: "Same qualifications, better service, half the drama. Here's what changes when you switch to a local independent.",
    usColumnLabel: "Us",
    themColumnLabel: "The chains",
    row1: "You get through to a real engineer, not a call centre",
    row2: "Fixed price on the phone — no surprise callout fees",
    row3: "Same engineer, start to finish",
    row4: "No upsell to a service plan you don't need",
    row5: "Photos of the job in your inbox, warts and all",
    row6: "12-month written guarantee, not fine-print excuses",
    primaryCtaLabel: "Switch to us",
    primaryCtaHref: "#whatsapp",
    disclaimer: "Not affiliated with any named provider. Comparison based on published price lists + customer feedback."
  }),
  renderer: CompareHero
};

sectionRegistry.register(registration);
