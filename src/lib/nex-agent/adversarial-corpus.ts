// src/lib/nex-agent/adversarial-corpus.ts
//
// NEX1 · ADVERSARIAL TRAINING CORPUS.
//
// Founder directive (2026-09-11):
//   "produce complex mock code in all file formats and situations to try get
//    nex1 to fail a task · and if fail then teach nex1 the code solution until
//    master coder ai. we require the top ai quality in the world."
//
// This corpus is a durable stress-test set. Each lesson:
//   1. presents intentionally broken code that LOOKS normal
//   2. declares which NEX guard (guardian · security · ui-dna · truth · docs)
//      should flag it AND the specific failure signature
//   3. carries the corrected solution
//   4. carries the teaching text explaining WHY the trap fails
//
// When NEX1 attempts a lesson, the runner:
//   attempt → grade against expected_failure_signals →
//     pass → bump competency
//     fail → surface teaching → record anti-pattern → retry
//
// The point is NOT to catalogue every possible bug. It is to give NEX1 a
// broad, repeatable adversarial ladder that the Capability Bar reflects.
//
// Additive: this file does NOT replace any existing training/lesson code.
// It complements src/lib/nex-agent/core/training.ts and the competency ledger.

export type LessonFormat =
  | "tsx" | "ts" | "js" | "sql" | "json" | "yaml"
  | "css" | "bash" | "powershell" | "markdown" | "dockerfile" | "env";

export type LessonGuard =
  | "guardian"       // architecture guardian
  | "security"       // security agent
  | "ui_dna"         // NEX UI DNA linter
  | "truth_engine"   // truth engine
  | "type_check"     // TypeScript compiler
  | "hooks_lint"     // React rules-of-hooks
  | "doctrine"       // ADR / immutable rule
  | "test_runner"    // unit/integration test
  | "a11y";          // accessibility

export type LessonDifficulty = 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10;

export interface AdversarialLesson {
  readonly id: string;
  readonly title: string;
  readonly category: string;
  readonly format: LessonFormat;
  readonly difficulty: LessonDifficulty;
  readonly guard: LessonGuard;
  readonly filePathHint: string;
  readonly mockFailingCode: string;
  readonly expectedFailureSignals: readonly string[];
  readonly correctedSolution: string;
  readonly teaching: string;
  readonly competencyDomains: readonly string[];
}

const L = (l: AdversarialLesson): AdversarialLesson => l;

