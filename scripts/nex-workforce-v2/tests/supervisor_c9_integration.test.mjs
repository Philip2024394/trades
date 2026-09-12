// NEX Workforce V2 · C10 · C8 supervisor ↔ C9 lifecycle integration tests
// ─────────────────────────────────────────────────────────────────────────────
// Proves the C8 supervisor is wired to the C9 lifecycle contract. Portable
// only. No Project B contact. No production DB. No Scheduled Task. No
// production child processes started.

import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { readFileSync, existsSync, mkdirSync, rmSync } from "node:fs";
import { dirname, resolve, join } from "node:path";
import { fileURLToPath } from "node:url";
import { tmpdir } from "node:os";

import { createSupervisor } from "../supervisor/supervisor.mjs";
import { createChildLifecycle } from "../supervisor/lib/child_lifecycle.mjs";
import {
  Role, StartupOrder, ShutdownOrder, SingletonRoles, MaxAgentCount,
  ExitClass, ChildState, RestartPolicy as CONTRACT_POLICY,
  isSpawnAllowed, LegalParentChild,
} from "../supervisor/lib/lifecycle_contract.mjs";
import { createSingletonRegistry } from "../supervisor/lib/singleton_registry.mjs";
import { createRestartPolicy } from "../supervisor/lib/restart_policy.mjs";
import { classifyExit } from "../supervisor/lib/exit_classifier.mjs";

const __dirname = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = resolve(__dirname, "..", "..", "..");
const SUPERVISOR_SRC = join(REPO_ROOT, "scripts/nex-workforce-v2/supervisor/supervisor.mjs");
const CHILD_LIFECYCLE_SRC = join(REPO_ROOT, "scripts/nex-workforce-v2/supervisor/lib/child_lifecycle.mjs");
const FAKE_WORKER = join(REPO_ROOT, "scripts/nex-workforce-v2/tests/support/fake_worker.mjs");

const silent = () => ({ info: () => {}, warn: () => {}, error: () => {}, critical: () => {}, close: () => {} });

// Track socket/DB probe attempts: we install a fetch stub that fails if any
// test in this file attempts to reach Project B.
const originalFetch = globalThis.fetch;
let projectBAttempts = 0;
beforeAll(() => {
  globalThis.fetch = async (url, ...rest) => {
    if (typeof url === "string" && url.includes("supabase.com")) {
      projectBAttempts += 1;
      throw new Error("C10 test guard: Project B fetch attempt blocked");
    }
    return originalFetch(url, ...rest);
  };
});
afterAll(() => {
  globalThis.fetch = originalFetch;
});

// Tiny mock query · never touches Project B
const mockQuery = async () => [];

// ═════════════════════════════════════════════════════════════════════════════
// C10-01 · supervisor imports C9 lifecycle successfully
// ═════════════════════════════════════════════════════════════════════════════
describe("C10-01 · supervisor imports C9 lifecycle", () => {
  it("supervisor source imports child_lifecycle + singleton_registry + restart_policy + lifecycle_contract", () => {
    const src = readFileSync(SUPERVISOR_SRC, "utf8");
    expect(src).toMatch(/from "\.\/lib\/child_lifecycle\.mjs"/);
    expect(src).toMatch(/from "\.\/lib\/singleton_registry\.mjs"/);
    expect(src).toMatch(/from "\.\/lib\/restart_policy\.mjs"/);
    expect(src).toMatch(/from "\.\/lib\/lifecycle_contract\.mjs"/);
  });

  it("supervisor no longer instantiates the older lifecycle_manager as authoritative", () => {
    const src = readFileSync(SUPERVISOR_SRC, "utf8");
    expect(src).not.toMatch(/import\s*\{[^}]*createLifecycleManager[^}]*\}\s*from/);
    expect(src).not.toMatch(/createLifecycleManager\(/);
  });
});

