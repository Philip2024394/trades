// Nex Financial Intelligence — public barrel.

export type {
  AffordabilityAnswer,
  Evidence,
  ExpenseBreakdown,
  ExpenseCategoryRow,
  FinancialHealth,
  FinancialSnapshot,
  RevenueBreakdown,
  RevenueRow,
  VATSummary
} from "./types";
export { evidenceFor } from "./types";

export { buildRevenue }  from "./revenue";
export { buildExpenses } from "./expenses";
export { buildVAT }      from "./vat";
export { checkAffordability } from "./affordability";

export { bandFor, computeFinancialHealth } from "./health";
export type { FinancialHealthInputs } from "./health";

export { _clearFiCache, buildFinancialSnapshot } from "./engine";
export type { BuildFinancialInput, BuildFinancialResult } from "./engine";

export { answerFinancial, classifyFinancialQuestion } from "./answer";
export type { FIQuestion } from "./answer";
