// src/app/api/nex/scheduled/route.ts
//
// Founder Phase 18 · P18-3 · List + register scheduled jobs.
// GET  → { jobs, registered_handlers }
// POST { name, handler, cadence, meta?, active? } → upsert

import { NextResponse } from "next/server";
import {
  listJobs,
  listRegisteredHandlers,
  upsertJob,
} from "@/lib/nex/scheduled";

export const runtime = "nodejs";

export async function GET() {
  const jobs = await listJobs();
  const registered_handlers = listRegisteredHandlers();
  return NextResponse.json({ jobs, registered_handlers });
}

export async function POST(req: Request) {
  let body: Record<string, unknown> = {};
  try { body = (await req.json()) as Record<string, unknown>; } catch { /* empty body */ }
  const name = typeof body.name === "string" ? body.name.trim() : "";
  const handler = typeof body.handler === "string" ? body.handler.trim() : "";
  const cadence = typeof body.cadence === "string" ? body.cadence.trim() : "";
  if (!name || !handler || !cadence) {
    return NextResponse.json({ error: "missing_name_handler_or_cadence" }, { status: 400 });
  }
  const registered = listRegisteredHandlers();
  if (!registered.includes(handler)) {
    return NextResponse.json({
      error: "unknown_handler",
      hint: `available: ${registered.join(", ")}`,
    }, { status: 400 });
  }
  const meta = typeof body.meta === "object" && body.meta !== null ? body.meta as Record<string, unknown> : undefined;
  const active = body.active === false ? false : true;
  const job = await upsertJob({ name, handler, cadence, meta, active });
  return NextResponse.json({ job });
}
