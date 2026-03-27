import { useState, useRef, useEffect } from "react";
import Head from "next/head";

const STEPS = ["upload", "details", "result", "form"];

const OPERATORS = {
  "DSB (Danmark)": { threshold: 60, rate: 0.5, authority: "Trafikstyrelsen", url: "https://www.trafikstyrelsen.dk" },
  "DB (Tyskland)": { threshold: 60, rate: 0.5, authority: "Bundesnetzagentur", url: "https://www.bundesnetzagentur.de" },
  "SNCF (Frankrig)": { threshold: 60, rate: 0.25, authority: "ARAFER", url: "https://www.autorite-transports.fr" },
  "Eurostar": { threshold: 60, rate: 0.5, authority: "ORRh (UK)", url: "https://www.orr.gov.uk" },
  "NS (Holland)": { threshold: 30, rate: 0.5, authority: "ACM", url: "https://www.acm.nl" },
  "ÖBB (Østrig)": { threshold: 60, rate: 0.5, authority: "Schienen-Control", url: "https://www.schienen-control.gv.at" },
  "Trenitalia (Italien)": { threshold: 60, rate: 0.25, authority: "ART", url: "https://www.autorita-trasporti.it" },
  "Renfe (Spanien)": { threshold: 60, rate: 0.5, authority: "CNMC", url: "https://www.cnmc.es" },
};

const DELAY_OPTIONS = ["30-59 min", "60-119 min", "120+ min"];

// Fuzzy-match extracted operator name to our known operators
const OPERATOR_ALIASES = {
  "dsb": "DSB (Danmark)",
  "danske statsbaner": "DSB (Danmark)",
  "db": "DB (Tyskland)",
  "deutsche bahn": "DB (Tyskland)",
  "sncf": "SNCF (Frankrig)",
  "eurostar": "Eurostar",
  "ns": "NS (Holland)",
  "nederlandse spoorwegen": "NS (Holland)",
  "öbb": "ÖBB (Østrig)",
  "obb": "ÖBB (Østrig)",
  "österreichische bundesbahnen": "ÖBB (Østrig)",
  "trenitalia": "Trenitalia (Italien)",
  "renfe": "Renfe (Spanien)",
};

function normalizeOperator(raw) {
  if (!raw) return "";
  const lower = raw.toLowerCase().trim();
  // Direct alias match
  for (const [alias, canonical] of Object.entries(OPERATOR_ALIASES)) {
    if (lower.includes(alias)) return canonical;
  }
  // Direct key match
  const directMatch = Object.keys(OPERATORS).find(k => k.toLowerCase().includes(lower) || lower.includes(k.toLowerCase().split(" ")[0].toLowerCase()));
  return directMatch || "";
}

function ProgressBar({ step }) {
  const steps = ["Billet", "Detaljer", "Vurdering", "Skema"];
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 0, marginBottom: 40 }}>
      {steps.map((s, i) => {
        const current = STEPS.indexOf(step);
        const active = i <= current;
        return (
          <div key={s} style={{ display: "flex", alignItems: "center", flex: i < steps.length - 1 ? 1 : "none" }}>
            <div style={{
              width: 32, height: 32, borderRadius: "50%",
              background: active ? "#C8A96E" : "#1a1a2e",
              border: `2px solid ${active ? "#C8A96E" : "#2d2d4e"}`,
              display: "flex", alignItems: "center", justifyContent: "center",
              fontSize: 12, fontFamily: "'DM Mono', monospace",
              color: active ? "#0a0a1a" : "#4a4a6a",
              fontWeight: 700, flexShrink: 0, transition: "all 0.3s ease"
            }}>
              {i < STEPS.indexOf(step) ? "✓" : i + 1}
            </div>
            <span style={{ fontSize: 11, color: active ? "#C8A96E" : "#3a3a5a", marginLeft: 6, fontFamily: "'DM Mono', monospace", whiteSpace: "nowrap" }}>{s}</span>
            {i < steps.length - 1 && (
              <div style={{ flex: 1, height: 1, background: active && i < STEPS.indexOf(step) ? "#C8A96E" : "#2d2d4e", margin: "0 12px", transition: "all 0.3s ease" }} />
            )}
          </div>
        );
      })}
    </div>
  );
}

