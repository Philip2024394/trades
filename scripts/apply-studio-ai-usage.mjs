// One-shot migration applier for studio_ai_usage.
// Reads token from ../hammer/.env.tools.local (shared Supabase project).

import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";

const __dir = dirname(fileURLToPath(import.meta.url));
const envPath = resolve(__dir, "..", "..", "hammer", ".env.tools.local");
const envText = await readFile(envPath, "utf8");
const token = envText.match(/^SUPABASE_ACCESS_TOKEN=(.+)$/m)[1].trim();

const sql = await readFile(
  resolve(__dir, "..", "supabase", "migrations", "20260718100000_studio_ai_usage.sql"),
  "utf8"
);

const ref = "msdonkkechxzgagyguoe";
const res = await fetch(
  `https://api.supabase.com/v1/projects/${ref}/database/query`,
  {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({ query: sql })
  }
);
const text = await res.text();
console.log("HTTP", res.status);
console.log(text);
if (!res.ok) process.exit(1);
