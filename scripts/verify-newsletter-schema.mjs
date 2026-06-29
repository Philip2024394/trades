// Sanity-check: confirm newsletter_subscribers table + indexes exist.
import { readFileSync } from "node:fs";

const envText = readFileSync("C:\\Users\\Victus\\hammer\\.env.tools.local", "utf-8");
const tokenMatch = envText.match(/^SUPABASE_ACCESS_TOKEN=(.+)$/m);
const token = tokenMatch[1].trim();
const ref = "msdonkkechxzgagyguoe";

async function q(sql) {
  const r = await fetch(`https://api.supabase.com/v1/projects/${ref}/database/query`, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: JSON.stringify({ query: sql })
  });
  return await r.json();
}

console.log(
  "Schema:",
  JSON.stringify(
    await q(`
      SELECT column_name, data_type, is_nullable
      FROM information_schema.columns
      WHERE table_name='hammerex_xrated_newsletter_subscribers'
      ORDER BY ordinal_position;
    `),
    null,
    2
  )
);
console.log("---");
console.log(
  "Indexes:",
  JSON.stringify(
    await q(
      `SELECT indexname FROM pg_indexes WHERE tablename='hammerex_xrated_newsletter_subscribers';`
    ),
    null,
    2
  )
);
