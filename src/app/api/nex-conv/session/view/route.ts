// src/app/api/nex-conv/session/view/route.ts
//
// NEX World-Class Result Card Interaction & Entity Detail Slice
// Philip 2026-09-06 · CEREMONIAL AUTHORIZE
//
// PURPOSE (§9 · §11)
//   Client-fired beacon: "the user just opened the detail page for
//   this entity in this conversation." Populates session.viewedEntity
//   so subsequent chat turns can resolve "does it have a pool?" /
//   "what about parking?" against the entity the user was viewing.
//
// SECURITY
//   Beacon requires an existing conversation_id · never creates a new
//   session · never leaks user info. If the ref_id / vertical / name
//   fails validation, the server responds 400 without mutating state.
//
// PERFORMANCE
//   Fire-and-forget shape · client does not block on the response.
//   Handler is O(1) session upsert.

import { NextResponse, type NextRequest } from "next/server";
import { getSession, upsertSession } from "@/lib/nex/brain/session";
import { getWorldRecordById } from "@/lib/nex/brain/world-adapters";
import { parseRefId } from "@/lib/nex/brain/reference-hydration";
import { presentRecords } from "@/lib/nex/brain/presentation";
import { projectEntityResultCardSetFromPresented } from "@/lib/nex/brain/entity-result-cards";
import { memoize } from "@/lib/nex/brain/entity-result-cards";
import {
  makeViewedEntitySnapshot,
} from "@/lib/nex/brain/universal-discovery/viewed-entity";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type ViewBeaconBody = {
  conversation_id?: string;
  ref_id?: string;
  vertical?: string;
  name?: string;
};

export async function POST(req: NextRequest) {
  let body: ViewBeaconBody;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ok: false, error: "invalid_json" }, { status: 400 });
  }

  const conversation_id = typeof body.conversation_id === "string" ? body.conversation_id.trim() : "";
  if (!conversation_id) {
    return NextResponse.json({ ok: false, error: "conversation_id_required" }, { status: 400 });
  }

  const session = getSession(conversation_id);
  if (!session) {
    // Never create a session from a beacon · beacon is a mutation of
    // existing conversation state only.
    return NextResponse.json({ ok: false, error: "no_session" }, { status: 404 });
  }

  const currentTurn = session.turnCount ?? 1;
  const snapshot = makeViewedEntitySnapshot({
    ref_id: body.ref_id,
    vertical: body.vertical,
    name: body.name,
    turnCount: currentTurn,
    nowIso: new Date().toISOString(),
  });
  if (!snapshot) {
    return NextResponse.json({ ok: false, error: "invalid_beacon_payload" }, { status: 400 });
  }

  // Enrich snapshot with the entity's memoized attribute state so the
  // attribute-query gate can answer "does it have a pool?" against
  // the entity the user was just viewing. Best-effort · silent on
  // adapter miss / DB error · the snapshot itself still lands so
  // pronoun-resolution can name the entity honestly.
  let enrichedSnapshot = snapshot;
  try {
    const parsed = parseRefId(snapshot.ref_id);
    if (parsed && parsed.vertical === snapshot.vertical) {
      const record = await getWorldRecordById({
        vertical: parsed.vertical,
        id: parsed.id,
        market: "ID",
      });
      if (record) {
        const presented = presentRecords({
          records: [record],
          totalAvailable: 1,
          vertical: parsed.vertical,
        });
        const cardSet = projectEntityResultCardSetFromPresented({ presented });
        const memos = memoize(cardSet.cards);
        if (memos[0]) {
          enrichedSnapshot = { ...snapshot, memo: memos[0] };
        }
      }
    }
  } catch { /* silent · memo is optional */ }

  upsertSession({ ...session, viewedEntity: enrichedSnapshot });
  return NextResponse.json({
    ok: true,
    viewed_entity: {
      ref_id: enrichedSnapshot.ref_id,
      vertical: enrichedSnapshot.vertical,
      name: enrichedSnapshot.name,
      viewedInTurn: enrichedSnapshot.viewedInTurn,
      memoized: !!enrichedSnapshot.memo,
    },
  });
}
