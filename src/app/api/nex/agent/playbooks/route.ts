// src/app/api/nex/agent/playbooks/route.ts
//
// Playbook CRUD · founder-authored macros.
// GET      → { ok, playbooks: [...] }
// POST     → validate + save · returns saved playbook
// DELETE ?id=... → remove by id
//
// Stored at data/nex-agent-playbooks/{id}.json + index.json for the list.

import { NextResponse } from "next/server";
import { existsSync, mkdirSync, readdirSync, readFileSync, unlinkSync, writeFileSync } from "node:fs";
import { resolve, join } from "node:path";
import { validatePlaybook, type Playbook } from "@/lib/nex-agent/playbook";
import { checkRateLimit, rateLimitKeyFor, detectBotUA, WORKSTATION_SEC_HEADERS } from "@/lib/nex-agent/anti-bot";
import { randomUUID } from "node:crypto";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function playbookRoot(): string {
  return resolve(process.cwd(), "data/nex-agent-playbooks");
}

function loadAll(): Playbook[] {
  const dir = playbookRoot();
  if (!existsSync(dir)) return [];
  const files = readdirSync(dir).filter((f) => f.endsWith(".json") && f !== "index.json");
  const out: Playbook[] = [];
  for (const f of files) {
    try {
      const raw = readFileSync(join(dir, f), "utf8");
      out.push(JSON.parse(raw) as Playbook);
    } catch { /* skip malformed */ }
  }
  return out.sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1));
}

export async function GET() {
  return NextResponse.json({ ok: true, playbooks: loadAll() }, { headers: { ...WORKSTATION_SEC_HEADERS, "Cache-Control": "no-store" } });
}

export async function POST(req: Request) {
  const rl = checkRateLimit(rateLimitKeyFor(req, "playbooks-save"), { windowMs: 60_000, maxRequests: 20 });
  if (!rl.allowed) return NextResponse.json({ ok: false, error: rl.reason }, { status: 429, headers: WORKSTATION_SEC_HEADERS });
  const bot = detectBotUA(req.headers.get("user-agent"));
  if (bot.isBot) return NextResponse.json({ ok: false, error: bot.reason }, { status: 403, headers: WORKSTATION_SEC_HEADERS });

  let body: Partial<Playbook> = {};
  try { body = await req.json(); } catch { /* */ }

  const pb: Playbook = {
    id: String(body.id ?? "") || `pb-${randomUUID()}`,
    name: String(body.name ?? "").trim(),
    description: String(body.description ?? "").slice(0, 200),
    createdAt: body.createdAt ?? new Date().toISOString(),
    createdBy: String(body.createdBy ?? "founder"),
    actions: Array.isArray(body.actions) ? body.actions : [],
  };
  const v = validatePlaybook(pb);
  if (!v.ok) return NextResponse.json({ ok: false, error: "invalid_playbook", detail: v.reason }, { status: 400, headers: WORKSTATION_SEC_HEADERS });

  const dir = playbookRoot();
  mkdirSync(dir, { recursive: true });
  writeFileSync(join(dir, `${pb.id}.json`), JSON.stringify(pb, null, 2), "utf8");
  return NextResponse.json({ ok: true, playbook: pb }, { headers: { ...WORKSTATION_SEC_HEADERS, "Cache-Control": "no-store" } });
}

export async function DELETE(req: Request) {
  const url = new URL(req.url);
  const id = url.searchParams.get("id");
  if (!id) return NextResponse.json({ ok: false, error: "id_required" }, { status: 400, headers: WORKSTATION_SEC_HEADERS });
  if (!/^[A-Za-z0-9_-]{2,60}$/.test(id)) return NextResponse.json({ ok: false, error: "id_invalid" }, { status: 400, headers: WORKSTATION_SEC_HEADERS });
  const path = join(playbookRoot(), `${id}.json`);
  if (!existsSync(path)) return NextResponse.json({ ok: false, error: "not_found" }, { status: 404, headers: WORKSTATION_SEC_HEADERS });
  try { unlinkSync(path); } catch { /* */ }
  return NextResponse.json({ ok: true, id }, { headers: { ...WORKSTATION_SEC_HEADERS, "Cache-Control": "no-store" } });
}
