// src/lib/nex/section-build/index.ts
//
// Stage 3 · public API for build artifacts · section revisions · change requests.
// PIPELINE substrates only · never canonical Knowledge (ADR-0314i §9).

export type {
  ArtifactFile,
  BuildArtifact,
  ChangeRequest,
  LifecycleState,
  SectionRevision,
  SemverParts,
} from "./types";

export {
  hashFileContent,
  hashArtifact,
  toArtifactFile,
} from "./content-hash";

export {
  parseSemver,
  formatSemver,
  bumpPatch,
  bumpMinor,
  bumpMajor,
  compareSemver,
} from "./semver";

export {
  createBuildArtifact,
  createSectionRevision,
  transitionRevision,
  createChangeRequest,
  walkRevisionHistory,
  getActiveRevision,
  isLegalTransition,
} from "./revision-store";
