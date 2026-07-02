// GET  /api/studio/publish/preview-links?pageId=…
//   → list active preview links for the current brand + page.
//
// POST /api/studio/publish/preview-links
//   { pageId, sourceKind: 'draft' | 'live' | 'version', sourceVersionId?, note?, expiresInDays? }
//   → mints a token, inserts a row, returns the shareable URL.
//
// Auth: studio session cookie. Reviewers use the resulting token via
// /studio/share/[token] which requires no auth of its own.

import { NextResponse } from "next/server";
import { randomBytes } from "node:crypto";
import { loadStudioSession } from "@/lib/studio/session";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

export const runtime = "nodejs";

type SourceKind = "draft" | "live" | "version";

type PreviewLinkRow = {
  id: string;
  page_id: string;
  token: string;
  source_kind: SourceKind;
  source_version_id: string | null;
  note: string | null;
  created_at: string;
  expires_at: string | null;
  revoked_at: string | null;
  view_count: number;
  last_viewed_at: string | null;
};

function mintToken(): string {
  // URL-safe base64, ~30 chars — 22 bytes of entropy, plenty for a
  // share link that only lives ~30 days by default.
  return randomBytes(22).toString("base64url");
}

export async function GET(req: Request) {
  const session = await loadStudioSession();
  if (!session) {
    return NextResponse.json({ ok: false, error: "unauthenticated" }, { status: 401 });
  }
  const url = new URL(req.url);
  const pageId = url.searchParams.get("pageId");
  const q = supabaseAdmin
    .from("studio_preview_links")
    .select(
      "id, page_id, token, source_kind, source_version_id, note, created_at, expires_at, revoked_at, view_count, last_viewed_at"
    )
    .eq("brand_id", session.brand.id)
    .is("revoked_at", null)
    .order("created_at", { ascending: false })
    .limit(50);
  if (pageId) q.eq("page_id", pageId);
  const res = await q;
  if (res.error) {
    return NextResponse.json({ ok: false, error: res.error.message }, { status: 500 });
  }
  return NextResponse.json({ ok: true, links: (res.data ?? []) as PreviewLinkRow[] });
}

type CreateBody = {
  pageId?: string;
  sourceKind?: SourceKind;
  sourceVersionId?: string;
  note?: string;
  expiresInDays?: number;
};

export async function POST(req: Request) {
  const session = await loadStudioSession();
  if (!session) {
    return NextResponse.json({ ok: false, error: "unauthenticated" }, { status: 401 });
  }
  let body: CreateBody;
  try {
    body = (await req.json()) as CreateBody;
  } catch {
    return NextResponse.json({ ok: false, error: "invalid-json" }, { status: 400 });
  }
  const pageId = typeof body.pageId === "string" ? body.pageId : "";
  if (!pageId) {
    return NextResponse.json({ ok: false, error: "invalid-page" }, { status: 400 });
  }
  const sourceKind: SourceKind =
    body.sourceKind === "draft" || body.sourceKind === "live" || body.sourceKind === "version"
      ? body.sourceKind
      : "draft";
  if (sourceKind === "version" && !body.sourceVersionId) {
    return NextResponse.json(
      { ok: false, error: "version-source-requires-id" },
      { status: 400 }
    );
  }
  const expiresInDays =
    typeof body.expiresInDays === "number" && body.expiresInDays > 0
      ? Math.min(body.expiresInDays, 365)
      : 30;
  const expiresAt = new Date(Date.now() + expiresInDays * 86_400_000).toISOString();

  const token = mintToken();
  const ins = await supabaseAdmin
    .from("studio_preview_links")
    .insert({
      brand_id: session.brand.id,
      page_id: pageId,
      token,
      source_kind: sourceKind,
      source_version_id: sourceKind === "version" ? body.sourceVersionId : null,
      note: body.note ?? null,
      expires_at: expiresAt
    })
    .select(
      "id, page_id, token, source_kind, source_version_id, note, created_at, expires_at"
    )
    .maybeSingle();
  if (ins.error || !ins.data) {
    return NextResponse.json(
      { ok: false, error: ins.error?.message ?? "insert-failed" },
      { status: 500 }
    );
  }
  return NextResponse.json({ ok: true, link: ins.data });
}
