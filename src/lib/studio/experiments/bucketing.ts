// Deterministic bucketing for A/B tests.
//
// Same-visitor, same-experiment → always same bucket. This is critical:
// if a visitor sees variant B on landing and variant A on return, the
// analytics attribution is meaningless AND the customer experience
// flickers between variants across visits.
//
// Uses a fast, deterministic string hash → 0-99 → compared against the
// experiment's split_a. Not crypto strength — that's fine, we only need
// a stable pseudo-random split.

export function bucketFor(
  visitorId: string,
  experimentId: string,
  splitA: number
): "A" | "B" {
  const seed = `${visitorId}::${experimentId}`;
  // FNV-1a 32-bit — cheap, collision-resistant enough for bucketing.
  let hash = 0x811c9dc5;
  for (let i = 0; i < seed.length; i++) {
    hash ^= seed.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193) >>> 0;
  }
  const percentile = hash % 100;
  return percentile < splitA ? "A" : "B";
}

export type ResolvedExperiment = {
  id: string;
  instance_id: string;
  variant_bucket: "A" | "B";
  config_overlay: Record<string, unknown>;
};

export type ExperimentRow = {
  id: string;
  instance_id: string;
  variant_a_config: Record<string, unknown>;
  variant_b_config: Record<string, unknown>;
  split_a: number;
};

/** Given the running experiments for a page + the visitor's stable id,
 *  resolve one ResolvedExperiment per experiment (bucket + config
 *  overlay to spread onto the section's live config). */
export function resolveExperiments(
  experiments: ExperimentRow[],
  visitorId: string
): ResolvedExperiment[] {
  return experiments.map((exp) => {
    const bucket = bucketFor(visitorId, exp.id, exp.split_a);
    const overlay =
      bucket === "A" ? exp.variant_a_config : exp.variant_b_config;
    return {
      id: exp.id,
      instance_id: exp.instance_id,
      variant_bucket: bucket,
      config_overlay: overlay ?? {}
    };
  });
}
