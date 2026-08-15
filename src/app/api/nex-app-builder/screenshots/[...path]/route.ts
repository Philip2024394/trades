// NEX App Builder · Chat · GET /api/nex-app-builder/screenshots/[...path] (Philip 2026-08-14).
//
// Serves the PNG screenshot files the build endpoint produced.
// Files live under tmp-nex-qa-screenshots-chat/<blueprintId>/<file>.png.
//
// Security: refuses any path containing "..", enforces absolute prefix,
// only serves .png files.

import { NextResponse } from "next/server";
import { readFileSync, existsSync, statSync } from "node:fs";
import { join, resolve } from "node:path";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const ROOT = resolve(process.cwd(), "tmp-nex-qa-screenshots-chat");

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ path: string[] }> }
): Promise<Response> {
  const { path } = await params;
  if (!path || path.length === 0) return NextResponse.json({ ok: false, error: "no-path" }, { status: 400 });

  // Path safety
  for (const part of path) {
    if (part.includes("..") || part.includes("/") || part.includes("\\")) {
      return NextResponse.json({ ok: false, error: "invalid-path" }, { status: 400 });
    }
  }

  const filepath = resolve(join(ROOT, ...path));
  // Enforce that resolved path is within ROOT
  if (!filepath.startsWith(ROOT)) {
    return NextResponse.json({ ok: false, error: "path-escape" }, { status: 400 });
  }
  if (!filepath.endsWith(".png")) {
    return NextResponse.json({ ok: false, error: "only-png" }, { status: 400 });
  }
  if (!existsSync(filepath)) {
    return NextResponse.json({ ok: false, error: "not-found", path: filepath }, { status: 404 });
  }
  const size = statSync(filepath).size;
  if (size <= 0) return NextResponse.json({ ok: false, error: "empty" }, { status: 404 });

  const bytes = readFileSync(filepath);
  return new NextResponse(bytes, {
    status: 200,
    headers: {
      "content-type": "image/png",
      "content-length": String(size),
      "cache-control": "public, max-age=60"
    }
  });
}
