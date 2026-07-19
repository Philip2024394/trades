// footer.minimal_1 — Phase 2 rebuild on shadcn foundation.
//
// Dark brand-name + 3-column link footer with WhatsApp/email row and
// copyright. Uses platform typography scale + Lucide icons + Framer
// Motion Reveal.

"use client";

import Link from "next/link";
import { MessageCircle, Mail, ArrowUpRight } from "lucide-react";
import { sectionRegistry } from "@/lib/studio/sectionRegistry";
import { sectionRootAttrs, treeAttrs } from "@/lib/studio/treeIds";
import type {
  SectionRegistration,
  SectionRendererProps
} from "@/lib/studio/sectionTypes";
import { Reveal } from "@/components/ui/reveal";
import { Separator } from "@/components/ui/separator";
import { cn } from "@/lib/utils";

type Config = {
  brandLine: string;
  tagline: string;
  col1Title: string;
  col1Links: string; // "Label:/href, Label2:/href2"
  col2Title: string;
  col2Links: string;
  col3Title: string;
  col3Links: string;
  contactWhatsappLabel: string;
  contactEmailLabel: string;
  contactEmailValue: string;
  copyright: string;
};

type LinkPair = { label: string; href: string };

function parseLinks(raw: unknown): LinkPair[] {
  if (typeof raw !== "string" || raw.length === 0) return [];
  return raw
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean)
    .map((entry) => {
      const [label, href] = entry.split(":").map((p) => p.trim());
      return { label: label ?? entry, href: href ?? "#" };
    });
}

