import Head from "next/head";
import { useState, useEffect } from "react";

const mono = "'DM Mono', monospace";
const serif = "'Playfair Display', serif";

function StatusBadge({ status }) {
  const colors = {
    received: { bg: "#EEF6FF", border: "#93C5FD", text: "#1D4ED8" },
    filed: { bg: "#F0FDF4", border: "#86EFAC", text: "#15803D" },
    approved: { bg: "#FFFBEB", border: "#FCD34D", text: "#92400E" },
    rejected: { bg: "#FFF1F2", border: "#FDA4AF", text: "#BE123C" },
  };
  const c = colors[status] || colors.received;
  return (
    <span style={{ fontFamily: mono, fontSize: 10, letterSpacing: "0.1em", padding: "3px 8px", borderRadius: 4, background: c.bg, border: `1px solid ${c.border}`, color: c.text }}>
      {(status || "received").toUpperCase()}
    </span>
  );
}

export default function Admin() {
  const [password, setPassword] = useState("");
  const [authed, setAuthed] = useState(false);
  const [claims, setClaims] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [selected, setSelected] = useState(null);
  const [search, setSearch] = useState("");

  const fetchClaims = async (pw) => {
    setLoading(true); setError("");
    try {
      const res = await fetch("/api/claims-log", {
        headers: { Authorization: `Bearer ${pw || password}` },
      });
      if (res.status === 401) { setError("Wrong password"); return; }
      const data = await res.json();
      setClaims(data.claims || []);
      setAuthed(true);
    } catch {
      setError("Failed to load claims");
    } finally {
      setLoading(false);
    }
  };

  const filtered = claims.filter(c =>
    !search || [c.name, c.email, c.fra, c.til, c.operatør, c.ref].some(v =>
      v?.toLowerCase().includes(search.toLowerCase())
    )
  );

  const totalComp = claims.reduce((s, c) => s + (Number(c.compensation) || 0), 0);
  const totalFee = claims.reduce((s, c) => s + (Number(c.ourFee) || 0), 0);

  if (!authed) return (
    <div style={{ minHeight: "100vh", background: "#FAFAF8", display: "flex", alignItems: "center", justifyContent: "center", padding: 16 }}>
      <Head>
        <title>Admin — EU Rail Refund</title>
        <style>{`@import url('https://fonts.googleapis.com/css2?family=Playfair+Display:ital,wght@0,400;0,700;1,400&family=DM+Mono:wght@400;500;700&display=swap');`}</style>
      </Head>
      <div style={{ width: "100%", maxWidth: 360, background: "#FFFFFF", border: "1px solid #E8E4DC", borderRadius: 16, padding: 32 }}>
        <div style={{ textAlign: "center", marginBottom: 24 }}>
          <div style={{ fontSize: 28, marginBottom: 8 }}>🚆</div>
          <h1 style={{ fontFamily: serif, fontSize: 22, color: "#1C1C28", fontWeight: 400, margin: 0 }}>Admin</h1>
          <p style={{ fontFamily: mono, fontSize: 11, color: "#9090A0", marginTop: 4 }}>EU Rail Refund claims dashboard</p>
        </div>
        <div style={{ marginBottom: 16 }}>
          <label style={{ display: "block", fontFamily: mono, fontSize: 10, color: "#4A4A5A", letterSpacing: "0.12em", textTransform: "uppercase", marginBottom: 6 }}>Password</label>
          <input
            type="password"
            value={password}
            onChange={e => setPassword(e.target.value)}
            onKeyDown={e => e.key === "Enter" && fetchClaims(password)}
            placeholder="••••••••"
            style={{ width: "100%", padding: "11px 13px", background: "#FAFAF8", border: "1px solid #E0DCD4", borderRadius: 8, fontFamily: mono, fontSize: 13, color: "#1C1C28", outline: "none", boxSizing: "border-box" }}
          />
        </div>
        {error && <p style={{ fontFamily: mono, fontSize: 11, color: "#CC3333", marginBottom: 12 }}>{error}</p>}
        <button
          onClick={() => fetchClaims(password)}
          disabled={loading}
          style={{ width: "100%", padding: "13px", background: "#C8A96E", color: "#FAFAF8", border: "none", borderRadius: 8, fontFamily: mono, fontSize: 13, fontWeight: 700, cursor: "pointer" }}
        >
          {loading ? "Loading..." : "Sign in →"}
        </button>
      </div>
    </div>
  );

  return (
    <div style={{ minHeight: "100vh", background: "#FAFAF8", padding: "24px 16px" }}>
      <Head>
        <title>Admin — EU Rail Refund</title>
        <style>{`@import url('https://fonts.googleapis.com/css2?family=Playfair+Display:ital,wght@0,400;0,700;1,400&family=DM+Mono:wght@400;500;700&display=swap');`}</style>
      </Head>

      <div style={{ maxWidth: 1100, margin: "0 auto" }}>
        {/* Header */}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 28, flexWrap: "wrap", gap: 12 }}>
          <div>
            <div style={{ display: "inline-flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
              <span style={{ fontSize: 18 }}>🚆</span>
              <span style={{ fontFamily: mono, fontSize: 11, color: "#C8A96E", letterSpacing: "0.15em" }}>EU RAIL REFUND</span>
            </div>
            <h1 style={{ fontFamily: serif, fontSize: 28, color: "#1C1C28", fontWeight: 400, margin: 0 }}>Claims Dashboard</h1>
          </div>
          <button onClick={() => fetchClaims(password)} style={{ fontFamily: mono, fontSize: 11, color: "#C8A96E", background: "none", border: "1px solid rgba(200,169,110,0.3)", borderRadius: 6, padding: "7px 14px", cursor: "pointer" }}>
            ↻ Refresh
          </button>
        </div>

        {/* Stats */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))", gap: 16, marginBottom: 28 }}>
          {[
            { label: "Total Claims", value: claims.length, unit: "" },
            { label: "Total Compensation", value: totalComp.toFixed(0), unit: " DKK" },
            { label: "Our Revenue (25%)", value: totalFee.toFixed(0), unit: " DKK" },
            { label: "Avg Claim Value", value: claims.length ? (totalComp / claims.length).toFixed(0) : "—", unit: claims.length ? " DKK" : "" },
          ].map(({ label, value, unit }) => (
            <div key={label} style={{ background: "#FFFFFF", border: "1px solid #E8E4DC", borderRadius: 12, padding: "18px 20px" }}>
              <div style={{ fontFamily: mono, fontSize: 10, color: "#9090A0", letterSpacing: "0.12em", textTransform: "uppercase", marginBottom: 6 }}>{label}</div>
              <div style={{ fontFamily: serif, fontSize: 26, color: "#1C1C28", fontWeight: 700 }}>{value}<span style={{ fontSize: 13, color: "#9090A0" }}>{unit}</span></div>
            </div>
          ))}
        </div>

        {/* Search */}
        <div style={{ marginBottom: 16 }}>
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search by name, email, route, operator..."
            style={{ width: "100%", padding: "11px 14px", background: "#FFFFFF", border: "1px solid #E0DCD4", borderRadius: 8, fontFamily: mono, fontSize: 13, color: "#1C1C28", outline: "none", boxSizing: "border-box" }}
          />
        </div>

        {/* Claims table */}
        {filtered.length === 0 ? (
          <div style={{ background: "#FFFFFF", border: "1px solid #E8E4DC", borderRadius: 12, padding: "48px 24px", textAlign: "center" }}>
            <div style={{ fontSize: 32, marginBottom: 12 }}>📭</div>
            <p style={{ fontFamily: mono, fontSize: 13, color: "#9090A0" }}>{search ? "No claims match your search" : "No claims yet — they will appear here after submission"}</p>
          </div>
        ) : (
          <div style={{ background: "#FFFFFF", border: "1px solid #E8E4DC", borderRadius: 12, overflow: "hidden" }}>
            <div style={{ overflowX: "auto" }}>
              <table style={{ width: "100%", borderCollapse: "collapse", fontFamily: mono, fontSize: 12 }}>
                <thead>
                  <tr style={{ background: "#F7F6F3", borderBottom: "1px solid #E8E4DC" }}>
                    {["Reference", "Date", "Claimant", "Route", "Operator", "Delay", "Compensation", "You Receive", "Status"].map(h => (
                      <th key={h} style={{ padding: "10px 14px", textAlign: "left", color: "#9090A0", fontSize: 10, letterSpacing: "0.1em", textTransform: "uppercase", fontWeight: 600, whiteSpace: "nowrap" }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((c, i) => (
                    <tr
                      key={c.ref || i}
                      onClick={() => setSelected(selected?.ref === c.ref ? null : c)}
                      style={{ borderBottom: "1px solid #F0EDE8", cursor: "pointer", background: selected?.ref === c.ref ? "#FFFBF0" : "transparent", transition: "background 0.15s" }}
                    >
                      <td style={{ padding: "12px 14px", color: "#C8A96E", fontWeight: 700, whiteSpace: "nowrap" }}>{c.ref || "—"}</td>
                      <td style={{ padding: "12px 14px", color: "#4A4A5A", whiteSpace: "nowrap" }}>{c.dato || c.timestamp?.slice(0, 10) || "—"}</td>
                      <td style={{ padding: "12px 14px" }}>
                        <div style={{ color: "#1C1C28", fontWeight: 600 }}>{c.name || "—"}</div>
                        <div style={{ color: "#9090A0", fontSize: 11 }}>{c.email || ""}</div>
                      </td>
                      <td style={{ padding: "12px 14px", color: "#4A4A5A", whiteSpace: "nowrap" }}>{c.fra && c.til ? `${c.fra} → ${c.til}` : "—"}</td>
                      <td style={{ padding: "12px 14px", color: "#4A4A5A", whiteSpace: "nowrap" }}>{c.operatør || "—"}</td>
                      <td style={{ padding: "12px 14px", color: "#4A4A5A", whiteSpace: "nowrap" }}>{c.forsinkelse || "—"}</td>
                      <td style={{ padding: "12px 14px", color: "#1C1C28", fontWeight: 600, whiteSpace: "nowrap" }}>{c.compensation ? `${Number(c.compensation).toFixed(0)} ${c.valuta || "DKK"}` : "—"}</td>
                      <td style={{ padding: "12px 14px", color: "#2D8653", fontWeight: 600, whiteSpace: "nowrap" }}>{c.youGet ? `${Number(c.youGet).toFixed(0)} ${c.valuta || "DKK"}` : "—"}</td>
                      <td style={{ padding: "12px 14px" }}><StatusBadge status={c.status} /></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Detail panel */}
        {selected && (
          <div style={{ marginTop: 20, background: "#FFFFFF", border: "1px solid #E8E4DC", borderRadius: 12, padding: 24 }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 20 }}>
              <div>
                <div style={{ fontFamily: mono, fontSize: 10, color: "#9090A0", letterSpacing: "0.12em", marginBottom: 4 }}>CLAIM DETAIL</div>
                <div style={{ fontFamily: serif, fontSize: 20, color: "#1C1C28" }}>{selected.ref}</div>
              </div>
              <button onClick={() => setSelected(null)} style={{ fontFamily: mono, fontSize: 11, color: "#9090A0", background: "none", border: "1px solid #E0DCD4", borderRadius: 6, padding: "6px 12px", cursor: "pointer" }}>✕ Close</button>
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: 16 }}>
              {[
                ["Submitted", selected.timestamp?.slice(0, 19).replace("T", " ") || "—"],
                ["Name", selected.name || "—"],
                ["Email", selected.email || "—"],
                ["Address", selected.address || "—"],
                ["IBAN", selected.iban || "—"],
                ["Route", selected.fra && selected.til ? `${selected.fra} → ${selected.til}` : "—"],
                ["Travel date", selected.dato || "—"],
                ["Departure time", selected.tidspunkt || "—"],
                ["Operator", selected.operatør || "—"],
                ["Delay", selected.forsinkelse || "—"],
                ["Ticket price", `${selected.billetpris || "—"} ${selected.valuta || "DKK"}`],
                ["Compensation", `${Number(selected.compensation || 0).toFixed(2)} ${selected.valuta || "DKK"}`],
                ["Our fee (25%)", `${Number(selected.ourFee || 0).toFixed(2)} ${selected.valuta || "DKK"}`],
                ["To claimant (75%)", `${Number(selected.youGet || 0).toFixed(2)} ${selected.valuta || "DKK"}`],
              ].map(([label, value]) => (
                <div key={label} style={{ padding: "10px 0", borderBottom: "1px solid #F0EDE8" }}>
                  <div style={{ fontFamily: mono, fontSize: 10, color: "#9090A0", letterSpacing: "0.1em", textTransform: "uppercase", marginBottom: 3 }}>{label}</div>
                  <div style={{ fontFamily: mono, fontSize: 12, color: "#1C1C28", wordBreak: "break-all" }}>{value}</div>
                </div>
              ))}
            </div>
            <div style={{ marginTop: 20, display: "flex", gap: 10, flexWrap: "wrap" }}>
              <a href={`mailto:${selected.email}?subject=Your claim ${selected.ref} — EU Rail Refund`}
                style={{ fontFamily: mono, fontSize: 11, color: "#C8A96E", border: "1px solid rgba(200,169,110,0.3)", borderRadius: 6, padding: "8px 14px", textDecoration: "none" }}>
                ✉ Email claimant
              </a>
              <a href={`mailto:support@${selected.operatør?.toLowerCase().includes("dsb") ? "dsb.dk" : "operator.eu"}?subject=Compensation claim ref ${selected.ref}`}
                style={{ fontFamily: mono, fontSize: 11, color: "#4A4A5A", border: "1px solid #E0DCD4", borderRadius: 6, padding: "8px 14px", textDecoration: "none" }}>
                ✉ Contact operator
              </a>
            </div>
          </div>
        )}

        <p style={{ fontFamily: mono, fontSize: 10, color: "#B0ADA8", marginTop: 24, textAlign: "center" }}>
          EU Rail Refund Admin · Claims refresh on page load · <a href="/" style={{ color: "#C8A96E", textDecoration: "none" }}>← Back to site</a>
        </p>
      </div>
    </div>
  );
}
