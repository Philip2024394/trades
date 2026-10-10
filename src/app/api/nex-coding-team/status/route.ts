// GET /api/nex-coding-team/status?run_id=...
// Read-only view of the pipeline manifest for the workstation UI to poll.

import { NextResponse } from "next/server";
import { loadManifest, publicManifestView } from "@/lib/nex-coding-team/orchestrator";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const url = new URL(req.url);
  const run_id = (url.searchParams.get("run_id") ?? "").trim();
  if (!run_id) {
    return NextResponse.json({ ok: false, error: "run_id required" }, { status: 400 });
  }
  const manifest = loadManifest(run_id);
  if (!manifest) {
    return NextResponse.json({ ok: false, error: "run not found" }, { status: 404 });
  }
  return NextResponse.json({ ok: true, run: publicManifestView(manifest) }, { status: 200 });
}
