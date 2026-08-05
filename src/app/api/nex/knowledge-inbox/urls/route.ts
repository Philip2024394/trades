// POST /api/nex/knowledge-inbox/urls
//
// URL import — accepts one or many URLs and stores one InboxItem per
// URL. The v1 pipeline stores the URL string only; the v2 pipeline
// will schedule a background fetch (respecting the source's scrutiny
// policy — gov-standards fetches deferred to Authoritative Sources
// whitelist, internet-article fetches flagged for verification, etc.).
//
// Body: { source: KnowledgeSource, urls: string[] | string }
//
// If urls is a single string, it is split on newlines, commas, and
// whitespace so the client's freeform textarea works as-is.

import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { coerceSource, saveUrlItem } from "@/lib/nex/knowledge-inbox/storage";
import type { InboxItem } from "@/lib/nex/knowledge-inbox/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function collectUrls(input: unknown): string[] {
  if (Array.isArray(input)) return input.map(String).filter(Boolean);
  if (typeof input === "string") {
    return input.split(/[\s,]+/).map((u) => u.trim()).filter((u) => u.length > 0);
  }
  return [];
}

export async function POST(req: NextRequest) {
  let body: { source?: unknown; urls?: unknown };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ok: false, error: "invalid_json" }, { status: 400 });
  }

  const urls = collectUrls(body.urls);
  if (urls.length === 0) {
    return NextResponse.json({ ok: false, error: "no_urls" }, { status: 400 });
  }
  const source = coerceSource(body.source);

  const created: InboxItem[] = [];
  const duplicates: InboxItem[] = [];
  for (const u of urls) {
    try {
      const { item, deduplicated } = await saveUrlItem({ source, url: u });
      if (deduplicated) duplicates.push(item);
      else created.push(item);
    } catch (err) {
      console.error("[knowledge-inbox.urls] save failed:", err);
    }
  }

  return NextResponse.json({ ok: true, created, duplicates });
}
