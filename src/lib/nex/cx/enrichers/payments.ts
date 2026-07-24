// Payments enricher — reads hammerex_sitebook_costs where this
// merchant is the assigned trade AND the customer's homeowner owns
// the parent project. Returns anything with agreed > paid.

import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { evidenceFor, type PaymentOwed } from "../types";

export async function loadPaymentsOwed(opts: {
  merchantListingId: string;
  partyId:           string | null;
  now?:              Date;
}): Promise<PaymentOwed[]> {
  if (!opts.partyId) return [];
  const now = opts.now ?? new Date();

  // Resolve homeowner_id through os_parties → hammerex_homeowners.
  const party = await supabaseAdmin
    .from("os_parties")
    .select("supabase_user_id, email_hash, whatsapp_hash")
    .eq("id", opts.partyId)
    .maybeSingle();
  if (!party.data) return [];
  const p = party.data as { supabase_user_id?: string | null; email_hash?: string | null; whatsapp_hash?: string | null };
  const q = supabaseAdmin.from("hammerex_homeowners").select("id");
  const filter = p.supabase_user_id ? q.eq("supabase_user_id", p.supabase_user_id)
              : p.email_hash        ? q.eq("email_hash", p.email_hash)
              : p.whatsapp_hash     ? q.eq("whatsapp_hash", p.whatsapp_hash)
              : null;
  if (!filter) return [];
  const ho = await filter.maybeSingle();
  if (!ho.data) return [];
  const homeownerId = (ho.data as { id: string }).id;

  // Costs where this merchant is the trade AND the cost isn't fully paid.
  const rows = await supabaseAdmin
    .from("hammerex_sitebook_costs")
    .select("id, project_id, description, agreed_pence, paid_pence, due_at, hammerex_sitebook_projects!inner(title, homeowner_id)")
    .eq("trade_listing_id", opts.merchantListingId)
    .eq("hammerex_sitebook_projects.homeowner_id", homeownerId)
    .neq("status", "cancelled");

  const ev = evidenceFor("hammerex_sitebook_costs (merchant = you, unpaid balance)", ["hammerex_sitebook_costs"]);
  const owed: PaymentOwed[] = [];
  for (const r of rows.data ?? []) {
    const agreed = Number(r.agreed_pence ?? 0);
    const paid   = Number(r.paid_pence ?? 0);
    const outstanding = Math.max(0, agreed - paid);
    if (outstanding === 0) continue;
    const parent = (r as { hammerex_sitebook_projects?: { title?: string | null } | null }).hammerex_sitebook_projects ?? null;
    const dueIso = r.due_at as string | null;
    owed.push({
      cost_id:         String(r.id),
      project_title:   (parent?.title ?? null) as string | null,
      description:     (r.description ?? null) as string | null,
      agreed_pence:    agreed,
      paid_pence:      paid,
      outstanding_pence: outstanding,
      due_at:          dueIso,
      is_overdue:      !!(dueIso && new Date(dueIso).getTime() < now.getTime()),
      evidence:        ev
    });
  }
  // Sort: overdue first, largest outstanding first.
  owed.sort((a, b) => {
    if (a.is_overdue !== b.is_overdue) return a.is_overdue ? -1 : 1;
    return b.outstanding_pence - a.outstanding_pence;
  });
  return owed;
}
