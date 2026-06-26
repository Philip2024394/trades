-- Xrated Trades — premium mini-app tier on top of the Trade Off directory.
-- Adds: per-tradie theme + hero text + CTA effects + avatar frame for the
-- premium "app" tier, plus the 30-day trial → paid lifecycle.

alter table public.hammerex_trade_off_listings
  add column if not exists theme_color text not null default '#F97316',
  add column if not exists button_text_color text not null default '#FFFFFF',
  add column if not exists cta_button_effect text not null default 'none'
    check (cta_button_effect in ('none','pulse','glow','shake')),
  add column if not exists hero_text_line1 text,
  add column if not exists hero_text_line2 text,
  add column if not exists hero_text_line2_color text,
  add column if not exists hero_text_tagline text,
  add column if not exists hero_text_effect text not null default 'none'
    check (hero_text_effect in ('none','shimmer','dance','underline')),
  add column if not exists avatar_frame_style text not null default 'none'
    check (avatar_frame_style in ('none','ring','pulse','dance')),
  add column if not exists profile_placement text not null default 'center'
    check (profile_placement in ('center','top-left','bottom-left')),
  add column if not exists accepting_jobs boolean not null default true,
  add column if not exists tier text not null default 'standard'
    check (tier in ('standard','app_trial','app_paid','app_expired')),
  add column if not exists trial_started_at timestamptz,
  add column if not exists trial_expires_at timestamptz,
  add column if not exists running_marquee text;

create index if not exists hammerex_trade_off_listings_tier_idx
  on public.hammerex_trade_off_listings (tier);
create index if not exists hammerex_trade_off_listings_trial_expires_idx
  on public.hammerex_trade_off_listings (trial_expires_at)
  where tier = 'app_trial';
