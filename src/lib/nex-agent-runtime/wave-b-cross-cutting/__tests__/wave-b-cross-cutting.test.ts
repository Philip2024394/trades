// §36-WAVE-B · WAVE-B · 2026-09-15 · wave-b-cross-cutting
// NEX bounded infrastructure · Wave B specialist reviewer tests · 2026-09-15

import { describe, expect, it } from "vitest";
import { runWaveBCrossCuttingReviewers } from "../wave-b-cross-cutting";
import type {
  RunWaveBSpecialistsFailure,
  RunWaveBSpecialistsSuccess,
  WaveBSpecialistFindingId,
  WaveBSpecialistId,
} from "../wave-b-cross-cutting-types";
import {
  WAVE_B_FINDING_ID_SEVERITY_MAP,
  WAVE_B_GREP_MARKER,
  WAVE_B_SPECIALIST_IDS,
} from "../wave-b-cross-cutting-types";
import type { SkillCandidate } from "../../skills/skill-schema-types";

// ── Fixture builder ─────────────────────────────────────────────────────

function candidate(overrides: Partial<SkillCandidate> = {}): SkillCandidate {
  return {
    workspace_relative_path: "src/lib/example/file.ts",
    change_kind: "file_new",
    current_sha256_hex: null,
    proposed_content: "// empty\n",
    proposed_content_sha256_hex: null,
    declared_symbols: [],
    imported_symbols: [],
    imported_from_specifiers: [],
    authorised: true,
    test_count_declared: null,
    ...overrides,
  };
}

function findingIdsOf(r: RunWaveBSpecialistsSuccess, id: WaveBSpecialistId): WaveBSpecialistFindingId[] {
  const entry = r.per_specialist.find((p) => p.specialist_id === id);
  return entry ? entry.findings.map((f) => f.finding_id) : [];
}

function runAll(c: SkillCandidate): RunWaveBSpecialistsSuccess {
  const r = runWaveBCrossCuttingReviewers({ candidate: c, specialists_to_run: "all" });
  expect(r.kind).toBe("SUCCESS");
  return r as RunWaveBSpecialistsSuccess;
}

// ── §A · Refusal codes ─────────────────────────────────────────────────

describe("§36-WAVE-B · Wave B · §A · refusal codes", () => {
  it("A-1 · WB_INVALID_REQUEST when request is null", () => {
    const r = runWaveBCrossCuttingReviewers(null as never) as RunWaveBSpecialistsFailure;
    expect(r.kind).toBe("FAILURE");
    expect(r.refusal_code).toBe("WB_INVALID_REQUEST");
  });

  it("A-2 · WB_INVALID_CANDIDATE when candidate is missing", () => {
    const r = runWaveBCrossCuttingReviewers({
      candidate: null as never,
      specialists_to_run: "all",
    }) as RunWaveBSpecialistsFailure;
    expect(r.kind).toBe("FAILURE");
    expect(r.refusal_code).toBe("WB_INVALID_CANDIDATE");
  });

  it("A-3 · WB_UNKNOWN_SPECIALIST when a specialist_id is not in the locked list", () => {
    const r = runWaveBCrossCuttingReviewers({
      candidate: candidate(),
      specialists_to_run: ["nex-not-a-real-specialist"] as never,
    }) as RunWaveBSpecialistsFailure;
    expect(r.kind).toBe("FAILURE");
    expect(r.refusal_code).toBe("WB_UNKNOWN_SPECIALIST");
  });

  it("A-4 · WB_INVALID_REQUEST when specialists_to_run is neither array nor 'all'", () => {
    const r = runWaveBCrossCuttingReviewers({
      candidate: candidate(),
      specialists_to_run: 7 as never,
    }) as RunWaveBSpecialistsFailure;
    expect(r.kind).toBe("FAILURE");
    expect(r.refusal_code).toBe("WB_INVALID_REQUEST");
  });

  it("A-5 · WB_INVALID_CANDIDATE when candidate is missing required fields", () => {
    const r = runWaveBCrossCuttingReviewers({
      candidate: { change_kind: "file_new" } as never,
      specialists_to_run: "all",
    }) as RunWaveBSpecialistsFailure;
    expect(r.kind).toBe("FAILURE");
    expect(r.refusal_code).toBe("WB_INVALID_CANDIDATE");
  });
});