function UploadStep({ onNext, setTicketData, setExtractedInfo }) {
  const [dragging, setDragging] = useState(false);
  const [file, setFile] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const fileRef = useRef();

  const handleFile = async (f) => {
    setFile(f);
    setError("");
  };

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
                text: `Du er en billetlæser. Analyser denne togbillet omhyggeligt og returner KUN gyldig JSON uden markdown eller forklaring:
{
  "fra": "afgangsstation fulde navn",
  "til": "destinationsstation fulde navn",
  "dato": "DD.MM.YYYY",
  "tidspunkt": "HH:MM",
  "operatør": "jernbaneselskabets navn (f.eks. DSB, DB, SNCF, Eurostar, NS, ÖBB, Trenitalia, Renfe)",
  "billetpris": 549,
  "valuta": "DKK",
  "bekræftet": true
}
Hvis du ikke kan finde et felt, sæt det til null. Returner altid bekræftet: true hvis du kan læse billetten.`
              }
            ]
          }]
        })
      });

      const data = await response.json();
      const text = data.content?.find(b => b.type === "text")?.text || "{}";
      const clean = text.replace(/```json|```/g, "").trim();
      const parsed = JSON.parse(clean);

      // Normalize operator name to match our dropdown
      const normalizedOp = normalizeOperator(parsed.operatør || "");
      const enriched = { ...parsed, operatør: normalizedOp };

      setTicketData({ file, base64, mediaType });
      setExtractedInfo(enriched);
      onNext();
    } catch (e) {
      setError("Kunne ikke læse billetten. Prøv et klarere billede.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div>
      <h2 style={{ fontFamily: "'Playfair Display', serif", fontSize: 28, color: "#e8e0d0", marginBottom: 8, fontWeight: 400 }}>
        Upload din billet
      </h2>
      <p style={{ color: "#6a6a8a", fontSize: 14, marginBottom: 28, fontFamily: "'DM Mono', monospace" }}>
        PDF eller billede — vi læser detaljerne automatisk
      </p>

      <div
        onClick={() => fileRef.current.click()}
        onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
        onDragLeave={() => setDragging(false)}
        onDrop={(e) => { e.preventDefault(); setDragging(false); handleFile(e.dataTransfer.files[0]); }}
        style={{
          border: `2px dashed ${dragging ? "#C8A96E" : file ? "#4CAF7A" : "#2d2d4e"}`,
          borderRadius: 12, padding: "48px 32px",
          textAlign: "center", cursor: "pointer",
          background: dragging ? "rgba(200,169,110,0.05)" : file ? "rgba(76,175,122,0.05)" : "rgba(255,255,255,0.02)",
          transition: "all 0.2s ease"
        }}
      >
        <input ref={fileRef} type="file" accept=".pdf,image/*" style={{ display: "none" }} onChange={e => handleFile(e.target.files[0])} />
        <div style={{ fontSize: 36, marginBottom: 12 }}>{file ? "🎫" : "📄"}</div>
        {file ? (
          <div>
            <div style={{ color: "#4CAF7A", fontFamily: "'DM Mono', monospace", fontSize: 14, fontWeight: 700 }}>{file.name}</div>
            <div style={{ color: "#6a6a8a", fontSize: 12, marginTop: 4 }}>{(file.size / 1024).toFixed(0)} KB</div>
          </div>
        ) : (
          <div>
            <div style={{ color: "#8a8aaa", fontFamily: "'DM Mono', monospace", fontSize: 14 }}>Træk fil hertil eller klik for at vælge</div>
            <div style={{ color: "#4a4a6a", fontSize: 12, marginTop: 6 }}>Understøtter PDF, JPG, PNG</div>
          </div>
        )}
      </div>

      {error && <div style={{ color: "#ff6b6b", fontSize: 13, marginTop: 12, fontFamily: "'DM Mono', monospace" }}>{error}</div>}

      <button
        onClick={analyze}
        disabled={!file || loading}
        style={{
          marginTop: 24, width: "100%", padding: "16px",
          background: file && !loading ? "#C8A96E" : "#1a1a2e",
          color: file && !loading ? "#0a0a1a" : "#3a3a5a",
          border: "none", borderRadius: 8, cursor: file && !loading ? "pointer" : "not-allowed",
          fontFamily: "'DM Mono', monospace", fontSize: 14, fontWeight: 700,
          letterSpacing: "0.05em", transition: "all 0.2s ease"
        }}
      >
        {loading ? "⟳  Analyserer billet..." : "Analysér billet →"}
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
    background: autoFilled(key) ? "rgba(76,175,122,0.08)" : "#111128",
    border: `1px solid ${autoFilled(key) ? "rgba(76,175,122,0.5)" : "#2d2d4e"}`,
    borderRadius: 8, color: "#e8e0d0",
    fontFamily: "'DM Mono', monospace", fontSize: 14, outline: "none",
    boxSizing: "border-box", transition: "border-color 0.2s"
  });

  const autoCount = ["fra","til","dato","tidspunkt","operatør","billetpris"].filter(k => autoFilled(k)).length;
  const canProceed = extractedInfo?.fra && extractedInfo?.til && extractedInfo?.operatør && extractedInfo?.forsinkelse && extractedInfo?.billetpris;

  return (
    <div>
      <h2 style={{ fontFamily: "'Playfair Display', serif", fontSize: 28, color: "#e8e0d0", marginBottom: 8, fontWeight: 400 }}>
        Bekræft rejsedetaljer
      </h2>

      {autoCount > 0 ? (
        <div style={{ display: "flex", alignItems: "center", gap: 10, background: "rgba(76,175,122,0.08)", border: "1px solid rgba(76,175,122,0.25)", borderRadius: 8, padding: "10px 14px", marginBottom: 24 }}>
          <span style={{ fontSize: 18 }}>✅</span>
          <span style={{ fontFamily: "'DM Mono', monospace", fontSize: 13, color: "#4CAF7A" }}>
            Vi læste <strong>{autoCount} felter</strong> automatisk fra din billet — tjek og ret hvis nødvendigt
          </span>
        </div>
      ) : (
        <p style={{ color: "#6a6a8a", fontSize: 14, marginBottom: 24, fontFamily: "'DM Mono', monospace" }}>
          Vi kunne ikke læse billetten — udfyld manuelt
        </p>
      )}

      <div style={{ display: "grid", gap: 14 }}>
        {/* Fra / Til side by side */}
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
          {[{ label: "Fra", key: "fra", placeholder: "Afgangsstation" }, { label: "Til", key: "til", placeholder: "Destinationsstation" }].map(({ label, key, placeholder }) => (
            <div key={key}>
              <label style={{ display: "flex", alignItems: "center", gap: 6, color: "#6a6a8a", fontSize: 10, fontFamily: "'DM Mono', monospace", marginBottom: 6, letterSpacing: "0.12em", textTransform: "uppercase" }}>
                {label}
                {autoFilled(key) && <span style={{ background: "rgba(76,175,122,0.2)", border: "1px solid rgba(76,175,122,0.4)", borderRadius: 3, padding: "1px 5px", fontSize: 8, color: "#4CAF7A", letterSpacing: "0.08em" }}>AUTO</span>}
              </label>
              <input value={extractedInfo?.[key] || ""} onChange={e => update(key, e.target.value)} placeholder={placeholder} style={fieldStyle(key)} />
            </div>
          ))}
        </div>

        {/* Dato / Tidspunkt side by side */}
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
          {[{ label: "Dato", key: "dato", placeholder: "DD.MM.YYYY" }, { label: "Afgang", key: "tidspunkt", placeholder: "HH:MM" }].map(({ label, key, placeholder }) => (
            <div key={key}>
              <label style={{ display: "flex", alignItems: "center", gap: 6, color: "#6a6a8a", fontSize: 10, fontFamily: "'DM Mono', monospace", marginBottom: 6, letterSpacing: "0.12em", textTransform: "uppercase" }}>
                {label}
                {autoFilled(key) && <span style={{ background: "rgba(76,175,122,0.2)", border: "1px solid rgba(76,175,122,0.4)", borderRadius: 3, padding: "1px 5px", fontSize: 8, color: "#4CAF7A", letterSpacing: "0.08em" }}>AUTO</span>}
              </label>
              <input value={extractedInfo?.[key] || ""} onChange={e => update(key, e.target.value)} placeholder={placeholder} style={fieldStyle(key)} />
            </div>
          ))}
        </div>

        {/* Operatør */}
        <div>
          <label style={{ display: "flex", alignItems: "center", gap: 6, color: "#6a6a8a", fontSize: 10, fontFamily: "'DM Mono', monospace", marginBottom: 6, letterSpacing: "0.12em", textTransform: "uppercase" }}>
            Jernbaneoperatør
            {autoFilled("operatør") && <span style={{ background: "rgba(76,175,122,0.2)", border: "1px solid rgba(76,175,122,0.4)", borderRadius: 3, padding: "1px 5px", fontSize: 8, color: "#4CAF7A", letterSpacing: "0.08em" }}>AUTO</span>}
          </label>
          <select value={extractedInfo?.operatør || ""} onChange={e => update("operatør", e.target.value)} style={{ ...fieldStyle("operatør"), color: extractedInfo?.operatør ? "#e8e0d0" : "#4a4a6a" }}>
            <option value="">Vælg operatør...</option>
            {operators.map(o => <option key={o} value={o}>{o}</option>)}
          </select>
        </div>

        {/* Pris / Valuta */}
        <div style={{ display: "grid", gridTemplateColumns: "2fr 1fr", gap: 14 }}>
          <div>
            <label style={{ display: "flex", alignItems: "center", gap: 6, color: "#6a6a8a", fontSize: 10, fontFamily: "'DM Mono', monospace", marginBottom: 6, letterSpacing: "0.12em", textTransform: "uppercase" }}>
              Billetpris
              {autoFilled("billetpris") && <span style={{ background: "rgba(76,175,122,0.2)", border: "1px solid rgba(76,175,122,0.4)", borderRadius: 3, padding: "1px 5px", fontSize: 8, color: "#4CAF7A", letterSpacing: "0.08em" }}>AUTO</span>}
            </label>
            <input type="number" value={extractedInfo?.billetpris || ""} onChange={e => update("billetpris", parseFloat(e.target.value))} placeholder="0" style={fieldStyle("billetpris")} />
          </div>
          <div>
            <label style={{ display: "block", color: "#6a6a8a", fontSize: 10, fontFamily: "'DM Mono', monospace", marginBottom: 6, letterSpacing: "0.12em", textTransform: "uppercase" }}>Valuta</label>
            <select value={extractedInfo?.valuta || "DKK"} onChange={e => update("valuta", e.target.value)} style={{ ...fieldStyle("valuta"), color: "#e8e0d0" }}>
              {["DKK", "EUR", "GBP", "NOK", "SEK"].map(v => <option key={v}>{v}</option>)}
            </select>
          </div>
        </div>

        {/* Forsinkelse */}
        <div>
          <label style={{ display: "block", color: "#6a6a8a", fontSize: 10, fontFamily: "'DM Mono', monospace", marginBottom: 8, letterSpacing: "0.12em", textTransform: "uppercase" }}>
            Hvad var forsinkelsen? <span style={{ color: "#CC4444", fontSize: 10 }}>*</span>
          </label>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 8 }}>
            {DELAY_OPTIONS.map(d => (
              <button key={d} onClick={() => update("forsinkelse", d)} style={{
                padding: "12px 8px", borderRadius: 8, cursor: "pointer",
                background: extractedInfo?.forsinkelse === d ? "rgba(200,169,110,0.15)" : "#111128",
                border: `1px solid ${extractedInfo?.forsinkelse === d ? "#C8A96E" : "#2d2d4e"}`,
                color: extractedInfo?.forsinkelse === d ? "#C8A96E" : "#6a6a8a",
                fontFamily: "'DM Mono', monospace", fontSize: 12, transition: "all 0.15s ease",
                fontWeight: extractedInfo?.forsinkelse === d ? 700 : 400
              }}>{d}</button>
            ))}
          </div>
        </div>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 2fr", gap: 12, marginTop: 24 }}>
        <button onClick={onBack} style={{ padding: "14px", background: "transparent", border: "1px solid #2d2d4e", borderRadius: 8, color: "#6a6a8a", cursor: "pointer", fontFamily: "'DM Mono', monospace", fontSize: 13 }}>
          ← Tilbage
        </button>
        <button onClick={onNext} disabled={!canProceed} style={{
          padding: "14px", background: canProceed ? "#C8A96E" : "#1a1a2e",
          color: canProceed ? "#0a0a1a" : "#3a3a5a", border: "none", borderRadius: 8,
          cursor: canProceed ? "pointer" : "not-allowed",
          fontFamily: "'DM Mono', monospace", fontSize: 14, fontWeight: 700, transition: "all 0.2s ease"
        }}>
          Beregn kompensation →
        </button>
      </div>
    </div>
  );
}

