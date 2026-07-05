// registryKit · selfCheck.
//
// Cross-registration invariants that run either at dev-server boot or
// via a `pnpm registry:check` script (Milestone 1 ships the function;
// wiring the script is left for the next milestone).
//
// Checks performed:
//   • duplicate aliases across registrations
//   • alias collisions with real ids
//   • deprecation.replacedBy points at a real id
//   • version format on every registration (redundant with register()
//     validation, but caught here too for defensive completeness)

import type { Frozen, RegistrationBase } from "./types";
import { isSemver } from "./validators";

export type SelfCheckReport = {
  warnings: string[];
  errors: string[];
};

export function selfCheckRegistry<T extends RegistrationBase>(
  label: string,
  ids: Iterable<string>,
  getFn: (id: string) => Frozen<T> | undefined
): SelfCheckReport {
  const warnings: string[] = [];
  const errors: string[] = [];
  const idSet = new Set<string>(ids);

  // Collect every alias and check for collisions.
  const aliasOwner = new Map<string, string>();
  for (const id of idSet) {
    const reg = getFn(id);
    if (!reg) continue;

    if (!isSemver(reg.version)) {
      errors.push(
        `${label}: "${id}" has invalid version "${reg.version}".`
      );
    }

    for (const alias of reg.aliases ?? []) {
      if (idSet.has(alias)) {
        errors.push(
          `${label}: "${id}" declares alias "${alias}" that is itself a registered id.`
        );
      }
      const prevOwner = aliasOwner.get(alias);
      if (prevOwner && prevOwner !== id) {
        errors.push(
          `${label}: alias "${alias}" is claimed by both "${prevOwner}" and "${id}".`
        );
      }
      aliasOwner.set(alias, id);
    }

    if (reg.deprecation) {
      const { replacedBy, deprecatedSince } = reg.deprecation;
      if (!isSemver(deprecatedSince)) {
        errors.push(
          `${label}: "${id}" deprecation.deprecatedSince "${deprecatedSince}" is not valid semver.`
        );
      }
      if (replacedBy && !idSet.has(replacedBy) && !aliasOwner.has(replacedBy)) {
        warnings.push(
          `${label}: "${id}" deprecation.replacedBy "${replacedBy}" is not a registered id or alias.`
        );
      }
    }
  }

  return { warnings, errors };
}
