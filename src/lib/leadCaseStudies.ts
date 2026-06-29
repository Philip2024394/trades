// Lead case studies — the 6 demo profiles we've expanded into
// fully-loaded showcase listings. Shared across:
//   - /trade/[slug]/page.tsx (richer metadata + higher canonical priority)
//   - sitemap.ts             (bumped priority, weekly changeFreq)
//   - /showcase/page.tsx     (the hub page that lists all 6)
//   - /trade-off/tips/*      (CaseStudyCallout cross-links)
//
// Single source of truth — when you add a 7th case study, add it here
// and every consumer picks it up.

export type LeadCaseStudy = {
  /** Listing slug — must match an existing row in hammerex_trade_off_listings. */
  slug: string;
  /** Display name as it appears on the live profile. Used by the
   *  showcase hub + the cross-link callouts. */
  name: string;
  /** Trade label in proper case, e.g. "Drywaller", "Building Merchant". */
  tradeLabel: string;
  /** Profile-type bucket — drives the small "Service / Sales / Hire /
   *  Manufacture" eyebrow on the showcase card. */
  bucket: "Service" | "Sales" | "Hire" | "Manufacture";
  /** City the profile targets. */
  city: string;
  /** One-sentence pull from the listing's bio — used on the showcase
   *  hub card. Honest paraphrase, no fabricated stats. */
  pullQuote: string;
  /** The real-search phrase this profile targets. Drives the SEO blurb
   *  underneath the showcase hub cards. */
  searchTarget: string;
};

export const LEAD_CASE_STUDIES: LeadCaseStudy[] = [
  {
    slug: "demo-marcus-okafor-drywaller-manchester",
    name: "Marcus Okafor",
    tradeLabel: "Drywaller",
    bucket: "Service",
    city: "Manchester",
    pullQuote:
      "Two-man drywalling outfit doing stud partitions, metal frame systems and acoustic ceilings across Greater Manchester. Every quote written down with the spec.",
    searchTarget: "drywaller Manchester"
  },
  {
    slug: "demo-emma-whitfield-plasterer-leeds",
    name: "Emma Whitfield",
    tradeLabel: "Plasterer",
    bucket: "Service",
    city: "Leeds",
    pullQuote:
      "Skim-coat finishes that don't need a second pass, full re-plasters on Victorian terraces, lime plaster repair on period brick. Five-day return for snags on every job.",
    searchTarget: "plasterer Leeds"
  },
  {
    slug: "demo-jamie-mclean-electrician-edinburgh",
    name: "Jamie MacLean",
    tradeLabel: "Electrician",
    bucket: "Service",
    city: "Edinburgh",
    pullQuote:
      "NICEIC-registered, Part P testing and certs included. Tenement rewires, consumer unit upgrades, EICR for landlords, EV chargers. Honest about what's actually needed.",
    searchTarget: "electrician Edinburgh"
  },
  {
    slug: "demo-stuart-kingsley-building-merchant-hull",
    name: "Stuart Kingsley",
    tradeLabel: "Building Merchant",
    bucket: "Sales",
    city: "Hull",
    pullQuote:
      "Family-run yard since 1987. Plasterboard, timber, bagged plaster, fixings, aggregates — trade prices that don't punish you for ordering smaller loads.",
    searchTarget: "building merchant Hull"
  },
  {
    slug: "demo-rebecca-fawcett-tool-hire-derby",
    name: "Rebecca Fawcett",
    tradeLabel: "Tool Hire",
    bucket: "Hire",
    city: "Derby",
    pullQuote:
      "Tool hire that helps you pick the right kit, not the most expensive one. Damage waiver explained upfront. Trade accounts get next-day on repeats.",
    searchTarget: "tool hire Derby"
  },
  {
    slug: "demo-charlotte-pemberton-kitchen-manufacturer-bath",
    name: "Charlotte Pemberton",
    tradeLabel: "Kitchen Manufacturer",
    bucket: "Manufacture",
    city: "Bath",
    pullQuote:
      "Bespoke in-frame and shaker kitchens, hand-painted in Mylands, dovetailed oak drawers, Blum runners as standard. Twelve-week lead on bigger projects.",
    searchTarget: "kitchen installer Bath"
  }
];

// O(1) lookup map for fast detection inside generateMetadata, the
// sitemap loop, and any future analytics chip.
const _slugSet = new Set(LEAD_CASE_STUDIES.map((c) => c.slug));
export function isLeadCaseStudy(slug: string): boolean {
  return _slugSet.has(slug);
}

export function findLeadCaseStudy(slug: string): LeadCaseStudy | null {
  return LEAD_CASE_STUDIES.find((c) => c.slug === slug) ?? null;
}