function ResultStep({ extractedInfo, onNext, onBack, setCompensation }) {
  const op = OPERATORS[extractedInfo?.operatør];
  const delayMap = { "30-59 min": 45, "60-119 min": 90, "120+ min": 150 };
  const delayMinutes = delayMap[extractedInfo?.forsinkelse] || 0;
  const price = parseFloat(extractedInfo?.billetpris) || 0;

  let rate = 0;
  let eligible = false;
  let reason = "";

  if (!op) {
    reason = "Operatør ikke fundet";
  } else if (delayMinutes < op.threshold) {
    reason = `Forsinkelse under ${op.threshold} min — ikke berettiget`;
  } else if (delayMinutes >= 120) {
    rate = 1.0; eligible = true;
  } else if (delayMinutes >= 60) {
    rate = op.rate; eligible = true;
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
      <h2 style={{ fontFamily: "'Playfair Display', serif", fontSize: 28, color: "#e8e0d0", marginBottom: 8, fontWeight: 400 }}>
        Vurdering
      </h2>

      <div style={{
        background: eligible ? "rgba(76,175,122,0.08)" : "rgba(255,107,107,0.08)",
        border: `1px solid ${eligible ? "rgba(76,175,122,0.3)" : "rgba(255,107,107,0.3)"}`,
        borderRadius: 12, padding: 24, marginBottom: 24
      }}>
        <div style={{ fontSize: 32, marginBottom: 8 }}>{eligible ? "✅" : "❌"}</div>
        <div style={{ fontFamily: "'Playfair Display', serif", fontSize: 22, color: eligible ? "#4CAF7A" : "#ff6b6b", marginBottom: 4 }}>
          {eligible ? "Du er berettiget til kompensation" : "Ikke berettiget"}
        </div>
        {!eligible && <div style={{ color: "#6a6a8a", fontSize: 13, fontFamily: "'DM Mono', monospace" }}>{reason}</div>}
      </div>

      {eligible && (
        <>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 12, marginBottom: 24 }}>
            {[
              { label: "Total kompensation", value: `${compensation.toFixed(0)} ${currency}`, accent: false },
              { label: "Vores fee (25%)", value: `${ourFee.toFixed(0)} ${currency}`, accent: false },
              { label: "Du modtager", value: `${youGet.toFixed(0)} ${currency}`, accent: true },
            ].map(({ label, value, accent }) => (
              <div key={label} style={{
                background: accent ? "rgba(200,169,110,0.1)" : "#111128",
                border: `1px solid ${accent ? "rgba(200,169,110,0.4)" : "#2d2d4e"}`,
                borderRadius: 10, padding: "16px 14px", textAlign: "center"
              }}>
                <div style={{ color: "#4a4a6a", fontSize: 10, fontFamily: "'DM Mono', monospace", letterSpacing: "0.1em", textTransform: "uppercase", marginBottom: 6 }}>{label}</div>
                <div style={{ color: accent ? "#C8A96E" : "#e8e0d0", fontSize: 18, fontFamily: "'Playfair Display', serif", fontWeight: 700 }}>{value}</div>
              </div>
            ))}
          </div>

          <div style={{ background: "#111128", border: "1px solid #2d2d4e", borderRadius: 10, padding: 16, marginBottom: 24 }}>
            <div style={{ color: "#6a6a8a", fontSize: 11, fontFamily: "'DM Mono', monospace", marginBottom: 8, letterSpacing: "0.1em", textTransform: "uppercase" }}>Klageinstans</div>
            <div style={{ color: "#e8e0d0", fontFamily: "'DM Mono', monospace", fontSize: 14 }}>{op?.authority}</div>
            <div style={{ color: "#C8A96E", fontSize: 12, marginTop: 4, fontFamily: "'DM Mono', monospace" }}>{op?.url}</div>
          </div>
        </>
      )}

      <div style={{ display: "grid", gridTemplateColumns: "1fr 2fr", gap: 12 }}>
        <button onClick={onBack} style={{ padding: "14px", background: "transparent", border: "1px solid #2d2d4e", borderRadius: 8, color: "#6a6a8a", cursor: "pointer", fontFamily: "'DM Mono', monospace", fontSize: 13 }}>
          ← Tilbage
        </button>
        {eligible && (
          <button onClick={onNext} style={{
            padding: "14px", background: "#C8A96E", color: "#0a0a1a",
            border: "none", borderRadius: 8, cursor: "pointer",
            fontFamily: "'DM Mono', monospace", fontSize: 14, fontWeight: 700
          }}>
            Generér klageskema →
          </button>
        )}
      </div>
    </div>
  );
}

