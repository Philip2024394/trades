// src/app/api/nex-control/agents/status/route.ts
//
// NEX Agent Runtime · Control Plane · STATUS endpoint
// Philip 2026-09-06 · FOUNDER AUTHORIZATION · §19 · §43 (truth over
// green label)
//
// GET /api/nex-control/agents/status
//
// Returns the OPERATIONAL TRUTH — derived at request time from
// heartbeat freshness + PID aliveness. Never returns registry
// configuration as if it were runtime state.
//
// Status is READ-ONLY and safe to expose without founder auth (no
// mutation possible), but includes only the shape defined in types.ts —
// no sensitive command audit content leaks here.

import { NextResponse } from "next/server";
import {
  status,
  ensureAuthorizedAgentsRegistered,
} from "@/lib/nex/agent-runtime/control-plane";
import { readRecentEvents } from "@/lib/nex/agent-runtime/event-bus";
import { readFounderStopOverride } from "@/lib/nex/agent-runtime/registry";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  ensureAuthorizedAgentsRegistered();
  const s = status();
  const override = readFounderStopOverride();
  const recentEvents = readRecentEvents(20);
  return NextResponse.json({
    ok: true,
    ...s,
    founder_stop_override_detail: override,
    recent_events: recentEvents,
    honesty: {
      // §43 disclosure — this runtime is 24/7-capable but the current
      // process persistence contract depends on:
      //   1. The parent Node process (Next.js dev server) OR
      //   2. Windows Task Scheduler (per-user, no admin) registration
      //      via `scripts/walkers/install-scheduled-task.ps1` pattern.
      // If neither is installed, agents will NOT survive user log-off
      // or reboot. See _agent_runtime_activation_report.md.
      persistence_across_reboot: "requires_windows_task_scheduler_installation",
      persistence_across_logoff: "requires_windows_task_scheduler_installation",
      persistence_across_terminal_close: "yes_via_detached_child_process",
    },
  });
}
