// Commercial bundles per V2 Q9 — sell outcomes, not images.
// Each bundle is a set of Studio App outputs sold as a single line
// item. Stripe SKU wiring lands when we set up test/live keys.

export type BundleId =
  | "brand-foundation"
  | "vehicle-branding"
  | "print-essentials"
  | "workwear-pack"
  | "site-branding"
  | "digital-presence"
  | "marketing-campaign"
  | "complete-brand-os";

export type Bundle = {
  id:               BundleId;
  name:             string;
  category:         string;
  headline:         string;
  contents:         string[];          // customer-facing bullets
  capability_ids:   string[];          // Studio App ids that ship in this bundle
  price_pence:      number;
  estimated_ai_cost_pence: number;
  margin_target_pct: number;
  outcome_message:  string;            // "brand your whole fleet"
  upsell_targets:   BundleId[];        // suggested next bundles
  featured:         boolean;
};

export const BUNDLES: Bundle[] = [
  {
    id: "brand-foundation",
    name: "Brand Foundation",
    category: "identity",
    headline: "Start your business identity",
    contents: [
      "Logo (SVG, PNG, mono, reverse, favicon)",
      "Brand Guide PDF",
      "Colour palette + HEX/RGB/CMYK",
      "Typography choice",
      "Brand voice + keywords",
      "Icon set",
      "Social avatar",
      "Email signature"
    ],
    capability_ids: ["identity.logo", "identity.brand-guide", "identity.colour", "identity.typography"],
    price_pence: 1999,
    estimated_ai_cost_pence: 40,
    margin_target_pct: 98,
    outcome_message: "Establish your professional identity",
    upsell_targets: ["vehicle-branding", "print-essentials"],
    featured: false
  },
  {
    id: "vehicle-branding",
    name: "Vehicle Branding",
    category: "vehicle",
    headline: "Brand your whole fleet",
    contents: [
      "Transit / Vivaro / Trafic / Custom",
      "Pickup + Lorry + Trailer",
      "Magnetic Signs",
      "Reflective Kit",
      "Fleet-consistent variants",
      "Printer-ready PDF/X-4 pack"
    ],
    capability_ids: ["vehicle.van-wrap", "vehicle.fleet-branding", "vehicle.magnetic-signs"],
    price_pence: 2999,
    estimated_ai_cost_pence: 200,
    margin_target_pct: 93,
    outcome_message: "Look established every time you park up",
    upsell_targets: ["workwear-pack", "site-branding", "complete-brand-os"],
    featured: true
  },
  {
    id: "print-essentials",
    name: "Print Essentials",
    category: "print",
    headline: "Professional print pack",
    contents: [
      "Business Cards",
      "Letterhead",
      "Invoice + Quote templates",
      "Receipt + Compliment slip",
      "Presentation folders",
      "Document templates"
    ],
    capability_ids: ["print.business-card", "print.letterhead", "print.invoice", "print.quote"],
    price_pence: 1999,
    estimated_ai_cost_pence: 80,
    margin_target_pct: 96,
    outcome_message: "Every touchpoint looks the same",
    upsell_targets: ["digital-presence", "workwear-pack"],
    featured: false
  },
  {
    id: "workwear-pack",
    name: "Workwear Pack",
    category: "workwear",
    headline: "Kit the whole crew",
    contents: [
      "Polo shirts",
      "T-shirts",
      "Hoodies",
      "Hi-Vis",
      "Softshell jackets",
      "Caps + beanies",
      "Helmet stickers",
      "Embroidery-ready files"
    ],
    capability_ids: ["workwear.polo", "workwear.hoodie", "workwear.hi-vis"],
    price_pence: 2499,
    estimated_ai_cost_pence: 100,
    margin_target_pct: 96,
    outcome_message: "One brand across every shift",
    upsell_targets: ["site-branding", "complete-brand-os"],
    featured: false
  },
  {
    id: "site-branding",
    name: "Site Branding",
    category: "signage",
    headline: "Own the site",
    contents: [
      "Yard signs",
      "Fence banners",
      "Scaffold banners",
      "Office signs",
      "Vehicle stickers",
      "Window graphics",
      "Safety boards"
    ],
    capability_ids: ["signage.yard-sign", "signage.fence-banner", "signage.office-sign"],
    price_pence: 2499,
    estimated_ai_cost_pence: 90,
    margin_target_pct: 96,
    outcome_message: "Every job site says 'this is a proper firm'",
    upsell_targets: ["marketing-campaign", "complete-brand-os"],
    featured: false
  },
  {
    id: "digital-presence",
    name: "Digital Presence",
    category: "digital",
    headline: "Look professional online",
    contents: [
      "Website hero",
      "Service graphics",
      "Social media set (Insta + FB + LI + TikTok + YouTube)",
      "Google Business assets",
      "Email header",
      "Blog graphics"
    ],
    capability_ids: ["website.hero", "social.facebook", "social.instagram", "digital.google-business"],
    price_pence: 2499,
    estimated_ai_cost_pence: 110,
    margin_target_pct: 96,
    outcome_message: "Show up strong online",
    upsell_targets: ["marketing-campaign", "complete-brand-os"],
    featured: false
  },
  {
    id: "marketing-campaign",
    name: "Marketing Campaign Kit",
    category: "marketing",
    headline: "Get more work every season",
    contents: [
      "Facebook + Instagram ads",
      "Flyers + leaflets",
      "Posters",
      "Seasonal promotions",
      "Referral cards",
      "Email templates"
    ],
    capability_ids: ["marketing.facebook-ads", "marketing.flyers", "marketing.seasonal"],
    price_pence: 2999,
    estimated_ai_cost_pence: 130,
    margin_target_pct: 96,
    outcome_message: "Keep leads coming in year-round",
    upsell_targets: ["complete-brand-os"],
    featured: false
  },
  {
    id: "complete-brand-os",
    name: "Complete Brand OS",
    category: "complete",
    headline: "Everything, one payment",
    contents: [
      "Every asset in every category",
      "All 8 bundles included",
      "Priority AI generation",
      "One-click brand-wide changes",
      "Fleet + workwear + signage + marketing sync",
      "Full anti-lockin export any time"
    ],
    capability_ids: [], // catch-all bundle
    price_pence: 9999,  // £99.99 entry — £149 upgrade for Enterprise
    estimated_ai_cost_pence: 400,
    margin_target_pct: 96,
    outcome_message: "A full professional business identity in one purchase",
    upsell_targets: [],
    featured: true
  }
];

export function bundleById(id: BundleId): Bundle | undefined {
  return BUNDLES.find((b) => b.id === id);
}
