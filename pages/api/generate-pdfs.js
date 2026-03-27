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

async function buildEuBlanket(info, comp, person) {
  const pdfDoc = await PDFDocument.create();
  const page = pdfDoc.addPage([595.28, 841.89]);
  const { width, height } = page.getSize();
  const bold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);
  const regular = await pdfDoc.embedFont(StandardFonts.Helvetica);

  const BLUE = hexToRgb('#1a2e73');
  const LIGHTBLUE = hexToRgb('#edf0fa');
  const GOLD = hexToRgb('#c8a96e');
  const MID = hexToRgb('#737373');
  const LITE = hexToRgb('#ededed');
  const WHITE = rgb(1,1,1);
  const BLACK = rgb(0,0,0);
  const m = 48;

  function fillRect(x, y, w, h, color) {
    page.drawRectangle({ x, y: height-y-h, width: w, height: h, color });
  }
  function strokeRect(x, y, w, h, color, lw=0.6) {
    page.drawRectangle({ x, y: height-y-h, width: w, height: h, borderColor: color, borderWidth: lw, color: rgb(1,1,1,0) });
  }
  function txt(text, x, y, size=9, color=BLACK, isBold=false) {
    page.drawText(String(text||''), { x, y: height-y-size, size, font: isBold?bold:regular, color });
  }
  function field(label, value, fx, fy, fw, fh=13) {
    txt(label, fx, fy+fh+2, 6.5, MID);
    fillRect(fx, fy, fw, fh, LITE);
    txt(String(value||''), fx+3, fy, 8.5);
  }
  function checkbox(x, y, checked=false, size=9) {
    strokeRect(x, y, size, size, BLACK, 0.7);
    if (checked) {
      fillRect(x+1, y+1, size-2, size-2, BLUE);
      txt('X', x+1.5, y+1, 7, WHITE, true);
    }
  }

  // HEADER
  fillRect(0, 0, width, 50, BLUE);
  txt('EUROPEAN UNION', m, 15, 7, WHITE, true);
  txt('Commission Implementing Regulation (EU) 2024/949 of 27 March 2024', m, 26, 6.5, hexToRgb('#c0ccff'));
  txt('COMMON FORM — REIMBURSEMENT AND COMPENSATION REQUEST', m, 40, 10, WHITE, true);

  let y = 66;
  function section(title) {
    fillRect(m-4, y-4, width-m*2+8, 16, LIGHTBLUE);
    txt(title, m, y+3, 7.5, BLUE, true);
    y += 22;
  }

  // S1
  section('1. TYPE OF CLAIM');
  txt('Compensation for delay (Art. 19, Reg. EU 2021/782):', m, y+1, 8);
  checkbox(m+280, y, true);
  y += 20;

  // S2
  section('2. JOURNEY DETAILS');
  const hw = (width - m*2 - 8) / 2;
  field('Station of departure', info.fra, m, y, hw);
  field('Station of destination', info.til, m+hw+8, y, hw);
  y += 26;
  field('Date of travel (DD/MM/YYYY)', info.dato, m, y, hw);
  field('Scheduled departure time', info.tidspunkt, m+hw+8, y, hw);
  y += 26;
  field('Railway undertaking', info.operatoer, m, y, hw);
  field('Train number', info.tog||'', m+hw+8, y, hw);
  y += 26;
  txt('Delay at final destination:', m, y+1, 8);
  let dx = m+150;
  for (const [label, chk] of [['< 60 min', info.forsinkelse==='30-59 min'],['60-119 min', info.forsinkelse==='60-119 min'],['>=120 min', info.forsinkelse==='120+ min']]) {
    checkbox(dx, y, chk); txt(label, dx+13, y+1, 8); dx += 80;
  }
  y += 26;
  field('Ticket price', info.billetpris+' '+(info.valuta||'DKK'), m, y, hw);
  field('Compensation claimed', (comp.compensation||0).toFixed(2)+' '+(info.valuta||'DKK'), m+hw+8, y, hw);
  y += 30;

  // S3
  section('3. PASSENGER DETAILS');
  field('Full name', person.navn, m, y, width-m*2);
  y += 26;
  field('Address', person.adresse, m, y, width-m*2);
  y += 26;
  field('Email address', person.email, m, y, hw);
  y += 26;
  field('IBAN (for bank transfer)', person.iban||'', m, y, width-m*2);
  y += 30;

  // S4
  section('4. PREVIOUS REQUEST');
  txt('Have you already submitted a request?', m, y+1, 8);
  checkbox(m+220, y, true); txt('No — first request', m+232, y+1, 8);
  y += 22;

  // S5
  section('5. SUPPORTING DOCUMENTS');
  for (const [label, chk] of [['Original ticket / booking confirmation', true],['Proof of delay', false]]) {
    checkbox(m, y, chk); txt(label, m+14, y+1, 8); y += 15;
  }
  y += 8;

  // S6
  section('6. DECLARATION AND SIGNATURE');
  const decl = 'I hereby declare that all information provided is true and accurate. I understand this form is submitted under EU Regulation 2021/782.';
  for (const line of wrapText(decl, 100)) {
    txt(line, m, y, 7.5, MID);
    y += 11;
  }
  y += 10;
  strokeRect(m, y, 215, 42, MID, 0.8);
  txt(person.navn, m+6, y+18, 14, BLUE, true);
  txt('(digital signature — EU Reg. 2024/949)', m+6, y+30, 6.5, MID);
  field('Date', person.dato_signed||'', m+228, y+14, 120);
  field('Place', 'Denmark', m+228, y+28, 120);
  y += 62;
  txt('SUBMIT TO: '+(info.operatoer||'')+' — '+(comp.authority||'')+' — '+(comp.url||''), m, y, 8, BLUE, true);
  y += 13;
  txt('This form may be submitted electronically under EU Reg. 2021/782, Art. 18-19.', m, y, 7, MID);

  // Footer
  fillRect(0, height-20, width, 20, BLUE);
  txt('Commission Implementing Reg. (EU) 2024/949 · Regulation (EU) 2021/782', m, height-14, 6.5, hexToRgb('#c0ccff'));

  const pdfBytes = await pdfDoc.save();
  return Buffer.from(pdfBytes).toString('base64');
}

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

  function fillRect(x, y, w, h, color) {
    page.drawRectangle({ x, y: height-y-h, width: w, height: h, color });
  }
  function strokeRect(x, y, w, h, color, lw=0.8) {
    page.drawRectangle({ x, y: height-y-h, width: w, height: h, borderColor: color, borderWidth: lw, color: rgb(1,1,1,0) });
  }
  function txt(text, x, y, size=10, color=BLACK, isBold=false) {
    page.drawText(String(text||''), { x, y: height-y-size, size, font: isBold?bold:regular, color });
  }
  function para(text, x, yStart, maxChars, size=10, color=BLACK, isBold=false, lh=15) {
    let y = yStart;
    for (const line of wrapText(text, maxChars)) {
      txt(line, x, y, size, color, isBold);
      y += lh;
    }
    return y;
  }

  // Header
  fillRect(0, 0, width, 70, BLUE);
  txt('FULDMAGT', m, 28, 24, WHITE, true);
  txt('Power of Attorney — Togkompensationskrav', m, 48, 11, hexToRgb('#c0ccff'));
  txt('Dato: '+(person.dato_signed||''), width-140, 44, 9, hexToRgb('#c0ccff'));

  let y = 96;

  // Undertegnede box
  fillRect(m-12, y, width-m*2+24, 72, hexToRgb('#f0f2fa'));
  txt('UNDERTEGNEDE — FULDMAGTSGIVER', m, y+4, 8.5, MID, true);
  y += 18;
  txt('Navn:', m, y, 10, BLACK, true); txt(person.navn, m+52, y, 10);
  y += 16;
  txt('Adresse:', m, y, 10, BLACK, true); txt(person.adresse||'', m+62, y, 10);
  y += 16;
  txt('Email:', m, y, 10, BLACK, true); txt(person.email||'', m+46, y, 10);
  y += 28;

  txt('GIVER HERMED FULDMAGT TIL:', m, y, 9, MID, true);
  y += 16;
  fillRect(m-12, y, width-m*2+24, 48, LITE);
  txt('EU Rail Refund ApS', m, y+4, 13, BLUE, true);
  y += 18;
  txt('Til at repraesentere undertegnede ift. nedenstaaende togkompensationskrav.', m, y, 9.5, MID);
  y += 36;

  // Journey box
  fillRect(m-12, y, width-m*2+24, 92, hexToRgb('#f5f7ff'));
  fillRect(m-12, y, width-m*2+24, 18, BLUE);
  txt('KRAVETS REJSEDETALJER', m, y+4, 8.5, WHITE, true);
  y += 16;
  txt('Fra:', m, y, 10, BLACK, true); txt(info.fra||'', m+35, y, 10);
  txt('Til:', m+240, y, 10, BLACK, true); txt(info.til||'', m+270, y, 10);
  y += 15;
  txt('Dato:', m, y, 10, BLACK, true); txt(info.dato||'', m+42, y, 10);
  txt('Forsinkelse:', m+145, y, 10, BLACK, true); txt(info.forsinkelse||'', m+222, y, 10);
  y += 15;
  txt('Operatoer:', m, y, 10, BLACK, true); txt(info.operatoer||'', m+68, y, 10);
  y += 15;
  txt('Kompensationskrav:', m, y, 10, BLUE, true);
  txt((comp.compensation||0).toFixed(2)+' '+(info.valuta||'DKK')+' (jf. EU 2021/782, Art. 19)', m+135, y, 10, BLUE, true);
  y += 32;

  // Omfang
  txt('FULDMAGTENS OMFANG', m, y, 9, MID, true);
  y += 16;
  const items = [
    'At indgive og underskrive den officielle EU-blanket (Forordning EU 2024/949) paa vegne af fuldmagtsgiver.',
    'At korrespondere med jernbaneoperatoeren og nationale klageinstanser, herunder '+(comp.authority||'')+' .',
    'At modtage kompensationsbelobet og udbetale fuldmagtsgivers andel (75%) inden for 5 hverdage.',
    'At videresende klagen til '+(comp.authority||'')+' hvis operatoeren ikke svarer inden 30 dage.',
  ];
  for (let i = 0; i < items.length; i++) {
    txt((i+1)+'.', m, y, 9.5, BLACK, true);
    y = para(items[i], m+18, y, 82, 9.5, BLACK, false, 14) + 5;
  }
  y += 8;

  // Honorar
  fillRect(m-12, y, width-m*2+24, 40, CREAM);
  page.drawLine({ start: {x: m-12, y: height-y}, end: {x: m-12, y: height-y-40}, thickness: 2, color: GOLD });
  txt('HONORAR:', m, y+4, 9, ORANGE, true);
  txt('25% af opnaet kompensation. Ingen betaling ved afvisning.', m, y+18, 9.5);
  y += 42;

  para('GDPR: Personoplysninger behandles iht. Forordning (EU) 2016/679.', m, y, 88, 8.5, MID);
  y += 24;

  txt('UNDERSKRIFT / SIGNATURE', m, y, 9, MID, true);
  y += 18;
  strokeRect(m, y, 220, 48, MID, 0.8);
  txt(person.navn, m+8, y+20, 15, BLUE, true);
  txt('(digital underskrift)', m+8, y+34, 7, MID);
  txt('Dato: '+(person.dato_signed||''), m+250, y+14, 10);
  txt('Sted: Danmark', m+250, y+32, 10);

  // Footer
  fillRect(0, height-22, width, 22, BLUE);
  txt('Fuldmagt til EU Rail Refund ApS · Jf. Forordning (EU) 2021/782 og 2024/949', m, height-15, 6.5, hexToRgb('#c0ccff'));

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