// ── Pure JS PDF builder (no external CDN) ───────────────────────────────────
function buildPdf(pages) {
  // Minimal PDF-1.4 builder — text + rectangles + lines only
  const enc = s => {
    let out = '';
    for (let i = 0; i < s.length; i++) {
      const c = s.charCodeAt(i);
      if (c === 40) out += '\\(';
      else if (c === 41) out += '\\)';
      else if (c === 92) out += '\\\\';
      else if (c > 127) out += '?';
      else out += s[i];
    }
    return out;
  };

  const objs = [];
  const addObj = (content) => { objs.push(content); return objs.length; };

  // Catalog + Pages placeholder (filled later)
  const catalogIdx = addObj(''); 
  const pagesIdx   = addObj('');

  const pageIdxs = [];
  const streamIdxs = [];

  for (const pg of pages) {
    const W = pg.W || 595, H = pg.H || 842;
    const ops = [];

    for (const cmd of pg.cmds) {
      if (cmd.type === 'fillRect') {
        const [r,g,b] = cmd.color || [0,0,0];
        ops.push(`${r.toFixed(3)} ${g.toFixed(3)} ${b.toFixed(3)} rg`);
        ops.push(`${cmd.x.toFixed(2)} ${cmd.y.toFixed(2)} ${cmd.w.toFixed(2)} ${cmd.h.toFixed(2)} re f`);
      } else if (cmd.type === 'strokeRect') {
        const [r,g,b] = cmd.color || [0,0,0];
        ops.push(`${r.toFixed(3)} ${g.toFixed(3)} ${b.toFixed(3)} RG`);
        ops.push(`${(cmd.lw||0.5).toFixed(2)} w`);
        ops.push(`${cmd.x.toFixed(2)} ${cmd.y.toFixed(2)} ${cmd.w.toFixed(2)} ${cmd.h.toFixed(2)} re S`);
      } else if (cmd.type === 'line') {
        const [r,g,b] = cmd.color || [0,0,0];
        ops.push(`${r.toFixed(3)} ${g.toFixed(3)} ${b.toFixed(3)} RG`);
        ops.push(`${(cmd.lw||0.5).toFixed(2)} w`);
        ops.push(`${cmd.x1.toFixed(2)} ${cmd.y1.toFixed(2)} m ${cmd.x2.toFixed(2)} ${cmd.y2.toFixed(2)} l S`);
      } else if (cmd.type === 'text') {
        const [r,g,b] = cmd.color || [0,0,0];
        const font = cmd.bold ? '/F2' : '/F1';
        ops.push(`BT`);
        ops.push(`${r.toFixed(3)} ${g.toFixed(3)} ${b.toFixed(3)} rg`);
        ops.push(`${font} ${(cmd.size||9).toFixed(1)} Tf`);
        ops.push(`${cmd.x.toFixed(2)} ${cmd.y.toFixed(2)} Td`);
        ops.push(`(${enc(String(cmd.text || ''))}) Tj`);
        ops.push(`ET`);
      }
    }

    const stream = ops.join('\n');
    const streamIdx = addObj(`<< /Length ${stream.length} >>\nstream\n${stream}\nendstream`);
    streamIdxs.push(streamIdx);

    const pageIdx = addObj(`<< /Type /Page /Parent ${pagesIdx} 0 R /MediaBox [0 0 ${W} ${H}] /Contents ${streamIdx} 0 R /Resources << /Font << /F1 ${objs.length+1} 0 R /F2 ${objs.length+2} 0 R >> >> >>`);
    pageIdxs.push(pageIdx);

    addObj('<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>');
    addObj('<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold /Encoding /WinAnsiEncoding >>');
  }

  // Fill pages obj
  objs[pagesIdx-1] = `<< /Type /Pages /Kids [${pageIdxs.map(i=>i+' 0 R').join(' ')}] /Count ${pageIdxs.length} >>`;
  objs[catalogIdx-1] = `<< /Type /Catalog /Pages ${pagesIdx} 0 R >>`;

  // Build xref
  let body = '%PDF-1.4\n';
  const offsets = [];
  for (let i = 0; i < objs.length; i++) {
    offsets.push(body.length);
    body += `${i+1} 0 obj\n${objs[i]}\nendobj\n`;
  }
  const xrefOffset = body.length;
  body += `xref\n0 ${objs.length+1}\n0000000000 65535 f \n`;
  for (const off of offsets) body += `${String(off).padStart(10,'0')} 00000 n \n`;
  body += `trailer\n<< /Size ${objs.length+1} /Root ${catalogIdx} 0 R >>\nstartxref\n${xrefOffset}\n%%EOF`;

  // Convert to Uint8Array
  const arr = new Uint8Array(body.length);
  for (let i = 0; i < body.length; i++) arr[i] = body.charCodeAt(i) & 0xff;
  return arr;
}

function wrapText(text, maxChars) {
  const words = (text||'').split(' ');
  const lines = []; let cur = '';
  for (const w of words) {
    if ((cur+' '+w).trim().length > maxChars) { lines.push(cur.trim()); cur = w; }
    else cur = (cur+' '+w).trim();
  }
  if (cur) lines.push(cur);
  return lines;
}

