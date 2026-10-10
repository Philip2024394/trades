// §36-WAVE-A · WAVE-A · 2026-09-15 · wave-a-language-framework
// NEX bounded infrastructure · Wave A specialist reviewer tests · 2026-09-15

import { describe, expect, it } from "vitest";
import { runWaveALanguageFrameworkReviewers } from "../wave-a-language-framework";
import type {
  RunWaveASpecialistsFailure,
  RunWaveASpecialistsSuccess,
  WaveASpecialistFindingId,
  WaveASpecialistId,
} from "../wave-a-language-framework-types";
import {
  WAVE_A_FINDING_ID_SEVERITY_MAP,
  WAVE_A_GREP_MARKER,
  WAVE_A_SPECIALIST_IDS,
} from "../wave-a-language-framework-types";
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

function findingIdsOf(r: RunWaveASpecialistsSuccess, id: WaveASpecialistId): WaveASpecialistFindingId[] {
  const entry = r.per_specialist.find((p) => p.specialist_id === id);
  return entry ? entry.findings.map((f) => f.finding_id) : [];
}

function runAll(c: SkillCandidate): RunWaveASpecialistsSuccess {
  const r = runWaveALanguageFrameworkReviewers({ candidate: c, specialists_to_run: "all" });
  expect(r.kind).toBe("SUCCESS");
  return r as RunWaveASpecialistsSuccess;
}

// ── §A · Refusal codes ─────────────────────────────────────────────────

describe("§36-WAVE-A · Wave A · §A · refusal codes", () => {
  it("A-1 · WA_INVALID_REQUEST when request is null", () => {
    const r = runWaveALanguageFrameworkReviewers(null as never) as RunWaveASpecialistsFailure;
    expect(r.kind).toBe("FAILURE");
    expect(r.refusal_code).toBe("WA_INVALID_REQUEST");
  });

  it("A-2 · WA_INVALID_CANDIDATE when candidate is missing", () => {
    const r = runWaveALanguageFrameworkReviewers({
      candidate: null as never,
      specialists_to_run: "all",
    }) as RunWaveASpecialistsFailure;
    expect(r.kind).toBe("FAILURE");
    expect(r.refusal_code).toBe("WA_INVALID_CANDIDATE");
  });

  it("A-3 · WA_UNKNOWN_SPECIALIST when a specialist_id is not in the locked list", () => {
    const r = runWaveALanguageFrameworkReviewers({
      candidate: candidate(),
      specialists_to_run: ["not-a-real-specialist"] as never,
    }) as RunWaveASpecialistsFailure;
    expect(r.kind).toBe("FAILURE");
    expect(r.refusal_code).toBe("WA_UNKNOWN_SPECIALIST");
    expect(r.offending_specialist).toBe("not-a-real-specialist");
  });

  it("A-4 · WA_INVALID_REQUEST when specialists_to_run is neither array nor 'all'", () => {
    const r = runWaveALanguageFrameworkReviewers({
      candidate: candidate(),
      specialists_to_run: 42 as never,
    }) as RunWaveASpecialistsFailure;
    expect(r.kind).toBe("FAILURE");
    expect(r.refusal_code).toBe("WA_INVALID_REQUEST");
  });

  it("A-5 · WA_INVALID_CANDIDATE when candidate is missing required fields", () => {
    const r = runWaveALanguageFrameworkReviewers({
      candidate: { workspace_relative_path: 42 } as never,
      specialists_to_run: "all",
    }) as RunWaveASpecialistsFailure;
    expect(r.kind).toBe("FAILURE");
    expect(r.refusal_code).toBe("WA_INVALID_CANDIDATE");
  });
});

// ── §B · Grep marker ───────────────────────────────────────────────────

describe("§36-WAVE-A · Wave A · §B · grep marker", () => {
  it("B-1 · SUCCESS response carries the locked grep marker", () => {
    const r = runAll(candidate());
    expect(r.grep_marker).toBe(WAVE_A_GREP_MARKER);
    expect(r.grep_marker).toBe("§36-WAVE-A · WAVE-A · 2026-09-15 · wave-a-language-framework");
  });

  it("B-2 · FAILURE response carries the locked grep marker", () => {
    const r = runWaveALanguageFrameworkReviewers(null as never) as RunWaveASpecialistsFailure;
    expect(r.grep_marker).toBe(WAVE_A_GREP_MARKER);
  });
});

