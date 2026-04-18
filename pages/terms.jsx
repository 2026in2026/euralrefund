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

export default function TermsAndConditions() {
  return (
    <div style={{ minHeight: "100vh", background: "#FAFAF8", padding: "40px 16px" }}>
      <Head>
        <title>Terms &amp; Conditions — EU Rail Refund</title>
        <meta name="description" content="Terms and Conditions for EU Rail Refund ApS" />
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
            Terms &amp; Conditions
          </h1>
          <p style={{ fontFamily: mono, fontSize: 12, color: "#9090A0" }}>
            Last updated: {new Date().toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" })}
          </p>
        </div>

        {/* Content */}
        <Section title="1. About Us">
          <p>
            EU Rail Refund ApS ("EU Rail Refund", "we", "us") is a Danish-registered claims service that prepares and files EU rail passenger compensation claims on behalf of passengers ("you", "the claimant") under EU Regulation 2021/782 on rail passengers&apos; rights.
          </p>
          <p style={{ marginTop: 12 }}>
            By using this website and submitting a claim, you agree to these Terms and Conditions in full. If you do not agree, do not use the service.
          </p>
        </Section>

        <Section title="2. The Service">
          <p>EU Rail Refund provides the following service:</p>
          <ul style={{ paddingLeft: 20, marginTop: 8 }}>
            <li style={{ marginBottom: 6 }}>We review your journey details and assess eligibility for compensation under EU Regulation 2021/782, Article 19</li>
            <li style={{ marginBottom: 6 }}>We prepare the official EU claim form (Commission Implementing Regulation (EU) 2024/949)</li>
            <li style={{ marginBottom: 6 }}>We file the claim directly with the railway operator on your behalf, acting under the Power of Attorney you sign</li>
            <li style={{ marginBottom: 6 }}>We handle all correspondence with the operator and, where necessary, escalate to the relevant national enforcement authority</li>
            <li style={{ marginBottom: 6 }}>Upon approval, we receive the compensation from the operator and pay out 75% to your IBAN within 5 business days</li>
          </ul>
        </Section>

        <Section title="3. Our Fee — No Win, No Fee">
          <div style={{ background: "#FFFBF0", border: "1px solid rgba(200,169,110,0.3)", borderRadius: 8, padding: 16, marginBottom: 16 }}>
            <p><strong>Our fee is 25% of the compensation amount actually received.</strong></p>
            <p style={{ marginTop: 8 }}>If your claim is rejected or no compensation is obtained, you pay nothing — absolutely no charge.</p>
          </div>
          <p>By submitting a claim, you authorise us to deduct our 25% fee from any compensation received before transferring the remaining 75% to your IBAN. The fee is calculated on the gross compensation amount paid by the operator, exclusive of any interest or supplementary awards.</p>
        </Section>

        <Section title="4. Compensation Amounts Under EU Law">
          <p>Under EU Regulation 2021/782, Article 19, passengers are entitled to:</p>
          <div style={{ marginTop: 12 }}>
            {[
              { delay: "60–119 minutes", entitlement: "25% of the ticket price" },
              { delay: "120 minutes or more", entitlement: "50% of the ticket price" },
            ].map(({ delay, entitlement }) => (
              <div key={delay} style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, padding: "10px 0", borderBottom: "1px solid #E8E4DC", fontSize: 12 }}>
                <span style={{ color: "#1C1C28", fontWeight: 700 }}>{delay}</span>
                <span style={{ color: "#4A4A5A" }}>{entitlement}</span>
              </div>
            ))}
          </div>
          <p style={{ marginTop: 12 }}>Delays under 60 minutes do not qualify for compensation. Operators may deny compensation where the delay is caused by extraordinary circumstances beyond their control (force majeure), severe weather, or third-party acts. We assess eligibility based on the information you provide but cannot guarantee a specific outcome.</p>
        </Section>

        <Section title="5. Your Responsibilities">
          <p>By submitting a claim, you confirm and warrant that:</p>
          <ul style={{ paddingLeft: 20, marginTop: 8 }}>
            <li style={{ marginBottom: 6 }}>You are the named passenger on the ticket, or have authority to claim on behalf of the named passenger</li>
            <li style={{ marginBottom: 6 }}>All information provided is accurate and complete to the best of your knowledge</li>
            <li style={{ marginBottom: 6 }}>You have not already submitted, or authorised another party to submit, a compensation claim for the same journey</li>
            <li style={{ marginBottom: 6 }}>You hold a valid ticket for the journey in question</li>
            <li style={{ marginBottom: 6 }}>You will notify us promptly if you receive compensation directly from the operator after authorising us to act on your behalf</li>
          </ul>
          <p style={{ marginTop: 12 }}>Submitting false or misleading information may constitute fraud and may result in legal action. We reserve the right to cancel our service and seek recovery of costs incurred if we discover that information was falsified.</p>
        </Section>

        <Section title="6. Power of Attorney">
          <p>By digitally signing the Power of Attorney document generated by our service, you authorise EU Rail Refund ApS to:</p>
          <ul style={{ paddingLeft: 20, marginTop: 8 }}>
            <li style={{ marginBottom: 6 }}>File and sign the official EU claim form on your behalf</li>
            <li style={{ marginBottom: 6 }}>Correspond with the railway operator and relevant enforcement authorities in your name</li>
            <li style={{ marginBottom: 6 }}>Receive compensation payments from the operator on your behalf</li>
            <li style={{ marginBottom: 6 }}>Escalate your claim to national authorities if required</li>
          </ul>
          <p style={{ marginTop: 12 }}>This Power of Attorney is limited in scope to the specific journey described in your claim submission and does not confer any other authority. You may revoke this authorisation at any time before the claim is filed by contacting us at <a href="mailto:support@euralrefund.com" style={{ color: "#C8A96E" }}>support@euralrefund.com</a>.</p>
        </Section>

        <Section title="7. Timelines">
          <p>We aim to file your claim with the operator within 24 hours of receiving a complete and valid submission. Under EU Regulation 2021/782, Article 24, railway operators must respond to complaints within 30 days. If the operator does not respond or responds unsatisfactorily, we escalate the claim to the relevant national enforcement body at no extra cost to you.</p>
          <p style={{ marginTop: 12 }}>Total claim processing time varies by operator and country. We cannot guarantee a specific timeline for resolution.</p>
        </Section>

        <Section title="8. Payout">
          <p>Once we receive compensation from the operator on your behalf, we will transfer 75% of the gross compensation to the IBAN you provided within 5 business days. We are not responsible for delays caused by incorrect IBAN details or bank processing times. You are responsible for providing a correct and valid IBAN.</p>
          <p style={{ marginTop: 12 }}>We operate in DKK, EUR, GBP, SEK, and NOK. Payouts are made in the currency of the compensation received from the operator. Currency conversion fees, if any, are borne by the claimant.</p>
        </Section>

        <Section title="9. Limitation of Liability">
          <p>EU Rail Refund is a claims preparation and filing service. We do not guarantee that your claim will be approved. Our liability in connection with the service is limited to the amount of our fee charged. We are not liable for any indirect, consequential, or special loss arising from a rejected claim, operator delays, or third-party actions.</p>
        </Section>

        <Section title="10. Governing Law and Disputes">
          <p>These Terms are governed by Danish law. Any dispute arising from or related to these Terms shall be subject to the jurisdiction of the Danish courts. You also have the right to file a complaint with the Danish Competition and Consumer Authority (Konkurrence- og Forbrugerstyrelsen) at <a href="https://www.forbrug.dk" style={{ color: "#C8A96E" }} target="_blank" rel="noopener noreferrer">forbrug.dk</a>.</p>
        </Section>

        <Section title="11. Contact">
          <p>For questions about these Terms, claims, or the status of your case, contact us at:</p>
          <p style={{ marginTop: 8 }}>
            <a href="mailto:support@euralrefund.com" style={{ color: "#C8A96E" }}>support@euralrefund.com</a><br />
            EU Rail Refund ApS · Denmark
          </p>
        </Section>

        {/* Footer */}
        <div style={{ borderTop: "1px solid #E8E4DC", paddingTop: 24, marginTop: 40, display: "flex", justifyContent: "space-between", flexWrap: "wrap", gap: 12 }}>
          <span style={{ fontFamily: mono, fontSize: 11, color: "#9090A0" }}>EU Rail Refund ApS · Denmark</span>
          <div style={{ display: "flex", gap: 20 }}>
            <Link href="/privacy" style={{ fontFamily: mono, fontSize: 11, color: "#C8A96E", textDecoration: "none" }}>Privacy Policy</Link>
            <a href="mailto:support@euralrefund.com" style={{ fontFamily: mono, fontSize: 11, color: "#C8A96E", textDecoration: "none" }}>Contact</a>
          </div>
        </div>
      </div>
    </div>
  );
}