// ── §B · Grep marker ───────────────────────────────────────────────────

describe("§36-WAVE-B · Wave B · §B · grep marker", () => {
  it("B-1 · SUCCESS response carries the locked grep marker", () => {
    const r = runAll(candidate());
    expect(r.grep_marker).toBe(WAVE_B_GREP_MARKER);
    expect(r.grep_marker).toBe("§36-WAVE-B · WAVE-B · 2026-09-15 · wave-b-cross-cutting");
  });

  it("B-2 · FAILURE response carries the locked grep marker", () => {
    const r = runWaveBCrossCuttingReviewers(null as never) as RunWaveBSpecialistsFailure;
    expect(r.grep_marker).toBe(WAVE_B_GREP_MARKER);
  });
});

// ── §C · nex-debugging-specialist ─────────────────────────────────────

describe("§36-WAVE-B · Wave B · §C · nex-debugging-specialist", () => {
  it("C-1 · NDG_CONSOLE_LOG_IN_PRODUCTION emitted for console.log in src/lib", () => {
    const r = runAll(candidate({
      workspace_relative_path: "src/lib/foo/bar.ts",
      proposed_content: "export function f(){ console.log('debug'); }\n",
    }));
    expect(findingIdsOf(r, "nex-debugging-specialist")).toContain("NDG_CONSOLE_LOG_IN_PRODUCTION");
  });

  it("C-2 · NDG_CONSOLE_LOG_IN_PRODUCTION NOT emitted in test files", () => {
    const r = runAll(candidate({
      workspace_relative_path: "src/lib/foo/__tests__/x.test.ts",
      proposed_content: "it('x', () => { console.log('debug'); expect(1).toBe(1); });\n",
    }));
    expect(findingIdsOf(r, "nex-debugging-specialist")).not.toContain("NDG_CONSOLE_LOG_IN_PRODUCTION");
  });

  it("C-3 · NDG_DEBUGGER_STATEMENT emitted", () => {
    const r = runAll(candidate({
      workspace_relative_path: "src/lib/foo/bar.ts",
      proposed_content: "export function f(){ debugger; return 1; }\n",
    }));
    expect(findingIdsOf(r, "nex-debugging-specialist")).toContain("NDG_DEBUGGER_STATEMENT");
  });

  it("C-4 · NDG_UNSILENCED_CATCH emitted for empty catch body", () => {
    const r = runAll(candidate({
      workspace_relative_path: "src/lib/foo/bar.ts",
      proposed_content: "export function f(){ try { g(); } catch (e) {} }\n",
    }));
    expect(findingIdsOf(r, "nex-debugging-specialist")).toContain("NDG_UNSILENCED_CATCH");
  });

  it("C-5 · NDG_BROAD_CATCH_ANY emitted for catch(e: any)", () => {
    const r = runAll(candidate({
      workspace_relative_path: "src/lib/foo/bar.ts",
      proposed_content: "export function f(){ try { g(); } catch (e: any) { console.error(e.message); } }\n",
    }));
    expect(findingIdsOf(r, "nex-debugging-specialist")).toContain("NDG_BROAD_CATCH_ANY");
  });

  it("C-6 · NDG_SWALLOWED_PROMISE emitted", () => {
    const r = runAll(candidate({
      workspace_relative_path: "src/lib/foo/bar.ts",
      proposed_content: "export function f(){ doSomethingAsync().catch(() => {}); }\n",
    }));
    expect(findingIdsOf(r, "nex-debugging-specialist")).toContain("NDG_SWALLOWED_PROMISE");
  });

  it("C-7 · NDG_SHORT_ERROR_MESSAGE emitted for short throw", () => {
    const r = runAll(candidate({
      workspace_relative_path: "src/lib/foo/bar.ts",
      proposed_content: "export function f(){ throw new Error('fail'); }\n",
    }));
    expect(findingIdsOf(r, "nex-debugging-specialist")).toContain("NDG_SHORT_ERROR_MESSAGE");
  });

  it("C-8 · NDG_SHORT_ERROR_MESSAGE NOT emitted when message has real context", () => {
    const r = runAll(candidate({
      workspace_relative_path: "src/lib/foo/bar.ts",
      proposed_content: "export function f(){ throw new Error('foo(): upstream service returned 502 for user 12345'); }\n",
    }));
    expect(findingIdsOf(r, "nex-debugging-specialist")).not.toContain("NDG_SHORT_ERROR_MESSAGE");
  });

  it("C-9 · NDG_UNCONDITIONAL_PROCESS_EXIT emitted in src/lib", () => {
    const r = runAll(candidate({
      workspace_relative_path: "src/lib/foo/bar.ts",
      proposed_content: "export function f(){ if (bad) process.exit(1); }\n",
    }));
    expect(findingIdsOf(r, "nex-debugging-specialist")).toContain("NDG_UNCONDITIONAL_PROCESS_EXIT");
  });

  it("C-10 · clean production file yields no NDG findings", () => {
    const r = runAll(candidate({
      workspace_relative_path: "src/lib/foo/bar.ts",
      proposed_content: "export function f(){ return 1; }\n",
    }));
    expect(findingIdsOf(r, "nex-debugging-specialist")).toEqual([]);
  });
});

