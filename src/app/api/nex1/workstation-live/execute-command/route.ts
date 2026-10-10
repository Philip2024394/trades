// §36-W-3 · W-3 · 2026-09-15 · workstation-execution-bridge
// NEX bounded infrastructure · execute-command API · 2026-09-15
//
// POST /api/nex1/workstation-live/execute-command
// Body: { command_text: string, authorisation_ref: string }
// Response: parser refusal OR execution result

import { NextRequest, NextResponse } from "next/server";
import * as fs from "node:fs";
import * as path from "node:path";
import { parseFounderCommand } from "@/lib/nex-agent-runtime/command-parser/command-parser";
import { executeStructuredCommand } from "@/lib/nex-agent-runtime/workstation-execution-bridge/execute-command";
import type { StyleOverridesFile } from "@/lib/nex-agent-runtime/workstation-execution-bridge/execution-bridge-types";
import { EMPTY_STYLE_OVERRIDES } from "@/lib/nex-agent-runtime/workstation-execution-bridge/execution-bridge-types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const REPO_ROOT = process.cwd();
const AUTHORISED_TARGET_ROOT = path.resolve(REPO_ROOT, "src/app/nex-generated/tiny-calculator");
const AUTHORISED_STATE_FILE = path.resolve(REPO_ROOT, "data/route-2d-tiny-calculator/style-overrides.json");
const AUTHORISED_TEST_FILE_RELATIVE = "src/app/nex-generated/tiny-calculator/TinyCalculator.test.tsx";

function loadOverrides(): StyleOverridesFile {
  try {
    if (!fs.existsSync(AUTHORISED_STATE_FILE)) return EMPTY_STYLE_OVERRIDES;
    const raw = fs.readFileSync(AUTHORISED_STATE_FILE, "utf8");
    const parsed = JSON.parse(raw);
    if (parsed && parsed.$schema_version === "route-2d-tiny-calculator-overrides-v1") {
      return parsed as StyleOverridesFile;
    }
    return EMPTY_STYLE_OVERRIDES;
  } catch {
    return EMPTY_STYLE_OVERRIDES;
  }
}

export async function POST(request: NextRequest): Promise<NextResponse> {
  let body: { command_text?: string; authorisation_ref?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ ok: false, stage: "parse_body", refusal_code: "INVALID_JSON", reason: "request body was not JSON" }, { status: 400 });
  }

  const authorisation_ref = typeof body.authorisation_ref === "string" ? body.authorisation_ref : "";
  if (authorisation_ref.length === 0) {
    return NextResponse.json({ ok: false, stage: "authorisation", refusal_code: "MISSING_AUTHORISATION", reason: "authorisation_ref required" }, { status: 401 });
  }

  const command_text = typeof body.command_text === "string" ? body.command_text : "";

  // Stage 1 · parse
  const parsed = parseFounderCommand(command_text);
  if (!parsed.ok) {
    return NextResponse.json({ ok: false, stage: "parser", parser: parsed }, { status: 200 });
  }

  // Stage 2 · execute
  const currentOverrides = loadOverrides();
  const mission_id = `wre-mission-${Date.now().toString(36)}`;
  const now_iso = new Date().toISOString();

  const result = await executeStructuredCommand({
    mission_id,
    authorisation_ref,
    structured: parsed.structured,
    matched_phrase_id: parsed.matched_phrase_id,
    current_overrides: currentOverrides,
    authorised_target_root: AUTHORISED_TARGET_ROOT,
    authorised_state_file_path: AUTHORISED_STATE_FILE,
    authorised_test_file_relative_path: AUTHORISED_TEST_FILE_RELATIVE,
    clock_iso: now_iso,
  }, REPO_ROOT);

  return NextResponse.json({ ok: result.ok, stage: "execute", parser: parsed, execute: result }, { status: 200 });
}
