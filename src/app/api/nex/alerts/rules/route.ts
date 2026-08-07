// GET /api/nex/alerts/rules — list rule catalogue
import { NextResponse } from "next/server";
import { listRules } from "@/lib/nex/alerts/evaluator";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() { return NextResponse.json({ ok: true, rules: await listRules() }); }
