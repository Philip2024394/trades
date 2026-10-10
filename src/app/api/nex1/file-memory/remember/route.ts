// POST /api/nex1/file-memory/remember
//
// NEX1 · CAPABILITY M-1 · File Memory · remember endpoint.
// Deterministic · zero LLM · append-only persistence.

import { NextResponse } from "next/server";
import { createFileMemoryStore } from "@/lib/nex-agent/code-engine/capability-m-file-memory";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

interface RequestBody {
  path?: string;
  tags?: readonly string[];
  summary?: string;
}

// One shared store instance per Node process. Reload on every construction
// isn't needed because appendFileSync is synchronous and we own the file.
let storeSingleton: ReturnType<typeof createFileMemoryStore> | null = null;
function getStore(): ReturnType<typeof createFileMemoryStore> {
  if (!storeSingleton) {
    storeSingleton = createFileMemoryStore({ repo_root: process.cwd() });
  }
  return storeSingleton;
}

export async function POST(req: Request) {
  let body: RequestBody = {};
  try {
    body = (await req.json()) as RequestBody;
  } catch {
    return NextResponse.json({ ok: false, error: "invalid_json" }, { status: 400 });
  }
  const result = getStore().rememberFile({
    path: typeof body.path === "string" ? body.path : "",
    tags: Array.isArray(body.tags) ? body.tags.filter((t): t is string => typeof t === "string") : undefined,
    summary: typeof body.summary === "string" ? body.summary : undefined,
  });
  return NextResponse.json({ ok: true, result });
}
