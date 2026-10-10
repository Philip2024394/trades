// src/app/api/nex/create-banners/sandbox/asset/route.ts
//
// NEX Create Banners · Sandbox asset serving endpoint · 2026-09-23
// ================================================================
// GET · streams a composed banner PNG back to the client. Path must be
// under the sandbox output root; any traversal outside is refused.

import { NextRequest, NextResponse } from "next/server";
import { existsSync, readFileSync } from "node:fs";
import * as path from "node:path";
import { sandboxOutputRootAbsolute } from "@/lib/nex/create-banners/sandbox/sandbox-doctrine";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const url = new URL(req.url);
  const rel = url.searchParams.get("path");
  if (!rel) {
    return NextResponse.json(
      { ok: false, error: "missing_path" },
      { status: 400 }
    );
  }
  const abs = path.resolve(process.cwd(), rel);
  const rootAbs = sandboxOutputRootAbsolute();
  const normAbs = abs.replace(/\\/g, "/");
  const normRoot = rootAbs.replace(/\\/g, "/");
  if (!normAbs.startsWith(normRoot)) {
    return NextResponse.json(
      { ok: false, error: "outside_sandbox" },
      { status: 403 }
    );
  }
  if (!existsSync(abs)) {
    return NextResponse.json(
      { ok: false, error: "not_found" },
      { status: 404 }
    );
  }
  const buf = readFileSync(abs);
  return new NextResponse(buf, {
    status: 200,
    headers: {
      "content-type": "image/png",
      "cache-control": "no-store",
    },
  });
}