function generateEUFormPdf({ info, comp, name, email, address, iban }) {
  const W=595, H=842, m=48;
  const blue=[0.10,0.18,0.45], dark=[0.08,0.08,0.08], mid=[0.45,0.45,0.45];
  const lite=[0.93,0.93,0.93], gold=[1.0,0.85,0.0], white=[1,1,1], red=[0.8,0.0,0.0];
  const cmds = [];

  const fillRect=(x,y,w,h,color)=>cmds.push({type:'fillRect',x,y,w,h,color});
  const strokeRect=(x,y,w,h,color,lw)=>cmds.push({type:'strokeRect',x,y,w,h,color,lw});
  const line=(x1,y1,x2,y2,color,lw)=>cmds.push({type:'line',x1,y1,x2,y2,color,lw});
  const text=(t,x,y,size,color,bold)=>cmds.push({type:'text',text:t,x,y,size,color,bold});

  // HEADER
  fillRect(0,H-50,W,50,blue);
  text('EUROPEAN UNION',m,H-15,7,white,true);
  text('Commission Implementing Regulation (EU) 2024/949 of 27 March 2024',m,H-26,6.5,[0.75,0.82,1]);
  text('COMMON FORM - REIMBURSEMENT AND COMPENSATION REQUEST',m,H-39,9.5,white,true);
  for(let i=0;i<12;i++){const a=(i/12)*Math.PI*2;text('*',W-66+Math.cos(a)*14,H-25+Math.sin(a)*14,7,gold);}

  let y=H-65;
  const section=(title)=>{
    fillRect(m-4,y-4,W-m*2+8,15,[0.93,0.96,1]);
    text(title,m,y+3,7.5,blue,true);
    y-=22;
  };

  // S1: CLAIM TYPE
  section('1.  TYPE OF CLAIM - Place a cross [X] in the applicable box');
  text('Reimbursement due to cancellation:',m,y+1,8,dark);
  strokeRect(m+170,y-1,9,9,dark,0.6); // unchecked
  text('Compensation for delay (Art. 19 Reg. EU 2021/782):',m+230,y+1,8,dark);
  strokeRect(m+440,y-1,9,9,dark,0.6); fillRect(m+441,y,7,7,blue); text('X',m+442,y+1,7,white,true); // checked
  y-=15;
  text('Continuation / re-routing:',m,y+1,8,dark);
  strokeRect(m+130,y-1,9,9,dark,0.6);
  text('Meals / refreshments:',m+230,y+1,8,dark);
  strokeRect(m+335,y-1,9,9,dark,0.6);
  y-=20;

  // S2: JOURNEY
  section('2.  JOURNEY DETAILS');
  const hw=(W-m*2-8)/2;
  const fld=(label,val,fx,fy,fw)=>{
    text(label,fx,fy+14,6.5,mid);
    fillRect(fx,fy,fw,13,lite);
    text(val||'',fx+3,fy+3,8.5,dark);
  };
  fld('Station of departure',info.fra,m,y,hw);
  fld('Station of destination',info.til,m+hw+8,y,hw);
  y-=26;
  fld('Date of travel (DD/MM/YYYY)',info.dato,m,y,hw);
  fld('Scheduled departure time',info.tidspunkt,m+hw+8,y,hw);
  y-=26;
  fld('Railway undertaking (operator)',info.operatør||'',m,y,hw);
  fld('Train number (if known)','',m+hw+8,y,hw);
  y-=26;
  text('Delay at final destination:',m,y+1,8,dark);
  const dOpts=['< 60 min','60-119 min','>= 120 min'];
  const dChk=[info.forsinkelse==='30-59 min',info.forsinkelse==='60-119 min',info.forsinkelse==='120+ min'];
  let dx=m+145;
  dOpts.forEach((d,i)=>{
    strokeRect(dx,y-1,9,9,dark,0.6);
    if(dChk[i]){fillRect(dx+1,y,7,7,blue);text('X',dx+1.5,y+1,7,white,true);}
    text(d,dx+12,y+1,8,dark);
    dx+=80;
  });
  y-=26;
  fld('Ticket price',info.billetpris+' '+info.valuta,m,y,hw);
  fld('Compensation claimed (Art.19)',comp.compensation.toFixed(2)+' '+info.valuta,m+hw+8,y,hw);
  y-=30;

  // S3: PASSENGER
  section('3.  PASSENGER DETAILS');
  fld('Full name',name,m,y,W-m*2); y-=26;
  fld('Address',address||'',m,y,W-m*2); y-=26;
  fld('Email address',email,m,y,hw);
  fld('Phone (optional)','',m+hw+8,y,hw); y-=26;
  fld('IBAN (for bank transfer)',iban||'',m,y,W-m*2); y-=30;

  // S4: PREVIOUS
  section('4.  PREVIOUS REQUEST');
  text('Have you already submitted a request to the railway undertaking?',m,y+1,8,dark);
  strokeRect(m+278,y-1,9,9,dark,0.6); text('Yes',m+290,y+1,8,dark);
  strokeRect(m+315,y-1,9,9,dark,0.6); fillRect(m+316,y,7,7,blue); text('X',m+316.5,y+1,7,white,true);
  text('No',m+327,y+1,8,dark);
  y-=22;

  // S5: DOCUMENTS
  section('5.  SUPPORTING DOCUMENTS ENCLOSED');
  [['Original ticket / booking confirmation',true],['Proof of delay (station stamp, screenshot)',false],['Proof of costs for alternative transport',false]].forEach(([label,chk])=>{
    strokeRect(m,y-1,9,9,dark,0.6);
    if(chk){fillRect(m+1,y,7,7,blue);text('X',m+1.5,y+1,7,white,true);}
    text(label,m+13,y+1,8,dark);
    y-=15;
  });
  y-=8;

  // S6: SIGNATURE
  section('6.  DECLARATION AND SIGNATURE');
  const decl='I hereby acknowledge that the recipient may share my personal data with other relevant parties if required for processing. I declare that all information provided is true and accurate.';
  wrapText(decl,104).forEach(l=>{text(l,m,y,7.5,mid);y-=11;});
  y-=6;
  strokeRect(m,y-33,220,41,[0.6,0.6,0.6],0.8);
  text(name,m+6,y-18,13,blue,true);
  text('(digital signature - EU 2024/949)',m+6,y-30,6.5,mid);
  text('Signature:',m,y+4,7.5,mid);
  fld('Date',new Date().toLocaleDateString('da-DK'),m+230,y-14,120);
  fld('Place','Denmark',m+230,y-40,120);
  y-=58;

  // SUBMIT
  line(m,y,W-m,y,[0.6,0.6,0.6],0.8); y-=13;
  text('SUBMIT TO: '+( info.operatør||'')+'  -  '+(comp.op.authority)+'  -  '+(comp.op.url),m,y,7.5,blue,true);
  y-=13;
  text('This form may be submitted electronically or on paper to any EU railway undertaking (Reg. EU 2021/782).',m,y,7,mid);

  // FOOTER
  fillRect(0,0,W,20,blue);
  text('Commission Implementing Reg. (EU) 2024/949  -  Reg. (EU) 2021/782 on rail passengers rights',m,6,6.5,[0.75,0.82,1]);
  text('Generated: '+new Date().toLocaleDateString('da-DK'),W-130,6,6.5,[0.75,0.82,1]);

  return buildPdf([{W,H,cmds}]);
}

