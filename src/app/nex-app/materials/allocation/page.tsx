// /nex-app/materials/allocation — Board allocation sub-page (placeholder).

import { ClipboardList } from "lucide-react";
import { MaterialsSubPage } from "@/components/nex-app/materials/MaterialsSubPage";
import "../../nex-app.css";

export const dynamic = "force-dynamic";
export const metadata = { title: "Board Allocation · NEX Materials", robots: { index: false } };

export default async function AllocationPage() {
  return (
    <div className="nex-app-root">
      <MaterialsSubPage
        crumbs={[
          { label: "Home",      href: "/nex-app" },
          { label: "Materials", href: "/nex-app/materials" },
          { label: "Board Allocation" },
        ]}
        title="Board Allocation"
        subtitle="Reserve boards for projects and manage active allocations."
        primaryAction={{ label: "New Allocation", href: "/admin/materials/hardwood" }}
        itemsCount={0}
        emptyState={{
          icon: ClipboardList,
          headline: "No active allocations",
          body: "Once boards are measured, allocate them against a project reference. Allocations are non-destructive — released boards return to the available pool with their full history intact.",
        }}
      />
    </div>
  );
}
