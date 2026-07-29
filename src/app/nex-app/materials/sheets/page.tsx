// /nex-app/materials/sheets — Sheet materials (placeholder).
// MDF, MR MDF, plywood, veneered MDF, flexible MDF, hardboard, chipboard,
// OSB, and flooring boards. Sheet-yield calculations arrive later.

import { Square } from "lucide-react";
import { MaterialsSubPage } from "@/components/nex-app/materials/MaterialsSubPage";
import "../../nex-app.css";

export const dynamic = "force-dynamic";
export const metadata = { title: "Sheets · NEX Materials", robots: { index: false } };

export default async function SheetsPage() {
  return (
    <div className="nex-app-root">
      <MaterialsSubPage
        crumbs={[
          { label: "Home",      href: "/nex-app" },
          { label: "Materials", href: "/nex-app/materials" },
          { label: "Sheets" },
        ]}
        title="Sheets"
        subtitle="MDF · plywood · veneered board · flooring boards."
        primaryAction={{ label: "Tell NEX about a delivery", href: "/nex-app/materials/add" }}
        itemsCount={0}
        emptyState={{
          icon: Square,
          headline: "No sheet stock yet",
          body: "Tell NEX 'Received 12 sheets of 18mm MDF' or 'Bought 6 birch plywood 2440 × 1220' and it'll appear here. Sheet-yield planning arrives with the Hardwood Calculator.",
        }}
      />
    </div>
  );
}
