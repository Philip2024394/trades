// scripts/nex-security-ci-runner.ts
//
// CI runner invoked by .github/workflows/security-agent.yml.
// Stage 2 of BUILD PLAN v1.1.
//
// Reads the git diff (base branch or HEAD~1 depending on event) · builds a
// SecurityInspectionRequest · calls the agent · exits with:
//   0 · ACCEPT
//   1 · REJECT (blocks merge)
//   2 · runner error

import { execSync } from "node:child_process";
import { SecurityAgent, type ProposedFileChange } from "@/lib/nex/security-agent";

const BASE_REF = process.env.BASE_REF ?? "origin/main";
const AGENT_ID = process.env.NEX_AGENT_ID ?? "master-ai";
const CHANGE_REASON =
  process.env.NEX_CHANGE_REASON ??
  process.env.GITHUB_HEAD_REF ??
  "CI · pull request change under CAP-091 · security agent inspection";

function shellOr(cmd: string, fallback: string): string {
  try {
    return execSync(cmd, { encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] });
  } catch {
    return fallback;
  }
}

function changedFiles(): string[] {
  // Try PR-style diff first
  const prDiff = shellOr(
    `git diff --name-only --diff-filter=ACMR ${BASE_REF}...HEAD`,
    "",
  );
  if (prDiff.trim().length > 0) {
    return prDiff.split("\n").map((s) => s.trim()).filter(Boolean);
  }
  // Fallback: push · compare with parent
  const pushDiff = shellOr("git diff --name-only --diff-filter=ACMR HEAD~1 HEAD", "");
  return pushDiff.split("\n").map((s) => s.trim()).filter(Boolean);
}

function fileAction(path: string): "create" | "modify" | "delete" | "rename" {
  const status = shellOr(
    `git log -1 --name-status --pretty=format: -- "${path}"`,
    "M",
  ).trim().split(/\s+/)[0];
  const code = (status ?? "M")[0];
  if (code === "A") return "create";
  if (code === "D") return "delete";
  if (code === "R") return "rename";
  return "modify";
}

function filePreview(path: string): string {
  const content = shellOr(`git show HEAD:"${path}"`, "");
  if (content.length > 20480) {
    return content.slice(0, 20480) + "\n// ...[TRUNCATED at 20KB]...";
  }
  return content;
}

async function main() {
  const files = changedFiles();
  if (files.length === 0) {
    console.log("[security-agent CI] No changed files · nothing to inspect.");
    process.exit(0);
  }

  const proposedFiles: ProposedFileChange[] = files.map((path) => ({
    path,
    action: fileAction(path),
    newContentPreview: filePreview(path),
  }));

  const agent = new SecurityAgent(process.cwd());
  const decision = await agent.inspect({
    agentId: AGENT_ID as never,
    targetCapabilities: [],
    changeReason: CHANGE_REASON,
    proposedFiles,
    proposedAction: { kind: "code_change_only" },
  });

  if (decision.accepted) {
    console.log(
      `::notice::Security Agent ACCEPT · runId=${decision.runId} · agent=${decision.agentId} · ${files.length} file(s)`,
    );
    process.exit(0);
  }

  console.error(
    `::error::Security Agent REJECT · runId=${decision.runId} · agent=${decision.agentId} · ${decision.rejections.length} rejection(s)`,
  );
  for (const r of decision.rejections) {
    const loc = r.filePath ? ` file=${r.filePath}` : "";
    console.error(`::error::  ${r.code}${loc} · ${r.message}`);
  }
  process.exit(1);
}

main().catch((e) => {
  console.error("[security-agent CI] Fatal:", e);
  process.exit(2);
});
