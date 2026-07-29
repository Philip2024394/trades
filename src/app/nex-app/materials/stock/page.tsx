// /nex-app/materials/stock — Stock summary sub-page (placeholder).
// Uses existing stockSummaryForOwner service.

import { BarChart3 } from "lucide-react";
import { MaterialsSubPage } from "@/components/nex-app/materials/MaterialsSubPage";
import { StockList } from "@/components/nex-app/materials/lists/StockList";
import { getAuthenticatedUser } from "@/lib/nex/brains/_auth";
import { stockSummaryForOwner } from "@/apps/materials/_services/stock";
import type { StockSummaryRow } from "@/apps/materials/_schema/types";
import "../../nex-app.css";

export const dynamic = "force-dynamic";
export const metadata = { title: "Stock Summary · NEX Materials", robots: { index: false } };

export default async function StockPage() {
  const rows = await loadStock();
  return (
    <div className="nex-app-root">
      <MaterialsSubPage
        crumbs={[
          { label: "Home",      href: "/nex-app" },
          { label: "Materials", href: "/nex-app/materials" },
          { label: "Stock Summary" },
        ]}
        title="Stock Summary"
        subtitle="See total volume by species and check available stock."
        primaryAction={{ label: "New Pack", href: "/admin/materials/hardwood" }}
        itemsCount={rows.length}
        itemsRender={<StockList rows={rows} />}
        emptyState={{
          icon: BarChart3,
          headline: "No stock to summarise yet",
          body: "Stock appears here as soon as your first pack has one measured board. Aggregation is grouped by species and rolls into the launcher's Today's Overview card.",
        }}
      />
    </div>
  );
}

async function loadStock(): Promise<StockSummaryRow[]> {
  try {
    const auth = await getAuthenticatedUser();
    if (!auth.ok) return [];
    return await stockSummaryForOwner(auth.user.email);
  } catch (e) {
    console.error("[materials.stock] load failed", e);
    return [];
  }
}
