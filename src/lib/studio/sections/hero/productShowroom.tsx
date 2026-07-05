// hero.product_showroom_1 — Merchant Product-Showroom Hero.
//
// Storefront-first hero for building merchants, tool suppliers,
// materials yards, kitchen showrooms. A 6-tile product grid mock
// sits on the RIGHT (or below on mobile); copy + Trade Account CTA
// + delivery-zone chip sit on the LEFT.
//
// Design principles applied:
//   • Product grid IS the pitch — merchants are ranges of stock
//   • Trade Account CTA prominently placed
//   • Delivery-zone chip immediately addresses "do you cover me?"
//   • Yellow badge on featured product tile (sale / new arrival)
//   • Works with real product photos or a placeholder gradient grid

"use client";

import Link from "next/link";
import { sectionRegistry } from "@/lib/studio/sectionRegistry";
import { sectionRootAttrs, treeAttrs } from "@/lib/studio/treeIds";
import type {
  SectionRegistration,
  SectionRendererProps
} from "@/lib/studio/sectionTypes";
import { GridPattern } from "@/components/magicui/grid-pattern";

/** Product-showroom uses grid pattern only — an animated aurora would
 *  fight the product tile grid and stock photography. */
type VisualEffect = "none" | "grid";

type Config = {
  eyebrow: string;
  heading: string;
  subheading: string;
  primaryCtaLabel: string;
  primaryCtaHref: string;
  secondaryCtaLabel: string;
  secondaryCtaHref: string;
  deliveryChip: string;
  tradeAccountChip: string;
  visualEffect: VisualEffect;
  product1Image: string;
  product1Label: string;
  product1Badge: string;
  product2Image: string;
  product2Label: string;
  product3Image: string;
  product3Label: string;
  product4Image: string;
  product4Label: string;
  product5Image: string;
  product5Label: string;
  product6Image: string;
  product6Label: string;
  backgroundImageUrl: string;
  backgroundImageOpacity: number;
};

