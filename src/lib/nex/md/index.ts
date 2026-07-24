// Nex Managing Director — public barrel.

export type {
  CashflowBucket,
  CashflowSnapshot,
  Evidence,
  ForecastSnapshot,
  JobProfit,
  MDBriefing,
  MDHealth,
  PriorityItem,
  ProfitSnapshot,
  Recommendation,
  SupplierRow,
  SupplierSnapshot,
  WorkforceSnapshot
} from "./types";
export { evidenceFor } from "./types";

export { buildCashflow } from "./cashflow";
export { buildForecast } from "./forecast";
export { buildProfit } from "./profit";
export { buildSuppliers } from "./suppliers";
export { buildWorkforce } from "./workforce";

export { bandFor, computeMDHealth } from "./health";
export type { HealthInputs } from "./health";

export { buildPriorities, isSilent, makePriority } from "./priorities";
export { buildRecommendations, toRecommendation } from "./recommendations";

export { _clearMdCache, buildMDBriefing } from "./engine";
export type { BuildMDInput, BuildMDResult } from "./engine";

export { answerMD, classifyMDQuestion } from "./answer";
export type { MDQuestion } from "./answer";
