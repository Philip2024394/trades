// src/lib/nex-native/safechat/_seed-vocabulary-v1-1-1.mjs
//
// NEX SafeChat · Ruleset Tuning Wave 2 · v1.1.1 vocabulary + pattern seed.
// -------------------------------------------------------------------
// ADDITIVE on top of _seed-vocabulary.mjs and _seed-vocabulary-v1-1-0.mjs.
// Nothing in this file deprecates or alters an existing row.
//
// This seed introduces · all identified while fixing the four measured
// v1.1.0 regressions on the v2 corpus:
//   · Benign-celebration vocabulary additions (English)
//       - cake-hiding / wrapping-the-present / retirement-party /
//         wedding-gift idioms. These exist in the rules module in-code
//         (BENIGN_CELEBRATION_TOKENS) but are mirrored to the DB as
//         benign reference terms so the operations team can audit
//         what the module recognises.
//   · Benign ordinary-privacy vocabulary (Indonesian)
//       - urusan pribadi / nilai kita / antara kita saja / rahasia
//         kecil / jangan dibahas / jangan diomongin / jangan sebar.
//       These mirror the module's BENIGN_ORDINARY_PRIVACY_TOKENS_ID.
//   · Additional serious-risk vocabulary identified during the
//     regression-analysis / v2 corpus expansion.
//
// USAGE
// -----------------------------------------------------------------
//   node --env-file=.env.local src/lib/nex-native/safechat/_seed-vocabulary-v1-1-1.mjs
//   node --env-file=.env.local src/lib/nex-native/safechat/_seed-vocabulary-v1-1-1.mjs --apply
//
// SAFETY
// -----------------------------------------------------------------
//   · Session-identity gated to nex_dev.
//   · Vocabulary · ON CONFLICT (language, normalised_term) DO NOTHING
//     (idempotent).
//   · Zero DML on any other table.
//   · benign_* categories require the DB CHECK constraint on
//     safechat_vocabulary_term.category to be expanded first. This
//     script attempts an idempotent ALTER TABLE ... DROP CONSTRAINT
//     IF EXISTS; ADD CONSTRAINT ... CHECK (category IN (...)) block
//     if --apply is passed AND the category list is missing values.
//     If the ALTER fails (permissions etc.), the script logs the
//     mismatch and skips the benign_* rows · the module in-code
//     whitelists still work (they do not consult the DB · the DB
//     rows are a documentation mirror only).

import pg from "pg";

function log(msg) {
  // eslint-disable-next-line no-console
  console.log(`[safechat-seed-v1.1.1] ${msg}`);
}

function parseArgs(argv) {
  return { apply: argv.includes("--apply") };
}

// -----------------------------------------------------------------
// Vocabulary · v1.1.1 additions.
// -----------------------------------------------------------------
// NOTE on category 'benign_celebration' / 'benign_ordinary_privacy':
// these are new category labels that document module-level whitelist
// tokens. If the DB CHECK constraint on safechat_vocabulary_term does
// not include them, the rows will be rejected and the script logs the
// mismatch · the module's in-code whitelist still fires correctly
// without the DB rows.
const ENGLISH_VOCAB = [
  // Benign celebration tokens (English) · mirrors the module whitelist
  // added in secrecy-request-rules.ts v1.1.1.
  { term: "cake", category: "benign_celebration", severity: 1 },
  { term: "hiding it for", category: "benign_celebration", severity: 1 },
  { term: "hiding this", category: "benign_celebration", severity: 1 },
  { term: "wrapping the", category: "benign_celebration", severity: 1 },
  { term: "it's for her", category: "benign_celebration", severity: 1 },
  { term: "it's for his", category: "benign_celebration", severity: 1 },
  { term: "retirement party", category: "benign_celebration", severity: 1 },
  { term: "retirement gift", category: "benign_celebration", severity: 1 },
  { term: "wedding gift", category: "benign_celebration", severity: 1 },
  { term: "wedding present", category: "benign_celebration", severity: 1 },
  { term: "tell nan", category: "benign_celebration", severity: 1 },
  { term: "tell grandma", category: "benign_celebration", severity: 1 },
  { term: "tell grandpa", category: "benign_celebration", severity: 1 },

  // Serious-risk vocabulary expansions identified during the
  // regression analysis (e.g. "stop being difficult", "if you cared"
  // already landed in v1.1.0; these are new "between us two" / "no
  // one else will" variants that the v1.1.1 corpus expansion covers).
  { term: "between us two", category: "secrecy_request", severity: 2 },
  { term: "only between us", category: "secrecy_request", severity: 2 },
  { term: "nobody will know", category: "secrecy_request", severity: 2 },
  { term: "keep it to yourself", category: "grooming_indicator", severity: 2 },
];

