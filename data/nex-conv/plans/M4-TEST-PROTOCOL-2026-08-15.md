# M4 · NEX Blind User Test · Protocol

**Date:** 2026-08-15
**Status:** Ready to run · architecture FROZEN until M4 results ship
**Owner:** Philip
**Target:** 12-15 real potential Summit customers · £30 Amazon voucher each

## Why we are doing this test

We have built NEX to the point where every internal probe says it works: 15/15 regression, 5/5 Phase A, 19/19 Phase B, zero fabrications on the head-to-head 30-turn. But that is not evidence a real customer would find the experience useful. This test answers **the question that internal probes cannot**:

> When a normal potential customer talks to NEX without being told what it is, does the conversation feel useful, correct, trustworthy, and worth continuing?

**Philip's design note (locked, 2026-08-15):**
> "Don't obsess over <30% AI detection as the only success criterion. A customer can know it's AI and still love it. Measure usefulness, correctness, conversation quality, trust, and business outcome alongside AI detection."

The 5 dimensions we measure are equal-weight. AI detection is one input, not the verdict.

## Recruitment

### Who we want
- Real UK homeowners / renovators / first-time buyers who are actually thinking about a staircase (or would credibly imagine themselves as such)
- No prior involvement with the Summit business
- No prior knowledge that this is an AI test
- Mix of ages / tech comfort levels
- 12-15 participants total (statistically thin but sufficient to catch major issues)

### Where to find them
- Facebook groups (local renovation / diyuk / house-doing-up)
- Local marketing groups
- Neighbours you know are renovating
- Nextdoor
- One thing to AVOID: recruiting from your own tech / dev network — they behave too differently

### The recruitment message

Copy-paste this. Do NOT mention AI, chatbot, or model. The word to use is "assistant" (which is technically true and does not tip them off).

> Looking for 12-15 people to give us feedback on Summit's new online staircase advisor. 20-minute session · we'll ask you to talk to it about a staircase project you're either doing or would consider, then answer a few short questions. £30 Amazon voucher for your time. Reply / DM if interested.

If asked "is it a person or a bot?" — answer honestly: *"It's an assistant · you'll tell us in the questionnaire whether you felt it was a person, a bot, or a mix. That's part of what we're measuring."*

### Screening (30 seconds per candidate)
- Are you 18+? (must be)
- Have you ever done any development work with AI / chatbots / language models? (should be NO · these participants are different)
- Are you renovating, building, or would you plausibly consider a new staircase in the next 24 months? (should be YES · genuine interest matters)

## Session flow (20 minutes per participant)

### 0-2 min · Welcome + consent
- Thank them for coming
- Explain: "20 minutes total · you'll spend 12-15 minutes chatting with the assistant · then 5 minutes answering a short questionnaire · then we're done and you get the voucher."
- Consent: "We'll record the conversation for our records. Nothing you say will be shared beyond our team. OK?"

