import { readFileSync } from "node:fs";
const t = readFileSync(
  "C:\\Users\\Victus\\hammer\\.env.tools.local",
  "utf-8"
)
  .match(/^SUPABASE_ACCESS_TOKEN=(.+)$/m)[1]
  .trim();
const q = async (sql) => {
  const r = await fetch(
    "https://api.supabase.com/v1/projects/msdonkkechxzgagyguoe/database/query",
    {
      method: "POST",
      headers: {
        Authorization: "Bearer " + t,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({ query: sql })
    }
  );
  console.log(r.status);
  console.log(await r.text());
};
await q(
  "UPDATE hammerex_trade_off_listings SET trade_connections_radius_km = 200 WHERE trade_connections_radius_km > 200;"
);
