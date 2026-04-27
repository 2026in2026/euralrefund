// pdf-lib loaded dynamically
let pdfLibLoaded = null;
async function getPdfLib() {
  if (pdfLibLoaded) return pdfLibLoaded;
  return new Promise((resolve, reject) => {
    if (typeof window === 'undefined') return reject('SSR');
    const script = document.createElement('script');
    script.src = 'https://unpkg.com/pdf-lib@1.17.1/dist/pdf-lib.min.js';
    script.onload = () => { pdfLibLoaded = window.PDFLib; resolve(window.PDFLib); };
    script.onerror = reject;
    document.head.appendChild(script);
  });
}

import { useState, useRef, useEffect } from "react";
import Head from "next/head";

// --- EU-ONLY IBAN validation ---
const EU_IBAN_LENGTHS = {
  AT:20, BE:16, BG:22, CY:28, CZ:24, DE:22, DK:18, EE:20, ES:24, FI:18,
  FO:18, FR:27, GB:22, GI:23, GL:18, GR:27, HR:21, HU:28, IE:22, IS:26,
  IT:27, LI:21, LT:20, LU:20, LV:21, MC:27, MT:31, NL:18, NO:15, PL:28,
  PT:25, RO:24, SE:24, SI:19, SK:24, SM:27,
};

const EU_COUNTRY_NAMES = {
  AT:"Austria", BE:"Belgium", BG:"Bulgaria", CY:"Cyprus", CZ:"Czech Republic",
  DE:"Germany", DK:"Denmark", EE:"Estonia", ES:"Spain", FI:"Finland",
  FO:"Faroe Islands", FR:"France", GB:"United Kingdom", GI:"Gibraltar",
  GL:"Greenland", GR:"Greece", HR:"Croatia", HU:"Hungary", IE:"Ireland",
  IS:"Iceland", IT:"Italy", LI:"Liechtenstein", LT:"Lithuania", LU:"Luxembourg",
  LV:"Latvia", MC:"Monaco", MT:"Malta", NL:"Netherlands", NO:"Norway",
  PL:"Poland", PT:"Portugal", RO:"Romania", SE:"Sweden", SI:"Slovenia",
  SK:"Slovakia", SM:"San Marino",
};

const COUNTRY_BIC = {
  DK:"DABADKKK", DE:"DEUTDEDB", GB:"NWBKGB2L", FR:"BNPAFRPP", ES:"CAIXESBB",
  IT:"UNCRITM1", NL:"INGBNL2A", BE:"GEBABEBB", SE:"SWEDSESS", NO:"DNBANOKK",
  FI:"NDEAFIHH", PL:"PKOPPLPW", AT:"BKAUATWW", PT:"CGDIPTPL", IE:"AIBKIE2D",
  GR:"ETHNGRAA", CZ:"GIBACZPX", SK:"SUBASKBX", HU:"OTPVHUHB", RO:"BRDEROBUXXX",
  HR:"PBZGHR2X", SI:"LJBASI2X", LU:"BILLLULL",
};

function validateIBAN(raw) {
  const iban = raw.replace(/\s/g, "").toUpperCase();
  if (iban.length < 4) return { valid: false, error: null, country: "", suggestedBic: "" };
  const cc = iban.slice(0, 2);
  if (!/^[A-Z]{2}$/.test(cc)) return { valid: false, error: "Start with 2-letter country code (e.g. DK, DE, FR)", country: "", suggestedBic: "" };
  if (!EU_IBAN_LENGTHS[cc]) return { valid: false, error: `Only EU/EEA IBANs are accepted (country: ${cc} not supported)`, country: "", suggestedBic: "" };
  const expectedLen = EU_IBAN_LENGTHS[cc];
  if (iban.length !== expectedLen)
    return { valid: false, error: `Should be ${expectedLen} chars for ${EU_COUNTRY_NAMES[cc]||cc} (got ${iban.length})`, country: "", suggestedBic: "" };
  const rearranged = iban.slice(4) + iban.slice(0, 4);
  let remainder = 0n;
  for (const ch of rearranged) {
    const code = ch.charCodeAt(0);
    const digit = code >= 65 ? BigInt(code - 55) : BigInt(code - 48);
    remainder = (remainder * (digit >= 10n ? 100n : 10n) + digit) % 97n;
  }
  if (remainder !== 1n) return { valid: false, error: "Invalid checksum — please double-check the number", country: EU_COUNTRY_NAMES[cc]||cc, suggestedBic: "" };
  return { valid: true, country: EU_COUNTRY_NAMES[cc] || cc, suggestedBic: COUNTRY_BIC[cc] || "" };
}

const STEPS = ["upload", "details", "result", "form"];

const OPERATORS = {
  "DSB (Danmark)": { threshold: 60, rate: 0.5, authority: "Trafikstyrelsen", url: "https://www.trafikstyrelsen.dk" },
  "DB (Tyskland)": { threshold: 60, rate: 0.5, authority: "Bundesnetzagentur", url: "https://www.bundesnetzagentur.de" },
  "SNCF (Frankrig)": { threshold: 60, rate: 0.25, authority: "ARAFER", url: "https://www.autorite-transports.fr" },
  "Eurostar": { threshold: 60, rate: 0.5, authority: "ORR (UK)", url: "https://www.orr.gov.uk" },
  "NS (Holland)": { threshold: 30, rate: 0.5, authority: "ACM", url: "https://www.acm.nl" },
  "ÖBB (Østrig)": { threshold: 60, rate: 0.5, authority: "Schienen-Control", url: "https://www.schienen-control.gv.at" },
  "Trenitalia (Italien)": { threshold: 60, rate: 0.25, authority: "ART", url: "https://www.autorita-trasporti.it" },
  "Renfe (Spanien)": { threshold: 60, rate: 0.5, authority: "CNMC", url: "https://www.cnmc.es" },
};

const DELAY_OPTIONS = [
  { label: "60–119 min", value: "60-119 min", refund: "25% refund", eligible: true },
  { label: "120+ min", value: "120+ min", refund: "50% refund", eligible: true },
  { label: "Under 60 min", value: "under-60 min", refund: "Not eligible", eligible: false },
];

const OPERATOR_ALIASES = {
  "dsb": "DSB (Danmark)", "danske statsbaner": "DSB (Danmark)",
  "db": "DB (Tyskland)", "deutsche bahn": "DB (Tyskland)",
  "sncf": "SNCF (Frankrig)", "eurostar": "Eurostar",
  "ns": "NS (Holland)", "nederlandse spoorwegen": "NS (Holland)",
  "öbb": "ÖBB (Østrig)", "obb": "ÖBB (Østrig)", "österreichische bundesbahnen": "ÖBB (Østrig)",
  "trenitalia": "Trenitalia (Italien)", "renfe": "Renfe (Spanien)",
};

function normalizeOperator(raw) {
  if (!raw) return "";
  const lower = raw.toLowerCase().trim();
  for (const [alias, canonical] of Object.entries(OPERATOR_ALIASES)) {
    if (lower.includes(alias)) return canonical;
  }
  const directMatch = Object.keys(OPERATORS).find(k => k.toLowerCase().includes(lower) || lower.includes(k.toLowerCase().split(" ")[0].toLowerCase()));
  return directMatch || "";
}

function ProgressBar({ step }) {
  const steps = ["Ticket", "Details", "Assessment", "Form"];
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 0, marginBottom: 40 }}>
      {steps.map((s, i) => {
        const current = STEPS.indexOf(step);
        const active = i <= current;
        return (
          <div key={s} style={{ display: "flex", alignItems: "center", flex: i < steps.length - 1 ? 1 : "none" }}>
            <div style={{
              width: 32, height: 32, borderRadius: "50%",
              background: active ? "#C8A96E" : "#F0EDE8",
              border: `2px solid ${active ? "#C8A96E" : "#E0DCD4"}`,
              display: "flex", alignItems: "center", justifyContent: "center",
              fontSize: 12, fontFamily: "'DM Mono', monospace",
              color: active ? "#FAFAF8" : "#9090A0",
              fontWeight: 700, flexShrink: 0, transition: "all 0.3s ease"
            }}>
              {i < STEPS.indexOf(step) ? "✓" : i + 1}
            </div>
            <span style={{ fontSize: 12, fontWeight: 500, color: active ? "#C8A96E" : "#9090A0", marginLeft: 6, fontFamily: "'DM Mono', monospace", whiteSpace: "nowrap" }}>{s}</span>
            {i < steps.length - 1 && (
              <div style={{ flex: 1, height: 1, background: active && i < STEPS.indexOf(step) ? "#C8A96E" : "#E0DCD4", margin: "0 12px", transition: "all 0.3s ease" }} />
            )}
          </div>
        );
      })}
    </div>
  </div>
  );
}

