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
  return r.text();
};
console.log(
  await q(
    "SELECT trade_connections_radius_km, count(*) FROM hammerex_trade_off_listings GROUP BY trade_connections_radius_km ORDER BY trade_connections_radius_km;"
  )
);
