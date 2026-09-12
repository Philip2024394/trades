// src/app/api/nex/agent/migration/introspect/route.ts
//
// NEX Agent v1.3 · POST { schema, table } → full shape of the table.
// Read-only · fine to expose broadly · founder can eyeball any table before proposing a migration.

import { NextResponse } from "next/server";
import { postgresSchemaIntrospect } from "@/lib/nex-agent/tools/database";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  let body: { schema?: string; table?: string } = {};
  try { body = await req.json(); } catch { /* empty */ }
  const schema = String(body.schema ?? "").trim();
  const table = String(body.table ?? "").trim();
  if (!schema || !table) return NextResponse.json({ ok: false, error: "schema_and_table_required" }, { status: 400 });
  const r = await postgresSchemaIntrospect(schema, table);
  return NextResponse.json(r);
}
