// services.list_1 — vertical services menu.
//
// 5 fixed service rows. Each row: icon glyph, name, one-line
// description, from-price on the right, whole row is a Link to a
// dedicated service page. Distinct from product_grid (photo-heavy 3-col
// tiles) — this is the "menu of services" pattern trade merchants use
// on plumbing / electrical / HVAC landing pages.

import Link from "next/link";
import { sectionRegistry } from "@/lib/studio/sectionRegistry";
import { sectionRootAttrs, treeAttrs } from "@/lib/studio/treeIds";
import type {
  SectionRegistration,
  SectionRendererProps
} from "@/lib/studio/sectionTypes";

type Slot = 1 | 2 | 3 | 4 | 5;

type Config = {
  eyebrow: string;
  heading: string;
  s1Icon: string; s1Name: string; s1Body: string; s1Price: string; s1Href: string;
  s2Icon: string; s2Name: string; s2Body: string; s2Price: string; s2Href: string;
  s3Icon: string; s3Name: string; s3Body: string; s3Price: string; s3Href: string;
  s4Icon: string; s4Name: string; s4Body: string; s4Price: string; s4Href: string;
  s5Icon: string; s5Name: string; s5Body: string; s5Price: string; s5Href: string;
};

function ServicesList({
  instanceId,
  config,
  tokens,
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

  type Row = {
    i: Slot;
    icon: string;
    name: string;
    body: string;
    price: string;
    href: string;
  };
  const slots: Row[] = [
    { i: 1, icon: config.s1Icon, name: config.s1Name, body: config.s1Body, price: config.s1Price, href: config.s1Href },
    { i: 2, icon: config.s2Icon, name: config.s2Name, body: config.s2Body, price: config.s2Price, href: config.s2Href },
    { i: 3, icon: config.s3Icon, name: config.s3Name, body: config.s3Body, price: config.s3Price, href: config.s3Href },
    { i: 4, icon: config.s4Icon, name: config.s4Name, body: config.s4Body, price: config.s4Price, href: config.s4Href },
    { i: 5, icon: config.s5Icon, name: config.s5Name, body: config.s5Body, price: config.s5Price, href: config.s5Href }
  ];
  const services = slots.filter((s) => s.name);

  return (
    <section
      className="w-full"
      style={{ background: surface, color: text }}
      {...sectionRootAttrs(instanceId, "services.list_1", "Services menu")}
    >
      <div className="mx-auto max-w-4xl px-4 py-14 sm:px-6 sm:py-20">
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

        <ul className="mt-8 divide-y divide-neutral-200 rounded-2xl border border-neutral-200 bg-white shadow-sm">
          {services.map((s) => (
            <li key={s.i}>
              <Link
                href={s.href || "#"}
                tabIndex={isEditing ? -1 : undefined}
                className="group flex items-center gap-4 p-4 transition hover:bg-neutral-50 sm:p-5"
              >
                <span
                  aria-hidden="true"
                  className="grid h-12 w-12 shrink-0 place-items-center rounded-xl text-[22px] font-extrabold"
                  style={{ background: accent, color: "#0A0A0A" }}
                  {...treeAttrs(instanceId, `s${s.i}Icon`, `Service ${s.i} icon`, "text")}
                >
                  {s.icon}
                </span>
                <div className="min-w-0 flex-1">
                  <p
                    className="text-[15px]"
                    style={{
                      fontFamily: headingFont,
                      fontWeight: headingWeight ?? 800,
                      color: text
                    }}
                    {...treeAttrs(instanceId, `s${s.i}Name`, `Service ${s.i} name`, "text")}
                  >
                    {s.name}
                  </p>
                  {s.body && (
                    <p
                      className="mt-0.5 text-[12px] leading-relaxed"
                      style={{
                        color: muted,
                        fontFamily: bodyFont,
                        fontWeight: bodyWeight ?? 500
                      }}
                      {...treeAttrs(instanceId, `s${s.i}Body`, `Service ${s.i} description`, "text")}
                    >
                      {s.body}
                    </p>
                  )}
                </div>
                <div className="flex shrink-0 flex-col items-end gap-0.5 text-right">
                  {s.price && (
                    <p
                      className="text-[13px]"
                      style={{
                        fontFamily: headingFont,
                        fontWeight: headingWeight ?? 800,
                        color: text
                      }}
                      {...treeAttrs(instanceId, `s${s.i}Price`, `Service ${s.i} price`, "text")}
                    >
                      {s.price}
                    </p>
                  )}
                  <span
                    className="text-[10px] font-extrabold uppercase tracking-widest transition group-hover:translate-x-0.5"
                    style={{ color: muted }}
                  >
                    Learn more →
                  </span>
                </div>
              </Link>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}

const serviceFields = (
  i: Slot,
  icon: string,
  name: string,
  body: string,
  price: string
) => [
  { key: `s${i}Icon`, label: `Service ${i} icon`, type: { kind: "text" as const, maxLength: 4 }, default: icon, priority: "text" as const, description: "One glyph — emoji or short symbol.", group: `Service ${i}` },
  { key: `s${i}Name`, label: `Service ${i} name`, type: { kind: "text" as const, maxLength: 60 }, default: name, priority: "text" as const, aiPromptable: true, group: `Service ${i}` },
  { key: `s${i}Body`, label: `Service ${i} description`, type: { kind: "text" as const, maxLength: 160, multiline: true }, default: body, priority: "text" as const, aiPromptable: true, group: `Service ${i}` },
  { key: `s${i}Price`, label: `Service ${i} price`, type: { kind: "text" as const, maxLength: 24 }, default: price, priority: "text" as const, description: "e.g. From £120, £75 / hour, POA", group: `Service ${i}` },
  { key: `s${i}Href`, label: `Service ${i} link`, type: { kind: "link" as const, allowInternal: true, allowExternal: true }, default: "#", group: `Service ${i}` }
];

const registration: SectionRegistration<Config> = {
  id: "services.list_1",
  name: "Services menu",
  version: "1.0.0",
  library: "services",
  description:
    "Vertical menu of 5 services. Icon glyph + name + short description + from-price on the right, whole row is a link. Distinct from a product grid — best for service-heavy trades (plumbing, electrical, HVAC, boiler repair).",
  editableFields: [
    { key: "eyebrow", role: "eyebrow",label: "Small kicker", type: { kind: "text", maxLength: 40 }, default: "What we do", priority: "text", group: "Header" },
    { key: "heading", role: "headline",label: "Main headline", type: { kind: "text", maxLength: 120 }, default: "Five services, one number.", priority: "text", aiPromptable: true, group: "Header" },
    ...serviceFields(1, "🔧", "Boiler installation", "Combi, system or heat-only. Fully certified, 10-year warranty.", "From £2,400"),
    ...serviceFields(2, "🚨", "Emergency callout", "Same-day response across the region, 24/7.", "£75 / hour"),
    ...serviceFields(3, "🔥", "Annual service", "Landlord CP12, homeowner service, boiler health check.", "£95"),
    ...serviceFields(4, "🚰", "Radiators + valves", "Replacement, additions, TRVs, thermostats.", "From £180"),
    ...serviceFields(5, "🔍", "Leak detection", "Non-invasive tracing, thermal imaging, moisture mapping.", "From £220")
  ],
  animations: ["none", "fade", "stagger"],
  aiPrompts: {
    explain:
      "Explain why a vertical services menu works for a UK trade merchant. Reference the specific services.",
    improve:
      "Improve without layout change. Service names under 5 words, descriptions under 15 words, prices consistent format. Return only patched config.",
    rewrite:
      "Rewrite service names + descriptions in a {tone} voice. Prices stay factual.",
    suggestAlternative:
      "Suggest an alternative layout from library='services'. One-sentence rationale.",
    score: "Score across 6 dimensions. JSON only."
  },
  thumbnail:
    "https://ik.imagekit.io/9mrgsv2rp/studio/thumbnails/services-list-1.png",
  scoreHints: {
    loading: { imageWeightBudgetKb: 0 },
    accessibility: { contrastMin: 4.5 },
    sales: { primaryActionRequired: true },
    seo: { headingLevel: 2 },
    mobile: { minTapTargetPx: 44 },
    brandConsistency: { boundTokens: ["color.accent", "color.surface", "color.text"] }
  },
  telemetryTags: [
    "services",
    "vertical_list",
    "five_slots",
    "price_right_aligned",
    "menu_style"
  ],
  bestForVerticals: [
    "plumbing",
    "electrical",
    "hvac",
    "boiler_repair",
    "drain_clearance",
    "glazing",
    "locksmith",
    "gas_safe"
  ],
  defaultConfig: () => ({
    eyebrow: "What we do",
    heading: "Five services, one number.",
    s1Icon: "🔧", s1Name: "Boiler installation", s1Body: "Combi, system or heat-only. Fully certified, 10-year warranty.", s1Price: "From £2,400", s1Href: "#",
    s2Icon: "🚨", s2Name: "Emergency callout", s2Body: "Same-day response across the region, 24/7.", s2Price: "£75 / hour", s2Href: "#",
    s3Icon: "🔥", s3Name: "Annual service", s3Body: "Landlord CP12, homeowner service, boiler health check.", s3Price: "£95", s3Href: "#",
    s4Icon: "🚰", s4Name: "Radiators + valves", s4Body: "Replacement, additions, TRVs, thermostats.", s4Price: "From £180", s4Href: "#",
    s5Icon: "🔍", s5Name: "Leak detection", s5Body: "Non-invasive tracing, thermal imaging, moisture mapping.", s5Price: "From £220", s5Href: "#"
  }),
  renderer: ServicesList
};

sectionRegistry.register(registration);
