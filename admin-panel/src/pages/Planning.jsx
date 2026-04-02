import React, { useEffect, useState, useRef } from "react";
import { format } from "date-fns";
import { companyService } from "../services/companyService";
import { getPlanningTasks, createPlanningTask, getBilling, createBilling } from "../services/planningService";
import { supabase } from "../lib/supabaseClient";
import CalendarWrapper from "../components/planning/CalendarWrapper";

function getCompanyColor(company) {
  if (!company || !company.id) return "#8e8e93";
  if (company.color) return company.color;
  let hash = 0;
  for (let i = 0; i < company.id.length; i++) {
    hash = company.id.charCodeAt(i) + ((hash << 5) - hash);
  }
  const c = (hash & 0x00ffffff).toString(16).toUpperCase();
  return "#" + "000000".substring(0, 6 - c.length) + c;
}

function lighten(hex, a = 0.82) {
  try {
    const h = hex.replace("#", "").padStart(6, "0");
    const r = parseInt(h.slice(0,2),16), g = parseInt(h.slice(2,4),16), b = parseInt(h.slice(4,6),16);
    return `rgb(${Math.round(r+(255-r)*a)},${Math.round(g+(255-g)*a)},${Math.round(b+(255-b)*a)})`;
  } catch { return "#f5f5f7"; }
}

function taskToCalendarEvent(task, companies) {
  if (!task || !task.title || !task.start_datetime || !task.company_id) return null;
  const start = new Date(task.start_datetime);
  if (isNaN(start.getTime())) return null;
  let end = task.end_datetime ? new Date(task.end_datetime) : new Date(start.getTime() + 3600000);
  if (isNaN(end.getTime())) end = new Date(start.getTime() + 3600000);
  const company = companies.find(c => c.id === task.company_id) || {};
  return { ...task, start, end, company };
}

