import { readFileSync } from "node:fs";
import { createClient } from "@supabase/supabase-js";
const envText = readFileSync("C:\\Users\\Victus\\trades\\.env.local", "utf-8");
function e(name) { return envText.match(new RegExp(`^${name}=(.+)$`, "m"))[1].trim().replace(/^["']|["']$/g, ""); }
const sb = createClient(e("NEXT_PUBLIC_SUPABASE_URL"), e("SUPABASE_SERVICE_ROLE_KEY"), { auth: { persistSession: false } });

// For every cluster of jobs started within 5s of each other, keep the
// first and delete the rest (multi-click duplicates).
const brainId = "9354a294-c058-4a33-b2cd-1a8e54988d26";
const { data: jobs } = await sb.from("brain_sync_jobs")
  .select("id, started_at").eq("brain_id", brainId).order("started_at", { ascending: true });
if (!jobs || jobs.length <= 1) { console.log("Nothing to dedupe"); process.exit(0); }

let clusterAnchor = jobs[0];
let deleted = 0;
for (let i = 1; i < jobs.length; i++) {
  const job = jobs[i];
  const gapMs = new Date(job.started_at).getTime() - new Date(clusterAnchor.started_at).getTime();
  if (gapMs < 5000) {
    await sb.from("brain_sync_jobs").delete().eq("id", job.id);
    console.log(`✓ Deleted duplicate: ${job.id} (${gapMs}ms after cluster anchor ${clusterAnchor.id})`);
    deleted++;
  } else {
    clusterAnchor = job;
  }
}
console.log(`Done. Deleted ${deleted} duplicate job(s).`);
