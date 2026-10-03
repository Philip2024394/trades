// src/app/nex-native/about/privacy/page.tsx
//
// NEX Privacy Policy · v1.2 · 2026-10-03.
// ---------------------------------------
// Supersedes the previous "privacy pledge" positioning page. Founder
// direction 2026-10-03:
//
//   · Technically precise, not aspirational. Describe what is
//     implemented today separately from what is planned.
//   · Match the visual language of Terms v1.2 (compact header,
//     numbered sections, dark navy palette).
//   · Do not claim E2E for areas that are not E2E today. In particular
//     Vault is currently session + RLS protected, NOT end-to-end
//     encrypted. Phase A is planned, not shipped.
//   · Distinguish peer text + personal media (E2E · Bridges 76 + 81)
//     from commerce media (deliberately plaintext · doctrine 2026-09-29)
//     from business<->customer chat (not E2E).
//   · No "unbreakable". No "nobody can see this". No "military-grade".
//     Observe the sealed banned-marketing list.
//
// Governed by:
//   · docs/doctrine/vault-build-plan-2026-10-03.md (Vault D1-D4)
//   · MEMORY: Phone-is-database doctrine (2026-09-29)
//   · MEMORY: Trust Scan evidence-not-accusation doctrine (2026-10-01)
//   · Terms of Use v1.2 (2026-10-03)
//
// This remains a plain-language policy authored in-house. Founder
// should replace with a lawyer-reviewed version before commercial
// launch outside a pilot audience, especially for jurisdictions with
// specific privacy legislation (EU GDPR, UK DPA, Indonesia PDP Law,
// California CCPA/CPRA, Brazil LGPD, etc.).

import Link from "next/link";

export const runtime = "nodejs";
export const dynamic = "force-static";

const NEX = {
  bg: "#020914",
  panel: "#03101D",
  text: "#F4F7FC",
  textDim: "#C8D4E4",
  textMute: "#8BA9D1",
  rule: "rgba(139, 169, 209, 0.18)",
  cyan: "#00AFFF",
  cyanSoft: "rgba(0,175,255,0.35)",
  orange: "#FF7200",
  // Soft chips for "implemented today" / "planned architecture" markers.
  liveChip: "rgba(34, 227, 122, 0.14)",
  liveChipText: "#4FE3A0",
  planChip: "rgba(255, 138, 42, 0.14)",
  planChipText: "#FFB166",
};

const SANS =
  "Inter, ui-sans-serif, system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif";

const VERSION = "v1.2";
const EFFECTIVE = "3 October 2026";

