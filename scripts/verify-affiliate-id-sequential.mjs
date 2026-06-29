import { readFileSync } from "node:fs";
const envText = readFileSync(
  "C:\\Users\\Victus\\hammer\\.env.tools.local",
  "utf-8"
);
const token = envText.match(/^SUPABASE_ACCESS_TOKEN=(.+)$/m)[1].trim();
const ref = "msdonkkechxzgagyguoe";
async function q(sql) {
  const r = await fetch(
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
  return r.ok ? JSON.parse(await r.text()) : { err: await r.text(), status: r.status };
}
console.log(
  "Insert test affiliate:",
  await q(
    `INSERT INTO hammerex_affiliates (whatsapp, password_hash, status, first_name)
     VALUES ('99999999998','test_hash','active','Verification')
     RETURNING affiliate_id, created_at;`
  )
);
console.log(
  "Cleanup:",
  await q(`DELETE FROM hammerex_affiliates WHERE whatsapp='99999999998' RETURNING affiliate_id;`)
);
