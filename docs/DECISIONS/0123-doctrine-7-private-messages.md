# ADR-0123 · Founder Doctrine #7 · Private Messages

**Status:** IMMUTABLE · **Date:** 2026-09-10 · **Author:** Founder + Master AI Engineer

## The rule

> **Messages between NEX users — listing chat, friends chat, direct messages — are PRIVATE.**
> **NEX never uses them to train, embed, or otherwise learn from.**
> **They never leave the two-party envelope without owner + user consent.**

## Why

WhatsApp deep-links were dropped from the NEX Directory. Every listing conversation is now a NEX-native chat channel. That gives NEX a data set — messages between visitors and business owners — that no frontier competitor holds.

Left ungoverned, that data set becomes a temptation: train a better model, embed for RAG, surface "similar conversations." All of those would break the trust NEX made with users the moment it accepted the message.

Doctrine #7 makes the wall permanent at the code layer, not the marketing page.

## What this doctrine forbids

- Ingesting `nex.listing_message` or friends-chat message rows into ANY training / embedding / RAG pipeline
- Surfacing message contents to third parties, including owner-marketing tooling
- Using message content as evidence for public claims about a listing
- Cross-user aggregation ("83% of visitors ask about parking") — this counts as leakage even without names
- Automated summarisation across threads for any purpose other than the two parties involved

## What Doctrine #7 permits

- Persisting messages for the two parties to read on their own devices
- Delivering owner-invite emails that quote **only the first message the visitor sent to that owner** — this is the visitor's clearly-intended outbound content
- Aggregate metrics that carry no message content: message count, response time, thread age
- Sender-side "recall" — a user reading their own message history

## Composition with existing doctrines

| Doctrine | Rule | Relation to #7 |
|---|---|---|
| #1 LLM rescue never bypasses Truth Engine | Model-generated content is provisional | Messages are never model-generated; orthogonal |
| #2 LLM never executes action without NEX auth | Model cannot invoke tools autonomously | Model cannot read message rows; orthogonal |
| #3 Vision/file/web capped at evidence_provisional | Provisional never becomes verified | Messages are NOT evidence at all — stronger than #3 |
| #4 Memory informs context, does not establish truth | Memory never becomes evidence | User memory + friend messages have distinct storage; message content NEVER enters user memory |
| #5 Untrusted content never becomes instructions | Injection defence | Messages pass through sanitiser before storage AND before display |
| #6 Truth or Unconfirmed | Claims must be labeled | Message content is neither claim nor evidence; labeler skipped for chat but applies to any assistant help thread |
| **#7 Private Messages** | **Two-party envelope · never train** | **Overrides ALL uses of message rows except delivery to the two parties** |

## Where this doctrine lives in code

- `nex.listing_message.body` and `nex.friends_message.body` carry a hard write-side comment forbidding training pipelines
- Any code path that queries these tables MUST scope by `(from_user_id OR to_owner_ref)` — global scans are architecturally impossible without a Founder override
- CI grep gate: `grep -R "listing_message\|friends_message" src/lib/nex/{brain,retrieval,embedding,training}` must return zero matches
- Every export or migration touching these tables carries a `-- DOCTRINE #7 · PRIVATE MESSAGES` header comment

## Measurable acceptance

- `scripts/smoke-listing-chat.mjs` proves:
  - Sending a message stores it visible only to sender + owner
  - No brain / retrieval / embedding code path can read the table (verified via file-level grep)
  - Owner-invite email quotes only the first inbound message (never subsequent messages, never other users' messages)

## Immutability

This ADR is IMMUTABLE. No product surface, marketing push, engagement metric, or model-quality argument can weaken it. If Doctrine #7 conflicts with a proposed feature, the feature is rejected — not the doctrine.
