// FIXTURE · cross-function trace.
export interface PipelineResult { readonly output: number; }
export function stage1(input: number): number {
  return Math.max(1, input);
}
export function runPipeline(input: number): PipelineResult {
  const output = stage1(input);
  return { output };
}