// ── §D · nex-git-change-impact-specialist ─────────────────────────────

describe("§36-WAVE-B · Wave B · §D · nex-git-change-impact-specialist", () => {
  it("D-1 · NGI_LARGE_FILE_NEW_1000LINES emitted for >1000 line file_new", () => {
    const lines = Array(1200).fill("// line").join("\n");
    const r = runAll(candidate({
      workspace_relative_path: "src/lib/foo/big.ts",
      change_kind: "file_new",
      proposed_content: lines,
    }));
    expect(findingIdsOf(r, "nex-git-change-impact-specialist")).toContain("NGI_LARGE_FILE_NEW_1000LINES");
  });

  it("D-2 · NGI_LARGE_FILE_NEW_1000LINES NOT emitted for small file_new", () => {
    const r = runAll(candidate({
      workspace_relative_path: "src/lib/foo/small.ts",
      change_kind: "file_new",
      proposed_content: "export const x = 1;\n",
    }));
    expect(findingIdsOf(r, "nex-git-change-impact-specialist")).not.toContain("NGI_LARGE_FILE_NEW_1000LINES");
  });

  it("D-3 · NGI_FILE_DELETE_OP emitted on any file_delete", () => {
    const r = runAll(candidate({
      workspace_relative_path: "src/lib/foo/bar.ts",
      change_kind: "file_delete",
      proposed_content: null,
    }));
    expect(findingIdsOf(r, "nex-git-change-impact-specialist")).toContain("NGI_FILE_DELETE_OP");
  });

  it("D-4 · NGI_TOUCHES_PROTECTED_MODULE emitted for skills/ file_content", () => {
    const r = runAll(candidate({
      workspace_relative_path: "src/lib/nex-agent-runtime/skills/skill-schema.ts",
      change_kind: "file_content",
      proposed_content: "// changed\n",
    }));
    expect(findingIdsOf(r, "nex-git-change-impact-specialist")).toContain("NGI_TOUCHES_PROTECTED_MODULE");
  });

  it("D-5 · NGI_TOUCHES_PROTECTED_MODULE NOT emitted for file_new in same module", () => {
    const r = runAll(candidate({
      workspace_relative_path: "src/lib/nex-agent-runtime/skills/new-thing.ts",
      change_kind: "file_new",
      proposed_content: "// new\n",
    }));
    expect(findingIdsOf(r, "nex-git-change-impact-specialist")).not.toContain("NGI_TOUCHES_PROTECTED_MODULE");
  });

  it("D-6 · NGI_TEST_FILE_WITHOUT_KNOWN_SOURCE emitted for new .test.ts", () => {
    const r = runAll(candidate({
      workspace_relative_path: "src/lib/foo/__tests__/x.test.ts",
      change_kind: "file_new",
      proposed_content: "import { it, expect } from 'vitest';\nit('x', () => { expect(1).toBe(1); });\n",
    }));
    expect(findingIdsOf(r, "nex-git-change-impact-specialist")).toContain("NGI_TEST_FILE_WITHOUT_KNOWN_SOURCE");
  });

  it("D-7 · NGI_SOURCE_WITHOUT_TEST_HINT emitted for new lib source", () => {
    const r = runAll(candidate({
      workspace_relative_path: "src/lib/foo/bar.ts",
      change_kind: "file_new",
      proposed_content: "export const x = 1;\n",
    }));
    expect(findingIdsOf(r, "nex-git-change-impact-specialist")).toContain("NGI_SOURCE_WITHOUT_TEST_HINT");
  });

  it("D-8 · NGI_SOURCE_WITHOUT_TEST_HINT NOT emitted for -types.ts", () => {
    const r = runAll(candidate({
      workspace_relative_path: "src/lib/foo/bar-types.ts",
      change_kind: "file_new",
      proposed_content: "export type X = 1;\n",
    }));
    expect(findingIdsOf(r, "nex-git-change-impact-specialist")).not.toContain("NGI_SOURCE_WITHOUT_TEST_HINT");
  });

  it("D-9 · NGI_CROSS_MODULE_FANOUT emitted with 3+ distinct src/lib modules", () => {
    const r = runAll(candidate({
      workspace_relative_path: "src/lib/foo/bar.ts",
      imported_from_specifiers: [
        "C:/repo/src/lib/mod-a/index.ts",
        "C:/repo/src/lib/mod-b/thing.ts",
        "C:/repo/src/lib/mod-c/other.ts",
      ],
    }));
    expect(findingIdsOf(r, "nex-git-change-impact-specialist")).toContain("NGI_CROSS_MODULE_FANOUT");
  });

  it("D-10 · NGI_MIGRATION_MODIFIED_IN_PLACE emitted", () => {
    const r = runAll(candidate({
      workspace_relative_path: "db/migrations/2025_01_15_users.sql",
      change_kind: "file_content",
      proposed_content: "ALTER TABLE users ADD COLUMN nope BOOLEAN;\n",
    }));
    expect(findingIdsOf(r, "nex-git-change-impact-specialist")).toContain("NGI_MIGRATION_MODIFIED_IN_PLACE");
  });

  it("D-11 · clean new source in non-lib location yields no NGI findings", () => {
    const r = runAll(candidate({
      workspace_relative_path: "src/app/foo/page.tsx",
      change_kind: "file_new",
      proposed_content: "export default function P(){ return null; }\n",
    }));
    expect(findingIdsOf(r, "nex-git-change-impact-specialist")).toEqual([]);
  });
});