// VISTA FACTURACION
function BillingView({ bills, companies }) {
  const [detailBill, setDetailBill] = useState(null);
  const today = new Date();

  return (
    <div style={{ flex: 1, overflowY: "auto", padding: "8px 0" }}>
      {companies.map(company => {
        const color  = getCompanyColor(company);
        const cBills = bills.filter(b => b.company_id === company.id);
        const cobrar = cBills.filter(b => b.direction === "cobrar").sort((a,b) => new Date(a.billing_date)-new Date(b.billing_date));
        const pagar  = cBills.filter(b => b.direction === "pagar").sort((a,b) => new Date(a.billing_date)-new Date(b.billing_date));

        return (
          <div key={company.id} style={{ marginBottom: 20, borderRadius: 12, border: `1px solid ${color}40`, overflow: "hidden" }}>
            {/* Cabecera empresa */}
            <div style={{ background: lighten(color, 0.88), borderBottom: `1px solid ${color}30`, padding: "8px 14px", display: "flex", alignItems: "center", gap: 8 }}>
              <span style={{ width: 10, height: 10, borderRadius: "50%", background: color, flexShrink: 0 }} />
              <span style={{ fontWeight: 700, fontSize: 14, color: "#1c1c1e" }}>{company.name}</span>
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 0 }}>
              {/* A cobrar */}
              <div style={{ borderRight: "1px solid #f2f2f7", padding: "8px 10px" }}>
                <div style={{ fontSize: 11, fontWeight: 700, color: "#34C759", textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 6 }}>A cobrar</div>
                {cobrar.length === 0
                  ? <div style={{ fontSize: 12, color: "#c7c7cc" }}>Sin pendientes</div>
                  : cobrar.map(bill => (
                    <MiniBillCard key={bill.id} bill={bill} color="#34C759" onClick={() => setDetailBill(bill)} />
                  ))}
              </div>
              {/* A pagar */}
              <div style={{ padding: "8px 10px" }}>
                <div style={{ fontSize: 11, fontWeight: 700, color: "#FF3B30", textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 6 }}>A pagar</div>
                {pagar.length === 0
                  ? <div style={{ fontSize: 12, color: "#c7c7cc" }}>Sin pendientes</div>
                  : pagar.map(bill => (
                    <MiniBillCard key={bill.id} bill={bill} color="#FF3B30" onClick={() => setDetailBill(bill)} />
                  ))}
              </div>
            </div>
          </div>
        );
      })}

      {/* Modal detalle factura */}
      {detailBill && (
        <div onClick={() => setDetailBill(null)} style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.45)", zIndex: 2000, display: "flex", alignItems: "center", justifyContent: "center" }}>
          <div onClick={e => e.stopPropagation()} style={{ background: "#fff", borderRadius: 16, padding: 28, minWidth: 300, maxWidth: 400, width: "90%", boxShadow: "0 8px 40px rgba(0,0,0,0.2)", display: "flex", flexDirection: "column", gap: 10, borderTop: `4px solid ${detailBill.direction === "cobrar" ? "#34C759" : "#FF3B30"}` }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
              <h3 style={{ margin: 0, fontSize: 18, color: "#1c1c1e" }}>{detailBill.title}</h3>
              <button onClick={() => setDetailBill(null)} style={{ all: "unset", cursor: "pointer", fontSize: 22, color: "#8e8e93" }}>x</button>
            </div>
            <DRow label="Empresa">{companies.find(c => c.id === detailBill.company_id)?.name || "-"}</DRow>
            <DRow label="Tipo">{detailBill.direction === "cobrar" ? "A cobrar" : "A pagar"}</DRow>
            <DRow label="Fecha">{detailBill.billing_date}</DRow>
            <DRow label="Importe"><strong style={{ color: detailBill.direction === "cobrar" ? "#34C759" : "#FF3B30" }}>{detailBill.direction === "cobrar" ? "+" : "-"}{detailBill.amount} EUR</strong></DRow>
            {detailBill.recurrence_type && detailBill.recurrence_type !== "none" && (
              <DRow label="Repeticion">{detailBill.recurrence_type}{detailBill.recurrence_value ? " cada "+detailBill.recurrence_value : ""}</DRow>
            )}
            {detailBill.description && <div style={{ marginTop: 4, fontSize: 14, color: "#636366", lineHeight: 1.6 }}>{detailBill.description}</div>}
            {detailBill.attachments && detailBill.attachments.length > 0 && (
              <div>
                <div style={{ fontSize: 11, fontWeight: 600, color: "#8e8e93", textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 4 }}>Adjuntos</div>
                {detailBill.attachments.map((f,i) => (
                  <a key={i} href={f.url || "#"} target="_blank" rel="noreferrer" style={{ display: "inline-flex", alignItems: "center", gap: 5, padding: "4px 10px", borderRadius: 8, background: "#f2f2f7", fontSize: 12, color: "#007AFF", textDecoration: "none", marginRight: 6 }}>
                    Adjunto {f.name || i+1}
                  </a>
                ))}
              </div>
            )}
            <button onClick={() => setDetailBill(null)} style={{ marginTop: 8, padding: "9px 0", borderRadius: 10, border: "none", background: "#007AFF", color: "#fff", fontWeight: 600, fontSize: 14, cursor: "pointer" }}>Cerrar</button>
          </div>
        </div>
      )}
    </div>
  );
}

function MiniBillCard({ bill, color, onClick }) {
  return (
    <div onClick={onClick} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "5px 8px", borderRadius: 8, background: color + "12", border: `1px solid ${color}30`, marginBottom: 5, cursor: "pointer" }}>
      <div>
        <div style={{ fontSize: 12, fontWeight: 600, color: "#1c1c1e", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", maxWidth: 90 }}>{bill.title}</div>
        <div style={{ fontSize: 11, color: "#8e8e93" }}>{bill.billing_date}</div>
      </div>
      <div style={{ fontSize: 13, fontWeight: 700, color }}>{bill.amount} EUR</div>
    </div>
  );
}

function DRow({ label, children }) {
  return (
    <div style={{ display: "flex", gap: 10, fontSize: 14, padding: "3px 0", borderBottom: "1px solid #f2f2f7" }}>
      <span style={{ minWidth: 90, fontSize: 11, fontWeight: 600, color: "#8e8e93", textTransform: "uppercase", letterSpacing: 0.4 }}>{label}</span>
      <span style={{ color: "#1c1c1e", flex: 1 }}>{children}</span>
    </div>
  );
}