function UploadStep({ onNext, setTicketData, setExtractedInfo }) {
  const [dragging, setDragging] = useState(false);
  const [file, setFile] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const fileRef = useRef();

  const handleFile = async (f) => { setFile(f); setError(""); };

  const analyze = async () => {
    if (!file) return;
    setLoading(true);
    try {
      const base64 = await new Promise((res, rej) => {
        const r = new FileReader();
        r.onload = () => res(r.result.split(",")[1]);
        r.onerror = rej;
        r.readAsDataURL(file);
      });
      const isImage = file.type.startsWith("image/");
      const mediaType = isImage ? file.type : "application/pdf";
      const contentBlock = isImage
        ? { type: "image", source: { type: "base64", media_type: mediaType, data: base64 } }
        : { type: "document", source: { type: "base64", media_type: mediaType, data: base64 } };
      const response = await fetch("/api/analyse-ticket", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          model: "claude-sonnet-4-20250514",
          max_tokens: 1000,
          messages: [{
            role: "user",
            content: [
              contentBlock,
              {
                type: "text",
                text: `Du er en billetlæser. Analyser denne togbillet omhyggeligt og returner KUN gyldig JSON uden markdown eller forklaring:\n\n{\n  "fra": "afgangsstation fulde navn",\n  "til": "destinationsstation fulde navn",\n  "dato": "DD.MM.YYYY",\n  "tidspunkt": "HH:MM",\n  "operatør": "jernbaneselskabets navn (f.eks. DSB, DB, SNCF, Eurostar, NS, ÖBB, Trenitalia, Renfe)",\n  "billetpris": 549,\n  "valuta": "DKK",\n  "passagernavn": "fulde navn på billetten hvis synligt ellers null",\n  "bekræftet": true\n}\n\nHvis du ikke kan finde et felt, sæt det til null. Returner altid bekræftet: true hvis du kan læse billetten.`
              }
            ]
          }]
        })
      });
      const data = await response.json();
      const text = data.content?.find(b => b.type === "text")?.text || "{}";
      const clean = text.replace(/```json|```/g, "").trim();
      const parsed = JSON.parse(clean);
      const normalizedOp = normalizeOperator(parsed.operatør || "");
      const enriched = { ...parsed, operatør: normalizedOp };
      setTicketData({ file, base64, mediaType });
      setExtractedInfo(enriched);
      onNext();
    } catch (e) {
      setError("Could not read the ticket. Please try a clearer image.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div>
      <h2 style={{ fontFamily: "'Playfair Display', serif", fontSize: 28, color: "#1C1C28", marginBottom: 8, fontWeight: 400 }}>
        Upload your ticket
      </h2>
      <p style={{ color: "#4A4A5A", fontSize: 14, marginBottom: 8, fontFamily: "'DM Mono', monospace" }}>
        PDF or image — we read the details automatically
      </p>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 10, marginBottom: 20 }}>
        {[
          { icon: "📎", step: "1", title: "Upload ticket", desc: "We read your journey details automatically" },
          { icon: "⚡", step: "2", title: "We file for you", desc: "Official EU form sent to operator within 24h" },
          { icon: "💰", step: "3", title: "You get paid", desc: "75% wired to your IBAN on approval" },
        ].map(({ icon, step, title, desc }) => (
          <div key={step} style={{ background: "#F7F6F3", border: "1px solid #E8E4DC", borderRadius: 10, padding: "12px 10px", textAlign: "center" }}>
            <div style={{ fontSize: 20, marginBottom: 4 }}>{icon}</div>
            <div style={{ fontFamily: "'DM Mono', monospace", fontSize: 11, fontWeight: 700, color: "#1C1C28", marginBottom: 3 }}>{title}</div>
            <div style={{ fontFamily: "'DM Mono', monospace", fontSize: 10, color: "#9090A0", lineHeight: 1.5 }}>{desc}</div>
          </div>
        ))}
      </div>
      <div style={{ background: "#FFFBF0", border: "1px solid #E8D090", borderRadius: 8, padding: "8px 12px", marginBottom: 20, fontFamily: "'DM Mono', monospace", fontSize: 11, color: "#C8A96E" }}>
        ⚠ Ticket upload is required to file a claim — this verifies your journey
      </div>
      <div
        onClick={() => fileRef.current.click()}
        onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
        onDragLeave={() => setDragging(false)}
        onDrop={(e) => { e.preventDefault(); setDragging(false); handleFile(e.dataTransfer.files[0]); }}
        style={{
          border: `2px dashed ${dragging ? "#C8A96E" : file ? "#2D8653" : "#E0DCD4"}`,
          borderRadius: 12, padding: "48px 32px",
          textAlign: "center", cursor: "pointer",
          background: dragging ? "#FFFBF0" : file ? "#F0FAF4" : "#F7F6F3",
          transition: "all 0.2s ease"
        }}
      >
        <input ref={fileRef} type="file" accept=".pdf,image/*" style={{ display: "none" }} onChange={e => handleFile(e.target.files[0])} />
        <div style={{ fontSize: 36, marginBottom: 12 }}>{file ? "🎫" : "📄"}</div>
        {file ? (
          <div>
            <div style={{ color: "#4CAF7A", fontFamily: "'DM Mono', monospace", fontSize: 14, fontWeight: 700 }}>{file.name}</div>
            <div style={{ color: "#4A4A5A", fontSize: 12, marginTop: 4 }}>{(file.size / 1024).toFixed(0)} KB</div>
          </div>
        ) : (
          <div>
            <div style={{ color: "#1C1C28", fontFamily: "'DM Mono', monospace", fontSize: 14 }}>Drag file here or click to select</div>
            <div style={{ color: "#9090A0", fontSize: 12, marginTop: 6 }}>Supports PDF, JPG, PNG</div>
          </div>
        )}
      </div>
      {error && <div style={{ color: "#CC3333", fontSize: 13, marginTop: 12, fontFamily: "'DM Mono', monospace" }}>{error}</div>}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 0, marginTop: 20, marginBottom: 4, padding: "16px 12px", background: "#FFFFFF", border: "1px solid rgba(255,255,255,0.06)", borderRadius: 10 }}>
        {[
          { icon: "📄", label: "You upload", sub: "ticket or PDF" },
          { icon: "→", label: null, sub: null, arrow: true },
          { icon: "⚡", label: "We file", sub: "the claim for you" },
          { icon: "→", label: null, sub: null, arrow: true },
          { icon: "💶", label: "You receive", sub: "money to your account" },
        ].map((s, i) => s.arrow
          ? <div key={i} style={{ color: "#E0DCD4", fontSize: 18, padding: "0 4px" }}>→</div>
          : <div key={i} style={{ textAlign: "center", flex: 1 }}>
              <div style={{ fontSize: 22, marginBottom: 4 }}>{s.icon}</div>
              <div style={{ fontFamily: "'DM Mono', monospace", fontSize: 11, color: "#C8A96E", fontWeight: 700, letterSpacing: "0.05em" }}>{s.label}</div>
              <div style={{ fontFamily: "'DM Mono', monospace", fontSize: 10, color: "#4A4A5A", marginTop: 2 }}>{s.sub}</div>
            </div>
        )}
      </div>
      <button
        onClick={analyze}
        disabled={!file || loading}
        style={{
          marginTop: 24, width: "100%", padding: "16px",
          background: file && !loading ? "#C8A96E" : "#F0EDE8",
          color: file && !loading ? "#FAFAF8" : "#B0ADA8",
          border: "none", borderRadius: 8, cursor: file && !loading ? "pointer" : "not-allowed",
          fontFamily: "'DM Mono', monospace", fontSize: 14, fontWeight: 700,
          letterSpacing: "0.05em", transition: "all 0.2s ease"
        }}
      >
        {loading ? "⟳  Analyserer billet..." : "Analyse ticket →"}
      </button>
    </div>
  );
}

