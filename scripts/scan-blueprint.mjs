#!/usr/bin/env node
// scan-blueprint.mjs
//
// Walks the codebase and emits docs/BLUEPRINT.md — a single-page map
// of the entire application. Run at the end of every meaningful
// change so a fresh Claude session (or a new engineer) can reconstruct
// the app in 30 seconds.
//
// What it captures:
//   1. Apps       — every src/apps/{name}/ with manifest.ts if present
//   2. Lib domains — every src/lib/{name}/ subfolder
//   3. Platform  — every src/platform/{area}/ subfolder
//   4. Routes    — every src/app/**/page.tsx path
//   5. APIs      — every src/app/api/**/route.ts endpoint
//   6. Migrations — every supabase/migrations/*.sql in order
//   7. Crons     — vercel.json cron entries
//
// Reads the first non-empty leading comment block from each file to
// use as a summary. If a README.md exists in the folder, that's
// preferred over the code comment.
//
// Zero dependencies — Node built-ins only.

import { readdirSync, readFileSync, existsSync, statSync, writeFileSync, mkdirSync } from "node:fs";
import { join, relative, sep } from "node:path";

const ROOT = process.cwd();
const SRC = join(ROOT, "src");
const OUT = join(ROOT, "docs");
const OUT_FILE = join(OUT, "BLUEPRINT.md");

function safeReaddir(dir) {
  try { return readdirSync(dir, { withFileTypes: true }); }
  catch { return []; }
}

function readFirstComment(file) {
  try {
    const raw = readFileSync(file, "utf-8");
    // Match a JS/TS leading comment block: // lines up to the first
    // blank line OR a /** ... */ JSDoc block. Strip the // or *.
    const lines = raw.split(/\r?\n/);
    const chunks = [];
    let inBlock = false;
    for (const line of lines) {
      const trimmed = line.trim();
      if (!inBlock && trimmed === "") {
        if (chunks.length > 0) break;
        continue;
      }
      if (trimmed.startsWith("/*")) {
        inBlock = true;
        const strip = trimmed.replace(/^\/\*+/, "").replace(/\*+\/$/, "").trim();
        if (strip) chunks.push(strip);
        continue;
      }
      if (inBlock) {
        if (trimmed.endsWith("*/")) {
          inBlock = false;
          const strip = trimmed.replace(/\*+\/$/, "").replace(/^\*+\s?/, "").trim();
          if (strip) chunks.push(strip);
          break;
        }
        chunks.push(trimmed.replace(/^\*+\s?/, ""));
        continue;
      }
      if (trimmed.startsWith("//")) {
        chunks.push(trimmed.replace(/^\/\/\s?/, ""));
        continue;
      }
      break;
    }
    const summary = chunks.join(" ").trim();
    if (!summary) return "";
    // Cap to a single short paragraph.
    return summary.length > 240 ? summary.slice(0, 237) + "…" : summary;
  } catch {
    return "";
  }
}

function readReadme(dir) {
  const path = join(dir, "README.md");
  if (!existsSync(path)) return "";
  try {
    const raw = readFileSync(path, "utf-8");
    // Skip the title and first blank line, take the first paragraph.
    const lines = raw.split(/\r?\n/);
    let started = false;
    const buf = [];
    for (const l of lines) {
      const t = l.trim();
      if (!started) {
        if (t.startsWith("#") || t === "") continue;
        started = true;
      }
      if (t === "") break;
      buf.push(t);
    }
    const summary = buf.join(" ").trim();
    return summary.length > 240 ? summary.slice(0, 237) + "…" : summary;
  } catch {
    return "";
  }
}

// ─── Apps (src/apps/*/) ─────────────────────────────────────

function scanApps() {
  const dir = join(SRC, "apps");
  const rows = [];
  for (const entry of safeReaddir(dir)) {
    if (!entry.isDirectory()) continue;
    const appDir = join(dir, entry.name);
    const manifest = join(appDir, "manifest.ts");
    let summary = readReadme(appDir);
    if (!summary && existsSync(manifest)) summary = readFirstComment(manifest);
    if (!summary) {
      // Fallback: try any index/page/main file.
      for (const guess of ["index.ts", "index.tsx", "page.tsx"]) {
        const f = join(appDir, guess);
        if (existsSync(f)) { summary = readFirstComment(f); break; }
      }
    }
    rows.push({ name: entry.name, summary, hasManifest: existsSync(manifest) });
  }
  return rows.sort((a, b) => a.name.localeCompare(b.name));
}

