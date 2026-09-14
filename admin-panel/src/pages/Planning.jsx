import { useEffect, useRef, useState } from "react";
import { format, addHours } from "date-fns";
import {
  getClientCompaniesByCompany,
  createClientCompany,
} from "../services/clientCompanyService";
import {
  getPlanningTasks, createPlanningTask, getBilling, createBilling,
  uploadPlannerFiles, deletePlanningTask, updatePlanningTask,
  deleteBilling, updateBilling,
} from "../services/planningService";
import { supabase } from "../lib/supabaseClient";
import { useCompany } from "../contexts/CompanyContext";
import { useLanguage } from "../contexts/LanguageContext";
import CalendarWrapper from "../components/planning/CalendarWrapper";
import DateTimeFields from "../components/planning/DateTimeFields";
import RecurrenceFields from "../components/planning/RecurrenceFields";
import { expandRecurringTasks, expandRecurringBills, formatRecurrence } from "../lib/recurrence";

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

// task.client_company_id → la empresa CLIENTE (no la tenant) a la que
// pertenece. Puede ser null: tareas generales sin empresa asociada (un
// recordatorio propio, por ejemplo) son válidas.
function taskToCalendarEvent(task, clientCompanies) {
  if (!task || !task.title || !task.start_datetime) return null;
  const start = new Date(task.start_datetime);
  if (isNaN(start.getTime())) return null;
  let end = task.end_datetime ? new Date(task.end_datetime) : new Date(start.getTime() + 3600000);
  if (isNaN(end.getTime())) end = new Date(start.getTime() + 3600000);
  const idx     = task.client_company_id ? clientCompanies.findIndex(c => c.id === task.client_company_id) : -1;
  const company = idx >= 0 ? clientCompanies[idx] : null;
  const _color  = getCompanyColor(company, idx >= 0 ? idx : undefined);
  return { ...task, start, end, company, _color };
}

// Formatea un Date a 'yyyy-MM-ddTHH:mm' para <input type="datetime-local">
function toDatetimeLocalValue(date) {
  return format(date, "yyyy-MM-dd'T'HH:mm");
}

function BillingAttachmentLink({ file, index }) {
  const { t } = useLanguage();
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
    } catch { alert(t('planning.fileOpenError')); }
  };
  return (
    <a href="#" onClick={handleClick}
      style={{ display: "inline-flex", alignItems: "center", gap: 5, padding: "4px 10px", borderRadius: 8, background: "#f2f2f7", fontSize: 12, color: "#007AFF", textDecoration: "none" }}>
      📎 {file.name || `${index + 1}`}
    </a>
  );
}

function downloadInvoicePDF(bill, clientCompanies, t) {
  const company = clientCompanies.find(c => c.id === bill.client_company_id);
  const companyName = company?.name || "-";
  const isCobrar = bill.direction === "cobrar";
  const invoiceNum = `FAC-${bill.id ? String(bill.id).slice(0,8).toUpperCase() : Date.now()}`;
  const today = new Date().toLocaleDateString(undefined, { year: "numeric", month: "long", day: "numeric" });
  const recurrenceLabel = bill.recurrence_type && bill.recurrence_type !== "none"
    ? formatRecurrence(bill.recurrence_type, bill.recurrence_value, t)
    : null;
  const html = `<!DOCTYPE html>
<html>
<head>
<meta charset="UTF-8" />
<title>${invoiceNum}</title>
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
      <h2>${isCobrar ? t('planning.invoiceToReceive') : t('planning.invoiceToPay')}</h2>
      <p>${invoiceNum}</p>
      <p>${t('planning.invoiceIssuedOn')} ${today}</p>
    </div>
  </div>

  <div class="section">
    <div class="section-title">${t('planning.invoiceDetail')}</div>
    <div class="row"><span class="label">${t('planning.invoiceConcept')}</span><span class="value">${bill.title || "-"}</span></div>
    <div class="row"><span class="label">${t('planning.companyLabel')}</span><span class="value">${companyName}</span></div>
    <div class="row"><span class="label">${t('planning.billingDateLabel')}</span><span class="value">${bill.billing_date || "-"}</span></div>
    <div class="row"><span class="label">${t('planning.typeLabel')}</span><span class="value">${isCobrar ? t('planning.directionReceive') : t('planning.directionPay')}</span></div>
    ${recurrenceLabel ? `<div class="row"><span class="label">${t('planning.recurrenceLabel')}</span><span class="value">${recurrenceLabel}</span></div>` : ""}
  </div>

  ${bill.description ? `<div class="section"><div class="section-title">${t('planning.descriptionLabel')}</div><div class="description-box">${bill.description}</div></div>` : ""}

  <div class="amount-box">
    <span class="amt-label">${t('planning.invoiceTotalAmount')}</span>
    <span class="amt-value">${isCobrar ? "+" : "-"}${bill.amount} EUR</span>
  </div>

  <div class="footer">${t('planning.invoiceGeneratedOn')} ${today} — ${invoiceNum}</div>
</div>
<script>window.onload = function(){ window.print(); }</script>
</body>
</html>`;

  const win = window.open("", "_blank", "width=820,height=1100");
  if (!win) { alert(t('planning.popupBlockedWarning')); return; }
  win.document.write(html);
  win.document.close();
}

