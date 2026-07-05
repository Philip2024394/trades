// Knowledge Domain: Marketing.
//
// "Does this increase the amount of reusable knowledge inside the
//  platform? If yes, we're moving in the right direction."
//
// How customers find the merchant + why they trust them. Domain owns
// Campaign + Content + Testimonial entities and the ASA/PECR
// compliance surface every UK trade must respect.

import { knowledgeDomainRegistry } from "../registry";
import type { KnowledgeDomain } from "../types";

const domain: KnowledgeDomain = {
  id: "marketing",
  name: "Marketing",
  tagline: "Find customers. Earn trust. Stay compliant.",
  description:
    "The horizontal contract for customer acquisition + trust content. Owns Campaign + Content + Testimonial entities and enforces UK ASA/PECR guardrails (superlatives, fake reviews, marketing consent, headline pricing rules).",
  version: "1.0.0",
  entities: [
    {
      id: "campaign",
      name: "Campaign",
      description:
        "A named marketing effort with attributable spend + measurable outcome.",
      contract: {
        name: "string",
        channel: "enum",
        started_at: "date",
        ended_at: "date",
        spend_minor: "number",
        currency: "string",
        utm_source: "string",
        utm_medium: "string",
        utm_campaign: "string"
      }
    },
    {
      id: "content-asset",
      name: "Content asset",
      description:
        "A blog post, guide, calculator page, or lead magnet. Trackable by URL + tags.",
      contract: {
        kind: "enum",
        title: "string",
        slug: "string",
        published_at: "date",
        target_keyword: "string"
      }
    },
    {
      id: "testimonial",
      name: "Testimonial",
      description:
        "A customer quote. Verified testimonials carry proof metadata; anonymous ones must be labelled.",
      contract: {
        customer_name: "string",
        anonymous: "boolean",
        verified: "boolean",
        quote_text: "text",
        source_channel: "string",
        collected_at: "date"
      }
    }
  ],
  capabilities: [
    {
      id: "content-generation",
      name: "Content generation",
      description:
        "Draft blog posts + service-page copy in the merchant's voice. AI-assisted but every claim citable."
    },
    {
      id: "seo-content-plan",
      name: "SEO content plan",
      description:
        "Trade-specific keyword strategy — 'roofer + city', service pages, coverage postcodes."
    },
    {
      id: "campaign-tracking",
      name: "Campaign tracking",
      description:
        "UTM-tagged inbound links + conversion attribution back to Deals."
    },
    {
      id: "review-request",
      name: "Review request",
      description:
        "Post-job review request via email/SMS/WhatsApp. DMCC 2024 compliant — never coerced, never edited."
    },
    {
      id: "asa-copy-guard",
      name: "ASA copy guard",
      description:
        "Runtime check that catches 'cheapest', 'best', 'lifetime' claims lacking evidence — prompts merchant to add substantiation."
    }
  ],
  aiRetrieval: [
    {
      id: "asa-headline-price",
      description:
        "Retrieve the CAP Code rules on headline pricing (VAT + compulsory charges included in headline for consumer offers).",
      keywords: ["asa", "price", "vat", "headline"]
    },
    {
      id: "asa-superlative-check",
      description:
        "Retrieve the CAP Code test for superlative claims (cheapest / best / lifetime).",
      keywords: ["superlative", "cheapest", "best"]
    },
    {
      id: "review-request-timing",
      description:
        "Retrieve typical post-completion review-request windows (24–72hr sweet spot).",
      keywords: ["review", "request", "timing"]
    }
  ],
  integrations: [
    {
      id: "google-business-profile",
      name: "Google Business Profile",
      category: "communications",
      description:
        "Business info + posts + review sync. Free public API; write access is allow-list gated."
    },
    {
      id: "meta-business-suite",
      name: "Meta Business Suite",
      category: "communications",
      description:
        "Facebook + Instagram business pages. Content publishing via Graph API."
    },
    {
      id: "google-analytics-4",
      name: "Google Analytics 4",
      category: "analytics",
      description:
        "Website measurement + conversion tracking. Server-side gtag for privacy."
    },
    {
      id: "mailchimp",
      name: "Mailchimp",
      category: "communications",
      description:
        "Email marketing platform. Merchants use this for newsletter campaigns."
    }
  ],
  compliance: [
    {
      id: "cap-code",
      name: "CAP Code — non-broadcast advertising",
      regulator: "ASA / CAP",
      source: "https://www.asa.org.uk/codes-and-rulings/advertising-codes/non-broadcast-code.html"
    },
    {
      id: "cap-superlatives",
      name: "CAP Code — superlative claims (cheapest / best)",
      regulator: "ASA / CAP",
      source: "https://www.asa.org.uk/advice-online/lowest-price-claims-and-promises-1.html"
    },
    {
      id: "cap-headline-price",
      name: "CAP Code 3.18 — headline price + compulsory charges",
      regulator: "ASA / CAP",
      source: "https://www.asa.org.uk/advice-online/compulsory-costs-and-charges-general.html"
    },
    {
      id: "pecr-marketing-consent",
      name: "PECR — separate marketing consent + soft opt-in",
      regulator: "ICO",
      source:
        "https://ico.org.uk/for-organisations/direct-marketing-and-privacy-and-electronic-communications/"
    },
    {
      id: "dmcc-2024-fake-reviews",
      name: "Digital Markets, Competition & Consumers Act 2024 — fake reviews prohibited",
      regulator: "CMA",
      source: "https://www.legislation.gov.uk/ukpga/2024/13/contents/enacted"
    }
  ],
  relatedDomains: ["seo", "reviews", "crm", "customers", "compliance"]
};

knowledgeDomainRegistry.register(domain);
export default domain;