function DetailsStep({ extractedInfo, setExtractedInfo, onNext, onBack }) {
  const operators = Object.keys(OPERATORS);
  const update = (k, v) => setExtractedInfo(p => ({ ...p, [k]: v }));
  const autoFilled = (key) => extractedInfo?.[key] !== null && extractedInfo?.[key] !== undefined && extractedInfo?.[key] !== "";
  const fieldStyle = (key) => ({
    width: "100%", padding: "12px 14px",
    background: autoFilled(key) ? "#F0FAF4" : "#FFFFFF",
    border: `1px solid ${autoFilled(key) ? "#A8D8B8" : "#E0DCD4"}`,
    borderRadius: 8, color: "#1C1C28",
    fontFamily: "'DM Mono', monospace", fontSize: 14, outline: "none",
    boxSizing: "border-box", transition: "border-color 0.2s"
  });
  const autoCount = ["fra","til","dato","tidspunkt","operatør","billetpris"].filter(k => autoFilled(k)).length;
  const selectedDelay = DELAY_OPTIONS.find(d => d.value === extractedInfo?.forsinkelse);
  const delayEligible = selectedDelay?.eligible !== false;
  const canProceed = extractedInfo?.fra && extractedInfo?.til && extractedInfo?.operatør && extractedInfo?.forsinkelse && delayEligible && extractedInfo?.billetpris;

  return (
    <div>
      <h2 style={{ fontFamily: "'Playfair Display', serif", fontSize: 28, color: "#1C1C28", marginBottom: 8, fontWeight: 400 }}>
        Confirm journey details
      </h2>
      {autoCount > 0 ? (
        <div style={{ display: "flex", alignItems: "center", gap: 10, background: "#F0FAF4", border: "1px solid rgba(76,175,122,0.25)", borderRadius: 8, padding: "10px 14px", marginBottom: 24 }}>
          <span style={{ fontSize: 18 }}>✅</span>
          <span style={{ fontFamily: "'DM Mono', monospace", fontSize: 13, color: "#4CAF7A" }}>
            We read <strong>{autoCount} fields</strong> automatically from your ticket — check and correct if needed
          </span>
        </div>
      ) : (
        <p style={{ color: "#4A4A5A", fontSize: 14, marginBottom: 24, fontFamily: "'DM Mono', monospace" }}>
          We could not read the ticket — please fill in manually
        </p>
      )}
      <div style={{ display: "grid", gap: 14 }}>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
          {[{ label: "From", key: "fra", placeholder: "Departure station" }, { label: "To", key: "til", placeholder: "Destination station" }].map(({ label, key, placeholder }) => (
            <div key={key}>
              <label style={{ display: "flex", alignItems: "center", gap: 6, color: "#4A4A5A", fontSize: 10, fontFamily: "'DM Mono', monospace", marginBottom: 6, letterSpacing: "0.12em", textTransform: "uppercase" }}>
                {label}
                {autoFilled(key) && <span style={{ background: "#F0FAF4", border: "1px solid rgba(76,175,122,0.4)", borderRadius: 3, padding: "1px 5px", fontSize: 8, color: "#2D8653", letterSpacing: "0.08em" }}>AUTO</span>}
              </label>
              <input value={extractedInfo?.[key] || ""} onChange={e => update(key, e.target.value)} placeholder={placeholder} style={fieldStyle(key)} />
            </div>
          ))}
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
          {[{ label: "Date", key: "dato", placeholder: "DD.MM.YYYY" }, { label: "Departure", key: "tidspunkt", placeholder: "HH:MM" }].map(({ label, key, placeholder }) => (
            <div key={key}>
              <label style={{ display: "flex", alignItems: "center", gap: 6, color: "#4A4A5A", fontSize: 10, fontFamily: "'DM Mono', monospace", marginBottom: 6, letterSpacing: "0.12em", textTransform: "uppercase" }}>
                {label}
                {autoFilled(key) && <span style={{ background: "#F0FAF4", border: "1px solid rgba(76,175,122,0.4)", borderRadius: 3, padding: "1px 5px", fontSize: 8, color: "#2D8653", letterSpacing: "0.08em" }}>AUTO</span>}
              </label>
              <input value={extractedInfo?.[key] || ""} onChange={e => update(key, e.target.value)} placeholder={placeholder} style={fieldStyle(key)} />
            </div>
          ))}
        </div>
        <div>
          <label style={{ display: "flex", alignItems: "center", gap: 6, color: "#4A4A5A", fontSize: 10, fontFamily: "'DM Mono', monospace", marginBottom: 6, letterSpacing: "0.12em", textTransform: "uppercase" }}>
            Railway operator
            {autoFilled("operatør") && <span style={{ background: "#F0FAF4", border: "1px solid rgba(76,175,122,0.4)", borderRadius: 3, padding: "1px 5px", fontSize: 8, color: "#2D8653", letterSpacing: "0.08em" }}>AUTO</span>}
          </label>
          <select value={extractedInfo?.operatør || ""} onChange={e => update("operatør", e.target.value)} style={{ ...fieldStyle("operatør"), color: extractedInfo?.operatør ? "#1C1C28" : "#9090A0" }}>
            <option value="">Select operator...</option>
            {operators.map(o => <option key={o} value={o}>{o}</option>)}
          </select>
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "2fr 1fr", gap: 14 }}>
          <div>
            <label style={{ display: "flex", alignItems: "center", gap: 6, color: "#4A4A5A", fontSize: 10, fontFamily: "'DM Mono', monospace", marginBottom: 6, letterSpacing: "0.12em", textTransform: "uppercase" }}>
              Ticket price
              {autoFilled("billetpris") && <span style={{ background: "#F0FAF4", border: "1px solid rgba(76,175,122,0.4)", borderRadius: 3, padding: "1px 5px", fontSize: 8, color: "#2D8653", letterSpacing: "0.08em" }}>AUTO</span>}
            </label>
            <input type="number" value={extractedInfo?.billetpris || ""} onChange={e => update("billetpris", parseFloat(e.target.value))} placeholder="0" style={fieldStyle("billetpris")} />
          </div>
          <div>
            <label style={{ display: "block", color: "#4A4A5A", fontSize: 10, fontFamily: "'DM Mono', monospace", marginBottom: 6, letterSpacing: "0.12em", textTransform: "uppercase" }}>Valuta</label>
            <select value={extractedInfo?.valuta || "DKK"} onChange={e => update("valuta", e.target.value)} style={{ ...fieldStyle("valuta"), color: "#1C1C28" }}>
              {["DKK", "EUR", "GBP", "NOK", "SEK"].map(v => <option key={v}>{v}</option>)}
            </select>
          </div>
        </div>
        <div>
          <label style={{ display: "block", color: "#4A4A5A", fontSize: 10, fontFamily: "'DM Mono', monospace", marginBottom: 4, letterSpacing: "0.12em", textTransform: "uppercase" }}>
            What was the delay? <span style={{ color: "#CC4444", fontSize: 10 }}>*</span>
          </label>
          <div style={{ color: "#9090A0", fontSize: 10, fontFamily: "'DM Mono', monospace", marginBottom: 8 }}>
            Measured from scheduled arrival to actual arrival at final destination
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 8 }}>
            {DELAY_OPTIONS.map(d => (
              <button key={d.value} onClick={() => update("forsinkelse", d.value)} style={{
                padding: "12px 8px", borderRadius: 8, cursor: "pointer",
                background: extractedInfo?.forsinkelse === d.value
                  ? (d.eligible ? "#FFFBF0" : "#FFF5F5")
                  : "#FFFFFF",
                border: `1px solid ${extractedInfo?.forsinkelse === d.value
                  ? (d.eligible ? "#C8A96E" : "#CC4444")
                  : "#E0DCD4"}`,
                color: extractedInfo?.forsinkelse === d.value
                  ? (d.eligible ? "#C8A96E" : "#ff6b6b")
                  : "#4A4A5A",
                fontFamily: "'DM Mono', monospace", fontSize: 11, transition: "all 0.15s ease",
                fontWeight: extractedInfo?.forsinkelse === d.value ? 700 : 400,
                textAlign: "center"
              }}>
                <div>{d.label}</div>
                <div style={{ fontSize: 9, marginTop: 3, opacity: 0.8 }}>{d.refund}</div>
              </button>
            ))}
          </div>
          {extractedInfo?.forsinkelse === "under-60 min" && (
            <div style={{ color: "#CC3333", fontSize: 11, marginTop: 8, fontFamily: "'DM Mono', monospace", background: "#FFF5F5", border: "1px solid rgba(255,107,107,0.2)", borderRadius: 6, padding: "8px 10px" }}>
              ❌ Delays under 60 minutes do not qualify for compensation under EU Regulation 2021/782, Art. 19
            </div>
          )}
        </div>
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 2fr", gap: 12, marginTop: 24 }}>
        <button onClick={onBack} style={{ padding: "14px", background: "transparent", border: "1px solid #3a3a5e", borderRadius: 8, color: "#4A4A5A", cursor: "pointer", fontFamily: "'DM Mono', monospace", fontSize: 13 }}>
          ← Tilbage
        </button>
        <button onClick={onNext} disabled={!canProceed} style={{
          padding: "14px", background: canProceed ? "#C8A96E" : "#F0EDE8",
          color: canProceed ? "#FAFAF8" : "#B0ADA8", border: "none", borderRadius: 8,
          cursor: canProceed ? "pointer" : "not-allowed",
          fontFamily: "'DM Mono', monospace", fontSize: 14, fontWeight: 700, transition: "all 0.2s ease"
        }}>
          Calculate compensation →
        </button>
      </div>
    </div>
  );
}

function ResultStep({ extractedInfo, onNext, onBack, setCompensation }) {
  const op = OPERATORS[extractedInfo?.operatør];
  const delayMap = { "60-119 min": 90, "120+ min": 150 };
  const delayMinutes = delayMap[extractedInfo?.forsinkelse] || 0;
  const price = parseFloat(extractedInfo?.billetpris) || 0;
  let rate = 0;
  let eligible = false;
  let reason = "";

  if (!op) {
    reason = "Operator not found";
  } else if (delayMinutes < op.threshold) {
    reason = `Delay under ${op.threshold} min — not eligible`;
  } else if (delayMinutes >= 120) {
    rate = 0.5; eligible = true;
  } else if (delayMinutes >= 60) {
    rate = 0.25; eligible = true;
  }

  const compensation = price * rate;
  const ourFee = compensation * 0.25;
  const youGet = compensation - ourFee;
  const currency = extractedInfo?.valuta || "DKK";

  useEffect(() => {
    if (eligible) setCompensation({ compensation, ourFee, youGet, currency, op });
  }, [extractedInfo?.forsinkelse, extractedInfo?.billetpris, extractedInfo?.operatør]);

  return (
    <div>
      <h2 style={{ fontFamily: "'Playfair Display', serif", fontSize: 28, color: "#1C1C28", marginBottom: 8, fontWeight: 400 }}>
        Assessment
      </h2>
      <div style={{
        background: eligible ? "#F0FAF4" : "#FFF5F5",
        border: `1px solid ${eligible ? "#A8D8B8" : "#F0AAAA"}`,
        borderRadius: 12, padding: 24, marginBottom: 24
      }}>
        <div style={{ fontSize: 32, marginBottom: 8 }}>{eligible ? "✅" : "❌"}</div>
        <div style={{ fontFamily: "'Playfair Display', serif", fontSize: 22, color: eligible ? "#2D8653" : "#CC3333", marginBottom: 4 }}>
          {eligible ? "Based on the provided information, you may be eligible for compensation" : "Not eligible"}
        </div>
        {!eligible && <div style={{ color: "#4A4A5A", fontSize: 13, fontFamily: "'DM Mono', monospace" }}>{reason}</div>}
      </div>
      {eligible && (
        <>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 12, marginBottom: 24 }}>
            {[
              { label: "Total compensation", value: `${compensation.toFixed(0)} ${currency}`, accent: false },
              { label: "Our fee (25%)", value: `${ourFee.toFixed(0)} ${currency}`, accent: false },
              { label: "You receive", value: `${youGet.toFixed(0)} ${currency}`, accent: true },
            ].map(({ label, value, accent }) => (
              <div key={label} style={{
                background: accent ? "#FFFBF0" : "#FFFFFF",
                border: `1px solid ${accent ? "#C8A96E" : "#E0DCD4"}`,
                borderRadius: 10, padding: "16px 14px", textAlign: "center"
              }}>
                <div style={{ color: "#9090A0", fontSize: 10, fontFamily: "'DM Mono', monospace", letterSpacing: "0.1em", textTransform: "uppercase", marginBottom: 6 }}>{label}</div>
                <div style={{ color: accent ? "#C8A96E" : "#1C1C28", fontSize: 18, fontFamily: "'Playfair Display', serif", fontWeight: 700 }}>{value}</div>
              </div>
            ))}
          </div>
          <div style={{ background: "#FFFFFF", border: "1px solid rgba(200,169,110,0.15)", borderRadius: 10, padding: 20, marginBottom: 24 }}>
            <div style={{ color: "#4A4A5A", fontSize: 10, fontFamily: "'DM Mono', monospace", marginBottom: 16, letterSpacing: "0.12em", textTransform: "uppercase" }}>What happens next?</div>
            {[
              { icon: "⚡", time: "Within 24 hours", desc: "We file your claim with the operator" },
              { icon: "⏳", time: "Up to 30 days", desc: "The operator has 30 days to respond" },
              { icon: "📨", time: "No reply?", desc: "We chase and escalate the claim" },
              { icon: "💶", time: "Payout", desc: "Compensation transferred to your IBAN" },
            ].map((step, i, arr) => (
              <div key={i} style={{ display: "flex", gap: 12, alignItems: "flex-start", marginBottom: i < arr.length - 1 ? 14 : 0 }}>
                <div style={{ width: 28, height: 28, borderRadius: "50%", background: "#FFFBF0", border: "1px solid rgba(200,169,110,0.25)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 13, flexShrink: 0 }}>{step.icon}</div>
                <div>
                  <div style={{ fontFamily: "'DM Mono', monospace", fontSize: 11, color: "#C8A96E", fontWeight: 700, marginBottom: 1 }}>{step.time}</div>
                  <div style={{ fontFamily: "'DM Mono', monospace", fontSize: 12, color: "#4A4A5A" }}>{step.desc}</div>
                </div>
              </div>
            ))}
          </div>
        </>
      )}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 2fr", gap: 12 }}>
        <button onClick={onBack} style={{ padding: "14px", background: "transparent", border: "1px solid #3a3a5e", borderRadius: 8, color: "#4A4A5A", cursor: "pointer", fontFamily: "'DM Mono', monospace", fontSize: 13 }}>
          ← Tilbage
        </button>
        {eligible && (
          <button onClick={onNext} style={{
            padding: "14px", background: "#C8A96E", color: "#FAFAF8",
            border: "none", borderRadius: 8, cursor: "pointer",
            fontFamily: "'DM Mono', monospace", fontSize: 14, fontWeight: 700
          }}>
            Generate claim form →
          </button>
        )}
      </div>
    </div>
  );
}

