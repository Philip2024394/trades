// POST /api/nex/contacts/connectors/manual — admin adds a contact
//
// Body: any ContactUpsertInput fields (email or phone required) plus
// optional admin_actor + entry_note. The source is set to "manual"
// automatically · caller does NOT supply source.

import { NextResponse } from "next/server";
import { recordContactManually, type ManualEntryInput } from "@/lib/nex/contacts/connectors/manual";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  let body: Partial<ManualEntryInput>;
  try {
    body = (await request.json()) as Partial<ManualEntryInput>;
  } catch {
    return NextResponse.json({ ok: false, error: "invalid_json" }, { status: 400 });
  }
  if (!body.email && !body.phone) {
    return NextResponse.json({ ok: false, error: "email_or_phone_required" }, { status: 400 });
  }
  const result = await recordContactManually(body as ManualEntryInput);
  const status = result.ok ? 200 : 500;
  return NextResponse.json(result, { status });
}
