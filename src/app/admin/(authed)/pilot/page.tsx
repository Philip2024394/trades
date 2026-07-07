// /admin/pilot — pilot ops dashboard.
//
// One page. Funnel counters at the top, median times below, active
// participants beside, friction reports feed on the right. Read-only:
// pilot ops uses this to know what's blocking real users. Every number
// is a link to the underlying rows so investigation is one click away.

import { redirect } from "next/navigation";
import { isAdminAuthed } from "@/lib/adminAuth";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { loadFunnelSummary } from "@/lib/os/pilot/funnel";
import { listFrictionReports } from "@/lib/os/pilot/friction";
import { PilotOverview } from "./PilotOverview";

export const dynamic = "force-dynamic";

const DEFAULT_COHORT = process.env.PILOT_COHORT || "pilot-1";

export default async function AdminPilotPage({
  searchParams
}: {
  searchParams: Promise<{ cohort?: string }>;
}) {
  if (!(await isAdminAuthed())) {
    redirect("/admin/login?next=/admin/pilot");
  }
  const sp = await searchParams;
  const cohort = sp.cohort || DEFAULT_COHORT;

  const [funnel, participantsRes, frictionUnresolved, frictionRecent] =
    await Promise.all([
      loadFunnelSummary(cohort),
      supabaseAdmin
        .from("os_pilot_participants")
        .select("*")
        .eq("cohort", cohort)
        .order("started_at", { ascending: false }),
      listFrictionReports({ cohort, unresolvedOnly: true, limit: 50 }),
      listFrictionReports({ cohort, limit: 50 })
    ]);

  return (
    <PilotOverview
      cohort={cohort}
      funnel={funnel}
      participants={(participantsRes.data || []).map((p) => ({
        id: p.id,
        merchantId: p.merchant_id,
        homeownerPartyId: p.homeowner_party_id,
        merchantDisplayName: p.merchant_display_name,
        homeownerDisplayName: p.homeowner_display_name,
        friendlyLabel: p.friendly_label,
        status: p.status,
        startedAt: p.started_at,
        completedAt: p.completed_at
      }))}
      unresolvedFriction={frictionUnresolved}
      recentFriction={frictionRecent}
    />
  );
}
