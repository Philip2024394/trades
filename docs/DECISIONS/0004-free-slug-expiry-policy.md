# ADR-0004: 30-day free-tier slug expiry policy

Status: Accepted
Date: 2026-07-13

## Context

Free-tier signup opens the door to slug squatting — bad actors register generic slugs (`kitchens`, `electricians`, `london`, `best-plumber`) they never use, hoping to extort real merchants or resell later. Without a policy, the slug pool degrades toward "everything obvious is taken by nobody". Paid tiers already reserve slugs for life — the question is only what to do about free-tier squatting.

## Decision

Free-tier merchants keep their slug as long as they log in at least once every 30 days. After 30 days of inactivity the slug is archived (renamed to `archived-{id}`) and returned to the pool. Warning emails at 15 / 25 / 29 days. The slug policy is stated on the packages page ("your URL kept as long as you log in once every 30 days") so no merchant is surprised. Paid tiers are never affected — subscription = slug for life.

Plus a reserved-slug blocklist (~225 blocked words across system paths, trade categories, UK cities, and marketing qualifiers) prevents the worst squatting patterns at signup time.

## Consequences

- **Positive:** Genuine free-tier merchants who actually use the platform keep their slug indefinitely. Squatters get flushed automatically after a month.
- **Positive:** Even when a slug expires, the merchant can still log in and pick a new URL — no data lost, no lockout.
- **Positive:** Clear pricing lever: "want your URL for life? Upgrade to any paid tier."
- **Negative:** Merchants who genuinely disappear for a month (holiday, seasonal work) lose their slug. Warning emails should cover most of this, but edge cases exist.
- **Negative:** Requires a daily cron + email dispatch infrastructure to maintain.

## Alternatives considered

- **Free tier never gets a slug** — rejected. Kills the viral loop where every free merchant's URL is a marketing surface.
- **90-day expiry** (more forgiving) — rejected. Long enough that squatters bank slugs cheaply; short enough that genuine long-absence users still lose slugs.
- **Manual admin review before expiry** — rejected. Doesn't scale past a few dozen merchants per month.
- **Charge a one-time "premium slug" fee for generic 1-word slugs** — deferred. Could layer on later if squatting bypasses the current rules.
</parameter>
