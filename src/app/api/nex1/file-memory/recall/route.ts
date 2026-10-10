// POST /api/nex1/file-memory/recall
//
// NEX1 · CAPABILITY M-1 · File Memory · recall endpoint.

import { NextResponse } from "next/server";
import { createFileMemoryStore } from "@/lib/nex-agent/code-engine/capability-m-file-memory";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

interface RequestBody {
  path?: string;
}

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
  const path = typeof body.path === "string" ? body.path : "";
  const result = getStore().recallFile(path);
  return NextResponse.json({ ok: true, result });
}