// ── §E · nex-security-specialist ──────────────────────────────────────

describe("§36-WAVE-B · Wave B · §E · nex-security-specialist", () => {
  it("E-1 · NSE_HARDCODED_SECRET_LOOKALIKE emitted for sk- literal", () => {
    const r = runAll(candidate({
      workspace_relative_path: "src/lib/foo/bar.ts",
      proposed_content: "const KEY = 'sk-abcdefghijklmnopqrstuvwxyz123456';\n",
    }));
    expect(findingIdsOf(r, "nex-security-specialist")).toContain("NSE_HARDCODED_SECRET_LOOKALIKE");
  });

  it("E-2 · NSE_HARDCODED_SECRET_LOOKALIKE emitted for 32+ hex", () => {
    const r = runAll(candidate({
      workspace_relative_path: "src/lib/foo/bar.ts",
      proposed_content: "const H = 'deadbeefdeadbeefdeadbeefdeadbeef01';\n",
    }));
    expect(findingIdsOf(r, "nex-security-specialist")).toContain("NSE_HARDCODED_SECRET_LOOKALIKE");
  });

  it("E-3 · NSE_EVAL_LIKE_EXECUTION emitted for eval(", () => {
    const r = runAll(candidate({
      workspace_relative_path: "src/lib/foo/bar.ts",
      proposed_content: "export function f(s: string){ return eval(s); }\n",
    }));
    expect(findingIdsOf(r, "nex-security-specialist")).toContain("NSE_EVAL_LIKE_EXECUTION");
  });

  it("E-4 · NSE_EVAL_LIKE_EXECUTION emitted for new Function(", () => {
    const r = runAll(candidate({
      workspace_relative_path: "src/lib/foo/bar.ts",
      proposed_content: "export function f(s: string){ return new Function(s)(); }\n",
    }));
    expect(findingIdsOf(r, "nex-security-specialist")).toContain("NSE_EVAL_LIKE_EXECUTION");
  });

  it("E-5 · NSE_UNSAFE_HTML_INSERTION emitted without sanitiser", () => {
    const r = runAll(candidate({
      workspace_relative_path: "src/app/foo/Comp.tsx",
      proposed_content: "export const C = ({ html }: { html: string }) => <div dangerouslySetInnerHTML={{ __html: html }}/>;\n",
    }));
    expect(findingIdsOf(r, "nex-security-specialist")).toContain("NSE_UNSAFE_HTML_INSERTION");
  });

  it("E-6 · NSE_UNSAFE_HTML_INSERTION NOT emitted when DOMPurify present", () => {
    const r = runAll(candidate({
      workspace_relative_path: "src/app/foo/Comp.tsx",
      proposed_content: "import DOMPurify from 'dompurify';\nexport const C = ({ html }: { html: string }) => <div dangerouslySetInnerHTML={{ __html: DOMPurify.sanitize(html) }}/>;\n",
    }));
    expect(findingIdsOf(r, "nex-security-specialist")).not.toContain("NSE_UNSAFE_HTML_INSERTION");
  });

  it("E-7 · NSE_UNVALIDATED_REDIRECT emitted", () => {
    const r = runAll(candidate({
      workspace_relative_path: "src/app/api/foo/route.ts",
      proposed_content: "import { redirect } from 'next/navigation';\nexport function GET(req: Request){ const target = 'x'; redirect(target); }\n",
    }));
    expect(findingIdsOf(r, "nex-security-specialist")).toContain("NSE_UNVALIDATED_REDIRECT");
  });

  it("E-8 · NSE_SQL_STRING_CONCATENATION emitted", () => {
    const r = runAll(candidate({
      workspace_relative_path: "src/lib/foo/bar.ts",
      proposed_content: "export function q(id: string){ return `SELECT * FROM users WHERE id = ${id}`; }\n",
    }));
    expect(findingIdsOf(r, "nex-security-specialist")).toContain("NSE_SQL_STRING_CONCATENATION");
  });

  it("E-9 · NSE_PATH_TRAVERSAL_LITERAL emitted", () => {
    const r = runAll(candidate({
      workspace_relative_path: "src/lib/foo/bar.ts",
      proposed_content: "import path from 'node:path';\nexport function f(name: string){ return path.join('/data', `${name}.json`); }\n",
    }));
    expect(findingIdsOf(r, "nex-security-specialist")).toContain("NSE_PATH_TRAVERSAL_LITERAL");
  });

  it("E-10 · NSE_DISABLED_TLS emitted for rejectUnauthorized:false", () => {
    const r = runAll(candidate({
      workspace_relative_path: "src/lib/foo/bar.ts",
      proposed_content: "const agent = new Agent({ rejectUnauthorized: false });\n",
    }));
    expect(findingIdsOf(r, "nex-security-specialist")).toContain("NSE_DISABLED_TLS");
  });

  it("E-11 · clean code yields no NSE findings", () => {
    const r = runAll(candidate({
      workspace_relative_path: "src/lib/foo/bar.ts",
      proposed_content: "export function f(x: number){ return x + 1; }\n",
    }));
    expect(findingIdsOf(r, "nex-security-specialist")).toEqual([]);
  });
});

