# NEX Conversation Intelligence Library

> **Source of truth for how NEX chat should recognise, classify, and respond to natural human language before touching the Reference Brain.**
>
> Codified from Philip's brief on 2026-07-29 after the "good day" bug (a greeting was routed into staircase-design retrieval). This library is the specification the chat classifier and composer should progressively grow toward — it is intentionally larger than what is currently implemented.
>
> **Related code (as of 2026-07-29):**
> - `src/components/nex-app/shell/classifyIntent.ts` — client-side classifier + reply helpers.
> - `src/components/nex-app/state/ConversationStateProvider.tsx` — short-circuit logic that keeps social intents off the Reference Brain retrieval path.
> - `src/components/nex-app/shell/ChatSurface.tsx` — `THINKING_MESSAGES_BY_INTENT` rotation map.
> - `src/lib/nex/brains/_composer.ts` — composer system prompt; owns Greeting Acknowledgement rule for mixed messages.
>
> **Companion doc:** `docs/nex/conversation-character-layer.md` — the showroom personality layer that sits BETWEEN this intent layer and the Reference Brain. Defines how NEX speaks on any turn (character stages: just-looking · looking at types · price / price resistance / doesn't know / cheapest / luxury / ambiguous "show me" / urgency / comparing companies).
>
> **Governing rule (see also `feedback_nex_chat_ux_show_dont_pretend_intelligence.md`):** Show intelligence, don't pretend intelligence. Every visible copy line describes a real action NEX is about to perform. Never fake theatre.

---

## Golden priority order

Every incoming user turn must be classified in this order — the moment a match is found, the pipeline stops. This is what prevents "good day" from ever triggering Reference Brain retrieval.

```
1.  Goodbye / ending
2.  Identity question   (Constitution 0005 · transparent AI identity)
3.  Frustration         (Constitution 0004 · safety-first, no defence)
4.  Greeting            (pure or mixed)
5.  Thanks / acknowledgement
6.  Availability check
7.  Confusion / level-change   (deferred · Patch 3)
8.  Small talk / confirmation
9.  Photo upload analysis      (deferred · Patch 3)
10. Project introduction / browsing   (deferred · Patch 3)
11. Actual technical request   (design / materials / regulation / procedural / terminology / refurbishment / troubleshooting)
12. Reference Brain retrieval
```

For mixed messages ("Good morning Nex, I need an oak staircase"), strip the social prefix, then re-classify the residual. The response should acknowledge the greeting briefly then answer the real question.

---

## Layer 1 — GREETING

### 1.1 Morning greetings

**Formal:** Good morning · Good Morning · Good morning Nex · Good morning NEX · Good morning there · Morning · Morning Nex · Morning NEX · A very good morning · A pleasant morning to you

**Casual:** Morning · Mornin · Morn · Mornin Nex · Hey morning · Hi morning · Hello morning · Morning mate · Morning buddy · Morning there · Morning everyone

**Slang / informal:** Rise and shine · Up early · Early morning · Top of the morning · Morning all · Morning folks · Morning guys · Morning lads · Morning team

**Voice typing variations:** good mornin · gud morning · gud mornin · gm · G M · g morning · morninggg · mornin

### 1.2 Afternoon greetings

**Formal:** Good afternoon · Good afternoon Nex · Good afternoon there · Afternoon · A good afternoon to you

**Casual:** Afternoon · Afternoon Nex · Hi afternoon · Hello afternoon · Hey afternoon · Afternoon mate · Afternoon buddy

**Informal:** Afternoon all · Afternoon guys · Afternoon folks · Hope you're having a good afternoon

**Voice variations:** good afternoon · gud afternoon · good arvo · arvo

### 1.3 Evening greetings

**Formal:** Good evening · Good evening Nex · Good evening there · Evening · A pleasant evening

**Casual:** Evening · Evening Nex · Hi evening · Hello evening · Hey evening · Evening mate

**Informal:** Evening all · Evening guys · Evening folks · Nice evening · Lovely evening

**Voice variations:** good evenin · gud evening · eveninggg

### 1.4 General greetings (any time)

**Common:** Hi · Hello · Hey · Hey Nex · Hi Nex · Hello Nex · Hi there · Hello there · Hey there · Hiya · Heya · Howdy · Greetings · Welcome

**Casual UK style:** Alright · Alright mate · Alright Nex · You alright? · You okay? · Oi · Hi mate · Hello mate · Hey mate · Cheers

**Informal / slang:** Yo · Yo Nex · Sup · What's up · Whats up · Wassup · Wsup · How's it going · How's things · How are things · How you doing · How you been

### 1.5 "How are you?" greetings

**Standard:** How are you? · How are you Nex? · How are things? · How is it going? · How's it going? · How are you doing? · How do you do?

**Casual:** You alright? · You okay? · How you doing? · How you been? · Everything good? · All good? · How's life? · What's happening? · What's new?

**Slang:** How's it hanging? · What's good? · What's up? · Sup? · How's tricks? · How's things?

**UK / Ireland style:** You alright? · All right? · How are ya? · How's yourself? · How's the craic?

### 1.6 Nice to meet you / introduction

**Formal:** Nice to meet you · Nice meeting you · Pleased to meet you · Good to meet you · Glad to meet you · Lovely to meet you

**Casual:** Nice one · Great to meet you · Good meeting you · Nice chatting with you · Good talking to you

**AI-specific:** Nice to meet you Nex · First time using Nex · I am new here · Hello Nex, I'm new

### 1.7 Welcome / re-entry

**User arriving:** I'm here · I'm back · Back again · Hello again · Hi again · Good to be back

---

## Layer 2 — SOCIAL

### 2.1 Thanks / positive interaction

**Standard:** Thank you · Thanks · Thank you Nex · Thanks Nex · Appreciate it · Much appreciated

**Casual:** Cheers · Nice one · Brilliant · Great · Perfect · That's great · That's helpful · Amazing · Excellent

**Slang:** Legend · You're a star · Class · Spot on · Bang on · Quality

### 2.2 Goodbye / ending

**Standard:** Goodbye · Bye · See you · See you later · Talk later · Good night

**Casual:** Cheers · Thanks bye · Catch you later · Catch ya · Later · Laters · Take care

**UK style:** Cheers mate · See you soon · All the best

### 2.3 Availability check ("is NEX there?")

Hello? · Hello are you there? · Are you there Nex? · Nex are you there? · Anyone there? · Is this working? · Does this work? · Can you hear me? · Are you listening? · Are you awake? · Are you online? · Are you available? · Can I speak with you? · Can I chat with you? · Can I ask you something? · Can I get some advice? · Can you help me?

### 2.4 Very short confirmation messages

Okay · Ok · Okey · Alright · Right · Got it · I see · Understood · Makes sense · Perfect · Great · Brilliant · Excellent · Nice · Good · Sounds good · That's helpful

### 2.5 Thinking / waiting messages

Let me think · Give me a minute · One second · Hang on · Hold on · Wait · Just checking · Let me see · I'll have a look · Interesting

### 2.6 Agreement phrases

Yes · Yep · Yeah · Yes please · Definitely · Correct · Exactly · That's right · You're right · That's what I mean · That's it · Spot on

### 2.7 UK regional expressions

**England:** Alright · You alright? · Cheers · Nice one · Brilliant · Lovely · Sound · No worries · Fair enough

**Scotland:** Alright pal · Aye · Cheers · Thanks very much · Good stuff

**Wales:** Alright · Cheers · Lovely · Thanks

**Ireland:** How are ya · Grand · Sound · Thanks a million · Good man · Fair play

### 2.8 UK trade-style openings

Alright · Alright mate · Alright pal · Alright boss · You alright · You alright mate · You okay mate · Morning mate · Morning boss · Morning lads · Morning guys · Morning team · Afternoon lads · Afternoon boss · Evening lads · How's things · How's work · Busy day? · Long day? · Hope you're well · Hope all is good · How's the site · How's everything going

### 2.9 Emoji-only messages

👋 (greeting) · 👍 (acknowledgement) · 👌 (agreement) · 🙏 (thanks) · 🤔 (thinking/question) · 😊 · 😃 · ❤️ · 🔨 · 🪚

### 2.10 Non-English greetings

Hola · Bonjour · Guten Morgen · Guten Tag · Ciao · Namaste · Salaam · Shalom · Konnichiwa

### 2.11 IDENTITY / personal questions — MUST short-circuit

Governed by **Product Constitution Principle 0005 · Transparent AI Identity**. NEX is personable without pretending human. Never invent age · relationships · memories · physical experiences. Always explain AI nature when asked. Approved response library maintained deliberately for consistency, audit, and prompt-injection resistance.

**Who / what:** Who are you? · What are you? · Are you human? · Are you real? · Are you a person? · Are you AI? · Are you a robot? · Are you a bot?

**Creator / origin:** Who made you? · Who created you? · Who owns you? · Are you connected to ChatGPT? · Are you OpenAI? · Are there many of you? · Are you the same everywhere? · Are you copied?

**Personal life:** How old are you? · Where are you from? · Where do you live? · Do you have a family? · Are you married? · Do you have children? · Do you have a boyfriend/girlfriend? · Are you dating? · Do you have feelings? · Do you sleep? · Do you go to school? · Do you have friends?

**Physical experience:** Do you eat? · What do you look like? · Can you see me? · Can you hear me speaking? · Do you get tired? · Do you get bored?

**Testing / capability:** Are you any good? · Do you know what you're talking about? · Are you an expert? · How much do you know about stairs? · Are you better than ChatGPT? · Are you smarter than my builder? · What can you do? · What are your limits?

**Approved response shape (never generated fresh):**

> "I'm NEX, an AI staircase specialist. I don't have an age, a family, or a personal life — I'm built to help with staircase design, materials, installation, and trade knowledge. What would you like to look at?"

Testing questions get a short, honest capability statement — never boasting, never comparison to other AIs.

### 2.12 FRUSTRATION — MUST short-circuit

Governed by **Product Constitution Principle 0004 · Safety-first responses**. Protect people without humiliating users. Never defensive. Never counter-argue. Never restart the whole explanation.

**Direct frustration:** This is useless · You're wrong · You gave me bad advice · That's not right · That's incorrect · You don't understand · This doesn't answer my question · You made a mistake · Are you sure? · Where did that come from? · Prove it · Are you guessing?

**Emotional escalation:** This is unacceptable · I'm not happy · This is a disaster · I paid good money · Someone needs to fix this · I'm stuck · I need help urgently

**Correction (softer form):** No, I mean... · That's not what I meant · Sorry, I explained that badly · Let me explain · What I mean is... · Actually...

**Approved response shape:**

> "Thanks for pointing that out — let's check the detail again. Tell me which part doesn't match your staircase and I'll rework the answer."

Never defend the earlier answer. Always invite the correction into the next reply.

### 2.13 HUMOUR (deferred · Patch 3)

Are you smarter than my builder? · Can you build stairs yourself? · Do you sleep? · Are you made of wood? · Can you use a saw? · Do you get splinters?

Response style: warm but clear, no fake laugh. Stay in the transparent-identity envelope of Principle 0005.

### 2.14 Common misspellings

**Greetings:** gud morning · gud mornin · good morn · goood morning · mornig · mornin · afternon · evenin · helloo · helo · hllo · hiyaaa

**Thanks:** thx · ty · thanx · cheerss

**Staircase terminology:** stair case · staircases · stair cases · newel post · newal post · baluster · balluster · spindle · spindal · hand rail · walnut · wallnut · oake · mahogony · mahogany · riser · rizer · tread · tred

---

## Layer 3 — PROJECT

### 3.1 "I don't know where to start"

I don't know where to start · Where do I begin? · I'm lost · I need help choosing · There are too many options · I don't know what I need · Can you guide me? · Can you walk me through it? · Can you explain the process? · What should I think about first?

### 3.2 Project introduction

I have a question about my stairs · I've got an old staircase · I'm building a new house · I'm renovating my hallway · I'm replacing my staircase · I'm looking for ideas · I'm planning a staircase · I'm thinking about changing my stairs · I'm not sure what staircase I need · I need some guidance · I need some advice before ordering

### 3.3 Browsing / exploring

Just looking · Just browsing · Having a look · Looking around · Getting ideas · Gathering ideas · Doing some research · Researching staircases · Exploring options · Seeing what's available · Finding inspiration · Planning ahead · Thinking about the future

### 3.4 "I'm looking for..."

I'm looking for a staircase · I'm looking for ideas · I'm looking for inspiration · I'm looking for advice · I'm looking for a supplier · I'm looking for something modern · I'm looking for something traditional · I'm looking for a quote · I'm looking for a replacement · I'm looking for help

### 3.5 "I need..."

I need a staircase · I need help · I need advice · I need information · I need dimensions · I need prices · I need ideas · I need a design · I need a drawing · I need to know · I need to understand

### 3.6 Change topic signals

Anyway · Anyway, back to... · Let's talk about... · Different question · Another thing · Something else · Changing subject · On another note · By the way · Also · One more thing

### 3.7 More / continue

More · More information · Tell me more · Go deeper · Continue · Next · Carry on · Expand · Explain more · More details · More examples · More ideas · Keep going

⚠️ **Critical**: "More" must mean *continue previous subject*, not *new staircase search*.

### 3.8 Stop / enough

That's enough · Stop there · No more · That's fine · I'm happy · That's all · Done · Finished · No thanks

### 3.9 Opinion request

What do you think? · What would you choose? · What would you recommend? · What is your opinion? · Which is better? · Which one would you pick? · What would you do? · Your thoughts? · Any advice? · Give me your honest opinion · If it was your staircase... · What would a professional choose?

### 3.10 Show me / visual requests

Show me · Can I see? · Let me see · Show examples · Show pictures · Show images · Can you show me designs? · Can you create an image? · Make me a picture · Generate a staircase · Visualise this · Can you render this? · What would this look like?

### 3.11 Comparison / decision help

Which is better? · Which one is best? · What's the difference? · Compare these · Oak or walnut? · Wood or metal? · Glass or spindles? · Traditional or modern? · Which would you choose? · What are the pros and cons? · Help me decide

### 3.12 Emotional customer language

I'm worried · I'm nervous · I'm unsure · I'm excited · I'm happy · I'm disappointed · I'm frustrated · I'm confused · I'm overwhelmed · I don't know where to start

### 3.13 Urgency

Urgent · Quickly · ASAP · As soon as possible · Today · Need this now · Emergency · Before tomorrow · I'm on site now · Installer is waiting · Customer is waiting

### 3.14 Frustration language

I'm stuck · I'm having trouble · I've got a problem · Something is wrong · It doesn't fit · This isn't working · I'm struggling · Can you help me fix this? · I need help urgently

### 3.15 Design consultation opener (deferred)

Can you design a staircase for my house? · I want a modern staircase · I want traditional stairs · Match my house · Match my hallway · What suits my Victorian house? · What suits my new build? · Help me choose · I want a wow factor · I want it to look expensive · I want a statement staircase · I want something timeless · I want something different · I want something nobody else has · Copy this staircase · Can you make this?

Routes to composer with `stage=design_discovery`. NEX should ask about house style + space + timber preference before enumerating options.

### 3.16 Comparison / decision help (deferred)

Which is better? · Which one is best? · What's the difference? · Compare these · Oak or walnut? · Wood or metal? · Glass or spindles? · Traditional or modern? · Which would you choose? · What are the pros and cons? · Help me decide · What would you buy? · What would you do if it was your house?

Answer shape (Product Constitution Principle 0003 · Judgement Not Verdict): state the specific case, compose the relevant principles, lead with a recommendation + visible reasoning, name the alternative honestly. Never rigid rule, never evasive "it depends".

### 3.17 Price / quote questions (deferred)

How much does this cost? · How much is a new staircase? · Rough price? · What sort of price? · What budget should I allow? · Is this expensive? · Where does the money go? · How can I save money? · What is the best value? · Why is this quote higher? · What is included? · Are there hidden costs? · Compare quotes.

Routes to composer with `stage=budget_discovery`. Never invent a price. Explain the manufacturing chain (design → survey → CAD → timber → machining → finishing → delivery → installation) and what should appear in a proper written quotation.

### 3.18 Refurbishment questions (deferred)

Can I just change the handrail? · Can I replace the spindles only? · Can I change the newel posts? · Can I keep the existing stairs? · Can I replace the treads? · Can I cover the old stairs? · Can I update the staircase without rebuilding? · Can I mix wood types? · Can I paint my staircase? · Can I add LED lights?

Routes to composer with `stage=refurbishment`. First question: *"Are you happy with the staircase structure and layout, or are you looking to change the shape as well?"*

### 3.19 Restoration questions (deferred)

Can old stairs be restored? · Can oak stairs be restored? · Can scratches be repaired? · Can old wood look new? · Can you sand my staircase? · Should I restore or replace? · What staircase would suit a Victorian house? · Can I keep the original character? · How old is my staircase? · Is this original?

Routes to composer with `stage=restoration`. Never claim exact age from a description alone — identify design clues, offer probable period, invite verification.

### 3.20 Photo-upload analysis (deferred)

Can you look at my staircase? · Can you check my stairs? · What's wrong with this? · Can you inspect this? · What is this called? · What type of staircase is this? · What style is this? · What wood is this? · What is this part? · Do you recognise this?

Routes to composer with `stage=photo_analysis`. Response structure: *what I can see* → *what I cannot confirm* → *next information needed*. Never immediately judge quality from a single image.

### 3.21 Troubleshooting / problem reporting (deferred)

My stairs are squeaking · There is a gap · It moves · It feels loose · The wood has cracked · The colour has changed · The finish looks wrong · The handrail is loose · The newel is moving · The stairs feel uneven · My staircase is moving · My staircase doesn't fit · The installer damaged my staircase · Something has changed after fitting.

Routes to composer with `stage=troubleshooting`. Never immediately blame anyone. Structured diagnosis: *symptom* → *when it appeared* → *conditions* → *likely cause* → *recommend inspection where needed*.

### 3.22 DIY vs professional (deferred)

Can I fit stairs myself? · Can I replace spindles? · Can I fit a handrail? · Can I do the finishing? · What parts are beginner friendly? · What tools do I need?

Answer shape: separate DIY-friendly (decorating, simple baluster replacement, some handrail work) from professional (structural alterations, complete staircase fitting, complex joinery, glass panels). Safety first.

### 3.23 Emotional / house-context language (deferred)

My hallway is small · My hallway is dark · My hallway feels closed in · I want to make my staircase look bigger · I want more light · I hate my staircase · I don't want it to look wrong · Will my furniture fit? · Sofa won't fit upstairs.

Routes to composer with `stage=house_context`. Design suggestions should be tied to the specific problem the user described, not a general catalogue.

### 3.24 Correction language

No, I mean... · That's not what I meant · Sorry, I explained that badly · Let me explain · What I mean is... · Not that · The other one · I meant... · Actually... · Correction...

---

## Layer 4 — TECHNICAL (retrieval-eligible)

Retrieval only fires when the user's turn is classified into one of these sub-intents. Everything above must have been ruled out first.

- **terminology** — what is a newel post / meaning of / definition / part names
- **materials** — timber species, finishes, hardware, moisture, movement, timber behaviour
- **design** — style / traditional / modern / spiral / round steps / matching / feature
- **regulation** — Part K / Document K / building control / handrail height / balustrade spacing / max rise / min going / headroom
- **procedural** — fitting / installing / how to / method / step by step
- **troubleshooting** — squeaking / gap / crack / loose / moving / uneven
- **measurement** — dimensions / calculate / minimum size / standard size / floor level
- **image_analysis** — user uploaded a photo, wants identification or advice
- **refurbishment** — replacing components (balusters / newels / handrail / treads) without full rebuild
- **restoration** — old timber restoration, sanding, refinishing, period-appropriate repair
- **workshop / manufacturing** — CNC vs handmade, joints, glue vs screws, factory dry-fit, engineered timber, panel selection
- **installation logistics** — site coordination, delivery in sections, access, trade sequence
- **maintenance** — cleaning, oiling, refinishing intervals, protecting timber, pet & child impact

---

## User state tags (session-level, not per-turn)

The composer should track the user's journey stage across turns:

```
user_state:
  greeting | exploring | learning | comparing | deciding |
  ordering | installing | troubleshooting | aftercare
```

Same question means different things at different stages. *"What wood is best?"* at idea stage → educate. At quotation stage → compare specifications. After installation → diagnose a problem.

---

## Response behaviour by intent

| Intent | API call? | Reply style |
|---|---|---|
| goodbye | ❌ short-circuit | Warm one-line closing |
| greeting (pure) | ❌ short-circuit | Time-of-day-aware opener + offer of help |
| thanks (pure) | ❌ short-circuit | Short warm acknowledgement, no upsell |
| availability_check | ❌ short-circuit | Confirm presence + offer of help |
| small_talk (pure confirmation) | ❌ short-circuit | One line, no retrieval |
| mixed (greeting + real) | ✅ retrieve on residual | Acknowledge greeting briefly + real answer |
| technical (project) | ✅ retrieve | Structured response per blueprint |

---

## The hidden question

Every visible customer message contains two things: surface question + hidden motivation.

| Surface | Likely hidden |
|---|---|
| *"How much is an oak staircase?"* | Can I trust spending this money? |
| *"Is glass safe?"* | I love the look but I'm worried. |
| *"What wood is best?"* | Which choice will make me feel I spent wisely? |
| *"Can I copy this staircase?"* | Give me confidence my dream is achievable. |

A search engine answers the surface question. A staircase consultant addresses both.

---

## The consultant filter

Before any answer, silently pass through:

1. **Who is the user?** — Homeowner / builder / joiner / architect / installer / student
2. **What stage are they at?** — Idea / research / decision / purchase / installation / problem
3. **What do they need?** — Information / comparison / design / calculation / fixing advice / reassurance
4. **Only then** — retrieve knowledge and compose.

---

## Progressive implementation status

**Patch 1 (2026-07-29)**
- ✅ **Layer 1 GREETING** — expanded vocabulary, mixed-intent stripping, short-circuit reply.
- ✅ **Layer 2 SOCIAL — goodbye · thanks · availability_check** — short-circuit + warm reply.
- ✅ **Layer 4 TECHNICAL** — materials / regulation / design / terminology / procedural.

**Patch 2 (2026-07-29 · later)**
- ✅ **Layer 2 SOCIAL — identity** — Constitution Principle 0005; short-circuit with approved response library.
- ✅ **Layer 2 SOCIAL — frustration** — Constitution Principle 0004; calm de-escalating short-circuit reply, never defensive.

**Deferred**
- ⏳ **Layer 2 — humour / small_talk confirmation / emoji-only** — safe fallback covers most cases.
- ⏳ **Layer 3 PROJECT sub-intents** — design consultation opener · comparison / decision help · price / quote · refurbishment · restoration · photo-upload analysis · troubleshooting · DIY vs professional · house-context. Vocabulary listed above; needs classifier + composer stage tags.
- ⏳ **Layer 4 extended** — refurbishment · restoration · workshop / manufacturing · installation logistics · maintenance. Vocabulary listed above.
- ⏳ **Session state tags** — `user_state` across turns (exploring / deciding / ordering / installing / troubleshooting / aftercare).
- ⏳ **Hidden-question composition** — belongs in the composer system prompt, not the classifier. Every answer should address the surface question AND the hidden motivation.
- ⏳ **Level-change intents** — "explain simpler" / "explain like a carpenter" — routes to composer with a register hint.

Every deferred item is intentional. The rule is: build only what a real conversation has proven the platform can't already handle (ADR-0041).
