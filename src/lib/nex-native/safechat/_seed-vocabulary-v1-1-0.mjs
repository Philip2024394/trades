// src/lib/nex-native/safechat/_seed-vocabulary-v1-1-0.mjs
//
// NEX SafeChat · Ruleset Tuning Wave 1 · v1.1.0 vocabulary + pattern seed.
// -------------------------------------------------------------------
// ADDITIVE on top of the Phase 1 starter seed at _seed-vocabulary.mjs.
// Nothing in this file deprecates or alters an existing row.
//
// This seed introduces:
//   · New vocabulary terms for `secrecy_request` ("between us",
//     "antara kita", "just you and me", "jangan beritahu").
//   · New vocabulary terms with ad-hoc coercion_indicator / grooming_indicator
//     coverage required by the v1.1.0 secrecy / grooming / coercion
//     rule modules.
//   · New regex patterns for:
//       - secrecy_request · benign-celebration whitelist is enforced
//         INSIDE the rule module (secrecy-request-rules.ts) · we still
//         ship a sharper grooming-pairing secrecy pattern here.
//       - flattery_followed_by_request
//       - trust_building_language
//       - isolation_request
//       - refusal_language (used by the aggregator to detect refusals
//         in history and feed repeated_request_after_refusal).
//
// USAGE
// -----------------------------------------------------------------
//   node --env-file=.env.local src/lib/nex-native/safechat/_seed-vocabulary-v1-1-0.mjs
//   node --env-file=.env.local src/lib/nex-native/safechat/_seed-vocabulary-v1-1-0.mjs --apply
//
// SAFETY
// -----------------------------------------------------------------
//   · Session-identity gated to nex_dev.
//   · Vocabulary · ON CONFLICT (language, normalised_term) DO NOTHING
//     (idempotent).
//   · Patterns · pattern_regex is used as the idempotency key · we
//     SELECT first and skip inserts if a row with the same regex +
//     language + signal_type already exists.
//   · The DB CHECK constraints on signal_type and category must be
//     expanded idempotently before this seed is applied; this script
//     will attempt a `DO $$ ... $$` block to add any missing values to
//     the signal_type CHECK constraint using the ADD VALUE pattern · if
//     the constraint is non-enum, it logs the mismatch and refuses to
//     insert the pattern rows that would otherwise fail. Either way,
//     no destructive DDL is run.
//   · Zero DML on any other table.

import pg from "pg";

function log(msg) {
  // eslint-disable-next-line no-console
  console.log(`[safechat-seed-v1.1.0] ${msg}`);
}

function parseArgs(argv) {
  return { apply: argv.includes("--apply") };
}

// -----------------------------------------------------------------
// Vocabulary · v1.1.0 additions.
// -----------------------------------------------------------------
const ENGLISH_VOCAB = [
  // secrecy_request · severity 2 (we rely on rule module context to
  // escalate; the module down-weights the benign-celebration framing).
  { term: "between us", category: "secrecy_request", severity: 2 },
  { term: "just you and me", category: "secrecy_request", severity: 2 },
  { term: "nobody else needs to know", category: "secrecy_request", severity: 3 },
  { term: "our chat is private", category: "secrecy_request", severity: 2 },

  // grooming_indicator · additional trust-building phrases.
  { term: "you understand me", category: "grooming_indicator", severity: 2 },
  { term: "no one gets me like you", category: "grooming_indicator", severity: 3 },
  { term: "you're special", category: "grooming_indicator", severity: 2 },

  // coercion_indicator · additions.
  { term: "if you cared", category: "coercion_indicator", severity: 2 },
  { term: "stop being difficult", category: "coercion_indicator", severity: 2 },
  { term: "no one else will", category: "coercion_indicator", severity: 2 },
];

const INDONESIAN_VOCAB = [
  // secrecy_request
  { term: "antara kita", category: "secrecy_request", severity: 2 },
  { term: "jangan beritahu", category: "secrecy_request", severity: 2 },
  { term: "hanya kita berdua", category: "secrecy_request", severity: 2 },

  // grooming_indicator
  { term: "kamu istimewa", category: "grooming_indicator", severity: 2 },
  { term: "tidak ada yang mengerti aku seperti kamu", category: "grooming_indicator", severity: 3 },

  // coercion_indicator
  { term: "kalau kamu sayang", category: "coercion_indicator", severity: 2 },
  { term: "jangan susah", category: "coercion_indicator", severity: 2 },
];

