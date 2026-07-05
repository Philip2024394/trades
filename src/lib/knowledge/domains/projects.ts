// Knowledge Domain: Projects.
//
// "Does this increase the amount of reusable knowledge inside the
//  platform? If yes, we're moving in the right direction."
//
// The unit of work a merchant delivers. Owns Project + Phase + Snag +
// Photo entities and enforces CDM 2015 + RIDDOR + HSAW compliance for
// on-site work. Job Diary is one Module that implements this Domain;
// future site-management modules layer on top.

import { knowledgeDomainRegistry } from "../registry";
import type { KnowledgeDomain } from "../types";

const domain: KnowledgeDomain = {
  id: "projects",
  name: "Projects",
  tagline: "From won quote to signed-off job — evidence-captured.",
  description:
    "The horizontal contract for delivered work. Owns Project + Phase + Snag + Photo entities and the CDM 2015 + RIDDOR compliance surface. Portfolio, job diary, site-safety, and sign-off modules all extend this.",
  version: "1.0.0",
  entities: [
    {
      id: "project",
      name: "Project",
      description:
        "One deliverable job — starts on a won quote, ends on a signed-off completion.",
      contract: {
        deal_id: "reference",
        title: "string",
        started_at: "date",
        target_completion_at: "date",
        actual_completion_at: "date",
        status: "enum",
        principal_contractor_id: "reference"
      }
    },
    {
      id: "phase",
      name: "Phase",
      description:
        "A staged part of a Project — first-fix, second-fix, snag round. Ordered.",
      contract: {
        project_id: "reference",
        sequence: "number",
        name: "string",
        started_at: "date",
        completed_at: "date"
      }
    },
    {
      id: "snag",
      name: "Snag",
      description:
        "One outstanding item on a walk-round. Fixable, sign-offable, categorised.",
      contract: {
        project_id: "reference",
        raised_by: "reference",
        category: "enum",
        severity: "enum",
        description: "text",
        raised_at: "date",
        resolved_at: "date"
      }
    }
  ],
  capabilities: [
    {
      id: "project-timeline",
      name: "Project timeline",
      description:
        "A Gantt-lite of phases + snag rounds. Powers the customer's live view + the merchant's diary."
    },
    {
      id: "phase-tracking",
      name: "Phase tracking",
      description:
        "Move a Phase to complete + auto-trigger the next Phase's start date."
    },
    {
      id: "snag-log",
      name: "Snag log",
      description:
        "Raise + resolve snags on a walk-through. Photo attached; severity captured."
    },
    {
      id: "photo-record",
      name: "Photo record",
      description:
        "Timestamped + optionally geotagged photos attached to a Phase — evidence trail for handover + insurance."
    },
    {
      id: "sign-off",
      name: "Sign-off",
      description:
        "Digital completion signature — customer + merchant, captured on device."
    }
  ],
  aiRetrieval: [
    {
      id: "cdm-principal-contractor-duties",
      description:
        "Retrieve the CDM 2015 principal-contractor duty list — planning, coordination, welfare provision.",
      keywords: ["cdm", "principal contractor", "duties"]
    },
    {
      id: "riddor-reportable-incidents",
      description:
        "Retrieve the RIDDOR reportable-incident thresholds — 7-day incapacitation, specified injuries, dangerous occurrences.",
      keywords: ["riddor", "reportable", "incident"]
    },
    {
      id: "typical-snag-categories",
      description:
        "Retrieve typical snag categorisations for UK trade handover — fabric, MEP, cosmetic, functional.",
      keywords: ["snag", "handover", "walk-round"]
    }
  ],
  integrations: [
    {
      id: "procore",
      name: "Procore",
      category: "field-service",
      description:
        "Enterprise construction project management. API for large-project modules."
    },
    {
      id: "fieldwire",
      name: "Fieldwire",
      category: "field-service",
      description:
        "Task-and-plan collaboration for site teams. Mid-market UK trades common."
    },
    {
      id: "buildertrend",
      name: "Buildertrend",
      category: "field-service",
      description:
        "End-to-end residential builder platform. API for job-diary sync."
    }
  ],
  compliance: [
    {
      id: "cdm-2015",
      name: "CDM 2015 — Construction (Design and Management) Regulations",
      regulator: "HSE",
      source: "https://www.legislation.gov.uk/uksi/2015/51/contents/made"
    },
    {
      id: "riddor-2013",
      name: "RIDDOR 2013 — Reporting of Injuries, Diseases and Dangerous Occurrences",
      regulator: "HSE",
      source: "https://www.legislation.gov.uk/uksi/2013/1471/contents/made"
    },
    {
      id: "health-safety-at-work-1974",
      name: "Health and Safety at Work etc. Act 1974",
      regulator: "HSE",
      source: "https://www.legislation.gov.uk/ukpga/1974/37/contents"
    }
  ],
  relatedDomains: ["scheduling", "staff", "crm", "compliance", "materials"]
};

knowledgeDomainRegistry.register(domain);
export default domain;