function ProductShowroomHero({
  instanceId,
  config,
  tokens,
  data
}: SectionRendererProps<Config>) {
  const accent = (tokens["color.accent"] as string) ?? "#FFB300";
  const bg = (tokens["color.surface"] as string) ?? "#FFFFFF";
  const visualEffect: VisualEffect =
    config.visualEffect === "none" ? "none" : "grid";
  const subtle = (tokens["color.subtle"] as string) ?? "#F5F5F5";
  const ink = (tokens["color.ink"] as string) ?? "#0A0A0A";
  const muted = (tokens["color.muted"] as string) ?? "#525252";
  const border = "#E5E5E5";
  const headingFont = (tokens["font.heading"] as string) ?? "inherit";
  const bodyFont = (tokens["font.body"] as string) ?? "inherit";

  const primaryHref =
    config.primaryCtaHref === "#whatsapp" && data.whatsappHref
      ? data.whatsappHref
      : config.primaryCtaHref;
  const secondaryHref =
    config.secondaryCtaHref === "#whatsapp" && data.whatsappHref
      ? data.whatsappHref
      : config.secondaryCtaHref;

  const products = [
    { image: config.product1Image, label: config.product1Label, badge: config.product1Badge },
    { image: config.product2Image, label: config.product2Label, badge: "" },
    { image: config.product3Image, label: config.product3Label, badge: "" },
    { image: config.product4Image, label: config.product4Label, badge: "" },
    { image: config.product5Image, label: config.product5Label, badge: "" },
    { image: config.product6Image, label: config.product6Label, badge: "" }
  ];

  return (
    <section
      className="relative isolate w-full overflow-hidden"
      style={{ background: bg, color: ink, fontFamily: bodyFont }}
      {...sectionRootAttrs(instanceId, "hero.product_showroom_1", "Product Showroom Hero")}
    >
      {/* Magic UI grid — sits above the background photo overlay so it
          reads on both photo and no-photo variants. */}
      {visualEffect === "grid" && (
        <GridPattern
          size={48}
          strokeWidth={1}
          className="-z-10 text-neutral-900/[0.05]"
        />
      )}
      {config.backgroundImageUrl && (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={config.backgroundImageUrl}
          alt=""
          aria-hidden="true"
          className="pointer-events-none absolute inset-0 -z-20 h-full w-full object-cover"
          style={{
            opacity: Math.max(0, Math.min(1, config.backgroundImageOpacity ?? 1))
          }}
          {...treeAttrs(instanceId, "backgroundImageUrl", "Background photo", "image")}
        />
      )}
      {config.backgroundImageUrl && (
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-0 -z-10"
          style={{
            background:
              "linear-gradient(180deg, rgba(0,0,0,0.4) 0%, rgba(0,0,0,0.55) 100%)"
          }}
        />
      )}

      <div className="mx-auto grid max-w-6xl grid-cols-1 gap-10 px-5 py-16 sm:px-6 lg:grid-cols-[1fr_1.15fr] lg:items-center lg:gap-14 lg:py-24">
        {/* LEFT — copy + CTAs + chips */}
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
              className="mt-5 max-w-lg text-[15px] leading-relaxed sm:text-[17px]"
              style={{ color: muted }}
              {...treeAttrs(instanceId, "subheading", "Subheading", "text")}
            >
              {config.subheading}
            </p>
          )}

          <div className="mt-7 flex flex-wrap gap-3">
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
            {config.secondaryCtaLabel && (
              <Link
                href={secondaryHref || "#"}
                className="inline-flex h-14 items-center justify-center rounded-xl px-6 text-[13px] font-extrabold uppercase tracking-widest text-white transition hover:brightness-95"
                style={{
                  background: "#5C3A21",
                  boxShadow: "0 8px 24px rgba(92,58,33,0.45)"
                }}
                {...treeAttrs(instanceId, "secondaryCtaLabel", "Secondary CTA", "button")}
              >
                {config.secondaryCtaLabel}
              </Link>
            )}
          </div>

          {/* Chips */}
          <ul className="mt-6 flex flex-wrap gap-2">
            {config.deliveryChip && (
              <li
                className="inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-[11px] font-extrabold uppercase tracking-wider"
                style={{
                  background: subtle,
                  borderColor: border,
                  color: ink
                }}
                {...treeAttrs(instanceId, "deliveryChip", "Delivery chip", "text")}
              >
                <TruckIcon color={accent} />
                {config.deliveryChip}
              </li>
            )}
            {config.tradeAccountChip && (
              <li
                className="inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-[11px] font-extrabold uppercase tracking-wider"
                style={{
                  background: subtle,
                  borderColor: border,
                  color: ink
                }}
                {...treeAttrs(instanceId, "tradeAccountChip", "Trade account chip", "text")}
              >
                <CardIcon color={accent} />
                {config.tradeAccountChip}
              </li>
            )}
          </ul>
        </div>

        {/* RIGHT — product grid */}
        <div className="grid grid-cols-3 grid-rows-2 gap-3">
          {products.map((p, i) => (
            <div
              key={i}
              className="relative aspect-square overflow-hidden rounded-2xl border"
              style={{
                background: p.image ? "transparent" : `linear-gradient(135deg, ${subtle} 0%, #ECECEC 100%)`,
                borderColor: border
              }}
            >
              {p.image ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={p.image}
                  alt={p.label}
                  className="h-full w-full object-contain"
                />
              ) : (
                <div className="flex h-full w-full items-center justify-center">
                  <BoxIcon color={muted} />
                </div>
              )}
              {p.label && (
                <div
                  className="absolute inset-x-0 bottom-0 p-2 text-[10px] font-extrabold uppercase tracking-widest"
                  style={{
                    background: "linear-gradient(180deg, transparent 0%, rgba(0,0,0,0.6) 100%)",
                    color: "#FFFFFF"
                  }}
                >
                  {p.label}
                </div>
              )}
              {p.badge && (
                <span
                  className="absolute right-2 top-2 rounded-full px-2 py-0.5 text-[9px] font-extrabold uppercase tracking-widest"
                  style={{ background: accent, color: "#0A0A0A" }}
                >
                  {p.badge}
                </span>
              )}
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

function TruckIcon({ color }: { color: string }) {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M10 17h4V5H2v12h3" />
      <path d="M14 8h4l4 4v5h-3" />
      <circle cx="7.5" cy="17.5" r="2.5" />
      <circle cx="17.5" cy="17.5" r="2.5" />
    </svg>
  );
}
function CardIcon({ color }: { color: string }) {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <rect x="2" y="6" width="20" height="12" rx="2" />
      <path d="M2 10h20" />
    </svg>
  );
}
function BoxIcon({ color }: { color: string }) {
  return (
    <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z" />
      <path d="M3.27 6.96 12 12.01l8.73-5.05" />
      <path d="M12 22.08V12" />
    </svg>
  );
}

