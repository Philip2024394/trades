// PUT /api/nex/alerts/rules/{id} — enable/disable · adjust thresholds · change channels
import { NextResponse } from "next/server";
import { updateRule } from "@/lib/nex/alerts/evaluator";
import type { AlertRule, DispatchChannel, Severity } from "@/lib/nex/alerts/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Patch = Partial<Pick<AlertRule, "enabled" | "params" | "dedup_window_sec" | "notify_channels" | "severity">>;
const VALID_SEV = new Set<Severity>(["info","warning","critical"]);
const VALID_CH  = new Set<DispatchChannel>(["email","webhook","slack"]);

export async function PUT(request: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  let body: Patch;
  try { body = await request.json() as Patch; }
  catch { return NextResponse.json({ ok: false, error: "invalid_json" }, { status: 400 }); }
  if (body.severity && !VALID_SEV.has(body.severity)) return NextResponse.json({ ok: false, error: "invalid severity" }, { status: 400 });
  if (body.notify_channels && !body.notify_channels.every((c) => VALID_CH.has(c))) return NextResponse.json({ ok: false, error: "invalid channel" }, { status: 400 });
  const r = await updateRule(id, body);
  if (!r) return NextResponse.json({ ok: false, error: "not_found" }, { status: 404 });
  return NextResponse.json({ ok: true, rule: r });
}
