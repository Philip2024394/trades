// src/app/api/nex/enterprise/teams/[id]/audit/export/route.ts
//
// Founder Phase 16 · P16-3 · SIEM-ready audit export.
//
// ?format=ndjson (default · one JSON per line · Splunk/Elastic native)
// ?format=json   (single JSON array · for small teams)
//
// Restricted to owner|admin. Records its own audit event.

import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { resolveSession } from "@/lib/nex/identity-auth";
import { getRoleInTeam, iterAuditEventsAsc, recordAuditEvent } from "@/lib/nex/enterprise";

export const runtime = "nodejs";

export async function GET(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const cookieStore = await cookies();
  const token = cookieStore.get("nex_session")?.value ?? null;
  const session = await resolveSession(token);
  if (!session?.user_id) return NextResponse.json({ error: "unauthenticated" }, { status: 401 });
  const role = await getRoleInTeam(id, session.user_id);
  if (role !== "owner" && role !== "admin") {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }

  const url = new URL(req.url);
  const format = (url.searchParams.get("format") ?? "ndjson").toLowerCase();

  // Record the export itself.
  await recordAuditEvent({
    team_id: id,
    actor_user_id: session.user_id,
    action: "audit.export",
    target: id,
    meta: { format },
  });

  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    async start(controller) {
      try {
        if (format === "json") {
          controller.enqueue(encoder.encode("["));
          let first = true;
          for await (const row of iterAuditEventsAsc(id)) {
            if (!first) controller.enqueue(encoder.encode(","));
            first = false;
            controller.enqueue(encoder.encode(JSON.stringify(row)));
          }
          controller.enqueue(encoder.encode("]"));
        } else {
          // ndjson (default)
          for await (const row of iterAuditEventsAsc(id)) {
            controller.enqueue(encoder.encode(JSON.stringify(row) + "\n"));
          }
        }
        controller.close();
      } catch (e) {
        controller.error(e);
      }
    },
  });

  const contentType = format === "json" ? "application/json" : "application/x-ndjson";
  const filename = `nex-audit-${id}-${new Date().toISOString().slice(0, 10)}.${format === "json" ? "json" : "ndjson"}`;
  return new Response(stream, {
    headers: {
      "Content-Type": contentType,
      "Content-Disposition": `attachment; filename="${filename}"`,
      "X-Audit-Export-Format": format,
    },
  });
}
