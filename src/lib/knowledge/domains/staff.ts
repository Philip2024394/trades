// Knowledge Domain: Staff.
//
// "Does this increase the amount of reusable knowledge inside the
//  platform? If yes, we're moving in the right direction."
//
// The people who deliver the work — employed staff, subcontractors,
// and everyone in between. Owns StaffMember + Skill + Certification +
// SubcontractEngagement entities and enforces the Construction
// Industry Scheme + CSCS + Employment Rights Act compliance surface.
// Meet the Team + Staff Management are Modules that ride this Domain.

import { knowledgeDomainRegistry } from "../registry";
import type { KnowledgeDomain } from "../types";

const domain: KnowledgeDomain = {
  id: "staff",
  name: "Staff",
  tagline: "Roster, cards, timesheets — CIS + CSCS-aware.",
  description:
    "The horizontal contract for staff + subcontractors. Owns StaffMember + Skill + Certification + SubcontractEngagement and enforces UK CIS + CSCS + Employment Rights guardrails. Verticals extend with trade-specific skills (Roofer adds working-at-height; Gas Engineer adds ACS re-assessment cycle).",
  version: "1.0.0",
  entities: [
    {
      id: "staff-member",
      name: "Staff member",
      description:
        "One person on the roster. May be employed (PAYE) or subcontracted (CIS).",
      contract: {
        name: "string",
        role: "string",
        employment_type: "enum",
        started_at: "date",
        left_at: "date",
        direct_dial: "string"
      }
    },
    {
      id: "certification",
      name: "Certification",
      description:
        "One credential held by a StaffMember — CSCS, IPAF, PASMA, Gas Safe engineer number, ACS.",
      contract: {
        staff_member_id: "reference",
        scheme: "enum",
        registration_number: "string",
        issued_at: "date",
        expires_at: "date",
        verified_at: "date"
      }
    },
    {
      id: "subcontract-engagement",
      name: "Subcontract engagement",
      description:
        "One contract engagement with a self-employed subcontractor — CIS status + UTR captured.",
      contract: {
        staff_member_id: "reference",
        engaged_at: "date",
        ended_at: "date",
        cis_verified_at: "date",
        cis_status: "enum",
        utr_last4: "string",
        day_rate_minor: "number"
      }
    }
  ],
  capabilities: [
    {
      id: "roster",
      name: "Roster",
      description:
        "The full staff + subcontractor list, filterable by employment type + certification."
    },
    {
      id: "timesheet",
      name: "Timesheet",
      description:
        "Per-StaffMember hours + day-rate log. Feeds payroll + CIS deductions."
    },
    {
      id: "certification-tracking",
      name: "Certification tracking",
      description:
        "Expiry alerts + auto-renew reminders on every card the merchant holds. Card expiry stops the operator dispatching to site."
    },
    {
      id: "cscs-verification",
      name: "CSCS verification",
      description:
        "Look up a CSCS card against the free public register + refresh the verified_at timestamp."
    },
    {
      id: "cis-status-check",
      name: "CIS status check",
      description:
        "Verify a subcontractor's CIS status with HMRC — Gross, 20% or 30% deduction band captured."
    }
  ],
  aiRetrieval: [
    {
      id: "cscs-card-colours",
      description:
        "Retrieve CSCS card colour meanings (Green = labourer, Blue = skilled, Gold = supervisor, Black = manager, Yellow = visitor).",
      keywords: ["cscs", "card colour", "green", "gold"]
    },
    {
      id: "cis-deduction-bands",
      description:
        "Retrieve the CIS deduction bands (Gross / 20% / 30%) and when each applies.",
      keywords: ["cis", "deduction", "20%", "gross"]
    },
    {
      id: "acs-renewal-window",
      description:
        "Retrieve the ACS (Accredited Certification Scheme) 5-year renewal window for Gas Safe engineers.",
      keywords: ["acs", "gas safe", "renewal", "5 years"]
    }
  ],
  integrations: [
    {
      id: "cscs-smartcheck",
      name: "CSCS SmartCheck",
      category: "compliance-register",
      description:
        "Public API for verifying a CSCS card is current + belongs to the person carrying it."
    },
    {
      id: "hmrc-cis-verify",
      name: "HMRC CIS Verify",
      category: "compliance-register",
      description:
        "Verify a subcontractor's CIS status (Gross / 20% / 30%) before first payment."
    },
    {
      id: "gas-safe-register",
      name: "Gas Safe Register",
      category: "compliance-register",
      description:
        "Verify a Gas Safe engineer's registration + work-category authorisation."
    },
    {
      id: "employment-hero",
      name: "Employment Hero",
      category: "hr",
      description:
        "UK-focused HR platform — payroll + timesheet + right-to-work. API for staff sync."
    }
  ],
  compliance: [
    {
      id: "cis-scheme",
      name: "Construction Industry Scheme — contractor tax deductions",
      regulator: "HMRC",
      source: "https://www.gov.uk/what-is-the-construction-industry-scheme"
    },
    {
      id: "cscs-card-2025",
      name: "CSCS card requirement — mandatory on most UK construction sites",
      regulator: "CITB / CSCS",
      source: "https://www.cscs.uk.com/",
      credentialScheme: "cscs"
    },
    {
      id: "employment-rights-1996",
      name: "Employment Rights Act 1996 — statutory notice, contracts, redundancy",
      regulator: "DBT",
      source: "https://www.legislation.gov.uk/ukpga/1996/18/contents"
    },
    {
      id: "right-to-work",
      name: "Right to Work checks — Immigration Asylum & Nationality Act 2006",
      regulator: "Home Office",
      source:
        "https://www.gov.uk/check-job-applicant-right-to-work"
    }
  ],
  relatedDomains: ["scheduling", "compliance", "projects", "crm"]
};

knowledgeDomainRegistry.register(domain);
export default domain;
