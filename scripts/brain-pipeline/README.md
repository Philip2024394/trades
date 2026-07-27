# NEX Brain Pipeline

Reusable pipeline for turning raw FAQ dumps (from ChatGPT, subject-matter experts, or anywhere else) into Nex-voice Brain JSON drafts ready for Trade Brain Author review.

## The problem this solves

- Raw FAQs from ChatGPT are in spec-manual voice — dry, passive, not Nex
- Manually rewriting every answer in Nex voice takes ~30s per Q&A × hundreds of Q&As × dozens of categories = weeks of work
- Doing that voice pass with an LLM in batches is ~200× faster and ~£1 per category
- The Author still sees + signs off every final entry — pipeline saves time, doesn't replace judgment

## Files

- **`faq-to-brain.mjs`** — orchestrator. Parses raw FAQ → dedupes → rewrites in Nex voice via Anthropic → outputs Brain-ready JSON
- **`_voice-prompt.mjs`** — the locked Nex voice system prompt. Codifies every voice rule from the saved memory (UK English · no marketing fluff · no "cheap" · workshop rhythms · never expose internal architecture)

## Usage

### Dry run — verify parse + dedup without spending on LLM

```bash
node scripts/brain-pipeline/faq-to-brain.mjs cement docs/brains/cement-faqs-raw.md --dry-run
```

Output goes to `scripts/.staging-brain-cement.json`. Answers are unchanged from the raw input (still spec voice) — this mode is for validating that parsing and deduping work correctly.

### Full run — with Nex voice rewrite

```bash
node scripts/brain-pipeline/faq-to-brain.mjs cement docs/brains/cement-faqs-raw.md
```

Requires `ANTHROPIC_API_KEY` in `.env.local`. Uses `claude-sonnet-4-6` in batches of 15 Q&As per call. Cost for 200 Q&As is roughly £0.55.

### Options

- `--batch N` — change Q&As per LLM call (default 15). Smaller = safer for very long answers, larger = fewer API calls
- `--out PATH` — custom output path (default `scripts/.staging-brain-<category>.json`)

## Output format

```json
{
  "kind": "brain_faqs",
  "category": "cement",
  "prompt_version": "faq-to-brain.v1",
  "generated_at": "2026-07-25T…",
  "author_status": "pending_review",
  "count": 148,
  "entries": [
    {
      "id": "cement-faq-001",
      "kind": "faq",
      "question": "What is cement?",
      "answer": "Cement's the grey powder that binds sand, gravel and water into concrete or mortar — the glue that holds most buildings together.",
      "category_tag": "cement",
      "audience_level": null,
      "classification": "industry_good_practice",
      "safety_note": null,
      "source_verified_at": null,
      "fact_check_flag": null
    },
    …
  ]
}
```

## Fact-check flags

If the LLM notices a factual issue in the raw answer (e.g. Q4 vs Q41 contradiction in the cement dump), it flags it in the `fact_check_flag` field of that entry AND prints a summary at the end of the run. Author reviews and resolves before ingest.

## What the pipeline does NOT do

- **Invent facts** — the voice prompt hard-blocks invention of prices, brands, quantities, delivery times etc. If it's not in the source, it doesn't appear in the rewrite.
- **Publish to production** — output is a staging JSON. Real ingest goes through: Author review → Admin review → pending-migrations sign-off → substrate loader. Same governance as every other Brain entry.
- **Cite company websites** — voice prompt bans citing merchant sites as evidence. Brand mentions (Blue Circle, Cemex, Rugby) are allowed as factual product names.

## Next steps after pipeline output

1. Read `scripts/.staging-brain-<category>.json`
2. Resolve any `fact_check_flag` entries by editing the JSON directly
3. Set `audience_level` (1 Homeowner → 5 Expert) per entry
4. Set `classification` per entry (usually `industry_good_practice` for FAQs, `safety_advice` where risk is involved)
5. Fill `source_verified_at` for anything cited
6. Author signs off → move to `docs/implementation/pending-migrations/` for Admin review
7. On Admin approval → substrate loader picks it up

## Cost model at scale

- 200 Q&As per category × 50 categories = 10,000 Q&As
- Batches of 15 = 667 LLM calls
- Sonnet 4.6 at ~$0.05/batch = **~$34 total** to voice-rewrite the entire launch Brain
- Author + Admin review time is the real cost, not the LLM
