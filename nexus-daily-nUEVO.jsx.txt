import { useState, useEffect } from "react";

const SYSTEM_PROMPT = `Eres NEXUS, el asistente personal de Gabriel Villafañe. 

Respondés en español, de forma concisa y directa. 

Cuando te den datos del calendario o emails, los analizás y das un resumen útil y priorizado.

Sos cálido pero eficiente. Usás "socio" ocasionalmente. Máximo 3-4 oraciones por respuesta.`;

const API_URL = "https://api.anthropic.com/v1/messages";

async function callClaude(messages, mcpServers = []) {

  const body = {

    model: "claude-sonnet-4-20250514",

    max_tokens: 1000,

    system: SYSTEM_PROMPT,

    messages,

  };

  if (mcpServers.length > 0) body.mcp_servers = mcpServers;

  const res = await fetch(API_URL, {

    method: "POST",

    headers: { "Content-Type": "application/json" },

    body: JSON.stringify(body),

  });

  const data = await res.json();

  const text = data.content?.filter(b => b.type === "text").map(b => b.text).join("\n") || "";

  return text;

}

const MCP_CALENDAR = { type: "url", url: "https://calendarmcp.googleapis.com/mcp/v1", name: "google-calendar" };

const MCP_GMAIL = { type: "url", url: "https://gmailmcp.googleapis.com/mcp/v1", name: "gmail" };
const NEWS_API_KEY = "TU_CLAVE_NEWSAPI_AQUI";

async function fetchNewsFromAPI(query = "Argentina") {
  const url = `https://newsapi.org/v2/top-headlines?country=ar&apiKey=${NEWS_API_KEY}&pageSize=5`;
  const res = await fetch(url);
  const data = await res.json();
  if (data.status !== "ok") throw new Error("NewsAPI error");
  return data.articles.map(a => `• ${a.title} (${a.source.name})`).join("\n");
}


function GlowDot({ color }) {

  return (

    <span style={{

      display: "inline-block", width: 8, height: 8, borderRadius: "50%",

      background: color, boxShadow: `0 0 6px ${color}`, marginRight: 6, flexShrink: 0

    }} />

  );

}

function Card({ children, style = {} }) {

  return (

    <div style={{

      background: "rgba(255,255,255,0.04)",

      border: "1px solid rgba(255,255,255,0.08)",

      borderRadius: 16,

      padding: "16px",

      marginBottom: 12,

      backdropFilter: "blur(10px)",

      ...style

    }}>

      {children}

    </div>

  );

}

function SectionTitle({ icon, label }) {

  return (

    <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 12 }}>

      <span style={{ fontSize: 16 }}>{icon}</span>

      <span style={{ fontSize: 11, fontWeight: 700, letterSpacing: 2, color: "#888", textTransform: "uppercase" }}>

        {label}

      </span>

    </div>

  );

}

function LoadingDots() {

  return (

    <span style={{ display: "inline-flex", gap: 4, alignItems: "center" }}>

      {[0, 1, 2].map(i => (

        <span key={i} style={{

          width: 5, height: 5, borderRadius: "50%", background: "#4fc3f7",

          animation: `pulse 1.2s ease-in-out ${i * 0.2}s infinite`,

        }} />

      ))}

      <style>{`@keyframes pulse { 0%,80%,100%{opacity:0.2;transform:scale(0.8)} 40%{opacity:1;transform:scale(1)} }`}</style>

    </span>

  );

}