export const ADVERSARIAL_CORPUS: readonly AdversarialLesson[] = [
  // ── React hooks / rendering discipline ───────────────────────────
  L({
    id: "HK-01",
    title: "useMemo after early return · hook count changes between renders",
    category: "React Hooks",
    format: "tsx",
    difficulty: 3,
    guard: "hooks_lint",
    filePathHint: "src/components/BadPanel.tsx",
    mockFailingCode: `"use client";
import { useMemo, useState } from "react";
export function BadPanel({ enabled }: { enabled: boolean }) {
  const [x] = useState(0);
  if (!enabled) return null;
  const label = useMemo(() => \`x=\${x}\`, [x]);   // ← hook after early return
  return <div>{label}</div>;
}`,
    expectedFailureSignals: ["Rendered more hooks than during the previous render", "hook-order", "conditional useMemo"],
    correctedSolution: `"use client";
import { useMemo, useState } from "react";
export function BadPanel({ enabled }: { enabled: boolean }) {
  const [x] = useState(0);
  const label = useMemo(() => \`x=\${x}\`, [x]);   // moved above the early return
  if (!enabled) return null;
  return <div>{label}</div>;
}`,
    teaching: "All hooks must run in the same order on every render. A conditional return before a hook flips the count between renders and crashes React's fiber. Move every hook above every early return, or drop the early return entirely.",
    competencyDomains: ["api_structure", "feature_planning"],
  }),
  L({
    id: "HK-02",
    title: "setState with stale closure · sequential increments collapse",
    category: "React Hooks",
    format: "tsx",
    difficulty: 4,
    guard: "hooks_lint",
    filePathHint: "src/components/Counter.tsx",
    mockFailingCode: `"use client";
import { useState } from "react";
export function Counter() {
  const [n, setN] = useState(0);
  const bumpThree = () => { setN(n + 1); setN(n + 1); setN(n + 1); }; // ← n captured once
  return <button onClick={bumpThree}>{n}</button>;
}`,
    expectedFailureSignals: ["stale closure", "setState with prior value", "n + 1 called with captured n"],
    correctedSolution: `"use client";
import { useState } from "react";
export function Counter() {
  const [n, setN] = useState(0);
  const bumpThree = () => { setN((p) => p + 1); setN((p) => p + 1); setN((p) => p + 1); };
  return <button onClick={bumpThree}>{n}</button>;
}`,
    teaching: "State updater form (prev => next) reads the *current* state at apply time. Direct \`setN(n+1)\` captures n at closure creation, so three back-to-back calls all read the same n.",
    competencyDomains: ["api_structure"],
  }),
  L({
    id: "HK-03",
    title: "useEffect without cleanup · event listener leak",
    category: "React Hooks",
    format: "tsx",
    difficulty: 3,
    guard: "hooks_lint",
    filePathHint: "src/components/ResizeHook.tsx",
    mockFailingCode: `"use client";
import { useEffect, useState } from "react";
export function ResizeHook() {
  const [w, setW] = useState(0);
  useEffect(() => {
    window.addEventListener("resize", () => setW(window.innerWidth));
  }, []);
  return <div>{w}</div>;
}`,
    expectedFailureSignals: ["missing cleanup", "listener leak", "no return from useEffect"],
    correctedSolution: `"use client";
import { useEffect, useState } from "react";
export function ResizeHook() {
  const [w, setW] = useState(0);
  useEffect(() => {
    const on = () => setW(window.innerWidth);
    window.addEventListener("resize", on);
    return () => window.removeEventListener("resize", on);
  }, []);
  return <div>{w}</div>;
}`,
    teaching: "Every subscription (addEventListener, setInterval, WebSocket, AbortController) must return a matching teardown from useEffect. Named handler is required to remove the exact same reference.",
    competencyDomains: ["api_structure", "self_repair"],
  }),

  // ── TypeScript / type safety ─────────────────────────────────────
  L({
    id: "TS-01",
    title: "Union narrowing lost via as cast",
    category: "TypeScript",
    format: "ts",
    difficulty: 4,
    guard: "type_check",
    filePathHint: "src/lib/parse.ts",
    mockFailingCode: `type Result = { ok: true; value: number } | { ok: false; error: string };
export function readValue(r: Result): number {
  return (r as { ok: true; value: number }).value; // ← unsafe cast erases discriminant
}`,
    expectedFailureSignals: ["unsafe cast", "discriminated union not narrowed", "as any pattern"],
    correctedSolution: `type Result = { ok: true; value: number } | { ok: false; error: string };
export function readValue(r: Result): number {
  if (!r.ok) throw new Error(r.error);
  return r.value;
}`,
    teaching: "Casts (as T) tell the compiler to trust you and stop checking. Discriminated unions are already narrow when the discriminant is checked (\`if (!r.ok)\`). Prefer branching over casting.",
    competencyDomains: ["api_structure", "reasoning_diagnosis"],
  }),
  L({
    id: "TS-02",
    title: "any-typed response silently accepted",
    category: "TypeScript",
    format: "ts",
    difficulty: 3,
    guard: "type_check",
    filePathHint: "src/lib/fetch-user.ts",
    mockFailingCode: `export async function fetchUser(id: string) {
  const r = await fetch(\`/api/user/\${id}\`);
  const j: any = await r.json();          // ← implicit any-typed body
  return j.profile.email.toUpperCase();   // ← may crash at runtime
}`,
    expectedFailureSignals: ["any type", "no runtime validation", "unchecked property chain"],
    correctedSolution: `import { z } from "zod";
const UserResponse = z.object({ profile: z.object({ email: z.string().email() }) });
export async function fetchUser(id: string) {
  const r = await fetch(\`/api/user/\${id}\`);
  const parsed = UserResponse.parse(await r.json());
  return parsed.profile.email.toUpperCase();
}`,
    teaching: "External JSON is untrusted. Parse it through a schema at the boundary (Zod, io-ts, valibot) so runtime shape matches compile-time type. any is a discipline hole.",
    competencyDomains: ["api_structure", "security_reasoning"],
  }),

  // ── SQL / migrations ─────────────────────────────────────────────
  L({
    id: "SQL-01",
    title: "String-concatenated query · SQL injection",
    category: "SQL / Security",
    format: "ts",
    difficulty: 5,
    guard: "security",
    filePathHint: "src/app/api/user/search/route.ts",
    mockFailingCode: `import { Client } from "pg";
export async function GET(req: Request) {
  const url = new URL(req.url);
  const q = url.searchParams.get("q") ?? "";
  const c = new Client(); await c.connect();
  const r = await c.query(\`SELECT id, name FROM users WHERE name LIKE '%\${q}%'\`);
  return Response.json(r.rows);
}`,
    expectedFailureSignals: ["SQL injection", "user input concatenated", "no parameterisation"],
    correctedSolution: `import { Client } from "pg";
export async function GET(req: Request) {
  const url = new URL(req.url);
  const q = url.searchParams.get("q") ?? "";
  const c = new Client(); await c.connect();
  const r = await c.query("SELECT id, name FROM users WHERE name LIKE $1", [\`%\${q}%\`]);
  return Response.json(r.rows);
}`,
    teaching: "Any query built with template literals + user input is injectable. Use parameterised queries with $1/$2 placeholders — pg escapes them safely and the query plan is cached.",
    competencyDomains: ["database_reasoning", "security_reasoning"],
  }),
  L({
    id: "SQL-02",
    title: "Migration adds NOT NULL without default · breaks existing rows",
    category: "SQL / Migrations",
    format: "sql",
    difficulty: 6,
    guard: "guardian",
    filePathHint: "db/migrations/0042_add_role.sql",
    mockFailingCode: `-- Add role column
ALTER TABLE users ADD COLUMN role text NOT NULL;`,
    expectedFailureSignals: ["NOT NULL without default", "existing rows have no value", "migration will fail on rows"],
    correctedSolution: `-- Add role column · backfill · then enforce NOT NULL
ALTER TABLE users ADD COLUMN role text;
UPDATE users SET role = 'user' WHERE role IS NULL;
ALTER TABLE users ALTER COLUMN role SET NOT NULL;
ALTER TABLE users ALTER COLUMN role SET DEFAULT 'user';`,
    teaching: "NOT NULL applied to an existing populated table fails on the first row that lacks a value. Add nullable → backfill → enforce NOT NULL as three steps. Set a DEFAULT so future inserts don't require the field.",
    competencyDomains: ["migration_reasoning", "database_reasoning"],
  }),
  L({
    id: "SQL-03",
    title: "Missing FK · orphan rows possible",
    category: "SQL / Migrations",
    format: "sql",
    difficulty: 4,
    guard: "guardian",
    filePathHint: "db/migrations/0043_orders.sql",
    mockFailingCode: `CREATE TABLE orders (
  order_id uuid PRIMARY KEY,
  user_id  uuid NOT NULL,    -- ← no FK back to users
  total    numeric NOT NULL
);`,
    expectedFailureSignals: ["missing foreign key", "referential integrity", "orphan rows possible"],
    correctedSolution: `CREATE TABLE orders (
  order_id uuid PRIMARY KEY,
  user_id  uuid NOT NULL REFERENCES users(user_id) ON DELETE RESTRICT,
  total    numeric NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX orders_user_id_idx ON orders(user_id);`,
    teaching: "Foreign keys prevent inserting orders for non-existent users. ON DELETE RESTRICT stops user-delete from silently orphaning orders. Add an index on the FK column — joins are painful without it.",
    competencyDomains: ["migration_reasoning", "database_reasoning"],
  }),

  // ── Security ─────────────────────────────────────────────────────
  L({
    id: "SEC-01",
    title: "Hardcoded API key in server file",
    category: "Security",
    format: "ts",
    difficulty: 2,
    guard: "security",
    filePathHint: "src/lib/mail.ts",
    mockFailingCode: `import { Resend } from "resend";
const resend = new Resend("re_prod_LiveKey_ABC123XYZ");   // ← credential in code
export async function send(to: string, subject: string, html: string) {
  await resend.emails.send({ from: "no-reply@app.com", to, subject, html });
}`,
    expectedFailureSignals: ["hardcoded API key", "secret in source", "process.env expected"],
    correctedSolution: `import { Resend } from "resend";
const key = process.env.RESEND_API_KEY;
if (!key) throw new Error("RESEND_API_KEY is required");
const resend = new Resend(key);
export async function send(to: string, subject: string, html: string) {
  await resend.emails.send({ from: "no-reply@app.com", to, subject, html });
}`,
    teaching: "Secrets in source get committed, indexed, shared in screenshots, and rotated forever. Read from process.env, fail loud at startup if missing, and put the real value in .env.local (gitignored).",
    competencyDomains: ["security_reasoning"],
  }),
  L({
    id: "SEC-02",
    title: "Shell command injection via user input",
    category: "Security",
    format: "ts",
    difficulty: 6,
    guard: "security",
    filePathHint: "src/app/api/thumb/route.ts",
    mockFailingCode: `import { exec } from "node:child_process";
export async function POST(req: Request) {
  const { filename } = await req.json();
  exec(\`convert /tmp/\${filename} /tmp/thumb.png\`, () => {}); // ← user controls filename
  return Response.json({ ok: true });
}`,
    expectedFailureSignals: ["shell injection", "user input in command", "exec with template literal"],
    correctedSolution: `import { execFile } from "node:child_process";
import { basename } from "node:path";
export async function POST(req: Request) {
  const { filename } = await req.json();
  const safe = basename(String(filename)).replace(/[^a-zA-Z0-9._-]/g, "");
  if (!safe) return Response.json({ ok: false }, { status: 400 });
  execFile("convert", [\`/tmp/\${safe}\`, "/tmp/thumb.png"]);
  return Response.json({ ok: true });
}`,
    teaching: "\`exec\` runs through a shell that interprets ;, |, &, $(). Attacker sends filename \`x.png; rm -rf /\` and you're done. Use \`execFile\` with an argv array — no shell involved. Also strip filename to a safe charset via basename+regex.",
    competencyDomains: ["security_reasoning"],
  }),
  L({
    id: "SEC-03",
    title: "SVG upload without sanitisation",
    category: "Security",
    format: "ts",
    difficulty: 5,
    guard: "security",
    filePathHint: "src/app/api/upload/route.ts",
    mockFailingCode: `export async function POST(req: Request) {
  const form = await req.formData();
  const file = form.get("file") as File;
  const bytes = await file.arrayBuffer();
  await Bun.write(\`public/uploads/\${file.name}\`, bytes);   // ← SVG with <script> served as-is
  return Response.json({ url: \`/uploads/\${file.name}\` });
}`,
    expectedFailureSignals: ["SVG script tag", "no sanitisation", "public/ serving arbitrary XML"],
    correctedSolution: `import DOMPurify from "isomorphic-dompurify";
export async function POST(req: Request) {
  const form = await req.formData();
  const file = form.get("file") as File;
  if (file.type === "image/svg+xml") {
    const text = await file.text();
    const clean = DOMPurify.sanitize(text, { USE_PROFILES: { svg: true, svgFilters: true } });
    await Bun.write(\`public/uploads/\${file.name}\`, clean);
  } else {
    await Bun.write(\`public/uploads/\${file.name}\`, await file.arrayBuffer());
  }
  return Response.json({ url: \`/uploads/\${file.name}\` });
}`,
    teaching: "SVG is XML. \`<svg><script>alert(1)</script></svg>\` runs when served with image/svg+xml MIME. Sanitise SVG through DOMPurify's SVG profile before writing to disk. Also validate filename separately.",
    competencyDomains: ["security_reasoning"],
  }),

  // ── UI DNA / accessibility ───────────────────────────────────────
  L({
    id: "UI-01",
    title: "Orange used decoratively · violates NEX UI DNA reserved colour rule",
    category: "UI DNA",
    format: "tsx",
    difficulty: 3,
    guard: "ui_dna",
    filePathHint: "src/components/InfoCard.tsx",
    mockFailingCode: `export function InfoCard() {
  return (
    <div style={{ background: "#F97316", padding: 16, borderRadius: 8, color: "white" }}>
      <h3>Weather today</h3>
      <p>Sunny · 24°C</p>
    </div>
  );
}`,
    expectedFailureSignals: ["orange used decoratively", "reserved for action only", "NEX UI DNA violation"],
    correctedSolution: `export function InfoCard() {
  return (
    <div style={{ background: "rgba(34, 211, 238, 0.10)", border: "1px solid rgba(34, 211, 238, 0.32)", padding: 16, borderRadius: 8, color: "#F9FAFB" }}>
      <h3>Weather today</h3>
      <p>Sunny · 24°C</p>
    </div>
  );
}`,
    teaching: "Per ADR-0316d the reserved-colour discipline is: cyan #22D3EE = technology/information, orange #F97316 = action only. Info panels use cyan glass, never orange. Orange on informational cards steals attention from real action affordances.",
    competencyDomains: ["ui_dna_reasoning", "adr_impact_reasoning"],
  }),
  L({
    id: "UI-02",
    title: "Button rendered as <div> · not keyboard accessible",
    category: "Accessibility",
    format: "tsx",
    difficulty: 2,
    guard: "a11y",
    filePathHint: "src/components/Dropdown.tsx",
    mockFailingCode: `export function Trigger({ onOpen }: { onOpen: () => void }) {
  return <div onClick={onOpen} className="btn">Open menu</div>;
}`,
    expectedFailureSignals: ["div with onClick", "no keyboard support", "not focusable"],
    correctedSolution: `export function Trigger({ onOpen }: { onOpen: () => void }) {
  return <button type="button" onClick={onOpen} className="btn">Open menu</button>;
}`,
    teaching: "\`<div onClick>\` is invisible to keyboard and screen readers · no focus ring · no Space/Enter activation · no button role. Use <button type=\"button\"> for any interactive element that isn't a link.",
    competencyDomains: ["ui_dna_reasoning"],
  }),
  L({
    id: "UI-03",
    title: "Image without alt · directory card fails matcher confidence gate",
    category: "Accessibility",
    format: "tsx",
    difficulty: 3,
    guard: "a11y",
    filePathHint: "src/components/nex-app/centre/SupplierCard.tsx",
    mockFailingCode: `export function SupplierCard({ img, name }: { img: string; name: string }) {
  return <div><img src={img} /><h3>{name}</h3></div>;
}`,
    expectedFailureSignals: ["img without alt", "screen reader silence", "NEX matcher alt-text discipline"],
    correctedSolution: `import type { AssetManifestRow } from "@/lib/nex/images/types";
export function SupplierCard({ manifestRow, name }: { manifestRow: AssetManifestRow; name: string }) {
  // Alt text derives from manifest row (ADR-0024) · never invented at render
  const alt = manifestRow.description ?? \`\${name} · profile image\`;
  return <div><img src={manifestRow.url} alt={alt} loading="lazy" /><h3>{name}</h3></div>;
}`,
    teaching: "Every <img> needs alt. Under NEX Image Constitution (ADR-0024) alt should come from the manifest row's description, not be fabricated at render. Empty alt='' is fine for purely decorative imagery; missing alt is never fine.",
    competencyDomains: ["ui_dna_reasoning", "architecture_reading"],
  }),

  // ── NEX doctrine violations ──────────────────────────────────────
  L({
    id: "DOC-01",
    title: "Direct write to nex.evidence · protected table",
    category: "Doctrine · nex.evidence protected",
    format: "ts",
    difficulty: 8,
    guard: "doctrine",
    filePathHint: "src/lib/nex/verifier/write.ts",
    mockFailingCode: `import { Client } from "pg";
export async function recordEvidence(claim_id: string, verdict: string) {
  const c = new Client(); await c.connect();
  await c.query("INSERT INTO nex.evidence (claim_id, verdict) VALUES ($1, $2)", [claim_id, verdict]);
  await c.end();
}`,
    expectedFailureSignals: ["nex.evidence protected", "requires founder authorisation", "Stage 1b BLOCKED"],
    correctedSolution: `// STOP · nex.evidence is protected substrate per Stage 1b lock.
// Author verifier records into the pipeline substrate (nex_test.* while under review).
// Do NOT touch nex.evidence without an explicit founder authorisation ADR.
throw new Error("sec.doctrine_nex_evidence_protected · founder authority required");`,
    teaching: "nex.evidence is locked behind Stage 1b apply-halt (pre-existing 173-row collision · pending founder review). Any code that writes to it without an approved ADR is a doctrine violation. Route new verifier work through the review path.",
    competencyDomains: ["adr_impact_reasoning", "architecture_reading"],
  }),
  L({
    id: "DOC-02",
    title: "Supabase declared as canonical image storage · violates GB Storage doctrine",
    category: "Doctrine · GB Storage canonical",
    format: "ts",
    difficulty: 7,
    guard: "doctrine",
    filePathHint: "src/lib/nex/visual-generation/storage.ts",
    mockFailingCode: `import { createClient } from "@supabase/supabase-js";
const sb = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_SERVICE_KEY!);
// Canonical NEX asset persistence
export async function saveCanonicalAsset(key: string, bytes: Uint8Array) {
  return sb.storage.from("nex-assets").upload(key, bytes);
}`,
    expectedFailureSignals: ["Supabase not canonical", "GB Storage doctrine", "ARCHITECTURAL_CONFLICT"],
    correctedSolution: `// GB Storage is the canonical substrate. It is currently UNBOUND.
// Do not silently equate Supabase Storage to GB Storage. Raise the conflict.
export async function saveCanonicalAsset(_key: string, _bytes: Uint8Array): Promise<never> {
  throw new Error("sec.gb_storage_unbound · founder-authored binding required · Supabase is legacy delivery only");
}`,
    teaching: "Founder D2 (2026-09-11): GB Storage = canonical abstraction, currently UNBOUND. Supabase Storage / ImageKit / @aws-sdk/client-s3 must NOT be silently promoted to canonical. Raise ARCHITECTURAL_CONFLICT and wait for founder binding.",
    competencyDomains: ["adr_impact_reasoning", "architecture_reading"],
  }),
  L({
    id: "DOC-03",
    title: "Third-party image copied on merchant import · violates ADR-0022",
    category: "Doctrine · ADR-0022",
    format: "ts",
    difficulty: 6,
    guard: "doctrine",
    filePathHint: "src/lib/nex/directory-import/gbp.ts",
    mockFailingCode: `export async function importFromGBP(profile: { logo?: string; gallery: string[] }) {
  const rows = [];
  if (profile.logo) rows.push({ url: profile.logo, source: "gbp_import" });
  for (const g of profile.gallery) rows.push({ url: g, source: "gbp_import" });
  return rows;
}`,
    expectedFailureSignals: ["ADR-0022 third-party image copy", "no logo/gallery copy", "text-only import"],
    correctedSolution: `// ADR-0022: import ONLY business text · never logos, gallery, cover, video from third-party sources.
export async function importFromGBP(profile: {
  name: string; address?: string; phone?: string; website?: string;
  category?: string; hours?: unknown;
}) {
  return {
    name: profile.name,
    address: profile.address ?? null,
    phone: profile.phone ?? null,
    website: profile.website ?? null,       // link is fine, copying content is not
    category: profile.category ?? null,
    hours: profile.hours ?? null,
    // NOTE: logo/gallery/cover deliberately omitted per ADR-0022
  };
}`,
    teaching: "ADR-0022 forbids copying logos/gallery/covers/products/video from Google Business Profile, Facebook, Instagram or any third-party source, at any tier. Text metadata is the entire allowed surface. Linking to their profile is fine; copying pixels is not.",
    competencyDomains: ["adr_impact_reasoning"],
  }),
  L({
    id: "DOC-04",
    title: "Bypass manifestWriter · direct fs.writeFile to nex-image-manifest.json",
    category: "Doctrine · ADR-0024",
    format: "ts",
    difficulty: 5,
    guard: "doctrine",
    filePathHint: "src/lib/nex/images/quick-import.ts",
    mockFailingCode: `import fs from "node:fs";
export async function quickImport(url: string, description: string) {
  const p = "data/nex-image-manifest.json";
  const j = JSON.parse(fs.readFileSync(p, "utf8"));
  j.images[url] = { description, created_at: new Date().toISOString() };   // ← bypass writer
  fs.writeFileSync(p, JSON.stringify(j, null, 2));
}`,
    expectedFailureSignals: ["bypass manifestWriter", "ADR-0024 requires all writes through canonical writer"],
    correctedSolution: `import { writeManifestRow } from "@/lib/nex/images/manifestWriter";
export async function quickImport(url: string, description: string) {
  await writeManifestRow({
    url,
    description,
    source: "uploaded",
    tags: [],
    subject_domain: "unknown",
    created_by: "quick-import",
  });
}`,
    teaching: "Every image URL in NEX must land in data/nex-image-manifest.json through the canonical writer (ADR-0024). Direct fs.writeFileSync skips schema validation, parseWithInheritance, Collection Intelligence updates, and Global Intelligence Pipeline re-run.",
    competencyDomains: ["adr_impact_reasoning", "architecture_reading"],
  }),

  // ── Async / race conditions ─────────────────────────────────────
  L({
    id: "ASYNC-01",
    title: "Sequential fetch with race · out-of-order response overwrites correct one",
    category: "Async",
    format: "tsx",
    difficulty: 6,
    guard: "hooks_lint",
    filePathHint: "src/components/Search.tsx",
    mockFailingCode: `"use client";
import { useEffect, useState } from "react";
export function Search({ query }: { query: string }) {
  const [results, setResults] = useState<string[]>([]);
  useEffect(() => {
    fetch(\`/api/search?q=\${query}\`).then((r) => r.json()).then((j) => setResults(j.results));
  }, [query]);
  return <ul>{results.map((r) => <li key={r}>{r}</li>)}</ul>;
}`,
    expectedFailureSignals: ["race condition", "no AbortController", "stale response overwrites fresh"],
    correctedSolution: `"use client";
import { useEffect, useState } from "react";
export function Search({ query }: { query: string }) {
  const [results, setResults] = useState<string[]>([]);
  useEffect(() => {
    const ac = new AbortController();
    fetch(\`/api/search?q=\${query}\`, { signal: ac.signal })
      .then((r) => r.json())
      .then((j) => setResults(j.results))
      .catch((e) => { if (e.name !== "AbortError") console.error(e); });
    return () => ac.abort();
  }, [query]);
  return <ul>{results.map((r) => <li key={r}>{r}</li>)}</ul>;
}`,
    teaching: "Typing fast: query='ab' fires, then 'abc' fires. If 'ab' resolves later, it overwrites 'abc' results. AbortController tied to useEffect cleanup cancels the stale request when a new one starts.",
    competencyDomains: ["api_structure", "self_repair"],
  }),

  // ── JSON / schemas ───────────────────────────────────────────────
  L({
    id: "JSON-01",
    title: "Required field missing from manifest row · fails ADR-0024 schema",
    category: "Schema · ADR-0024",
    format: "json",
    difficulty: 3,
    guard: "doctrine",
    filePathHint: "data/nex-image-manifest.json (row)",
    mockFailingCode: `{
  "https://ik.imagekit.io/5vv5pw26q/newpic.png": {
    "source": "ai_generated",
    "tags": ["staircase"]
  }
}`,
    expectedFailureSignals: ["missing description", "missing subject_domain", "missing created_at", "missing original_prompt for ai_generated"],
    correctedSolution: `{
  "https://ik.imagekit.io/5vv5pw26q/newpic.png": {
    "source": "ai_generated",
    "original_prompt": "modern oak floating staircase · rim lighting · dark studio background",
    "description": "Floating oak staircase in modern studio setting · marketing hero shot",
    "master_ai_prompt": null,
    "tags": ["staircase", "oak", "floating", "modern"],
    "subject_domain": "staircase",
    "primary_domain": "STAIRCASE",
    "primary_brain": "staircase_brain",
    "a_plus": false,
    "created_at": "2026-09-11T12:00:00.000Z",
    "created_by": "philip",
    "notes": null
  }
}`,
    teaching: "ADR-0024 requires: source · description · tags[] · subject_domain · created_at on every row, plus original_prompt when source='ai_generated'. Missing fields fail the manifest validator and the row is quarantined until authored.",
    competencyDomains: ["adr_impact_reasoning", "architecture_reading"],
  }),

  // ── CSS / a11y ───────────────────────────────────────────────────
  L({
    id: "CSS-01",
    title: "Text-on-image button · fails WCAG 4.5:1 contrast",
    category: "Accessibility",
    format: "css",
    difficulty: 2,
    guard: "a11y",
    filePathHint: "src/styles/buttons.css",
    mockFailingCode: `.btn-primary {
  background: #F97316;
  color: #FDBA74;         /* orange on orange · contrast ~1.9:1 */
  padding: 8px 16px;
  border-radius: 6px;
}`,
    expectedFailureSignals: ["contrast ratio below 4.5", "WCAG AA fail", "orange on orange"],
    correctedSolution: `.btn-primary {
  background: #F97316;
  color: #FFFFFF;         /* orange on white · contrast 4.66:1 */
  padding: 8px 16px;
  border-radius: 6px;
}
.btn-primary:hover { background: #EA580C; }
.btn-primary:focus-visible { outline: 2px solid #22D3EE; outline-offset: 2px; }`,
    teaching: "WCAG AA for normal text: 4.5:1 contrast. Orange #F97316 on white gives 4.66:1 (pass). Orange on light-orange gives <2:1 (unreadable to a lot of users). Also add :focus-visible for keyboard users — cyan outline matches NEX DNA.",
    competencyDomains: ["ui_dna_reasoning"],
  }),

  // ── Import / module ─────────────────────────────────────────────
  L({
    id: "IMPORT-01",
    title: "Broken import path · default vs named",
    category: "Imports",
    format: "ts",
    difficulty: 2,
    guard: "type_check",
    filePathHint: "src/app/api/user/route.ts",
    mockFailingCode: `import Client from "pg";                    // ← pg exports Client as named, not default
export async function GET() {
  const c = new Client();
  await c.connect();
  return Response.json({ ok: true });
}`,
    expectedFailureSignals: ["default import mismatch", "Client is not a constructor", "should be named import"],
    correctedSolution: `import { Client } from "pg";
export async function GET() {
  const c = new Client();
  await c.connect();
  return Response.json({ ok: true });
}`,
    teaching: "Not every package has a default export. \`pg\` exports named Client, Pool, types. \`import X from 'pg'\` gets you the module namespace, and \`new X()\` fails at runtime because it's not a constructor.",
    competencyDomains: ["api_structure"],
  }),

  // ── Turbopack / JSX ─────────────────────────────────────────────
  L({
    id: "JSX-01",
    title: "Unescaped angle-bracket in JSX text · parses as tag",
    category: "JSX",
    format: "tsx",
    difficulty: 2,
    guard: "type_check",
    filePathHint: "src/components/Doc.tsx",
    mockFailingCode: `export function Doc() {
  return <p>Contrast must be > 4.5:1 for AA · use <NexBadge> for hints</p>;
}`,
    expectedFailureSignals: ["JSX parse error", "> in text", "<NexBadge> parsed as tag"],
    correctedSolution: `export function Doc() {
  return <p>Contrast must be &gt; 4.5:1 for AA · use &lt;NexBadge&gt; for hints</p>;
}`,
    teaching: "JSX parses < and > as tag delimiters. Text content that contains them must escape via &lt; and &gt; (or wrap in {'string'}). Compiler error will point at the unbalanced tag.",
    competencyDomains: ["api_structure"],
  }),

  // ── Truth engine ─────────────────────────────────────────────────
  L({
    id: "TRUTH-01",
    title: "Fabricated data · placeholder pretending to be canonical",
    category: "Truth Engine",
    format: "ts",
    difficulty: 5,
    guard: "truth_engine",
    filePathHint: "src/lib/nex/brains/stats.ts",
    mockFailingCode: `export function getBrainStats() {
  return {
    total_images: 982,           // ← last-remembered number · not queried
    total_relationships: 1500,   // ← invented
    last_updated: "2026-08-01",  // ← stale, hardcoded
  };
}`,
    expectedFailureSignals: ["hardcoded stat", "evidence-or-silence", "no real query"],
    correctedSolution: `import { Client } from "pg";
export async function getBrainStats() {
  const c = new Client(); await c.connect();
  try {
    const total = Number((await c.query("SELECT count(*)::int c FROM nex.images")).rows[0].c);
    const rels = Number((await c.query("SELECT count(*)::int c FROM nex.image_relationships")).rows[0].c);
    const last = (await c.query("SELECT max(created_at)::text t FROM nex.images")).rows[0].t;
    return { total_images: total, total_relationships: rels, last_updated: last };
  } finally { await c.end(); }
}`,
    teaching: "Evidence-or-silence (CLAUDE.md rule): every displayed fact needs a provable evidence chain OR must be hidden. Hardcoded stats become lies as soon as data changes. If you can't query it live, don't display it.",
    competencyDomains: ["reasoning_diagnosis", "adr_impact_reasoning"],
  }),

  // ── Env / config ────────────────────────────────────────────────
  L({
    id: "ENV-01",
    title: "Committed .env with production secrets",
    category: "Security · env",
    format: "env",
    difficulty: 3,
    guard: "security",
    filePathHint: ".env",
    mockFailingCode: `DATABASE_URL=postgresql://prod-user:S3cretPr0dPass@db.company.com:5432/prod
STRIPE_SECRET_KEY=sk_live_ABC123XYZ_realproductionkey
RESEND_API_KEY=re_prod_LiveKey_realkey`,
    expectedFailureSignals: ["production secrets committed", ".env in repo", "should be .env.local"],
    correctedSolution: `# .env (committed · dev defaults · never production values)
DATABASE_URL=postgresql://postgres:local@localhost:5432/dev
STRIPE_SECRET_KEY=sk_test_placeholder
RESEND_API_KEY=re_test_placeholder

# .env.local (NEVER committed · listed in .gitignore · founder-authored production values)`,
    teaching: ".env can be committed if it's dev-safe defaults. Real production values live only in .env.local (gitignored) or the deployment secret manager. Rotating a leaked prod key is unpleasant; rotating all of them because one committed .env leaked is worse.",
    competencyDomains: ["security_reasoning"],
  }),

  // ── Bash / PowerShell shell injection ──────────────────────────
  L({
    id: "SH-01",
    title: "PowerShell script eval user input",
    category: "Security · shell",
    format: "powershell",
    difficulty: 4,
    guard: "security",
    filePathHint: "scripts/rename.ps1",
    mockFailingCode: `param([string]$name)
Invoke-Expression "Rename-Item -Path old.txt -NewName $name"   # ← IEX on user input`,
    expectedFailureSignals: ["Invoke-Expression on user input", "shell injection", "IEX dangerous"],
    correctedSolution: `param([string]$name)
$safe = $name -replace '[^\\w.-]', ''
if (-not $safe) { throw "invalid name" }
Rename-Item -Path 'old.txt' -NewName $safe`,
    teaching: "\`Invoke-Expression\` (IEX) is the PowerShell equivalent of \`eval\`. Any user string reaches shell interpretation. Use direct cmdlets with parameter binding and sanitise the input through a strict regex.",
    competencyDomains: ["security_reasoning"],
  }),

  // ── Markdown / docs ─────────────────────────────────────────────
  L({
    id: "MD-01",
    title: "ADR claims IMMUTABLE but proposes to mutate an existing immutable ADR",
    category: "Doctrine · ADR discipline",
    format: "markdown",
    difficulty: 7,
    guard: "doctrine",
    filePathHint: "docs/DECISIONS/0035-image-model-upgrade.md",
    mockFailingCode: `# ADR-0035: Modernise the image knowledge system

Status: Accepted · IMMUTABLE

## Decision
Replace ADR-0028 IMMUTABLE constitution with a simpler flat image model.
Delete ADR-0027 v1.2. New parser drops family_tree + geometry_preservation.`,
    expectedFailureSignals: ["IMMUTABLE ADR cannot be replaced", "ADR-0028 protected", "additive-not-replacement rule"],
    correctedSolution: `# ADR-0035: Additive image-model extension for animation frame metadata

Status: Proposed · non-immutable (extends ADR-0028)

## Decision
ADR-0028 remains IMMUTABLE. This ADR ADDS an optional \`animation_metadata\`
block to manifest rows for image_type=animation. Existing rows are unaffected.
family_tree, geometry_preservation, IMAGE DNA, Master AI Prompt, Confidence
Score all remain authoritative. Founder authorisation obtained: [date].`,
    teaching: "Founder rule locked 2026-09-11: NEX1 must never replace an existing immutable image constitution with a cleaner-looking model. Improvements must be additive. Deleting or superseding ADR-0027 / 0028 / 0034 requires an explicit founder amendment ADR — never a downstream ADR overwriting them silently.",
    competencyDomains: ["adr_impact_reasoning"],
  }),

  // ── Docker ───────────────────────────────────────────────────────
  L({
    id: "DOCKER-01",
    title: "COPY from unknown build stage · silent runtime failure",
    category: "Docker · multi-stage",
    format: "dockerfile",
    difficulty: 5,
    guard: "guardian",
    filePathHint: "Dockerfile",
    mockFailingCode: `FROM node:20-slim AS build
WORKDIR /app
COPY . .
RUN npm ci && npm run build

FROM node:20-slim
WORKDIR /app
COPY --from=builder /app/dist ./dist    # ← 'builder' vs 'build' typo
COPY --from=builder /app/node_modules ./node_modules
CMD ["node", "dist/index.js"]`,
    expectedFailureSignals: ["stage name mismatch", "COPY --from unknown stage", "typo builder vs build"],
    correctedSolution: `FROM node:20-slim AS build
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
RUN npm run build

FROM node:20-slim
WORKDIR /app
COPY --from=build /app/dist ./dist
COPY --from=build /app/node_modules ./node_modules
USER node
CMD ["node", "dist/index.js"]`,
    teaching: "COPY --from=<stage> must reference an existing AS name. 'builder' vs 'build' fails the build with a cryptic error. Also: install deps before COPY . . to keep the docker layer cache useful, and drop privileges via USER node.",
    competencyDomains: ["api_structure"],
  }),

  // ── YAML ─────────────────────────────────────────────────────────
  L({
    id: "YAML-01",
    title: "Indentation collapses map into string",
    category: "YAML",
    format: "yaml",
    difficulty: 4,
    guard: "type_check",
    filePathHint: ".github/workflows/ci.yml",
    mockFailingCode: `name: CI
on: push
jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - name: Install
      run: npm ci                # ← indentation drops 'run' out of the step
      - name: Test
        run: npm test`,
    expectedFailureSignals: ["yaml indentation", "run key at wrong level", "step missing run"],
    correctedSolution: `name: CI
on: push
jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - name: Install
        run: npm ci
      - name: Test
        run: npm test`,
    teaching: "YAML meaning is set by indentation. \`run\` at column 6 belongs to the job, not the step; at column 8 it belongs to the step. Two-space consistent indentation + a linter (yamllint / actionlint) catches this before CI does.",
    competencyDomains: ["api_structure"],
  }),

  // ── WebSocket ────────────────────────────────────────────────────
  L({
    id: "WS-01",
    title: "WebSocket without ping/pong · silent disconnect on idle",
    category: "WebSocket",
    format: "ts",
    difficulty: 6,
    guard: "guardian",
    filePathHint: "src/lib/live/socket.ts",
    mockFailingCode: `export function connect(url: string, onMessage: (m: string) => void) {
  const ws = new WebSocket(url);
  ws.onmessage = (e) => onMessage(String(e.data));
  return ws;   // ← no heartbeat · proxies/NAT will drop idle connection after ~60s
}`,
    expectedFailureSignals: ["no heartbeat", "no ping/pong", "silent disconnect", "idle timeout"],
    correctedSolution: `export function connect(url: string, onMessage: (m: string) => void) {
  const ws = new WebSocket(url);
  ws.onmessage = (e) => onMessage(String(e.data));
  const pingId = setInterval(() => {
    if (ws.readyState === WebSocket.OPEN) ws.send(JSON.stringify({ type: "ping" }));
  }, 25_000);
  ws.addEventListener("close", () => clearInterval(pingId));
  return ws;
}`,
    teaching: "Proxies, load balancers, and mobile NATs drop idle TCP connections after 30-60 seconds. Send an application-level ping every 25s so the connection stays warm and the client detects breakage. Always clear the interval on close to avoid leaks.",
    competencyDomains: ["api_structure", "self_repair"],
  }),

  // ── Service Worker ──────────────────────────────────────────────
  L({
    id: "SW-01",
    title: "Service worker serves stale assets forever · no version bump",
    category: "Service Worker",
    format: "js",
    difficulty: 6,
    guard: "guardian",
    filePathHint: "public/sw.js",
    mockFailingCode: `self.addEventListener("install", (e) => {
  e.waitUntil(caches.open("v1").then((c) => c.addAll(["/", "/app.js", "/app.css"])));
});
self.addEventListener("fetch", (e) => {
  e.respondWith(caches.match(e.request).then((r) => r || fetch(e.request)));
});
// no activate handler · old caches never cleaned · users stuck on v1 forever`,
    expectedFailureSignals: ["no cache versioning", "no activate handler", "old cache not deleted", "stale forever"],
    correctedSolution: `const VERSION = "v3";
const ASSETS = ["/", "/app.js", "/app.css"];
self.addEventListener("install", (e) => {
  e.waitUntil(caches.open(VERSION).then((c) => c.addAll(ASSETS)).then(() => self.skipWaiting()));
});
self.addEventListener("activate", (e) => {
  e.waitUntil(
    caches.keys().then((keys) => Promise.all(keys.filter((k) => k !== VERSION).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  );
});
self.addEventListener("fetch", (e) => {
  e.respondWith(caches.match(e.request).then((r) => r || fetch(e.request)));
});`,
    teaching: "Service workers are sticky. Without a version bump and an activate handler that deletes old caches, users can be stuck on last month's JS forever. VERSION const + activate cleanup + skipWaiting + clients.claim() forces the update.",
    competencyDomains: ["api_structure", "self_repair"],
  }),

  // ── CORS ─────────────────────────────────────────────────────────
  L({
    id: "CORS-01",
    title: "Access-Control-Allow-Origin: * with credentials · CORS abuse",
    category: "Security · CORS",
    format: "ts",
    difficulty: 5,
    guard: "security",
    filePathHint: "src/app/api/private/route.ts",
    mockFailingCode: `export async function GET(_req: Request) {
  return new Response(JSON.stringify({ user: "philip", role: "admin" }), {
    headers: {
      "Content-Type": "application/json",
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Credentials": "true",
    },
  });
}`,
    expectedFailureSignals: ["wildcard with credentials", "CORS unsafe combination", "allow origin star"],
    correctedSolution: `const ALLOWED = new Set(["https://app.thenetworkers.app", "http://localhost:3008"]);
export async function GET(req: Request) {
  const origin = req.headers.get("origin") ?? "";
  const allowed = ALLOWED.has(origin);
  return new Response(JSON.stringify({ user: "philip", role: "admin" }), {
    headers: {
      "Content-Type": "application/json",
      ...(allowed ? {
        "Access-Control-Allow-Origin": origin,
        "Access-Control-Allow-Credentials": "true",
        "Vary": "Origin",
      } : {}),
    },
  });
}`,
    teaching: "Browsers reject Allow-Origin: * combined with Allow-Credentials, but some proxies pass it through. Either way it's a footgun. Maintain an explicit allowlist, echo the request's Origin only when it's in the list, and set Vary: Origin so CDNs cache correctly.",
    competencyDomains: ["security_reasoning"],
  }),

  // ── Cookies ──────────────────────────────────────────────────────
  L({
    id: "COOKIE-01",
    title: "Session cookie without HttpOnly/Secure/SameSite",
    category: "Security · Cookies",
    format: "ts",
    difficulty: 3,
    guard: "security",
    filePathHint: "src/app/api/auth/login/route.ts",
    mockFailingCode: `export async function POST() {
  const token = "abc.def.ghi";
  return new Response("ok", {
    headers: { "Set-Cookie": \`session=\${token}; Path=/; Max-Age=86400\` },
  });
}`,
    expectedFailureSignals: ["missing HttpOnly", "missing Secure", "missing SameSite", "XSS-readable session"],
    correctedSolution: `export async function POST() {
  const token = "abc.def.ghi";
  return new Response("ok", {
    headers: {
      "Set-Cookie": \`session=\${token}; Path=/; Max-Age=86400; HttpOnly; Secure; SameSite=Lax\`,
    },
  });
}`,
    teaching: "Session cookies without HttpOnly are readable by any XSS. Without Secure they leak over http downgrade. Without SameSite they ride along on cross-site requests (CSRF). Set all three every time · Lax is a sensible default; Strict for logins.",
    competencyDomains: ["security_reasoning"],
  }),

  // ── Rate limit ──────────────────────────────────────────────────
  L({
    id: "RATE-01",
    title: "Fixed-window rate limit · trivially gameable at the boundary",
    category: "Security · Rate limit",
    format: "ts",
    difficulty: 6,
    guard: "security",
    filePathHint: "src/lib/rate-limit.ts",
    mockFailingCode: `const buckets = new Map<string, { count: number; windowStart: number }>();
export function checkRate(ip: string, limit = 10, windowMs = 60_000): boolean {
  const now = Date.now();
  const b = buckets.get(ip);
  if (!b || now - b.windowStart > windowMs) {
    buckets.set(ip, { count: 1, windowStart: now });
    return true;
  }
  b.count += 1;
  return b.count <= limit;   // ← attacker sends limit at 59.9s then limit again at 60.0s = 2x limit
}`,
    expectedFailureSignals: ["fixed window boundary", "burst at window edge", "sliding window preferred"],
    correctedSolution: `const hits = new Map<string, number[]>();
export function checkRate(ip: string, limit = 10, windowMs = 60_000): boolean {
  const now = Date.now();
  const cutoff = now - windowMs;
  const arr = (hits.get(ip) ?? []).filter((t) => t > cutoff);
  arr.push(now);
  hits.set(ip, arr);
  return arr.length <= limit;
}`,
    teaching: "Fixed windows reset abruptly; an attacker can burst 2× the limit across the reset. Sliding window keeps timestamps and counts what's still within \`windowMs\` — smoother, harder to game. For production use Upstash/Redis-based sliding-window with atomic INCR + EXPIRE.",
    competencyDomains: ["security_reasoning", "api_structure"],
  }),

  // ── Route handler runtime ───────────────────────────────────────
  L({
    id: "ROUTE-01",
    title: "Node-only imports in a route handler without runtime='nodejs'",
    category: "Next.js · Runtime",
    format: "ts",
    difficulty: 4,
    guard: "type_check",
    filePathHint: "src/app/api/pdf/route.ts",
    mockFailingCode: `import fs from "node:fs";
import { Client } from "pg";
export async function GET() {
  const c = new Client(); await c.connect();
  const buf = fs.readFileSync("/tmp/report.pdf");
  return new Response(buf, { headers: { "Content-Type": "application/pdf" } });
}`,
    expectedFailureSignals: ["missing runtime = nodejs", "edge runtime by default", "node:fs not available on edge"],
    correctedSolution: `export const runtime = "nodejs";
export const dynamic = "force-dynamic";
import fs from "node:fs";
import { Client } from "pg";
export async function GET() {
  const c = new Client();
  try {
    await c.connect();
    const buf = fs.readFileSync("/tmp/report.pdf");
    return new Response(buf, { headers: { "Content-Type": "application/pdf" } });
  } finally {
    try { await c.end(); } catch { /* ignore */ }
  }
}`,
    teaching: "Next.js App Router route handlers can default to the edge runtime depending on config. \`node:fs\`, \`pg\`, and other Node-only modules break on edge. Declare \`export const runtime = 'nodejs'\` at the top of any handler that needs them. Also close pg clients in finally.",
    competencyDomains: ["api_structure"],
  }),

  // ── Streaming SSE ───────────────────────────────────────────────
  L({
    id: "SSE-01",
    title: "SSE stream without keepalive or unsubscribe handling",
    category: "Streaming · SSE",
    format: "ts",
    difficulty: 6,
    guard: "guardian",
    filePathHint: "src/app/api/stream/route.ts",
    mockFailingCode: `export const runtime = "nodejs";
export async function GET() {
  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    async start(controller) {
      for (let i = 0; i < 100; i++) {
        controller.enqueue(encoder.encode(\`data: \${i}\\n\\n\`));
        await new Promise((r) => setTimeout(r, 5000));    // ← 5s gap · proxy will drop
      }
      controller.close();
    },
  });
  return new Response(stream, { headers: { "Content-Type": "text/event-stream" } });
}`,
    expectedFailureSignals: ["no keepalive comment", "no cancel handler", "proxy timeout", "connection closed unhandled"],
    correctedSolution: `export const runtime = "nodejs";
export async function GET(req: Request) {
  const encoder = new TextEncoder();
  let cancelled = false;
  const stream = new ReadableStream({
    async start(controller) {
      const keepalive = setInterval(() => {
        if (!cancelled) controller.enqueue(encoder.encode(": keepalive\\n\\n"));
      }, 15_000);
      req.signal.addEventListener("abort", () => { cancelled = true; clearInterval(keepalive); });
      for (let i = 0; i < 100 && !cancelled; i++) {
        controller.enqueue(encoder.encode(\`data: \${i}\\n\\n\`));
        await new Promise((r) => setTimeout(r, 5000));
      }
      clearInterval(keepalive);
      controller.close();
    },
  });
  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache, no-transform",
      "Connection": "keep-alive",
    },
  });
}`,
    teaching: "SSE needs (1) a keepalive comment every 15-25s so proxies don't idle-drop it, (2) an abort handler that stops the loop when the client disconnects, and (3) Cache-Control: no-cache, no-transform so intermediaries don't buffer.",
    competencyDomains: ["api_structure", "self_repair"],
  }),

  // ── Testing / vitest ────────────────────────────────────────────
  L({
    id: "TEST-01",
    title: "Flaky test · setTimeout inside expect · non-deterministic",
    category: "Testing",
    format: "ts",
    difficulty: 4,
    guard: "test_runner",
    filePathHint: "src/lib/queue.test.ts",
    mockFailingCode: `import { describe, it, expect } from "vitest";
import { runJob } from "./queue";
describe("queue", () => {
  it("runs job", () => {
    let done = false;
    runJob(() => { done = true; });
    setTimeout(() => { expect(done).toBe(true); }, 100);  // ← expect fires after test ended
  });
});`,
    expectedFailureSignals: ["setTimeout in test", "async without await", "flaky test", "expect outside test window"],
    correctedSolution: `import { describe, it, expect } from "vitest";
import { runJob } from "./queue";
describe("queue", () => {
  it("runs job", async () => {
    let done = false;
    await new Promise<void>((resolve) => {
      runJob(() => { done = true; resolve(); });
    });
    expect(done).toBe(true);
  });
});`,
    teaching: "setTimeout inside a test doesn't hold the test open. The test function returns immediately, vitest calls it a pass, then the assertion fires afterwards into the void. Use async/await with a promise the runJob callback resolves — that way the test actually waits.",
    competencyDomains: ["testing", "self_repair"],
  }),
  L({
    id: "TEST-02",
    title: "Test writes to shared DB without cleanup · pollutes next test",
    category: "Testing",
    format: "ts",
    difficulty: 5,
    guard: "test_runner",
    filePathHint: "src/lib/user.test.ts",
    mockFailingCode: `import { describe, it, expect } from "vitest";
import { Client } from "pg";
describe("users", () => {
  const c = new Client();
  it("inserts a user", async () => {
    await c.connect();
    await c.query("INSERT INTO users (email) VALUES ('a@x.com')");
    const r = await c.query("SELECT count(*) FROM users");
    expect(Number(r.rows[0].count)).toBeGreaterThan(0);
  });
});`,
    expectedFailureSignals: ["no cleanup", "shared state", "no beforeEach afterEach", "test pollution"],
    correctedSolution: `import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { Client } from "pg";
describe("users", () => {
  let c: Client;
  beforeEach(async () => {
    c = new Client();
    await c.connect();
    await c.query("BEGIN");
  });
  afterEach(async () => {
    await c.query("ROLLBACK");
    await c.end();
  });
  it("inserts a user", async () => {
    await c.query("INSERT INTO users (email) VALUES ($1)", ["a@x.com"]);
    const r = await c.query("SELECT count(*) FROM users WHERE email = $1", ["a@x.com"]);
    expect(Number(r.rows[0].count)).toBe(1);
  });
});`,
    teaching: "Tests that share DB state pollute each other. Wrap each test in BEGIN/ROLLBACK so nothing persists. Parameterise queries so the assertion is scoped to what this specific test inserted. Never rely on 'greater than 0' when other tests seeded rows earlier.",
    competencyDomains: ["testing", "database_reasoning"],
  }),
  L({
    id: "TEST-03",
    title: "Missing edge-case coverage · test only happy path",
    category: "Testing",
    format: "ts",
    difficulty: 3,
    guard: "test_runner",
    filePathHint: "src/lib/parse-currency.test.ts",
    mockFailingCode: `import { describe, it, expect } from "vitest";
import { parseCurrency } from "./parse-currency";
describe("parseCurrency", () => {
  it("parses positive amount", () => {
    expect(parseCurrency("£12.50")).toBe(12.5);
  });
});`,
    expectedFailureSignals: ["only happy path", "missing edge cases", "no negatives", "no invalid input", "coverage gap"],
    correctedSolution: `import { describe, it, expect } from "vitest";
import { parseCurrency } from "./parse-currency";
describe("parseCurrency", () => {
  it("parses positive amount", () => {
    expect(parseCurrency("£12.50")).toBe(12.5);
  });
  it("parses zero", () => {
    expect(parseCurrency("£0.00")).toBe(0);
  });
  it("parses negative amount", () => {
    expect(parseCurrency("-£5.00")).toBe(-5);
  });
  it("throws on empty string", () => {
    expect(() => parseCurrency("")).toThrow();
  });
  it("throws on malformed input", () => {
    expect(() => parseCurrency("not a price")).toThrow();
  });
  it("handles pence-only", () => {
    expect(parseCurrency("50p")).toBe(0.5);
  });
  it("handles thousands separator", () => {
    expect(parseCurrency("£1,234.56")).toBe(1234.56);
  });
});`,
    teaching: "One happy-path test proves nothing about robustness. Every parser needs: zero, negative, empty, malformed, and format variants. A test suite with only positive cases is decoration, not coverage. Aim for the failure modes that would break in production.",
    competencyDomains: ["testing", "reasoning_diagnosis"],
  }),
  L({
    id: "TEST-04",
    title: "Snapshot test asserts nothing meaningful · brittle to whitespace",
    category: "Testing",
    format: "tsx",
    difficulty: 4,
    guard: "test_runner",
    filePathHint: "src/components/Card.test.tsx",
    mockFailingCode: `import { describe, it, expect } from "vitest";
import { render } from "@testing-library/react";
import { Card } from "./Card";
describe("Card", () => {
  it("renders", () => {
    const { container } = render(<Card title="Hi" body="hello world" />);
    expect(container.innerHTML).toMatchSnapshot();   // ← breaks on every attr order shuffle
  });
});`,
    expectedFailureSignals: ["snapshot too broad", "innerHTML brittle", "asserts nothing specific", "breaks on whitespace"],
    correctedSolution: `import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { Card } from "./Card";
describe("Card", () => {
  it("shows the title and body", () => {
    render(<Card title="Hi" body="hello world" />);
    expect(screen.getByRole("heading", { name: "Hi" })).toBeInTheDocument();
    expect(screen.getByText("hello world")).toBeInTheDocument();
  });
  it("marks the card as region for a11y", () => {
    render(<Card title="Hi" body="hello world" />);
    expect(screen.getByRole("region")).toBeInTheDocument();
  });
});`,
    teaching: "innerHTML snapshots break whenever React reorders attributes or Tailwind changes class order. Assert on user-visible behaviour instead: findable by role/text/label. Every assertion should map to something a user could see or interact with.",
    competencyDomains: ["testing", "ui_dna_reasoning"],
  }),

  // ── Crypto ──────────────────────────────────────────────────────
  L({
    id: "CRYPTO-01",
    title: "AES-CBC with reused IV · pattern leakage / plaintext recovery",
    category: "Security · Crypto",
    format: "ts",
    difficulty: 8,
    guard: "security",
    filePathHint: "src/lib/crypto/encrypt.ts",
    mockFailingCode: `import crypto from "node:crypto";
const KEY = Buffer.from(process.env.ENC_KEY!, "hex");
const IV = Buffer.alloc(16, 0);   // ← constant IV across every encryption
export function encrypt(plaintext: string): string {
  const c = crypto.createCipheriv("aes-256-cbc", KEY, IV);
  return Buffer.concat([c.update(plaintext, "utf8"), c.final()]).toString("base64");
}`,
    expectedFailureSignals: ["IV reused", "constant IV", "CBC without random IV", "prefer GCM"],
    correctedSolution: `import crypto from "node:crypto";
const KEY = Buffer.from(process.env.ENC_KEY!, "hex");    // 32 bytes
export function encrypt(plaintext: string): string {
  const iv = crypto.randomBytes(12);
  const c = crypto.createCipheriv("aes-256-gcm", KEY, iv);
  const enc = Buffer.concat([c.update(plaintext, "utf8"), c.final()]);
  const tag = c.getAuthTag();
  // iv || tag || ciphertext, all base64
  return Buffer.concat([iv, tag, enc]).toString("base64");
}
export function decrypt(payload: string): string {
  const buf = Buffer.from(payload, "base64");
  const iv = buf.subarray(0, 12);
  const tag = buf.subarray(12, 28);
  const enc = buf.subarray(28);
  const d = crypto.createDecipheriv("aes-256-gcm", KEY, iv);
  d.setAuthTag(tag);
  return Buffer.concat([d.update(enc), d.final()]).toString("utf8");
}`,
    teaching: "Reused IV in CBC leaks structure and, with certain plaintexts, enables full recovery. Use AES-GCM: authenticated encryption, 96-bit random IV per message, 128-bit auth tag preventing bit-flipping. Store iv||tag||ct together so decrypt knows where each part starts.",
    competencyDomains: ["security_reasoning"],
  }),
];

