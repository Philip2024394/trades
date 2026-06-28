// Per-trade hero banners — the default hero image a tradesperson's
// /<slug> profile uses when they have not uploaded their own
// custom_app_hero_url. Also used on /trade-off/trades to render the
// "Trade examples" landscape cards.
//
// Slugs match TRADE_OFF_TRADES; trades without a hero fall back to the
// generic Xrated landing hero on profiles.

export const TRADE_OFF_HERO_IMAGES: Record<string, string> = {
  carpenter:
    "https://msdonkkechxzgagyguoe.supabase.co/storage/v1/object/public/product-images/imagekit-import/3643cc34433c-ChatGPT_Image_Jun_25__2026__12_21_55_PM.png",
  bricklayer:
    "https://msdonkkechxzgagyguoe.supabase.co/storage/v1/object/public/product-images/imagekit-import/e727a6f64778-Untitledasdasdasdsdsdsdasss.png",
  plumber:
    "https://msdonkkechxzgagyguoe.supabase.co/storage/v1/object/public/product-images/imagekit-import/b976fea78218-ChatGPT_Image_Jun_25__2026__12_27_12_PM.png",
  scaffolder:
    "https://msdonkkechxzgagyguoe.supabase.co/storage/v1/object/public/product-images/imagekit-import/337192aa1295-ChatGPT_Image_Jun_25__2026__12_31_55_PM.png",
  electrician:
    "https://msdonkkechxzgagyguoe.supabase.co/storage/v1/object/public/product-images/imagekit-import/ed1102196969-ChatGPT_Image_Jun_25__2026__12_32_51_PM.png",
  drywaller:
    "https://msdonkkechxzgagyguoe.supabase.co/storage/v1/object/public/product-images/imagekit-import/968696e6815f-ChatGPT_Image_Jun_25__2026__12_38_50_PM.png",
  stonemason:
    "https://msdonkkechxzgagyguoe.supabase.co/storage/v1/object/public/product-images/imagekit-import/ee7d5c9fa9bb-ChatGPT_Image_Jun_25__2026__12_48_03_PM.png",
  tiler:
    "https://msdonkkechxzgagyguoe.supabase.co/storage/v1/object/public/product-images/imagekit-import/cf01981a20a3-ChatGPT_Image_Jun_25__2026__12_50_00_PM.png",
  painter:
    "https://msdonkkechxzgagyguoe.supabase.co/storage/v1/object/public/product-images/imagekit-import/82f31612a3b4-ChatGPT_Image_Jun_25__2026__02_06_44_PM.png",
  roofer:
    "https://msdonkkechxzgagyguoe.supabase.co/storage/v1/object/public/product-images/imagekit-import/dcebd6ac4310-ChatGPT_Image_Jun_27__2026__10_41_47_AM.png",
  joiner:
    "https://msdonkkechxzgagyguoe.supabase.co/storage/v1/object/public/product-images/imagekit-import/8a982c28982a-ChatGPT_Image_Jun_27__2026__10_42_41_AM.png",
  plasterer:
    "https://msdonkkechxzgagyguoe.supabase.co/storage/v1/object/public/product-images/imagekit-import/ba4a53a1cd81-ChatGPT_Image_Jun_27__2026__10_45_04_AM.png",
  "general-builder":
    "https://msdonkkechxzgagyguoe.supabase.co/storage/v1/object/public/product-images/imagekit-import/6e66c24ee2e1-ChatGPT_Image_Jun_27__2026__10_46_08_AM.png",
  "building-merchant":
    "https://msdonkkechxzgagyguoe.supabase.co/storage/v1/object/public/product-images/imagekit-import/6c94a12f7bc9-ChatGPT_Image_Jun_27__2026__10_48_59_AM.png",
  "metal-engineer":
    "https://msdonkkechxzgagyguoe.supabase.co/storage/v1/object/public/product-images/imagekit-import/a53af0684cfb-ChatGPT_Image_Jun_27__2026__10_51_31_AM.png",
  "heavy-machinery":
    "https://msdonkkechxzgagyguoe.supabase.co/storage/v1/object/public/product-images/imagekit-import/e01f86a92082-ChatGPT_Image_Jun_27__2026__10_52_36_AM.png",
  "tool-hire":
    "https://msdonkkechxzgagyguoe.supabase.co/storage/v1/object/public/product-images/imagekit-import/e3897fc2b891-ChatGPT_Image_Jun_27__2026__10_55_22_AM.png",
  landscaper:
    "https://msdonkkechxzgagyguoe.supabase.co/storage/v1/object/public/product-images/imagekit-import/438f1611c708-ChatGPT_Image_Jun_27__2026__10_57_48_AM.png",
  "gas-engineer":
    "https://msdonkkechxzgagyguoe.supabase.co/storage/v1/object/public/product-images/imagekit-import/c3f53c88ca19-ChatGPT_Image_Jun_27__2026__10_59_11_AM.png",
  "concrete-finisher":
    "https://msdonkkechxzgagyguoe.supabase.co/storage/v1/object/public/product-images/imagekit-import/aa7b5586adcd-ChatGPT_Image_Jun_27__2026__11_00_12_AM.png",
  "concrete-specialist":
    "https://msdonkkechxzgagyguoe.supabase.co/storage/v1/object/public/product-images/imagekit-import/aa7b5586adcd-ChatGPT_Image_Jun_27__2026__11_00_12_AM.png",
  "stair-fitter":
    "https://msdonkkechxzgagyguoe.supabase.co/storage/v1/object/public/product-images/imagekit-import/00064b78c32e-ChatGPT_Image_Jun_27__2026__11_05_18_AM.png",
  "kitchen-fitter":
    "https://msdonkkechxzgagyguoe.supabase.co/storage/v1/object/public/product-images/imagekit-import/55584d588caf-ChatGPT_Image_Jun_27__2026__11_03_54_AM.png",
  "kitchen-showroom":
    "https://msdonkkechxzgagyguoe.supabase.co/storage/v1/object/public/product-images/imagekit-import/2f468ab28af6-ChatGPT_Image_Jun_28__2026__01_57_34_PM.png",
  "kitchen-manufacturer":
    "https://msdonkkechxzgagyguoe.supabase.co/storage/v1/object/public/product-images/imagekit-import/6a31fc2160c8-ChatGPT_Image_Jun_28__2026__02_06_14_PM.png",
  "window-fitter":
    "https://msdonkkechxzgagyguoe.supabase.co/storage/v1/object/public/product-images/imagekit-import/630da56e3e20-ChatGPT_Image_Jun_27__2026__11_03_23_AM.png",
  "crane-operator":
    "https://msdonkkechxzgagyguoe.supabase.co/storage/v1/object/public/product-images/imagekit-import/95008e68b0b5-ChatGPT_Image_Jun_27__2026__11_26_20_AM.png",
  groundworker:
    "https://msdonkkechxzgagyguoe.supabase.co/storage/v1/object/public/product-images/imagekit-import/8e6c3befe79f-Jun_27__2026__11_22_28_AM.png",
  "security-installer":
    "https://msdonkkechxzgagyguoe.supabase.co/storage/v1/object/public/product-images/imagekit-import/bbb0cfea4416-ChatGPT_Image_Jun_28__2026__03_09_10_PM.png",
  "builders-supplies":
    "https://msdonkkechxzgagyguoe.supabase.co/storage/v1/object/public/product-images/imagekit-import/8cd7696e101d-ChatGPT_Image_Jun_27__2026__11_36_16_AM.png",
  formworker:
    "https://msdonkkechxzgagyguoe.supabase.co/storage/v1/object/public/product-images/imagekit-import/2e545d6ae39f-ChatGPT_Image_Jun_27__2026__11_51_42_AM.png",
  "insulation-installer":
    "https://msdonkkechxzgagyguoe.supabase.co/storage/v1/object/public/product-images/imagekit-import/b0d3ffa8c38e-ChatGPT_Image_Jun_27__2026__11_50_42_AM.png",
  "trim-carpenter":
    "https://msdonkkechxzgagyguoe.supabase.co/storage/v1/object/public/product-images/imagekit-import/b7391dae46be-ChatGPT_Image_Jun_27__2026__11_53_16_AM.png",
  "block-layer":
    "https://msdonkkechxzgagyguoe.supabase.co/storage/v1/object/public/product-images/imagekit-import/adec792f45a9-ChatGPT_Image_Jun_27__2026__11_57_06_AM.png",
  "taper-and-finisher":
    "https://msdonkkechxzgagyguoe.supabase.co/storage/v1/object/public/product-images/imagekit-import/b865e2ce0ebf-ChatGPT_Image_Jun_27__2026__12_00_33_PM.png",
  renderer:
    "https://msdonkkechxzgagyguoe.supabase.co/storage/v1/object/public/product-images/imagekit-import/b1f87c4d4490-ChatGPT_Image_Jun_27__2026__12_01_54_PM.png",
  "site-safety":
    "https://msdonkkechxzgagyguoe.supabase.co/storage/v1/object/public/product-images/imagekit-import/b633af8d8305-ChatGPT_Image_Jun_27__2026__12_11_04_PM.png",
  "water-drilling":
    "https://msdonkkechxzgagyguoe.supabase.co/storage/v1/object/public/product-images/imagekit-import/a83a3c24798d-ChatGPT_Image_Jun_27__2026__12_14_53_PM.png",
  "fascia-and-soffit":
    "https://msdonkkechxzgagyguoe.supabase.co/storage/v1/object/public/product-images/imagekit-import/dc49827bfb79-ChatGPT_Image_Jun_27__2026__12_16_10_PM.png",
  demolition:
    "https://msdonkkechxzgagyguoe.supabase.co/storage/v1/object/public/product-images/imagekit-import/3525c5e1e659-ChatGPT_Image_Jun_27__2026__12_17_15_PM.png",
  "site-canteen":
    "https://msdonkkechxzgagyguoe.supabase.co/storage/v1/object/public/product-images/imagekit-import/e73ebd91fb29-ChatGPT_Image_Jun_27__2026__12_19_36_PM.png",
  "damp-proofer":
    "https://msdonkkechxzgagyguoe.supabase.co/storage/v1/object/public/product-images/imagekit-import/c171d419c931-ChatGPT_Image_Jun_28__2026__02_45_55_PM.png",
  "drainage-engineer":
    "https://msdonkkechxzgagyguoe.supabase.co/storage/v1/object/public/product-images/imagekit-import/476190f63f89-ChatGPT_Image_Jun_28__2026__02_48_30_PM.png",
  "chimney-sweep":
    "https://msdonkkechxzgagyguoe.supabase.co/storage/v1/object/public/product-images/imagekit-import/f3ae400d19ce-ChatGPT_Image_Jun_28__2026__02_52_42_PM.png",
  "pest-control":
    "https://msdonkkechxzgagyguoe.supabase.co/storage/v1/object/public/product-images/imagekit-import/7a59176aaa15-ChatGPT_Image_Jun_28__2026__02_57_02_PM.png",
  "tree-surgeon":
    "https://msdonkkechxzgagyguoe.supabase.co/storage/v1/object/public/product-images/imagekit-import/82162e05d757-ChatGPT_Image_Jun_28__2026__03_02_19_PM.png",
  "asbestos-removal":
    "https://msdonkkechxzgagyguoe.supabase.co/storage/v1/object/public/product-images/imagekit-import/b3c67a9eac45-ChatGPT_Image_Jun_28__2026__03_02_58_PM.png",
  "lead-worker":
    "https://msdonkkechxzgagyguoe.supabase.co/storage/v1/object/public/product-images/imagekit-import/54a569fe9307-ChatGPT_Image_Jun_28__2026__03_05_56_PM.png",
  "post-construction-cleaner":
    "https://msdonkkechxzgagyguoe.supabase.co/storage/v1/object/public/product-images/imagekit-import/a13206876447-ChatGPT_Image_Jun_28__2026__03_07_41_PM.png",
  "flooring-installer":
    "https://msdonkkechxzgagyguoe.supabase.co/storage/v1/object/public/product-images/imagekit-import/f96b81e327c5-ChatGPT_Image_Jun_28__2026__03_13_54_PM.png",
  "conservatory-installer":
    "https://msdonkkechxzgagyguoe.supabase.co/storage/v1/object/public/product-images/imagekit-import/b06c47caa560-ChatGPT_Image_Jun_28__2026__03_15_51_PM.png",
  "solar-installer":
    "https://msdonkkechxzgagyguoe.supabase.co/storage/v1/object/public/product-images/imagekit-import/f338668d4864-ChatGPT_Image_Jun_28__2026__03_17_42_PM.png",
  "ev-charger-installer":
    "https://msdonkkechxzgagyguoe.supabase.co/storage/v1/object/public/product-images/imagekit-import/583e2b5ffd43-ChatGPT_Image_Jun_28__2026__03_19_14_PM.png",
  "skip-hire":
    "https://msdonkkechxzgagyguoe.supabase.co/storage/v1/object/public/product-images/imagekit-import/9cb5edc6e836-ChatGPT_Image_Jun_28__2026__03_29_26_PM.png",
  "pump-service":
    "https://msdonkkechxzgagyguoe.supabase.co/storage/v1/object/public/product-images/imagekit-import/3df2575f92d0-ChatGPT_Image_Jun_28__2026__03_26_07_PM.png",
  "mobile-mechanic":
    "https://msdonkkechxzgagyguoe.supabase.co/storage/v1/object/public/product-images/imagekit-import/c61011596ed6-ChatGPT_Image_Jun_28__2026__03_31_31_PM.png",
  "door-manufacturer":
    "https://msdonkkechxzgagyguoe.supabase.co/storage/v1/object/public/product-images/imagekit-import/a3f1da513ca6-ChatGPT_Image_Jun_28__2026__08_32_45_PM.png"
};