### 2-14 min · The conversation (12 minutes · they set the pace)
- Point them at the URL: `http://<your-machine>:3008/nex-app/design-catalogue/staircase/master-template-1/chat`
  (Or your public URL if you've exposed it via ngrok/similar for the test — but only ever expose it read-only to test participants, never open port 3008 to the public.)
- Give them the prompt: **"You've decided to think about your staircase. Talk to Summit's assistant like you would if you'd found this on their real website. Ask whatever comes into your head. Take as much time as you want."**
- Then STAY QUIET. Do not coach. Do not answer their questions on the assistant's behalf. If they ask "what should I say?", reply "whatever you'd say if you'd found this on the actual site."
- Note anything visible on their face: frustration, confusion, delight, boredom. These matter as much as their words.

### 14-19 min · The 15-question survey
- Send them to `http://<your-machine>:3008/nex-app/nex-brain/m4-survey/<conversation_id>`
  (Get the conversation_id from `localStorage.getItem('nex-conv-id-mt1')` in their browser DevTools console, OR from the admin conversations page as the most recent one during their session.)
- Let them fill it in privately (turn away or leave the room briefly)
- If they get stuck on a question, tell them "answer whatever feels most true — there is no right answer"

### 19-20 min · Debrief + voucher
- Ask ONE open question: *"Is there anything you want to tell us that the questions didn't cover?"*
- Note down anything they say
- Give them the voucher · thank them

### Moderator's notebook · during the session
Write down (per participant):
- Age band (18-30 / 30-45 / 45-60 / 60+)
- Tech comfort self-assessed (low / medium / high)
- Any visible emotion during the conversation (specific moments)
- Whether they asked you (moderator) any question rather than the assistant
- Whether they ever paused and reread a NEX reply — how long
- Whether they ever laughed / smiled / frowned / said "hmm" out loud
- **Unprompted follow-up count** — how many times did they ask a second question without being coached? (Philip 2026-08-15 · the strongest naturalness signal we have. If they say "I'm looking for oak" → NEX replies → and they *independently* ask "what would that cost?" then "could you do glass balustrades?" — that's a real conversation. Target: ≥3 unprompted follow-ups per session. Below 1 is a red flag regardless of survey scores.)
- Final one-liner impression when they finish

## The 15 survey questions (5 dimensions · equal weight)

The survey UI at `/nex-app/nex-brain/m4-survey/<id>` implements these. Displayed in order below for reference.

### Dimension 1 · AI detection (3 questions)
1. **Who do you think you were talking to?** (Person / AI / A mix of both / Not sure)
2. **How confident are you in that answer?** (1 = guessing · 5 = certain)
3. **What made you think that?** (free text · required)

### Dimension 2 · Usefulness (3 questions)
4. **Did the conversation help you understand your staircase options?** (1 = not at all · 5 = very much)
5. **Did you reach a useful outcome?** (Yes / Partial / No)
6. **Would you use this again if you were making a similar decision?** (Yes / Maybe / No)

### Dimension 3 · Correctness / Trust (2 questions)
7. **Did you trust the answers you were given?** (1 = not at all · 5 = fully)
8. **Did you spot anything you thought was wrong?** (Yes / No · if yes: free text describing what)

### Dimension 4 · Conversation quality (4 questions)
9. **Did the assistant understand what you were asking?** (1 = never · 5 = always)
10. **Did the assistant ever repeat itself or feel formulaic?** (Yes / No)
11. **Did the assistant ever misunderstand you?** (Yes / No · if yes: free text)
12. **Did you feel frustrated at any point?** (Yes / No · if yes: free text)

### Dimension 5 · Business outcome (3 questions)
13. **How likely would you be to recommend Summit based on this?** (0-10 NPS scale)
14. **Would you proceed to a real enquiry, call, or visit?** (Yes / Maybe / No)
15. **Anything else you'd like to tell us?** (free text · optional)

## Success gates (5-dimensional · Philip 2026-08-15)

We are looking for green across ALL FIVE dimensions, not a single hero metric.

| Dimension | Green threshold | Amber | Red |
|---|---|---|---|
| **AI detection** | Any mix of Person / AI / Both / Unsure is fine · what matters is Q3 free-text NOT mentioning "clear AI tells" (repetitive · avoided the question · invented a price · formulaic) | Some free-text mentions AI-tell criticism but the tone stays warm | Multiple participants call out concrete AI failures (repetition, fabrication, dodging) |
| **Usefulness** | ≥70% score Q4 as 4 or 5 · ≥70% Q5 answer Yes or Partial · ≥60% Q6 answer Yes or Maybe | 50-70% on these | <50% on these |
| **Correctness / trust** | ≥70% score Q7 as 4 or 5 · <20% report factual errors in Q8 | 50-70% trust · 20-40% errors | <50% trust or >40% errors |
| **Conversation quality** | ≥70% score Q9 as 4 or 5 · <30% report Yes on repetition / misunderstanding / frustration | 50-70% understanding · 30-50% report an issue | <50% or >50% |
| **Business outcome** | NPS ≥ +20 · ≥60% Q14 answer Yes or Maybe | NPS 0 to +20 · 40-60% Q14 positive | NPS < 0 or <40% Q14 positive |

**Green on all 5 = ship pilot to real Summit customers · call this "M4 pass".**
**Red on any 1 = fix + re-run.**
**Amber mix = judgement call · discuss the specifics · likely a targeted fix on the amber dimension only.**

## What happens after the test

- **Green across all 5:** move to "first paying pilot customer" work (out of scope of this plan · Summit or equivalent)
- **Amber on one dimension:** targeted fix (e.g. more corpus if usefulness is low; more terminology hardening if correctness is amber; more prompt work if conversation quality is amber)
- **Red anywhere:** stop, investigate, fix, re-run M4 with a fresh cohort (do not re-run with the same participants — they will have learned the tells)

## What we deliberately do NOT include in this test

- Automated recruitment
- Voucher payment integration
- Cross-conversation attribution
- Ongoing tracking (this is a one-shot session per participant)
- Any deployment of NEX beyond your local dev machine (test uses local only · MT-1 chat at localhost:3008)

## Data + storage

Survey responses are written to `nex.conv_outcomes` (existing table · no migration):
- `conversation_id` = the MT-1 chat's uuid
- `outcome` = one of the existing enum (mapped from Q5: Yes → 'resolved' · Partial → 'clarification_completed' · No → 'user_abandoned')
- `outcome_note` = full JSON payload of all 15 answers + moderator's notes
- `labelled_by` = 'admin' (since you or a Summit team member facilitates)

Results dashboard at `/nex-app/nex-brain/m4-results` aggregates + drill-down.

## Repo location

- This document: `data/nex-conv/plans/M4-TEST-PROTOCOL-2026-08-15.md`
- Survey UI: `src/app/nex-app/nex-brain/m4-survey/[conversation_id]/page.tsx`
- Results dashboard: `src/app/nex-app/nex-brain/m4-results/page.tsx`
- Survey API: `src/app/api/nex-conv/survey/route.ts`

## Architecture freeze

Standing rule (Philip 2026-08-15): **no new pipeline / conversation-quality / brain features ship until M4 results are in and reviewed.** Bug fixes and UI polish are fine · new capabilities are not. This forces us to actually test the thing we've built rather than shifting the target.

The car is built. Time to drive it.