function generateFuldmagtPdf({ info, comp, name, email, address }) {
  const W=595, H=842, m=60;
  const blue=[0.10,0.18,0.45], dark=[0.08,0.08,0.08], mid=[0.45,0.45,0.45];
  const lite=[0.93,0.93,0.93], gold=[1.0,0.85,0.0], white=[1,1,1];
  const cmds=[];

  const fillRect=(x,y,w,h,color)=>cmds.push({type:'fillRect',x,y,w,h,color});
  const strokeRect=(x,y,w,h,color,lw)=>cmds.push({type:'strokeRect',x,y,w,h,color,lw});
  const line=(x1,y1,x2,y2,color,lw)=>cmds.push({type:'line',x1,y1,x2,y2,color,lw});
  const text=(t,x,y,size,color,bold)=>cmds.push({type:'text',text:t,x,y,size,color,bold});
  const wdraw=(str,x,y,maxW,size,color,bold,lh=15)=>{
    const chars=Math.floor(maxW/(size*0.52));
    wrapText(str,chars).forEach(l=>{text(l,x,y,size,color,bold);y-=lh;});
    return y;
  };

  // HEADER
  fillRect(0,H-70,W,70,blue);
  text('FULDMAGT',m,H-28,24,white,true);
  text('Power of Attorney - Togkompensationskrav',m,H-48,11,[0.75,0.82,1]);
  text('Dato: '+new Date().toLocaleDateString('da-DK'),W-140,H-44,9,[0.75,0.82,1]);
  for(let i=0;i<12;i++){const a=(i/12)*Math.PI*2;text('*',W-66+Math.cos(a)*14,H-36+Math.sin(a)*14,7,gold);}

  let y=H-96;

  // UNDERTEGNEDE
  fillRect(m-12,y-58,W-m*2+24,72,[0.96,0.97,1]);
  text('UNDERTEGNEDE - FULDMAGTSGIVER',m,y,8.5,mid,true); y-=18;
  text('Navn:',m,y,10,dark,true); text(name,m+50,y,10,dark);  y-=16;
  text('Adresse:',m,y,10,dark,true); text(address||'-',m+60,y,10,dark); y-=16;
  text('Email:',m,y,10,dark,true); text(email,m+45,y,10,dark); y-=26;

  text('GIVER HERMED FULDMAGT TIL:',m,y,9,mid,true); y-=16;
  fillRect(m-12,y-34,W-m*2+24,48,lite);
  text('EU Rail Refund ApS',m,y,13,blue,true); y-=18;
  text('Til at handle pa undertegnedes vegne i forbindelse med nedenstaaende togkompensationskrav.',m,y,9.5,dark);
  y-=36;

  // REJSEDETALJER
  fillRect(m-12,y-78,W-m*2+24,90,[0.97,0.98,1]);
  fillRect(m-12,y+6,W-m*2+24,16,blue);
  text('KRAVETS REJSEDETALJER',m,y+10,8,white,true); y-=16;
  text('Fra: '+info.fra,m,y,9.5,dark,true);
  text('Til: '+info.til,m+240,y,9.5,dark,true); y-=15;
  text('Dato: '+info.dato,m,y,9.5,dark);
  text('Forsinkelse: '+info.forsinkelse,m+140,y,9.5,dark); y-=15;
  text('Operatoer: '+(info.operatør||''),m,y,9.5,dark); y-=15;
  text('Kompensationskrav: '+comp.compensation.toFixed(2)+' '+info.valuta+' (jf. EU 2021/782, Art. 19)',m,y,9.5,blue,true);
  y-=32;

  // OMFANG
  text('FULDMAGTENS OMFANG',m,y,9,mid,true); y-=16;
  const items=[
    'At indgive og underskrive den officielle EU-blanket (Forordning EU 2024/949) pa vegne af fuldmagtsgiver.',
    'At korrespondere med jernbaneoperatoeren og nationale klageinstanser, herunder '+(comp.op.authority)+'.',
    'At modtage kompensationsbelobet og udbetale fuldmagtsgivers andel (75%) inden for 5 hverdage.',
    'At videresende klagen til '+(comp.op.authority)+' hvis operatoeren ikke svarer inden 30 dage.',
  ];
  items.forEach((item,i)=>{
    text((i+1)+'.',m,y,9.5,dark,true);
    y=wdraw(item,m+18,y,W-m*2-18,9.5,dark,false,14)-6;
  });
  y-=8;

  // HONORAR
  fillRect(m-12,y-26,W-m*2+24,40,[1,0.97,0.89]);
  text('HONORAR:',m,y+8,9,[0.55,0.28,0],true);
  text('25% af opnaet kompensation. Ingen betaling ved afvisning af klagen.',m,y-6,9.5,dark);
  y-=42;

  // GDPR
  y=wdraw('GDPR: Personoplysninger behandles iht. Forordning (EU) 2016/679 og anvendes udelukkende til behandling af dette krav.',m,y,W-m*2,8.5,mid,false,13)-12;

  // UNDERSKRIFT
  text('UNDERSKRIFT / SIGNATURE',m,y,9,mid,true); y-=18;
  strokeRect(m,y-40,220,48,[0.6,0.6,0.6],0.8);
  text(name,m+8,y-22,15,blue,true);
  text('(digital underskrift)',m+8,y-36,7,mid);
  text('Fuldmagtsgiver:',m,y+4,7.5,mid);
  text('Dato: '+new Date().toLocaleDateString('da-DK'),m+250,y-14,10,dark);
  text('Sted: Danmark',m+250,y-32,10,dark);

  // FOOTER
  fillRect(0,0,W,22,blue);
  text('Fuldmagt til EU Rail Refund ApS  -  Jf. Forordning (EU) 2021/782 og 2024/949',m,7,6.5,[0.75,0.82,1]);

  return buildPdf([{W,H,cmds}]);
}

function downloadPdf(bytes, filename) {
  // Convert to base64 data URI — avoids Blob/createObjectURL sandbox restrictions
  let binary = '';
  for (let i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i]);
  const b64 = btoa(binary);
  const a = document.createElement('a');
  a.href = 'data:application/pdf;base64,' + b64;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
}

