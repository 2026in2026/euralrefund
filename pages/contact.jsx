import Head from "next/head";
import Link from "next/link";

const mono = "'DM Mono', monospace";
const serif = "'Playfair Display', serif";

export default function Contact() {
    return (
          <div style={{ minHeight: "100vh", background: "#FAFAF8", display: "flex", flexDirection: "column" }}>
            <Head>
              <title>Contact — EU Rail Refund</title>
              <meta name="description" content="Contact EU Rail Refund — questions about your claim, our service, or anything else." />
              <style>{`@import url('https://fonts.googleapis.com/css2?family=Playfair+Display:ital,wght@0,400;0,700;1,400&family=DM+Mono:wght@400;500;700&display=swap');`}</style>
            </Head>

      {/* Nav */}
      <div style={{ padding: "20px 32px", borderBottom: "1px solid #E8E4DC", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <Link href="/" style={{ textDecoration: "none", display: "flex", alignItems: "center", gap: 8 }}>
          <span style={{ fontSize: 18 }}>🚆</span>
                      <span style={{ fontFamily: mono, fontSize: 11, letterSpacing: "0.15em", color: "#1C1C28" }}>EU RAIL REFUND</span>
                    </Link>
                    <Link href="/" style={{ fontFamily: mono, fontSize: 11, color: "#C8A96E", textDecoration: "none" }}>
          ← Back to claim
        </Link>
                  </div>

            {/* Content */}
      <div style={{ flex: 1, maxWidth: 640, margin: "0 auto", padding: "60px 24px", width: "100%" }}>
                    <h1 style={{ fontFamily: serif, fontSize: 36, fontWeight: 400, color: "#1C1C28", marginBottom: 8 }}>
                      Contact
                    </h1>
                    <p style={{ fontFamily: mono, fontSize: 13, color: "#9090A0", marginBottom: 48, letterSpacing: "0.05em" }}>
                      EU Rail Refund ApS · Denmark
        </p>

            {/* Email */}
                    <div style={{ background: "#FFFFFF", border: "1px solid #E8E4DC", borderRadius: 12, padding: 28, marginBottom: 20 }}>
                      <div style={{ fontFamily: mono, fontSize: 10, color: "#9090A0", letterSpacing: "0.15em", textTransform: "uppercase", marginBottom: 12 }}>
                        Email
                      </div>
                      <a
                        href="mailto:support@euralrefund.com"
                        style={{ fontFamily: mono, fontSize: 16, color: "#C8A96E", textDecoration: "none", fontWeight: 700 }}
          >
                        support@euralrefund.com
                      </a>
                      <p style={{ fontFamily: mono, fontSize: 12, color: "#9090A0", marginTop: 8, lineHeight: 1.7 }}>
            We aim to respond within one business day. For questions about an existing claim, include your reference number (e.g. ERR-XXXXX) in the subject line.
          </p>
                    </div>

            {/* Company info */}
        <div style={{ background: "#FFFFFF", border: "1px solid #E8E4DC", borderRadius: 12, padding: 28, marginBottom: 20 }}>
                      <div style={{ fontFamily: mono, fontSize: 10, color: "#9090A0", letterSpacing: "0.15em", textTransform: "uppercase", marginBottom: 16 }}>
                        Company Details
          </div>
            {[
                        ["Company", "EU Rail Refund ApS"],
                        ["Country", "Denmark"],
                        ["Email", "support@euralrefund.com"],
                      ].map(([label, value]) => (
                        <div key={label} style={{ display: "flex", gap: 16, padding: "8px 0", borderBottom: "1px solid #F0EDE8" }}>
                          <span style={{ fontFamily: mono, fontSize: 12, color: "#9090A0", minWidth: 100 }}>{label}</span>
                          <span style={{ fontFamily: mono, fontSize: 12, color: "#1C1C28" }}>{value}</span>
                                      </div>
          ))}
                    </div>

            {/* Response times */}
                                  <div style={{ background: "#FFFBF0", border: "1px solid rgba(200,169,110,0.3)", borderRadius: 12, padding: 24 }}>
                                    <div style={{ fontFamily: mono, fontSize: 10, color: "#C8A96E", letterSpacing: "0.15em", textTransform: "uppercase", marginBottom: 12 }}>
                                      Response Times
                                    </div>
                                    <p style={{ fontFamily: mono, fontSize: 12, color: "#4A4A5A", lineHeight: 1.8, margin: 0 }}>
                                      General enquiries: within 1 business day<br />
                                      Claim status updates: within 2 business days<br />
                                      Complaint escalations: within 5 business days
                                    </p>
                                  </div>
                                </div>

                          {/* Footer */}
                                <footer style={{ borderTop: "1px solid #E8E4DC", padding: "24px 32px", display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 12 }}>
                                  <span style={{ fontFamily: mono, fontSize: 11, color: "#9090A0" }}>EU Rail Refund ApS · Denmark</span>
        <div style={{ display: "flex", gap: 24 }}>
          <Link href="/privacy" style={{ fontFamily: mono, fontSize: 11, color: "#9090A0", textDecoration: "none" }}>Privacy Policy</Link>
          <Link href="/terms" style={{ fontFamily: mono, fontSize: 11, color: "#9090A0", textDecoration: "none" }}>Terms & Conditions</Link>
        </div>
      </footer>
    </div>
  );
}
