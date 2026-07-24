// POST /api/authors/session/logout — clears the Author session cookie.

import { clearAuthorSessionCookie } from "@/lib/nex/brains/_studio";
import { jsonOk } from "../../_shared";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST() {
  await clearAuthorSessionCookie();
  return jsonOk({ signed_out: true });
}
