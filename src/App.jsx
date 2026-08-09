import React, { useState, useEffect, useMemo, useRef } from "react";
import "./storage.js";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, LineChart, Line, Legend,
} from "recharts";
import { AlertTriangle, Search, Filter, TrendingUp, Plus, X, Image as ImageIcon, Calendar, LogIn, ChevronDown, FileWarning, Trash2, ShieldCheck, ShieldOff } from "lucide-react";
import crestImg from "./assets/crest.jpeg";

const PLUGOT = ["א", "ב", "ג", "פלס\"ם"];
const CAUSES = [
  "אי קריאת שטח", "מכוון לקוי", "אי ביצוע מכוון", "עייפות",
  "אי שמירת מרחק", "חוסר מקצועיות", "רשלנות", "גורם חיצוני", "לא ידוע",
];

const ACCENT = "#E0A32E";
const DANGER = "#C4463A";
const BG = "#14161B";
const SURFACE = "#1D2027";
const SURFACE2 = "#252932";
const BORDER = "#323744";
const TEXT = "#E7E9EE";
const MUTED = "#8A90A0";

const CAUSE_COLORS = ["#E0A32E", "#C4463A", "#4A90A4", "#7B8FA1", "#A3673D", "#5C7A5C", "#8A6B9E", "#B0555A", "#5A6472"];

function uid() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
}

// The manager password is stored on this device once entered correctly,
// and sent to the server with delete requests. The server is the real
// gatekeeper — it rejects any deletion whose password does not match.
const ADMIN_TOKEN_LS_KEY = "accident-tracker:admin-token";
function getAdminToken() {
  try { return localStorage.getItem(ADMIN_TOKEN_LS_KEY) || null; } catch (e) { return null; }
}
function setStoredAdminToken(t) {
  try { if (t) localStorage.setItem(ADMIN_TOKEN_LS_KEY, t); else localStorage.removeItem(ADMIN_TOKEN_LS_KEY); } catch (e) {}
}
async function verifyAdminToken(token) {
  try {
    const res = await fetch("/api/admin-check", { headers: token ? { "X-Admin-Token": token } : {} });
    if (!res.ok) return false;
    const j = await res.json();
    return !!j.isAdmin;
  } catch (e) {
    return false;
  }
}

function resizeImage(file, maxW = 900, quality = 0.72) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const img = new window.Image();
      img.onload = () => {
        const scale = Math.min(1, maxW / img.width);
        const canvas = document.createElement("canvas");
        canvas.width = img.width * scale;
        canvas.height = img.height * scale;
        const ctx = canvas.getContext("2d");
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
        resolve(canvas.toDataURL("image/jpeg", quality));
      };
      img.onerror = reject;
      img.src = e.target.result;
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

function fmtDate(d) {
  if (!d) return "";
  const [y, m, day] = d.split("-");
  return `${day}.${m}.${y}`;
}

