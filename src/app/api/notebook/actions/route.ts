// GET /api/notebook/actions
//
// Returns the current merchant's action-required notebook events —
// the small subset of events that need the merchant to DO something
// (respond to a review inside its 72h window, act on a dispute, etc).
//
// Read-only. Auth via the same session cookie the merchant session
// uses. Anonymous callers get an empty array; the client banner just
// stays hidden.
//
// The full notebook page reads events via the server-side call to
// eventsForMerchantFromDb. This endpoint is the lightweight
// client-facing version that only powers the top-of-canteen banner.

import { NextResponse } from "next/server";
import { getMerchantSlug } from "@/lib/merchantSession";
import { eventsForMerchantFromDb } from "@/lib/notebook.server";

export async function GET() {
  const slug = await getMerchantSlug();
  if (!slug) {
    // Unauthenticated → no banner. Not an error state.
    return NextResponse.json({ ok: true, actions: [], count: 0 });
  }

  try {
    const events = await eventsForMerchantFromDb(slug);
    const actions = events
      .filter((e) => e.actionRequired)
      .slice(0, 3)
      .map((e) => ({
        id: e.id,
        kind: e.kind,
        title: e.title,
        deadlineAt: e.deadlineAt ?? null,
        actionLabel: e.action?.label ?? null,
        actionHref: e.action?.href ?? null
      }));
    return NextResponse.json({ ok: true, actions, count: actions.length });
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error("[notebook.actions] fetch failed", err);
    return NextResponse.json({ ok: true, actions: [], count: 0 });
  }
}
