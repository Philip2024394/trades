// §36-PCE1 · WAVE-PCE-V1 · 2026-09-15 · nex-perceptual-contract-extraction-v1 · v1 adapter
// NEX bounded infrastructure · honest V1 contract adapter · 2026-09-15
// Authored as bounded NEX infrastructure per Perpetual Coder Rule · NOT
// NEX1-authored capability.
//
// Converts a PerceptualExtractionResult into a V1 VisualConstraintContract
// **honestly** — verified properties become contract entries; unable_to_verify
// properties are OMITTED (never fabricated).
//
// This preserves the no-confidence-laundering rule:
//   PCE unable_to_verify
//        → V1 contract has no entry for the property
//        → V2 sees an absence · does not fabricate 'preserved' or 'changed'
//
// The returned bundle also names every omitted property so callers can see
// exactly what PCE could not verify.

import type { PerceptualExtractionResult, PCE_ExtractedProperty } from "./perceptual-extraction";
import type {
  ColourLock,
  ComponentCount,
  IdentityFeature,
  MaterialLock,
  VisualConstraintContract,
} from "../nex-visual-intelligence-v1/visual-constraint-contract";

export interface PCEToV1AdapterBundle {
  /** V1 contract containing ONLY properties PCE could verify.
   *  In PCE V1 this typically contains just aspect_ratio when the format
   *  is PNG · everything else is omitted honestly. */
  readonly contract: VisualConstraintContract;
  /** Property IDs that PCE could not verify · these are NOT in the contract. */
  readonly unable_to_verify_property_ids: readonly string[];
  /** Property IDs that PCE could verify · these ARE in the contract or its
   *  provenance section. */
  readonly verified_property_ids: readonly string[];
}

/** Convert a PCE result to a V1 contract bundle. Unable_to_verify
 *  properties are OMITTED · never fabricated. The bundle carries the
 *  honest unable_to_verify list so downstream consumers can see what
 *  PCE couldn't establish.
 *
 *  Caller supplies contract_id + subject_kind because these are user-
 *  facing identifiers not derivable from pixels alone. */
export function toVisualConstraintContract(input: {
  readonly extraction: PerceptualExtractionResult;
  readonly contract_id: string;
  readonly subject_kind: string;
}): PCEToV1AdapterBundle {
  const { extraction, contract_id, subject_kind } = input;
  const properties: readonly PCE_ExtractedProperty[] = extraction.extracted_properties;
  const verified_ids: string[] = [];
  const unable_ids: string[] = [];

  // Build the V1 contract from ONLY verified properties. Anything
  // unable_to_verify is added to unable_ids but NOT synthesised into the
  // contract.

  // Aspect-ratio derivation (only if verified)
  let aspect_ratio_num = 1;
  let aspect_ratio_den = 1;
  let aspect_ratio_verified = false;

  for (const p of properties) {
    if (p.verification_status === "unable_to_verify") {
      unable_ids.push(p.property_id);
      continue;
    }
    if (p.verification_status === "verified_deterministic" || p.verification_status === "high_confidence") {
      verified_ids.push(p.property_id);
      if (p.property_id === "composition.aspect_ratio") {
        const parts = p.value_summary.split(":");
        const n = Number.parseInt(parts[0] ?? "1", 10);
        const d = Number.parseInt(parts[1] ?? "1", 10);
        if (Number.isFinite(n) && Number.isFinite(d) && n > 0 && d > 0) {
          aspect_ratio_num = n;
          aspect_ratio_den = d;
          aspect_ratio_verified = true;
        }
      }
    }
  }

  const identity_features: IdentityFeature[] = [];
  // NEX policy: no identity features unless PCE verified them.
  // In V1 no identity feature extraction is authorised → array stays empty.

  const component_counts: ComponentCount[] = [];
  // Similarly · no fabricated component counts.

  const locked_materials: MaterialLock[] = [];
  // No fabricated materials.

  const locked_colours: ColourLock[] = [];
  // No fabricated colours.

  const contract: VisualConstraintContract = {
    contract_id,
    subject_kind,
    identity_features: Object.freeze(identity_features),
    geometry: {
      component_counts: Object.freeze(component_counts),
      structural_description: aspect_ratio_verified
        ? `PCE V1: aspect_ratio ${aspect_ratio_num}:${aspect_ratio_den} · structural detail unable_to_verify`
        : "PCE V1: structural detail unable_to_verify",
    },
    camera: {
      // These are marked in unable_ids · the contract stores placeholders
      // labelled explicitly so a reviewer sees the semantics clearly.
      // A future PCE Vb amendment can populate these.
      view_angle_kind: "eye_level",       // placeholder · flagged as unable in unable_ids
      height_relative_kind: "eye_level",  // placeholder · flagged in unable_ids
      focal_length_kind: "standard",      // placeholder · flagged in unable_ids
    },
    composition: {
      aspect_ratio_num: aspect_ratio_verified ? aspect_ratio_num : 1,
      aspect_ratio_den: aspect_ratio_verified ? aspect_ratio_den : 1,
      subject_placement_hint: "unable_to_verify",
    },
    locked_materials: Object.freeze(locked_materials),
    locked_colours: Object.freeze(locked_colours),
    provenance: {
      authored_at: extraction.provenance.extraction_timestamp,
      authored_by: "MAI_infrastructure",
      source_reference_sha256: extraction.provenance.source_asset_sha256,
      contract_version: "1.0.0",
      promotion_state: "PENDING",
    },
  };

  return {
    contract,
    unable_to_verify_property_ids: Object.freeze(unable_ids),
    verified_property_ids: Object.freeze(verified_ids),
  };
}
