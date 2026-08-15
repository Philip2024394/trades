// Store factory · switch between JSONL and Postgres by env or arg.
// Same interface either way (see PostgresStore doc).

import { Store as JsonlStore } from './store.mjs';
import { PostgresStore } from './store-postgres.mjs';

export async function createStore({ backend = 'jsonl', root, connectionString } = {}) {
  if (backend === 'postgres') {
    const s = new PostgresStore({ connectionString });
    return await s.init();
  }
  const s = new JsonlStore(root);
  return await s.init();
}