// Banner fallback map — every Phase 2 trade points at the closest
// existing trade whose banner art reads sensibly for it. Lets all 67
// new templates inherit a hand-picked banner immediately, so the
// gallery looks complete on day one. Real banners can replace these
// over time by adding the slug to TRADE_OFF_HERO_IMAGES.
//
// Exported so the gallery on /trade-off/trades can reuse the same
// chain to pick the closest LIVE DEMO PROFILE for each card — same
// reasoning as the banner: Kitchen Manufacture card inherits Kitchen
// Fitter's demo, EV Charger Installer inherits Electrician's, etc.
export const BANNER_FALLBACK_BY_TRADE: Record<string, string> = {
  // Service additions
  "sash-window-restorer": "window-fitter",
  "garden-designer": "landscaper",
  // Installation additions
  "door-fitter": "window-fitter",
  "bathroom-fitter": "plumber",
  "heat-pump-installer": "plumber",
  "smart-home-installer": "electrician",
  "garage-door-installer": "window-fitter",
  "gutter-installer": "fascia-and-soffit",
  "driveway-installer": "groundworker",
  "fencing-installer": "landscaper",
  "shutter-installer": "window-fitter",
  "aerial-satellite-installer": "electrician",
  "garden-room-installer": "general-builder",
  "awning-installer": "window-fitter",
  // Manufacture additions
  "staircase-manufacturer": "stair-fitter",
  "door-manufacturer": "joiner",
  "window-manufacturer": "window-fitter",
  "flooring-manufacturer": "joiner",
  "conservatory-manufacturer": "window-fitter",
  "wardrobe-maker": "kitchen-fitter",
  "furniture-maker": "joiner",
  "joinery-workshop": "joiner",
  "worktop-manufacturer": "kitchen-fitter",
  "glass-manufacturer": "window-fitter",
  "shed-manufacturer": "joiner",
  "garden-room-manufacturer": "general-builder",
  "steel-fabricator": "metal-engineer",
  // Sales additions
  "timber-merchant": "building-merchant",
  "plumbing-merchant": "builders-supplies",
  "electrical-wholesaler": "builders-supplies",
  "tile-shop": "tiler",
  "flooring-shop": "builders-supplies",
  "door-showroom": "window-fitter",
  "window-showroom": "window-fitter",
  "bathroom-showroom": "plumber",
  "paint-merchant": "painter",
  ironmongery: "builders-supplies",
  "ppe-supplier": "site-safety",
  "tool-shop": "tool-hire",
  "landscape-supplies": "landscaper",
  "aggregate-supplier": "groundworker",
  "roofing-supplies": "roofer",
  "insulation-supplies": "insulation-installer",
  // Hire additions
  "plant-hire": "heavy-machinery",
  "portaloo-hire": "site-canteen",
  "scaffolding-hire": "scaffolder",
  "generator-hire": "tool-hire",
  "van-hire": "heavy-machinery",
  "crane-hire": "crane-operator",
  "waste-removal": "demolition",
  "minidigger-hire": "heavy-machinery",
  "storage-container-hire": "heavy-machinery"
};

export function tradeHeroFor(slug: string): string | null {
  if (TRADE_OFF_HERO_IMAGES[slug]) return TRADE_OFF_HERO_IMAGES[slug];
  // Walk the fallback chain — protects us if a future fallback ever
  // points to another fallback target by mistake.
  const seen = new Set<string>();
  let cur: string | undefined = BANNER_FALLBACK_BY_TRADE[slug];
  while (cur && !seen.has(cur)) {
    if (TRADE_OFF_HERO_IMAGES[cur]) return TRADE_OFF_HERO_IMAGES[cur];
    seen.add(cur);
    cur = BANNER_FALLBACK_BY_TRADE[cur];
  }
  return null;
}
