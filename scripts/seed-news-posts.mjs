// One-shot seeder for the Newsroom. Inserts 6 launch posts into
// hammerex_xrated_news_posts and creates a matching admin announcement
// in The Yard for each one so members can react + comment.
//
// Idempotent: ON CONFLICT(slug) DO UPDATE so re-running refreshes the
// body / excerpt without duplicating. Yard cross-posts use the
// news_post_id metadata as the dedupe key.

import { readFileSync } from "node:fs";

const envText = readFileSync(
  "C:\\Users\\Victus\\hammer\\.env.tools.local",
  "utf-8"
);
const tokenMatch = envText.match(/^SUPABASE_ACCESS_TOKEN=(.+)$/m);
if (!tokenMatch) {
  throw new Error("SUPABASE_ACCESS_TOKEN missing from .env.tools.local");
}
const token = tokenMatch[1].trim();
const ref = "msdonkkechxzgagyguoe";

const ADMIN_LISTING_ID = "00000000-0000-0000-0000-0000000000ad";
const ADMIN_DISPLAY_NAME = "Trade Off Team";
const PUBLIC_BASE = "https://xratedtrade.com";

async function db(query, name = "query") {
  const r = await fetch(
    `https://api.supabase.com/v1/projects/${ref}/database/query`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({ query })
    }
  );
  const txt = await r.text();
  if (!r.ok) {
    throw new Error(`${name} ${r.status}: ${txt}`);
  }
  try {
    return JSON.parse(txt);
  } catch {
    return txt;
  }
}

function pgQuote(s) {
  if (s === null || s === undefined) return "NULL";
  return `'${String(s).replace(/'/g, "''")}'`;
}