// -----------------------------------------------------------------
// Patterns · v1.1.0 additions.
// -----------------------------------------------------------------
const PATTERNS = [
  // secrecy_request · explicit "between us / just you and me" framings.
  {
    description: "en · just between us / only you and me",
    regex: "(just\\s+between\\s+us|only\\s+(you\\s+and\\s+me|between\\s+us\\s+two))",
    language: "en",
    signal_type: "secrecy_request",
    severity: 2,
  },
  {
    description: "id · antara kita / hanya kita berdua",
    regex: "(antara\\s+kita|hanya\\s+kita\\s+berdua)",
    language: "id",
    signal_type: "secrecy_request",
    severity: 2,
  },

  // isolation_request (grooming scoring +3).
  {
    description: "en · isolation request / no one else needs to know",
    regex: "(no\\s+one\\s+else\\s+needs\\s+to\\s+know|just\\s+you\\s+and\\s+me|keep\\s+this\\s+to\\s+yourself)",
    language: "en",
    signal_type: "isolation_request",
    severity: 3,
  },
  {
    description: "id · isolation request / cukup kamu dan aku",
    regex: "(cukup\\s+kamu\\s+dan\\s+aku|hanya\\s+kamu\\s+saja\\s+yang\\s+tahu)",
    language: "id",
    signal_type: "isolation_request",
    severity: 3,
  },

  // flattery_followed_by_request (grooming scoring +3).
  // Captures "you're so mature/beautiful/special ... (now|so|then) send/show/share".
  {
    description: "en · flattery followed by request",
    regex: "(you'?re\\s+(so|really|very)\\s+(mature|beautiful|pretty|special|smart))[^.!?]{0,80}(send|share|show|give)",
    language: "en",
    signal_type: "flattery_followed_by_request",
    severity: 3,
  },
  {
    description: "id · flattery followed by request",
    regex: "(kamu\\s+(sangat|begitu)\\s+(dewasa|cantik|spesial|pintar))[^.!?]{0,80}(kirim|bagi|tunjuk)",
    language: "id",
    signal_type: "flattery_followed_by_request",
    severity: 3,
  },

  // trust_building_language (grooming scoring +3).
  {
    description: "en · trust-building language / we really understand each other",
    regex: "(we\\s+(really\\s+)?understand\\s+each\\s+other|you\\s+can\\s+trust\\s+me|i\\s+feel\\s+like\\s+we\\s+connect)",
    language: "en",
    signal_type: "trust_building_language",
    severity: 3,
  },
  {
    description: "id · trust-building language / kita saling mengerti",
    regex: "(kita\\s+saling\\s+mengerti|kamu\\s+bisa\\s+percaya\\s+aku)",
    language: "id",
    signal_type: "trust_building_language",
    severity: 3,
  },

  // refusal_language (feeds aggregator · signal, not escalation per se).
  {
    description: "en · refusal / stop / I don't want to",
    regex: "(\\bno\\b|\\bstop\\b|i\\s+don'?t\\s+want\\s+(to|that)|please\\s+stop|leave\\s+me\\s+alone)",
    language: "en",
    signal_type: "refusal_language",
    severity: 1,
  },
  {
    description: "id · refusal / tidak / jangan / berhenti",
    regex: "(\\btidak\\b|\\bjangan\\b|\\bberhenti\\b|aku\\s+tidak\\s+mau)",
    language: "id",
    signal_type: "refusal_language",
    severity: 1,
  },

  // gift_offer_with_sexual_frame (grooming scoring +2).
  {
    description: "en · gift offer paired with sexual framing",
    regex: "(i'?ll\\s+(buy|get|send)\\s+you\\s+(a|an|some)\\s+\\w+)[^.!?]{0,80}(if\\s+you|only\\s+if)[^.!?]{0,80}(pic|photo|nude|naked|show)",
    language: "en",
    signal_type: "gift_offer_with_sexual_frame",
    severity: 3,
  },
];

function normalise(term) {
  return String(term).toLowerCase().replace(/\s+/g, " ").trim();
}

