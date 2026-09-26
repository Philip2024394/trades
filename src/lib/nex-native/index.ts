// src/lib/nex-native/index.ts
//
// NEX-native barrel · single import surface for the 6-service foundation.
// Every downstream caller imports from here · never reaches past this
// module into the individual service files (so future refactors stay
// contained).

export { nexSupabaseAdmin, nexSupabaseProjectRef } from "./supabase-admin";
export * from "./types";
export * as accountService from "./account-service";
export * as businessService from "./business-service";
export * as productService from "./product-service";
export * as conversationService from "./conversation-service";
export * as orderService from "./order-service";
export * as ledgerService from "./ledger-service";