const POSTS = [
  {
    slug: "trade-off-is-live",
    category: "platform",
    title: "Trade Off is live — what we built and why",
    excerpt:
      "Trade Off is the shareable trade profile for working tradespeople. Here is the honest tour — what it does, what it costs, and what it deliberately does not do.",
    body: `## What Trade Off actually is

Trade Off is a shareable profile for tradespeople. One link, one page — the work you have done, the prices you charge, the reviews you have earned, and a button that opens a WhatsApp conversation with you. Built for the way trades actually win jobs in 2026: through a screenshot in a WhatsApp group chat, a QR code on the side of the van, a link in an Instagram bio.

The closest analogue is a Linktree built specifically for trades. Profile-first, not job-board-first. The customer does not post a job and wait for quotes — they look at your profile, decide they trust you, and message you directly.

## The 108 trade templates

We launched with 108 trade-specific templates. Bricklayer. Plasterer. Tiler. Heavy machinery operator. Building merchant. Stonemason. Each template ships with a hero banner image, the right service-list questions for that trade, and example pricing so a new joiner is not staring at a blank page on day one.

Pick your trade. The skeleton fills itself in. You replace the placeholder photos with your work, edit the prices to match what you charge, and the page is ready to share inside ten minutes.

## Free vs paid — what is actually different

Free is **free forever**, no card on signup. You get:

- Your shareable profile at xratedtrade.com/your-name
- WhatsApp button
- Up to six photos of work
- Reviews
- A trade icon, a short bio, and one phone number

That is enough to win jobs. We will not put a paywall in front of features your customer needs to make a decision.

Paid (£14.99/month) adds the things a busy tradesperson needs to *run* the work, not just advertise it:

- Service Cards — itemised pricing with photos, so a customer can see &ldquo;loft hatch fit&rdquo; at £180 before they even message you
- The Yard — a trades-only chat board where you can ask other working tradies for help on a quirky job, hire a labourer, or find spare materials
- Job Diary — calendar and quote tracking
- Trade Center — wholesaler-style shopping for tools at trade prices
- Six more add-ons that mostly do not exist anywhere else

There is a 14-day free trial of Paid on signup. No card. If you do not use it, you stay on Free forever — no automatic charging, no &ldquo;your trial has ended, please subscribe&rdquo; emails harassing you.

Verified (£19.99/month) sits above Paid. It is the same feature set plus a verified-business check (Companies House for UK, equivalents elsewhere) and a verified badge on your hero. It is on a waitlist until later in 2026 while we get the verification flow right.

## The no-commission stance, plainly

We do not take a cut of any job booked through Trade Off. The £14.99 covers the platform; everything you quote, you keep. We do not sit between you and the customer at quote time, we do not inflate quotes with platform fees, and we will not.

Why does this matter? Because the dominant tradesperson directories — Checkatrade and MyBuilder among them — make most of their money by charging the *tradesperson* per lead, and charging more if your trade is competitive in your postcode. The economics of those platforms only work if a tradesperson cannot find work without them. We are not trying to corner you.

## How we differ from Checkatrade and MyBuilder

Three structural differences:

1. **Profile-first, not job-first.** The customer comes to your profile, not to a list of every plumber in their postcode where you are competing on price with seven others.
2. **Flat subscription, no per-lead charges.** £14.99 is £14.99 whether you win one job or fifty.
3. **You own the customer relationship.** WhatsApp goes direct to your phone. No platform messaging layer, no &ldquo;please respond within 2 hours or your rating drops&rdquo; tactic.

We are not trying to replace word-of-mouth. We are trying to make word-of-mouth shareable.

## What to do next

If you are new: pick your trade at [/trade-off/trades](/trade-off/trades), claim your name, and the Free profile is yours forever. If you want Paid, the 14-day trial starts the moment you click &ldquo;Try Paid&rdquo; — no card required.

If you are already on Trade Off: tell another tradesperson. The platform works better when the people you talk to every day are on it, because The Yard chat becomes useful, and because customers searching for &ldquo;tilers near me&rdquo; find a directory dense enough to actually be useful.

Either way — welcome to Trade Off. We are glad you are here.`
  },
  {
    slug: "has-plastering-evolved",
    category: "opinion",
    title:
      "Has plastering evolved since the traditional days? A working tradie's take",
    excerpt:
      "Opinion piece from a working plasterer — what has actually changed, what has not, and where traditional methods are quietly making a comeback.",
    body: `*This is an opinion piece. The views below are one working tradesperson&rsquo;s take on how plastering has and has not changed. Your mileage will vary by region, by trade, by the kind of jobs you do.*

## The short answer: yes and no

Yes — the tools and materials have changed beyond recognition. Multi-finish came in, lime fell out of mainstream new-build, mechanical mixers replaced hawk-and-trowel-only, and we now have plastering machines that can spray a wall in minutes that would have taken a morning by hand.

No — the actual *skill* of getting a flat, polished finish without trowel marks has not changed at all. Anyone telling you it has is selling something.

## What traditional plastering actually meant

For most of the 20th century in the UK, traditional plastering meant three coats over wooden lath or, later, expanded metal: scratch coat, float coat, and a setting coat. Lime-based mortars for older buildings. Sand-and-cement render outside. Tooled by hand, mixed in a bucket or a wheelbarrow with a paddle if you were lucky.

It was slow. It was physical. A bedroom ceiling was a full day for a competent plasterer. A skim coat on a wall could take an entire morning before you even got to the polishing pass.

The skill was the eye. A plasterer who could read the suction of the wall, time the polishing perfectly, and walk away with a glass-flat finish was worth their weight. That skill took ten years to build and was passed down by working alongside someone who already had it.

## What changed in the 80s and 90s

Two things, mostly: gypsum-based multi-finish coats (British Gypsum and Knauf got these to scale in the UK, replacing lime in most new-build) and dot-and-dab plasterboard fixing replacing wet plaster on solid walls. Suddenly a wall that would have taken two coats of float and a finish coat could be plasterboarded and skimmed in a single visit.

Faster. Cheaper. Equally flat, *if* the skim was done well.

## What modern tools actually do

The headline change in the last decade is the spray plastering machine. PFT G4s and Wagner-style rigs. Mix and spray a tonne of multi-finish onto a ceiling in twenty minutes, then trowel up by hand. On big jobs — new-build estates, commercial fit-outs, anywhere with hundreds of square metres of flat surface — it is genuinely a step change.

For a one-room kitchen extension on a Tuesday afternoon? The spray rig is a hassle. You spend longer setting up and washing down than you save on the spray. Hand-trowel still wins for small jobs and always will.

The other quiet change is mortar quality. Pre-bagged base coats and topcoats are more consistent than they were twenty years ago. Less mixing-by-eye, more &ldquo;follow the bag instructions and it will work.&rdquo; That helps newer plasterers get a passable finish faster — but it does not replace the eye for when the suction is wrong and the wall needs an extra hour.

## Where traditional methods are coming back

Heritage and listed-building work. The 2014 update to PAS 2035 and the broader push around breathable buildings has put lime plastering back on the syllabus. Old houses do not want gypsum on solid stone walls — gypsum traps moisture, lime breathes. The number of conservation officers insisting on hot-mixed lime is rising every year.

If you are a working plasterer, learning lime work is one of the more durable bets you can make. The supply of plasterers who can read an old wall and mix a hot lime is genuinely small, and the demand from heritage owners is growing.

## Where modern tools genuinely save time

Mechanical mixers — bucket mixers and paddle mixers — saved the trade hours per day. Anyone still hand-mixing for a full job is making their back work harder than it needs to.

Laser levels for setting beads. The old plumb-and-line method works, the laser is faster, and on plaster beading where 2mm matters, the laser is more reliable.

Polishing trowels with the Marshalltown or PermaShape blades. They cost more, they last longer, and the finish off them is genuinely better than the soft-steel trowels from the 80s.

## The bit nobody talks about

Apprenticeships are thin. The number of working plasterers training the next generation has dropped, and YouTube does not replace standing next to a finisher who can show you how to read a wall in real time. If you are a working plasterer with ten years in, taking on an apprentice is the single most valuable thing you can do for the trade.

## So, has it evolved?

Materials yes, tools yes, methods on big jobs yes. The core skill is unchanged. And quietly, on heritage work, we are circling back to where we started.

Mixed answer. Honest answer.`
  },
  {
    slug: "tools-that-fit-your-trade",
    category: "opinion",
    title: "Buy tools that fit your trade, not Instagram",
    excerpt:
      "Opinion: the Instagram tool-of-the-week hype cycle costs trades thousands. Here is how to evaluate a tool before you buy it.",
    body: `*Opinion piece — a working tradesperson&rsquo;s view on tool-buying. Your trade may need different things.*

## The marketing hype cycle is loud

Every six months a new tool gets passed around the trade Instagram accounts, the YouTube reviewer channels and the wholesaler emails like it is the second coming. Sometimes it is genuinely good. Most times it is fine but no better than the one you already own.

A tool review on YouTube tends to look at: build quality, headline specs (torque, rpm, blade size), and whether it cuts a 2x4 the reviewer happened to have. None of that tells you whether it is the right tool for *your* trade, *your* jobs, and *your* week.

## What actually matters when you buy a tool

The headline spec is rarely the thing that wins or loses a tool for working trades. The boring stuff matters more:

- **Battery platform.** If you are already on Makita 18V, the new DeWalt sander has to be a *lot* better to be worth a second charger, a second battery family and a second wall socket on the van. Stay on one platform unless there is a genuine reason to swap.
- **Repair availability.** A drill that needs to go back to the factory for any fault is a drill you will lose for three weeks. Brands with good local service agents — Makita, Bosch, Festool in the UK — beat brands that do not.
- **Weight.** Sounds soft. Try holding any tool above your head for two hours. The 200g you save on a multi-tool is two days of less shoulder pain across a week of ceiling work.
- **Dust collection.** If your trade kicks dust — chasing, grinding, sanding — the tool that hooks up cleanly to your vac matters more than the tool with one more horsepower. HSE silica dust enforcement is not slowing down.
- **Noise.** Apartment jobs, day work in office fit-outs, anywhere the customer is nearby. Quieter tools win jobs you would otherwise lose. Brushless motors generally help here.

## What does not matter as much as you think

Headline torque numbers. Most jobs are not torque-limited. The driver that runs out of torque is a driver too small for the job; the driver that meets the job is enough. An extra 10 Nm of stall torque sells units but rarely saves time.

Bit cosmetics. The yellow vs the green vs the blue. If you find yourself reaching for a colour because it looks good on Instagram, you are buying a tool for the wrong reason.

The launch-week hype. Wait six months. By then the real working reviews are out, the early-batch problems are documented, and the price has usually settled.

## How to actually evaluate a tool before you buy

Three questions. Honest answers.

1. **What job, this month, would this tool make meaningfully faster?** If you cannot name one specific job, you do not need it yet. Wishlist it.
2. **Does it fit your battery platform / dust extractor / van layout?** A &ldquo;great&rdquo; tool that needs a separate battery family is a worse tool than a &ldquo;good&rdquo; one that does not.
3. **Can you borrow one for a day before you buy?** Most builders&rsquo; merchants and some local tool reps will lend a tool for a job. Try before you commit.

If you answer those three honestly, the tool-of-the-week hype loses most of its power.

## The trades that get this right

The plumbers and electricians who go ten years on one drill, one impact driver, one multi-tool and one specialty for their trade — and replace each one only when it dies — are the ones with the healthiest van budgets at the end of the year. They are not less professional. They are more profitable.

The trades that turn over their tool kit every two years on hype are funding the tool reviewers&rsquo; YouTube channels. Sometimes that is fine; that is how they enjoy the trade. But it is a choice, not a requirement.

## A working list of &ldquo;buy once, cry once&rdquo; categories

For anyone reading this who is genuinely in the market, the categories where spending more usually pays back are:

- Cordless drill/driver and impact driver — the daily-driven tools
- Track saw or circular saw, if your trade cuts sheet goods
- Quality dust extractor — silica fine HSE compliance is a moving target
- Site-grade laser level — fastenings, beads, tile setouts
- Marshalltown / equivalent finishing trowel for plasterers

For the &ldquo;buy something decent but cheap is fine&rdquo; category:

- Most consumables — drill bits, blades, abrasives
- Tape measures (you will lose them)
- Workbenches (most break the same way regardless of price)

## The point

Buy tools that solve your jobs. Not tools that solve the YouTuber&rsquo;s jobs. Not tools that look good in the back of your van for the Instagram photo. Tools that, on a Tuesday morning in February, make the work go faster or come out better.

Everything else is marketing.`
  },
  {
    slug: "why-builders-merchants-matter",
    category: "industry",
    title: "Why builders' merchants still matter in 2026",
    excerpt:
      "The case for keeping your local merchant — trade accounts, knowledgeable staff, local stock and the things online never quite gets right.",
    body: `Online has taken a chunk of the merchant trade. Toolstation in your van app, Amazon-Prime-overnight on a bag of fixings, Travis Perkins one-tap online ordering. None of it is going away.

And yet the local builders&rsquo; merchant — the counter, the yard, the bloke who has been on the desk for fifteen years — still matters more than the Internet thinks it does. Here is the honest case for keeping the local merchant alive, written for working tradies who already know half of this.

## Trade accounts

A 30-day account at a local merchant is one of the simpler cashflow tools the trade has. You buy on Monday. You invoice the customer on Friday. The customer pays you the following Friday. The merchant invoice does not hit your account until the end of the month after that. You have used the merchant&rsquo;s capital for free, against the back of your reputation as a regular customer.

Online retailers do not really do this. Amazon Business does some net-30 but only for limited categories and with credit limits that do not match how a working trade actually spends.

If you do volume — and especially if you do volume where the customer-pay cycle runs hot and cold — a 30-day account is worth real money.

## Local stock

The moment you find out a customer&rsquo;s pipe is 22mm and not 28mm — at 4pm on a Friday when the job has to finish today — is the moment you remember why having a merchant five minutes away matters. Online overnight is not overnight if the order goes in after 6pm. Local stock is now.

Even better: the merchant&rsquo;s counter staff usually know what they actually have versus what the website says they have. The number of times an online system says &ldquo;in stock&rdquo; and the reality is &ldquo;sat in the wrong warehouse&rdquo; is non-zero.

## Knowledgeable counter staff

The genuinely experienced person at the counter is one of the unwritten advantages of the trade. They have seen ten thousand jobs walk in the door over their career. They know which compounds skim over render that has previously been painted, which fixings cope with a hollow block wall, which drainage fittings the local council inspector will not flag.

That knowledge is not transferable to a website search box. The merchant counter is one of the last places in the trade where a working person can ask a question and get an answer from someone who actually knows.

Worth saying plainly: this is also why merchants are vulnerable. The counter staff are the asset. When merchants strip the counter to save wages and push everything online, the customers leave — because the answer to the question is no longer there.

## The yard

If you have ever tried to fit a 4.8m length of 8x2 into the back of a Transit Custom, you understand why a yard with a forklift, a flat trolley and someone willing to help load matters.

Online deliveries can handle long lengths, but the lead time is days, the delivery window is half-day-wide, and the missed-delivery cycle of long lengths is brutal. Local yard, drive in, load up, gone — still the cleanest way to handle bulk timber and aggregate.

## The case against the merchant (honest)

For fairness: there are real reasons trades have shifted away from merchants over the last decade.

- **Pricing transparency.** Online catalogues are simpler to price-compare than a paper price-list that the counter quotes from. Merchants who have not modernised their pricing tools lose price-sensitive trades.
- **Counter waits.** A 20-minute queue at 7:30am on a Monday is normal in some merchants. That is time you do not get back.
- **Inconsistent pricing.** The same item priced three different ways depending which staff member is on the counter. Frustrating.
- **Account hassle.** Setting up a trade account is harder than it should be. Some merchants ask for two years of accounts before approving a new account holder, which excludes newer trades who actually need the credit most.

None of these are dealbreakers, but they are real.

## What a working merchant relationship looks like in 2026

The merchants who win the next decade are the ones who keep the knowledgeable counter, fix the queue at 7:30am, and put the price list online — but keep the local yard, the credit, and the human at the desk.

For working trades, the best move is usually:

- Have a primary merchant. Get the account in place. Use it for the bulk of your spend.
- Have a backup. The day your primary&rsquo;s system goes down — and it will — you need somewhere to go.
- Keep an online supplier for last-minute consumables. Toolstation overnight, Screwfix click-and-collect, fine.
- Do not pretend the online suppliers can replace the merchant entirely. They cannot.

## Closing

The local merchant is one of the small structural pieces that makes the trade work. Quietly, in the background. The day they all close — and a few have already, post-2024 — is the day we find out what we lost.

Use them. Pay them on time. Be polite to the counter staff. They are worth more than the spreadsheet says.`
  },
  {
    slug: "reseller-programme-conversation",
    category: "platform",
    title: "Reseller programme — open for conversation",
    excerpt:
      "We are exploring a Trade Off reseller programme. Not announcing one yet. Here is the early thinking and how to tell us what you want it to look like.",
    body: `## Where this came from

A few weeks ago we started getting the same question from a few different directions:

- A merchant rep asking if Trade Off was something they could offer to their account holders.
- A construction-software consultant asking about white-label.
- A federation/trade-body director asking whether members could get a discount in exchange for the body promoting Trade Off.

Three different shapes of the same idea: someone outside Trade Off has access to a group of tradespeople, and wants a structured way to bring them in.

We do not have a reseller programme yet. But we want to talk about it before we build one, so the programme actually fits what resellers and tradespeople want — not just what we assume.

## What a reseller programme could look like

There are at least three plausible shapes. We are not committing to any of them.

**1. Affiliate-style — flat referral fee.**
A merchant, federation or consultant signs up with a unique link. Every Paid signup that comes through their link earns them a one-off referral fee. Simple, low overhead, no ongoing commitment.

**2. Co-marketed bundles.**
A merchant offers a free 6-month Paid subscription as a benefit of their trade account. The merchant pays a discounted rate to Trade Off, the tradesperson sees it as a free benefit, the merchant gets stickier accounts. Common shape in B2B software but new for our space.

**3. White-label / partner edition.**
A trade body or federation has its own branded version of Trade Off for its members. Same platform underneath, the body&rsquo;s branding on top. Heavier integration, longer conversations.

Each shape suits different partners. We do not know yet which is the right starting point.

## What we want to learn

If you are a potential partner — merchant, federation, consultant, trade body, or just a tradesperson with a network — we would like to hear:

- Which of the three shapes above fits the way you actually work with trades.
- What the commercial terms would have to look like for it to be worth your time.
- What you would need from us in terms of marketing assets, account management, and onboarding support.
- Whether there is a fourth shape we have not thought of.

This is genuinely a conversation, not a sales pitch. We do not have a deck. We have a working platform and a small team and a willingness to figure this out with people who actually do the work.

## What we will not do

A few honest exclusions, so partners know what we are not.

- **No exclusivity by region.** We are not going to lock a postcode to one reseller. The platform is open and the tradesperson decides where they want to be listed.
- **No commission on the tradesperson&rsquo;s jobs.** Our core promise is that we do not take a cut of jobs. That stays true whether the tradesperson signed up via a reseller or directly. Resellers get paid by us, not by the tradesperson.
- **No surprise cost-passing.** Anything we agree with a reseller is transparent. The tradesperson should never be paying more because their merchant introduced them — that breaks the trust we are trying to build.

## How to talk to us

If you are interested in any of this, email us via the [contact page](/contact). Mention &ldquo;Reseller programme&rdquo; in the subject so it routes to the right inbox. Tell us:

- Who you are
- The size and shape of the trade audience you have access to
- Which of the three shapes above appeals (or your own variation)
- What a sensible first step looks like — pilot, conversation, just an exploratory call

We are not going to publish a glossy partner deck until we have had a dozen of these conversations. The shape of the programme should come from those conversations. We will report back here once we have a clearer picture.

## Why we are doing it this way

The trade software space is full of partner programmes that were designed in a boardroom and never quite fit the people they were supposed to fit. We would rather build slowly and listen than launch something polished that no one wants to actually use.

If that means we have a partner programme in six months instead of next week — fine.

Email us. We are listening.`
  },
  {
    slug: "should-every-tradesperson-have-a-public-profile",
    category: "opinion",
    title: "Should every tradesperson have a public profile in 2026?",
    excerpt:
      "Opinion: a public profile helps most working tradespeople, but not all. Here is the honest case for, against, and the middle ground.",
    body: `*Opinion piece — written by someone who runs a platform that builds public profiles. Read it with that in mind. We are biased, but we are also trying to be honest.*

## The case for

A public profile — anywhere — does three things that compound over time.

**Google does the work for you.**
When someone in your area searches for &ldquo;[trade] near me&rdquo; on Google or Apple Maps, the businesses that show up are the ones with public profiles. Google rewards verifiable presence: a Google Business profile, reviews, a website, a directory listing. Trades that exist only as a word-of-mouth name on a notepad do not appear, and the customer who searched at 11pm on a Tuesday picks one of the others.

You do not have to like SEO. You just have to be in the index.

**Customers vet you before they call.**
Customer behaviour in 2026 is not &ldquo;call the first plumber on the list.&rdquo; It is: get the name, search for the name, look at the work, read the reviews, make sure the business exists, and *then* call. If there is nothing to find, half of the customers will silently move on without you ever knowing they were considering you.

A 5-photo profile with three reviews and a phone number is enough to clear the vetting bar for most domestic jobs. A blank Google result is not.

**Reviews compound.**
The first review is hard to get. The fifth is easier. The fiftieth is automatic. By the time you have fifty reviews on a profile that has been live for two years, you are no longer competing with newer trades on price — you are competing on social proof. That advantage takes years to build and is impossible to fake (the platforms that try to fake it get caught eventually, and the trades caught with them).

## The case against

There are working tradespeople who genuinely do not need this, and we should be honest about who they are.

**The booked-out word-of-mouth specialists.**
The plumber whose phone rings off the hook from word-of-mouth. The plasterer who is already booked twelve months out. The bespoke joiner who only takes referred jobs from architects. If you genuinely have more demand than supply, a public profile mostly just adds noise. The leads it brings in are less qualified than the ones already coming from referrals.

For these trades, the answer is &ldquo;maybe a profile, but turn off the &lsquo;contact me&rsquo; button.&rdquo; A reference page exists. New customers cannot quite get through. The reputation continues to compound. Defensible position.

**The trade that hates the back-office work.**
Profiles need maintaining. Photos need adding. Reviews need replying to. If the answer to &ldquo;will you spend ten minutes a month on this&rdquo; is genuinely no, an unkempt profile is worse than no profile. A 2024-vintage cover photo and a one-star review from 2023 sitting unanswered on the page is actively harmful.

For trades who will not do the maintenance, a Google Business profile (which Google maintains for them, more or less) is fine and a paid platform is not. Be honest with yourself.

**The privacy-first trade.**
Some trades genuinely do not want to be public. Security trades, specialist installations for high-net-worth clients, custom commercial work. The customer base does not search Google. Public profiles for these trades risk attracting the wrong work.

If you are in this category, you almost certainly already know you are. Skip the profile question entirely.

## The honest middle ground

For the 80% of working trades who are not in the &ldquo;booked out forever&rdquo; or &ldquo;privacy-first&rdquo; camps, a public profile is a defensive move first and an offensive move second.

Defensive: when the customer Googles you, *something* needs to come up. That something should be: your name, your work, a way to contact you, and at least one piece of social proof.

Offensive: when the customer Googles &ldquo;[trade] in [city],&rdquo; you want to appear in that list. Not necessarily at the top — appearing at all is most of the win.

The minimum viable profile, in 2026, looks like this:

- A Google Business profile, claimed and verified (free)
- A directory listing on a credible trade platform (free or paid)
- Three to five photos of your actual work
- A trade-association badge or verification, where it exists for your trade
- A way to message you directly that does not require the customer to install an app

If you have all five, you are above the line. If you have none, you are below it.

## The bit where we acknowledge the bias

We run Trade Off. We obviously think a profile on Trade Off is a sensible piece of this puzzle. We also think Google Business and a single trade-body listing might be enough on their own for some trades.

The honest answer to &ldquo;should every tradesperson have a public profile?&rdquo; is &ldquo;most should, some should not, and the ones who should not usually already know.&rdquo;

That is not a great headline. It happens to be true.

## How to decide

Two questions, honestly answered:

1. If a stranger Googled my business name right now, would they find enough to trust me?
2. If a stranger Googled &ldquo;[my trade] in [my city],&rdquo; would they find me at all?

If &ldquo;yes&rdquo; to both: you are sorted. Maintain what you have. Do not overthink the rest.

If &ldquo;no&rdquo; to either: a profile is probably the cheapest fix for the gap. Free is fine. Free works. The question is whether your name and your work exist somewhere a customer can find them.

That is the actual question. Not which platform. Not which paid tier. Just: when someone looks for you, will they find what they need to make a decision?

Your call.`
  }
];

