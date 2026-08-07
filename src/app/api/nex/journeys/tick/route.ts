// POST /api/nex/journeys/tick  · advance every pending state (cron target)
import { NextResponse } from "next/server";
import { tickJourneys } from "@/lib/nex/journeys/runtime/tick";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

export async function POST() { return NextResponse.json(await tickJourneys()); }
export async function GET()  { return NextResponse.json(await tickJourneys()); }
