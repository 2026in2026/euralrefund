import { useState, useRef, useEffect } from "react";
import Head from "next/head";

const STEPS = ["upload", "details", "result", "form"];

const OPERATORS = {
  "DSB (Denmark)": { threshold: 60, rate: 0.5, authority: "Trafikstyrelsen", authorityUrl: "https://www.trafikstyrelsen.dk", claimEmail: "kundeservice@dsb.dk", claimUrl: "https://www.dsb.dk/kundeservice/kontakt/" },
  "DB (Germany)": { threshold: 60, rate: 0.5, authority: "Bundesnetzagentur", authorityUrl: "https://www.bundesnetzagentur.de", claimEmail: "fahrgastrechte@bahn.de", claimUrl: "https://int.bahn.de/en/buchung/meine-reisen" },
  "SNCF (France)": { threshold: 60, rate: 0.25, authority: "ARAFER", authorityUrl: "https://www.autorite-transports.fr", claimEmail: "client@sncf.fr", claimUrl: "https://www.sncf-connect.com/en-en/help/delays" },
  "Eurostar": { threshold: 60, rate: 0.5, authority: "ORR (UK)", authorityUrl: "https://www.orr.gov.uk", claimEmail: "claims@eurostar.com", claimUrl: "https://www.eurostar.com/uk-en/customer-service/delays-and-disruptions" },
  "NS (Netherlands)": { threshold: 30, rate: 0.5, authority: "ACM", authorityUrl: "https://www.acm.nl", claimEmail: "klantenservice@ns.nl", claimUrl: "https://www.ns.nl/klantenservice/compensatie-en-schadeclaims" },
  "OBB (Austria)": { threshold: 60, rate: 0.5, authority: "Schienen-Control", authorityUrl: "https://www.schienen-control.gv.at", claimEmail: "kundenservice@oebb.at", claimUrl: "https://www.oebb.at/en/service/contact" },
  "Trenitalia (Italy)": { threshold: 60, rate: 0.25, authority: "ART", authorityUrl: "https://www.autorita-trasporti.it", claimEmail: "assistenza@trenitalia.it", claimUrl: "https://www.trenitalia.com/en/services/customer-care.html" },
  "Renfe (Spain)": { threshold: 60, rate: 0.5, authority: "CNMC", authorityUrl: "https://www.cnmc.es", claimEmail: "atencion.cliente@renfe.es", claimUrl: "https://www.renfe.com/es/en/travelling-with-renfe/customer-service" },
};

const DELAY_OPTIONS = ["30-59 min", "60-119 min", "120+ min"];

const OPERATOR_ALIASES = {
  "dsb": "DSB (Denmark)", "danske statsbaner": "DSB (Denmark)",
  "db": "DB (Germany)", "deutsche bahn": "DB (Germany)",
  "sncf": "SNCF (France)", "eurostar": "Eurostar",
  "ns": "NS (Netherlands)", "nederlandse spoorwegen": "NS (Netherlands)",
  "obb": "OBB (Austria)", "oebb": "OBB (Austria)", "osterreichische bundesbahnen": "OBB (Austria)",
  "trenitalia": "Trenitalia (Italy)", "renfe": "Renfe (Spain)",
};

function normalizeOperator(raw) {
  if (!raw) return "";
  const lower = raw.toLowerCase().trim();
  for (const [alias, canonical] of Object.entries(OPERATOR_ALIASES)) {
    if (lower.includes(alias)) return canonical;
  }
  return Object.keys(OPERATORS).find(k =>
    k.toLowerCase().includes(lower) || lower.includes(k.toLowerCase().split(" ")[0].toLowerCase())
  ) || "";
}

