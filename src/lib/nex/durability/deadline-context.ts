// src/lib/nex/durability/deadline-context.ts
//
// UWI · Wave 2 · D3 · Deadline-propagation context (~40 LOC)
// Founder-authorised programme.
//
// First-class deadline that propagates across worker chains. Prevents
// late results arriving after the caller gave up; enables coordinated
// timeouts. Every long-chain research operation should accept an
// optional DeadlineContext and check `assertNotExpired` at each step.

export interface DeadlineContext {
  readonly started_at_ms: number;
  readonly deadline_ms: number;
  /** Human-readable name for diagnostics. Optional. */
  readonly context?: string;
}

/** Create a fresh deadline expiring `timeout_ms` from now. */
export function createDeadline(
  timeout_ms: number,
  context?: string,
  now_ms: number = Date.now(),
): DeadlineContext {
  return { started_at_ms: now_ms, deadline_ms: now_ms + timeout_ms, context };
}

/** Milliseconds remaining before the deadline expires. Never negative. */
export function remainingMs(ctx: DeadlineContext, now_ms: number = Date.now()): number {
  return Math.max(0, ctx.deadline_ms - now_ms);
}

/** True if the deadline has expired. */
export function isExpired(ctx: DeadlineContext, now_ms: number = Date.now()): boolean {
  return now_ms >= ctx.deadline_ms;
}

/** Create a child context with a shorter sub-budget. Child deadline is
 *  min(parent_deadline, now + sub_timeout_ms) — never longer than parent. */
export function childDeadline(
  parent: DeadlineContext,
  sub_timeout_ms: number,
  context?: string,
  now_ms: number = Date.now(),
): DeadlineContext {
  const sub_deadline = now_ms + sub_timeout_ms;
  return {
    started_at_ms: now_ms,
    deadline_ms: Math.min(parent.deadline_ms, sub_deadline),
    context,
  };
}

export class DeadlineExceededError extends Error {
  readonly elapsed_ms: number;
  readonly budget_ms: number;
  constructor(where: string, ctx: DeadlineContext, now_ms: number = Date.now()) {
    const elapsed = now_ms - ctx.started_at_ms;
    const budget = ctx.deadline_ms - ctx.started_at_ms;
    super(
      `deadline exceeded in '${where}': elapsed=${elapsed}ms budget=${budget}ms` +
        (ctx.context ? ` deadline_context='${ctx.context}'` : ""),
    );
    this.name = "DeadlineExceededError";
    this.elapsed_ms = elapsed;
    this.budget_ms = budget;
  }
}

/** Throw DeadlineExceededError if the deadline has expired. */
export function assertNotExpired(ctx: DeadlineContext, where: string, now_ms: number = Date.now()): void {
  if (isExpired(ctx, now_ms)) throw new DeadlineExceededError(where, ctx, now_ms);
}
