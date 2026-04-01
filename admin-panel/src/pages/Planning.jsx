import React, { useEffect, useState } from 'react';
import { format, startOfWeek, addDays, isSameDay, parseISO, setHours, setMinutes } from 'date-fns';
import { companyService } from '../services/companyService';
import { getPlanningTasks, createPlanningTask, getBilling, createBilling } from '../services/planningService';
import { supabase } from '../lib/supabaseClient';
import AppleCalendar from '../components/AppleCalendar';

// Devuelve el color de la empresa, o genera uno único si no tiene
function getCompanyColor(company) {
  if (!company || !company.id) return '#8e8e93';
  if (company.color) return company.color;
  let hash = 0;
  for (let i = 0; i < company.id.length; i++) {
    hash = company.id.charCodeAt(i) + ((hash << 5) - hash);
  }
  const c = (hash & 0x00FFFFFF).toString(16).toUpperCase();
  return '#' + '000000'.substring(0, 6 - c.length) + c;
}

// Mapea una tarea de BD a evento de calendario
function taskToEvent(task, companies) {
  if (!task || !task.title || !task.start_datetime || !task.company_id) return null;
  const start = new Date(task.start_datetime);
  if (isNaN(start.getTime())) return null;
  let end = task.end_datetime ? new Date(task.end_datetime) : new Date(start.getTime() + 60 * 60 * 1000);
  if (isNaN(end.getTime())) end = new Date(start.getTime() + 60 * 60 * 1000);
  const company = companies.find(c => c.id === task.company_id) || {};
  return {
    id: task.id,
    title: String(task.title),
    start,
    end,
    is_all_day: !!task.is_all_day,
    type: task.type,
    description: task.description,
    company,
    recurrence_type: task.recurrence_type,
    recurrence_value: task.recurrence_value,
    _raw: task,
  };
}

