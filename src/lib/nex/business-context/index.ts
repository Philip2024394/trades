// NEX Business Context · barrel export (Philip 2026-08-14).

export type { CustomerBusinessIdentity, OwnerBusinessIdentity, BusinessRecord, NexRole, NexSession } from "./types";
export { registerBusiness, getBusiness, listBusinesses, toCustomerIdentity, toOwnerIdentity, _resetRegistryForTest } from "./registry";
export { readSession, encodeSession } from "./session";
export { assertPermission, permissionErrorResponse } from "./permissions";
export { ensureSeeded } from "./seed";
