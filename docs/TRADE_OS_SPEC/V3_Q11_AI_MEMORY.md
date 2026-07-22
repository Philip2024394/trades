# Trade Operating System · Volume 3 · Question 11
## AI Memory Architecture — The Learning Brain

**Audience:** Senior AI Engineers, Platform Architects, Knowledge Systems Engineers
**Source:** ChatGPT design-brief architecture series, V3 Q11.

---

## Philosophy

Most AI products are stateless. Every request starts from zero.

**Trade OS does the opposite.** Every interaction makes the system slightly better for that merchant while respecting privacy.

The goal is not "remember everything". The goal is to **remember the right things.**

---

## The Memory Pyramid

```
                Wisdom
          (Best practices)

           Design Knowledge
      (Learned design patterns)

         Merchant Preferences
     (Likes / dislikes / habits)

        Merchant History
    (Projects, generations, edits)

          Raw Interactions
```

Higher levels change slowly. Lower levels grow continuously.

---

## Memory Architecture

```
Merchant Action
        ↓
Memory Extractor
        ├─────────────┐
        ▼             ▼
 Episodic         Preference
 Memory             Memory
        ↓             ↓
 Semantic      Design Decisions
 Memory            Store
        └──────┬──────┘
               ▼
        Memory Index
               ↓
 Retrieval Engine
               ↓
 Prompt Compiler
```

---

## Five Memory Types

### 1. Episodic — stores events (like a diary)
```
2026-07-18
Merchant generated 3 van concepts
Selected Concept 2
Requested: larger logo · darker background · remove gradient
Final approved
```

### 2. Semantic — stores facts (rarely change)
Trade · Service Area · Brand Position · Primary Colour · Accent · Target Market

### 3. Preference — learns taste
Likes: minimal layouts · large photography · white typography · dark backgrounds
Dislikes: orange · busy layouts · 3D effects · gloss gradients

### 4. Design Decision — stores WHY something changed
```
Decision:  Increase logo size
Reason:    Merchant felt branding was weak
```
```
Decision:  Move phone lower
Reason:    Better readability while driving
```

**Far more valuable than storing the final image.**

### 5. Outcome — stores success
```
Vehicle Wrap    — Approved first attempt
Business Card   — Rejected
Website         — Three revisions
Logo            — Chosen concept 4
```

System begins recommending what has historically worked.

---

## Schema

```ts
interface MerchantMemory {
  merchantId:   string;
  semantic:     SemanticMemory;
  episodic:     Episode[];
  preferences:  Preference[];
  decisions:    Decision[];
  outcomes:     Outcome[];
  embeddings:   number[];
  updatedAt:    Date;
}

interface Episode {
  id:         string;
  timestamp:  Date;
  studio:     string;
  action:     string;
  inputs:     string[];
  outputs:    string[];
  result:     "accepted" | "edited" | "rejected";
}

interface Preference {
  category:       "colour" | "layout" | "typography" | "photography" | "branding";
  value:          string;
  confidence:     number;
  sourceEpisode:  string;
  lastConfirmed:  Date;
}

interface Decision {
  surface:    string;
  decision:   string;
  reason:     string;
  confidence: number;
  approved:   boolean;
}

interface Outcome {
  assetId:         string;
  approvalScore:   number;
  revisionCount:   number;
  timeToApproval:  number;
  merchantRating:  number;
}
```

---

## Confidence Scoring

Never assume one action defines a permanent preference.

- Rejected orange 1x  → confidence 22%
- Rejected orange 11x → confidence 98%
- Always dark bg     → confidence 99%
- Enlarged logo 2x   → confidence 45%

**Every preference carries confidence.**

---

## Preference Learning

Every action updates memory:

Merchant: *"Make the logo bigger."*
System learns: `Logo Size +12% · Confidence +6%`.

Next generation starts with a larger logo.

---

## Memory Decay

Not every preference lasts forever. Weighted decay:

```
Weight = Confidence × Recency × Frequency
```

Recent repeated actions stay. Old one-off edits fade.

---

## Retrieval Pipeline

```
Merchant
    ↓
Brand DNA
    ↓
Memory Query
    ↓
Top Relevant Memories
    ↓
Prompt Compiler
```

**Do not inject all history.** Retrieve only what's relevant to the current task.

---

## Vector Search

Store embeddings for: conversations · approved designs · design decisions · critiques · merchant notes.

Query: *"Vehicle wrap preferences"* → returns: dark backgrounds · large phone number · Concept 2 · minimal text · premium photography.

---

## Memory Extractor — what to store, what to ignore

**Store:** repeated preferences · brand decisions · business facts · trade changes · asset approvals · asset rejections · permanent colour changes.