const registration: SectionRegistration<Config> = {
  id: "hero.product_showroom_1",
  name: "Merchant Product Showroom Hero",
  version: "1.0.0",
  library: "hero",
  description:
    "Storefront-first hero for building merchants, tool suppliers, materials yards. Product grid on the right, copy + trade-account CTA + delivery chip on the left.",
  editableFields: [
    { key: "eyebrow", role: "eyebrow",label: "Eyebrow", type: { kind: "text", maxLength: 60 }, default: "Yard open · Monday to Saturday", priority: "text", aiPromptable: true, group: "Copy" },
    { key: "heading", role: "headline",label: "Headline", type: { kind: "text", maxLength: 100 }, default: "Everything you need to get on site.", priority: "text", aiPromptable: true, group: "Copy" },
    { key: "subheading", role: "subhead",label: "Subheading", type: { kind: "text", maxLength: 200, multiline: true }, default: "Building materials, tools and consumables in stock. Same-day delivery inside our zone. Trade account holders get 30-day credit.", priority: "text", aiPromptable: true, group: "Copy" },
    { key: "primaryCtaLabel", role: "primary_action_label",label: "Primary CTA label", type: { kind: "text", maxLength: 30 }, default: "Open a trade account", priority: "button", aiPromptable: true, group: "CTAs" },
    { key: "primaryCtaHref", role: "primary_action_href",label: "Primary CTA link", type: { kind: "link" }, default: "#trade-account", group: "CTAs" },
    { key: "secondaryCtaLabel", role: "secondary_action_label",label: "Secondary CTA label", type: { kind: "text", maxLength: 30 }, default: "Browse stock", priority: "button", aiPromptable: true, group: "CTAs" },
    { key: "secondaryCtaHref", role: "secondary_action_href",label: "Secondary CTA link", type: { kind: "link" }, default: "#shop", group: "CTAs" },
    { key: "deliveryChip", label: "Delivery chip", type: { kind: "text", maxLength: 40 }, default: "Same-day within 15 miles", group: "Chips" },
    { key: "tradeAccountChip", label: "Trade account chip", type: { kind: "text", maxLength: 40 }, default: "30-day trade credit", group: "Chips" },
    { key: "product1Image", role: "hero_media",label: "Product 1 image", type: { kind: "image", aspectRatio: "1:1" }, default: "", group: "Product 1 (featured)" },
    { key: "product1Label", role: "product_name",label: "Product 1 label", type: { kind: "text", maxLength: 30 }, default: "Cement 25kg", group: "Product 1 (featured)" },
    { key: "product1Badge", role: "product_badge",label: "Product 1 badge", type: { kind: "text", maxLength: 20 }, default: "New", group: "Product 1 (featured)" },
    { key: "product2Image", role: "hero_media",label: "Product 2 image", type: { kind: "image", aspectRatio: "1:1" }, default: "", group: "Products" },
    { key: "product2Label", role: "product_name",label: "Product 2 label", type: { kind: "text", maxLength: 30 }, default: "Plasterboard", group: "Products" },
    { key: "product3Image", role: "hero_media",label: "Product 3 image", type: { kind: "image", aspectRatio: "1:1" }, default: "", group: "Products" },
    { key: "product3Label", role: "product_name",label: "Product 3 label", type: { kind: "text", maxLength: 30 }, default: "Insulation", group: "Products" },
    { key: "product4Image", role: "hero_media",label: "Product 4 image", type: { kind: "image", aspectRatio: "1:1" }, default: "", group: "Products" },
    { key: "product4Label", role: "product_name",label: "Product 4 label", type: { kind: "text", maxLength: 30 }, default: "Timber", group: "Products" },
    { key: "product5Image", role: "hero_media",label: "Product 5 image", type: { kind: "image", aspectRatio: "1:1" }, default: "", group: "Products" },
    { key: "product5Label", role: "product_name",label: "Product 5 label", type: { kind: "text", maxLength: 30 }, default: "Tools", group: "Products" },
    { key: "product6Image", role: "hero_media",label: "Product 6 image", type: { kind: "image", aspectRatio: "1:1" }, default: "", group: "Products" },
    { key: "product6Label", role: "product_name",label: "Product 6 label", type: { kind: "text", maxLength: 30 }, default: "Fixings", group: "Products" },
    { key: "backgroundImageUrl", role: "background_media",label: "Background photo", type: { kind: "image", aspectRatio: "16:9", recommendedWidthPx: 1920 }, default: "https://ik.imagekit.io/9mrgsv2rp/ChatGPT%20Image%20Jul%202,%202026,%2002_36_48%20PM.png?updatedAt=1782977828849", group: "Background", description: "Full-bleed photo behind the copy + product grid. Leave empty for the plain dark surface." },
    { key: "backgroundImageOpacity", role: "opacity",label: "Background photo opacity", type: { kind: "number", min: 0, max: 1, step: 0.05 }, default: 1, group: "Background" },
    { key: "visualEffect", label: "Background effect", type: { kind: "select", options: [{ value: "grid", label: "Grid pattern (default)" }, { value: "none", label: "None" }] }, default: "grid", description: "Subtle Magic UI grid layered above the background photo.", group: "Background" }
  ],
  animations: ["none", "fade-in"],
  aiPrompts: {
    explain: "Explain when the Product-Showroom hero works best for merchants.",
    improve: "Suggest which product tile to feature.",
    rewrite: "Rewrite the headline for a materials merchant.",
    suggestAlternative: "Which hero would work for a service merchant with no product catalogue?",
    score: "Score this hero on the six standard axes."
  },
  thumbnail: "",
  telemetryTags: ["hero", "merchant", "product-grid", "trade-account"],
  bestForVerticals: ["building-merchant", "builders-supplies", "tool-hire", "materials-yard", "kitchen-showroom", "bathroom-showroom", "timber-merchant"],
  defaultConfig: () => ({
    eyebrow: "Yard open · Monday to Saturday",
    heading: "Everything you need to get on site.",
    subheading: "Building materials, tools and consumables in stock. Same-day delivery inside our zone. Trade account holders get 30-day credit.",
    primaryCtaLabel: "Open a trade account",
    primaryCtaHref: "#trade-account",
    secondaryCtaLabel: "Browse stock",
    secondaryCtaHref: "#shop",
    deliveryChip: "Same-day within 15 miles",
    tradeAccountChip: "30-day trade credit",
    product1Image: "",
    product1Label: "Cement 25kg",
    product1Badge: "New",
    product2Image: "",
    product2Label: "Plasterboard",
    product3Image: "",
    product3Label: "Insulation",
    product4Image: "",
    product4Label: "Timber",
    product5Image: "",
    product5Label: "Tools",
    product6Image: "",
    product6Label: "Fixings",
    backgroundImageUrl:
      "https://ik.imagekit.io/9mrgsv2rp/ChatGPT%20Image%20Jul%202,%202026,%2002_36_48%20PM.png?updatedAt=1782977828849",
    backgroundImageOpacity: 1,
    visualEffect: "grid"
  }),
  renderer: ProductShowroomHero
};

sectionRegistry.register(registration);