// ─── Lib domains (src/lib/*) ────────────────────────────────

function scanLib() {
  const dir = join(SRC, "lib");
  const rows = [];
  for (const entry of safeReaddir(dir)) {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) {
      let summary = readReadme(path);
      if (!summary) {
        for (const guess of ["index.ts", "index.tsx"]) {
          const f = join(path, guess);
          if (existsSync(f)) { summary = readFirstComment(f); break; }
        }
      }
      rows.push({ name: entry.name, kind: "folder", summary });
    } else if (entry.name.endsWith(".ts") || entry.name.endsWith(".tsx")) {
      const summary = readFirstComment(path);
      rows.push({ name: entry.name.replace(/\.tsx?$/, ""), kind: "file", summary });
    }
  }
  return rows.sort((a, b) => a.name.localeCompare(b.name));
}

// ─── Platform (src/platform/*) ──────────────────────────────

function scanPlatform() {
  const dir = join(SRC, "platform");
  const rows = [];
  for (const entry of safeReaddir(dir)) {
    if (!entry.isDirectory()) continue;
    const path = join(dir, entry.name);
    let summary = readReadme(path);
    if (!summary) {
      for (const guess of ["index.ts", "types.ts", "registry.ts"]) {
        const f = join(path, guess);
        if (existsSync(f)) { summary = readFirstComment(f); break; }
      }
    }
    rows.push({ name: entry.name, summary });
  }
  return rows.sort((a, b) => a.name.localeCompare(b.name));
}

// ─── Routes (src/app/**/page.tsx) ───────────────────────────

function scanRoutes(base = join(SRC, "app"), routes = []) {
  for (const entry of safeReaddir(base)) {
    const path = join(base, entry.name);
    if (entry.isDirectory()) {
      // Skip route groups' internal folders? No — we still want them.
      scanRoutes(path, routes);
    } else if (entry.name === "page.tsx" || entry.name === "page.ts") {
      const rel = relative(join(SRC, "app"), base).split(sep).join("/");
      const url = rel === "" ? "/" : "/" + rel.replace(/\(([^)]+)\)\//g, "").replace(/\(([^)]+)\)$/g, "");
      const summary = readFirstComment(path);
      routes.push({ url, summary });
    }
  }
  return routes;
}

// ─── APIs (src/app/api/**/route.ts) ─────────────────────────

function scanApis(base = join(SRC, "app", "api"), apis = []) {
  for (const entry of safeReaddir(base)) {
    const path = join(base, entry.name);
    if (entry.isDirectory()) {
      scanApis(path, apis);
    } else if (entry.name === "route.ts" || entry.name === "route.js") {
      const rel = relative(join(SRC, "app", "api"), base).split(sep).join("/");
      const url = "/api/" + rel;
      const summary = readFirstComment(path);
      apis.push({ url, summary });
    }
  }
  return apis;
}

// ─── Migrations ─────────────────────────────────────────────

function scanMigrations() {
  const dir = join(ROOT, "supabase", "migrations");
  const rows = [];
  for (const entry of safeReaddir(dir)) {
    if (!entry.isFile() || !entry.name.endsWith(".sql")) continue;
    const path = join(dir, entry.name);
    const raw = readFileSync(path, "utf-8");
    // Read the first non-empty comment line.
    const first = raw.split(/\r?\n/).find((l) => l.trim().startsWith("--")) ?? "";
    const summary = first.replace(/^--\s?/, "").trim();
    rows.push({ file: entry.name, summary });
  }
  return rows.sort((a, b) => a.file.localeCompare(b.file));
}

// ─── Crons (vercel.json) ────────────────────────────────────

function scanCrons() {
  const path = join(ROOT, "vercel.json");
  try {
    const raw = JSON.parse(readFileSync(path, "utf-8"));
    return (raw.crons ?? []).map((c) => ({ path: c.path, schedule: c.schedule }));
  } catch { return []; }
}

// ─── Emit ───────────────────────────────────────────────────

