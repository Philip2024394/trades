// src/lib/nex/component-registry/types.ts
//
// Stage 10 · versioned component registry. Every reusable component (Button ·
// Card · Modal · Field · Table etc.) is registered with a semver + doctrine
// tags + NEX DNA compliance verdict. Consumers look up by (name, version).

export interface ComponentRecord {
  readonly name: string;              // "Button" · "Card" · "AttachmentField"
  readonly version: string;           // "v1.0.0"
  readonly capabilityId: string;      // CAP-XXX that owns this component
  readonly path: string;              // "src/components/nex/Button.tsx"
  readonly nexDnaVerdict: "PASS" | "FAIL" | "PENDING";
  readonly doctrineTags: readonly string[];    // e.g. ["DOC-034", "adr-0316d-rule-5"]
  readonly deprecatedBy: string | null;         // full "Name@version" of successor
  readonly registeredAt: string;
}

export type ComponentQuery =
  | { readonly kind: "byName"; readonly name: string }
  | { readonly kind: "byNameVersion"; readonly name: string; readonly version: string }
  | { readonly kind: "byCapability"; readonly capabilityId: string };

export type RegistryValidation =
  | { readonly ok: true }
  | { readonly ok: false; readonly code: string; readonly reason: string };
