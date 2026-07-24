// Nex Supply Chain Intelligence — public barrel.

export type {
  AlternativeItem,
  AlternativesAnswer,
  DeliverySuggestion,
  Evidence,
  ShoppingLine,
  ShoppingList,
  SupplierProfile,
  SupplierProfiles,
  SupplyChainSnapshot,
  WasteRow,
  WasteSummary
} from "./types";
export { evidenceFor } from "./types";

export { buildShoppingList }      from "./shopping_list";
export { buildSupplierProfiles }  from "./suppliers";
export { buildWaste }             from "./waste";
export { findAlternatives }       from "./alternatives";
export { suggestDelivery }        from "./delivery_planner";

export { _clearScCache, buildSCSnapshot } from "./engine";
export type { BuildSCInput, BuildSCResult } from "./engine";

export { answerSC, classifySCQuestion } from "./answer";
export type { SCQuestion } from "./answer";