// ── §C · nex-typescript-engineering ────────────────────────────────────

describe("§36-WAVE-A · Wave A · §C · nex-typescript-engineering", () => {
  it("C-1 · NTS_TS_IGNORE_COMMENT emitted when @ts-ignore present", () => {
    const r = runAll(candidate({
      workspace_relative_path: "src/lib/example/foo.ts",
      proposed_content: "// @ts-ignore\nconst x: number = 'oops' as any;\n",
    }));
    expect(findingIdsOf(r, "nex-typescript-engineering")).toContain("NTS_TS_IGNORE_COMMENT");
  });

  it("C-2 · NTS_TS_EXPECT_ERROR_UNJUSTIFIED emitted when justification absent", () => {
    const r = runAll(candidate({
      workspace_relative_path: "src/lib/example/foo.ts",
      proposed_content: "// @ts-expect-error\nconst y: string = 42;\n",
    }));
    expect(findingIdsOf(r, "nex-typescript-engineering")).toContain("NTS_TS_EXPECT_ERROR_UNJUSTIFIED");
  });

  it("C-3 · NTS_TS_EXPECT_ERROR_UNJUSTIFIED NOT emitted when justification present", () => {
    const r = runAll(candidate({
      workspace_relative_path: "src/lib/example/foo.ts",
      proposed_content: "// @ts-expect-error -- upstream types are wrong until v5.2\nconst y: string = 42 as unknown as string;\n",
    }));
    expect(findingIdsOf(r, "nex-typescript-engineering")).not.toContain("NTS_TS_EXPECT_ERROR_UNJUSTIFIED");
  });

  it("C-4 · NTS_TS_NOCHECK emitted when @ts-nocheck present", () => {
    const r = runAll(candidate({
      workspace_relative_path: "src/lib/example/foo.ts",
      proposed_content: "// @ts-nocheck\nexport const bad = true;\n",
    }));
    expect(findingIdsOf(r, "nex-typescript-engineering")).toContain("NTS_TS_NOCHECK");
  });

  it("C-5 · NTS_ENUM_DECLARATION emitted", () => {
    const r = runAll(candidate({
      workspace_relative_path: "src/lib/example/foo.ts",
      proposed_content: "export enum Color { Red, Green, Blue }\n",
    }));
    expect(findingIdsOf(r, "nex-typescript-engineering")).toContain("NTS_ENUM_DECLARATION");
  });

  it("C-6 · NTS_NAMESPACE_DECLARATION emitted", () => {
    const r = runAll(candidate({
      workspace_relative_path: "src/lib/example/foo.ts",
      proposed_content: "export namespace Legacy { export const x = 1; }\n",
    }));
    expect(findingIdsOf(r, "nex-typescript-engineering")).toContain("NTS_NAMESPACE_DECLARATION");
  });

  it("C-7 · NTS_NON_NULL_ASSERTION_CHAIN emitted for a!.b!.c pattern", () => {
    const r = runAll(candidate({
      workspace_relative_path: "src/lib/example/foo.ts",
      proposed_content: "const n = obj!.child!.value;\n",
    }));
    expect(findingIdsOf(r, "nex-typescript-engineering")).toContain("NTS_NON_NULL_ASSERTION_CHAIN");
  });

  it("C-8 · NTS_UNTYPED_JSON_PARSE emitted when no as-cast", () => {
    const r = runAll(candidate({
      workspace_relative_path: "src/lib/example/foo.ts",
      proposed_content: "const data = JSON.parse(raw);\n",
    }));
    expect(findingIdsOf(r, "nex-typescript-engineering")).toContain("NTS_UNTYPED_JSON_PARSE");
  });

  it("C-9 · NTS_UNTYPED_JSON_PARSE NOT emitted when as-cast present", () => {
    const r = runAll(candidate({
      workspace_relative_path: "src/lib/example/foo.ts",
      proposed_content: "const data = JSON.parse(raw) as MyType;\n",
    }));
    expect(findingIdsOf(r, "nex-typescript-engineering")).not.toContain("NTS_UNTYPED_JSON_PARSE");
  });

  it("C-10 · NTS_DEEP_MODULE_RELATIVE_5PLUS emitted for 5+ ..", () => {
    const r = runAll(candidate({
      workspace_relative_path: "src/lib/example/foo.ts",
      proposed_content: "import { thing } from '../../../../../deep';\n",
    }));
    expect(findingIdsOf(r, "nex-typescript-engineering")).toContain("NTS_DEEP_MODULE_RELATIVE_5PLUS");
  });

  it("C-11 · specialist emits nothing on non-TS files", () => {
    const r = runAll(candidate({
      workspace_relative_path: "src/lib/example/foo.md",
      proposed_content: "# @ts-ignore does not count here\n",
    }));
    expect(findingIdsOf(r, "nex-typescript-engineering")).toEqual([]);
  });

  it("C-12 · clean TS file yields no NTS findings", () => {
    const r = runAll(candidate({
      workspace_relative_path: "src/lib/example/foo.ts",
      proposed_content: "export const clean: number = 1;\n",
    }));
    expect(findingIdsOf(r, "nex-typescript-engineering")).toEqual([]);
  });
});

