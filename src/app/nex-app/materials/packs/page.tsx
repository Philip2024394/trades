// /nex-app/materials/packs — Hardwood packs sub-page (placeholder).
// Reads real data via existing listPacks service. Shows a light list
// when packs exist; empty state otherwise.

import { Package } from "lucide-react";
import { MaterialsSubPage } from "@/components/nex-app/materials/MaterialsSubPage";
import { PacksList } from "@/components/nex-app/materials/lists/PacksList";
import { getAuthenticatedUser } from "@/lib/nex/brains/_auth";
import { listPacks } from "@/apps/materials/_services/packs";
import type { HardwoodPackRow } from "@/apps/materials/_schema/types";
import "../../nex-app.css";

export const dynamic = "force-dynamic";
export const metadata = { title: "Hardwood Packs · NEX Materials", robots: { index: false } };

export default async function PacksPage() {
  const packs = await loadPacks();
  return (
    <div className="nex-app-root">
      <MaterialsSubPage
        crumbs={[
          { label: "Home",      href: "/nex-app" },
          { label: "Materials", href: "/nex-app/materials" },
          { label: "Hardwood Packs" },
        ]}
        title="Hardwood Packs"
        subtitle="Purchase batches and suppliers. Track incoming timber."
        primaryAction={{ label: "New Pack", href: "/admin/materials/hardwood" }}
        itemsCount={packs.length}
        itemsRender={<PacksList packs={packs} />}
        emptyState={{
          icon: Package,
          headline: "No packs yet",
          body: "Register your first hardwood pack to begin tracking purchases, boards and measurements against your inventory.",
        }}
      />
    </div>
  );
}

async function loadPacks(): Promise<HardwoodPackRow[]> {
  try {
    const auth = await getAuthenticatedUser();
    if (!auth.ok) return [];
    return await listPacks(auth.user.email);
  } catch (e) {
    console.error("[materials.packs] load failed", e);
    return [];
  }
}
