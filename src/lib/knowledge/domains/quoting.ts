// Knowledge Domain: Quoting.
//
// "Does this increase the amount of reusable knowledge inside the
//  platform? If yes, we're moving in the right direction."
//
// Estimating produces the numbers. Quoting turns them into a customer-
// facing document that gets sent, tracked, chased, accepted or lost.
// The document format + status lifecycle is the horizontal contract;
// verticals extend with trade-specific clauses (Gas Safe declarations,
// FENSA notifications, MCS grant handling).

import { knowledgeDomainRegistry } from "../registry";
import type { KnowledgeDomain } from "../types";

const domain: KnowledgeDomain = {
  id: "quoting",
  name: "Quoting",
  tagline: "Send it, track it, chase it, win it.",
  description:
    "The customer-facing document lifecycle. Domain owns Quote entity + status transitions (draft → sent → viewed → accepted/rejected/expired) + the standard clauses every UK trade quote requires (Consumer Contracts pre-contract info, ASA-safe pricing, cancellation rights). Verticals extend with trade-specific clauses.",
  version: "1.0.0",
  entities: [
    {
      id: "quote",
      name: "Quote",
      description:
        "The customer-facing document. Immutable after sent; revisions land as a new version.",
      contract: {
        estimate_id: "reference",
        title: "string",
        customer_id: "reference",
        status: "enum",
        sent_at: "date",
        viewed_at: "date",
        accepted_at: "date",
        expires_at: "date",
        version: "number",
        pdf_url: "string"
      }
    },
    {
      id: "quote-clause",
      name: "Quote clause",
      description:
        "Named text block on a quote — bespoke exemption notice, cancellation right, warranty term, tanking-system warranty reference.",
      contract: {
        quote_id: "reference",
        clause_type: "string",
        body_md: "text",
        order: "number"
      }
    },
    {
      id: "quote-event",
      name: "Quote event",
      description:
        "Timeline of interactions on a Quote — sent, opened, downloaded, questioned, accepted.",
      contract: {
        quote_id: "reference",
        kind: "enum",
        happened_at: "date",
        actor: "string",
        metadata_json: "text"
      }
    }
  ],
  capabilities: [
    {
      id: "quote-pdf",
      name: "Quote PDF generation",
      description: "Server-render a PDF from the Quote + brand tokens."
    },
    {
      id: "quote-send",
      name: "Quote send",
      description: "Email + WhatsApp send with trackable open link."
    },
    {
      id: "quote-follow-up",
      name: "Quote follow-up",
      description:
        "Auto-nudge sequence after N days without acceptance. Merchant-configurable cadence."
    },
    {
      id: "quote-accept",
      name: "Quote accept",
      description:
        "Customer clicks accept from the email link — signature captured + status flipped."
    },
    {
      id: "quote-revise",
      name: "Quote revise",
      description:
        "New version supersedes the previous — audit trail preserved."
    }
  ],
  aiRetrieval: [
    {
      id: "clause-library",
      description:
        "Retrieve statutory clauses (Consumer Contracts pre-contract, 14-day cancellation with bespoke exemption, deposit protection) for insertion into a Quote.",
      keywords: [
        "clause",
        "consumer contracts",
        "cancellation",
        "deposit",
        "warranty"
      ]
    },
    {
      id: "voice-check",
      description:
        "Score a Quote's copy for merchant voice — trade-plain, no marketing fluff, correct trade terminology.",
      keywords: ["voice", "tone", "trade-plain", "check"]
    }
  ],
  integrations: [
    {
      id: "resend",
      name: "Resend",
      category: "communications",
      description:
        "Transactional email for quote-sent + follow-up. Already wired."
    },
    {
      id: "whatsapp-business",
      name: "WhatsApp Business",
      category: "communications",
      description:
        "Send quote link with photo attachment via WA Business API."
    },
    {
      id: "docusign",
      name: "DocuSign",
      category: "identity",
      description:
        "Legally-binding electronic signature on high-value quotes."
    }
  ],
  compliance: [
    {
      id: "ccr-2013-14-day",
      name: "Consumer Contracts Regulations 2013 — 14-day cancellation right",
      regulator: "UK Government",
      source:
        "https://www.legislation.gov.uk/uksi/2013/3134/contents/made"
    },
    {
      id: "ccr-2013-bespoke-exemption",
      name: "Consumer Contracts Regulations 2013 — bespoke + urgent-repair exemption",
      regulator: "UK Government",
      source:
        "https://www.legislation.gov.uk/uksi/2013/3134/regulation/28"
    },
    {
      id: "cap-price-claims",
      name: "CAP Code — headline price + compulsory charges",
      regulator: "ASA / CAP",
      source:
        "https://www.asa.org.uk/advice-online/compulsory-costs-and-charges-general.html"
    },
    {
      id: "cap-lowest-price",
      name: "CAP Code — lowest-price + price-match claims",
      regulator: "ASA / CAP",
      source:
        "https://www.asa.org.uk/advice-online/lowest-price-claims-and-promises-1.html"
    }
  ],
  relatedDomains: ["estimating", "customers", "finance", "compliance"]
};

knowledgeDomainRegistry.register(domain);
export default domain;
