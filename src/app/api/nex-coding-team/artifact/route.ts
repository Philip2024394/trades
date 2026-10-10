// GET /api/nex-coding-team/artifact?run_id=...&name=...
// Returns the raw contents of an agent-produced artifact so the workstation UI
// can render spec.md, review.md, etc. Path is scope-restricted to a specific
// run's directory · no traversal permitted.

import { NextResponse } from "next/server";
import { existsSync, readFileSync } from "node:fs";
import * as path from "node:path";

export const dynamic = "force-dynamic";

const REPO_ROOT = path.resolve(process.cwd()); // Next.js runs from repo root

// Allowlist of artifact names — additive, no wildcards.
const ARTIFACT_ALLOWLIST = new Set<string>([
  "ticket.md",
  "spec.md",
  "build-notes.md",
  "test-plan.md",
  "debug-notes.md",
  "review.md",
  "forensics.md",
  "secops.md",
  "integration.md",
  "docs-notes.md",
  "telemetry-report.md",
  "types.md",
  "migration-review.md",
  "a11y-review.md",
  "contract-review.md",
  "manifest.json",
  "AGENT_STATE.json",
  "founder-prompt.txt",
]);

const RUN_ID_RX = /^run-[0-9T:.\-Z]+-[0-9a-f]{8}$/;

export async function GET(req: Request) {
  const url = new URL(req.url);
  const run_id = (url.searchParams.get("run_id") ?? "").trim();
  const name = (url.searchParams.get("name") ?? "").trim();

  if (!RUN_ID_RX.test(run_id)) {
    return NextResponse.json({ ok: false, error: "run_id has invalid shape" }, { status: 400 });
  }
  if (!ARTIFACT_ALLOWLIST.has(name)) {
    return NextResponse.json({ ok: false, error: `name not in allowlist: ${name}` }, { status: 400 });
  }

  const full = path.join(REPO_ROOT, "data", "nex-coding-team", "runs", run_id, name);
  // Defensive: reject any path that escapes the run directory (belt-and-braces even though
  // both run_id and name are already regex-restricted).
  const runDir = path.join(REPO_ROOT, "data", "nex-coding-team", "runs", run_id);
  const resolved = path.resolve(full);
  if (!resolved.startsWith(path.resolve(runDir) + path.sep) && resolved !== path.resolve(runDir)) {
    return NextResponse.json({ ok: false, error: "path escapes run directory" }, { status: 400 });
  }

  if (!existsSync(full)) {
    return NextResponse.json({ ok: false, error: "artifact not yet produced" }, { status: 404 });
  }

  const content = readFileSync(full, "utf8");
  return new NextResponse(content, {
    status: 200,
    headers: { "Content-Type": name.endsWith(".json") ? "application/json" : "text/plain; charset=utf-8" },
  });
}
