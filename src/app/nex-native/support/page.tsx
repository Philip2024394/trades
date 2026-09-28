// src/app/nex-native/support/page.tsx
//
// Bridge 16c · NEX Support · public flow.
// ---------------------------------------
// Branching help surface routed by URL query params. The critical
// branch is the payment-dispute path · it enforces the "did you use
// a safe path?" gate and either points the user at the escrow
// provider's own dispute process, or explains why NEX cannot help
// (with links to alternative recourse: bank dispute, police report).
//
// Design principle: NEX does not have a live chat support · this
// page IS the support surface. Every leaf gives the user the next
// concrete step to take, not "email us and wait".
//
// Routing:
//   /support                        · top-level categories
//   /support?topic=payment          · payment issue landing
//   /support?topic=payment&used_safe_path=yes    · escrow dispute help
//   /support?topic=payment&used_safe_path=no     · off-doctrine guidance
//   /support?topic=listing          · listing/product issues
//   /support?topic=account          · account, sign-in, billing
//   /support?topic=report           · report a scammer / abuse

import type * as React from "react";
import Link from "next/link";

export const runtime = "nodejs";
export const dynamic = "force-static";

const NEX = {
  bg: "#020914",
  panel: "#050f1e",
  panelSoft: "rgba(6, 15, 28, 0.72)",
  border: "rgba(139, 169, 209, 0.14)",
  borderStrong: "rgba(139, 169, 209, 0.24)",
  text: "#F4F7FC",
  textDim: "#8BA9D1",
  textMute: "#526B89",
  cyan: "#00AFFF",
  cyanSoft: "rgba(0,175,255,0.5)",
  orange: "#FF7200",
  orangeSoft: "rgba(255,114,0,0.6)",
  green: "#16D66B",
  amber: "#F59E0B",
  red: "#FF3355",
};

const SERIF =
  "'Cormorant Garamond', 'EB Garamond', 'Playfair Display', Georgia, serif";
const SANS =
  "Inter, ui-sans-serif, system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif";

export const metadata = {
  title: "NEX · Support",
  description:
    "Get help with a NEX chat, listing, payment issue, or account. NEX doesn't handle payments · we help you take the right next step.",
};

export default async function SupportPage({
  searchParams,
}: {
  searchParams: Promise<{
    topic?: string;
    used_safe_path?: string;
  }>;
}) {
  const sp = await searchParams;
  const topic = sp.topic ?? null;
  const usedSafePath = sp.used_safe_path ?? null;

  return (
    <div
      style={{
        minHeight: "100dvh",
        background: NEX.bg,
        color: NEX.text,
        fontFamily: SANS,
        paddingBottom: 80,
      }}
    >
      {/* Top nav */}
      <header
        style={{
          padding: "calc(env(safe-area-inset-top, 0) + 14px) 20px 12px",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          borderBottom: `1px solid ${NEX.border}`,
        }}
      >
        <Link
          href="/nex-native"
          style={{
            fontSize: 11,
            color: NEX.textDim,
            textDecoration: "none",
            letterSpacing: "0.06em",
            textTransform: "uppercase",
            fontWeight: 700,
          }}
        >
          ← NEX
        </Link>
        <div style={{ display: "flex", gap: 16 }}>
          <Link
            href="/nex-native/safe-trade"
            style={{
              fontSize: 11,
              color: NEX.textDim,
              textDecoration: "none",
              letterSpacing: "0.06em",
              textTransform: "uppercase",
              fontWeight: 700,
            }}
          >
            Safe trade ↗
          </Link>
          <Link
            href="/nex-native/terms"
            style={{
              fontSize: 11,
              color: NEX.cyan,
              textDecoration: "none",
              letterSpacing: "0.06em",
              textTransform: "uppercase",
              fontWeight: 700,
            }}
          >
            Terms ↗
          </Link>
        </div>
      </header>

      <main style={{ maxWidth: 720, margin: "0 auto", padding: "40px 20px" }}>
        {topic === null && <TopicPicker />}
        {topic === "payment" && usedSafePath === null && (
          <PaymentGate />
        )}
        {topic === "payment" && usedSafePath === "yes" && (
          <SafePathHelp />
        )}
        {topic === "payment" && usedSafePath === "no" && (
          <OffDoctrineHelp />
        )}
        {topic === "listing" && <ListingHelp />}
        {topic === "account" && <AccountHelp />}
        {topic === "report" && <ReportHelp />}
        {topic !== null &&
          !["payment", "listing", "account", "report"].includes(topic) && (
            <UnknownTopic />
          )}
      </main>
    </div>
  );
}

