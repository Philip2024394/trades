// Universal Smart Section Engine — variant/category swap logic.
//
// The single most important piece of the Studio's differentiation:
// swapping a section preserves merchant content by matching fields via
// their SEMANTIC ROLE rather than their key. A Hero A `heading` (role
// "headline") carries into a Hero B `mainTitle` (role "headline")
// without merchant intervention.
//
// Pure. No I/O. No React. Fully deterministic. Wrapped by the diff
// modal (`SmartSwapModal`) for the UI and callable from the Studio bus
// (`iframeEmit.replaceSection`) once wired.

import type { SectionRegistration } from "./sectionTypes";

/** Everything the swap engine returns — never throws. Callers inspect
 *  `.result.status` to decide whether to commit or prompt the merchant. */
export type SmartSwapResult = {
  /** The new config to hand to the target section renderer. Ready to
   *  render. */
  targetConfig: Record<string, unknown>;
  /** Which target keys were populated from the source and how. */
  carried: CarryEntry[];
  /** Target keys that got the target's default because no source
   *  match was found. */
  defaulted: DefaultEntry[];
  /** Source keys that had no landing spot on the target. Stored so
   *  a swap-back can restore them cleanly. */
  orphaned: OrphanEntry[];
  /** Roll-up view for humans + telemetry. */
  summary: {
    carriedCount: number;
    defaultedCount: number;
    orphanedCount: number;
    /** Percentage of target's fields that received a merchant-authored
     *  value from the source. Higher = better swap. */
    carryRate: number;
  };
};

export type CarryEntry = {
  targetKey: string;
  sourceKey: string;
  /** How we matched — role match is preferred; same-key match is the
   *  fallback for legacy sections without roles seeded. */
  via: "role" | "same-key";
  role?: string;
  value: unknown;
};

export type DefaultEntry = {
  targetKey: string;
  role?: string;
  reason:
    | "no-source-match"
    | "source-empty"
    | "type-incompatible";
  value: unknown;
};

export type OrphanEntry = {
  sourceKey: string;
  role?: string;
  value: unknown;
};

/** Run a section swap. Returns a fully populated target config plus a
 *  diff report the UI can render before committing. */
export function smartSwap(args: {
  source: {
    registration: Pick<SectionRegistration, "id" | "editableFields">;
    config: Record<string, unknown>;
  };
  target: {
    registration: Pick<
      SectionRegistration,
      "id" | "editableFields" | "defaultConfig"
    >;
  };
}): SmartSwapResult {
  const { source, target } = args;

  const targetDefaults = target.registration.defaultConfig();
  const targetConfig: Record<string, unknown> = { ...targetDefaults };

  const sourceByRole = buildRoleIndex(source.registration.editableFields);
  const sourceByKey = new Map(
    source.registration.editableFields.map((f) => [f.key, f])
  );

  const carried: CarryEntry[] = [];
  const defaulted: DefaultEntry[] = [];
  const consumedSourceKeys = new Set<string>();

  // ─── Fill every target field ────────────────────────────
  for (const targetField of target.registration.editableFields) {
    const targetRole = targetField.role;
    let matched = false;

    // 1. Role match — the primary strategy.
    if (targetRole) {
      const sourceCandidates = sourceByRole.get(targetRole);
      const winner = pickBestSourceCandidate(sourceCandidates, source.config);
      if (winner) {
        const sourceValue = source.config[winner.key];
        if (isMeaningful(sourceValue)) {
          targetConfig[targetField.key] = sourceValue;
          carried.push({
            targetKey: targetField.key,
            sourceKey: winner.key,
            via: "role",
            role: targetRole,
            value: sourceValue
          });
          consumedSourceKeys.add(winner.key);
          matched = true;
        }
      }
    }

    // 2. Same-key fallback — legacy path for pre-role sections. Only
    //    fires when the source field has NO role (else we'd overwrite
    //    a deliberate role-based match above).
    if (!matched) {
      const sourceField = sourceByKey.get(targetField.key);
      if (
        sourceField &&
        !sourceField.role &&
        !consumedSourceKeys.has(targetField.key)
      ) {
        const sourceValue = source.config[targetField.key];
        if (
          isMeaningful(sourceValue) &&
          isTypeCompatible(sourceField.type, targetField.type)
        ) {
          targetConfig[targetField.key] = sourceValue;
          carried.push({
            targetKey: targetField.key,
            sourceKey: targetField.key,
            via: "same-key",
            role: targetRole,
            value: sourceValue
          });
          consumedSourceKeys.add(targetField.key);
          matched = true;
        }
      }
    }

    // 3. No match — target default stays.
    if (!matched) {
      defaulted.push({
        targetKey: targetField.key,
        role: targetRole,
        reason: "no-source-match",
        value: targetDefaults[targetField.key]
      });
    }
  }

  // ─── Collect orphans (source fields with no home on target) ────
  const orphaned: OrphanEntry[] = [];
  for (const sourceField of source.registration.editableFields) {
    if (consumedSourceKeys.has(sourceField.key)) continue;
    const sourceValue = source.config[sourceField.key];
    if (!isMeaningful(sourceValue)) continue;
    orphaned.push({
      sourceKey: sourceField.key,
      role: sourceField.role,
      value: sourceValue
    });
  }

  const totalTargetFields = target.registration.editableFields.length;
  const carryRate =
    totalTargetFields === 0
      ? 1
      : carried.length / totalTargetFields;

  return {
    targetConfig,
    carried,
    defaulted,
    orphaned,
    summary: {
      carriedCount: carried.length,
      defaultedCount: defaulted.length,
      orphanedCount: orphaned.length,
      carryRate
    }
  };
}

