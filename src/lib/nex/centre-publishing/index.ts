// NEX Centre publishing — public barrel.
//
// Consumers import from this file, not from internal modules. The
// merchant assistant approve endpoint + the centre feed API + the
// extended centre-search endpoint all reach in via this barrel.

export type { CentreFeedItem, CentreFeedFilters } from "./types";
export { listCentreFeedItems } from "./indexForSearch";
export {
  publishToFeed,
  setOfferCentreVisibility,
  type PublishToFeedResult,
} from "./publishToFeed";