/* --------------------------------------------------------------------- *
 * Top-level topic picker                                                *
 * --------------------------------------------------------------------- */

function TopicPicker() {
  return (
    <>
      <div style={{ marginBottom: 36 }}>
        <div
          style={{
            fontSize: 10,
            letterSpacing: "0.32em",
            textTransform: "uppercase",
            color: NEX.cyan,
            fontWeight: 700,
            marginBottom: 10,
          }}
        >
          NEX support
        </div>
        <h1
          style={{
            margin: 0,
            fontFamily: SERIF,
            fontSize: 40,
            lineHeight: 1.1,
            fontWeight: 500,
            letterSpacing: "-0.015em",
            marginBottom: 14,
          }}
        >
          What do you need help with?
        </h1>
        <p
          style={{
            margin: 0,
            fontSize: 14,
            lineHeight: 1.65,
            color: NEX.textDim,
          }}
        >
          Pick the closest match. NEX doesn&apos;t have a live chat
          desk · every path below gives you a concrete next step
          rather than a queue.
        </p>
      </div>

      <div style={{ display: "grid", gap: 12 }}>
        <TopicCard
          href="/nex-native/support?topic=payment"
          eyebrow="Money issue"
          eyebrowColor={NEX.red}
          title="I paid but the seller didn't ship · or something's wrong with a payment"
          blurb="Best-case: your escrow provider handles it. Worst-case: you paid off-doctrine · we tell you what recourse you still have."
        />
        <TopicCard
          href="/nex-native/support?topic=listing"
          eyebrow="Listing / product"
          eyebrowColor={NEX.orange}
          title="A listing is wrong, missing, or looks like a scam"
          blurb="Report a listing · fix your own listing · questions about categories, stock, dispatch times."
        />
        <TopicCard
          href="/nex-native/support?topic=account"
          eyebrow="Account & billing"
          eyebrowColor={NEX.cyan}
          title="Sign-in, my account, or my Bisnis subscription"
          blurb="Password / face sign-in problems · Bisnis payment · deleting your account · data export."
        />
        <TopicCard
          href="/nex-native/support?topic=report"
          eyebrow="Report abuse"
          eyebrowColor={NEX.amber}
          title="Someone is scamming, harassing, or violating the rules"
          blurb="Report a seller or buyer · file a chat snapshot as evidence · request account suspension."
        />
      </div>
    </>
  );
}

function TopicCard({
  href,
  eyebrow,
  eyebrowColor,
  title,
  blurb,
}: {
  href: string;
  eyebrow: string;
  eyebrowColor: string;
  title: string;
  blurb: string;
}) {
  return (
    <Link
      href={href}
      style={{
        display: "block",
        padding: "18px 20px",
        borderRadius: 16,
        background: NEX.panelSoft,
        border: `1px solid ${NEX.border}`,
        textDecoration: "none",
        color: NEX.text,
      }}
    >
      <div
        style={{
          fontSize: 10,
          letterSpacing: "0.22em",
          textTransform: "uppercase",
          color: eyebrowColor,
          fontWeight: 700,
          marginBottom: 8,
        }}
      >
        {eyebrow}
      </div>
      <div
        style={{
          fontSize: 15,
          fontWeight: 700,
          lineHeight: 1.35,
          letterSpacing: "-0.005em",
          marginBottom: 6,
        }}
      >
        {title}
      </div>
      <div style={{ fontSize: 13, lineHeight: 1.55, color: NEX.textDim }}>
        {blurb}
      </div>
    </Link>
  );
}

/* --------------------------------------------------------------------- *
 * Payment · gate                                                        *
 * --------------------------------------------------------------------- */

