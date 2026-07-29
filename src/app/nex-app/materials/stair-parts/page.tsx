// /nex-app/materials/stair-parts — Stair Parts (placeholder).
// Newels, balusters, handrails, baserails, tread blanks, string blanks,
// riser blanks, kite winders, bullnose treads, plinth blocks, rosettes,
// cover caps. Rich per-part detail arrives after v1 freeze.

import { Blocks } from "lucide-react";
import { MaterialsSubPage } from "@/components/nex-app/materials/MaterialsSubPage";
import "../../nex-app.css";

export const dynamic = "force-dynamic";
export const metadata = { title: "Stair Parts · NEX Materials", robots: { index: false } };

export default async function StairPartsPage() {
  return (
    <div className="nex-app-root">
      <MaterialsSubPage
        crumbs={[
          { label: "Home",      href: "/nex-app" },
          { label: "Materials", href: "/nex-app/materials" },
          { label: "Stair Parts" },
        ]}
        title="Stair Parts"
        subtitle="Newels · balusters · handrails · baserails · blanks."
        primaryAction={{ label: "Tell NEX about a delivery", href: "/nex-app/materials/add" }}
        itemsCount={0}
        emptyState={{
          icon: Blocks,
          headline: "No stair parts yet",
          body: "Stair parts appear here as you tell NEX about deliveries — 'Received 40 pine string blanks', 'Bought 12 mopstick handrails'. Once the Hardwood Calculator ships, this view also shows what parts your active projects need.",
        }}
      />
    </div>
  );
}
