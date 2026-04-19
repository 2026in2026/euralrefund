// pages/api/submit-claim.js
// Fires on every completed claim submission — emails full claim details to company
// and sends a confirmation email to the claimant via Resend

import { storeClaim } from "./claims-log";

export default async function handler(req, res) {
  if (req.method === "OPTIONS") {
    res.setHeader("Access-Control-Allow-Origin", "*");
    res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
    res.setHeader("Access-Control-Allow-Headers", "Content-Type");
    return res.status(200).end();
  }
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

  const RESEND_API_KEY = process.env.RESEND_API_KEY;
  const COMPANY_EMAIL = process.env.COMPANY_EMAIL || "support@euralrefund.com";

  const {
    name, email, address, iban,
    fra, til, dato, tidspunkt,
    forsinkelse, operatør,
    billetpris, valuta,
    compensation, ourFee, youGet,
  } = req.body || {};

  // Log claim server-side regardless of email success
  console.log("CLAIM RECEIVED", JSON.stringify({
    timestamp: new Date().toISOString(),
    name, email, fra, til, dato, operatør,
    forsinkelse, compensation, valuta,
  }));

  // Store in claim log (accessible via /api/claims-log)
  await storeClaim({
    ref: `ERR-${Date.now().toString(36).toUpperCase()}`,
    timestamp: new Date().toISOString(),
    name, email, address, iban,
    fra, til, dato, tidspunkt,
    forsinkelse, operatør,
    billetpris, valuta,
    compensation, ourFee, youGet,
    status: "received",
  });

  if (!RESEND_API_KEY) {
    console.warn("RESEND_API_KEY not set — skipping emails");
    return res.status(200).json({ ok: true, skipped: true });
  }

  const claimRef = `ERR-${Date.now().toString(36).toUpperCase()}`;

  // 1. Internal notification to company
  const internalHtml = `
    <div style="font-family: monospace; max-width: 600px; margin: 0 auto; padding: 24px; background: #f9f9f9;">
      <h2 style="color: #1a3a6e; border-bottom: 2px solid #C8A96E; padding-bottom: 8px;">
        🚆 New Claim Received — ${claimRef}
      </h2>
      <table style="width: 100%; border-collapse: collapse; font-size: 13px;">
        <tr style="background:#eef2ff"><td style="padding:8px;font-weight:bold;width:160px">Reference</td><td style="padding:8px">${claimRef}</td></tr>
        <tr><td style="padding:8px;font-weight:bold">Submitted</td><td style="padding:8px">${new Date().toISOString()}</td></tr>
        <tr style="background:#eef2ff"><td style="padding:8px;font-weight:bold">Claimant Name</td><td style="padding:8px">${name || "-"}</td></tr>
        <tr><td style="padding:8px;font-weight:bold">Email</td><td style="padding:8px">${email || "-"}</td></tr>
        <tr style="background:#eef2ff"><td style="padding:8px;font-weight:bold">Address</td><td style="padding:8px">${address || "-"}</td></tr>
        <tr><td style="padding:8px;font-weight:bold">IBAN</td><td style="padding:8px">${iban || "-"}</td></tr>
        <tr style="background:#eef2ff"><td style="padding:8px;font-weight:bold">Route</td><td style="padding:8px">${fra || "-"} → ${til || "-"}</td></tr>
        <tr><td style="padding:8px;font-weight:bold">Date</td><td style="padding:8px">${dato || "-"} ${tidspunkt || ""}</td></tr>
        <tr style="background:#eef2ff"><td style="padding:8px;font-weight:bold">Operator</td><td style="padding:8px">${operatør || "-"}</td></tr>
        <tr><td style="padding:8px;font-weight:bold">Delay</td><td style="padding:8px">${forsinkelse || "-"}</td></tr>
        <tr style="background:#eef2ff"><td style="padding:8px;font-weight:bold">Ticket Price</td><td style="padding:8px">${billetpris || "-"} ${valuta || "DKK"}</td></tr>
        <tr style="background:#fff8e1"><td style="padding:8px;font-weight:bold">Compensation</td><td style="padding:8px;font-weight:bold;color:#1a3a6e">${Number(compensation || 0).toFixed(2)} ${valuta || "DKK"}</td></tr>
        <tr><td style="padding:8px;font-weight:bold">Our Fee (25%)</td><td style="padding:8px">${Number(ourFee || 0).toFixed(2)} ${valuta || "DKK"}</td></tr>
        <tr style="background:#e8f5e9"><td style="padding:8px;font-weight:bold">To Claimant (75%)</td><td style="padding:8px;font-weight:bold;color:#2D8653">${Number(youGet || 0).toFixed(2)} ${valuta || "DKK"}</td></tr>
      </table>
      <p style="margin-top:16px;font-size:12px;color:#666;">
        ACTION REQUIRED: File the EU claim form (2024/949) with ${operatør || "the operator"} within 24 hours.
      </p>
    </div>
  `;

  // 2. Confirmation to claimant
  const confirmHtml = `
    <div style="font-family: 'DM Mono', monospace; max-width: 560px; margin: 0 auto; padding: 32px; background: #FAFAF8;">
      <div style="text-align:center;margin-bottom:24px;">
        <span style="font-size:32px">🚆</span>
        <h2 style="font-family: Georgia, serif; color: #1C1C28; font-weight: 400; margin: 8px 0 4px;">Claim received</h2>
        <p style="color: #9090A0; font-size: 12px; letter-spacing: 0.1em;">EU RAIL REFUND · ${claimRef}</p>
      </div>
      <p style="color: #4A4A5A; font-size: 13px; line-height: 1.8;">Hi ${name?.split(" ")[0] || "there"},</p>
      <p style="color: #4A4A5A; font-size: 13px; line-height: 1.8; margin-bottom: 20px;">
        We have received your claim for the journey <strong>${fra || "-"} → ${til || "-"}</strong> on <strong>${dato || "-"}</strong> with <strong>${operatør || "-"}</strong>.
        Your reference number is <strong style="color: #C8A96E;">${claimRef}</strong>.
      </p>
      <div style="background:#FFFBF0;border:1px solid rgba(200,169,110,0.3);border-radius:8px;padding:16px;margin-bottom:20px;font-size:13px;">
        <div style="color:#9090A0;font-size:10px;letter-spacing:0.15em;margin-bottom:8px;">YOUR CLAIM SUMMARY</div>
        <div style="display:flex;justify-content:space-between;padding:4px 0;border-bottom:1px solid rgba(200,169,110,0.15)">
          <span style="color:#4A4A5A">Delay</span>
          <span style="color:#1C1C28;font-weight:bold">${forsinkelse || "-"}</span>
        </div>
        <div style="display:flex;justify-content:space-between;padding:4px 0;border-bottom:1px solid rgba(200,169,110,0.15)">
          <span style="color:#4A4A5A">Compensation claimed</span>
          <span style="color:#1C1C28;font-weight:bold">${Number(compensation || 0).toFixed(2)} ${valuta || "DKK"}</span>
        </div>
        <div style="display:flex;justify-content:space-between;padding:4px 0">
          <span style="color:#4A4A5A">You receive (if approved)</span>
          <span style="color:#2D8653;font-weight:bold">${Number(youGet || 0).toFixed(2)} ${valuta || "DKK"}</span>
        </div>
      </div>
      <div style="font-size:12px;color:#4A4A5A;line-height:2;margin-bottom:20px;">
        <strong style="color:#C8A96E;">What happens next:</strong><br/>
        1. We file your claim with the operator within 24 hours<br/>
        2. The operator has up to 30 days to respond (EU Reg. 2021/782)<br/>
        3. If no reply — we escalate to the national enforcement authority<br/>
        4. Once approved, we transfer 75% to your IBAN within 5 business days
      </div>
      <p style="font-size:11px;color:#9090A0;border-top:1px solid #E8E4DC;padding-top:16px;">
        Questions? Reply to this email or contact <a href="mailto:support@euralrefund.com" style="color:#C8A96E;">support@euralrefund.com</a><br/>
        EU Rail Refund ApS · Denmark · <a href="https://euralrefund.vercel.app/privacy" style="color:#C8A96E;">Privacy Policy</a>
      </p>
    </div>
  `;

  const sendEmail = async (to, subject, html) => {
    const r = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${RESEND_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: "EU Rail Refund <onboarding@resend.dev>",
        to: [to],
        subject,
        html,
      }),
    });
    if (!r.ok) {
      const err = await r.text();
      console.error(`Email to ${to} failed:`, err);
    }
    return r.ok;
  };

  try {
    await Promise.all([
      sendEmail(COMPANY_EMAIL, `🚆 New Claim ${claimRef} — ${name} — ${fra} → ${til}`, internalHtml),
      email ? sendEmail(email, `Your claim has been received — ${claimRef}`, confirmHtml) : Promise.resolve(),
    ]);
    res.setHeader("Access-Control-Allow-Origin", "*");
    return res.status(200).json({ ok: true, ref: claimRef });
  } catch (e) {
    console.error("submit-claim error:", e);
    return res.status(200).json({ ok: true, warning: e.message });
  }
}