const Planning = () => {
  const [companies, setCompanies] = useState([]);
  const [selectedCompanies, setSelectedCompanies] = useState([]);
  const [search, setSearch] = useState('');
  const [userId, setUserId] = useState(null);
  const [loading, setLoading] = useState(true);

  const [showAddModal, setShowAddModal] = useState(false);
  const [addForm, setAddForm] = useState({ name: '', phone: '', email: '', responsible: '', color: '#1976d2' });
  const [adding, setAdding] = useState(false);
  const [errorAdd, setErrorAdd] = useState('');

  const [tasks, setTasks] = useState([]);
  const [bills, setBills] = useState([]);
  const [loadingTasks, setLoadingTasks] = useState(false);
  const [loadingBills, setLoadingBills] = useState(false);

  const [showTaskModal, setShowTaskModal] = useState(false);
  const [showBillModal, setShowBillModal] = useState(false);
  const [taskForm, setTaskForm] = useState({ title: '', description: '', company_id: '', type: 'todo', start_datetime: '', end_datetime: '', is_all_day: false, recurrence_type: 'none', recurrence_value: null });
  const [billForm, setBillForm] = useState({ title: '', description: '', company_id: '', billing_date: '', amount: '', direction: 'cobrar', recurrence_type: 'none', recurrence_value: null });
  const [errorTask, setErrorTask] = useState('');
  const [errorBill, setErrorBill] = useState('');

  const [detailTask, setDetailTask] = useState(null);
  const [detailBill, setDetailBill] = useState(null);
  const [showBills, setShowBills] = useState(false);

  useEffect(() => {
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (user) setUserId(user.id);
    });
  }, []);

  useEffect(() => {
    if (!userId) return;
    setLoading(true);
    (async () => {
      try {
        const memberships = await companyService.getMyCompanies();
        const isAdmin = memberships.some(m => m.role === 'admin');
        const data = isAdmin
          ? await companyService.getAllCompanies()
          : memberships.map(m => m.companies);
        setCompanies(data);
      } catch {
        setCompanies([]);
      } finally {
        setLoading(false);
      }
    })();
  }, [userId]);

  useEffect(() => {
    if (!selectedCompanies.length) { setTasks([]); setBills([]); return; }
    const ids = selectedCompanies.map(c => c.id);
    setLoadingTasks(true);
    setLoadingBills(true);
    getPlanningTasks(ids).then(setTasks).catch(() => setTasks([])).finally(() => setLoadingTasks(false));
    getBilling(ids).then(setBills).catch(() => setBills([])).finally(() => setLoadingBills(false));
  }, [selectedCompanies]);

  const filteredCompanies = companies.filter(c => c.name.toLowerCase().includes(search.toLowerCase()));
  const toggleCompany = (company) => setSelectedCompanies(prev => prev.some(c => c.id === company.id) ? prev.filter(c => c.id !== company.id) : [...prev, company]);
  const removeCompany = (id) => setSelectedCompanies(prev => prev.filter(c => c.id !== id));
  const selectAll = () => setSelectedCompanies(filteredCompanies);

  const openAddModal = () => { setAddForm({ name: '', phone: '', email: '', responsible: '', color: '#1976d2' }); setErrorAdd(''); setShowAddModal(true); };
  const handleAddCompany = async (e) => {
    e.preventDefault(); setAdding(true); setErrorAdd('');
    try {
      const created = await companyService.createCompany({ ...addForm, user_id: userId });
      setCompanies(prev => [created, ...prev]);
      setShowAddModal(false);
    } catch { setErrorAdd('Error al crear la empresa'); }
    finally { setAdding(false); }
  };

  const openTaskModal = (slot) => {
    const dt = slot instanceof Date ? format(slot, "yyyy-MM-dd'T'HH:mm") : '';
    setTaskForm({ title: '', description: '', company_id: selectedCompanies[0]?.id || '', type: 'todo', start_datetime: dt, end_datetime: '', is_all_day: false, recurrence_type: 'none', recurrence_value: null });
    setErrorTask(''); setShowTaskModal(true);
  };
  const handleAddTask = async (e) => {
    e.preventDefault(); setErrorTask('');
    if (!taskForm.company_id) { setErrorTask('Selecciona una empresa.'); return; }
    try {
      await createPlanningTask({ ...taskForm, created_by: userId });
      const updated = await getPlanningTasks(selectedCompanies.map(c => c.id));
      setTasks(updated); setShowTaskModal(false);
    } catch (err) { setErrorTask(err.message || 'Error al crear la tarea'); }
  };

  const openBillModal = () => {
    setBillForm({ title: '', description: '', company_id: selectedCompanies[0]?.id || '', billing_date: '', amount: '', direction: 'cobrar', recurrence_type: 'none', recurrence_value: null });
    setErrorBill(''); setShowBillModal(true);
  };
  const handleAddBill = async (e) => {
    e.preventDefault(); setErrorBill('');
    try {
      const created = await createBilling({ ...billForm, created_by: userId });
      setBills(prev => [created, ...prev]); setShowBillModal(false);
    } catch { setErrorBill('Error al crear la facturacion'); }
  };

  const calendarEvents = tasks.map(t => taskToEvent(t, companies)).filter(Boolean);

  const card = (color) => ({
    borderLeft: `4px solid ${color}`,
    background: color + '18',
    borderRadius: 8,
    padding: '10px 14px',
    marginBottom: 10,
    cursor: 'pointer',
  });

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', padding: '24px 24px 0', boxSizing: 'border-box', gap: 16 }}>

      <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
        <div style={{ position: 'relative' }}>
          <input
            type="text"
            placeholder="Buscar empresa..."
            style={{ padding: '7px 12px', borderRadius: 8, border: '1px solid #d1d1d6', fontSize: 14, minWidth: 220 }}
            value={search}
            onChange={e => setSearch(e.target.value)}
            disabled={loading}
          />
          {search && filteredCompanies.length > 0 && (
            <div style={{ position: 'absolute', top: '100%', left: 0, right: 0, background: '#fff', border: '1px solid #e5e5ea', borderRadius: 10, boxShadow: '0 4px 16px #0002', zIndex: 20, maxHeight: 200, overflowY: 'auto', marginTop: 4 }}>
              {filteredCompanies.map(company => (
                <div key={company.id} style={{ padding: '8px 14px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 8, fontSize: 14 }} onClick={() => { toggleCompany(company); setSearch(''); }}>
                  <span style={{ width: 10, height: 10, borderRadius: '50%', background: getCompanyColor(company), display: 'inline-block', flexShrink: 0 }} />
                  {company.name}
                  {selectedCompanies.some(c => c.id === company.id) && <span style={{ marginLeft: 'auto', color: '#34C759', fontWeight: 700 }}>v</span>}
                </div>
              ))}
            </div>
          )}
        </div>
        <button onClick={selectAll} style={{ padding: '7px 14px', borderRadius: 8, border: '1px solid #d1d1d6', background: '#fff', fontSize: 13, cursor: 'pointer' }}>Todas</button>
        <button onClick={openAddModal} style={{ padding: '7px 14px', borderRadius: 8, border: 'none', background: '#007AFF', color: '#fff', fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>+ Empresa</button>
        {selectedCompanies.map(company => (
          <span key={company.id} style={{ display: 'inline-flex', alignItems: 'center', gap: 6, background: getCompanyColor(company) + '20', border: `1px solid ${getCompanyColor(company)}`, borderRadius: 20, padding: '4px 10px 4px 8px', fontSize: 12, fontWeight: 500, color: getCompanyColor(company) }}>
            <span style={{ width: 8, height: 8, borderRadius: '50%', background: getCompanyColor(company) }} />
            {company.name}
            <span style={{ cursor: 'pointer', opacity: 0.6, fontSize: 14, lineHeight: 1, marginLeft: 2 }} onClick={() => removeCompany(company.id)}>x</span>
          </span>
        ))}
      </div>

      <div style={{ display: 'flex', flex: 1, gap: 16, minHeight: 0 }}>
        <div style={{ flex: 3, minHeight: 0, display: 'flex', flexDirection: 'column' }}>
          <AppleCalendar
            events={calendarEvents}
            getCompanyColor={getCompanyColor}
            onSelectEvent={ev => setDetailTask(ev._raw || ev)}
            onSelectSlot={openTaskModal}
          />
        </div>

        <div style={{ width: 220, flexShrink: 0, display: 'flex', flexDirection: 'column', gap: 12 }}>
          <button onClick={() => openTaskModal(new Date())} style={{ padding: '10px 0', borderRadius: 10, border: 'none', background: '#007AFF', color: '#fff', fontWeight: 600, fontSize: 14, cursor: 'pointer', boxShadow: '0 2px 8px #007AFF44' }}>
            + Nueva tarea
          </button>
          <button onClick={openBillModal} style={{ padding: '10px 0', borderRadius: 10, border: '1px solid #d1d1d6', background: '#fff', fontWeight: 600, fontSize: 14, cursor: 'pointer', color: '#1c1c1e' }}>
            + Facturacion
          </button>
          <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, cursor: 'pointer', color: '#636366' }}>
            <input type="checkbox" checked={showBills} onChange={e => setShowBills(e.target.checked)} />
            Ver facturacion
          </label>
          {showBills && (
            <div style={{ flex: 1, overflowY: 'auto' }}>
              {loadingBills ? (
                <div style={{ color: '#8e8e93', fontSize: 13 }}>Cargando...</div>
              ) : bills.length === 0 ? (
                <div style={{ color: '#c7c7cc', fontSize: 13 }}>Sin facturacion</div>
              ) : (
                bills.map(bill => {
                  const col = getCompanyColor(companies.find(c => c.id === bill.company_id) || {});
                  return (
                    <div key={bill.id} style={card(col)} onClick={() => setDetailBill(bill)}>
                      <div style={{ fontWeight: 600, fontSize: 13, color: '#1c1c1e' }}>{bill.title}</div>
                      <div style={{ fontSize: 12, color: '#636366' }}>{companies.find(c => c.id === bill.company_id)?.name}</div>
                      <div style={{ fontSize: 12, color: '#636366' }}>{bill.billing_date}</div>
                      <div style={{ fontSize: 13, fontWeight: 600, color: bill.direction === 'cobrar' ? '#34C759' : '#FF3B30' }}>
                        {bill.direction === 'cobrar' ? '+' : '-'}{bill.amount} EUR
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          )}
        </div>
      </div>

      {showAddModal && (
        <div style={modalOverlay}>
          <form onSubmit={handleAddCompany} style={modalBox}>
            <h3 style={{ margin: '0 0 16px' }}>Anadir empresa</h3>
            <input required placeholder="Nombre" value={addForm.name} onChange={e => setAddForm(f => ({ ...f, name: e.target.value }))} style={inputStyle} />
            <input placeholder="Telefono" value={addForm.phone} onChange={e => setAddForm(f => ({ ...f, phone: e.target.value }))} style={inputStyle} />
            <input type="email" placeholder="Email" value={addForm.email} onChange={e => setAddForm(f => ({ ...f, email: e.target.value }))} style={inputStyle} />
            <input placeholder="Responsable" value={addForm.responsible} onChange={e => setAddForm(f => ({ ...f, responsible: e.target.value }))} style={inputStyle} />
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <label style={{ fontSize: 13, color: '#636366' }}>Color</label>
              <input type="color" value={addForm.color} onChange={e => setAddForm(f => ({ ...f, color: e.target.value }))} style={{ width: 36, height: 36, border: 'none', background: 'none', cursor: 'pointer' }} />
            </div>
            {errorAdd && <div style={{ color: '#FF3B30', fontSize: 13 }}>{errorAdd}</div>}
            <div style={modalActions}>
              <button type="button" onClick={() => setShowAddModal(false)} style={btnSecondary} disabled={adding}>Cancelar</button>
              <button type="submit" style={btnPrimary} disabled={adding}>{adding ? 'Guardando...' : 'Guardar'}</button>
            </div>
          </form>
        </div>
      )}

      {showTaskModal && (
        <div style={modalOverlay}>
          <form onSubmit={handleAddTask} style={modalBox}>
            <h3 style={{ margin: '0 0 16px' }}>Nueva tarea</h3>
            <input required placeholder="Titulo" value={taskForm.title} onChange={e => setTaskForm(f => ({ ...f, title: e.target.value }))} style={inputStyle} />
            <textarea placeholder="Descripcion" value={taskForm.description} onChange={e => setTaskForm(f => ({ ...f, description: e.target.value }))} style={{ ...inputStyle, minHeight: 70, resize: 'vertical' }} />
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
            <label style={{ fontSize: 13, color: '#636366' }}>Inicio</label>
            <input type="datetime-local" required value={taskForm.start_datetime} onChange={e => setTaskForm(f => ({ ...f, start_datetime: e.target.value }))} style={inputStyle} />
            <label style={{ fontSize: 13, color: '#636366' }}>Fin (opcional)</label>
            <input type="datetime-local" value={taskForm.end_datetime} onChange={e => setTaskForm(f => ({ ...f, end_datetime: e.target.value }))} style={inputStyle} />
            <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13 }}>
              <input type="checkbox" checked={taskForm.is_all_day} onChange={e => setTaskForm(f => ({ ...f, is_all_day: e.target.checked }))} />
              Todo el dia
            </label>
            <div style={{ display: 'flex', gap: 8 }}>
              <select value={taskForm.recurrence_type} onChange={e => setTaskForm(f => ({ ...f, recurrence_type: e.target.value }))} style={{ ...inputStyle, flex: 2 }}>
                <option value="none">Sin repeticion</option>
                <option value="daily">Diaria</option>
                <option value="weekly">Semanal</option>
                <option value="yearly">Anual</option>
              </select>
              {taskForm.recurrence_type !== 'none' && (
                <input type="number" min="1" placeholder="Frecuencia" value={taskForm.recurrence_value || ''} onChange={e => setTaskForm(f => ({ ...f, recurrence_value: e.target.value ? Number(e.target.value) : null }))} style={{ ...inputStyle, flex: 1, minWidth: 80 }} />
              )}
            </div>
            {errorTask && <div style={{ color: '#FF3B30', fontSize: 13 }}>{errorTask}</div>}
            <div style={modalActions}>
              <button type="button" onClick={() => setShowTaskModal(false)} style={btnSecondary}>Cancelar</button>
              <button type="submit" style={btnPrimary}>Guardar</button>
            </div>
          </form>
        </div>
      )}

      {showBillModal && (
        <div style={modalOverlay}>
          <form onSubmit={handleAddBill} style={modalBox}>
            <h3 style={{ margin: '0 0 16px' }}>Nueva facturacion</h3>
            <input required placeholder="Titulo" value={billForm.title} onChange={e => setBillForm(f => ({ ...f, title: e.target.value }))} style={inputStyle} />
            <textarea placeholder="Descripcion" value={billForm.description} onChange={e => setBillForm(f => ({ ...f, description: e.target.value }))} style={{ ...inputStyle, minHeight: 70, resize: 'vertical' }} />
            <select required value={billForm.company_id} onChange={e => setBillForm(f => ({ ...f, company_id: e.target.value }))} style={inputStyle}>
              <option value="">Selecciona empresa</option>
              {companies.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
            <label style={{ fontSize: 13, color: '#636366' }}>Fecha</label>
            <input type="date" required value={billForm.billing_date} onChange={e => setBillForm(f => ({ ...f, billing_date: e.target.value }))} style={inputStyle} />
            <input type="number" required placeholder="Importe (EUR)" value={billForm.amount} onChange={e => setBillForm(f => ({ ...f, amount: e.target.value }))} style={inputStyle} />
            <select value={billForm.direction} onChange={e => setBillForm(f => ({ ...f, direction: e.target.value }))} style={inputStyle}>
              <option value="cobrar">A cobrar</option>
              <option value="pagar">A pagar</option>
            </select>
            <div style={{ display: 'flex', gap: 8 }}>
              <select value={billForm.recurrence_type} onChange={e => setBillForm(f => ({ ...f, recurrence_type: e.target.value }))} style={{ ...inputStyle, flex: 2 }}>
                <option value="none">Sin repeticion</option>
                <option value="daily">Diaria</option>
                <option value="weekly">Semanal</option>
                <option value="yearly">Anual</option>
              </select>
              {billForm.recurrence_type !== 'none' && (
                <input type="number" min="1" placeholder="Frecuencia" value={billForm.recurrence_value || ''} onChange={e => setBillForm(f => ({ ...f, recurrence_value: e.target.value ? Number(e.target.value) : null }))} style={{ ...inputStyle, flex: 1, minWidth: 80 }} />
              )}
            </div>
            {errorBill && <div style={{ color: '#FF3B30', fontSize: 13 }}>{errorBill}</div>}
            <div style={modalActions}>
              <button type="button" onClick={() => setShowBillModal(false)} style={btnSecondary}>Cancelar</button>
              <button type="submit" style={btnPrimary}>Guardar</button>
            </div>
          </form>
        </div>
      )}

      {detailTask && (
        <div style={modalOverlay} onClick={() => setDetailTask(null)}>
          <div style={{ ...modalBox, maxWidth: 420 }} onClick={e => e.stopPropagation()}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 16 }}>
              <span style={{ width: 12, height: 12, borderRadius: '50%', background: getCompanyColor(companies.find(c => c.id === detailTask.company_id) || {}), flexShrink: 0 }} />
              <h3 style={{ margin: 0, flex: 1 }}>{detailTask.title}</h3>
            </div>
            <div style={detailRow}><span style={detailLabel}>Empresa</span>{companies.find(c => c.id === detailTask.company_id)?.name || '-'}</div>
            <div style={detailRow}><span style={detailLabel}>Tipo</span>{detailTask.type}</div>
            <div style={detailRow}><span style={detailLabel}>Inicio</span>{detailTask.start_datetime?.replace('T', ' ').slice(0, 16)}</div>
            {detailTask.end_datetime && <div style={detailRow}><span style={detailLabel}>Fin</span>{detailTask.end_datetime.replace('T', ' ').slice(0, 16)}</div>}
            <div style={detailRow}><span style={detailLabel}>Todo el dia</span>{detailTask.is_all_day ? 'Si' : 'No'}</div>
            {detailTask.recurrence_type && detailTask.recurrence_type !== 'none' && (
              <div style={detailRow}><span style={detailLabel}>Repeticion</span>{detailTask.recurrence_type} (cada {detailTask.recurrence_value || 1})</div>
            )}
            {detailTask.description && <div style={{ marginTop: 10, fontSize: 14, color: '#636366', lineHeight: 1.6 }}>{detailTask.description}</div>}
            <div style={modalActions}><button onClick={() => setDetailTask(null)} style={btnPrimary}>Cerrar</button></div>
          </div>
        </div>
      )}

      {detailBill && (
        <div style={modalOverlay} onClick={() => setDetailBill(null)}>
          <div style={{ ...modalBox, maxWidth: 380 }} onClick={e => e.stopPropagation()}>
            <h3 style={{ margin: '0 0 16px' }}>{detailBill.title}</h3>
            <div style={detailRow}><span style={detailLabel}>Empresa</span>{companies.find(c => c.id === detailBill.company_id)?.name || '-'}</div>
            <div style={detailRow}><span style={detailLabel}>Tipo</span>{detailBill.direction === 'cobrar' ? 'A cobrar' : 'A pagar'}</div>
            <div style={detailRow}><span style={detailLabel}>Fecha</span>{detailBill.billing_date}</div>
            <div style={detailRow}><span style={detailLabel}>Importe</span><strong style={{ color: detailBill.direction === 'cobrar' ? '#34C759' : '#FF3B30' }}>{detailBill.direction === 'cobrar' ? '+' : '-'}{detailBill.amount} EUR</strong></div>
            {detailBill.description && <div style={{ marginTop: 10, fontSize: 14, color: '#636366', lineHeight: 1.6 }}>{detailBill.description}</div>}
            <div style={modalActions}><button onClick={() => setDetailBill(null)} style={btnPrimary}>Cerrar</button></div>
          </div>
        </div>
      )}
    </div>
  );
};

const modalOverlay = { position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.40)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center' };
const modalBox = { background: '#fff', borderRadius: 16, padding: 28, minWidth: 320, boxShadow: '0 8px 40px rgba(0,0,0,0.18)', display: 'flex', flexDirection: 'column', gap: 12, maxHeight: '90vh', overflowY: 'auto' };
const modalActions = { display: 'flex', gap: 8, justifyContent: 'flex-end', marginTop: 8 };
const inputStyle = { padding: '9px 12px', borderRadius: 9, border: '1px solid #d1d1d6', fontSize: 14, outline: 'none', width: '100%', boxSizing: 'border-box', fontFamily: 'inherit' };
const btnPrimary = { padding: '9px 20px', borderRadius: 9, border: 'none', background: '#007AFF', color: '#fff', fontWeight: 600, fontSize: 14, cursor: 'pointer' };
const btnSecondary = { padding: '9px 20px', borderRadius: 9, border: '1px solid #d1d1d6', background: '#fff', fontWeight: 500, fontSize: 14, cursor: 'pointer', color: '#1c1c1e' };
const detailRow = { display: 'flex', alignItems: 'baseline', gap: 10, fontSize: 14, color: '#1c1c1e', padding: '4px 0', borderBottom: '1px solid #f2f2f7' };
const detailLabel = { fontSize: 12, fontWeight: 600, color: '#8e8e93', minWidth: 90, textTransform: 'uppercase', letterSpacing: 0.4 };

export default Planning;
