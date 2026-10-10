// src/lib/nex/failure-governance/failure-emitter.ts
//
// UWI · Wave 6 · M25 · Typed failure emitter
// Founder-authorised programme.
//
// Wires typed failure events to the research-event stream + local
// audit log. Every failure becomes visible + typed rather than silently
// disappearing. Sink is injectable so production integration can wire
// directly to `worker_audit_events` and Wave 5 `LifecycleHistoryLog`.

import type { DurabilityFailureEvent, ResearchFailureEvent, TypedFailureEvent } from "./types";

/** Sink interface. Production wire targets: worker_audit_events + lifecycle_history. */
export interface FailureSink {
  emitDurability(event: DurabilityFailureEvent): void | Promise<void>;
  emitResearch(event: ResearchFailureEvent): void | Promise<void>;
}

/** In-memory sink for tests + fallback. Preserves emission order. */
export class InMemoryFailureSink implements FailureSink {
  public readonly durability: DurabilityFailureEvent[] = [];
  public readonly research: ResearchFailureEvent[] = [];
  emitDurability(event: DurabilityFailureEvent): void { this.durability.push(event); }
  emitResearch(event: ResearchFailureEvent): void { this.research.push(event); }
  clear(): void { this.durability.length = 0; this.research.length = 0; }
  countAll(): number { return this.durability.length + this.research.length; }
}

/** Emitter that guarantees layer-appropriate routing. */
export class TypedFailureEmitter {
  constructor(public readonly sink: FailureSink) {}

  async emit(event: TypedFailureEvent): Promise<void> {
    if (event.layer === "durability") {
      await this.sink.emitDurability(event);
    } else {
      await this.sink.emitResearch(event);
    }
  }
}
