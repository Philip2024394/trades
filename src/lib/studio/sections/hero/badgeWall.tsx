// hero.badge_wall_1 — Accreditation Badge Wall Hero.
//
// Trust-first hero for regulated trades: gas, electrical, structural,
// scaffolding, roofing, boiler engineers. Renders a wall of 8-12
// accreditation badges as physical-feeling embossed cards. The
// merchant's copy sits alongside; the badge wall does the talking.
//
// Design principles applied:
//   • Trust badges as first-class visual, not tiny footer noise
//   • Embossed / metallic finish — reads as "official"
//   • Configurable badge count (8, 10, or 12) with graceful fallback
//   • Each badge shows label + tier (Registered / Certified / Approved)
//   • Optional link on each badge to the registrar's verification page

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
  primaryCtaLabel: string;
  primaryCtaHref: string;
  supportingCopy: string;
  badge1Name: string;
  badge1Tier: string;
  badge1Number: string;
  badge2Name: string;
  badge2Tier: string;
  badge2Number: string;
  badge3Name: string;
  badge3Tier: string;
  badge3Number: string;
  badge4Name: string;
  badge4Tier: string;
  badge4Number: string;
  badge5Name: string;
  badge5Tier: string;
  badge5Number: string;
  badge6Name: string;
  badge6Tier: string;
  badge6Number: string;
  badge7Name: string;
  badge7Tier: string;
  badge7Number: string;
  badge8Name: string;
  badge8Tier: string;
  badge8Number: string;
};

function BadgeWallHero({
  instanceId,
  config,
  tokens,
  data
}: SectionRendererProps<Config>) {
  const accent = (tokens["color.accent"] as string) ?? "#FFB300";
  const bg = "linear-gradient(180deg, #0A0A0A 0%, #141414 100%)";
  const ink = "#FFFFFF";
  const muted = "rgba(255,255,255,0.72)";
  const headingFont = (tokens["font.heading"] as string) ?? "inherit";
  const bodyFont = (tokens["font.body"] as string) ?? "inherit";

  const primaryHref =
    config.primaryCtaHref === "#whatsapp" && data.whatsappHref
      ? data.whatsappHref
      : config.primaryCtaHref;

  const badges = [
    { name: config.badge1Name, tier: config.badge1Tier, number: config.badge1Number },
    { name: config.badge2Name, tier: config.badge2Tier, number: config.badge2Number },
    { name: config.badge3Name, tier: config.badge3Tier, number: config.badge3Number },
    { name: config.badge4Name, tier: config.badge4Tier, number: config.badge4Number },
    { name: config.badge5Name, tier: config.badge5Tier, number: config.badge5Number },
    { name: config.badge6Name, tier: config.badge6Tier, number: config.badge6Number },
    { name: config.badge7Name, tier: config.badge7Tier, number: config.badge7Number },
    { name: config.badge8Name, tier: config.badge8Tier, number: config.badge8Number }
  ].filter((b) => b.name?.trim().length > 0);

  return (
    <section
      className="relative isolate w-full overflow-hidden"
      style={{ background: bg, color: ink, fontFamily: bodyFont }}
      {...sectionRootAttrs(instanceId, "hero.badge_wall_1", "Badge Wall Hero")}
    >
      <div className="mx-auto grid max-w-6xl grid-cols-1 gap-10 px-5 py-16 sm:px-6 lg:grid-cols-[1fr_1.2fr] lg:items-center lg:gap-14 lg:py-24">
        {/* LEFT — copy */}
        <div>
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
            className="mt-3 text-4xl font-extrabold leading-[0.95] sm:text-5xl lg:text-6xl"
            style={{ fontFamily: headingFont, letterSpacing: "-0.02em" }}
            {...treeAttrs(instanceId, "heading", "Headline", "text")}
          >
            {config.heading}
          </h1>
          {config.subheading && (
            <p
              className="mt-5 max-w-md text-[15px] leading-relaxed sm:text-[17px]"
              style={{ color: muted }}
              {...treeAttrs(instanceId, "subheading", "Subheading", "text")}
            >
              {config.subheading}
            </p>
          )}
          <Link
            href={primaryHref || "#"}
            className="mt-8 inline-flex h-14 items-center justify-center gap-2 rounded-xl px-6 text-[13px] font-extrabold uppercase tracking-widest transition active:scale-[0.98]"
            style={{
              background: accent,
              color: "#0A0A0A",
              boxShadow: `0 8px 24px ${accent}55`
            }}
            {...treeAttrs(instanceId, "primaryCtaLabel", "Primary CTA", "button")}
          >
            <span>{config.primaryCtaLabel}</span>
          </Link>
          {config.supportingCopy && (
            <p
              className="mt-4 text-[11px] font-bold uppercase tracking-[0.22em] text-white/50"
              {...treeAttrs(instanceId, "supportingCopy", "Supporting copy", "text")}
            >
              {config.supportingCopy}
            </p>
          )}
        </div>

        {/* RIGHT — badge wall */}
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
          {badges.map((b, i) => (
            <BadgeCard
              key={i}
              name={b.name}
              tier={b.tier}
              number={b.number}
              accent={accent}
            />
          ))}
        </div>
      </div>
    </section>
  );
}

