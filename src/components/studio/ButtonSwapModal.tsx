"use client";

// Button-scoped swap picker — thin wrapper around SmartSwapModal.
//
// Buttons are structurally compatible with sections at the swap engine
// level: both expose id / name / description / editableFields /
// defaultConfig. The Universal Smart Section Engine matches by
// semantic role, not by "is this a section?", so button variants that
// share roles (e.g. every `primary_action` button) preserve label +
// href + icon across variant swaps.
//
// This wrapper narrows the candidate list to the source button's
// category so merchants pick between siblings (Primary Solid → Primary
// Gradient) rather than accidentally swapping into a WhatsApp CTA.

import { buttonRegistry } from "@/platform/buttons";
import "@/platform/buttons";
import { SmartSwapModal } from "./SmartSwapModal";
import type { FrozenButtonRegistration } from "@/platform/buttons/types";

type CommitPayload = {
  targetVariantKey: string;
  targetConfig: Record<string, unknown>;
  orphanedFields: { sourceKey: string; role?: string; value: unknown }[];
};

export function ButtonSwapModal({
  sourceInstanceId,
  source,
  onCancel,
  onCommit,
  /** Optional narrowing — defaults to "same role as source" so merchants
   *  stay within one intent. Pass "same-category" to widen. Pass "all"
   *  for absolute freedom. */
  scope = "same-role"
}: {
  sourceInstanceId: string;
  source: {
    registration: FrozenButtonRegistration;
    config: Record<string, unknown>;
  };
  onCancel: () => void;
  onCommit: (payload: CommitPayload) => void;
  scope?: "same-role" | "same-category" | "all";
}) {
  const candidates = buttonRegistry
    .list()
    .filter((r) => {
      if (r.id === source.registration.id) return false;
      if (scope === "same-role") return r.role === source.registration.role;
      if (scope === "same-category") return r.category === source.registration.category;
      return true;
    })
    .map((r) => ({
      id: r.id,
      name: r.name,
      description: r.description,
      editableFields: r.editableFields,
      defaultConfig: r.defaultConfig
    }));

  return (
    <SmartSwapModal
      sourceInstanceId={sourceInstanceId}
      source={{
        registration: {
          id: source.registration.id,
          name: source.registration.name,
          editableFields: source.registration.editableFields
        },
        config: source.config
      }}
      candidates={candidates}
      onCancel={onCancel}
      onCommit={(commit) =>
        onCommit({
          targetVariantKey: commit.targetSectionId,
          targetConfig: commit.targetConfig,
          orphanedFields: commit.orphanedFields
        })
      }
    />
  );
}
