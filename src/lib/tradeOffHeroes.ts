// Per-trade hero banners — the default hero image a tradesperson's
// /<slug> profile uses when they have not uploaded their own
// custom_app_hero_url. Also used on /trade-off/trades to render the
// "Trade examples" landscape cards.
//
// Slugs match TRADE_OFF_TRADES; trades without a hero fall back to the
// generic Xrated landing hero on profiles.

export const TRADE_OFF_HERO_IMAGES: Record<string, string> = {
  carpenter:
    "https://ik.imagekit.io/5vv5pw26q/Untitleddsdsaaaaaaadsasd.png?updatedAt=1784617900936",
  bricklayer:
    "https://ik.imagekit.io/9mrgsv2rp/ChatGPT%20Image%20Jul%2017,%202026,%2006_05_51%20AM.png?updatedAt=1784243168614",
  plumber:
    "https://ik.imagekit.io/9mrgsv2rp/ChatGPT%20Image%20Jul%206,%202026,%2002_03_04%20PM.png?updatedAt=1783321401355",
  scaffolder:
    "https://msdonkkechxzgagyguoe.supabase.co/storage/v1/object/public/product-images/imagekit-import/337192aa1295-ChatGPT_Image_Jun_25__2026__12_31_55_PM.png",
  electrician:
    "https://msdonkkechxzgagyguoe.supabase.co/storage/v1/object/public/product-images/imagekit-import/ed1102196969-ChatGPT_Image_Jun_25__2026__12_32_51_PM.png",
  drywaller:
    "https://ik.imagekit.io/9mrgsv2rp/ChatGPT%20Image%20Jul%2017,%202026,%2007_38_49%20AM.png?updatedAt=1784248755973",
  stonemason:
    "https://msdonkkechxzgagyguoe.supabase.co/storage/v1/object/public/product-images/imagekit-import/ee7d5c9fa9bb-ChatGPT_Image_Jun_25__2026__12_48_03_PM.png",
  tiler:
    "https://ik.imagekit.io/9mrgsv2rp/ChatGPT%20Image%20Jul%2017,%202026,%2007_08_32%20AM.png?updatedAt=1784246934783",
  painter:
    "https://msdonkkechxzgagyguoe.supabase.co/storage/v1/object/public/product-images/imagekit-import/82f31612a3b4-ChatGPT_Image_Jun_25__2026__02_06_44_PM.png",
  roofer:
    "https://ik.imagekit.io/9mrgsv2rp/b7e8d507628ea97aaae03bdbd1a81154.jpg?updatedAt=1784124333716",
  joiner:
    "https://ik.imagekit.io/9mrgsv2rp/93bf4c7289b643b54c98fec085a28aa2.jpg?updatedAt=1784121207097",
  plasterer:
    "https://ik.imagekit.io/9mrgsv2rp/ChatGPT%20Image%20Jul%2017,%202026,%2005_47_24%20AM.png?updatedAt=1784242063425",
  "general-builder":
    "https://ik.imagekit.io/9mrgsv2rp/Untitleddfafddffsddddddddsd.png?updatedAt=1783724926573",
  "building-merchant":
    "https://ik.imagekit.io/5vv5pw26q/ChatGPT%20Image%20Jul%2022,%202026,%2005_43_21%20AM.png?updatedAt=1784673816597",
  "metal-engineer":
    "https://msdonkkechxzgagyguoe.supabase.co/storage/v1/object/public/product-images/imagekit-import/a53af0684cfb-ChatGPT_Image_Jun_27__2026__10_51_31_AM.png",
  "heavy-machinery":
    "https://ik.imagekit.io/9mrgsv2rp/ChatGPT%20Image%20Jul%202,%202026,%2001_29_50%20PM.png?updatedAt=1782973809295",
  "tool-hire":
    "https://ik.imagekit.io/9mrgsv2rp/ChatGPT%20Image%20Jul%201,%202026,%2010_17_59%20PM.png?updatedAt=1782919107938",
  landscaper:
    "https://ik.imagekit.io/9mrgsv2rp/ChatGPT%20Image%20Jul%2015,%202026,%2007_21_23%20AM.png?updatedAt=1784074905020",
  "gas-engineer":
    "https://msdonkkechxzgagyguoe.supabase.co/storage/v1/object/public/product-images/imagekit-import/c3f53c88ca19-ChatGPT_Image_Jun_27__2026__10_59_11_AM.png",
  "concrete-finisher":
    "https://msdonkkechxzgagyguoe.supabase.co/storage/v1/object/public/product-images/imagekit-import/aa7b5586adcd-ChatGPT_Image_Jun_27__2026__11_00_12_AM.png",
  "concrete-specialist":
    "https://msdonkkechxzgagyguoe.supabase.co/storage/v1/object/public/product-images/imagekit-import/aa7b5586adcd-ChatGPT_Image_Jun_27__2026__11_00_12_AM.png",
  "stair-fitter":
    "https://msdonkkechxzgagyguoe.supabase.co/storage/v1/object/public/product-images/imagekit-import/00064b78c32e-ChatGPT_Image_Jun_27__2026__11_05_18_AM.png",
  "kitchen-fitter":
    "https://ik.imagekit.io/9mrgsv2rp/ChatGPT%20Image%20Jul%2013,%202026,%2001_52_07%20PM.png?updatedAt=1783925545344",
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
    "https://ik.imagekit.io/9mrgsv2rp/9a02b8ba5a1194ac6c1738ddcc8d9067.jpg?updatedAt=1783771301197",
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
    "https://msdonkkechxzgagyguoe.supabase.co/storage/v1/object/public/product-images/imagekit-import/a3f1da513ca6-ChatGPT_Image_Jun_28__2026__08_32_45_PM.png",
  "swimming-pool-installer":
    "https://ik.imagekit.io/9mrgsv2rp/d1c00eddcda0dbc1960be21c05ba7cf4%20(1).jpg?updatedAt=1784134372034",
  "estate-agent":
    "https://ik.imagekit.io/9mrgsv2rp/d6401a8646cdba6db3d1fe46f665c8fd.jpg?updatedAt=1784126810194",
  locksmith:
    "https://ik.imagekit.io/9mrgsv2rp/Untitledfdfddd.png?updatedAt=1782889000676",
  "logo-designer":
    "https://ik.imagekit.io/5vv5pw26q/Untitledzxczxdddddddddfdasdddfffdddddxdsdxczxcxcxccccddcccccccccvddvvvdv.png?updatedAt=1784690081752",
  "social-media-marketer":
    "https://ik.imagekit.io/5vv5pw26q/af981685a21ef236529576ba5c163fe2.jpg?updatedAt=1784596413569",
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
  "driveway-installer":
    "https://ik.imagekit.io/9mrgsv2rp/ChatGPT%20Image%20Jul%2017,%202026,%2007_26_13%20AM.png?updatedAt=1784247996214",
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
  "furniture-maker":
    "https://ik.imagekit.io/9mrgsv2rp/f6906127ca6b272c347366e0ec1049f9.jpg?updatedAt=1784120794983",
  "joinery-workshop": "joiner",
  "worktop-manufacturer": "kitchen-fitter",
  "glass-manufacturer": "window-fitter",
  "shed-manufacturer": "joiner",
  "garden-room-manufacturer": "general-builder",
  "steel-fabricator": "metal-engineer",
  // Sales additions
  "timber-merchant":
    "https://ik.imagekit.io/9mrgsv2rp/ChatGPT%20Image%20Jul%206,%202026,%2002_51_24%20AM.png?updatedAt=1783281109102",
  "plumbing-merchant": "builders-supplies",
  "electrical-wholesaler": "builders-supplies",
  "tile-shop": "tiler",
  "flooring-shop": "builders-supplies",
  "door-showroom": "window-fitter",
  "window-showroom": "window-fitter",
  "bathroom-showroom": "plumber",
  "paint-merchant": "painter",
  ironmongery: "builders-supplies",
  "ppe-supplier":
    "https://ik.imagekit.io/9mrgsv2rp/ChatGPT%20Image%20Jul%201,%202026,%2001_50_24%20PM.png?updatedAt=1782888644770",
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
