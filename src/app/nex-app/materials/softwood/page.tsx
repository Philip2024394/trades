// /nex-app/materials/softwood — Softwood Stock (placeholder).
// Pine, redwood, whitewood, hemlock, spruce, cedar · used for landing
// joists, framing, understair carcasses. Real stock support arrives
// after the Materials v1 freeze lifts and softwood provider lands.

import { TreePine } from "lucide-react";
import { MaterialsSubPage } from "@/components/nex-app/materials/MaterialsSubPage";
import "../../nex-app.css";

export const dynamic = "force-dynamic";
export const metadata = { title: "Softwood Stock · NEX Materials", robots: { index: false } };

export default async function SoftwoodStockPage() {
  return (
    <div className="nex-app-root">
      <MaterialsSubPage
        crumbs={[
          { label: "Home",      href: "/nex-app" },
          { label: "Materials", href: "/nex-app/materials" },
          { label: "Softwood Stock" },
        ]}
        title="Softwood Stock"
        subtitle="Pine · Redwood · Hemlock · Spruce. Boards, joists and framing timber."
        primaryAction={{ label: "Tell NEX about a delivery", href: "/nex-app/materials/add" }}
        itemsCount={0}
        emptyState={{
          icon: TreePine,
          headline: "No softwood stock yet",
          body: "Tell NEX what you've received on the Materials home and it'll create the pack, register the boards and update stock — same as hardwood. Softwood-specific views (landing joists, framing lengths) arrive in a later release.",
        }}
      />
    </div>
  );
}