// ─── Compact feedback widget shown at bottom of every step ──────────────────
function MicroFeedback({ stepName }) {
  const [rating, setRating] = useState(0);
  const [hovered, setHovered] = useState(0);
  const [note, setNote] = useState("");
  const [done, setDone] = useState(false);
  const [saving, setSaving] = useState(false);
  const mono = "'DM Mono', monospace";

  const submit = async () => {
    if (!rating) return;
    setSaving(true);
    try {
      await fetch("/api/send-feedback", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ step: stepName, rating, comment: note }),
      });
    } catch (_) {}
    setDone(true);
    setSaving(false);
  };

  if (done) return (
    <div style={{ marginTop: 20, padding: "10px 14px", background: "rgba(76,175,122,0.07)", border: "1px solid rgba(76,175,122,0.18)", borderRadius: 8, display: "flex", alignItems: "center", gap: 8 }}>
      <span style={{ fontSize: 16 }}>🙏</span>
      <span style={{ fontFamily: mono, fontSize: 11, color: "#4CAF7A" }}>Thanks for the feedback!</span>
    </div>
  );

  return (
    <div style={{ marginTop: 20, padding: "12px 14px", background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.06)", borderRadius: 8 }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 8 }}>
        <span style={{ fontFamily: mono, fontSize: 10, color: "#4a4a6a", letterSpacing: "0.1em", textTransform: "uppercase" }}>Quick feedback</span>
        <div style={{ display: "flex", gap: 4, alignItems: "center" }}>
          {[1,2,3,4,5].map(n => (
            <button key={n} onClick={() => setRating(n)} onMouseEnter={() => setHovered(n)} onMouseLeave={() => setHovered(0)}
              style={{ fontSize: 16, background: "none", border: "none", cursor: "pointer", padding: 0, lineHeight: 1,
                transform: (hovered || rating) >= n ? "scale(1.25)" : "scale(1)",
                transition: "transform 0.1s",
                filter: (hovered || rating) >= n ? "none" : "grayscale(1) opacity(0.35)" }}>⭐</button>
          ))}
          {rating > 0 && (
            <>
              <input value={note} onChange={e => setNote(e.target.value)} placeholder="Optional note…"
                style={{ marginLeft: 8, padding: "4px 8px", background: "#111128", border: "1px solid #2d2d4e", borderRadius: 6, color: "#e8e0d0", fontFamily: mono, fontSize: 11, outline: "none", width: 140 }} />
              <button onClick={submit} disabled={saving}
                style={{ marginLeft: 6, padding: "4px 10px", background: "#C8A96E", color: "#0a0a1a", border: "none", borderRadius: 6, cursor: "pointer", fontFamily: mono, fontSize: 11, fontWeight: 700 }}>
                {saving ? "…" : "Send"}
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

function ProgressBar({ step }) {
  const steps = ["Ticket", "Details", "Assessment", "Form"];
  const current = STEPS.indexOf(step);
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 0, marginBottom: 40 }}>
      {steps.map((s, i) => {
        const active = i <= current;
        return (
          <div key={s} style={{ display: "flex", alignItems: "center", flex: i < steps.length - 1 ? 1 : "none" }}>
            <div style={{ width: 32, height: 32, borderRadius: "50%", background: active ? "#C8A96E" : "#1a1a2e", border: `2px solid ${active ? "#C8A96E" : "#2d2d4e"}`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 12, fontFamily: "'DM Mono', monospace", color: active ? "#0a0a1a" : "#4a4a6a", fontWeight: 700, flexShrink: 0, transition: "all 0.3s ease" }}>
              {i < current ? "✓" : i + 1}
            </div>
            <span style={{ fontSize: 11, color: active ? "#C8A96E" : "#3a3a5a", marginLeft: 6, fontFamily: "'DM Mono', monospace", whiteSpace: "nowrap" }}>{s}</span>
            {i < steps.length - 1 && <div style={{ flex: 1, height: 1, background: active && i < current ? "#C8A96E" : "#2d2d4e", margin: "0 12px", transition: "all 0.3s ease" }} />}
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

  const handleFile = (f) => { setFile(f); setError(""); };

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
          messages: [{ role: "user", content: [contentBlock, { type: "text", text: `You are a ticket reader. Analyze this train ticket carefully and return ONLY valid JSON without markdown or explanation: { "fra": "departure station full name", "til": "destination station full name", "dato": "DD.MM.YYYY", "tidspunkt": "HH:MM", "operatoer": "railway company name (e.g. DSB, DB, SNCF, Eurostar, NS, OBB, Trenitalia, Renfe)", "billetpris": 549, "valuta": "DKK", "bekreeftet": true } If you cannot find a field, set it to null.` }] }]
        })
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error?.message || "API error");
      const text = data.content?.find(b => b.type === "text")?.text || "{}";
      const parsed = JSON.parse(text.replace(/```json|```/g, "").trim());
      const normalizedOp = normalizeOperator(parsed.operatoer || parsed.operatør || "");
      setTicketData({ file, base64, mediaType });
      setExtractedInfo({ ...parsed, operatør: normalizedOp });
      onNext();
    } catch (e) {
      setError("Could not read ticket. Please try a clearer image.");
    } finally {
      setLoading(false);
    }
  };

  const skipToManual = () => {
    setExtractedInfo({});
    onNext();
  };

  return (
    <div>
      <h2 style={{ fontFamily: "'Playfair Display', serif", fontSize: 28, color: "#e8e0d0", marginBottom: 8, fontWeight: 400 }}>Upload your ticket</h2>
      <p style={{ color: "#6a6a8a", fontSize: 14, marginBottom: 28, fontFamily: "'DM Mono', monospace" }}>PDF or image — we read the details automatically</p>

      <div
        onClick={() => fileRef.current.click()}
        onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
        onDragLeave={() => setDragging(false)}
        onDrop={(e) => { e.preventDefault(); setDragging(false); handleFile(e.dataTransfer.files[0]); }}
        style={{ border: `2px dashed ${dragging ? "#C8A96E" : file ? "#4CAF7A" : "#2d2d4e"}`, borderRadius: 12, padding: "48px 32px", textAlign: "center", cursor: "pointer", background: dragging ? "rgba(200,169,110,0.05)" : file ? "rgba(76,175,122,0.05)" : "rgba(255,255,255,0.02)", transition: "all 0.2s ease" }}>
        <input ref={fileRef} type="file" accept=".pdf,image/*" style={{ display: "none" }} onChange={e => handleFile(e.target.files[0])} />
        <div style={{ fontSize: 36, marginBottom: 12 }}>{file ? "🎫" : "📄"}</div>
        {file ? (
          <div>
            <div style={{ color: "#4CAF7A", fontFamily: "'DM Mono', monospace", fontSize: 14, fontWeight: 700 }}>{file.name}</div>
            <div style={{ color: "#6a6a8a", fontSize: 12, marginTop: 4 }}>{(file.size / 1024).toFixed(0)} KB</div>
          </div>
        ) : (
          <div>
            <div style={{ color: "#8a8aaa", fontFamily: "'DM Mono', monospace", fontSize: 14 }}>Drag file here or click to select</div>
            <div style={{ color: "#4a4a6a", fontSize: 12, marginTop: 6 }}>Supports PDF, JPG, PNG</div>
          </div>
        )}
      </div>

      {error && <div style={{ color: "#ff6b6b", fontSize: 13, marginTop: 12, fontFamily: "'DM Mono', monospace" }}>{error}</div>}

      <button onClick={analyze} disabled={!file || loading}
        style={{ marginTop: 24, width: "100%", padding: "16px", background: file && !loading ? "#C8A96E" : "#1a1a2e", color: file && !loading ? "#0a0a1a" : "#3a3a5a", border: "none", borderRadius: 8, cursor: file && !loading ? "pointer" : "not-allowed", fontFamily: "'DM Mono', monospace", fontSize: 14, fontWeight: 700, letterSpacing: "0.05em", transition: "all 0.2s ease" }}>
        {loading ? "⟳ Analysing ticket..." : "Analyse ticket →"}
      </button>

      <button onClick={skipToManual}
        style={{ marginTop: 10, width: "100%", padding: "11px", background: "transparent", color: "#4a4a6a", border: "1px solid #1e1e38", borderRadius: 8, cursor: "pointer", fontFamily: "'DM Mono', monospace", fontSize: 12, transition: "all 0.2s ease" }}>
        Skip — enter details manually →
      </button>

      <MicroFeedback stepName="upload" />
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
    borderRadius: 8, color: "#e8e0d0", fontFamily: "'DM Mono', monospace", fontSize: 14,
    outline: "none", boxSizing: "border-box", transition: "border-color 0.2s"
  });
  const autoCount = ["fra","til","dato","tidspunkt","operatør","billetpris"].filter(k => autoFilled(k)).length;
  const canProceed = extractedInfo?.fra && extractedInfo?.til && extractedInfo?.operatør && extractedInfo?.forsinkelse && extractedInfo?.billetpris;
  const AutoBadge = () => <span style={{ background: "rgba(76,175,122,0.2)", border: "1px solid rgba(76,175,122,0.4)", borderRadius: 3, padding: "1px 5px", fontSize: 8, color: "#4CAF7A", letterSpacing: "0.08em" }}>AUTO</span>;
  const Lbl = ({ children, k }) => <label style={{ display: "flex", alignItems: "center", gap: 6, color: "#6a6a8a", fontSize: 10, fontFamily: "'DM Mono', monospace", marginBottom: 6, letterSpacing: "0.12em", textTransform: "uppercase" }}>{children}{k && autoFilled(k) && <AutoBadge />}</label>;

  return (
    <div>
      <h2 style={{ fontFamily: "'Playfair Display', serif", fontSize: 28, color: "#e8e0d0", marginBottom: 8, fontWeight: 400 }}>Confirm journey details</h2>
      {autoCount > 0 ? (
        <div style={{ display: "flex", alignItems: "center", gap: 10, background: "rgba(76,175,122,0.08)", border: "1px solid rgba(76,175,122,0.25)", borderRadius: 8, padding: "10px 14px", marginBottom: 24 }}>
          <span style={{ fontSize: 18 }}>✅</span>
          <span style={{ fontFamily: "'DM Mono', monospace", fontSize: 13, color: "#4CAF7A" }}>We read <strong>{autoCount} fields</strong> automatically — check and correct if needed</span>
        </div>
      ) : <p style={{ color: "#6a6a8a", fontSize: 14, marginBottom: 24, fontFamily: "'DM Mono', monospace" }}>Fill in your journey details below</p>}

      <div style={{ display: "grid", gap: 14 }}>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
          {[{label:"From", key:"fra", ph:"Departure station"},{label:"To", key:"til", ph:"Destination station"}].map(({label,key,ph}) => (
            <div key={key}><Lbl k={key}>{label}</Lbl><input value={extractedInfo?.[key]||""} onChange={e=>update(key,e.target.value)} placeholder={ph} style={fieldStyle(key)} /></div>
          ))}
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
          {[{label:"Date", key:"dato", ph:"DD.MM.YYYY"},{label:"Departure", key:"tidspunkt", ph:"HH:MM"}].map(({label,key,ph}) => (
            <div key={key}><Lbl k={key}>{label}</Lbl><input value={extractedInfo?.[key]||""} onChange={e=>update(key,e.target.value)} placeholder={ph} style={fieldStyle(key)} /></div>
          ))}
        </div>
        <div>
          <Lbl k="operatør">Railway operator</Lbl>
          <select value={extractedInfo?.operatør||""} onChange={e=>update("operatør",e.target.value)} style={{...fieldStyle("operatør"), color: extractedInfo?.operatør ? "#e8e0d0" : "#4a4a6a"}}>
            <option value="">Select operator...</option>
            {operators.map(o => <option key={o} value={o}>{o}</option>)}
          </select>
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "2fr 1fr", gap: 14 }}>
          <div><Lbl k="billetpris">Ticket price</Lbl><input type="number" value={extractedInfo?.billetpris||""} onChange={e=>update("billetpris",parseFloat(e.target.value))} placeholder="0" style={fieldStyle("billetpris")} /></div>
          <div><Lbl>Currency</Lbl><select value={extractedInfo?.valuta||"DKK"} onChange={e=>update("valuta",e.target.value)} style={{...fieldStyle("valuta"), color:"#e8e0d0"}}>{["DKK","EUR","GBP","NOK","SEK"].map(v=><option key={v}>{v}</option>)}</select></div>
        </div>
        <div>
          <label style={{ display: "block", color: "#6a6a8a", fontSize: 10, fontFamily: "'DM Mono', monospace", marginBottom: 8, letterSpacing: "0.12em", textTransform: "uppercase" }}>What was the delay? <span style={{ color: "#CC4444" }}>*</span></label>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 8 }}>
            {DELAY_OPTIONS.map(d => (
              <button key={d} onClick={() => update("forsinkelse", d)}
                style={{ padding: "12px 8px", borderRadius: 8, cursor: "pointer", background: extractedInfo?.forsinkelse===d ? "rgba(200,169,110,0.15)" : "#111128", border: `1px solid ${extractedInfo?.forsinkelse===d ? "#C8A96E" : "#2d2d4e"}`, color: extractedInfo?.forsinkelse===d ? "#C8A96E" : "#6a6a8a", fontFamily: "'DM Mono', monospace", fontSize: 12, transition: "all 0.15s ease", fontWeight: extractedInfo?.forsinkelse===d ? 700 : 400 }}>{d}</button>
            ))}
          </div>
        </div>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 2fr", gap: 12, marginTop: 24 }}>
        <button onClick={onBack} style={{ padding: "14px", background: "transparent", border: "1px solid #2d2d4e", borderRadius: 8, color: "#6a6a8a", cursor: "pointer", fontFamily: "'DM Mono', monospace", fontSize: 13 }}>← Back</button>
        <button onClick={onNext} disabled={!canProceed} style={{ padding: "14px", background: canProceed ? "#C8A96E" : "#1a1a2e", color: canProceed ? "#0a0a1a" : "#3a3a5a", border: "none", borderRadius: 8, cursor: canProceed ? "pointer" : "not-allowed", fontFamily: "'DM Mono', monospace", fontSize: 14, fontWeight: 700, transition: "all 0.2s ease" }}>Calculate compensation →</button>
      </div>

      <MicroFeedback stepName="details" />
    </div>
  );
}