export default function PrivacyPolicyPage(): React.JSX.Element {
  return (
    <div
      style={{
        minHeight: "100dvh",
        background: NEX.bg,
        color: NEX.text,
        fontFamily: SANS,
      }}
    >
      <main
        style={{
          maxWidth: 720,
          margin: "0 auto",
          padding:
            "calc(env(safe-area-inset-top, 0) + 32px) 20px 72px",
          fontSize: 14,
          lineHeight: 1.65,
        }}
      >
        {/* ─── Document header · intentionally restrained ─────────── */}
        <header
          style={{
            paddingBottom: 18,
            marginBottom: 24,
            borderBottom: `1px solid ${NEX.rule}`,
          }}
        >
          <div
            style={{
              fontSize: 10.5,
              letterSpacing: "0.26em",
              textTransform: "uppercase",
              color: NEX.cyan,
              fontWeight: 700,
            }}
          >
            NEX · Legal
          </div>
          <h1
            style={{
              margin: "10px 0 6px",
              fontSize: 22,
              fontWeight: 600,
              letterSpacing: "-0.005em",
            }}
          >
            NEX Privacy Policy
          </h1>
          <div
            style={{
              fontSize: 12,
              color: NEX.textMute,
              letterSpacing: "0.02em",
            }}
          >
            Version {VERSION} · Effective date: {EFFECTIVE}
          </div>
        </header>

        {/* ─── Preamble ───────────────────────────────────────────── */}
        <p style={paraStyle}>
          This Privacy Policy describes how NEX collects, stores, uses
          and protects information when you use NEX, including NEX Chat,
          NEX Business, NEX Products, NEX Vault, FaceCover Store and
          related NEX services.
        </p>
        <p style={paraStyle}>
          It should be read alongside the{" "}
          <Link
            href="/nex-native/about/terms"
            style={{ color: NEX.orange, textDecoration: "underline", fontWeight: 600 }}
          >
            NEX Terms of Use
          </Link>
          .
        </p>
        <p style={{ ...paraStyle, fontStyle: "italic", color: NEX.textDim }}>
          NEX is designed around a simple commitment: we do not sell your
          personal information, and we do not build NEX by selling your
          private life to advertisers or data brokers. We also will not
          claim access to information that NEX's technical architecture
          does not provide us with access to.
        </p>

        {/* ─── Reading the badges ─────────────────────────────────── */}
        <section
          data-nex-privacy-reading-guide
          style={{
            margin: "16px 0 10px",
            padding: "12px 14px",
            background: NEX.panel,
            border: `1px solid ${NEX.rule}`,
            borderRadius: 10,
            fontSize: 12.5,
            color: NEX.textDim,
            lineHeight: 1.55,
          }}
        >
          <p style={{ margin: 0, fontWeight: 600, color: NEX.text }}>
            How to read this document
          </p>
          <p style={{ margin: "6px 0 0" }}>
            Where the security characteristics of a feature differ from
            its planned future form, we label the current state{" "}
            <LiveTag inline /> and the planned architecture <PlanTag inline />.
            A feature is only &ldquo;Implemented today&rdquo; if the
            underlying code has been written and verified.
          </p>
        </section>

        {/* ─── Sections ───────────────────────────────────────────── */}

        <Section num={1} title="Scope">
          <p style={paraStyle}>
            This policy applies to information processed by NEX when you
            use the NEX services. It does not apply to third-party apps,
            websites, operating systems, payment providers, app stores
            or networks you may interact with alongside NEX. Those
            services have their own privacy terms.
          </p>
        </Section>

        <Section num={2} title="Information we collect">
          <p style={paraStyle}>
            We collect information you provide to us directly, information
            that is generated by your use of NEX, and limited information
            that we need to operate the platform safely.
          </p>

          <SubHead>Information you provide</SubHead>
          <List
            items={[
              "account identifiers (email, phone number, NEX handle);",
              "display name, avatar, and theme choice;",
              "profile fields you choose to add;",
              "the content of messages, images, videos, voice notes, documents and other items you send, publish or store through NEX;",
              "business and FaceCover content you publish;",
              "support, report and feedback submissions you send to us;",
              "any identity-verification material you provide for business or trust features.",
            ]}
          />

          <SubHead>Information generated by your use of NEX</SubHead>
          <List
            items={[
              "cryptographic public keys registered by your device;",
              "device key fingerprints associated with your account;",
              "a server-side session identifier associated with your signed-in session;",
              "the fact that two accounts are participants of a conversation (not the contents of the messages, where encrypted);",
              "timestamps necessary for message delivery, read-receipts, and sort order;",
              "operational metrics required for service reliability (error traces, request timings, worker-health signals);",
              "aggregate counts needed for product analytics (see §10);",
              "safety signals generated by the platform (see §9).",
            ]}
          />

          <SubHead>Information we may collect for safety and verification</SubHead>
          <List
            items={[
              "limited device-environment signals used only to detect fraud and abuse (see §9);",
              "verification material (where you choose to verify a business or submit identity for a trust feature);",
              "transaction and dispute information where NEX is involved in a transaction or dispute;",
              "records of reports made by or about an account.",
            ]}
          />
        </Section>

        <Section num={3} title="Information we do not collect">
          <p style={paraStyle}>
            NEX is designed to minimise collection. We do not currently
            collect:
          </p>
          <List
            items={[
              "advertising identifiers from third-party ad networks;",
              "biometric templates (face, fingerprint, voiceprint) for cross-user matching;",
              "the plaintext content of end-to-end encrypted peer messages or encrypted personal media (see §5–§6);",
              "payment card numbers (NEX itself does not process card payments; see §13);",
              "browsing history outside the NEX application;",
              "contacts from your device's address book without your deliberate action;",
              "ambient audio or video from your device.",
            ]}
          />
        </Section>

        <Section num={4} title="Where your information is stored">
          <p style={paraStyle}>
            NEX runs on managed cloud infrastructure. Our primary
            backend is a Supabase project (PostgreSQL + object storage +
            authentication). Operational logs, product analytics and
            service-reliability telemetry may be processed by the
            infrastructure providers identified in §12.
          </p>
          <p style={paraStyle}>
            Within our backend:
          </p>
          <List
            items={[
              "account information and relationships live in dedicated database tables with row-level security (RLS) policies that limit access to the owning account;",
              "end-to-end encrypted peer messages are stored as ciphertext only — the server does not hold a copy of the readable plaintext;",
              "end-to-end encrypted personal media is stored as ciphertext in a dedicated object bucket; see §5;",
              "commerce media (shop photos, product images, menu items, cart screenshots, shared product cards) is deliberately stored in a server-readable form so that cold visitors to a public shop or menu can render the content; see §8;",
              "Vault entries and Vault files are stored in dedicated private storage with owner-scoped RLS; today they are not end-to-end encrypted (see §7 and §21).",
            ]}
          />
        </Section>

        <Section num={5} title="What NEX can and cannot technically access">
          <p style={paraStyle}>
            Different NEX services have different security
            characteristics. The lists below describe what is{" "}
            <strong style={{ color: NEX.text }}>implemented today</strong>.
          </p>

          <SubHead>What NEX cannot technically access today</SubHead>
          <List
            items={[
              "the plaintext of peer text messages sent between individual NEX accounts (encrypted with nacl.box on your device · Bridges 76+);",
              "the bytes of encrypted personal media attachments on peer messages (image, video, audio · envelope-encrypted with nacl.secretbox + per-recipient key wrapping · Bridge 81);",
              "the audio or video of a peer voice or video call (WebRTC peer-to-peer · NEX servers relay only connection-setup signals · Bridges 68-69);",
              "any private cryptographic key held on your device.",
            ]}
          />

          <SubHead>What NEX can technically access today</SubHead>
          <p style={paraStyle}>
            NEX servers can read:
          </p>
          <List
            items={[
              "account identifiers, display names, avatars and theme choices;",
              "the fact that two accounts are participants of a conversation (participation metadata);",
              "message timestamps and read-receipt flags;",
              "the content of customer-to-business chat messages where that channel is not end-to-end encrypted (see §7);",
              "commerce media (shop photos, product images, menus) because that content is intended to be publicly discoverable;",
              "Vault entries and Vault files, because Vault today uses session-based access and database row-level security rather than end-to-end encryption (see §7 and §21);",
              "logs, telemetry and safety signals necessary to operate the platform.",
            ]}
          />
          <p style={paraStyle}>
            Being able to read a particular class of information does
            not mean NEX will read it. Access is scoped to what is
            necessary to operate, secure and protect the platform, and
            to comply with lawful obligations.
          </p>
        </Section>

        <Section num={6} title="End-to-end encryption · scope and limits">
          <p style={paraStyle}>
            Where NEX provides end-to-end encrypted communication, the
            encryption architecture is designed to prevent NEX from
            accessing the readable contents of that communication.
          </p>
          <p style={paraStyle}>
            However, end-to-end encryption only protects the contents
            of the communication while it is in transit and at rest on
            the server. It does not protect you from:
          </p>
          <List
            items={[
              "someone who gains physical or malware-based access to your device;",
              "someone to whom you deliberately show your screen;",
              "a counterparty who screenshots, copies, forwards or re-shares a message you sent to them;",
              "weak device passcodes or lock-screen protection;",
              "backups of your device created by services outside NEX (e.g. operating-system cloud backups);",
              "a device compromised by spyware or by an unauthorised physical actor.",
            ]}
          />
          <p style={paraStyle}>
            NEX does not describe any feature as &ldquo;unbreakable&rdquo;.
            No internet-connected system can honestly make such a claim.
          </p>
        </Section>

        <Section num={7} title="NEX Chat vs NEX Vault">
          <p style={paraStyle}>
            <strong style={{ color: NEX.text }}>NEX Chat</strong> is the
            messaging surface used to communicate with other NEX users
            and with businesses.
          </p>
          <List
            items={[
              "Peer-to-peer messages between individual NEX accounts are end-to-end encrypted for text and for personal media (image/video/audio).",
              "Commerce media (product cards, shared menu items, cart orders, product shares) is intentionally stored server-readable so that catalogue views work for cold visitors. Doctrine sealed 2026-09-29.",
              "Customer-to-business chat messages are not currently end-to-end encrypted. NEX may process these messages so that the business can receive and reply to them from its dashboard.",
              "Voice and video calls between individual NEX accounts run peer-to-peer; NEX servers relay only the signalling needed to set up the connection.",
            ]}
          />
          <p style={paraStyle}>
            <strong style={{ color: NEX.text }}>NEX Vault</strong> is a
            private space inside NEX for people, conversations,
            documents, photographs, videos, plans and notes you choose
            to move there.
          </p>
          <p style={paraStyle}>
            <LiveTag /> Vault today uses:
          </p>
          <List
            items={[
              "database row-level security policies that restrict reads and writes to the owning account;",
              "owner-scoped storage policies on the private Vault file bucket;",
              "short-lived signed URLs for file downloads (default 60-second expiry);",
              "a prototype six-digit PIN entry screen for the Vault doorway.",
            ]}
          />
          <p style={paraStyle}>
            <strong style={{ color: NEX.text }}>
              What this does not do today:
            </strong>{" "}
            Vault is not currently end-to-end encrypted. NEX service-role
            credentials, used by our backend processes, can technically
            read Vault bytes. The six-digit PIN entry is a prototype and
            is not currently a cryptographic authentication boundary.
            This is stated plainly in the Vault settings screen as well.
          </p>
          <p style={paraStyle}>
            <PlanTag /> The planned Vault security architecture
            introduces client-side encryption with keys that NEX never
            holds. We will update this policy and surface in-app
            notices when that architecture is actually implemented and
            independently verified. Users should not assume it is
            active until it is identified as active.
          </p>
        </Section>

        <Section num={8} title="Public business and FaceCover content">
          <p style={paraStyle}>
            If you create a Business NEX profile, publish a product,
            menu, service, FaceCover entry or similar public content,
            that content is intended to be discoverable by other users.
          </p>
          <p style={paraStyle}>
            Public business content may include business names,
            descriptions, prices, photographs, menus, locations, opening
            information and other information you intentionally publish.
          </p>
          <p style={paraStyle}>
            This content is treated differently from private peer
            communications: it is stored server-readable so that cold
            visitors (people who have not yet signed into NEX) can
            render your public pages. You should assume that anything
            you publish publicly is visible to anyone with the link or
            through NEX discovery.
          </p>
        </Section>

        <Section num={9} title="Trust &amp; Safety information">
          <p style={paraStyle}>
            NEX operates systems designed to reduce fraud, scams, spam,
            impersonation, unauthorised access and other threats to the
            community.
          </p>
          <p style={paraStyle}>
            For those purposes we may process:
          </p>
          <List
            items={[
              "limited device-environment signals used only to detect fraud and abuse;",
              "account activity rates, in order to detect spam and unauthorised access;",
              "report records (what was reported, by whom, when);",
              "verification material that you choose to submit for a trust feature;",
              "transaction and dispute information where NEX is involved in a transaction.",
            ]}
          />
          <p style={paraStyle}>
            NEX Trust features are intended to surface information and
            safety signals. They are not a guarantee that another user
            is trustworthy, that a business is legitimate or that a
            transaction will be safe. Automated signals and user
            reports are treated as evidence, not as a definitive
            judgement about a person. Where information is incomplete,
            we will identify it as unknown rather than guessing.
          </p>
        </Section>

        <Section num={10} title="Analytics and telemetry">
          <p style={paraStyle}>
            NEX processes limited product analytics and reliability
            telemetry to understand which parts of the platform work,
            which fail, and where to invest engineering time.
          </p>
          <p style={paraStyle}>
            Our analytics are designed to be aggregate and operational
            rather than individually targeted. We do not use NEX
            analytics to profile you for third-party advertising.
          </p>
          <p style={paraStyle}>
            Current providers used for analytics and performance
            measurement are identified in §12.
          </p>
        </Section>

        <Section num={11} title="Cookies and local storage">
          <p style={paraStyle}>
            NEX uses cookies and browser or device local storage for
            purposes that are strictly necessary to operate the
            service. Current uses include:
          </p>
          <List
            items={[
              "a session cookie set by our authentication provider so that you remain signed in across page loads;",
              "a NEX session identifier used for the first-conversation signup flow;",
              "limited local-storage entries used to remember UI state (such as cart contents on a seller page or theme selections);",
              "service-worker caching so that the application can load reliably.",
            ]}
          />
          <p style={paraStyle}>
            NEX does not use advertising cookies, cross-site tracking
            cookies or cookies that measure your behaviour on websites
            outside NEX.
          </p>
        </Section>

        <Section num={12} title="Third-party service providers">
          <p style={paraStyle}>
            To operate NEX we rely on carefully selected third-party
            infrastructure providers. These providers process
            information only as necessary to deliver their service to
            us and are subject to their own privacy terms.
          </p>
          <p style={paraStyle}>Current providers include:</p>
          <List
            items={[
              "Supabase · managed database, object storage and authentication for the primary NEX backend;",
              "Vercel · application hosting, edge delivery and performance / analytics instrumentation;",
              "the operators of the push-notification services on your device's operating system;",
              "payment providers identified at the point of purchase (see §13);",
              "email delivery providers used for account-related notifications;",
              "transit providers (ISPs, mobile networks, app stores) that are inherently involved when any internet-connected service is used.",
            ]}
          />
          <p style={paraStyle}>
            This list may change as NEX evolves. Where a change is
            material, we will update this policy per §21.
          </p>
        </Section>

        <Section num={13} title="Payments">
          <p style={paraStyle}>
            NEX does not currently process card payments itself. Where
            NEX offers a paid service, the payment is handled by an
            identified payment provider at the time of purchase and is
            governed by that provider's terms.
          </p>
          <p style={paraStyle}>
            Where two users or businesses arrange payment directly
            between themselves (for example, in a seller-to-buyer
            transaction arranged inside NEX Chat), NEX is not
            automatically a party to that transaction and does not hold
            the payment credentials used.
          </p>
          <p style={paraStyle}>
            NEX will not ask you to transfer money through an
            unofficial personal account in order to obtain support.
          </p>
        </Section>

        <Section num={14} title="Retention">
          <p style={paraStyle}>
            We retain information for as long as reasonably necessary
            to:
          </p>
          <List
            items={[
              "operate the services you use;",
              "maintain account continuity across devices;",
              "deliver messages reliably;",
              "operate safety and anti-abuse systems;",
              "handle disputes;",
              "meet legal, accounting or regulatory obligations.",
            ]}
          />
          <p style={paraStyle}>
            Where a specific feature carries its own retention rule
            (for example, delivery queues that purge after successful
            delivery), that rule is applied in addition to the general
            rule above.
          </p>
        </Section>

        <Section num={15} title="Deletion and account closure">
          <p style={paraStyle}>
            You may request closure of your account at any time.
          </p>
          <p style={paraStyle}>
            Account closure removes your account and the content you
            own from the active NEX surfaces. Some information may be
            retained temporarily where retention is necessary for
            security, fraud prevention, dispute resolution or legal
            compliance, as described in §14.
          </p>
          <p style={paraStyle}>
            Where NEX's technical architecture prevents us from
            holding readable copies of your end-to-end encrypted content,
            we also cannot retrieve or restore that content. If you lose
            your device without a prior export or key backup, the
            content held only on that device may be unrecoverable.
          </p>
          <p style={paraStyle}>
            <PlanTag /> The planned Vault security architecture will
            make Vault deletion a cryptographic erasure (removing the
            key material required to decrypt the stored bytes) rather
            than a simple row-level deletion. Until that is
            implemented, Vault deletion is a database-level deletion.
          </p>
        </Section>

        <Section num={16} title="Legal requests">
          <p style={paraStyle}>
            NEX will respond to valid legal process in the
            jurisdictions in which it operates. We will not disclose
            information to law enforcement or private parties except
            where required by applicable law or by a valid legal
            process we are legally obliged to honour.
          </p>
          <p style={paraStyle}>
            Where NEX's technical architecture prevents us from
            accessing particular information, we cannot produce it in
            response to a legal request. We will not misrepresent our
            technical ability to access content we cannot access.
          </p>
          <p style={paraStyle}>
            Where legally permitted, we will seek to narrow the scope
            of any production to the specific accounts, timeframes and
            categories identified in the request.
          </p>
        </Section>

        <Section num={17} title="International users and data transfers">
          <p style={paraStyle}>
            NEX's infrastructure providers operate globally. Processing
            of information may occur in jurisdictions other than the one
            in which you are located.
          </p>
          <p style={paraStyle}>
            Where applicable law requires specific safeguards for
            international data transfers (for example, the EU, the
            United Kingdom, Indonesia under the PDP Law, Brazil under
            LGPD, or similar frameworks), we will take reasonable steps
            to apply those safeguards through our provider contracts
            and operational practices.
          </p>
        </Section>

        <Section num={18} title="Children and minors">
          <p style={paraStyle}>
            NEX is not designed for use by children below the minimum
            age established by applicable law in the jurisdiction in
            which the user is located.
          </p>
          <p style={paraStyle}>
            Where NEX becomes aware that an account belongs to a user
            below that minimum age, we may suspend or close the account
            and delete associated information except where retention
            is legally required.
          </p>
          <p style={paraStyle}>
            Parents and guardians who believe a minor has created a NEX
            account without consent may contact NEX through the
            in-application support channel described in §21 of the
            Terms of Use.
          </p>
        </Section>

        <Section num={19} title="Your rights">
          <p style={paraStyle}>
            Depending on the jurisdiction in which you are located, you
            may have rights with respect to the personal information
            NEX holds about you, including rights to:
          </p>
          <List
            items={[
              "access the personal information NEX holds about you;",
              "correct inaccurate personal information;",
              "request deletion of personal information, subject to the limits described in §14 and §15;",
              "object to or restrict certain processing;",
              "receive certain information in a portable form;",
              "withdraw consent, where processing was based on consent;",
              "lodge a complaint with a competent supervisory authority.",
            ]}
          />
          <p style={paraStyle}>
            To exercise these rights, use the in-application NEX
            support channel. Where NEX cannot verify that a request
            comes from the account holder, we may ask for additional
            verification before acting on it.
          </p>
        </Section>

        <Section num={20} title="Security limitations">
          <p style={paraStyle}>
            NEX takes reasonable measures to protect the information it
            processes, including encryption-in-transit, encryption-at-rest
            on managed infrastructure, access control, row-level
            security policies and operational monitoring.
          </p>
          <p style={paraStyle}>
            Nothing in this policy is a guarantee that:
          </p>
          <List
            items={[
              "a particular NEX feature is impossible to breach;",
              "every third-party provider operates without incident;",
              "a device compromised outside NEX will not expose information held on that device;",
              "a particular future security mechanism has already been implemented.",
            ]}
          />
          <p style={paraStyle}>
            No internet-connected system can honestly make absolute
            guarantees. Where we identify a material security incident
            affecting NEX user information, we will respond in
            accordance with applicable law and operational best
            practice.
          </p>
        </Section>

        <Section num={21} title="Future changes and planned architecture">
          <p style={paraStyle}>
            NEX will develop its services. Where a change materially
            affects:
          </p>
          <List
            items={[
              "what information NEX collects;",
              "how private communications are handled;",
              "the security architecture of a service;",
              "third-party processors used by NEX;",
              "the retention rules applied to a category of information;",
              "or your rights under this policy,",
            ]}
          />
          <p style={paraStyle}>
            NEX will update this policy and provide appropriate notice
            where required by applicable law. The version number and
            effective date will be updated when material changes are
            made.
          </p>
          <p style={paraStyle}>
            <PlanTag /> Planned future architecture (not currently
            implemented): client-side end-to-end encryption for NEX
            Vault, cryptographic deletion for Vault items, and a
            production-grade cryptographic Vault PIN authentication
            boundary. These are planned, not shipped. Until they are
            identified as active, users should assume that today's
            architecture (session + row-level security) governs Vault
            data.
          </p>
        </Section>

        {/* ─── Terms pointer + footer ─────────────────────────────── */}
        <section style={{ marginTop: 36 }}>
          <h2 style={h2Style}>Terms of Use</h2>
          <p style={paraStyle}>
            This Privacy Policy should be read alongside the{" "}
            <Link
              href="/nex-native/about/terms"
              style={{ color: NEX.orange, textDecoration: "underline", fontWeight: 600 }}
            >
              NEX Terms of Use
            </Link>
            .
          </p>
        </section>

        <footer
          style={{
            marginTop: 24,
            paddingTop: 20,
            borderTop: `1px solid ${NEX.rule}`,
            color: NEX.textMute,
          }}
        >
          <div style={{ fontSize: 11, letterSpacing: "0.04em" }}>
            Privacy Policy · {VERSION} · Effective {EFFECTIVE}
          </div>
          <div
            style={{
              marginTop: 20,
              display: "flex",
              flexWrap: "wrap",
              gap: 12,
            }}
          >
            <Link
              href="/nex-native/about/terms"
              style={{
                padding: "10px 18px",
                borderRadius: 10,
                background: NEX.orange,
                color: "#0B0F1A",
                fontSize: 12.5,
                fontWeight: 700,
                letterSpacing: "0.03em",
                textDecoration: "none",
              }}
            >
              Read the Terms of Use
            </Link>
            <Link
              href="/nex-native/create-account"
              style={{
                padding: "10px 18px",
                borderRadius: 10,
                background: "transparent",
                color: NEX.text,
                fontSize: 12.5,
                fontWeight: 600,
                letterSpacing: "0.03em",
                textDecoration: "none",
                border: `1px solid ${NEX.cyanSoft}`,
              }}
            >
              Create account
            </Link>
          </div>
        </footer>
      </main>
    </div>
  );
}

