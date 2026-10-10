// NEX1 · Rung-5 · type-repair demo · isolated types
// Deterministic · zero LLM · used ONLY by the tsc-mode branch of the loop.
export interface DemoConfig {
  readonly name: string;
  readonly enabled: boolean;
  readonly maxRetries: number;
}