// ── §F · nex-playwright-engineering ───────────────────────────────────

describe("§36-WAVE-B · Wave B · §F · nex-playwright-engineering", () => {
  it("F-1 · NPW_MISSING_AWAIT_ON_ACTION emitted", () => {
    const r = runAll(candidate({
      workspace_relative_path: "tests/e2e/login.spec.ts",
      proposed_content: `import { test, expect } from '@playwright/test';\ntest('login', async ({ page }) => { page.click('#go'); await expect(page).toHaveURL(/ok/); });\n`,
    }));
    expect(findingIdsOf(r, "nex-playwright-engineering")).toContain("NPW_MISSING_AWAIT_ON_ACTION");
  });

  it("F-2 · NPW_MISSING_AWAIT_ON_ACTION NOT emitted when properly awaited", () => {
    const r = runAll(candidate({
      workspace_relative_path: "tests/e2e/login.spec.ts",
      proposed_content: `import { test, expect } from '@playwright/test';\ntest.beforeEach(async ({ page }) => { await page.goto('/'); });\ntest('login', async ({ page }) => { await page.click('#go'); await expect(page).toHaveURL(/ok/); });\n`,
    }));
    expect(findingIdsOf(r, "nex-playwright-engineering")).not.toContain("NPW_MISSING_AWAIT_ON_ACTION");
  });

  it("F-3 · NPW_HARDCODED_LARGE_TIMEOUT emitted for 5s+", () => {
    const r = runAll(candidate({
      workspace_relative_path: "tests/e2e/wait.spec.ts",
      proposed_content: `import { test, expect } from '@playwright/test';\ntest.beforeEach(async ({ page }) => { await page.goto('/'); });\ntest('wait', async ({ page }) => { await page.waitForTimeout(8000); await expect(page).toBeVisible; });\n`,
    }));
    expect(findingIdsOf(r, "nex-playwright-engineering")).toContain("NPW_HARDCODED_LARGE_TIMEOUT");
  });

  it("F-4 · NPW_HARDCODED_LARGE_TIMEOUT NOT emitted for small timeout", () => {
    const r = runAll(candidate({
      workspace_relative_path: "tests/e2e/wait.spec.ts",
      proposed_content: `import { test } from '@playwright/test';\ntest.beforeEach(async ({ page }) => { await page.goto('/'); });\ntest('short wait', async ({ page }) => { await page.waitForTimeout(200); });\n`,
    }));
    expect(findingIdsOf(r, "nex-playwright-engineering")).not.toContain("NPW_HARDCODED_LARGE_TIMEOUT");
  });

  it("F-5 · NPW_GETBYTEXT_WITHOUT_ROLE emitted", () => {
    const r = runAll(candidate({
      workspace_relative_path: "tests/e2e/find.spec.ts",
      proposed_content: `import { test, expect } from '@playwright/test';\ntest.beforeEach(async ({ page }) => { await page.goto('/'); });\ntest('find', async ({ page }) => { await page.getByText('Submit').click(); await expect(page.getByText('OK')).toBeVisible(); });\n`,
    }));
    expect(findingIdsOf(r, "nex-playwright-engineering")).toContain("NPW_GETBYTEXT_WITHOUT_ROLE");
  });

  it("F-6 · NPW_SCREENSHOT_WITHOUT_ASSERTION emitted", () => {
    const r = runAll(candidate({
      workspace_relative_path: "tests/e2e/shot.spec.ts",
      proposed_content: `import { test, expect } from '@playwright/test';\ntest.beforeEach(async ({ page }) => { await page.goto('/'); });\ntest('shot', async ({ page }) => { await page.getByRole('button').click(); await page.screenshot({ path: 'x.png' }); expect(true).toBe(true); });\n`,
    }));
    expect(findingIdsOf(r, "nex-playwright-engineering")).toContain("NPW_SCREENSHOT_WITHOUT_ASSERTION");
  });

  it("F-7 · NPW_TEST_NAME_MENTIONS_LOCALHOST emitted", () => {
    const r = runAll(candidate({
      workspace_relative_path: "tests/e2e/host.spec.ts",
      proposed_content: `import { test, expect } from '@playwright/test';\ntest.beforeEach(async ({ page }) => { await page.goto('/'); });\ntest('open localhost dashboard', async ({ page }) => { await expect(page.getByRole('heading')).toBeVisible(); });\n`,
    }));
    expect(findingIdsOf(r, "nex-playwright-engineering")).toContain("NPW_TEST_NAME_MENTIONS_LOCALHOST");
  });

  it("F-8 · NPW_TEST_SKIP_OR_FIXME_LEFT_IN emitted for test.skip", () => {
    const r = runAll(candidate({
      workspace_relative_path: "tests/e2e/skip.spec.ts",
      proposed_content: `import { test, expect } from '@playwright/test';\ntest.beforeEach(async ({ page }) => { await page.goto('/'); });\ntest.skip('todo', async ({ page }) => { await expect(page.getByRole('button')).toBeVisible(); });\n`,
    }));
    expect(findingIdsOf(r, "nex-playwright-engineering")).toContain("NPW_TEST_SKIP_OR_FIXME_LEFT_IN");
  });

  it("F-9 · NPW_NO_PAGE_INITIALIZER emitted when page used without setup", () => {
    const r = runAll(candidate({
      workspace_relative_path: "tests/e2e/no-setup.spec.ts",
      proposed_content: `import { test, expect } from '@playwright/test';\ntest('bare', async ({ page }) => { await page.goto('/'); await expect(page.getByRole('button')).toBeVisible(); });\n`,
    }));
    expect(findingIdsOf(r, "nex-playwright-engineering")).toContain("NPW_NO_PAGE_INITIALIZER");
  });

  it("F-10 · non-playwright test file yields no NPW findings", () => {
    const r = runAll(candidate({
      workspace_relative_path: "src/lib/foo/__tests__/x.test.ts",
      proposed_content: `import { describe, it, expect } from 'vitest';\ndescribe('x', () => { it('y', () => { expect(1).toBe(1); }); });\n`,
    }));
    expect(findingIdsOf(r, "nex-playwright-engineering")).toEqual([]);
  });

  it("F-11 · clean playwright test yields no NPW findings", () => {
    const r = runAll(candidate({
      workspace_relative_path: "tests/e2e/clean.spec.ts",
      proposed_content: `import { test, expect } from '@playwright/test';\ntest.beforeEach(async ({ page }) => { await page.goto('/'); });\ntest('clean', async ({ page }) => { await page.getByRole('button', { name: 'Go' }).click(); await expect(page.getByRole('heading')).toBeVisible(); });\n`,
    }));
    expect(findingIdsOf(r, "nex-playwright-engineering")).toEqual([]);
  });
});

