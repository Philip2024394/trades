// scripts/nex-dev-reply-as-friend.mts
//
// Dev-only · post a plaintext peer-chat message AS a seeded friend
// INTO the conversation with the signed-in dev user. Used when a human
// is testing a chat prototype in the browser and we want a scripted
// counterparty to reply.
//
// Guarded by NEX_ALLOW_DEV_ADMIN=1 · never runs in production.
//
// Usage:
//   NEX_ALLOW_DEV_ADMIN=1 npx tsx scripts/nex-dev-reply-as-friend.mts \
//     --as=d3e7f000-0001-4a00-b000-000000000001 \
//     --to-email=dev-admin@nex-native.local \
//     "hey Philip — got your shoes!"
//
// Defaults:
//   --as         Maria Santos (d3e7f000-0001-4a00-b000-000000000001)
//   --to-email   dev-admin@nex-native.local

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
  console.error("FAIL · NEX_ALLOW_DEV_ADMIN=1 required · dev-only impersonation");
  process.exit(1);
}

const DEFAULT_FRIEND_ID = "d3e7f000-0001-4a00-b000-000000000001"; // Maria
const DEFAULT_TO_EMAIL = "dev-admin@nex-native.local";

function parseArgs() {
  let friendId = DEFAULT_FRIEND_ID;
  let toEmail = DEFAULT_TO_EMAIL;
  const bodyParts: string[] = [];
  for (const a of process.argv.slice(2)) {
    if (a.startsWith("--as=")) friendId = a.slice("--as=".length);
    else if (a.startsWith("--to-email=")) toEmail = a.slice("--to-email=".length);
    else bodyParts.push(a);
  }
  const body = bodyParts.join(" ").trim();
  if (!body) {
    console.error("FAIL · no message body · usage: nex-dev-reply-as-friend.mts [--as=UUID] [--to-email=EMAIL] \"message\"");
    process.exit(1);
  }
  if (body.length > 4000) {
    console.error("FAIL · body exceeds 4000 chars");
    process.exit(1);
  }
  return { friendId, toEmail, body };
}

const { friendId, toEmail, body } = parseArgs();

const pg = new PgClient({ connectionString: DB_URL });
await pg.connect();
try {
  // Resolve recipient (the real human in the browser).
  const to = await pg.query<{ id: string; display_name: string }>(
    `select na.id, na.display_name from nex_account na
       join auth.users au on au.id = na.supabase_user_id
      where lower(au.email) = $1 limit 1`,
    [toEmail.toLowerCase()],
  );
  if (to.rows.length === 0) {
    console.error(`FAIL · no nex_account for email ${toEmail}`);
    process.exit(1);
  }
  const toId = to.rows[0]!.id;

  // Resolve friend (impersonated sender).
  const friend = await pg.query<{ id: string; display_name: string }>(
    `select id, display_name from nex_account where id = $1`,
    [friendId],
  );
  if (friend.rows.length === 0) {
    console.error(`FAIL · no nex_account with id ${friendId} · did you run nex-seed-dev-friends.mts?`);
    process.exit(1);
  }
  const friendName = friend.rows[0]!.display_name;

  // Canonical (a < b) participant ordering.
  const [pa, pb] = toId < friendId ? [toId, friendId] : [friendId, toId];

  // Get or create the peer conversation.
  const conv = await pg.query<{ id: string }>(
    `insert into nex_peer_conversation (participant_a_id, participant_b_id)
       values ($1, $2)
     on conflict (participant_a_id, participant_b_id)
       do update set participant_a_id = excluded.participant_a_id
     returning id`,
    [pa, pb],
  );
  const conversationId = conv.rows[0]!.id;

  // Insert the message as the friend.
  const inserted = await pg.query<{ id: string; sent_at: string }>(
    `insert into nex_peer_message
       (conversation_id, sender_account_id, body, read_at)
     values ($1, $2, $3, null)
     returning id, sent_at`,
    [conversationId, friendId, body],
  );
  const row = inserted.rows[0]!;

  // Bump last_message_at so inbox ordering stays correct.
  await pg.query(
    `update nex_peer_conversation set last_message_at = $1 where id = $2`,
    [row.sent_at, conversationId],
  );

  console.log(
    `✓ ${friendName} → ${to.rows[0]!.display_name} · msg ${row.id.slice(0, 8)} · ${row.sent_at}`,
  );
  console.log(`  "${body}"`);
} catch (e) {
  const msg = e instanceof Error ? e.message : String(e);
  console.error(`FAIL · ${msg}`);
  process.exit(1);
} finally {
  await pg.end();
}
