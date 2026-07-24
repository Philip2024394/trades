// Nex Marketplace Intelligence — public barrel.

export type {
  Evidence,
  ProcurementAdvice,
  ProcurementSaving,
  ProductListing,
  ProductRequest,
  RankedListing,
  SearchResult
} from "./types";
export { UNAVAILABLE_TODAY, evidenceFor } from "./types";

export { searchProducts }        from "./search";
export type { SearchProductsInput } from "./search";

export { parseBasketRequest }    from "./basket";
export type { ParsedBasket }     from "./basket";

export { rankListings }          from "./ranking";
export type { RankInput, TrustLookup } from "./ranking";

export { buildProcurementAdvice } from "./procurement";
export type { BuildProcurementInput } from "./procurement";

export { answerMP, classifyMPQuestion, formatSearch } from "./answer";
export type { AnswerMPInput, MPQuestion } from "./answer";
