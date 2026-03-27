import json
import math
import base64
import io
from http.server import BaseHTTPRequestHandler
from reportlab.pdfgen import canvas
from reportlab.lib.pagesizes import A4
from reportlab.lib.colors import HexColor, white, black

W, H = A4

BLUE     = HexColor("#1a2e73")
LIGHTBLUE= HexColor("#edf0fa")
GOLD     = HexColor("#c8a96e")
MID      = HexColor("#737373")
LITE     = HexColor("#ededed")
ORANGE   = HexColor("#8c4700")
CREAM    = HexColor("#fdf8f0")

def wrap(text, max_chars):
    words = text.split()
    lines, buf = [], ""
    for w in words:
        if len(buf + " " + w) > max_chars:
            lines.append(buf.strip())
            buf = w
        else:
            buf = (buf + " " + w).strip()
    if buf:
        lines.append(buf)
    return lines

def eu_blanket(info, comp, person):
    buf = io.BytesIO()
    c = canvas.Canvas(buf, pagesize=A4)
    m = 48

    def fill_rect(x, y, w, h, color):
        c.setFillColor(color); c.rect(x, y, w, h, fill=1, stroke=0)
    def stroke_rect(x, y, w, h, color, lw=0.6):
        c.setStrokeColor(color); c.setLineWidth(lw); c.rect(x, y, w, h, fill=0, stroke=1)
    def txt(text, x, y, size=9, color=black, bold=False):
        c.setFillColor(color); c.setFont("Helvetica-Bold" if bold else "Helvetica", size); c.drawString(x, y, str(text))
    def hline(x1, y1, x2, color=MID, lw=0.5):
        c.setStrokeColor(color); c.setLineWidth(lw); c.line(x1, y1, x2, y1)
    def field(label, value, fx, fy, fw, fh=13):
        txt(label, fx, fy+fh+2, 6.5, MID)
        fill_rect(fx, fy, fw, fh, LITE)
        txt(value or "", fx+3, fy+3, 8.5)
    def checkbox(x, y, checked=False, size=9):
        stroke_rect(x, y, size, size, black, 0.7)
        if checked:
            fill_rect(x+1, y+1, size-2, size-2, BLUE)
            c.setFillColor(white); c.setFont("Helvetica-Bold", 7); c.drawString(x+1.5, y+1.5, "X")

    # HEADER
    fill_rect(0, H-50, W, 50, BLUE)
    txt("EUROPEAN UNION", m, H-15, 7, white, True)
    txt("Commission Implementing Regulation (EU) 2024/949 of 27 March 2024", m, H-26, 6.5, HexColor("#c0ccff"))
    txt("COMMON FORM — REIMBURSEMENT AND COMPENSATION REQUEST", m, H-40, 10, white, True)
    for i in range(12):
        a = (i/12)*math.pi*2
        c.setFillColor(HexColor("#ffdd00")); c.setFont("Helvetica-Bold", 7)
        c.drawString(W-65+math.cos(a)*14-3, H-25+math.sin(a)*14-3, "*")

    y = H - 66

    def section(title):
        nonlocal y
        fill_rect(m-4, y-4, W-m*2+8, 16, LIGHTBLUE)
        txt(title, m, y+3, 7.5, BLUE, True)
        y -= 22

    # S1: CLAIM TYPE
    section("1.  TYPE OF CLAIM — Place a cross [X] in the applicable box")
    txt("Reimbursement due to cancellation:", m, y+1, 8); checkbox(m+172, y, False)
    txt("Compensation for delay (Art. 19, Reg. EU 2021/782):", m+230, y+1, 8); checkbox(m+443, y, True)
    y -= 15
    txt("Continuation / re-routing:", m, y+1, 8); checkbox(m+132, y, False)
    txt("Meals / refreshments:", m+230, y+1, 8); checkbox(m+338, y, False)
    y -= 20

    # S2: JOURNEY
    section("2.  JOURNEY DETAILS")
    hw = (W - m*2 - 8) / 2
    field("Station of departure", info["fra"], m, y, hw)
    field("Station of destination", info["til"], m+hw+8, y, hw); y -= 26
    field("Date of travel (DD/MM/YYYY)", info["dato"], m, y, hw)
    field("Scheduled departure time", info["tidspunkt"], m+hw+8, y, hw); y -= 26
    field("Railway undertaking (operator)", info["operatoer"], m, y, hw)
    field("Train number (if known)", info.get("tog", ""), m+hw+8, y, hw); y -= 26
    txt("Delay at final destination:", m, y+1, 8)
    dx = m+145
    for label, chk in [("< 60 min", info["forsinkelse"]=="30-59 min"),
                        ("60-119 min", info["forsinkelse"]=="60-119 min"),
                        (">= 120 min", info["forsinkelse"]=="120+ min")]:
        checkbox(dx, y, chk); txt(label, dx+13, y+1, 8); dx += 80
    y -= 26
    field("Ticket price", f"{info['billetpris']} {info['valuta']}", m, y, hw)
    field("Compensation claimed", f"{comp['compensation']:.2f} {info['valuta']}", m+hw+8, y, hw); y -= 30

    # S3: PASSENGER
    section("3.  PASSENGER DETAILS")
    field("Full name", person["navn"], m, y, W-m*2); y -= 26
    field("Address", person["adresse"], m, y, W-m*2); y -= 26
    field("Email address", person["email"], m, y, hw)
    field("Phone (optional)", person.get("telefon",""), m+hw+8, y, hw); y -= 26
    field("IBAN (for bank transfer)", person.get("iban",""), m, y, W-m*2); y -= 30

    # S4
    section("4.  PREVIOUS REQUEST FOR REIMBURSEMENT / COMPENSATION")
    txt("Have you already submitted a request to the railway undertaking?", m, y+1, 8)
    checkbox(m+280, y, False); txt("Yes", m+292, y+1, 8)
    checkbox(m+315, y, True);  txt("No — first request", m+327, y+1, 8); y -= 22

    # S5
    section("5.  SUPPORTING DOCUMENTS ENCLOSED")
    for label, chk in [("Original ticket / booking confirmation", True),
                        ("Proof of delay (station notification / app screenshot)", False),
                        ("Proof of costs for alternative transport (if applicable)", False)]:
        checkbox(m, y, chk); txt(label, m+14, y+1, 8); y -= 15
    y -= 8

    # S6
    section("6.  DECLARATION AND SIGNATURE")
    decl = "I hereby acknowledge that the recipient of this form may share my personal data with other relevant parties if required for the processing of my request. I hereby declare that all of the information provided in this form is true and accurate in all respects."
    dy = y
    for line in wrap(decl, 104):
        txt(line, m, dy, 7.5, MID); dy -= 11
    y = dy - 10
    stroke_rect(m, y-34, 215, 42, MID, 0.8)
    txt(person["navn"], m+6, y-18, 14, BLUE, True)
    txt("(digital signature — EU Reg. 2024/949)", m+6, y-30, 6.5, MID)
    txt("Signature:", m, y+5, 7.5, MID)
    field("Date", person.get("dato_signed",""), m+228, y-14, 120)
    field("Place", "Denmark", m+228, y-40, 120)
    y -= 62

    hline(m, y, W-m, MID, 0.8); y -= 13
    txt(f"SUBMIT TO: {info['operatoer']}  —  {comp['authority']}  —  {comp['url']}", m, y, 8, BLUE, True)
    y -= 13
    txt("This form may be submitted electronically or on paper to any EU railway company (Reg. EU 2021/782, Art. 18-19).", m, y, 7, MID)

    fill_rect(0, 0, W, 20, BLUE)
    txt("Commission Implementing Reg. (EU) 2024/949  ·  Regulation (EU) 2021/782 on rail passengers rights", m, 6, 6.5, HexColor("#c0ccff"))

    c.save()
    return buf.getvalue()


