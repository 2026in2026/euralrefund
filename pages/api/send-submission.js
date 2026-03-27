// pages/api/send-submission.js
// Sends a copy of the generated PDFs to the company email via Resend API
// Set RESEND_API_KEY and COMPANY_EMAIL in Vercel environment variables

export default async function handler(req, res) {
  if (req.method === 'OPTIONS') {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
    return res.status(200).end();
  }
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  try {
    const { person, info, comp, euPdf, fuldmagtPdf } = req.body;

    const RESEND_API_KEY = process.env.RESEND_API_KEY;
    const COMPANY_EMAIL = process.env.COMPANY_EMAIL || 'claims@euralrefund.com';

    if (!RESEND_API_KEY) {
      console.warn('RESEND_API_KEY not set — skipping email');
      return res.status(200).json({ ok: true, skipped: true });
    }

    const subject = `New Claim: ${person.name} — ${info.fra} → ${info.til} (${info.dato})`;

    const htmlBody = `
      <h2>New EU Rail Refund Submission</h2>
      <table style="font-family: monospace; font-size: 13px; border-collapse: collapse;">
        <tr><td style="padding: 4px 12px 4px 0; color: #666;">Name</td><td><strong>${person.name}</strong></td></tr>
        <tr><td style="padding: 4px 12px 4px 0; color: #666;">Email</td><td>${person.email}</td></tr>
        <tr><td style="padding: 4px 12px 4px 0; color: #666;">Address</td><td>${person.address || '-'}</td></tr>
        <tr><td style="padding: 4px 12px 4px 0; color: #666;">IBAN</td><td>${person.iban || '-'}</td></tr>
        <tr><td colspan="2" style="padding-top: 12px;"><hr/></td></tr>
        <tr><td style="padding: 4px 12px 4px 0; color: #666;">From</td><td>${info.fra}</td></tr>
        <tr><td style="padding: 4px 12px 4px 0; color: #666;">To</td><td>${info.til}</td></tr>
        <tr><td style="padding: 4px 12px 4px 0; color: #666;">Date</td><td>${info.dato}</td></tr>
        <tr><td style="padding: 4px 12px 4px 0; color: #666;">Delay</td><td>${info.forsinkelse}</td></tr>
        <tr><td style="padding: 4px 12px 4px 0; color: #666;">Operator</td><td>${info.operatoer}</td></tr>
        <tr><td style="padding: 4px 12px 4px 0; color: #666;">Ticket price</td><td>${info.billetpris} ${info.valuta}</td></tr>
        <tr><td style="padding: 4px 12px 4px 0; color: #666;">Compensation</td><td><strong>${comp.compensation} ${info.valuta}</strong></td></tr>
        <tr><td style="padding: 4px 12px 4px 0; color: #666;">Authority</td><td>${comp.authority} — ${comp.url}</td></tr>
      </table>
      <p style="margin-top: 16px; color: #888; font-size: 12px;">Both PDF documents are attached.</p>
    `;

    const emailPayload = {
      from: 'EU Rail Refund <noreply@euralrefund.com>',
      to: [COMPANY_EMAIL],
      reply_to: person.email,
      subject,
      html: htmlBody,
      attachments: [
        { filename: 'EU-claim-form-2024-949.pdf', content: euPdf },
        { filename: 'Power-of-Attorney-EU-Rail-Refund.pdf', content: fuldmagtPdf },
      ],
    };

    const emailRes = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${RESEND_API_KEY}`, 'Content-Type': 'application/json' },
      body: JSON.stringify(emailPayload),
    });

    if (!emailRes.ok) {
      const err = await emailRes.text();
      console.error('Resend error:', err);
      return res.status(200).json({ ok: true, warning: 'Email failed: ' + err });
    }

    res.setHeader('Access-Control-Allow-Origin', '*');
    res.status(200).json({ ok: true });
  } catch (e) {
    console.error('send-submission error:', e);
    res.status(200).json({ ok: true, warning: e.message });
  }
}