// ═════════════════════════════════════════════════════════════════════════════
// C10-02 · C9 lifecycle_contract is the only lifecycle authority
// ═════════════════════════════════════════════════════════════════════════════
describe("C10-02 · lifecycle contract single source of truth", () => {
  it("supervisor does not duplicate Role / StartupOrder / ShutdownOrder / MaxAgentCount / RestartPolicy constants", () => {
    const src = readFileSync(SUPERVISOR_SRC, "utf8");
    // No local definitions of these constants
    expect(src).not.toMatch(/const\s+StartupOrder\s*=/);
    expect(src).not.toMatch(/const\s+ShutdownOrder\s*=/);
    expect(src).not.toMatch(/const\s+MaxAgentCount\s*=/);
    expect(src).not.toMatch(/const\s+SingletonRoles\s*=/);
    // Role must be imported, never re-declared
    const roleAssign = src.match(/(?:const|let|var)\s+Role\s*=\s*\{/);
    expect(roleAssign).toBeNull();
  });

  it("supervisor.contract surface exposes C9 constants by reference (not by copy)", () => {
    const sup = createSupervisor({ query: mockQuery, logger: silent() });
    expect(sup.contract.Role).toBe(Role);
    expect(sup.contract.StartupOrder).toBe(StartupOrder);
    expect(sup.contract.ShutdownOrder).toBe(ShutdownOrder);
    expect(sup.contract.MaxAgentCount).toBe(MaxAgentCount);
  });
});

// ═════════════════════════════════════════════════════════════════════════════
// C10-03 · startup order comes directly from C9
// C10-04 · shutdown order comes directly from C9
// ═════════════════════════════════════════════════════════════════════════════
describe("C10-03/04 · startup + shutdown order sourced from C9", () => {
  it("StartupOrder is [SUPERVISOR, REAPER, ORCHESTRATOR, AGENT] · unchanged from C9", () => {
    expect(StartupOrder).toEqual([Role.SUPERVISOR, Role.REAPER, Role.ORCHESTRATOR, Role.AGENT]);
    const sup = createSupervisor({ query: mockQuery, logger: silent() });
    expect(sup.contract.StartupOrder).toEqual([Role.SUPERVISOR, Role.REAPER, Role.ORCHESTRATOR, Role.AGENT]);
  });

  it("ShutdownOrder is [ORCHESTRATOR, AGENT, REAPER, SUPERVISOR] · unchanged from C9", () => {
    expect(ShutdownOrder).toEqual([Role.ORCHESTRATOR, Role.AGENT, Role.REAPER, Role.SUPERVISOR]);
    const sup = createSupervisor({ query: mockQuery, logger: silent() });
    expect(sup.contract.ShutdownOrder).toEqual([Role.ORCHESTRATOR, Role.AGENT, Role.REAPER, Role.SUPERVISOR]);
  });
});

// ═════════════════════════════════════════════════════════════════════════════
// C10-05/06/07 · supervisor creates legal REAPER + ORCHESTRATOR + AGENT specs
// ═════════════════════════════════════════════════════════════════════════════
describe("C10-05/06/07 · supervisor registers REAPER + ORCHESTRATOR + AGENT specs on construction", () => {
  it("REAPER spec registered with the V2 reaper.mjs script", () => {
    const sup = createSupervisor({ query: mockQuery, logger: silent() });
    const reaper = sup.lifecycle.get(Role.REAPER, "reaper-1");
    expect(reaper).toBeTruthy();
    expect(reaper.role).toBe(Role.REAPER);
    expect(sup.childScripts[Role.REAPER]).toMatch(/scripts[\\/]nex-workforce-v2[\\/]reaper\.mjs$/);
  });

  it("ORCHESTRATOR spec registered with the V2 orchestrator.mjs script", () => {
    const sup = createSupervisor({ query: mockQuery, logger: silent() });
    const orch = sup.lifecycle.get(Role.ORCHESTRATOR, "orchestrator-1");
    expect(orch).toBeTruthy();
    expect(orch.role).toBe(Role.ORCHESTRATOR);
    expect(sup.childScripts[Role.ORCHESTRATOR]).toMatch(/scripts[\\/]nex-workforce-v2[\\/]orchestrator\.mjs$/);
  });

  it("AGENT spec registered with the V2 agent.mjs script", () => {
    const sup = createSupervisor({ query: mockQuery, logger: silent() });
    const ag = sup.lifecycle.get(Role.AGENT, "agent-1");
    expect(ag).toBeTruthy();
    expect(ag.role).toBe(Role.AGENT);
    expect(sup.childScripts[Role.AGENT]).toMatch(/scripts[\\/]nex-workforce-v2[\\/]agent\.mjs$/);
  });

  it("V2 entry scripts actually exist at the resolved paths", () => {
    const sup = createSupervisor({ query: mockQuery, logger: silent() });
    for (const role of [Role.REAPER, Role.ORCHESTRATOR, Role.AGENT]) {
      expect(existsSync(sup.childScripts[role]), `script for ${role} missing: ${sup.childScripts[role]}`).toBe(true);
    }
  });
});

// ═════════════════════════════════════════════════════════════════════════════
// C10-08 · AGENT count cannot exceed MaxAgentCount (widened to 5 by C11.5)
// ═════════════════════════════════════════════════════════════════════════════
describe("C10-08 · AGENT count cannot exceed MaxAgentCount=5", () => {
  it("MaxAgentCount is exactly 5 (widened by C11.5 · portable-only)", () => {
    expect(MaxAgentCount).toBe(5);
  });

  it("6th AGENT registration throws (using the supervisor's own lifecycle)", () => {
    // Supervisor's registerV2ChildSpecs registers agent-1 already · we add 4 more
    // then attempt a 6th
    const sup = createSupervisor({ query: mockQuery, logger: silent() });
    for (const id of ["agent-2","agent-3","agent-4","agent-5"]) {
      sup.lifecycle.register({ role: Role.AGENT, identifier: id, script: FAKE_WORKER, env: { NEX_FAKE_HANG: "true" } });
    }
    expect(() => sup.lifecycle.register({
      role: Role.AGENT, identifier: "agent-6", script: FAKE_WORKER,
    })).toThrow(/AGENT count ceiling/);
  });
});

// ═════════════════════════════════════════════════════════════════════════════
// C10-09 · legacy path registration rejected
// ═════════════════════════════════════════════════════════════════════════════
describe("C10-09 · legacy path registration rejected via C9 guard", () => {
  const legacy = [
    "scripts/nex-acquisition-workforce/run-production-launcher.mjs",
    "scripts/nex-workforce/_category-walker.mjs",
    "scripts/nex-acquisition-workforce/run-production-watchdog.mjs",
    "scripts/nex-acquisition-workforce/run-production-supervisor.mjs",
  ];
  for (const p of legacy) {
    it(`refuses legacy path via supervisor.lifecycle.register: ${p}`, () => {
      const sup = createSupervisor({ query: mockQuery, logger: silent() });
      expect(() => sup.lifecycle.register({ role: Role.REAPER, identifier: `leg-${Math.random()}`, script: p })).toThrow(/refusing to register legacy/);
    });
  }
});

// ═════════════════════════════════════════════════════════════════════════════
// C10-10 · autoStart=false starts zero children
// ═════════════════════════════════════════════════════════════════════════════
describe("C10-10 · autoStart defaults false · zero children spawned", () => {
  it("supervisor.lifecycle.isAutoStart() is false by default", () => {
    const sup = createSupervisor({ query: mockQuery, logger: silent() });
    expect(sup.lifecycle.isAutoStart()).toBe(false);
  });

  it("calling start() with autoStart=false throws · no PID assigned", async () => {
    const sup = createSupervisor({ query: mockQuery, logger: silent() });
    await expect(sup.lifecycle.start(Role.AGENT, "agent-1")).rejects.toThrow(/autoStart=false/);
    const ag = sup.lifecycle.get(Role.AGENT, "agent-1");
    expect(ag.pid).toBeNull();
    expect(ag.state).toBe(ChildState.STARTING); // never transitioned to RUNNING
  });

  it("supervisor.config.autoStart is frozen false at import time", () => {
    const sup = createSupervisor({ query: mockQuery, logger: silent() });
    expect(sup.config.autoStart).toBe(false);
  });
});

// ═════════════════════════════════════════════════════════════════════════════
// C10-11/12 · agent crash does not change orchestrator/reaper state
// C10-13/14 · orchestrator/reaper crash does not restart agent
// ═════════════════════════════════════════════════════════════════════════════
describe("C10-11/12/13/14 · failure isolation via C9 restart_policy", () => {
  it("restart_policy history keyed by (role, identifier) · agent restart count doesn't cross into orchestrator", () => {
    let t = 1000;
    const rp = createRestartPolicy({ maxRestarts: 3, windowMs: 60_000, now: () => t });
    rp.record(Role.AGENT, "agent-1", ExitClass.TRANSIENT_CRASH); t += 100;
    rp.record(Role.AGENT, "agent-1", ExitClass.TRANSIENT_CRASH); t += 100;
    rp.record(Role.AGENT, "agent-1", ExitClass.TRANSIENT_CRASH); t += 100;
    // Agent hit ceiling
    expect(rp.allow(Role.AGENT, "agent-1", ExitClass.TRANSIENT_CRASH).allowed).toBe(false);
    // Orchestrator still eligible
    expect(rp.allow(Role.ORCHESTRATOR, "orchestrator-1", ExitClass.TRANSIENT_CRASH).allowed).toBe(true);
    // Reaper still eligible
    expect(rp.allow(Role.REAPER, "reaper-1", ExitClass.TRANSIENT_CRASH).allowed).toBe(true);
  });

  it("orchestrator failure history does not affect agent eligibility", () => {
    let t = 1000;
    const rp = createRestartPolicy({ maxRestarts: 3, windowMs: 60_000, now: () => t });
    for (let i = 0; i < 3; i++) { rp.record(Role.ORCHESTRATOR, "orchestrator-1", ExitClass.TRANSIENT_CRASH); t += 100; }
    expect(rp.allow(Role.ORCHESTRATOR, "orchestrator-1", ExitClass.TRANSIENT_CRASH).allowed).toBe(false);
    expect(rp.allow(Role.AGENT, "agent-1", ExitClass.TRANSIENT_CRASH).allowed).toBe(true);
    expect(rp.allow(Role.REAPER, "reaper-1", ExitClass.TRANSIENT_CRASH).allowed).toBe(true);
  });

  it("reaper failure history does not affect agent eligibility", () => {
    let t = 1000;
    const rp = createRestartPolicy({ maxRestarts: 3, windowMs: 60_000, now: () => t });
    for (let i = 0; i < 3; i++) { rp.record(Role.REAPER, "reaper-1", ExitClass.TRANSIENT_CRASH); t += 100; }
    expect(rp.allow(Role.REAPER, "reaper-1", ExitClass.TRANSIENT_CRASH).allowed).toBe(false);
    expect(rp.allow(Role.AGENT, "agent-1", ExitClass.TRANSIENT_CRASH).allowed).toBe(true);
    expect(rp.allow(Role.ORCHESTRATOR, "orchestrator-1", ExitClass.TRANSIENT_CRASH).allowed).toBe(true);
  });
});

// ═════════════════════════════════════════════════════════════════════════════
// C10-15 · restart policy remains C9 bounded policy
// C10-16 · restart ceiling produces DEGRADED
// ═════════════════════════════════════════════════════════════════════════════
describe("C10-15/16 · supervisor consumes C9 restart policy · ceiling → DEGRADED", () => {
  it("supervisor.restartPolicy uses CONTRACT_POLICY defaults from lifecycle_contract", () => {
    const sup = createSupervisor({ query: mockQuery, logger: silent() });
    // Snapshot proves the numbers wired through are the C9 numbers
    const snap = sup.restartPolicy.snapshot(Role.AGENT, "agent-1");
    expect(snap.maxRestarts).toBe(CONTRACT_POLICY.maxRestartsInWindow);
    expect(snap.maxRestarts).toBe(3);
    expect(snap.windowMs).toBe(CONTRACT_POLICY.windowMs);
    expect(snap.windowMs).toBe(15 * 60 * 1000);
  });

  it("exponential backoff matches C9 [1000, 2000, 4000, 8000]", () => {
    expect(CONTRACT_POLICY.backoffMs).toEqual([1000, 2000, 4000, 8000]);
  });

  it("ceiling produces allowed=false with restart_ceiling_reached", () => {
    let t = 1000;
    const rp = createRestartPolicy({ maxRestarts: 3, windowMs: 60_000, now: () => t });
    for (let i = 0; i < 3; i++) { rp.record(Role.AGENT, "agent-1", ExitClass.TRANSIENT_CRASH); t += 10; }
    const decision = rp.allow(Role.AGENT, "agent-1", ExitClass.TRANSIENT_CRASH);
    expect(decision.allowed).toBe(false);
    expect(decision.reason).toMatch(/restart_ceiling_reached/);
  });
});

// ═════════════════════════════════════════════════════════════════════════════
// C10-17 · permission failure does not restart
// C10-18 · authentication failure does not restart
// ═════════════════════════════════════════════════════════════════════════════
describe("C10-17/18 · permission + auth failures are fail-loud (never auto-restart)", () => {
  it("PERMISSION_FAILURE (code 5) → allow=false with non_restartable_class", () => {
    const rp = createRestartPolicy();
    const c = classifyExit({ code: 5, signal: null });
    expect(c.class).toBe(ExitClass.PERMISSION_FAILURE);
    const d = rp.allow(Role.AGENT, "agent-1", c.class);
    expect(d.allowed).toBe(false);
    expect(d.reason).toMatch(/non_restartable_class/);
  });

  it("stderr containing '42501' triggers PERMISSION_FAILURE even with code=1", () => {
    const c = classifyExit({ code: 1, signal: null, stderrTail: "ERROR 42501: permission denied for schema nex_workforce" });
    expect(c.class).toBe(ExitClass.PERMISSION_FAILURE);
    const rp = createRestartPolicy();
    expect(rp.allow(Role.AGENT, "agent-1", c.class).allowed).toBe(false);
  });

  it("AUTHENTICATION_FAILURE (code 4) → allow=false", () => {
    const c = classifyExit({ code: 4, signal: null });
    expect(c.class).toBe(ExitClass.AUTHENTICATION_FAILURE);
    const rp = createRestartPolicy();
    expect(rp.allow(Role.AGENT, "agent-1", c.class).allowed).toBe(false);
  });

  it("CONFIGURATION_FAILURE (code 3) → allow=false", () => {
    const c = classifyExit({ code: 3, signal: null });
    expect(c.class).toBe(ExitClass.CONFIGURATION_FAILURE);
    const rp = createRestartPolicy();
    expect(rp.allow(Role.AGENT, "agent-1", c.class).allowed).toBe(false);
  });
});

// ═════════════════════════════════════════════════════════════════════════════
// C10-19 · shutdown uses C9 order
// C10-20 · zero orphan child processes
// ═════════════════════════════════════════════════════════════════════════════
describe("C10-19/20 · shutdown uses C9 order · no orphans", () => {
  it("supervisor.shutdown() calls lifecycle.shutdownAll (C9 API) not old gracefulShutdownAll", () => {
    const src = readFileSync(SUPERVISOR_SRC, "utf8");
    expect(src).toMatch(/lifecycle\.shutdownAll\(/);
    expect(src).not.toMatch(/lifecycle\.gracefulShutdownAll\(/);
  });

  it("child_lifecycle.shutdownAll iterates ShutdownOrder (excluding SUPERVISOR)", () => {
    const src = readFileSync(CHILD_LIFECYCLE_SRC, "utf8");
    // ShutdownOrder imported and iterated
    expect(src).toMatch(/for\s*\(\s*const\s+role\s+of\s+ShutdownOrder\s*\)/);
    // SUPERVISOR excluded (external shutdown authority)
    expect(src).toMatch(/if\s*\(\s*role\s*===\s*Role\.SUPERVISOR\s*\)\s*continue/);
  });

  it("supervisor.shutdown with no started children returns cleanly · no orphans", async () => {
    const sup = createSupervisor({ query: mockQuery, logger: silent() });
    // Never called start · autoStart=false
    await sup.shutdown("test");
    // list() shows no PIDs
    const items = sup.lifecycle.list();
    for (const c of items) {
      expect(c.pid).toBeNull();
    }
  });
});

// ═════════════════════════════════════════════════════════════════════════════
// C10-21 · no recursive child spawning
// ═════════════════════════════════════════════════════════════════════════════
describe("C10-21 · no recursive child spawning", () => {
  it("isSpawnAllowed forbids AGENT→AGENT, ORCHESTRATOR→AGENT, REAPER→AGENT, AGENT→ORCHESTRATOR, etc.", () => {
    expect(isSpawnAllowed(Role.AGENT, Role.AGENT)).toBe(false);
    expect(isSpawnAllowed(Role.AGENT, Role.ORCHESTRATOR)).toBe(false);
    expect(isSpawnAllowed(Role.AGENT, Role.REAPER)).toBe(false);
    expect(isSpawnAllowed(Role.ORCHESTRATOR, Role.AGENT)).toBe(false);
    expect(isSpawnAllowed(Role.ORCHESTRATOR, Role.REAPER)).toBe(false);
    expect(isSpawnAllowed(Role.REAPER, Role.AGENT)).toBe(false);
    expect(isSpawnAllowed(Role.REAPER, Role.ORCHESTRATOR)).toBe(false);
    // Only SUPERVISOR may spawn
    expect(isSpawnAllowed(Role.SUPERVISOR, Role.AGENT)).toBe(true);
    expect(isSpawnAllowed(Role.SUPERVISOR, Role.ORCHESTRATOR)).toBe(true);
    expect(isSpawnAllowed(Role.SUPERVISOR, Role.REAPER)).toBe(true);
  });

  it("child_lifecycle with parentRole=AGENT refuses to register anything (structural)", () => {
    const bad = createChildLifecycle({ logger: silent(), parentRole: Role.AGENT, autoStart: false });
    expect(() => bad.register({ role: Role.AGENT, identifier: "recursive", script: FAKE_WORKER })).toThrow(/parent AGENT may not spawn AGENT/);
    expect(() => bad.register({ role: Role.ORCHESTRATOR, identifier: "recursive-orch", script: FAKE_WORKER })).toThrow(/parent AGENT may not spawn ORCHESTRATOR/);
  });
});

// ═════════════════════════════════════════════════════════════════════════════
// C10-22 · no legacy imports
// ═════════════════════════════════════════════════════════════════════════════
describe("C10-22 · supervisor + lifecycle contain no legacy imports", () => {
  const files = [
    "scripts/nex-workforce-v2/supervisor/supervisor.mjs",
    "scripts/nex-workforce-v2/supervisor/lib/child_lifecycle.mjs",
    "scripts/nex-workforce-v2/supervisor/lib/lifecycle_contract.mjs",
    "scripts/nex-workforce-v2/supervisor/lib/singleton_registry.mjs",
    "scripts/nex-workforce-v2/supervisor/lib/restart_policy.mjs",
    "scripts/nex-workforce-v2/supervisor/lib/exit_classifier.mjs",
  ];
  const legacyMarkers = [
    "nex-acquisition-workforce",
    "run-production-launcher",
    "run-production-watchdog",
    "run-production-supervisor",
  ];
  for (const f of files) {
    it(`${f} · imports contain no legacy paths`, () => {
      const src = readFileSync(join(REPO_ROOT, f), "utf8");
      const importLines = src.split("\n").filter((l) => /^\s*import\s/.test(l));
      for (const marker of legacyMarkers) {
        for (const line of importLines) {
          expect(line, `${f}: legacy import "${marker}" in "${line}"`).not.toContain(marker);
        }
      }
    });
  }
});

// ═════════════════════════════════════════════════════════════════════════════
// C10-23 · child lifecycle contains no lease mutation
// C10-24 · child lifecycle contains no enqueue mutation
// C10-25 · child lifecycle contains no reaper mutation
// ═════════════════════════════════════════════════════════════════════════════
describe("C10-23/24/25 · lifecycle layer contains no business DB operations", () => {
  const forbiddenTokens = {
    lease_mutation:   [/nex_workforce\.claim\(/, /lease_deadline\s*=/, /UPDATE\s+nex_workforce\.work_item/i],
    enqueue_mutation: [/enqueue_from_view/, /INSERT\s+INTO\s+nex_workforce\.work_item/i],
    reaper_mutation:  [/reap_expired_leases/, /requeue_soft_fail_backoff_elapsed/],
  };
  const filesToScan = [SUPERVISOR_SRC, CHILD_LIFECYCLE_SRC,
    join(REPO_ROOT, "scripts/nex-workforce-v2/supervisor/lib/singleton_registry.mjs"),
    join(REPO_ROOT, "scripts/nex-workforce-v2/supervisor/lib/restart_policy.mjs"),
    join(REPO_ROOT, "scripts/nex-workforce-v2/supervisor/lib/exit_classifier.mjs"),
    join(REPO_ROOT, "scripts/nex-workforce-v2/supervisor/lib/lifecycle_contract.mjs"),
  ];
  for (const [category, patterns] of Object.entries(forbiddenTokens)) {
    it(`no ${category} tokens in lifecycle layer`, () => {
      for (const f of filesToScan) {
        const src = readFileSync(f, "utf8");
        for (const p of patterns) {
          // Allow the tokens ONLY inside a comment block that documents the prohibition
          const matches = src.match(new RegExp(p.source, p.flags));
          if (!matches) continue;
          // If a match exists, it must be within a comment block (i.e. lines starting with //)
          const lines = src.split("\n");
          for (const line of lines) {
            if (p.test(line)) {
              expect(line.trim().startsWith("//"), `${f}: forbidden ${category} token "${matches[0]}" not in comment: "${line.trim()}"`).toBe(true);
            }
          }
        }
      }
    });
  }
});

// ═════════════════════════════════════════════════════════════════════════════
// C10-26 · supervisor health remains distinct from workforce health
// C10-27 · C7 probe failure cannot fabricate HEALTHY
// ═════════════════════════════════════════════════════════════════════════════
describe("C10-26/27 · process health ≠ workforce health · probe failure never HEALTHY", () => {
  it("supervisor.tracker (process health) and probe.workforce_health are separate surfaces", () => {
    const sup = createSupervisor({ query: mockQuery, logger: silent() });
    const snap = sup.tracker.snapshot();
    // Tracker never has a workforce_health field
    expect("workforce_health" in snap).toBe(false);
  });

  it("probe failure records tracker.recordFailure · does NOT set workforce_health='HEALTHY'", async () => {
    let lastLogged = null;
    const logger = {
      info:  (msg, data) => { lastLogged = { msg, data, level: "info"  }; },
      warn:  (msg, data) => { lastLogged = { msg, data, level: "warn"  }; },
      error: () => {}, critical: () => {}, close: () => {},
    };
    // failing query · probe returns ok=false
    const failQ = async () => { throw new Error("simulated probe failure"); };
    const sup = createSupervisor({ query: failQ, logger, opts: { probeTimeoutMs: 250, maxConsecutive: 5 } });
    const r = await sup.tick();
    expect(r.exit).toBeFalsy();
    // The warn log for probe_failed must NOT contain workforce_health=HEALTHY
    expect(lastLogged?.msg).toMatch(/probe_failed/);
    if (lastLogged?.data) {
      // If a workforce_health field slipped through, it must not be HEALTHY
      expect(lastLogged.data.workforce_health === "HEALTHY").toBe(false);
      expect(lastLogged.data.workforce_health === "WORKFORCE_HEALTHY").toBe(false);
    }
  });
});

// ═════════════════════════════════════════════════════════════════════════════
// C10-28 · production mode defaults autoStart=false
// ═════════════════════════════════════════════════════════════════════════════
describe("C10-28 · production default autoStart=false", () => {
  it("CONFIG.autoStart is false at supervisor module top level (frozen)", () => {
    const src = readFileSync(SUPERVISOR_SRC, "utf8");
    // Verify the CONFIG object contains autoStart:false
    expect(src).toMatch(/autoStart:\s*false/);
    // And CONFIG is frozen
    expect(src).toMatch(/CONFIG\s*=\s*Object\.freeze\(/);
  });

  it("no environment variable can silently flip autoStart=true (would require opts override)", () => {
    const src = readFileSync(SUPERVISOR_SRC, "utf8");
    // No pattern like process.env.NEX_...AUTOSTART reading into config.autoStart
    expect(src).not.toMatch(/autoStart:\s*process\.env/i);
    expect(src).not.toMatch(/NEX_SUPERVISOR_AUTOSTART/);
  });
});

// ═════════════════════════════════════════════════════════════════════════════
// C10-29 · no Project B connection occurs during integration tests
// ═════════════════════════════════════════════════════════════════════════════
describe("C10-29 · zero Project B connection attempts during integration tests", () => {
  it("beforeAll fetch guard has not been tripped during earlier tests", () => {
    // If any prior test in this file reached supabase.com, projectBAttempts > 0.
    expect(projectBAttempts).toBe(0);
  });

  it("createSupervisor with mockQuery never reaches Project B", async () => {
    const sup = createSupervisor({ query: mockQuery, logger: silent() });
    await sup.tick();
    expect(projectBAttempts).toBe(0);
  });
});

// ═════════════════════════════════════════════════════════════════════════════
// C10-30 · lifecycle_manager retained for standalone C8 regression only
// ═════════════════════════════════════════════════════════════════════════════
describe("C10-30 · lifecycle_manager retained for C8 regression only · supervisor no longer uses it", () => {
  it("scripts/nex-workforce-v2/supervisor/lib/lifecycle_manager.mjs still exists (C8 tests reference it directly)", () => {
    expect(existsSync(join(REPO_ROOT, "scripts/nex-workforce-v2/supervisor/lib/lifecycle_manager.mjs"))).toBe(true);
  });

  it("supervisor.mjs does NOT reference createLifecycleManager anywhere", () => {
    const src = readFileSync(SUPERVISOR_SRC, "utf8");
    expect(src).not.toMatch(/createLifecycleManager/);
  });

  it("supervisor.lifecycle instance is a C9 child_lifecycle (exposes register + list + shutdownAll)", () => {
    const sup = createSupervisor({ query: mockQuery, logger: silent() });
    expect(typeof sup.lifecycle.register).toBe("function");
    expect(typeof sup.lifecycle.list).toBe("function");
    expect(typeof sup.lifecycle.shutdownAll).toBe("function");
    // The older API (spawnChild + gracefulShutdownAll) is NOT on the C9 lifecycle
    expect(sup.lifecycle.spawnChild).toBeUndefined();
    expect(sup.lifecycle.gracefulShutdownAll).toBeUndefined();
  });
});
