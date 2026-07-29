// /nex-app/materials — Module launcher (Screen 2).
// Server component. Loads two things in parallel:
//   · Today's Overview metrics (aggregate stock summary)
//   · Recent Activity (day-grouped audit log)
// Falls back gracefully when unauthenticated — the launcher is
// public-safe and never 500s.

import { MaterialsLanding, type OverviewData } from "@/components/nex-app/materials/MaterialsLanding";
import { getAuthenticatedUser } from "@/lib/nex/brains/_auth";
import { stockSummaryForOwner } from "@/apps/materials/_services/stock";
import { loadRecentActivity } from "@/apps/materials/_services/recent_activity";
import type { ActivityGroup } from "@/apps/materials/_services/recent_activity";
import "../nex-app.css";

export const dynamic = "force-dynamic";
export const metadata = { title: "NEX Materials · Hardwood Manager", robots: { index: false } };

export default async function MaterialsLandingPage() {
  const [overview, activity] = await loadLandingData();
  return (
    <div className="nex-app-root">
      <MaterialsLanding overview={overview} activity={activity} />
    </div>
  );
}

async function loadLandingData(): Promise<[OverviewData, ActivityGroup[]]> {
  const emptyOverview: OverviewData = { boards: 0, packs: 0, availableM3: 0, reservedM3: 0 };
  const emptyActivity: ActivityGroup[] = [];

  try {
    const auth = await getAuthenticatedUser();
    if (!auth.ok) return [emptyOverview, emptyActivity];

    const [summary, activity] = await Promise.all([
      stockSummaryForOwner(auth.user.email).catch((e) => {
        console.error("[materials.launcher] overview load failed", e);
        return [];
      }),
      loadRecentActivity(auth.user.email, 12).catch((e) => {
        console.error("[materials.launcher] activity load failed", e);
        return [] as ActivityGroup[];
      }),
    ]);

    let boards = 0, packs = 0, totalM3 = 0, measuredCount = 0, allocatedCount = 0;
    for (const s of summary) {
      boards         += s.board_count;
      packs          += s.pack_count;
      totalM3        += s.total_volume_m3;
      measuredCount  += s.measured_board_count;
      allocatedCount += s.allocated_count;
    }
    // Reserved volume is estimated proportionally: the existing service
    // exposes allocated_count but not allocated_volume_m3 directly.
    const reservedM3  = measuredCount > 0 ? totalM3 * (allocatedCount / measuredCount) : 0;
    const availableM3 = Math.max(0, totalM3 - reservedM3);

    return [{ boards, packs, availableM3, reservedM3 }, activity];
  } catch (e) {
    console.error("[materials.launcher] load failed", e);
    return [emptyOverview, emptyActivity];
  }
}
