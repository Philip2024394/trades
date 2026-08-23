# NEX Brain

Provider-independent LLM abstraction for NEX. Per the [Router
architecture doctrine](../../../../.claude/projects/C--Users-Victus/memory/constitution_nex_architecture_provider_independent_router_2026_08_20.md)
(2026-08-20 · CONSTITUTIONAL): NEX is not "an Anthropic app" or "an
OpenAI app". Third-party LLM providers are engines UNDERNEATH NEX.
Swapping Claude Opus 4.7 for GPT-5 or Gemini 3 tomorrow must be a
one-file change, not an architectural rewrite.

## Layout

```
src/lib/nex/brain/
├── provider.ts              — NexBrainProvider interface + NEX-canonical types
├── providers/
│   ├── anthropic.ts         — Claude Opus / Haiku implementation (via existing src/lib/llm/anthropic.ts)
│   └── stub.ts              — dev fallback (honest "no provider configured" response)
├── resolve.ts               — runtime provider selection (env-key → Anthropic, else stub)
└── README.md                — this file
```

## Where the tools live

Tools NEX Brain can call are declared at `src/lib/nex/tools/schemas.ts`.
Session 1 registers four tools for the staircase agent:

- `readStaircaseDesign` — reads the customer's current design state
- `updateStaircaseDesign` — writes design mutations (per doctrine
  amendment 2026-08-20 · chat writes when customer issues direct
  design instructions)
- `generateInspiration` — Phase 3 stub (Vibe Studio image generation)
- `requestQuote` — Phase 4 stub (Geometry Engine + specialist handoff)

## Usage · basic

```ts
import { resolveNexBrain } from "@/lib/nex/brain/resolve";
import { STAIRCASE_AGENT_TOOLS } from "@/lib/nex/tools/schemas";

const { provider, isLive, reason } = resolveNexBrain();
console.info(`[nex-brain] using ${provider.id} · ${reason} · live=${isLive}`);

for await (const event of provider.chat({
  systemPrompt: STAIRCASE_AGENT_SYSTEM_PROMPT, // Session 2
  messages: [
    { role: "user", content: "Show me an oak straight-flight staircase." },
  ],
  tools: [...STAIRCASE_AGENT_TOOLS],
  maxTokens: 1024,
})) {
  switch (event.type) {
    case "text_delta":
      process.stdout.write(event.text);
      break;
    case "tool_call_ready":
      // Execute the tool (Session 2 · handlers)
      // Feed result back with a { role: "tool", content: [{ type: "tool_result", ... }] } message
      break;
    case "done":
      console.info("\n[done]", event.stopReason, event.usage);
      break;
    case "error":
      console.error("[error]", event.error, "retriable:", event.retriable);
      break;
  }
}
```

## Phase 1 · acceptance test (Philip 2026-08-20)

```
User: "I want a modern straight-flight staircase in oak."
  → LLM calls updateStaircaseDesign({ updates: {
        materialFamily: "timber",
        geometry: "straight",
        wood: "oak"
      } })
  → assistant replies: "Set to a straight oak staircase. Nice choice."

User: "Make it open riser."
  → LLM reads state (already knows: timber, straight, oak)
  → LLM calls updateStaircaseDesign({ updates: { riser: "open" } })
  → assistant replies: "Done — changed to open riser. Still oak, still straight."

User: "Add glass."
  → LLM disambiguates: glass most likely refers to balustrade
  → LLM calls updateStaircaseDesign({ updates: { balustrade: "glass_framed" } })
  → assistant replies: "Added a glass balustrade. Modern look with your oak treads."

User: "Actually, change the oak to walnut."
  → LLM keeps everything else
  → LLM calls updateStaircaseDesign({ updates: { wood: "walnut" } })
  → assistant replies: "Swapped to walnut. Still straight flight, open riser, glass balustrade."
```

If NEX does the above reliably in text, Phase 1 is done. Then voice
(Phase 2). Then Vibe Studio images (Phase 3). Then Geometry Engine +
quote handoff (Phase 4).

## Provider swap · adding a new engine

To add a new provider (e.g. OpenAI GPT-4o):

1. Create `providers/openai.ts` exporting `createOpenAIBrainProvider(model)` that returns a `NexBrainProvider`. Handle the NEX-canonical ↔ OpenAI translation inside.
2. Extend `resolve.ts` with an `OPENAI_API_KEY` branch above or below the Anthropic branch (order = preference).
3. That's it. Every caller keeps working. The staircase agent, future kitchen agent, tools registry — none change.

## Rules this module enforces (per Router doctrine)

- No provider name in caller code (only inside `providers/*.ts`).
- No provider-specific state (every message + tool call + event is NEX-canonical).
- No single-provider dependency in production (`resolve.ts` always falls back gracefully).
- Every capability survives its primary provider being swapped.
- NEX is NEX. External comms + marketing + UI never surface provider names.

## Related doctrines

- [NEX Router architecture](../../../../.claude/projects/C--Users-Victus/memory/constitution_nex_architecture_provider_independent_router_2026_08_20.md) · CONSTITUTIONAL 2026-08-20
- [NEX Full Experience Phase Plan](../../../../.claude/projects/C--Users-Victus/memory/project_nex_full_experience_phase_plan_2026_08_20.md) · 2026-08-20
- [Claude's Role · Master AI Engineer + Visual AI](../../../../.claude/projects/C--Users-Victus/memory/feedback_claude_role_master_ai_engineer_and_visual_ai_2026_08_20.md) · 2026-08-20
