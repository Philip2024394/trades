// Knowledge Domain: CRM.
//
// "Does this increase the amount of reusable knowledge inside the
//  platform? If yes, we're moving in the right direction."
//
// The horizontal contract for customer relationship management —
// Contact, Company, Deal, Interaction. Every construction business
// has customers, whether B2C (homeowner leads) or B2B (trade
// accounts, main contractors). Verticals extend Contact with
// trade-specific fields (Landlord = extension of Contact for gas
// engineers; Site Manager = extension for commercial contractors).

import { knowledgeDomainRegistry } from "../registry";
import type { KnowledgeDomain } from "../types";

const domain: KnowledgeDomain = {
  id: "crm",
  name: "CRM",
  tagline: "Every customer, every interaction, every job.",
  description:
    "The horizontal contract for tracking people, companies, deals, and interactions. Domain owns the core entities + timeline. Verticals extend Contact with role-specific fields; the runtime never branches on role.",
  version: "1.0.0",
  entities: [
    {
      id: "contact",
      name: "Contact",
      description: "Individual — homeowner, buyer, site manager.",
      contract: {
        brand_id: "reference",
        first_name: "string",
        last_name: "string",
        email: "string",
        phone: "string",
        whatsapp: "string",
        role: "enum"
      }
    },
    {
      id: "company",
      name: "Company",
      description:
        "Organisation — main contractor, letting agent, developer, trade account.",
      contract: {
        brand_id: "reference",
        name: "string",
        companies_house_number: "string",
        vat_number: "string",
        billing_address: "text",
        credit_limit_minor: "number",
        payment_terms_days: "number"
      }
    },
    {
      id: "deal",
      name: "Deal",
      description:
        "A tracked opportunity from first enquiry to won / lost. Estimates + Quotes attach to a Deal.",
      contract: {
        brand_id: "reference",
        contact_id: "reference",
        company_id: "reference",
        status: "enum",
        value_minor: "number",
        expected_close_at: "date",
        source: "string",
        blueprint_slug: "string"
      }
    },
    {
      id: "interaction",
      name: "Interaction",
      description:
        "Any inbound or outbound event — form submit, WhatsApp, call, quote sent, quote viewed.",
      contract: {
        deal_id: "reference",
        kind: "enum",
        happened_at: "date",
        summary: "string",
        payload_json: "text"
      }
    }
  ],
  capabilities: [
    {
      id: "lead-capture",
      name: "Lead capture",
      description:
        "Public form submission creates a Contact + Deal. Every Blueprint form flows through this."
    },
    {
      id: "whatsapp-intent",
      name: "WhatsApp intent",
      description:
        "Deep-link prefilled with job context (product, quantity, postcode, photo) — merchant intercepts to score intent."
    },
    {
      id: "call-tracking",
      name: "Call tracking",
      description:
        "Trackable phone number per campaign — attribution back to source."
    },
    {
      id: "deal-pipeline",
      name: "Deal pipeline",
      description:
        "Kanban board across the Deal status transitions. Configurable stages per merchant."
    },
    {
      id: "duplicate-detection",
      name: "Duplicate detection",
      description:
        "Same phone / email / postcode within N days = merge suggestion."
    },
    {
      id: "review-request",
      name: "Review request",
      description:
        "Post-completion nudge for a Google review. Templates in the Local SEO Pack."
    }
  ],
  aiRetrieval: [
    {
      id: "reply-suggestion",
      description:
        "Given an inbound interaction (e.g. 'can you do it next week?'), suggest a merchant-voice reply retrieved from prior successful patterns.",
      keywords: ["reply", "response", "voice"]
    },
    {
      id: "deal-context",
      description:
        "Retrieve every prior interaction for a Deal so the merchant walks into a callback fully briefed.",
      keywords: ["context", "history", "brief"]
    },
    {
      id: "trade-role-extension",
      description:
        "For a given trade, retrieve the trade-relevant Contact roles + fields (Landlord for gas engineer, Site Manager for commercial contractor).",
      keywords: ["role", "customer type"]
    }
  ],
  integrations: [
    {
      id: "hubspot",
      name: "HubSpot",
      category: "crm",
      description:
        "Two-way sync via HubSpot's public API. For merchants who already run HubSpot."
    },
    {
      id: "tradify",
      name: "Tradify",
      category: "crm",
      description:
        "UK trades-first CRM. Recommended partner for merchants outgrowing our lightweight CRM."
    },
    {
      id: "twilio",
      name: "Twilio",
      category: "communications",
      description: "SMS + trackable phone numbers."
    },
    {
      id: "whatsapp-business",
      name: "WhatsApp Business",
      category: "communications",
      description: "Send prefilled deep-links, receive inbound messages."
    }
  ],
  compliance: [
    {
      id: "gdpr-lawful-basis",
      name: "UK GDPR — lawful basis for lead-form processing",
      regulator: "ICO",
      source:
        "https://ico.org.uk/for-organisations/uk-gdpr-guidance-and-resources/lawful-basis/"
    },
    {
      id: "gdpr-marketing-consent",
      name: "PECR + UK GDPR — separate marketing consent",
      regulator: "ICO",
      source:
        "https://ico.org.uk/for-organisations/direct-marketing-and-privacy-and-electronic-communications/"
    },
    {
      id: "asa-cma-fake-reviews",
      name: "Digital Markets, Competition & Consumers Act 2024 — fake reviews ban",
      regulator: "CMA",
      source:
        "https://www.legislation.gov.uk/ukpga/2024/13/contents/enacted"
    }
  ],
  relatedDomains: [
    "customers",
    "quoting",
    "estimating",
    "marketing",
    "reviews",
    "compliance",
    "automation"
  ]
};

knowledgeDomainRegistry.register(domain);
export default domain;
