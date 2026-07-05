// Knowledge Domain: Materials.
//
// "Does this increase the amount of reusable knowledge inside the
//  platform? If yes, we're moving in the right direction."
//
// Horizontal contract for every physical thing a construction business
// sells, hires, or installs. Owns the catalogue + product + brand +
// spec contract. Verticals extend with trade-specific attributes
// (Plant Hire adds machine.attachments; Merchant adds credit-tier
// pricing).

import { knowledgeDomainRegistry } from "../registry";
import type { KnowledgeDomain } from "../types";

const domain: KnowledgeDomain = {
  id: "materials",
  name: "Materials",
  tagline: "Catalogue, spec, brand, warranty.",
  description:
    "Every construction business sells or installs physical stuff. Domain owns the product/material contract: category, spec, warranty, brand. Verticals extend with trade-specific fields (machine specs for plant hire, thermal ratings for insulation, coverage rates for paint).",
  version: "1.0.0",
  entities: [
    {
      id: "material-item",
      name: "Material item",
      description:
        "A single stocked/quoted item. Sits in a catalogue, belongs to a brand, has a spec sheet.",
      contract: {
        sku: "string",
        name: "string",
        brand_id: "reference",
        category: "string",
        spec_json: "text",
        warranty_years: "number",
        price_minor: "number",
        currency: "string"
      }
    },
    {
      id: "brand",
      name: "Brand",
      description:
        "Manufacturer / supplier brand. Warranty terms + accredited-installer status live here.",
      contract: {
        name: "string",
        manufacturer_country: "string",
        warranty_terms_url: "string",
        accredited_installer_scheme: "string"
      }
    },
    {
      id: "material-category",
      name: "Material category",
      description:
        "Category tree for the catalogue. Trades filter their PDPs + calculators by category.",
      contract: {
        parent_id: "reference",
        name: "string",
        slug: "string"
      }
    }
  ],
  capabilities: [
    {
      id: "catalogue-lookup",
      name: "Catalogue lookup",
      description:
        "Given a customer intent + trade context, return matching items. Used by calculators + AI + quote builder."
    },
    {
      id: "material-substitution",
      name: "Material substitution",
      description:
        "Suggest equivalent items when a customer's first pick is out of stock. Trade-specific rules (e.g. thermal equivalence for insulation)."
    },
    {
      id: "warranty-lookup",
      name: "Warranty lookup",
      description:
        "Retrieve manufacturer warranty terms for a specific item + installer scheme."
    },
    {
      id: "unit-conversion",
      name: "Unit conversion",
      description:
        "Metric ↔ imperial, packs ↔ single units, coverage-area ↔ volume."
    },
    {
      id: "spec-sheet-generation",
      name: "Spec sheet generation",
      description:
        "Merchant-branded downloadable PDF spec sheet, useful in trade-account handovers."
    }
  ],
  aiRetrieval: [
    {
      id: "brand-warranty-terms",
      description:
        "Retrieve manufacturer warranty pattern (e.g. Sika 15yr / Icopal 20yr) so the LLM can cite real terms rather than invent.",
      keywords: ["warranty", "guarantee", "manufacturer"]
    },
    {
      id: "substitution-rules",
      description:
        "Retrieve trade-specific substitution rules (thermal equivalence for insulation; strength band for concrete).",
      keywords: ["substitute", "equivalent", "swap"]
    },
    {
      id: "unit-conversion-hint",
      description:
        "Common conversions the LLM shouldn't reinvent (m² per litre for paint, m³ per tonne for aggregate).",
      keywords: ["unit", "convert", "per litre", "per tonne"]
    }
  ],
  integrations: [
    {
      id: "gs1-uk-barcode",
      name: "GS1 UK barcode database",
      category: "logistics",
      description:
        "Lookup product data from a scanned barcode. Paid membership; useful for merchants."
    },
    {
      id: "shopify-catalogue",
      name: "Shopify catalogue",
      category: "storage",
      description:
        "Sync catalogue with a Shopify store when the merchant runs shop mode via Shopify."
    }
  ],
  compliance: [
    {
      id: "ce-ukca-marking",
      name: "UKCA marking — construction products (Post-Brexit)",
      regulator: "OPSS",
      source:
        "https://www.gov.uk/guidance/using-the-ukca-marking"
    },
    {
      id: "en-1090-structural-steel",
      name: "EN 1090 — Structural steel + aluminium",
      regulator: "BSI",
      source:
        "https://knowledge.bsigroup.com/products/execution-of-steel-structures-and-aluminium-structures-general-rules-1"
    },
    {
      id: "cpr-2013",
      name: "Construction Products Regulation (EU 305/2011, retained in UK law)",
      regulator: "OPSS",
      source:
        "https://www.legislation.gov.uk/eur/2011/305/contents"
    },
    {
      id: "voc-paints-2012",
      name: "VOC in Paints, Varnishes + Vehicle Refinishing Regulations 2012",
      regulator: "HSE / DEFRA",
      source:
        "https://www.legislation.gov.uk/uksi/2012/1715/contents/made"
    }
  ],
  relatedDomains: ["estimating", "inventory", "deliveries", "quoting"]
};

knowledgeDomainRegistry.register(domain);
export default domain;
