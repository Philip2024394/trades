-- Xrated Trades — country code on jobs for flag display + country-weighted
-- spotlight (70% user's country, 30% other countries).

alter table public.hammerex_xrated_jobs
  add column if not exists country text not null default 'GB';

create index if not exists hammerex_xrated_jobs_country_idx
  on public.hammerex_xrated_jobs (country);