function BadgeCard({
  name,
  tier,
  number,
  accent
}: {
  name: string;
  tier: string;
  number: string;
  accent: string;
}) {
  return (
    <div
      className="relative flex flex-col items-center gap-2 rounded-2xl border p-3 text-center transition hover:brightness-110"
      style={{
        borderColor: "rgba(255,255,255,0.1)",
        background:
          "linear-gradient(180deg, rgba(255,255,255,0.06) 0%, rgba(255,255,255,0.02) 100%)",
        boxShadow:
          "0 1px 0 rgba(255,255,255,0.05) inset, 0 12px 32px rgba(0,0,0,0.4)",
        minHeight: 120
      }}
    >
      {/* Emblem — hexagonal shield */}
      <div
        className="relative flex h-14 w-14 items-center justify-center"
        style={{
          background: `conic-gradient(from 45deg, ${accent}44, ${accent}22, ${accent}44)`,
          clipPath: "polygon(50% 0%, 100% 25%, 100% 75%, 50% 100%, 0% 75%, 0% 25%)"
        }}
      >
        <div
          className="flex h-11 w-11 items-center justify-center"
          style={{
            background: "#0A0A0A",
            clipPath: "polygon(50% 0%, 100% 25%, 100% 75%, 50% 100%, 0% 75%, 0% 25%)"
          }}
        >
          <svg width="20" height="20" viewBox="0 0 24 24" fill={accent} aria-hidden="true">
            <path d="M12 2L4 5v6c0 5 3.5 9.5 8 11 4.5-1.5 8-6 8-11V5l-8-3zM10.8 16 7 12.2l1.4-1.4 2.4 2.4 5.4-5.4L17.6 9l-6.8 7z" />
          </svg>
        </div>
      </div>

      <p
        className="mt-1 text-[11px] font-extrabold uppercase tracking-widest text-white"
      >
        {name}
      </p>
      {tier && (
        <p className="text-[9px] font-bold uppercase tracking-widest" style={{ color: accent }}>
          {tier}
        </p>
      )}
      {number && (
        <p className="font-mono text-[10px] text-white/50">{number}</p>
      )}
    </div>
  );
}

