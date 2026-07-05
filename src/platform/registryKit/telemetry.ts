// registryKit · optional telemetry.
//
// Registry consumers can opt into a fire-and-forget notification when
// registrations happen, when gets hit, or when gets miss. Zero cost
// when no hook is attached — the factory checks for the hook once at
// call time and skips otherwise.
//
// Growth Coach + Studio analytics both want registry hit-rate data.
// This module provides the wiring; callers register the sink.

import type { Frozen, RegistrationBase } from "./types";

/** Emit an event to a hook, swallowing any hook error so the registry
 *  never blocks or throws because of telemetry. */
export function safeEmit<Args extends unknown[]>(
  hook: ((...args: Args) => void) | undefined,
  ...args: Args
): void {
  if (!hook) return;
  try {
    hook(...args);
  } catch {
    // Silent — telemetry must never break registry semantics.
  }
}

/** Convenience factory for a no-op telemetry set — used in tests. */
export function noopTelemetry<T extends RegistrationBase>() {
  return {
    onRegister: (_reg: Frozen<T>) => {
      /* no-op */
    },
    onGet: (_id: string, _hit: boolean) => {
      /* no-op */
    },
    onMiss: (_id: string) => {
      /* no-op */
    }
  };
}
