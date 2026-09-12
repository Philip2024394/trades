// GET /api/nex/project-architecture/infer?root=<optional>
// Read-only Project Architecture Intelligence inference.

import { NextResponse } from "next/server";
import { resolve } from "node:path";
import { inferArchitecture } from "@/lib/nex-project-architecture/architecture";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: Request): Promise<NextResponse> {
  const url = new URL(req.url);
  const rootParam = url.searchParams.get("root");
  const root = rootParam ? resolve(rootParam) : process.cwd();
  const arch = inferArchitecture({ root });
  return NextResponse.json(arch, { headers: { "Cache-Control": "no-store" } });
}