/* ─────────────────────────────────────────────────────────────────── *
 * Helpers                                                              *
 * ─────────────────────────────────────────────────────────────────── */

const paraStyle: React.CSSProperties = {
  margin: "0 0 12px",
  fontSize: 14,
  lineHeight: 1.65,
  color: NEX.textDim,
};

const h2Style: React.CSSProperties = {
  margin: "0 0 10px",
  fontSize: 15,
  fontWeight: 600,
  letterSpacing: "-0.002em",
  color: NEX.text,
};

const subHeadStyle: React.CSSProperties = {
  margin: "14px 0 6px",
  fontSize: 12,
  fontWeight: 700,
  letterSpacing: "0.08em",
  textTransform: "uppercase",
  color: NEX.textMute,
};

function Section({
  num,
  title,
  children,
}: {
  num: number;
  title: string;
  children: React.ReactNode;
}): React.JSX.Element {
  return (
    <section
      data-nex-privacy-section={num}
      style={{
        marginTop: 28,
        marginBottom: 4,
        scrollMarginTop: 24,
      }}
      id={`s${num}`}
    >
      <h2 style={h2Style}>
        <span
          style={{
            color: NEX.cyan,
            marginRight: 10,
            fontVariantNumeric: "tabular-nums",
          }}
        >
          §{num}
        </span>
        {title}
      </h2>
      <div>{children}</div>
    </section>
  );
}

