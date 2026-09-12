#!/usr/bin/env node
// scripts/nex-security-precommit.mjs
//
// Pre-commit + CI wrapper for the HQ Security Agent.
// Stage 2 of BUILD PLAN v1.1.
//
// USAGE:
//   node scripts/nex-security-precommit.mjs                    # pre-commit mode · reads git staged files
//   node scripts/nex-security-precommit.mjs --agent-id nex1 --reason "CAP-091 · adding sidebar entry"
//
// EXIT CODES:
//   0 · Security Agent ACCEPTs (safe to commit)
//   1 · Security Agent REJECTs (commit blocked)
//   2 · Invocation error (missing args · agent load failure)
//
// The script:
//   1. Determines the set of files staged for commit (via `git diff --cached --name-only`)
//   2. Reads the change reason (from --reason flag OR git commit message file OR env)
//   3. Determines agent identity (from --agent-id flag OR env NEX_AGENT_ID OR "founder")
//   4. Reads the proposed content of each staged file (from staged area)
//   5. Constructs a SecurityInspectionRequest and calls the agent in-process
//   6. Prints the SecurityDecision + exits with the right code
//
// DISCIPLINE:
//   - READ-ONLY on the repository (never writes back)
//   - Never bypasses the Security Agent
//   - Never suppresses rejections
//   - Every rejection is printed with its full sec.* code + message

import { execSync } from "node:child_process";
import { readFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import { pathToFileURL } from "node:url";

const args = process.argv.slice(2);
function argValue(name, defaultValue = null) {
  const idx = args.indexOf(name);
  if (idx >= 0 && args[idx + 1]) return args[idx + 1];
  return defaultValue;
}

function stagedFiles() {
  try {
    const out = execSync("git diff --cached --name-only --diff-filter=ACMR", {
      encoding: "utf8",
      stdio: ["ignore", "pipe", "pipe"],
    });
    return out
      .split("\n")
      .map((s) => s.trim())
      .filter((s) => s.length > 0);
  } catch {
    return [];
  }
}

function stagedFileAction(path) {
  try {
    const out = execSync(`git diff --cached --name-status -- "${path}"`, {
      encoding: "utf8",
      stdio: ["ignore", "pipe", "pipe"],
    });
    const status = (out.trim().split(/\s+/)[0] ?? "M")[0];
    if (status === "A") return "create";
    if (status === "D") return "delete";
    if (status === "R") return "rename";
    return "modify";
  } catch {
    return "modify";
  }
}

function stagedFileContent(path) {
  try {
    const out = execSync(`git show ":${path}"`, {
      encoding: "utf8",
      stdio: ["ignore", "pipe", "pipe"],
    });
    // Truncate very large files to first 200 lines / 20 KB for pattern check
    const truncated =
      out.length > 20480
        ? out.slice(0, 20480) + "\n// ...[TRUNCATED at 20 KB by security precommit]..."
        : out;
    return truncated;
  } catch {
    return "";
  }
}

async function loadAgent() {
  // Import via file URL to work with ESM in this .mjs context
  const cwd = process.cwd();
  const agentModule = await import(
    pathToFileURL(`${cwd}/src/lib/nex/security-agent/security-agent.ts`).href
  ).catch(async () => {
    // Fallback: try compiled path (if project has been built)
    const p = `${cwd}/.next/server/lib/nex/security-agent/security-agent.js`;
    if (existsSync(p)) {
      return import(pathToFileURL(p).href);
    }
    return null;
  });
  return agentModule;
}

async function readCommitReasonFromFile(pathFromArg) {
  const p =
    pathFromArg ??
    argValue("--commit-msg-file") ??
    process.env.HUSKY_GIT_PARAMS ??
    process.env.GIT_COMMIT_MSG_FILE;
  if (!p || !existsSync(p)) return null;
  try {
    const raw = await readFile(p, "utf8");
    return raw
      .split("\n")
      .filter((l) => !l.startsWith("#"))
      .join("\n")
      .trim();
  } catch {
    return null;
  }
}

async function main() {
  const files = stagedFiles();
  if (files.length === 0) {
    console.log("[security-agent] No staged files · nothing to inspect · commit allowed.");
    process.exit(0);
  }

  const agentId = argValue("--agent-id") ?? process.env.NEX_AGENT_ID ?? "founder";
  let changeReason = argValue("--reason");
  if (!changeReason) {
    changeReason = await readCommitReasonFromFile();
  }
  if (!changeReason) {
    console.error(
      "[security-agent] ERROR: No --reason provided and no commit-msg file found.",
    );
    console.error(
      "Every code change must cite a WHY that references a CAP-XXX (per DOC-036).",
    );
    process.exit(2);
  }

  // Build proposed-files array
  const proposedFiles = files.map((path) => ({
    path,
    action: stagedFileAction(path),
    newContentPreview: stagedFileContent(path),
  }));

  // Load the agent
  console.log(`[security-agent] Inspecting ${files.length} staged file(s) via agent...`);
  const mod = await loadAgent();
  if (!mod || !mod.SecurityAgent) {
    console.error(
      "[security-agent] ERROR: Could not load SecurityAgent. This precommit requires tsx or a build.",
    );
    console.error(
      "Try: npx tsx scripts/nex-security-precommit.mjs OR ensure .ts is loadable via runtime.",
    );
    process.exit(2);
  }

  const agent = new mod.SecurityAgent(process.cwd());
  const decision = await agent.inspect({
    agentId,
    targetCapabilities: [],
    changeReason,
    proposedFiles,
    proposedAction: { kind: "code_change_only" },
  });

  if (decision.accepted) {
    console.log(
      `[security-agent] ACCEPT · runId=${decision.runId} · agent=${decision.agentId} · files=${files.length}`,
    );
    process.exit(0);
  }

  // REJECT · print every rejection · exit non-zero
  console.error(
    `[security-agent] REJECT · runId=${decision.runId} · agent=${decision.agentId} · ${decision.rejections.length} rejection(s):`,
  );
  for (const r of decision.rejections) {
    const loc = r.filePath ? ` [${r.filePath}]` : "";
    console.error(`  · ${r.code}${loc} · ${r.message}`);
  }
  console.error("");
  console.error(
    "[security-agent] Commit BLOCKED. Fix the rejections above · re-stage · try again.",
  );
  process.exit(1);
}

main().catch((e) => {
  console.error("[security-agent] Fatal:", e);
  process.exit(2);
});
