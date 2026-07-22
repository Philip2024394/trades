// Logo Studio catalog — trades + styles. Static seed data for the
// pick-your-trade + pick-your-style screens. Real preview images live
// in public/logo-templates/<style-slug>.jpg. When missing, the UI
// falls back to a gradient tile so the shell reads as designed even
// before the image library is populated.

export type LogoStyleSample = {
  tradeSlug: string;
  imageUrl:  string;   // absolute (ImageKit for now) or /public path once migrated
};

export type LogoStyle = {
  slug:         string;
  name:         string;
  tagline:      string;
  description:  string;
  gradient:     [string, string];   // fallback tile colours
  suitedTrades: string[];           // trade slugs this style leans toward
  vibe:         string;             // one-word feel tag
  samples:      LogoStyleSample[];  // real examples across trades
};

/** Pick the sample image best matched to the current trade context.
 *  Falls back to the first available sample, or null if the style
 *  has no samples yet (tile renders the gradient placeholder). */
export function pickSample(style: LogoStyle, tradeSlug: string | null): LogoStyleSample | null {
  if (style.samples.length === 0) return null;
  if (tradeSlug) {
    const match = style.samples.find((s) => s.tradeSlug === tradeSlug);
    if (match) return match;
  }
  return style.samples[0];
}

