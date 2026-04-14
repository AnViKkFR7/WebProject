import React, { useEffect, useState, useRef } from "react";
import { format } from "date-fns";
import { companyService } from "../services/companyService";
import { getPlanningTasks, createPlanningTask, getBilling, createBilling, uploadPlannerFiles, deletePlanningTask, updatePlanningTask, deleteBilling, updateBilling } from "../services/planningService";
import { supabase } from "../lib/supabaseClient";
import CalendarWrapper from "../components/planning/CalendarWrapper";

const PALETTE = [
  "#007AFF", "#FF3B30", "#34C759", "#FF9500", "#AF52DE",
  "#5856D6", "#FF2D55", "#00C7BE", "#FF6B6B", "#FFD60A",
  "#BF5AF2", "#4ECDC4", "#45B7D1", "#30D158", "#FF8C42",
  "#6BCB77",
];

function getCompanyColor(company, idx) {
  if (!company) return PALETTE[0];
  if (company.color) return company.color;
  // idx pasado explícitamente → paleta por posición
  if (idx !== undefined) return PALETTE[idx % PALETTE.length];
  // fallback: hash del id → índice en paleta (siempre vivo)
  let hash = 0;
  const str = company.id || company.name || "";
  for (let i = 0; i < str.length; i++) hash = str.charCodeAt(i) + ((hash << 5) - hash);
  return PALETTE[Math.abs(hash) % PALETTE.length];
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
  const idx     = companies.findIndex(c => c.id === task.company_id);
  const company = idx >= 0 ? companies[idx] : {};
  const _color  = getCompanyColor(company, idx >= 0 ? idx : undefined);
  return { ...task, start, end, company, _color };
}

function BillingAttachmentLink({ file, index }) {
  const handleClick = async (e) => {
    e.preventDefault();
    try {
      if (file.path) {
        const { data, error } = await supabase.storage.from('media-planner').createSignedUrl(file.path, 3600);
        if (error) throw error;
        window.open(data.signedUrl, '_blank');
      } else if (file.url) {
        window.open(file.url, '_blank');
      }
    } catch { alert('No se pudo abrir el archivo.'); }
  };
  return (
    <a href="#" onClick={handleClick}
      style={{ display: "inline-flex", alignItems: "center", gap: 5, padding: "4px 10px", borderRadius: 8, background: "#f2f2f7", fontSize: 12, color: "#007AFF", textDecoration: "none" }}>
      📎 {file.name || `Archivo ${index + 1}`}
    </a>
  );
}

