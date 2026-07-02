// Plant Hire section registry — declarative source of truth listing
// every section that can appear on the merchant's plant hire home. The
// layout editor reads this to know which sections exist; the dynamic
// renderer reads this to know how to render each section key.
//
// Cross-app pattern: every trade app that wants a customisable layout
// exports one of these registries. Same editor + renderer components
// consume them.

import type { PlantHireConfig } from "@/lib/plantHire";

export type SectionSize = "full" | "compact";

export type PlantSectionMeta = {
  key: string;
  /** Human-readable name for the layout editor sidebar. */
  label: string;
  /** Short one-line description shown under the label in the editor. */
  description: string;
  /** Sensible-default region. */
  default_region: "main" | "sidebar";
  /** Can this section sit next to another one in a 2/3-col row?
   *  Compact sections (small CTA cards, calculator teaser, promo pills)
   *  can share a row. Full-width sections (featured machines grid,
   *  marquee, hero banner) always take a whole row. */
  size: SectionSize;
  /** Which feature toggle unlocks this section. When the toggle is
   *  false the editor greys it out and the renderer skips it. */
  toggleKey: keyof PlantHireConfig | null;
  /** Icon key for the editor (uses drawer icon set). */
  icon:
    | "home"
    | "grid"
    | "calendar"
    | "target"
    | "compare"
    | "cart"
    | "pin"
    | "truck"
    | "shield"
    | "alert"
    | "box"
    | "card"
    | "briefcase"
    | "user"
    | "clock"
    | "camera"
    | "wrench"
    | "verified"
    | "video"
    | "calc";
};

export const PLANT_SECTION_REGISTRY: PlantSectionMeta[] = [
  {
    key: "featured_machines",
    label: "Featured machines",
    description: "Top 6 machines from your enabled fleet — rates + specs + image tile.",
    default_region: "main",
    size: "full",
    toggleKey: null,
    icon: "grid"
  },
  {
    key: "for_sale_strip",
    label: "Ex-fleet for sale strip",
    description: "Any machines flagged for-sale → strip with prices + condition.",
    default_region: "main",
    size: "full",
    toggleKey: null,
    icon: "grid"
  },
  {
    key: "haulage_banner",
    label: "Hire / move machine banner",
    description: "Yellow promo banner linking to the haulage wizard.",
    default_region: "main",
    size: "compact",
    toggleKey: "haulage_service",
    icon: "truck"
  },
  {
    key: "breakdown_banner",
    label: "24/7 breakdown banner",
    description: "Red urgent promo banner linking to the breakdown form.",
    default_region: "main",
    size: "compact",
    toggleKey: "breakdown_service",
    icon: "alert"
  },
  {
    key: "delivery_zones",
    label: "Delivery zones section",
    description: "Zone map + postcode calculator + rate cards.",
    default_region: "main",
    size: "full",
    toggleKey: null,
    icon: "pin"
  },
  {
    key: "machine_finder_cta",
    label: "Machine finder CTA card",
    description: "Which-machine-do-I-need image + copy + start button.",
    default_region: "main",
    size: "full",
    toggleKey: "machine_finder",
    icon: "target"
  },
  {
    key: "site_calculator_cta",
    label: "Site calculator CTA card",
    description: "Compact click-through to /plant-hire/calculator.",
    default_region: "main",
    size: "compact",
    toggleKey: "site_calculator",
    icon: "calc"
  },
  {
    key: "video_center_cta",
    label: "Video centre CTA card",
    description: "Compact click-through to /plant-hire/video.",
    default_region: "main",
    size: "compact",
    toggleKey: "video_center",
    icon: "video"
  },
  {
    key: "credentials_cta",
    label: "Vetted · Insured · Audited CTA",
    description: "Compact click-through to /plant-hire/credentials.",
    default_region: "main",
    size: "compact",
    toggleKey: "trust_signals",
    icon: "verified"
  },
  {
    key: "trust_benefits_strip",
    label: "Why hire from us · trust strip",
    description: "8-tick button strip with links (CPA, HSE, breakdown line, etc.).",
    default_region: "main",
    size: "full",
    toggleKey: null,
    icon: "shield"
  },
  {
    key: "trade_circle_banner",
    label: "Trade Circle banner",
    description: "Dark banner linking to the plant-hire-filtered Yard board.",
    default_region: "main",
    size: "full",
    toggleKey: null,
    icon: "user"
  },
  {
    key: "careers_cta",
    label: "Careers / We're hiring card",
    description: "Compact click-through to /plant-hire/careers.",
    default_region: "main",
    size: "compact",
    toggleKey: "driver_recruitment",
    icon: "briefcase"
  },
  {
    key: "trade_accounts_cta",
    label: "Trade accounts card",
    description: "Compact click-through to /plant-hire/trade-accounts.",
    default_region: "main",
    size: "compact",
    toggleKey: "trade_accounts",
    icon: "card"
  },
  {
    key: "compliance_cta",
    label: "Wide load · Compliance card",
    description: "Compact click-through to /plant-hire/compliance.",
    default_region: "main",
    size: "compact",
    toggleKey: "compliance_info",
    icon: "shield"
  },
  {
    key: "cdm_pack",
    label: "CDM 2015 site safety pack",
    description: "Inline card with contents + price + sample PDF.",
    default_region: "main",
    size: "full",
    toggleKey: "cdm_pack",
    icon: "shield"
  },
  {
    key: "repeat_ladder",
    label: "Repeat customer ladder",
    description: "Dark 4-tier discount card with background image.",
    default_region: "main",
    size: "full",
    toggleKey: "repeat_ladder",
    icon: "user"
  },
  {
    key: "notify_when_free_card",
    label: "Notify-when-free teaser",
    description: "Small teaser card pointing to the machine tiles.",
    default_region: "main",
    size: "compact",
    toggleKey: "notify_when_free",
    icon: "clock"
  },
  {
    key: "bulk_quote_card",
    label: "Bulk / project quote teaser",
    description: "Small teaser card with min-machines + WhatsApp CTA.",
    default_region: "main",
    size: "compact",
    toggleKey: "bulk_quote",
    icon: "briefcase"
  },
  {
    key: "sub_hire_section",
    label: "Trade Circle sourcing (sub-hire)",
    description: "\"Not listed? Ask us anyway\" section with trust strip + CTAs.",
    default_region: "main",
    size: "full",
    toggleKey: "sub_hire",
    icon: "user"
  },
  {
    key: "trade_counter_marquee",
    label: "Trade counter parts marquee",
    description: "Bottom auto-scrolling parts strip linking to /plant-hire/parts.",
    default_region: "main",
    size: "full",
    toggleKey: "parts_counter",
    icon: "box"
  },
  {
    key: "big_cta",
    label: "See-all-machines big CTA",
    description: "Yellow button linking to /plant-hire/machines.",
    default_region: "main",
    size: "full",
    toggleKey: null,
    icon: "grid"
  }
];

