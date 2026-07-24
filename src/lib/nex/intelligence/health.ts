// Knowledge Health — per-trade coverage read from the SQL view.

import { supabaseAdmin } from "@/lib/supabaseAdmin";

export type HealthRow = {
  trade:            string;
  published:        number;
  official:         number;
  company:          number;
  high_confidence:  number;
  unsourced:        number;
  outdated:         number;
  categories:       number;
  avg_confidence:   number;
  last_updated:     string;
  health_pct:       number;
};

export async function readHealth(): Promise<HealthRow[]> {
  const { data, error } = await supabaseAdmin
    .from("v_nex_knowledge_health")
    .select("*")
    .order("health_pct", { ascending: true });
  if (error) return [];
  return (data as unknown as HealthRow[]) ?? [];
}
