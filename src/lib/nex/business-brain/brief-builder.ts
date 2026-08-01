// Business Brain · Supplier Brief Builder (Philip 2026-08-02)
//
// Turns a SupplierEnquiry into the customer-facing Supplier Brief block that
// Nex presents at Step 3 of the workflow. Verbatim structure from Philip's
// spec (PROJECT TYPE · LOCATION · STYLE · MATERIALS · QUANTITY · STATUS).

import "server-only";
import type { SupplierEnquiry } from "./enquiry-state";

const COUNTRY_LABEL: Record<string, string> = {
  UK: "United Kingdom",
  IE: "Ireland",
  US: "United States",
  CA: "Canada",
  AU: "Australia",
  NZ: "New Zealand",
};

function label(k: keyof SupplierEnquiry, e: SupplierEnquiry): string {
  const v = e[k];
  if (Array.isArray(v)) return v.length > 0 ? v.join(", ") : "—";
  if (typeof v === "string" && v.length > 0) return v;
  return "—";
}

// Philip 2026-08-02 · Opportunity 1 · Visual Brain → Supplier Workflow Bridge v1.
// State-appropriate caveat that follows the design reference in the brief.
// Never presents the image as a specification · always defers to supplier review.
const DESIGN_REFERENCE_CAVEAT: Record<string, string> = {
  concept:
    "Image shows possible appearance only (Nex generated concept). Exact manufacture requires supplier review · a supplier still needs measurements, drawings, site conditions, regulations and engineering checks before committing.",
  reference:
    "Image is a style direction only. Exact manufacture may vary · supplier review required for measurements, drawings, site conditions and engineering checks.",
  manufacturer:
    "Image is a real manufacturer product photo · not a customer specification. Availability, current pricing and suitability must be confirmed directly with the manufacturer.",
  customer_project:
    "Image is a real customer installation reference · not a specification for this project. A supplier still needs measurements, drawings and engineering checks.",
};

export function formatSupplierBrief(enquiry: SupplierEnquiry): string {
  const country = enquiry.country
    ? `${COUNTRY_LABEL[enquiry.country] ?? enquiry.country}${enquiry.project_location ? ` · ${enquiry.project_location}` : ""}`
    : (enquiry.project_location ?? "—");

  const projectType = enquiry.project_type
    ? enquiry.project_type.replace(/_/g, " ")
    : "Residential staircase";

  const size = enquiry.approximate_size ? ` · ${enquiry.approximate_size}` : "";

  const lines: string[] = [];

  // Philip 2026-08-02 · Bridge output · DESIGN REFERENCE block appears FIRST when
  // the customer was looking at Nex Visual Brain images. Uses the state-appropriate
  // caveat (concept · reference · manufacturer · customer_project) so the supplier
  // reading the brief knows exactly what the image is and what it isn't.
  if (enquiry.design_references && enquiry.design_references.length > 0) {
    lines.push(`DESIGN REFERENCE:`);
    for (const ref of enquiry.design_references) {
      const label = ref.title ?? ref.design_id;
      const stateName = ref.image_state
        .replace("customer_project", "customer project")
        .replace(/^\w/, (c) => c.toUpperCase());
      lines.push(`${stateName} · ${label} (${ref.design_id})`);
    }
    // Single caveat, keyed off the FIRST reference's state · all references in a
    // single brief will normally share the same state (they came from one retrieval).
    const primaryState = enquiry.design_references[0].image_state;
    const caveat = DESIGN_REFERENCE_CAVEAT[primaryState] ?? DESIGN_REFERENCE_CAVEAT.concept;
    lines.push(``);
    lines.push(`IMPORTANT:`);
    lines.push(caveat);
    lines.push(``);
  }

  lines.push(
    `PROJECT TYPE:`,
    `${projectType}${size}`,
    ``,
    `LOCATION:`,
    country,
    ``,
    `STYLE:`,
    label("design_style", enquiry),
    ``,
    `MATERIALS:`,
    label("materials", enquiry),
    ``,
    `STAIRCASE TYPE:`,
    label("staircase_type", enquiry),
    ``,
    `QUANTITY:`,
    label("quantity", enquiry),
    ``,
    `TIMEFRAME:`,
    label("timeframe", enquiry),
    ``,
    `STATUS:`,
    `Customer looking for manufacturer · brief prepared by Nex`,
    ``,
    `Reference: ${enquiry.enquiry_id}`,
  );

  return lines.join("\n");
}

// Machine-readable version · this is what future CRM ingestion consumes.
export function supplierBriefAsRecord(enquiry: SupplierEnquiry): Record<string, unknown> {
  return {
    enquiry_id:        enquiry.enquiry_id,
    conversation_id:   enquiry.conversation_id,
    project_type:      enquiry.project_type ?? "residential_staircase",
    country:           enquiry.country,
    project_location:  enquiry.project_location,
    design_style:      enquiry.design_style,
    materials:         enquiry.materials ?? [],
    staircase_type:    enquiry.staircase_type,
    approximate_size:  enquiry.approximate_size,
    quantity:          enquiry.quantity,
    timeframe:         enquiry.timeframe,
    use_case:          enquiry.use_case,
    project_stage:     enquiry.project_stage,
    // Philip 2026-08-02 · Bridge output · design references + explicit note that
    // the image is a reference, NOT a specification. CRM ingestion should treat
    // this field as customer-facing context, never as an order specification.
    design_references: enquiry.design_references ?? [],
    design_note:       (enquiry.design_references && enquiry.design_references.length > 0)
      ? "Design references are for context only · not a specification · supplier review required"
      : undefined,
    status:            "customer_looking_for_manufacturer",
    prepared_by:       "nex",
    prepared_at:       new Date(enquiry.updated_at).toISOString(),
  };
}
