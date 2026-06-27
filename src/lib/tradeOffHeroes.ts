// Per-trade hero banners — the default hero image a tradesperson's
// /<slug> profile uses when they have not uploaded their own
// custom_app_hero_url. Also used on /trade-off/trades to render the
// "Trade examples" landscape cards.
//
// Slugs match TRADE_OFF_TRADES; trades without a hero fall back to the
// generic Xrated landing hero on profiles.

export const TRADE_OFF_HERO_IMAGES: Record<string, string> = {
  carpenter:
    "https://ik.imagekit.io/9mrgsv2rp/ChatGPT%20Image%20Jun%2025,%202026,%2012_21_55%20PM.png?updatedAt=1782364958280",
  bricklayer:
    "https://ik.imagekit.io/9mrgsv2rp/Untitledasdasdasdsdsdsdasss.png?updatedAt=1782365032826",
  plumber:
    "https://ik.imagekit.io/9mrgsv2rp/ChatGPT%20Image%20Jun%2025,%202026,%2012_27_12%20PM.png?updatedAt=1782365260211",
  scaffolder:
    "https://ik.imagekit.io/9mrgsv2rp/ChatGPT%20Image%20Jun%2025,%202026,%2012_31_55%20PM.png?updatedAt=1782365534412",
  electrician:
    "https://ik.imagekit.io/9mrgsv2rp/ChatGPT%20Image%20Jun%2025,%202026,%2012_32_51%20PM.png?updatedAt=1782365592907",
  drywaller:
    "https://ik.imagekit.io/9mrgsv2rp/ChatGPT%20Image%20Jun%2025,%202026,%2012_38_50%20PM.png?updatedAt=1782365955013",
  stonemason:
    "https://ik.imagekit.io/9mrgsv2rp/ChatGPT%20Image%20Jun%2025,%202026,%2012_48_03%20PM.png?updatedAt=1782366504839",
  tiler:
    "https://ik.imagekit.io/9mrgsv2rp/ChatGPT%20Image%20Jun%2025,%202026,%2012_50_00%20PM.png?updatedAt=1782366620814",
  painter:
    "https://ik.imagekit.io/9mrgsv2rp/ChatGPT%20Image%20Jun%2025,%202026,%2002_06_44%20PM.png?updatedAt=1782371229670",
  roofer:
    "https://ik.imagekit.io/9mrgsv2rp/ChatGPT%20Image%20Jun%2027,%202026,%2010_41_47%20AM.png",
  joiner:
    "https://ik.imagekit.io/9mrgsv2rp/ChatGPT%20Image%20Jun%2027,%202026,%2010_42_41%20AM.png",
  plasterer:
    "https://ik.imagekit.io/9mrgsv2rp/ChatGPT%20Image%20Jun%2027,%202026,%2010_45_04%20AM.png",
  "general-builder":
    "https://ik.imagekit.io/9mrgsv2rp/ChatGPT%20Image%20Jun%2027,%202026,%2010_46_08%20AM.png",
  "building-merchant":
    "https://ik.imagekit.io/9mrgsv2rp/ChatGPT%20Image%20Jun%2027,%202026,%2010_48_59%20AM.png",
  "metal-engineer":
    "https://ik.imagekit.io/9mrgsv2rp/ChatGPT%20Image%20Jun%2027,%202026,%2010_51_31%20AM.png",
  "heavy-machinery":
    "https://ik.imagekit.io/9mrgsv2rp/ChatGPT%20Image%20Jun%2027,%202026,%2010_52_36%20AM.png",
  "tool-hire":
    "https://ik.imagekit.io/9mrgsv2rp/ChatGPT%20Image%20Jun%2027,%202026,%2010_55_22%20AM.png",
  landscaper:
    "https://ik.imagekit.io/9mrgsv2rp/ChatGPT%20Image%20Jun%2027,%202026,%2010_57_48%20AM.png",
  "gas-engineer":
    "https://ik.imagekit.io/9mrgsv2rp/ChatGPT%20Image%20Jun%2027,%202026,%2010_59_11%20AM.png",
  "concrete-finisher":
    "https://ik.imagekit.io/9mrgsv2rp/ChatGPT%20Image%20Jun%2027,%202026,%2011_00_12%20AM.png",
  "stair-fitter":
    "https://ik.imagekit.io/9mrgsv2rp/ChatGPT%20Image%20Jun%2027,%202026,%2011_05_18%20AM.png",
  "kitchen-fitter":
    "https://ik.imagekit.io/9mrgsv2rp/ChatGPT%20Image%20Jun%2027,%202026,%2011_03_54%20AM.png",
  "window-fitter":
    "https://ik.imagekit.io/9mrgsv2rp/ChatGPT%20Image%20Jun%2027,%202026,%2011_03_23%20AM.png"
};

export function tradeHeroFor(slug: string): string | null {
  return TRADE_OFF_HERO_IMAGES[slug] ?? null;
}
