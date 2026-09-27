// scripts/nex-set-maria-hero.mts
//
// One-off · uploads a local image file as Maria Santos's chat hero
// portrait (nex_account_profile.avatar_url).
//
// Usage:
//   NEX_ALLOW_DEV_ADMIN=1 npx tsx scripts/nex-set-maria-hero.mts <path-to-image>
//
// Example:
//   NEX_ALLOW_DEV_ADMIN=1 npx tsx scripts/nex-set-maria-hero.mts \
//     "C:/Users/Victus/Pictures/theme3.png"

import * as fs from "node:fs";
import * as path from "node:path";
import { Client as PgClient } from "pg";
import { createClient } from "@supabase/supabase-js";

function loadEnv() {
  const p = path.join(process.cwd(), ".env.local");
  if (!fs.existsSync(p)) return;
  for (const line of fs.readFileSync(p, "utf8").split(/\r?\n/)) {
    const m = line.match(/^([A-Z0-9_]+)\s*=\s*(.*)$/);
    if (m && !process.env[m[1]!])
      process.env[m[1]!] = m[2]!.replace(/^["']|["']$/g, "");
  }
}
loadEnv();

if (process.env.NEX_ALLOW_DEV_ADMIN !== "1") {
  console.error("FAIL · NEX_ALLOW_DEV_ADMIN=1 required · dev-only");
  process.exit(1);
}

const DB_URL = process.env.DATABASE_URL;
const SB_URL =
  process.env.NEX_SUPABASE_URL ?? process.env.NEXT_PUBLIC_NEX_SUPABASE_URL;
const SB_KEY = process.env.NEX_SUPABASE_SERVICE_ROLE_KEY;

if (!DB_URL || !SB_URL || !SB_KEY) {
  console.error(
    "FAIL · need DATABASE_URL + NEX_SUPABASE_URL + NEX_SUPABASE_SERVICE_ROLE_KEY",
  );
  process.exit(1);
}

const IMAGE_PATH = process.argv[2];
if (!IMAGE_PATH || !fs.existsSync(IMAGE_PATH)) {
  console.error(`FAIL · image not found: ${IMAGE_PATH ?? "<missing arg>"}`);
  process.exit(1);
}

// Maria Santos · seeded account id from nex-seed-dev-friends.mts
const MARIA_ACCOUNT_ID = "d3e7f000-0001-4a00-b000-000000000001";

async function main() {
  const bytes = new Uint8Array(fs.readFileSync(IMAGE_PATH));
  const ext = (IMAGE_PATH.split(".").pop() ?? "png").toLowerCase();
  const safeExt = ["png", "jpg", "jpeg", "webp", "avif"].includes(ext)
    ? ext
    : "png";
  const objectPath = `maria-santos-hero-${Date.now()}.${safeExt}`;

  const sb = createClient(SB_URL!, SB_KEY!, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
  const bucket = sb.storage.from("nex-chat-theme-hero");

  console.log(`↑ uploading ${IMAGE_PATH} → ${objectPath}`);
  const up = await bucket.upload(objectPath, bytes, {
    contentType: `image/${safeExt === "jpg" ? "jpeg" : safeExt}`,
    upsert: true,
  });
  if (up.error) {
    console.error("FAIL · upload:", up.error.message);
    process.exit(1);
  }
  const { data: pub } = bucket.getPublicUrl(objectPath);
  const publicUrl = pub.publicUrl;
  console.log(`✓ public url: ${publicUrl}`);

  const db = new PgClient({ connectionString: DB_URL });
  await db.connect();
  try {
    const upd = await db.query(
      `UPDATE nex_account_profile
         SET avatar_url = $1,
             updated_at = now()
       WHERE account_id = $2
       RETURNING account_id, avatar_url`,
      [publicUrl, MARIA_ACCOUNT_ID],
    );
    if (upd.rowCount === 0) {
      // Profile may not exist yet · insert a minimal one.
      const ins = await db.query(
        `INSERT INTO nex_account_profile (account_id, avatar_url)
         VALUES ($1, $2)
         RETURNING account_id, avatar_url`,
        [MARIA_ACCOUNT_ID, publicUrl],
      );
      console.log(`✓ inserted profile for maria · avatar_url set`);
      console.log(ins.rows[0]);
    } else {
      console.log(`✓ updated maria's avatar_url`);
      console.log(upd.rows[0]);
    }
  } finally {
    await db.end();
  }
}

main().catch((e) => {
  console.error("FAIL:", e);
  process.exit(1);
});
