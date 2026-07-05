// Blueprint registrations — single import point.
//
// Importing this module registers every Blueprint manifest. Any code
// path that reads the blueprint registry (browser, wizard, recommender,
// installer, API routes) imports this file first — or transitively
// depends on something that does.
//
// New blueprint: add one line here + create the manifest under
// `blueprints/manifests/<slug>.ts`. Never edit any consumer.

// ─── Reference blueprints (Lane 1 smoke-test set) ───────────────────
import "./manifests/roofingEmergency";
import "./manifests/buildersMerchant";
import "./manifests/plantHire";

// ─── Core-trade blueprints (Lane 4 batch A) ─────────────────────────
import "./manifests/electrician";
import "./manifests/plumberEmergency";
import "./manifests/carpenter";
import "./manifests/kitchenFitter";
import "./manifests/bathroomFitter";
import "./manifests/landscaper";

// ─── Service-trade blueprints (Lane 4 batch B) ──────────────────────
import "./manifests/generalBuilder";
import "./manifests/painter";
import "./manifests/tiler";
import "./manifests/plasterer";
import "./manifests/solarInstaller";
import "./manifests/heatPumpInstaller";

// ─── Family-fill blueprints (Lane 4 batch C) ────────────────────────
import "./manifests/gasEngineer";
import "./manifests/rooferPlanned";
import "./manifests/windowFitter";
import "./manifests/groundworker";
import "./manifests/timberMerchant";
import "./manifests/recruitment";

// ─── Craft + supply blueprints (Lane 4 batch D) ─────────────────────
import "./manifests/bricklayer";
import "./manifests/fencer";
import "./manifests/aggregatesSupplier";
import "./manifests/concreteSupplier";
import "./manifests/hvacContractor";
import "./manifests/structuralEngineer";

// ─── Support + emergency blueprints (Lane 4 batch E) ────────────────
import "./manifests/welfareUnitHire";
import "./manifests/workwearRetailer";
import "./manifests/trainingProvider";
import "./manifests/locksmith";
import "./manifests/drivewaySpecialist";
import "./manifests/treeSurgeon";

// ─── Commercial + vehicle blueprints (Lane 4 batch F) ───────────────
import "./manifests/commercialRoofing";
import "./manifests/securityInstaller";
import "./manifests/fireProtection";
import "./manifests/steelFabricator";
import "./manifests/recoveryService";
import "./manifests/commercialVehicleHire";

// ─── Specialist blueprints (Lane 4 batch H) ─────────────────────────
import "./manifests/kitchenShowroom";
import "./manifests/bathroomShowroom";
import "./manifests/extensionSpecialist";
import "./manifests/partyWallSurveyor";
import "./manifests/dampSpecialist";
import "./manifests/asbestosSurveyor";

// ─── Broad-coverage blueprints (Lane 4 batch G) ─────────────────────
import "./manifests/handyman";
import "./manifests/skipHire";
import "./manifests/chimneySweep";
import "./manifests/mobileMechanic";
import "./manifests/charteredSurveyor";
import "./manifests/insulationInstaller";

// Re-export for consumers
export { blueprintRegistry } from "./registry";
export type {
  BlueprintManifest,
  BlueprintPageId,
  BlueprintPageLayout,
  BlueprintScore,
  BlueprintSectionSeed,
  CredentialScheme,
  DesignVariant,
  FrozenBlueprintManifest,
  OutcomeSlug
} from "./types";
export { DESIGN_VARIANTS, OUTCOME_SLUGS, CREDENTIAL_SCHEMES } from "./types";