function FormStep({ extractedInfo, compensation, onBack }) {
  const [subStep, setSubStep] = useState("details");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [address, setAddress] = useState("");
  const [iban, setIban] = useState("");
  const [agreed, setAgreed] = useState(false);
  const [signInput, setSignInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const mono = "'DM Mono', monospace";
  const inp = { width:"100%", padding:"11px 13px", background:"#111128", border:"1px solid #2d2d4e", borderRadius:8, color:"#e8e0d0", fontFamily:mono, fontSize:13, outline:"none", boxSizing:"border-box" };
  const signed = signInput.trim().toLowerCase() === name.trim().toLowerCase() && name.trim().length > 0;
  const canGo = name.trim() && email.trim() && address.trim() && agreed;

  const doGenerate = async () => {
    setLoading(true); setError("");
    try {
      const res = await fetch("/api/generate-pdfs", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          info: {
            fra: extractedInfo.fra,
            til: extractedInfo.til,
            dato: extractedInfo.dato,
            tidspunkt: extractedInfo.tidspunkt,
            forsinkelse: extractedInfo.forsinkelse,
            operatoer: extractedInfo.operatør || "",
            billetpris: extractedInfo.billetpris,
            valuta: extractedInfo.valuta || "DKK",
          },
          comp: {
            compensation: compensation.compensation,
            authority: compensation.op.authority,
            url: compensation.op.url,
          },
          person: {
            navn: name,
            email: email,
            adresse: address,
            iban: iban,
            dato_signed: new Date().toLocaleDateString("da-DK"),
          }
        })
      });
      if (!res.ok) throw new Error("Server fejl: " + res.status);
      const data = await res.json();
      // Download both PDFs from base64
      const dl = (b64, filename) => {
        const byteStr = atob(b64);
        const arr = new Uint8Array(byteStr.length);
        for (let i = 0; i < byteStr.length; i++) arr[i] = byteStr.charCodeAt(i);
        const blob = new Blob([arr], { type: "application/pdf" });
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url; a.download = filename; a.click();
        setTimeout(() => URL.revokeObjectURL(url), 2000);
      };
      dl(data.eu, "EU-blanket-togkompensation.pdf");
      setTimeout(() => dl(data.fuldmagt, "Fuldmagt-EU-Rail-Refund.pdf"), 800);
      setSubStep("done");
    } catch(e) {
      setError("Fejl: " + e.message);
    } finally {
      setLoading(false);
    }
  };

  const LabelEl = ({ children }) => (
    <label style={{ display:"block", color:"#6a6a8a", fontSize:10, fontFamily:mono, marginBottom:5, letterSpacing:"0.1em", textTransform:"uppercase" }}>
      {children}
    </label>
  );

  if (subStep === "details") return (
    <div>
      <h2 style={{ fontFamily:"'Playfair Display', serif", fontSize:26, color:"#e8e0d0", marginBottom:6, fontWeight:400 }}>Dine oplysninger</h2>
      <p style={{ color:"#6a6a8a", fontSize:13, marginBottom:22, fontFamily:mono }}>Bruges til at udfylde den officielle EU-blanket (2024/949)</p>

      <div style={{ display:"grid", gap:14 }}>
        <div>
          <LabelEl>Fulde navn *</LabelEl>
          <input value={name} onChange={e => setName(e.target.value)} placeholder="Frederik Hansen" style={inp} />
        </div>

        <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:12 }}>
          <div>
            <LabelEl>Email *</LabelEl>
            <input value={email} onChange={e => setEmail(e.target.value)} placeholder="din@email.dk" type="email" style={inp} />
          </div>
          <div>
            <LabelEl>IBAN (til udbetaling)</LabelEl>
            <input value={iban} onChange={e => setIban(e.target.value)} placeholder="DK50 0040..." style={inp} />
          </div>
        </div>

        <div>
          <LabelEl>Adresse *</LabelEl>
          <input value={address} onChange={e => setAddress(e.target.value)} placeholder="Strandvejen 1, 2100 Kobenhavn O" style={inp} />
        </div>

        <div style={{ background:"rgba(200,169,110,0.07)", border:"1px solid rgba(200,169,110,0.2)", borderRadius:10, padding:"14px 16px" }}>
          <div style={{ fontFamily:mono, fontSize:11, color:"#C8A96E", marginBottom:10, letterSpacing:"0.08em" }}>VI GENERERER 2 DOKUMENTER</div>
          <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:10 }}>
            <div style={{ background:"#111128", borderRadius:8, padding:"10px 12px" }}>
              <div style={{ fontSize:20, marginBottom:4 }}>📄</div>
              <div style={{ fontFamily:mono, fontSize:11, color:"#e8e0d0", fontWeight:700 }}>EU-blanket 2024/949</div>
              <div style={{ fontFamily:mono, fontSize:10, color:"#6a6a8a", marginTop:3 }}>Officiel EU-formular, auto-udfyldt</div>
            </div>
            <div style={{ background:"#111128", borderRadius:8, padding:"10px 12px" }}>
              <div style={{ fontSize:20, marginBottom:4 }}>✍️</div>
              <div style={{ fontFamily:mono, fontSize:11, color:"#e8e0d0", fontWeight:700 }}>Fuldmagt</div>
              <div style={{ fontFamily:mono, fontSize:10, color:"#6a6a8a", marginTop:3 }}>Bemyndiger os til at indsende</div>
            </div>
          </div>
        </div>

        <div
          onClick={() => setAgreed(a => !a)}
          style={{ display:"flex", gap:10, cursor:"pointer", alignItems:"flex-start", padding:"12px", background: agreed ? "rgba(76,175,122,0.07)" : "#111128", border:`1px solid ${agreed ? "rgba(76,175,122,0.4)" : "#2d2d4e"}`, borderRadius:8, transition:"all 0.2s" }}
        >
          <div style={{ width:16, height:16, border:`2px solid ${agreed ? "#4CAF7A" : "#4a4a6a"}`, borderRadius:3, background: agreed ? "#4CAF7A" : "transparent", flexShrink:0, marginTop:1, display:"flex", alignItems:"center", justifyContent:"center" }}>
            {agreed && <span style={{ color:"white", fontSize:10, fontWeight:700 }}>✓</span>}
          </div>
          <span style={{ fontFamily:mono, fontSize:11, color:"#8a8aaa", lineHeight:1.6 }}>
            Jeg giver EU Rail Refund ApS fuldmagt til at indgive klagen paa mine vegne og accepterer 25% honorar. Ingen betaling ved afvisning.
          </span>
        </div>
      </div>

      <div style={{ display:"grid", gridTemplateColumns:"1fr 2fr", gap:12, marginTop:20 }}>
        <button onClick={onBack} style={{ padding:"13px", background:"transparent", border:"1px solid #2d2d4e", borderRadius:8, color:"#6a6a8a", cursor:"pointer", fontFamily:mono, fontSize:13 }}>
          ← Tilbage
        </button>
        <button
          onClick={() => setSubStep("sign")}
          disabled={!canGo}
          style={{ padding:"13px", background: canGo ? "#C8A96E" : "#1a1a2e", color: canGo ? "#0a0a1a" : "#3a3a5a", border:"none", borderRadius:8, cursor: canGo ? "pointer" : "not-allowed", fontFamily:mono, fontSize:13, fontWeight:700, transition:"all 0.2s" }}
        >
          Fortsaet til underskrift →
        </button>
      </div>
    </div>
  );

  if (subStep === "sign") return (
    <div>
      <h2 style={{ fontFamily:"'Playfair Display', serif", fontSize:26, color:"#e8e0d0", marginBottom:6, fontWeight:400 }}>Digital underskrift</h2>
      <p style={{ color:"#6a6a8a", fontSize:13, marginBottom:20, fontFamily:mono }}>Skriv dit navn for at underskrive begge dokumenter</p>

      <div style={{ background:"#0d0d20", border:"1px solid #2d2d4e", borderRadius:10, padding:18, marginBottom:20 }}>
        <div style={{ fontFamily:mono, fontSize:10, color:"#6a6a8a", marginBottom:12, letterSpacing:"0.1em" }}>DU UNDERSKRIVER</div>
        {[
          ["📄 EU-blanket (2024/949)", "Kompensationskrav: " + compensation.compensation.toFixed(0) + " " + extractedInfo.valuta],
          ["✍️ Fuldmagt til EU Rail Refund ApS", extractedInfo.fra + " → " + extractedInfo.til + " · " + extractedInfo.dato],
        ].map(([title, sub]) => (
          <div key={title} style={{ display:"flex", justifyContent:"space-between", alignItems:"center", padding:"8px 0", borderBottom:"1px solid #1a1a2e" }}>
            <div>
              <div style={{ fontFamily:mono, fontSize:12, color:"#e8e0d0" }}>{title}</div>
              <div style={{ fontFamily:mono, fontSize:10, color:"#6a6a8a", marginTop:2 }}>{sub}</div>
            </div>
            <div style={{ color: signed ? "#4CAF7A" : "#4a4a6a", fontSize:20 }}>{signed ? "✓" : "○"}</div>
          </div>
        ))}
      </div>

      <div style={{ marginBottom:20 }}>
        <LabelEl>Skriv dit fulde navn som underskrift *</LabelEl>
        <input
          value={signInput}
          onChange={e => setSignInput(e.target.value)}
          placeholder="Skriv dit fulde navn..."
          style={{ ...inp, fontSize:16, fontFamily:"'Playfair Display', serif", borderColor: signed ? "rgba(76,175,122,0.5)" : "#2d2d4e", background: signed ? "rgba(76,175,122,0.05)" : "#111128" }}
        />
        <div style={{ fontFamily:mono, fontSize:10, color:"#4a4a6a", marginTop:6 }}>
          Din navneindtastning fungerer som digital underskrift paa begge dokumenter.
        </div>
      </div>

      {error && <div style={{ color:"#ff6b6b", fontFamily:mono, fontSize:12, marginBottom:12 }}>{error}</div>}

      <div style={{ display:"grid", gridTemplateColumns:"1fr 2fr", gap:12 }}>
        <button onClick={() => setSubStep("details")} style={{ padding:"13px", background:"transparent", border:"1px solid #2d2d4e", borderRadius:8, color:"#6a6a8a", cursor:"pointer", fontFamily:mono, fontSize:13 }}>
          ← Tilbage
        </button>
        <button
          onClick={doGenerate}
          disabled={!signed || loading}
          style={{ padding:"13px", background: signed && !loading ? "#C8A96E" : "#1a1a2e", color: signed && !loading ? "#0a0a1a" : "#3a3a5a", border:"none", borderRadius:8, cursor: signed ? "pointer" : "not-allowed", fontFamily:mono, fontSize:13, fontWeight:700 }}
        >
          {loading ? "⟳  Genererer PDFer..." : "✍️  Underskriv og download PDF →"}
        </button>
      </div>
    </div>
  );

  return (
    <div style={{ textAlign:"center", padding:"10px 0" }}>
      <div style={{ fontSize:52, marginBottom:16 }}>🎉</div>
      <h2 style={{ fontFamily:"'Playfair Display', serif", fontSize:26, color:"#e8e0d0", marginBottom:10, fontWeight:400 }}>Dokumenter downloadet!</h2>
      <p style={{ fontFamily:mono, fontSize:13, color:"#6a6a8a", marginBottom:20, lineHeight:1.8 }}>
        2 PDF-filer er downloadet. Send begge til <strong style={{ color:"#C8A96E" }}>{compensation.op.authority}</strong>.
      </p>
      <div style={{ display:"grid", gap:10, textAlign:"left", background:"#111128", borderRadius:10, padding:18, marginBottom:20 }}>
        {[
          ["📄 EU-blanket-togkompensation.pdf", "Officiel EU 2024/949 formular — send til operatøren"],
          ["✍️ Fuldmagt-EU-Rail-Refund.pdf", "Fuldmagt — vedlaeg til klagen"],
        ].map(([file, desc]) => (
          <div key={file}>
            <div style={{ fontFamily:mono, fontSize:12, color:"#e8e0d0" }}>{file}</div>
            <div style={{ fontFamily:mono, fontSize:10, color:"#6a6a8a", marginTop:2 }}>{desc}</div>
          </div>
        ))}
      </div>
      <div style={{ background:"rgba(200,169,110,0.07)", border:"1px solid rgba(200,169,110,0.2)", borderRadius:10, padding:"14px 16px", textAlign:"left" }}>
        <div style={{ fontFamily:mono, fontSize:11, color:"#C8A96E", marginBottom:10 }}>NAESTE SKRIDT</div>
        <div style={{ fontFamily:mono, fontSize:12, color:"#8a8aaa", lineHeight:2 }}>
          1. Email begge PDF-filer til {extractedInfo.operatør}<br/>
          2. CC: {compensation.op.authority} ({compensation.op.url})<br/>
          3. Operatøren har 30 dage til at svare (Reg. EU 2021/782)<br/>
          4. Vi rykker automatisk hvis ingen svar
        </div>
      </div>
    </div>
  );
}


