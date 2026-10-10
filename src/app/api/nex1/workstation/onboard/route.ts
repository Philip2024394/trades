// POST /api/nex1/workstation/onboard
//
// NEX1 · Workstation Repo-Onboarding · 2026-09-17.
// Founder-authorised.
//
// PURPOSE
//   When the user drops a repo onto the workstation, this endpoint returns the
//   deterministic "onboarding report" NEX1 must post to the chat feed BEFORE
//   the first code prompt:
//     · repo file count · total size
//     · code-type distribution
//     · framework(s) detected · what the repo was created with
//     · scan errors located during upload
//     · restructure suggestions (code-level · not UI-level)
//     · notable signals (SQL discipline · Android companion · Docker · etc.)
//
// CONTRACT
//   Request  · { repo_id: string }   e.g. "corpus-website"
//   Response · Either single JSON (Content-Type: application/json)
//              OR SSE stream (Accept: text/event-stream) — one frame per event.
//
// SANDBOX
//   The onboarding capability itself refuses any path outside
//   data/nex-training-corpus/. This route additionally verifies repo_id is
//   a simple slug (no path traversal). Zero code executed. Zero LLM.

import { NextResponse } from "next/server";
import * as path from "node:path";
import * as fs from "node:fs";
import { runRepoOnboarding, type OnboardingEvent } from "@/lib/nex-agent/code-engine/capability-repo-onboarding";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

interface RequestBody {
  repo_id?: string;
}

const REPO_ID_RE = /^[a-z0-9][a-z0-9._-]{0,63}$/i;

function loadSafetyScanIfPresent(corpusDir: string): unknown {
  try {
    const dir = path.join(corpusDir, "_scans");
    if (!fs.existsSync(dir)) return null;
    const files = fs.readdirSync(dir).filter((f) => f.endsWith(".json")).sort();
    if (files.length === 0) return null;
    const latest = path.join(dir, files[files.length - 1]);
    return JSON.parse(fs.readFileSync(latest, "utf8"));
  } catch {
    return null;
  }
}

export async function POST(req: Request) {
  let body: RequestBody = {};
  try { body = await req.json(); } catch { /* empty ok · repo_id may be in query */ }
  const url = new URL(req.url);
  const repo_id = (body.repo_id ?? url.searchParams.get("repo_id") ?? "").toString().trim();
  if (!repo_id) {
    return NextResponse.json({ ok: false, error: "repo_id_required" }, { status: 400 });
  }
  if (!REPO_ID_RE.test(repo_id)) {
    return NextResponse.json({ ok: false, error: "repo_id_invalid", detail: "must match /^[a-z0-9][a-z0-9._-]{0,63}$/i" }, { status: 400 });
  }

  const cwd = process.cwd();
  const corpusDir = path.join(cwd, "data", "nex-training-corpus");
  const repoRoot = path.join(corpusDir, repo_id);
  const scan = loadSafetyScanIfPresent(corpusDir);

  const result = runRepoOnboarding({
    repo_id,
    repo_root: repoRoot,
    corpus_dir_abs: corpusDir,
    safety_scan_json: scan,
  });

  // SSE mode.
  const accept = req.headers.get("accept") || "";
  if (accept.includes("text/event-stream")) {
    const encoder = new TextEncoder();
    const stream = new ReadableStream<Uint8Array>({
      start(controller) {
        const write = (event: string, data: unknown) => {
          const frame = `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`;
          controller.enqueue(encoder.encode(frame));
        };
        write("hello", { repo_id, streaming_version: "onboard-2026-09-17" });
        for (const e of result.events as readonly OnboardingEvent[]) {
          write(e.kind, { ...e.data, at_ms: e.at_ms, execution_source: "NEX1_NATIVE", zero_llm: true });
        }
        write("done", {
          ok: result.ok,
          denied_reason: result.denied_reason ?? null,
          duration_ms: result.duration_ms,
          execution_source: "NEX1_NATIVE",
          zero_llm: true,
        });
        try { controller.close(); } catch { /* already closed */ }
      },
    });
    return new Response(stream, {
      headers: {
        "Content-Type": "text/event-stream; charset=utf-8",
        "Cache-Control": "no-cache, no-transform",
        "Connection": "keep-alive",
        "X-Nex-Execution-Source": "NEX1_NATIVE",
        "X-Nex-Zero-LLM": "true",
      },
    });
  }

  // JSON mode.
  return NextResponse.json({
    ok: result.ok,
    source: "NEX1_NATIVE",
    zero_llm: true,
    repo_id: result.repo_id,
    denied_reason: result.denied_reason ?? null,
    duration_ms: result.duration_ms,
    events: result.events,
  });
}

export async function GET(req: Request) {
  // Convenience: list available repos in the corpus dir.
  const corpusDir = path.join(process.cwd(), "data", "nex-training-corpus");
  let entries: string[] = [];
  try { entries = fs.readdirSync(corpusDir); } catch { entries = []; }
  const repos = entries
    .filter((n) => !n.startsWith("_") && !n.startsWith("."))
    .filter((n) => {
      try { return fs.statSync(path.join(corpusDir, n)).isDirectory(); } catch { return false; }
    })
    .map((repo_id) => {
      const abs = path.join(corpusDir, repo_id);
      let file_count = 0, total_bytes = 0;
      const stack = [abs];
      const excludeDirs = new Set([".git", "node_modules"]);
      while (stack.length) {
        const cur = stack.pop()!;
        let s: fs.Stats;
        try { s = fs.statSync(cur); } catch { continue; }
        if (s.isDirectory()) {
          const base = path.basename(cur);
          if (excludeDirs.has(base)) continue;
          try { for (const c of fs.readdirSync(cur)) stack.push(path.join(cur, c)); } catch { /* ignore */ }
        } else if (s.isFile()) {
          file_count++;
          total_bytes += s.size;
        }
      }
      return { repo_id, file_count, total_bytes };
    });
  return NextResponse.json({ ok: true, corpus_dir: "data/nex-training-corpus", repos, source: "NEX1_NATIVE", zero_llm: true });
}