// ── §D · nex-react-engineering ────────────────────────────────────────

describe("§36-WAVE-A · Wave A · §D · nex-react-engineering", () => {
  it("D-1 · NRX_INDEX_AS_KEY emitted", () => {
    const r = runAll(candidate({
      workspace_relative_path: "src/app/example/Comp.tsx",
      proposed_content: "import { useState } from 'react';\nexport const C = () => items.map((it, index) => <div key={index}>{it}</div>);\n",
    }));
    expect(findingIdsOf(r, "nex-react-engineering")).toContain("NRX_INDEX_AS_KEY");
  });

  it("D-2 · NRX_MAP_WITHOUT_KEY emitted", () => {
    const r = runAll(candidate({
      workspace_relative_path: "src/app/example/Comp.tsx",
      proposed_content: "import 'react';\nexport const C = () => items.map((it) => <div>{it}</div>);\n",
    }));
    expect(findingIdsOf(r, "nex-react-engineering")).toContain("NRX_MAP_WITHOUT_KEY");
  });

  it("D-3 · NRX_MAP_WITHOUT_KEY NOT emitted when key is present", () => {
    const r = runAll(candidate({
      workspace_relative_path: "src/app/example/Comp.tsx",
      proposed_content: "import 'react';\nexport const C = () => items.map((it) => <div key={it.id}>{it}</div>);\n",
    }));
    expect(findingIdsOf(r, "nex-react-engineering")).not.toContain("NRX_MAP_WITHOUT_KEY");
  });

  it("D-4 · NRX_DIRECT_STATE_MUTATION emitted for state.push", () => {
    const r = runAll(candidate({
      workspace_relative_path: "src/app/example/Comp.tsx",
      proposed_content: "import 'react';\nfunction f() { state.push(1); }\n",
    }));
    expect(findingIdsOf(r, "nex-react-engineering")).toContain("NRX_DIRECT_STATE_MUTATION");
  });

  it("D-5 · NRX_USEEFFECT_NO_CLEANUP_SUBSCRIPTION emitted", () => {
    const r = runAll(candidate({
      workspace_relative_path: "src/app/example/Comp.tsx",
      proposed_content: `import { useEffect } from 'react';
useEffect(() => {
  window.addEventListener('resize', onResize);
}, []);\n`,
    }));
    expect(findingIdsOf(r, "nex-react-engineering")).toContain("NRX_USEEFFECT_NO_CLEANUP_SUBSCRIPTION");
  });

  it("D-6 · NRX_INLINE_STYLE_OBJECT_IN_LOOP emitted", () => {
    const r = runAll(candidate({
      workspace_relative_path: "src/app/example/Comp.tsx",
      proposed_content: "import 'react';\nitems.map((it) => <div style={{ color: 'red' }}>{it}</div>);\n",
    }));
    expect(findingIdsOf(r, "nex-react-engineering")).toContain("NRX_INLINE_STYLE_OBJECT_IN_LOOP");
  });

  it("D-7 · NRX_ANONYMOUS_HANDLER_IN_MAP emitted", () => {
    const r = runAll(candidate({
      workspace_relative_path: "src/app/example/Comp.tsx",
      proposed_content: "import 'react';\nitems.map((it) => <button key={it.id} onClick={() => act(it)}>x</button>);\n",
    }));
    expect(findingIdsOf(r, "nex-react-engineering")).toContain("NRX_ANONYMOUS_HANDLER_IN_MAP");
  });

  it("D-8 · NRX_EAGER_USESTATE_INIT emitted", () => {
    const r = runAll(candidate({
      workspace_relative_path: "src/app/example/Comp.tsx",
      proposed_content: "import { useState } from 'react';\nconst [x, setX] = useState(computeExpensiveInitial());\n",
    }));
    expect(findingIdsOf(r, "nex-react-engineering")).toContain("NRX_EAGER_USESTATE_INIT");
  });

  it("D-9 · NRX_EAGER_USESTATE_INIT NOT emitted with lazy init", () => {
    const r = runAll(candidate({
      workspace_relative_path: "src/app/example/Comp.tsx",
      proposed_content: "import { useState } from 'react';\nconst [x, setX] = useState(() => computeExpensiveInitial());\n",
    }));
    expect(findingIdsOf(r, "nex-react-engineering")).not.toContain("NRX_EAGER_USESTATE_INIT");
  });

  it("D-10 · specialist emits nothing on non-React files", () => {
    const r = runAll(candidate({
      workspace_relative_path: "src/lib/plain.ts",
      proposed_content: "items.map((it, index) => ({ key: index }));\n",
    }));
    expect(findingIdsOf(r, "nex-react-engineering")).toEqual([]);
  });

  it("D-11 · clean React file yields no NRX findings", () => {
    const r = runAll(candidate({
      workspace_relative_path: "src/app/example/Comp.tsx",
      proposed_content: `"use client";\nimport { useState } from "react";\nexport function C() { const [n] = useState(() => 0); return <span>{n}</span>; }\n`,
    }));
    expect(findingIdsOf(r, "nex-react-engineering")).toEqual([]);
  });
});

