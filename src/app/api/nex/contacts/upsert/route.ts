// POST /api/nex/contacts/upsert — Contact Registry canonical upsert
//
// Every source-importer (trades · newsletter · CRM · form · manual · CSV
// · future API) routes through here. Dedup happens inside the registry
// (canonical_email match · then canonical_phone match). A miss creates a
// new canonical contact; a hit collapses onto the existing one. Both
// cases append to nex.contact_sources so the origin is preserved.
//
// Note: the pre-existing /api/nex/contacts/route.ts is fs-store based
// (Master Contact Database v0). Phase 3b will migrate its data into
// the registry and route the old endpoint through this one.
//
// Doctrine: constitution_nex_contact_intelligence_registry_2026_08_07.md

import { NextResponse } from "next/server";
import { upsertContact } from "@/lib/nex/contacts/registry";
import type { ContactUpsertInput } from "@/lib/nex/contacts/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  let body: Partial<ContactUpsertInput>;
  try {
    body = (await request.json()) as Partial<ContactUpsertInput>;
  } catch {
    return NextResponse.json({ ok: false, error: "invalid_json" }, { status: 400 });
  }

  if (!body.email && !body.phone) {
    return NextResponse.json({ ok: false, error: "email_or_phone_required" }, { status: 400 });
  }

  const source = body.source ?? { type: "manual" };
  try {
    const result = await upsertContact({ ...body, source });
    return NextResponse.json({ ok: true, ...result });
  } catch (err) {
    return NextResponse.json({
      ok: false,
      error: err instanceof Error ? err.message : "upsert_failed",
    }, { status: 500 });
  }
}
