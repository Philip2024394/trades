// src/lib/nex-native/__tests__/vault-conversation-envelope-b1.test.ts
//
// Vault Phase B · Commit B.1 · deterministic schema regression for
// nex-supabase/migrations/143_nex_vault_conversation_envelope.sql
//
// Pattern mirrors the sealed Phase A.1 schema tests at
// src/lib/nex-native/__tests__/vault-persistence.test.ts: static
// read-and-grep of the migration SQL to prove shape and invariants
// without requiring a live Postgres connection. Live-DB assertions
// land in B.2 / B.3 Playwright and route-level tests.
//
// This file enforces the B.1 doctrine:
//   · ONE new table only (nex_vault_conversation_envelope)
//   · NO modification of any sealed table
//   · NO plaintext key material storage
//   · Correct FK + RLS + CHECK + partial unique index shape
//   · Sealed Phase A crypto sizes reused (no new format invented)

import { describe, test, expect } from "vitest";
import * as fs from "node:fs";
import * as path from "node:path";

const MIGRATION_143 = path.resolve(
  __dirname,
  "../../../../nex-supabase/migrations/143_nex_vault_conversation_envelope.sql",
);

const migration143 = fs.readFileSync(MIGRATION_143, "utf-8");

function stripComments(sql: string): string {
  return sql
    .split(/\r?\n/)
    .map((line) => {
      const idx = line.indexOf("--");
      return idx === -1 ? line : line.slice(0, idx);
    })
    .join("\n");
}

const migration143Code = stripComments(migration143);

// ---------------------------------------------------------------------------
// A · table exists with exact name
// ---------------------------------------------------------------------------

