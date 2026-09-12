// src/app/api/nex/agent/tools/route.ts
//
// NEX Agent v1 · direct tool invocation for the UI's "Ask a tool" panel.
// V1.0 exposes read-only tools only. Every call goes through the same
// registry the orchestrator uses, so behaviour matches.

import { NextResponse } from "next/server";
import { TOOL_REGISTRY, type ToolName, safeResolve } from "@/lib/nex-agent/tools";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const READ_ONLY_TOOLS = new Set<ToolName>([
  "read_file", "list_directory", "search_code", "git_status", "postgres_read", "crawler_feed", "architecture_scan",
  // V1.2 · verification tools spawn processes but DO NOT write to source. Considered safe.
  "run_typecheck", "run_lint", "run_tests",
  // V1.2 · worktree scaffolding · list is safe; create/delete require task ownership
  "git_worktree_list", "git_worktree_create", "git_worktree_delete",
  // V1.3 · database engineer · introspect is read-only · dry_run leaves DB untouched
  "postgres_schema_introspect", "postgres_dry_run_migration",
  // postgres_apply_migration is NOT here · only reachable via /api/nex/agent/migration/apply
]);

export async function POST(req: Request) {
  let body: { tool?: string; args?: Record<string, unknown> } = {};
  try { body = await req.json(); } catch { /* empty */ }
  const tool = String(body.tool ?? "").trim() as ToolName;
  if (!READ_ONLY_TOOLS.has(tool)) {
    return NextResponse.json({ ok: false, error: `unknown_or_forbidden_tool:${tool}` }, { status: 400 });
  }
  const args = body.args ?? {};
  try {
    let result: unknown;
    switch (tool) {
      case "read_file":            result = TOOL_REGISTRY.read_file(String(args.path ?? "")); break;
      case "list_directory":       result = TOOL_REGISTRY.list_directory(String(args.path ?? "")); break;
      case "search_code":          result = TOOL_REGISTRY.search_code(String(args.query ?? ""), { pathPrefix: args.path_prefix as string | undefined, maxMatches: args.max_matches as number | undefined }); break;
      case "git_status":           result = TOOL_REGISTRY.git_status(); break;
      case "postgres_read":        result = await TOOL_REGISTRY.postgres_read(String(args.sql ?? "")); break;
      case "crawler_feed":         result = await TOOL_REGISTRY.crawler_feed(String(args.query ?? ""), args.source as string | undefined); break;
      case "architecture_scan":    result = TOOL_REGISTRY.architecture_scan({ touched_paths: Array.isArray(args.touched_paths) ? args.touched_paths as string[] : [], added_dependencies: Array.isArray(args.added_dependencies) ? args.added_dependencies as string[] : [], diff_text: String(args.diff_text ?? "") }); break;
      case "run_typecheck":        result = await TOOL_REGISTRY.run_typecheck({ scope: args.scope as string | undefined, timeoutMs: args.timeout_ms as number | undefined }); break;
      case "run_lint":             result = await TOOL_REGISTRY.run_lint({ scope: args.scope as string | undefined, timeoutMs: args.timeout_ms as number | undefined }); break;
      case "run_tests":            result = await TOOL_REGISTRY.run_tests({ pattern: args.pattern as string | undefined, timeoutMs: args.timeout_ms as number | undefined }); break;
      case "git_worktree_list":    result = await TOOL_REGISTRY.git_worktree_list(); break;
      case "git_worktree_create":  result = await TOOL_REGISTRY.git_worktree_create(String(args.task_id ?? ""), { baseBranch: args.base_branch as string | undefined }); break;
      case "git_worktree_delete":  result = await TOOL_REGISTRY.git_worktree_delete(String(args.task_id ?? "")); break;
      case "postgres_schema_introspect": result = await TOOL_REGISTRY.postgres_schema_introspect(String(args.schema ?? ""), String(args.table ?? "")); break;
      case "postgres_dry_run_migration": result = await TOOL_REGISTRY.postgres_dry_run_migration(String(args.sql ?? "")); break;
    }
    return NextResponse.json({ ok: true, result });
  } catch (err) {
    return NextResponse.json({ ok: false, error: (err as Error).message.slice(0, 200) }, { status: 500 });
  }
}

// Optional GET for enumerating available tools + arg shapes (UI docs)
export async function GET() {
  return NextResponse.json({
    ok: true,
    tools: [
      { name: "read_file",         args: ["path"], description: "Read a file inside the repo (200KB max)." },
      { name: "list_directory",    args: ["path"], description: "List entries in a directory." },
      { name: "search_code",       args: ["query", "path_prefix?", "max_matches?"], description: "git grep across the repo." },
      { name: "git_status",        args: [],       description: "Current branch + ahead/behind + porcelain changes." },
      { name: "postgres_read",     args: ["sql"],  description: "SELECT-only read against nex_dev. Refuses any write keyword." },
      { name: "crawler_feed",      args: ["query", "source?"], description: "Query the lab crawler harvest_raw tables for a name match." },
      { name: "architecture_scan", args: ["touched_paths", "added_dependencies?", "diff_text?"], description: "Run rules/architecture.json against a proposed change." },
      { name: "run_typecheck",     args: ["scope?", "timeout_ms?"], description: "V1.2 · tsc --noEmit · parses TS errors into structured findings." },
      { name: "run_lint",          args: ["scope?", "timeout_ms?"], description: "V1.2 · next lint · parses ESLint output into structured findings." },
      { name: "run_tests",         args: ["pattern?", "timeout_ms?"], description: "V1.2 · vitest run · parses pass/fail summary + failed-file list." },
      { name: "git_worktree_list", args: [], description: "V1.2 · list git worktrees." },
      { name: "git_worktree_create", args: ["task_id", "base_branch?"], description: "V1.2 · create isolated worktree at data/nex-agent-workspaces/task-{id8}." },
      { name: "git_worktree_delete", args: ["task_id"], description: "V1.2 · remove a task's worktree." },
      { name: "postgres_schema_introspect", args: ["schema", "table"], description: "V1.3 · full shape of a table: columns · constraints · indexes · FKs · row-count estimate." },
      { name: "postgres_dry_run_migration", args: ["sql"], description: "V1.3 · runs SQL in a SAVEPOINT · always rolls back · returns per-statement results + destructive-op flags." },
    ],
  });
}
