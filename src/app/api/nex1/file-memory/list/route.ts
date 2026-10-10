// GET /api/nex1/file-memory/list?path_prefix=&language=&tag=&limit=
//
// NEX1 · CAPABILITY M-1 · File Memory · list endpoint.

import { NextResponse } from "next/server";
import { createFileMemoryStore } from "@/lib/nex-agent/code-engine/capability-m-file-memory";
import type { ListFilesFilter } from "@/lib/nex-agent/code-engine/capability-m-file-memory";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

let storeSingleton: ReturnType<typeof createFileMemoryStore> | null = null;
function getStore(): ReturnType<typeof createFileMemoryStore> {
  if (!storeSingleton) {
    storeSingleton = createFileMemoryStore({ repo_root: process.cwd() });
  }
  return storeSingleton;
}

export async function GET(req: Request) {
  const url = new URL(req.url);
  const filter: ListFilesFilter = {};
  const prefix = url.searchParams.get("path_prefix");
  const language = url.searchParams.get("language");
  const tag = url.searchParams.get("tag");
  const limitRaw = url.searchParams.get("limit");
  const filterMut: {
    path_prefix?: string;
    language?: string;
    tag?: string;
    limit?: number;
  } = {};
  if (prefix) filterMut.path_prefix = prefix;
  if (language) filterMut.language = language;
  if (tag) filterMut.tag = tag;
  if (limitRaw) {
    const n = Number(limitRaw);
    if (Number.isFinite(n) && n > 0) filterMut.limit = Math.floor(n);
  }
  const result = getStore().listFiles(Object.keys(filterMut).length > 0 ? (filterMut as ListFilesFilter) : undefined);
  return NextResponse.json({ ok: true, result });
}