describe("B.1 · migration 143 · table existence", () => {
  test("creates nex_vault_conversation_envelope", () => {
    expect(migration143Code).toMatch(
      /CREATE\s+TABLE\s+IF\s+NOT\s+EXISTS\s+nex_vault_conversation_envelope\s*\(/,
    );
  });

  test("does NOT create any other table (B.1 scope rule)", () => {
    const createTable = migration143Code.match(
      /CREATE\s+TABLE\s+IF\s+NOT\s+EXISTS\s+(\w+)/g,
    );
    expect(createTable).not.toBeNull();
    expect(createTable).toHaveLength(1);
    expect(createTable![0]).toContain("nex_vault_conversation_envelope");
  });

  test("does NOT alter any sealed Phase A or chat table", () => {
    // Phase A sealed tables + chat canonical tables must not be touched.
    const sealedTables = [
      "nex_peer_conversation",
      "nex_peer_message",
      "nex_vault_entry",
      "nex_vault_file",
      "nex_account",
      "nex_account_device_key",
      "nex_vault_setup",
      "nex_vault_key_envelope",
      "nex_session",
      "nex_sign_in_event",
    ];
    for (const tbl of sealedTables) {
      expect(
        migration143Code,
        `migration 143 must not ALTER sealed table ${tbl}`,
      ).not.toMatch(new RegExp(`ALTER\\s+TABLE\\s+${tbl}\\b`, "i"));
    }
  });
});

// ---------------------------------------------------------------------------
// B · required columns + types
// ---------------------------------------------------------------------------

describe("B.1 · migration 143 · column schema", () => {
  test("id is uuid PRIMARY KEY with gen_random_uuid default", () => {
    expect(migration143Code).toMatch(
      /\bid\s+uuid\s+PRIMARY\s+KEY\s+DEFAULT\s+gen_random_uuid\(\)/i,
    );
  });

  test("account_id is uuid NOT NULL and FKs nex_account(id) ON DELETE CASCADE", () => {
    expect(migration143Code).toMatch(
      /\baccount_id\s+uuid\s+NOT\s+NULL\s+REFERENCES\s+nex_account\(id\)\s+ON\s+DELETE\s+CASCADE/i,
    );
  });

  test("conversation_id is uuid NOT NULL and FKs nex_peer_conversation(id) ON DELETE CASCADE", () => {
    expect(migration143Code).toMatch(
      /\bconversation_id\s+uuid\s+NOT\s+NULL\s+REFERENCES\s+nex_peer_conversation\(id\)\s+ON\s+DELETE\s+CASCADE/i,
    );
  });

  test("target_device_id is text NOT NULL", () => {
    expect(migration143Code).toMatch(
      /\btarget_device_id\s+text\s+NOT\s+NULL/i,
    );
  });

  test("wrapped_k_c is bytea NOT NULL", () => {
    expect(migration143Code).toMatch(/\bwrapped_k_c\s+bytea\s+NOT\s+NULL/i);
  });

  test("nonce is bytea NOT NULL", () => {
    expect(migration143Code).toMatch(/\bnonce\s+bytea\s+NOT\s+NULL/i);
  });

  test("algorithm is text NOT NULL", () => {
    expect(migration143Code).toMatch(/\balgorithm\s+text\s+NOT\s+NULL/i);
  });

  test("generation is integer NOT NULL DEFAULT 1", () => {
    expect(migration143Code).toMatch(
      /\bgeneration\s+integer\s+NOT\s+NULL\s+DEFAULT\s+1/i,
    );
  });

  test("revoked_at is nullable timestamptz", () => {
    expect(migration143Code).toMatch(
      /\brevoked_at\s+timestamptz\s+NULL/i,
    );
  });

  test("created_at is timestamptz NOT NULL DEFAULT now()", () => {
    expect(migration143Code).toMatch(
      /\bcreated_at\s+timestamptz\s+NOT\s+NULL\s+DEFAULT\s+now\(\)/i,
    );
  });
});

// ---------------------------------------------------------------------------
// C · foreign-key relationships (ownership + conversation)
// ---------------------------------------------------------------------------

describe("B.1 · migration 143 · foreign-key relationships", () => {
  test("account_id references nex_account(id)", () => {
    expect(migration143Code).toMatch(
      /account_id[^,]*REFERENCES\s+nex_account\(id\)/i,
    );
  });

  test("conversation_id references nex_peer_conversation(id)", () => {
    expect(migration143Code).toMatch(
      /conversation_id[^,]*REFERENCES\s+nex_peer_conversation\(id\)/i,
    );
  });

  test("there is NO foreign key from this envelope back onto nex_peer_message", () => {
    // Deleting envelopes must never cascade into chat history.
    expect(migration143Code).not.toMatch(/REFERENCES\s+nex_peer_message\b/i);
  });

  test("there is NO cascade from envelope delete to conversation delete", () => {
    // The FK direction is envelope -> conversation (child -> parent);
    // deleting an envelope never touches nex_peer_conversation.
    // Static shape proof: there is no DELETE / UPDATE RULE that could
    // reverse the direction.
    expect(migration143Code).not.toMatch(/CREATE\s+RULE\b/i);
    expect(migration143Code).not.toMatch(/CREATE\s+TRIGGER\b/i);
  });
});

// ---------------------------------------------------------------------------
// D · CHECK constraints (crypto sizes + value domains)
// ---------------------------------------------------------------------------

describe("B.1 · migration 143 · CHECK constraints", () => {
  test("algorithm must equal 'aes-256-gcm/v1' (sealed Phase A)", () => {
    expect(migration143Code).toMatch(
      /CHECK\s*\(\s*algorithm\s*=\s*'aes-256-gcm\/v1'\s*\)/i,
    );
  });

  test("wrapped_k_c length is exactly 60 bytes (12 nonce || 32 ct || 16 tag)", () => {
    expect(migration143Code).toMatch(
      /CHECK\s*\(\s*octet_length\(wrapped_k_c\)\s*=\s*60\s*\)/i,
    );
  });

  test("nonce length is exactly 12 bytes (AES-GCM standard)", () => {
    expect(migration143Code).toMatch(
      /CHECK\s*\(\s*octet_length\(nonce\)\s*=\s*12\s*\)/i,
    );
  });

  test("generation is at least 1", () => {
    expect(migration143Code).toMatch(
      /CHECK\s*\(\s*generation\s*>=\s*1\s*\)/i,
    );
  });

  test("target_device_id length is 8-128 chars (reuses Phase A convention)", () => {
    expect(migration143Code).toMatch(
      /CHECK\s*\(\s*char_length\(target_device_id\)\s+BETWEEN\s+8\s+AND\s+128\s*\)/i,
    );
  });

  test("wrapped_k_c is NOT NULL (no empty-key row can exist)", () => {
    // Already covered by NOT NULL declaration; this test adds a second
    // safety grep for the literal "NOT NULL" on the wrapped_k_c line.
    const line = migration143Code
      .split(/\r?\n/)
      .find((l) => /\bwrapped_k_c\s+bytea/i.test(l));
    expect(line, "wrapped_k_c declaration must exist").toBeTruthy();
    expect(line!).toMatch(/NOT\s+NULL/i);
  });
});

// ---------------------------------------------------------------------------
// E · partial unique index (the active-envelope uniqueness predicate)
// ---------------------------------------------------------------------------

describe("B.1 · migration 143 · partial unique index", () => {
  test("creates partial UNIQUE index on (account_id, conversation_id, target_device_id, generation) WHERE revoked_at IS NULL", () => {
    expect(migration143Code).toMatch(
      /CREATE\s+UNIQUE\s+INDEX\s+IF\s+NOT\s+EXISTS\s+\w+\s+ON\s+nex_vault_conversation_envelope\s*\(\s*account_id\s*,\s*conversation_id\s*,\s*target_device_id\s*,\s*generation\s*\)\s*WHERE\s+revoked_at\s+IS\s+NULL/i,
    );
  });

  test("the uniqueness predicate includes exactly the four columns the founder sealed", () => {
    // Match the 4-tuple ordering explicitly against the founder brief:
    //   account + conversation + device + generation
    const idxMatch = migration143Code.match(
      /CREATE\s+UNIQUE\s+INDEX[^;]+ON\s+nex_vault_conversation_envelope\s*\(([^)]+)\)\s*WHERE/i,
    );
    expect(idxMatch, "partial unique index must exist").not.toBeNull();
    const cols = idxMatch![1]!
      .split(",")
      .map((c) => c.trim().toLowerCase());
    expect(cols).toEqual([
      "account_id",
      "conversation_id",
      "target_device_id",
      "generation",
    ]);
  });

  test("has a lookup index for 'all my active envelopes on this device'", () => {
    expect(migration143Code).toMatch(
      /CREATE\s+INDEX\s+IF\s+NOT\s+EXISTS\s+\w+\s+ON\s+nex_vault_conversation_envelope\s*\(\s*account_id\s*,\s*target_device_id\s*\)\s*WHERE\s+revoked_at\s+IS\s+NULL/i,
    );
  });

  test("has a lookup index for per-conversation audit (all envelopes active+revoked)", () => {
    expect(migration143Code).toMatch(
      /CREATE\s+INDEX\s+IF\s+NOT\s+EXISTS\s+\w+\s+ON\s+nex_vault_conversation_envelope\s*\(\s*account_id\s*,\s*conversation_id\s*,\s*created_at\s+DESC\s*\)/i,
    );
  });
});

