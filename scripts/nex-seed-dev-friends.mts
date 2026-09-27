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
    // business_owner so the shop storefront badge renders on her card ·
    // she sells her own footwear line.
    kind: "business_owner",
    profession: "Footwear Designer",
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
    profession: "Reseller · Vintage",
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
    profession: "Bakery Owner",
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

  // 5. Seed the reference conversation with Maria Santos so the peer
  //    chat surface visually matches the design brief on first load.
  //    Idempotent · only seeds if the conversation has zero messages.
  const maria = DEV_FRIENDS[0]!;
  const [pa, pb] =
    devAdminId < maria.id ? [devAdminId, maria.id] : [maria.id, devAdminId];
  const conv = await pg.query<{ id: string }>(
    `insert into nex_peer_conversation (participant_a_id, participant_b_id)
       values ($1, $2)
     on conflict (participant_a_id, participant_b_id)
       do update set participant_a_id = excluded.participant_a_id
     returning id`,
    [pa, pb],
  );
  const conversationId = conv.rows[0]!.id;

  const existingCount = await pg.query<{ n: string }>(
    `select count(*)::text as n from nex_peer_message where conversation_id = $1`,
    [conversationId],
  );
  if (Number(existingCount.rows[0]!.n) === 0) {
    // Reference conversation from the pixel-accurate brief.
    const refThread: Array<{ from: "peer" | "me"; body: string }> = [
      { from: "peer", body: "Hey! Just saw your latest product post. Looks amazing! 👋" },
      { from: "me", body: "Thanks! I'm really happy with how it turned out. The materials are so much better than I expected." },
      { from: "peer", body: "That's awesome! I love the color options. Are you planning to do more styles soon?" },
      { from: "me", body: "Yes! I'm working on a new collection right now. I'll share some previews with you soon." },
      { from: "peer", body: "Perfect. I'd love to give you some feedback before you launch. Just let me know!" },
      { from: "me", body: "Absolutely. Would love your input. You're always so helpful! 🙏" },
      { from: "peer", body: "Sounds great! See you around!" },
    ];
    const nowIso = Date.now();
    const spacingMs = 45_000; // 45 s between messages
    let latestSentAt: string | null = null;
    for (let i = 0; i < refThread.length; i++) {
      const m = refThread[i]!;
      const senderId = m.from === "peer" ? maria.id : devAdminId;
      const sentAt = new Date(
        nowIso - (refThread.length - i) * spacingMs,
      ).toISOString();
      // Mark my own messages as read by the peer (dev demo state); peer
      // messages are marked unread so `markPeerMessagesRead` flips them
      // to read on first view (idempotent).
      const readAt = m.from === "me" ? sentAt : null;
      await pg.query(
        `insert into nex_peer_message
           (conversation_id, sender_account_id, body, sent_at, read_at)
         values ($1, $2, $3, $4, $5)`,
        [conversationId, senderId, m.body, sentAt, readAt],
      );
      latestSentAt = sentAt;
    }
    if (latestSentAt) {
      await pg.query(
        `update nex_peer_conversation set last_message_at = $1 where id = $2`,
        [latestSentAt, conversationId],
      );
    }
    console.log(`  ✓ seeded ${refThread.length} reference messages with Maria`);
  } else {
    console.log(
      `  · Maria conversation already has ${existingCount.rows[0]!.n} messages · skipping thread seed`,
    );
  }

  // 6. Confirm count
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
