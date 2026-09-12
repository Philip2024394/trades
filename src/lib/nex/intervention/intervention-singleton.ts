// src/lib/nex/intervention/intervention-singleton.ts

import { InMemoryInterventionStore } from "./intervention-store";

const g = globalThis as unknown as { __nex_intervention_store?: InMemoryInterventionStore };
if (!g.__nex_intervention_store) g.__nex_intervention_store = new InMemoryInterventionStore();
export const interventionStore: InMemoryInterventionStore = g.__nex_intervention_store;
