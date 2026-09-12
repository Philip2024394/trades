// src/app/api/nex/agent/security-scan/route.ts
//
// On-demand scan endpoint · re-scans a stored attachment or a text payload.
// Used by the workstation UI to show shield status on chips + export buttons
// and by the upload/export pipelines to reject-first.
//
// POST body · one of:
//   { attachment_id: "..." }              → looks up the file, scans, returns verdict
//   { text: "...", filename?: "..." }     → scans plain text (for export bundles)

import { NextResponse } from "next/server";
import { existsSync, readFileSync } from "node:fs";
import { resolve, join } from "node:path";
import { scanFile, scanText } from "@/lib/nex-agent/content-scanner";
import { checkRateLimit, rateLimitKeyFor, detectBotUA, WORKSTATION_SEC_HEADERS } from "@/lib/nex-agent/anti-bot";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function uploadsIndex(): string {
  return resolve(process.cwd(), "data/nex-agent-uploads/index.json");
}

export async function POST(req: Request) {
  // Rate limit + bot UA check
  const rl = checkRateLimit(rateLimitKeyFor(req, "security-scan"), { windowMs: 60_000, maxRequests: 30 });
  if (!rl.allowed) {
    return NextResponse.json({ ok: false, error: rl.reason ?? "rate_limited" }, { status: 429, headers: WORKSTATION_SEC_HEADERS });
  }
  const bot = detectBotUA(req.headers.get("user-agent"));
  if (bot.isBot) {
    return NextResponse.json({ ok: false, error: bot.reason ?? "sec.bot_ua_signature" }, { status: 403, headers: WORKSTATION_SEC_HEADERS });
  }

  let body: { attachment_id?: string; text?: string; filename?: string; mimeType?: string } = {};
  try { body = await req.json(); } catch { /* empty */ }

  if (body.attachment_id) {
    const idxPath = uploadsIndex();
    if (!existsSync(idxPath)) return NextResponse.json({ ok: false, error: "no_index" }, { status: 404, headers: WORKSTATION_SEC_HEADERS });
    try {
      const idx = JSON.parse(readFileSync(idxPath, "utf8")) as Record<string, { diskPath: string; filename: string; mimeType: string }>;
      const meta = idx[body.attachment_id];
      if (!meta) return NextResponse.json({ ok: false, error: "not_found" }, { status: 404, headers: WORKSTATION_SEC_HEADERS });
      if (!existsSync(meta.diskPath)) return NextResponse.json({ ok: false, error: "file_missing" }, { status: 410, headers: WORKSTATION_SEC_HEADERS });
      const buf = readFileSync(meta.diskPath);
      const result = scanFile({ buffer: buf, filename: meta.filename, mimeType: meta.mimeType });
      return NextResponse.json({ ok: true, attachment_id: body.attachment_id, filename: meta.filename, ...result }, { headers: { ...WORKSTATION_SEC_HEADERS, "Cache-Control": "no-store" } });
    } catch (e) {
      return NextResponse.json({ ok: false, error: (e as Error).message.slice(0, 200) }, { status: 500, headers: WORKSTATION_SEC_HEADERS });
    }
  }

  if (typeof body.text === "string") {
    const result = scanText({ text: body.text, filename: body.filename, mimeType: body.mimeType });
    return NextResponse.json({ ok: true, ...result }, { headers: { ...WORKSTATION_SEC_HEADERS, "Cache-Control": "no-store" } });
  }

  return NextResponse.json({ ok: false, error: "attachment_id_or_text_required" }, { status: 400, headers: WORKSTATION_SEC_HEADERS });
}
