# ADR-0007: No editorial image rules

Status: Accepted
Date: 2026-07-13

## Context

Marketplace and canteen surfaces both let merchants upload product / design / hero photos. The industry-standard move for a marketplace is to enforce editorial rules — white backgrounds, minimum resolutions, single-product-per-frame — so the listing grid looks consistent. Amazon, Google Shopping and Etsy hero listings all do this to varying degrees. We considered the same for Trade Center.

The problem: our target merchant is a UK trade with a phone, a busy site, and no time for photo shoots. Every editorial rule cuts supply. Merchants who don't meet the rule either don't list, list badly and get frustrated, or route to WhatsApp (bypassing the marketplace flow we want to seed). The "clean marketplace grid" gets bought at the cost of the marketplace itself being empty.

## Decision

**No editorial rules on merchant images.** Any file that is a valid image and under the size cap ships to production. No background requirements, no "single subject" rules, no resolution minimums beyond what the client-side upload can compress, no auto-rejection. Pros will post polished shots because it converts; amateurs will post what they have. The market self-corrects on the click-through rate, not on our editorial policy.

The only gates that apply are file-hygiene, not editorial:
- Reject non-image MIME types
- Reject 0-byte or corrupt files
- Cap file size (cost control, not judgment)

## Consequences

- **Positive:** Merchants list day-one with whatever photo they have. Marketplace liquidity wins. Anti-Checkatrade positioning stays intact.
- **Positive:** Zero moderation queue for image quality. No support tickets asking "why was my image rejected". Free platform hours.
- **Positive:** Preserves an upgrade lever for The Works tier — merchants who want the polished look pay for the AI background-removal tool later. If rules force everyone to be polished, that lever disappears.
- **Negative:** The Trade Center browse grid will look visually inconsistent — some listings are studio shots, some are phone snaps. Pros will stand out (good) but the grid loses uniformity (fine — that's the tradeoff).
- **Neutral:** Some merchants will still list bad photos and wonder why they don't sell. The click-through data will teach them, not us.

## Alternatives considered

- **Enforce white backgrounds like Amazon** — rejected. Kills supply. Trades don't have photo studios.
- **Force `object-contain` inside a white card container** — considered as a compromise. Rejected because it doesn't actually solve the "consistent grid" concern (backgrounds still visible around the containment area) and adds design constraints without addressing the underlying trade-off.
- **Auto-remove backgrounds on upload via AI** — deferred to a paid tier feature (The Works) later, not as a platform default. Uses ~$0.20/image which we can't absorb on Free / Canteen / Marketplace.
- **Moderation queue with admin approval** — rejected outright. Would kill the "list in 60 seconds" flow that's a core value prop.
</parameter>
