import { readFileSync } from "node:fs";
const envText = readFileSync("C:\\Users\\Victus\\hammer\\.env.tools.local", "utf-8");
const token = envText.match(/^SUPABASE_ACCESS_TOKEN=(.+)$/m)[1].trim();
const ref = "msdonkkechxzgagyguoe";

async function q(sql) {
  const r = await fetch(`https://api.supabase.com/v1/projects/${ref}/database/query`, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: JSON.stringify({ query: sql })
  });
  const txt = await r.text();
  if (!r.ok) throw new Error(`Supabase ${r.status}: ${txt}`);
  return txt;
}

const sql = `
CREATE TABLE IF NOT EXISTS public.hammerex_plant_hire_applications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  listing_id UUID NOT NULL,
  reference TEXT UNIQUE,
  role_slugs TEXT[] NOT NULL,
  applicant_name TEXT NOT NULL,
  applicant_email TEXT,
  applicant_phone TEXT NOT NULL,
  applicant_age INT,
  applicant_postcode TEXT,
  applicant_city TEXT,
  right_to_work TEXT,
  driving_licence_classes TEXT[],
  cpc_expiry DATE,
  has_digitacho BOOLEAN,
  qualifications_note TEXT,
  years_experience INT,
  experience JSONB DEFAULT '[]'::jsonb,
  notice_period TEXT,
  salary_expectation TEXT,
  available_from DATE,
  work_pattern TEXT,
  cv_url TEXT,
  cover_note TEXT,
  status TEXT NOT NULL DEFAULT 'new',
  metadata JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_plant_applications_listing_id ON public.hammerex_plant_hire_applications (listing_id);
CREATE INDEX IF NOT EXISTS idx_plant_applications_phone ON public.hammerex_plant_hire_applications (applicant_phone);
CREATE INDEX IF NOT EXISTS idx_plant_applications_created_at ON public.hammerex_plant_hire_applications (created_at DESC);
`;

console.log(await q(sql));
