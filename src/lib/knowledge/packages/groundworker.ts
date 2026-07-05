// Knowledge Package: Groundworker.
//
// "Does this increase the amount of reusable knowledge inside the
//  platform? If yes, we're moving in the right direction."
//
// Foundations, drainage, driveways, hard-standings, site prep. CDM
// principal-contractor territory. Grounded in real HSE + SUDS +
// utility-survey standards.

import { knowledgePackageRegistry } from "../packageRegistry";
import type { KnowledgePackage } from "../packageTypes";

const pkg: KnowledgePackage = {
  id: "groundworker",
  name: "Groundworker",
  emoji: "🚧",
  tagline: "Dig, drainage, foundations — safe, surveyed, compliant.",
  description:
    "Full-service groundworker. Excavation, foundations, drainage, driveways, hard-standings + site prep. CDM 2015 principal contractor duties + PAS 128 utility-survey aware. Works upstream of builders + extension teams.",
  version: "1.0.0",
  trades: ["groundworker", "groundworks"],

  usesDomains: ["estimating", "quoting", "compliance", "crm", "projects", "staff"],

  extensions: [
    {
      domainId: "estimating",
      notes:
        "Groundworks estimates are excavation-volume × muck-away rate + concrete m³ + drainage runs. Ground condition unknown until dug — quotes include a contingency line for unforeseen ground.",
      entityExtensions: [
        {
          entityId: "estimate-line",
          additionalFields: {
            excavation_volume_m3: "number",
            concrete_grade: "string",
            drainage_runs_m: "number",
            muck_away_loads: "number",
            utility_survey_included: "boolean"
          },
          reason:
            "Volume drives muck-away cost; concrete grade drives price/m³; PAS 128 utility survey is a real cost that customers miss."
        }
      ],
      capabilities: [
        {
          capabilityId: "material-calculator",
          slug: "concrete-volume-calculator",
          name: "Concrete volume calculator",
          description:
            "Length × width × depth → m³. Includes wastage factor + adjusts for stepped foundations."
        }
      ]
    },
    {
      domainId: "compliance",
      notes:
        "Every groundworks job over 20 days or 500 person-days must be F10-notified to HSE. Utility surveys should be PAS 128 to Quality Level B before excavation. Waste-carrier registration mandatory.",
      compliance: [
        {
          id: "cdm-2015-principal-contractor",
          name: "CDM 2015 — Principal Contractor duties",
          regulator: "HSE",
          source: "https://www.legislation.gov.uk/uksi/2015/51/contents/made"
        },
        {
          id: "hse-f10-notification",
          name: "HSE F10 — construction project notification",
          regulator: "HSE",
          source:
            "https://www.hse.gov.uk/forms/notification/f10.htm"
        },
        {
          id: "pas-128-utility-survey",
          name: "PAS 128 — Underground utility detection, verification + location",
          regulator: "BSI",
          source:
            "https://knowledge.bsigroup.com/products/underground-utility-detection-verification-and-location"
        },
        {
          id: "hswa-1974-excavation",
          name: "Health and Safety at Work Act 1974 — excavation duty of care",
          regulator: "HSE",
          source: "https://www.legislation.gov.uk/ukpga/1974/37/contents"
        },
        {
          id: "waste-carrier-upper-tier",
          name: "Environmental Permitting Regulations — upper-tier waste carrier",
          regulator: "Environment Agency",
          source: "https://www.gov.uk/waste-carrier-or-broker-registration",
          credentialScheme: "waste-carrier"
        }
      ]
    },
    {
      domainId: "projects",
      notes:
        "Groundworks phase drives the entire project's critical path. Slippage propagates — every day of ground delay is a day of concrete + brickwork slip.",
      entityExtensions: [
        {
          entityId: "phase",
          additionalFields: {
            f10_notified: "boolean",
            utility_survey_ref: "string",
            temporary_works_designed_by: "string"
          },
          reason:
            "F10 notification is a legal precondition, not a formality. Temporary works (shoring, propping) must be designed by a competent person."
        }
      ]
    },
    {
      domainId: "staff",
      notes:
        "Groundworkers need CSCS + specific plant tickets (360 excavator, dumper, roller). Confined-space cards for any drainage in restricted access.",
      compliance: [
        {
          id: "cpcs-plant-cards",
          name: "CPCS / NPORS plant operator cards (360, dumper, roller)",
          regulator: "CITB / CPCS",
          source: "https://www.cscs.uk.com/cards/"
        }
      ]
    },
    {
      domainId: "crm",
      notes:
        "Groundworkers rarely deal with end-customers — the main contractor or extension builder is the customer. Reputation with the 5-10 local builders drives the pipeline.",
      entityExtensions: [
        {
          entityId: "company",
          additionalFields: {
            typical_projects_per_year: "number",
            preferred_notice_days: "number"
          },
          reason:
            "Regular contractor accounts want longer notice (2-4 weeks) — one-off jobs come with 3-5 days lead."
        }
      ]
    }
  ],

  services: [
    { slug: "strip-foundations", name: "Strip / trench foundations", frequency: "core", pricingModel: "quote-required", description: "Dig, level, concrete pour. Building Control inspection at open trench." },
    { slug: "raft-foundation", name: "Raft foundation", frequency: "specialism", pricingModel: "quote-required", description: "Reinforced concrete raft for poor ground or clay." },
    { slug: "underpinning", name: "Underpinning", frequency: "specialism", pricingModel: "quote-required", description: "Traditional or mini-pile — extending existing foundations." },
    { slug: "site-drainage", name: "Site drainage + soakaway", frequency: "core", pricingModel: "quote-required", description: "Storm + foul runs, inspection chambers, SUDS-compliant discharge." },
    { slug: "driveway-groundworks", name: "Driveway sub-base + kerbs", frequency: "core", pricingModel: "quote-required", description: "Excavation, Type 1 sub-base, kerb line, edge restraints." },
    { slug: "muck-away", name: "Muck-away + waste removal", frequency: "core", pricingModel: "fixed-price", description: "Skip or grab-lorry, waste-carrier licensed." },
    { slug: "hard-standing", name: "Hard-standing / plant base", frequency: "common", pricingModel: "quote-required", description: "Concrete pad for garage, workshop, plant storage." },
    { slug: "utility-trenches", name: "Utility trenches + ducting", frequency: "common", pricingModel: "quote-required", description: "Water, gas, electric, comms — coordinated with utility teams." },
    { slug: "site-clearance", name: "Site clearance + demolition", frequency: "common", pricingModel: "quote-required", description: "Small-scale demo, tree stump removal, site strip." }
  ],

  customerTypes: [
    { slug: "main-contractor", name: "Main contractor (building firm)", description: "Largest segment. Regular pipeline, extended payment terms." },
    { slug: "extension-builder", name: "Extension builder (repeat)", description: "Repeat work per project. Values fast quote turnaround + no-drama execution." },
    { slug: "homeowner-direct", name: "Homeowner (driveway + drainage)", description: "Single-project. Values clarity on ground unknowns + skip cost." },
    { slug: "developer", name: "Developer (single or multi-plot)", description: "Volume work. Values consistency + rate cards." }
  ],

  workflow: [
    { slug: "enquiry-and-visit", name: "Enquiry + site visit", description: "Assess access, drainage discharge point, ground indications, F10 threshold." },
    { slug: "quote-with-contingency", name: "Quote (with contingency)", description: "Priced schedule + contingency line for unforeseen ground." },
    { slug: "pre-start-notify", name: "Pre-start — F10 + utility survey", description: "F10 to HSE where required. PAS 128 utility survey commissioned." },
    { slug: "excavate-and-prep", name: "Excavate + prep", description: "Set out, dig, spoil away, Building Control open-trench inspection." },
    { slug: "concrete-and-inspect", name: "Concrete pour + inspection", description: "Pour, cure, second inspection before backfill." },
    { slug: "handover", name: "Handover to next trade", description: "Deliver level surface / open drainage runs to the follow-on trade. Photo record + certs." }
  ],

  commonFaqs: [
    { question: "What's F10 and do I need it?", answer: "HSE construction notification — required for any project over 30 working days OR 500 person-days. We notify at pre-start." },
    { question: "Do you dig where utilities might be?", answer: "PAS 128 survey first. We won't excavate without at least a Quality Level B survey where cables or gas might be present." },
    { question: "What if you hit clay / soft ground?", answer: "Contingency line in the quote covers modest ground unknowns. Serious ground change is a variation with your approval." },
    { question: "Do you take waste?", answer: "Yes — Environment Agency waste-carrier registered. Skip or grab-lorry priced separately." },
    { question: "Can you coordinate with my builder?", answer: "Yes — 80% of our work is groundworks-then-handover. We hit the level + timing your builder needs." }
  ],

  recommendedModules: ["website", "verified-badges", "quote-pipeline", "job-diary", "meet-the-team", "material-calculators", "staff-management"],
  canonicalBlueprint: undefined,

  industryIntelligence: [
    "F10 notification threshold: 30 working days or 500 person-days on site",
    "PAS 128 Quality Level B is the standard before any deep excavation near utilities",
    "Ground contingency line is standard practice — 5-10% for unforeseen conditions",
    "Waste-carrier registration is mandatory — upper-tier for regular use",
    "CDM Principal Contractor duties typically fall on the groundworker in domestic builds"
  ]
};

knowledgePackageRegistry.register(pkg);
export default pkg;
