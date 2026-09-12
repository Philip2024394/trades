// GET  /api/nex/marketing/templates
// POST /api/nex/marketing/templates
//
// Template CRUD. Body → MJML → HTML compile happens here.
// If mjml is not installed, we fall back to using mjml_source as HTML
// directly (with an honest note in the response) so the founder can
// still create + preview templates during dev.

import { NextResponse } from "next/server";
import { getPool } from "@/lib/nex/db";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

function isFounderRequest(req: Request): boolean {
  const url = new URL(req.url);
  const host = url.hostname;
  if (host === "localhost" || host === "127.0.0.1" || host === "::1") return true;
  const cookie = req.headers.get("cookie") ?? "";
  if (cookie.includes("admin_authed=1") || /x-admin-sig|nex_session=/.test(cookie)) return true;
  const token = req.headers.get("x-hq-token") ?? url.searchParams.get("hq_token");
  const expected = process.env.NEX_HQ_DASHBOARD_TOKEN;
  if (expected && expected.length >= 16 && token && token === expected) return true;
  return false;
}

async function compileMjml(source: string): Promise<{ html: string; compiler: string; note?: string }> {
  try {
    const mod = await import("mjml" as string);
    const mjml = (mod as { default: (s: string) => { html: string; errors?: unknown[] } }).default;
    const r = mjml(source);
    return { html: r.html, compiler: "mjml" };
  } catch {
    // MJML not installed · use source as-is with disclaimer
    return {
      html: source,
      compiler: "raw_html_fallback",
      note: "mjml package not installed · template served as raw HTML · run `npm install mjml` for responsive rendering",
    };
  }
}

function htmlToText(html: string): string {
  return html.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim().slice(0, 2000);
}

export async function GET(req: Request) {
  if (!isFounderRequest(req)) return NextResponse.json({ error: "no_founder_credential" }, { status: 401 });
  const pool = await getPool();
  if (!pool) return NextResponse.json({ templates: [] });
  const c = await pool.connect();
  try {
    const r = await c.query(`
      SELECT template_id, slug, display_name, subject_line, from_email, from_name,
             banner_image_url, cta_url, language, updated_at, updated_by
      FROM nex.marketing_template ORDER BY updated_at DESC
    `);
    return NextResponse.json({ templates: r.rows });
  } finally { c.release(); }
}

export async function POST(req: Request) {
  if (!isFounderRequest(req)) return NextResponse.json({ error: "no_founder_credential" }, { status: 401 });
  const body = await req.json().catch(() => null) as {
    slug?: string; display_name?: string; subject_line?: string;
    from_email?: string; from_name?: string; reply_to?: string;
    mjml_source?: string; banner_image_url?: string; cta_url?: string;
    variables?: Record<string, unknown>; language?: string; updated_by?: string;
  } | null;
  if (!body?.slug || !body.subject_line || !body.mjml_source) {
    return NextResponse.json({ error: "missing_fields" }, { status: 400 });
  }
  const compiled = await compileMjml(body.mjml_source);
  const text = htmlToText(compiled.html);
  const pool = await getPool();
  if (!pool) return NextResponse.json({ error: "postgres_unavailable" }, { status: 500 });
  const c = await pool.connect();
  try {
    const r = await c.query(
      `INSERT INTO nex.marketing_template
         (slug, display_name, subject_line, from_email, from_name, reply_to,
          mjml_source, html_compiled, text_fallback, banner_image_url, cta_url,
          variables, language, updated_by)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12::jsonb,$13,$14)
       ON CONFLICT (slug) DO UPDATE SET
         display_name = EXCLUDED.display_name,
         subject_line = EXCLUDED.subject_line,
         from_email = EXCLUDED.from_email, from_name = EXCLUDED.from_name,
         reply_to = EXCLUDED.reply_to,
         mjml_source = EXCLUDED.mjml_source, html_compiled = EXCLUDED.html_compiled,
         text_fallback = EXCLUDED.text_fallback,
         banner_image_url = EXCLUDED.banner_image_url, cta_url = EXCLUDED.cta_url,
         variables = EXCLUDED.variables, language = EXCLUDED.language,
         updated_at = now(), updated_by = EXCLUDED.updated_by
       RETURNING template_id`,
      [body.slug, body.display_name ?? body.slug, body.subject_line,
       body.from_email ?? "hello@nex.id", body.from_name ?? "NEX", body.reply_to ?? null,
       body.mjml_source, compiled.html, text,
       body.banner_image_url ?? null, body.cta_url ?? null,
       JSON.stringify(body.variables ?? {}), body.language ?? "id", body.updated_by ?? "founder"]
    );
    return NextResponse.json({ ok: true, template_id: r.rows[0].template_id, compiler: compiled.compiler, note: compiled.note });
  } finally { c.release(); }
}
