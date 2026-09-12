// data/nex1-code-engine/novel-challenges-d/product-source.ts
//
// Novel-challenge fixture · Capability D generalisation · string field.

export interface Product {
  readonly id: string;
  readonly sku: string;
}

export function makeProducts(skus: readonly string[]): Product[] {
  return skus.map((sku, i) => ({
    id: `p${i}`,
    sku,
  }));
}
