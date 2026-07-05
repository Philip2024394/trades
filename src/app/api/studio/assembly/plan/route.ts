// Assembly Plan preview API.
//
//   GET /api/studio/assembly/plan?modules=id1,id2,id3
//     → { ok, plan: ResolvedAssemblyPlan }
//
// If `modules` is empty, resolves the plan for every migrated module
// on the platform — useful for "what would happen if all modules had
// full DNA" admin previews.

import { NextResponse } from "next/server";
import { loadStudioSession } from "@/lib/studio/session";
import {
  resolveAssemblyPlan,
  resolveWholePlatformPlan
} from "@/lib/studio/assembly";

export const runtime = "nodejs";

export async function GET(req: Request) {
  const session = await loadStudioSession();
  if (!session) {
    return NextResponse.json(
      { ok: false, error: "unauthenticated" },
      { status: 401 }
    );
  }

  const url = new URL(req.url);
  const raw = url.searchParams.get("modules") ?? "";
  const moduleIds = raw
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);

  const plan =
    moduleIds.length > 0
      ? resolveAssemblyPlan({ moduleIds })
      : resolveWholePlatformPlan();

  return NextResponse.json({ ok: true, plan });
}
