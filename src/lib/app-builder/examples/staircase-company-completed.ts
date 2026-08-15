// NEX App Builder · Golden fixture · staircase company with completed customer profile.
//
// (Philip 2026-08-14 · Phase 9 golden test fixture)
//
// Same shape as staircase-company.ts BUT with all REQUIRED customer facts
// supplied. The distinction matters:
//
//   staircase-company.ts (the "raw" Blueprint)
//     → REQUIRED fields left as placeholders
//     → readiness.ready = false
//     → workers block on required facts
//     → QA correctly FAILS title checks because "[Staircase Company Name]"
//       reaches the rendered page
//
//   staircase-company-completed.ts (this file · golden fixture)
//     → Same 7 pages, 17 sections, integrations
//     → Customer supplied: displayName, phone, email, service-radius, products data
//     → provenance marks these as KNOWN with source="customer:completed-profile"
//     → readiness.ready = true (no REQUIRED blockers)
//     → QA passes because no placeholders reach the rendered page
//
// Constitutional rule preserved:
//   - Every KNOWN fact traces to source="customer:completed-profile"
//   - Blueprint schema unchanged
//   - Adapter unchanged
//   - Workers unchanged
//   - QA rules unchanged (the [Xxx] placeholder detector still runs)
//   - Only new information: the CUSTOMER PROFILE data itself

import type { AppBlueprint } from "../blueprint-schema";
import { staircaseCompanyBlueprint } from "./staircase-company";
import { setKnown } from "../provenance";

const CUSTOMER = {
  displayName: "Rowan Architectural Staircases",
  legalName: "Rowan Architectural Staircases Ltd",
  aboutBlurb:
    "Rowan Architectural Staircases has been designing and installing bespoke staircases across the UK for premium residential and commercial projects. Each staircase is engineered in oak, walnut or ash and installed by our own team.",
  yearFounded: 2009,
  teamSize: "12–20",
  primaryEmail: "hello@rowanstaircases.co.uk",
  primaryPhone: "+44 20 7946 0322",
  whatsapp: "+44 7700 900321",
  postcode: "SW1A 1AA",
  city: "London",
  serviceRadiusMiles: 40
};

// Realistic product seed data. Not fabricated for the customer — this
// represents the customer having filled in their real product catalogue
// through the Studio form. Source is recorded in provenance.
const PRODUCT_SEED = [
  {
    slug: "helix-oak-open-tread",
    name: "Helix · Open-tread oak",
    description:
      "Open-tread European oak spiral in a single continuous string. Hand-finished with hardwax oil.",
    price: { amount: 14500, currency: "GBP" },
    images: ["hero://staircase-spiral-curved-walnut-modern"],
    featured: true
  },
  {
    slug: "meridian-walnut-cantilever",
    name: "Meridian · Cantilevered walnut",
    description:
      "American black walnut floating staircase with concealed steel spine and glass balustrade.",
    price: { amount: 21800, currency: "GBP" },
    images: ["hero://staircase-cantilever-black-metal-modern"],
    featured: true
  },
  {
    slug: "ashcombe-oak-traditional",
    name: "Ashcombe · Traditional oak",
    description:
      "Turned oak balustrade, chamfered newel posts, and a full-return handrail. Suitable for period homes.",
    price: { amount: 11400, currency: "GBP" },
    images: ["hero://staircase-traditional-oak-newel"],
    featured: false
  },
  {
    slug: "coastal-painted",
    name: "Coastal · Painted timber",
    description:
      "White-painted stringer with natural oak treads and stainless-steel spindles.",
    price: { amount: 8900, currency: "GBP" },
    images: ["hero://staircase-painted-coastal"],
    featured: false
  }
];

// Realistic hero seed (references library entries the customer's chosen).
const HERO_IMAGE_SEED = [
  { asset: "hero://staircase-spiral-curved-walnut-modern", alt: "Spiral walnut staircase" },
  { asset: "hero://staircase-cantilever-black-metal-modern", alt: "Cantilevered floating staircase" }
];

const SERVICES_SEED = [
  { name: "Bespoke staircase design", summary: "CAD-drawn design tailored to your space, including 3D visualisation." },
  { name: "In-house manufacture", summary: "Every staircase built in our UK workshop by our own joiners." },
  { name: "Nationwide installation", summary: "Delivery and installation across mainland UK by our own installers." }
];

const TEAM_SEED = [
  { name: "James Rowan", role: "Founder & lead designer" },
  { name: "Priya Shah", role: "Head of manufacture" },
  { name: "Marcus Whitely", role: "Install team lead" }
];

