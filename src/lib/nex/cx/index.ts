// Nex Customer Intelligence — public barrel.

export type {
  ContactSummary,
  CustomerListEntry,
  CustomerRef,
  CustomerResolveErr,
  CustomerResolveOk,
  CustomerSnapshot,
  Evidence,
  Opportunity,
  PaymentOwed,
  Preference,
  RelationshipHealth,
  WarrantyItem
} from "./types";
export { evidenceFor } from "./types";

export { bandFor, computeRelationshipHealth } from "./health";
export type { HealthInput } from "./health";

export { resolveCustomer } from "./resolver";

export { _clearCxCache, buildCustomerSnapshot } from "./engine";
export type { BuildCustomerOptions, BuildCustomerResult } from "./engine";

export { detectOpportunities } from "./enrichers/opportunities";
export { inferPreferences } from "./enrichers/preferences";
export { loadPaymentsOwed } from "./enrichers/payments";
export { loadWarranties } from "./enrichers/warranties";

export {
  findBestReviewers,
  findCustomersByTag,
  findCustomersOwingMoney,
  findCustomersToContact,
  findRepeatCustomers
} from "./search";

export {
  classifyCustomerQuestion,
  formatCustomerList,
  formatCustomerOverview
} from "./answer";
export type { CustomerQuestion } from "./answer";
