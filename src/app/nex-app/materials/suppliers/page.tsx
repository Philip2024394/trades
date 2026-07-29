// /nex-app/materials/suppliers — Suppliers sub-page (placeholder).
// Suppliers is an inventory concern (who a pack was bought from ·
// contact details · purchase history) and belongs inside the Stock
// module per the v1.2 refactor.

import { Truck } from "lucide-react";
import { MaterialsSubPage } from "@/components/nex-app/materials/MaterialsSubPage";
import "../../nex-app.css";

export const dynamic = "force-dynamic";
export const metadata = { title: "Suppliers · NEX Materials", robots: { index: false } };

export default async function SuppliersPage() {
  return (
    <div className="nex-app-root">
      <MaterialsSubPage
        crumbs={[
          { label: "Home",      href: "/nex-app" },
          { label: "Materials", href: "/nex-app/materials" },
          { label: "Suppliers" },
        ]}
        title="Suppliers"
        subtitle="Manage timber merchants and their purchase history."
        primaryAction={{ label: "New Supplier", href: "/admin/materials" }}
        itemsCount={0}
        emptyState={{
          icon: Truck,
          headline: "No suppliers yet",
          body: "Suppliers appear here once you register your first hardwood pack. Each supplier keeps a running history of packs bought, delivery lead time, and any notes on quality.",
        }}
      />
    </div>
  );
}
