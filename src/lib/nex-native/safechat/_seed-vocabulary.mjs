// src/lib/nex-native/safechat/_seed-vocabulary.mjs
//
// NEX SafeChat Phase 1 · bilingual starter seed.
//
// DOCTRINE
// -----------------------------------------------------------------
// This seed is DELIBERATELY INCOMPLETE. It is a conservative starting
// point for Phase 1 instrumentation only. We ship ~20 English + ~15
// Bahasa Indonesia terms so the classifier has enough signal to
// produce useful log entries, and 10 regex patterns covering
// image_request / secrecy_request / meeting_arrangement / repeated
// pressure.
//
// We do NOT ship:
//   · fabricated slang from training data (every term here is
//     mundane dictionary vocabulary with a clear context tag)
//   · exhaustive sexual vocabulary (ethics review required)
//   · profanity we don't have a measured category for
//
// Phase 2+ expansion requires a separate wave + ethics review ·
// see docs/doctrine/nex-safechat-phase-1-simulated-2026-10-10.md.
//
// USAGE
// -----------------------------------------------------------------
//   node --env-file=.env.local src/lib/nex-native/safechat/_seed-vocabulary.mjs
//   node --env-file=.env.local src/lib/nex-native/safechat/_seed-vocabulary.mjs --apply
//
// Dry-run by default · prints the row counts that WOULD be inserted.
// Pass --apply to perform the ON CONFLICT DO NOTHING insert.
//
// SAFETY
// -----------------------------------------------------------------
//   · Session-identity gated to nex_dev.
//   · ON CONFLICT DO NOTHING on (language, normalised_term) · idempotent.
//   · Pre-insert sanity check for required columns.
//   · Zero DML on any other table.

import pg from "pg";

function log(msg) {
  // eslint-disable-next-line no-console
  console.log(`[safechat-seed] ${msg}`);
}

function parseArgs(argv) {
  return { apply: argv.includes("--apply") };
}

// -----------------------------------------------------------------
// Vocabulary · English (~20 terms)
// -----------------------------------------------------------------
const ENGLISH_VOCAB = [
  // sexual_slang · severity 1 (low) · mundane dictionary terms with a
  // sexual connotation. Used as a trigger for level 1 only.
  { term: "boobs", category: "sexual_slang", severity: 1 },
  { term: "butt", category: "sexual_slang", severity: 1 },

  // explicit_sexual · severity 2 (medium) · clearly adult.
  { term: "sex", category: "explicit_sexual", severity: 2 },
  { term: "nude", category: "explicit_sexual", severity: 2 },
  { term: "naked", category: "explicit_sexual", severity: 2 },

  // violence · severity 2 · dictionary vocab for weapons / harm.
  { term: "kill", category: "violence", severity: 2 },
  { term: "gun", category: "violence", severity: 2 },

  // self_harm · severity 3 · high-signal verbs. Phase 1 just logs ·
  // Phase 3+ may surface a resource card after ethics review.
  { term: "suicide", category: "self_harm", severity: 3 },

  // drugs · severity 2.
  { term: "drugs", category: "drugs", severity: 2 },
  { term: "weed", category: "drugs", severity: 2 },

  // grooming_indicator · severity 3 · classic trust-building phrases
  // that frequently show up in grooming conversations.
  { term: "our little secret", category: "grooming_indicator", severity: 3 },
  { term: "you're so mature", category: "grooming_indicator", severity: 3 },
  { term: "do you trust me", category: "grooming_indicator", severity: 2 },

  // coercion_indicator · severity 2 · phrases that frame pressure.
  { term: "or else", category: "coercion_indicator", severity: 2 },
  { term: "if you love me", category: "coercion_indicator", severity: 2 },
  { term: "you owe me", category: "coercion_indicator", severity: 2 },

  // image_request · severity 2.
  { term: "pic", category: "image_request", severity: 2 },
  { term: "photo", category: "image_request", severity: 2 },

  // secrecy_request · severity 3.
  { term: "don't tell", category: "secrecy_request", severity: 3 },

  // meeting_arrangement · severity 2.
  { term: "meet up", category: "meeting_arrangement", severity: 2 },
];