function PaymentGate() {
  return (
    <>
      <BackLink />
      <SectionEyebrow color={NEX.red}>Money issue</SectionEyebrow>
      <h1 style={h1Style}>Did you use one of the five NEX safe paths?</h1>
      <p style={ledeStyle}>
        Before we can point you at the right next step, we need to know
        HOW you paid. NEX supports five buyer-safe paths ·{" "}
        <Link
          href="/nex-native/safe-trade"
          style={{ color: NEX.cyan, textDecoration: "none" }}
        >
          full list here
        </Link>
        .
      </p>

      <div style={{ display: "grid", gap: 12, marginTop: 26 }}>
        <BranchCard
          href="/nex-native/support?topic=payment&used_safe_path=yes"
          tone="green"
          badge="YES"
          title="I used COD, QRIS on delivery, Courier COD, Meet in person, or Escrow"
          blurb="Good · the third party (escrow, courier, or the delivery driver) is on your side. Here's how to invoke your protection."
        />
        <BranchCard
          href="/nex-native/support?topic=payment&used_safe_path=no"
          tone="red"
          badge="NO"
          title="I transferred directly to the seller's bank / QR / e-wallet before receiving the goods"
          blurb="This is off-doctrine · NEX cannot mediate the dispute. But there are still steps you can take · read on."
        />
      </div>
    </>
  );
}

/* --------------------------------------------------------------------- *
 * Payment · safe-path help                                              *
 * --------------------------------------------------------------------- */

function SafePathHelp() {
  return (
    <>
      <BackLink href="/nex-native/support?topic=payment" />
      <SectionEyebrow color={NEX.green}>You&apos;re protected ✓</SectionEyebrow>
      <h1 style={h1Style}>Invoke the third party you already paid.</h1>
      <p style={ledeStyle}>
        The party holding your money (escrow / courier / driver) has a
        dispute process. Contact them directly · they will investigate
        and either release your funds back to you or press the seller
        to ship / refund.
      </p>

      <div style={{ marginTop: 26, display: "grid", gap: 14 }}>
        <HelpStep
          num="1"
          title="Cash on Delivery"
          detail="If the delivery driver hasn't handed you the package yet · refuse the package. No cash changes hands. If they already did and the item is wrong · take a photo, contact the seller in chat, and if unresolved report the seller (Bridge 16 report flow · queued)."
        />
        <HelpStep
          num="2"
          title="QRIS on Delivery / Courier COD"
          detail="If you paid the courier and haven't received the item · call the courier's customer service (JNE 1500 111, J&T 021-8066 1888, SiCepat 021-5020 0050, AnterAja 021-5060 6070) with your tracking number. They will hold/reverse the funds."
        />
        <HelpStep
          num="3"
          title="Meet in Person"
          detail="You paid cash on the spot · you should have the item. If the item is faulty and the seller refuses a swap, take photos + video, keep the chat log, and if unresolved report the seller."
        />
        <HelpStep
          num="4"
          title="Escrow · Rekber / Xendit / Midtrans / DOKU"
          detail="Log into your escrow provider's portal. Look for the specific transaction. Every escrow has a dispute button · use it. Include your NEX chat log as evidence · you can screenshot the whole conversation. The escrow will hold the funds until the dispute resolves."
        />
        <HelpStep
          num="5"
          title="PayPal Goods & Services"
          detail="Open PayPal's Resolution Center within 180 days of the transaction. Click 'Report a Problem' → 'Item Not Received' or 'Significantly Not as Described'. Attach the NEX chat log. PayPal Buyer Protection is real · they will refund you if the seller can't prove delivery + condition."
        />
      </div>

      <BottomCard tone="cyan">
        <div style={{ fontSize: 14, lineHeight: 1.6 }}>
          Need to snapshot the NEX chat as evidence? Open the chat,
          tap the 3-dot menu, and select <b>Export conversation</b>
          {" "}(queued · Bridge 17). Until that ships, take full-page
          screenshots on your phone.
        </div>
      </BottomCard>
    </>
  );
}

/* --------------------------------------------------------------------- *
 * Payment · off-doctrine help                                           *
 * --------------------------------------------------------------------- */

