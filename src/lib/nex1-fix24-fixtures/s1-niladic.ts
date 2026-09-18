// FIXTURE · reset by connection probe.
export interface WorkerPoolResult { readonly size: number; }
export function computeWorkerPool(): WorkerPoolResult {
  const size = 8;
  return { size };
}
