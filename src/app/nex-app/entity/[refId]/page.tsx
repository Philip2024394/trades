// src/app/nex-app/entity/[refId]/page.tsx
//
// NEX Universal Discovery Slice · Entity Detail Route
// Philip 2026-09-06 · CEREMONIAL AUTHORIZE
//
// URL format: /nex-app/entity/<url-encoded refId>
// Where refId is the standard `place:{vertical}:{id}` form used across
// session.entities · reference-resolution · P0.3 hydration.
//
// Server component fetches the WorldRecord via getWorldRecordById()
// then projects to EntityDetail via the universal contract. The
// EntityDetailView (client component) renders the shell + Interested
// flow. Zero fabrication · empty detail short-circuits to an honest
// unavailable page.

import Link from "next/link";
import { notFound } from "next/navigation";
import { getWorldRecordById } from "@/lib/nex/brain/world-adapters";
import { presentRecords } from "@/lib/nex/brain/presentation";
import { projectEntityDetail } from "@/lib/nex/brain/universal-discovery/entity-detail-contract";
import { parseRefId } from "@/lib/nex/brain/reference-hydration";
import { EntityDetailView } from "@/components/nex-app/detail/EntityDetailView";
// NEX Phase 3 · Live surface mounts on every entity page
import { queryEntityLiveCards } from "@/lib/nex/live/entity-live-query";

// Force dynamic · each entity is unique, no caching.
export const dynamic = "force-dynamic";

export default async function EntityDetailPage({
  params,
}: {
  params: Promise<{ refId: string }>;
}) {
  const { refId: rawRefId } = await params;
  const refId = decodeURIComponent(rawRefId);
  const parsed = parseRefId(refId);
  if (!parsed) return <UnavailableDetail message="This item id isn't recognised." />;

  const record = await getWorldRecordById({
    vertical: parsed.vertical,
    id: parsed.id,
    market: "ID",
  });
  if (!record) return <UnavailableDetail message="This item is no longer available in NEX." />;

  const presented = presentRecords({
    records: [record],
    totalAvailable: 1,
    vertical: parsed.vertical,
  });
  const card = presented.cards[0];
  const detail = projectEntityDetail({ record, card });

  // Phase 3 · Live query · returns empty array when no fixtures exist
  // for this entity · never fabricates a session.
  const liveResult = await queryEntityLiveCards({
    entity_ref_id: detail.ref_id,
    entity_name: detail.name,
  });

  // Phase 3.1 diagnostic · lets the founder-journey proof see WHY a
  // real entity might render an empty Live carousel. Server-side log
  // only · no customer surface.
  console.info(`[entity-live] ref=${detail.ref_id} resolved=${liveResult.resolved_mock_entity_id ?? "null"} cards=${liveResult.cards.length} reason=${liveResult.reason}`);

  return <EntityDetailView detail={detail} liveCards={liveResult.cards} />;
}

function UnavailableDetail({ message }: { message: string }) {
  return (
    <div className="mx-auto flex min-h-screen max-w-[560px] flex-col items-center justify-center bg-[var(--nex-cream,#FDFCF9)] px-6 text-center">
      <div className="text-[18px] font-semibold text-[var(--nex-neutral-900,#111)]">
        Item unavailable
      </div>
      <p className="mt-2 text-[14px] text-[var(--nex-neutral-700,#444)]">{message}</p>
      <Link
        href="/nex-appchat"
        className="mt-4 inline-flex items-center rounded-full bg-orange-500 px-4 py-2 text-[13px] font-semibold text-white shadow-sm hover:bg-orange-600"
      >
        Back to NEX
      </Link>
    </div>
  );
}
