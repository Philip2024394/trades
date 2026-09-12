// src/app/api/nex/agent/github/route.ts
//
// GitHub connection registry for NEX1 · founder types a repo URL and connects it.
// Persisted to data/nex-agent-github.json so the connection survives dev restarts.
//
// GET  → { ok, repo, connected_at, connected_by, validation }
// POST { repoUrl, connectedBy } → validates format + optional reachability check
//   Format: https://github.com/{owner}/{repo}   OR   git@github.com:{owner}/{repo}.git

import { NextResponse } from "next/server";
import { readFileSync, writeFileSync, existsSync, mkdirSync } from "node:fs";
import { resolve, dirname } from "node:path";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

interface GithubConnection {
  readonly repoUrl: string;
  readonly owner: string;
  readonly repo: string;
  readonly connectedAt: string;
  readonly connectedBy: string;
  readonly reachable: boolean | null;
  readonly reachabilityCheckedAt: string | null;
}

function storePath(): string {
  return resolve(process.cwd(), "data/nex-agent-github.json");
}

function loadConnection(): GithubConnection | null {
  const p = storePath();
  if (!existsSync(p)) return null;
  try {
    const raw = readFileSync(p, "utf8");
    return JSON.parse(raw) as GithubConnection;
  } catch {
    return null;
  }
}

function saveConnection(conn: GithubConnection): void {
  const p = storePath();
  mkdirSync(dirname(p), { recursive: true });
  writeFileSync(p, JSON.stringify(conn, null, 2), "utf8");
}

function parseGithubUrl(url: string): { owner: string; repo: string } | null {
  const s = url.trim();
  // https form
  const httpsMatch = /^https:\/\/github\.com\/([A-Za-z0-9._-]+)\/([A-Za-z0-9._-]+?)(?:\.git)?\/?$/.exec(s);
  if (httpsMatch) return { owner: httpsMatch[1], repo: httpsMatch[2] };
  // ssh form · git@github.com:owner/repo.git
  const sshMatch = /^git@github\.com:([A-Za-z0-9._-]+)\/([A-Za-z0-9._-]+?)(?:\.git)?$/.exec(s);
  if (sshMatch) return { owner: sshMatch[1], repo: sshMatch[2] };
  return null;
}

async function checkReachability(owner: string, repo: string): Promise<boolean | null> {
  try {
    const r = await fetch(`https://api.github.com/repos/${owner}/${repo}`, {
      headers: { Accept: "application/vnd.github+json", "User-Agent": "nex1-workstation" },
      signal: AbortSignal.timeout(8000),
    });
    if (r.status === 200) return true;
    if (r.status === 404) return false;
    return null; // rate-limited or auth-required · leave unknown
  } catch {
    return null;
  }
}

export async function GET() {
  const conn = loadConnection();
  return NextResponse.json({ ok: true, connection: conn }, { headers: { "Cache-Control": "no-store" } });
}

export async function POST(req: Request) {
  let body: { repoUrl?: string; connectedBy?: string } = {};
  try { body = await req.json(); } catch { /* empty */ }

  const repoUrl = String(body.repoUrl ?? "").trim();
  const connectedBy = String(body.connectedBy ?? "founder").trim();
  if (!repoUrl) return NextResponse.json({ ok: false, error: "repo_url_required" }, { status: 400 });

  const parsed = parseGithubUrl(repoUrl);
  if (!parsed) {
    return NextResponse.json({
      ok: false,
      error: "invalid_repo_url",
      detail: "expected https://github.com/{owner}/{repo} or git@github.com:{owner}/{repo}.git",
    }, { status: 400 });
  }

  const reachable = await checkReachability(parsed.owner, parsed.repo);
  const conn: GithubConnection = {
    repoUrl,
    owner: parsed.owner,
    repo: parsed.repo,
    connectedAt: new Date().toISOString(),
    connectedBy,
    reachable,
    reachabilityCheckedAt: new Date().toISOString(),
  };
  saveConnection(conn);

  return NextResponse.json({ ok: true, connection: conn }, { headers: { "Cache-Control": "no-store" } });
}

export async function DELETE() {
  const p = storePath();
  if (existsSync(p)) {
    try {
      writeFileSync(p, JSON.stringify({}, null, 2), "utf8");
    } catch { /* ignore */ }
  }
  return NextResponse.json({ ok: true, disconnected: true }, { headers: { "Cache-Control": "no-store" } });
}