function downloadInvoicePDF(bill, companies) {
  const company = companies.find(c => c.id === bill.company_id);
  const companyName = company?.name || "Empresa desconocida";
  const isCobrar = bill.direction === "cobrar";
  const invoiceNum = `FAC-${bill.id ? String(bill.id).slice(0,8).toUpperCase() : Date.now()}`;
  const today = new Date().toLocaleDateString("es-ES", { year: "numeric", month: "long", day: "numeric" });
  const html = `<!DOCTYPE html>
<html lang="es">
<head>
<meta charset="UTF-8" />
<title>Factura ${invoiceNum}</title>
<style>
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; color: #1c1c1e; background: #fff; padding: 48px; }
  .invoice { max-width: 720px; margin: 0 auto; }
  .header { display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 40px; padding-bottom: 24px; border-bottom: 3px solid ${isCobrar ? "#34C759" : "#FF3B30"}; }
  .company-name { font-size: 36px; font-weight: 800; color: #1c1c1e; letter-spacing: -1px; }
  .invoice-label { text-align: right; }
  .invoice-label h2 { font-size: 22px; font-weight: 700; color: ${isCobrar ? "#34C759" : "#FF3B30"}; text-transform: uppercase; letter-spacing: 2px; }
  .invoice-label p { font-size: 13px; color: #8e8e93; margin-top: 4px; }
  .section { margin-bottom: 32px; }
  .section-title { font-size: 11px; font-weight: 700; text-transform: uppercase; letter-spacing: 1px; color: #8e8e93; margin-bottom: 8px; }
  .row { display: flex; justify-content: space-between; padding: 10px 0; border-bottom: 1px solid #f2f2f7; font-size: 15px; }
  .row .label { color: #636366; font-weight: 500; }
  .row .value { font-weight: 600; color: #1c1c1e; }
  .amount-box { background: ${isCobrar ? "#34C75912" : "#FF3B3012"}; border: 1.5px solid ${isCobrar ? "#34C759" : "#FF3B30"}; border-radius: 12px; padding: 20px 24px; display: flex; justify-content: space-between; align-items: center; margin-top: 12px; }
  .amount-box .amt-label { font-size: 14px; font-weight: 600; color: #636366; text-transform: uppercase; letter-spacing: 0.5px; }
  .amount-box .amt-value { font-size: 32px; font-weight: 800; color: ${isCobrar ? "#34C759" : "#FF3B30"}; }
  .description-box { background: #f9f9f9; border-radius: 10px; padding: 14px 18px; font-size: 14px; color: #3a3a3c; line-height: 1.6; }
  .footer { margin-top: 48px; padding-top: 16px; border-top: 1px solid #e5e5ea; font-size: 12px; color: #aeaeb2; text-align: center; }
  @media print { body { padding: 0; } .invoice { padding: 32px; } }
</style>
</head>
<body>
<div class="invoice">
  <div class="header">
    <div class="company-name">${companyName}</div>
    <div class="invoice-label">
      <h2>${isCobrar ? "Factura a cobrar" : "Factura a pagar"}</h2>
      <p>${invoiceNum}</p>
      <p>Emitida el ${today}</p>
    </div>
  </div>

  <div class="section">
    <div class="section-title">Detalle</div>
    <div class="row"><span class="label">Concepto</span><span class="value">${bill.title || "-"}</span></div>
    <div class="row"><span class="label">Empresa</span><span class="value">${companyName}</span></div>
    <div class="row"><span class="label">Fecha de facturación</span><span class="value">${bill.billing_date || "-"}</span></div>
    <div class="row"><span class="label">Tipo</span><span class="value">${isCobrar ? "A cobrar" : "A pagar"}</span></div>
    ${bill.recurrence_type && bill.recurrence_type !== "none" ? `<div class="row"><span class="label">Repetición</span><span class="value">${bill.recurrence_type}${bill.recurrence_value ? " cada " + bill.recurrence_value : ""}</span></div>` : ""}
  </div>

  ${bill.description ? `<div class="section"><div class="section-title">Descripción / Notas</div><div class="description-box">${bill.description}</div></div>` : ""}

  <div class="amount-box">
    <span class="amt-label">Importe total</span>
    <span class="amt-value">${isCobrar ? "+" : "-"}${bill.amount} EUR</span>
  </div>

  <div class="footer">Documento generado el ${today} — ${invoiceNum}</div>
</div>
<script>window.onload = function(){ window.print(); }<\/script>
</body>
</html>`;

  const win = window.open("", "_blank", "width=820,height=1100");
  if (!win) { alert("Permite ventanas emergentes para descargar la factura."); return; }
  win.document.write(html);
  win.document.close();
}

