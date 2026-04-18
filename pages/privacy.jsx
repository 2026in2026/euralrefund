import Head from "next/head";
import Link from "next/link";

const mono = "'DM Mono', monospace";
const serif = "'Playfair Display', serif";

const Section = ({ title, children }) => (
  <div style={{ marginBottom: 32 }}>
    <h2 style={{ fontFamily: serif, fontSize: 22, color: "#1C1C28", fontWeight: 400, marginBottom: 12, borderBottom: "1px solid #E8E4DC", paddingBottom: 8 }}>
      {title}
    </h2>
    <div style={{ fontFamily: mono, fontSize: 13, color: "#4A4A5A", lineHeight: 2 }}>
      {children}
    </div>
  </div>
);

export default function PrivacyPolicy() {
  return (
    <div style={{ minHeight: "100vh", background: "#FAFAF8", padding: "40px 16px" }}>
      <Head>
        <title>Privacy Policy — EU Rail Refund</title>
        <meta name="description" content="Privacy Policy for EU Rail Refund ApS" />
        <link rel="icon" href="/favicon.ico" />
        <style>{`@import url('https://fonts.googleapis.com/css2?family=Playfair+Display:ital,wght@0,400;0,700;1,400&family=DM+Mono:wght@400;500;700&display=swap');`}</style>
      </Head>

      <div style={{ maxWidth: 720, margin: "0 auto" }}>
        {/* Header */}
        <div style={{ marginBottom: 40 }}>
          <Link href="/" style={{ fontFamily: mono, fontSize: 12, color: "#C8A96E", textDecoration: "none" }}>
            ← Back to EU Rail Refund
          </Link>
          <div style={{ marginTop: 24, display: "inline-flex", alignItems: "center", gap: 10, background: "#F7F6F3", border: "1px solid #E8E4DC", borderRadius: 100, padding: "6px 16px" }}>
            <span style={{ fontSize: 16 }}>🚆</span>
            <span style={{ fontFamily: mono, fontSize: 11, color: "#C8A96E", letterSpacing: "0.15em", textTransform: "uppercase" }}>EU Rail Refund</span>
          </div>
          <h1 style={{ fontFamily: serif, fontSize: 36, color: "#1C1C28", fontWeight: 400, marginTop: 16, marginBottom: 8 }}>
            Privacy Policy
          </h1>
          <p style={{ fontFamily: mono, fontSize: 12, color: "#9090A0" }}>
            Last updated: {new Date().toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" })}
          </p>
        </div>

        {/* Content */}
        <Section title="1. Who We Are">
          <p>EU Rail Refund ApS ("we", "us", "our") is a Danish-registered company that provides EU rail compensation claim services on behalf of passengers under EU Regulation 2021/782. We act as a data controller for the personal data you provide when using our service.</p>
          <p style={{ marginTop: 12 }}>Contact: <a href="mailto:support@euralrefund.com" style={{ color: "#C8A96E" }}>support@euralrefund.com</a></p>
        </Section>

        <Section title="2. What Data We Collect">
          <p>When you submit a compensation claim, we collect:</p>
          <ul style={{ paddingLeft: 20, marginTop: 8 }}>
            {[
              "Full name",
              "Email address",
              "Postal address",
              "IBAN and SWIFT/BIC (for payment)",
              "Train ticket (PDF or image)",
              "Journey details: departure station, destination station, date, operator, delay",
              "Compensation amount claimed",
            ].map((item) => (
              <li key={item} style={{ marginBottom: 6 }}>{item}</li>
            ))}
          </ul>
          <p style={{ marginTop: 12 }}>We do not collect payment card details. Payouts are made exclusively via bank transfer to the IBAN you provide.</p>
        </Section>

        <Section title="3. Why We Process Your Data (Legal Basis)">
          <p>We process your personal data for the following purposes and on the following legal bases:</p>
          <div style={{ marginTop: 12 }}>
            {[
              { purpose: "Processing your compensation claim", basis: "Performance of contract (GDPR Art. 6(1)(b))" },
              { purpose: "Sending you claim status updates", basis: "Performance of contract (GDPR Art. 6(1)(b))" },
              { purpose: "Paying out your compensation", basis: "Performance of contract (GDPR Art. 6(1)(b))" },
              { purpose: "Filing claim with railway operator", basis: "Performance of contract / your explicit consent (GDPR Art. 6(1)(a) and (b))" },
              { purpose: "Communicating with enforcement authorities", basis: "Legal obligation (GDPR Art. 6(1)(c))" },
              { purpose: "Internal record-keeping", basis: "Legitimate interest (GDPR Art. 6(1)(f))" },
            ].map(({ purpose, basis }) => (
              <div key={purpose} style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, padding: "8px 0", borderBottom: "1px solid #E8E4DC", fontSize: 12 }}>
                <span style={{ color: "#1C1C28" }}>{purpose}</span>
                <span style={{ color: "#9090A0" }}>{basis}</span>
              </div>
            ))}
          </div>
        </Section>

        <Section title="4. Who We Share Your Data With">
          <p>We share your data only as necessary to process your claim:</p>
          <ul style={{ paddingLeft: 20, marginTop: 8 }}>
            <li style={{ marginBottom: 6 }}><strong>Railway operators</strong> — to file your compensation claim on your behalf</li>
            <li style={{ marginBottom: 6 }}><strong>National enforcement authorities</strong> — if escalation is required (e.g. Trafikstyrelsen, Bundesnetzagentur)</li>
            <li style={{ marginBottom: 6 }}><strong>Resend.com</strong> — our email delivery provider (used for confirmation emails and internal notifications)</li>
          </ul>
          <p style={{ marginTop: 12 }}>We do not sell, rent, or trade your personal data to third parties.</p>
        </Section>

        <Section title="5. How Long We Keep Your Data">
          <p>We retain your personal data for as long as needed to process your claim and for a period of 5 years thereafter for legal and accounting purposes, in compliance with Danish bookkeeping law (Bogføringsloven).</p>
          <p style={{ marginTop: 12 }}>Claim-related correspondence and financial records are kept for 5 years from the date of claim completion. Train ticket files are deleted within 90 days of claim completion.</p>
        </Section>

        <Section title="6. Your Rights Under GDPR">
          <p>As a data subject under EU Regulation 2016/679 (GDPR), you have the following rights:</p>
          <ul style={{ paddingLeft: 20, marginTop: 8 }}>
            {[
              "Right of access — request a copy of your personal data",
              "Right to rectification — correct inaccurate data",
              "Right to erasure — request deletion of your data (subject to legal retention obligations)",
              "Right to restriction — restrict how we use your data",
              "Right to data portability — receive your data in a structured, machine-readable format",
              "Right to object — object to processing based on legitimate interest",
              "Right to withdraw consent — withdraw your consent at any time without affecting prior processing",
            ].map((right) => (
              <li key={right} style={{ marginBottom: 6 }}>{right}</li>
            ))}
          </ul>
          <p style={{ marginTop: 12 }}>
            To exercise any of these rights, contact us at <a href="mailto:support@euralrefund.com" style={{ color: "#C8A96E" }}>support@euralrefund.com</a>.
            We will respond within 30 days.
          </p>
          <p style={{ marginTop: 12 }}>
            If you are unhappy with how we handle your data, you have the right to lodge a complaint with the Danish Data Protection Authority (Datatilsynet) at <a href="https://www.datatilsynet.dk" style={{ color: "#C8A96E" }} target="_blank" rel="noopener noreferrer">datatilsynet.dk</a>.
          </p>
        </Section>

        <Section title="7. Data Security">
          <p>We take appropriate technical and organisational measures to protect your personal data against unauthorised access, loss, or misuse. All data is transmitted over HTTPS. Access to claim data is restricted to authorised staff only.</p>
        </Section>

        <Section title="8. Cookies">
          <p>This website does not use tracking cookies or third-party analytics. We do not use advertising trackers. The site may use functional browser storage solely to maintain your claim session state while you complete the form — this data is not transmitted to any third party.</p>
        </Section>

        <Section title="9. Changes to This Policy">
          <p>We may update this policy from time to time. Material changes will be communicated by updating the "last updated" date above. Continued use of our service after changes constitutes acceptance of the updated policy.</p>
        </Section>

        {/* Footer */}
        <div style={{ borderTop: "1px solid #E8E4DC", paddingTop: 24, marginTop: 40, display: "flex", justifyContent: "space-between", flexWrap: "wrap", gap: 12 }}>
          <span style={{ fontFamily: mono, fontSize: 11, color: "#9090A0" }}>EU Rail Refund ApS · Denmark</span>
          <div style={{ display: "flex", gap: 20 }}>
            <Link href="/terms" style={{ fontFamily: mono, fontSize: 11, color: "#C8A96E", textDecoration: "none" }}>Terms &amp; Conditions</Link>
            <a href="mailto:support@euralrefund.com" style={{ fontFamily: mono, fontSize: 11, color: "#C8A96E", textDecoration: "none" }}>Contact</a>
          </div>
        </div>
      </div>
    </div>
  );
}
