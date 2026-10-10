// NEX1 · Rung-5 · type-repair demo · consumer with intentional TS2739
// Deterministic · zero LLM · used ONLY by the tsc-mode branch of the loop.
import type { DemoConfig } from "./types";
export const demoConfig: DemoConfig = {
    name: "demo",
    enabled: true,
    maxRetries: 0
};
