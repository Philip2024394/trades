// Per-trade hero banners for the Xrated Trades /trade-off/<trade> filter
// pages. Slugs match TRADE_OFF_TRADES; trades without a hero fall back to
// the generic Xrated landing hero.

export const TRADE_OFF_HERO_IMAGES: Record<string, string> = {
  electrician:
    "https://msdonkkechxzgagyguoe.supabase.co/storage/v1/object/public/product-images/branding/trade-hero-electrician.png",
  plasterer:
    "https://msdonkkechxzgagyguoe.supabase.co/storage/v1/object/public/product-images/branding/trade-hero-plasterer.png",
  drywaller:
    "https://msdonkkechxzgagyguoe.supabase.co/storage/v1/object/public/product-images/branding/trade-hero-drywaller.png",
  stonemason:
    "https://msdonkkechxzgagyguoe.supabase.co/storage/v1/object/public/product-images/branding/trade-hero-stonemason.png",
  plumber:
    "https://msdonkkechxzgagyguoe.supabase.co/storage/v1/object/public/product-images/branding/trade-hero-plumber.png",
  "general-builder":
    "https://msdonkkechxzgagyguoe.supabase.co/storage/v1/object/public/product-images/branding/trade-hero-general-builder.png",
  bricklayer:
    "https://msdonkkechxzgagyguoe.supabase.co/storage/v1/object/public/product-images/branding/trade-hero-bricklayer.png",
  scaffolder:
    "https://msdonkkechxzgagyguoe.supabase.co/storage/v1/object/public/product-images/branding/trade-hero-scaffolder.png"
};

export function tradeHeroFor(slug: string): string | null {
  return TRADE_OFF_HERO_IMAGES[slug] ?? null;
}