// ── §E · nex-nextjs-engineering ───────────────────────────────────────

describe("§36-WAVE-A · Wave A · §E · nex-nextjs-engineering", () => {
  it("E-1 · NNX_SERVER_COMPONENT_WITH_CLIENT_HOOK emitted", () => {
    const r = runAll(candidate({
      workspace_relative_path: "src/app/foo/page.tsx",
      proposed_content: "import { useState } from 'react';\nexport default function P(){ const [x, setX] = useState(0); return <div/>; }\n",
    }));
    expect(findingIdsOf(r, "nex-nextjs-engineering")).toContain("NNX_SERVER_COMPONENT_WITH_CLIENT_HOOK");
  });

  it("E-2 · NNX_API_ROUTE_NO_ERROR_SHAPE emitted", () => {
    const r = runAll(candidate({
      workspace_relative_path: "src/app/api/foo/route.ts",
      proposed_content: "export async function GET() { return Response.json({ ok: true }); }\n",
    }));
    expect(findingIdsOf(r, "nex-nextjs-engineering")).toContain("NNX_API_ROUTE_NO_ERROR_SHAPE");
  });

  it("E-3 · NNX_UNVALIDATED_SEARCHPARAMS emitted", () => {
    const r = runAll(candidate({
      workspace_relative_path: "src/app/foo/page.tsx",
      proposed_content: "export default function P({ searchParams }: { searchParams: URLSearchParams }) { return <div>{String(searchParams)}</div>; }\n",
    }));
    expect(findingIdsOf(r, "nex-nextjs-engineering")).toContain("NNX_UNVALIDATED_SEARCHPARAMS");
  });

  it("E-4 · NNX_METADATA_EXPORT_IN_CLIENT_COMPONENT emitted", () => {
    const r = runAll(candidate({
      workspace_relative_path: "src/app/foo/page.tsx",
      proposed_content: `"use client";\nexport const metadata = { title: 'x' };\nexport default function P(){ return <div/>; }\n`,
    }));
    expect(findingIdsOf(r, "nex-nextjs-engineering")).toContain("NNX_METADATA_EXPORT_IN_CLIENT_COMPONENT");
  });

  it("E-5 · NNX_HARDCODED_HTTP_URL emitted", () => {
    const r = runAll(candidate({
      workspace_relative_path: "src/app/api/foo/route.ts",
      proposed_content: "export const runtime = 'nodejs';\nexport async function GET(){ const u = 'https://third-party.example.com/x'; return Response.json({ error: 'x', u }); }\n",
    }));
    expect(findingIdsOf(r, "nex-nextjs-engineering")).toContain("NNX_HARDCODED_HTTP_URL");
  });

  it("E-6 · NNX_MISSING_ROUTE_RUNTIME_DECL emitted", () => {
    const r = runAll(candidate({
      workspace_relative_path: "src/app/api/foo/route.ts",
      proposed_content: "export async function GET(){ return Response.json({ error: null }); }\n",
    }));
    expect(findingIdsOf(r, "nex-nextjs-engineering")).toContain("NNX_MISSING_ROUTE_RUNTIME_DECL");
  });

  it("E-7 · NNX_USE_CLIENT_IN_LAYOUT emitted", () => {
    const r = runAll(candidate({
      workspace_relative_path: "src/app/foo/layout.tsx",
      proposed_content: `"use client";\nimport { ReactNode } from 'react';\nexport default function Layout({ children }: { children: ReactNode }){ return <div>{children}</div>; }\n`,
    }));
    expect(findingIdsOf(r, "nex-nextjs-engineering")).toContain("NNX_USE_CLIENT_IN_LAYOUT");
  });

  it("E-8 · specialist emits nothing on non-App-Router files", () => {
    const r = runAll(candidate({
      workspace_relative_path: "src/lib/plain.ts",
      proposed_content: "export const runtime = 'nodejs';\n",
    }));
    expect(findingIdsOf(r, "nex-nextjs-engineering")).toEqual([]);
  });

  it("E-9 · clean API route with error shape and runtime yields no NNX findings", () => {
    const r = runAll(candidate({
      workspace_relative_path: "src/app/api/clean/route.ts",
      proposed_content: `export const runtime = 'nodejs';\nexport async function POST(){ const error = null; return Response.json({ error, ok: true }); }\n`,
    }));
    expect(findingIdsOf(r, "nex-nextjs-engineering")).toEqual([]);
  });

  it("E-10 · server-component page with a client hook triggers finding", () => {
    const r = runAll(candidate({
      workspace_relative_path: "src/app/other/page.tsx",
      proposed_content: "import { useEffect } from 'react';\nexport default function P(){ useEffect(()=>{},[]); return <div/>; }\n",
    }));
    expect(findingIdsOf(r, "nex-nextjs-engineering")).toContain("NNX_SERVER_COMPONENT_WITH_CLIENT_HOOK");
  });
});

