---
authored_by: Master AI Engineer
authored_role: Phase C implementation status + wire-up guide
captured_at: 2026-08-03
governance:
  rule_a_anti_fabrication: pass · runtime shipped + tested
  rule_c_attributable_origin: Master AI Engineer 2026-08-03
architecture_layer: L2 · Phase C implementation
document_version: 1.0
---

# Phase C · Identity + Goal Layer — Implementation Status

## What Shipped

**Doctrine:**
- `docs/brains/nex-user-identity-brain-philip-2026-08-03.md` — 10-register model + signals + persistence + downstream effects

**Runtime library (`src/lib/nex/identity/`):**
- `types.ts` — `IdentityRegister` union · `IdentityClassification` · `registerToAudienceLevel()` mapping to Knowledge Layer audience_level filter (1/2/3)
- `classify.ts` — explicit self-ID priority patterns + per-register signal vocabularies + scoring
- `index.ts` — public exports
- `classify.test.ts` — **7 tests, all passing**

**API:**
- `POST /api/nex/identity` — returns `{ register, confidence, matched_signals, reason, needs_clarification }`. Enforces Brain 14 (Never-Guess) at the API boundary via `needs_clarification: true` when confidence <0.7.

**UI component:**
- `src/components/nex/GoalLayer.tsx` — self-contained React component · 7 goal cards + free-text fallback · drops into any chat page as opening surface

## The 7 Goal Cards

| Emoji | Title | Default identity hint | Default domain hint |
|---|---|---|---|
| 🏠 | Home & Property | homeowner_informed | staircase |
| 💼 | Business Growth | business_owner | marketing |
| 🛒 | Sell Products | business_owner | ecommerce |
| 💰 | Money | business_owner | finance |
| 🎨 | Design Studio | business_owner | design |
| 📚 | Learn Something | student | education |
| 🤖 | Build With AI | developer | ai |

## The Full Classification Chain (composes B + B.5 + C)

```
User first message OR Goal Layer card click
    ↓
POST /api/nex/identity           → { register, confidence, needs_clarification }
POST /api/nex/universal-intent   → { layer1_verb, layer2_domain, layer3_capability }
    ↓
Nex Workspace stores { identity_register, current_goal, current_domain }
    ↓
retrieve({ domain, query, filters: { audience_level: registerToAudienceLevel(register) } })
    ↓
Foundation Brains fire (13 reads register · 5 translates · 6 recommends · 12 shows · 9 writes · 15 ends with value)
    ↓
Response
```

## How to Wire the Goal Layer Into the Chat Page

```tsx
// src/app/nex-app/chat/page.tsx (illustrative)
import { GoalLayer, type Goal } from "@/components/nex/GoalLayer";

function ChatPage() {
  const [phase, setPhase] = useState<"goal_layer" | "conversation">("goal_layer");
  const [identity, setIdentity] = useState<string | null>(null);
  const [goal, setGoal] = useState<Goal | null>(null);

  const handleGoalSelected = (goal: Goal) => {
    setGoal(goal);
    setIdentity(goal.default_identity_hint);
    setPhase("conversation");
  };

  const handleFreeText = async (input: string) => {
    const [idRes, intentRes] = await Promise.all([
      fetch("/api/nex/identity", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ input }),
      }).then((r) => r.json()),
      fetch("/api/nex/universal-intent", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ input }),
      }).then((r) => r.json()),
    ]);
    setIdentity(idRes.register);
    // Compose downstream response using identity + intent
    setPhase("conversation");
  };

  if (phase === "goal_layer") {
    return (
      <GoalLayer
        greeting="Welcome to Nex"
        onGoalSelected={handleGoalSelected}
        onFreeText={handleFreeText}
      />
    );
  }

  return <ChatConversation identity={identity} goal={goal} />;
}
```

## Composition with Foundation Brains

- **Brain 13 (Match User Knowledge)** — reads the identity_register and adjusts tone.
- **Brain 10 (Memory)** — persists identity_register to Workspace so returning users skip Goal Layer.
- **Brain 14 (Never-Guess)** — enforces `needs_clarification` at the API boundary.
- **Brain 15 (End With Value)** — every goal card IS a next-step.

## What Phase C DID NOT Ship

- Full chat-page wiring (illustrative in this doc · needs to land in the actual chat/page.tsx as a separate PR).
- Workspace persistence of identity_register (Phase F).
- Learning Loop that updates register when new evidence contradicts stored (Phase F.5).
- Identity classifier corpus growth from real user telemetry (ongoing).

## Test Results

```
Identity classifier tests · 7/7 passing · 1.85s
Universal Intent tests    · 9/9 passing · 1.53s
Knowledge Layer tests     · 7/7 passing · 0.97s

Total · 23/23 passing across 3 runtime libraries.
```

## Session Cumulative

- **Foundation Brains** — 15 authored
- **Runtime libraries** — 3 (universal-intent · knowledge-layer · identity)
- **API endpoints** — 2 (universal-intent · identity)
- **UI components** — 1 (GoalLayer)
- **Doctrine mega-docs** — 14
- **Domains** — 2 (Staircase 001 · Kitchen 002 Bronze)
- **Shared brains** — 1 (Universal Trade Layer)
- **Tests** — 23/23 passing across 3 suites

## Next

Coverage Score + Knowledge Health + Dashboard doctrine (Task #99). Then the 14 Kitchen articles (Task #100). Then 3 cross-domain shared articles (Task #101).