function FooterMinimal({
  instanceId,
  config,
  tokens,
  data
}: SectionRendererProps<Config>) {
  const accent = (tokens["color.accent"] as string) ?? "#FFB300";

  // Defensive fallbacks.
  const brandLine =
    typeof config.brandLine === "string" ? config.brandLine : "Your Business";
  const tagline =
    typeof config.tagline === "string" ? config.tagline : "";
  const col1Title =
    typeof config.col1Title === "string" ? config.col1Title : "";
  const col2Title =
    typeof config.col2Title === "string" ? config.col2Title : "";
  const col3Title =
    typeof config.col3Title === "string" ? config.col3Title : "";
  const contactWhatsappLabel =
    (typeof config.contactWhatsappLabel === "string" &&
      config.contactWhatsappLabel) ||
    "WhatsApp us";
  const contactEmailLabel =
    (typeof config.contactEmailLabel === "string" &&
      config.contactEmailLabel) ||
    "Email";
  const contactEmailValue =
    typeof config.contactEmailValue === "string"
      ? config.contactEmailValue
      : "";
  const copyright =
    (typeof config.copyright === "string" && config.copyright) ||
    `© ${new Date().getFullYear()} ${brandLine}. All rights reserved.`;

  const col1Links = parseLinks(config.col1Links);
  const col2Links = parseLinks(config.col2Links);
  const col3Links = parseLinks(config.col3Links);

  const whatsappHref = data.whatsappHref ?? "#whatsapp";

  return (
    <footer
      className={cn(
        "relative w-full overflow-x-clip bg-foreground text-background"
      )}
      {...sectionRootAttrs(instanceId, "footer.minimal_1", "Footer")}
    >
      <div className="mx-auto max-w-6xl px-4 py-12 sm:px-6 sm:py-16">
        <div className="grid gap-8 sm:grid-cols-2 lg:grid-cols-4 lg:gap-10">
          {/* Brand column */}
          <Reveal>
            <div>
              <p
                className="text-heading-lg font-extrabold tracking-tight"
                {...treeAttrs(instanceId, "brandLine", "Brand name", "text")}
              >
                {brandLine}
              </p>
              {tagline && (
                <p
                  className="mt-2 max-w-xs text-body-sm opacity-70"
                  {...treeAttrs(instanceId, "tagline", "Tagline", "text")}
                >
                  {tagline}
                </p>
              )}
            </div>
          </Reveal>

          {/* Link columns */}
          {[
            { title: col1Title, links: col1Links, idx: 1 },
            { title: col2Title, links: col2Links, idx: 2 },
            { title: col3Title, links: col3Links, idx: 3 }
          ].map((col) =>
            col.title || col.links.length > 0 ? (
              <Reveal key={col.idx} delay={0.05 * col.idx}>
                <div>
                  {col.title && (
                    <p
                      className="text-caption font-extrabold uppercase opacity-60"
                      {...treeAttrs(
                        instanceId,
                        `col${col.idx}Title`,
                        `Column ${col.idx} title`,
                        "text"
                      )}
                    >
                      {col.title}
                    </p>
                  )}
                  {col.links.length > 0 && (
                    <ul className="mt-3 flex flex-col gap-2">
                      {col.links.map((l, i) => (
                        <li key={i}>
                          <Link
                            href={l.href}
                            className="inline-flex items-center gap-1 text-body-sm opacity-80 transition-opacity hover:opacity-100"
                          >
                            {l.label}
                            <ArrowUpRight
                              size={12}
                              strokeWidth={2}
                              className="opacity-0 transition-opacity group-hover:opacity-100"
                              aria-hidden="true"
                            />
                          </Link>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              </Reveal>
            ) : null
          )}
        </div>

        {/* Divider */}
        <Separator className="my-8 bg-background/10 sm:my-10" />

        {/* Bottom row — contact + copyright */}
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <Reveal delay={0.2}>
            <div className="flex flex-wrap items-center gap-3">
              <Link
                href={whatsappHref}
                className="inline-flex items-center gap-2 rounded-full border border-background/20 px-4 py-1.5 text-caption font-extrabold uppercase transition-colors hover:border-background/40"
              >
                <MessageCircle
                  size={14}
                  strokeWidth={2.25}
                  style={{ color: "#166534" }}
                  aria-hidden="true"
                />
                {contactWhatsappLabel}
              </Link>
              {contactEmailValue && (
                <Link
                  href={`mailto:${contactEmailValue}`}
                  className="inline-flex items-center gap-2 rounded-full border border-background/20 px-4 py-1.5 text-caption font-extrabold uppercase transition-colors hover:border-background/40"
                >
                  <Mail
                    size={14}
                    strokeWidth={2.25}
                    style={{ color: accent }}
                    aria-hidden="true"
                  />
                  {contactEmailLabel}
                </Link>
              )}
            </div>
          </Reveal>
          <Reveal delay={0.25}>
            <p
              className="text-caption font-bold opacity-50"
              {...treeAttrs(instanceId, "copyright", "Copyright", "text")}
            >
              {copyright}
            </p>
          </Reveal>
        </div>
      </div>
    </footer>
  );
}

const registration: SectionRegistration<Config> = {
  id: "footer.minimal_1",
  name: "Footer · minimal",
  version: "2.0.0",
  library: "footer",
  description:
    "Dark 3-column link footer with brand line + tagline + WhatsApp/email chips + copyright. Framer Motion staggered entrance. Lucide icons.",
  editableFields: [
    { key: "brandLine", label: "Brand name", type: { kind: "text", maxLength: 40 }, default: "Your Business", priority: "text", group: "Brand" },
    { key: "tagline", label: "Tagline", type: { kind: "text", maxLength: 120 }, default: "Trades done right, first time, insured and guaranteed.", priority: "text", role: "trust_line", aiPromptable: true, group: "Brand" },
    { key: "col1Title", label: "Column 1 title", type: { kind: "text", maxLength: 30 }, default: "Services", group: "Column 1" },
    { key: "col1Links", label: "Column 1 links", type: { kind: "text", maxLength: 400 }, default: "Home:/, Services:/services, Prices:/prices, Areas we cover:/areas", description: "Comma-separated 'Label:/href' pairs.", group: "Column 1" },
    { key: "col2Title", label: "Column 2 title", type: { kind: "text", maxLength: 30 }, default: "About", group: "Column 2" },
    { key: "col2Links", label: "Column 2 links", type: { kind: "text", maxLength: 400 }, default: "About us:/about, Our team:/team, Reviews:/reviews, Guarantees:/guarantees", group: "Column 2" },
    { key: "col3Title", label: "Column 3 title", type: { kind: "text", maxLength: 30 }, default: "Get in touch", group: "Column 3" },
    { key: "col3Links", label: "Column 3 links", type: { kind: "text", maxLength: 400 }, default: "Quote:/contact, Emergency:/emergency, Book an appointment:/book", group: "Column 3" },
    { key: "contactWhatsappLabel", label: "WhatsApp chip label", type: { kind: "text", maxLength: 30 }, default: "WhatsApp us", priority: "text", group: "Contact" },
    { key: "contactEmailLabel", label: "Email chip label", type: { kind: "text", maxLength: 30 }, default: "Email", priority: "text", group: "Contact" },
    { key: "contactEmailValue", label: "Email address", type: { kind: "text", maxLength: 60 }, default: "hello@yourbusiness.co.uk", priority: "text", group: "Contact" },
    { key: "copyright", label: "Copyright line", type: { kind: "text", maxLength: 120 }, default: "", description: "Leave blank to auto-generate '© {year} {brand}. All rights reserved.'", priority: "text", role: "disclaimer", group: "Legal" }
  ],
  animations: ["none", "fade-in"],
  aiPrompts: {
    explain: "A minimal 3-column footer. Explain when this beats a mega-footer.",
    improve: "Tighten link labels. Return patched fields only.",
    rewrite: "Rewrite the tagline in a {tone} voice.",
    suggestAlternative: "Suggest an alternative when the merchant has 30+ links.",
    score: "Score across Loading, Accessibility, Sales, SEO, Mobile, Brand Consistency. JSON only."
  },
  thumbnail: "",
  scoreHints: { loading: { imageWeightBudgetKb: 0 }, accessibility: { contrastMin: 4.5 }, sales: { primaryActionRequired: false }, seo: { headingLevel: 3 }, mobile: { minTapTargetPx: 44 }, brandConsistency: { boundTokens: ["color.accent"] } },
  telemetryTags: ["footer", "minimal", "3col", "shadcn", "framer_motion"],
  bestForVerticals: ["electrician", "plumber", "gas-engineer", "hvac-contractor", "roofer", "landscaper", "extension-builder"],
  defaultConfig: () => ({
    brandLine: "Your Business",
    tagline: "Trades done right, first time, insured and guaranteed.",
    col1Title: "Services",
    col1Links: "Home:/, Services:/services, Prices:/prices, Areas we cover:/areas",
    col2Title: "About",
    col2Links: "About us:/about, Our team:/team, Reviews:/reviews, Guarantees:/guarantees",
    col3Title: "Get in touch",
    col3Links: "Quote:/contact, Emergency:/emergency, Book an appointment:/book",
    contactWhatsappLabel: "WhatsApp us",
    contactEmailLabel: "Email",
    contactEmailValue: "hello@yourbusiness.co.uk",
    copyright: ""
  }),
  renderer: FooterMinimal
};

sectionRegistry.register(registration);