export const LOGO_STYLES: LogoStyle[] = [
  {
    slug:         "3d-metallic-badge",
    name:         "3D Metallic Badge",
    tagline:      "Dark wood, gold ribbon, chrome tool",
    description:  "The Facebook-ready trade badge. Deep wood grain background, brushed metal centrepiece, gold ribbon flag with your name. Reads professional on van wraps, workwear and directory listings.",
    gradient:     ["#1a1410", "#8B7355"],
    suitedTrades: ["carpenter", "roofer", "bricklayer", "scaffolder", "landscaper", "plumber"],
    vibe:         "Premium",
    samples: [
      // Carpenter / joinery (10 uniques)
      { tradeSlug: "carpenter", imageUrl: "https://ik.imagekit.io/5vv5pw26q/Untitledzxczxdddddddddf.png" },
      { tradeSlug: "carpenter", imageUrl: "https://ik.imagekit.io/5vv5pw26q/Untitledzxczxdddddddddfdasd.png" },
      { tradeSlug: "carpenter", imageUrl: "https://ik.imagekit.io/5vv5pw26q/Untitledzxczxdddddddddfdasddd.png" },
      { tradeSlug: "carpenter", imageUrl: "https://ik.imagekit.io/5vv5pw26q/Untitledzxczxdddddddddfdasdddff.png" },
      { tradeSlug: "carpenter", imageUrl: "https://ik.imagekit.io/5vv5pw26q/Untitledzxczxdddddddddfdasdddfff.png" },
      { tradeSlug: "carpenter", imageUrl: "https://ik.imagekit.io/5vv5pw26q/Untitledzxczxdddddddddfdasdddfffd.png" },
      { tradeSlug: "carpenter", imageUrl: "https://ik.imagekit.io/5vv5pw26q/Untitledzxczxdddddddddfdasdddfffdd.png" },
      { tradeSlug: "carpenter", imageUrl: "https://ik.imagekit.io/5vv5pw26q/Untitledzxczxdddddddddfdasdddfffddd.png" },
      { tradeSlug: "carpenter", imageUrl: "https://ik.imagekit.io/5vv5pw26q/Untitledzxczxdddddddddfdasdddfffdddd.png" },
      { tradeSlug: "carpenter", imageUrl: "https://ik.imagekit.io/5vv5pw26q/Untitledzxczxdddddddddfdasdddfffddddd.png" },
      // Plumbing (9)
      { tradeSlug: "plumber", imageUrl: "https://ik.imagekit.io/5vv5pw26q/Untitledzxczxdddddddddfdasdddfffdddddx.png" },
      { tradeSlug: "plumber", imageUrl: "https://ik.imagekit.io/5vv5pw26q/Untitledzxczxdddddddddfdasdddfffdddddxd.png" },
      { tradeSlug: "plumber", imageUrl: "https://ik.imagekit.io/5vv5pw26q/Untitledzxczxdddddddddfdasdddfffdddddxdsd.png" },
      { tradeSlug: "plumber", imageUrl: "https://ik.imagekit.io/5vv5pw26q/Untitledzxczxdddddddddfdasdddfffdddddxdsdxc.png" },
      { tradeSlug: "plumber", imageUrl: "https://ik.imagekit.io/5vv5pw26q/Untitledzxczxdddddddddfdasdddfffdddddxdsdxczxc.png" },
      { tradeSlug: "plumber", imageUrl: "https://ik.imagekit.io/5vv5pw26q/Untitledzxczxdddddddddfdasdddfffdddddxdsdxczxcxc.png" },
      { tradeSlug: "plumber", imageUrl: "https://ik.imagekit.io/5vv5pw26q/Untitledzxczxdddddddddfdasdddfffdddddxdsdxczxcxcxc.png" },
      { tradeSlug: "plumber", imageUrl: "https://ik.imagekit.io/5vv5pw26q/Untitledzxczxdddddddddfdasdddfffdddddxdsdxczxcxcxccc.png" },
      { tradeSlug: "plumber", imageUrl: "https://ik.imagekit.io/5vv5pw26q/Untitledzxczxdddddddddfdasdddfffdddddxdsdxczxcxcxcccc.png" },
      // Bricklayer (9)
      { tradeSlug: "bricklayer", imageUrl: "https://ik.imagekit.io/5vv5pw26q/Untitledzxczxdddddddddfdasdddfffdddddxdsdxczxcxcxccccd.png" },
      { tradeSlug: "bricklayer", imageUrl: "https://ik.imagekit.io/5vv5pw26q/Untitledzxczxdddddddddfdasdddfffdddddxdsdxczxcxcxccccdd.png" },
      { tradeSlug: "bricklayer", imageUrl: "https://ik.imagekit.io/5vv5pw26q/Untitledzxczxdddddddddfdasdddfffdddddxdsdxczxcxcxccccddcc.png" },
      { tradeSlug: "bricklayer", imageUrl: "https://ik.imagekit.io/5vv5pw26q/Untitledzxczxdddddddddfdasdddfffdddddxdsdxczxcxcxccccddccc.png" },
      { tradeSlug: "bricklayer", imageUrl: "https://ik.imagekit.io/5vv5pw26q/Untitledzxczxdddddddddfdasdddfffdddddxdsdxczxcxcxccccddcccc.png" },
      { tradeSlug: "bricklayer", imageUrl: "https://ik.imagekit.io/5vv5pw26q/Untitledzxczxdddddddddfdasdddfffdddddxdsdxczxcxcxccccddccccc.png" },
      { tradeSlug: "bricklayer", imageUrl: "https://ik.imagekit.io/5vv5pw26q/Untitledzxczxdddddddddfdasdddfffdddddxdsdxczxcxcxccccddcccccc.png" },
      { tradeSlug: "bricklayer", imageUrl: "https://ik.imagekit.io/5vv5pw26q/Untitledzxczxdddddddddfdasdddfffdddddxdsdxczxcxcxccccddccccccc.png" },
      { tradeSlug: "bricklayer", imageUrl: "https://ik.imagekit.io/5vv5pw26q/Untitledzxczxdddddddddfdasdddfffdddddxdsdxczxcxcxccccddcccccccc.png" }
    ]
  },
  {
    slug:         "chrome-steel",
    name:         "Chrome Steel",
    tagline:      "Brushed metal, cool grey, industrial edge",
    description:  "Cool brushed-steel finish with sharp geometry. Reads modern and industrial. Ideal for engineering, welding, mechanical and plant-hire trades.",
    gradient:     ["#2a2a2a", "#9ca3af"],
    suitedTrades: ["electrician", "plumber", "welder", "mechanic"],
    vibe:         "Industrial",
    samples:      []
  },
  {
    slug:         "flat-modern",
    name:         "Flat Modern",
    tagline:      "Clean vector, one accent colour",
    description:  "Minimal flat-vector mark with a single accent colour and clean sans typography. Scales perfectly on websites, apps and embroidery. Good primary logo choice paired with a 3D variant for marketing.",
    gradient:     ["#FBF6EC", "#FFB300"],
    suitedTrades: ["carpenter", "bricklayer", "kitchen-fitter", "bathroom-fitter", "tiler", "painter"],
    vibe:         "Minimal",
    samples: [
      // Carpenter / joinery vector variants (9)
      { tradeSlug: "carpenter", imageUrl: "https://ik.imagekit.io/5vv5pw26q/Untitledzxczxdddddddddfdasdddfffdddddxdsdxczxcxcxccccddcccccccccvddvvvdvdd.png" },
      { tradeSlug: "carpenter", imageUrl: "https://ik.imagekit.io/5vv5pw26q/Untitledzxczxdddddddddfdasdddfffdddddxdsdxczxcxcxccccddcccccccccvddvvvdvddc.png" },
      { tradeSlug: "carpenter", imageUrl: "https://ik.imagekit.io/5vv5pw26q/Untitledzxczxdddddddddfdasdddfffdddddxdsdxczxcxcxccccddcccccccccvddvvvdvddcc.png" },
      { tradeSlug: "carpenter", imageUrl: "https://ik.imagekit.io/5vv5pw26q/Untitledzxczxdddddddddfdasdddfffdddddxdsdxczxcxcxccccddcccccccccvddvvvdvddccv.png" },
      { tradeSlug: "carpenter", imageUrl: "https://ik.imagekit.io/5vv5pw26q/Untitledzxczxdddddddddfdasdddfffdddddxdsdxczxcxcxccccddcccccccccvddvvvdvddccvc.png" },
      { tradeSlug: "carpenter", imageUrl: "https://ik.imagekit.io/5vv5pw26q/Untitledzxczxdddddddddfdasdddfffdddddxdsdxczxcxcxccccddcccccccccvddvvvdvddccvcv.png" },
      { tradeSlug: "carpenter", imageUrl: "https://ik.imagekit.io/5vv5pw26q/Untitledzxczxdddddddddfdasdddfffdddddxdsdxczxcxcxccccddcccccccccvddvvvdvddccvcvc.png" },
      { tradeSlug: "carpenter", imageUrl: "https://ik.imagekit.io/5vv5pw26q/Untitledzxczxdddddddddfdasdddfffdddddxdsdxczxcxcxccccddcccccccccvddvvvdvddccvcvcc.png" },
      { tradeSlug: "carpenter", imageUrl: "https://ik.imagekit.io/5vv5pw26q/Untitledzxczxdddddddddfdasdddfffdddddxdsdxczxcxcxccccddcccccccccvddvvvdvddccvcvccc.png" },
      // Bricklayer vector variants (9)
      { tradeSlug: "bricklayer", imageUrl: "https://ik.imagekit.io/5vv5pw26q/Untitledzxczxdddddddddfdasdddfffdddddxdsdxczxcxcxccccddcccccccccvddvvvdvddccvcvcccdd.png" },
      { tradeSlug: "bricklayer", imageUrl: "https://ik.imagekit.io/5vv5pw26q/Untitledzxczxdddddddddfdasdddfffdddddxdsdxczxcxcxccccddcccccccccvddvvvdvddccvcvcccddff.png" },
      { tradeSlug: "bricklayer", imageUrl: "https://ik.imagekit.io/5vv5pw26q/Untitledzxczxdddddddddfdasdddfffdddddxdsdxczxcxcxccccddcccccccccvddvvvdvddccvcvcccddfff.png" },
      { tradeSlug: "bricklayer", imageUrl: "https://ik.imagekit.io/5vv5pw26q/Untitledzxczxdddddddddfdasdddfffdddddxdsdxczxcxcxccccddcccccccccvddvvvdvddccvcvcccddfffd.png" },
      { tradeSlug: "bricklayer", imageUrl: "https://ik.imagekit.io/5vv5pw26q/Untitledzxczxdddddddddfdasdddfffdddddxdsdxczxcxcxccccddcccccccccvddvvvdvddccvcvcccddfffdd.png" },
      { tradeSlug: "bricklayer", imageUrl: "https://ik.imagekit.io/5vv5pw26q/Untitledzxczxdddddddddfdasdddfffdddddxdsdxczxcxcxccccddcccccccccvddvvvdvddccvcvcccddfffddd.png" },
      { tradeSlug: "bricklayer", imageUrl: "https://ik.imagekit.io/5vv5pw26q/Untitledzxczxdddddddddfdasdddfffdddddxdsdxczxcxcxccccddcccccccccvddvvvdvddccvcvcccddfffdddd.png" },
      { tradeSlug: "bricklayer", imageUrl: "https://ik.imagekit.io/5vv5pw26q/Untitledzxczxdddddddddfdasdddfffdddddxdsdxczxcxcxccccddcccccccccvddvvvdvddccvcvcccddfffddddd.png" },
      { tradeSlug: "bricklayer", imageUrl: "https://ik.imagekit.io/5vv5pw26q/Untitledzxczxdddddddddfdasdddfffdddddxdsdxczxcxcxccccddcccccccccvddvvvdvddccvcvcccddfffddddddd.png" }
    ]
  },
  {
    slug:         "vintage-workshop",
    name:         "Vintage Workshop",
    tagline:      "Aged type, hand-drawn tool, cream backdrop",
    description:  "Warm vintage feel with distressed type and a hand-drawn tool illustration. Reads craft-heritage. Suits carpenters, joiners, blacksmiths and restoration work.",
    gradient:     ["#f5e6c8", "#8b4513"],
    suitedTrades: ["carpenter", "joiner", "restoration"],
    vibe:         "Heritage",
    samples:      []
  },
  {
    slug:         "luxury-gold",
    name:         "Luxury Gold",
    tagline:      "Black + gold, restrained, premium",
    description:  "Deep black background with brushed-gold typography and a fine crest. Positions you at the premium end. Suits interior fitters, bespoke joiners, kitchen designers.",
    gradient:     ["#0a0a0a", "#d4af37"],
    suitedTrades: ["kitchen-fitter", "interior-fitter", "joiner"],
    vibe:         "Premium",
    samples:      []
  },
  {
    slug:         "hi-vis-industrial",
    name:         "Hi-Vis Industrial",
    tagline:      "Amber + black, safety-first energy",
    description:  "Bold amber and black colour block with heavy sans type. Reads high-visibility and safety-first. Ideal for scaffolders, plant hire, groundworks, demolition.",
    gradient:     ["#0a0a0a", "#F59E0B"],
    suitedTrades: ["scaffolder", "groundworker", "plant-hire", "demolition"],
    vibe:         "Bold",
    samples:      []
  },
  {
    slug:         "monogram-crest",
    name:         "Monogram Crest",
    tagline:      "Two letters, quiet confidence",
    description:  "Your initials as a fine-line monogram inside a subtle crest. Understated, timeless. Suits building surveyors, architects and heritage tradespeople.",
    gradient:     ["#e5e1d8", "#1a1a1a"],
    suitedTrades: ["surveyor", "architect", "heritage"],
    vibe:         "Classic",
    samples:      []
  },
  {
    slug:         "neon-sign",
    name:         "Neon Sign",
    tagline:      "Electric glow on dark, night-shift vibe",
    description:  "Neon-tube glow on a dark brick backdrop. Signals modern, urban, night-friendly. Good for locksmiths, emergency callouts, 24-hour trades.",
    gradient:     ["#0a0a1a", "#22d3ee"],
    suitedTrades: ["locksmith", "electrician", "emergency-plumber"],
    vibe:         "Urban",
    samples:      []
  }
];

