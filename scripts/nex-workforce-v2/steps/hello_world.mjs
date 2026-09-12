// NEX Workforce v2 · Slice 1c · Hello-World Step-Library
// ─────────────────────────────────────────────────────────────────────────────
// SMOKE TEST ONLY (per D4). No domain work. No external services.
// Purpose: exercise the agent's inner loop end-to-end · plan → execute →
// checkpoint → complete. Real domain step-libraries land in Slice 1f+.
//
// Cursor shape: { stepIndex: 0..N } — tracks how many steps have been
// checkpointed. On restart, plan() emits only steps [stepIndex..N] so the
// agent resumes from where the previous incarnation checkpointed.
//
// Category/source keys: helloworld/helloworld  (registered by tests)

const TOTAL_STEPS = 3;

export const seedCursor = () => ({ stepIndex: 0, hits: [] });

export function plan({ cursor, workItem }) {
  const startAt = cursor?.stepIndex ?? 0;
  const steps = [];
  for (let i = startAt; i < TOTAL_STEPS; i++) {
    steps.push({
      id: `hello-${i}`,
      async execute({ ctx }) {
        // Simulate a small piece of work
        await new Promise((res) => setTimeout(res, 50));
        return { i, at: new Date().toISOString(), workItemId: workItem.id };
      },
      async newCursor({ cursor, result }) {
        return {
          stepIndex: (cursor?.stepIndex ?? 0) + 1,
          hits: [...(cursor?.hits ?? []), result],
        };
      },
    });
  }
  return steps;
}

export const totals = ({ cursor }) => ({
  records_new:      cursor?.stepIndex ?? 0,
  records_rejected: 0,
});
