// NEX Coding Team · Agent definition validator
// Parses YAML frontmatter for every agent .md file and asserts the required
// schema. Fails fast at boot so a malformed agent never surfaces mid-pipeline.
//
// Called from: /api/nex-coding-team/health · runtime start-up smoke test.

import { existsSync, readFileSync, readdirSync } from "node:fs";
import * as path from "node:path";
import { ALL_AGENT_IDS } from "./types";
import type { AgentId } from "./types";

const REPO_ROOT = process.cwd();
const AGENTS_DIR = path.join(REPO_ROOT, "src", "lib", "nex-coding-team", "agents");

const REQUIRED_FIELDS: readonly string[] = [
  "agent_id",
  "name",
  "title",
  "pipeline_stage",
  "kind",
  "reads",
  "writes",
  "touches_code",
  "permissions",
  "stop_conditions",
];

export interface AgentDefinition {
  readonly agent_id: AgentId;
  readonly file_path: string;
  readonly frontmatter: Readonly<Record<string, unknown>>;
  readonly body: string;
}

export interface AgentValidationIssue {
  readonly agent_id: AgentId | null;
  readonly file_path: string;
  readonly issue: string;
}

export interface AgentValidationReport {
  readonly ok: boolean;
  readonly agents_found: number;
  readonly agents_expected: number;
  readonly definitions: readonly AgentDefinition[];
  readonly issues: readonly AgentValidationIssue[];
}

export function validateAllAgents(): AgentValidationReport {
  const issues: AgentValidationIssue[] = [];
  const definitions: AgentDefinition[] = [];

  if (!existsSync(AGENTS_DIR)) {
    return {
      ok: false,
      agents_found: 0,
      agents_expected: ALL_AGENT_IDS.length,
      definitions: [],
      issues: [{ agent_id: null, file_path: AGENTS_DIR, issue: "agents directory missing" }],
    };
  }

  const files = readdirSync(AGENTS_DIR)
    .filter((f) => f.endsWith(".md"))
    .sort();

  const seen = new Set<string>();
  for (const file of files) {
    const abs = path.join(AGENTS_DIR, file);
    const parsed = parseAgentFile(abs);
    if ("issue" in parsed) {
      issues.push({ agent_id: null, file_path: abs, issue: parsed.issue });
      continue;
    }
    const def = parsed.def;
    if (!(ALL_AGENT_IDS as readonly string[]).includes(def.agent_id)) {
      issues.push({
        agent_id: null,
        file_path: abs,
        issue: `agent_id "${def.agent_id}" not in canonical AgentId set`,
      });
      continue;
    }
    if (seen.has(def.agent_id)) {
      issues.push({ agent_id: def.agent_id, file_path: abs, issue: "duplicate agent_id across files" });
      continue;
    }
    seen.add(def.agent_id);
    definitions.push(def);
  }

  for (const expected of ALL_AGENT_IDS) {
    if (!seen.has(expected)) {
      issues.push({
        agent_id: expected,
        file_path: AGENTS_DIR,
        issue: `expected agent "${expected}" missing`,
      });
    }
  }

  return {
    ok: issues.length === 0 && definitions.length === ALL_AGENT_IDS.length,
    agents_found: definitions.length,
    agents_expected: ALL_AGENT_IDS.length,
    definitions,
    issues,
  };
}

function parseAgentFile(abs: string): { def: AgentDefinition } | { issue: string } {
  const raw = readFileSync(abs, "utf8");
  const match = raw.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n([\s\S]*)$/);
  if (!match || !match[1] || match[2] === undefined) {
    return { issue: "missing or malformed frontmatter (--- ... ---)" };
  }
  const fm = match[1];
  const body = match[2];
  const frontmatter = parseSimpleYaml(fm);
  for (const field of REQUIRED_FIELDS) {
    if (!(field in frontmatter)) {
      return { issue: `missing required field: ${field}` };
    }
  }
  const bodyTrim = body.trim();
  if (!bodyTrim.includes("## Purpose")) {
    return { issue: "body missing '## Purpose' section" };
  }
  const agent_id = String(frontmatter.agent_id);
  return {
    def: {
      agent_id: agent_id as AgentId,
      file_path: abs,
      frontmatter,
      body: bodyTrim,
    },
  };
}

// Minimal YAML parser · handles `key: value`, `key: [a, b, c]`, `key:` (null).
// Not a full engine — only what our frontmatter uses.
export function parseSimpleYaml(input: string): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const rawLine of input.split(/\r?\n/)) {
    const line = rawLine.trimEnd();
    if (!line || line.trimStart().startsWith("#")) continue;
    const colon = line.indexOf(":");
    if (colon === -1) continue;
    const key = line.slice(0, colon).trim();
    const val = line.slice(colon + 1).trim();
    if (val === "") {
      out[key] = null;
      continue;
    }
    if (val.startsWith("[") && val.endsWith("]")) {
      const inner = val.slice(1, -1).trim();
      out[key] = inner.length === 0 ? [] : inner.split(",").map((s) => s.trim());
    } else if (/^-?\d+(?:\.\d+)?$/.test(val)) {
      out[key] = Number(val);
    } else if (val === "true") {
      out[key] = true;
    } else if (val === "false") {
      out[key] = false;
    } else {
      out[key] = val.replace(/^["']|["']$/g, "");
    }
  }
  return out;
}
