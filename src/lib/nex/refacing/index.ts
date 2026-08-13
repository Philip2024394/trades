// index.ts — public surface of the NEX Refacing intelligence library.
//
// Consumers (page.tsx, API routes, tests) should import from '@/lib/nex/refacing'
// rather than reaching into individual files. This keeps the surface reviewable
// and makes future re-organisation safe.

export {
  newRefacingCaseId,
  isRefacingCaseId,
  assertRefacingCaseId,
  type RefacingCaseId,
} from "./case-id";

export {
  CONFIDENCE_VALUES,
  isConfidence,
  attest,
  isBannedFieldName,
  type Confidence,
  type Attested,
} from "./confidence";

export {
  COMPONENT_ROLES,
  CANONICAL_STYLES,
  CANONICAL_MOODS,
  STYLE_VALUES,
  MOOD_VALUES,
  MATERIAL_FAMILIES,
  CONFIGURATION_VALUES,
  FLIGHT_ORIENTATION_VALUES,
  STRING_TYPE_VALUES,
  RISER_OPENNESS_VALUES,
  OWNER_TYPES,
  VISIBILITY_LABELS,
  makeCanonicalProfileId,
  isCanonicalProfileId,
  isCompatibilityGroupId,
  type ComponentRole,
  type CanonicalStyle,
  type CanonicalMood,
  type CanonicalProfileId,
  type CompatibilityGroupId,
  type StyleValue,
  type MoodValue,
  type MaterialFamily,
  type SubMaterial,
  type MaterialCompositionEntry,
  type Configuration,
  type FlightOrientation,
  type StringType,
  type RiserOpenness,
  type FlightSegment,
  type LandingSegment,
  type GeometrySegment,
  type Geometry,
  type QualityAttributes,
  type OwnerType,
  type VisibilityLabel,
  type Governance,
  type RelatedImageRef,
  type ImagesV3Entry,
  type ImagesV3Family,
} from "./image-schema";

export {
  INTENT_TREATMENTS,
  FEELING_VALUES,
  CASE_STATUSES,
  type IntentTreatment,
  type IntentEntry,
  type FeelingValue,
  type TransformationScope,
  type CustomerIntent,
  type DesignDirection,
  type SelectedDesign,
  type RequestedWorkArea,
  type RequestedWork,
  type UnknownItem,
  type CaseStatus,
  type CustomerContact,
  type BasePhoto,
  type VisibleComponent,
  type ExistingStaircase,
  type RefacingCase,
} from "./case-schema";

export {
  validateCompositionProvenance,
  tryValidateCompositionProvenance,
  PR18ProvenanceError,
  type CompositionProvenanceEntry,
  type CompositionProvenance,
} from "./provenance";

export {
  validatePR16,
  validatePR13NoNexPriceOnCase,
  validateRefacingCase,
  validateImagesV3Entry,
  tryValidateRefacingCase,
  tryValidateImagesV3Entry,
  PR16ConfidenceError,
  PR13PriceOnCaseError,
  type CaseValidatorContext,
  type ValidationResult,
} from "./validators";

export {
  loadManifest,
  loadImagesV3,
  loadKnownImageIds,
  invalidateManifestCache,
  type RawManifest,
} from "./manifest";

export {
  createDraftCase,
  readCase,
  readCaseWithToken,
  updateCase,
  CaseNotFoundError,
  CaseValidationError,
} from "./case-store";

export {
  retrieveSeeDirections,
  retrieveTryAlternates,
  resolveReferences,
  type SeeQuery,
  type SeeDirection,
  type TryQuery,
  type TryAlternate,
} from "./retrieval";

export {
  mapFeelingsToStyles,
  mapFeelingsToMoods,
  inferMaterialFamilyHint,
  componentRoleFromItem,
} from "./feeling-map";