def fuldmagt(info, comp, person):
    buf = io.BytesIO()
    c = canvas.Canvas(buf, pagesize=A4)
    m = 58

    def fill_rect(x, y, w, h, color):
        c.setFillColor(color); c.rect(x, y, w, h, fill=1, stroke=0)
    def stroke_rect(x, y, w, h, color, lw=0.8):
        c.setStrokeColor(color); c.setLineWidth(lw); c.rect(x, y, w, h, fill=0, stroke=1)
    def txt(text, x, y, size=10, color=black, bold=False):
        c.setFillColor(color); c.setFont("Helvetica-Bold" if bold else "Helvetica", size); c.drawString(x, y, str(text))
    def para(text, x, y, max_chars, size=10, color=black, bold=False, lh=15):
        for line in wrap(text, max_chars):
            txt(line, x, y, size, color, bold); y -= lh
        return y

    # HEADER
    fill_rect(0, H-70, W, 70, BLUE)
    txt("FULDMAGT", m, H-28, 24, white, True)
    txt("Power of Attorney — Togkompensationskrav", m, H-48, 11, HexColor("#c0ccff"))
    txt(f"Dato: {person.get('dato_signed','')}", W-140, H-44, 9, HexColor("#c0ccff"))
    for i in range(12):
        a = (i/12)*math.pi*2
        c.setFillColor(HexColor("#ffdd00")); c.setFont("Helvetica-Bold", 7)
        c.drawString(W-65+math.cos(a)*14-3, H-36+math.sin(a)*14-3, "*")

    y = H - 96

    # UNDERTEGNEDE
    fill_rect(m-12, y-58, W-m*2+24, 72, HexColor("#f0f2fa"))
    txt("UNDERTEGNEDE — FULDMAGTSGIVER", m, y, 8.5, MID, True); y -= 18
    txt("Navn:", m, y, 10, black, True);    txt(person["navn"], m+52, y, 10); y -= 16
    txt("Adresse:", m, y, 10, black, True); txt(person["adresse"], m+62, y, 10); y -= 16
    txt("Email:", m, y, 10, black, True);   txt(person["email"], m+46, y, 10); y -= 28

    txt("GIVER HERMED FULDMAGT TIL:", m, y, 9, MID, True); y -= 16
    fill_rect(m-12, y-34, W-m*2+24, 48, LITE)
    txt("EU Rail Refund ApS", m, y, 13, BLUE, True); y -= 18
    txt("Til at repraesentere undertegnede ift. nedenstaaende togkompensationskrav.", m, y, 9.5, MID); y -= 36

    # REJSE BOX
    fill_rect(m-12, y-78, W-m*2+24, 92, HexColor("#f5f7ff"))
    fill_rect(m-12, y+8,  W-m*2+24, 18, BLUE)
    txt("KRAVETS REJSEDETALJER", m, y+12, 8.5, white, True); y -= 16
    txt("Fra:", m, y, 10, black, True);       txt(info["fra"], m+35, y, 10)
    txt("Til:", m+240, y, 10, black, True);   txt(info["til"], m+270, y, 10); y -= 15
    txt("Dato:", m, y, 10, black, True);      txt(info["dato"], m+42, y, 10)
    txt("Forsinkelse:", m+145, y, 10, black, True); txt(info["forsinkelse"], m+222, y, 10); y -= 15
    txt("Operatoer:", m, y, 10, black, True); txt(info["operatoer"], m+68, y, 10); y -= 15
    txt("Kompensationskrav:", m, y, 10, BLUE, True)
    txt(f"{comp['compensation']:.2f} {info['valuta']}  (jf. EU 2021/782, Art. 19)", m+135, y, 10, BLUE, True); y -= 32

    # OMFANG
    txt("FULDMAGTENS OMFANG", m, y, 9, MID, True); y -= 16
    for i, item in enumerate([
        "At indgive og underskrive den officielle EU-blanket (Forordning EU 2024/949) paa vegne af fuldmagtsgiver.",
        f"At korrespondere med jernbaneoperatoeren og nationale klageinstanser, herunder {comp['authority']}.",
        "At modtage kompensationsbelobet og udbetale fuldmagtsgivers andel (75%) inden for 5 hverdage.",
        f"At videresende klagen til {comp['authority']} hvis operatoeren ikke svarer inden 30 dage.",
    ]):
        txt(f"{i+1}.", m, y, 9.5, black, True)
        y = para(item, m+18, y, 82, 9.5, black, False, 14) - 5
    y -= 8

    # HONORAR
    fill_rect(m-12, y-26, W-m*2+24, 40, CREAM)
    c.setStrokeColor(GOLD); c.setLineWidth(2); c.line(m-12, y+14, m-12, y-26)
    txt("HONORAR:", m, y+8, 9, ORANGE, True)
    txt("25% af opnaet kompensation. Ingen betaling ved afvisning.", m, y-7, 9.5); y -= 42

    y = para("GDPR: Personoplysninger behandles iht. Forordning (EU) 2016/679 og anvendes udelukkende til behandling af dette krav.", m, y, 88, 8.5, MID, False, 13) - 14

    txt("UNDERSKRIFT / SIGNATURE", m, y, 9, MID, True); y -= 18
    stroke_rect(m, y-40, 220, 48, MID, 0.8)
    txt(person["navn"], m+8, y-20, 15, BLUE, True)
    txt("(digital underskrift)", m+8, y-34, 7, MID)
    txt("Fuldmagtsgiver:", m, y+4, 7.5, MID)
    txt(f"Dato: {person.get('dato_signed','')}", m+250, y-14, 10)
    txt("Sted: Danmark", m+250, y-32, 10)

    fill_rect(0, 0, W, 22, BLUE)
    txt("Fuldmagt til EU Rail Refund ApS  ·  Jf. Forordning (EU) 2021/782 og 2024/949", m, 7, 6.5, HexColor("#c0ccff"))

    c.save()
    return buf.getvalue()


class handler(BaseHTTPRequestHandler):
    def do_POST(self):
        length = int(self.headers.get("Content-Length", 0))
        body = json.loads(self.rfile.read(length))

        info   = body["info"]
        comp   = body["comp"]
        person = body["person"]

        eu_bytes = eu_blanket(info, comp, person)
        fu_bytes = fuldmagt(info, comp, person)

        result = {
            "eu":       base64.b64encode(eu_bytes).decode(),
            "fuldmagt": base64.b64encode(fu_bytes).decode(),
        }

        self.send_response(200)
        self.send_header("Content-Type", "application/json")
        self.send_header("Access-Control-Allow-Origin", "*")
        self.end_headers()
        self.wfile.write(json.dumps(result).encode())

    def do_OPTIONS(self):
        self.send_response(200)
        self.send_header("Access-Control-Allow-Origin", "*")
        self.send_header("Access-Control-Allow-Methods", "POST, OPTIONS")
        self.send_header("Access-Control-Allow-Headers", "Content-Type")
        self.end_headers()