// MODALES
const modalOverlay  = { position: "fixed", inset: 0, background: "rgba(0,0,0,0.42)", zIndex: 1000, display: "flex", alignItems: "center", justifyContent: "center" };
const modalBox      = { background: "#fff", borderRadius: 16, padding: 28, minWidth: 320, maxWidth: 480, width: "92%", boxShadow: "0 8px 40px rgba(0,0,0,0.18)", display: "flex", flexDirection: "column", gap: 12, maxHeight: "90vh", overflowY: "auto" };
const modalActions  = { display: "flex", gap: 8, justifyContent: "flex-end", marginTop: 8 };
const inputStyle    = { padding: "9px 12px", borderRadius: 9, border: "1px solid #d1d1d6", fontSize: 14, outline: "none", width: "100%", boxSizing: "border-box", fontFamily: "inherit" };
const btnPrimary    = { padding: "9px 20px", borderRadius: 9, border: "none", background: "#007AFF", color: "#fff", fontWeight: 600, fontSize: 14, cursor: "pointer" };
const btnSecondary  = { padding: "9px 20px", borderRadius: 9, border: "1px solid #d1d1d6", background: "#fff", fontWeight: 500, fontSize: 14, cursor: "pointer", color: "#1c1c1e" };

function Label({ children }) {
  return <div style={{ fontSize: 12, fontWeight: 600, color: "#8e8e93", textTransform: "uppercase", letterSpacing: 0.4 }}>{children}</div>;
}