function wrapText(text, maxChars) {
  const words = (text || '').split(' ');
  const lines = []; let cur = '';
  for (const w of words) {
    if ((cur + ' ' + w).trim().length > maxChars) { lines.push(cur.trim()); cur = w; }
    else cur = (cur + ' ' + w).trim();
  }
  if (cur) lines.push(cur);
  return lines;
}

async function generateEUFormPdf({ info, comp, name, email, address, iban }) {
  const { PDFDocument, rgb, StandardFonts } = await getPdfLib();
  const doc = await PDFDocument.create();
  const page = doc.addPage([595, 842]);
  const { width, height } = page.getSize();
  const helvetica = await doc.embedFont(StandardFonts.Helvetica);
  const helveticaBold = await doc.embedFont(StandardFonts.HelveticaBold);

  const blue = rgb(0.10, 0.18, 0.45);
  const dark = rgb(0.08, 0.08, 0.08);
  const mid = rgb(0.45, 0.45, 0.45);
  const lite = rgb(0.93, 0.93, 0.93);
  const white = rgb(1, 1, 1);
  const gold = rgb(1.0, 0.85, 0.0);
  const m = 48;

  const drawText = (text, x, y, size, color, bold) => {
    const sanitized = String(text || '')
      .replace(/æ/g, 'ae').replace(/Æ/g, 'Ae')
      .replace(/ø/g, 'o').replace(/Ø/g, 'O')
      .replace(/å/g, 'a').replace(/Å/g, 'A')
      .replace(/ü/g, 'u').replace(/Ü/g, 'U')
      .replace(/ö/g, 'o').replace(/Ö/g, 'O')
      .replace(/ä/g, 'a').replace(/Ä/g, 'A')
      .replace(/ß/g, 'ss')
      .replace(/é/g, 'e').replace(/è/g, 'e').replace(/ê/g, 'e').replace(/É/g, 'E')
      .replace(/à/g, 'a').replace(/â/g, 'a').replace(/À/g, 'A')
      .replace(/î/g, 'i').replace(/ï/g, 'i')
      .replace(/ô/g, 'o').replace(/ù/g, 'u').replace(/û/g, 'u')
      .replace(/ç/g, 'c').replace(/Ç/g, 'C')
      .replace(/ñ/g, 'n').replace(/Ñ/g, 'N')
      .replace(/[^\x20-\x7E]/g, '');
    page.drawText(sanitized, {
      x, y, size, color, font: bold ? helveticaBold : helvetica
    });
  };
  const fillRect = (x, y, w, h, color) => page.drawRectangle({ x, y, width: w, height: h, color });
  const strokeRect = (x, y, w, h, color) => page.drawRectangle({ x, y, width: w, height: h, borderColor: color, borderWidth: 0.6, color: rgb(1, 1, 1) });
  const drawLine = (x1, y1, x2, y2, color) => page.drawLine({ start: { x: x1, y: y1 }, end: { x: x2, y: y2 }, color, thickness: 0.6 });

  // HEADER
  fillRect(0, height - 50, width, 50, blue);
  drawText('EUROPEAN UNION', m, height - 15, 7, white, true);
  drawText('Commission Implementing Regulation (EU) 2024/949 of 27 March 2024', m, height - 26, 6.5, rgb(0.75, 0.82, 1), false);
  drawText('COMMON FORM - REIMBURSEMENT AND COMPENSATION REQUEST', m, height - 39, 9.5, white, true);

  for (let i = 0; i < 12; i++) {
    const a = (i / 12) * Math.PI * 2;
    drawText('*', width - 66 + Math.cos(a) * 14, height - 25 + Math.sin(a) * 14, 7, gold, true);
  }

  let y = height - 65;

  const section = (title) => {
    fillRect(m - 4, y - 4, width - m * 2 + 8, 15, rgb(0.93, 0.96, 1));
    drawText(title, m, y + 3, 7.5, blue, true);
    y -= 22;
  };

  const fld = (label, val, fx, fy, fw) => {
    drawText(label, fx, fy + 14, 6.5, mid, false);
    fillRect(fx, fy, fw, 13, lite);
    drawText((val || '').toString().substring(0, Math.floor(fw / 5.5)), fx + 3, fy + 3, 8.5, dark, false);
  };

  section('1.  TYPE OF CLAIM - Place a cross [X] in the applicable box');
  drawText('Reimbursement due to cancellation:', m, y + 1, 8, dark, false);
  strokeRect(m + 170, y - 1, 9, 9, dark);
  drawText('Compensation for delay (Art. 19 Reg. EU 2021/782):', m + 230, y + 1, 8, dark, false);
  strokeRect(m + 440, y - 1, 9, 9, dark);
  fillRect(m + 441, y, 7, 7, blue);
  drawText('X', m + 442, y + 1, 7, white, true);
  y -= 15;
  drawText('Continuation / re-routing:', m, y + 1, 8, dark, false);
  strokeRect(m + 130, y - 1, 9, 9, dark);
  drawText('Meals / refreshments:', m + 230, y + 1, 8, dark, false);
  strokeRect(m + 335, y - 1, 9, 9, dark);
  y -= 20;

  section('2.  JOURNEY DETAILS');
  const hw = (width - m * 2 - 8) / 2;
  fld('Station of departure', info.fra, m, y, hw);
  fld('Station of destination', info.til, m + hw + 8, y, hw);
  y -= 26;
  fld('Date of travel (DD/MM/YYYY)', info.dato, m, y, hw);
  fld('Scheduled departure time', info.tidspunkt, m + hw + 8, y, hw);
  y -= 26;
  fld('Railway undertaking (operator)', (info.operatør || ''), m, y, hw);
  fld('Train number (if known)', '', m + hw + 8, y, hw);
  y -= 26;
  drawText('Delay at final destination:', m, y + 1, 8, dark, false);
  const dOpts = ['60-119 min', '>= 120 min'];
  const dChk = [info.forsinkelse === '60-119 min', info.forsinkelse === '120+ min'];
  let dx = m + 145;
  dOpts.forEach((d, i) => {
    strokeRect(dx, y - 1, 9, 9, dark);
    if (dChk[i]) { fillRect(dx + 1, y, 7, 7, blue); drawText('X', dx + 1.5, y + 1, 7, white, true); }
    drawText(d, dx + 12, y + 1, 8, dark, false);
    dx += 90;
  });
  y -= 26;
  fld('Ticket price', (info.billetpris || '') + ' ' + (info.valuta || 'DKK'), m, y, hw);
  fld('Compensation claimed (Art.19)', comp.compensation.toFixed(2) + ' ' + (info.valuta || 'DKK'), m + hw + 8, y, hw);
  y -= 30;

  section('3.  PASSENGER DETAILS');
  fld('Full name', name, m, y, width - m * 2); y -= 26;
  fld('Address', address || '', m, y, width - m * 2); y -= 26;
  fld('Email address', email, m, y, hw);
  fld('Phone (optional)', '', m + hw + 8, y, hw); y -= 26;
  fld('IBAN (for bank transfer)', iban || '', m, y, width - m * 2); y -= 30;

  section('4.  PREVIOUS REQUEST');
  drawText('Have you already submitted a request to the railway undertaking?', m, y + 1, 8, dark, false);
  strokeRect(m + 278, y - 1, 9, 9, dark);
  drawText('Yes', m + 290, y + 1, 8, dark, false);
  strokeRect(m + 315, y - 1, 9, 9, dark);
  fillRect(m + 316, y, 7, 7, blue);
  drawText('X', m + 316.5, y + 1, 7, white, true);
  drawText('No', m + 327, y + 1, 8, dark, false);
  y -= 22;

  section('5.  SUPPORTING DOCUMENTS ENCLOSED');
  [['Original ticket / booking confirmation', true], ['Proof of delay (station stamp, screenshot)', false], ['Proof of costs for alternative transport', false]].forEach(([label, chk]) => {
    strokeRect(m, y - 1, 9, 9, dark);
    if (chk) { fillRect(m + 1, y, 7, 7, blue); drawText('X', m + 1.5, y + 1, 7, white, true); }
    drawText(label, m + 13, y + 1, 8, dark, false);
    y -= 15;
  });
  y -= 8;

  section('6.  DECLARATION AND SIGNATURE');
  const decl = 'I hereby acknowledge that the recipient may share my personal data with other relevant parties if required for processing. I declare that all information provided is true and accurate.';
  wrapText(decl, 104).forEach(l => { drawText(l, m, y, 7.5, mid, false); y -= 11; });
  y -= 6;
  page.drawRectangle({ x: m, y: y - 33, width: 220, height: 41, borderColor: rgb(0.7, 0.7, 0.7), borderWidth: 0.8, color: rgb(0.98, 0.98, 0.98) });
  drawText(name.substring(0, 28), m + 6, y - 18, 13, blue, true);
  drawText('(digital signature - EU 2024/949)', m + 6, y - 30, 6.5, mid, false);
  drawText('Signature:', m, y + 4, 7.5, mid, false);
  fld('Date', new Date().toLocaleDateString('da-DK'), m + 230, y - 14, 120);
  fld('Place', 'Denmark', m + 230, y - 40, 120);
  y -= 58;

  page.drawLine({ start: { x: m, y: y }, end: { x: width - m, y: y }, color: rgb(0.8, 0.8, 0.8), thickness: 0.5 });
  y -= 13;
  drawText('SUBMIT TO: ' + (info.operatør || '') + '  |  ' + (comp.op ? comp.op.authority : '') + '  |  ' + (comp.op ? comp.op.url : ''), m, y, 7.5, blue, true);
  y -= 13;
  drawText('This form may be submitted electronically or on paper to any EU railway undertaking (Reg. EU 2021/782).', m, y, 7, mid, false);

  fillRect(0, 0, width, 20, blue);
  drawText('Commission Implementing Reg. (EU) 2024/949  |  Reg. (EU) 2021/782 on rail passengers rights', m, 6, 6.5, rgb(0.75, 0.82, 1), false);
  drawText('Generated: ' + new Date().toLocaleDateString('da-DK'), width - 130, 6, 6.5, rgb(0.75, 0.82, 1), false);

  return await doc.save();
}

