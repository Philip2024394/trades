import { readFileSync } from "node:fs";
import { createClient } from "@supabase/supabase-js";
const envText = readFileSync("C:\\Users\\Victus\\trades\\.env.local", "utf-8");
function e(name) { return envText.match(new RegExp(`^${name}=(.+)$`, "m"))[1].trim().replace(/^["']|["']$/g, ""); }
const sb = createClient(e("NEXT_PUBLIC_SUPABASE_URL"), e("SUPABASE_SERVICE_ROLE_KEY"), { auth: { persistSession: false } });

const { data: businesses } = await sb.from("business_brain_businesses").select("id, name, primary_domain");
console.log("Businesses:", businesses);

const { data: brains } = await sb.from("business_brains").select("id, business_id, status, sync_frequency, next_sync_due_at");
console.log("Brains:", brains);
