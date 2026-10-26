import { useCallback, useEffect, useRef, useState } from "react";
import {
  getClientCompaniesByCompany, createClientCompany,
} from "../services/clientCompanyService";
import {
  getPlanningTasks, createPlanningTask, getBilling, createBilling,
  uploadPlannerFiles, deletePlanningTask, updatePlanningTask,
  deleteBilling, updateBilling, movePlanningTask, undoPlanningTaskMove,
} from "../services/planningService";
import { supabase } from "../lib/supabaseClient";
import { useCompany } from "../contexts/CompanyContext";
import { useLanguage } from "../contexts/LanguageContext";
import { useFeedback } from "../contexts/FeedbackContext";
import { usePermissions } from "../hooks/usePermissions";
import { expandRecurringTasks, expandRecurringBills } from "../lib/recurrence";
import { localInputToISO, toLocalInputValue, formatDateTime } from "../lib/dates";
import { taskHourLater } from "../lib/dateInput";
import { getCompanyColor } from "../lib/planningColors";
import { mergeAttachments, removeAttachment } from "../lib/attachments";
import { normalizeReminders } from "../lib/reminders";
import { toDateOnly } from "../lib/planningRange";
import { movedPlanningTask } from "../lib/planningTaskMove";
import CalendarWrapper from "../components/planning/CalendarWrapper";
import BillingView from "../components/planning/BillingView";
import PlanningEmailFailures from "../components/planning/PlanningEmailFailures";
import TaskFormModal from "../components/planning/TaskFormModal";
import BillingFormModal from "../components/planning/BillingFormModal";
import ClientCompanyModal from "../components/planning/ClientCompanyModal";
import Icon from "../components/ui/Icon";
import EmptyState from "../components/ui/EmptyState";
import "../styles/planning.css";

const emptyTaskForm = {
  title: "", description: "", client_company_id: "", type: "todo",
  start_datetime: "", end_datetime: "", is_all_day: false,
  recurrence_type: "none", recurrence_value: null, reminders: [],
};
const emptyBillForm = {
  title: "", description: "", client_company_id: "", billing_date: "",
  amount: "", direction: "cobrar", recurrence_type: "none", recurrence_value: null,
};
const emptyCompanyForm = { name: "", tax_id:"", billing_address:"", phone: "", email: "", responsible: "", color: "#1976d2" };

// La selección de clientes se recuerda por empresa: antes se perdía al refrescar
const selectionKey = (companyId) => `moira.planning.clients.${companyId}`;

function readSelection(companyId) {
  try {
    return JSON.parse(localStorage.getItem(selectionKey(companyId)) || "[]");
  } catch {
    return [];
  }
}

function storeSelection(companyId, ids) {
  try {
    localStorage.setItem(selectionKey(companyId), JSON.stringify(ids));
  } catch {
    // Almacenamiento bloqueado: la selección dura lo que la sesión
  }
}

function taskToCalendarEvent(task, clientCompanies) {
  if (!task?.title || !task.start_datetime) return null;
  const start = new Date(task.start_datetime);
  if (isNaN(start.getTime())) return null;
  let end = task.end_datetime ? new Date(task.end_datetime) : new Date(start.getTime() + 3600000);
  if (isNaN(end.getTime())) end = new Date(start.getTime() + 3600000);
  const idx = task.client_company_id ? clientCompanies.findIndex(c => c.id === task.client_company_id) : -1;
  const company = idx >= 0 ? clientCompanies[idx] : null;
  return { ...task, start, end, company, _color: getCompanyColor(company, idx) };
}

const Planning = () => {
  const { selectedCompany, user } = useCompany();
  if (!selectedCompany) return null;
  return <PlanningWorkspace key={`${user?.id}-${selectedCompany.id}`} />;
};

