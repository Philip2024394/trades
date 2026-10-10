// scripts/nex-canonical/__tests__/migration-199.test.ts
//
// Structural tests for migration 199 (NEX SafeChat Phase 1 schema).
// Pure · read-only inspection of the SQL file. No DB. No network.

import { describe, expect, test } from "vitest";
import * as fs from "node:fs";
import * as path from "node:path";

const MIG_PATH = path.join(
  __dirname,
  "..",
  "..",
  "..",
  "deploy",
  "postgres",
  "init",
  "199_nex_safechat_schema.sql",
);

function readCode(): string {
  const sql = fs.readFileSync(MIG_PATH, "utf8");
  // Strip SQL comments so grep-style tests don't match doc prose.
  return sql.replace(/--[^\n]*/g, "");
}

describe("migration 199 · existence + target", () => {
  test("file exists", () => {
    expect(fs.existsSync(MIG_PATH)).toBe(true);
  });

  test("file is non-trivially sized (>2KB)", () => {
    const raw = fs.readFileSync(MIG_PATH, "utf8");
    expect(raw.length).toBeGreaterThan(2048);
  });

  test("creates nex.safechat_classification table", () => {
    expect(readCode()).toMatch(
      /CREATE\s+TABLE\s+IF\s+NOT\s+EXISTS\s+nex\.safechat_classification/i,
    );
  });

  test("creates nex.safechat_vocabulary_term table", () => {
    expect(readCode()).toMatch(
      /CREATE\s+TABLE\s+IF\s+NOT\s+EXISTS\s+nex\.safechat_vocabulary_term/i,
    );
  });

  test("creates nex.safechat_pattern table", () => {
    expect(readCode()).toMatch(
      /CREATE\s+TABLE\s+IF\s+NOT\s+EXISTS\s+nex\.safechat_pattern/i,
    );
  });
});

describe("migration 199 · safechat_classification columns", () => {
  test("classification_id uuid PK with default", () => {
    expect(readCode()).toMatch(
      /classification_id\s+uuid\s+PRIMARY\s+KEY\s+DEFAULT\s+gen_random_uuid\(\)/i,
    );
  });

  test("message_ref text NOT NULL", () => {
    expect(readCode()).toMatch(/message_ref\s+text\s+NOT\s+NULL/i);
  });

  test("sender_account_id text NOT NULL", () => {
    expect(readCode()).toMatch(/sender_account_id\s+text\s+NOT\s+NULL/i);
  });

  test("recipient_account_id text NOT NULL", () => {
    expect(readCode()).toMatch(/recipient_account_id\s+text\s+NOT\s+NULL/i);
  });

  test("conversation_id text NULL", () => {
    expect(readCode()).toMatch(/conversation_id\s+text\s+NULL/i);
  });

  test("level smallint with CHECK IN (0,1,2,3)", () => {
    const code = readCode();
    expect(code).toMatch(/level\s+smallint\s+NOT\s+NULL/i);
    expect(code).toMatch(/level\s+IN\s*\(\s*0\s*,\s*1\s*,\s*2\s*,\s*3\s*\)/i);
  });

  test("confidence numeric(4,3) 0..1", () => {
    const code = readCode();
    expect(code).toMatch(/confidence\s+numeric\(4,3\)\s+NOT\s+NULL/i);
    expect(code).toMatch(/confidence\s*>=\s*0\s+AND\s+confidence\s*<=\s*1/i);
  });

  test("rule_matches jsonb NOT NULL DEFAULT []", () => {
    expect(readCode()).toMatch(/rule_matches\s+jsonb\s+NOT\s+NULL\s+DEFAULT\s+'\[\]'::jsonb/i);
  });

  test("language_detected nullable with length guard", () => {
    const code = readCode();
    expect(code).toMatch(/language_detected\s+text\s+NULL/i);
    expect(code).toMatch(/length\(language_detected\)\s+BETWEEN\s+2\s+AND\s+10/i);
  });

  test("signals jsonb NOT NULL DEFAULT {}", () => {
    expect(readCode()).toMatch(/signals\s+jsonb\s+NOT\s+NULL\s+DEFAULT\s+'\{\}'::jsonb/i);
  });

  test("visibility_to_guardian boolean NOT NULL DEFAULT FALSE", () => {
    expect(readCode()).toMatch(
      /visibility_to_guardian\s+boolean\s+NOT\s+NULL\s+DEFAULT\s+FALSE/i,
    );
  });

  test("simulated boolean NOT NULL DEFAULT TRUE", () => {
    expect(readCode()).toMatch(/simulated\s+boolean\s+NOT\s+NULL\s+DEFAULT\s+TRUE/i);
  });

  test("classified_at timestamptz NOT NULL DEFAULT now()", () => {
    expect(readCode()).toMatch(/classified_at\s+timestamptz\s+NOT\s+NULL\s+DEFAULT\s+now\(\)/i);
  });

  test("classifier_version text NOT NULL", () => {
    expect(readCode()).toMatch(/classifier_version\s+text\s+NOT\s+NULL/i);
  });
});