function OffDoctrineHelp() {
  return (
    <>
      <BackLink href="/nex-native/support?topic=payment" />
      <SectionEyebrow color={NEX.red}>Off-doctrine payment</SectionEyebrow>
      <h1 style={h1Style}>We&apos;re sorry · but NEX cannot mediate this.</h1>
      <p style={ledeStyle}>
        You paid a seller directly · outside the five NEX safe paths.
        This was covered in the safe-trade terms you acknowledged when
        you started your first commerce chat (
        <Link
          href="/nex-native/terms"
          style={{ color: NEX.cyan, textDecoration: "none" }}
        >
          section 3
        </Link>
        ). NEX support does not refund you, chase the seller for
        repayment, or dispute with their bank.
      </p>

      <p style={ledeStyle}>
        You still have options · none of them involve NEX, but the
        chat log we preserved is your strongest evidence in all of
        them.
      </p>

      <div style={{ marginTop: 26, display: "grid", gap: 14 }}>
        <HelpStep
          num="1"
          title="File a bank dispute"
          detail="Contact YOUR bank (not the seller's) within 60 days of the transaction. Provide the chat log, the transaction ID, and any receipts. Indonesian banks (BCA, Mandiri, BRI, BNI) have fraud investigation teams · they may reverse the transaction if fraud is clear."
        />
        <HelpStep
          num="2"
          title="Report to OJK · financial regulator"
          detail="Otoritas Jasa Keuangan (OJK) handles complaints about payment fraud. File at konsumen.ojk.go.id/formkonsumen or call 157. Include the chat log and any seller identification you have. This adds official pressure and creates a public record."
        />
        <HelpStep
          num="3"
          title="File a police report"
          detail="For amounts over Rp 1 million, or when the pattern looks like organised fraud, file a police report (laporan polisi) at your nearest station or online via patrolisiber.polri.go.id. Bring the chat log printed out. Fraud is a criminal offence in Indonesia (KUHP Article 378)."
        />
        <HelpStep
          num="4"
          title="Report the seller to NEX"
          detail="Even though we can't refund you, we can suspend the seller's listings so nobody else falls into the same trap. Go to /nex-native/support?topic=report and file a scam report. We snapshot the chat log automatically as evidence."
        />
      </div>

      <BottomCard tone="red">
        <div
          style={{
            fontSize: 10,
            letterSpacing: "0.14em",
            textTransform: "uppercase",
            color: NEX.red,
            fontWeight: 700,
            marginBottom: 6,
          }}
        >
          Prevent this from happening again
        </div>
        <div style={{ fontSize: 14, lineHeight: 1.6, color: NEX.text }}>
          On your next order, always use one of the{" "}
          <Link
            href="/nex-native/safe-trade"
            style={{ color: NEX.cyan, textDecoration: "none" }}
          >
            five safe paths
          </Link>
          . If a seller refuses all five, walk away · a legitimate
          seller has nothing to lose by using a protected path.
        </div>
      </BottomCard>
    </>
  );
}

/* --------------------------------------------------------------------- *
 * Listing help                                                          *
 * --------------------------------------------------------------------- */

function ListingHelp() {
  return (
    <>
      <BackLink />
      <SectionEyebrow color={NEX.orange}>Listing / product</SectionEyebrow>
      <h1 style={h1Style}>Something wrong with a listing?</h1>
      <div style={{ marginTop: 20, display: "grid", gap: 12 }}>
        <HelpCard
          title="A listing looks like a scam / fake / stolen goods"
          body="Report the seller via /support?topic=report · we snapshot the chat and listing, review, and suspend confirmed scammers."
        />
        <HelpCard
          title="Something is missing on my own listing"
          body="Open /nex-native/manage · edit the product or menu item · save. Changes are live within seconds. If a field you need isn't in the form, tell us via /support?topic=account."
        />
        <HelpCard
          title="A photo won't upload"
          body="File size must be under 10 MB · format JPEG, PNG, or WebP. If the upload still fails, it may be a network issue · retry on WiFi. Persistent problems: report as an account issue."
        />
        <HelpCard
          title="I can't set my shop as a restaurant / cafe / rental etc."
          body="Set your category on /nex-native/manage/shop under 'Discovery'. Restaurants and cafes unlock the /manage/menu editor · other verticals are being added over time."
        />
      </div>
    </>
  );
}

/* --------------------------------------------------------------------- *
 * Account help                                                          *
 * --------------------------------------------------------------------- */

