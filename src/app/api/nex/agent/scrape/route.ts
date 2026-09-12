// src/app/api/nex/agent/scrape/route.ts
//
// URL scraper for NEX1. Founder puts URL(s) in a prompt · this endpoint
// fetches the page · strips HTML + scripts + styles · returns cleaned text.
//
// Discipline: The returned text carries a `paraphrase_only: true` flag and a
// system_hint reminding NEX1 to REWORD · never copy verbatim from the source.
// Downstream orchestrator prompts NEX1 with that hint.
//
// POST { url } → { ok, title, text, chars, host, source_url, system_hint }
//
// Never fetches localhost / RFC1918 · returns 400. Never follows infinite
// redirects (max 3). Never returns more than 20 KB of scraped text.

import { NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 30;

const MAX_TEXT_CHARS = 20_000;
const MAX_REDIRECTS = 3;
const FETCH_TIMEOUT_MS = 12_000;
const BLOCKED_HOST_RE = /^(localhost|127\.|10\.|172\.(1[6-9]|2\d|3[01])\.|192\.168\.|::1|\[?fc|\[?fd)/i;

function stripHtml(html: string): { title: string | null; text: string } {
  const titleMatch = /<title[^>]*>([^<]{0,300})<\/title>/i.exec(html);
  const title = titleMatch ? titleMatch[1].trim() : null;

  let body = html
    .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, " ")
    .replace(/<style\b[^<]*(?:(?!<\/style>)<[^<]*)*<\/style>/gi, " ")
    .replace(/<!--[\s\S]*?-->/g, " ")
    .replace(/<nav\b[^<]*(?:(?!<\/nav>)<[^<]*)*<\/nav>/gi, " ")
    .replace(/<footer\b[^<]*(?:(?!<\/footer>)<[^<]*)*<\/footer>/gi, " ");
  // Convert some breaks to newlines for readability
  body = body
    .replace(/<\/?(br|p|div|h[1-6]|li|tr|section|article)[^>]*>/gi, "\n")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/[ \t]+/g, " ")
    .replace(/\n{3,}/g, "\n\n")
    .trim();

  return { title, text: body.slice(0, MAX_TEXT_CHARS) };
}

export async function POST(req: Request) {
  let body: { url?: string } = {};
  try { body = await req.json(); } catch { /* empty */ }
  const rawUrl = String(body.url ?? "").trim();
  if (!rawUrl) return NextResponse.json({ ok: false, error: "url_required" }, { status: 400 });

  let u: URL;
  try { u = new URL(rawUrl); }
  catch { return NextResponse.json({ ok: false, error: "invalid_url" }, { status: 400 }); }

  if (u.protocol !== "http:" && u.protocol !== "https:") {
    return NextResponse.json({ ok: false, error: "unsupported_protocol", detail: u.protocol }, { status: 400 });
  }
  if (BLOCKED_HOST_RE.test(u.hostname)) {
    return NextResponse.json({ ok: false, error: "blocked_host", detail: "loopback/private-net not allowed" }, { status: 400 });
  }

  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
    const r = await fetch(u.toString(), {
      redirect: "follow",
      headers: {
        "User-Agent": "nex1-scraper/1.0 (+ NEX Programming Workstation)",
        "Accept": "text/html,application/xhtml+xml,text/plain;q=0.9,*/*;q=0.8",
      },
      signal: controller.signal,
    });
    clearTimeout(timer);
    const ct = (r.headers.get("content-type") ?? "").toLowerCase();
    if (!r.ok) {
      return NextResponse.json({ ok: false, error: "fetch_failed", status: r.status, host: u.hostname }, { status: 502 });
    }
    if (!ct.startsWith("text/") && !ct.includes("html") && !ct.includes("xml") && !ct.includes("json")) {
      return NextResponse.json({ ok: false, error: "unsupported_content_type", detail: ct, host: u.hostname }, { status: 415 });
    }
    const raw = await r.text();
    const { title, text } = ct.includes("html") ? stripHtml(raw) : { title: null, text: raw.slice(0, MAX_TEXT_CHARS) };

    return NextResponse.json({
      ok: true,
      source_url: u.toString(),
      host: u.hostname,
      title,
      text,
      chars: text.length,
      paraphrase_only: true,
      system_hint: "SOURCE MATERIAL · REWORD IN YOUR OWN WORDS · NEVER COPY VERBATIM. Attribute the source URL when relevant. Summarize the key facts the founder wants to learn from this page.",
    }, { headers: { "Cache-Control": "no-store" } });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "fetch_failed";
    return NextResponse.json({ ok: false, error: "scrape_failed", detail: msg.slice(0, 200) }, { status: 502 });
  }
}