// ── §F · nex-vitest-engineering ───────────────────────────────────────

describe("§36-WAVE-A · Wave A · §F · nex-vitest-engineering", () => {
  it("F-1 · NVT_ONLY_LEFT_IN emitted for it.only", () => {
    const r = runAll(candidate({
      workspace_relative_path: "src/lib/example/__tests__/x.test.ts",
      proposed_content: "import { describe, it, expect } from 'vitest';\ndescribe('x', () => { it.only('a', () => { expect(1).toBe(1); }); });\n",
    }));
    expect(findingIdsOf(r, "nex-vitest-engineering")).toContain("NVT_ONLY_LEFT_IN");
  });

  it("F-2 · NVT_TEST_NO_ASSERTION emitted when it() has no expect", () => {
    const r = runAll(candidate({
      workspace_relative_path: "src/lib/example/__tests__/x.test.ts",
      proposed_content: "import { describe, it } from 'vitest';\ndescribe('x', () => { it('a', () => { const y = 1 + 1; }); });\n",
    }));
    expect(findingIdsOf(r, "nex-vitest-engineering")).toContain("NVT_TEST_NO_ASSERTION");
  });

  it("F-3 · NVT_SKIP_LEFT_IN emitted for it.skip", () => {
    const r = runAll(candidate({
      workspace_relative_path: "src/lib/example/__tests__/x.test.ts",
      proposed_content: "import { describe, it, expect } from 'vitest';\ndescribe('x', () => { it.skip('a', () => { expect(1).toBe(1); }); });\n",
    }));
    expect(findingIdsOf(r, "nex-vitest-engineering")).toContain("NVT_SKIP_LEFT_IN");
  });

  it("F-4 · NVT_ASYNC_TEST_NO_AWAIT emitted", () => {
    const r = runAll(candidate({
      workspace_relative_path: "src/lib/example/__tests__/x.test.ts",
      proposed_content: "import { describe, it, expect } from 'vitest';\ndescribe('x', () => { it('a', async () => { expect(1).toBe(1); }); });\n",
    }));
    expect(findingIdsOf(r, "nex-vitest-engineering")).toContain("NVT_ASYNC_TEST_NO_AWAIT");
  });

  it("F-5 · NVT_TIMER_MOCK_NO_RESTORE emitted", () => {
    const r = runAll(candidate({
      workspace_relative_path: "src/lib/example/__tests__/x.test.ts",
      proposed_content: "import { describe, it, expect, vi } from 'vitest';\ndescribe('x', () => { it('a', () => { vi.useFakeTimers(); expect(1).toBe(1); }); });\n",
    }));
    expect(findingIdsOf(r, "nex-vitest-engineering")).toContain("NVT_TIMER_MOCK_NO_RESTORE");
  });

  it("F-6 · NVT_MISSING_DESCRIBE emitted for top-level it", () => {
    const r = runAll(candidate({
      workspace_relative_path: "src/lib/example/__tests__/x.test.ts",
      proposed_content: "import { it, expect } from 'vitest';\nit('a', () => { expect(1).toBe(1); });\n",
    }));
    expect(findingIdsOf(r, "nex-vitest-engineering")).toContain("NVT_MISSING_DESCRIBE");
  });

  it("F-7 · NVT_LARGE_INLINE_SNAPSHOT emitted", () => {
    const big = "x".repeat(600);
    const r = runAll(candidate({
      workspace_relative_path: "src/lib/example/__tests__/x.test.ts",
      proposed_content: `import { describe, it, expect } from 'vitest';\ndescribe('x', () => { it('a', () => { expect('a').toMatchInlineSnapshot(\`${big}\`); }); });\n`,
    }));
    expect(findingIdsOf(r, "nex-vitest-engineering")).toContain("NVT_LARGE_INLINE_SNAPSHOT");
  });

  it("F-8 · specialist emits nothing on non-test files", () => {
    const r = runAll(candidate({
      workspace_relative_path: "src/lib/example/foo.ts",
      proposed_content: "export const it_only = 1;\n",
    }));
    expect(findingIdsOf(r, "nex-vitest-engineering")).toEqual([]);
  });

  it("F-9 · clean vitest file yields no NVT findings", () => {
    const r = runAll(candidate({
      workspace_relative_path: "src/lib/example/__tests__/x.test.ts",
      proposed_content: "import { describe, it, expect } from 'vitest';\ndescribe('x', () => { it('a', () => { expect(1).toBe(1); }); });\n",
    }));
    expect(findingIdsOf(r, "nex-vitest-engineering")).toEqual([]);
  });

  it("F-10 · describe.only also fires NVT_ONLY_LEFT_IN", () => {
    const r = runAll(candidate({
      workspace_relative_path: "src/lib/example/__tests__/x.test.ts",
      proposed_content: "import { describe, it, expect } from 'vitest';\ndescribe.only('x', () => { it('a', () => { expect(1).toBe(1); }); });\n",
    }));
    expect(findingIdsOf(r, "nex-vitest-engineering")).toContain("NVT_ONLY_LEFT_IN");
  });
});