**Ignore:** Hello · Thanks · Can you try again · Nice · Maybe · OK · Generate another.

**Memory stays clean.**

---

## Cross-Merchant Learning

**Never copy one merchant's identity.** Instead, learn anonymous statistics.

Example:
```
Trade:            Plumbing
Accepted Layout:  Split diagonal   → Acceptance Rate: 94%
Logo Position:    Upper left       → Approval: 97%
```

Aggregated knowledge only. No customer assets. No customer names.

---

## Privacy Model — three levels

```
Merchant Memory              (Private)
        ↓
Trade Intelligence           (Anonymous Aggregate)
        ↓
Global Design Intelligence   (Platform Wide)
```

**Nothing moves upward unless anonymised.**

---

## Compiler Integration

```ts
const memory = retrieve({
  merchantId,
  capability: "vehicle-wrap",
  topK: 10
});
```

Returns:
- Large logo
- Dark backgrounds
- No gradients
- Likes Concept 2
- Prefers geometric panels

Compiler injects only these.

---

## Memory Update Flow

```
Generation Complete
        ↓
Merchant Reviews
        ↓
Design Critic
        ↓
Memory Extractor
        ↓
Preference Scorer
        ↓
Semantic Update
        ↓
Vector Index
```

---

## Merchant Design Profile (long-term)

```
Minimalism           94%
Luxury               98%
Dark Theme           96%
Photography Heavy    89%
Swiss Typography     82%
```

Future generations begin close to the merchant's ideal.

---

## Memory API

```ts
interface MemoryService {
  recordEpisode(episode: Episode): Promise<void>;
  learnPreference(preference: Preference): Promise<void>;
  retrieve(merchantId: string, capability: string, limit: number): Promise<MemoryContext>;
  forget(merchantId: string, memoryId: string): Promise<void>;
}
```

---

## Explainable Memory

Every retrieved memory includes its reason:

```json
{
  "memory": "Merchant prefers dark backgrounds",
  "confidence": 0.94,
  "derivedFrom": [
    "Vehicle Wrap v2 approved",
    "Business Card v3 approved",
    "Website v1 approved"
  ]
}
```

Prevents "mystery behaviour".

---

## Memory Health

```
Memory Coverage       87%
Strong Preferences    24
Weak Preferences       9
Contradictions         2
Confidence            91%
```

If contradictions appear (merchant alternates minimal / busy), flag for clarification instead of guessing.

---

## Memory Layers (only higher layers influence generation)

```
Raw Events → Episodes → Preferences → Semantic Facts → Design Knowledge → Brand Intelligence
```

---

## Human Controls

A merchant should always be able to:

1. View what the platform has learned
2. Increase or decrease confidence in preferences
3. Pin preferences ("Always use navy as the primary colour")
4. Forget outdated preferences
5. Export their preference profile
6. Disable learning for specific projects

**Transparency builds trust.**

---

## Architectural Principle

**Memory should never be a conversation log.** It should be a **continuously refined knowledge graph of design decisions.**

Remember: stable business facts · durable brand choices · recurring design preferences · successful outcomes · reasoning behind decisions.
Forget: transient conversation details.

Creates a platform that improves over time without becoming cluttered or unpredictable.

---

## Networkers-specific implementation notes

- **Extends the existing `hammerex_mate_user_memory` table** (shipped in step 4 of Mate build). Add sectioned columns: `episodic_json`, `preferences_json`, `decisions_json`, `outcomes_json`, `embeddings` (pgvector).
- **Memory Extractor** = new module `src/lib/design/memory/extractor.ts` — runs after every merchant action. Store-vs-ignore heuristics per spec.
- **Preference Scorer** = deterministic function `src/lib/design/memory/scorer.ts` — updates confidence per Weight = Confidence × Recency × Frequency formula.
- **Retrieval** = `MemoryService.retrieve()` uses pgvector cosine similarity against the query embedding. Filter to top-K memories relevant to the current capability.
- **Cross-merchant aggregate** = new table `hammerex_trade_learnings` populated by a nightly cron that anonymises + aggregates per-trade preference statistics. Never contains merchant IDs.
- **Merchant "what has been learned" surface** = new route `/studio/memory` — merchant sees + edits + pins + forgets preferences per the Human Controls list.
- **Compiler integration** = the Prompt Compiler's memory injection stage (Q13 Stage 8) reads from `MemoryService.retrieve()` and injects hints into the IR.
- **Explainability trace** = every memory carries `derivedFrom[]` (list of source episode IDs). Displayed inline when Mate cites memory in a reasoning trace.
