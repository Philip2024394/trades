// GET /api/nex/composer/variables — registered variable catalog for the picker
import { NextResponse } from "next/server";
import { VARIABLES } from "@/lib/nex/composer/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  return NextResponse.json({ ok: true, variables: VARIABLES });
}
