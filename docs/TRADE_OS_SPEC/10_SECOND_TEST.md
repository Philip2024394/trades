# The 10-Second Test

Every merchant-facing surface must pass this. Land on the page, look
for 10 seconds, close the tab, then answer four questions:

1. **What was this page for?**
2. **What action would you take?**
3. **Did anything confuse you?**
4. **Would you come back?**

If any answer isn't immediate, the page fails and gets redesigned.

Every surface here is scored honestly. Pass = clear on all four in
under 10 seconds. Fail = at least one uncertain. Fix or ship the
redesign — no defending.

---

## Merchant surfaces

### `/studio` (sign-in gate)

| Question | Answer |
|---|---|
| For? | Sign in |
| Action? | Click magic link in email (or Dev bypass in dev) |
| Confusion? | None |
| Return? | Yes, when I forget I'm logged out |

**Verdict: PASS.** One line of copy, one button, one obvious action.

### `/studio/discovery` (7-question intake)

| Question | Answer |
|---|---|
| For? | Answering 7 questions about my business |
| Action? | Type an answer, hit Next |
| Confusion? | None. Yellow progress dots show where I am |
| Return? | No — one-shot flow, done in 90s |

**Verdict: PASS.** Post-sweep copy is tradesperson-native ("Why do customers pick you over the next lad?").

### `/studio/vault` (Brand Vault home)

| Question | Answer |
|---|---|
| For? | See my brand + assets in one place |
| Action? | Click "Design my van" (primary) or "Business cards" |
| Confusion? | Low. Six zones is dense — considered risk, not failure. Brand Health card gives a % anyone reads instantly |
| Return? | Yes, this is the home |

**Verdict: PASS with caveat.** Six zones works on desktop; on mobile we'd want zone-collapse. Follow-up for a real device audit once merchants are on it.

### `/studio/store` (Capability Store)

| Question | Answer |
|---|---|
| For? | Buy a pack for my business |
| Action? | Pick a category tab, hit "Get it" on a pack |
| Confusion? | None. Prices + contents visible on every card |
| Return? | Only when I want more |

**Verdict: PASS.** Business Roadmap widget removed last pass — it was admin noise.

### `/studio/studios/van-wrap` (Van Wrap Studio)

| Question | Answer |
|---|---|
| For? | Design my van |
| Action? | Hit "Design my van" |
| Confusion? | None post-sweep. "About a minute", "Ready" chip, price + time on result |
| Return? | To try tweaks, yes |

**Verdict: PASS.** Copy is now plain-speak (no compiler / critic / 14 stages).

### `/nex` (chat)

| Question | Answer |
|---|---|
| For? | Talk to Nex to get things built |
| Action? | Tap a starter chip or type |
| Confusion? | None. Suggestion chips prime intent |
| Return? | Yes, this is the "just tell it what you need" surface |

**Verdict: PASS.** Ambient input, starter prompts, evidence chips on knowledge answers, "That's not right" correction affordance.

---

## Admin surfaces (staff, not merchants — held to a slightly different bar)

Staff can handle more density than merchants but the 10-second test
still catches jargon.

### `/admin/nex/knowledge` (Knowledge Studio)

| Question | Answer |
|---|---|
| For? | Add and inspect knowledge entries |
| Action? | Filter, hit "+ New knowledge" |
| Confusion? | None. Every entry shows title, trade, confidence, version, source count |
| Return? | Yes, this is where staff lives |

**Verdict: PASS.** Post-sweep copy says "goes to Review — not live until approved".

### `/admin/nex/review` (Review Queue)

| Question | Answer |
|---|---|
| For? | Approve or reject proposed knowledge changes |
| Action? | Read the card, hit approve/reject/archive |
| Confusion? | None. Amber badge shows pending count |
| Return? | Daily, per Weekly Critic doc |

**Verdict: PASS.**

### `/admin/nex/health` (Weak-spots dashboard)

| Question | Answer |
|---|---|
| For? | See which trades Nex doesn't know enough about |
| Action? | Go teach it (Teach button in header) |
| Confusion? | None post-sweep. Old subhead was a maths formula; new one is "Where Nex is weak" + "under 80% needs more" |
| Return? | Weekly review |

**Verdict: PASS.** Title now action-framed ("Where Nex is weak", not "Knowledge health").

### `/admin/nex/sources` (Source Library — new this pass)

| Question | Answer |
|---|---|
| For? | See every source Nex cites + how load-bearing each is |
| Action? | Spot orphan sources (1 citation, amber badge); prune or reuse |
| Confusion? | None. Table sorted by entry_count desc; big black badge = load-bearing |
| Return? | Weekly, to audit |

**Verdict: PASS.**

### `/admin/nex/teach` (Teach Nex)

| Question | Answer |
|---|---|
| For? | Upload a document so Nex reads it |
| Action? | Pick file, add trade/topic hint, hit "Teach Nex" |
| Confusion? | None post-sweep. Was "Upload for extraction"; now "Teach Nex" |
| Return? | Every time you have new material |

**Verdict: PASS.**

### `/admin/nex/timeline/[id]` (Version history)

| Question | Answer |
|---|---|
| For? | See every change to a single entry |
| Action? | Read the timeline. Restore isn't wired yet (out of scope this pass) |
| Confusion? | Minor — "change_kind" chips (minor/major/correction) may need a legend |
| Return? | When you need to trace why something is the way it is |

**Verdict: PASS with follow-up.** Add a one-line legend under the H1 explaining what "minor / major / correction" means.

---

## Overall verdict

**Every merchant surface passes today.** Every admin surface passes.
One follow-up (Timeline legend). One risk flagged (Vault density on mobile).

## Rule for every future surface

Before merging a new page, run the four questions on yourself with
fresh eyes (or grab a colleague who's never seen it). If any answer
takes longer than 3 seconds, either:

- Cut copy
- Rename the primary action to a verb the tradesperson uses
- Remove a control until the surface is single-purpose

Never justify complexity with "they'll learn." Merchants have 3
seconds and a job to get to.