export function styleBySlug(slug: string): LogoStyle | undefined {
  return LOGO_STYLES.find((s) => s.slug === slug);
}

// ─── Trades ────────────────────────────────────────────────────

export type LogoTrade = {
  slug:  string;
  label: string;
  icon:  string;   // Lucide icon name
};

export const LOGO_TRADES: LogoTrade[] = [
  { slug: "electrician",       label: "Electrician",       icon: "Zap"           },
  { slug: "plumber",           label: "Plumber",           icon: "Wrench"        },
  { slug: "carpenter",         label: "Carpenter",         icon: "Hammer"        },
  { slug: "painter",           label: "Painter",           icon: "PaintBucket"   },
  { slug: "roofer",            label: "Roofer",            icon: "Home"          },
  { slug: "bricklayer",        label: "Bricklayer",        icon: "Grid3x3"       },
  { slug: "tiler",             label: "Tiler",             icon: "Square"        },
  { slug: "landscaper",        label: "Landscaper",        icon: "Trees"         },
  { slug: "scaffolder",        label: "Scaffolder",        icon: "GalleryVertical" },
  { slug: "kitchen-fitter",    label: "Kitchen Fitter",    icon: "Utensils"      },
  { slug: "bathroom-fitter",   label: "Bathroom Fitter",   icon: "Bath"          },
  { slug: "plasterer",         label: "Plasterer",         icon: "PaintRoller"   }
];

export function tradeBySlug(slug: string): LogoTrade | undefined {
  return LOGO_TRADES.find((t) => t.slug === slug);
}
