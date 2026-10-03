// src/app/nex-native/about/terms/page.tsx
//
// NEX Terms of Use · v1.2 · 2026-10-03.
// -------------------------------------
// Founder direction 2026-10-03 after the Vault session:
//   · Smaller professional header, numbered sections, legal-document
//     feel rather than marketing display.
//   · Technically honest. The prior v1.1 claimed every message was E2E
//     encrypted on-device; that claim is only true where the underlying
//     implementation has been independently verified. Vault in
//     particular is session + RLS protected, NOT yet E2E. The copy here
//     reflects that.
//   · No absolute promises. No "unbreakable". No "we can access
//     anything we need". NEX retains operational authority to run the
//     platform without claiming access to content its architecture
//     does not expose to it.
//
// This remains a plain-language terms document. Founder should replace
// with a legally-reviewed version before any commercial launch outside
// a pilot audience.

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
};

const SANS =
  "Inter, ui-sans-serif, system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif";

const VERSION = "v1.2";
const EFFECTIVE = "3 October 2026";

export default function TermsOfUsePage(): React.JSX.Element {
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
            NEX Terms of Use
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
          These Terms of Use govern your use of NEX, including NEX Chat,
          NEX Business, NEX Products, FaceCover Store and related NEX
          services.
        </p>
        <p style={paraStyle}>
          By creating or using a NEX account, you agree to these Terms
          and to the{" "}
          <Link
            href="/nex-native/about/privacy"
            style={{ color: NEX.orange, textDecoration: "underline", fontWeight: 600 }}
          >
            NEX Privacy Policy
          </Link>
          .
        </p>
        <p style={{ ...paraStyle, fontStyle: "italic", color: NEX.textDim }}>
          NEX is designed around a simple principle: NEX provides the
          platform. You control your conversations, relationships and
          content, subject to the rights and responsibilities described
          in these Terms.
        </p>

        {/* ─── Sections ───────────────────────────────────────────── */}
        <Section num={1} title="What NEX is">
          <p style={paraStyle}>
            NEX is a communication, discovery, business and commerce
            platform.
          </p>
          <p style={paraStyle}>
            Depending on the services available to you, NEX may allow
            you to:
          </p>
          <List
            items={[
              "communicate with other NEX users;",
              "create and manage a personal NEX profile;",
              "discover businesses, products and services;",
              "communicate with businesses through NEX Chat;",
              "create or manage a Business NEX presence;",
              "publish products, services, menus or other business information;",
              "use NEX Vault and other private-space features;",
              "use FaceCover Store and related product experiences; and",
              "access additional NEX services introduced in the future.",
            ]}
          />
          <p style={paraStyle}>
            Different NEX services may have different technical,
            privacy, storage and security characteristics. NEX will
            describe material differences where they apply.
          </p>
        </Section>

        <Section num={2} title="Your content">
          <p style={paraStyle}>
            You retain your rights in content that you create and submit
            to NEX, subject to the licences and permissions reasonably
            necessary for NEX to operate the services.
          </p>
          <p style={paraStyle}>
            You are responsible for the content you submit, publish,
            send, store or otherwise make available through NEX.
          </p>
          <p style={paraStyle}>You must not use NEX to:</p>
          <List
            items={[
              "violate applicable law;",
              "infringe another person's rights;",
              "impersonate another person or business;",
              "distribute malware or malicious code;",
              "conduct fraud or scams;",
              "send unlawful or abusive communications;",
              "conduct unauthorized bulk messaging;",
              "interfere with NEX systems; or",
              "attempt to gain unauthorized access to another user's account, data or private content.",
            ]}
          />
        </Section>

        <Section num={3} title="NEX's role and control of the platform">
          <p style={paraStyle}>
            NEX operates and controls the NEX platform, its
            infrastructure, software, security systems, moderation
            systems, account systems and service rules.
          </p>
          <p style={paraStyle}>
            NEX may take reasonable measures necessary to:
          </p>
          <List
            items={[
              "operate and maintain the platform;",
              "protect users and NEX systems;",
              "prevent fraud, spam, abuse and unauthorized access;",
              "investigate security incidents;",
              "enforce these Terms;",
              "investigate reports and disputes;",
              "comply with applicable law or valid legal process;",
              "suspend or restrict accounts or services where reasonably necessary; and",
              "protect the rights, property and safety of NEX, its users and third parties.",
            ]}
          />
          <p style={paraStyle}>
            This operational authority does not mean that NEX owns your
            private conversations or personal content.
          </p>
          <p style={paraStyle}>
            Where NEX's technical architecture prevents NEX from
            accessing particular content, NEX will not represent that it
            can access that content.
          </p>
        </Section>

        <Section num={4} title="Privacy">
          <p style={paraStyle}>
            NEX does not sell personal information to advertisers, data
            brokers or other companies for their own marketing purposes.
          </p>
          <p style={paraStyle}>
            NEX does not intend to build its business by selling users'
            private conversations, photographs, videos, voice
            communications or personal information.
          </p>
          <p style={paraStyle}>
            NEX will not use private communications to train third-party
            AI models.
          </p>
          <p style={paraStyle}>
            NEX may collect, process and retain information that is
            reasonably necessary to operate, secure, maintain, improve
            and protect the platform, subject to the NEX Privacy Policy
            and applicable law.
          </p>
          <p style={paraStyle}>NEX may also process information required for:</p>
          <List
            items={[
              "account administration;",
              "authentication;",
              "security;",
              "fraud and abuse prevention;",
              "customer support;",
              "business verification;",
              "transaction and dispute handling;",
              "legal compliance;",
              "service reliability; and",
              "other purposes disclosed in the NEX Privacy Policy.",
            ]}
          />
          <p style={paraStyle}>NEX does not sell your personal information.</p>
        </Section>

        <Section num={5} title="Communications and security">
          <p style={paraStyle}>
            NEX provides communication services designed to protect user
            communications.
          </p>
          <p style={paraStyle}>
            The security characteristics of a communication depend on
            the particular NEX service being used.
          </p>
          <p style={paraStyle}>
            Where NEX provides end-to-end encrypted communication, the
            encryption architecture is intended to prevent NEX from
            accessing the readable contents of that communication.
          </p>
          <p style={paraStyle}>
            However, NEX does not make a blanket claim that every NEX
            feature, storage area or future service is end-to-end
            encrypted.
          </p>
          <p style={paraStyle}>
            For example, NEX Vault may contain features with separate
            storage and security architecture. The security
            characteristics applicable to Vault will be described in the
            relevant NEX Privacy and Security documentation.
          </p>
          <p style={paraStyle}>
            Users should not assume that information is end-to-end
            encrypted merely because it appears inside the NEX
            application.
          </p>
        </Section>

        <Section num={6} title="NEX Vault">
          <p style={paraStyle}>
            NEX Vault is designed as a private space within NEX.
          </p>
          <p style={paraStyle}>Vault may allow you to keep selected:</p>
          <List
            items={[
              "people;",
              "conversations;",
              "photographs;",
              "videos;",
              "documents;",
              "files;",
              "plans;",
              "notes;",
              "other private material; and",
              "future Vault services.",
            ]}
          />
          <p style={paraStyle}>
            Vault security is separate from ordinary NEX account access.
          </p>
          <p style={paraStyle}>
            NEX may introduce additional encryption, device-security,
            recovery and authentication mechanisms for Vault.
          </p>
          <p style={paraStyle}>
            Until a particular security mechanism is expressly
            identified as active, users should not assume that it has
            been implemented.
          </p>
          <p style={paraStyle}>
            NEX will not describe a Vault feature as &ldquo;unbreakable&rdquo;
            or make an absolute guarantee that no unauthorized access is
            technically possible.
          </p>
        </Section>

        <Section num={7} title="Business and publicly discoverable content">
          <p style={paraStyle}>
            If you create a Business NEX profile or publish a product,
            service, restaurant, menu, shop, FaceCover product or other
            public business information, you understand that this
            information is intended to be discoverable by other users.
          </p>
          <p style={paraStyle}>Public business content may include:</p>
          <List
            items={[
              "business names;",
              "descriptions;",
              "product information;",
              "prices;",
              "photographs;",
              "menus;",
              "locations;",
              "opening information;",
              "contact information; and",
              "other information you intentionally publish.",
            ]}
          />
          <p style={paraStyle}>
            This information is different from private peer
            communications.
          </p>
          <p style={paraStyle}>
            You are responsible for ensuring that information you
            publish publicly is accurate and that you have the rights
            necessary to publish it.
          </p>
        </Section>

        <Section num={8} title="NEX Chat and customer service">
          <p style={paraStyle}>
            NEX Chat may be used by businesses and customers to
            communicate directly.
          </p>
          <p style={paraStyle}>
            Where a business provides customer service through NEX Chat,
            users should verify that they are communicating with the
            intended business account.
          </p>
          <p style={paraStyle}>
            NEX does not require customers to disclose passwords, PINs,
            recovery phrases, private encryption keys or other
            authentication secrets through customer-service
            conversations.
          </p>
          <p style={paraStyle}>
            NEX will never ask you to disclose your NEX Vault PIN or
            recovery credentials through an ordinary customer-service
            conversation.
          </p>
          <p style={paraStyle}>
            Users should be cautious of anyone requesting payment
            credentials, recovery information or account secrets while
            claiming to represent NEX.
          </p>
        </Section>

        <Section num={9} title="Payments">
          <p style={paraStyle}>
            NEX may introduce paid subscriptions, products, business
            services, themes or other paid features.
          </p>
          <p style={paraStyle}>
            The payment method, payment provider and applicable payment
            terms will be identified at the time of purchase.
          </p>
          <p style={paraStyle}>
            NEX will not ask users to transfer money through an
            unofficial personal account merely to obtain customer
            support.
          </p>
          <p style={paraStyle}>
            Where NEX itself processes a payment, the applicable payment
            provider and payment terms will govern the transaction.
          </p>
          <p style={paraStyle}>
            Where two users or businesses arrange payment directly
            between themselves, NEX is not automatically a party to that
            transaction.
          </p>
          <p style={paraStyle}>
            NEX does not guarantee the quality, legality, delivery or
            performance of goods or services supplied by an independent
            seller unless NEX expressly states otherwise.
          </p>
        </Section>

        <Section num={10} title="No sale of personal information">
          <p style={paraStyle}>
            NEX's business model is not based on selling users' personal
            information.
          </p>
          <p style={paraStyle}>NEX does not sell personal information.</p>
          <p style={paraStyle}>
            NEX also does not grant advertisers or unrelated third
            parties unrestricted access to private NEX communications
            for their own purposes.
          </p>
          <p style={paraStyle}>
            Where third-party service providers are required to operate
            NEX, they may process information only as necessary to
            provide the relevant service and subject to applicable
            contractual, security and privacy requirements.
          </p>
          <p style={paraStyle}>
            Further information is provided in the NEX Privacy Policy.
          </p>
        </Section>

        <Section num={11} title="Safety, Trust and fraud prevention">
          <p style={paraStyle}>
            NEX may operate safety systems designed to identify and
            reduce:
          </p>
          <List
            items={[
              "fraud;",
              "scams;",
              "spam;",
              "impersonation;",
              "account abuse;",
              "malicious activity;",
              "suspicious transactions;",
              "unauthorized access; and",
              "other threats to the NEX community.",
            ]}
          />
          <p style={paraStyle}>
            NEX may use limited account, activity, verification,
            transaction and community-safety information for these
            purposes.
          </p>
          <p style={paraStyle}>
            NEX Trust features are intended to provide information and
            safety signals.
          </p>
          <p style={paraStyle}>
            They are not a guarantee that another user is trustworthy,
            that a business is legitimate, or that a transaction will be
            safe.
          </p>
          <p style={paraStyle}>
            NEX will not treat an automated signal or user report alone
            as definitive proof that a person is dishonest, fraudulent
            or unsafe.
          </p>
          <p style={paraStyle}>
            Where information is incomplete or unavailable, NEX may
            identify that information as unknown.
          </p>
        </Section>

        <Section num={12} title="Reports, investigations and enforcement">
          <p style={paraStyle}>NEX may investigate reports concerning:</p>
          <List
            items={[
              "abuse;",
              "fraud;",
              "scams;",
              "impersonation;",
              "illegal activity;",
              "security incidents;",
              "intellectual-property complaints;",
              "unauthorized access;",
              "violations of these Terms; and",
              "threats to users or the platform.",
            ]}
          />
          <p style={paraStyle}>
            NEX may take action that it reasonably considers necessary,
            including warnings, restrictions, suspension, removal of
            public content, disabling features or closing accounts.
          </p>
          <p style={paraStyle}>
            Where legally permitted and technically possible, NEX will
            seek to limit action to the affected account, content or
            service rather than unnecessarily affecting unrelated users.
          </p>
        </Section>

        <Section num={13} title="Account security">
          <p style={paraStyle}>
            You are responsible for maintaining the security of your
            account and devices.
          </p>
          <p style={paraStyle}>You should:</p>
          <List
            items={[
              "use a strong unique password;",
              "keep your devices updated;",
              "protect your authentication credentials;",
              "never disclose your Vault PIN or recovery credentials;",
              "avoid sharing account access;",
              "verify unexpected requests for money or credentials; and",
              "notify NEX if you believe your account has been compromised.",
            ]}
          />
          <p style={paraStyle}>
            NEX will never guarantee that a user's device, account or
            communications can never be compromised.
          </p>
          <p style={paraStyle}>
            No internet-connected system can honestly provide such a
            guarantee.
          </p>
        </Section>

        <Section num={14} title="Account suspension and termination">
          <p style={paraStyle}>
            NEX may suspend, restrict or terminate access where
            reasonably necessary to:
          </p>
          <List
            items={[
              "protect users;",
              "protect NEX;",
              "prevent fraud or abuse;",
              "investigate security incidents;",
              "enforce these Terms;",
              "comply with law; or",
              "maintain the integrity of the platform.",
            ]}
          />
          <p style={paraStyle}>
            You may request closure of your account at any time.
          </p>
          <p style={paraStyle}>
            Deletion of an account does not necessarily mean that every
            piece of information disappears immediately where NEX is
            legally required to retain it or where retention is
            reasonably necessary for security, fraud prevention, dispute
            resolution or legal compliance.
          </p>
        </Section>

        <Section num={15} title="Third-party services">
          <p style={paraStyle}>
            NEX may rely on third-party infrastructure, payment
            providers, hosting providers, telecommunications networks,
            app stores and other service providers.
          </p>
          <p style={paraStyle}>
            NEX is not responsible for failures that are entirely
            outside NEX's reasonable control.
          </p>
          <p style={paraStyle}>
            Third-party services may have their own terms and privacy
            policies.
          </p>
        </Section>

        <Section num={16} title="Intellectual property">
          <p style={paraStyle}>
            NEX and its licensors retain ownership of NEX software,
            trademarks, designs, interfaces, logos, systems and other
            NEX-owned intellectual property.
          </p>
          <p style={paraStyle}>
            You receive a limited, non-exclusive, non-transferable right
            to use NEX for its intended purposes while your account
            remains permitted to use the service.
          </p>
          <p style={paraStyle}>
            You may not copy, reverse engineer, redistribute, sell,
            exploit or attempt to reproduce NEX's proprietary systems
            except where applicable law expressly permits such activity.
          </p>
        </Section>

        <Section num={17} title="Availability and warranties">
          <p style={paraStyle}>
            NEX is provided on an &ldquo;as available&rdquo; and
            &ldquo;as is&rdquo; basis to the maximum extent permitted by
            applicable law.
          </p>
          <p style={paraStyle}>NEX does not guarantee:</p>
          <List
            items={[
              "uninterrupted availability;",
              "error-free operation;",
              "successful delivery of every communication;",
              "permanent availability of every feature;",
              "compatibility with every device;",
              "uninterrupted third-party infrastructure; or",
              "that unauthorized access will never occur.",
            ]}
          />
          <p style={paraStyle}>
            Nothing in these Terms excludes rights or protections that
            cannot legally be excluded.
          </p>
        </Section>

        <Section num={18} title="Limitation of liability">
          <p style={paraStyle}>
            To the maximum extent permitted by applicable law, NEX will
            not be responsible for indirect, incidental, consequential,
            special or punitive losses arising from your use of the
            platform.
          </p>
          <p style={paraStyle}>This includes losses resulting from:</p>
          <List
            items={[
              "device loss;",
              "user error;",
              "unauthorized access caused by compromised credentials or devices;",
              "loss of locally stored information;",
              "third-party services;",
              "transactions between independent users;",
              "seller conduct;",
              "network failures; or",
              "temporary service interruption.",
            ]}
          />
          <p style={paraStyle}>
            Nothing in these Terms excludes liability that cannot
            legally be excluded or limited.
          </p>
        </Section>

        <Section num={19} title="Changes to NEX">
          <p style={paraStyle}>NEX may develop and change its services.</p>
          <p style={paraStyle}>
            If a material change substantially affects:
          </p>
          <List
            items={[
              "what information NEX collects;",
              "how private communications are handled;",
              "the security architecture of a service;",
              "payment arrangements; or",
              "your contractual rights,",
            ]}
          />
          <p style={paraStyle}>
            NEX will provide appropriate notice where required by
            applicable law.
          </p>
          <p style={paraStyle}>
            The version and effective date of these Terms will be
            updated when material changes are made.
          </p>
        </Section>

        <Section num={20} title="Governing law">
          <p style={paraStyle}>
            These Terms are governed by the applicable laws of the
            jurisdiction in which NEX operates, except where mandatory
            consumer or other applicable laws provide otherwise.
          </p>
          <p style={paraStyle}>
            Nothing in these Terms removes rights that you cannot
            legally waive.
          </p>
        </Section>

        <Section num={21} title="Contacting NEX">
          <p style={paraStyle}>
            For account, safety or customer-service questions, use the
            official NEX support account or official support channel
            identified inside the NEX application.
          </p>
          <p style={paraStyle}>
            NEX Chat is the preferred secure communication channel for
            contacting NEX support from inside the application.
          </p>
          <p style={paraStyle}>
            NEX support will not ask you to provide your:
          </p>
          <List
            items={[
              "Vault PIN;",
              "recovery phrase;",
              "private encryption key;",
              "account password; or",
              "other secret authentication credential.",
            ]}
          />
          <p style={paraStyle}>
            If someone claiming to be NEX support asks for these
            credentials, do not provide them.
          </p>
        </Section>

        <Section num={22} title="Our privacy commitment">
          <p style={paraStyle}>
            NEX is built around a simple commitment:
          </p>
          <p style={{ ...paraStyle, fontStyle: "italic", color: NEX.textDim }}>
            We do not sell your personal information, and we do not
            build NEX around selling your private life to advertisers or
            data brokers.
          </p>
          <p style={paraStyle}>
            NEX may process information necessary to operate, secure,
            protect and legally administer the platform.
          </p>
          <p style={paraStyle}>
            NEX will maintain appropriate authority over its platform
            and infrastructure so that it can protect users, investigate
            abuse, enforce its rules and comply with lawful obligations.
          </p>
          <p style={paraStyle}>
            At the same time, NEX will not claim access to information
            that its technical architecture does not provide it with
            access to.
          </p>
          <p style={paraStyle}>
            Privacy does not mean NEX has no responsibility. Security
            does not mean NEX can make impossible promises. NEX's job is
            to operate the platform responsibly while giving users
            meaningful control over their information.
          </p>
        </Section>

        {/* ─── Privacy Policy pointer ─────────────────────────────── */}
        <section style={{ marginTop: 36, marginBottom: 32 }}>
          <h2 style={h2Style}>Privacy Policy</h2>
          <p style={paraStyle}>For details about:</p>
          <List
            items={[
              "information NEX collects;",
              "information NEX does not collect;",
              "retention;",
              "deletion;",
              "security;",
              "business information;",
              "Trust and safety information;",
              "Vault;",
              "third-party processors; and",
              "user rights,",
            ]}
          />
          <p style={paraStyle}>
            see the{" "}
            <Link
              href="/nex-native/about/privacy"
              style={{ color: NEX.orange, textDecoration: "underline", fontWeight: 600 }}
            >
              NEX Privacy Policy
            </Link>
            .
          </p>
        </section>

        {/* ─── Footer meta + CTAs ─────────────────────────────────── */}
        <footer
          style={{
            paddingTop: 20,
            borderTop: `1px solid ${NEX.rule}`,
            color: NEX.textMute,
          }}
        >
          <div style={{ fontSize: 11, letterSpacing: "0.04em" }}>
            Terms of Use · {VERSION} · Effective {EFFECTIVE}
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
              href="/nex-native/about/privacy"
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
              Read the Privacy Policy
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
      data-nex-terms-section={num}
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