// ── §G · nex-postgresql-engineering ───────────────────────────────────

describe("§36-WAVE-A · Wave A · §G · nex-postgresql-engineering", () => {
  it("G-1 · NPG_MISSING_PRIMARY_KEY emitted", () => {
    const r = runAll(candidate({
      workspace_relative_path: "db/migrations/2026_01_01_users.sql",
      proposed_content: "CREATE TABLE users (name TEXT NOT NULL);\n",
    }));
    expect(findingIdsOf(r, "nex-postgresql-engineering")).toContain("NPG_MISSING_PRIMARY_KEY");
  });

  it("G-2 · NPG_TIMESTAMP_WITHOUT_TIMEZONE emitted", () => {
    const r = runAll(candidate({
      workspace_relative_path: "db/migrations/2026_01_02.sql",
      proposed_content: "CREATE TABLE events (id INT PRIMARY KEY, at TIMESTAMP NOT NULL);\n",
    }));
    expect(findingIdsOf(r, "nex-postgresql-engineering")).toContain("NPG_TIMESTAMP_WITHOUT_TIMEZONE");
  });

  it("G-3 · NPG_UNBOUNDED_VARCHAR emitted", () => {
    const r = runAll(candidate({
      workspace_relative_path: "db/migrations/2026_01_03.sql",
      proposed_content: "CREATE TABLE t (id INT PRIMARY KEY, name VARCHAR);\n",
    }));
    expect(findingIdsOf(r, "nex-postgresql-engineering")).toContain("NPG_UNBOUNDED_VARCHAR");
  });

  it("G-4 · NPG_SERIAL_INSTEAD_OF_IDENTITY emitted", () => {
    const r = runAll(candidate({
      workspace_relative_path: "db/migrations/2026_01_04.sql",
      proposed_content: "CREATE TABLE t (id BIGSERIAL PRIMARY KEY);\n",
    }));
    expect(findingIdsOf(r, "nex-postgresql-engineering")).toContain("NPG_SERIAL_INSTEAD_OF_IDENTITY");
  });

  it("G-5 · NPG_MISSING_RLS_ENABLE emitted", () => {
    const r = runAll(candidate({
      workspace_relative_path: "db/migrations/2026_01_05.sql",
      proposed_content: "CREATE TABLE profiles (id INT PRIMARY KEY);\n",
    }));
    expect(findingIdsOf(r, "nex-postgresql-engineering")).toContain("NPG_MISSING_RLS_ENABLE");
  });

  it("G-6 · NPG_MULTI_STATEMENT_NO_TRANSACTION emitted for 3+ DDL without BEGIN/COMMIT", () => {
    const r = runAll(candidate({
      workspace_relative_path: "db/migrations/2026_01_06.sql",
      proposed_content: "CREATE TABLE a (id INT PRIMARY KEY);\nCREATE TABLE b (id INT PRIMARY KEY);\nCREATE INDEX b_idx ON b(id);\n",
    }));
    expect(findingIdsOf(r, "nex-postgresql-engineering")).toContain("NPG_MULTI_STATEMENT_NO_TRANSACTION");
  });

  it("G-7 · NPG_UUID_WITHOUT_EXTENSION emitted", () => {
    const r = runAll(candidate({
      workspace_relative_path: "db/migrations/2026_01_07.sql",
      proposed_content: "CREATE TABLE u (id UUID PRIMARY KEY DEFAULT uuid_generate_v4());\n",
    }));
    expect(findingIdsOf(r, "nex-postgresql-engineering")).toContain("NPG_UUID_WITHOUT_EXTENSION");
  });

  it("G-8 · NPG_UUID_WITHOUT_EXTENSION NOT emitted when extension declared", () => {
    const r = runAll(candidate({
      workspace_relative_path: "db/migrations/2026_01_08.sql",
      proposed_content: "CREATE EXTENSION IF NOT EXISTS \"uuid-ossp\";\nCREATE TABLE u (id UUID PRIMARY KEY DEFAULT uuid_generate_v4());\n",
    }));
    expect(findingIdsOf(r, "nex-postgresql-engineering")).not.toContain("NPG_UUID_WITHOUT_EXTENSION");
  });

  it("G-9 · specialist emits nothing on non-SQL files", () => {
    const r = runAll(candidate({
      workspace_relative_path: "src/lib/plain.ts",
      proposed_content: "const q = 'SELECT * FROM foo';\n",
    }));
    expect(findingIdsOf(r, "nex-postgresql-engineering")).toEqual([]);
  });

  it("G-10 · clean SQL yields no NPG findings", () => {
    const r = runAll(candidate({
      workspace_relative_path: "db/migrations/2026_01_10.sql",
      proposed_content: "BEGIN;\nCREATE EXTENSION IF NOT EXISTS \"uuid-ossp\";\nCREATE TABLE t (id UUID PRIMARY KEY DEFAULT uuid_generate_v4(), at TIMESTAMPTZ NOT NULL, name VARCHAR(255));\nALTER TABLE t ENABLE ROW LEVEL SECURITY;\nCOMMIT;\n",
    }));
    expect(findingIdsOf(r, "nex-postgresql-engineering")).toEqual([]);
  });
});

