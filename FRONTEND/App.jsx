import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";

import {
  Activity, AlertOctagon, ArrowDownRight, ArrowUpRight, Bot, BrainCircuit,
  Check, CheckCircle2, ChevronRight, CircleDot, Clock3, Cpu, Gauge, GitBranch,
  MessageSquare, Play, Radio, RefreshCw, Send, Shield, ShieldAlert, ShieldCheck,
  Sparkles, Target, Thermometer, Waves, XCircle, Zap
} from "lucide-react";
import {
  Area, AreaChart, CartesianGrid, Legend, Line, LineChart, ResponsiveContainer,
  Tooltip, XAxis, YAxis
} from "recharts";
import "./styles.css";

const API = "http://127.0.0.1:8000";
const initialReadings = [
  { time: "10:41:00", temperature: 42, vibration: 24, pressure: 58 },
  { time: "10:41:05", temperature: 43, vibration: 26, pressure: 57 },
  { time: "10:41:10", temperature: 44, vibration: 29, pressure: 58 },
  { time: "10:41:15", temperature: 45, vibration: 38, pressure: 56 },
  { time: "10:41:20", temperature: 47, vibration: 52, pressure: 55 },
  { time: "10:41:25", temperature: 49, vibration: 61, pressure: 54 },
  { time: "10:41:30", temperature: 51, vibration: 72, pressure: 52 },
];

const agents = [
  { id: "analyst", name: "Sensor Analyst", role: "SIGNAL INTERPRETATION", icon: Activity, color: "cyan" },
  { id: "risk", name: "Risk Evaluator", role: "RISK CLASSIFICATION", icon: Target, color: "amber" },
  { id: "critic", name: "Adversarial Critic", role: "COUNTER-EVIDENCE", icon: BrainCircuit, color: "violet" },
  { id: "planner", name: "Safety Planner", role: "ACTION RECOMMENDATION", icon: ShieldCheck, color: "green" },
];

const demoTrace = [
  { id: 1, agent: "Sensor Analyst", stage: "OBSERVE", status: "complete", time: "10:41:31", text: "Vibration is trending upward across 6 consecutive samples.", detail: "Signal pattern differs from the previous stable window." },
  { id: 2, agent: "Risk Evaluator", stage: "ASSESS", status: "complete", time: "10:41:32", text: "Initial classification: elevated mechanical risk.", detail: "Temperature and vibration are increasing together." },
  { id: 3, agent: "Adversarial Critic", stage: "CHALLENGE", status: "active", time: "10:41:33", text: "Checking whether this could be a transient sensor spike.", detail: "Counter-check: the anomaly persists across multiple readings." },
  { id: 4, agent: "Safety Planner", stage: "RECOMMEND", status: "waiting", time: "—", text: "Awaiting critic review before proposing an action.", detail: "No physical control action has been executed." },
];

function firstValue(obj, keys, fallback = null) {
  if (!obj || typeof obj !== "object") return fallback;
  for (const key of keys) if (obj[key] !== undefined && obj[key] !== null) return obj[key];
  return fallback;
}
function asNumber(value, fallback = 0) {
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
}
function normalizeReading(item, i) {
  const d = item || {};
  return {
    time: String(firstValue(d, ["time", "timestamp", "created_at", "label"], `T-${6 - i}`)).slice(-8),
    temperature: asNumber(firstValue(d, ["temperature", "temp", "temperature_c", "motor_temperature"], 40 + i * 1.7)),
    vibration: asNumber(firstValue(d, ["vibration", "vibration_level", "vibration_mm_s"], 20 + i * 7)),
    pressure: asNumber(firstValue(d, ["pressure", "pressure_kpa"], 60 - i)),
  };
}
function normalizeIncident(item, i) {
  const d = item || {};
  return {
    id: String(firstValue(d, ["id", "incident_id"], `INC-${String(i + 1).padStart(3, "0")}`)),
    title: String(firstValue(d, ["title", "message", "description", "type"], "Sensor anomaly detected")),
    severity: String(firstValue(d, ["severity", "level", "risk"], "medium")).toLowerCase(),
    time: String(firstValue(d, ["time", "timestamp", "created_at"], "Recently")),
    status: String(firstValue(d, ["status", "state"], "monitoring")).toLowerCase(),
  };
}
async function getJson(path, signal) {
  const res = await fetch(`${API}${path}`, { signal });
  if (!res.ok) throw new Error(`${path} returned ${res.status}`);
  return res.json();
}

