// Enquiry persistence to Supabase (Philip 2026-08-02 · Supplier Memory v1).
//
// Called from runSupplierWorkflow the moment a brief is assembled. Never
// blocks the customer-facing response — persistence runs fire-and-forget
// so a Supabase outage never breaks the workflow. Failures are logged.
//
// Every insert carries:
//   - PII-masked brief_record (via maskPII)
//   - prepared_at timestamp
//   - matched_supplier_ids extracted from the match list
//   - status='prepared' (admin flips to 'delivered' when they forward to supplier)
//
// This is a WRITE path only. Reading enquiries back happens in the admin UI
// (Phase 1.5) and, later, in the memory-informed matching layer.

import "server-only";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { maskPII } from "./pii-mask";
import type { SupplierEnquiry } from "./enquiry-state";

export type PersistBriefInput = {
  enquiry: SupplierEnquiry;
  brief_record: Record<string, unknown>;
  matched_supplier_ids: string[];
};

/**
 * Persist an assembled brief to Supabase. Fire-and-forget · never throws
 * · never blocks the workflow. Failures logged for admin investigation.
 */
export async function persistBrief(input: PersistBriefInput): Promise<void> {
  try {
    const { enquiry, brief_record, matched_supplier_ids } = input;

    const maskedBrief = maskPII(brief_record);
    const maskedRefs  = enquiry.design_references
      ? maskPII(enquiry.design_references)
      : null;

    const row = {
      enquiry_id:            enquiry.enquiry_id,
      conversation_id:       enquiry.conversation_id,
      customer_country:      enquiry.country ?? null,
      brief_record:          maskedBrief,
      design_references:     maskedRefs,
      matched_supplier_ids:  matched_supplier_ids,
      status:                "prepared",
      prepared_at:           new Date(enquiry.updated_at).toISOString(),
    };

    const { error } = await supabaseAdmin
      .from("nex_supplier_enquiries")
      .upsert(row, { onConflict: "enquiry_id" });

    if (error) {
      // eslint-disable-next-line no-console
      console.warn(
        "[nex-supplier-memory] persistBrief failed (non-fatal · workflow continues):",
        error.message,
        "· enquiry_id=", enquiry.enquiry_id,
      );
    }
  } catch (err) {
    // eslint-disable-next-line no-console
    console.warn(
      "[nex-supplier-memory] persistBrief threw (non-fatal):",
      (err as Error).message,
    );
  }
}
