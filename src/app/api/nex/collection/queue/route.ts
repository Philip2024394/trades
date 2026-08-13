// POST /api/nex/collection/queue — enqueue one URL or many (newline-separated)
// GET  /api/nex/collection/queue — list current queue rows (admin dashboard)
//
// Path C · Semi-autonomous URL queue collector (Philip 2026-08-13).
// Admin auth only — uses isAdminAuthed() from the shared session helper.

import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { isAdminAuthed } from "@/lib/adminAuth";
import { enqueueUrl, listQueue, queueStats, type UrlKind } from "@/lib/nex/collection/urlQueueDb";
import { getTradeCategory } from "@/lib/nex/centre-publishing/tradeCategoryRegistry";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Worker-dump input format (Philip 2026-08-13). One URL per line. Lines MAY be
 * prefixed with a label to distinguish discovery sources from company candidates:
 *
 *   DISCOVERY https://checkatrade.com/Search/Staircase-Refurbishment/in/Uk
 *   CANDIDATE https://stairfurb.co.uk/
 *   https://hampshirestaircase.co.uk/    ← no prefix, kind inferred from host
 *
 * Blank lines and lines starting with '#' are ignored (allow the dump to
 * carry comments). This keeps 200-line pastes readable.
 */
function parseUrlDump(text: string): Array<{ url: string; kind?: UrlKind }> {
  const out: Array<{ url: string; kind?: UrlKind }> = [];
  const lines = text.split(/\r?\n/);
  for (const raw of lines) {
    const line = raw.trim();
    if (!line || line.startsWith("#")) continue;
    const m = /^(DISCOVERY|CANDIDATE)\s+(.+)$/i.exec(line);
    if (m) {
      const kind = m[1].toUpperCase() === "DISCOVERY" ? "discovery" : "candidate";
      out.push({ url: m[2].trim(), kind });
    } else {
      out.push({ url: line });
    }
  }
  return out;
}

type EnqueueBody = {
  collection_type?: string;
  /** Legacy shape · plain array of URLs. Prefer `dump` for labelled input. */
  urls?: string[];
  /** Preferred shape · multi-line text supporting DISCOVERY / CANDIDATE prefixes. */
  dump?: string;
  submitted_by?: string;
  notes?: string;
};

export async function POST(req: NextRequest) {
  if (!(await isAdminAuthed())) {
    return NextResponse.json({ ok: false, error: "not_authenticated" }, { status: 401 });
  }
  let body: EnqueueBody;
  try { body = (await req.json()) as EnqueueBody; }
  catch { return NextResponse.json({ ok: false, error: "invalid_json" }, { status: 400 }); }

  const collectionType = body.collection_type ?? "staircase_refacing";
  const category = getTradeCategory(collectionType);
  if (!category || !category.enabled) {
    return NextResponse.json({ ok: false, error: `category_not_enabled: ${collectionType}` }, { status: 400 });
  }

  // Prefer labelled dump; fall back to legacy plain-array input.
  const entries: Array<{ url: string; kind?: UrlKind }> =
    typeof body.dump === "string" && body.dump.trim().length > 0
      ? parseUrlDump(body.dump)
      : Array.isArray(body.urls)
      ? body.urls.map((u) => ({ url: u.trim() })).filter((e) => e.url)
      : [];

  if (entries.length === 0) {
    return NextResponse.json({ ok: false, error: "no_urls_supplied" }, { status: 400 });
  }
  if (entries.length > 500) {
    return NextResponse.json({ ok: false, error: "max_500_urls_per_request" }, { status: 400 });
  }

  type Result = { url: string; ok: boolean; duplicate?: boolean; error?: string; error_category?: string; id?: string; kind?: UrlKind };
  const results: Result[] = [];
  for (const e of entries) {
    const r = await enqueueUrl({
      candidate_url: e.url,
      collection_type: collectionType,
      submitted_by: body.submitted_by ?? "admin",
      notes: body.notes,
      kind: e.kind,
    });
    if (r.ok) results.push({ url: e.url, ok: true, duplicate: r.duplicate, id: r.id, kind: r.kind });
    else results.push({ url: e.url, ok: false, error: r.error, error_category: r.error_category });
  }

  const enqueued           = results.filter((r) => r.ok && !r.duplicate && r.kind === "candidate").length;
  const discoveryBookmarks = results.filter((r) => r.ok && !r.duplicate && r.kind === "discovery").length;
  const duplicates         = results.filter((r) => r.ok && r.duplicate).length;
  const dnsRejected        = results.filter((r) => !r.ok && r.error_category === "dns_error").length;
  const invalidUrl         = results.filter((r) => !r.ok && r.error_category === "invalid_url").length;
  const otherFail          = results.filter((r) => !r.ok && r.error_category !== "dns_error" && r.error_category !== "invalid_url").length;
  const failed             = dnsRejected + invalidUrl + otherFail;

  return NextResponse.json({
    ok: true,
    total: entries.length,
    enqueued,
    dnsRejected,
    invalidUrl,
    discoveryBookmarks,
    duplicates,
    failed,
    results,
  });
}

export async function GET(req: NextRequest) {
  if (!(await isAdminAuthed())) {
    return NextResponse.json({ ok: false, error: "not_authenticated" }, { status: 401 });
  }
  const url = new URL(req.url);
  const collectionType = url.searchParams.get("collection_type") ?? undefined;
  const limit = Number(url.searchParams.get("limit") ?? "200");

  const [items, stats] = await Promise.all([
    listQueue({ collectionType, limit }),
    queueStats(collectionType),
  ]);
  return NextResponse.json({ ok: true, stats, items });
}
