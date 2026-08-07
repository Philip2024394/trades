// Customer resolver — takes a CustomerRef and returns the merchant-
// scoped contact (permission-safe). Every path checks merchant_id so
// a merchant can never resolve another merchant's contact.
//
// Search matching is name-based (case-insensitive substring) across
// the merchant's own contacts. Multiple matches return "ambiguous"
// so Nex can ask "which one?".
//
// Phase 3d.4b · Contact Registry enrichment.
// Every successful resolution now enriches the merchant-scoped record
// with the canonical Contact Registry identity (alias-safe · confidence-
// scored · audited). Downstream consumers (Email · Notifications · CRM ·
// Marketing) resolve through the canonical id without needing to know
// about the per-merchant record.

import "server-only";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { loadContactSummary, type ContactSummary } from "@/lib/crm/loadContactTimeline";
import type { CustomerRef, CustomerResolveErr, CustomerResolveOk } from "./types";
import { resolveContactForAI } from "@/lib/nex/ai/contact_resolver";

const MAX_SEARCH_HITS = 8;

/** Phase 3d.4b · registry enrichment · never throws · returns undefined
 *  when the registry is unreachable so the CX brain remains fully
 *  backward-compatible. */
async function enrichWithRegistry(summary: ContactSummary, caller: string): Promise<CustomerResolveOk["registry"] | undefined> {
  const email = summary.contact.email ?? undefined;
  const phone = summary.contact.whatsappE164 ?? undefined;
  const name  = summary.contact.displayName ?? undefined;
  if (!email && !phone && !name) return undefined;
  try {
    const result = await resolveContactForAI({
      email, phone, name_hint: name,
      caller: `nex-brain:cx:${caller}`,
    });
    const top = result.matches[0];
    if (!top) {
      return {
        canonical_contact_id: null,
        alias_resolved: false,
        confidence: null,
        match_reason: null,
        resolved_at: result.resolved_at,
      };
    }
    return {
      canonical_contact_id: top.contact.contact_id,
      alias_resolved: top.match_reason === "contact_id_alias_resolved",
      confidence: top.confidence,
      match_reason: top.match_reason,
      resolved_at: result.resolved_at,
    };
  } catch {
    return undefined;
  }
}

export async function resolveCustomer(merchantId: string, ref: CustomerRef): Promise<CustomerResolveOk | CustomerResolveErr> {
  switch (ref.kind) {
    case "contact_id": {
      const summary = await loadContactSummary(ref.id, merchantId);
      if (!summary) return { ok: false, reason: "not_yours" };
      const registry = await enrichWithRegistry(summary, "resolve_by_contact_id");
      return { ok: true, contactId: summary.contact.id, summary, registry };
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
      const registry = await enrichWithRegistry(summary, "resolve_by_party_id");
      return { ok: true, contactId: summary.contact.id, summary, registry };
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
      const registry = await enrichWithRegistry(summary, "resolve_by_search");
      return { ok: true, contactId: summary.contact.id, summary, registry };
    }
  }
}
