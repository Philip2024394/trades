// NEX Workforce V2 · Supervisor · Lifecycle contract (declarative)
// ─────────────────────────────────────────────────────────────────────────────
// The C9 contract as executable constants. Any module reading this module
// gets the SAME ordering + limits · single source of truth.
//
// Per C9 · read the doctrine before changing any number here. These constants
// are the workforce's promise about how it composes.

export const Role = Object.freeze({
  SUPERVISOR:   "SUPERVISOR",
  REAPER:       "REAPER",
  ORCHESTRATOR: "ORCHESTRATOR",
  AGENT:        "AGENT",
});

// C9 § 5 · deterministic startup order (upstream → downstream)
export const StartupOrder = Object.freeze([
  Role.SUPERVISOR,
  Role.REAPER,
  Role.ORCHESTRATOR,
  Role.AGENT,
]);

// C9 § 6 · deterministic shutdown order (stop-new-work-first · exit-last)
export const ShutdownOrder = Object.freeze([
  Role.ORCHESTRATOR, // stop new enqueue first
  Role.AGENT,        // then stop agents from starting NEW work (existing lease finishes normally OR reaper handles later)
  Role.REAPER,       // then stop reaper
  Role.SUPERVISOR,   // supervisor exits last
]);

// C9 § 7 · singleton by role (agents intentionally not singleton per § 8)
export const SingletonRoles = Object.freeze(new Set([Role.SUPERVISOR, Role.REAPER, Role.ORCHESTRATOR]));
export const NonSingletonRoles = Object.freeze(new Set([Role.AGENT]));

// C9 § 25 · hard-coded capacity limit · widened to 5 by C11.5 · portable-only
// concurrency proving (2026-09-05). Contract meaning: 0 ≤ active agents ≤ 5.
// Widening beyond 5 requires a new capacity authorization + portable proving.
// Singleton roles (SUPERVISOR/REAPER/ORCHESTRATOR) are unaffected by this
// constant · they remain exactly one each via singleton_registry.
export const MaxAgentCount = 5;

// C9 § 9 · restart policy · max 3 in 15 min · exponential backoff (1s → 8s)
export const RestartPolicy = Object.freeze({
  maxRestartsInWindow: 3,
  windowMs:            15 * 60 * 1000,        // 15 minutes
  backoffMs:           [1000, 2000, 4000, 8000], // exponential up to 8s
});

// C9 § 15 · exit classifications
export const ExitClass = Object.freeze({
  CLEAN_SHUTDOWN:         "clean_shutdown",         // code=0 · SIGTERM/SIGINT graceful
  EXPECTED_EXIT:          "expected_exit",          // code=0 · natural end
  TRANSIENT_CRASH:        "transient_crash",        // code=1 · first-time · possibly recoverable
  REPEATED_CRASH:         "repeated_crash",         // code=1 · multiple in window · degrade
  CONFIGURATION_FAILURE:  "configuration_failure",  // code=3 · missing env / bad config
  AUTHENTICATION_FAILURE: "authentication_failure", // code=4 · bad DB creds / token
  PERMISSION_FAILURE:     "permission_failure",     // code=5 · 42501 · fail loud · no auto-restart
  CATASTROPHIC_FAILURE:   "catastrophic_failure",   // OOM / config-load failure / SEGV
  UNKNOWN_FAILURE:        "unknown_failure",        // don't-know · bounded restart · fail loud
});

// Which exit classes are eligible for auto-restart under the restart policy.
// Permission failure is EXPLICITLY excluded per § 14: "permission failure
// must never be treated as a transient retry forever."
export const RestartableExitClasses = Object.freeze(new Set([
  ExitClass.TRANSIENT_CRASH,
  ExitClass.REPEATED_CRASH,
  ExitClass.CATASTROPHIC_FAILURE,
  ExitClass.UNKNOWN_FAILURE,
]));

// Exit classes that MUST fail loud and never auto-restart
export const NonRestartableExitClasses = Object.freeze(new Set([
  ExitClass.PERMISSION_FAILURE,
  ExitClass.AUTHENTICATION_FAILURE,
  ExitClass.CONFIGURATION_FAILURE,
]));

// C9 § 17 · child lifecycle states
export const ChildState = Object.freeze({
  STARTING: "STARTING",
  RUNNING:  "RUNNING",
  DEGRADED: "DEGRADED",
  STOPPING: "STOPPING",
  EXITED:   "EXITED",
});

// C9 § 18 · legal parent → child edges only
// Only SUPERVISOR may spawn children. No recursive spawning.
export const LegalParentChild = Object.freeze({
  [Role.SUPERVISOR]:   new Set([Role.REAPER, Role.ORCHESTRATOR, Role.AGENT]),
  [Role.REAPER]:       new Set(),
  [Role.ORCHESTRATOR]: new Set(),
  [Role.AGENT]:        new Set(),
});

export function isSpawnAllowed(parentRole, childRole) {
  return (LegalParentChild[parentRole] || new Set()).has(childRole);
}
