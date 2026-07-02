"use client";

// Add-on wrapper — Trade Connections.
//
// Wraps TradeConnectionsCarousel. Trade Connections is designed for PDP
// surfaces (auto-scroll carousel under each product), so on a page-level
// slot the wrapper renders a category-grouped card grid using the local
// trades pool the storefront hydrator provides.
//
// Content — the pool of local trades — is fetched by the storefront
// hydrator via the existing trade-connections lookup. Studio owns the
// section's appearance (heading copy, colours, radius, card grid style).

import { TradeConnectionsCarousel } from "@/components/trade-off/TradeConnectionsCarousel";
import { defineAddonSection } from "./_adapter";

type TradeCard = React.ComponentProps<
  typeof TradeConnectionsCarousel
>["cards"][number];

type TradeConnectionsAddonConfig = {
  heading: string;
  helperCopy: string;
  disclaimerCopy: string;
  headingColor: string;
  helperColor: string;
  background: string;
  cardRadius: number;
  gridColumns: "one" | "two" | "three" | "four";
};

type TradeConnectionsAddonData = {
  cards: TradeCard[];
  productSlug: string;
};

function TradeConnectionsInner({
  data,
  addonData
}: {
  config: TradeConnectionsAddonConfig;
  data: { slug: string; merchantName: string };
  addonData: TradeConnectionsAddonData;
  tokens: Record<string, unknown>;
  mode: string;
}) {
  const { cards, productSlug } = addonData;
  if (!cards || cards.length === 0) return null;
  return (
    <div data-addon-section="trade_connections">
      <TradeConnectionsCarousel
        cards={cards}
        merchantSlug={data.slug}
        merchantName={data.merchantName}
        productSlug={productSlug}
      />
    </div>
  );
}

defineAddonSection<TradeConnectionsAddonConfig, TradeConnectionsAddonData>({
  addonSlug: "trade_connections",
  library: "categories",
  name: "Trade Connections",
  description:
    "Local trades who install products in this category. Auto-scroll carousel. Appearance only.",
  thumbnail: "/studio/thumbnails/trade-connections.png",
  bestForVerticals: [
    "building-merchant",
    "builders-supplies",
    "tool-hire",
    "materials-yard"
  ],
  animations: ["none", "fade", "auto-scroll"],
  editableFields: [
    {
      key: "heading",
      label: "Heading",
      type: { kind: "text", maxLength: 80 },
      default: "Local trades who install this kind of product",
      priority: "text",
      aiPromptable: true,
      group: "Copy"
    },
    {
      key: "helperCopy",
      label: "Helper copy",
      type: { kind: "text", maxLength: 160 },
      default:
        "These are independent local trades — tap any card to see their profile.",
      priority: "text",
      aiPromptable: true,
      group: "Copy"
    },
    {
      key: "disclaimerCopy",
      label: "Disclaimer copy",
      type: { kind: "text", maxLength: 240, multiline: true },
      default:
        "These are independent businesses — not employed, vetted or verified by the merchant. Research each trade yourself, read their reviews, and request a written quote before any work begins.",
      priority: "text",
      aiPromptable: false,
      group: "Copy",
      description:
        "Legal disclaimer. Please only edit if your legal team has approved the wording."
    },
    {
      key: "headingColor",
      label: "Heading colour",
      type: { kind: "color", brandBindable: true },
      default: "#0A0A0A",
      bindsTo: "color.ink",
      group: "Colour"
    },
    {
      key: "helperColor",
      label: "Helper text colour",
      type: { kind: "color", brandBindable: true },
      default: "#525252",
      bindsTo: "color.muted",
      group: "Colour"
    },
    {
      key: "background",
      label: "Background",
      type: { kind: "color", brandBindable: true },
      default: "#FAFAFA",
      bindsTo: "color.subtle",
      group: "Colour"
    },
    {
      key: "cardRadius",
      label: "Card corner radius",
      type: { kind: "number", min: 0, max: 32, step: 2, unit: "px" },
      default: 16,
      bindsTo: "radius.md",
      group: "Shape"
    },
    {
      key: "gridColumns",
      label: "Grid columns on desktop",
      type: {
        kind: "select",
        options: [
          { value: "one", label: "1" },
          { value: "two", label: "2" },
          { value: "three", label: "3" },
          { value: "four", label: "4" }
        ]
      },
      default: "three",
      group: "Layout"
    }
  ],
  defaultConfig: () => ({
    heading: "Local trades who install this kind of product",
    helperCopy:
      "These are independent local trades — tap any card to see their profile.",
    disclaimerCopy:
      "These are independent businesses — not employed, vetted or verified by the merchant. Research each trade yourself, read their reviews, and request a written quote before any work begins.",
    headingColor: "#0A0A0A",
    helperColor: "#525252",
    background: "#FAFAFA",
    cardRadius: 16,
    gridColumns: "three"
  }),
  inner: TradeConnectionsInner
});