export default function App() {
  const [step, setStep] = useState("upload");
  const [ticketData, setTicketData] = useState(null);
  const [extractedInfo, setExtractedInfo] = useState({});
  const [compensation, setCompensation] = useState(null);

  const goTo = (s) => setStep(s);

  return (
    <div style={{
      minHeight: "100vh",
      background: "#0a0a1a",
      backgroundImage: "radial-gradient(ellipse at 20% 20%, rgba(200,169,110,0.06) 0%, transparent 60%), radial-gradient(ellipse at 80% 80%, rgba(76,100,175,0.08) 0%, transparent 60%)",
      display: "flex", alignItems: "center", justifyContent: "center",
      padding: "24px 16px", fontFamily: "system-ui",
      position: "relative", overflow: "hidden"
    }}>
      {/* Background rail lines */}
      <div style={{ position: "fixed", inset: 0, opacity: 0.04, pointerEvents: "none" }}>
        {[...Array(8)].map((_, i) => (
          <div key={i} style={{ position: "absolute", left: `${i * 14}%`, top: 0, bottom: 0, width: 1, background: "#C8A96E", transform: `rotate(${i % 2 === 0 ? 5 : -5}deg)` }} />
        ))}
      </div>

      <div style={{ width: "100%", maxWidth: 520, position: "relative" }}>
        {/* Header */}
        <div style={{ marginBottom: 32, textAlign: "center" }}>
          <div style={{ display: "inline-flex", alignItems: "center", gap: 10, background: "rgba(200,169,110,0.08)", border: "1px solid rgba(200,169,110,0.2)", borderRadius: 100, padding: "6px 16px", marginBottom: 20 }}>
            <span style={{ fontSize: 16 }}>🚆</span>
            <span style={{ fontFamily: "'DM Mono', monospace", fontSize: 11, color: "#C8A96E", letterSpacing: "0.15em", textTransform: "uppercase" }}>EU Rail Refund</span>
          </div>
          <h1 style={{ fontFamily: "'Playfair Display', serif", fontSize: 36, color: "#e8e0d0", margin: 0, fontWeight: 400, lineHeight: 1.2 }}>
            Få dine penge<br /><em style={{ color: "#C8A96E" }}>tilbage</em>
          </h1>
          <p style={{ color: "#4a4a6a", fontFamily: "'DM Mono', monospace", fontSize: 12, marginTop: 10, letterSpacing: "0.05em" }}>
            POWERED BY EU-FORORDNING 1371/2007
          </p>
        </div>

        {/* Card */}
        <div style={{
          background: "rgba(255,255,255,0.03)",
          border: "1px solid rgba(255,255,255,0.07)",
          borderRadius: 16, padding: "32px",
          backdropFilter: "blur(20px)",
          boxShadow: "0 32px 80px rgba(0,0,0,0.4)"
        }}>
          <ProgressBar step={step} />

          {step === "upload" && <UploadStep onNext={() => goTo("details")} setTicketData={setTicketData} setExtractedInfo={setExtractedInfo} />}
          {step === "details" && <DetailsStep extractedInfo={extractedInfo} setExtractedInfo={setExtractedInfo} onNext={() => goTo("result")} onBack={() => goTo("upload")} />}
          {step === "result" && <ResultStep extractedInfo={extractedInfo} onNext={() => goTo("form")} onBack={() => goTo("details")} setCompensation={setCompensation} />}
          {step === "form" && <FormStep extractedInfo={extractedInfo} compensation={compensation} onBack={() => goTo("result")} />}
        </div>

        <p style={{ textAlign: "center", color: "#2a2a3a", fontSize: 11, fontFamily: "'DM Mono', monospace", marginTop: 20 }}>
          Vi tager 25% af kompensationen — intet at betale hvis vi ikke vinder
        </p>
      </div>

      <Head>
        <title>EU Rail Refund — Få dine penge tilbage</title>
        <meta name="description" content="Kræv togkompensation automatisk under EU-forordning 2021/782" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <link rel="icon" href="/favicon.ico" />
      </Head>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Playfair+Display:ital,wght@0,400;0,700;1,400&family=DM+Mono:wght@400;500;700&display=swap');
        * { box-sizing: border-box; }
        input, select { transition: border-color 0.2s ease; }
        input:focus, select:focus { border-color: #C8A96E !important; }
        ::-webkit-scrollbar { width: 4px; }
        ::-webkit-scrollbar-track { background: #111128; }
        ::-webkit-scrollbar-thumb { background: #2d2d4e; border-radius: 2px; }
        option { background: #111128; }
      `}</style>
    </div>
  );
}
