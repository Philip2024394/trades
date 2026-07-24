# Nex Character Library

Nex's personality lives here, not in code. This lets us grow to 1,000+
canonical responses without touching the runtime.

## Where responses live

```
src/lib/nex/character/
├── types.ts                — schema (Zod-validated)
├── library.ts              — loader + matcher + alternative picker
└── library/
    ├── volume_00_core.json — the 81 responses that shipped originally
    ├── volume_01_greetings.json  (add when ready)
    ├── volume_02_humour.json
    ├── volume_03_personal.json
    ├── volume_04_business.json
    ├── volume_05_construction.json
    ├── volume_06_security_privacy.json
    ├── volume_07_pricing_credits.json
    ├── volume_08_marketing_sales.json
    ├── volume_09_motivation.json
    ├── volume_10_random_easter_eggs.json
    ├── volume_11_difficult_customers.json
    └── volume_12_regulations.json
```

Adding a new volume = one new file + one line in `library.ts`. No other code changes.

## Every entry has metadata

```jsonc
{
  "intent":       "count_to_million",           // stable id — must be unique
  "priority":     1,                             // 1-100. Higher wins on collision
  "version":      1,                             // bump when you edit alternatives
  "category":     "humour",                      // enum from CATEGORIES
  "tone":         "playful",                     // enum from TONES
  "tags":         ["humour", "easter_egg"],      // enum from TAGS

  "patterns":     ["\\bcount\\s+to\\s+(a\\s+)?million\\b"],
  "alternatives": [
    "You first. I'll keep count.",
    "I could... but we'd both retire before I finished.",
    "Let's save that for a rainy day. What can I actually help you with?"
  ],
  "notes":        "Optional reviewer note"
}
```

- `intent` is the stable identifier. Loader throws on duplicate.
- `patterns` is an array of regex sources (as strings). Any pattern matching = the entry fires.
- `alternatives` — Nex picks one per (merchant, intent, day). Add more strings to vary Nex's replies.
- `tone` and `tags` — for filtering, admin search, and future weighted selection.

## Alternative picker — deterministic

`pickAlternative(entry, { merchantSlug, now })` uses SHA-256(`merchantSlug|intent|YYYY-MM-DD`) mod alternatives.length. Result:
- Same merchant asks the same question twice today → same reply. No annoying jitter.
- Tomorrow → probably a different reply.
- Different merchants can see different replies for the same question the same day.

## Priority resolution

Entries are sorted by priority desc at load time. Higher priority beats lower on the first match. Use for specific-before-general overrides:
- `fingers_and_toes` (priority 5) → "Zero. How many have you?"
- `how_many_toes` (priority 5) → "The same number as my fingers."
- `how_many_fingers` (priority 1) → fallback for arms/legs/limbs etc.

## Vocabulary

```
CATEGORIES = greeting · goodbye · thanks · compliment · personal · identity ·
             humour · love · business · security · privacy · credits · plans ·
             marketing · sales · customer_service · construction · regulations ·
             legal · motivation · philosophy · random · easter_egg · shopping ·
             safety · relationships

TONES = calm · witty · warm · matter_of_fact · encouraging · reassuring · advisor ·
        playful · firm

TAGS = greeting · goodbye · humour · construction · privacy · legal · marketing ·
       pricing · plans · credits · relationships · philosophy · motivation ·
       random · easter_egg · business · customer_service · regulations · shopping ·
       safety · identity · trust · learning
```

Bumping the vocabulary: edit `types.ts` — every entry that uses the new value passes Zod on next load.

## Runtime integration

`assessBehaviour()` in `src/lib/nex/behaviour.ts` calls `findEntry(text)`. On hit → `pickAlternative()` for the reply. On miss → falls through to the hate/abuse/frustration/casual-swear classifiers.

The behaviour tests exercise the library indirectly — every canonical quip is asserted via `assessBehaviour("...")`. If a volume ships with a broken pattern, tests catch it immediately.

## Admin viewer

`/admin/nex/character` lists every entry grouped by category, with tone / priority / version chips, all alternatives visible via a collapsed details block, and the compiled patterns shown at the bottom of each card. Read-only in pass 1. Edit responses in the JSON files.

## What's shipped

- Schema + Zod validation
- Loader with duplicate-intent guard
- Static-import volume registry (add volumes without dynamic import cost)
- Priority-based sort at load
- Deterministic alternative picker
- All 81 shipped responses migrated to `volume_00_core.json`
- Admin viewer at `/admin/nex/character`
- 13 new library tests + 232 total Nex tests

## What's next (per Philip's plan)

Fill each volume:
- V1 — Greetings (50)
- V2 — Humour (50)
- V3 — Personal (75)
- V4 — Business (100)
- V5 — Construction (100)
- V6 — Security + privacy (50)
- V7 — Pricing + credits (50)
- V8 — Marketing + sales (75)
- V9 — Motivation (75)
- V10 — Random + easter eggs (100)
- V11 — Difficult customers (75)
- V12 — Regulations + boundaries (75)

**Target: ~875 canonical intents × 3+ alternatives each = ~2,600+ possible Nex replies.**

Each new volume = one new JSON file, one import line, tests optional (patterns are validated at load).

## Deferred

- DB-backed overrides so staff can edit responses without a deploy
- Weighted alternative selection (e.g. avoid recently-used variants)
- Multi-language variants keyed by tag
- Auto-lint against `voiceCheck` at load time (currently linted only on the shipped strings via test)
