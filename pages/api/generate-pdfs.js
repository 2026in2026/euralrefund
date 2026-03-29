import { PDFDocument, rgb, StandardFonts } from 'pdf-lib';

function hexToRgb(hex) {
  const r = parseInt(hex.slice(1,3),16)/255;
  const g = parseInt(hex.slice(3,5),16)/255;
  const b = parseInt(hex.slice(5,7),16)/255;
  return rgb(r,g,b);
}

function wrapText(text, maxChars) {
  const words = String(text || '').split(' ');
  const lines = [];
  let buf = '';
  for (const w of words) {
    if ((buf + ' ' + w).trim().length > maxChars) {
      if (buf) lines.push(buf.trim());
      buf = w;
    } else {
      buf = (buf + ' ' + w).trim();
    }
  }
  if (buf) lines.push(buf.trim());
  return lines;
}

// ─── EU Form 2024/949 — exact structure matching the official annex ───────────
async function buildEuBlanket(info, comp, person) {
  const pdfDoc = await PDFDocument.create();
  const page = pdfDoc.addPage([595.28, 841.89]);
  const { width, height } = page.getSize();
  const bold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);
  const regular = await pdfDoc.embedFont(StandardFonts.Helvetica);

  const BLUE      = hexToRgb('#1a2e73');
  const LBLUE     = hexToRgb('#edf0fa');
  const GOLD      = hexToRgb('#c8a96e');
  const MID       = hexToRgb('#555555');
  const LITE      = hexToRgb('#f4f4f4');
  const BORDER    = hexToRgb('#cccccc');
  const WHITE     = rgb(1,1,1);
  const BLACK     = rgb(0,0,0);
  const m = 44;

  function fillRect(x, y, w, h, color) {
    page.drawRectangle({ x, y: height-y-h, width: w, height: h, color });
  }
  function strokeRect(x, y, w, h, color, lw=0.5) {
    page.drawRectangle({ x, y: height-y-h, width: w, height: h, borderColor: color, borderWidth: lw, color: rgb(1,1,1,0) });
  }
  function line(x1, y1, x2, y2, color=BORDER, lw=0.4) {
    page.drawLine({ start:{x:x1, y:height-y1}, end:{x:x2, y:height-y2}, thickness:lw, color });
  }
  function txt(text, x, y, size=8, color=BLACK, isBold=false) {
    page.drawText(String(text||''), { x, y: height-y-size, size, font: isBold?bold:regular, color });
  }
  function checkbox(x, y, checked=false, size=8) {
    strokeRect(x, y, size, size, BLACK, 0.7);
    if (checked) {
      txt('X', x+1.5, y, 6.5, BLUE, true);
    }
  }
  function fieldRow(label, value, x, y, w, h=13) {
    strokeRect(x, y, w, h, BORDER, 0.4);
    txt(label, x+2, y+1, 6, MID);
    txt(String(value||''), x+2, y+5, 7.5, BLACK);
  }
  function sectionHeader(num, title, y) {
    fillRect(m-4, y, width-m*2+8, 14, LBLUE);
    strokeRect(m-4, y, width-m*2+8, 14, BORDER, 0.4);
    txt(num + '.  ' + title, m, y+3, 7.5, BLUE, true);
    return y + 18;
  }

  // ── HEADER ──────────────────────────────────────────────────────────────────
  fillRect(0, 0, width, 44, BLUE);
  txt('REIMBURSEMENT AND COMPENSATION REQUEST FORM', m, 12, 9.5, WHITE, true);
  txt('under Regulation (EU) 2021/782 of the European Parliament and of the Council', m, 25, 7, hexToRgb('#c0ccff'));
  txt('Commission Implementing Regulation (EU) 2024/949 of 27 March 2024', m, 35, 6.5, hexToRgb('#8899cc'));

  // EU emblem small block
  fillRect(width-60, 4, 52, 36, hexToRgb('#0c1d5a'));
  txt('★ ★ ★', width-55, 10, 8, GOLD, true);
  txt('★   ★', width-55, 20, 8, GOLD, true);
  txt('★ ★ ★', width-55, 30, 8, GOLD, true);

  let y = 54;
  // Instruction lines
  const instrLines = [
    'Passengers may use this form to request reimbursement, compensation or both from railway undertakings.',
    'Fill out the relevant parts of the form clearly IN BLOCK CAPITALS.',
  ];
  for (const l of instrLines) { txt(l, m, y, 6.5, MID); y += 9; }
  y += 4;

  // ── SECTION 1: Reason(s) ────────────────────────────────────────────────────
  y = sectionHeader('1', 'Reason(s) for your request', y);
  txt('Please indicate a cross [X] next to each incident that applies to your request:', m, y, 7, MID);
  y += 11;
  const reasons = [
    ['Delay', true],
    ['Cancellation', false],
    ['Missed connection due to a delay or cancellation', false],
  ];
  strokeRect(m-4, y, width-m*2+8, reasons.length*13+6, BORDER, 0.4);
  for (const [label, chk] of reasons) {
    checkbox(m+2, y+2, chk);
    txt(label, m+14, y+2, 7.5);
    y += 13;
  }
  y += 4;

  // ── SECTION 2: Previous request ─────────────────────────────────────────────
  y = sectionHeader('2', 'Previous request for reimbursement/compensation for delay/cancellation/missed connection for the same rail journey', y);
  const prevNote = 'Have you already requested reimbursement and/or compensation for a cancellation, delay or missed connection during the same rail journey via such channel(s)? If yes, please complete the information below.';
  for (const l of wrapText(prevNote, 102)) { txt(l, m, y, 6.5, MID, false); y += 8; }
  y += 2;
  const colW = (width-m*2-8)/3;
  fieldRow('2.1. Date of previous request (day/month/year)', '', m, y, colW, 13);
  fieldRow('2.2. Request addressed to (railway undertaking)', '', m+colW+4, y, colW, 13);
  fieldRow('2.3. Means used (e.g. online form, mobile app)', '', m+colW*2+8, y, colW, 13);
  y += 17;

  // ── SECTION 3: Journey details ───────────────────────────────────────────────
  y = sectionHeader('3', 'Your journey details', y);

  // 3.1 Railway undertaking
  fieldRow('3.1. Name of railway undertaking', info.operatoer||'', m, y, width-m*2, 13);
  y += 17;

  // 3.2 Scheduled journey
  txt('3.2. Scheduled journey', m, y, 7, BLUE, true); y += 10;
  const hw = (width-m*2-4)/2;
  const hw3 = (width-m*2-8)/3;
  fieldRow('3.2.1. Departure date (day/month/year)', info.dato||'', m, y, hw3, 13);
  fieldRow('3.2.2. Departure station', info.fra||'', m+hw3+4, y, hw3, 13);
  fieldRow('3.2.3. Destination station', info.til||'', m+hw3*2+8, y, hw3, 13);
  y += 17;
  const hw4 = (width-m*2-12)/4;
  fieldRow('3.2.4. Scheduled departure time (hh:mm)', info.tidspunkt||'', m, y, hw4, 13);
  fieldRow('3.2.5. Scheduled arrival time (hh:mm)', '', m+hw4+4, y, hw4, 13);
  fieldRow('3.2.6. Train No / category', info.tog||'', m+hw4*2+8, y, hw4, 13);
  fieldRow('3.2.7. Ticket No / Booking Reference', info.bookingRef||'', m+hw4*3+12, y, hw4, 13);
  y += 17;
  fieldRow('3.2.8. Ticket price(s)', String(info.billetpris||'') + ' ' + (info.valuta||'DKK'), m, y, hw, 13);
  y += 17;

  // 3.3 Actual journey
  txt('3.3. Actual journey', m, y, 7, BLUE, true); y += 10;
  const hw5 = (width-m*2-16)/5;
  const delayMap = { '30-59 min': '45', '60-119 min': '90', '120+ min': '120+' };
  const delayMins = delayMap[info.forsinkelse] || '';
  fieldRow('3.3.1. Date of actual arrival (day/month/year)', info.dato||'', m, y, hw4, 13);
  fieldRow('3.3.2. Actual time of departure (hh:mm)', info.tidspunkt||'', m+hw4+4, y, hw4, 13);
  fieldRow('3.3.3. Actual time of arrival at destination', '', m+hw4*2+8, y, hw4, 13);
  fieldRow('3.3.4. Train No / category of train', info.tog||'', m+hw4*3+12, y, hw4, 13);
  y += 17;

  // ── SECTION 4: Nature of request ────────────────────────────────────────────
  y = sectionHeader('4', 'Nature of your request towards the railway undertaking', y);
  txt('Please specify your claim(s) with a cross [X]:', m, y, 7, MID); y += 11;
  const is120 = info.forsinkelse === '120+ min';
  const is60  = info.forsinkelse === '60-119 min';
  const natureItems = [
    ['Reimbursement from railway undertaking of the ticket(s) due to cancelled/delayed train (≥60 min delay)', false],
    ['Compensation from railway undertaking — For a delay at final destination of 60 to 119 minutes', is60],
    ['Compensation from railway undertaking — For a delay at final destination of 120 minutes or more', is120],
    ['Reimbursement of costs for alternative transport, meals, accommodation, etc.', false],
  ];
  strokeRect(m-4, y, width-m*2+8, natureItems.length*13+6, BORDER, 0.4);
  for (const [label, chk] of natureItems) {
    checkbox(m+2, y+2, chk);
    for (const l of wrapText(label, 94)) { txt(l, m+14, y+2, 7); y += 9; }
    y += 4;
  }
  y += 2;

  // ── SECTION 5: Personal details ──────────────────────────────────────────────
  y = sectionHeader('5', 'Personal details', y);
  const nameParts = (person.navn||'').split(' ');
  const firstName = nameParts.slice(0,-1).join(' ') || person.navn||'';
  const lastName  = nameParts.slice(-1)[0] || '';
  fieldRow('5.1.1. First name', firstName, m, y, hw, 13);
  fieldRow('5.1.2. Last name', lastName, m+hw+4, y, hw, 13);
  y += 17;
  // Address
  const addrParts = (person.adresse||'').split(',');
  const street = addrParts[0]?.trim()||'';
  const cityLine = addrParts.slice(1).join(',').trim()||'';
  fieldRow('5.2.1. Street name & No.', street, m, y, hw, 13);
  fieldRow('5.2.3–5. Country / Postal code / City', cityLine, m+hw+4, y, hw, 13);
  y += 17;
  fieldRow('5.3.1. Email address (address used at time of booking)', person.email||'', m, y, hw+hw/2, 13);
  fieldRow('5.3.2. Telephone number', '', m+hw+hw/2+4, y, hw/2, 13);
  y += 17;
  // Payment
  txt('5.4. Preferred form of payment for reimbursement/compensation:', m, y, 7, MID);
  checkbox(m+240, y, true); txt('Money', m+252, y, 7);
  checkbox(m+290, y, false); txt('Vouchers and/or other services (if offered)', m+302, y, 7);
  y += 14;
  strokeRect(m-4, y, width-m*2+8, 42, BORDER, 0.4);
  txt('5.5. Payment details (in case of preference for reimbursement/compensation in money):', m, y+2, 6.5, MID);
  y += 11;
  fieldRow('5.5.1. IBAN (account number)', person.iban||'', m, y, hw, 13);
  fieldRow('5.5.2. SWIFT/BIC (routing number)', person.swift||'', m+hw+4, y, hw/2, 13);
  fieldRow('5.5.4. Name of account holder', person.navn||'', m+hw+hw/2+8, y, hw/2, 13);
  y += 17;

  // ── SECTION 6: Additional information ────────────────────────────────────────
  y = sectionHeader('6', 'Additional information related to your ticket/journey', y);
  const addlNote = 'Compensation claimed: ' + (comp.compensation||0).toFixed(2) + ' ' + (info.valuta||'DKK') + '  |  This claim is submitted under EU Reg. 2021/782, Art. 19.';
  strokeRect(m-4, y, width-m*2+8, 24, BORDER, 0.4);
  txt(addlNote, m, y+6, 7.5, BLUE, true);
  y += 28;

  // ── DOCUMENTS ────────────────────────────────────────────────────────────────
  fillRect(m-4, y, width-m*2+8, 18, LITE);
  strokeRect(m-4, y, width-m*2+8, 18, BORDER, 0.4);
  txt('PLEASE ATTACH RELEVANT DOCUMENTS', m, y+3, 7, BLACK, true);
  txt('(e.g. ticket(s) or reservation(s), including documentation for additional costs incurred; delay/cancellation confirmation where appropriate)', m, y+11, 6.5, MID);
  y += 22;

  // ── SIGNATURE ────────────────────────────────────────────────────────────────
  y += 4;
  txt('Date: ' + (person.dato_signed||''), m, y, 8);
  txt('Place: ' + 'Denmark', m+120, y, 8);
  txt('Signature: ', m+240, y, 8);
  strokeRect(m+290, y-2, 160, 16, BORDER, 0.5);
  txt(person.navn||'', m+294, y+2, 9, BLUE, true);
  txt('(digital signature — EU Reg. 2024/949)', m+294, y+9, 6, MID);
  y += 24;

  // ── SUBMIT TO ─────────────────────────────────────────────────────────────────
  fillRect(m-4, y, width-m*2+8, 14, BLUE);
  txt('SUBMIT TO:  ' + (info.operatoer||'') + '   ·   ' + (comp.authorityUrl||''), m, y+3, 7, WHITE, true);
  y += 18;

  // ── FOOTER ───────────────────────────────────────────────────────────────────
  fillRect(0, height-22, width, 22, BLUE);
  txt('Commission Implementing Regulation (EU) 2024/949 of 27 March 2024  ·  Regulation (EU) 2021/782', m, height-14, 6.5, hexToRgb('#c0ccff'));
  txt('www.europa.eu/youreurope/citizens/travel', width-190, height-14, 6.5, hexToRgb('#8899cc'));

  const pdfBytes = await pdfDoc.save();
  return Buffer.from(pdfBytes).toString('base64');
}

