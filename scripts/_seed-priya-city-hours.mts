import { Client as PgClient } from "pg";
import * as fs from "node:fs";
import * as path from "node:path";

const envPath = path.join(process.cwd(), ".env.local");
if (fs.existsSync(envPath)) {
  for (const line of fs.readFileSync(envPath, "utf8").split(/\r?\n/)) {
    const m = line.match(/^([A-Z0-9_]+)\s*=\s*(.*)$/);
    if (m && !process.env[m[1]!]) {
      process.env[m[1]!] = m[2]!.replace(/^["']|["']$/g, "");
    }
  }
}

const pg = new PgClient({ connectionString: process.env.DATABASE_URL! });
await pg.connect();
const res = await pg.query(
  `UPDATE nex_business
   SET city = $1,
       hours_display = $2
   WHERE slug = 'priya-mumbai-cafe'
   RETURNING slug, city, hours_display`,
  ["Bandra West, Mumbai", "Every day 7am-10pm · dine-in and takeaway"],
);
console.log(res.rows);
await pg.end();
