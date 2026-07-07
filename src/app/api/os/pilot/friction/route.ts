// POST /api/os/pilot/friction — public submission from the widget.
// No auth: friction reports are pilot-scoped feedback and honesty
// benefits from anonymity. Cohort + screen_id come from the client;
// admin filters by cohort in the dashboard.
import { NextResponse, type NextRequest } from "next/server";
import { submitFrictionReport } from "@/lib/os/pilot/friction";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Body = {
  cohort?: unknown;
  screenId?: unknown;
  severity?: unknown;
  actorKind?: unknown;
  body?: unknown;
  context?: unknown;
};

const SEVERITIES = new Set(["stuck", "confusion", "minor", "positive"]);
const ACTORS = new Set(["merchant", "homeowner", "trade", "admin"]);

export async function POST(req: NextRequest) {
  let body: Body;
  try {
    body = (await req.json()) as Body;
  } catch {
    return NextResponse.json({ ok: false, error: "Invalid JSON." }, { status: 400 });
  }
  const cohort =
    typeof body.cohort === "string" && body.cohort.length > 0
      ? body.cohort
      : "unassigned";
  const screenId =
    typeof body.screenId === "string" && body.screenId.length > 0
      ? body.screenId
      : "unknown";
  const severity =
    typeof body.severity === "string" && SEVERITIES.has(body.severity)
      ? (body.severity as "stuck" | "confusion" | "minor" | "positive")
      : "confusion";
  const actorKind =
    typeof body.actorKind === "string" && ACTORS.has(body.actorKind)
      ? (body.actorKind as "merchant" | "homeowner" | "trade" | "admin")
      : "homeowner";
  const bodyText = typeof body.body === "string" ? body.body.trim() : "";
  if (bodyText.length < 3) {
    return NextResponse.json(
      { ok: false, error: "Tell us a little more." },
      { status: 400 }
    );
  }
  const result = await submitFrictionReport({
    cohort,
    screenId,
    severity,
    actorKind,
    body: bodyText,
    context:
      typeof body.context === "object" && body.context !== null
        ? (body.context as Record<string, unknown>)
        : {}
  });
  return NextResponse.json({ ok: true, id: result?.id ?? null });
}
