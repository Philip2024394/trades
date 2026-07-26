# Staircase Diagnosis Engine — Specification

**Version:** V1
**Data file:** `data/staircase-diagnosis-engine.json`
**Source of truth for content:** `knowledge/staircase.json` (linked via `related_brain_entries`)

## Purpose

Turn a customer's plain-language symptom ("my stairs squeak") into a structured diagnostic conversation that:

1. Identifies the likely cause (not just the symptom).
2. Suggests diagnostic questions to narrow it down.
3. Offers repair options graded by DIY vs professional.
4. Flags safety-critical situations.
5. Links back to the brain for deeper reading.

Enforces the **cause-before-solution** rule from the knowledge architecture doc: never suggest a repair before confirming the cause.

---

## Schema

Each entry in `data/staircase-diagnosis-engine.json` follows this shape:

```json
{
  "id": "diag-001",
  "symptom": "Formal symptom name",
  "customer_language": ["how a customer might describe it", "alternative phrasings"],
  "trade_category": "noise | movement | damage | finish | structural | fixings | timber | balustrade | handrail | dimensions | installation",
  "audience_level": 1,
  "urgency": "low | medium | high | safety_critical",
  "possible_causes": [
    {
      "cause": "Human-readable cause name",
      "probability": "high | medium | low",
      "why": "One-sentence explanation of what is happening physically."
    }
  ],
  "diagnostic_questions": [
    {
      "q": "Question the diagnostic UI asks the user",
      "answer_maps_to": {
        "Answer A": "Points at cause X",
        "Answer B": "Points at cause Y"
      }
    }
  ],
  "repair_options": [
    {
      "for_cause": "Which cause this repair addresses",
      "diy": true,
      "difficulty": "easy | moderate | hard",
      "method": "Step-by-step or short procedure summary."
    }
  ],
  "when_to_call_professional": "Rule of thumb for escalating.",
  "safety_note": "If urgency is safety_critical, what to do RIGHT NOW.",
  "related_brain_entries": ["staircase-faq-102", "staircase-faq-317"]
}
```

## Field semantics

**`symptom`** — the canonical name (used for indexing). One short phrase.

**`customer_language`** — array of the ways real customers describe it, for fuzzy-match retrieval. NEX should match user input against this list before falling back to semantic search.

**`trade_category`** — routing hint for which specialist would handle it. Also used for filtering the diagnosis engine in listings.

**`audience_level`** — expected default audience. Homeowner (1), DIY (2), trade (3), workshop (4). Repair options and language should suit this level; the engine can escalate if the user identifies as a trade.

**`urgency`** — how urgent is the problem?
- `low`: cosmetic, no safety implication (e.g. small scratch)
- `medium`: worsens if ignored (e.g. small squeak, hairline crack)
- `high`: risk of failure or serious damage if ignored (e.g. loose newel, structural crack)
- `safety_critical`: risk of injury if used before fixing (e.g. handrail detaching from wall, tread splitting)

**`possible_causes`** — ordered by probability (`high` first). The engine walks them in order.

**`diagnostic_questions`** — short question tree that maps user answers back to likely causes. Not a full decision tree; usually 1-3 questions is enough to narrow the field.

**`repair_options`** — one per possible cause. `diy: true` means a competent homeowner can attempt it; `diy: false` means call a professional.

**`when_to_call_professional`** — plain-language guidance. Every entry has this.

**`safety_note`** — only for `urgency: safety_critical`. Immediate action to take (e.g. "do not use this staircase until repaired — use another route between floors").

**`related_brain_entries`** — pointers into `knowledge/staircase.json` for the user to read further. Not required for engine operation, but improves the reading experience.

## Content coverage — V1 (100 problems)

Distributed across the trade categories:

| Category | Count | Examples |
|---|---|---|
| Noise / squeaks | 10 | Squeaky tread · creaking newel · rattling spindle · ticking · groan under weight |
| Movement | 10 | Wobbly newel · shaky handrail · bouncy landing · whole flight moves · loose spindle |
| Damage | 15 | Loose tread · cracked riser · split newel cap · dented nosing · water stain · rot |
| Finish problems | 10 | Peeling paint · faded stain · sticky varnish · watermark · sun damage · deep scratch |
| Structural | 10 | Sagging stringer · cracked landing · failed cantilever · separation from wall |
| Fixings | 10 | Screw pushing out · bolt turning · bracket coming off wall · pin popping through |
| Timber movement | 10 | Cupping tread · winter gap · shrinkage crack · veneer lifting · seasonal creak |
| Balustrade | 10 | Loose spindle in baserail · glass chip · cable slack · panel misalignment |
| Handrail | 5 | Loose end · detached wall bracket · joint gap · surface rough · height wrong |
| Dimensions / regs | 5 | Uneven step heights · headroom hit · overhang failed · pitch too steep |
| Installation defects | 5 | Poor mitre at skirting · visible pin holes · glue squeeze-out · finish contamination |

Total: **100 entries**.

## Usage patterns

### Direct symptom lookup
User types "my stairs squeak". Engine matches against `customer_language`, returns the diag entry.

### Guided diagnostic
User has a vague complaint. Engine asks `diagnostic_questions` from the most likely category, narrows down to a specific entry.

### From a photo
Future: photo analysis identifies a visible problem (see `photo-analysis-rules.md`), maps it to a diag entry by `symptom` name.

### Report generation
User has multiple problems. Engine aggregates diag entries into a NEX Staircase Health Check report with prioritised repair list (safety_critical → high → medium → low).

## Extension rules

- New entries go into the same JSON file with next-available `diag-NNN` ID.
- If a new symptom overlaps significantly with an existing one, merge rather than add.
- `related_brain_entries` should be kept in sync when brain entries are renumbered or merged.
- Country-specific safety notes (Doc K vs IRC vs NCC) should be added as a `country_notes` object when country packs land.

## Not in V1

- Diagnostic tree beyond 3-question depth (deferred to V2 conditional trees).
- Cost estimates for repairs (needs regional pricing data).
- Insurance / warranty guidance beyond the "call the installer" hint.
- Full image-recognition integration (waits for photo analysis rules).
