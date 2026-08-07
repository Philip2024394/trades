// POST /api/nex/alerts/evaluate — run all enabled rules against a
// fresh platform snapshot · dispatch new/updated alerts through the
// configured channels · auto-resolve alerts whose condition cleared.
//
// In production this is called by a cron every ~30-60 s. Also
// pressable from the AlertsCentrePanel Run-tick button.
import { NextResponse } from "next/server";
import { evaluate } from "@/lib/nex/alerts/evaluator";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

export async function POST() { return NextResponse.json(await evaluate()); }
export async function GET()  { return NextResponse.json(await evaluate()); }