export default function App() {
  const [userName, setUserName] = useState(null);
  const [nameInput, setNameInput] = useState("");
  const [view, setView] = useState("home");
  const [accidents, setAccidents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [toast, setToast] = useState(null);
  const [isAdmin, setIsAdmin] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        const personal = await window.storage.get("user-name", false);
        if (personal?.value) setUserName(personal.value);
      } catch (e) {}

      // Re-validate a previously entered manager password against the server.
      try {
        const token = getAdminToken();
        if (token) {
          const ok = await verifyAdminToken(token);
          setIsAdmin(ok);
          if (!ok) setStoredAdminToken(null);
        }
      } catch (e) {}

      // Load every accident (one KV record each) in a single request.
      try {
        const res = await window.storage.getAll("accident:", true);
        if (res?.items?.length) {
          const list = res.items
            .map((it) => { try { return JSON.parse(it.value); } catch (e) { return null; } })
            .filter(Boolean)
            .sort((a, b) => (b.createdAt || "").localeCompare(a.createdAt || ""));
          setAccidents(list);
        }
      } catch (e) {
        // no records yet - fine
      }
      setLoading(false);
    })();
  }, []);

  const showToast = (msg) => {
    setToast(msg);
    setTimeout(() => setToast(null), 2600);
  };

  // Add a single accident as its own KV record. This never rewrites other
  // records, so two people reporting at once can't overwrite each other.
  const addAccident = async (record) => {
    setAccidents((prev) => [record, ...prev]);
    try {
      const result = await window.storage.set("accident:" + record.id, JSON.stringify(record), true);
      if (!result) setError("השמירה נכשלה, נסה שוב");
    } catch (e) {
      setError("שגיאה בשמירת הנתונים");
    }
  };

  const deleteAccident = async (id) => {
    const token = getAdminToken();
    try {
      await window.storage.delete("accident:" + id, true, token);
      setAccidents((prev) => prev.filter((a) => a.id !== id));
      showToast("הדיווח נמחק");
    } catch (e) {
      setError("אין הרשאה למחיקה — נדרש מצב מנהל");
    }
  };

  const enterAdminMode = async () => {
    const pw = window.prompt("הזן/י סיסמת מנהל למחיקת דיווחים:");
    if (pw === null) return;
    const ok = await verifyAdminToken(pw.trim());
    if (ok) {
      setStoredAdminToken(pw.trim());
      setIsAdmin(true);
      showToast("מצב מנהל הופעל");
    } else {
      setError("סיסמת מנהל שגויה");
    }
  };

  const exitAdminMode = () => {
    setStoredAdminToken(null);
    setIsAdmin(false);
    showToast("יצאת ממצב מנהל");
  };

  const handleLogin = async () => {
    const name = nameInput.trim();
    if (!name) return;
    setUserName(name);
    try {
      await window.storage.set("user-name", name, false);
    } catch (e) {}
  };

  if (loading) {
    return (
      <div style={{ minHeight: "100vh", background: BG, display: "flex", alignItems: "center", justifyContent: "center" }}>
        <div style={{ color: MUTED, fontFamily: "Heebo, sans-serif" }}>טוען נתונים...</div>
      </div>
    );
  }

  if (!userName) {
    return <LoginScreen nameInput={nameInput} setNameInput={setNameInput} onLogin={handleLogin} />;
  }

  return (
    <div style={{ minHeight: "100vh", background: BG, fontFamily: "Heebo, Assistant, sans-serif", direction: "rtl", color: TEXT }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Heebo:wght@300;400;500;600;700;800&family=Assistant:wght@400;500;600;700&display=swap');
        * { box-sizing: border-box; }
        ::selection { background: ${ACCENT}55; }
        input, select, textarea { font-family: inherit; }
        button { font-family: inherit; cursor: pointer; }
        input:focus, select:focus, textarea:focus, button:focus-visible {
          outline: 2px solid ${ACCENT}; outline-offset: 1px;
        }
      `}</style>

      <TopBar userName={userName} view={view} setView={setView} accidentCount={accidents.length} isAdmin={isAdmin} onEnterAdmin={enterAdminMode} onExitAdmin={exitAdminMode} />

      {toast && (
        <div style={{
          position: "fixed", top: 74, left: "50%", transform: "translateX(-50%)", zIndex: 50,
          background: SURFACE2, border: `1px solid ${ACCENT}`, color: TEXT, padding: "10px 20px",
          borderRadius: 8, fontSize: 14, boxShadow: "0 8px 24px rgba(0,0,0,0.4)",
        }}>
          {toast}
        </div>
      )}

      <main style={{ maxWidth: 1180, margin: "0 auto", padding: "28px 20px 60px" }}>
        {view === "home" && (
          <ReportForm
            userName={userName}
            onSubmit={async (record) => {
              await addAccident(record);
              showToast("הדיווח נשמר בהצלחה");
              setView("database");
            }}
          />
        )}
        {view === "database" && <DatabaseView accidents={accidents} isAdmin={isAdmin} onDelete={deleteAccident} />}
        {view === "analytics" && <AnalyticsView accidents={accidents} />}
      </main>

      {error && (
        <div style={{ position: "fixed", bottom: 16, left: "50%", transform: "translateX(-50%)", background: DANGER, color: "#fff", padding: "8px 16px", borderRadius: 8, fontSize: 13 }}>
          {error}
        </div>
      )}
    </div>
  );
}

function LoginScreen({ nameInput, setNameInput, onLogin }) {
  return (
    <div style={{
      minHeight: "100vh", background: BG, direction: "rtl", display: "flex",
      alignItems: "center", justifyContent: "center", fontFamily: "Heebo, sans-serif", color: TEXT, padding: 20,
    }}>
      <style>{`@import url('https://fonts.googleapis.com/css2?family=Heebo:wght@300;400;600;800&display=swap');`}</style>
      <div style={{ width: "100%", maxWidth: 380 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 6 }}>
          <div style={{ width: 44, height: 44, borderRadius: 9, background: "#F4F1EA", display: "flex", alignItems: "center", justifyContent: "center", padding: 4, flexShrink: 0 }}>
            <img src={crestImg} alt="סמל הגדוד" style={{ width: "100%", height: "100%", objectFit: "contain" }} />
          </div>
          <div style={{ fontSize: 22, fontWeight: 800, letterSpacing: -0.3 }}>מערכת דיווח תאונות</div>
        </div>
        <div style={{ color: MUTED, fontSize: 14, marginBottom: 28 }}>גדוד · יומן תאונות ותחקור</div>

        <div style={{ background: SURFACE, border: `1px solid ${BORDER}`, borderRadius: 12, padding: 24 }}>
          <label style={{ display: "block", fontSize: 13, color: MUTED, marginBottom: 8 }}>שם מלא לזיהוי דיווחים</label>
          <input
            autoFocus
            value={nameInput}
            onChange={(e) => setNameInput(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && onLogin()}
            placeholder="לדוגמה: רס״ן כהן"
            style={{
              width: "100%", background: SURFACE2, border: `1px solid ${BORDER}`, borderRadius: 8,
              padding: "11px 14px", color: TEXT, fontSize: 15, marginBottom: 16,
            }}
          />
          <button
            onClick={onLogin}
            style={{
              width: "100%", background: ACCENT, color: "#14161B", border: "none", borderRadius: 8,
              padding: "12px 0", fontSize: 15, fontWeight: 700, display: "flex", alignItems: "center",
              justifyContent: "center", gap: 8,
            }}
          >
            <LogIn size={17} /> כניסה למערכת
          </button>
        </div>
        <div style={{ color: MUTED, fontSize: 12, marginTop: 14, lineHeight: 1.6 }}>
          הנתונים נשמרים עבור כלל המשתמשים במערכת. השם משמש לזיהוי מגיש הדיווח בלבד.
        </div>
      </div>
    </div>
  );
}

function TopBar({ userName, view, setView, accidentCount, isAdmin, onEnterAdmin, onExitAdmin }) {
  const tabs = [
    { id: "home", label: "דיווח תאונה", icon: Plus },
    { id: "database", label: "מאגר תאונות", icon: Search },
    { id: "analytics", label: "ניתוח נתונים", icon: TrendingUp },
  ];
  return (
    <div style={{ position: "sticky", top: 0, zIndex: 40, background: `${BG}f2`, backdropFilter: "blur(8px)", borderBottom: `1px solid ${BORDER}` }}>
      <div style={{ maxWidth: 1180, margin: "0 auto", padding: "14px 20px", display: "flex", alignItems: "center", gap: 24, flexWrap: "wrap" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 9 }}>
          <div style={{ width: 34, height: 34, borderRadius: 7, background: "#F4F1EA", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0, padding: 3 }}>
            <img src={crestImg} alt="סמל הגדוד" style={{ width: "100%", height: "100%", objectFit: "contain" }} />
          </div>
          <div>
            <div style={{ fontWeight: 800, fontSize: 15, letterSpacing: -0.2 }}>מערכת דיווח תאונות</div>
            <div style={{ fontSize: 11.5, color: MUTED }}>{accidentCount} רשומות במאגר</div>
          </div>
        </div>

        <nav style={{ display: "flex", gap: 4, background: SURFACE, padding: 4, borderRadius: 10, border: `1px solid ${BORDER}` }}>
          {tabs.map((t) => {
            const Icon = t.icon;
            const active = view === t.id;
            return (
              <button
                key={t.id}
                onClick={() => setView(t.id)}
                style={{
                  display: "flex", alignItems: "center", gap: 6, padding: "7px 14px", borderRadius: 7,
                  border: "none", background: active ? ACCENT : "transparent", color: active ? "#14161B" : MUTED,
                  fontSize: 13.5, fontWeight: active ? 700 : 500, transition: "all .15s",
                }}
              >
                <Icon size={15} /> {t.label}
              </button>
            );
          })}
        </nav>

        <div style={{ marginRight: "auto", fontSize: 12.5, color: MUTED, display: "flex", alignItems: "center", gap: 12 }}>
          {isAdmin ? (
            <button
              onClick={onExitAdmin}
              title="יציאה ממצב מנהל"
              style={{
                display: "flex", alignItems: "center", gap: 6, padding: "6px 12px", borderRadius: 7,
                border: `1px solid ${ACCENT}`, background: `${ACCENT}1c`, color: ACCENT, fontSize: 12.5, fontWeight: 700,
              }}
            >
              <ShieldCheck size={14} /> מצב מנהל
            </button>
          ) : (
            <button
              onClick={onEnterAdmin}
              title="כניסה למצב מנהל (למחיקת דיווחים)"
              style={{
                display: "flex", alignItems: "center", gap: 6, padding: "6px 12px", borderRadius: 7,
                border: `1px solid ${BORDER}`, background: SURFACE2, color: MUTED, fontSize: 12.5, fontWeight: 600,
              }}
            >
              <ShieldOff size={14} /> מצב מנהל
            </button>
          )}
          <span style={{ display: "flex", alignItems: "center", gap: 6 }}>
            מחובר/ת: <span style={{ color: TEXT, fontWeight: 600 }}>{userName}</span>
          </span>
        </div>
      </div>
    </div>
  );
}

function ReportForm({ userName, onSubmit }) {
  const today = new Date().toISOString().slice(0, 10);
  const [title, setTitle] = useState("");
  const [date, setDate] = useState(today);
  const [pluga, setPluga] = useState("");
  const [causes, setCauses] = useState([]);
  const [hasDamage, setHasDamage] = useState(null);
  const [damage, setDamage] = useState("");
  const [hasCasualties, setHasCasualties] = useState(null);
  const [casualties, setCasualties] = useState("");
  const [image, setImage] = useState(null);
  const [imageProcessing, setImageProcessing] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [touched, setTouched] = useState(false);
  const fileRef = useRef(null);

  const toggleCause = (c) => {
    setCauses((prev) => (prev.includes(c) ? prev.filter((x) => x !== c) : [...prev, c]));
  };

  const handleImage = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setImageProcessing(true);
    try {
      const dataUrl = await resizeImage(file);
      setImage(dataUrl);
    } catch (e) {
      // ignore
    }
    setImageProcessing(false);
  };

  const valid = title.trim() && date && pluga && causes.length > 0 && hasDamage !== null && hasCasualties !== null;

  const handleSubmit = async () => {
    setTouched(true);
    if (!valid) return;
    setSubmitting(true);
    const record = {
      id: uid(),
      title: title.trim(), date, pluga, causes,
      hasDamage, damage: hasDamage ? damage.trim() : "",
      hasCasualties, casualties: hasCasualties ? casualties.trim() : "",
      image, reporter: userName, createdAt: new Date().toISOString(),
    };
    await onSubmit(record);
    setTitle(""); setDate(today); setPluga(""); setCauses([]);
    setHasDamage(null); setDamage(""); setHasCasualties(null); setCasualties("");
    setImage(null); setTouched(false);
    setSubmitting(false);
  };

  return (
    <div>
      <PageHeader icon={FileWarning} title="דיווח תאונה חדשה" subtitle="מלא/י את פרטי האירוע. שדות עם * הם שדות חובה" />

      <div style={{ background: SURFACE, border: `1px solid ${BORDER}`, borderRadius: 14, padding: 28, display: "grid", gap: 24 }}>
        <Field label="כותרת האירוע *" error={touched && !title.trim()}>
          <input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="כותרת קצרה שתזהה את האירוע, לדוגמה: התהפכות האמר בציר"
            style={inputStyle}
          />
        </Field>

        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 20 }}>
          <Field label="תאריך התאונה *" error={touched && !date}>
            <input type="date" value={date} onChange={(e) => setDate(e.target.value)} style={inputStyle} />
          </Field>
          <Field label="פלוגה *" error={touched && !pluga}>
            <div style={{ display: "flex", gap: 8 }}>
              {PLUGOT.map((p) => (
                <button
                  key={p}
                  onClick={() => setPluga(p)}
                  style={{
                    flex: 1, padding: "10px 0", borderRadius: 8, border: `1px solid ${pluga === p ? ACCENT : BORDER}`,
                    background: pluga === p ? `${ACCENT}22` : SURFACE2, color: pluga === p ? ACCENT : TEXT,
                    fontWeight: pluga === p ? 700 : 500, fontSize: 14,
                  }}
                >
                  {p}
                </button>
              ))}
            </div>
          </Field>
        </div>

        <Field label="גורמים לתאונה * (ניתן לבחור יותר מאחד)" error={touched && causes.length === 0}>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
            {CAUSES.map((c) => {
              const on = causes.includes(c);
              return (
                <button
                  key={c}
                  onClick={() => toggleCause(c)}
                  style={{
                    padding: "8px 14px", borderRadius: 20, border: `1px solid ${on ? ACCENT : BORDER}`,
                    background: on ? `${ACCENT}22` : SURFACE2, color: on ? ACCENT : MUTED,
                    fontSize: 13, fontWeight: on ? 600 : 500,
                  }}
                >
                  {c}
                </button>
              );
            })}
          </div>
        </Field>

        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 20 }}>
          <Field label="נזק *" error={touched && hasDamage === null}>
            <YesNo value={hasDamage} onChange={setHasDamage} />
          </Field>
          <Field label="נפגעים *" error={touched && hasCasualties === null}>
            <YesNo value={hasCasualties} onChange={setHasCasualties} />
          </Field>
        </div>

        {hasDamage === true && (
          <Field label="פירוט הנזק">
            <textarea
              value={damage}
              onChange={(e) => setDamage(e.target.value)}
              placeholder="תיאור הנזק שנגרם, ציוד מעורב וכו׳"
              rows={3}
              style={{ ...inputStyle, resize: "vertical", lineHeight: 1.6 }}
            />
          </Field>
        )}

        {hasCasualties === true && (
          <Field label="פירוט נפגעים">
            <textarea
              value={casualties}
              onChange={(e) => setCasualties(e.target.value)}
              placeholder="פרטי הנפגעים, חומרת הפגיעה, טיפול שניתן וכו׳"
              rows={3}
              style={{ ...inputStyle, resize: "vertical", lineHeight: 1.6 }}
            />
          </Field>
        )}

        <Field label="תמונה מהאירוע (אופציונלי)">
          <input ref={fileRef} type="file" accept="image/*" onChange={handleImage} style={{ display: "none" }} />
          {!image ? (
            <button
              onClick={() => fileRef.current?.click()}
              style={{
                display: "flex", alignItems: "center", gap: 8, padding: "12px 18px", borderRadius: 8,
                border: `1.5px dashed ${BORDER}`, background: SURFACE2, color: MUTED, fontSize: 14, width: "fit-content",
              }}
            >
              <ImageIcon size={16} /> {imageProcessing ? "מעבד תמונה..." : "העלה תמונה"}
            </button>
          ) : (
            <div style={{ position: "relative", width: "fit-content" }}>
              <img src={image} alt="תמונה מהאירוע" style={{ maxHeight: 180, borderRadius: 8, border: `1px solid ${BORDER}` }} />
              <button
                onClick={() => setImage(null)}
                style={{
                  position: "absolute", top: -8, left: -8, width: 26, height: 26, borderRadius: "50%",
                  background: DANGER, color: "#fff", border: "none", display: "flex", alignItems: "center", justifyContent: "center",
                }}
              >
                <X size={14} />
              </button>
            </div>
          )}
        </Field>

        <div style={{ display: "flex", alignItems: "center", gap: 14, marginTop: 4 }}>
          <button
            onClick={handleSubmit}
            disabled={submitting}
            style={{
              padding: "13px 32px", borderRadius: 9, border: "none", background: ACCENT, color: "#14161B",
              fontWeight: 700, fontSize: 15, opacity: submitting ? 0.7 : 1,
            }}
          >
            {submitting ? "שומר..." : "שמירת דיווח"}
          </button>
          {touched && !valid && (
            <span style={{ color: DANGER, fontSize: 13 }}>יש למלא את כל שדות החובה</span>
          )}
        </div>
      </div>
    </div>
  );
}

function YesNo({ value, onChange }) {
  const opt = (val, label) => (
    <button
      type="button"
      onClick={() => onChange(val)}
      style={{
        flex: 1, padding: "10px 0", borderRadius: 8,
        border: `1px solid ${value === val ? ACCENT : BORDER}`,
        background: value === val ? `${ACCENT}22` : SURFACE2,
        color: value === val ? ACCENT : TEXT, fontWeight: value === val ? 700 : 500, fontSize: 14,
      }}
    >
      {label}
    </button>
  );
  return (
    <div style={{ display: "flex", gap: 8 }}>
      {opt(true, "יש")}
      {opt(false, "אין")}
    </div>
  );
}

function Field({ label, error, children }) {
  return (
    <div>
      <label style={{ display: "block", fontSize: 13, color: error ? DANGER : MUTED, marginBottom: 8, fontWeight: 500 }}>
        {label}
      </label>
      {children}
    </div>
  );
}

const inputStyle = {
  width: "100%", background: SURFACE2, border: `1px solid ${BORDER}`, borderRadius: 8,
  padding: "10px 13px", color: TEXT, fontSize: 14.5,
};

function PageHeader({ icon: Icon, title, subtitle }) {
  return (
    <div style={{ display: "flex", alignItems: "flex-start", gap: 12, marginBottom: 22 }}>
      <div style={{ width: 38, height: 38, borderRadius: 9, background: `${ACCENT}1c`, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0, marginTop: 2 }}>
        <Icon size={19} color={ACCENT} />
      </div>
      <div>
        <div style={{ fontSize: 21, fontWeight: 800, letterSpacing: -0.3 }}>{title}</div>
        <div style={{ fontSize: 13.5, color: MUTED, marginTop: 2 }}>{subtitle}</div>
      </div>
    </div>
  );
}

function DatabaseView({ accidents, isAdmin, onDelete }) {
  const [keyword, setKeyword] = useState("");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [pluga, setPluga] = useState("");
  const [causeFilter, setCauseFilter] = useState([]);
  const [showFilters, setShowFilters] = useState(false);
  const [expanded, setExpanded] = useState(null);

  const filtered = useMemo(() => {
    return accidents.filter((a) => {
      if (keyword.trim()) {
        const k = keyword.trim().toLowerCase();
        const hay = `${a.title || ""} ${a.damage || ""} ${a.casualties || ""} ${a.pluga} ${a.causes.join(" ")} ${a.reporter || ""}`.toLowerCase();
        if (!hay.includes(k)) return false;
      }
      if (dateFrom && a.date < dateFrom) return false;
      if (dateTo && a.date > dateTo) return false;
      if (pluga && a.pluga !== pluga) return false;
      if (causeFilter.length > 0 && !causeFilter.some((c) => a.causes.includes(c))) return false;
      return true;
    });
  }, [accidents, keyword, dateFrom, dateTo, pluga, causeFilter]);

  const toggleCauseFilter = (c) => setCauseFilter((prev) => (prev.includes(c) ? prev.filter((x) => x !== c) : [...prev, c]));
  const clearFilters = () => { setKeyword(""); setDateFrom(""); setDateTo(""); setPluga(""); setCauseFilter([]); };
  const activeFilterCount = [dateFrom, dateTo, pluga].filter(Boolean).length + causeFilter.length;

  return (
    <div>
      <PageHeader icon={Search} title="מאגר תאונות" subtitle={`${filtered.length} מתוך ${accidents.length} רשומות`} />

      <div style={{ background: SURFACE, border: `1px solid ${BORDER}`, borderRadius: 14, padding: 18, marginBottom: 18 }}>
        <div style={{ display: "flex", gap: 10 }}>
          <div style={{ position: "relative", flex: 1 }}>
            <Search size={16} color={MUTED} style={{ position: "absolute", right: 13, top: 13 }} />
            <input
              value={keyword}
              onChange={(e) => setKeyword(e.target.value)}
              placeholder="חיפוש חופשי בתיאור, פלוגה, גורם או מדווח..."
              style={{ ...inputStyle, paddingRight: 38 }}
            />
          </div>
          <button
            onClick={() => setShowFilters((s) => !s)}
            style={{
              display: "flex", alignItems: "center", gap: 7, padding: "0 16px", borderRadius: 8,
              border: `1px solid ${activeFilterCount ? ACCENT : BORDER}`, background: activeFilterCount ? `${ACCENT}1c` : SURFACE2,
              color: activeFilterCount ? ACCENT : TEXT, fontSize: 14, fontWeight: 600,
            }}
          >
            <Filter size={15} /> סינון {activeFilterCount > 0 ? `(${activeFilterCount})` : ""}
            <ChevronDown size={14} style={{ transform: showFilters ? "rotate(180deg)" : "none", transition: "transform .15s" }} />
          </button>
        </div>

        {showFilters && (
          <div style={{ marginTop: 16, paddingTop: 16, borderTop: `1px solid ${BORDER}`, display: "grid", gap: 16 }}>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 14 }}>
              <Field label="מתאריך">
                <input type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} style={inputStyle} />
              </Field>
              <Field label="עד תאריך">
                <input type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)} style={inputStyle} />
              </Field>
              <Field label="פלוגה">
                <select value={pluga} onChange={(e) => setPluga(e.target.value)} style={inputStyle}>
                  <option value="">הכל</option>
                  {PLUGOT.map((p) => <option key={p} value={p}>{p}</option>)}
                </select>
              </Field>
            </div>
            <Field label="גורמים">
              <div style={{ display: "flex", flexWrap: "wrap", gap: 7 }}>
                {CAUSES.map((c) => {
                  const on = causeFilter.includes(c);
                  return (
                    <button
                      key={c}
                      onClick={() => toggleCauseFilter(c)}
                      style={{
                        padding: "6px 12px", borderRadius: 18, border: `1px solid ${on ? ACCENT : BORDER}`,
                        background: on ? `${ACCENT}22` : SURFACE2, color: on ? ACCENT : MUTED, fontSize: 12.5,
                      }}
                    >
                      {c}
                    </button>
                  );
                })}
              </div>
            </Field>
            {activeFilterCount > 0 && (
              <button onClick={clearFilters} style={{ width: "fit-content", background: "none", border: "none", color: MUTED, fontSize: 13, textDecoration: "underline" }}>
                נקה סינון
              </button>
            )}
          </div>
        )}
      </div>

      {filtered.length === 0 ? (
        <EmptyState text={accidents.length === 0 ? "עדיין לא הוזנו תאונות למאגר" : "לא נמצאו תוצאות התואמות את הסינון"} />
      ) : (
        <div style={{ display: "grid", gap: 10 }}>
          {filtered.map((a) => (
            <AccidentCard key={a.id} a={a} expanded={expanded === a.id} onToggle={() => setExpanded(expanded === a.id ? null : a.id)} isAdmin={isAdmin} onDelete={onDelete} />
          ))}
        </div>
      )}
    </div>
  );
}

function AccidentCard({ a, expanded, onToggle, isAdmin, onDelete }) {
  // Backward compatible with older records that only had a free-text damage field.
  const hasDamage = a.hasDamage === true || (a.hasDamage === undefined && !!a.damage);
  const hasCasualties = a.hasCasualties === true || (a.hasCasualties === undefined && !!a.casualties);
  return (
    <div style={{ background: SURFACE, border: `1px solid ${BORDER}`, borderRadius: 12, overflow: "hidden" }}>
      <button
        onClick={onToggle}
        style={{ width: "100%", padding: "16px 18px", display: "flex", alignItems: "center", gap: 16, background: "none", border: "none", color: TEXT, textAlign: "right" }}
      >
        <div style={{
          width: 30, height: 30, borderRadius: 7, background: `${ACCENT}1c`, color: ACCENT,
          display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 700, fontSize: 13, flexShrink: 0,
        }}>
          {a.pluga}
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 15, fontWeight: 700, marginBottom: 5, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: expanded ? "normal" : "nowrap" }}>
            {a.title || "ללא כותרת"}
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
            <span style={{ display: "flex", alignItems: "center", gap: 5, color: MUTED, fontSize: 12.5 }}>
              <Calendar size={13} /> {fmtDate(a.date)}
            </span>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
              {a.causes.slice(0, expanded ? undefined : 2).map((c) => (
                <span key={c} style={{ fontSize: 11.5, padding: "3px 9px", borderRadius: 12, background: SURFACE2, color: MUTED, border: `1px solid ${BORDER}` }}>{c}</span>
              ))}
              {!expanded && a.causes.length > 2 && <span style={{ fontSize: 11.5, color: MUTED }}>+{a.causes.length - 2}</span>}
            </div>
            {hasCasualties && (
              <span style={{ fontSize: 11.5, padding: "3px 9px", borderRadius: 12, background: `${DANGER}22`, color: DANGER, border: `1px solid ${DANGER}`, fontWeight: 600 }}>
                נפגעים
              </span>
            )}
          </div>
        </div>
        {a.image && <ImageIcon size={15} color={MUTED} style={{ flexShrink: 0 }} />}
        <ChevronDown size={16} color={MUTED} style={{ transform: expanded ? "rotate(180deg)" : "none", transition: "transform .15s", flexShrink: 0 }} />
      </button>
      {expanded && (
        <div style={{ padding: "0 18px 18px", display: "grid", gap: 12 }}>
          <div style={{ display: "flex", gap: 28, flexWrap: "wrap" }}>
            <div>
              <div style={{ fontSize: 11.5, color: MUTED, marginBottom: 4 }}>נזק</div>
              <div style={{ fontSize: 14, fontWeight: 700, color: hasDamage ? ACCENT : MUTED }}>{hasDamage ? "יש" : "אין"}</div>
            </div>
            <div>
              <div style={{ fontSize: 11.5, color: MUTED, marginBottom: 4 }}>נפגעים</div>
              <div style={{ fontSize: 14, fontWeight: 700, color: hasCasualties ? DANGER : MUTED }}>{hasCasualties ? "יש" : "אין"}</div>
            </div>
          </div>
          {hasDamage && a.damage && (
            <div>
              <div style={{ fontSize: 11.5, color: MUTED, marginBottom: 4 }}>פירוט הנזק</div>
              <div style={{ fontSize: 14, lineHeight: 1.6 }}>{a.damage}</div>
            </div>
          )}
          {hasCasualties && a.casualties && (
            <div>
              <div style={{ fontSize: 11.5, color: MUTED, marginBottom: 4 }}>פירוט נפגעים</div>
              <div style={{ fontSize: 14, lineHeight: 1.6 }}>{a.casualties}</div>
            </div>
          )}
          {a.image && (
            <img src={a.image} alt="תמונה מהאירוע" style={{ maxHeight: 260, borderRadius: 8, border: `1px solid ${BORDER}` }} />
          )}
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
            <div style={{ fontSize: 12, color: MUTED }}>דווח ע״י {a.reporter || "לא ידוע"}</div>
            {isAdmin && (
              <button
                onClick={() => { if (window.confirm("למחוק את הדיווח לצמיתות? פעולה זו אינה הפיכה.")) onDelete(a.id); }}
                style={{
                  display: "flex", alignItems: "center", gap: 7, padding: "7px 14px", borderRadius: 8,
                  border: `1px solid ${DANGER}`, background: `${DANGER}1c`, color: DANGER, fontSize: 13, fontWeight: 600,
                }}
              >
                <Trash2 size={14} /> מחק דיווח
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

function EmptyState({ text }) {
  return (
    <div style={{ textAlign: "center", padding: "60px 20px", color: MUTED, background: SURFACE, border: `1px dashed ${BORDER}`, borderRadius: 14 }}>
      <AlertTriangle size={30} style={{ marginBottom: 10, opacity: 0.6 }} />
      <div style={{ fontSize: 14 }}>{text}</div>
    </div>
  );
}

function AnalyticsView({ accidents }) {
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");

  const filtered = useMemo(() => {
    return accidents.filter((a) => {
      if (dateFrom && (!a.date || a.date < dateFrom)) return false;
      if (dateTo && (!a.date || a.date > dateTo)) return false;
      return true;
    });
  }, [accidents, dateFrom, dateTo]);

  const byCause = useMemo(() => {
    const map = {};
    CAUSES.forEach((c) => (map[c] = 0));
    filtered.forEach((a) => a.causes.forEach((c) => { map[c] = (map[c] || 0) + 1; }));
    return CAUSES.map((c) => ({ name: c, value: map[c] })).sort((a, b) => b.value - a.value);
  }, [filtered]);

  const byPluga = useMemo(() => {
    const map = {};
    PLUGOT.forEach((p) => (map[p] = 0));
    filtered.forEach((a) => { map[a.pluga] = (map[a.pluga] || 0) + 1; });
    return PLUGOT.map((p) => ({ name: p, value: map[p] }));
  }, [filtered]);

  const byMonth = useMemo(() => {
    const map = {};
    filtered.forEach((a) => {
      if (!a.date) return;
      const key = a.date.slice(0, 7);
      map[key] = (map[key] || 0) + 1;
    });
    return Object.entries(map).sort(([a], [b]) => a.localeCompare(b)).map(([k, v]) => ({ month: k, count: v }));
  }, [filtered]);

  const topCause = byCause[0];

  const setPreset = (days) => {
    const to = new Date();
    const from = new Date();
    from.setDate(from.getDate() - days + 1);
    setDateFrom(from.toISOString().slice(0, 10));
    setDateTo(to.toISOString().slice(0, 10));
  };
  const setThisYear = () => {
    const y = new Date().getFullYear();
    setDateFrom(`${y}-01-01`);
    setDateTo(`${y}-12-31`);
  };
  const clearRange = () => { setDateFrom(""); setDateTo(""); };
  const rangeActive = !!(dateFrom || dateTo);

  const presetBtn = (label, onClick) => (
    <button
      onClick={onClick}
      style={{
        padding: "7px 14px", borderRadius: 18, border: `1px solid ${BORDER}`,
        background: SURFACE2, color: TEXT, fontSize: 12.5, fontWeight: 600,
      }}
    >
      {label}
    </button>
  );

  const rangeBar = (
    <div style={{ background: SURFACE, border: `1px solid ${BORDER}`, borderRadius: 14, padding: 18, marginBottom: 18 }}>
      <div style={{ display: "flex", alignItems: "flex-end", gap: 16, flexWrap: "wrap" }}>
        <Field label="מתאריך">
          <input type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} style={{ ...inputStyle, width: 170 }} />
        </Field>
        <Field label="עד תאריך">
          <input type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)} style={{ ...inputStyle, width: 170 }} />
        </Field>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center", paddingBottom: 2 }}>
          {presetBtn("30 יום אחרונים", () => setPreset(30))}
          {presetBtn("90 יום אחרונים", () => setPreset(90))}
          {presetBtn("השנה", setThisYear)}
          {rangeActive && (
            <button onClick={clearRange} style={{ background: "none", border: "none", color: MUTED, fontSize: 13, textDecoration: "underline" }}>
              נקה טווח
            </button>
          )}
        </div>
        <div style={{ marginRight: "auto", fontSize: 12.5, color: MUTED, paddingBottom: 4 }}>
          {rangeActive ? `${filtered.length} תאונות בטווח` : `כל התאונות (${accidents.length})`}
        </div>
      </div>
    </div>
  );

  if (accidents.length === 0) {
    return (
      <div>
        <PageHeader icon={TrendingUp} title="ניתוח נתונים" subtitle="תובנות מתוך מאגר התאונות" />
        <EmptyState text="אין עדיין נתונים לניתוח - הוסף תאונות במאגר" />
      </div>
    );
  }

  return (
    <div>
      <PageHeader icon={TrendingUp} title="ניתוח נתונים" subtitle="תובנות מתוך מאגר התאונות" />

      {rangeBar}

      {filtered.length === 0 ? (
        <EmptyState text="אין תאונות בטווח התאריכים שנבחר" />
      ) : (
      <>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 14, marginBottom: 22 }}>
        <StatCard label="סה״כ תאונות בטווח" value={filtered.length} />
        <StatCard label="הגורם השכיח ביותר" value={topCause?.value ? topCause.name : "-"} small />
        <StatCard label="חודשים בטווח" value={byMonth.length} />
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1.4fr 1fr", gap: 16, marginBottom: 16 }}>
        <ChartCard title="תאונות לפי גורם">
          <ResponsiveContainer width="100%" height={280}>
            <BarChart data={byCause} layout="vertical" margin={{ left: 10, right: 20 }}>
              <CartesianGrid strokeDasharray="3 3" stroke={BORDER} horizontal={false} />
              <XAxis type="number" allowDecimals={false} stroke={MUTED} fontSize={12} />
              <YAxis type="category" dataKey="name" stroke={MUTED} fontSize={12} width={100} />
              <Tooltip contentStyle={{ background: SURFACE2, border: `1px solid ${BORDER}`, borderRadius: 8, fontSize: 13 }} labelStyle={{ color: TEXT }} />
              <Bar dataKey="value" radius={[0, 4, 4, 0]}>
                {byCause.map((_, i) => <Cell key={i} fill={CAUSE_COLORS[i % CAUSE_COLORS.length]} />)}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </ChartCard>

        <ChartCard title="תאונות לפי פלוגה">
          <ResponsiveContainer width="100%" height={280}>
            <PieChart>
              <Pie data={byPluga} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={90} label={({ name, value }) => value > 0 ? `${name}: ${value}` : ""}>
                {byPluga.map((_, i) => <Cell key={i} fill={CAUSE_COLORS[i % CAUSE_COLORS.length]} />)}
              </Pie>
              <Tooltip contentStyle={{ background: SURFACE2, border: `1px solid ${BORDER}`, borderRadius: 8, fontSize: 13 }} />
            </PieChart>
          </ResponsiveContainer>
        </ChartCard>
      </div>

      <ChartCard title="מגמת תאונות לאורך זמן">
        <ResponsiveContainer width="100%" height={240}>
          <LineChart data={byMonth}>
            <CartesianGrid strokeDasharray="3 3" stroke={BORDER} />
            <XAxis dataKey="month" stroke={MUTED} fontSize={12} />
            <YAxis allowDecimals={false} stroke={MUTED} fontSize={12} />
            <Tooltip contentStyle={{ background: SURFACE2, border: `1px solid ${BORDER}`, borderRadius: 8, fontSize: 13 }} labelStyle={{ color: TEXT }} />
            <Line type="monotone" dataKey="count" stroke={ACCENT} strokeWidth={2.5} dot={{ fill: ACCENT, r: 3 }} />
          </LineChart>
        </ResponsiveContainer>
      </ChartCard>
      </>
      )}
    </div>
  );
}

function StatCard({ label, value, small }) {
  return (
    <div style={{ background: SURFACE, border: `1px solid ${BORDER}`, borderRadius: 12, padding: "18px 20px" }}>
      <div style={{ fontSize: 12.5, color: MUTED, marginBottom: 6 }}>{label}</div>
      <div style={{ fontSize: small ? 20 : 28, fontWeight: 800, color: ACCENT }}>{value}</div>
    </div>
  );
}

function ChartCard({ title, children }) {
  return (
    <div style={{ background: SURFACE, border: `1px solid ${BORDER}`, borderRadius: 14, padding: 20 }}>
      <div style={{ fontSize: 14.5, fontWeight: 700, marginBottom: 12 }}>{title}</div>
      {children}
    </div>
  );
}
