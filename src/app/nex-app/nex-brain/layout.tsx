// NEX Headquarters layout — server component that fetches sidebar notification
// counts (e.g. Collector pending-claim badge) and passes them into the HQShell.
//
// The counts come from the SAME Supabase directory_seeds table the Collector
// Dashboard reads · no new endpoint, no new table, no duplicate workflow.

import { HQShell, type HQNotificationCounts } from "@/components/nex-app/nex-brain/HQShell";
import { supabaseNexAdmin } from "@/lib/supabaseNexAdmin";
import "../nex-app.css";

export const dynamic = "force-dynamic";

async function loadNotificationCounts(): Promise<HQNotificationCounts> {
  try {
    // Pending claim requests (lifecycle_status in claim_requested / claim_pending)
    const res = await supabaseNexAdmin
      .from("directory_seeds")
      .select("id", { count: "exact", head: true })
      .in("lifecycle_status", ["claim_requested", "claim_pending"]);
    return { collector_claims: res.count ?? 0 };
  } catch {
    return {};
  }
}

export default async function NexBrainLayout({ children }: { children: React.ReactNode }) {
  const notificationCounts = await loadNotificationCounts();
  return <HQShell notificationCounts={notificationCounts}>{children}</HQShell>;
}
