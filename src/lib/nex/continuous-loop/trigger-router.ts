// src/lib/nex/continuous-loop/trigger-router.ts
//
// UWI · Wave 7 · M27 · 6-way trigger router
// Founder-authorised programme.
//
// Deterministic dispatch of the 6 trigger classes to registered
// handlers. Every trigger is typed. Every handler is registered
// once. No default fall-through — an unknown trigger is a
// runtime-visible error.
//
// Deterministic · pure · no external deps.

import type { TriggerEvent, TriggerKind } from "./types";

export type TriggerHandler = (event: TriggerEvent) => Promise<void>;

export class TriggerRouter {
  private handlers = new Map<TriggerKind, TriggerHandler>();
  private dispatched_count = 0;
  private dispatched_by_kind = new Map<TriggerKind, number>();

  register(kind: TriggerKind, handler: TriggerHandler): void {
    if (this.handlers.has(kind)) {
      throw new Error(`trigger handler for '${kind}' already registered — replace via explicit unregister first`);
    }
    this.handlers.set(kind, handler);
  }

  unregister(kind: TriggerKind): void {
    this.handlers.delete(kind);
  }

  async dispatch(event: TriggerEvent): Promise<void> {
    const handler = this.handlers.get(event.kind);
    if (!handler) throw new UnhandledTriggerError(event.kind, event.target_id);
    this.dispatched_count += 1;
    this.dispatched_by_kind.set(event.kind, (this.dispatched_by_kind.get(event.kind) ?? 0) + 1);
    await handler(event);
  }

  registeredKinds(): ReadonlyArray<TriggerKind> {
    return Array.from(this.handlers.keys());
  }

  countByKind(): ReadonlyMap<TriggerKind, number> {
    return new Map(this.dispatched_by_kind);
  }

  totalDispatched(): number { return this.dispatched_count; }

  _resetForTests(): void {
    this.handlers.clear();
    this.dispatched_count = 0;
    this.dispatched_by_kind.clear();
  }
}

export class UnhandledTriggerError extends Error {
  constructor(public readonly kind: TriggerKind, public readonly target_id: string) {
    super(`no handler registered for trigger kind '${kind}' (target ${target_id}). Every trigger class must have exactly one registered handler.`);
    this.name = "UnhandledTriggerError";
  }
}