function AccountHelp() {
  return (
    <>
      <BackLink />
      <SectionEyebrow color={NEX.cyan}>Account &amp; billing</SectionEyebrow>
      <h1 style={h1Style}>Account, sign-in, and Bisnis subscription.</h1>
      <div style={{ marginTop: 20, display: "grid", gap: 12 }}>
        <HelpCard
          title="Face sign-in isn't working"
          body="Face sign-in uses WebAuthn tied to a specific device. Sign in with your email/password first, then re-enrol your face on the new device via /nex-native/create-account/face."
        />
        <HelpCard
          title="I forgot my password"
          body="Password reset flow is in a queued Bridge · until then, sign in with face if you have it enrolled, or contact us via account@nex.id (placeholder · production TBD)."
        />
        <HelpCard
          title="How do I upgrade to Bisnis?"
          body="Full details at /nex-native/packages. Bisnis is Rp 99k/month or Rp 990k/year · unlocks international export, verified badge, featured chip, unlimited caps. Payment via bank transfer or e-wallet directly to the NEX operating account (not through a NEX rail)."
        />
        <HelpCard
          title="I want to delete my account"
          body="Account deletion flow is a queued Bridge · until then, ask us to delete it manually. Your listings are archived, chats are retained (both sides need them as receipts), account is wiped after 30 days."
        />
        <HelpCard
          title="I want a data export"
          body="Data export (chats + listings + orders) as JSON is queued. Ask us and we can pull it manually while we finish the self-serve version."
        />
      </div>
    </>
  );
}

/* --------------------------------------------------------------------- *
 * Report help                                                           *
 * --------------------------------------------------------------------- */

function ReportHelp() {
  return (
    <>
      <BackLink />
      <SectionEyebrow color={NEX.amber}>Report abuse</SectionEyebrow>
      <h1 style={h1Style}>Report a scammer, harasser, or rule-breaker.</h1>
      <p style={ledeStyle}>
        NEX takes reports seriously. Every report snapshots the chat
        log · we review manually within 48 hours during pilot.
      </p>

      <div style={{ marginTop: 20, display: "grid", gap: 12 }}>
        <HelpCard
          title="How to report (self-serve · queued Bridge)"
          body="Inside any peer chat, tap the 3-dot menu → 'Report this user'. A form opens · choose the reason (scam, harassment, prohibited goods, impersonation, spam) and add a note. Chat log is attached automatically."
        />
        <HelpCard
          title="What happens after you report"
          body="Confirmed scam · listings suspended within 24 hours · repeat offenders permanently banned. Confirmed harassment · sender warned + optionally suspended. Prohibited goods · listings removed + reported to authorities where required by law."
        />
        <HelpCard
          title="Threshold enforcement"
          body="A single report doesn't automatically suspend. Multiple independent reports from different buyers on the same seller trigger a review + auto-suspend. This prevents malicious sellers from weaponising the report system against competitors."
        />
        <HelpCard
          title="If it's illegal (fraud over Rp 1M, threats, prohibited goods)"
          body="Report to NEX AND to the police (patrolisiber.polri.go.id for cyber-fraud). NEX cooperates with Indonesian law enforcement on formal requests."
        />
      </div>
    </>
  );
}

/* --------------------------------------------------------------------- *
 * Unknown topic fallback                                                *
 * --------------------------------------------------------------------- */

function UnknownTopic() {
  return (
    <>
      <BackLink />
      <SectionEyebrow color={NEX.textMute}>Not found</SectionEyebrow>
      <h1 style={h1Style}>We don&apos;t recognise that topic.</h1>
      <p style={ledeStyle}>
        Go back to the{" "}
        <Link
          href="/nex-native/support"
          style={{ color: NEX.cyan, textDecoration: "none" }}
        >
          topic list
        </Link>{" "}
        and pick a category.
      </p>
    </>
  );
}

/* --------------------------------------------------------------------- *
 * Shared primitives                                                     *
 * --------------------------------------------------------------------- */

function BackLink({ href = "/nex-native/support" }: { href?: string }) {
  return (
    <Link
      href={href}
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 6,
        color: NEX.textDim,
        textDecoration: "none",
        fontSize: 12,
        fontWeight: 600,
        letterSpacing: "0.04em",
        marginBottom: 22,
      }}
    >
      ← Back
    </Link>
  );
}

function SectionEyebrow({
  color,
  children,
}: {
  color: string;
  children: React.ReactNode;
}) {
  return (
    <div
      style={{
        fontSize: 10,
        letterSpacing: "0.28em",
        textTransform: "uppercase",
        color,
        fontWeight: 700,
        marginBottom: 8,
      }}
    >
      {children}
    </div>
  );
}