async function generateFuldmagtPdf({ info, comp, name, email, address }) {
  const { PDFDocument, rgb, StandardFonts } = await getPdfLib();
  const doc = await PDFDocument.create();
  const page = doc.addPage([595, 842]);
  const { width, height } = page.getSize();
  const helvetica = await doc.embedFont(StandardFonts.Helvetica);
  const helveticaBold = await doc.embedFont(StandardFonts.HelveticaBold);

  const blue = rgb(0.10, 0.18, 0.45);
  const dark = rgb(0.08, 0.08, 0.08);
  const mid = rgb(0.45, 0.45, 0.45);
  const lite = rgb(0.93, 0.93, 0.93);
  const white = rgb(1, 1, 1);
  const gold = rgb(1.0, 0.85, 0.0);
  const m = 60;

  const drawText = (text, x, y, size, color, bold) => {
    const sanitized = String(text || '')
      .replace(/æ/g, 'ae').replace(/Æ/g, 'Ae')
      .replace(/ø/g, 'o').replace(/Ø/g, 'O')
      .replace(/å/g, 'a').replace(/Å/g, 'A')
      .replace(/ü/g, 'u').replace(/Ü/g, 'U')
      .replace(/ö/g, 'o').replace(/Ö/g, 'O')
      .replace(/ä/g, 'a').replace(/Ä/g, 'A')
      .replace(/ß/g, 'ss')
      .replace(/é/g, 'e').replace(/è/g, 'e').replace(/ê/g, 'e').replace(/É/g, 'E')
      .replace(/à/g, 'a').replace(/â/g, 'a').replace(/À/g, 'A')
      .replace(/î/g, 'i').replace(/ï/g, 'i')
      .replace(/ô/g, 'o').replace(/ù/g, 'u').replace(/û/g, 'u')
      .replace(/ç/g, 'c').replace(/Ç/g, 'C')
      .replace(/ñ/g, 'n').replace(/Ñ/g, 'N')
      .replace(/[^\x20-\x7E]/g, '');
    page.drawText(sanitized, {
      x, y, size, color, font: bold ? helveticaBold : helvetica
    });
  };
  const fillRect = (x, y, w, h, color) => page.drawRectangle({ x, y, width: w, height: h, color });
  const strokeRect = (x, y, w, h, color) => page.drawRectangle({ x, y, width: w, height: h, borderColor: color, borderWidth: 0.8, color: rgb(1, 1, 1) });
  const fld = (label, val, fx, fy, fw) => {
    drawText(label, fx, fy + 14, 6.5, mid, false);
    fillRect(fx, fy, fw, 13, lite);
    drawText((val || '').toString().substring(0, Math.floor(fw / 5.5)), fx + 3, fy + 3, 8.5, dark, false);
  };

  fillRect(0, height - 70, width, 70, blue);
  drawText('POWER OF ATTORNEY', m, height - 28, 22, white, true);
  drawText('Rail Compensation Claim - EU Regulation 2021/782', m, height - 48, 11, rgb(0.75, 0.82, 1), false);
  drawText('Date: ' + new Date().toLocaleDateString('da-DK'), width - 140, height - 44, 9, rgb(0.75, 0.82, 1), false);
  for (let i = 0; i < 12; i++) {
    const a = (i / 12) * Math.PI * 2;
    drawText('*', width - 66 + Math.cos(a) * 14, height - 36 + Math.sin(a) * 14, 7, gold, true);
  }

  let y = height - 96;

  fillRect(m - 12, y - 58, width - m * 2 + 24, 72, rgb(0.96, 0.97, 1));
  drawText('THE UNDERSIGNED - GRANTOR', m, y, 8.5, mid, true); y -= 18;
  drawText('Name:', m, y, 10, dark, true); drawText(name, m + 50, y, 10, dark, false); y -= 16;
  drawText('Address:', m, y, 10, dark, true); drawText((address || '-').substring(0, 60), m + 60, y, 10, dark, false); y -= 16;
  drawText('Email:', m, y, 10, dark, true); drawText(email, m + 45, y, 10, dark, false); y -= 26;

  drawText('HEREBY GRANTS POWER OF ATTORNEY TO:', m, y, 9, mid, true); y -= 16;
  fillRect(m - 12, y - 34, width - m * 2 + 24, 48, lite);
  drawText('EU Rail Refund ApS', m, y, 13, blue, true); y -= 18;
  drawText('To act on behalf of the undersigned in connection with the rail compensation claim described below.', m, y, 9.5, dark, false);
  y -= 36;

  fillRect(m - 12, y - 78, width - m * 2 + 24, 90, rgb(0.97, 0.98, 1));
  fillRect(m - 12, y + 6, width - m * 2 + 24, 16, blue);
  drawText('CLAIM JOURNEY DETAILS', m, y + 10, 8, white, true); y -= 16;
  drawText('From: ' + (info.fra || ''), m, y, 9.5, dark, true);
  drawText('To: ' + (info.til || ''), m + 240, y, 9.5, dark, true); y -= 15;
  drawText('Date: ' + (info.dato || ''), m, y, 9.5, dark, false);
  drawText('Delay: ' + (info.forsinkelse || ''), m + 140, y, 9.5, dark, false); y -= 15;
  drawText('Operator: ' + (info.operatør || ''), m, y, 9.5, dark, false); y -= 15;
  drawText('Compensation claimed: ' + (comp.compensation || 0).toFixed(2) + ' ' + (info.valuta || 'DKK') + ' (EU 2021/782, Art. 19)', m, y, 9.5, blue, true);
  y -= 32;

  drawText('SCOPE OF POWER OF ATTORNEY', m, y, 9, mid, true); y -= 16;
  const items = [
    'To file and sign the official EU claim form (Regulation EU 2024/949) on behalf of the grantor.',
    'To correspond with the railway operator and national enforcement bodies, including ' + (comp.op ? comp.op.authority : 'the relevant authority') + '.',
    'To receive the compensation amount and transfer the grantor share (75%) within 5 business days.',
    'To escalate the claim to ' + (comp.op ? comp.op.authority : 'the relevant authority') + ' if the operator does not respond within 30 days.',
  ];
  items.forEach((item, i) => {
    drawText((i + 1) + '.', m, y, 9.5, dark, true);
    wrapText(item, 90).forEach(l => { drawText(l, m + 18, y, 9.5, dark, false); y -= 14; });
    y -= 6;
  });
  y -= 8;

  fillRect(m - 12, y - 26, width - m * 2 + 24, 40, rgb(1, 0.97, 0.89));
  drawText('FEE:', m, y + 8, 9, rgb(0.55, 0.28, 0), true);
  drawText('25% of compensation obtained. No payment if the claim is rejected.', m, y - 6, 9.5, dark, false);
  y -= 42;

  wrapText('GDPR: Personal data is processed pursuant to Regulation (EU) 2016/679 and used solely for the purpose of processing this claim.', 90).forEach(l => {
    drawText(l, m, y, 8.5, mid, false); y -= 13;
  });
  y -= 12;

  drawText('SIGNATURE', m, y, 9, mid, true); y -= 18;
  strokeRect(m, y - 40, 220, 48, rgb(0.6, 0.6, 0.6));
  drawText(name.substring(0, 24), m + 8, y - 22, 15, blue, true);
  drawText('(digital signature)', m + 8, y - 36, 7, mid, false);
  drawText('Grantor:', m, y + 4, 7.5, mid, false);
  fld('Date', new Date().toLocaleDateString('da-DK'), m + 250, y - 14, 110);
  fld('Place', 'Denmark', m + 250, y - 32, 110);

  fillRect(0, 0, width, 22, blue);
  drawText('Power of Attorney to EU Rail Refund ApS  |  Regulation (EU) 2021/782 and 2024/949', m, 7, 6.5, rgb(0.75, 0.82, 1), false);

  return await doc.save();
}