/** Default layout — the same order as the hardcoded showcase before
 *  the layout system existed. Used when a merchant first opens the
 *  layout editor so they see their current live page as the starting
 *  point (not a blank canvas). */
export function defaultPlantLayoutRows(): { id: string; columns: string[]; region: "main" | "sidebar" }[] {
  return [
    { id: "r_fea", columns: ["featured_machines"], region: "main" },
    { id: "r_fsl", columns: ["for_sale_strip"], region: "main" },
    { id: "r_promo", columns: ["haulage_banner", "breakdown_banner"], region: "main" },
    { id: "r_del", columns: ["delivery_zones"], region: "main" },
    { id: "r_mf", columns: ["machine_finder_cta"], region: "main" },
    { id: "r_calc", columns: ["site_calculator_cta"], region: "main" },
    { id: "r_vid", columns: ["video_center_cta"], region: "main" },
    { id: "r_cred", columns: ["credentials_cta"], region: "main" },
    { id: "r_tb", columns: ["trust_benefits_strip"], region: "main" },
    { id: "r_tc", columns: ["trade_circle_banner"], region: "main" },
    {
      id: "r_biz",
      columns: ["careers_cta", "trade_accounts_cta"],
      region: "main"
    },
    { id: "r_cmp", columns: ["compliance_cta"], region: "main" },
    { id: "r_cdm", columns: ["cdm_pack"], region: "main" },
    { id: "r_rl", columns: ["repeat_ladder"], region: "main" },
    {
      id: "r_ntf",
      columns: ["notify_when_free_card", "bulk_quote_card"],
      region: "main"
    },
    { id: "r_sh", columns: ["sub_hire_section"], region: "main" },
    { id: "r_tcm", columns: ["trade_counter_marquee"], region: "main" },
    { id: "r_bc", columns: ["big_cta"], region: "main" }
  ];
}

export function sectionByKey(key: string): PlantSectionMeta | undefined {
  return PLANT_SECTION_REGISTRY.find((s) => s.key === key);
}