// ── §H · Determinism ──────────────────────────────────────────────────

describe("§36-WAVE-A · Wave A · §H · determinism", () => {
  it("H-1 · same input yields identical output shape (per-specialist finding_id order)", () => {
    const input = candidate({
      workspace_relative_path: "src/app/foo/page.tsx",
      proposed_content: `"use client";\nimport { useState } from 'react';\nexport default function P(){ const [x] = useState(compute()); return items.map((it, i) => <div key={i}>{it}</div>); }\n`,
    });
    const a = runAll(input);
    const b = runAll(input);
    expect(JSON.stringify(a.per_specialist)).toBe(JSON.stringify(b.per_specialist));
    expect(a.total_findings).toBe(b.total_findings);
    expect(a.overall_verdict).toBe(b.overall_verdict);
  });
});

// ── §I · Severity map exhaustive ──────────────────────────────────────

describe("§36-WAVE-A · Wave A · §I · severity map exhaustive", () => {
  it("I-1 · every finding_id in the union has a locked severity mapping", () => {
    // Compile-time exhaustiveness is enforced by Record<WaveASpecialistFindingId, …>.
    // Runtime check: every declared severity is one of the 3 allowed values.
    for (const key of Object.keys(WAVE_A_FINDING_ID_SEVERITY_MAP)) {
      const sev = (WAVE_A_FINDING_ID_SEVERITY_MAP as Record<string, string>)[key];
      expect(["advisory", "warning", "critical"]).toContain(sev);
    }
    // At least 36 finding-ids
    expect(Object.keys(WAVE_A_FINDING_ID_SEVERITY_MAP).length).toBeGreaterThanOrEqual(36);
  });

  it("I-2 · all 5 specialists exist in the locked WAVE_A_SPECIALIST_IDS array", () => {
    expect(WAVE_A_SPECIALIST_IDS).toEqual([
      "nex-typescript-engineering",
      "nex-react-engineering",
      "nex-nextjs-engineering",
      "nex-vitest-engineering",
      "nex-postgresql-engineering",
    ]);
  });
});