// ─── Helpers ─────────────────────────────────────────────────────

function buildRoleIndex(
  fields: SectionRegistration["editableFields"]
): Map<string, { key: string; roleWeight: number }[]> {
  const idx = new Map<string, { key: string; roleWeight: number }[]>();
  for (const f of fields) {
    if (!f.role) continue;
    const bucket = idx.get(f.role) ?? [];
    // roleWeight bumps priority-tagged fields ahead of unmarked ones so
    // when multiple source fields share a role (rare but possible during
    // migrations) we prefer the one the merchant actually edits.
    const roleWeight = f.priority ? 1 : 0;
    bucket.push({ key: f.key, roleWeight });
    idx.set(f.role, bucket);
  }
  return idx;
}

function pickBestSourceCandidate(
  candidates: { key: string; roleWeight: number }[] | undefined,
  config: Record<string, unknown>
): { key: string } | null {
  if (!candidates || candidates.length === 0) return null;
  // Prefer candidates that (a) carry a non-empty value and (b) have the
  // highest role weight. Stable sort so behavior is deterministic across
  // runs.
  const scored = candidates
    .map((c) => ({
      key: c.key,
      score:
        c.roleWeight * 10 + (isMeaningful(config[c.key]) ? 1 : 0)
    }))
    .sort((a, b) => b.score - a.score);
  return scored[0].score > 0 ? { key: scored[0].key } : { key: scored[0].key };
}

/** A value is "meaningful" if the merchant would notice its loss:
 *  non-empty strings, non-zero numbers unless zero is default, non-null
 *  media URLs, defined booleans. Empty defaults get treated as absence
 *  so a target field can fall back cleanly. */
function isMeaningful(v: unknown): boolean {
  if (v === null || v === undefined) return false;
  if (typeof v === "string") return v.trim().length > 0;
  if (typeof v === "number") return Number.isFinite(v);
  if (typeof v === "boolean") return true;
  if (Array.isArray(v)) return v.length > 0;
  if (typeof v === "object") return Object.keys(v).length > 0;
  return true;
}

/** Type compatibility for the same-key fallback. Role matches skip this
 *  check because same-role means same semantic type by contract. */
function isTypeCompatible(
  sourceType: { kind: string },
  targetType: { kind: string }
): boolean {
  if (sourceType.kind === targetType.kind) return true;
  // text ↔ rich_text is safe (rich_text tolerates plain strings)
  if (
    (sourceType.kind === "text" && targetType.kind === "rich_text") ||
    (sourceType.kind === "rich_text" && targetType.kind === "text")
  ) {
    return true;
  }
  return false;
}
