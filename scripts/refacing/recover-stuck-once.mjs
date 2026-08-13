// One-off: run the stuck-processing recovery now (bypass the need to wait
// for the next Process Now click). Safe to re-run · idempotent.

import { readFileSync } from "node:fs";
import { createClient } from "@supabase/supabase-js";
import { join } from "node:path";

const raw = readFileSync(join(process.cwd(), ".env.local"), "utf8");
for (const line of raw.split(/\r?\n/)) {
  const m = line.match(/^([A-Z0-9_]+)\s*=\s*(.*)$/);
  if (m && !(m[1] in process.env)) process.env[m[1]] = m[2].replace(/^["'](.*)["']$/, "$1");
}
const sb = createClient(process.env.NEXT_PUBLIC_NEX_SUPABASE_URL, process.env.NEX_SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false, autoRefreshToken: false } });

const cutoff = new Date(Date.now() - 30 * 60 * 1000).toISOString();
const res = await sb.from("nex_collection_url_queue")
  .update({
    status: "queued",
    processing_started_at: null,
    last_error: `auto_recovered: stuck in processing > 30min at ${new Date().toISOString()}`,
  })
  .eq("status", "processing")
  .lt("processing_started_at", cutoff)
  .select("id, candidate_url");
if (res.error) { console.error("[recover]", res.error); process.exit(1); }
console.log(`Recovered ${res.data?.length ?? 0} stuck row(s):`);
for (const r of res.data ?? []) console.log("  -", r.candidate_url);
