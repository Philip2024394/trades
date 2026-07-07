// Public surface of the events module.

export { emitEvent } from "./emit";
export type { EmitInput, EmitResult } from "./emit";

export {
  registerProjection,
  projectionsFor,
  allRegistrations
} from "./bus";
export type { ProjectionHandler } from "./bus";

export {
  loadEvent,
  loadEventsForMerchant,
  loadProjectionsForEvent
} from "./loader";

export {
  BUSINESS_EVENT_TYPES,
  isBusinessEventType,
  PROJECTION_TYPES
} from "./types";
export type {
  BusinessEvent,
  BusinessEventType,
  EventProjection,
  ProjectionResult,
  ProjectionStatus,
  ProjectionType
} from "./types";
