// GET /api/nex-native/custom-intro/video?account_id=…
//
// Phase 1.0 Custom Intro · streams the owner's uploaded video.
// Accepts an `account_id` query param so visitors can play the chat
// owner's intro · owner-serve + visitor-serve both route through this
// one endpoint.
//
// Access rules:
//   · Must be signed in (session resolver).
//   · When account_id === self: always allowed (owner previewing).
//   · When account_id !== self: allowed only when the owner has an
//     ACTIVE Custom Intro (video uploaded + enabled). This is the same
//     check the peer-chat mount gate uses · nothing additional is
//     disclosed through this endpoint.

import { NextResponse, type NextRequest } from "next/server";
import { resolveNexAppSessionFromContext } from "@/lib/nex-native/app/session";
import {
  getActiveCustomIntroForOwner,
  getCustomIntroRow,
} from "@/lib/nex-native/custom-intro-service";
import { getObjectStorage } from "@/lib/nex/storage/object-registry";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: NextRequest): Promise<Response> {
  const session = await resolveNexAppSessionFromContext();
  if (!session) {
    return NextResponse.json({ ok: false, error: "not_signed_in" }, { status: 401 });
  }

  const requested = req.nextUrl.searchParams.get("account_id");
  const accountId = requested && requested.trim().length > 0 ? requested.trim() : session.account.id;

  // Access check
  let videoRef: string | null = null;
  if (accountId === session.account.id) {
    const row = await getCustomIntroRow(session.account.id);
    videoRef = row?.video_url ?? null;
  } else {
    const active = await getActiveCustomIntroForOwner(accountId);
    videoRef = active?.video_url ?? null;
  }
  if (!videoRef) {
    return NextResponse.json({ ok: false, error: "not_found" }, { status: 404 });
  }

  // Fetch bytes via the object-storage adapter.
  const [bucket, ...keyParts] = videoRef.split("/");
  const key = keyParts.join("/");
  if (!bucket || !key) {
    return NextResponse.json({ ok: false, error: "bad_ref" }, { status: 500 });
  }
  const storage = getObjectStorage();
  const result = await storage.get(bucket, key);
  if (!result) {
    return NextResponse.json({ ok: false, error: "not_found" }, { status: 404 });
  }

  // Stream the bytes with sensible caching headers.
  return new Response(new Uint8Array(result.body), {
    status: 200,
    headers: {
      "content-type": result.meta.mime_type || "video/mp4",
      "content-length": String(result.body.length),
      // Short cache · the ref is stable per upload but we want revocation
      // (e.g. owner toggles OFF) to kick in quickly.
      "cache-control": "private, max-age=60",
    },
  });
}
