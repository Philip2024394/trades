// POST /api/brain-admin/session/login
// Body: { invite_token: string }

import type { NextRequest } from "next/server";
import { nexBrainAdminEnabled, setBrainAdminSessionCookie, verifyBrainAdminInviteToken } from "@/lib/nex/brains/_admin";
import { jsonError, jsonOk } from "../../_shared";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  if (!nexBrainAdminEnabled()) return jsonError("brain_admin_disabled", "Brain Admin disabled", 503);

  let body: { invite_token?: unknown };
  try { body = await req.json(); } catch {
    return jsonError("invalid_json", "Request body is not valid JSON");
  }
  if (typeof body.invite_token !== "string" || body.invite_token.trim() === "") {
    return jsonError("bad_request", "invite_token is required");
  }

  const result = verifyBrainAdminInviteToken(body.invite_token.trim());
  if (!result.ok) return jsonError(`invite_${result.reason}`, `Invite verification failed: ${result.reason}`, 401);

  await setBrainAdminSessionCookie(result.adminId);
  return jsonOk({ admin_id: result.adminId });
}