function ResultStep({ extractedInfo, onNext, onBack, setCompensation }) {
  const op = OPERATORS[extractedInfo?.operatør];
  const delayMap = { "30-59 min": 45, "60-119 min": 90, "120+ min": 150 };
  const delayMinutes = delayMap[extractedInfo?.forsinkelse] || 0;
  const price = parseFloat(extractedInfo?.billetpris) || 0;
  let rate = 0, eligible = false, reason = "";
  if (!op) { reason = "Operator not found"; }
  else if (delayMinutes < op.threshold) { reason = `Delay under ${op.threshold} min — not eligible`; }
  else if (delayMinutes >= 120) { rate = 1.0; eligible = true; }
  else if (delayMinutes >= 60) { rate = op.rate; eligible = true; }
  const compensation = price * rate;
  const ourFee = compensation * 0.25;
  const youGet = compensation - ourFee;
  const currency = extractedInfo?.valuta || "DKK";

  useEffect(() => {
    if (eligible) setCompensation({ compensation, ourFee, youGet, currency, op });
  }, [extractedInfo?.forsinkelse, extractedInfo?.billetpris, extractedInfo?.operatør]);

  return (
    <div>
      <h2 style={{ fontFamily: "'Playfair Display', serif", fontSize: 28, color: "#e8e0d0", marginBottom: 8, fontWeight: 400 }}>Assessment</h2>
      <div style={{ background: eligible ? "rgba(76,175,122,0.08)" : "rgba(255,107,107,0.08)", border: `1px solid ${eligible ? "rgba(76,175,122,0.3)" : "rgba(255,107,107,0.3)"}`, borderRadius: 12, padding: 24, marginBottom: 24 }}>
        <div style={{ fontSize: 32, marginBottom: 8 }}>{eligible ? "✅" : "❌"}</div>
        <div style={{ fontFamily: "'Playfair Display', serif", fontSize: 22, color: eligible ? "#4CAF7A" : "#ff6b6b", marginBottom: 4 }}>{eligible ? "You are eligible for compensation" : "Not eligible"}</div>
        {!eligible && <div style={{ color: "#6a6a8a", fontSize: 13, fontFamily: "'DM Mono', monospace" }}>{reason}</div>}
      </div>
      {eligible && (
        <>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 12, marginBottom: 24 }}>
            {[{label:"Total compensation",value:`${compensation.toFixed(0)} ${currency}`,accent:false},{label:"Our fee (25%)",value:`${ourFee.toFixed(0)} ${currency}`,accent:false},{label:"You receive",value:`${youGet.toFixed(0)} ${currency}`,accent:true}].map(({label,value,accent}) => (
              <div key={label} style={{ background: accent ? "rgba(200,169,110,0.1)" : "#111128", border: `1px solid ${accent ? "rgba(200,169,110,0.4)" : "#2d2d4e"}`, borderRadius: 10, padding: "16px 14px", textAlign: "center" }}>
                <div style={{ color: "#4a4a6a", fontSize: 10, fontFamily: "'DM Mono', monospace", letterSpacing: "0.1em", textTransform: "uppercase", marginBottom: 6 }}>{label}</div>
                <div style={{ color: accent ? "#C8A96E" : "#e8e0d0", fontSize: 18, fontFamily: "'Playfair Display', serif", fontWeight: 700 }}>{value}</div>
              </div>
            ))}
          </div>
          <div style={{ background: "#111128", border: "1px solid #2d2d4e", borderRadius: 10, padding: 16, marginBottom: 24 }}>
            <div style={{ color: "#6a6a8a", fontSize: 11, fontFamily: "'DM Mono', monospace", marginBottom: 8, letterSpacing: "0.1em", textTransform: "uppercase" }}>Complaints authority</div>
            <div style={{ color: "#e8e0d0", fontFamily: "'DM Mono', monospace", fontSize: 14 }}>{op?.authority}</div>
            <div style={{ color: "#C8A96E", fontSize: 12, marginTop: 4, fontFamily: "'DM Mono', monospace" }}>{op?.authorityUrl}</div>
          </div>
        </>
      )}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 2fr", gap: 12 }}>
        <button onClick={onBack} style={{ padding: "14px", background: "transparent", border: "1px solid #2d2d4e", borderRadius: 8, color: "#6a6a8a", cursor: "pointer", fontFamily: "'DM Mono', monospace", fontSize: 13 }}>← Back</button>
        {eligible && <button onClick={onNext} style={{ padding: "14px", background: "#C8A96E", color: "#0a0a1a", border: "none", borderRadius: 8, cursor: "pointer", fontFamily: "'DM Mono', monospace", fontSize: 14, fontWeight: 700 }}>Generate claim form →</button>}
      </div>
      <MicroFeedback stepName="assessment" />
    </div>
  );
}