const registration: SectionRegistration<Config> = {
  id: "hero.badge_wall_1",
  name: "Accreditation Badge Wall Hero",
  version: "1.0.0",
  library: "hero",
  description:
    "Trust-first hero for regulated trades. Renders up to 8 accreditation badges as embossed metallic emblems. Perfect for gas, electrical, structural, roofing.",
  editableFields: [
    { key: "eyebrow", role: "eyebrow",label: "Eyebrow", type: { kind: "text", maxLength: 60 }, default: "Registered · Certified · Insured", priority: "text", aiPromptable: true, group: "Copy" },
    { key: "heading", role: "headline",label: "Headline", type: { kind: "text", maxLength: 100 }, default: "The credentials to back the work.", priority: "text", aiPromptable: true, group: "Copy" },
    { key: "subheading", role: "subhead",label: "Subheading", type: { kind: "text", maxLength: 200, multiline: true }, default: "Every accreditation on this wall is live, checkable and current. Ask us for the certificate — we send it before we come out.", priority: "text", aiPromptable: true, group: "Copy" },
    { key: "primaryCtaLabel", role: "primary_action_label",label: "Primary CTA label", type: { kind: "text", maxLength: 30 }, default: "Get a quote", priority: "button", aiPromptable: true, group: "CTAs" },
    { key: "primaryCtaHref", role: "primary_action_href",label: "Primary CTA link", type: { kind: "link" }, default: "#whatsapp", group: "CTAs" },
    { key: "supportingCopy", role: "supporting_copy",label: "Supporting copy", type: { kind: "text", maxLength: 80 }, default: "Certificates available on request", priority: "text", group: "Copy" },
    { key: "badge1Name", label: "Badge 1 name", type: { kind: "text", maxLength: 40 }, default: "Gas Safe", group: "Badge 1" },
    { key: "badge1Tier", label: "Badge 1 tier", type: { kind: "text", maxLength: 40 }, default: "Registered", group: "Badge 1" },
    { key: "badge1Number", label: "Badge 1 number", type: { kind: "text", maxLength: 40 }, default: "127384", group: "Badge 1" },
    { key: "badge2Name", label: "Badge 2 name", type: { kind: "text", maxLength: 40 }, default: "NICEIC", group: "Badge 2" },
    { key: "badge2Tier", label: "Badge 2 tier", type: { kind: "text", maxLength: 40 }, default: "Approved", group: "Badge 2" },
    { key: "badge2Number", label: "Badge 2 number", type: { kind: "text", maxLength: 40 }, default: "V/62834", group: "Badge 2" },
    { key: "badge3Name", label: "Badge 3 name", type: { kind: "text", maxLength: 40 }, default: "TrustMark", group: "Badge 3" },
    { key: "badge3Tier", label: "Badge 3 tier", type: { kind: "text", maxLength: 40 }, default: "Government-endorsed", group: "Badge 3" },
    { key: "badge3Number", label: "Badge 3 number", type: { kind: "text", maxLength: 40 }, default: "", group: "Badge 3" },
    { key: "badge4Name", label: "Badge 4 name", type: { kind: "text", maxLength: 40 }, default: "£5m insured", group: "Badge 4" },
    { key: "badge4Tier", label: "Badge 4 tier", type: { kind: "text", maxLength: 40 }, default: "Public liability", group: "Badge 4" },
    { key: "badge4Number", label: "Badge 4 number", type: { kind: "text", maxLength: 40 }, default: "", group: "Badge 4" },
    { key: "badge5Name", label: "Badge 5 name", type: { kind: "text", maxLength: 40 }, default: "FMB", group: "Badge 5" },
    { key: "badge5Tier", label: "Badge 5 tier", type: { kind: "text", maxLength: 40 }, default: "Master Builder", group: "Badge 5" },
    { key: "badge5Number", label: "Badge 5 number", type: { kind: "text", maxLength: 40 }, default: "", group: "Badge 5" },
    { key: "badge6Name", label: "Badge 6 name", type: { kind: "text", maxLength: 40 }, default: "CHAS", group: "Badge 6" },
    { key: "badge6Tier", label: "Badge 6 tier", type: { kind: "text", maxLength: 40 }, default: "Accredited", group: "Badge 6" },
    { key: "badge6Number", label: "Badge 6 number", type: { kind: "text", maxLength: 40 }, default: "", group: "Badge 6" },
    { key: "badge7Name", label: "Badge 7 name", type: { kind: "text", maxLength: 40 }, default: "CSCS", group: "Badge 7" },
    { key: "badge7Tier", label: "Badge 7 tier", type: { kind: "text", maxLength: 40 }, default: "Gold card", group: "Badge 7" },
    { key: "badge7Number", label: "Badge 7 number", type: { kind: "text", maxLength: 40 }, default: "", group: "Badge 7" },
    { key: "badge8Name", label: "Badge 8 name", type: { kind: "text", maxLength: 40 }, default: "Companies House", group: "Badge 8" },
    { key: "badge8Tier", label: "Badge 8 tier", type: { kind: "text", maxLength: 40 }, default: "Active limited", group: "Badge 8" },
    { key: "badge8Number", label: "Badge 8 number", type: { kind: "text", maxLength: 40 }, default: "12345678", group: "Badge 8" }
  ],
  animations: ["none", "fade-in", "shimmer"],
  aiPrompts: {
    explain: "Explain when the Badge Wall hero works best.",
    improve: "Suggest badge order — most-important-first.",
    rewrite: "Rewrite the headline for a regulated trade.",
    suggestAlternative: "Which hero would work for a non-regulated trade?",
    score: "Score this hero on the six standard axes."
  },
  thumbnail: "",
  telemetryTags: ["hero", "trust", "badges", "regulated-trades"],
  bestForVerticals: ["gas-engineer", "electrician", "boiler-engineer", "roofer", "structural-engineer", "scaffolder", "plumber", "asbestos-remover"],
  defaultConfig: () => ({
    eyebrow: "Registered · Certified · Insured",
    heading: "The credentials to back the work.",
    subheading: "Every accreditation on this wall is live, checkable and current. Ask us for the certificate — we send it before we come out.",
    primaryCtaLabel: "Get a quote",
    primaryCtaHref: "#whatsapp",
    supportingCopy: "Certificates available on request",
    badge1Name: "Gas Safe", badge1Tier: "Registered", badge1Number: "127384",
    badge2Name: "NICEIC", badge2Tier: "Approved", badge2Number: "V/62834",
    badge3Name: "TrustMark", badge3Tier: "Government-endorsed", badge3Number: "",
    badge4Name: "£5m insured", badge4Tier: "Public liability", badge4Number: "",
    badge5Name: "FMB", badge5Tier: "Master Builder", badge5Number: "",
    badge6Name: "CHAS", badge6Tier: "Accredited", badge6Number: "",
    badge7Name: "CSCS", badge7Tier: "Gold card", badge7Number: "",
    badge8Name: "Companies House", badge8Tier: "Active limited", badge8Number: "12345678"
  }),
  renderer: BadgeWallHero
};

sectionRegistry.register(registration);
