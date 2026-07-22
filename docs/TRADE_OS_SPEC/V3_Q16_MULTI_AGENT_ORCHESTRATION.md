# Trade Operating System · Volume 3 · Question 16
## Multi-Agent Orchestration Engine — The Operating System

**Audience:** Senior AI Platform Engineers, Distributed Systems Architects, Workflow Engineers
**Source:** ChatGPT design-brief architecture series, V3 Q16.

---

## Philosophy

Most AI products have one agent. **Trade OS has a team of specialists.**

No agent tries to do everything. Each has **one responsibility** and communicates through an orchestration engine.

**The Orchestrator is the CEO. The agents are the departments.**

---

## Architecture

```
                  Merchant
                     ↓
           Experience Layer (Studio UI)
                     ↓
            Workflow Orchestrator ⭐
                     ↓
      ┌──────────────┼──────────────┐
      ▼              ▼              ▼
 Discovery      Brand Agent     Memory Agent
      └──────────────┼──────────────┘
                     ▼
            Creative Director
                     ↓
            Prompt Compiler
                     ↓
         ┌───────────┼────────────┐
         ▼           ▼            ▼
      GPT Image   Recraft     GPT-5
                     ↓
              Design Critic
                     │
              ┌──────┴──────┐
              ▼             ▼
            PASS          FAIL
              │             │
              ▼             ▼
           Export      Regenerate
```

**No component calls another directly. Everything flows through the Orchestrator.**

---

## Agent Responsibilities

| Agent | Responsibility |
|-|-|
| Discovery | Learn about merchant |
| Brand | Build Brand DNA |
| Memory | Retrieve relevant knowledge |
| Creative Director | Choose creative strategy |
| Prompt Compiler | Compile deterministic prompts |
| Image Generator | Produce artwork |
| Design Critic | Score quality |
| QA | Technical validation |
| Export | Produce deliverables |
| Analytics | Learn platform-wide trends |

**Each agent has one job.**

---

## Core Orchestrator

```ts
interface WorkflowEngine {
  start(request: MerchantRequest): Promise<Workflow>;
  resume(workflowId: string):      Promise<void>;
  cancel(workflowId: string):      Promise<void>;
  retry(stepId: string):           Promise<void>;
}
```

---

## Workflow State Machine

```
NEW → DISCOVERY → BRAND_READY → MEMORY_LOADED → CREATIVE_DIRECTION →
PROMPT_COMPILED → GENERATING → CRITIQUING → QA → APPROVED →
EXPORTING → COMPLETE
```

**Every step is resumable.**

---

## Workflow Types

```ts
interface Workflow {
  id:         string;
  merchantId: string;
  studio:     string;
  status:     WorkflowState;
  steps:      WorkflowStep[];
  context:    WorkflowContext;
  startedAt:  Date;
  updatedAt:  Date;
}

interface WorkflowStep {
  id:           string;
  agent:        string;
  status:       "pending" | "running" | "failed" | "completed";
  startedAt:    Date;
  completedAt?: Date;
  retryCount:   number;
  result:       unknown;
}

interface WorkflowContext {
  merchant:      Merchant;
  brand:         BrandDNA;
  memory:        MemoryContext;
  capability:    CapabilityManifest;
  request:       MerchantRequest;
  designIntent:  DesignIR;
  assets:        AssetLibrary;
}
```

**Every agent receives the same context object.** Agents never fetch data independently. The Orchestrator provides everything.

---

## Retry Policy per Failure Type

| Failure | Response |
|-|-|
| API timeout | Retry immediately |
| Image generation error | Retry once |
| Critic rejection | Regenerate |
| QA failure | Fix deterministically |
| Export failure | Rebuild package |

**Never restart the whole workflow.**

---

## Parallel Execution

Many agents work simultaneously:

```
Brand Agent
Memory Agent
Trade Intelligence
Vehicle Intelligence
Photography Intelligence
     └── all in parallel
```

Compiler waits until all complete.

---

## Cost Optimisation

The Orchestrator decides when AI is necessary.

- Merchant changes phone number → **don't regenerate artwork**. Just update vector text.
- Merchant changes background colour → **regenerate**.

**Orchestrator saves money.**

---

## Event Routing (loose coupling)

```
BrandUpdated → MemoryUpdated → PromptCompiled →
GenerationCompleted → CriticPassed → ExportReady
```

**No direct function calls.**

---

## Observability

Every workflow records: Duration · Cost · Tokens · Models Used · Failures · Retries · Critic Score · Merchant Rating.

**Everything measurable.**

### Workflow Timeline Example

```
09:00  Discovery         ✓
09:01  Brand             ✓
09:01  Memory            ✓
09:02  Creative Director ✓
09:02  Compiler          ✓
09:03  GPT Image         ✓
09:06  Critic     96     ✓
09:06  Export            ✓
```

Perfect for debugging.

---

## Human Intervention

A reviewer can:
1. Pause workflow
2. Approve manually
3. Reject
4. Regenerate only one stage
5. Replace uploaded assets
6. Restart from any checkpoint

**Never restart from the beginning.**

---

## Agent Interface

```ts
interface Agent {
  id:           string;
  version:      string;
  capabilities: string[];
  execute(context: WorkflowContext): Promise<AgentResult>;
}
```

Every agent implements the same interface.

---

## Orchestrator Interface

```ts
interface Orchestrator {
  register(agent: Agent):        void;
  run(workflow: Workflow):       Promise<void>;
  emit(event: WorkflowEvent):    void;
}
```

---

## Failure Recovery

Every completed stage checkpointed:

```
Discovery ✓   Brand ✓   Memory ✓   Compiler ✓   Generator ✗
```

**Resume from Generator. Not Discovery.**

---

## Scaling Strategy

```
Merchant Request → Workflow Queue → Worker Pool
                                     ├── Worker
                                     ├── Worker
                                     └── Worker
```

Each worker executes multiple agents. Horizontal scaling.

---

## Future Agent Marketplace

Third-party agents plug in via the same interface: SEO Agent · Legal Compliance · Translation · Video Generation · Ad Campaign · Fleet Optimisation.

---

## Architectural Principle

**The Orchestrator never contains business logic.** It only:
- Schedules work
- Routes events
- Manages state
- Handles retries
- Coordinates agents
- Optimises cost
- Maintains observability

**All intelligence lives inside the agents, the DIL, the Prompt Compiler, and Brand DNA.**

This separation keeps Trade OS modular, scalable, testable, and able to adopt new AI models without redesigning the core platform.

---

## Networkers-specific implementation notes

- **Location:** `src/lib/design/orchestrator/`
- **Recommended runtime for Phase 1:** in-process TypeScript workflow engine backed by Postgres for checkpoint persistence. No Temporal / BullMQ dep yet — matches our "in-process Event Bus first" pattern from V1 Part 4.
- **Phase 2 upgrade:** Temporal for durable workflows once we hit ~10k workflows/day. Interface stays the same; swap the runtime.
- **Checkpoint table:** new migration `hammerex_workflow_checkpoints` — one row per workflow with `state_json` + `current_step` + `resumable_at`.
- **Agent registration:** by convention — every file in `src/lib/design/agents/*.ts` exports an `Agent` object. Orchestrator scans on boot.
- **Every WorkflowStep publishes an event** to the existing EventBus (V1 Part 4) — so the whole platform sees pipeline progress without polling.
- **Human intervention** — pause/approve/reject buttons live in `/admin/workflows` (new). Merchant-side approval steps surface in `/studio/vault`.
- **Parallel generation** implemented via `Promise.all` for now; upgrade to worker pool when queue depth demands it.