const PROJECTS_SEED = [
  { title: "Notting Hill townhouse", location: "London W11", year_completed: 2025 },
  { title: "Cotswolds farmhouse", location: "Chipping Norton", year_completed: 2024 },
  { title: "Chelsea penthouse", location: "London SW3", year_completed: 2024 }
];

/** Produce a Blueprint with the customer-completed profile applied. */
export function buildCompletedStaircaseBlueprint(): AppBlueprint {
  // Start from the raw Blueprint and apply the customer profile.
  const raw = staircaseCompanyBlueprint;

  const identity: AppBlueprint["identity"] = {
    ...raw.identity,
    legalName: CUSTOMER.legalName,
    displayName: CUSTOMER.displayName,
    aboutBlurb: CUSTOMER.aboutBlurb,
    yearFounded: CUSTOMER.yearFounded,
    teamSize: CUSTOMER.teamSize,
    contact: {
      primaryEmail: CUSTOMER.primaryEmail,
      primaryPhone: CUSTOMER.primaryPhone,
      whatsapp: CUSTOMER.whatsapp,
      serviceRadius: {
        centre: { kind: "postcode", value: CUSTOMER.postcode },
        radiusMiles: CUSTOMER.serviceRadiusMiles
      }
    },
    locations: [
      {
        id: "loc_hq",
        label: "London workshop",
        addressLines: ["Unit 4, Kingsway Yard"],
        postcode: CUSTOMER.postcode,
        city: CUSTOMER.city,
        country: "GB",
        isPrimary: true
      }
    ]
  };

  // Copy data models and seed them with the customer's real data.
  const data: AppBlueprint["data"] = raw.data.map((m) => {
    if (m.id === "products") return { ...m, seed: PRODUCT_SEED as unknown as Record<string, unknown>[] };
    if (m.id === "hero_images") return { ...m, seed: HERO_IMAGE_SEED as unknown as Record<string, unknown>[] };
    if (m.id === "services") return { ...m, seed: SERVICES_SEED as unknown as Record<string, unknown>[] };
    if (m.id === "team") return { ...m, seed: TEAM_SEED as unknown as Record<string, unknown>[] };
    if (m.id === "projects") return { ...m, seed: PROJECTS_SEED as unknown as Record<string, unknown>[] };
    return m;
  });

  // Promote the previously-REQUIRED provenance entries to KNOWN with
  // source="customer:completed-profile". Everything else is untouched —
  // the raw Blueprint's INFERRED brand tokens etc. stay INFERRED so the
  // constitutional distinction survives.
  let prov = { ...raw.provenance };
  prov = setKnown(prov, "identity.displayName", "customer:completed-profile", "customer supplied via Studio form");
  prov = setKnown(prov, "identity.contact.primaryEmail", "customer:completed-profile", "customer supplied");
  prov = setKnown(prov, "identity.contact.primaryPhone", "customer:completed-profile", "customer supplied");
  prov = setKnown(prov, "identity.contact.serviceRadius.centre", "customer:completed-profile", "customer supplied postcode");
  prov = setKnown(prov, "identity.contact.serviceRadius.radiusMiles", "customer:completed-profile", "customer supplied radius");

  return {
    ...raw,
    id: "ab_staircase_completed",
    name: CUSTOMER.displayName,
    identity,
    data,
    provenance: prov,
    sourceUtterances: [
      ...raw.sourceUtterances,
      "Company name: Rowan Architectural Staircases",
      "Contact: hello@rowanstaircases.co.uk / +44 20 7946 0322",
      "Based at SW1A 1AA · service radius 40 miles",
      "Four products supplied: Helix, Meridian, Ashcombe, Coastal"
    ],
    meta: {
      ...raw.meta,
      revision: raw.meta.revision + 1,
      updatedAt: new Date().toISOString()
    }
  };
}

export const staircaseCompletedBlueprint = buildCompletedStaircaseBlueprint();

/** Same Blueprint MINUS the displayName · used by the deliberate negative test. */
export function buildCompletedStaircaseBlueprint_WithoutName(): AppBlueprint {
  const bp = buildCompletedStaircaseBlueprint();
  const bp2: AppBlueprint = {
    ...bp,
    id: "ab_staircase_missing_name",
    name: "[Staircase Company Name]",
    identity: {
      ...bp.identity,
      displayName: "[Staircase Company Name]",   // reset to placeholder
      legalName: undefined
    }
  };
  // Provenance for displayName reverts to REQUIRED
  bp2.provenance = { ...bp2.provenance };
  bp2.provenance["identity.displayName"] = {
    level: "REQUIRED",
    source: "blueprint:required",
    reason: "customer did not supply company name in negative test"
  };
  return bp2;
}
