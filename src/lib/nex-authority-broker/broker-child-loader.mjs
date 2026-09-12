// src/lib/nex-authority-broker/broker-child-loader.mjs
//
// Phase 8 T3-A · Node ESM resolver hook for the Broker child process.
// Zero third-party deps · pure Node module hook API.
//
// Responsibilities (narrow):
//   1. Resolve extension-less relative imports (`./foo`, `../foo`) to `.ts` when a `.ts` sibling exists.
//   2. Resolve TypeScript path alias `@/lib/…` → `<repo>/src/lib/…` (only the two we still use).
//
// This loader is intentionally minimal · it exists ONLY to let Node's built-in TS type-stripping
// run the Broker child process without introducing a runtime dep (tsx / ts-node / bundler).
// The T1 harness still runs under Next.js/Vitest which have their own resolvers.

import { existsSync, statSync } from "node:fs";
import { fileURLToPath, pathToFileURL } from "node:url";
import { resolve as pathResolve, dirname, extname } from "node:path";

const REPO_ROOT = pathResolve(fileURLToPath(new URL(".", import.meta.url)), "../../..");

export function resolve(specifier, context, nextResolve) {
  // Path alias: @/lib/... → REPO_ROOT/src/lib/...
  if (specifier.startsWith("@/")) {
    const stripped = specifier.slice(2);
    const abs = pathResolve(REPO_ROOT, "src", stripped);
    const withExt = pickExistingExtension(abs);
    if (withExt) return nextResolve(pathToFileURL(withExt).href, context);
  }

  // Relative import without extension → probe for .ts / .tsx / .mts / .js sibling
  if ((specifier.startsWith("./") || specifier.startsWith("../")) && extname(specifier) === "") {
    if (context.parentURL) {
      const parentPath = fileURLToPath(context.parentURL);
      const abs = pathResolve(dirname(parentPath), specifier);
      const withExt = pickExistingExtension(abs);
      if (withExt) return nextResolve(pathToFileURL(withExt).href, context);
    }
  }

  return nextResolve(specifier, context);
}

function pickExistingExtension(absPathWithoutExt) {
  const candidates = [".ts", ".tsx", ".mts", ".cts", ".js", ".mjs", ".cjs"];
  for (const ext of candidates) {
    const candidate = absPathWithoutExt + ext;
    if (existsSync(candidate) && statSync(candidate).isFile()) return candidate;
  }
  // Fall back to index files inside a directory
  if (existsSync(absPathWithoutExt) && statSync(absPathWithoutExt).isDirectory()) {
    for (const ext of candidates) {
      const idx = pathResolve(absPathWithoutExt, "index" + ext);
      if (existsSync(idx) && statSync(idx).isFile()) return idx;
    }
  }
  return null;
}