function SubHead({ children }: { children: React.ReactNode }): React.JSX.Element {
  return <p style={subHeadStyle}>{children}</p>;
}

function List({ items }: { items: string[] }): React.JSX.Element {
  return (
    <ul
      style={{
        margin: "0 0 12px",
        paddingLeft: 20,
        color: NEX.textDim,
      }}
    >
      {items.map((it, i) => (
        <li key={i} style={{ marginBottom: 4, fontSize: 14, lineHeight: 1.6 }}>
          {it}
        </li>
      ))}
    </ul>
  );
}

function LiveTag({ inline = false }: { inline?: boolean }): React.JSX.Element {
  return (
    <span
      data-nex-privacy-tag="live"
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 4,
        padding: inline ? "1px 7px" : "2px 8px",
        borderRadius: 999,
        background: NEX.liveChip,
        color: NEX.liveChipText,
        border: `1px solid ${NEX.liveChip}`,
        fontSize: 10.5,
        fontWeight: 700,
        letterSpacing: "0.08em",
        textTransform: "uppercase",
        verticalAlign: inline ? "baseline" : "middle",
      }}
    >
      Implemented today
    </span>
  );
}

function PlanTag({ inline = false }: { inline?: boolean }): React.JSX.Element {
  return (
    <span
      data-nex-privacy-tag="planned"
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 4,
        padding: inline ? "1px 7px" : "2px 8px",
        borderRadius: 999,
        background: NEX.planChip,
        color: NEX.planChipText,
        border: `1px solid ${NEX.planChip}`,
        fontSize: 10.5,
        fontWeight: 700,
        letterSpacing: "0.08em",
        textTransform: "uppercase",
        verticalAlign: inline ? "baseline" : "middle",
      }}
    >
      Planned architecture
    </span>
  );
}