function emit() {
  const now = new Date().toISOString().slice(0, 19).replace("T", " ");
  const apps = scanApps();
  const lib = scanLib();
  const platform = scanPlatform();
  const routes = scanRoutes();
  const apis = scanApis();
  const migrations = scanMigrations();
  const crons = scanCrons();

  let md = "";
  md += "# Application Blueprint\n\n";
  md += `_Auto-generated by \`scripts/scan-blueprint.mjs\` on ${now} UTC._\n\n`;
  md += "This document maps the entire application at a glance. Run the scanner after every meaningful change. Every entry pulls its summary from the file's own leading comment or the folder's `README.md`, so keeping this fresh means keeping comments and READMEs fresh.\n\n";
  md += "**Snapshot:** ";
  md += `${apps.length} apps · ${lib.length} lib entries · ${platform.length} platform areas · `;
  md += `${routes.length} pages · ${apis.length} API endpoints · ${migrations.length} migrations · ${crons.length} crons.\n\n`;

  md += "---\n\n## Apps (`src/apps/`)\n\n";
  md += "Manifest-first apps. Each is a self-contained feature module.\n\n";
  md += "| App | Manifest? | Summary |\n|---|---|---|\n";
  for (const a of apps) {
    md += `| \`${a.name}\` | ${a.hasManifest ? "✓" : "—"} | ${a.summary || "_(no summary)_"} |\n`;
  }

  md += "\n---\n\n## Platform (`src/platform/`)\n\n";
  md += "Cross-cutting platform infrastructure — themes, runtime, registry, etc.\n\n";
  md += "| Area | Summary |\n|---|---|\n";
  for (const p of platform) {
    md += `| \`${p.name}\` | ${p.summary || "_(no summary)_"} |\n`;
  }

  md += "\n---\n\n## Lib (`src/lib/`)\n\n";
  md += "Shared utilities and domain logic.\n\n";
  md += "| Entry | Kind | Summary |\n|---|---|---|\n";
  for (const l of lib) {
    md += `| \`${l.name}\` | ${l.kind} | ${l.summary || "_(no summary)_"} |\n`;
  }

  md += "\n---\n\n## Pages (`src/app/**/page.tsx`)\n\n";
  md += `Every server-rendered page in the app (${routes.length} total). URLs shown as they resolve after route-group brackets are stripped.\n\n`;
  md += "| URL | Summary |\n|---|---|\n";
  for (const r of routes) {
    md += `| \`${r.url}\` | ${r.summary || ""} |\n`;
  }

  md += "\n---\n\n## API endpoints (`src/app/api/**/route.ts`)\n\n";
  md += `Every API handler (${apis.length} total).\n\n`;
  md += "| Endpoint | Summary |\n|---|---|\n";
  for (const a of apis) {
    md += `| \`${a.url}\` | ${a.summary || ""} |\n`;
  }

  md += "\n---\n\n## Migrations (`supabase/migrations/`)\n\n";
  md += `Ordered database migrations (${migrations.length} total).\n\n`;
  md += "| File | Purpose |\n|---|---|\n";
  for (const m of migrations) {
    md += `| \`${m.file}\` | ${m.summary || ""} |\n`;
  }

  md += "\n---\n\n## Crons (`vercel.json`)\n\n";
  md += `Scheduled tasks (${crons.length} total). Cron syntax: minute hour day month day-of-week.\n\n`;
  md += "| Path | Schedule |\n|---|---|\n";
  for (const c of crons) {
    md += `| \`${c.path}\` | \`${c.schedule}\` |\n`;
  }

  md += "\n---\n\n## How to keep this fresh\n\n";
  md += "1. Run `node scripts/scan-blueprint.mjs` after every meaningful change.\n";
  md += "2. When you add a new app / lib / platform area, add a `README.md` to its folder with a 1-line summary in the second paragraph.\n";
  md += "3. When you add a new page / API route / migration, put a `//` or `--` leading comment describing what it does.\n";
  md += "4. The scanner picks all of that up automatically — this doc regenerates in ~2 seconds.\n";

  if (!existsSync(OUT)) mkdirSync(OUT, { recursive: true });
  writeFileSync(OUT_FILE, md, "utf-8");

  console.log(`Wrote ${relative(ROOT, OUT_FILE)} — ${apps.length} apps, ${lib.length} lib, ${platform.length} platform, ${routes.length} pages, ${apis.length} apis, ${migrations.length} migrations, ${crons.length} crons.`);
}

emit();
