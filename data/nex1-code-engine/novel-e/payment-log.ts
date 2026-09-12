// data/nex1-code-engine/novel-e/payment-log.ts
import type { Payment } from "./schema";
export function ledgerize(currencies: readonly string[]): Payment[] {
  return currencies.map((currency, i) => ({ transactionId: `t${i}`, currency }));
}