function BranchCard({
  href,
  tone,
  badge,
  title,
  blurb,
}: {
  href: string;
  tone: "green" | "red";
  badge: string;
  title: string;
  blurb: string;
}) {
  const color = tone === "green" ? NEX.green : NEX.red;
  return (
    <Link
      href={href}
      style={{
        display: "block",
        padding: "20px 22px",
        borderRadius: 16,
        background:
          tone === "green"
            ? "rgba(22,214,107,0.08)"
            : "rgba(255,51,85,0.08)",
        border: `1px solid ${
          tone === "green"
            ? "rgba(22,214,107,0.35)"
            : "rgba(255,51,85,0.35)"
        }`,
        textDecoration: "none",
        color: NEX.text,
      }}
    >
      <div
        style={{
          display: "inline-block",
          fontSize: 10,
          letterSpacing: "0.22em",
          textTransform: "uppercase",
          color,
          fontWeight: 800,
          padding: "3px 10px",
          borderRadius: 999,
          background: `${color}20`,
          border: `1px solid ${color}55`,
          marginBottom: 10,
        }}
      >
        {badge}
      </div>
      <div
        style={{
          fontSize: 15,
          fontWeight: 700,
          lineHeight: 1.4,
          letterSpacing: "-0.005em",
          marginBottom: 6,
        }}
      >
        {title}
      </div>
      <div style={{ fontSize: 13, lineHeight: 1.55, color: NEX.textDim }}>
        {blurb}
      </div>
    </Link>
  );
}

function HelpStep({
  num,
  title,
  detail,
}: {
  num: string;
  title: string;
  detail: string;
}) {
  return (
    <div
      style={{
        display: "grid",
        gridTemplateColumns: "36px 1fr",
        gap: 14,
        padding: "16px 18px",
        borderRadius: 14,
        background: NEX.panelSoft,
        border: `1px solid ${NEX.border}`,
      }}
    >
      <div
        style={{
          width: 36,
          height: 36,
          borderRadius: 12,
          background: "rgba(0,175,255,0.14)",
          border: "1px solid rgba(0,175,255,0.4)",
          color: NEX.cyan,
          display: "grid",
          placeItems: "center",
          fontSize: 15,
          fontWeight: 800,
          fontFamily: SERIF,
        }}
      >
        {num}
      </div>
      <div>
        <div
          style={{
            fontSize: 14,
            fontWeight: 700,
            marginBottom: 4,
            letterSpacing: "-0.003em",
          }}
        >
          {title}
        </div>
        <div style={{ fontSize: 13, lineHeight: 1.55, color: NEX.textDim }}>
          {detail}
        </div>
      </div>
    </div>
  );
}

function HelpCard({ title, body }: { title: string; body: string }) {
  return (
    <div
      style={{
        padding: "16px 18px",
        borderRadius: 14,
        background: NEX.panelSoft,
        border: `1px solid ${NEX.border}`,
      }}
    >
      <div
        style={{
          fontSize: 14,
          fontWeight: 700,
          marginBottom: 6,
          letterSpacing: "-0.003em",
        }}
      >
        {title}
      </div>
      <div style={{ fontSize: 13, lineHeight: 1.55, color: NEX.textDim }}>
        {body}
      </div>
    </div>
  );
}

function BottomCard({
  tone,
  children,
}: {
  tone: "cyan" | "red" | "green";
  children: React.ReactNode;
}) {
  const border =
    tone === "cyan"
      ? "rgba(0,175,255,0.35)"
      : tone === "red"
        ? "rgba(255,51,85,0.35)"
        : "rgba(22,214,107,0.35)";
  const bg =
    tone === "cyan"
      ? "rgba(0,175,255,0.08)"
      : tone === "red"
        ? "rgba(255,51,85,0.08)"
        : "rgba(22,214,107,0.08)";
  return (
    <div
      style={{
        marginTop: 26,
        padding: "18px 20px",
        borderRadius: 14,
        background: bg,
        border: `1px solid ${border}`,
      }}
    >
      {children}
    </div>
  );
}

const h1Style: React.CSSProperties = {
  margin: 0,
  fontFamily: SERIF,
  fontSize: 34,
  lineHeight: 1.12,
  fontWeight: 500,
  letterSpacing: "-0.012em",
  marginBottom: 12,
};

const ledeStyle: React.CSSProperties = {
  margin: "0 0 12px",
  fontSize: 14,
  lineHeight: 1.65,
  color: "rgba(244,247,252,0.88)",
};
