// POST /api/authors/session/login
// Body: { invite_token: string }
// On success: sets tn_author_sid cookie, returns { author_id }.

import type { NextRequest } from "next/server";
import { nexAuthorStudioEnabled, setAuthorSessionCookie, verifyInviteToken } from "@/lib/nex/brains/_studio";
import { jsonError, jsonOk } from "../../_shared";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  if (!nexAuthorStudioEnabled()) return jsonError("author_studio_disabled", "Studio not enabled", 503);

  let body: { invite_token?: unknown };
  try { body = await req.json(); } catch {
    return jsonError("invalid_json", "Request body is not valid JSON");
  }
  if (typeof body.invite_token !== "string" || body.invite_token.trim() === "") {
    return jsonError("bad_request", "invite_token is required");
  }

  const result = verifyInviteToken(body.invite_token.trim());
  if (!result.ok) return jsonError(`invite_${result.reason}`, `Invite verification failed: ${result.reason}`, 401);

  await setAuthorSessionCookie(result.authorId);
  return jsonOk({ author_id: result.authorId });
}
