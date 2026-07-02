// Studio pages CRUD.
//
//   GET  /api/studio/pages
//     → { ok, pages: StudioPage[] }
//
//   POST /api/studio/pages   { slug, name, description? }
//     → creates a new page for the current brand. Slug must be unique
//       within the brand and match [a-z0-9-]. Home flag is never set
//       by this endpoint — the DB backfill / seed owns the home page.
//     → returns { ok, page }
//
// Rename / delete / re-order live in /api/studio/pages/[id]/route.ts.

import { NextResponse } from "next/server";
import { loadStudioSession } from "@/lib/studio/session";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { listPagesForBrand } from "@/lib/studio/pagesLoader";

export const runtime = "nodejs";

const SLUG_RE = /^[a-z0-9](?:[a-z0-9-]{0,58}[a-z0-9])?$/;

export async function GET() {
  const session = await loadStudioSession();
  if (!session) {
    return NextResponse.json({ ok: false, error: "unauthenticated" }, { status: 401 });
  }
  const pages = await listPagesForBrand(session.brand.id);
  return NextResponse.json({ ok: true, pages });
}

type CreateBody = { slug?: string; name?: string; description?: string };

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
  const slug = (body.slug ?? "").trim().toLowerCase();
  const name = (body.name ?? "").trim();
  if (!SLUG_RE.test(slug)) {
    return NextResponse.json(
      { ok: false, error: "invalid-slug" },
      { status: 400 }
    );
  }
  if (!name || name.length > 80) {
    return NextResponse.json(
      { ok: false, error: "invalid-name" },
      { status: 400 }
    );
  }
  // Give new pages a sort_order after every existing page so they land
  // at the end of the list.
  const existing = await listPagesForBrand(session.brand.id);
  if (existing.some((p) => p.slug === slug)) {
    return NextResponse.json(
      { ok: false, error: "slug-taken" },
      { status: 409 }
    );
  }
  const maxOrder = existing.reduce((n, p) => Math.max(n, p.sort_order), 0);

  const ins = await supabaseAdmin
    .from("studio_pages")
    .insert({
      brand_id: session.brand.id,
      slug,
      name,
      description: body.description ?? null,
      sort_order: maxOrder + 10,
      is_home: false
    })
    .select("id, slug, name, description, sort_order, is_home")
    .maybeSingle();
  if (ins.error) {
    return NextResponse.json({ ok: false, error: ins.error.message }, { status: 500 });
  }
  return NextResponse.json({ ok: true, page: ins.data });
}
