# NEX Authoring Factory · 5-Stage Pipeline

**Philip 2026-08-01** — This directory is the entry point for the NEX authoring factory. Manual article writing is deprecated. Every new topic starts as raw notes here, gets processed by Claude, gets Philip's approval on the gaps, then publishes into the Knowledge Brain.

## Why a factory

- 1 hour of Philip's expertise → 30+ structured knowledge entries after AI-assisted structuring + human review
- Every customer question that surfaces in a transcript becomes an authoring input
- The corpus grows around real customer intents, not imagined ones

## The 5 stages

### Stage 1 · Raw expert notes

Philip writes exactly what comes into his head, unformatted. No structure required. One thought per line is fine. Two sentences per thought is fine.

Filename pattern: `data/nex-author-notes/<YYYY-MM-DD>-<topic>-raw.md`

Example seed: `2026-08-01-seed-raw.md`

### Stage 2 · Claude processing

Run `node scripts/nex-author-process.mjs data/nex-author-notes/<file>-raw.md`.

Claude Haiku reads the notes and returns:

- **Topics** — grouped clusters of related customer intents
- **Customer Intents** — the actual questions customers ask under each topic
- **Retrieval Tags** — searchable tokens for the retrieval engine
- **Knowledge Gaps** — questions that appear implied but lack a factual answer in the notes
- **Question Classification** — every intent tagged with intent-type + business-vs-technical

Output: `data/nex-author-notes/<file>-processed.json` + human-readable `<file>-processed.md`

Claude is instructed: **do NOT invent facts.** Every intent must be traceable to something Philip wrote in the notes.

### Stage 3 · Knowledge gaps report

The processed output includes a Knowledge Gaps section — questions that surfaced from the notes but have no explicit answer. These become Philip's next authoring input.

### Stage 4 · Author approval

Philip reviews the processed output. For each topic:

- Approve intents and tags as-is · edit if wording is off
- Answer the gap questions in a follow-up notes file
- Reject any Claude output that misrepresents the domain

Approval is stored by moving the file into `data/nex-author-notes/approved/`.

### Stage 5 · Publish

Approved topics get published as Knowledge Brain articles under `data/nex-reference-brains/staircase-preparation/expert-notes-philip-ofarrell/staircase-instances/`. Each customer intent becomes a searchable snippet.

This step is **manual today** — Philip's call which approved topic becomes an article and what the article title should be. A future publisher script can automate the last mile.

## Rules baked into the processor

- No fabrication · every intent traces to Philip's raw notes
- No hallucinated facts · gaps get flagged, not filled
- Every question gets classified (intent + business vs technical)
- Duplicates get grouped
- Related intents get clustered under topics
- Never publishes automatically · human gate at Stage 4

## Domain classification (Stage 2 output)

Each question gets flagged:

| Domain | Examples |
|---|---|
| **Business** | payment · viewing · quotes · lead times · installation policy |
| **Technical** | materials · geometry · balusters · manufacturing methods |
| **Both** | installation duration · staircase choice · warranty |
| **Neither** | greetings · off-topic · social intents |

Business questions eventually route to a Business Knowledge Brain (currently the same Knowledge Brain · to be split when volume warrants).

## Feedback loop (Stage 6, informal)

Every transcript where Nex says *"I don't have that in my knowledge yet"* is a signal. Log these separately as Stage 1 candidates. Highest-volume unanswered questions become authoring priorities.

Suggested future dashboard: `Top unanswered this week` counting unique customer phrasings that hit no-knowledge fallbacks.
