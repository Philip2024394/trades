// src/lib/nex-native/first-conversation/__tests__/_load-env.ts
//
// Side-effect module: loads .env.local into process.env before any
// downstream test imports that need it (e.g. supabase-admin, which
// reads env at module-evaluation time and throws if missing).
//
// Import this FIRST in any Bridge 99 integration test:
//   import "./_load-env";
//   import { createSession } from "../session-registry-service";
//
// Node ES module semantics evaluate imports in source order, so this
// file runs before the next import statement, guaranteeing env is
// populated before supabase-admin loads.

import fs from "node:fs";
import path from "node:path";

const envPath = path.join(process.cwd(), ".env.local");
if (fs.existsSync(envPath)) {
  for (const line of fs.readFileSync(envPath, "utf8").split(/\r?\n/)) {
    const m = line.match(/^([A-Z0-9_]+)\s*=\s*(.*)$/);
    if (m && !process.env[m[1]]) {
      process.env[m[1]] = m[2].replace(/^["']|["']$/g, "");
    }
  }
}