// ── §G · Determinism ──────────────────────────────────────────────────

describe("§36-WAVE-B · Wave B · §G · determinism", () => {
  it("G-1 · same input yields identical output", () => {
    const input = candidate({
      workspace_relative_path: "src/lib/foo/bar.ts",
      change_kind: "file_new",
      proposed_content: "export function f(){ try { g(); } catch(e){} console.log('x'); throw new Error('bad'); }\n",
    });
    const a = runAll(input);
    const b = runAll(input);
    expect(JSON.stringify(a.per_specialist)).toBe(JSON.stringify(b.per_specialist));
    expect(a.total_findings).toBe(b.total_findings);
    expect(a.overall_verdict).toBe(b.overall_verdict);
  });
});

// ── §H · Severity map exhaustive ──────────────────────────────────────

describe("§36-WAVE-B · Wave B · §H · severity map exhaustive", () => {
  it("H-1 · every finding_id in the union has a locked severity mapping", () => {
    for (const key of Object.keys(WAVE_B_FINDING_ID_SEVERITY_MAP)) {
      const sev = (WAVE_B_FINDING_ID_SEVERITY_MAP as Record<string, string>)[key];
      expect(["advisory", "warning", "critical"]).toContain(sev);
    }
    expect(Object.keys(WAVE_B_FINDING_ID_SEVERITY_MAP).length).toBeGreaterThanOrEqual(28);
  });

  it("H-2 · all 4 specialists exist in the locked WAVE_B_SPECIALIST_IDS array", () => {
    expect(WAVE_B_SPECIALIST_IDS).toEqual([
      "nex-debugging-specialist",
      "nex-git-change-impact-specialist",
      "nex-security-specialist",
      "nex-playwright-engineering",
    ]);
  });
});

