// GET /api/nex/project-profile/infer?root=<optional>
// Read-only ProjectProfile inference. Default root = process.cwd().

import { NextResponse } from "next/server";
import { resolve } from "node:path";
import { inferProfile } from "@/lib/nex-project-profile/profile";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: Request): Promise<NextResponse> {
  const url = new URL(req.url);
  const rootParam = url.searchParams.get("root");
  const root = rootParam ? resolve(rootParam) : process.cwd();
  const profile = inferProfile({ root });
  return NextResponse.json(profile, { headers: { "Cache-Control": "no-store" } });
}
