// pages/api/send-feedback.js
// Sends user feedback (star rating + comment) to company email via Resend

export default async function handler(req, res) {
  if (req.method === 'OPTIONS') {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
    return res.status(200).end();
  }
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  try {
    const { rating, comment } = req.body;
    const RESEND_API_KEY = process.env.RESEND_API_KEY;
    const COMPANY_EMAIL = process.env.COMPANY_EMAIL || 'claims@euralrefund.com';

    if (!RESEND_API_KEY) {
      console.warn('RESEND_API_KEY not set — skipping feedback email');
      return res.status(200).json({ ok: true, skipped: true });
    }

    const stars = '⭐'.repeat(rating) + '☆'.repeat(5 - rating);
    const subject = `Feedback: ${stars} (${rating}/5)`;
    const htmlBody = `
      <h2>New Feedback from EU Rail Refund</h2>
      <p style="font-size: 28px; margin: 8px 0;">${stars}</p>
      <p><strong>Rating:</strong> ${rating}/5</p>
      ${comment ? `<p><strong>Comment:</strong></p><blockquote style="border-left: 3px solid #C8A96E; padding-left: 12px; color: #555;">${comment}</blockquote>` : '<p><em>No comment provided.</em></p>'}
      <hr/>
      <p style="color: #999; font-size: 11px;">Submitted via euralrefund.vercel.app — ${new Date().toISOString()}</p>
    `;

    await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${RESEND_API_KEY}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        from: 'EU Rail Refund <noreply@euralrefund.com>',
        to: [COMPANY_EMAIL],
        subject,
        html: htmlBody,
      }),
    });

    res.setHeader('Access-Control-Allow-Origin', '*');
    res.status(200).json({ ok: true });
  } catch (e) {
    console.error('send-feedback error:', e);
    res.status(200).json({ ok: true, warning: e.message });
  }
}
