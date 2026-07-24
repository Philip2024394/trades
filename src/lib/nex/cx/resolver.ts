// Customer resolver — takes a CustomerRef and returns the merchant-
// scoped contact (permission-safe). Every path checks merchant_id so
// a merchant can never resolve another merchant's contact.
//
// Search matching is name-based (case-insensitive substring) across
// the merchant's own contacts. Multiple matches return "ambiguous"
// so Nex can ask "which one?".

import "server-only";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { loadContactSummary } from "@/lib/crm/loadContactTimeline";
import type { CustomerRef, CustomerResolveErr, CustomerResolveOk } from "./types";

const MAX_SEARCH_HITS = 8;

export async function resolveCustomer(merchantId: string, ref: CustomerRef): Promise<CustomerResolveOk | CustomerResolveErr> {
  switch (ref.kind) {
    case "contact_id": {
      const summary = await loadContactSummary(ref.id, merchantId);
      if (!summary) return { ok: false, reason: "not_yours" };
      return { ok: true, contactId: summary.contact.id, summary };
    }

    case "party_id": {
      const { data } = await supabaseAdmin
        .from("app_crm_contacts")
        .select("id")
        .eq("merchant_id", merchantId)
        .eq("party_id", ref.id)
        .maybeSingle();
      if (!data) return { ok: false, reason: "not_yours" };
      const summary = await loadContactSummary(String(data.id), merchantId);
      if (!summary) return { ok: false, reason: "not_yours" };
      return { ok: true, contactId: summary.contact.id, summary };
    }

    case "search": {
      const q = ref.query.trim();
      if (!q) return { ok: false, reason: "not_found" };
      const { data } = await supabaseAdmin
        .from("app_crm_contacts")
        .select("id, display_name, lifecycle_stage, last_activity_at")
        .eq("merchant_id", merchantId)
        .ilike("display_name", `%${q}%`)
        .order("last_activity_at", { ascending: false, nullsFirst: false })
        .limit(MAX_SEARCH_HITS);
      const rows = data ?? [];
      if (rows.length === 0) return { ok: false, reason: "not_found" };
      if (rows.length > 1) {
        return {
          ok: false,
          reason: "ambiguous",
          matches: rows.map((r) => ({
            contactId:      String(r.id),
            displayName:    String(r.display_name),
            lifecycleStage: String(r.lifecycle_stage),
            lastActivityAt: (r.last_activity_at as string | null) ?? null
          }))
        };
      }
      const only = rows[0];
      const summary = await loadContactSummary(String(only.id), merchantId);
      if (!summary) return { ok: false, reason: "not_yours" };
      return { ok: true, contactId: summary.contact.id, summary };
    }
  }
}