// Full-size feedback box used at the end (step 4 done state)
function FeedbackBox() {
  const [rating, setRating] = useState(0);
  const [hovered, setHovered] = useState(0);
  const [comment, setComment] = useState("");
  const [submitted, setSubmitted] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const mono = "'DM Mono', monospace";
  const submit = async () => {
    if (!rating) return;
    setSubmitting(true);
    try { await fetch("/api/send-feedback", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ step: "done", rating, comment }) }); } catch(e) {}
    setSubmitted(true); setSubmitting(false);
  };
  if (submitted) return (
    <div style={{ textAlign: "center", padding: "20px", background: "rgba(76,175,122,0.07)", border: "1px solid rgba(76,175,122,0.2)", borderRadius: 12, marginTop: 24 }}>
      <div style={{ fontSize: 28, marginBottom: 8 }}>🙏</div>
      <div style={{ fontFamily: mono, fontSize: 13, color: "#4CAF7A" }}>Thank you for your feedback!</div>
    </div>
  );
  return (
    <div style={{ background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.07)", borderRadius: 12, padding: "20px", marginTop: 24 }}>
      <div style={{ fontFamily: mono, fontSize: 11, color: "#6a6a8a", letterSpacing: "0.1em", textTransform: "uppercase", marginBottom: 14 }}>How was your experience?</div>
      <div style={{ display: "flex", gap: 8, marginBottom: 14 }}>
        {[1,2,3,4,5].map(n => (
          <button key={n} onClick={() => setRating(n)} onMouseEnter={() => setHovered(n)} onMouseLeave={() => setHovered(0)}
            style={{ fontSize: 24, background: "none", border: "none", cursor: "pointer", transform: (hovered||rating) >= n ? "scale(1.2)" : "scale(1)", transition: "transform 0.15s", filter: (hovered||rating) >= n ? "none" : "grayscale(1) opacity(0.4)" }}>⭐</button>
        ))}
      </div>
      <textarea value={comment} onChange={e => setComment(e.target.value)} placeholder="Optional comment..." rows={3}
        style={{ width: "100%", padding: "10px 12px", background: "#111128", border: "1px solid #2d2d4e", borderRadius: 8, color: "#e8e0d0", fontFamily: mono, fontSize: 12, outline: "none", resize: "vertical", boxSizing: "border-box" }} />
      <button onClick={submit} disabled={!rating || submitting}
        style={{ marginTop: 10, padding: "10px 20px", background: rating ? "#C8A96E" : "#1a1a2e", color: rating ? "#0a0a1a" : "#3a3a5a", border: "none", borderRadius: 8, cursor: rating ? "pointer" : "not-allowed", fontFamily: mono, fontSize: 12, fontWeight: 700 }}>
        {submitting ? "Sending..." : "Submit feedback"}
      </button>
    </div>
  );
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
  const Lbl = ({children}) => <label style={{ display:"block", color:"#6a6a8a", fontSize:10, fontFamily:mono, marginBottom:5, letterSpacing:"0.1em", textTransform:"uppercase" }}>{children}</label>;

  const doGenerate = async () => {
    setLoading(true); setError("");
    try {
      const payload = {
        info: { fra: extractedInfo.fra, til: extractedInfo.til, dato: extractedInfo.dato, tidspunkt: extractedInfo.tidspunkt, forsinkelse: extractedInfo.forsinkelse, operatoer: extractedInfo.operatør || "", billetpris: extractedInfo.billetpris, valuta: extractedInfo.valuta || "DKK" },
        comp: { compensation: compensation.compensation, authority: compensation.op.authority, authorityUrl: compensation.op.authorityUrl },
        person: { navn: name, email, adresse: address, iban, dato_signed: new Date().toLocaleDateString("en-GB") }
      };
      const res = await fetch("/api/generate-pdfs", { method:"POST", headers:{"Content-Type":"application/json"}, body: JSON.stringify(payload) });
      if (!res.ok) throw new Error("Server error: " + res.status);
      const data = await res.json();
      const dl = (b64, filename) => {
        const byteStr = atob(b64);
        const arr = new Uint8Array(byteStr.length);
        for (let i = 0; i < byteStr.length; i++) arr[i] = byteStr.charCodeAt(i);
        const blob = new Blob([arr], { type: "application/pdf" });
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a"); a.href = url; a.download = filename; a.click();
        setTimeout(() => URL.revokeObjectURL(url), 2000);
      };
      dl(data.eu, "EU-claim-form-2024-949.pdf");
      setTimeout(() => dl(data.fuldmagt, "Power-of-Attorney-EU-Rail-Refund.pdf"), 800);
      fetch("/api/send-submission", { method: "POST", headers: {"Content-Type":"application/json"}, body: JSON.stringify({ person: { name, email, address, iban }, info: payload.info, comp: payload.comp, euPdf: data.eu, fuldmagtPdf: data.fuldmagt }) }).catch(() => {});
      setSubStep("done");
    } catch(e) { setError("Error: " + e.message); } finally { setLoading(false); }
  };

  if (subStep === "details") return (
    <div>
      <h2 style={{ fontFamily:"'Playfair Display', serif", fontSize:26, color:"#e8e0d0", marginBottom:6, fontWeight:400 }}>Your information</h2>
      <p style={{ color:"#6a6a8a", fontSize:13, marginBottom:22, fontFamily:mono }}>Used to fill in the official EU form (2024/949)</p>
      <div style={{ display:"grid", gap:14 }}>
        <div><Lbl>Full name *</Lbl><input value={name} onChange={e=>setName(e.target.value)} placeholder="John Smith" style={inp} /></div>
        <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:12 }}>
          <div><Lbl>Email *</Lbl><input value={email} onChange={e=>setEmail(e.target.value)} placeholder="your@email.com" type="email" style={inp} /></div>
          <div><Lbl>IBAN (for payout)</Lbl><input value={iban} onChange={e=>setIban(e.target.value)} placeholder="DK50 0040..." style={inp} /></div>
        </div>
        <div><Lbl>Address *</Lbl><input value={address} onChange={e=>setAddress(e.target.value)} placeholder="123 Main Street, Copenhagen" style={inp} /></div>
        <div style={{ background:"rgba(200,169,110,0.07)", border:"1px solid rgba(200,169,110,0.2)", borderRadius:10, padding:"14px 16px" }}>
          <div style={{ fontFamily:mono, fontSize:11, color:"#C8A96E", marginBottom:10, letterSpacing:"0.08em" }}>WE GENERATE 2 DOCUMENTS</div>
          <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:10 }}>
            <div style={{ background:"#111128", borderRadius:8, padding:"10px 12px" }}><div style={{ fontSize:20, marginBottom:4 }}>📄</div><div style={{ fontFamily:mono, fontSize:11, color:"#e8e0d0", fontWeight:700 }}>EU Form 2024/949</div><div style={{ fontFamily:mono, fontSize:10, color:"#6a6a8a", marginTop:3 }}>Legally binding claim — sent directly to operator</div></div>
            <div style={{ background:"#111128", borderRadius:8, padding:"10px 12px" }}><div style={{ fontSize:20, marginBottom:4 }}>✍️</div><div style={{ fontFamily:mono, fontSize:11, color:"#e8e0d0", fontWeight:700 }}>Power of Attorney</div><div style={{ fontFamily:mono, fontSize:10, color:"#6a6a8a", marginTop:3 }}>Authorises EU Rail Refund to act for you</div></div>
          </div>
        </div>
        <div onClick={() => setAgreed(a=>!a)} style={{ display:"flex", gap:10, cursor:"pointer", alignItems:"flex-start", padding:"12px", background: agreed ? "rgba(76,175,122,0.07)" : "#111128", border:`1px solid ${agreed ? "rgba(76,175,122,0.4)" : "#2d2d4e"}`, borderRadius:8, transition:"all 0.2s" }}>
          <div style={{ width:16, height:16, border:`2px solid ${agreed ? "#4CAF7A" : "#4a4a6a"}`, borderRadius:3, background: agreed ? "#4CAF7A" : "transparent", flexShrink:0, marginTop:1, display:"flex", alignItems:"center", justifyContent:"center" }}>{agreed && <span style={{ color:"white", fontSize:10, fontWeight:700 }}>✓</span>}</div>
          <span style={{ fontFamily:mono, fontSize:11, color:"#8a8aaa", lineHeight:1.6 }}>I authorise EU Rail Refund ApS to file the claim on my behalf and accept a 25% fee. No payment if the claim is rejected.</span>
        </div>
      </div>
      <div style={{ display:"grid", gridTemplateColumns:"1fr 2fr", gap:12, marginTop:20 }}>
        <button onClick={onBack} style={{ padding:"13px", background:"transparent", border:"1px solid #2d2d4e", borderRadius:8, color:"#6a6a8a", cursor:"pointer", fontFamily:mono, fontSize:13 }}>← Back</button>
        <button onClick={() => setSubStep("sign")} disabled={!canGo} style={{ padding:"13px", background: canGo ? "#C8A96E" : "#1a1a2e", color: canGo ? "#0a0a1a" : "#3a3a5a", border:"none", borderRadius:8, cursor: canGo ? "pointer" : "not-allowed", fontFamily:mono, fontSize:13, fontWeight:700, transition:"all 0.2s" }}>Continue to signature →</button>
      </div>
      <MicroFeedback stepName="form-details" />
    </div>
  );

  if (subStep === "sign") return (
    <div>
      <h2 style={{ fontFamily:"'Playfair Display', serif", fontSize:26, color:"#e8e0d0", marginBottom:6, fontWeight:400 }}>Digital signature</h2>
      <p style={{ color:"#6a6a8a", fontSize:13, marginBottom:20, fontFamily:mono }}>Type your name to sign both documents</p>
      <div style={{ background:"#0d0d20", border:"1px solid #2d2d4e", borderRadius:10, padding:18, marginBottom:20 }}>
        <div style={{ fontFamily:mono, fontSize:10, color:"#6a6a8a", marginBottom:12, letterSpacing:"0.1em" }}>YOU ARE SIGNING</div>
        {[["📄 EU Claim Form (2024/949)", "Compensation: " + compensation.compensation.toFixed(0) + " " + extractedInfo.valuta],
          ["✍️ Power of Attorney — EU Rail Refund ApS", extractedInfo.fra + " → " + extractedInfo.til + " · " + extractedInfo.dato]
        ].map(([title, sub]) => (
          <div key={title} style={{ display:"flex", justifyContent:"space-between", alignItems:"center", padding:"8px 0", borderBottom:"1px solid #1a1a2e" }}>
            <div><div style={{ fontFamily:mono, fontSize:12, color:"#e8e0d0" }}>{title}</div><div style={{ fontFamily:mono, fontSize:10, color:"#6a6a8a", marginTop:2 }}>{sub}</div></div>
            <div style={{ color: signed ? "#4CAF7A" : "#4a4a6a", fontSize:20 }}>{signed ? "✓" : "○"}</div>
          </div>
        ))}
      </div>
      <div style={{ marginBottom:20 }}>
        <Lbl>Type your full name as signature *</Lbl>
        <input value={signInput} onChange={e=>setSignInput(e.target.value)} placeholder="Type your full name..."
          style={{ ...inp, fontSize:16, fontFamily:"'Playfair Display', serif", borderColor: signed ? "rgba(76,175,122,0.5)" : "#2d2d4e", background: signed ? "rgba(76,175,122,0.05)" : "#111128" }} />
        <div style={{ fontFamily:mono, fontSize:10, color:"#4a4a6a", marginTop:6 }}>Your typed name serves as a digital signature on both documents.</div>
      </div>
      {error && <div style={{ color:"#ff6b6b", fontFamily:mono, fontSize:12, marginBottom:12 }}>{error}</div>}
      <div style={{ display:"grid", gridTemplateColumns:"1fr 2fr", gap:12 }}>
        <button onClick={() => setSubStep("details")} style={{ padding:"13px", background:"transparent", border:"1px solid #2d2d4e", borderRadius:8, color:"#6a6a8a", cursor:"pointer", fontFamily:mono, fontSize:13 }}>← Back</button>
        <button onClick={doGenerate} disabled={!signed||loading} style={{ padding:"13px", background: signed&&!loading ? "#C8A96E" : "#1a1a2e", color: signed&&!loading ? "#0a0a1a" : "#3a3a5a", border:"none", borderRadius:8, cursor: signed ? "pointer" : "not-allowed", fontFamily:mono, fontSize:13, fontWeight:700 }}>
          {loading ? "⟳ Generating PDFs..." : "✍️ Sign and download PDF →"}
        </button>
      </div>
      <MicroFeedback stepName="form-sign" />
    </div>
  );

  return (
    <div style={{ textAlign:"center", padding:"10px 0" }}>
      <div style={{ fontSize:52, marginBottom:16 }}>🎉</div>
      <h2 style={{ fontFamily:"'Playfair Display', serif", fontSize:26, color:"#e8e0d0", marginBottom:10, fontWeight:400 }}>Documents downloaded!</h2>
      <p style={{ fontFamily:mono, fontSize:13, color:"#6a6a8a", marginBottom:20, lineHeight:1.8 }}>
        2 PDF files have been downloaded. Send both to <strong style={{ color:"#C8A96E" }}>{compensation.op.authority}</strong>.
      </p>
      <div style={{ display:"grid", gap:10, textAlign:"left", background:"#111128", borderRadius:10, padding:18, marginBottom:20 }}>
        {[["📄 EU-claim-form-2024-949.pdf","EU Reg. 2024/949 claim form — submitted to the operator for compensation"],
          ["✍️ Power-of-Attorney-EU-Rail-Refund.pdf","Power of attorney — attach to the complaint"]
        ].map(([file,desc]) => (
          <div key={file}><div style={{ fontFamily:mono, fontSize:12, color:"#e8e0d0" }}>{file}</div><div style={{ fontFamily:mono, fontSize:10, color:"#6a6a8a", marginTop:2 }}>{desc}</div></div>
        ))}
      </div>
      <div style={{ background:"rgba(200,169,110,0.07)", border:"1px solid rgba(200,169,110,0.2)", borderRadius:10, padding:"14px 16px", textAlign:"left", marginBottom: 0 }}>
        <div style={{ fontFamily:mono, fontSize:11, color:"#C8A96E", marginBottom:10 }}>NEXT STEPS</div>
        <div style={{ fontFamily:mono, fontSize:12, color:"#8a8aaa", lineHeight:2 }}>
          1. We email EU form 2024/949 + PoA to {extractedInfo.operatør}<br/>
          2. Operator must reply within 1 month (EU Reg. 2021/782, Art. 29)<br/>
          3. If rejected or no reply → we escalate to {compensation.op.authority}<br/>
          4. We handle all follow-up on your behalf
        </div>
      </div>
      <FeedbackBox />
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
    <div style={{ minHeight:"100vh", background:"#0a0a1a", backgroundImage:"radial-gradient(ellipse at 20% 20%, rgba(200,169,110,0.06) 0%, transparent 60%), radial-gradient(ellipse at 80% 80%, rgba(76,100,175,0.08) 0%, transparent 60%)", display:"flex", alignItems:"center", justifyContent:"center", padding:"24px 16px", fontFamily:"system-ui", position:"relative", overflow:"hidden" }}>
      <div style={{ position:"fixed", inset:0, opacity:0.04, pointerEvents:"none" }}>
        {[...Array(8)].map((_,i) => <div key={i} style={{ position:"absolute", left:`${i*14}%`, top:0, bottom:0, width:1, background:"#C8A96E", transform:`rotate(${i%2===0?5:-5}deg)` }} />)}
      </div>
      <div style={{ width:"100%", maxWidth:520, position:"relative" }}>
        <div style={{ marginBottom:32, textAlign:"center" }}>
          <div style={{ display:"inline-flex", alignItems:"center", gap:10, background:"rgba(200,169,110,0.08)", border:"1px solid rgba(200,169,110,0.2)", borderRadius:100, padding:"6px 16px", marginBottom:20 }}>
            <span style={{ fontSize:16 }}>🚆</span>
            <span style={{ fontFamily:"'DM Mono', monospace", fontSize:11, color:"#C8A96E", letterSpacing:"0.15em", textTransform:"uppercase" }}>EU Rail Refund</span>
          </div>
          <h1 style={{ fontFamily:"'Playfair Display', serif", fontSize:36, color:"#e8e0d0", margin:0, fontWeight:400, lineHeight:1.2 }}>
            Get your money<br /><em style={{ color:"#C8A96E" }}>back</em>
          </h1>
          <p style={{ color:"#4a4a6a", fontFamily:"'DM Mono', monospace", fontSize:12, marginTop:10, letterSpacing:"0.05em" }}>POWERED BY EU REGULATION 1371/2007</p>
        </div>
        <div style={{ background:"rgba(255,255,255,0.03)", border:"1px solid rgba(255,255,255,0.07)", borderRadius:16, padding:"32px", backdropFilter:"blur(20px)", boxShadow:"0 32px 80px rgba(0,0,0,0.4)" }}>
          <ProgressBar step={step} />
          {step==="upload" && <UploadStep onNext={()=>goTo("details")} setTicketData={setTicketData} setExtractedInfo={setExtractedInfo} />}
          {step==="details" && <DetailsStep extractedInfo={extractedInfo} setExtractedInfo={setExtractedInfo} onNext={()=>goTo("result")} onBack={()=>goTo("upload")} />}
          {step==="result" && <ResultStep extractedInfo={extractedInfo} onNext={()=>goTo("form")} onBack={()=>goTo("details")} setCompensation={setCompensation} />}
          {step==="form" && <FormStep extractedInfo={extractedInfo} compensation={compensation} onBack={()=>goTo("result")} />}
        </div>
        <p style={{ textAlign:"center", color:"#2a2a3a", fontSize:11, fontFamily:"'DM Mono', monospace", marginTop:20 }}>We take 25% of the compensation — nothing to pay if we don't win</p>
      </div>
      <Head>
        <title>EU Rail Refund — Get your money back</title>
        <meta name="description" content="Claim train compensation automatically under EU Regulation 2021/782" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <link rel="icon" href="/favicon.ico" />
      </Head>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Playfair+Display:ital,wght@0,400;0,700;1,400&family=DM+Mono:wght@400;500;700&display=swap');
        * { box-sizing: border-box; }
        input, select, textarea { transition: border-color 0.2s ease; }
        input:focus, select:focus, textarea:focus { border-color: #C8A96E !important; }
        ::-webkit-scrollbar { width: 4px; }
        ::-webkit-scrollbar-track { background: #111128; }
        ::-webkit-scrollbar-thumb { background: #2d2d4e; border-radius: 2px; }
        option { background: #111128; }
      `}</style>
    </div>
  );
}