// VISTA FACTURACION
function BillingView({ bills, clientCompanies, onDelete, onEdit }) {
  const { t } = useLanguage();
  const [detailBill, setDetailBill] = useState(null);
  const [confirmingDelete, setConfirmingDelete] = useState(false);

  return (
    <div style={{ flex: 1, overflowY: "auto", padding: "8px 0" }}>
      {clientCompanies.map(company => {
        const color  = getCompanyColor(company);
        const cBills = bills.filter(b => b.client_company_id === company.id);
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
                <div style={{ fontSize: 11, fontWeight: 700, color: "#34C759", textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 6 }}>{t('planning.toReceive')}</div>
                {cobrar.length === 0
                  ? <div style={{ fontSize: 12, color: "#c7c7cc" }}>{t('planning.noPending')}</div>
                  : cobrar.map(bill => (
                    <MiniBillCard key={bill._occurrenceKey || bill.id} bill={bill} color="#34C759" onClick={() => setDetailBill(bill)} />
                  ))}
              </div>
              {/* A pagar */}
              <div style={{ padding: "8px 10px" }}>
                <div style={{ fontSize: 11, fontWeight: 700, color: "#FF3B30", textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 6 }}>{t('planning.toPay')}</div>
                {pagar.length === 0
                  ? <div style={{ fontSize: 12, color: "#c7c7cc" }}>{t('planning.noPending')}</div>
                  : pagar.map(bill => (
                    <MiniBillCard key={bill._occurrenceKey || bill.id} bill={bill} color="#FF3B30" onClick={() => setDetailBill(bill)} />
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
              <button onClick={() => setDetailBill(null)} style={{ all: "unset", cursor: "pointer", fontSize: 22, color: "#8e8e93" }}>×</button>
            </div>
            <DRow label={t('planning.companyLabel')}>{clientCompanies.find(c => c.id === detailBill.client_company_id)?.name || "-"}</DRow>
            <DRow label={t('planning.typeLabel')}>{detailBill.direction === "cobrar" ? t('planning.directionReceive') : t('planning.directionPay')}</DRow>
            <DRow label={t('planning.dateLabel')}>{detailBill.billing_date}</DRow>
            <DRow label={t('planning.amountLabel')}><strong style={{ color: detailBill.direction === "cobrar" ? "#34C759" : "#FF3B30" }}>{detailBill.direction === "cobrar" ? "+" : "-"}{detailBill.amount} EUR</strong></DRow>
            {detailBill.recurrence_type && detailBill.recurrence_type !== "none" && (
              <DRow label={t('planning.recurrenceLabel')}>
                {formatRecurrence(detailBill.recurrence_type, detailBill.recurrence_value, t)}
              </DRow>
            )}
            {detailBill.description && <div style={{ marginTop: 4, fontSize: 14, color: "#636366", lineHeight: 1.6 }}>{detailBill.description}</div>}
            {detailBill.attachments && detailBill.attachments.length > 0 && (
              <div>
                <div style={{ fontSize: 11, fontWeight: 600, color: "#8e8e93", textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 4 }}>{t('planning.attachmentsLabel')}</div>
                <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                  {detailBill.attachments.map((f, i) => (
                    <BillingAttachmentLink key={i} file={f} index={i} />
                  ))}
                </div>
              </div>
            )}
            <button onClick={() => downloadInvoicePDF(detailBill, clientCompanies, t)} style={{ width: "100%", padding: "10px 0", borderRadius: 10, border: "1.5px solid #5856D6", background: "#fff", color: "#5856D6", fontWeight: 600, fontSize: 14, cursor: "pointer", marginTop: 2 }}>{t('planning.downloadInvoicePdf')}</button>
            <div style={{ display: "flex", gap: 8, marginTop: 4 }}>
              {onEdit && (
                <button onClick={() => { onEdit(detailBill); setDetailBill(null); setConfirmingDelete(false); }} style={{ flex: 1, padding: "9px 0", borderRadius: 10, border: "1px solid #007AFF", background: "#fff", color: "#007AFF", fontWeight: 600, fontSize: 14, cursor: "pointer" }}>{t('common.edit')}</button>
              )}
              {onDelete && (
                confirmingDelete
                  ? <button onClick={() => { onDelete(detailBill.id); setDetailBill(null); setConfirmingDelete(false); }} style={{ flex: 1, padding: "9px 0", borderRadius: 10, border: "none", background: "#FF3B30", color: "#fff", fontWeight: 600, fontSize: 14, cursor: "pointer" }}>{t('planning.confirmDelete')}</button>
                  : <button onClick={() => setConfirmingDelete(true)} style={{ flex: 1, padding: "9px 0", borderRadius: 10, border: "1px solid #FF3B30", background: "#fff", color: "#FF3B30", fontWeight: 600, fontSize: 14, cursor: "pointer" }}>{t('common.delete')}</button>
              )}
              <button onClick={() => { setDetailBill(null); setConfirmingDelete(false); }} style={{ flex: 1, padding: "9px 0", borderRadius: 10, border: "none", background: "#007AFF", color: "#fff", fontWeight: 600, fontSize: 14, cursor: "pointer" }}>{t('common.close')}</button>
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

const emptyTaskForm = { title: "", description: "", client_company_id: "", type: "todo", start_datetime: "", end_datetime: "", is_all_day: false, recurrence_type: "none", recurrence_value: null };
const emptyBillForm = { title: "", description: "", client_company_id: "", billing_date: "", amount: "", direction: "cobrar", recurrence_type: "none", recurrence_value: null };

// ── PLANNING ─────────────────────────────────────────────────────
const Planning = () => {
  const { selectedCompany } = useCompany();
  const { t } = useLanguage();

  const [clientCompanies, setClientCompanies]         = useState([]);
  const [selectedCompanies, setSelectedCompanies]     = useState([]);
  const [search, setSearch]                           = useState("");
  const [userId, setUserId]                           = useState(null);
  const [loading, setLoading]                         = useState(true);
  const [mainView, setMainView]                       = useState("calendar"); // 'calendar' | 'billing'

  // Altura real disponible hasta el borde de la ventana. El contenedor de
  // .page no tiene una altura acotada (crece con el contenido y es la
  // ventana la que hace scroll), así que el "flex:1 + overflow" del
  // calendario nunca tenía un límite real del que recortar — por eso se
  // veía más alto que la pantalla en vez de scrollear por dentro.
  const pageRef = useRef(null);
  const [pageHeight, setPageHeight] = useState(null);

  useEffect(() => {
    function updateHeight() {
      if (!pageRef.current) return;
      const top = pageRef.current.getBoundingClientRect().top;
      setPageHeight(Math.max(420, window.innerHeight - top - 20));
    }
    updateHeight();
    window.addEventListener("resize", updateHeight);
    return () => window.removeEventListener("resize", updateHeight);
  }, []);

  // empresa cliente
  const [showAddModal, setShowAddModal]         = useState(false);
  const [addForm, setAddForm]                   = useState({ name: "", phone: "", email: "", responsible: "", color: "#1976d2" });
  const [adding, setAdding]                     = useState(false);
  const [errorAdd, setErrorAdd]                 = useState("");

  // tareas y facturas
  const [tasks, setTasks]                       = useState([]);
  const [bills, setBills]                       = useState([]);
  const [loadingBills, setLoadingBills]         = useState(false);

  // modal tarea
  const [showTaskModal, setShowTaskModal]       = useState(false);
  const [taskForm, setTaskForm]                 = useState(emptyTaskForm);
  const [taskFiles, setTaskFiles]               = useState([]);
  const [errorTask, setErrorTask]               = useState("");
  const [editingTask, setEditingTask]           = useState(null);

  // modal facturacion
  const [showBillModal, setShowBillModal]       = useState(false);
  const [billForm, setBillForm]                 = useState(emptyBillForm);
  const [billFiles, setBillFiles]               = useState([]);
  const [errorBill, setErrorBill]               = useState("");
  const [editingBill, setEditingBill]           = useState(null);

  // usuario
  useEffect(() => {
    supabase.auth.getUser().then(({ data: { user } }) => { if (user) setUserId(user.id); });
  }, []);

  // empresas cliente de la empresa tenant seleccionada
  useEffect(() => {
    if (!selectedCompany?.id) return;
    setLoading(true);
    getClientCompaniesByCompany(selectedCompany.id)
      .then(setClientCompanies)
      .catch(() => setClientCompanies([]))
      .finally(() => setLoading(false));
    // Al cambiar de empresa tenant, la selección de clientes anterior ya no aplica
    setSelectedCompanies([]);
  }, [selectedCompany?.id]);

  // Tareas: siempre se cargan (aunque no haya ninguna empresa seleccionada),
  // porque las tareas generales sin empresa asociada deben verse siempre.
  // Facturas: solo tiene sentido si hay al menos una empresa seleccionada
  // (una factura siempre pertenece a un cliente).
  useEffect(() => {
    if (!selectedCompany?.id) { setTasks([]); setBills([]); return; }
    const ids = selectedCompanies.map(c => c.id);
    getPlanningTasks(selectedCompany.id, ids).then(setTasks).catch(() => setTasks([]));
    if (ids.length) {
      setLoadingBills(true);
      getBilling(selectedCompany.id, ids).then(setBills).catch(() => setBills([])).finally(() => setLoadingBills(false));
    } else {
      setBills([]);
    }
  }, [selectedCompany?.id, selectedCompanies]);

  const filteredCompanies = clientCompanies.filter(c => c.name.toLowerCase().includes(search.toLowerCase()));
  const toggleCompany  = (co) => setSelectedCompanies(prev => prev.some(c => c.id === co.id) ? prev.filter(c => c.id !== co.id) : [...prev, co]);
  const removeCompany  = (id) => setSelectedCompanies(prev => prev.filter(c => c.id !== id));
  const selectAll      = ()   => setSelectedCompanies(filteredCompanies);

  // empresa cliente
  const handleAddCompany = async (e) => {
    e.preventDefault(); setAdding(true); setErrorAdd("");
    try {
      const created = await createClientCompany({
        name:        addForm.name,
        phone:       addForm.phone || null,
        email:       addForm.email || null,
        responsible: addForm.responsible || null,
        color:       addForm.color,
        user_id:     userId,
        company_id:  selectedCompany.id,
      });
      setClientCompanies(prev => [created, ...prev]); setShowAddModal(false);
    } catch { setErrorAdd(t('planning.addCompanyError')); } finally { setAdding(false); }
  };

  // tarea
  const openTaskModal = (prefillDate) => {
    setEditingTask(null);
    setTaskForm({
      ...emptyTaskForm,
      client_company_id: selectedCompanies[0]?.id || "",
      start_datetime: prefillDate ? toDatetimeLocalValue(prefillDate) : "",
    });
    setTaskFiles([]); setErrorTask(""); setShowTaskModal(true);
  };
  const handleAddTask = async (e) => {
    e.preventDefault(); setErrorTask("");
    try {
      const normalizedTask = {
        ...taskForm,
        client_company_id: taskForm.client_company_id || null, // tarea general, sin empresa
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
        await createPlanningTask({ ...normalizedTask, attachments, created_by: userId, company_id: selectedCompany.id });
      }
      const updated = await getPlanningTasks(selectedCompany.id, selectedCompanies.map(c => c.id));
      setTasks(updated); setShowTaskModal(false); setEditingTask(null);
    } catch (err) { setErrorTask(err.message || t('planning.taskSaveError')); }
  };

  // facturacion
  const openBillModal = () => {
    setEditingBill(null);
    setBillForm({ ...emptyBillForm, client_company_id: selectedCompanies[0]?.id || "" });
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
      } else {
        await createBilling({ ...billForm, attachments, created_by: userId, company_id: selectedCompany.id });
      }
      const updated = await getBilling(selectedCompany.id, selectedCompanies.map(c => c.id));
      setBills(updated); setShowBillModal(false); setEditingBill(null);
    } catch (err) { setErrorBill(err.message || t('planning.billingSaveError')); }
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
      title:              task.title || "",
      description:        task.description || "",
      client_company_id:  task.client_company_id || "",
      type:               task.type || "todo",
      start_datetime:     task.start_datetime || "",
      end_datetime:       task.end_datetime || "",
      is_all_day:         task.is_all_day || false,
      recurrence_type:    task.recurrence_type || "none",
      recurrence_value:   task.recurrence_value || null,
    });
    setTaskFiles([]); setErrorTask(""); setShowTaskModal(true);
  };

  // clic en hueco vacío del calendario → crear tarea con esa fecha/hora
  const handleSelectSlot = (date) => {
    openTaskModal(date);
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
      title:              bill.title || "",
      description:        bill.description || "",
      client_company_id:  bill.client_company_id || "",
      billing_date:       bill.billing_date || "",
      amount:             bill.amount || "",
      direction:          bill.direction || "cobrar",
      recurrence_type:    bill.recurrence_type || "none",
      recurrence_value:   bill.recurrence_value || null,
    });
    setBillFiles([]); setErrorBill(""); setShowBillModal(true);
  };

  // Eventos del calendario — cada tarea recurrente se expande en sus
  // ocurrencias virtuales (ver src/lib/recurrence.js) antes de convertirla
  // en evento del calendario, así "semanal" de verdad aparece cada semana.
  const calendarEvents = expandRecurringTasks(tasks)
    .map(t => taskToCalendarEvent(t, clientCompanies))
    .filter(Boolean);

  // Facturas expandidas igual, para la vista de facturación
  const expandedBills = expandRecurringBills(bills);

  if (!selectedCompany) {
    return (
      <div className="page">
        <div className="page-content">
          <p>{t('dashboard.selectCompanyDescription')}</p>
        </div>
      </div>
    );
  }

  return (
    <div ref={pageRef} className="planning-page" style={{ display: "flex", flexDirection: "column", height: pageHeight ? `${pageHeight}px` : "100%", padding: "20px 20px 0", boxSizing: "border-box", gap: 14, fontFamily: "-apple-system, BlinkMacSystemFont, sans-serif" }}>

      {/* ── Selector de empresas ── */}
      <div className="planning-company-row" style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
        <div style={{ position: "relative" }}>
          <input
            type="text" placeholder={t('planning.searchPlaceholder')}
            style={{ padding: "7px 12px", borderRadius: 8, border: "1px solid #d1d1d6", fontSize: 14, minWidth: 220 }}
            value={search} onChange={e => setSearch(e.target.value)} disabled={loading}
          />
          {search && filteredCompanies.length > 0 && (
            <div style={{ position: "absolute", top: "100%", left: 0, right: 0, background: "#fff", border: "1px solid #e5e5ea", borderRadius: 10, boxShadow: "0 4px 16px rgba(0,0,0,0.12)", zIndex: 20, maxHeight: 200, overflowY: "auto", marginTop: 4 }}>
              {filteredCompanies.map((co) => (
                <div key={co.id} style={{ padding: "8px 14px", cursor: "pointer", display: "flex", alignItems: "center", gap: 8, fontSize: 14 }}
                  onClick={() => { toggleCompany(co); setSearch(""); }}>
                  <span style={{ width: 10, height: 10, borderRadius: "50%", background: getCompanyColor(co, clientCompanies.findIndex(c => c.id === co.id)), flexShrink: 0 }} />
                  {co.name}
                  {selectedCompanies.some(c => c.id === co.id) && <span style={{ marginLeft: "auto", color: "#34C759", fontWeight: 700 }}>✓</span>}
                </div>
              ))}
            </div>
          )}
        </div>
        <button onClick={() => { setAddForm({ name: "", phone: "", email: "", responsible: "", color: "#1976d2" }); setErrorAdd(""); setShowAddModal(true); }}
          style={{ padding: "7px 14px", borderRadius: 8, border: "none", background: "#007AFF", color: "#fff", fontSize: 13, fontWeight: 600, cursor: "pointer" }}>
          {t('planning.addCompany')}
        </button>
        <button onClick={selectAll}
          style={{ padding: "7px 14px", borderRadius: 8, border: "1px solid #d1d1d6", background: "#fff", fontSize: 13, cursor: "pointer" }}>
          {t('planning.selectAll')}
        </button>
      </div>

      {/* ── Bullet-list de empresas seleccionadas ── */}
      {selectedCompanies.length > 0 && (
        <ul className="planning-chips" style={{ margin: 0, padding: "0 0 0 4px", display: "flex", flexWrap: "wrap", gap: 8, listStyle: "none" }}>
          {selectedCompanies.map(co => {
            const idx = clientCompanies.findIndex(c => c.id === co.id);
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
      <div className="planning-body" style={{ display: "flex", flex: 1, gap: 16, minHeight: 0 }}>

        {/* Calendario o Facturacion (4/6) */}
        <div className="planning-main-area" style={{ flex: 4, minHeight: 0, display: "flex", flexDirection: "column" }}>
          {mainView === "calendar"
            ? <CalendarWrapper tasks={calendarEvents} defaultView="week" onDeleteTask={handleDeleteTask} onEditTask={handleEditTask} onSelectSlot={handleSelectSlot} />
            : (
              <div style={{ flex: 1, overflowY: "auto", background: "#fff", borderRadius: 14, border: "1px solid #e5e5ea", padding: 16 }}>
                {selectedCompanies.length === 0
                  ? <div style={{ color: "#c7c7cc", textAlign: "center", paddingTop: 40 }}>{t('planning.selectCompanyPrompt')}</div>
                  : loadingBills
                    ? <div style={{ color: "#8e8e93", textAlign: "center", paddingTop: 40 }}>{t('planning.loadingBilling')}</div>
                    : <BillingView bills={expandedBills} clientCompanies={selectedCompanies} onDelete={handleDeleteBill} onEdit={handleEditBill} />
                }
              </div>
            )
          }
        </div>

        {/* Panel lateral (2/6) */}
        <div className="planning-sidebar" style={{ flex: 2, display: "flex", flexDirection: "column", gap: 12, minHeight: 0 }}>

          {/* Switcher */}
          <div style={{ display: "flex", background: "#f2f2f7", borderRadius: 10, padding: 3, flexShrink: 0 }}>
            {[{ k: "calendar", l: t('planning.switcherCalendar') }, { k: "billing", l: t('planning.switcherBilling') }].map(v => (
              <button key={v.k} onClick={() => setMainView(v.k)}
                style={{ all: "unset", flex: 1, textAlign: "center", cursor: "pointer", padding: "7px 0", borderRadius: 8, fontSize: 13, fontWeight: mainView === v.k ? 600 : 400, color: "#1c1c1e", background: mainView === v.k ? "#fff" : "transparent", boxShadow: mainView === v.k ? "0 1px 4px rgba(0,0,0,0.12)" : "none", transition: "all 0.12s" }}>
                {v.l}
              </button>
            ))}
          </div>

          {/* Acciones */}
          <button onClick={() => openTaskModal()}
            style={{ padding: "11px 0", borderRadius: 10, border: "none", background: "#007AFF", color: "#fff", fontWeight: 600, fontSize: 14, cursor: "pointer", flexShrink: 0 }}>
            {t('planning.newTask')}
          </button>
          <button onClick={openBillModal}
            style={{ padding: "11px 0", borderRadius: 10, border: "1px solid #d1d1d6", background: "#fff", fontWeight: 600, fontSize: 14, cursor: "pointer", color: "#1c1c1e", flexShrink: 0 }}>
            {t('planning.newBilling')}
          </button>

          {/* Resumen tareas pendientes */}
          {mainView === "calendar" && tasks.length > 0 && (
            <div style={{ flex: 1, overflowY: "auto", paddingTop: 4 }}>
              <div style={{ fontSize: 11, fontWeight: 700, color: "#8e8e93", textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 8 }}>
                {t('planning.upcomingTasks')}
              </div>
              {tasks.slice(0, 8).map((task, i) => {
                const co = clientCompanies.find(c => c.id === task.client_company_id);
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
            <h3 style={{ margin: "0 0 4px" }}>{t('planning.newCompanyTitle')}</h3>
            <input required placeholder={t('planning.namePlaceholder')} value={addForm.name} onChange={e => setAddForm(f => ({ ...f, name: e.target.value }))} style={inputStyle} />
            <input placeholder={t('planning.phonePlaceholder')} value={addForm.phone} onChange={e => setAddForm(f => ({ ...f, phone: e.target.value }))} style={inputStyle} />
            <input type="email" placeholder={t('planning.emailPlaceholder')} value={addForm.email} onChange={e => setAddForm(f => ({ ...f, email: e.target.value }))} style={inputStyle} />
            <input placeholder={t('planning.responsiblePlaceholder')} value={addForm.responsible} onChange={e => setAddForm(f => ({ ...f, responsible: e.target.value }))} style={inputStyle} />
            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <Label>{t('planning.colorLabel')}</Label>
              <input type="color" value={addForm.color} onChange={e => setAddForm(f => ({ ...f, color: e.target.value }))} style={{ width: 36, height: 36, border: "none", background: "none", cursor: "pointer" }} />
              <span style={{ fontSize: 12, color: "#8e8e93" }}>{addForm.color}</span>
            </div>
            {errorAdd && <div style={{ color: "#FF3B30", fontSize: 13 }}>{errorAdd}</div>}
            <div style={modalActions}>
              <button type="button" onClick={() => setShowAddModal(false)} style={btnSecondary} disabled={adding}>{t('common.cancel')}</button>
              <button type="submit" style={btnPrimary} disabled={adding}>{adding ? t('common.savingChanges') : t('common.save')}</button>
            </div>
          </form>
        </div>
      )}

      {/* ── MODAL: Crear tarea ── */}
      {showTaskModal && (
        <div style={modalOverlay}>
          <form onSubmit={handleAddTask} style={modalBox}>
            <h3 style={{ margin: "0 0 4px" }}>{editingTask ? t('planning.editTaskTitle') : t('planning.newTaskTitle')}</h3>
            <input required placeholder={t('planning.titlePlaceholder')} value={taskForm.title} onChange={e => setTaskForm(f => ({ ...f, title: e.target.value }))} style={inputStyle} />
            <textarea placeholder={t('planning.descriptionPlaceholder')} value={taskForm.description} onChange={e => setTaskForm(f => ({ ...f, description: e.target.value }))} style={{ ...inputStyle, minHeight: 68, resize: "vertical" }} />
            <select value={taskForm.client_company_id} onChange={e => setTaskForm(f => ({ ...f, client_company_id: e.target.value }))} style={inputStyle}>
              <option value="">{t('planning.noCompanyOption')}</option>
              {clientCompanies.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
            <select value={taskForm.type} onChange={e => setTaskForm(f => ({ ...f, type: e.target.value }))} style={inputStyle}>
              <option value="todo">{t('planning.typeTodo')}</option>
              <option value="reunion">{t('planning.typeMeeting')}</option>
              <option value="entregable">{t('planning.typeDeliverable')}</option>
              <option value="recibir_pago">{t('planning.typeReceivePayment')}</option>
              <option value="realizar_pago">{t('planning.typeMakePayment')}</option>
            </select>
            <label style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 14, padding: "2px 0" }}>
              <input type="checkbox" checked={taskForm.is_all_day} onChange={e => setTaskForm(f => ({ ...f, is_all_day: e.target.checked, end_datetime: "" }))} />
              <span style={{ fontWeight: 500 }}>{t('planning.allDayLabel')}</span>
              <span style={{ fontSize: 12, color: "#8e8e93" }}>{t('planning.allDayHint')}</span>
            </label>
            {taskForm.is_all_day ? (
              <>
                <Label>{t('planning.dateLabel')}</Label>
                <input type="date" required value={taskForm.start_datetime?.slice(0,10) || ""} onChange={e => setTaskForm(f => ({ ...f, start_datetime: e.target.value + "T08:00", end_datetime: e.target.value + "T08:30" }))} style={inputStyle} />
              </>
            ) : (
              <>
                <Label>{t('planning.startDateLabel')}</Label>
                <DateTimeFields required value={taskForm.start_datetime} onChange={v => setTaskForm(f => ({
                  ...f,
                  start_datetime: v,
                  // Al fijar el inicio, si no hay fin (todavía), se propone +1h — el
                  // usuario puede cambiarlo después sin que se vuelva a sobrescribir.
                  end_datetime: !f.end_datetime && v ? toDatetimeLocalValue(addHours(new Date(v), 1)) : f.end_datetime,
                }))} />
                <Label>{t('planning.endDateLabel')}</Label>
                <DateTimeFields value={taskForm.end_datetime} onChange={v => setTaskForm(f => ({ ...f, end_datetime: v }))} />
              </>
            )}
            <RecurrenceFields
              type={taskForm.recurrence_type}
              value={taskForm.recurrence_value}
              onChange={({ recurrence_type, recurrence_value }) => setTaskForm(f => ({ ...f, recurrence_type, recurrence_value }))}
            />
            <Label>{t('planning.attachFiles')}</Label>
            <input type="file" multiple onChange={e => setTaskFiles(Array.from(e.target.files))} style={{ fontSize: 13 }} />
            {taskFiles.length > 0 && <div style={{ fontSize: 12, color: "#636366" }}>{taskFiles.map(f => f.name).join(", ")}</div>}
            {errorTask && <div style={{ color: "#FF3B30", fontSize: 13 }}>{errorTask}</div>}
            <div style={modalActions}>
              <button type="button" onClick={() => { setShowTaskModal(false); setEditingTask(null); }} style={btnSecondary}>{t('common.cancel')}</button>
              <button type="submit" style={btnPrimary}>{t('common.save')}</button>
            </div>
          </form>
        </div>
      )}

      {/* ── MODAL: Crear facturacion ── */}
      {showBillModal && (
        <div style={modalOverlay}>
          <form onSubmit={handleAddBill} style={modalBox}>
            <h3 style={{ margin: "0 0 4px" }}>{editingBill ? t('planning.editBillingTitle') : t('planning.newBillingTitle')}</h3>
            <input required placeholder={t('planning.titlePlaceholder')} value={billForm.title} onChange={e => setBillForm(f => ({ ...f, title: e.target.value }))} style={inputStyle} />
            <textarea placeholder={t('planning.descriptionPlaceholder')} value={billForm.description} onChange={e => setBillForm(f => ({ ...f, description: e.target.value }))} style={{ ...inputStyle, minHeight: 68, resize: "vertical" }} />
            <select required value={billForm.client_company_id} onChange={e => setBillForm(f => ({ ...f, client_company_id: e.target.value }))} style={inputStyle}>
              <option value="">{t('planning.selectCompanyOption')}</option>
              {clientCompanies.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
            <Label>{t('planning.billingDateLabel')}</Label>
            <input type="date" required value={billForm.billing_date} onChange={e => setBillForm(f => ({ ...f, billing_date: e.target.value }))} style={inputStyle} />
            <input type="number" required placeholder={t('planning.amountPlaceholder')} value={billForm.amount} onChange={e => setBillForm(f => ({ ...f, amount: e.target.value }))} style={inputStyle} />
            <select value={billForm.direction} onChange={e => setBillForm(f => ({ ...f, direction: e.target.value }))} style={inputStyle}>
              <option value="cobrar">{t('planning.directionReceive')}</option>
              <option value="pagar">{t('planning.directionPay')}</option>
            </select>
            <RecurrenceFields
              type={billForm.recurrence_type}
              value={billForm.recurrence_value}
              onChange={({ recurrence_type, recurrence_value }) => setBillForm(f => ({ ...f, recurrence_type, recurrence_value }))}
            />
            <Label>{t('planning.attachFiles')}</Label>
            <input type="file" multiple onChange={e => setBillFiles(Array.from(e.target.files))} style={{ fontSize: 13 }} />
            {billFiles.length > 0 && <div style={{ fontSize: 12, color: "#636366" }}>{billFiles.map(f => f.name).join(", ")}</div>}
            {errorBill && <div style={{ color: "#FF3B30", fontSize: 13 }}>{errorBill}</div>}
            <div style={modalActions}>
              <button type="button" onClick={() => { setShowBillModal(false); setEditingBill(null); }} style={btnSecondary}>{t('common.cancel')}</button>
              <button type="submit" style={btnPrimary}>{t('common.save')}</button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
};

export default Planning;
