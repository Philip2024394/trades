// src/lib/nex-native/directory/index.ts
//
// NEX Directory · Phase B + C · Barrel.
//
// The one import surface. Downstream callers (Phase A UI route +
// future surfaces) import from here, never reach past the barrel
// into the individual files, so future refactors stay contained.

// ─── Phase B · Canonical read contract ────────────────────────────

export {
  classifyEntityType,
  BUSINESS_ENTITY_TYPES,
  PERSON_ENTITY_TYPES,
  PLACE_ENTITY_TYPES,
} from "./classify-entity-type";

export {
  projectDirectoryListing,
  projectDirectoryListings,
} from "./project-canonical-row";

export type { ProjectDirectoryListingArgs } from "./project-canonical-row";

export type {
  DirectoryCanonicalRow,
  DirectoryClassification,
  DirectoryCoordinates,
  DirectoryImage,
  DirectoryListingMedia,
  DirectoryListingVM,
  EntityType,
  LifecycleState,
} from "./types";

// ─── Phase C · Destination resolution ─────────────────────────────

export {
  resolveDirectoryDestination,
  resolveDirectoryDestinations,
  buildNexBusinessPath,
  buildNexUserProfilePath,
} from "./resolve-destination";

export type { ResolveDirectoryDestinationArgs } from "./resolve-destination";

export {
  NEX_BUSINESS_ROUTE_PATTERN,
  NEX_USER_PROFILE_ROUTE_PATTERN,
  SEALED_DESTINATION_KINDS,
  SEALED_UNRESOLVED_REASONS,
} from "./destination-types";

export type {
  DirectoryDestination,
  OwnerClaim,
  UnresolvedReason,
} from "./destination-types";