// ── §I · Full integration ─────────────────────────────────────────────

describe("§36-WAVE-B · Wave B · §I · full integration", () => {
  it("I-1 · all 4 specialists appear in per_specialist result when specialists_to_run='all'", () => {
    const r = runAll(candidate({
      workspace_relative_path: "docs/README.md",
      proposed_content: "# doc\n",
    }));
    const ids = r.per_specialist.map((p) => p.specialist_id).sort();
    expect(ids).toEqual([
      "nex-debugging-specialist",
      "nex-git-change-impact-specialist",
      "nex-playwright-engineering",
      "nex-security-specialist",
    ]);
  });

  it("I-2 · overall_verdict === 'action_required' when any critical present", () => {
    const r = runAll(candidate({
      workspace_relative_path: "src/lib/foo/bar.ts",
      proposed_content: "debugger;\n",
    }));
    expect(r.overall_verdict).toBe("action_required");
    expect(r.critical_count).toBeGreaterThanOrEqual(1);
  });

  it("I-3 · overall_verdict === 'advisory_only' when only advisories present", () => {
    // console.log alone is advisory
    const r = runAll(candidate({
      workspace_relative_path: "src/lib/foo/bar-types.ts",
      change_kind: "file_new",
      proposed_content: "export type X = 1;\nconsole.log('meta');\n",
    }));
    expect(r.overall_verdict).toBe("advisory_only");
  });

  it("I-4 · overall_verdict === 'no_findings' when nothing matches", () => {
    const r = runAll(candidate({
      workspace_relative_path: "docs/README.md",
      proposed_content: "# clean\n",
    }));
    expect(r.overall_verdict).toBe("no_findings");
    expect(r.total_findings).toBe(0);
  });

  it("I-5 · specialists_to_run subset returns only requested specialists", () => {
    const r = runWaveBCrossCuttingReviewers({
      candidate: candidate(),
      specialists_to_run: ["nex-security-specialist", "nex-playwright-engineering"],
    }) as RunWaveBSpecialistsSuccess;
    expect(r.kind).toBe("SUCCESS");
    const ids = r.per_specialist.map((p) => p.specialist_id).sort();
    expect(ids).toEqual(["nex-playwright-engineering", "nex-security-specialist"]);
  });
});
