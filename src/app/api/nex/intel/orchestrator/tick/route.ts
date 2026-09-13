// POST /api/nex/intel/orchestrator/tick
//
// Runs one orchestrator cycle. Reads the latest persisted mandate,
// dispatches a mission if the deterministic scheduler chooses to,
// and returns the outcome.

import { NextResponse } from "next/server";
import { promises as fs } from "node:fs";
import path from "node:path";
import { runOrchestratorTick } from "@/lib/nex-intel-orchestrator/orchestrator";
import type { CrawlerManifest } from "@/lib/nex-intelligence/types";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function POST(req: Request): Promise<Response> {
  try {
    // For slice-1 dev, the crawler manifest and fixture path are provided
    // via the request body (JSON). Production would load the latest
    // persisted manifest that the mandate authorises.
    const body = await req.json().catch(() => ({}));
    const manifest = body.crawler_manifest as CrawlerManifest;
    const fetchUrl = body.fetch_url as string;
    const sandboxRoot = body.sandbox_root as string || path.join(process.cwd(), "data", "nex-agent-workspaces", `intel-tick-${Date.now()}`);
    await fs.mkdir(sandboxRoot, { recursive: true });

    if (!manifest || !fetchUrl) {
      return NextResponse.json({ ok: false, error: "body requires crawler_manifest + fetch_url" }, { status: 400 });
    }

    const result = await runOrchestratorTick({
      crawler_manifest: manifest,
      fetch_url: fetchUrl,
      sandbox_root: sandboxRoot,
      trusted_attestation_keys: body.trusted_attestation_keys as string[] | undefined,
    });
    return NextResponse.json({ ok: true, result }, { status: 200 });
  } catch (e) {
    return NextResponse.json({ ok: false, error: (e as Error).message }, { status: 500 });
  }
}

export async function GET(): Promise<Response> { return methodNotAllowed(); }
export async function PUT(): Promise<Response> { return methodNotAllowed(); }
export async function PATCH(): Promise<Response> { return methodNotAllowed(); }
export async function DELETE(): Promise<Response> { return methodNotAllowed(); }
function methodNotAllowed(): Response {
  return NextResponse.json({ error: "method_not_allowed" }, { status: 405 });
}