// VISTA FACTURACION
function BillingView({ bills, companies, onDelete, onEdit }) {
  const [detailBill, setDetailBill] = useState(null);
  const [confirmingDelete, setConfirmingDelete] = useState(false);
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
        <div onClick={() => { setDetailBill(null); setConfirmingDelete(false); }} style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.45)", zIndex: 2000, display: "flex", alignItems: "center", justifyContent: "center" }}>
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
                <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                  {detailBill.attachments.map((f, i) => (
                    <BillingAttachmentLink key={i} file={f} index={i} />
                  ))}
                </div>
              </div>
            )}
            <button onClick={() => downloadInvoicePDF(detailBill, companies)} style={{ width: "100%", padding: "10px 0", borderRadius: 10, border: "1.5px solid #5856D6", background: "#fff", color: "#5856D6", fontWeight: 600, fontSize: 14, cursor: "pointer", marginTop: 2 }}>Descargar factura PDF</button>
            <div style={{ display: "flex", gap: 8, marginTop: 4 }}>
              {onEdit && (
                <button onClick={() => { onEdit(detailBill); setDetailBill(null); setConfirmingDelete(false); }} style={{ flex: 1, padding: "9px 0", borderRadius: 10, border: "1px solid #007AFF", background: "#fff", color: "#007AFF", fontWeight: 600, fontSize: 14, cursor: "pointer" }}>Editar</button>
              )}
              {onDelete && (
                confirmingDelete
                  ? <button onClick={() => { onDelete(detailBill.id); setDetailBill(null); setConfirmingDelete(false); }} style={{ flex: 1, padding: "9px 0", borderRadius: 10, border: "none", background: "#FF3B30", color: "#fff", fontWeight: 600, fontSize: 14, cursor: "pointer" }}>¿Confirmar?</button>
                  : <button onClick={() => setConfirmingDelete(true)} style={{ flex: 1, padding: "9px 0", borderRadius: 10, border: "1px solid #FF3B30", background: "#fff", color: "#FF3B30", fontWeight: 600, fontSize: 14, cursor: "pointer" }}>Eliminar</button>
              )}
              <button onClick={() => { setDetailBill(null); setConfirmingDelete(false); }} style={{ flex: 1, padding: "9px 0", borderRadius: 10, border: "none", background: "#007AFF", color: "#fff", fontWeight: 600, fontSize: 14, cursor: "pointer" }}>Cerrar</button>
            </div>
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
  const [editingTask, setEditingTask]           = useState(null);

  // modal facturacion
  const [showBillModal, setShowBillModal]       = useState(false);
  const [billForm, setBillForm]                 = useState({ title: "", description: "", company_id: "", billing_date: "", amount: "", direction: "cobrar", recurrence_type: "none", recurrence_value: null });
  const [billFiles, setBillFiles]               = useState([]);
  const [errorBill, setErrorBill]               = useState("");
  const [editingBill, setEditingBill]           = useState(null);

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
      const created = await companyService.createCompany({
        name:          addForm.name,
        contact_email: addForm.email || "sin-email@placeholder.com",
        contact_phone: addForm.phone || "-",
        color:         addForm.color,
        description:   addForm.responsible ? `Responsable: ${addForm.responsible}` : undefined,
        user_id:       userId,
      });
      setCompanies(prev => [created, ...prev]); setShowAddModal(false);
    } catch { setErrorAdd("Error al crear la empresa"); } finally { setAdding(false); }
  };

  // tarea
  const openTaskModal = () => {
    setEditingTask(null);
    setTaskForm({ title: "", description: "", company_id: selectedCompanies[0]?.id || "", type: "todo", start_datetime: "", end_datetime: "", is_all_day: false, recurrence_type: "none", recurrence_value: null });
    setTaskFiles([]); setErrorTask(""); setShowTaskModal(true);
  };
  const handleAddTask = async (e) => {
    e.preventDefault(); setErrorTask("");
    if (!taskForm.company_id) { setErrorTask("Selecciona una empresa."); return; }
    try {
      const normalizedTask = {
        ...taskForm,
        start_datetime: taskForm.start_datetime || null,
        end_datetime: taskForm.end_datetime || null,
        recurrence_value: taskForm.recurrence_value || null,
      };
      const attachments = taskFiles.length > 0
        ? await uploadPlannerFiles(taskFiles, "tasks")
        : (editingTask?.attachments || []);
      if (editingTask) {
        await updatePlanningTask(editingTask.id, { ...normalizedTask, attachments });
      } else {
        await createPlanningTask({ ...normalizedTask, attachments, created_by: userId });
      }
      const updated = await getPlanningTasks(selectedCompanies.map(c => c.id));
      setTasks(updated); setShowTaskModal(false); setEditingTask(null);
    } catch (err) { setErrorTask(err.message || "Error al guardar la tarea"); }
  };

  // facturacion
  const openBillModal = () => {
    setEditingBill(null);
    setBillForm({ title: "", description: "", company_id: selectedCompanies[0]?.id || "", billing_date: "", amount: "", direction: "cobrar", recurrence_type: "none", recurrence_value: null });
    setBillFiles([]); setErrorBill(""); setShowBillModal(true);
  };
  const handleAddBill = async (e) => {
    e.preventDefault(); setErrorBill("");
    try {
      const attachments = billFiles.length > 0
        ? await uploadPlannerFiles(billFiles, "billing")
        : (editingBill?.attachments || []);
      if (editingBill) {
        await updateBilling(editingBill.id, { ...billForm, attachments });
        setBills(prev => prev.map(b => b.id === editingBill.id ? { ...b, ...billForm, attachments } : b));
      } else {
        const created = await createBilling({ ...billForm, attachments, created_by: userId });
        setBills(prev => [created, ...prev]);
      }
      setShowBillModal(false); setEditingBill(null);
    } catch { setErrorBill("Error al guardar la facturacion"); }
  };

  // delete / edit tarea
  const handleDeleteTask = async (id) => {
    try {
      await deletePlanningTask(id);
      setTasks(prev => prev.filter(t => t.id !== id));
    } catch { /* silencioso */ }
  };
  const handleEditTask = (task) => {
    setEditingTask(task);
    setTaskForm({
      title:            task.title || "",
      description:      task.description || "",
      company_id:       task.company_id || "",
      type:             task.type || "todo",
      start_datetime:   task.start_datetime || "",
      end_datetime:     task.end_datetime || "",
      is_all_day:       task.is_all_day || false,
      recurrence_type:  task.recurrence_type || "none",
      recurrence_value: task.recurrence_value || null,
    });
    setTaskFiles([]); setErrorTask(""); setShowTaskModal(true);
  };

  // delete / edit facturación
  const handleDeleteBill = async (id) => {
    try {
      await deleteBilling(id);
      setBills(prev => prev.filter(b => b.id !== id));
    } catch { /* silencioso */ }
  };
  const handleEditBill = (bill) => {
    setEditingBill(bill);
    setBillForm({
      title:            bill.title || "",
      description:      bill.description || "",
      company_id:       bill.company_id || "",
      billing_date:     bill.billing_date || "",
      amount:           bill.amount || "",
      direction:        bill.direction || "cobrar",
      recurrence_type:  bill.recurrence_type || "none",
      recurrence_value: bill.recurrence_value || null,
    });
    setBillFiles([]); setErrorBill(""); setShowBillModal(true);
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
              {filteredCompanies.map((co, i) => (
                <div key={co.id} style={{ padding: "8px 14px", cursor: "pointer", display: "flex", alignItems: "center", gap: 8, fontSize: 14 }}
                  onClick={() => { toggleCompany(co); setSearch(""); }}>
                  <span style={{ width: 10, height: 10, borderRadius: "50%", background: getCompanyColor(co, companies.findIndex(c => c.id === co.id)), flexShrink: 0 }} />
                  {co.name}
                  {selectedCompanies.some(c => c.id === co.id) && <span style={{ marginLeft: "auto", color: "#34C759", fontWeight: 700 }}>✓</span>}
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
            const idx = companies.findIndex(c => c.id === co.id);
            const color = getCompanyColor(co, idx);
            return (
              <li key={co.id} style={{ display: "flex", alignItems: "center", gap: 6, background: color + "18", border: `1px solid ${color}50`, borderRadius: 20, padding: "3px 10px 3px 6px" }}>
                <span style={{ width: 10, height: 10, borderRadius: "50%", background: color, flexShrink: 0 }} />
                <span style={{ fontSize: 13, color: "#1c1c1e", fontWeight: 500 }}>{co.name}</span>
                <button onClick={() => removeCompany(co.id)}
                  style={{ all: "unset", cursor: "pointer", fontSize: 13, color: color, fontWeight: 700, lineHeight: 1, marginLeft: 2 }}>×</button>
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
            ? <CalendarWrapper tasks={calendarEvents} defaultView="week" onDeleteTask={handleDeleteTask} onEditTask={handleEditTask} />
            : (
              <div style={{ flex: 1, overflowY: "auto", background: "#fff", borderRadius: 14, border: "1px solid #e5e5ea", padding: 16 }}>
                {selectedCompanies.length === 0
                  ? <div style={{ color: "#c7c7cc", textAlign: "center", paddingTop: 40 }}>Selecciona al menos una empresa</div>
                  : loadingBills
                    ? <div style={{ color: "#8e8e93", textAlign: "center", paddingTop: 40 }}>Cargando facturacion...</div>
                    : <BillingView bills={bills} companies={selectedCompanies} onDelete={handleDeleteBill} onEdit={handleEditBill} />
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
            <h3 style={{ margin: "0 0 4px" }}>{editingTask ? "Editar tarea" : "Nueva tarea"}</h3>
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
            <label style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 14, padding: "2px 0" }}>
              <input type="checkbox" checked={taskForm.is_all_day} onChange={e => setTaskForm(f => ({ ...f, is_all_day: e.target.checked, end_datetime: "" }))} />
              <span style={{ fontWeight: 500 }}>Todo el día</span>
              <span style={{ fontSize: 12, color: "#8e8e93" }}>(se mostrará a las 08:00 durante 30 min)</span>
            </label>
            {taskForm.is_all_day ? (
              <>
                <Label>Fecha</Label>
                <input type="date" required value={taskForm.start_datetime?.slice(0,10) || ""} onChange={e => setTaskForm(f => ({ ...f, start_datetime: e.target.value + "T08:00", end_datetime: e.target.value + "T08:30" }))} style={inputStyle} />
              </>
            ) : (
              <>
                <Label>Fecha inicio</Label>
                <input type="datetime-local" required value={taskForm.start_datetime} onChange={e => setTaskForm(f => ({ ...f, start_datetime: e.target.value }))} style={inputStyle} />
                <Label>Fecha fin (opcional)</Label>
                <input type="datetime-local" value={taskForm.end_datetime} onChange={e => setTaskForm(f => ({ ...f, end_datetime: e.target.value }))} style={inputStyle} />
              </>
            )}
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
              <button type="button" onClick={() => { setShowTaskModal(false); setEditingTask(null); }} style={btnSecondary}>Cancelar</button>
              <button type="submit" style={btnPrimary}>Guardar</button>
            </div>
          </form>
        </div>
      )}

      {/* ── MODAL: Crear facturacion ── */}
      {showBillModal && (
        <div style={modalOverlay}>
          <form onSubmit={handleAddBill} style={modalBox}>
            <h3 style={{ margin: "0 0 4px" }}>{editingBill ? "Editar facturacion" : "Nueva facturacion"}</h3>
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
              <button type="button" onClick={() => { setShowBillModal(false); setEditingBill(null); }} style={btnSecondary}>Cancelar</button>
              <button type="submit" style={btnPrimary}>Guardar</button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
};

export default Planning;
