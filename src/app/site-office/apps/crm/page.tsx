// /site-office/apps/crm — merchant contacts list.

import { redirect } from "next/navigation";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { getMerchantIdFromRequest } from "@/lib/os/merchantSession";
import { ContactsList } from "./ContactsList";

export const dynamic = "force-dynamic";

const STAGE_ORDER = [
  "engaged",
  "quoted",
  "active",
  "signed_off",
  "won",
  "silent",
  "new",
  "lost"
] as const;

export default async function CrmHomePage({
  searchParams
}: {
  searchParams: Promise<{ stage?: string; q?: string; m?: string }>;
}) {
  const sp = await searchParams;
  const merchantId = await getMerchantIdFromRequest(sp.m || null);
  if (!merchantId) {
    redirect("/site-office?next=/site-office/apps/crm");
  }
  const stage = sp.stage || null;
  const q = (sp.q || "").trim();

  let query = supabaseAdmin
    .from("app_crm_contacts")
    .select(
      "id, display_name, email, whatsapp_e164, postcode, lifecycle_stage, source, tags, last_activity_at, last_touch_at, next_follow_up_at, quiet_since, created_at"
    )
    .eq("merchant_id", merchantId)
    .order("last_activity_at", { ascending: false, nullsFirst: false })
    .limit(300);
  if (stage) query = query.eq("lifecycle_stage", stage);
  if (q.length > 1) {
    query = query.or(
      `display_name.ilike.%${q}%,email.ilike.%${q}%,postcode.ilike.%${q}%`
    );
  }
  const { data: contacts } = await query;

  // Group counts by stage for tab pills
  const { data: allContacts } = await supabaseAdmin
    .from("app_crm_contacts")
    .select("lifecycle_stage")
    .eq("merchant_id", merchantId);
  const stageCounts = new Map<string, number>();
  (allContacts || []).forEach((c) => {
    stageCounts.set(
      c.lifecycle_stage,
      (stageCounts.get(c.lifecycle_stage) || 0) + 1
    );
  });

  // Open follow-up count
  const { count: openTaskCount } = await supabaseAdmin
    .from("app_crm_tasks")
    .select("id", { count: "exact", head: true })
    .eq("merchant_id", merchantId)
    .eq("status", "open")
    .lte("due_at", new Date().toISOString());

  return (
    <div className="mx-auto max-w-6xl p-4 md:p-6">
      <header className="mb-6">
        <p className="text-[13px] font-semibold uppercase tracking-wide text-neutral-500">
          Sales
        </p>
        <h1 className="mt-1 text-2xl font-bold md:text-3xl">Contacts</h1>
        <p className="mt-1 text-[14px] text-neutral-600">
          Every person you've ever done work for, or nearly did. One
          page per contact, all their activity in one timeline.
        </p>
        {openTaskCount && openTaskCount > 0 ? (
          <div className="mt-3 inline-flex items-center gap-1.5 rounded-full bg-amber-100 px-2.5 py-1 text-[13px] font-semibold text-amber-900">
            {openTaskCount} follow-up{openTaskCount === 1 ? "" : "s"} due
          </div>
        ) : null}
      </header>

      <ContactsList
        contacts={(contacts || []).map((c) => ({
          id: c.id,
          displayName: c.display_name,
          email: c.email,
          whatsappE164: c.whatsapp_e164,
          postcode: c.postcode,
          stage: c.lifecycle_stage,
          source: c.source,
          tags: c.tags || [],
          lastActivityAt: c.last_activity_at,
          nextFollowUpAt: c.next_follow_up_at,
          quietSince: c.quiet_since
        }))}
        activeStage={stage}
        stageOrder={STAGE_ORDER}
        stageCounts={Object.fromEntries(stageCounts.entries())}
        initialQuery={q}
      />
    </div>
  );
}