// ── PLANNING ─────────────────────────────────────────────────────
const Planning = () => {
  const [companies, setCompanies]               = useState([]);
  const [selectedCompanies, setSelectedCompanies] = useState([]);
  const [search, setSearch]                     = useState("");
  const [userId, setUserId]                     = useState(null);
  const [loading, setLoading]                   = useState(true);
  const [mainView, setMainView]                 = useState("calendar"); // 'calendar' | 'billing'

  // empresa
  const [showAddModal, setShowAddModal]         = useState(false);
  const [addForm, setAddForm]                   = useState({ name: "", phone: "", email: "", responsible: "", color: "#1976d2" });
  const [adding, setAdding]                     = useState(false);
  const [errorAdd, setErrorAdd]                 = useState("");

  // tareas y facturas
  const [tasks, setTasks]                       = useState([]);
  const [bills, setBills]                       = useState([]);
  const [loadingTasks, setLoadingTasks]         = useState(false);
  const [loadingBills, setLoadingBills]         = useState(false);

  // modal tarea
  const [showTaskModal, setShowTaskModal]       = useState(false);
  const [taskForm, setTaskForm]                 = useState({ title: "", description: "", company_id: "", type: "todo", start_datetime: "", end_datetime: "", is_all_day: false, recurrence_type: "none", recurrence_value: null });
  const [taskFiles, setTaskFiles]               = useState([]);
  const [errorTask, setErrorTask]               = useState("");

  // modal facturacion
  const [showBillModal, setShowBillModal]       = useState(false);
  const [billForm, setBillForm]                 = useState({ title: "", description: "", company_id: "", billing_date: "", amount: "", direction: "cobrar", recurrence_type: "none", recurrence_value: null });
  const [billFiles, setBillFiles]               = useState([]);
  const [errorBill, setErrorBill]               = useState("");

  // usuario
  useEffect(() => {
    supabase.auth.getUser().then(({ data: { user } }) => { if (user) setUserId(user.id); });
  }, []);

  // empresas
  useEffect(() => {
    if (!userId) return;
    setLoading(true);
    (async () => {
      try {
        const memberships = await companyService.getMyCompanies();
        const isAdmin = memberships.some(m => m.role === "admin");
        const data = isAdmin ? await companyService.getAllCompanies() : memberships.map(m => m.companies);
        setCompanies(data);
      } catch { setCompanies([]); } finally { setLoading(false); }
    })();
  }, [userId]);

  // tareas/facturas por empresa seleccionada
  useEffect(() => {
    if (!selectedCompanies.length) { setTasks([]); setBills([]); return; }
    const ids = selectedCompanies.map(c => c.id);
    setLoadingTasks(true); setLoadingBills(true);
    getPlanningTasks(ids).then(setTasks).catch(() => setTasks([])).finally(() => setLoadingTasks(false));
    getBilling(ids).then(setBills).catch(() => setBills([])).finally(() => setLoadingBills(false));
  }, [selectedCompanies]);

  const filteredCompanies = companies.filter(c => c.name.toLowerCase().includes(search.toLowerCase()));
  const toggleCompany  = (co) => setSelectedCompanies(prev => prev.some(c => c.id === co.id) ? prev.filter(c => c.id !== co.id) : [...prev, co]);
  const removeCompany  = (id) => setSelectedCompanies(prev => prev.filter(c => c.id !== id));
  const selectAll      = ()   => setSelectedCompanies(filteredCompanies);

  // empresa
  const handleAddCompany = async (e) => {
    e.preventDefault(); setAdding(true); setErrorAdd("");
    try {
      const created = await companyService.createCompany({ ...addForm, user_id: userId });
      setCompanies(prev => [created, ...prev]); setShowAddModal(false);
    } catch { setErrorAdd("Error al crear la empresa"); } finally { setAdding(false); }
  };

  // tarea
  const openTaskModal = () => {
    setTaskForm({ title: "", description: "", company_id: selectedCompanies[0]?.id || "", type: "todo", start_datetime: "", end_datetime: "", is_all_day: false, recurrence_type: "none", recurrence_value: null });
    setTaskFiles([]); setErrorTask(""); setShowTaskModal(true);
  };
  const handleAddTask = async (e) => {
    e.preventDefault(); setErrorTask("");
    if (!taskForm.company_id) { setErrorTask("Selecciona una empresa."); return; }
    try {
      await createPlanningTask({ ...taskForm, created_by: userId });
      const updated = await getPlanningTasks(selectedCompanies.map(c => c.id));
      setTasks(updated); setShowTaskModal(false);
    } catch (err) { setErrorTask(err.message || "Error al crear la tarea"); }
  };

  // facturacion
  const openBillModal = () => {
    setBillForm({ title: "", description: "", company_id: selectedCompanies[0]?.id || "", billing_date: "", amount: "", direction: "cobrar", recurrence_type: "none", recurrence_value: null });
    setBillFiles([]); setErrorBill(""); setShowBillModal(true);
  };
  const handleAddBill = async (e) => {
    e.preventDefault(); setErrorBill("");
    try {
      const created = await createBilling({ ...billForm, created_by: userId });
      setBills(prev => [created, ...prev]); setShowBillModal(false);
    } catch { setErrorBill("Error al crear la facturacion"); }
  };

  // Eventos del calendario
  const calendarEvents = tasks
    .map(t => taskToCalendarEvent(t, companies))
    .filter(Boolean);

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100%", padding: "20px 20px 0", boxSizing: "border-box", gap: 14, fontFamily: "-apple-system, BlinkMacSystemFont, sans-serif" }}>

      {/* ── Selector de empresas ── */}
      <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
        <div style={{ position: "relative" }}>
          <input
            type="text" placeholder="Buscar empresa cliente..."
            style={{ padding: "7px 12px", borderRadius: 8, border: "1px solid #d1d1d6", fontSize: 14, minWidth: 220 }}
            value={search} onChange={e => setSearch(e.target.value)} disabled={loading}
          />
          {search && filteredCompanies.length > 0 && (
            <div style={{ position: "absolute", top: "100%", left: 0, right: 0, background: "#fff", border: "1px solid #e5e5ea", borderRadius: 10, boxShadow: "0 4px 16px rgba(0,0,0,0.12)", zIndex: 20, maxHeight: 200, overflowY: "auto", marginTop: 4 }}>
              {filteredCompanies.map(co => (
                <div key={co.id} style={{ padding: "8px 14px", cursor: "pointer", display: "flex", alignItems: "center", gap: 8, fontSize: 14 }}
                  onClick={() => { toggleCompany(co); setSearch(""); }}>
                  <span style={{ width: 10, height: 10, borderRadius: "50%", background: getCompanyColor(co), flexShrink: 0 }} />
                  {co.name}
                  {selectedCompanies.some(c => c.id === co.id) && <span style={{ marginLeft: "auto", color: "#34C759", fontWeight: 700 }}>v</span>}
                </div>
              ))}
            </div>
          )}
        </div>
        <button onClick={() => { setAddForm({ name: "", phone: "", email: "", responsible: "", color: "#1976d2" }); setErrorAdd(""); setShowAddModal(true); }}
          style={{ padding: "7px 14px", borderRadius: 8, border: "none", background: "#007AFF", color: "#fff", fontSize: 13, fontWeight: 600, cursor: "pointer" }}>
          + Empresa
        </button>
        <button onClick={selectAll}
          style={{ padding: "7px 14px", borderRadius: 8, border: "1px solid #d1d1d6", background: "#fff", fontSize: 13, cursor: "pointer" }}>
          Seleccionar todas
        </button>
      </div>

      {/* ── Bullet-list de empresas seleccionadas ── */}
      {selectedCompanies.length > 0 && (
        <ul style={{ margin: 0, padding: "0 0 0 4px", display: "flex", flexWrap: "wrap", gap: 8, listStyle: "none" }}>
          {selectedCompanies.map(co => {
            const color = getCompanyColor(co);
            return (
              <li key={co.id} style={{ display: "flex", alignItems: "center", gap: 6 }}>
                <span style={{ color, fontSize: 16, lineHeight: 1 }}>•</span>
                <span style={{ fontSize: 13, color: "#1c1c1e", fontWeight: 500 }}>{co.name}</span>
                <button onClick={() => removeCompany(co.id)}
                  style={{ all: "unset", cursor: "pointer", fontSize: 13, color: "#8e8e93", lineHeight: 1, marginLeft: 2 }}>x</button>
              </li>
            );
          })}
        </ul>
      )}

      {/* ── Cuerpo principal ── */}
      <div style={{ display: "flex", flex: 1, gap: 16, minHeight: 0 }}>

        {/* Calendario o Facturacion (4/6) */}
        <div style={{ flex: 4, minHeight: 0, display: "flex", flexDirection: "column" }}>
          {mainView === "calendar"
            ? <CalendarWrapper tasks={calendarEvents} defaultView="week" />
            : (
              <div style={{ flex: 1, overflowY: "auto", background: "#fff", borderRadius: 14, border: "1px solid #e5e5ea", padding: 16 }}>
                {selectedCompanies.length === 0
                  ? <div style={{ color: "#c7c7cc", textAlign: "center", paddingTop: 40 }}>Selecciona al menos una empresa</div>
                  : loadingBills
                    ? <div style={{ color: "#8e8e93", textAlign: "center", paddingTop: 40 }}>Cargando facturacion...</div>
                    : <BillingView bills={bills} companies={selectedCompanies} />
                }
              </div>
            )
          }
        </div>

        {/* Panel lateral (2/6) */}
        <div style={{ flex: 2, display: "flex", flexDirection: "column", gap: 12, minHeight: 0 }}>

          {/* Switcher */}
          <div style={{ display: "flex", background: "#f2f2f7", borderRadius: 10, padding: 3, flexShrink: 0 }}>
            {[{ k: "calendar", l: "Calendario" }, { k: "billing", l: "Facturacion" }].map(v => (
              <button key={v.k} onClick={() => setMainView(v.k)}
                style={{ all: "unset", flex: 1, textAlign: "center", cursor: "pointer", padding: "7px 0", borderRadius: 8, fontSize: 13, fontWeight: mainView === v.k ? 600 : 400, color: "#1c1c1e", background: mainView === v.k ? "#fff" : "transparent", boxShadow: mainView === v.k ? "0 1px 4px rgba(0,0,0,0.12)" : "none", transition: "all 0.12s" }}>
                {v.l}
              </button>
            ))}
          </div>

          {/* Acciones */}
          <button onClick={openTaskModal}
            style={{ padding: "11px 0", borderRadius: 10, border: "none", background: "#007AFF", color: "#fff", fontWeight: 600, fontSize: 14, cursor: "pointer", flexShrink: 0 }}>
            + Nueva tarea
          </button>
          <button onClick={openBillModal}
            style={{ padding: "11px 0", borderRadius: 10, border: "1px solid #d1d1d6", background: "#fff", fontWeight: 600, fontSize: 14, cursor: "pointer", color: "#1c1c1e", flexShrink: 0 }}>
            + Nueva facturacion
          </button>

          {/* Resumen tareas pendientes */}
          {mainView === "calendar" && tasks.length > 0 && (
            <div style={{ flex: 1, overflowY: "auto", paddingTop: 4 }}>
              <div style={{ fontSize: 11, fontWeight: 700, color: "#8e8e93", textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 8 }}>
                Proximas tareas
              </div>
              {tasks.slice(0, 8).map((task, i) => {
                const co = companies.find(c => c.id === task.company_id);
                const color = getCompanyColor(co || {});
                return (
                  <div key={task.id || i} style={{ borderLeft: `3px solid ${color}`, background: lighten(color, 0.85), borderRadius: 8, padding: "7px 10px", marginBottom: 7 }}>
                    <div style={{ fontSize: 12, fontWeight: 600, color: "#1c1c1e", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{task.title}</div>
                    <div style={{ fontSize: 11, color: "#636366" }}>{task.start_datetime?.replace("T"," ").slice(0,16)}</div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* ── MODAL: Anadir empresa ── */}
      {showAddModal && (
        <div style={modalOverlay}>
          <form onSubmit={handleAddCompany} style={modalBox}>
            <h3 style={{ margin: "0 0 4px" }}>Nueva empresa cliente</h3>
            <input required placeholder="Nombre" value={addForm.name} onChange={e => setAddForm(f => ({ ...f, name: e.target.value }))} style={inputStyle} />
            <input placeholder="Telefono" value={addForm.phone} onChange={e => setAddForm(f => ({ ...f, phone: e.target.value }))} style={inputStyle} />
            <input type="email" placeholder="Email" value={addForm.email} onChange={e => setAddForm(f => ({ ...f, email: e.target.value }))} style={inputStyle} />
            <input placeholder="Responsable" value={addForm.responsible} onChange={e => setAddForm(f => ({ ...f, responsible: e.target.value }))} style={inputStyle} />
            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <Label>Color empresa</Label>
              <input type="color" value={addForm.color} onChange={e => setAddForm(f => ({ ...f, color: e.target.value }))} style={{ width: 36, height: 36, border: "none", background: "none", cursor: "pointer" }} />
              <span style={{ fontSize: 12, color: "#8e8e93" }}>{addForm.color}</span>
            </div>
            {errorAdd && <div style={{ color: "#FF3B30", fontSize: 13 }}>{errorAdd}</div>}
            <div style={modalActions}>
              <button type="button" onClick={() => setShowAddModal(false)} style={btnSecondary} disabled={adding}>Cancelar</button>
              <button type="submit" style={btnPrimary} disabled={adding}>{adding ? "Guardando..." : "Guardar"}</button>
            </div>
          </form>
        </div>
      )}

      {/* ── MODAL: Crear tarea ── */}
      {showTaskModal && (
        <div style={modalOverlay}>
          <form onSubmit={handleAddTask} style={modalBox}>
            <h3 style={{ margin: "0 0 4px" }}>Nueva tarea</h3>
            <input required placeholder="Titulo" value={taskForm.title} onChange={e => setTaskForm(f => ({ ...f, title: e.target.value }))} style={inputStyle} />
            <textarea placeholder="Descripcion" value={taskForm.description} onChange={e => setTaskForm(f => ({ ...f, description: e.target.value }))} style={{ ...inputStyle, minHeight: 68, resize: "vertical" }} />
            <select required value={taskForm.company_id} onChange={e => setTaskForm(f => ({ ...f, company_id: e.target.value }))} style={inputStyle}>
              <option value="">Selecciona empresa</option>
              {companies.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
            <select value={taskForm.type} onChange={e => setTaskForm(f => ({ ...f, type: e.target.value }))} style={inputStyle}>
              <option value="todo">ToDo / Tarea</option>
              <option value="reunion">Reunion</option>
              <option value="entregable">Entregable</option>
              <option value="recibir_pago">Recibir pago</option>
              <option value="realizar_pago">Realizar pago</option>
            </select>
            <Label>Fecha inicio</Label>
            <input type="datetime-local" required value={taskForm.start_datetime} onChange={e => setTaskForm(f => ({ ...f, start_datetime: e.target.value }))} style={inputStyle} />
            <Label>Fecha fin (opcional)</Label>
            <input type="datetime-local" value={taskForm.end_datetime} onChange={e => setTaskForm(f => ({ ...f, end_datetime: e.target.value }))} style={inputStyle} />
            <label style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 14 }}>
              <input type="checkbox" checked={taskForm.is_all_day} onChange={e => setTaskForm(f => ({ ...f, is_all_day: e.target.checked }))} />
              Todo el dia
            </label>
            <div style={{ display: "flex", gap: 8 }}>
              <select value={taskForm.recurrence_type} onChange={e => setTaskForm(f => ({ ...f, recurrence_type: e.target.value }))} style={{ ...inputStyle, flex: 2 }}>
                <option value="none">Sin repeticion</option>
                <option value="hourly">Cada hora</option>
                <option value="daily">Diaria</option>
                <option value="weekly">Semanal</option>
                <option value="yearly">Anual</option>
              </select>
              {taskForm.recurrence_type !== "none" && (
                <input type="number" min="1" placeholder="Frecuencia" value={taskForm.recurrence_value || ""} onChange={e => setTaskForm(f => ({ ...f, recurrence_value: e.target.value ? Number(e.target.value) : null }))} style={{ ...inputStyle, flex: 1, minWidth: 80 }} />
              )}
            </div>
            <Label>Adjuntar archivos</Label>
            <input type="file" multiple onChange={e => setTaskFiles(Array.from(e.target.files))} style={{ fontSize: 13 }} />
            {taskFiles.length > 0 && <div style={{ fontSize: 12, color: "#636366" }}>{taskFiles.map(f => f.name).join(", ")}</div>}
            {errorTask && <div style={{ color: "#FF3B30", fontSize: 13 }}>{errorTask}</div>}
            <div style={modalActions}>
              <button type="button" onClick={() => setShowTaskModal(false)} style={btnSecondary}>Cancelar</button>
              <button type="submit" style={btnPrimary}>Guardar</button>
            </div>
          </form>
        </div>
      )}

      {/* ── MODAL: Crear facturacion ── */}
      {showBillModal && (
        <div style={modalOverlay}>
          <form onSubmit={handleAddBill} style={modalBox}>
            <h3 style={{ margin: "0 0 4px" }}>Nueva facturacion</h3>
            <input required placeholder="Titulo" value={billForm.title} onChange={e => setBillForm(f => ({ ...f, title: e.target.value }))} style={inputStyle} />
            <textarea placeholder="Descripcion" value={billForm.description} onChange={e => setBillForm(f => ({ ...f, description: e.target.value }))} style={{ ...inputStyle, minHeight: 68, resize: "vertical" }} />
            <select required value={billForm.company_id} onChange={e => setBillForm(f => ({ ...f, company_id: e.target.value }))} style={inputStyle}>
              <option value="">Selecciona empresa</option>
              {companies.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
            <Label>Fecha de facturacion</Label>
            <input type="date" required value={billForm.billing_date} onChange={e => setBillForm(f => ({ ...f, billing_date: e.target.value }))} style={inputStyle} />
            <input type="number" required placeholder="Importe (EUR)" value={billForm.amount} onChange={e => setBillForm(f => ({ ...f, amount: e.target.value }))} style={inputStyle} />
            <select value={billForm.direction} onChange={e => setBillForm(f => ({ ...f, direction: e.target.value }))} style={inputStyle}>
              <option value="cobrar">A cobrar</option>
              <option value="pagar">A pagar</option>
            </select>
            <div style={{ display: "flex", gap: 8 }}>
              <select value={billForm.recurrence_type} onChange={e => setBillForm(f => ({ ...f, recurrence_type: e.target.value }))} style={{ ...inputStyle, flex: 2 }}>
                <option value="none">Sin repeticion</option>
                <option value="hourly">Cada hora</option>
                <option value="daily">Diaria</option>
                <option value="weekly">Semanal</option>
                <option value="yearly">Anual</option>
              </select>
              {billForm.recurrence_type !== "none" && (
                <input type="number" min="1" placeholder="Frecuencia" value={billForm.recurrence_value || ""} onChange={e => setBillForm(f => ({ ...f, recurrence_value: e.target.value ? Number(e.target.value) : null }))} style={{ ...inputStyle, flex: 1, minWidth: 80 }} />
              )}
            </div>
            <Label>Adjuntar archivos</Label>
            <input type="file" multiple onChange={e => setBillFiles(Array.from(e.target.files))} style={{ fontSize: 13 }} />
            {billFiles.length > 0 && <div style={{ fontSize: 12, color: "#636366" }}>{billFiles.map(f => f.name).join(", ")}</div>}
            {errorBill && <div style={{ color: "#FF3B30", fontSize: 13 }}>{errorBill}</div>}
            <div style={modalActions}>
              <button type="button" onClick={() => setShowBillModal(false)} style={btnSecondary}>Cancelar</button>
              <button type="submit" style={btnPrimary}>Guardar</button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
};

export default Planning;