async function downloadPdf(bytes, filename) {
  const blob = new Blob([bytes], { type: 'application/pdf' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 3000);
}


function FormStep({ extractedInfo, compensation, onBack }) {
  const [subStep, setSubStep] = useState("details");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [address, setAddress] = useState("");
  const [iban, setIban] = useState("");
  const [swift, setSwift] = useState("");
  const [ibanValidation, setIbanValidation] = useState({ valid: false, error: null, country: "", suggestedBic: "" });
  const [agreed, setAgreed] = useState(false);
  const [gdprConsent, setGdprConsent] = useState(false);
  const [signInput, setSignInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const ticketName = extractedInfo?.passagernavn || null;
  const nameMismatch = ticketName && name.trim().length > 2 &&
    ticketName.trim().toLowerCase() !== name.trim().toLowerCase() &&
    !ticketName.trim().toLowerCase().includes(name.trim().toLowerCase().split(" ")[0]) &&
    !name.trim().toLowerCase().includes(ticketName.trim().toLowerCase().split(" ")[0]);

  const mono = "'DM Mono', monospace";
  const inp = { width:"100%", padding:"11px 13px", background:"#FFFFFF", border:"1px solid #3a3a5e", borderRadius:8, color:"#1C1C28", fontFamily:mono, fontSize:13, outline:"none", boxSizing:"border-box" };
  const signed = signInput.trim().toLowerCase() === name.trim().toLowerCase() && name.trim().length > 0;
  const canGo = name.trim() && email.trim() && address.trim() && iban.trim() && ibanValidation.valid && agreed && gdprConsent;

  const doGenerate = async () => {
    setLoading(true); setError("");
    try {
      const euBytes = await generateEUFormPdf({
        info: {
          fra: extractedInfo.fra,
          til: extractedInfo.til,
          dato: extractedInfo.dato,
          tidspunkt: extractedInfo.tidspunkt,
          forsinkelse: extractedInfo.forsinkelse,
          operatør: extractedInfo.operatør || "",
          billetpris: extractedInfo.billetpris,
          valuta: extractedInfo.valuta || "DKK",
        },
        comp: compensation,
        name, email, address, iban
      });
      const fuldmagtBytes = await generateFuldmagtPdf({
        info: {
          fra: extractedInfo.fra,
          til: extractedInfo.til,
          dato: extractedInfo.dato,
          forsinkelse: extractedInfo.forsinkelse,
          operatør: extractedInfo.operatør || "",
          billetpris: extractedInfo.billetpris,
          valuta: extractedInfo.valuta || "DKK",
        },
        comp: compensation,
        name, email, address
      });
      await downloadPdf(euBytes, "EU-blanket-togkompensation.pdf");
      setTimeout(() => downloadPdf(fuldmagtBytes, "Fuldmagt-EU-Rail-Refund.pdf"), 800);
      setSubStep("done");
    } catch(e) {
      setError("Error generating documents: " + e.message);
    } finally {
      setLoading(false);
    }
  };

  const LabelEl = ({ children }) => (
    <label style={{ display:"block", color:"#4A4A5A", fontSize:10, fontFamily:mono, marginBottom:5, letterSpacing:"0.1em", textTransform:"uppercase" }}>
      {children}
    </label>
  );

  if (subStep === "details") return (
    <div>
      <h2 style={{ fontFamily:"'Playfair Display', serif", fontSize:26, color:"#1C1C28", marginBottom:6, fontWeight:400 }}>Your details</h2>
      <p style={{ color:"#4A4A5A", fontSize:13, marginBottom:22, fontFamily:mono }}>Used to complete the official EU form (2024/949)</p>
      <div style={{ display:"grid", gap:14 }}>
        <div>
          <LabelEl>Full name *</LabelEl>
          <input value={name} onChange={e => setName(e.target.value)} placeholder="Klaus Müller" style={inp} />
          {nameMismatch && (
            <div style={{ color:"#C8A96E", fontSize:11, marginTop:5, fontFamily:mono, background:"#FFFBF0", border:"1px solid rgba(200,169,110,0.25)", borderRadius:6, padding:"7px 10px" }}>
              ⚠ The name on your ticket appears to be "<strong>{ticketName}</strong>" — please confirm this is you, or correct the name above
            </div>
          )}
          {ticketName && !nameMismatch && name.trim().length > 2 && (
            <div style={{ color:"#2D8653", fontSize:11, marginTop:4, fontFamily:mono }}>✓ Name matches ticket</div>
          )}
        </div>
        <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:12 }}>
          <div>
            <LabelEl>Email *</LabelEl>
            <input value={email} onChange={e => setEmail(e.target.value)} placeholder="k.mueller@gmail.com" type="email" style={inp} />
          </div>
          <div>
            <LabelEl>IBAN — EU/EEA only *</LabelEl>
            <input
              value={iban}
              onChange={e => {
                const val = e.target.value;
                setIban(val);
                const result = validateIBAN(val);
                setIbanValidation(result);
                if (result.valid && result.suggestedBic && !swift.trim()) setSwift(result.suggestedBic);
              }}
              placeholder="DE89 3704 0044 0532 0130 00"
              style={{ ...inp, borderColor: iban.length > 4 ? (ibanValidation.valid ? "#4CAF7A" : "#CC4444") : "#E0DCD4" }}
            />
            {iban.length > 4 && !ibanValidation.valid && ibanValidation.error && (
              <div style={{ color:"#CC4444", fontSize:11, marginTop:4, fontFamily:mono }}>✗ {ibanValidation.error}</div>
            )}
            {ibanValidation.valid && (
              <div style={{ color:"#2D8653", fontSize:11, marginTop:4, fontFamily:mono }}>✓ Valid IBAN{ibanValidation.country ? " — " + ibanValidation.country : ""}</div>
            )}
          </div>
        </div>
        <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:12 }}>
          <div>
            <LabelEl>SWIFT/BIC *</LabelEl>
            <input value={swift} onChange={e => setSwift(e.target.value)} placeholder={ibanValidation.suggestedBic || "DABADKKK"}
              style={{ ...inp, borderColor: swift.trim().length >= 8 ? "#4CAF7A" : "#E0DCD4" }} />
            {ibanValidation.valid && !swift.trim() && (
              <div style={{ color:"#CC4444", fontSize:11, marginTop:4, fontFamily:mono }}>Required for wire transfer</div>
            )}
            {ibanValidation.suggestedBic && !swift.trim() && (
              <button type="button" onClick={() => setSwift(ibanValidation.suggestedBic)}
                style={{ background:"none", border:"none", color:"#C8A96E", fontSize:11, cursor:"pointer", fontFamily:mono, padding:"4px 0", textDecoration:"underline" }}>
                Use suggested: {ibanValidation.suggestedBic}
              </button>
            )}
          </div>
          <div>
            <LabelEl>Address *</LabelEl>
            <input value={address} onChange={e => setAddress(e.target.value)} placeholder="Musterstraße 12, 10115 Berlin" style={inp} />
          </div>
        </div>
        <div style={{ background:"#FFFBF0", border:"1px solid rgba(200,169,110,0.2)", borderRadius:10, padding:"14px 16px" }}>
          <div style={{ fontFamily:mono, fontSize:11, color:"#C8A96E", marginBottom:10, letterSpacing:"0.08em" }}>WE GENERATE 2 DOCUMENTS</div>
          <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:10 }}>
            <div style={{ background:"#FFFFFF", borderRadius:8, padding:"10px 12px" }}>
              <div style={{ fontSize:20, marginBottom:4 }}>📄</div>
              <div style={{ fontFamily:mono, fontSize:11, color:"#1C1C28", fontWeight:700 }}>EU Form 2024/949</div>
              <div style={{ fontFamily:mono, fontSize:10, color:"#4A4A5A", marginTop:3 }}>Official EU form, auto-filled</div>
            </div>
            <div style={{ background:"#FFFFFF", borderRadius:8, padding:"10px 12px" }}>
              <div style={{ fontSize:20, marginBottom:4 }}>✍️</div>
              <div style={{ fontFamily:mono, fontSize:11, color:"#1C1C28", fontWeight:700 }}>Power of Attorney</div>
              <div style={{ fontFamily:mono, fontSize:10, color:"#4A4A5A", marginTop:3 }}>Authorises us to submit</div>
            </div>
          </div>
        </div>
        <div onClick={() => setGdprConsent(a => !a)}
          style={{ display:"flex", gap:10, cursor:"pointer", alignItems:"flex-start", padding:"12px",
            background: gdprConsent ? "#F0FAF4" : "#FFFFFF",
            border: `1px solid ${gdprConsent ? "#A8D8B8" : "#E0DCD4"}`,
            borderRadius:8, transition:"all 0.2s" }}>
          <div style={{ width:16, height:16, border: `2px solid ${gdprConsent ? "#2D8653" : "#E0DCD4"}`, borderRadius:3, background: gdprConsent ? "#2D8653" : "transparent", flexShrink:0, marginTop:1, display:"flex", alignItems:"center", justifyContent:"center" }}>
            {gdprConsent && <span style={{ color:"#FFFFFF", fontSize:10, fontWeight:700 }}>✓</span>}
          </div>
          <span style={{ fontFamily:mono, fontSize:11, color:"#1C1C28", lineHeight:1.6 }}>
            🔒 <strong style={{ color:"#1C1C28" }}>GDPR Consent:</strong> I agree that my personal data (name, email, address, IBAN and ticket) is processed by EU Rail Refund ApS solely for the purpose of this claim, pursuant to EU Regulation 2016/679 (GDPR). Data is deleted within 90 days of completion.
          </span>
        </div>
        <div onClick={() => setAgreed(a => !a)}
          style={{ display:"flex", gap:10, cursor:"pointer", alignItems:"flex-start", padding:"12px",
            background: agreed ? "#F0FAF4" : "#FFFFFF",
            border: `1px solid ${agreed ? "#A8D8B8" : "#E0DCD4"}`,
            borderRadius:8, transition:"all 0.2s" }}>
          <div style={{ width:16, height:16, border: `2px solid ${agreed ? "#2D8653" : "#E0DCD4"}`, borderRadius:3, background: agreed ? "#2D8653" : "transparent", flexShrink:0, marginTop:1, display:"flex", alignItems:"center", justifyContent:"center" }}>
            {agreed && <span style={{ color:"#FFFFFF", fontSize:10, fontWeight:700 }}>✓</span>}
          </div>
          <span style={{ fontFamily:mono, fontSize:11, color:"#1C1C28", lineHeight:1.6 }}>
            ✅ I confirm I am the named passenger on this ticket and authorise EU Rail Refund ApS to file the claim on my behalf. I accept a 25% fee on success — no payment if the claim is rejected.
          </span>
        </div>
      </div>
      <div style={{ display:"grid", gridTemplateColumns:"1fr 2fr", gap:12, marginTop:20 }}>
        <button onClick={onBack} style={{ padding:"13px", background:"transparent", border:"1px solid #3a3a5e", borderRadius:8, color:"#4A4A5A", cursor:"pointer", fontFamily:mono, fontSize:13 }}>← Back</button>
        <button onClick={() => setSubStep("sign")} disabled={!canGo}
          style={{ padding:"13px", background: canGo ? "#C8A96E" : "#F0EDE8", color: canGo ? "#FAFAF8" : "#B0ADA8", border:"none", borderRadius:8, cursor: canGo ? "pointer" : "not-allowed", fontFamily:mono, fontSize:13, fontWeight:700, transition:"all 0.2s" }}>
          Continue to signature →
        </button>
      </div>
    </div>
  );

  if (subStep === "sign") return (
    <div>
      <h2 style={{ fontFamily:"'Playfair Display', serif", fontSize:26, color:"#1C1C28", marginBottom:6, fontWeight:400 }}>Digital signature</h2>
      <p style={{ color:"#4A4A5A", fontSize:13, marginBottom:20, fontFamily:mono }}>Type your name to sign both documents</p>
      <div style={{ background:"#FAFAF8", border:"1px solid #3a3a5e", borderRadius:10, padding:18, marginBottom:20 }}>
        <div style={{ fontFamily:mono, fontSize:10, color:"#4A4A5A", marginBottom:12, letterSpacing:"0.1em" }}>DU UNDERSKRIVER</div>
        {[
          ["📄 EU-blanket (2024/949)", "Kompensationskrav: " + compensation.compensation.toFixed(0) + " " + extractedInfo.valuta],
          ["✍️ Power of Attorney to EU Rail Refund ApS", extractedInfo.fra + " → " + extractedInfo.til + " · " + extractedInfo.dato],
        ].map(([title, sub]) => (
          <div key={title} style={{ display:"flex", justifyContent:"space-between", alignItems:"center", padding:"8px 0", borderBottom:"1px solid #1a1a2e" }}>
            <div>
              <div style={{ fontFamily:mono, fontSize:12, color:"#1C1C28" }}>{title}</div>
              <div style={{ fontFamily:mono, fontSize:10, color:"#4A4A5A", marginTop:2 }}>{sub}</div>
            </div>
            <div style={{ color: signed ? "#4CAF7A" : "#9090A0", fontSize:20 }}>{signed ? "✓" : "○"}</div>
          </div>
        ))}
      </div>
      <div style={{ marginBottom:20 }}>
        <LabelEl>Type your full name as signature *</LabelEl>
        <input value={signInput} onChange={e => setSignInput(e.target.value)} placeholder="Type your full name..."
          style={{ ...inp, fontSize:16, fontFamily:"'Playfair Display', serif", borderColor: signed ? "#A8D8B8" : "#E0DCD4", background: signed ? "#F0FAF4" : "#FFFFFF" }} />
        <div style={{ fontFamily:mono, fontSize:10, color:"#9090A0", marginTop:6 }}>
          Your typed name serves as a legal digital signature on both documents.
        </div>
      </div>
      {error && <div style={{ color:"#ff6b6b", fontFamily:mono, fontSize:12, marginBottom:12 }}>{error}</div>}
      <div style={{ display:"grid", gridTemplateColumns:"1fr 2fr", gap:12 }}>
        <button onClick={() => setSubStep("details")} style={{ padding:"13px", background:"transparent", border:"1px solid #3a3a5e", borderRadius:8, color:"#4A4A5A", cursor:"pointer", fontFamily:mono, fontSize:13 }}>← Back</button>
        <button onClick={doGenerate} disabled={!signed || loading}
          style={{ padding:"13px", background: signed && !loading ? "#C8A96E" : "#F0EDE8", color: signed && !loading ? "#FAFAF8" : "#B0ADA8", border:"none", borderRadius:8, cursor: signed ? "pointer" : "not-allowed", fontFamily:mono, fontSize:13, fontWeight:700 }}>
          {loading ? "⟳  Generating PDFs..." : "✍️  Sign & download PDF →"}
        </button>
      </div>
    </div>
  );

  return (
    <div style={{ textAlign:"center", padding:"10px 0" }}>
      <div style={{ fontSize:52, marginBottom:16 }}>🎉</div>
      <h2 style={{ fontFamily:"'Playfair Display', serif", fontSize:26, color:"#1C1C28", marginBottom:10, fontWeight:400 }}>You're all set!</h2>
      <p style={{ fontFamily:mono, fontSize:13, color:"#4A4A5A", marginBottom:20, lineHeight:1.8 }}>
        Your documents are ready. We will file everything on your behalf — you don't need to do anything else.
      </p>

      <div style={{ background:"#FFFBF0", border:"1px solid rgba(200,169,110,0.2)", borderRadius:10, padding:"14px 16px", textAlign:"left" }}>
        <div style={{ fontFamily:mono, fontSize:11, color:"#C8A96E", marginBottom:10 }}>WHAT HAPPENS NEXT</div>
        <div style={{ fontFamily:mono, fontSize:12, color:"#1C1C28", lineHeight:2 }}>
          1. We file your claim with the operator within 24 hours<br/>
          2. The operator has 30 days to respond (EU Reg. 2021/782)<br/>
          3. If no reply — we escalate automatically on your behalf<br/>
          4. Once approved, we transfer 75% directly to your IBAN
        </div>
      </div>
    </div>
  );
}


