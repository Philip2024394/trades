// GET  /api/nex-security/scan?path=<repo-relative>  · one-shot scan of one path or tree
// POST /api/nex-security/scan/baseline · snapshot integrity of DEFAULT_INTEGRITY_TARGETS
// GET  /api/nex-security/scan/drift    · compare current state to latest baseline

import { NextResponse } from "next/server";
import * as path from "node:path";
import { existsSync, statSync } from "node:fs";
import {
  scanFile,
  scanDirectory,
  createBaseline,
  saveBaseline,
  loadLatestBaseline,
  compareToBaseline,
  DEFAULT_INTEGRITY_TARGETS,
} from "@/lib/nex-security/scanner";

export const dynamic = "force-dynamic";

const REPO_ROOT = process.cwd();

export async function GET(req: Request) {
  const url = new URL(req.url);
  const target = url.searchParams.get("path");
  if (!target) {
    // No path supplied · scan the coding-team + coding-chat trees + scripts + agents.
    const roots = ["src/lib/nex-coding-team", "src/lib/nex-coding-chat", "src/lib/nex-security", "scripts/nex-coding-chat", "scripts/nex-coding-team"];
    const combined = roots.map((r) => scanDirectory(r));
    const critical = combined.reduce((n, r) => n + r.critical_count, 0);
    const warning = combined.reduce((n, r) => n + r.warning_count, 0);
    const info = combined.reduce((n, r) => n + r.info_count, 0);
    const files = combined.reduce((n, r) => n + r.files_scanned, 0);
    return NextResponse.json({
      ok: critical === 0,
      files_scanned: files,
      critical_count: critical,
      warning_count: warning,
      info_count: info,
      results: combined,
      scanned_at: new Date().toISOString(),
    });
  }

  // Path-escape defence.
  const rel = target.replace(/\\/g, "/");
  if (rel.startsWith("..") || path.isAbsolute(rel)) {
    return NextResponse.json({ ok: false, error: "path must be repo-relative and non-escaping" }, { status: 400 });
  }
  const abs = path.resolve(REPO_ROOT, rel);
  if (!existsSync(abs)) return NextResponse.json({ ok: false, error: "path not found" }, { status: 404 });

  const st = statSync(abs);
  if (st.isDirectory()) {
    return NextResponse.json(scanDirectory(rel));
  }
  const r = scanFile(rel);
  return NextResponse.json(r);
}

export async function POST(req: Request) {
  // POST creates + persists an integrity baseline of the default protected files.
  const baseline = createBaseline(DEFAULT_INTEGRITY_TARGETS);
  const saved_at = saveBaseline(baseline);
  return NextResponse.json({
    ok: true,
    baseline_path: saved_at,
    files_tracked: baseline.files.length,
    created_at: baseline.created_at,
  });
}
