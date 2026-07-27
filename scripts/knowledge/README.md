# NEX Knowledge Pipeline

Local automation for turning raw FAQ dumps into a validated, deduplicated, voice-checked master knowledge database. Built to scale from 869 entries today to 50,000+ tomorrow.

## The flow

```
      raw FAQ (ChatGPT dump, expert notes, whatever)
                       ↓
        npm run knowledge:generate <cat> <input.md>
                       ↓
              knowledge/<category>.json      ← per-category, small, versionable
                       ↓
             npm run knowledge:validate      ← schema · uniqueness · voice · UK spelling
                       ↓
              npm run knowledge:build        ← merges everything, sorts, checksums
                       ↓
              knowledge_master.json          ← single artefact for downstream
                       ↓
        (Supabase upload · SEO pages · AskNex)
```

## Directory layout

```
knowledge/
  cement.json
  sand.json
  steel-nails.json
  hand-tools.json
  timber.json       ← add categories over time
  oak.json
  ...

scripts/knowledge/
  _lib.mjs          shared helpers (voice rules · US-spelling list · banned phrases)
  generate.mjs      raw FAQ md → per-category JSON (calls Anthropic)
  validate.mjs      lint · uniqueness · voice · schema
  build.mjs         merges knowledge/*.json → knowledge_master.json
  README.md         this file

knowledge_master.json   generated · never edited by hand
```

## Commands

```bash
# Generate a new category from a raw markdown FAQ dump
npm run knowledge:generate cement docs/brains/cement-faqs-raw.md
# → writes knowledge/cement.json

# Validate everything (safe · offline · fast)
npm run knowledge:validate
# → reports errors + warnings, exits 1 on error

# Strict mode — treat warnings as errors
npm run knowledge:validate:strict

# Build the master (validates first automatically)
npm run knowledge:build
# → writes knowledge_master.json

# One-shot: validate + build
npm run knowledge:all
```

## What validate.mjs checks

**Errors** (block build):
- Missing required fields (`id`, `kind`, `question`, `answer`, `category_tag`)
- Duplicate IDs across all categories
- Duplicate IDs within a single file
- Banned phrases: "cheap", "In most cases", "provided that", marketing fluff
- Any reference exposing internal architecture (Brain, LLM, RAG, memory layer, etc.)

**Warnings** (don't block, do report):
- Answers <20 or >800 chars
- No Nex voice markers (contractions, em dashes, direct "you")
- US spellings (color / favor / center / etc.)
- Near-duplicate questions (based on normalised keyword match)
- `fact_check_flag` still set (needs Author review before publish)

## Adding a new category

1. Drop raw FAQ into `docs/brains/<category>-faqs-raw.md` (numbered format)
2. `npm run knowledge:generate <category> docs/brains/<category>-faqs-raw.md`
3. `npm run knowledge:validate` — fix any errors
4. `npm run knowledge:build`
5. Commit `knowledge/<category>.json` (small diff, easy review)

Master is regenerated on every build so it's never in git conflict.

## Design principles

- **Per-category files, not one giant file** — small diffs, easy Author review, git-friendly
- **Fail-fast validation** — build refuses to run on invalid data unless explicitly overridden
- **Offline validation** — no LLM or network needed, runs in <1 second
- **Deterministic output** — master is sorted by ID, so diffs are meaningful
- **Checksums per category** — spot corruption or unintended edits
- **Voice rules codified in code, not in prompts** — validate.mjs enforces the rules regardless of whether Claude, an Author, or a future contributor wrote the entry

## Future extensions (when needed)

- `knowledge:embeddings` — generate embeddings for semantic dedup + retrieval
- `knowledge:upload` — push master to Supabase
- `knowledge:sitemap` — generate SEO pages per FAQ
- `knowledge:diff` — see what changed between master versions
- `knowledge:coverage` — report which categories are thin, which are dense

Add these when the volume justifies them, not before.
