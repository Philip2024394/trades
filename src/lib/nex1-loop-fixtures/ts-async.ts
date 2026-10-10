// FIXTURE · async / Promise.
export interface Row { readonly data: number; }
export async function fetchRow(id: number): Promise<Row> {
  const data = 42;
  return { data };
}
