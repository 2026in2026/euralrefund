import { Resend } from 'resend';

const resend = new Resend(process.env.RESEND_API_KEY);

export default async function handler(req, res) {
    if (req.method !== 'POST') return res.status(405).end();

  const { person, info, comp, euPdf, fuldmagtPdf } = req.body;

  const claimRef = 'ERR-' + Date.now();
    const timestamp = new Date().toLocaleString('da-DK', { timeZone: 'Europe/Copenhagen' });

  try {
        // Email 1 — to you with both PDFs attached
      await resend.emails.send({
              from: 'EU Rail Refund <onboarding@resend.dev>',
              to: 'kjerulf1994@gmail.com',
              subject: `New claim: ${person.navn} — ${info.operatør} — ${comp.compensation} ${info.valuta} [${claimRef}]`,
              html: `
                      <div style="font-family: monospace; padding: 24px; background: #f9f9f9;">
                                <h2 style="color: #1C1C28;">New Claim Received</h2>
                                          <table style="border-collapse: collapse; width: 100%;">
                                                      <tr><td style="padding: 6px 12px; color: #666;">Ref</td><td style="padding: 6px 12px; font-weight: bold;">${claimRef}</td></tr>
                                                                  <tr style="background:#fff"><td style="padding: 6px 12px; color: #666;">Submitted</td><td style="padding: 6px 12px;">${timestamp}</td></tr>
                                                                              <tr><td style="padding: 6px 12px; color: #666;">Name</td><td style="padding: 6px 12px;">${person.navn}</td></tr>
                                                                                          <tr style="background:#fff"><td style="padding: 6px 12px; color: #666;">Email</td><td style="padding: 6px 12px;">${person.email}</td></tr>
                                                                                                      <tr><td style="padding: 6px 12px; color: #666;">Address</td><td style="padding: 6px 12px;">${person.adresse}</td></tr>
                                                                                                                  <tr style="background:#fff"><td style="padding: 6px 12px; color: #666;">IBAN</td><td style="padding: 6px 12px;">${person.iban}</td></tr>
                                                                                                                              <tr><td style="padding: 6px 12px; color: #666;">Route</td><td style="padding: 6px 12px;">${info.fra} → ${info.til}</td></tr>
                                                                                                                                          <tr style="background:#fff"><td style="padding: 6px 12px; color: #666;">Date</td><td style="padding: 6px 12px;">${info.dato}</td></tr>
                                                                                                                                                      <tr><td style="padding: 6px 12px; color: #666;">Operator</td><td style="padding: 6px 12px;">${info.operatør}</td></tr>
                                                                                                                                                                  <tr style="background:#fff"><td style="padding: 6px 12px; color: #666;">Delay</td><td style="padding: 6px 12px;">${info.forsinkelse}</td></tr>
                                                                                                                                                                              <tr><td style="padding: 6px 12px; color: #666;">Ticket price</td><td style="padding: 6px 12px;">${info.billetpris} ${info.valuta}</td></tr>
                                                                                                                                                                                          <tr style="background:#fff"><td style="padding: 6px 12px; color: #666;">Compensation</td><td style="padding: 6px 12px; font-weight: bold; color: #C8A96E;">${comp.compensation} ${info.valuta}</td></tr>
                                                                                                                                                                                                      <tr><td style="padding: 6px 12px; color: #666;">Our fee (25%)</td><td style="padding: 6px 12px;">${comp.ourFee} ${info.valuta}</td></tr>
                                                                                                                                                                                                                  <tr style="background:#fff"><td style="padding: 6px 12px; color: #666;">Payout to client</td><td style="padding: 6px 12px;">${comp.youGet} ${info.valuta}</td></tr>
                                                                                                                                                                                                                            </table>
                                                                                                                                                                                                                                      <p style="margin-top: 16px; color: #666; font-size: 12px;">Both PDF documents attached.</p>
                                                                                                                                                                                                                                              </div>
                                                                                                                                                                                                                                                    `,
              attachments: [
                { filename: 'EU-form-' + claimRef + '.pdf', content: euPdf },
                { filename: 'PowerOfAttorney-' + claimRef + '.pdf', content: fuldmagtPdf },
                      ],
      });

      // Email 2 — confirmation to the user
      await resend.emails.send({
              from: 'EU Rail Refund <onboarding@resend.dev>',
              to: person.email,
              subject: `Your claim has been received — ${claimRef}`,
              html: `
                      <div style="font-family: Georgia, serif; max-width: 560px; margin: 0 auto; padding: 40px 24px; color: #1C1C28;">
                                <div style="font-family: monospace; font-size: 11px; color: #C8A96E; letter-spacing: 2px; margin-bottom: 8px;">EU RAIL REFUND</div>
                                          <h1 style="font-size: 28px; font-weight: 400; margin: 0 0 24px;">Your claim is in good hands.</h1>
                                                    <p style="color: #4A4A5A; line-height: 1.8;">Hi ${person.navn},</p>
                                                              <p style="color: #4A4A5A; line-height: 1.8;">We have received your compensation claim and will file it with <strong>${info.operatør}</strong> within 24 hours. You don't need to do anything further.</p>
                                                                        <div style="background: #F7F6F3; border-radius: 12px; padding: 20px 24px; margin: 24px 0;">
                                                                                    <div style="font-family: monospace; font-size: 10px; color: #9090A0; margin-bottom: 12px; letter-spacing: 1px;">CLAIM SUMMARY</div>
                                                                                                <table style="width: 100%; font-family: monospace; font-size: 13px;">
                                                                                                              <tr><td style="color: #9090A0; padding: 3px 0;">Reference</td><td style="text-align: right; font-weight: bold;">${claimRef}</td></tr>
                                                                                                                            <tr><td style="color: #9090A0; padding: 3px 0;">Route</td><td style="text-align: right;">${info.fra} → ${info.til}</td></tr>
                                                                                                                                          <tr><td style="color: #9090A0; padding: 3px 0;">Date</td><td style="text-align: right;">${info.dato}</td></tr>
                                                                                                                                                        <tr><td style="color: #9090A0; padding: 3px 0;">Operator</td><td style="text-align: right;">${info.operatør}</td></tr>
                                                                                                                                                                      <tr><td style="color: #9090A0; padding: 3px 0;">Compensation claimed</td><td style="text-align: right; color: #C8A96E; font-weight: bold;">${comp.compensation} ${info.valuta}</td></tr>
                                                                                                                                                                                    <tr><td style="color: #9090A0; padding: 3px 0;">You will receive (75%)</td><td style="text-align: right; font-weight: bold;">${comp.youGet} ${info.valuta}</td></tr>
                                                                                                                                                                                                </table>
                                                                                                                                                                                                          </div>
                                                                                                                                                                                                                    <p style="color: #4A4A5A; line-height: 1.8; font-size: 14px;"><strong>What happens next:</strong></p>
                                                                                                                                                                                                                              <ol style="color: #4A4A5A; line-height: 2; font-size: 14px;">
                                                                                                                                                                                                                                          <li>We file your claim with ${info.operatør} within 24 hours</li>
                                                                                                                                                                                                                                                      <li>The operator has 30 days to respond (EU Reg. 2021/782)</li>
                                                                                                                                                                                                                                                                  <li>If no reply — we escalate automatically</li>
                                                                                                                                                                                                                                                                              <li>Once approved, we transfer ${comp.youGet} ${info.valuta} to your IBAN</li>
                                                                                                                                                                                                                                                                                        </ol>
                                                                                                                                                                                                                                                                                                  <p style="color: #9090A0; font-size: 12px; line-height: 1.8; margin-top: 32px; border-top: 1px solid #E8E4DC; padding-top: 16px;">Questions? Reply to this email or contact us at support@euralrefund.com<br>EU Rail Refund ApS · Denmark · euralrefund.com</p>
                                                                                                                                                                                                                                                                                                          </div>
                                                                                                                                                                                                                                                                                                                `,
      });

      res.status(200).json({ ok: true, ref: claimRef });
  } catch (err) {
        console.error('Email error:', err);
        res.status(500).json({ error: err.message });
  }
}