// --- Hero Components ---
const routes = [
  { from: "Amsterdam", to: "Berlin", delay: "94 min", amount: "€187" },
  { from: "Paris", to: "Brussels", delay: "61 min", amount: "€112" },
  { from: "Copenhagen", to: "Hamburg", delay: "78 min", amount: "€150" },
  { from: "Vienna", to: "Munich", delay: "120 min", amount: "€225" },
  { from: "Milan", to: "Zurich", delay: "55 min", amount: "€98" },
];

const TICKER_ITEMS = "EU Regulation 2021/782 • No Win, No Fee • 75% directly to your IBAN • Official EU form filed within 24h • Denmark, Germany, France, Netherlands, Austria, Italy, Spain • ";

function ClockIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <circle cx="12" cy="12" r="10" />
      <polyline points="12 6 12 12 16 14" />
    </svg>
  );
}

function ArrowRight() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
      <path d="M5 12h14M12 5l7 7-7 7" />
    </svg>
  );
}

function TrainLines() {
  return (
    <svg
      style={{ position: "absolute", inset: 0, width: "100%", height: "100%", opacity: 0.04 }}
      preserveAspectRatio="none"
      viewBox="0 0 800 600"
    >
      {[...Array(8)].map((_, i) => (
        <line key={i} x1={-50} y1={i * 90 - 20} x2={850} y2={i * 90 + 40} stroke="white" strokeWidth="1" />
      ))}
      {[...Array(5)].map((_, i) => (
        <line key={`v${i}`} x1={i * 200} y1={0} x2={i * 200 + 100} y2={600} stroke="white" strokeWidth="0.5" />
      ))}
    </svg>
  );
}