// ── §J · Full integration ─────────────────────────────────────────────

describe("§36-WAVE-A · Wave A · §J · full integration", () => {
  it("J-1 · all 5 specialists appear in per_specialist result when specialists_to_run='all'", () => {
    const r = runAll(candidate({
      workspace_relative_path: "src/lib/plain.md", // hits nothing
      proposed_content: "# plain\n",
    }));
    const ids = r.per_specialist.map((p) => p.specialist_id).sort();
    expect(ids).toEqual([
      "nex-nextjs-engineering",
      "nex-postgresql-engineering",
      "nex-react-engineering",
      "nex-typescript-engineering",
      "nex-vitest-engineering",
    ]);
  });

  it("J-2 · overall_verdict === 'action_required' when any critical/warning present", () => {
    const r = runAll(candidate({
      workspace_relative_path: "src/lib/example/foo.ts",
      proposed_content: "// @ts-nocheck\nexport const x = 1;\n",
    }));
    expect(r.overall_verdict).toBe("action_required");
    expect(r.critical_count).toBeGreaterThanOrEqual(1);
  });

  it("J-3 · overall_verdict === 'advisory_only' when only advisories present", () => {
    const r = runAll(candidate({
      workspace_relative_path: "src/lib/example/foo.ts",
      proposed_content: "export enum X { A, B }\n",
    }));
    expect(r.overall_verdict).toBe("advisory_only");
    expect(r.advisory_count).toBeGreaterThanOrEqual(1);
    expect(r.critical_count).toBe(0);
    expect(r.warning_count).toBe(0);
  });

  it("J-4 · overall_verdict === 'no_findings' when nothing matches", () => {
    const r = runAll(candidate({
      workspace_relative_path: "src/lib/example/pure.ts",
      proposed_content: "export const clean = 1;\n",
    }));
    expect(r.overall_verdict).toBe("no_findings");
    expect(r.total_findings).toBe(0);
  });

  it("J-5 · specialists_to_run subset returns only requested specialists", () => {
    const r = runWaveALanguageFrameworkReviewers({
      candidate: candidate(),
      specialists_to_run: ["nex-typescript-engineering", "nex-vitest-engineering"],
    }) as RunWaveASpecialistsSuccess;
    expect(r.kind).toBe("SUCCESS");
    const ids = r.per_specialist.map((p) => p.specialist_id).sort();
    expect(ids).toEqual(["nex-typescript-engineering", "nex-vitest-engineering"]);
  });
});
