#!/usr/bin/env node
// scripts/scan-routes.mjs — Route inventory generator.
//
// Walks src/app/**/page.tsx and emits a structured list of every route
// in the codebase. Two outputs:
//   • docs/route-inventory.json — machine-readable, one entry per route
//   • docs/route-inventory.md   — human-readable table, grouped by top-level
//                                 segment for quick eyeballing
//
// Purpose: before scaffolding ANY new route with a conceptual name
// (canteen, marketplace, dashboard, prices, profile, etc.), run this
// script (or read the checked-in inventory files) so you can see if
// the concept already exists. If it does — extend, don't duplicate.
//
// Usage:
//   node scripts/scan-routes.mjs
//   node scripts/scan-routes.mjs --search canteen
//
// Options:
//   --search <term>   Only include routes whose URL contains <term>
//   --json-only       Skip the Markdown output
//   --md-only         Skip the JSON output

import { readdir, readFile, writeFile, mkdir, stat } from "node:fs/promises";
import { existsSync } from "node:fs";
import { join, relative, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, "..");
const APP_DIR = join(ROOT, "src", "app");
const DOCS_DIR = join(ROOT, "docs");

// Groups let the Markdown output cluster related routes so a human can
// scan for "which system owns this concept" at a glance.
const TOP_LEVEL_GROUPS = {
  "tc": "Trade Center",
  "trade-off": "Yard / Trade-off (legacy — becoming Trade Center)",
  "trade": "Public trade profile",
  "canteen": "Per-trade canteens (NEW — 2026-07-12)",
  "community": "Community compat (redirect shim)",
  "api": "API routes (excluded from grouped view)",
  "auth": "Auth flows",
  "home": "Home / landing surfaces",
  "join": "Signup funnel",
  "join-family": "Signup funnel (family)",
  "hero-swap-demo": "Dev sandbox",
  "live-edit-demo": "Dev sandbox"
};

async function walkAppDir(dir) {
  const routes = [];
  async function recurse(current) {
    const entries = await readdir(current, { withFileTypes: true });
    for (const entry of entries) {
      const full = join(current, entry.name);
      if (entry.isDirectory()) {
        // Skip route groups' parentheses and internal folders that
        // Next.js ignores at routing time.
        if (entry.name.startsWith("_")) continue;
        await recurse(full);
      } else if (entry.name === "page.tsx" || entry.name === "page.ts") {
        routes.push(full);
      }
    }
  }
  await recurse(dir);
  return routes;
}

function filepathToUrl(filepath) {
  const rel = relative(APP_DIR, filepath).replace(/\\/g, "/");
  const segments = rel.split("/").slice(0, -1); // drop page.tsx
  // Strip Next.js route groups (parenthesised folders).
  const filtered = segments.filter((s) => !(s.startsWith("(") && s.endsWith(")")));
  const url = "/" + filtered.join("/");
  return url === "//" ? "/" : url;
}

function topLevelSegment(url) {
  const first = url.split("/").filter(Boolean)[0] ?? "(root)";
  return first;
}

async function peekPurpose(filepath) {
  // Read the first 20 lines of the page file to lift the top comment as
  // a purpose hint. Not perfect but useful when the page has a header
  // block explaining what it does.
  try {
    const raw = await readFile(filepath, "utf8");
    const lines = raw.split(/\r?\n/).slice(0, 20);
    const commentLines = [];
    let inBlock = false;
    for (const line of lines) {
      const trimmed = line.trim();
      if (trimmed.startsWith("//")) {
        commentLines.push(trimmed.replace(/^\/\/\s?/, ""));
      } else if (trimmed.startsWith("/*")) {
        inBlock = true;
        commentLines.push(trimmed.replace(/^\/\*+\s?/, ""));
      } else if (inBlock) {
        if (trimmed.includes("*/")) {
          inBlock = false;
          commentLines.push(trimmed.replace(/\*+\/\s*$/, "").replace(/^\*+\s?/, ""));
          break;
        }
        commentLines.push(trimmed.replace(/^\*+\s?/, ""));
      } else if (commentLines.length > 0) {
        break; // Header comment ended.
      }
    }
    return commentLines
      .join(" ")
      .replace(/\s+/g, " ")
      .trim()
      .slice(0, 220);
  } catch {
    return "";
  }
}

async function generate({ search, jsonOnly, mdOnly }) {
  const files = await walkAppDir(APP_DIR);
  const entries = [];
  for (const filepath of files) {
    const url = filepathToUrl(filepath);
    if (search && !url.toLowerCase().includes(search.toLowerCase())) continue;
    const purpose = await peekPurpose(filepath);
    entries.push({
      url,
      file: relative(ROOT, filepath).replace(/\\/g, "/"),
      topLevel: topLevelSegment(url),
      purpose
    });
  }
  entries.sort((a, b) => a.url.localeCompare(b.url));

  if (!existsSync(DOCS_DIR)) await mkdir(DOCS_DIR, { recursive: true });

  if (!mdOnly) {
    const json = {
      generatedAt: new Date().toISOString(),
      totalRoutes: entries.length,
      searchFilter: search ?? null,
      routes: entries
    };
    await writeFile(join(DOCS_DIR, "route-inventory.json"), JSON.stringify(json, null, 2));
  }

  if (!jsonOnly) {
    const grouped = new Map();
    for (const e of entries) {
      const g = TOP_LEVEL_GROUPS[e.topLevel] ?? e.topLevel;
      if (!grouped.has(g)) grouped.set(g, []);
      grouped.get(g).push(e);
    }
    let md = `# Route inventory\n\n_Generated by \`scripts/scan-routes.mjs\` on ${new Date().toISOString()}_\n\n`;
    md += `Total routes: **${entries.length}**${search ? ` (filtered by \`${search}\`)` : ""}\n\n`;
    md += `> **Read this before scaffolding any new page.** Look up the concept you're about to build. If a route already exists that owns the concept, extend it — do not duplicate.\n\n`;
    for (const [group, list] of [...grouped.entries()].sort()) {
      md += `## ${group}\n\n`;
      md += `| URL | Purpose (from source comment) | File |\n`;
      md += `|---|---|---|\n`;
      for (const e of list) {
        const escapedPurpose = (e.purpose || "_(no header comment)_").replace(/\|/g, "\\|");
        md += `| \`${e.url}\` | ${escapedPurpose} | \`${e.file}\` |\n`;
      }
      md += `\n`;
    }
    await writeFile(join(DOCS_DIR, "route-inventory.md"), md);
  }

  console.log(`Scanned ${entries.length} routes.`);
  if (!jsonOnly) console.log(`  → docs/route-inventory.md`);
  if (!mdOnly) console.log(`  → docs/route-inventory.json`);
}

const args = process.argv.slice(2);
const searchIdx = args.indexOf("--search");
const search = searchIdx >= 0 ? args[searchIdx + 1] : null;
const jsonOnly = args.includes("--json-only");
const mdOnly = args.includes("--md-only");

generate({ search, jsonOnly, mdOnly }).catch((err) => {
  console.error(err);
  process.exit(1);
});
