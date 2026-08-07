// GET /api/nex/contacts/list — paginated / filtered explorer feed
//
// Query params:
//   search             · matches name · email · company (case-insensitive)
//   country            · exact match (ISO alpha-2)
//   lifecycle_stage    · exact match
//   consent_marketing  · "true" | "false"
//   never_contact      · "true" | "false"
//   limit              · default 50 · max 500
//   offset             · default 0

import { NextResponse } from "next/server";
import { listContacts } from "@/lib/nex/contacts/registry";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function bool(v: string | null): boolean | undefined {
  if (v === "true") return true;
  if (v === "false") return false;
  return undefined;
}

export async function GET(request: Request) {
  const q = new URL(request.url).searchParams;
  const { total, rows } = await listContacts({
    search: q.get("search") ?? undefined,
    country: q.get("country") ?? undefined,
    lifecycle_stage: q.get("lifecycle_stage") ?? undefined,
    consent_marketing: bool(q.get("consent_marketing")),
    never_contact: bool(q.get("never_contact")),
    limit: Number(q.get("limit") ?? 50) || 50,
    offset: Number(q.get("offset") ?? 0) || 0,
  });
  return NextResponse.json({ ok: true, total, rows });
}
