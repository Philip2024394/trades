// scripts/nex-seed-dev-friends.mts
//
// Dev-admin seeder · provisions 5 realistic friends for dev-admin
// (dev-admin@nex-native.local) so peer-chat can be exercised end-to-end
// without needing to sign up real second users.
//
// Guarded by NEX_ALLOW_DEV_ADMIN=1 · never runs in production.
//
// Idempotent · uses fixed UUIDs so re-running just refreshes fields.
//
// Usage:
//   NEX_ALLOW_DEV_ADMIN=1 npx tsx scripts/nex-seed-dev-friends.mts
//
// After seeding: sign in as dev-admin, visit /nex-native/chat →
// Friends tab, tap any card → live peer chat opens.

import { Client as PgClient } from "pg";
import * as fs from "node:fs";
import * as path from "node:path";

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

const DB_URL = process.env.DATABASE_URL;
if (!DB_URL) {
  console.error("FAIL · DATABASE_URL missing (need .env.local)");
  process.exit(1);
}
if (process.env.NEX_ALLOW_DEV_ADMIN !== "1") {
  console.error("FAIL · NEX_ALLOW_DEV_ADMIN=1 required · dev-only seeder");
  process.exit(1);
}

const DEV_ADMIN_EMAIL = "dev-admin@nex-native.local";

interface DevFriend {
  id: string;
  display_name: string;
  nex_handle: string;
  chat_theme: string;
  kind: string;
  profession: string;
  location_label: string;
  avatar_url: string;
  has_shop: boolean; // recorded on nex_business for later Bridge · not persisted here
}

const DEV_FRIENDS: DevFriend[] = [
  {
    id: "d3e7f000-0001-4a00-b000-000000000001",
    display_name: "Maria Santos",
    nex_handle: "nex-27418",
    chat_theme: "pink",
    kind: "professional",
    profession: "Footwear designer",
    location_label: "Bandung",
    avatar_url:
      "https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=200&h=200&fit=crop",
    has_shop: true,
  },
  {
    id: "d3e7f000-0002-4a00-b000-000000000002",
    display_name: "Aisha Rahman",
    nex_handle: "nex-52091",
    chat_theme: "gold",
    kind: "reseller",
    profession: "Reseller · vintage cameras",
    location_label: "Jakarta",
    avatar_url:
      "https://images.unsplash.com/photo-1573496359142-b8d87734a5a2?w=200&h=200&fit=crop",
    has_shop: true,
  },
  {
    id: "d3e7f000-0003-4a00-b000-000000000003",
    display_name: "Kenji Tanaka",
    nex_handle: "nex-38754",
    chat_theme: "titanium",
    kind: "professional",
    profession: "Photographer",
    location_label: "Tokyo",
    avatar_url:
      "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=200&h=200&fit=crop",
    has_shop: false,
  },
  {
    id: "d3e7f000-0004-4a00-b000-000000000004",
    display_name: "Lucas Ferreira",
    nex_handle: "nex-15662",
    chat_theme: "default",
    kind: "student",
    profession: "Student · Design",
    location_label: "Rio de Janeiro",
    avatar_url:
      "https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=200&h=200&fit=crop",
    has_shop: false,
  },
  {
    id: "d3e7f000-0005-4a00-b000-000000000005",
    display_name: "Priya Patel",
    nex_handle: "nex-91280",
    chat_theme: "night",
    kind: "business_owner",
    profession: "Bakery owner",
    location_label: "Mumbai",
    avatar_url:
      "https://images.unsplash.com/photo-1438761681033-6461ffad8d80?w=200&h=200&fit=crop",
    has_shop: true,
  },
];

const pg = new PgClient({ connectionString: DB_URL });
await pg.connect();
try {
  // 1. Locate dev-admin's nex_account.id via auth.users email.
  const devAdmin = await pg.query<{ id: string }>(
    `select na.id from nex_account na
       join auth.users au on au.id = na.supabase_user_id
      where lower(au.email) = $1
      limit 1`,
    [DEV_ADMIN_EMAIL],
  );
  if (devAdmin.rows.length === 0) {
    console.error(
      `FAIL · no nex_account for ${DEV_ADMIN_EMAIL} · sign in as dev-admin at least once first`,
    );
    process.exit(1);
  }
  const devAdminId = devAdmin.rows[0]!.id;
  console.log(`dev-admin · ${devAdminId}`);

  for (const f of DEV_FRIENDS) {
    // 2. Upsert nex_account
    await pg.query(
      `insert into nex_account (id, display_name, nex_handle, chat_theme)
         values ($1, $2, $3, $4)
       on conflict (id) do update
         set display_name = excluded.display_name,
             nex_handle   = excluded.nex_handle,
             chat_theme   = excluded.chat_theme`,
      [f.id, f.display_name, f.nex_handle, f.chat_theme],
    );

    // 3. Upsert nex_account_profile
    await pg.query(
      `insert into nex_account_profile
         (account_id, kind, profession, location_label, avatar_url, is_public)
         values ($1, $2, $3, $4, $5, true)
       on conflict (account_id) do update
         set kind           = excluded.kind,
             profession     = excluded.profession,
             location_label = excluded.location_label,
             avatar_url     = excluded.avatar_url,
             is_public      = true`,
      [f.id, f.kind, f.profession, f.location_label, f.avatar_url],
    );

    // 4. Upsert accepted nex_friend_edge (canonical a<b ordering)
    const [a, b] =
      devAdminId < f.id ? [devAdminId, f.id] : [f.id, devAdminId];
    await pg.query(
      `insert into nex_friend_edge
         (a_account_id, b_account_id, requested_by, status)
         values ($1, $2, $3, 'accepted')
       on conflict (a_account_id, b_account_id) do update
         set status = 'accepted',
             updated_at = now()`,
      [a, b, devAdminId],
    );

    console.log(`  ✓ ${f.display_name} · ${f.id.slice(0, 8)}…`);
  }

  // 5. Confirm count
  const cnt = await pg.query<{ n: string }>(
    `select count(*)::text as n from nex_friend_edge
      where (a_account_id = $1 or b_account_id = $1) and status = 'accepted'`,
    [devAdminId],
  );
  console.log(`dev-admin now has ${cnt.rows[0]!.n} accepted friend(s)`);
  console.log(
    `\n✅ seed complete · sign in as ${DEV_ADMIN_EMAIL} and visit /nex-native/chat`,
  );
} catch (e) {
  const msg = e instanceof Error ? e.message : String(e);
  console.error(`FAIL · ${msg}`);
  process.exit(1);
} finally {
  await pg.end();
}
