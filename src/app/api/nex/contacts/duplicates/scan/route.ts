// POST /api/nex/contacts/duplicates/scan — populate suggestions

import { NextResponse } from "next/server";
import { scanForDuplicates } from "@/lib/nex/contacts/merge";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 300;

export async function POST() {
  const result = await scanForDuplicates();
  return NextResponse.json({ ok: true, result });
}