// Make sure the sentinel admin "listing" row exists — The Yard FK
// requires listing_id to reference hammerex_trade_off_listings. We
// insert a marker row (status='draft' so it never appears on the
// public directory) the first time we run; subsequent runs are no-ops.
await db(
  `INSERT INTO public.hammerex_trade_off_listings
     (id, slug, display_name, primary_trade, city, country,
      whatsapp, email, bio, status)
   VALUES (
     ${pgQuote(ADMIN_LISTING_ID)},
     'trade-off-team',
     ${pgQuote(ADMIN_DISPLAY_NAME)},
     'general-builder',
     'London',
     'United Kingdom',
     '+44 0',
     'team@xratedtrade.com',
     'Sentinel listing for Trade Off admin announcements. Not a real tradesperson — used by the Yard FK so admin announcement posts can be inserted without binding to a real member.',
     'draft'
   )
   ON CONFLICT (id) DO NOTHING;`,
  "ensure sentinel listing"
);

const summary = { inserted: 0, updated: 0, yardCreated: 0, yardSkipped: 0 };

for (const post of POSTS) {
  const insertSql = `
    INSERT INTO public.hammerex_xrated_news_posts
      (slug, title, category, body_markdown, excerpt, status, published_at, updated_at)
    VALUES (
      ${pgQuote(post.slug)},
      ${pgQuote(post.title)},
      ${pgQuote(post.category)},
      ${pgQuote(post.body)},
      ${pgQuote(post.excerpt)},
      'live',
      now(),
      now()
    )
    ON CONFLICT (slug) DO UPDATE SET
      title = EXCLUDED.title,
      category = EXCLUDED.category,
      body_markdown = EXCLUDED.body_markdown,
      excerpt = EXCLUDED.excerpt,
      status = 'live',
      published_at = COALESCE(public.hammerex_xrated_news_posts.published_at, now()),
      updated_at = now()
    RETURNING id, slug, title, excerpt, (xmax = 0) AS inserted;
  `;
  const upsertRes = await db(insertSql, `news upsert ${post.slug}`);
  const row = upsertRes?.[0];
  if (!row) throw new Error(`No row returned for ${post.slug}`);
  if (row.inserted) summary.inserted++;
  else summary.updated++;

  // Cross-post to The Yard — idempotent on metadata.news_post_id.
  const yardCheck = await db(
    `SELECT id FROM public.hammerex_trade_off_yard_posts
       WHERE is_admin_announcement = true
         AND listing_id = ${pgQuote(ADMIN_LISTING_ID)}
         AND metadata @> ${pgQuote(JSON.stringify({ news_post_id: row.id }))}::jsonb
       LIMIT 1;`,
    `yard check ${post.slug}`
  );
  if (yardCheck?.length) {
    summary.yardSkipped++;
    continue;
  }

  const body = [
    `📰 New from the Newsroom: ${post.title}`,
    "",
    post.excerpt,
    "",
    `Read the full piece: ${PUBLIC_BASE}/news/${post.slug}`
  ].join("\n");
  const meta = {
    posted_by: "trade_off_team",
    display_name: ADMIN_DISPLAY_NAME,
    type: "news_announcement",
    news_post_id: row.id,
    news_slug: post.slug
  };
  const yardInsert = await db(
    `INSERT INTO public.hammerex_trade_off_yard_posts
      (listing_id, kind, trade_slug, title, body, country, region, is_sample,
       status, is_admin_announcement, is_pinned, moderation_status, expires_at, metadata)
     VALUES (
       ${pgQuote(ADMIN_LISTING_ID)},
       'chat',
       'general-builder',
       ${pgQuote("📰 Newsroom: " + post.title)},
       ${pgQuote(body)},
       'UK',
       NULL,
       false,
       'live',
       true,
       false,
       'live',
       now() + interval '30 days',
       ${pgQuote(JSON.stringify(meta))}::jsonb
     )
     RETURNING id;`,
    `yard insert ${post.slug}`
  );
  const yardId = yardInsert?.[0]?.id;
  if (yardId) {
    summary.yardCreated++;
    await db(
      `UPDATE public.hammerex_xrated_news_posts
         SET yard_post_id = ${pgQuote(yardId)}
         WHERE id = ${pgQuote(row.id)};`,
      `link news.yard_post_id ${post.slug}`
    );
  }
}

const finalCount = await db(
  `SELECT slug, status, yard_post_id IS NOT NULL AS has_yard
     FROM public.hammerex_xrated_news_posts
     ORDER BY published_at DESC NULLS LAST;`,
  "final check"
);

console.log("Seed complete:", summary);
console.log("Rows:", finalCount);
