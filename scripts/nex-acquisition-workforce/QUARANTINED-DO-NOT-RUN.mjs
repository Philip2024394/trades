#!/usr/bin/env node
// ═══════════════════════════════════════════════════════════════════════
// LEGACY WORKFORCE QUARANTINE · SAFETY-NET SCRIPT · 2026-09-04
// ═══════════════════════════════════════════════════════════════════════
// This file exists so the Windows Scheduled Task `NEX-Acquisition-Workforce`
// can be re-pointed away from the legacy launcher without deleting the task
// (the task remains Disabled). If the task is ever accidentally enabled and
// fired, it lands here and exits with code 2 + a clear quarantine notice
// instead of launching the legacy Phase 1B acquisition workforce.
//
// This file must:
//   · Never import pg / any DB client
//   · Never spawn any child process
//   · Never make any HTTP request
//   · Never touch any file
//   · Exit as fast as possible with a non-zero code
//
// Rollback: restore the Scheduled Task action to point back at
//   scripts\nex-acquisition-workforce\run-production-launcher.mjs
//   (see the quarantine slice's Part 14 · Rollback Procedure).
// ═══════════════════════════════════════════════════════════════════════

process.stderr.write("═══════════════════════════════════════════════════════════════════════\n");
process.stderr.write(" NEX LEGACY WORKFORCE · QUARANTINED · Scheduled-Task safety-net fired\n");
process.stderr.write("═══════════════════════════════════════════════════════════════════════\n");
process.stderr.write("\n");
process.stderr.write(" The Windows Scheduled Task 'NEX-Acquisition-Workforce' launched this\n");
process.stderr.write(" safety-net script instead of the legacy production launcher.\n");
process.stderr.write("\n");
process.stderr.write(" This means either:\n");
process.stderr.write("   (a) The task was accidentally enabled (it must remain Disabled), or\n");
process.stderr.write("   (b) Someone manually triggered it via Start-ScheduledTask.\n");
process.stderr.write("\n");
process.stderr.write(" No database connection, child-process spawn, or Overpass request has\n");
process.stderr.write(" occurred. Exiting with code 2 immediately.\n");
process.stderr.write("\n");
process.stderr.write(" The legacy nex-acquisition-workforce path was quarantined on 2026-09-04\n");
process.stderr.write(" per the Permanent Workforce Activation Readiness Gate finding: legacy\n");
process.stderr.write(" writes bypass the Slice 4.1 v2 extensions.digest persister boundary\n");
process.stderr.write(" proven by Gate 5A #4. Legacy production launch is superseded by\n");
process.stderr.write(" scripts/nex-workforce-v2/ (activation is a separate future gate).\n");
process.stderr.write("\n");
process.stderr.write(" To restore intentional operation:\n");
process.stderr.write("   1. Design the workforce v2 supervisor (separate authorized slice)\n");
process.stderr.write("   2. Rewire the Scheduled Task to point at the v2 supervisor\n");
process.stderr.write("   3. Explicit authorization from Philip required before enabling\n");
process.stderr.write("═══════════════════════════════════════════════════════════════════════\n");
process.exit(2);
