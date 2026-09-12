#!/usr/bin/env node
// Internal wrapper · called by nex-master-ai-supervisor.mjs
// Runs one Claude session observer cycle via tsx-compiled import.
// Outputs a single JSON line the supervisor can parse.

async function main() {
  const mod = await import("../src/lib/nex/master-ai/claude-session-observer.ts");
  const cycle = mod.runObserverCycle({ root: process.cwd(), window_hours: 24, max_files: 50 });
  process.stdout.write(JSON.stringify({
    files: cycle.files_scored,
    avg:   cycle.avg_score,
    advice: cycle.new_advice.length,
    top:   cycle.top_files.slice(0, 3),
  }) + "\n");
}
main().catch((err) => {
  process.stderr.write("observer_wrapper_error: " + String(err).slice(0, 300) + "\n");
  process.exit(1);
});
