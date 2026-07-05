// Knowledge Domain: Finance.
//
// "Does this increase the amount of reusable knowledge inside the
//  platform? If yes, we're moving in the right direction."
//
// Money in / money out for a UK trade business. Owns Invoice + Payment
// + Refund + LedgerEntry and the HMRC MTD-for-VAT + Consumer Rights Act
// + PSD2 SCA compliance surface. Verticals extend with trade-specific
// fields (Merchant adds credit-limit; Plant Hire adds hire-agreement
// terms; Bathroom Fitter adds staged-payment schedule).

import { knowledgeDomainRegistry } from "../registry";
import type { KnowledgeDomain } from "../types";

const domain: KnowledgeDomain = {
  id: "finance",
  name: "Finance",
  tagline: "Invoice, capture, reconcile — VAT-compliant by default.",
  description:
    "The horizontal contract for cash movement. Owns Invoice + Payment + Refund and enforces UK HMRC MTD-for-VAT + Consumer Rights Act + PSD2 SCA guardrails. Every module that touches money (Payments, Invoicing, Wholesale credit) resolves through this Domain.",
  version: "1.0.0",
  entities: [
    {
      id: "invoice",
      name: "Invoice",
      description:
        "A billable document issued to a customer. Immutable once sent — corrections happen via credit notes.",
      contract: {
        deal_id: "reference",
        invoice_number: "string",
        issued_at: "date",
        due_at: "date",
        currency: "string",
        subtotal_minor: "number",
        vat_amount_minor: "number",
        total_minor: "number",
        status: "enum"
      }
    },
    {
      id: "payment",
      name: "Payment",
      description:
        "One receipt against an Invoice. Multiple partial payments allowed; overpayment creates a credit balance.",
      contract: {
        invoice_id: "reference",
        received_at: "date",
        amount_minor: "number",
        currency: "string",
        method: "enum",
        provider_ref: "string"
      }
    },
    {
      id: "refund",
      name: "Refund",
      description:
        "A negative payment against an Invoice — Consumer Rights Act refund window enforced.",
      contract: {
        payment_id: "reference",
        issued_at: "date",
        amount_minor: "number",
        reason: "text",
        provider_ref: "string"
      }
    }
  ],
  capabilities: [
    {
      id: "invoice-issue",
      name: "Invoice issue",
      description:
        "Generate a VAT-formatted invoice PDF + issue via email/portal. Numbering sequence guaranteed."
    },
    {
      id: "payment-capture",
      name: "Payment capture",
      description:
        "Take card / bank / BNPL / crypto payment via one of the platform's payment providers. PSD2 SCA respected."
    },
    {
      id: "refund-issue",
      name: "Refund issue",
      description:
        "Reverse a payment. Consumer Rights Act 14-day window auto-detected + provider refund fired."
    },
    {
      id: "statement-generation",
      name: "Statement generation",
      description:
        "Rolling customer statement — invoices + payments + running balance. Powers trade-account reconciliation."
    },
    {
      id: "mtd-vat-submission",
      name: "MTD VAT submission",
      description:
        "Prepare + file the quarterly VAT return via HMRC MTD API. Requires signposted digital-record-keeping."
    }
  ],
  aiRetrieval: [
    {
      id: "vat-standard-rates",
      description:
        "Retrieve UK VAT bands (20% standard, 5% reduced, 0% zero-rated, exempt) + which trade services fall under each.",
      keywords: ["vat", "20%", "reduced rate", "zero-rated"]
    },
    {
      id: "consumer-refund-window",
      description:
        "Retrieve the Consumer Rights Act 2015 refund windows for goods (30 days short-term reject, 6 months tier-one) and services (reperformance / price-reduction rights).",
      keywords: ["refund", "consumer rights", "return window"]
    },
    {
      id: "mtd-vat-thresholds",
      description:
        "Retrieve MTD-for-VAT applicability — mandatory for all VAT-registered businesses since April 2022.",
      keywords: ["mtd", "vat", "hmrc", "digital records"]
    }
  ],
  integrations: [
    {
      id: "stripe",
      name: "Stripe",
      category: "payment",
      description:
        "Card + BNPL + link. PSD2 SCA out of the box; Payment Intents API for the two-step confirm."
    },
    {
      id: "xero",
      name: "Xero",
      category: "accounting",
      description:
        "Accounting book of record. Invoices + payments sync via OAuth. UK MTD-VAT ready."
    },
    {
      id: "quickbooks-online",
      name: "QuickBooks Online",
      category: "accounting",
      description:
        "Second-most common UK trade ledger after Xero. Similar OAuth + MTD-VAT scope."
    },
    {
      id: "hmrc-mtd-vat",
      name: "HMRC MTD-for-VAT",
      category: "compliance-register",
      description:
        "Direct submission of the VAT100 quarterly return. OAuth via HMRC Developer Hub."
    }
  ],
  compliance: [
    {
      id: "mtd-vat-2022",
      name: "Making Tax Digital for VAT — mandatory since April 2022",
      regulator: "HMRC",
      source: "https://www.gov.uk/guidance/making-tax-digital-for-vat"
    },
    {
      id: "consumer-rights-act-2015",
      name: "Consumer Rights Act 2015 — refunds + service reperformance",
      regulator: "CMA",
      source: "https://www.legislation.gov.uk/ukpga/2015/15/contents"
    },
    {
      id: "psd2-sca",
      name: "PSD2 — Strong Customer Authentication for card payments",
      regulator: "FCA",
      source:
        "https://www.fca.org.uk/firms/strong-customer-authentication"
    },
    {
      id: "fca-consumer-credit",
      name: "FCA Consumer Credit — required for regulated credit / BNPL",
      regulator: "FCA",
      source:
        "https://www.fca.org.uk/firms/consumer-credit"
    }
  ],
  relatedDomains: ["quoting", "crm", "compliance", "marketing"]
};

knowledgeDomainRegistry.register(domain);
export default domain;
