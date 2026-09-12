// H2 fixture · caller for Invoice.
import type { Invoice } from "./invoice-schema";
export function buildInvoices(amounts: readonly number[]): Invoice[] {
  return amounts.map((amount, i) => ({ invoiceId: `inv-${i}`, amount }));
}
