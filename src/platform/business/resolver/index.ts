export { resolve } from "./resolve";
export type { FacetProvenance, ResolvedStrategy } from "./types";

// The strategyResolver is exported as a namespace of pure functions —
// not a class — because it has no state.
import { resolve } from "./resolve";
export const strategyResolver = { resolve };
