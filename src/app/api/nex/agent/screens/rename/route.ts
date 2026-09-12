// src/app/api/nex/agent/screens/rename/route.ts
//
// Founder-renamed URLs for detected screens. Stored as an alias map at
// data/nex-agent-screens/aliases.json · { originalRoute → newRoute }.
//
// Discipline:
//   - New route must start with "/" · length 1..80 · [/A-Za-z0-9_:-] only
//   - Original route is never mutated · just aliased for display + preview URL
//   - Removing an alias is done via DELETE ?originalRoute=...
//
// GET  → { ok, aliases }
// POST { originalRoute, newRoute } → validates + persists
// DELETE ?originalRoute=... → removes the alias

import { NextResponse } from "next/server";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { checkRateLimit, rateLimitKeyFor, detectBotUA, WORKSTATION_SEC_HEADERS } from "@/lib/nex-agent/anti-bot";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const ROUTE_RE = /^\/[A-Za-z0-9\/_:-]{0,79}$/;

function aliasesPath(): string {
  return resolve(process.cwd(), "data/nex-agent-screens/aliases.json");
}

function loadAliases(): Record<string, { newRoute: string; renamedAt: string; renamedBy: string }> {
  const p = aliasesPath();
  if (!existsSync(p)) return {};
  try { return JSON.parse(readFileSync(p, "utf8")); }
  catch { return {}; }
}

function saveAliases(m: Record<string, unknown>): void {
  const p = aliasesPath();
  mkdirSync(dirname(p), { recursive: true });
  writeFileSync(p, JSON.stringify(m, null, 2), "utf8");
}

export async function GET() {
  return NextResponse.json({ ok: true, aliases: loadAliases() }, { headers: { ...WORKSTATION_SEC_HEADERS, "Cache-Control": "no-store" } });
}

export async function POST(req: Request) {
  const rl = checkRateLimit(rateLimitKeyFor(req, "screens-rename"), { windowMs: 60_000, maxRequests: 20 });
  if (!rl.allowed) return NextResponse.json({ ok: false, error: rl.reason ?? "rate_limited" }, { status: 429, headers: WORKSTATION_SEC_HEADERS });
  const bot = detectBotUA(req.headers.get("user-agent"));
  if (bot.isBot) return NextResponse.json({ ok: false, error: bot.reason ?? "sec.bot_ua_signature" }, { status: 403, headers: WORKSTATION_SEC_HEADERS });

  let body: { originalRoute?: string; newRoute?: string; renamedBy?: string } = {};
  try { body = await req.json(); } catch { /* */ }
  const originalRoute = String(body.originalRoute ?? "").trim();
  const newRoute = String(body.newRoute ?? "").trim();
  const renamedBy = String(body.renamedBy ?? "founder").trim() || "founder";

  if (!originalRoute) return NextResponse.json({ ok: false, error: "originalRoute_required" }, { status: 400, headers: WORKSTATION_SEC_HEADERS });
  if (!newRoute) return NextResponse.json({ ok: false, error: "newRoute_required" }, { status: 400, headers: WORKSTATION_SEC_HEADERS });
  if (!ROUTE_RE.test(newRoute)) {
    return NextResponse.json({
      ok: false, error: "newRoute_invalid",
      detail: "New route must start with '/' and contain only letters · digits · underscore · dash · slash · colon (dynamic segment)",
    }, { status: 400, headers: WORKSTATION_SEC_HEADERS });
  }
  if (!ROUTE_RE.test(originalRoute)) {
    return NextResponse.json({ ok: false, error: "originalRoute_invalid" }, { status: 400, headers: WORKSTATION_SEC_HEADERS });
  }

  const aliases = loadAliases();
  aliases[originalRoute] = { newRoute, renamedAt: new Date().toISOString(), renamedBy };
  saveAliases(aliases);

  return NextResponse.json({ ok: true, originalRoute, newRoute, aliases }, { headers: { ...WORKSTATION_SEC_HEADERS, "Cache-Control": "no-store" } });
}

export async function DELETE(req: Request) {
  const url = new URL(req.url);
  const original = url.searchParams.get("originalRoute");
  if (!original) return NextResponse.json({ ok: false, error: "originalRoute_required" }, { status: 400, headers: WORKSTATION_SEC_HEADERS });
  const aliases = loadAliases();
  if (!aliases[original]) return NextResponse.json({ ok: false, error: "not_found" }, { status: 404, headers: WORKSTATION_SEC_HEADERS });
  delete aliases[original];
  saveAliases(aliases);
  return NextResponse.json({ ok: true, removed: original, aliases }, { headers: { ...WORKSTATION_SEC_HEADERS, "Cache-Control": "no-store" } });
}
