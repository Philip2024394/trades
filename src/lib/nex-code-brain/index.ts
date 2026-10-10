// NEX Code Brain · public entry point
// Import from `@/lib/nex-code-brain` rather than deep files.

export type {
  AgentLane,
  LaneStatus,
  WriteLease,
  LeaseConflictKind,
  LeaseGrant,
  LeaseConflict,
  LeaseResult,
  LeaseRequest,
  KnowledgeEntry,
  FeedItem,
  AssignmentRecord,
  LaneRoutingResult,
  CrossLaneRejection,
  WorkAcceptance,
  WorkRequestResult,
  WorkRequest,
} from "./types";

export {
  loadLanes,
  seedLanes,
  registerLane,
  updateLaneStatus,
  findLane,
  validateLanesNonOverlapping,
} from "./lane-registry";

export { routePath, routePaths, normaliseRel } from "./path-router";

export {
  acquireLease,
  releaseLease,
  forceReleaseByLane,
  listActiveLeases,
  sweepExpiredLeases,
} from "./leases";

export {
  currentAssignments,
  assignmentsForLane,
  assignmentsByStatus,
  findActiveAssignment,
  newAssignmentId,
} from "./assignments";

export {
  addEntry as addKnowledgeEntry,
  searchEntries as searchKnowledge,
  totalEntries as totalKnowledgeEntries,
} from "./knowledge-store";

export { enqueueOnLane, readFeed, updateFeedItemStatus } from "./feed";

export { requestWork, completeWork } from "./brain";