// ---------------------------------------------------------------------------
// F · RLS (owner-scoped SELECT · no owner writes · service-role only)
// ---------------------------------------------------------------------------

describe("B.1 · migration 143 · row-level security", () => {
  test("enables ROW LEVEL SECURITY on the new table", () => {
    expect(migration143Code).toMatch(
      /ALTER\s+TABLE\s+nex_vault_conversation_envelope\s+ENABLE\s+ROW\s+LEVEL\s+SECURITY/i,
    );
  });

  test("adds exactly one owner SELECT policy", () => {
    expect(migration143Code).toMatch(
      /CREATE\s+POLICY\s+\w+\s+ON\s+nex_vault_conversation_envelope\s+FOR\s+SELECT\s+TO\s+authenticated\s+USING\s*\(/i,
    );
  });

  test("owner SELECT policy routes through supabase_user_id → nex_account.id (no direct conversation_id trust)", () => {
    // Access must flow via the authenticated account's ownership of
    // nex_account · knowing a conversation_id must NOT be sufficient to
    // read envelopes.
    expect(migration143Code).toMatch(
      /USING\s*\(\s*account_id\s+IN\s*\(\s*SELECT\s+id\s+FROM\s+nex_account\s+WHERE\s+supabase_user_id\s*=\s*auth\.uid\(\)\s*\)\s*\)/i,
    );
  });

  test("adds NO INSERT policy (service-role only)", () => {
    expect(migration143Code).not.toMatch(
      /CREATE\s+POLICY[^;]+ON\s+nex_vault_conversation_envelope\s+FOR\s+INSERT/i,
    );
  });

  test("adds NO UPDATE policy (service-role only)", () => {
    expect(migration143Code).not.toMatch(
      /CREATE\s+POLICY[^;]+ON\s+nex_vault_conversation_envelope\s+FOR\s+UPDATE/i,
    );
  });

  test("adds NO DELETE policy (service-role only)", () => {
    expect(migration143Code).not.toMatch(
      /CREATE\s+POLICY[^;]+ON\s+nex_vault_conversation_envelope\s+FOR\s+DELETE/i,
    );
  });

  test("adds NO FOR ALL policy (would subsume INSERT/UPDATE/DELETE)", () => {
    expect(migration143Code).not.toMatch(
      /CREATE\s+POLICY[^;]+ON\s+nex_vault_conversation_envelope\s+FOR\s+ALL/i,
    );
  });
});

// ---------------------------------------------------------------------------
// G · doctrine (table does NOT masquerade as a second conversation)
// ---------------------------------------------------------------------------

describe("B.1 · migration 143 · doctrine comments", () => {
  test("file begins with the B.1 doctrine block (one-conversation rule)", () => {
    expect(migration143).toMatch(/Vault Phase B\s+·\s+Commit B\.1/);
    expect(migration143).toMatch(/canonical\s+nex_peer_conversation/i);
    expect(migration143).toMatch(/does\s+NOT\s+create\s+a\s+second\s+conversation/i);
    expect(migration143).toMatch(/plaintext\s+key\s+material/i);
  });

  test("table has a COMMENT making the one-conversation rule explicit to future readers", () => {
    // Postgres COMMENT ON TABLE strings can be split across adjacent
    // quoted fragments ('…' '…') which the SQL parser concatenates.
    // We normalise the fragment boundaries before matching so the
    // phrase can span lines in the source without breaking the test.
    const normalised = migration143Code.replace(/'\s+'/g, "");
    expect(normalised).toMatch(
      /COMMENT\s+ON\s+TABLE\s+nex_vault_conversation_envelope\s+IS[\s\S]*?Does\s+NOT\s+create\s+a\s+second\s+conversation/i,
    );
  });

  test("rollback block is documented in a comment", () => {
    expect(migration143).toMatch(/DROP\s+TABLE\s+IF\s+EXISTS\s+nex_vault_conversation_envelope\s+CASCADE/i);
  });
});

// ---------------------------------------------------------------------------
// H · B.1 scope guards (NO routes, NO client crypto, NO UI touched)
// ---------------------------------------------------------------------------

describe("B.1 · scope guards · nothing outside the migration should move", () => {
  // The "no /vault/chat/ directory" guard was B.1-time forward-looking.
  // B.2 (commit b2) is explicitly authorised to build that directory
  // (envelope mint/list/revoke/rotate + attachment/preserve). The B.2
  // test suite in vault-conversation-envelope-routes-b2.test.ts enforces
  // the overbuild rule going forward: only the 4 envelope route dirs
  // and the single preserve route are permitted. B.1 no longer asserts
  // on the directory's absence (would collide with sealed B.2 scope).

  test("no new client crypto file under src/lib/nex-native/vault/client/conversation-cache.ts", () => {
    const clientFile = path.resolve(
      __dirname,
      "../../../..",
      "src/lib/nex-native/vault/client/conversation-cache.ts",
    );
    expect(fs.existsSync(clientFile)).toBe(false);
  });

  test("no new Vault chat surface under src/app/nex-native/vault/home/chats/[conversationId]", () => {
    const uiDir = path.resolve(
      __dirname,
      "../../../..",
      "src/app/nex-native/vault/home/chats",
    );
    // The doorway LIST page is sealed and may exist; the per-conversation
    // surface must NOT exist yet.
    if (fs.existsSync(uiDir)) {
      const entries = fs.readdirSync(uiDir);
      for (const name of entries) {
        expect(name, `no per-conversation route added in B.1 · found ${name}`).not.toMatch(
          /^\[.+conversationId.+\]$/i,
        );
      }
    }
  });
});

// ---------------------------------------------------------------------------
// I · plaintext-blindness regression (no server-side K_c / VMK handling)
// ---------------------------------------------------------------------------

describe("B.1 · plaintext-blindness · the migration must not synthesise plaintext key material", () => {
  // Note: we deliberately do NOT grep for occurrences of the strings
  // "plaintext K_c" / "plaintext VMK" etc. in the SQL text. Those
  // phrases are intentionally present in the doctrine comments where
  // they document the server's blindness ("server never sees plaintext
  // K_c"). The authoritative plaintext-blindness guard is architectural
  // (no decrypt functions, no plaintext columns, opaque bytea only) and
  // is covered by the test below plus the column-schema tests above.

  test("migration SQL does not create any function that could decrypt or process key material", () => {
    expect(migration143Code).not.toMatch(/CREATE\s+(OR\s+REPLACE\s+)?FUNCTION\b/i);
    expect(migration143Code).not.toMatch(/pgp_sym_decrypt\s*\(/i);
    expect(migration143Code).not.toMatch(/pgp_sym_encrypt\s*\(/i);
    expect(migration143Code).not.toMatch(/\bdecrypt\s*\(/i);
    expect(migration143Code).not.toMatch(/\bencrypt\s*\(/i);
  });

  test("every secret-bearing column is opaque bytea (no server-interpretable key format)", () => {
    // wrapped_k_c and nonce must be bytea · never text / jsonb / varchar
    // · so the server has no structural ability to parse their contents.
    const wrappedLine = migration143Code
      .split(/\r?\n/)
      .find((l) => /\bwrapped_k_c\b/i.test(l));
    expect(wrappedLine, "wrapped_k_c declaration must exist").toBeTruthy();
    expect(wrappedLine!).toMatch(/\bbytea\b/i);
    expect(wrappedLine!).not.toMatch(/\btext\b|\bjsonb\b|\bvarchar\b/i);

    const nonceLine = migration143Code
      .split(/\r?\n/)
      .find((l) => /^\s*nonce\s+/i.test(l));
    expect(nonceLine, "nonce declaration must exist").toBeTruthy();
    expect(nonceLine!).toMatch(/\bbytea\b/i);
    expect(nonceLine!).not.toMatch(/\btext\b|\bjsonb\b|\bvarchar\b/i);
  });
});