export default function App() {
  const [readings, setReadings] = useState(initialReadings);
  const [incidents, setIncidents] = useState([]);
  const [trace, setTrace] = useState(demoTrace);
  const [backendStatus, setBackendStatus] = useState("connecting");
  const [simulationMode, setSimulationMode] = useState(false);
  const [activeView, setActiveView] = useState("overview");
  const [activeAgent, setActiveAgent] = useState("critic");
  const [chatOpen, setChatOpen] = useState(false);
  const [chatInput, setChatInput] = useState("");
  const [chatMessages, setChatMessages] = useState([
    { role: "assistant", text: "I'm ready to inspect the latest sensor signals. Ask about anomalies, risk, or the current decision trace." }
  ]);
  const [chatBusy, setChatBusy] = useState(false);
  const [lastUpdated, setLastUpdated] = useState(new Date());
  const [apiErrors, setApiErrors] = useState([]);
  const [refreshing, setRefreshing] = useState(false);
  const [reviewMode, setReviewMode] = useState("live");
  const socketRef = useRef(null);

  const latest = readings[readings.length - 1] || initialReadings[initialReadings.length - 1];
  const prior = readings[readings.length - 2] || latest;
  const tempDelta = latest.temperature - prior.temperature;
  const vibDelta = latest.vibration - prior.vibration;
  const riskScore = Math.min(99, Math.max(12, Math.round(latest.vibration * 0.68 + Math.max(0, latest.temperature - 35) * 0.7)));
  const riskLabel = riskScore >= 70 ? "HIGH" : riskScore >= 45 ? "ELEVATED" : "GUARDED";

  const refreshData = useCallback(async () => {
    setRefreshing(true);
    const controller = new AbortController();
    const endpoints = [
      ["/api/readings", (data) => {
        const raw = Array.isArray(data) ? data : firstValue(data, ["readings", "data", "items"], []);
        if (Array.isArray(raw) && raw.length) setReadings(raw.slice(-24).map(normalizeReading));
      }],
      ["/api/incidents", (data) => {
        const raw = Array.isArray(data) ? data : firstValue(data, ["incidents", "data", "items"], []);
        if (Array.isArray(raw)) setIncidents(raw.slice(0, 6).map(normalizeIncident));
      }],
      ["/api/trace", (data) => {
        const raw = Array.isArray(data) ? data : firstValue(data, ["trace", "events", "steps", "data"], []);
        if (Array.isArray(raw) && raw.length) {
          setTrace(raw.slice(-8).map((t, i) => ({
            id: t.id ?? i + 1,
            agent: firstValue(t, ["agent", "agent_name", "node", "name"], "Agent"),
            stage: String(firstValue(t, ["stage", "step", "type"], "PROCESS")).toUpperCase(),
            status: String(firstValue(t, ["status", "state"], i === raw.length - 1 ? "active" : "complete")).toLowerCase(),
            time: String(firstValue(t, ["time", "timestamp", "created_at"], "—")).slice(-8),
            text: String(firstValue(t, ["message", "text", "description", "output"], "Agent event received.")),
            detail: String(firstValue(t, ["detail", "reason", "summary"], "Backend trace event.")),
          })));
        }
      }],
      ["/api/status", (data) => {
        const ok = firstValue(data, ["ok", "healthy", "connected", "status"], true);
        setBackendStatus(ok === false || ["error", "offline", "unhealthy"].includes(String(ok).toLowerCase()) ? "degraded" : "online");
      }],
    ];
    const errors = [];
    await Promise.all(endpoints.map(async ([path, apply]) => {
      try { apply(await getJson(path, controller.signal)); }
      catch (e) { errors.push(path); }
    }));
    setApiErrors(errors);
    if (errors.length < endpoints.length) setBackendStatus((old) => old === "connecting" ? "online" : old);
    else setBackendStatus("offline");
    setLastUpdated(new Date());
    setRefreshing(false);
    controller.abort();
  }, []);

  useEffect(() => {
    refreshData();
    const poll = setInterval(refreshData, 12000);
    let socket;
    try {
      socket = new WebSocket("ws://127.0.0.1:8000/ws/live");
      socketRef.current = socket;
      socket.onopen = () => setBackendStatus("online");
      socket.onmessage = (event) => {
        try {
          const payload = JSON.parse(event.data);
          const raw = firstValue(payload, ["reading", "sensor", "data"], payload);
          if (raw && typeof raw === "object" && ["temperature", "temp", "vibration", "pressure", "vibration_level"].some(k => raw[k] !== undefined)) {
            setReadings(prev => [...prev, normalizeReading(raw, prev.length)].slice(-24));
            setLastUpdated(new Date());
          }
          const traceItem = firstValue(payload, ["trace_event", "agent_event"], null);
          if (traceItem) {
            setTrace(prev => [...prev.slice(-7), {
              id: Date.now(), agent: firstValue(traceItem, ["agent", "name"], "Agent"),
              stage: String(firstValue(traceItem, ["stage", "type"], "UPDATE")).toUpperCase(),
              status: "active", time: new Date().toLocaleTimeString(),
              text: String(firstValue(traceItem, ["message", "text"], "New agent event received.")),
              detail: String(firstValue(traceItem, ["detail", "reason"], "Live backend event.")),
            }]);
          }
        } catch { /* Ignore non-JSON heartbeat messages. */ }
      };
      socket.onerror = () => setBackendStatus(old => old === "online" ? "degraded" : old);
      socket.onclose = () => setBackendStatus(old => old === "online" ? "degraded" : old);
    } catch { setBackendStatus("offline"); }
    return () => {
      clearInterval(poll);
      if (socket && socket.readyState <= 1) socket.close();
    };
  }, [refreshData]);

  useEffect(() => {
    if (backendStatus === "offline" && trace === demoTrace) setTrace(demoTrace);
  }, [backendStatus, trace]);

  const metrics = useMemo(() => [
    { label: "Motor temperature", value: latest.temperature.toFixed(1), unit: "°C", delta: tempDelta, icon: Thermometer, tone: "orange", note: "Thermal signal" },
    { label: "Vibration index", value: latest.vibration.toFixed(0), unit: "mm/s", delta: vibDelta, icon: Waves, tone: "violet", note: "Mechanical signal" },
    { label: "System pressure", value: latest.pressure.toFixed(0), unit: "kPa", delta: null, icon: Gauge, tone: "blue", note: "Operating condition" },
    { label: "Composite risk", value: String(riskScore), unit: "/100", delta: null, icon: ShieldAlert, tone: riskScore >= 70 ? "red" : "green", note: `${riskLabel} classification` },
  ], [latest, tempDelta, vibDelta, riskScore, riskLabel]);

  const sendChat = async (e) => {
    e?.preventDefault();
    const message = chatInput.trim();
    if (!message || chatBusy) return;
    setChatInput("");
    setChatMessages(prev => [...prev, { role: "user", text: message }]);
    setChatBusy(true);
    try {
      const res = await fetch(`${API}/api/chat`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.detail || "Chat request failed");
      setChatMessages(prev => [...prev, { role: "assistant", text: String(firstValue(data, ["response", "answer", "message", "reply"], JSON.stringify(data))) }]);
    } catch {
      setChatMessages(prev => [...prev, { role: "assistant", text: "I couldn't reach the backend chat endpoint. Check that the SENTINEL backend is running on port 8000." }]);
    } finally { setChatBusy(false); }
  };

  const toggleSimulation = async () => {
    const next = !simulationMode;
    setSimulationMode(next);
    try {
      await fetch(`${API}/api/simulation/mode`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ enabled: next, mode: next ? "simulation" : "live" }),
      });
    } catch { /* UI shows current request intent; backend status remains visible. */ }
  };

  const nav = [
    { id: "overview", label: "Command overview", icon: Activity },
    { id: "signals", label: "Live signals", icon: Waves },
    { id: "council", label: "Agent council", icon: BrainCircuit },
    { id: "incidents", label: "Incident review", icon: AlertOctagon },
  ];
  const titleMap = { overview: "Autonomous oversight", signals: "Live signal intelligence", council: "Agent council", incidents: "Incident review" };

  return (
    <div className="sentinel-app">
      <aside className="sidebar">
        <div className="brand-lockup">
          <div className="brand-mark"><Shield size={22} strokeWidth={1.8} /><span /></div>
          <div><div className="brand-name">SENTINEL<span>®</span></div><div className="brand-sub">AGENTIC INTELLIGENCE</div></div>
        </div>
        <div className="side-section-label">WORKSPACE</div>
        <nav className="main-nav" aria-label="Main navigation">
          {nav.map(item => {
            const Icon = item.icon;
            return <button key={item.id} className={`nav-item ${activeView === item.id ? "selected" : ""}`} onClick={() => setActiveView(item.id)}>
              <Icon size={17} /><span>{item.label}</span>{item.id === "incidents" && incidents.length > 0 && <b className="nav-count">{incidents.length}</b>}
            </button>;
          })}
        </nav>
        <div className="side-rule" />
        <div className="side-section-label">SYSTEM STATUS</div>
        <div className="side-status-card">
          <div className="side-status-row"><span className={`status-dot ${backendStatus}`} /> <span>{backendStatus === "online" ? "Backend connected" : backendStatus === "connecting" ? "Connecting…" : backendStatus === "degraded" ? "Connection degraded" : "Backend offline"}</span></div>
          <div className="side-status-row muted"><Radio size={13} /><span>WebSocket telemetry</span></div>
          <div className="side-status-row muted"><Cpu size={13} /><span>Agent runtime</span><span className="status-value">{backendStatus === "online" ? "READY" : "CHECK"}</span></div>
        </div>
        <div className="sidebar-spacer" />
        <div className="sidebar-bottom">
          <div className="operator-avatar">OP</div>
          <div className="operator-copy"><strong>Operations desk</strong><span>Safety supervisor</span></div>
          <span className="operator-status" title="Operator present" />
        </div>
        <div className="sidebar-version">SENTINEL CORE <span>v0.9.4</span></div>
      </aside>

      <main className="main-content">
        <header className="topbar">
          <div className="breadcrumb"><span>WORKSPACE</span><ChevronRight size={13} /><strong>{titleMap[activeView]}</strong></div>
          <div className="topbar-actions">
            <div className="live-pill"><span className="live-dot" /> {backendStatus === "online" ? "LIVE SYSTEM" : backendStatus.toUpperCase()}</div>
            <div className="topbar-divider" />
            <div className="updated-label"><Clock3 size={14} /> Updated {lastUpdated.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" })}</div>
            <button className="icon-button" onClick={refreshData} disabled={refreshing} aria-label="Refresh data"><RefreshCw size={16} className={refreshing ? "spin" : ""} /></button>
          </div>
        </header>

        <div className="page-wrap">
          <section className="page-heading">
            <div>
              <div className="eyebrow"><span className="eyebrow-line" /> AUTONOMOUS SAFETY SYSTEM <span className="eyebrow-sep">/</span> SESSION 0084</div>
              <h1>{titleMap[activeView]}<span className="heading-period">.</span></h1>
              <p className="page-description">A multi-agent intelligence layer that observes, challenges, and validates safety decisions.</p>
            </div>
            <div className="heading-right">
              <div className="session-chip"><span className="session-chip-dot" /> SESSION ACTIVE <span className="session-id">#0084</span></div>
              <button className={`simulation-toggle ${simulationMode ? "on" : ""}`} onClick={toggleSimulation}><span className="toggle-track"><span /></span><span>{simulationMode ? "Simulation on" : "Simulation mode"}</span></button>
            </div>
          </section>

          {apiErrors.length === 4 && <div className="connection-banner"><AlertOctagon size={16} /><span>Backend endpoints are unreachable. Showing fallback telemetry for layout preview.</span><button onClick={refreshData}>Retry connection</button></div>}

          {activeView === "overview" && <>
            <section className="metric-grid">
              {metrics.map((m, i) => {
                const Icon = m.icon;
                return <article className={`metric-card tone-${m.tone}`} key={m.label}>
                  <div className="metric-top"><span className="metric-label">{m.label}</span><span className="metric-icon"><Icon size={17} /></span></div>
                  <div className="metric-number">{m.value}<small>{m.unit}</small></div>
                  <div className="metric-foot"><span className="metric-note">{m.note}</span>{m.delta !== null && <span className={`metric-delta ${m.delta > 0 ? "up" : "down"}`}>{m.delta > 0 ? <ArrowUpRight size={13} /> : <ArrowDownRight size={13} />}{Math.abs(m.delta).toFixed(1)} this window</span>}</div>
                  <div className="metric-accent" />
                </article>;
              })}
            </section>

            <section className="analysis-grid">
              <article className="panel signal-panel">
                <div className="panel-header">
                  <div><div className="panel-kicker">01 / TELEMETRY</div><h2>Signal correlation</h2><p>Multi-sensor evidence · last {readings.length} samples</p></div>
                  <span className="panel-live"><span /> STREAMING</span>
                </div>
                <div className="chart-legend"><span><i className="legend-dot temp" /> Temperature</span><span><i className="legend-dot vib" /> Vibration</span></div>
                <div className="signal-chart"><ResponsiveContainer width="100%" height="100%"><LineChart data={readings} margin={{ top: 8, right: 8, left: -18, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 5" vertical={false} stroke="var(--chart-grid)" />
                  <XAxis dataKey="time" tick={{ fill: "var(--muted)", fontSize: 10 }} tickLine={false} axisLine={false} minTickGap={25} />
                  <YAxis tick={{ fill: "var(--muted)", fontSize: 10 }} tickLine={false} axisLine={false} />
                  <Tooltip contentStyle={{ background: "var(--tooltip-bg)", border: "1px solid var(--border)", borderRadius: 10, color: "var(--text)", fontSize: 12 }} />
                  <Line type="monotone" dataKey="temperature" name="Temperature °C" stroke="#ef9566" strokeWidth={2.4} dot={false} activeDot={{ r: 4 }} />
                  <Line type="monotone" dataKey="vibration" name="Vibration index" stroke="#a99bff" strokeWidth={2.4} dot={false} activeDot={{ r: 4 }} />
                </LineChart></ResponsiveContainer></div>
                <div className="chart-insight"><Sparkles size={14} /><span><strong>Correlation watch:</strong> Temperature and vibration are moving upward together. The critic agent is checking whether the pattern is persistent.</span></div>
              </article>

              <article className="panel risk-panel">
                <div className="panel-header"><div><div className="panel-kicker">02 / RISK ENGINE</div><h2>Risk assessment</h2><p>Composite signal score</p></div><span className={`risk-badge ${riskLabel.toLowerCase()}`}>{riskLabel}</span></div>
                <div className="risk-score-wrap">
                  <div className="risk-gauge" style={{ "--score": `${riskScore * 3.6}deg` }}><div className="gauge-inner"><span className="gauge-number">{riskScore}</span><span className="gauge-caption">RISK INDEX</span></div></div>
                  <div className="risk-summary"><strong>{riskScore >= 70 ? "Escalate for review" : riskScore >= 45 ? "Increased attention required" : "Within guarded range"}</strong><span>Based on current sensor evidence and trend direction.</span><div className="risk-range"><span className="range-low" /><span className="range-mid" /><span className="range-high" /></div><div className="range-labels"><span>LOW</span><span>GUARDED</span><span>HIGH</span></div></div>
                </div>
                <div className="risk-divider" />
                <div className="risk-factors"><div><span className="factor-dot orange" /><span>Temperature trend</span><strong>{tempDelta > 0 ? "RISING" : "STABLE"}</strong></div><div><span className="factor-dot violet" /><span>Vibration trend</span><strong>{vibDelta > 0 ? "RISING" : "STABLE"}</strong></div><div><span className="factor-dot green" /><span>Decision confidence</span><strong>{backendStatus === "online" ? "REVIEWING" : "PROVISIONAL"}</strong></div></div>
                <div className="risk-disclaimer"><Shield size={13} /> Advisory score only · no autonomous physical action executed</div>
              </article>
            </section>

            <section className="agent-workspace">
              <div className="section-heading"><div><div className="panel-kicker">03 / MULTI-AGENT REASONING</div><h2>Agent council <span className="section-count">04</span></h2></div><button className="text-button" onClick={() => setActiveView("council")}>Open council <ChevronRight size={14} /></button></div>
              <div className="agent-cards">
                {agents.map((agent, i) => {
                  const Icon = agent.icon;
                  const statuses = ["complete", "complete", "active", "waiting"];
                  const status = statuses[i];
                  const selected = activeAgent === agent.id;
                  const blurbs = [
                    "Correlating sensor windows",
                    "Rechecking risk thresholds",
                    "Testing alternate explanations",
                    "Waiting for critic verdict",
                  ];
                  return <button key={agent.id} className={`agent-card agent-${agent.color} ${selected ? "active-agent" : ""}`} onClick={() => { setActiveAgent(agent.id); setActiveView("council"); }}>
                    <div className="agent-card-top"><span className="agent-icon"><Icon size={18} /></span><span className={`agent-status ${status}`}>{status === "complete" ? <Check size={11} /> : status === "active" ? <span className="mini-pulse" /> : <Clock3 size={11} />}{status.toUpperCase()}</span></div>
                    <div className="agent-name">{agent.name}</div><div className="agent-role">{agent.role}</div>
                    <p>{blurbs[i]}</p>
                    <div className="agent-card-bottom"><span>{status === "active" ? "Working now" : status === "waiting" ? "Queued" : "Evidence received"}</span><ChevronRight size={14} /></div>
                  </button>;
                })}
              </div>
            </section>

            <section className="bottom-grid">
              <article className="panel trace-panel">
                <div className="panel-header"><div><div className="panel-kicker">04 / AUDITABLE PROCESS</div><h2>Decision trace</h2><p>Visible sequence of agent activity</p></div><span className="trace-count">{trace.length} EVENTS</span></div>
                <div className="trace-list">
                  {trace.slice(-4).map((t, i) => <div className={`trace-item trace-${t.status}`} key={t.id ?? i}>
                    <div className="trace-rail"><span className="trace-node">{t.status === "complete" ? <Check size={12} /> : t.status === "active" ? <span className="mini-pulse" /> : <Clock3 size={12} />}</span>{i < Math.min(trace.length, 4) - 1 && <span className="trace-connector" />}</div>
                    <div className="trace-copy"><div className="trace-meta"><strong>{t.agent}</strong><span>{t.time}</span></div><div className="trace-stage">{t.stage}</div><p>{t.text}</p><small>{t.detail}</small></div>
                  </div>)}
                </div>
              </article>
              <article className="panel critique-panel">
                <div className="panel-header"><div><div className="panel-kicker">05 / SELF-CRITIQUE</div><h2>Challenge the conclusion</h2><p>Counter-evidence before recommendation</p></div><span className="critic-mark"><BrainCircuit size={17} /></span></div>
                <div className="critique-status"><span className="critique-status-dot" /><span>CRITIC REVIEW IN PROGRESS</span><span className="critique-timer">PASS 02</span></div>
                <div className="hypothesis-box"><div className="hypothesis-label"><CircleDot size={13} /> INITIAL HYPOTHESIS</div><p>Observed vibration increase may be a transient fluctuation.</p></div>
                <div className="critique-connector"><span /><ChevronDownFallback /></div>
                <div className="counter-box"><div className="hypothesis-label"><AlertOctagon size={13} /> COUNTER-EVIDENCE</div><p>Temperature and vibration rose across multiple samples; the signal may not be isolated noise.</p></div>
                <div className="confidence-row"><div><span>Confidence in elevated-risk hypothesis</span><strong>{riskScore >= 70 ? "0.87" : riskScore >= 45 ? "0.71" : "0.42"}</strong></div><div className="confidence-bar"><span style={{ width: `${riskScore >= 70 ? 87 : riskScore >= 45 ? 71 : 42}%` }} /></div></div>
                <div className="critique-foot"><ShieldAlert size={14} /><span>Provisional assessment. Awaiting backend agent verdict before treating this as a confirmed AI conclusion.</span></div>
              </article>
            </section>

            <section className="decision-banner">
              <div className="decision-icon"><ShieldAlert size={20} /></div>
              <div className="decision-copy"><div className="decision-eyebrow">SAFETY RECOMMENDATION <span>·</span> PROVISIONAL</div><strong>{riskScore >= 70 ? "Escalate for immediate operator review" : riskScore >= 45 ? "Continue close monitoring and verify sensor integrity" : "Maintain monitoring and gather more evidence"}</strong><p>Human approval required before any physical control action.</p></div>
              <button className="decision-button" onClick={() => setActiveView("incidents")}>Review incidents <ChevronRight size={15} /></button>
            </section>
          </>}

          {activeView === "signals" && <section className="panel expanded-view"><div className="panel-header"><div><div className="panel-kicker">LIVE TELEMETRY</div><h2>Sensor signal history</h2><p>Recent samples received from the backend, when available</p></div><span className="panel-live"><span /> STREAMING</span></div><div className="expanded-chart"><ResponsiveContainer width="100%" height="100%"><AreaChart data={readings}><defs><linearGradient id="vibFill" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#a99bff" stopOpacity={0.28} /><stop offset="100%" stopColor="#a99bff" stopOpacity={0.01} /></linearGradient></defs><CartesianGrid strokeDasharray="3 5" vertical={false} stroke="var(--chart-grid)" /><XAxis dataKey="time" tick={{ fill: "var(--muted)", fontSize: 11 }} /><YAxis tick={{ fill: "var(--muted)", fontSize: 11 }} /><Tooltip contentStyle={{ background: "var(--tooltip-bg)", border: "1px solid var(--border)", borderRadius: 10 }} /><Legend /><Area type="monotone" dataKey="vibration" stroke="#a99bff" fill="url(#vibFill)" strokeWidth={2.5} /><Line type="monotone" dataKey="temperature" stroke="#ef9566" strokeWidth={2.5} /></AreaChart></ResponsiveContainer></div><div className="signal-table"><div className="signal-table-row signal-table-head"><span>Timestamp</span><span>Temperature</span><span>Vibration</span><span>Pressure</span><span>Signal status</span></div>{readings.slice().reverse().map((r, i) => <div className="signal-table-row" key={`${r.time}-${i}`}><span>{r.time}</span><span>{r.temperature.toFixed(1)} °C</span><span>{r.vibration.toFixed(0)} mm/s</span><span>{r.pressure.toFixed(0)} kPa</span><span><i className={`table-status ${r.vibration > 60 ? "warning" : "stable"}`} />{r.vibration > 60 ? "Review" : "Observed"}</span></div>)}</div></section>}

          {activeView === "council" && <section className="council-view"><div className="council-intro panel"><div className="panel-kicker">COLLABORATIVE INTELLIGENCE</div><h2>One signal. Multiple perspectives.</h2><p>Each role has a different responsibility. The critic is expected to challenge a conclusion, not merely agree with the first assessment.</p><div className="council-flow"><span>OBSERVE</span><ChevronRight size={15} /><span>ASSESS</span><ChevronRight size={15} /><span className="flow-active">CHALLENGE</span><ChevronRight size={15} /><span>RECOMMEND</span></div></div><div className="council-detail-grid"><div className="council-agent-list">{agents.map((a, i) => {const Icon = a.icon; return <button key={a.id} className={`council-agent-select ${activeAgent === a.id ? "chosen" : ""}`} onClick={() => setActiveAgent(a.id)}><span className={`agent-icon ${a.color}`}><Icon size={18} /></span><span><strong>{a.name}</strong><small>{a.role}</small></span><ChevronRight size={15} /></button>;})}</div><div className="panel council-detail"><div className="panel-kicker">AGENT DETAIL / ROLE CONTRACT</div><h2>{agents.find(a => a.id === activeAgent)?.name}</h2><p className="council-role-description">{({ analyst: "Interpret incoming telemetry, identify changes over time, and surface relationships between sensors without asserting a root cause prematurely.", risk: "Compare observed patterns with configured risk rules and communicate the evidence and uncertainty behind the classification.", critic: "Actively test the leading hypothesis, look for counter-evidence, and flag unsupported assumptions before a recommendation is made.", planner: "Translate reviewed evidence into a safe, bounded recommendation. Physical actions require explicit operator approval." })[activeAgent]}</p><div className="detail-divider" /><div className="panel-kicker">LATEST TRACE EVENTS</div>{trace.slice(-4).map((t, i) => <div className="detail-event" key={t.id ?? i}><span className="detail-event-dot" /><div><strong>{t.stage} · {t.agent}</strong><p>{t.text}</p><small>{t.time}</small></div></div>)}<div className="honesty-note"><ShieldCheck size={15} /> Live agent outputs appear here when exposed by the backend. Otherwise the dashboard uses clearly provisional UI examples.</div></div></div></section>}

          {activeView === "incidents" && <section className="panel incidents-view"><div className="panel-header"><div><div className="panel-kicker">SAFETY QUEUE</div><h2>Incident review</h2><p>Review detected events before taking action</p></div><span className="trace-count">{incidents.length} FROM API</span></div>{incidents.length ? <div className="incident-list">{incidents.map((inc) => <div className="incident-row" key={inc.id}><div className={`incident-icon ${inc.severity}`}><AlertOctagon size={18} /></div><div className="incident-main"><strong>{inc.title}</strong><span>{inc.id} <i /> {inc.time}</span></div><span className={`incident-severity ${inc.severity}`}>{inc.severity}</span><span className="incident-state">{inc.status}</span><button className="icon-button" onClick={() => setChatOpen(true)} aria-label="Ask agent about incident"><MessageSquare size={15} /></button></div>)}</div> : <div className="empty-incidents"><CheckCircle2 size={28} /><strong>No incidents returned by the backend</strong><span>New incident records will appear here when the API provides them.</span></div>}<div className="incident-human-note"><Shield size={15} /><span>Safety policy: the dashboard recommends and explains; an authorized human approves physical interventions.</span></div></section>}

          <footer className="page-footer"><span>© SENTINEL AUTONOMOUS SAFETY INTELLIGENCE</span><span><span className={`footer-dot ${backendStatus}`} /> {backendStatus.toUpperCase()} <i /> DATA REFRESH: 12S</span><span>DESIGNED FOR TRACEABLE DECISIONS</span></footer>
        </div>
      </main>

      <button className={`chat-launcher ${chatOpen ? "chat-open" : ""}`} onClick={() => setChatOpen(v => !v)} aria-label={chatOpen ? "Close AI assistant" : "Open AI assistant"}>{chatOpen ? <XCircle size={21} /> : <><span className="chat-launcher-spark"><Sparkles size={16} /></span><span>Ask Sentinel</span><span className="chat-launcher-dot" /></>}</button>
      {chatOpen && <aside className="chat-panel">
        <div className="chat-header"><div className="chat-avatar"><Bot size={19} /></div><div><strong>Sentinel copilot</strong><span><i /> {backendStatus === "online" ? "Connected to backend" : "Backend connection check"}</span></div><button className="chat-close" onClick={() => setChatOpen(false)} aria-label="Close chat"><XCircle size={17} /></button></div>
        <div className="chat-context"><span><Sparkles size={13} /> CONTEXT ATTACHED</span><p>Current telemetry · risk score {riskScore}/100 · {trace.length} trace events</p></div>
        <div className="chat-messages">{chatMessages.map((m, i) => <div className={`chat-message ${m.role}`} key={i}><span className="chat-message-role">{m.role === "assistant" ? "SENTINEL" : "YOU"}</span><p>{m.text}</p></div>)}{chatBusy && <div className="chat-message assistant"><span className="thinking-dots"><i /><i /><i /></span></div>}</div>
        <form className="chat-form" onSubmit={sendChat}><input value={chatInput} onChange={e => setChatInput(e.target.value)} placeholder="Ask about the current signals…" aria-label="Message Sentinel" /><button type="submit" disabled={chatBusy || !chatInput.trim()} aria-label="Send message"><Send size={16} /></button></form>
        <div className="chat-footnote">AI output is advisory. Verify before acting.</div>
      </aside>}
    </div>
  );
}

function ChevronDownFallback() {
  return <span className="critic-down-arrow">↓</span>;
}