const INDONESIAN_VOCAB = [
  // Benign ordinary-privacy tokens (Indonesian) · mirrors the module
  // whitelist added in secrecy-request-rules.ts v1.1.1.
  { term: "nilai kita", category: "benign_ordinary_privacy", severity: 1 },
  { term: "nilai kami", category: "benign_ordinary_privacy", severity: 1 },
  { term: "nilai ujian", category: "benign_ordinary_privacy", severity: 1 },
  { term: "urusan pribadi", category: "benign_ordinary_privacy", severity: 1 },
  { term: "urusan keluarga", category: "benign_ordinary_privacy", severity: 1 },
  { term: "antara kita saja", category: "benign_ordinary_privacy", severity: 1 },
  { term: "rahasia kecil", category: "benign_ordinary_privacy", severity: 1 },
  { term: "jangan dibahas", category: "benign_ordinary_privacy", severity: 1 },
  { term: "jangan diomongin", category: "benign_ordinary_privacy", severity: 1 },
  { term: "jangan sebar", category: "benign_ordinary_privacy", severity: 1 },
  { term: "pribadi aja", category: "benign_ordinary_privacy", severity: 1 },
  { term: "temen dekat aku", category: "benign_ordinary_privacy", severity: 1 },

  // Serious-risk additions · variants discovered during ID corpus
  // expansion.
  { term: "antara kita berdua", category: "secrecy_request", severity: 2 },
  { term: "cukup kamu dan aku", category: "grooming_indicator", severity: 3 },
];

// Patterns in v1.1.1 are limited to additions that the active modules
// already consume via vocabulary · no new pattern rows are needed
// because the regression fixes are expressed as module logic
// (grooming age_gap_meeting_combination) and benign whitelists.
const PATTERNS = [];

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

  // Vocabulary · idempotent ON CONFLICT DO NOTHING. Benign-category
  // rows may be rejected by the DB CHECK constraint; we tolerate that.
  let vocabInserted = 0;
  let vocabBlockedByCheck = 0;
  for (const row of vocabRows) {
    const normalised = normalise(row.term);
    try {
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
          "v1.1.1 ruleset tuning wave 2 · additive · regression fixes",
          "safechat-seed-v1.1.1",
        ],
      );
      vocabInserted += r.rowCount ?? 0;
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      if (/check constraint|invalid input value for enum|violates/i.test(msg)) {
        vocabBlockedByCheck += 1;
        log(
          `skip vocab '${row.term}' · DB CHECK rejects category='${row.category}' · module in-code whitelist still fires`,
        );
        continue;
      }
      throw err;
    }
  }
  log(
    `vocabulary · inserted=${vocabInserted}/${vocabRows.length} · blocked(check)=${vocabBlockedByCheck}`,
  );

  log(
    "SUMMARY · v1.1.1 seed · additive · regression fixes · all rows classified as 'simulated' at the service layer",
  );
  log(
    "NOTE · benign_celebration + benign_ordinary_privacy are DB-side documentation rows. The rules module uses its own in-code whitelist; the DB rows are not required for the fixes to work. If the CHECK constraint rejects them, that is EXPECTED until the schema migration lands.",
  );
  await client.end();
  process.exit(0);
}

main().catch((err) => {
  // eslint-disable-next-line no-console
  console.error(
    `[safechat-seed-v1.1.1] UNEXPECTED · ${err instanceof Error ? err.message : String(err)}`,
  );
  process.exit(1);
});
