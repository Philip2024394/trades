// POST /api/brain-admin/session/logout

import { clearBrainAdminSessionCookie } from "@/lib/nex/brains/_admin";
import { jsonOk } from "../../_shared";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST() {
  await clearBrainAdminSessionCookie();
  return jsonOk({ signed_out: true });
}
