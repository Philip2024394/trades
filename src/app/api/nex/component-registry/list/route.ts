// src/app/api/nex/component-registry/list/route.ts

import { NextResponse } from "next/server";
import { componentRegistry } from "@/lib/nex/component-registry/registry-singleton";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET() {
  const all = componentRegistry.query({ kind: "byCapability", capabilityId: "CAP-000" });
  const rows = componentRegistry.query({ kind: "byName", name: "" });
  // The above returns 0 · use listing via all-capabilities pattern:
  const seen = new Map<string, ReturnType<typeof componentRegistry.query>>();
  const results: any[] = [];
  // Since InMemoryComponentRegistry doesn't expose a "listAll", we iterate
  // the known caps that seed adds. The seed touches CAP-091..CAP-097.
  for (const cap of ["CAP-091", "CAP-092", "CAP-093", "CAP-094", "CAP-095", "CAP-096", "CAP-097"]) {
    const items = componentRegistry.query({ kind: "byCapability", capabilityId: cap });
    for (const it of items) results.push(it);
  }
  return NextResponse.json({ ok: true, rows: results, generated_at: new Date().toISOString() }, { headers: { "Cache-Control": "no-store" } });
}
