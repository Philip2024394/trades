// NEX Workforce V2 · Supervisor · Shutdown handler
// ─────────────────────────────────────────────────────────────────────────────
// Wires SIGINT + SIGTERM to a deterministic cleanup pipeline (per C8 § 17).
// Handlers are idempotent · calling shutdown twice runs cleanup once.

export function createShutdownHandler({ logger, onShutdown } = {}) {
  let shuttingDown = false;
  let stopReason = null;

  async function doShutdown(reason) {
    if (shuttingDown) return { alreadyShuttingDown: true, stopReason };
    shuttingDown = true;
    stopReason = reason;
    logger?.info?.("supervisor.shutdown.begin", { reason });
    try {
      if (typeof onShutdown === "function") await onShutdown(reason);
    } catch (e) {
      logger?.error?.("supervisor.shutdown.error", { err: e.message });
    }
    logger?.info?.("supervisor.shutdown.complete", { reason });
    return { alreadyShuttingDown: false, stopReason };
  }

  function install() {
    const sigintHandler = () => { void doShutdown("SIGINT"); };
    const sigtermHandler = () => { void doShutdown("SIGTERM"); };
    process.once("SIGINT", sigintHandler);
    process.once("SIGTERM", sigtermHandler);
    // Also handle explicit exit event (last-chance cleanup for singleton lock)
    process.on("exit", () => {
      // synchronous only in 'exit' handler
      try { if (!shuttingDown && typeof onShutdown === "function") onShutdown("exit"); } catch {}
    });
    return { installed: true };
  }

  return { install, doShutdown, isShuttingDown: () => shuttingDown };
}
