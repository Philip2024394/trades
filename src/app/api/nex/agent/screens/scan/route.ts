// src/app/api/nex/agent/screens/scan/route.ts
//
// Walks src/app/ recursively · returns every real page.tsx (Next.js App
// Router route) with derived URL + file metadata. NEX1 uses this list as
// reference for theme + UI consistency across the whole nexapp.
//
// Read-only · never mutates · never lists node_modules/.next/build folders.

import { NextResponse } from "next/server";
import { existsSync, readdirSync, statSync } from "node:fs";
import { resolve, join, relative, sep } from "node:path";
import { WORKSTATION_SEC_HEADERS, checkRateLimit, rateLimitKeyFor, detectBotUA } from "@/lib/nex-agent/anti-bot";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const APP_ROOT = "src/app";
const IGNORE_DIRS = new Set([
  "node_modules", ".next", ".git", "dist", "build", "coverage", ".vercel",
]);
const MAX_FILES = 500;

export interface ScannedScreen {
  readonly route: string;
  readonly filePath: string;   // repo-relative · forward-slash normalised
  readonly bytes: number;
  readonly modifiedAt: string;
  readonly hasLayout: boolean;
  readonly hasMetadata: boolean;
  readonly hasClientComponent: boolean;
  readonly section: string;    // top-level namespace · nexapp · nex-head-quarters · api · etc.
}

function normalisePath(p: string): string {
  return p.split(sep).join("/");
}

/**
 * Convert `src/app/nexapp/nex-agent/page.tsx` → `/nexapp/nex-agent`
 *   · strips `src/app/` prefix
 *   · strips trailing `/page.tsx`
 *   · strips route-groups like `(auth)`
 *   · converts `[id]` → `:id`
 *   · `page.tsx` at root → `/`
 */
function deriveRoute(filePathFromApp: string): string {
  // filePathFromApp is like "nexapp/nex-agent/page.tsx" or "page.tsx"
  const parts = filePathFromApp.split("/");
  if (parts[parts.length - 1] !== "page.tsx" && parts[parts.length - 1] !== "page.ts") return "";
  const segments = parts.slice(0, -1).filter((s) => !(s.startsWith("(") && s.endsWith(")")));
  if (segments.length === 0) return "/";
  return "/" + segments.map((s) => s.replace(/^\[([^\]]+)\]$/, ":$1")).join("/");
}

function isPageFile(name: string): boolean {
  return name === "page.tsx" || name === "page.ts";
}

/** Sync recursive walk · returns page.tsx files as repo-relative paths. */
function walkAppDir(root: string): string[] {
  const out: string[] = [];
  const stack: string[] = [root];
  while (stack.length > 0 && out.length < MAX_FILES) {
    const dir = stack.pop()!;
    let entries: string[];
    try { entries = readdirSync(dir); } catch { continue; }
    for (const e of entries) {
      if (IGNORE_DIRS.has(e)) continue;
      if (e.startsWith(".")) continue;
      const full = join(dir, e);
      let s: ReturnType<typeof statSync>;
      try { s = statSync(full); } catch { continue; }
      if (s.isDirectory()) stack.push(full);
      else if (s.isFile() && isPageFile(e)) out.push(full);
    }
  }
  return out;
}

/** Detect optional siblings + client-component signal via lightweight file checks. */
function inspectSiblings(filePath: string): Pick<ScannedScreen, "hasLayout" | "hasMetadata" | "hasClientComponent"> {
  const dir = filePath.slice(0, filePath.lastIndexOf(sep));
  const hasLayout = existsSync(join(dir, "layout.tsx")) || existsSync(join(dir, "layout.ts"));
  let hasMetadata = false;
  let hasClientComponent = false;
  try {
    // Peek first 4KB · avoid loading giant files
    const { readFileSync } = require("node:fs") as typeof import("node:fs");
    const head = readFileSync(filePath, { encoding: "utf8" }).slice(0, 4096);
    hasMetadata = /export\s+const\s+metadata\b|generateMetadata\s*\(/.test(head);
    hasClientComponent = /^\s*['"]use client['"]/m.test(head);
  } catch { /* ignore · not fatal */ }
  return { hasLayout, hasMetadata, hasClientComponent };
}

export async function GET(req: Request) {
  const rl = checkRateLimit(rateLimitKeyFor(req, "screens-scan"), { windowMs: 60_000, maxRequests: 30 });
  if (!rl.allowed) return NextResponse.json({ ok: false, error: rl.reason }, { status: 429, headers: WORKSTATION_SEC_HEADERS });
  const bot = detectBotUA(req.headers.get("user-agent"));
  if (bot.isBot) return NextResponse.json({ ok: false, error: bot.reason }, { status: 403, headers: WORKSTATION_SEC_HEADERS });

  const url = new URL(req.url);
  const sectionFilter = url.searchParams.get("section") ?? "";
  const appRoot = resolve(process.cwd(), APP_ROOT);
  if (!existsSync(appRoot)) {
    return NextResponse.json({ ok: false, error: "src/app not found" }, { status: 404, headers: WORKSTATION_SEC_HEADERS });
  }

  const files = walkAppDir(appRoot);
  const out: ScannedScreen[] = [];
  for (const f of files) {
    const relFromCwd = normalisePath(relative(process.cwd(), f));
    const relFromApp = normalisePath(relative(appRoot, f));
    const route = deriveRoute(relFromApp);
    if (!route) continue;
    const topSegment = route.split("/").filter(Boolean)[0] ?? "root";
    if (sectionFilter && topSegment !== sectionFilter) continue;
    let s: ReturnType<typeof statSync>;
    try { s = statSync(f); } catch { continue; }
    const siblings = inspectSiblings(f);
    out.push({
      route,
      filePath: relFromCwd,
      bytes: s.size,
      modifiedAt: s.mtime.toISOString(),
      section: topSegment,
      ...siblings,
    });
  }
  // Sort by route alphabetically · stable
  out.sort((a, b) => a.route.localeCompare(b.route));

  // Aggregate sections
  const sections = Array.from(new Set(out.map((s) => s.section))).sort();

  return NextResponse.json({
    ok: true,
    scanned_at: new Date().toISOString(),
    count: out.length,
    truncated: files.length >= MAX_FILES,
    sections,
    screens: out,
  }, { headers: { ...WORKSTATION_SEC_HEADERS, "Cache-Control": "no-store" } });
}