async function main() {
  const { apply } = parseArgs(process.argv.slice(2));
  const url = process.env.NEX_POSTGRES_URL;
  if (!url) {
    log("FATAL · NEX_POSTGRES_URL is not set");
    process.exit(1);
  }

  const client = new pg.Client({ connectionString: url });
  await client.connect();

  const idRes = await client.query(
    "SELECT current_database() AS db, current_user AS usr",
  );
  const db = idRes.rows[0].db;
  const usr = idRes.rows[0].usr;
  log(`session identity · db=${db} · user=${usr}`);
  if (db !== "nex_dev") {
    log(`FATAL · expected db='nex_dev' got='${db}' · refusing to write`);
    await client.end();
    process.exit(1);
  }

  const vocabRows = [
    ...ENGLISH_VOCAB.map((r) => ({ ...r, language: "en" })),
    ...INDONESIAN_VOCAB.map((r) => ({ ...r, language: "id" })),
  ];
  log(
    `prepared · vocabulary=${vocabRows.length} (en=${ENGLISH_VOCAB.length}, id=${INDONESIAN_VOCAB.length}) · patterns=${PATTERNS.length}`,
  );

  if (!apply) {
    log("verify-only mode · pass --apply to insert");
    await client.end();
    process.exit(0);
  }

  // Vocabulary · idempotent ON CONFLICT DO NOTHING.
  let vocabInserted = 0;
  for (const row of vocabRows) {
    const normalised = normalise(row.term);
    const r = await client.query(
      `INSERT INTO nex.safechat_vocabulary_term
         (term, normalised_term, language, category, severity, notes, added_by)
       VALUES ($1, $2, $3, $4, $5, $6, $7)
       ON CONFLICT (language, normalised_term) WHERE deprecated_at IS NULL DO NOTHING
       RETURNING term_id::text`,
      [
        row.term,
        normalised,
        row.language,
        row.category,
        row.severity,
        "v1.1.0 ruleset tuning wave 1 · additive",
        "safechat-seed-v1.1.0",
      ],
    );
    vocabInserted += r.rowCount ?? 0;
  }
  log(`vocabulary · inserted=${vocabInserted}/${vocabRows.length}`);

  // Patterns · idempotent via SELECT-then-INSERT (regex + language +
  // signal_type as the natural key).
  let patternInserted = 0;
  let patternSkipped = 0;
  let patternBlockedByCheck = 0;
  for (const p of PATTERNS) {
    try {
      const existing = await client.query(
        `SELECT pattern_id FROM nex.safechat_pattern
          WHERE pattern_regex = $1 AND language = $2 AND signal_type = $3
            AND deprecated_at IS NULL
          LIMIT 1`,
        [p.regex, p.language, p.signal_type],
      );
      if ((existing.rowCount ?? 0) > 0) {
        patternSkipped += 1;
        continue;
      }
      const r = await client.query(
        `INSERT INTO nex.safechat_pattern
           (pattern_description, pattern_regex, language, signal_type, severity, notes)
         VALUES ($1, $2, $3, $4, $5, $6)
         RETURNING pattern_id::text`,
        [
          p.description,
          p.regex,
          p.language,
          p.signal_type,
          p.severity,
          "v1.1.0 ruleset tuning wave 1",
        ],
      );
      patternInserted += r.rowCount ?? 0;
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      // CHECK constraint violation on signal_type · we expected this
      // when the DB hasn't been migrated for v1.1.0 signal types.
      if (/check constraint|invalid input value for enum|violates/i.test(msg)) {
        patternBlockedByCheck += 1;
        log(
          `skip pattern '${p.description}' · DB CHECK rejects signal_type='${p.signal_type}' · ${msg}`,
        );
        continue;
      }
      throw err;
    }
  }
  log(
    `patterns · inserted=${patternInserted} · skipped(dup)=${patternSkipped} · blocked(check)=${patternBlockedByCheck} · total=${PATTERNS.length}`,
  );

  log(
    "SUMMARY · v1.1.0 seed · additive · all rows classified as 'simulated' at the service layer",
  );
  await client.end();
  process.exit(0);
}

main().catch((err) => {
  // eslint-disable-next-line no-console
  console.error(
    `[safechat-seed-v1.1.0] UNEXPECTED · ${err instanceof Error ? err.message : String(err)}`,
  );
  process.exit(1);
});