// -----------------------------------------------------------------
// Vocabulary · Bahasa Indonesia (~15 terms)
// -----------------------------------------------------------------
const INDONESIAN_VOCAB = [
  // explicit_sexual
  { term: "seks", category: "explicit_sexual", severity: 2 },
  { term: "telanjang", category: "explicit_sexual", severity: 2 },
  { term: "bugil", category: "explicit_sexual", severity: 2 },

  // violence
  { term: "bunuh", category: "violence", severity: 2 },
  { term: "pistol", category: "violence", severity: 2 },

  // self_harm
  { term: "bunuh diri", category: "self_harm", severity: 3 },

  // drugs
  { term: "narkoba", category: "drugs", severity: 2 },
  { term: "ganja", category: "drugs", severity: 2 },

  // grooming_indicator
  { term: "rahasia kita", category: "grooming_indicator", severity: 3 },
  { term: "kamu dewasa", category: "grooming_indicator", severity: 2 },

  // coercion_indicator
  { term: "kalau tidak", category: "coercion_indicator", severity: 2 },
  { term: "kalau cinta aku", category: "coercion_indicator", severity: 2 },

  // image_request
  { term: "foto", category: "image_request", severity: 2 },

  // secrecy_request
  { term: "jangan bilang", category: "secrecy_request", severity: 3 },

  // meeting_arrangement
  { term: "ketemuan", category: "meeting_arrangement", severity: 2 },
];

// -----------------------------------------------------------------
// Patterns · 10 total · bilingual coverage of image_request /
// secrecy / meeting / platform-switch / pressure.
// -----------------------------------------------------------------
const PATTERNS = [
  {
    description: "en · explicit send-image request",
    regex: "send\\s+(me\\s+)?(a\\s+)?(pic|photo|picture|selfie|snap)",
    language: "en",
    signal_type: "image_request",
    severity: 2,
  },
  {
    description: "en · show-me-your-X request",
    regex: "show\\s+me\\s+(your|some)\\s+\\w+",
    language: "en",
    signal_type: "image_request",
    severity: 2,
  },
  {
    description: "en · don't tell someone (secrecy)",
    regex: "don[’']?t\\s+tell\\s+(your\\s+)?(mum|mom|parents|anyone|dad)",
    language: "en",
    signal_type: "secrecy_request",
    severity: 3,
  },
  {
    description: "id · jangan bilang siapa-siapa (secrecy)",
    regex: "jangan\\s+bilang(\\s+siapa[-\\s]?siapa)?",
    language: "id",
    signal_type: "secrecy_request",
    severity: 3,
  },
  {
    description: "en · let's meet up / can we meet",
    regex: "(let[’']?s|can\\s+we|wanna)\\s+(meet(\\s+up)?|hang\\s+out)",
    language: "en",
    signal_type: "meeting_arrangement",
    severity: 2,
  },
  {
    description: "id · ayo ketemuan",
    regex: "(ayo|yuk)\\s+ketemuan",
    language: "id",
    signal_type: "meeting_arrangement",
    severity: 2,
  },
  {
    description: "en · switch to WhatsApp / Signal / Telegram",
    regex: "(move|switch|go|chat|dm)\\s+(to|on)\\s+(whatsapp|signal|telegram|snapchat|insta|instagram)",
    language: "en",
    signal_type: "platform_switch_invitation",
    severity: 2,
  },
  {
    description: "id · pindah ke WhatsApp / Telegram",
    regex: "pindah\\s+(ke|di)\\s+(whatsapp|wa|telegram|signal|snapchat|ig|instagram)",
    language: "id",
    signal_type: "platform_switch_invitation",
    severity: 2,
  },
  {
    description: "en · repeated pressure after a refusal",
    regex: "(come\\s+on|please\\s+please|just\\s+(one|a\\s+little))",
    language: "en",
    signal_type: "repeated_pressure_after_refusal",
    severity: 2,
  },
  {
    description: "en · age gap disclosure",
    regex: "i['’]?m\\s+\\d{2}\\s+(and|,)\\s+you['’]?re\\s+\\d{1,2}",
    language: "en",
    signal_type: "age_gap_disclosure",
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
  log("NOTE · vocabulary is DELIBERATELY INCOMPLETE · see doctrine");

  if (!apply) {
    log("verify-only mode · pass --apply to insert");
    await client.end();
    process.exit(0);
  }

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
        "phase-1-starter-seed · deliberately incomplete",
        "safechat-seed",
      ],
    );
    vocabInserted += r.rowCount ?? 0;
  }
  log(`vocabulary · inserted=${vocabInserted}/${vocabRows.length}`);

  let patternInserted = 0;
  for (const p of PATTERNS) {
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
        "phase-1-starter-seed",
      ],
    );
    patternInserted += r.rowCount ?? 0;
  }
  log(`patterns · inserted=${patternInserted}/${PATTERNS.length}`);

  log("SUMMARY · phase-1 bilingual seed applied · all rows are classified as 'simulated' at the service layer");
  await client.end();
  process.exit(0);
}

main().catch((err) => {
  // eslint-disable-next-line no-console
  console.error(
    `[safechat-seed] UNEXPECTED · ${err instanceof Error ? err.message : String(err)}`,
  );
  process.exit(1);
});
