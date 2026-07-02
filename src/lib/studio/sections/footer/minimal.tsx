// footer.minimal_1 — dark brand-name + 3-column link footer.
//
// Every published page needs one. Merchant fills 3 columns of links
// (comma-separated), a WhatsApp / email row, and a copyright line.

import Link from "next/link";
import { sectionRegistry } from "@/lib/studio/sectionRegistry";
import { sectionRootAttrs, treeAttrs } from "@/lib/studio/treeIds";
import type {
  SectionRegistration,
  SectionRendererProps
} from "@/lib/studio/sectionTypes";

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

function parseLinks(raw: string): LinkPair[] {
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
  const accent = (tokens["color.accent"] as string | undefined) ?? "#FFB300";
  const headingFont = tokens["font.heading"] as string | undefined;
  const bodyFont = tokens["font.body"] as string | undefined;
  const headingWeight = tokens["font.heading.weight"] as number | undefined;

  const cols = [
    { i: 1 as const, title: config.col1Title, links: parseLinks(config.col1Links) },
    { i: 2 as const, title: config.col2Title, links: parseLinks(config.col2Links) },
    { i: 3 as const, title: config.col3Title, links: parseLinks(config.col3Links) }
  ];

  const whatsappHref = data.whatsappHref ?? "#";
  const mailHref = config.contactEmailValue
    ? `mailto:${config.contactEmailValue}`
    : "#";

  return (
    <section
      className="w-full"
      style={{ background: "#0A0A0A", color: "#FFFFFF" }}
      {...sectionRootAttrs(instanceId, "footer.minimal_1", "Footer")}
    >
      <div className="mx-auto max-w-6xl px-4 py-12 sm:px-6 sm:py-16">
        <div className="grid grid-cols-1 gap-8 lg:grid-cols-4">
          <div>
            <p
              className="text-2xl leading-tight"
              style={{
                fontFamily: headingFont,
                fontWeight: headingWeight ?? 900,
                color: accent
              }}
              {...treeAttrs(instanceId, "brandLine", "Brand line", "text")}
            >
              {config.brandLine}
            </p>
            <p
              className="mt-2 max-w-xs text-[12px] leading-relaxed"
              style={{ color: "rgba(255,255,255,0.65)", fontFamily: bodyFont }}
              {...treeAttrs(instanceId, "tagline", "Tagline", "text")}
            >
              {config.tagline}
            </p>
          </div>

          {cols.map((c) => (
            <div key={c.i}>
              <p
                className="text-[10px] font-extrabold uppercase tracking-widest"
                style={{ color: accent }}
                {...treeAttrs(instanceId, `col${c.i}Title`, `Column ${c.i} title`, "text")}
              >
                {c.title}
              </p>
              <ul
                className="mt-3 space-y-2"
                {...treeAttrs(instanceId, `col${c.i}Links`, `Column ${c.i} links`, "text")}
              >
                {c.links.map((l, idx) => (
                  <li key={idx}>
                    <Link
                      href={l.href}
                      className="text-[13px] font-bold text-white transition hover:text-white/70"
                    >
                      {l.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        <div className="mt-10 flex flex-wrap items-center justify-between gap-4 border-t border-white/10 pt-6">
          <div className="flex flex-wrap gap-3">
            {config.contactWhatsappLabel && (
              <Link
                href={whatsappHref}
                className="inline-flex h-10 items-center rounded-xl px-4 text-[12px] font-extrabold uppercase tracking-widest"
                style={{ background: "#25D366", color: "#FFFFFF" }}
                {...treeAttrs(instanceId, "contactWhatsappLabel", "WhatsApp button", "button")}
              >
                {config.contactWhatsappLabel}
              </Link>
            )}
            {config.contactEmailLabel && (
              <Link
                href={mailHref}
                className="inline-flex h-10 items-center rounded-xl px-4 text-[12px] font-extrabold uppercase tracking-widest text-white transition hover:brightness-110"
                style={{ background: "rgba(255,255,255,0.10)" }}
                {...treeAttrs(instanceId, "contactEmailLabel", "Email button", "button")}
              >
                {config.contactEmailLabel}
              </Link>
            )}
          </div>
          <p
            className="text-[11px]"
            style={{ color: "rgba(255,255,255,0.4)" }}
            {...treeAttrs(instanceId, "copyright", "Copyright", "text")}
          >
            {config.copyright}
          </p>
        </div>
      </div>
    </section>
  );
}

const columnFields = (i: 1 | 2 | 3, title: string, links: string) => [
  { key: `col${i}Title`, label: `Column ${i} title`, type: { kind: "text" as const, maxLength: 30 }, default: title, priority: "text" as const, group: `Column ${i}` },
  { key: `col${i}Links`, label: `Column ${i} links`, type: { kind: "text" as const, maxLength: 400, multiline: true }, default: links, priority: "text" as const, description: "Format: Label:/href, Label:/href, …", group: `Column ${i}` }
];

const registration: SectionRegistration<Config> = {
  id: "footer.minimal_1",
  name: "Minimal footer",
  version: "1.0.0",
  library: "footer",
  description:
    "Dark 4-column footer: brand + tagline + 3 link columns. Bottom row: WhatsApp + email + copyright. Ships on every published page.",
  editableFields: [
    { key: "brandLine", label: "Brand line", type: { kind: "text", maxLength: 40 }, default: "Your Business", priority: "text", group: "Brand" },
    { key: "tagline", label: "Tagline", type: { kind: "text", maxLength: 160 }, default: "Trades done right, first time, insured and guaranteed.", priority: "text", aiPromptable: true, group: "Brand" },
    ...columnFields(1, "Services", "Home:/, Services:/services, Prices:/pricing, Areas we cover:/areas"),
    ...columnFields(2, "About", "About us:/about, Our team:/team, Reviews:/reviews, Guarantees:/guarantee"),
    ...columnFields(3, "Get in touch", "Quote:/quote, Emergency:/emergency, Book an appointment:/book, WhatsApp:#whatsapp"),
    { key: "contactWhatsappLabel", label: "WhatsApp button text", type: { kind: "text", maxLength: 24 }, default: "💬 WhatsApp us", priority: "button", group: "Contact row" },
    { key: "contactEmailLabel", label: "Email button text", type: { kind: "text", maxLength: 24 }, default: "✉ Email", priority: "button", group: "Contact row" },
    { key: "contactEmailValue", label: "Email address", type: { kind: "text", maxLength: 80 }, default: "hello@yourbusiness.co.uk", group: "Contact row" },
    { key: "copyright", label: "Copyright line", type: { kind: "text", maxLength: 120 }, default: "© Your Business Ltd. Registered in England.", priority: "text", group: "Legal" }
  ],
  animations: ["none"],
  aiPrompts: {
    explain: "Explain why merchants need a footer this rich. Reference the 3 link columns.",
    improve: "Improve without layout change. Column titles under 3 words. Link labels under 4 words. Return only patched config.",
    rewrite: "Rewrite the tagline in a {tone} voice.",
    suggestAlternative: "Suggest an alternative footer from library='footer'. One-sentence rationale.",
    score: "Score across 6 dimensions. JSON only."
  },
  thumbnail: "https://ik.imagekit.io/9mrgsv2rp/studio/thumbnails/footer-minimal-1.png",
  scoreHints: {
    loading: { imageWeightBudgetKb: 0 },
    accessibility: { contrastMin: 4.5 },
    sales: { primaryActionRequired: true },
    seo: { headingLevel: 2 },
    mobile: { minTapTargetPx: 44 },
    brandConsistency: { boundTokens: ["color.accent"] }
  },
  telemetryTags: ["footer", "minimal", "dark", "four_column", "contact_row"],
  bestForVerticals: ["plumbing", "electrical", "hvac", "landscaping", "roofing", "joinery", "plant_hire", "kitchen_install", "bathroom_install"],
  defaultConfig: () => ({
    brandLine: "Your Business",
    tagline: "Trades done right, first time, insured and guaranteed.",
    col1Title: "Services",
    col1Links: "Home:/, Services:/services, Prices:/pricing, Areas we cover:/areas",
    col2Title: "About",
    col2Links: "About us:/about, Our team:/team, Reviews:/reviews, Guarantees:/guarantee",
    col3Title: "Get in touch",
    col3Links: "Quote:/quote, Emergency:/emergency, Book an appointment:/book, WhatsApp:#whatsapp",
    contactWhatsappLabel: "💬 WhatsApp us",
    contactEmailLabel: "✉ Email",
    contactEmailValue: "hello@yourbusiness.co.uk",
    copyright: "© Your Business Ltd. Registered in England."
  }),
  renderer: FooterMinimal
};

sectionRegistry.register(registration);
