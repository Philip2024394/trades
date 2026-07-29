// /nex-app/materials/offcuts — Offcuts sub-page (placeholder).

import { Scissors } from "lucide-react";
import { MaterialsSubPage } from "@/components/nex-app/materials/MaterialsSubPage";
import "../../nex-app.css";

export const dynamic = "force-dynamic";
export const metadata = { title: "Offcuts · NEX Materials", robots: { index: false } };

export default async function OffcutsPage() {
  return (
    <div className="nex-app-root">
      <MaterialsSubPage
        crumbs={[
          { label: "Home",      href: "/nex-app" },
          { label: "Materials", href: "/nex-app/materials" },
          { label: "Offcuts" },
        ]}
        title="Offcuts"
        subtitle="Manage offcuts and remaining timber inventory."
        primaryAction={{ label: "Log Offcut", href: "/admin/materials/hardwood" }}
        itemsCount={0}
        emptyState={{
          icon: Scissors,
          headline: "No offcuts yet",
          body: "Offcuts appear here when a board is partially consumed. Each offcut carries its parent board's provenance so nothing gets forgotten in a corner of the workshop.",
        }}
      />
    </div>
  );
}
