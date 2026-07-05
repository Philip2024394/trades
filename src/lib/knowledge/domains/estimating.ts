// Knowledge Domain: Estimating.
//
// "Does this increase the amount of reusable knowledge inside the
//  platform? If yes, we're moving in the right direction."
//
// The horizontal capability every construction business needs some
// form of. Individual trades extend this Domain with their own
// calculators, waste factors, labour rules, and pricing overrides.
// The Domain itself owns the CONTRACT only — entities, capabilities,
// AI retrieval hooks, integrations, compliance surface.

import { knowledgeDomainRegistry } from "../registry";
import type { KnowledgeDomain } from "../types";

const domain: KnowledgeDomain = {
  id: "estimating",
  name: "Estimating",
  tagline: "Turn dimensions + specs into a costed take-off.",
  description:
    "Every construction trade estimates. The Domain owns the contract for material calculators, labour rules, waste factors, and margin rules. Verticals inherit the contract and provide trade-specific implementations (paint calc for decorators, tile calc for tilers, day-rate calc for plant hire, mix strength calc for concrete suppliers).",
  version: "1.0.0",
  entities: [
    {
      id: "estimate",
      name: "Estimate",
      description: "Header record for a costed take-off.",
      contract: {
        title: "string",
        customer_id: "reference",
        status: "enum",
        subtotal_minor: "number",
        tax_minor: "number",
        total_minor: "number",
        currency: "string",
        expires_at: "date"
      }
    },
    {
      id: "estimate-line",
      name: "Estimate line",
      description: "One quantifiable item on an Estimate.",
      contract: {
        estimate_id: "reference",
        kind: "enum",
        description: "text",
        quantity: "number",
        unit: "string",
        unit_price_minor: "number",
        waste_percent: "number",
        total_minor: "number"
      }
    },
    {
      id: "calculator-input",
      name: "Calculator input",
      description:
        "The dimensioned measurement the merchant collects — length + width + depth + coats, etc. Owns the raw survey data before it's costed.",
      contract: {
        estimate_id: "reference",
        calculator_slug: "string",
        payload_json: "text"
      }
    }
  ],
  capabilities: [
    {
      id: "material-calculator",
      name: "Material calculator",
      description:
        "Given a dimension set, output a quantity + waste. Trade-specific implementations plug in — the Domain provides the shell."
    },
    {
      id: "labour-calculator",
      name: "Labour calculator",
      description:
        "Given quantity + skill level + productivity factor, output hours. Trade-specific productivity factors plug in."
    },
    {
      id: "waste-factor",
      name: "Waste factor",
      description:
        "Per-material waste percentage applied to raw take-off. Trade-specific defaults."
    },
    {
      id: "pricing-rule",
      name: "Pricing rule",
      description:
        "Merchant pricing tier — retail vs trade-account vs contract. Powered by the Materials Domain."
    },
    {
      id: "margin-rule",
      name: "Margin rule",
      description:
        "Merchant margin applied over cost. Can be tenant-configured or trade-typical."
    }
  ],
  aiRetrieval: [
    {
      id: "typical-waste-factor",
      description:
        "Look up typical waste % for a material in a trade (paint 10%, tiles 10-15%, gravel 5%).",
      keywords: ["waste", "over-order", "spillage", "cuts"]
    },
    {
      id: "typical-productivity",
      description:
        "Look up typical labour productivity for a trade activity (m² of tiling per hour, m of skirting per hour).",
      keywords: ["productivity", "hours", "man-day", "labour"]
    },
    {
      id: "quote-fairness-check",
      description:
        "Given a merchant's quote, retrieve a sanity band ('is £2,400 for a 12m² bathroom tile fair for the region?') — never states a fact, always presents as a comparison band.",
      keywords: ["fair", "compare", "band", "check"]
    }
  ],
  integrations: [
    {
      id: "companies-house",
      name: "Companies House",
      category: "identity",
      description:
        "Verify customer company on B2B estimates. Free public API."
    },
    {
      id: "vat-hmrc",
      name: "HMRC VAT lookup",
      category: "identity",
      description:
        "Verify customer VAT number on B2B estimates. Free public API."
    },
    {
      id: "xero",
      name: "Xero",
      category: "accounting",
      description:
        "Push accepted estimates into Xero as sales orders. OAuth."
    },
    {
      id: "quickbooks",
      name: "QuickBooks",
      category: "accounting",
      description:
        "Push accepted estimates into QuickBooks as sales orders. OAuth."
    }
  ],
  compliance: [
    {
      id: "cca-2015-fair-price",
      name: "Consumer Rights Act 2015 — reasonable price",
      regulator: "UK Parliament",
      source:
        "https://www.legislation.gov.uk/ukpga/2015/15/section/49/enacted"
    },
    {
      id: "asa-cap-3.18",
      name: "CAP Code 3.18 — headline price must include compulsory charges",
      regulator: "ASA / CAP",
      source: "https://www.asa.org.uk/type/non_broadcast/code_section/03.html"
    },
    {
      id: "asa-guarantees-3.53",
      name: "CAP Code 3.53–3.56 — guarantee claims",
      regulator: "ASA / CAP",
      source:
        "https://www.asa.org.uk/advice-online/guarantees-and-warranties.html"
    }
  ],
  relatedDomains: [
    "quoting",
    "materials",
    "labour",
    "finance",
    "customers"
  ]
};

knowledgeDomainRegistry.register(domain);
export default domain;
