// Knowledge Domain: Compliance.
//
// "Does this increase the amount of reusable knowledge inside the
//  platform? If yes, we're moving in the right direction."
//
// UK construction is heavily regulated. Compliance is the horizontal
// contract for every scheme (Gas Safe, NICEIC, MCS, TrustMark, FMB,
// CHAS, FENSA, HETAS, IPAF, PASMA, Waste Carrier, Companies House,
// VAT, Public Liability). Verticals declare which of these are
// mandatory / expected / optional for their trade.

import { knowledgeDomainRegistry } from "../registry";
import type { KnowledgeDomain } from "../types";

const domain: KnowledgeDomain = {
  id: "compliance",
  name: "Compliance",
  tagline: "Every scheme, verified daily, silently hidden when expired.",
  description:
    "The horizontal contract for UK trade certifications. Owns the Credential entity + verification lifecycle. Verticals declare which schemes are trade-mandatory (Gas Safe for gas engineers, NICEIC for electricians) vs recommended (TrustMark, FMB) vs specialist (MCS for renewables, FENSA for windows).",
  version: "1.0.0",
  entities: [
    {
      id: "credential",
      name: "Credential",
      description:
        "A scheme registration held by a merchant. Verified daily where a public register is auto-checkable; self-declared otherwise (linked to the public register for end-user verification).",
      contract: {
        brand_id: "reference",
        scheme: "string",
        number: "string",
        status: "enum",
        verified_at: "date",
        expires_at: "date",
        last_check_at: "date",
        display_label: "string"
      }
    },
    {
      id: "compliance-block",
      name: "Compliance content block",
      description:
        "A statutory copy block a Blueprint renders — Consumer Contracts pre-contract, GDPR form auditor, ASA superlative guard.",
      contract: {
        block_id: "string",
        body_md: "text",
        regulator: "string",
        version: "string"
      }
    }
  ],
  capabilities: [
    {
      id: "scheme-verifier",
      name: "Scheme verifier",
      description:
        "Auto-verify a credential against a public register (Companies House, HMRC VAT). Nightly cron + on-demand recheck."
    },
    {
      id: "self-declaration",
      name: "Self-declaration",
      description:
        "Non-auto-verifiable schemes recorded honestly with link to the scheme's own public register."
    },
    {
      id: "asa-copy-guard",
      name: "ASA copy guard",
      description:
        "Block or require-evidence on superlatives ('cheapest', 'best', 'lifetime') per CAP Code."
    },
    {
      id: "gdpr-form-auditor",
      name: "GDPR form auditor",
      description:
        "Validate every public form has a lawful-basis line + separate marketing opt-in + privacy notice link."
    }
  ],
  aiRetrieval: [
    {
      id: "trade-mandatory-schemes",
      description:
        "For a given trade, retrieve schemes that are legally mandatory to advertise the trade (Gas Safe for gas work).",
      keywords: ["mandatory", "required", "illegal"]
    },
    {
      id: "compliance-question",
      description:
        "'Is it legal to say X in my copy?' — retrieve relevant ASA rulings + CAP Code sections. Never advises, always cites.",
      keywords: ["legal", "asa", "cap", "check"]
    },
    {
      id: "expiry-window",
      description:
        "Retrieve typical expiry windows (IPAF PAL card 5 years, CSCS card 5 years, CP12 12 months) so the platform can schedule reminders.",
      keywords: ["expiry", "renewal", "reminder"]
    }
  ],
  integrations: [
    {
      id: "companies-house",
      name: "Companies House",
      category: "compliance-register",
      description:
        "Free public REST API. Auto-verifies daily."
    },
    {
      id: "hmrc-vat",
      name: "HMRC VAT",
      category: "compliance-register",
      description: "Free public REST API. Auto-verifies daily."
    },
    {
      id: "gas-safe-register",
      name: "Gas Safe Register",
      category: "compliance-register",
      description:
        "Public search only, no free API. Merchants self-declare + public site links to the register for end-user verification."
    },
    {
      id: "niceic-search",
      name: "NICEIC contractor search",
      category: "compliance-register",
      description: "Public search, no free API. Same handling as Gas Safe."
    },
    {
      id: "mcs-directory",
      name: "MCS installer directory",
      category: "compliance-register",
      description: "Public search, no free API."
    }
  ],
  compliance: [
    {
      id: "gas-safety-1998",
      name: "Gas Safety (Installation and Use) Regulations 1998",
      regulator: "HSE",
      source: "https://www.legislation.gov.uk/uksi/1998/2451/contents/made"
    },
    {
      id: "part-p-electrical",
      name: "Building Regulations Part P — electrical safety in dwellings",
      regulator: "MHCLG",
      source:
        "https://www.gov.uk/government/publications/electrical-safety-approved-document-p"
    },
    {
      id: "gdpr-uk",
      name: "UK GDPR + Data Protection Act 2018",
      regulator: "ICO",
      source: "https://ico.org.uk/for-organisations/uk-gdpr-guidance-and-resources/"
    },
    {
      id: "companies-act-2006-trading-disclosures",
      name: "Companies (Trading Disclosures) Regulations 2008 — website disclosure",
      regulator: "Companies House",
      source:
        "https://www.legislation.gov.uk/uksi/2008/495/contents/made"
    },
    {
      id: "car-2012",
      name: "Control of Asbestos Regulations 2012",
      regulator: "HSE",
      source: "https://www.legislation.gov.uk/uksi/2012/632/contents/made"
    },
    {
      id: "cdm-2015",
      name: "Construction (Design and Management) Regulations 2015",
      regulator: "HSE",
      source: "https://www.legislation.gov.uk/uksi/2015/51/contents/made"
    }
  ],
  relatedDomains: ["health-safety", "customers", "marketing", "seo"]
};

knowledgeDomainRegistry.register(domain);
export default domain;
