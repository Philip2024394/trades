// src/app/api/nex/agent/snapshots/route.ts
//
// Workstation state snapshots · founder saves/restores the full workstation
// configuration (viewport · zoom · phone model · bezel · sidebar toggles ·
// pinned tasks) so a coding session can be resumed exactly where left off.
//
// Snapshots are pure JSON · never contain secrets · never persist tokens.
//
// GET             → list snapshots (id · name · createdAt only)
// GET ?id=...     → return the full snapshot body
// POST            → { name, description, state } → save
// DELETE ?id=...  → delete

import { NextResponse } from "next/server";
import { existsSync, mkdirSync, readdirSync, readFileSync, unlinkSync, writeFileSync } from "node:fs";
import { resolve, join } from "node:path";
import { checkRateLimit, rateLimitKeyFor, detectBotUA, WORKSTATION_SEC_HEADERS } from "@/lib/nex-agent/anti-bot";
import { randomUUID } from "node:crypto";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const NAME_RE = /^[A-Za-z0-9][A-Za-z0-9 _-]{1,60}$/;
const MAX_STATE_BYTES = 32_000;

function root(): string {
  return resolve(process.cwd(), "data/nex-agent-snapshots");
}

interface Snapshot {
  id: string;
  name: string;
  description: string;
  createdAt: string;
  createdBy: string;
  state: Record<string, unknown>;
}

function listAll(): Array<Omit<Snapshot, "state">> {
  const dir = root();
  if (!existsSync(dir)) return [];
  const out: Array<Omit<Snapshot, "state">> = [];
  for (const f of readdirSync(dir)) {
    if (!f.endsWith(".json")) continue;
    try {
      const raw = readFileSync(join(dir, f), "utf8");
      const parsed = JSON.parse(raw) as Snapshot;
      out.push({ id: parsed.id, name: parsed.name, description: parsed.description, createdAt: parsed.createdAt, createdBy: parsed.createdBy });
    } catch { /* skip */ }
  }
  return out.sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1));
}

export async function GET(req: Request) {
  const url = new URL(req.url);
  const id = url.searchParams.get("id");
  if (id) {
    if (!/^[A-Za-z0-9_-]{2,60}$/.test(id)) return NextResponse.json({ ok: false, error: "id_invalid" }, { status: 400, headers: WORKSTATION_SEC_HEADERS });
    const path = join(root(), `${id}.json`);
    if (!existsSync(path)) return NextResponse.json({ ok: false, error: "not_found" }, { status: 404, headers: WORKSTATION_SEC_HEADERS });
    try {
      const raw = readFileSync(path, "utf8");
      const parsed = JSON.parse(raw) as Snapshot;
      return NextResponse.json({ ok: true, snapshot: parsed }, { headers: { ...WORKSTATION_SEC_HEADERS, "Cache-Control": "no-store" } });
    } catch (e) { return NextResponse.json({ ok: false, error: (e as Error).message.slice(0, 200) }, { status: 500, headers: WORKSTATION_SEC_HEADERS }); }
  }
  return NextResponse.json({ ok: true, snapshots: listAll() }, { headers: { ...WORKSTATION_SEC_HEADERS, "Cache-Control": "no-store" } });
}

export async function POST(req: Request) {
  const rl = checkRateLimit(rateLimitKeyFor(req, "snapshots-save"), { windowMs: 60_000, maxRequests: 20 });
  if (!rl.allowed) return NextResponse.json({ ok: false, error: rl.reason }, { status: 429, headers: WORKSTATION_SEC_HEADERS });
  const bot = detectBotUA(req.headers.get("user-agent"));
  if (bot.isBot) return NextResponse.json({ ok: false, error: bot.reason }, { status: 403, headers: WORKSTATION_SEC_HEADERS });

  let body: Partial<Snapshot> = {};
  try { body = await req.json(); } catch { /* */ }

  const name = String(body.name ?? "").trim();
  if (!NAME_RE.test(name)) return NextResponse.json({ ok: false, error: "name_invalid" }, { status: 400, headers: WORKSTATION_SEC_HEADERS });
  const state = (body.state ?? {}) as Record<string, unknown>;
  const stateBytes = Buffer.byteLength(JSON.stringify(state), "utf8");
  if (stateBytes > MAX_STATE_BYTES) return NextResponse.json({ ok: false, error: "state_too_large", detail: `max ${MAX_STATE_BYTES} bytes` }, { status: 413, headers: WORKSTATION_SEC_HEADERS });

  const snap: Snapshot = {
    id: `snap-${randomUUID()}`,
    name,
    description: String(body.description ?? "").slice(0, 200),
    createdAt: new Date().toISOString(),
    createdBy: String(body.createdBy ?? "founder"),
    state,
  };
  const dir = root();
  mkdirSync(dir, { recursive: true });
  writeFileSync(join(dir, `${snap.id}.json`), JSON.stringify(snap, null, 2), "utf8");
  return NextResponse.json({ ok: true, snapshot: snap }, { headers: { ...WORKSTATION_SEC_HEADERS, "Cache-Control": "no-store" } });
}

export async function DELETE(req: Request) {
  const url = new URL(req.url);
  const id = url.searchParams.get("id");
  if (!id) return NextResponse.json({ ok: false, error: "id_required" }, { status: 400, headers: WORKSTATION_SEC_HEADERS });
  if (!/^[A-Za-z0-9_-]{2,60}$/.test(id)) return NextResponse.json({ ok: false, error: "id_invalid" }, { status: 400, headers: WORKSTATION_SEC_HEADERS });
  const path = join(root(), `${id}.json`);
  if (!existsSync(path)) return NextResponse.json({ ok: false, error: "not_found" }, { status: 404, headers: WORKSTATION_SEC_HEADERS });
  try { unlinkSync(path); } catch { /* */ }
  return NextResponse.json({ ok: true, id }, { headers: { ...WORKSTATION_SEC_HEADERS, "Cache-Control": "no-store" } });
}
