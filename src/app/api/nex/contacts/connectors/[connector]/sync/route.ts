// POST /api/nex/contacts/connectors/{connector}/sync — trigger a sync run
//
// Body (all optional):
//   { limit?: number, dry_run?: boolean, triggered_by?: "manual" | "cron" | "webhook" }
//
// Returns the ConnectorRunResult so the caller can display / log it.
// Every run also writes an audit event to nex.events via the shared runner.

import { NextResponse } from "next/server";
import { findConnector, PUSH_CONNECTORS, UPLOAD_CONNECTORS } from "@/lib/nex/contacts/connectors";
import { runConnector } from "@/lib/nex/contacts/connectors/_runner";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
// Long-running · disable Next.js's default 30s streaming timeout for
// large syncs. Individual connectors should still bound their own work.
export const maxDuration = 300;

export async function POST(request: Request, ctx: { params: Promise<{ connector: string }> }) {
  const { connector: connectorId } = await ctx.params;

  // Push-mode connectors have no sync() method · admin trigger is invalid.
  if (PUSH_CONNECTORS.some((d) => d.id === connectorId)) {
    return NextResponse.json({
      ok: false,
      error: "push_mode_connector",
      detail: "This connector is event-driven · records arrive from the caller (route/webhook/worker) · no admin sync trigger.",
      connector: connectorId,
    }, { status: 400 });
  }

  // Upload-mode connectors use a dedicated /upload endpoint (accept a file body).
  if (UPLOAD_CONNECTORS.some((d) => d.id === connectorId)) {
    return NextResponse.json({
      ok: false,
      error: "upload_mode_connector",
      detail: `This connector is admin-upload · POST the file to /api/nex/contacts/connectors/${connectorId}/upload instead.`,
      connector: connectorId,
    }, { status: 400 });
  }

  const connector = findConnector(connectorId);
  if (!connector) {
    return NextResponse.json({ ok: false, error: "unknown_connector", connector: connectorId }, { status: 404 });
  }

  let body: { limit?: number; dry_run?: boolean; triggered_by?: "manual" | "cron" | "webhook" } = {};
  try { body = await request.json(); } catch { body = {}; }

  const result = await runConnector(connector, {
    limit: body.limit,
    dry_run: body.dry_run,
    triggered_by: body.triggered_by ?? "manual",
  });

  return NextResponse.json({ ok: result.outcome !== "failed", result });
}