// ─── Power of Attorney (unchanged, just updated to use authorityUrl) ──────────
async function buildFuldmagt(info, comp, person) {
  const pdfDoc = await PDFDocument.create();
  const page = pdfDoc.addPage([595.28, 841.89]);
  const { width, height } = page.getSize();
  const bold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);
  const regular = await pdfDoc.embedFont(StandardFonts.Helvetica);
  const BLUE = hexToRgb('#1a2e73');
  const GOLD = hexToRgb('#c8a96e');
  const MID = hexToRgb('#737373');
  const LITE = hexToRgb('#ededed');
  const CREAM = hexToRgb('#fdf8f0');
  const WHITE = rgb(1,1,1);
  const BLACK = rgb(0,0,0);
  const ORANGE = hexToRgb('#8c4700');
  const m = 58;
  function fillRect(x, y, w, h, color) { page.drawRectangle({ x, y: height-y-h, width: w, height: h, color }); }
  function strokeRect(x, y, w, h, color, lw=0.8) { page.drawRectangle({ x, y: height-y-h, width: w, height: h, borderColor: color, borderWidth: lw, color: rgb(1,1,1,0) }); }
  function txt(text, x, y, size=10, color=BLACK, isBold=false) { page.drawText(String(text||''), { x, y: height-y-size, size, font: isBold?bold:regular, color }); }
  function para(text, x, yStart, maxChars, size=10, color=BLACK, isBold=false, lh=15) {
    let y = yStart;
    for (const line of wrapText(text, maxChars)) { txt(line, x, y, size, color, isBold); y += lh; }
    return y;
  }
  // Header
  fillRect(0, 0, width, 70, BLUE);
  txt('POWER OF ATTORNEY', m, 26, 22, WHITE, true);
  txt('Authorisation to act on behalf of rail passenger — EU Reg. 2021/782', m, 48, 10, hexToRgb('#c0ccff'));
  txt('Date: '+(person.dato_signed||''), width-140, 44, 9, hexToRgb('#c0ccff'));
  let y = 96;
  // Grantor box
  fillRect(m-12, y, width-m*2+24, 72, hexToRgb('#f0f2fa'));
  txt('GRANTOR (PASSENGER)', m, y+4, 8.5, MID, true);
  y += 18;
  txt('Name:', m, y, 10, BLACK, true); txt(person.navn, m+52, y, 10); y += 16;
  txt('Address:', m, y, 10, BLACK, true); txt(person.adresse||'', m+62, y, 10); y += 16;
  txt('Email:', m, y, 10, BLACK, true); txt(person.email||'', m+46, y, 10); y += 28;
  txt('GRANTS POWER OF ATTORNEY TO:', m, y, 9, MID, true); y += 16;
  fillRect(m-12, y, width-m*2+24, 48, LITE);
  txt('EU Rail Refund ApS', m, y+4, 13, BLUE, true); y += 18;
  txt('To represent the grantor in connection with the rail compensation claim detailed below.', m, y, 9.5, MID); y += 36;
  // Journey box
  fillRect(m-12, y, width-m*2+24, 92, hexToRgb('#f5f7ff'));
  fillRect(m-12, y, width-m*2+24, 18, BLUE);
  txt('CLAIM JOURNEY DETAILS', m, y+4, 8.5, WHITE, true); y += 16;
  txt('From:', m, y, 10, BLACK, true); txt(info.fra||'', m+35, y, 10);
  txt('To:', m+240, y, 10, BLACK, true); txt(info.til||'', m+270, y, 10); y += 15;
  txt('Date:', m, y, 10, BLACK, true); txt(info.dato||'', m+42, y, 10);
  txt('Delay:', m+145, y, 10, BLACK, true); txt(info.forsinkelse||'', m+190, y, 10); y += 15;
  txt('Operator:', m, y, 10, BLACK, true); txt(info.operatoer||'', m+62, y, 10); y += 15;
  txt('Compensation claim:', m, y, 10, BLUE, true);
  txt((comp.compensation||0).toFixed(2)+' '+(info.valuta||'DKK')+' (EU Reg. 2021/782, Art. 19)', m+135, y, 10, BLUE, true); y += 32;
  // Scope
  txt('SCOPE OF AUTHORITY', m, y, 9, MID, true); y += 16;
  const items = [
    'To submit and sign the official EU form (Reg. EU 2024/949) to ' + (info.operatoer||'') + ' on behalf of the grantor.',
    'To correspond with the railway operator and national enforcement bodies, including ' + (comp.authority||'') + '.',
    'To receive the compensation amount and pay the grantor's share (75%) within 5 business days.',
    'To escalate to ' + (comp.authority||'') + ' if the operator does not reply within 30 days (EU Reg. 2021/782, Art. 29).',
  ];
  for (let i = 0; i < items.length; i++) {
    txt((i+1)+'.', m, y, 9.5, BLACK, true);
    y = para(items[i], m+18, y, 82, 9.5, BLACK, false, 14) + 5;
  }
  y += 8;
  // Fee
  fillRect(m-12, y, width-m*2+24, 40, CREAM);
  page.drawLine({ start:{x:m-12, y:height-y}, end:{x:m-12, y:height-y-40}, thickness:2, color:GOLD });
  txt('FEE:', m, y+4, 9, ORANGE, true);
  txt('25% of compensation obtained. No payment if the claim is rejected.', m, y+18, 9.5); y += 42;
  para('GDPR: Personal data processed in accordance with Regulation (EU) 2016/679.', m, y, 88, 8.5, MID); y += 24;
  txt('SIGNATURE / DIGITAL SIGNATURE', m, y, 9, MID, true); y += 18;
  strokeRect(m, y, 220, 48, MID, 0.8);
  txt(person.navn, m+8, y+20, 15, BLUE, true);
  txt('(digital signature)', m+8, y+34, 7, MID);
  txt('Date: '+(person.dato_signed||''), m+250, y+14, 10);
  txt('Place: Denmark', m+250, y+32, 10);
  // Footer
  fillRect(0, height-22, width, 22, BLUE);
  txt('Power of Attorney — EU Rail Refund ApS  ·  Regulation (EU) 2021/782 and 2024/949', m, height-15, 6.5, hexToRgb('#c0ccff'));
  const pdfBytes = await pdfDoc.save();
  return Buffer.from(pdfBytes).toString('base64');
}

export default async function handler(req, res) {
  if (req.method === 'OPTIONS') {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
    return res.status(200).end();
  }
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
  try {
    const { info, comp, person } = req.body;
    const eu = await buildEuBlanket(info, comp, person);
    const fuldmagt = await buildFuldmagt(info, comp, person);
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.status(200).json({ eu, fuldmagt });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: e.message });
  }
}
