// /nex-app/materials/boards — Individual boards sub-page (placeholder).

import { FileBox } from "lucide-react";
import { MaterialsSubPage } from "@/components/nex-app/materials/MaterialsSubPage";
import "../../nex-app.css";

export const dynamic = "force-dynamic";
export const metadata = { title: "Individual Boards · NEX Materials", robots: { index: false } };

export default async function BoardsPage() {
  return (
    <div className="nex-app-root">
      <MaterialsSubPage
        crumbs={[
          { label: "Home",      href: "/nex-app" },
          { label: "Materials", href: "/nex-app/materials" },
          { label: "Individual Boards" },
        ]}
        title="Individual Boards"
        subtitle="Digital twin for every board in your workshop."
        primaryAction={{ label: "Add Boards", href: "/admin/materials/hardwood" }}
        itemsCount={0}
        emptyState={{
          icon: FileBox,
          headline: "No boards yet",
          body: "Boards appear here once you register a hardwood pack and add its board count. Each board becomes a digital twin you can measure, allocate and track through machining.",
        }}
      />
    </div>
  );
}