describe("migration 199 · safechat_vocabulary_term columns + CHECKs", () => {
  test("term_id uuid PK", () => {
    expect(readCode()).toMatch(
      /term_id\s+uuid\s+PRIMARY\s+KEY\s+DEFAULT\s+gen_random_uuid\(\)/i,
    );
  });

  test("language length check 2..10", () => {
    expect(readCode()).toMatch(/length\(language\)\s+BETWEEN\s+2\s+AND\s+10/i);
  });

  test("category CHECK includes all 10 sealed values", () => {
    const code = readCode();
    for (const c of [
      "sexual_slang",
      "explicit_sexual",
      "violence",
      "self_harm",
      "drugs",
      "grooming_indicator",
      "coercion_indicator",
      "image_request",
      "secrecy_request",
      "meeting_arrangement",
    ]) {
      expect(code).toMatch(new RegExp(`'${c}'`));
    }
  });

  test("severity CHECK IN (1,2,3)", () => {
    expect(readCode()).toMatch(/severity\s+smallint\s+NOT\s+NULL/i);
    expect(readCode()).toMatch(/severity\s+IN\s*\(\s*1\s*,\s*2\s*,\s*3\s*\)/i);
  });

  test("deprecated_at nullable timestamptz", () => {
    expect(readCode()).toMatch(/deprecated_at\s+timestamptz\s+NULL/i);
  });

  test("UNIQUE index on (language, normalised_term) WHERE deprecated_at IS NULL", () => {
    const code = readCode();
    expect(code).toMatch(
      /CREATE\s+UNIQUE\s+INDEX\s+IF\s+NOT\s+EXISTS\s+safechat_vocabulary_term_lang_term_uq/i,
    );
    expect(code).toMatch(/\(language,\s*normalised_term\)[\s\S]*?WHERE\s+deprecated_at\s+IS\s+NULL/i);
  });
});

describe("migration 199 · safechat_pattern columns + CHECKs", () => {
  test("pattern_description length check 1..300", () => {
    expect(readCode()).toMatch(/length\(pattern_description\)\s+BETWEEN\s+1\s+AND\s+300/i);
  });

  test("pattern_regex length check 1..500", () => {
    expect(readCode()).toMatch(/length\(pattern_regex\)\s+BETWEEN\s+1\s+AND\s+500/i);
  });

  test("signal_type CHECK includes all 8 sealed values", () => {
    const code = readCode();
    for (const s of [
      "image_request",
      "coercion_followup",
      "secrecy_request",
      "meeting_arrangement",
      "platform_switch_invitation",
      "repeated_pressure_after_refusal",
      "gift_offer_with_sexual_frame",
      "age_gap_disclosure",
    ]) {
      expect(code).toMatch(new RegExp(`'${s}'`));
    }
  });
});

describe("migration 199 · indexes", () => {
  test("safechat_classification_time_idx (classified_at DESC)", () => {
    const code = readCode();
    expect(code).toMatch(/safechat_classification_time_idx/i);
    expect(code).toMatch(/classified_at\s+DESC/i);
  });

  test("safechat_classification_level_time_idx (level, classified_at DESC)", () => {
    const code = readCode();
    expect(code).toMatch(/safechat_classification_level_time_idx/i);
    expect(code).toMatch(/level,\s*classified_at\s+DESC/i);
  });

  test("safechat_classification_conversation_time_idx is partial", () => {
    const code = readCode();
    expect(code).toMatch(/safechat_classification_conversation_time_idx/i);
    expect(code).toMatch(/WHERE\s+conversation_id\s+IS\s+NOT\s+NULL/i);
  });

  test("safechat_pattern_language_idx WHERE deprecated_at IS NULL", () => {
    const code = readCode();
    expect(code).toMatch(/safechat_pattern_language_idx/i);
    expect(code).toMatch(/safechat_pattern[\s\S]*?language[\s\S]*?WHERE\s+deprecated_at\s+IS\s+NULL/i);
  });
});

describe("migration 199 · idempotence + doctrine", () => {
  test("every CREATE INDEX uses IF NOT EXISTS", () => {
    const code = readCode();
    const creates = code.match(/\bCREATE\s+(?:UNIQUE\s+)?INDEX\s+(?:IF\s+NOT\s+EXISTS\s+)?/gi) ?? [];
    const guarded = code.match(/\bCREATE\s+(?:UNIQUE\s+)?INDEX\s+IF\s+NOT\s+EXISTS\b/gi) ?? [];
    expect(guarded.length).toBe(creates.length);
    expect(creates.length).toBeGreaterThan(0);
  });

  test("every CREATE TABLE uses IF NOT EXISTS", () => {
    const code = readCode();
    const creates = code.match(/\bCREATE\s+TABLE\s+(?:IF\s+NOT\s+EXISTS\s+)?/gi) ?? [];
    const guarded = code.match(/\bCREATE\s+TABLE\s+IF\s+NOT\s+EXISTS\b/gi) ?? [];
    expect(guarded.length).toBe(creates.length);
    expect(creates.length).toBe(3);
  });

  test("zero DML in migration", () => {
    const code = readCode();
    expect(code).not.toMatch(/\bINSERT\s+INTO\b/i);
    expect(code).not.toMatch(/\bUPDATE\s+\w+\s+SET\b/i);
    expect(code).not.toMatch(/\bDELETE\s+FROM\b/i);
  });

  test("header documents Phase 1 instrumentation-only doctrine", () => {
    const raw = fs.readFileSync(MIG_PATH, "utf8");
    expect(raw).toMatch(/instrumentation/i);
    expect(raw).toMatch(/zero user-facing effect/i);
  });

  test("header documents simulated=TRUE and visibility_to_guardian=FALSE invariants", () => {
    const raw = fs.readFileSync(MIG_PATH, "utf8");
    expect(raw).toMatch(/simulated\s*=\s*TRUE/i);
    expect(raw).toMatch(/visibility_to_guardian\s*=\s*FALSE/i);
  });

  test("header documents DELIBERATELY INCOMPLETE vocabulary", () => {
    const raw = fs.readFileSync(MIG_PATH, "utf8");
    expect(raw).toMatch(/deliberately incomplete/i);
  });

  test("header documents encrypted-messages-skipped invariant", () => {
    const raw = fs.readFileSync(MIG_PATH, "utf8");
    expect(raw).toMatch(/encrypted/i);
    expect(raw).toMatch(/SKIP|skipped/i);
  });
});
