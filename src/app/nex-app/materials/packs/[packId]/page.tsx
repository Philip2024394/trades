// /nex-app/materials/packs/[packId] — Individual Boards mobile screen.
//
// Server component. Reads pack + boards + measurements via the existing
// getPack service (no schema/service/API changes). Computes overview
// metrics from the same data. Renders the client-side PackDetailScreen.

import { notFound, redirect } from "next/navigation";
import { PackDetailScreen } from "@/components/nex-app/materials/pack-detail/PackDetailScreen";
import { getAuthenticatedUser } from "@/lib/nex/brains/_auth";
import { getPack } from "@/apps/materials/_services/packs";
import { getProvider } from "@/apps/materials/_providers";
import type { PackWithBoards } from "@/apps/materials/_schema/types";
import "../../../nex-app.css";

export const dynamic = "force-dynamic";
export const metadata = { title: "Pack Detail · NEX Materials", robots: { index: false } };

type Ctx = { params: Promise<{ packId: string }> };

export default async function PackDetailPage({ params }: Ctx) {
  const { packId } = await params;

  const auth = await getAuthenticatedUser();
  if (!auth.ok) {
    redirect(`/nex-app/materials/packs`);
  }

  let pack: PackWithBoards;
  try {
    pack = await getPack(auth.user.email, packId);
  } catch (e) {
    if ((e as { status?: number }).status === 404) notFound();
    throw e;
  }

  const overview = computeOverview(pack);
  const speciesShort = deriveSpeciesShort(pack.species.id, pack.species.display_name);

  return (
    <div className="nex-app-root">
      <PackDetailScreen pack={pack} overview={overview} speciesShort={speciesShort} />
    </div>
  );
}

function computeOverview(pack: PackWithBoards) {
  const provider = getProvider("hardwood");
  const totalBoards = pack.boards.length;
  let totalVolumeM3 = 0;
  let reservedM3    = 0;
  let measuredCount = 0;

  for (const b of pack.boards) {
    if (b.current_measurement) {
      const v = provider.computeVolume(b.current_measurement).volume_m3;
      totalVolumeM3 += v;
      measuredCount += 1;
      if (b.status === "allocated" || b.status === "machined" || b.status === "installed") {
        reservedM3 += v;
      }
    }
  }
  const availableM3 = Math.max(0, totalVolumeM3 - reservedM3);
  const measuredPct = totalBoards > 0 ? (measuredCount / totalBoards) * 100 : 0;
  return { totalBoards, totalVolumeM3, availableM3, reservedM3, measuredPct };
}

/** Derive a 3-4 letter code from the species — 'oak_american_white' → 'OAK'. */
function deriveSpeciesShort(id: string, displayName: string): string {
  // Prefer the trailing wood-type token from the display name.
  const firstToken = displayName.split(/\s+/)[0];
  if (firstToken && firstToken.length >= 3) return firstToken.slice(0, 4).toUpperCase();
  return id.slice(0, 4).toUpperCase();
}