const PlanningWorkspace = () => {
  const { selectedCompany } = useCompany();
  const { t } = useLanguage();
  const { toast } = useFeedback();
  const { canEdit } = usePermissions();
  const companyId = selectedCompany?.id;

  const [clientCompanies, setClientCompanies] = useState([]);
  const [selectedIds, setSelectedIds] = useState([]);
  const [search, setSearch] = useState("");
  const [userId, setUserId] = useState(null);
  const [loading, setLoading] = useState(true);
  const [mainView, setMainView] = useState("calendar");
  const [range, setRange] = useState(null);

  const [tasks, setTasks] = useState([]);
  const [bills, setBills] = useState([]);
  const [loadingBills, setLoadingBills] = useState(false);
  // Un fallo de carga no es "no hay tareas": se avisa y se conserva lo que había
  const [loadError, setLoadError] = useState(false);
  const [reloadKey, setReloadKey] = useState(0);

  const [companyModal, setCompanyModal] = useState(false);
  const [companyForm, setCompanyForm] = useState(emptyCompanyForm);
  const [companyError, setCompanyError] = useState("");

  const [taskModal, setTaskModal] = useState(false);
  const [taskForm, setTaskForm] = useState(emptyTaskForm);
  const [taskAttachments, setTaskAttachments] = useState([]);
  const [taskFiles, setTaskFiles] = useState([]);
  const [taskError, setTaskError] = useState("");
  const [editingTask, setEditingTask] = useState(null);

  const [billModal, setBillModal] = useState(false);
  const [billForm, setBillForm] = useState(emptyBillForm);
  const [billAttachments, setBillAttachments] = useState([]);
  const [billFiles, setBillFiles] = useState([]);
  const [billError, setBillError] = useState("");
  const [editingBill, setEditingBill] = useState(null);

  const [saving, setSaving] = useState(false);
  const [lastMove,setLastMove]=useState(null)
  const workspaceActive=useRef(true)
  useEffect(()=>{workspaceActive.current=true;return()=>{workspaceActive.current=false}},[])
  useEffect(()=>{if(!lastMove)return;const timer=setTimeout(()=>setLastMove(null),10000);return()=>clearTimeout(timer)},[lastMove])

  // El calendario crece hasta el borde de la ventana; .page no acota la altura,
  // así que sin esto el "flex:1 + overflow" no tenía de dónde recortar
  const pageRef = useRef(null);
  const [pageHeight, setPageHeight] = useState(null);

  useEffect(() => {
    const updateHeight = () => {
      if (!pageRef.current || window.innerWidth <= 900) { setPageHeight(null); return; }
      const top = pageRef.current.getBoundingClientRect().top;
      setPageHeight(Math.max(420, window.innerHeight - top - 20));
    };
    updateHeight();
    window.addEventListener("resize", updateHeight);
    return () => window.removeEventListener("resize", updateHeight);
  }, []);

  useEffect(() => {
    supabase.auth.getUser().then(({ data: { user } }) => { if (user) setUserId(user.id); });
  }, []);

  // Empresas cliente + selección recordada
  useEffect(() => {
    if (!companyId) return;
    let active = true;
    setLoading(true);
    getClientCompaniesByCompany(companyId)
      .then((list) => {
        if (!active) return;
        setClientCompanies(list);
        const stored = readSelection(companyId).filter(id => list.some(c => c.id === id));
        setSelectedIds(stored);
      })
      .catch(() => { if (active) setLoadError(true); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [companyId, reloadKey]);

  // Solo el tramo visible del calendario, no todo el histórico.
  // Las tareas recurrentes se traen siempre: su fila original puede ser antigua
  // y sus ocurrencias caer dentro del rango (ver services/planningService.js).
  useEffect(() => {
    if (!companyId || !range) { return; }
    let active = true;
    getPlanningTasks(companyId, selectedIds, range.from, range.to)
      .then(data => { if (active) setTasks(data); })
      .catch(() => { if (active) setLoadError(true); });
    return () => { active = false; };
  }, [companyId, selectedIds, range, reloadKey]);

  useEffect(() => {
    if (!companyId || selectedIds.length === 0) { setBills([]); return; }
    let active = true;
    setLoadingBills(true);
    getBilling(companyId, selectedIds, range && toDateOnly(range.from), range && toDateOnly(range.to))
      .then(data => { if (active) setBills(data); })
      .catch(() => { if (active) setLoadError(true); })
      .finally(() => { if (active) setLoadingBills(false); });
    return () => { active = false; };
  }, [companyId, selectedIds, range, reloadKey]);

  const onRangeChange = useCallback((next) => {
    setRange(prev => (prev?.from === next.from && prev?.to === next.to ? prev : next));
  }, []);

  const retryLoad = () => { setLoadError(false); setReloadKey(k => k + 1); };

  const selectedCompanies = clientCompanies.filter(c => selectedIds.includes(c.id));
  const filteredCompanies = clientCompanies.filter(c => c.name.toLowerCase().includes(search.toLowerCase()));

  const updateSelection = (ids) => {
    setSelectedIds(ids);
    if (companyId) storeSelection(companyId, ids);
  };
  const toggleCompany = (co) => updateSelection(
    selectedIds.includes(co.id) ? selectedIds.filter(id => id !== co.id) : [...selectedIds, co.id],
  );

  // ── Empresa cliente ──
  const handleAddCompany = async (e) => {
    e.preventDefault();
    setSaving(true); setCompanyError("");
    try {
      const created = await createClientCompany({
        name: companyForm.name,
        tax_id:companyForm.tax_id || null,
        billing_address:companyForm.billing_address || null,
        phone: companyForm.phone || null,
        email: companyForm.email || null,
        responsible: companyForm.responsible || null,
        color: companyForm.color,
        user_id: userId,
        company_id: companyId,
      });
      setClientCompanies(prev => [created, ...prev]);
      updateSelection([...selectedIds, created.id]);
      setCompanyModal(false);
    } catch {
      setCompanyError(t('planning.addCompanyError'));
    } finally {
      setSaving(false);
    }
  };

  // ── Tareas ──
  const openTaskModal = (prefillDate) => {
    setEditingTask(null);
    setTaskForm({
      ...emptyTaskForm,
      client_company_id: selectedIds[0] || "",
      start_datetime: prefillDate ? toLocalInputValue(prefillDate) : "",
      end_datetime: prefillDate ? taskHourLater(toLocalInputValue(prefillDate)) : "",
    });
    setTaskAttachments([]); setTaskFiles([]); setTaskError(""); setTaskModal(true);
  };

  const handleEditTask = (task) => {
    setEditingTask(task);
    setTaskForm({
      title: task.title || "",
      description: task.description || "",
      client_company_id: task.client_company_id || "",
      type: task.type || "todo",
      start_datetime: toLocalInputValue(task.start_datetime),
      end_datetime: toLocalInputValue(task.end_datetime),
      is_all_day: task.is_all_day || false,
      recurrence_type: task.recurrence_type || "none",
      recurrence_value: task.recurrence_value || null,
      reminders: normalizeReminders(task.reminders),
    });
    setTaskAttachments(task.attachments || []);
    setTaskFiles([]); setTaskError(""); setTaskModal(true);
  };

  const handleSubmitTask = async (e) => {
    e.preventDefault();
    setSaving(true); setTaskError("");
    try {
      if (!taskForm.start_datetime || !localInputToISO(taskForm.start_datetime) || (taskForm.end_datetime && (!localInputToISO(taskForm.end_datetime) || new Date(taskForm.end_datetime)<=new Date(taskForm.start_datetime)))) throw new Error(t('dateInput.endAfterStart'));
      const uploaded = taskFiles.length > 0 ? await uploadPlannerFiles(taskFiles, "tasks", companyId) : [];
      const payload = {
        ...taskForm,
        client_company_id: taskForm.client_company_id || null,
        // El formulario está en hora local; se guarda en ISO con zona (lib/dates.js)
        start_datetime: localInputToISO(taskForm.start_datetime),
        end_datetime: localInputToISO(taskForm.end_datetime),
        recurrence_value: taskForm.recurrence_value || null,
        reminders: normalizeReminders(taskForm.reminders),
        attachments: mergeAttachments(taskAttachments, uploaded),
      };
      if (editingTask) {
        await updatePlanningTask(editingTask.id, payload);
      } else {
        await createPlanningTask({ ...payload, created_by: userId, company_id: companyId });
      }
      setTaskModal(false); setEditingTask(null);
      setReloadKey(k => k + 1);
      toast.success(t('planning.taskSaved'));
    } catch (err) {
      setTaskError(err.message || t('planning.taskSaveError'));
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteTask = async (id) => {
    try {
      await deletePlanningTask(id);
      setTasks(prev => prev.filter(task => task.id !== id));
      toast.success(t('feedback.taskDeleted'));
    } catch {
      toast.error(t('feedback.deleteError'));
    }
  };

  const persistTaskMove=async(task,change)=>{
    if(!canEdit||saving)return
    const recurring=task.recurrence_type&&task.recurrence_type!=='none'
    const accepted=await confirm({title:t('planning.moveTaskTitle'),message:recurring?t('planning.moveSeriesWarning'):t('planning.moveTaskWarning'),confirmLabel:t('planning.moveTaskConfirm')})
    if(!accepted||!workspaceActive.current||!companyId)return
    setSaving(true)
    try{
      const dates=movedPlanningTask(task,change)
      const result=await movePlanningTask(companyId,task,dates)
      if(!workspaceActive.current)return
      setLastMove({id:result.move_id,taskId:task.id,version:result.version})
      setReloadKey(key=>key+1);toast.success(t('planning.taskMoveSaved'))
    }catch{if(workspaceActive.current)toast.error(t('planning.taskMoveError'))}
    finally{if(workspaceActive.current)setSaving(false)}
  }
  const undoTaskMove=async()=>{
    if(!lastMove||!companyId||saving)return
    setSaving(true)
    try{await undoPlanningTaskMove(companyId,lastMove.taskId,lastMove.id,lastMove.version);if(!workspaceActive.current)return;setLastMove(null);setReloadKey(key=>key+1);toast.success(t('planning.taskMoveUndone'))}
    catch{if(workspaceActive.current){setLastMove(null);toast.error(t('planning.taskMoveUndoError'))}}
    finally{if(workspaceActive.current)setSaving(false)}
  }

  // ── Facturación ──
  const handleEditBill = (bill) => {
    setEditingBill(bill);
    setBillForm({
      title: bill.title || "",
      description: bill.description || "",
      client_company_id: bill.client_company_id || "",
      billing_date: bill.billing_date || "",
      amount: bill.amount || "",
      direction: bill.direction || "cobrar",
      recurrence_type: bill.recurrence_type || "none",
      recurrence_value: bill.recurrence_value || null,
    });
    setBillAttachments(bill.attachments || []);
    setBillFiles([]); setBillError(""); setBillModal(true);
  };

  const handleSubmitBill = async (e) => {
    e.preventDefault();
    setSaving(true); setBillError("");
    try {
      const uploaded = billFiles.length > 0 ? await uploadPlannerFiles(billFiles, "billing", companyId) : [];
      const payload = { ...billForm, attachments: mergeAttachments(billAttachments, uploaded) };
      if (editingBill) {
        await updateBilling(editingBill.id, payload);
      } else {
        await createBilling({ ...payload, created_by: userId, company_id: companyId });
      }
      setBillModal(false); setEditingBill(null);
      setReloadKey(k => k + 1);
      toast.success(t('planning.billSaved'));
    } catch (err) {
      setBillError(err.message || t('planning.billingSaveError'));
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteBill = async (id) => {
    try {
      await deleteBilling(id);
      setBills(prev => prev.filter(bill => bill.id !== id));
      toast.success(t('feedback.billDeleted'));
    } catch {
      toast.error(t('feedback.deleteError'));
    }
  };

  if (!selectedCompany) {
    return (
      <div className="page-content">
        <p>{t('dashboard.selectCompanyDescription')}</p>
      </div>
    );
  }

  const calendarEvents = expandRecurringTasks(tasks)
    .map(task => taskToCalendarEvent(task, clientCompanies))
    .filter(Boolean);

  return (
    <div ref={pageRef} className="planning-page" style={pageHeight ? { height: `${pageHeight}px` } : undefined}>

      <div className="planning-toolbar">
        <div className="planning-search">
          <input
            type="search"
            className="input"
            placeholder={t('planning.searchPlaceholder')}
            aria-label={t('planning.searchPlaceholder')}
            value={search}
            onChange={e => setSearch(e.target.value)}
            disabled={loading}
          />
          {search && filteredCompanies.length > 0 && (
            <div className="planning-suggestions">
              {filteredCompanies.map((co, idx) => (
                <button
                  key={co.id}
                  type="button"
                  className="planning-suggestion"
                  onClick={() => { toggleCompany(co); setSearch(""); }}
                >
                  <span className="company-dot" style={{ '--company-color': getCompanyColor(co, idx) }} />
                  {co.name}
                  {selectedIds.includes(co.id) && (
                    <span className="is-selected"><Icon name="check" size={16} strokeWidth={2.5} /></span>
                  )}
                </button>
              ))}
            </div>
          )}
        </div>

        {canEdit && (
          <button type="button" className="primary-button" onClick={() => { setCompanyForm(emptyCompanyForm); setCompanyError(""); setCompanyModal(true); }}>
            <Icon name="plus" size={16} />{t('planning.addCompany')}
          </button>
        )}
        <button type="button" className="ghost-button" onClick={() => updateSelection(filteredCompanies.map(c => c.id))}>
          {t('planning.selectAll')}
        </button>
        {lastMove&&<button type="button" className="ghost-button" onClick={undoTaskMove} disabled={saving}>{t('planning.undoTaskMove')}</button>}
      </div>

      {selectedCompanies.length > 0 && (
        <ul className="planning-chips">
          {selectedCompanies.map(co => {
            const color = getCompanyColor(co, clientCompanies.findIndex(c => c.id === co.id));
            return (
              <li key={co.id} className="planning-chip" style={{ '--company-color': color }}>
                <span className="company-dot" style={{ '--company-color': color }} />
                {co.name}
                <button
                  type="button"
                  className="planning-chip-remove"
                  onClick={() => updateSelection(selectedIds.filter(id => id !== co.id))}
                  aria-label={t('planning.removeCompany').replace('{name}', co.name)}
                >
                  <Icon name="close" size={14} />
                </button>
              </li>
            );
          })}
        </ul>
      )}

      {loadError && (
        <div className="error-state" role="alert">
          <span>{t('feedback.planningLoadError')}</span>
          <button type="button" onClick={retryLoad}>{t('feedback.retry')}</button>
        </div>
      )}

      <div className="planning-body">
        <div className="planning-main-area">
          {mainView === "calendar" ? (
            <CalendarWrapper
              tasks={calendarEvents}
              defaultView="week"
              onRangeChange={onRangeChange}
              onDeleteTask={canEdit ? handleDeleteTask : undefined}
              onEditTask={canEdit ? handleEditTask : undefined}
              onMoveTask={canEdit ? (task,change)=>persistTaskMove(task,change) : undefined}
              onResizeTask={canEdit ? (task,resizeMinutes)=>resizeMinutes&&persistTaskMove(task,{resizeMinutes}) : undefined}
              onSelectSlot={canEdit ? openTaskModal : undefined}
            />
          ) : mainView === "billing" ? (
            <div className="planning-panel">
              {selectedCompanies.length === 0
                ? <p className="planning-empty">{t('planning.selectCompanyPrompt')}</p>
                : loadingBills
                  ? <p className="planning-empty">{t('planning.loadingBilling')}</p>
                  : <BillingView
                      bills={expandRecurringBills(bills)}
                      clientCompanies={selectedCompanies}
                      onDelete={canEdit ? handleDeleteBill : undefined}
                      onEdit={canEdit ? handleEditBill : undefined}
                    />}
            </div>
          ) : (
            <PlanningEmailFailures companyId={companyId} canEdit={canEdit} t={t}/>
          )}
        </div>

        <div className="planning-sidebar">
          <div className="segmented" role="group" aria-label={t('planning.viewMode')}>
            {[["calendar", 'planning.switcherCalendar'], ["billing", 'planning.switcherBilling'], ["emailFailures", 'planning.switcherEmailFailures']].map(([key, labelKey]) => (
              <button
                key={key}
                type="button"
                onClick={() => setMainView(key)}
                aria-pressed={mainView === key}
                style={{ flex: 1, width: 'auto' }}
              >
                {t(labelKey)}
              </button>
            ))}
          </div>

          {canEdit && (
            <>
              <button type="button" className="primary-button" onClick={() => openTaskModal()}>
                <Icon name="plus" size={16} />{t('planning.newTask')}
              </button>
            </>
          )}

          {mainView === "calendar" && (
            <div style={{ flex: 1, overflowY: "auto", minHeight: 0 }}>
              <h3 className="planning-section-title">{t('planning.upcomingTasks')}</h3>
              {tasks.length === 0 ? (
                <EmptyState
                  compact
                  icon="planning"
                  title={t('planning.noTasks')}
                  description={t('planning.noTasksHint')}
                />
              ) : tasks.slice(0, 8).map((task, i) => {
                const co = clientCompanies.find(c => c.id === task.client_company_id);
                return (
                  <div key={task.id || i} className="task-card" style={{ '--task-color': getCompanyColor(co), padding: '0.45rem 0.625rem', marginBottom: '0.45rem', cursor: 'default' }}>
                    <span className="task-card-title task-card-ellipsis" style={{ display: 'block', fontSize: '0.75rem' }}>{task.title}</span>
                    <span className="task-card-meta" style={{ fontSize: '0.7rem' }}>{formatDateTime(task.start_datetime)}</span>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      <ClientCompanyModal
        open={companyModal}
        form={companyForm}
        setForm={setCompanyForm}
        error={companyError}
        saving={saving}
        onSubmit={handleAddCompany}
        onClose={() => setCompanyModal(false)}
      />

      <TaskFormModal
        open={taskModal}
        editing={editingTask}
        form={taskForm}
        setForm={setTaskForm}
        clientCompanies={clientCompanies}
        existingAttachments={taskAttachments}
        files={taskFiles}
        onRemoveExisting={(i) => setTaskAttachments(prev => removeAttachment(prev, i))}
        onFilesChange={setTaskFiles}
        error={taskError}
        saving={saving}
        onSubmit={handleSubmitTask}
        onClose={() => { setTaskModal(false); setEditingTask(null); }}
      />

      <BillingFormModal
        open={billModal}
        editing={editingBill}
        form={billForm}
        setForm={setBillForm}
        clientCompanies={clientCompanies}
        existingAttachments={billAttachments}
        files={billFiles}
        onRemoveExisting={(i) => setBillAttachments(prev => removeAttachment(prev, i))}
        onFilesChange={setBillFiles}
        error={billError}
        saving={saving}
        onSubmit={handleSubmitBill}
        onClose={() => { setBillModal(false); setEditingBill(null); }}
      />
    </div>
  );
};

export default Planning;