export default function App() {
  const [step, setStep] = useState("upload");
  const [ticketData, setTicketData] = useState(null);
  const [extractedInfo, setExtractedInfo] = useState(null);
  const [compensation, setCompensation] = useState(null);
  const [activeRoute, setActiveRoute] = useState(0);
  const [animating, setAnimating] = useState(false);
  const [tickerPos, setTickerPos] = useState(0);

  const goTo = (s) => setStep(s);

  useEffect(() => {
    const interval = setInterval(() => {
      setAnimating(true);
      setTimeout(() => {
        setActiveRoute((prev) => (prev + 1) % routes.length);
        setAnimating(false);
      }, 400);
    }, 3000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    let pos = 0;
    const ticker = setInterval(() => {
      pos -= 1;
      if (pos < -800) pos = 0;
      setTickerPos(pos);
    }, 20);
    return () => clearInterval(ticker);
  }, []);

  const route = routes[activeRoute];

  return (
    <div style={{ fontFamily: "'DM Sans', sans-serif", minHeight: "100vh", background: "#f5f2ed" }}>
      <Head>
        <title>EU Rail Refund — Get your money back</title>
        <meta name="description" content="Claim train delay compensation automatically under EU Regulation 2021/782" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <link rel="icon" href="/favicon.ico" />
      </Head>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Playfair+Display:ital,wght@0,400;0,700;0,900;1,400;1,700&family=DM+Sans:wght@300;400;500&display=swap');
        * { box-sizing: border-box; }
        input, select { transition: border-color 0.2s ease; }
        input:focus, select:focus { border-color: #C8A96E !important; }
        ::-webkit-scrollbar { width: 4px; }
        ::-webkit-scrollbar-track { background: #F0EDE8; }
        ::-webkit-scrollbar-thumb { background: #E0DCD4; border-radius: 2px; }
        option { background: #FFFFFF; }
        .nav { display:flex; justify-content:space-between; align-items:center; padding:20px 48px; background:#0a1628; color:white; }
        .nav-logo { font-family:'Playfair Display',serif; font-size:17px; font-weight:700; letter-spacing:0.02em; color:white; display:flex; align-items:center; gap:10px; }
        .nav-logo-dot { width:8px; height:8px; background:#e8c547; border-radius:50%; }
        .nav-right { font-size:13px; color:rgba(255,255,255,0.55); letter-spacing:0.08em; text-transform:uppercase; }
        .ticker-bar { background:#e8c547; padding:9px 0; overflow:hidden; white-space:nowrap; }
        .ticker-inner { display:inline-block; color:#0a1628; font-size:11px; font-weight:500; letter-spacing:0.12em; text-transform:uppercase; padding-right:40px; }
        .hero-grid { display:grid; grid-template-columns:1fr 480px; min-height:calc(100vh - 86px); }
        .hero-left { background:#0a1628; padding:72px 56px 64px; position:relative; overflow:hidden; display:flex; flex-direction:column; justify-content:space-between; }
        .hero-eyebrow { font-size:11px; letter-spacing:0.18em; text-transform:uppercase; color:#e8c547; font-family:'DM Sans',sans-serif; font-weight:500; margin-bottom:28px; display:flex; align-items:center; gap:10px; }
        .eyebrow-line { width:32px; height:1px; background:#e8c547; display:inline-block; }
        .hero-headline { font-family:'Playfair Display',serif; font-size:clamp(52px,6vw,76px); font-weight:900; color:white; line-height:1.0; letter-spacing:-0.02em; margin-bottom:36px; }
        .hero-headline em { font-style:italic; color:#e8c547; }
        .hero-sub { font-size:16px; color:rgba(255,255,255,0.6); line-height:1.65; max-width:440px; margin-bottom:52px; font-weight:300; }
        .hero-sub strong { color:rgba(255,255,255,0.9); font-weight:500; }
        .cta-group { display:flex; align-items:center; gap:24px; }
        .cta-primary { background:#e8c547; color:#0a1628; border:none; padding:16px 32px; font-size:14px; font-weight:600; letter-spacing:0.06em; text-transform:uppercase; cursor:pointer; font-family:'DM Sans',sans-serif; display:flex; align-items:center; gap:10px; transition:all 0.2s; }
        .cta-primary:hover { background:#f0d060; transform:translateY(-1px); }
        .cta-ghost { font-size:13px; color:rgba(255,255,255,0.45); letter-spacing:0.05em; font-family:'DM Sans',sans-serif; }
        .live-route-card { margin-top:64px; border-top:1px solid rgba(255,255,255,0.1); padding-top:28px; }
        .live-label { font-size:10px; letter-spacing:0.16em; text-transform:uppercase; color:rgba(255,255,255,0.3); margin-bottom:14px; display:flex; align-items:center; gap:8px; }
        .live-dot { width:6px; height:6px; background:#4ade80; border-radius:50%; animation:pulse-dot 2s infinite; }
        @keyframes pulse-dot { 0%,100%{opacity:1} 50%{opacity:0.3} }
        .route-display { display:flex; align-items:center; gap:16px; transition:opacity 0.3s,transform 0.3s; }
        .route-display.fade { opacity:0; transform:translateY(8px); }
        .route-city { font-family:'Playfair Display',serif; font-size:22px; font-weight:700; color:white; }
        .route-arrow-line { width:40px; height:1px; background:rgba(255,255,255,0.2); }
        .route-delay { display:flex; align-items:center; gap:6px; color:#f87171; font-size:12px; font-weight:500; margin-top:4px; }
        .route-amount { font-family:'Playfair Display',serif; font-size:24px; font-weight:700; color:#e8c547; }
        .route-amount-label { font-size:10px; color:rgba(255,255,255,0.3); text-transform:uppercase; letter-spacing:0.1em; font-family:'DM Sans',sans-serif; text-align:right; margin-top:2px; }
        .hero-right { background:#f5f2ed; padding:40px 36px; display:flex; flex-direction:column; justify-content:flex-start; border-left:1px solid rgba(0,0,0,0.06); overflow-y:auto; max-height:100vh; }
        @media (max-width:900px) {
          .hero-grid { grid-template-columns:1fr; }
          .hero-left { padding:48px 28px; }
          .nav { padding:16px 24px; }
        }
        @media (max-width:600px) {
          [style*='gridTemplateColumns: "1fr 1fr"'] { grid-template-columns:1fr !important; }
          [style*='gridTemplateColumns: "2fr 1fr"'] { grid-template-columns:1fr !important; }
          [style*='gridTemplateColumns: "1fr 2fr"'] { grid-template-columns:1fr !important; }
          [style*='gridTemplateColumns: "repeat(3, 1fr)"'] { grid-template-columns:1fr 1fr !important; }
          [style*='gridTemplateColumns: "1fr 1fr 1fr"'] { grid-template-columns:1fr !important; }
        }
      `}</style>

      {/* Nav */}
      <nav className="nav">
        <div className="nav-logo">
          <div className="nav-logo-dot" />
          EU Rail Refund
        </div>
        <div className="nav-right">EU Regulation 2021/782</div>
      </nav>

      {/* Ticker */}
      <div className="ticker-bar">
        <span className="ticker-inner" style={{ transform: `translateX(${tickerPos}px)`, display: "inline-block" }}>
          {TICKER_ITEMS.repeat(6)}
        </span>
      </div>

      {/* Main grid */}
      <div className="hero-grid">
        {/* LEFT */}
        <div className="hero-left">
          <TrainLines />
          <div style={{ position: "relative", zIndex: 1 }}>
            <div className="hero-eyebrow">
              <span className="eyebrow-line" />
              Cross-border train delay claims
            </div>
            <h1 className="hero-headline">
              Your train<br />
              was late.<br />
              <em>Get paid.</em>
            </h1>
            <p className="hero-sub">
              Delayed on a cross-EU train journey? Under <strong>EU Regulation 2021/782</strong>, you're entitled to up to 75% of your ticket price. We handle the paperwork — you keep 75% of what we recover.
            </p>
            <div className="cta-group">
              <button className="cta-primary" onClick={() => document.getElementById('claim-form')?.scrollIntoView({ behavior: 'smooth' })}>
                Check my claim <ArrowRight />
              </button>
              <span className="cta-ghost">No win, no fee</span>
            </div>
          </div>
          <div className="live-route-card" style={{ position: "relative", zIndex: 1 }}>
            <div className="live-label">
              <span className="live-dot" />
              Recent successful claims
            </div>
            <div className={`route-display ${animating ? "fade" : ""}`}>
              <div><div className="route-city">{route.from}</div></div>
              <div><div className="route-arrow-line" /></div>
              <div>
                <div className="route-city">{route.to}</div>
                <div className="route-delay"><ClockIcon /> {route.delay} delay</div>
              </div>
              <div style={{ marginLeft: "auto" }}>
                <div className="route-amount">{route.amount}</div>
                <div className="route-amount-label">recovered</div>
              </div>
            </div>
          </div>
        </div>
        </div>

        {/* RIGHT — wizard */}
        <div className="hero-right" id="claim-form">

        <div style={{ background: "#FFFFFF", border: "1px solid rgba(255,255,255,0.07)", borderRadius: 20, padding: "clamp(20px, 5vw, 40px)", boxShadow: "0 4px 24px rgba(0,0,0,0.08)" }}>
          <ProgressBar step={step} />
          {step === "upload" && <UploadStep onNext={() => goTo("details")} setTicketData={setTicketData} setExtractedInfo={setExtractedInfo} />}
          {step === "details" && <DetailsStep extractedInfo={extractedInfo} setExtractedInfo={setExtractedInfo} onNext={() => goTo("result")} onBack={() => goTo("upload")} />}
          {step === "result" && <ResultStep extractedInfo={extractedInfo} onNext={() => goTo("form")} onBack={() => goTo("details")} setCompensation={setCompensation} />}
          {step === "form" && <FormStep extractedInfo={extractedInfo} compensation={compensation} onBack={() => goTo("result")} />}
        </div>
        </div>
      </div>
        <div style={{ marginTop: 28, background: "#FFFFFF", border: "1px solid #E8E4DC", borderRadius: 16, padding: "28px 28px 24px" }}>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: 24, marginBottom: 20 }}>
            <div>
              <div style={{ fontFamily: "'DM Mono', monospace", fontSize: 10, color: "#C8A96E", letterSpacing: "0.15em", textTransform: "uppercase", marginBottom: 8 }}>About EU Rail Refund</div>
              <p style={{ fontFamily: "'DM Mono', monospace", fontSize: 11, color: "#4A4A5A", lineHeight: 1.9, margin: 0 }}>
                EU Rail Refund is a Danish-registered claims service that handles train delay compensation on your behalf under EU Regulation 2021/782. We prepare the official documentation, file directly with the operator, and chase the claim so you don’t have to. Our fee is 25% of the compensation received — if the claim is rejected, you pay nothing.
              </p>
            </div>
            <div>
              <div style={{ fontFamily: "'DM Mono', monospace", fontSize: 10, color: "#C8A96E", letterSpacing: "0.15em", textTransform: "uppercase", marginBottom: 8 }}>Company Details</div>
              <div style={{ fontFamily: "'DM Mono', monospace", fontSize: 11, color: "#4A4A5A", lineHeight: 2.2 }}>
                <div>EU Rail Refund ApS</div>
                <div>CVR: 12345678</div>
                <div>Strandvejen 100, 2900 Hellerup</div>
                <div>Denmark</div>
                <div><a href="mailto:support@euralrefund.com" style={{ color: "#C8A96E", textDecoration: "none" }}>support@euralrefund.com</a></div>
              </div>
            </div>
          </div>
          <div style={{ borderTop: "1px solid #E8E4DC", paddingTop: 16, display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 8 }}>
            <div style={{ fontFamily: "'DM Mono', monospace", fontSize: 10, color: "#9090A0" }}>
              We operate across Denmark, Germany, France, Netherlands, Austria, Italy, Spain and the UK
            </div>
            <div style={{ display: "flex", gap: 16 }}>
              <a href="/privacy" style={{ fontFamily: "'DM Mono', monospace", fontSize: 10, color: "#C8A96E", textDecoration: "none" }}>Privacy Policy</a>
              <a href="/terms" style={{ fontFamily: "'DM Mono', monospace", fontSize: 10, color: "#C8A96E", textDecoration: "none" }}>Terms &amp; Conditions</a>
              <a href="mailto:support@euralrefund.com" style={{ fontFamily: "'DM Mono', monospace", fontSize: 10, color: "#C8A96E", textDecoration: "none" }}>Contact</a>
            </div>
          </div>
        </div>
        <div style={{ textAlign: "center", marginTop: 16 }}>
          <p style={{ color: "#B0ADA8", fontSize: 11, fontFamily: "'DM Mono', monospace", margin: "0 0 8px" }}>
            We take 25% of the compensation — nothing to pay if we don't win
          </p>
          <div style={{ display: "flex", justifyContent: "center", gap: 20, flexWrap: "wrap" }}>
            <a href="/privacy" style={{ fontFamily: "'DM Mono', monospace", fontSize: 10, color: "#B0ADA8", textDecoration: "none" }}>Privacy Policy</a>
            <span style={{ color: "#E0DCD4" }}>·</span>
            <a href="/terms" style={{ fontFamily: "'DM Mono', monospace", fontSize: 10, color: "#B0ADA8", textDecoration: "none" }}>Terms &amp; Conditions</a>
            <span style={{ color: "#E0DCD4" }}>·</span>
            <a href="mailto:support@euralrefund.com" style={{ fontFamily: "'DM Mono', monospace", fontSize: 10, color: "#B0ADA8", textDecoration: "none" }}>support@euralrefund.com</a>
            <span style={{ color: "#E0DCD4" }}>·</span>
            <span style={{ fontFamily: "'DM Mono', monospace", fontSize: 10, color: "#B0ADA8" }}>EU Rail Refund ApS · CVR: 12345678 · Denmark</span>
          </div>
        </div>
    </div>
  );
}
