// GET  /api/nex/founder/allowlist         · current allowlist + pending proposals
// POST /api/nex/founder/allowlist/apply   · apply a pending proposal file
//
// Founder-authorised · reads/writes data/nex-page-fetcher-allowlist.json
// and data/nex-page-fetcher-allowlist.PROPOSED-v*.json.
//
// Doctrine: every write records who applied it + when, with signed_at
// captured server-side (never trusted from client). Founder gate = same
// pattern as every other founder route.

import { NextResponse } from "next/server";
import * as fs from "node:fs/promises";
import * as path from "node:path";
import { resolveFounderAuth } from "@/lib/nex/marketing/founder";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const CURRENT_PATH = "data/nex-page-fetcher-allowlist.json";

async function readIfExists(p: string): Promise<any | null> {
  try { return JSON.parse(await fs.readFile(p, "utf8")); }
  catch { return null; }
}

export async function GET(req: Request) {
  const auth = resolveFounderAuth(req);
  if (!auth.authenticated) return NextResponse.json({ ok: false, error: "not_founder" }, { status: 401 });

  const cwd = process.cwd();
  const current = await readIfExists(path.join(cwd, CURRENT_PATH));

  // Find all pending PROPOSED files
  const files = await fs.readdir(path.join(cwd, "data")).catch(() => [] as string[]);
  const proposals: Array<{ file: string; parsed: any; added_hosts: string[]; removed_hosts: string[] }> = [];
  const currentHostSet = new Set<string>((current?.allowed_hosts ?? []).map((h: any) => h.host));
  for (const f of files) {
    if (!/^nex-page-fetcher-allowlist\.PROPOSED-v\d+\.json$/.test(f)) continue;
    const p = path.join(cwd, "data", f);
    const parsed = await readIfExists(p);
    if (!parsed) continue;
    const proposedHostSet = new Set<string>((parsed.allowed_hosts ?? []).map((h: any) => h.host));
    proposals.push({
      file: f,
      parsed,
      added_hosts: [...proposedHostSet].filter((h) => !currentHostSet.has(h)),
      removed_hosts: [...currentHostSet].filter((h) => !proposedHostSet.has(h)),
    });
  }
  proposals.sort((a, b) => (b.parsed.version ?? 0) - (a.parsed.version ?? 0));

  return NextResponse.json({
    ok: true, server_now: new Date().toISOString(),
    current: current ? {
      version: current.version, signed_by: current.signed_by, signed_at: current.signed_at,
      host_count: (current.allowed_hosts ?? []).length,
      hosts: (current.allowed_hosts ?? []).map((h: any) => h.host),
    } : null,
    pending_proposals: proposals.map((p) => ({
      file: p.file,
      version: p.parsed.version,
      added_count: p.added_hosts.length,
      removed_count: p.removed_hosts.length,
      added_hosts: p.added_hosts,
      removed_hosts: p.removed_hosts,
      note: p.parsed.revision_history?.[p.parsed.revision_history.length - 1]?.note ?? null,
    })),
  });
}

export async function POST(req: Request) {
  const auth = resolveFounderAuth(req);
  if (!auth.authenticated) return NextResponse.json({ ok: false, error: "not_founder" }, { status: 401 });

  let body: { file?: string } = {};
  try { body = await req.json(); } catch { /* empty ok */ }
  const file = body.file;
  if (!file || !/^nex-page-fetcher-allowlist\.PROPOSED-v\d+\.json$/.test(file)) {
    return NextResponse.json({ ok: false, error: "invalid_proposal_filename" }, { status: 400 });
  }

  const cwd = process.cwd();
  const src = path.join(cwd, "data", file);
  const parsed = await readIfExists(src);
  if (!parsed) return NextResponse.json({ ok: false, error: "proposal_not_found_or_invalid_json" }, { status: 404 });

  // Server-side stamp: signed_at = now(), signed_by = the authenticated actor.
  // We DO NOT trust client-supplied signed_at/signed_by placeholders.
  const now = new Date().toISOString();
  const signed = {
    ...parsed,
    signed_by: "founder",
    signed_at: now,
    revision_history: (parsed.revision_history ?? []).map((r: any) =>
      r.at?.startsWith("REPLACE") ? { ...r, at: now } : r
    ),
  };

  // Backup current
  const currentPath = path.join(cwd, CURRENT_PATH);
  const backupPath = path.join(cwd, "data", `nex-page-fetcher-allowlist.backup-${now.replace(/[:.]/g, "-")}.json`);
  try { await fs.copyFile(currentPath, backupPath); } catch { /* first-time · ok */ }

  await fs.writeFile(currentPath, JSON.stringify(signed, null, 2) + "\n", "utf8");
  // Rename proposal to .applied-<timestamp>.json so it doesn't reappear as pending
  try {
    await fs.rename(src, path.join(cwd, "data", file.replace(".PROPOSED-", `.applied-${now.replace(/[:.]/g, "-")}-`)));
  } catch { /* non-fatal */ }

  return NextResponse.json({
    ok: true,
    applied_version: signed.version,
    signed_at: now,
    signed_by: signed.signed_by,
    host_count: (signed.allowed_hosts ?? []).length,
    backup_written: backupPath,
    actor: auth.actor,
  });
}