export default function NexusDaily() {

  const now = new Date();

  const greeting = now.getHours() < 12 ? "Buenos días" : now.getHours() < 19 ? "Buenas tardes" : "Buenas noches";

  const dateStr = now.toLocaleDateString("es-AR", { weekday: "long", day: "numeric", month: "long" });

  const [calSummary, setCalSummary] = useState(null);

  const [gmailSummary, setGmailSummary] = useState(null);

  const [nexusMsg, setNexusMsg] = useState(null);

  const [loading, setLoading] = useState({ cal: false, gmail: false, nexus: false });

  const [tasks, setTasks] = useState([

    { id: 1, text: "Ver partido de Racing 21:30", done: false, priority: "alta" },

  ]);

  const [newTask, setNewTask] = useState("");

  const [chatInput, setChatInput] = useState("");

  const [chatHistory, setChatHistory] = useState([]);

  const [chatLoading, setChatLoading] = useState(false);
  const [newsSummary, setNewsSummary] = useState(null);
  const [newsLoading, setNewsLoading] = useState(false);

  const [activeTab, setActiveTab] = useState("home");

  async function fetchCalendar() {

    setLoading(l => ({ ...l, cal: true }));

    try {

      const today = now.toISOString().split("T")[0];

      const prompt = `Listá los eventos del calendario de hoy ${today} y mañana. Solo los títulos, horarios y si hay alguno urgente.`;

      const summary = await callClaude(

        [{ role: "user", content: prompt }],

        [MCP_CALENDAR]

      );

      setCalSummary(summary);

    } catch (e) {

      setCalSummary("No pude conectar con el calendario.");

    }

    setLoading(l => ({ ...l, cal: false }));

  }

  async function fetchGmail() {

    setLoading(l => ({ ...l, gmail: true }));

    try {

      const prompt = "Revisá los últimos emails no leídos. Dame un resumen de los 3 más importantes con remitente y asunto. Sé breve.";

      const summary = await callClaude(

        [{ role: "user", content: prompt }],

        [MCP_GMAIL]

      );

      setGmailSummary(summary);

    } catch (e) {

      setGmailSummary("No pude conectar con Gmail.");

    }

    setLoading(l => ({ ...l, gmail: false }));

  }

  async function fetchNexusBriefing() {

    setLoading(l => ({ ...l, nexus: true }));

    try {

      const taskList = tasks.filter(t => !t.done).map(t => `- ${t.text}`).join("\n") || "Sin tareas pendientes";

      const prompt = `Hoy es ${dateStr}. Tareas pendientes de Gabriel:\n${taskList}\n\nDame un briefing del día en 2-3 oraciones. Motivador pero concreto.`;

      const msg = await callClaude([{ role: "user", content: prompt }]);

      setNexusMsg(msg);

    } catch (e) {

      setNexusMsg("Error al conectar.");

    }

    setLoading(l => ({ ...l, nexus: false }));

  }

  
  async function fetchNews() {
    setNewsLoading(true);
    try {
      const headlines = await fetchNewsFromAPI();
      const prompt = `Estos son los titulares de noticias de hoy en Argentina:\n${headlines}\n\nDame un resumen de las 3 más importantes en 2-3 oraciones. Sé breve.`;
      const summary = await callClaude([{ role: "user", content: prompt }]);
      setNewsSummary(summary);
    } catch (e) {
      setNewsSummary("No pude obtener las noticias.");
    }
    setNewsLoading(false);
  }

  async function sendChat() {

    if (!chatInput.trim()) return;

    const userMsg = chatInput.trim();

    setChatInput("");

    setChatLoading(true);

    const newHistory = [...chatHistory, { role: "user", content: userMsg }];

    setChatHistory(newHistory);

    try {

      const reply = await callClaude(newHistory, [MCP_CALENDAR, MCP_GMAIL]);

      setChatHistory([...newHistory, { role: "assistant", content: reply }]);

    } catch (e) {

      setChatHistory([...newHistory, { role: "assistant", content: "Error al responder." }]);

    }

    setChatLoading(false);

  }

  function addTask() {

    if (!newTask.trim()) return;

    setTasks(t => [...t, { id: Date.now(), text: newTask.trim(), done: false, priority: "normal" }]);

    setNewTask("");

  }

  function toggleTask(id) {

    setTasks(t => t.map(task => task.id === id ? { ...task, done: !task.done } : task));

  }

  const pendingCount = tasks.filter(t => !t.done).length;

  const tabs = [

    { id: "home", icon: "⌂", label: "Inicio" },

    { id: "tasks", icon: "âœ“", label: "Tareas" },

    { id: "chat", icon: "◈", label: "NEXUS" },

  ];

  const styles = {

    root: {

      minHeight: "100vh",

      background: "#0a0a0f",

      color: "#e8e8f0",

      fontFamily: "'DM Sans', 'Segoe UI', sans-serif",

      maxWidth: 430,

      margin: "0 auto",

      position: "relative",

      paddingBottom: 70,

    },

    header: {

      padding: "24px 20px 16px",

      borderBottom: "1px solid rgba(255,255,255,0.06)",

      background: "linear-gradient(180deg, rgba(79,195,247,0.06) 0%, transparent 100%)",

    },

    greeting: { fontSize: 13, color: "#4fc3f7", fontWeight: 600, letterSpacing: 1, marginBottom: 2 },

    name: { fontSize: 22, fontWeight: 700, color: "#fff", marginBottom: 2 },

    date: { fontSize: 12, color: "#666", textTransform: "capitalize" },

    content: { padding: "16px 16px 0" },

    btnPrimary: {

      background: "linear-gradient(135deg, #4fc3f7, #0288d1)",

      border: "none", borderRadius: 10, color: "#fff",

      padding: "10px 16px", fontSize: 13, fontWeight: 600,

      cursor: "pointer", width: "100%", marginTop: 8,

    },

    btnSecondary: {

      background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.1)",

      borderRadius: 10, color: "#ccc", padding: "9px 14px",

      fontSize: 12, cursor: "pointer", flex: 1,

    },

    input: {

      background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.1)",

      borderRadius: 10, color: "#fff", padding: "10px 14px",

      fontSize: 13, width: "100%", outline: "none", boxSizing: "border-box",

    },

    tabBar: {

      position: "fixed", bottom: 0, left: "50%", transform: "translateX(-50%)",

      width: "100%", maxWidth: 430,

      background: "rgba(10,10,15,0.95)", backdropFilter: "blur(20px)",

      borderTop: "1px solid rgba(255,255,255,0.08)",

      display: "flex", justifyContent: "space-around", padding: "8px 0 12px",

      zIndex: 100,

    },

    tabBtn: (active) => ({

      display: "flex", flexDirection: "column", alignItems: "center", gap: 3,

      background: "none", border: "none", cursor: "pointer",

      color: active ? "#4fc3f7" : "#555", padding: "4px 20px",

      fontSize: active ? 18 : 16, transition: "color 0.2s",

    }),

    tabLabel: (active) => ({

      fontSize: 10, fontWeight: active ? 700 : 400,

      color: active ? "#4fc3f7" : "#555", letterSpacing: 0.5,

    }),

    summaryText: { fontSize: 13, color: "#bbb", lineHeight: 1.6 },

    badge: {

      background: "#4fc3f7", color: "#000", borderRadius: 20,

      padding: "1px 7px", fontSize: 10, fontWeight: 700, marginLeft: 6,

    },

  };

  return (

    <div style={styles.root}>

      {/* Header */}

      <div style={styles.header}>

        <div style={styles.greeting}>{greeting}, Gabriel</div>

        <div style={styles.name}>NEXUS <span style={{ color: "#4fc3f7", fontSize: 16 }}>Daily</span></div>

        <div style={styles.date}>{dateStr}</div>

      </div>

      <div style={styles.content}>

        {/* HOME TAB */}

        {activeTab === "home" && (

          <div>

            {/* Briefing */}

            <Card>

              <SectionTitle icon="◈" label="Briefing del día" />

              {nexusMsg ? (

                <p style={styles.summaryText}>{nexusMsg}</p>

              ) : (

                <p style={{ ...styles.summaryText, color: "#555" }}>

                  Pedile a NEXUS que analice tu día.

                </p>

              )}

              <button style={styles.btnPrimary} onClick={fetchNexusBriefing} disabled={loading.nexus}>

                {loading.nexus ? <LoadingDots /> : "◈ Generar briefing"}

              </button>

            </Card>

            {/* Calendar */}

            <Card>

              <SectionTitle icon="ðŸ“…" label="Calendario" />

              {calSummary ? (

                <p style={styles.summaryText}>{calSummary}</p>

              ) : (

                <p style={{ ...styles.summaryText, color: "#555" }}>Sin datos aún.</p>

              )}

              <button style={styles.btnPrimary} onClick={fetchCalendar} disabled={loading.cal}>

                {loading.cal ? <LoadingDots /> : "Revisar calendario"}

              </button>

            </Card>

            {/* Gmail */}

            <Card>

              <SectionTitle icon="âœ‰" label="Emails importantes" />

              {gmailSummary ? (

                <p style={styles.summaryText}>{gmailSummary}</p>

              ) : (

                <p style={{ ...styles.summaryText, color: "#555" }}>Sin datos aún.</p>

              )}

              <button style={styles.btnPrimary} onClick={fetchGmail} disabled={loading.gmail}>

                {loading.gmail ? <LoadingDots /> : "Revisar Gmail"}

              </button>

            </Card>

            {/* Tasks preview */}

            <Card>

              <SectionTitle icon="âœ“" label={`Tareas pendientes`} />

              {pendingCount === 0 ? (

                <p style={{ ...styles.summaryText, color: "#555" }}>Sin tareas pendientes ðŸŽ‰</p>

              ) : (

                tasks.filter(t => !t.done).slice(0, 3).map(t => (

                  <div key={t.id} style={{ display: "flex", alignItems: "flex-start", gap: 8, marginBottom: 8 }}>

                    <GlowDot color={t.priority === "alta" ? "#ef5350" : "#4fc3f7"} />

                    <span style={{ fontSize: 13, color: "#ccc" }}>{t.text}</span>

                  </div>

                ))

              )}

              {pendingCount > 3 && (

                <p style={{ fontSize: 11, color: "#555", marginTop: 4 }}>+{pendingCount - 3} más...</p>

              )}

            </Card>

          </div>

        )}

        {/* TASKS TAB */}

        {activeTab === "tasks" && (

          <div>

            <Card>

              <SectionTitle icon="âœ“" label="Mis tareas" />

              <div style={{ display: "flex", gap: 8, marginBottom: 12 }}>

                <input

                  style={{ ...styles.input, flex: 1 }}

                  placeholder="Nueva tarea..."

                  value={newTask}

                  onChange={e => setNewTask(e.target.value)}

                  onKeyDown={e => e.key === "Enter" && addTask()}

                />

                <button

                  onClick={addTask}

                  style={{

                    background: "linear-gradient(135deg, #4fc3f7, #0288d1)",

                    border: "none", borderRadius: 10, color: "#fff",

                    padding: "0 16px", fontSize: 18, cursor: "pointer",

                  }}>+</button>

              </div>

              {tasks.length === 0 && (

                <p style={{ ...styles.summaryText, color: "#555" }}>Sin tareas. Â¡Agregá una!</p>

              )}

              {tasks.map(task => (

                <div key={task.id} onClick={() => toggleTask(task.id)} style={{

                  display: "flex", alignItems: "flex-start", gap: 10,

                  padding: "10px 0", borderBottom: "1px solid rgba(255,255,255,0.05)",

                  cursor: "pointer",

                }}>

                  <div style={{

                    width: 18, height: 18, borderRadius: 5, flexShrink: 0, marginTop: 1,

                    border: task.done ? "none" : "2px solid rgba(79,195,247,0.5)",

                    background: task.done ? "#4fc3f7" : "transparent",

                    display: "flex", alignItems: "center", justifyContent: "center",

                    fontSize: 11, color: "#000", fontWeight: 700,

                  }}>

                    {task.done ? "âœ“" : ""}

                  </div>

                  <span style={{

                    fontSize: 13, color: task.done ? "#444" : "#ccc",

                    textDecoration: task.done ? "line-through" : "none",

                    lineHeight: 1.4,

                  }}>

                    {task.text}

                  </span>

                </div>

              ))}

            </Card>

          </div>

        )}

        {/* CHAT TAB */}

        {activeTab === "chat" && (

          <div>

            <Card style={{ minHeight: 300 }}>

              <SectionTitle icon="◈" label="NEXUS â€” Asistente" />

              <div style={{ maxHeight: 350, overflowY: "auto", marginBottom: 12 }}>

                {chatHistory.length === 0 && (

                  <p style={{ ...styles.summaryText, color: "#555" }}>

                    Preguntame sobre tu agenda, emails, o cualquier cosa, socio.

                  </p>

                )}

                {chatHistory.map((msg, i) => (

                  <div key={i} style={{

                    marginBottom: 10,

                    display: "flex",

                    justifyContent: msg.role === "user" ? "flex-end" : "flex-start",

                  }}>

                    <div style={{

                      maxWidth: "82%",

                      background: msg.role === "user"

                        ? "linear-gradient(135deg, #0288d1, #4fc3f7)"

                        : "rgba(255,255,255,0.07)",

                      borderRadius: msg.role === "user" ? "14px 14px 4px 14px" : "14px 14px 14px 4px",

                      padding: "9px 12px",

                      fontSize: 13,

                      color: msg.role === "user" ? "#fff" : "#ccc",

                      lineHeight: 1.5,

                    }}>

                      {msg.content}

                    </div>

                  </div>

                ))}

                {chatLoading && (

                  <div style={{ display: "flex", justifyContent: "flex-start", marginBottom: 10 }}>

                    <div style={{

                      background: "rgba(255,255,255,0.07)", borderRadius: "14px 14px 14px 4px",

                      padding: "10px 14px",

                    }}>

                      <LoadingDots />

                    </div>

                  </div>

                )}

              </div>

              <div style={{ display: "flex", gap: 8 }}>

                <input

                  style={{ ...styles.input, flex: 1 }}

                  placeholder="Escribí algo..."

                  value={chatInput}

                  onChange={e => setChatInput(e.target.value)}

                  onKeyDown={e => e.key === "Enter" && sendChat()}

                />

                <button

                  onClick={sendChat}

                  disabled={chatLoading}

                  style={{

                    background: "linear-gradient(135deg, #4fc3f7, #0288d1)",

                    border: "none", borderRadius: 10, color: "#fff",

                    padding: "0 14px", fontSize: 16, cursor: "pointer",

                  }}>▶</button>

              </div>

            </Card>


            {/* Noticias */}
            <Card>
              <SectionTitle icon="📰" label="Noticias del día" />
              {newsSummary ? (
                <p style={styles.summaryText}>{newsSummary}</p>
              ) : (
                <p style={{ ...styles.summaryText, color: "#555" }}>Sin noticias aún.</p>
              )}
              <button style={styles.btnPrimary} onClick={fetchNews} disabled={newsLoading}>
                {newsLoading ? <LoadingDots /> : "📰 Ver noticias"}
              </button>
            </Card>
          </div>

        )}

      </div>

      {/* Tab Bar */

      <div style={styles.tabBar}>

        {tabs.map(tab => (

          <button key={tab.id} style={styles.tabBtn(activeTab === tab.id)} onClick={() => setActiveTab(tab.id)}>

            <span>{tab.icon}</span>

            <span style={styles.tabLabel(activeTab === tab.id)}>{tab.label}</span>

            {tab.id === "tasks" && pendingCount > 0 && (

              <span style={styles.badge}>{pendingCount}</span>

            )}

          </button>

        ))}

      </div>

    </div>

  );

}