// ─── Corpus stats + helpers ────────────────────────────────────────
export function corpusStats() {
  const total = ADVERSARIAL_CORPUS.length;
  const byGuard = ADVERSARIAL_CORPUS.reduce<Record<string, number>>((acc, l) => {
    acc[l.guard] = (acc[l.guard] ?? 0) + 1;
    return acc;
  }, {});
  const byFormat = ADVERSARIAL_CORPUS.reduce<Record<string, number>>((acc, l) => {
    acc[l.format] = (acc[l.format] ?? 0) + 1;
    return acc;
  }, {});
  const byDifficulty = ADVERSARIAL_CORPUS.reduce<Record<number, number>>((acc, l) => {
    acc[l.difficulty] = (acc[l.difficulty] ?? 0) + 1;
    return acc;
  }, {});
  return { total, byGuard, byFormat, byDifficulty };
}

export function lessonById(id: string): AdversarialLesson | null {
  return ADVERSARIAL_CORPUS.find((l) => l.id === id) ?? null;
}

/**
 * Deterministic grader · returns pass if NEX1's response mentions the expected
 * failure signals OR its correctedCode contains structural indicators of a fix.
 * Not a semantic grader · just a first-pass regex-style check. Master AI +
 * Claude review remain the human-level graders.
 */
