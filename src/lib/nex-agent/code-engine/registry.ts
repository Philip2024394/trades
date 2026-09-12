// src/lib/nex-agent/code-engine/registry.ts
//
// NEX1's adapter registry. NEX1 owns selection · never falls through to a cloud
// service. If no adapter is available for the request, engine fails-closed with
// sec.nex1_reasoning_not_bound.
//
// The template-only adapter is registered by NEX1 at bootstrap · it is the
// identity floor and NEX1 removes it only when the adapter-removal conformance
// test explicitly asks for it (Amendment 1.B).

import type {
  Nex1IntentKind,
  Nex1ReasoningAdapter,
  Nex1ReasoningRequest,
  Nex1ReasoningResponse,
} from "./types";
import { NEX1_ENGINE_ERRORS } from "./types";
import { TemplateOnlyAdapter } from "./adapters/template-only";

export class Nex1ReasoningRegistry {
  private readonly adapters = new Map<string, Nex1ReasoningAdapter>();
  private priority: string[] = [];

  constructor() {
    // NEX1 registers its identity floor first · always
    this.register(TemplateOnlyAdapter);
  }

  register(adapter: Nex1ReasoningAdapter): void {
    if (this.adapters.has(adapter.id)) return;
    this.adapters.set(adapter.id, adapter);
    // Ordering: non-deterministic adapters (LLM-assisted) go first · they
    // typically have richer capability. Deterministic adapters go LAST · they
    // are the fallback / identity floor. Multi-adapter routing in
    // nex1InvokeAdapter tries them in this priority order and falls through
    // via `sec.nex1_reasoning_not_bound` when a directive isn't handled.
    if (adapter.deterministic) this.priority = [...this.priority, adapter.id];
    else this.priority = [adapter.id, ...this.priority];
  }

  unregister(id: string): void {
    this.adapters.delete(id);
    this.priority = this.priority.filter((x) => x !== id);
  }

  /**
   * Sprint-1 rule: NEX1 explicitly requests template-only during Sprint 1.
   * Once other adapters are registered, NEX1 uses the priority list.
   */
  async chooseFor(req: Nex1ReasoningRequest): Promise<Nex1ReasoningAdapter | null> {
    for (const id of this.priority) {
      const a = this.adapters.get(id);
      if (!a) continue;
      const ok = await safeIsAvailable(a);
      if (!ok) continue;
      if (!supports(a, req.intent)) continue;
      return a;
    }
    return null;
  }

  async available(): Promise<string[]> {
    const out: string[] = [];
    for (const id of this.priority) {
      const a = this.adapters.get(id);
      if (!a) continue;
      if (await safeIsAvailable(a)) out.push(id);
    }
    return out;
  }

  hasAdapter(id: string): boolean {
    return this.adapters.has(id);
  }

  getById(id: string): Nex1ReasoningAdapter | undefined {
    return this.adapters.get(id);
  }

  listRegistered(): string[] {
    return [...this.priority];
  }
}

/**
 * NEX1 invokes adapters through this wrapper so the response ALWAYS carries
 * adapter_scope='code_proposal_only'. NEX1 remains the accountable decider.
 *
 * Multi-adapter routing (Sprint 2): tries adapters in priority order. If an
 * adapter returns `sec.nex1_reasoning_not_bound` (meaning "this directive is
 * not my job"), we try the next adapter. If ALL adapters refuse the
 * directive, we return `sec.nex1_reasoning_not_bound`. Never falls through
 * to any external service.
 */
export async function nex1InvokeAdapter(
  registry: Nex1ReasoningRegistry,
  req: Nex1ReasoningRequest,
): Promise<Nex1ReasoningResponse> {
  const candidateIds = registry.listRegistered();
  const attemptedIds: string[] = [];
  let lastResponse: Nex1ReasoningResponse | null = null;
  for (const id of candidateIds) {
    const adapter = registry.getById(id);
    if (!adapter) continue;
    try { if (!(await adapter.isAvailable())) continue; } catch { continue; }
    if (!adapter.capabilities().supported_intents.includes(req.intent)) continue;
    attemptedIds.push(id);
    const resp = await adapter.reason(req);
    lastResponse = resp;
    if (resp.ok) return resp;
    // Adapter declined this specific directive · try the next adapter
    if (resp.code === NEX1_ENGINE_ERRORS.reasoning_not_bound) continue;
    // Non-"not-bound" failure → this adapter accepted responsibility but failed · return it
    return resp;
  }
  if (attemptedIds.length === 0) {
    return {
      ok: false,
      code: NEX1_ENGINE_ERRORS.reasoning_not_bound,
      reason: `No adapter available for intent ${req.intent} · NEX1 refuses to fall through to any external service`,
    };
  }
  return {
    ok: false,
    code: NEX1_ENGINE_ERRORS.reasoning_not_bound,
    reason: `No adapter handled directive kind · tried: [${attemptedIds.join(", ")}] · last reason: ${lastResponse?.ok === false ? lastResponse.reason : "unknown"}`,
  };
}

async function safeIsAvailable(a: Nex1ReasoningAdapter): Promise<boolean> {
  try {
    return await a.isAvailable();
  } catch {
    return false;
  }
}

function supports(a: Nex1ReasoningAdapter, intent: Nex1IntentKind): boolean {
  return a.capabilities().supported_intents.includes(intent);
}