export function gradeAttempt(lesson: AdversarialLesson, attempt: {
  diagnosisText: string;
  correctedCode?: string;
}): { verdict: "pass" | "partial" | "fail"; matchedSignals: string[]; missedSignals: string[]; notes: string } {
  const text = attempt.diagnosisText.toLowerCase();
  const matched: string[] = [];
  const missed: string[] = [];
  for (const sig of lesson.expectedFailureSignals) {
    if (text.includes(sig.toLowerCase())) matched.push(sig);
    else missed.push(sig);
  }
  const structuralHint = attempt.correctedCode && lesson.correctedSolution
    ? (() => {
        // rough overlap heuristic: %-of-lines in corrected that appear in attempt
        const cs = lesson.correctedSolution.split("\n").map((l) => l.trim()).filter(Boolean);
        const as = new Set(attempt.correctedCode.split("\n").map((l) => l.trim()));
        const overlap = cs.filter((l) => as.has(l)).length;
        return cs.length === 0 ? 0 : overlap / cs.length;
      })()
    : 0;
  const signalRate = matched.length / lesson.expectedFailureSignals.length;
  const verdict: "pass" | "partial" | "fail" =
    signalRate >= 0.7 && structuralHint >= 0.4 ? "pass"
    : signalRate >= 0.4 || structuralHint >= 0.4 ? "partial"
    : "fail";
  return {
    verdict, matchedSignals: matched, missedSignals: missed,
    notes: `signal_match=${(signalRate * 100).toFixed(0)}% · structural_overlap=${(structuralHint * 100).toFixed(0)}%`,
  };
}
