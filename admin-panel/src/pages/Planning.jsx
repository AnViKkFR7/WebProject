import React, { useEffect, useState } from 'react';
import { format, startOfWeek, addDays, isSameDay, parseISO } from 'date-fns';
import { companyService } from '../services/companyService';
import { getPlanningTasks, createPlanningTask, getBilling, createBilling } from '../services/planningService';
import { supabase } from '../lib/supabaseClient';

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
  // Tareas y facturación
  const [tasks, setTasks] = useState([]);
  const [bills, setBills] = useState([]);
  const [calendarView, setCalendarView] = useState('semanal');
  const [showTaskModal, setShowTaskModal] = useState(false);
  const [showBillModal, setShowBillModal] = useState(false);
  const [taskForm, setTaskForm] = useState({ title: '', description: '', company_id: '', type: 'todo', start_datetime: '', end_datetime: '', is_all_day: false, recurrence_type: 'none', recurrence_value: null });
  const [billForm, setBillForm] = useState({ title: '', description: '', company_id: '', billing_date: '', amount: '', direction: 'cobrar', recurrence_type: 'none', recurrence_value: null });
  const [loadingTasks, setLoadingTasks] = useState(false);
  const [loadingBills, setLoadingBills] = useState(false);
  const [errorTask, setErrorTask] = useState('');
  const [errorBill, setErrorBill] = useState('');
  // Detalle ampliado
  const [detailTask, setDetailTask] = useState(null);
  const [detailBill, setDetailBill] = useState(null);
  // Cargar tareas y facturación al seleccionar empresas
  useEffect(() => {
    if (!selectedCompanies.length) {
      setTasks([]);
      setBills([]);
      return;
    }
    const ids = selectedCompanies.map(c => c.id);
    setLoadingTasks(true);
    setLoadingBills(true);
    getPlanningTasks(ids)
      .then(setTasks)
      .catch(() => setTasks([]))
      .finally(() => setLoadingTasks(false));
    getBilling(ids)
      .then(setBills)
      .catch(() => setBills([]))
      .finally(() => setLoadingBills(false));
  }, [selectedCompanies]);
  // Abrir modal tarea/facturación
  const openTaskModal = () => {
    setTaskForm({ title: '', description: '', company_id: selectedCompanies[0]?.id || '', type: 'todo', start_datetime: '', end_datetime: '', is_all_day: false, recurrence_type: 'none', recurrence_value: null });
    setErrorTask('');
    setShowTaskModal(true);
  };
  const openBillModal = () => {
    setBillForm({ title: '', description: '', company_id: selectedCompanies[0]?.id || '', billing_date: '', amount: '', direction: 'cobrar', recurrence_type: 'none', recurrence_value: null });
    setErrorBill('');
    setShowBillModal(true);
  };
  const closeTaskModal = () => setShowTaskModal(false);
  const closeBillModal = () => setShowBillModal(false);

  // Guardar tarea
  const handleAddTask = async (e) => {
    e.preventDefault();
    setErrorTask('');
    try {
      const newTask = { ...taskForm, created_by: userId };
      const created = await createPlanningTask(newTask);
      setTasks(prev => [created, ...prev]);
      setShowTaskModal(false);
    } catch (err) {
      setErrorTask('Error al crear la tarea');
    }
  };
  // Guardar facturación
  const handleAddBill = async (e) => {
    e.preventDefault();
    setErrorBill('');
    try {
      const newBill = { ...billForm, created_by: userId };
      const created = await createBilling(newBill);
      setBills(prev => [created, ...prev]);
      setShowBillModal(false);
    } catch (err) {
      setErrorBill('Error al crear la facturación');
    }
  };

  // Obtener el usuario actual de Supabase
  useEffect(() => {
    async function fetchUser() {
      const { data: { user } } = await supabase.auth.getUser();
      if (user) setUserId(user.id);
    }
    fetchUser();
  }, []);

  // Cargar empresas cliente del usuario
  useEffect(() => {
    if (!userId) return;
    setLoading(true);
    async function fetchCompanies() {
      try {
        // Si eres admin, ves todas las empresas; si no, solo las que tienes acceso
        let companiesData = [];
        const memberships = await companyService.getMyCompanies();
        const isAdmin = memberships.some(m => m.role === 'admin');
        if (isAdmin) {
          companiesData = await companyService.getAllCompanies();
        } else {
          companiesData = memberships.map(m => m.companies);
        }
        setCompanies(companiesData);
      } catch {
        setCompanies([]);
      } finally {
        setLoading(false);
      }
    }
    fetchCompanies();
  }, [userId]);

  // Filtrar empresas por búsqueda
  const filteredCompanies = companies.filter(c =>
    c.name.toLowerCase().includes(search.toLowerCase())
  );

  // Seleccionar/deseleccionar empresa
  const toggleCompany = (company) => {
    setSelectedCompanies(prev =>
      prev.some(c => c.id === company.id)
        ? prev.filter(c => c.id !== company.id)
        : [...prev, company]
    );
  };

  // Seleccionar todas
  const selectAll = () => setSelectedCompanies(filteredCompanies);
  // Quitar empresa de la selección
  const removeCompany = (id) => setSelectedCompanies(prev => prev.filter(c => c.id !== id));

  // Abrir modal añadir empresa
  const openAddModal = () => {
    setAddForm({ name: '', phone: '', email: '', responsible: '', color: '#1976d2' });
    setErrorAdd('');
    setShowAddModal(true);
  };
  // Cerrar modal
  const closeAddModal = () => setShowAddModal(false);

  // Guardar nueva empresa
  const handleAddCompany = async (e) => {
    e.preventDefault();
    setAdding(true);
    setErrorAdd('');
    try {
      const newCompany = {
        ...addForm,
        user_id: userId,
        color: addForm.color || '#1976d2',
      };
      const created = await companyService.createCompany(newCompany);
      setCompanies(prev => [created, ...prev]);
      setShowAddModal(false);
    } catch (err) {
      setErrorAdd('Error al crear la empresa');
    } finally {
      setAdding(false);
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', padding: 24 }}>
      {/* Selector de empresas y acciones */}
      <div style={{ display: 'flex', alignItems: 'center', marginBottom: 16 }}>
        {/* Selector de empresas (multi-select) */}
        <div style={{ flex: 1 }}>
          <input
            type="text"
            placeholder="Buscar empresa..."
            style={{ width: '60%', padding: 8 }}
            value={search}
            onChange={e => setSearch(e.target.value)}
            disabled={loading}
          />
          {/* Lista de empresas filtradas para seleccionar */}
          {search && filteredCompanies.length > 0 && (
            <div style={{ background: '#fff', border: '1px solid #eee', borderRadius: 8, marginTop: 4, maxHeight: 180, overflowY: 'auto', position: 'absolute', zIndex: 10 }}>
              {filteredCompanies.map(company => (
                <div
                  key={company.id}
                  style={{ padding: 8, cursor: 'pointer', color: company.color || '#1976d2' }}
                  onClick={() => toggleCompany(company)}
                >
                  {company.name}
                  {selectedCompanies.some(c => c.id === company.id) && ' ✓'}
                </div>
              ))}
            </div>
          )}
        </div>
        {/* Botón añadir empresa */}
        <button style={{ marginLeft: 8 }} onClick={openAddModal}>Añadir empresa</button>
        {/* Botón seleccionar todas */}
        <button style={{ marginLeft: 8 }} onClick={selectAll}>Seleccionar todas</button>
      </div>

      {/* Lista de empresas seleccionadas */}
      <div style={{ marginBottom: 16 }}>
        <ul style={{ display: 'flex', gap: 16, listStyle: 'disc inside' }}>
          {selectedCompanies.map(company => (
            <li
              key={company.id}
              style={{ color: company.color || '#1976d2', background: company.color ? `${company.color}22` : '#e3f2fd', borderRadius: 8, padding: '4px 12px', display: 'flex', alignItems: 'center' }}
            >
              {company.name}
              <span
                style={{ marginLeft: 8, cursor: 'pointer', color: '#888' }}
                onClick={() => removeCompany(company.id)}
              >✕</span>
            </li>
          ))}
        </ul>
      </div>

      {/* Contenido principal: calendario y menú lateral */}
      <div style={{ display: 'flex', flex: 1, gap: 24 }}>
        {/* Calendario (4/6 ancho) */}
        <div style={{ flex: 4, background: '#fafafa', borderRadius: 12, padding: 16, minHeight: 400 }}>
          <div style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
            <button>Mensual</button>
            <button>Semanl</button>
            <button>Diario</button>
          </div>
          <div style={{ border: '1px solid #eee', borderRadius: 8, height: '100%' }}>
            {/* Aquí irá el calendario */}
            <div style={{ textAlign: 'center', padding: 40, color: '#bbb' }}>
              [Calendario aquí]
            </div>
          </div>
        </div>
        {/* Menú lateral (2/6 ancho) */}
        <div style={{ flex: 2, background: '#f5f5f5', borderRadius: 12, padding: 16, minHeight: 400 }}>
          <div style={{ marginBottom: 16 }}>
            <label>
              <input type="checkbox" /> Vista facturación
            </label>
          </div>
          <button style={{ width: '100%', marginBottom: 12 }} onClick={openTaskModal}>Crear nueva tarea</button>
          <button style={{ width: '100%' }} onClick={openBillModal}>Crear nueva facturación</button>
        </div>
      </div>
      {/* Modal para añadir empresa */}
      {showAddModal && (
        <div style={{ position: 'fixed', top: 0, left: 0, width: '100vw', height: '100vh', background: '#0008', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <form onSubmit={handleAddCompany} style={{ background: '#fff', borderRadius: 12, padding: 32, minWidth: 320, boxShadow: '0 4px 24px #0002', display: 'flex', flexDirection: 'column', gap: 16 }}>
            <h3 style={{ margin: 0 }}>Añadir empresa</h3>
            <input required placeholder="Nombre" value={addForm.name} onChange={e => setAddForm(f => ({ ...f, name: e.target.value }))} />
            <input placeholder="Teléfono" value={addForm.phone} onChange={e => setAddForm(f => ({ ...f, phone: e.target.value }))} />
            <input type="email" placeholder="Email" value={addForm.email} onChange={e => setAddForm(f => ({ ...f, email: e.target.value }))} />
            <input placeholder="Responsable" value={addForm.responsible} onChange={e => setAddForm(f => ({ ...f, responsible: e.target.value }))} />
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <label>Color:</label>
              <input type="color" value={addForm.color} onChange={e => setAddForm(f => ({ ...f, color: e.target.value }))} style={{ width: 32, height: 32, border: 'none', background: 'none' }} />
            </div>
            {errorAdd && <div style={{ color: 'red' }}>{errorAdd}</div>}
            <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
              <button type="button" onClick={closeAddModal} disabled={adding}>Cancelar</button>
              <button type="submit" disabled={adding}>{adding ? 'Guardando...' : 'Guardar'}</button>
            </div>
          </form>
        </div>
      )}

      {/* Placeholder para lógica de tareas y calendario */}
      <div style={{ display: 'flex', flex: 1, gap: 24 }}>
        {/* Calendario (4/6 ancho) */}
        <div style={{ flex: 4, background: '#fafafa', borderRadius: 12, padding: 16, minHeight: 400 }}>
          <div style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
            <button>Mensual</button>
            <button>Semanl</button>
            <button>Diario</button>
          </div>
          <div style={{ border: '1px solid #eee', borderRadius: 8, height: '100%' }}>
            {/* Aquí irá el calendario */}
            <div style={{ textAlign: 'center', padding: 40, color: '#bbb' }}>
              [Calendario aquí]
            </div>
          </div>
        </div>
        {/* Menú lateral (2/6 ancho) */}
        <div style={{ flex: 2, background: '#f5f5f5', borderRadius: 12, padding: 16, minHeight: 400 }}>
          <div style={{ marginBottom: 16 }}>
            <label>
              <input type="checkbox" /> Vista facturación
            </label>
          </div>
          <button style={{ width: '100%', marginBottom: 12 }}>Crear nueva tarea</button>
          <button style={{ width: '100%' }}>Crear nueva facturación</button>
        </div>
      </div>
      {/* Modal crear tarea */}
      {showTaskModal && (
        <div style={{ position: 'fixed', top: 0, left: 0, width: '100vw', height: '100vh', background: '#0008', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <form onSubmit={handleAddTask} style={{ background: '#fff', borderRadius: 12, padding: 32, minWidth: 320, boxShadow: '0 4px 24px #0002', display: 'flex', flexDirection: 'column', gap: 16 }}>
            <h3 style={{ margin: 0 }}>Crear tarea</h3>
            <input required placeholder="Título" value={taskForm.title} onChange={e => setTaskForm(f => ({ ...f, title: e.target.value }))} />
            <textarea placeholder="Descripción" value={taskForm.description} onChange={e => setTaskForm(f => ({ ...f, description: e.target.value }))} />
            <select required value={taskForm.company_id} onChange={e => setTaskForm(f => ({ ...f, company_id: e.target.value }))}>
              <option value="">Selecciona empresa</option>
              {companies.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
            <input type="datetime-local" required value={taskForm.start_datetime} onChange={e => setTaskForm(f => ({ ...f, start_datetime: e.target.value }))} />
            <input type="datetime-local" value={taskForm.end_datetime} onChange={e => setTaskForm(f => ({ ...f, end_datetime: e.target.value }))} />
            <select value={taskForm.type} onChange={e => setTaskForm(f => ({ ...f, type: e.target.value }))}>
              <option value="recibir_pago">Recibir pago</option>
              <option value="realizar_pago">Realizar pago</option>
              <option value="todo">ToDo-Task</option>
              <option value="entregable">Entregable</option>
              <option value="reunion">Reunión</option>
            </select>
            <label><input type="checkbox" checked={taskForm.is_all_day} onChange={e => setTaskForm(f => ({ ...f, is_all_day: e.target.checked }))} /> Todo el día</label>
            <div style={{ display: 'flex', gap: 8 }}>
              <select value={taskForm.recurrence_type} onChange={e => setTaskForm(f => ({ ...f, recurrence_type: e.target.value }))}>
                <option value="none">Sin repetición</option>
                <option value="hourly">Cada hora</option>
                <option value="daily">Diaria</option>
                <option value="weekly">Semanal</option>
                <option value="yearly">Anual</option>
              </select>
              <input type="number" min="1" placeholder="Frecuencia" value={taskForm.recurrence_value || ''} onChange={e => setTaskForm(f => ({ ...f, recurrence_value: e.target.value ? Number(e.target.value) : null }))} style={{ width: 80 }} />
            </div>
            {errorTask && <div style={{ color: 'red' }}>{errorTask}</div>}
            <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
              <button type="button" onClick={closeTaskModal}>Cancelar</button>
              <button type="submit">Guardar</button>
            </div>
          </form>
        </div>
      )}
      {/* Modal crear facturación */}
      {showBillModal && (
        <div style={{ position: 'fixed', top: 0, left: 0, width: '100vw', height: '100vh', background: '#0008', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <form onSubmit={handleAddBill} style={{ background: '#fff', borderRadius: 12, padding: 32, minWidth: 320, boxShadow: '0 4px 24px #0002', display: 'flex', flexDirection: 'column', gap: 16 }}>
            <h3 style={{ margin: 0 }}>Crear facturación</h3>
            <input required placeholder="Título" value={billForm.title} onChange={e => setBillForm(f => ({ ...f, title: e.target.value }))} />
            <textarea placeholder="Descripción" value={billForm.description} onChange={e => setBillForm(f => ({ ...f, description: e.target.value }))} />
            <select required value={billForm.company_id} onChange={e => setBillForm(f => ({ ...f, company_id: e.target.value }))}>
              <option value="">Selecciona empresa</option>
              {companies.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
            <input type="date" required value={billForm.billing_date} onChange={e => setBillForm(f => ({ ...f, billing_date: e.target.value }))} />
            <input type="number" required placeholder="Cantidad" value={billForm.amount} onChange={e => setBillForm(f => ({ ...f, amount: e.target.value }))} />
            <select value={billForm.direction} onChange={e => setBillForm(f => ({ ...f, direction: e.target.value }))}>
              <option value="cobrar">A cobrar</option>
              <option value="pagar">A pagar</option>
            </select>
            <div style={{ display: 'flex', gap: 8 }}>
              <select value={billForm.recurrence_type} onChange={e => setBillForm(f => ({ ...f, recurrence_type: e.target.value }))}>
                <option value="none">Sin repetición</option>
                <option value="hourly">Cada hora</option>
                <option value="daily">Diaria</option>
                <option value="weekly">Semanal</option>
                <option value="yearly">Anual</option>
              </select>
              <input type="number" min="1" placeholder="Frecuencia" value={billForm.recurrence_value || ''} onChange={e => setBillForm(f => ({ ...f, recurrence_value: e.target.value ? Number(e.target.value) : null }))} style={{ width: 80 }} />
            </div>
            {errorBill && <div style={{ color: 'red' }}>{errorBill}</div>}
            <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
              <button type="button" onClick={closeBillModal}>Cancelar</button>
              <button type="submit">Guardar</button>
            </div>
          </form>
        </div>
      )}

      {/* Renderizado de tareas y facturación */}
      <div style={{ display: 'flex', flex: 1, gap: 24 }}>
        {/* Calendario (4/6 ancho) */}
        <div style={{ flex: 4, background: '#fafafa', borderRadius: 12, padding: 16, minHeight: 400 }}>
          <div style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
            <button onClick={() => setCalendarView('mensual')}>Mensual</button>
            <button onClick={() => setCalendarView('semanal')}>Semanal</button>
            <button onClick={() => setCalendarView('diario')}>Diario</button>
          </div>
          <div style={{ border: '1px solid #eee', borderRadius: 8, height: '100%', padding: 16, overflowY: 'auto' }}>
            {/* Aquí irá el calendario */}
            {loadingTasks ? (
              <div style={{ textAlign: 'center', color: '#bbb' }}>Cargando tareas...</div>
            ) : tasks.length === 0 ? (
              <div style={{ textAlign: 'center', color: '#bbb' }}>[Sin tareas]</div>
            ) : (
              <div>
                {calendarView === 'semanal' && (
                  (() => {
                    // Agrupar tareas por día de la semana actual
                    const today = new Date();
                    const weekStart = startOfWeek(today, { weekStartsOn: 1 }); // Lunes
                    const days = Array.from({ length: 7 }, (_, i) => addDays(weekStart, i));
                    return days.map(day => {
                      const dayTasks = tasks.filter(task => isSameDay(parseISO(task.start_datetime), day));
                      return (
                        <div key={day.toISOString()} style={{ marginBottom: 18 }}>
                          <div style={{ fontWeight: 600, marginBottom: 6, color: '#1976d2' }}>{format(day, 'EEEE dd/MM/yyyy')}</div>
                          {dayTasks.length === 0 ? (
                            <div style={{ color: '#bbb', fontSize: 13, marginLeft: 8 }}>[Sin tareas]</div>
                          ) : (
                            <ul style={{ padding: 0, margin: 0, listStyle: 'none' }}>
                              {dayTasks.map(task => (
                                <li key={task.id} style={{ marginBottom: 10 }}>
                                  <div
                                    style={{ borderLeft: `6px solid ${companies.find(c => c.id === task.company_id)?.color || '#1976d2'}`, background: `${companies.find(c => c.id === task.company_id)?.color || '#1976d2'}22`, borderRadius: 8, padding: 12, cursor: 'pointer' }}
                                    onClick={() => setDetailTask(task)}
                                  >
                                    <strong>{task.title}</strong> <span style={{ fontSize: 12, color: '#888' }}>({task.type})</span><br />
                                    <span style={{ fontSize: 13 }}>{companies.find(c => c.id === task.company_id)?.name || ''}</span>
                                    <div style={{ fontSize: 12, color: '#666' }}>{task.start_datetime?.replace('T', ' ').slice(0, 16)}</div>
                                  </div>
                                </li>
                              ))}
                            </ul>
                          )}
                        </div>
                      );
                    });
                  })()
                )}
                {calendarView === 'diario' && (() => {
                  const today = new Date();
                  const dayTasks = tasks.filter(task => isSameDay(parseISO(task.start_datetime), today));
                  return (
                    <div>
                      <div style={{ fontWeight: 600, marginBottom: 6, color: '#1976d2' }}>{format(today, 'EEEE dd/MM/yyyy')}</div>
                      {dayTasks.length === 0 ? (
                        <div style={{ color: '#bbb', fontSize: 13, marginLeft: 8 }}>[Sin tareas]</div>
                      ) : (
                        <ul style={{ padding: 0, margin: 0, listStyle: 'none' }}>
                          {dayTasks.map(task => (
                            <li key={task.id} style={{ marginBottom: 10 }}>
                              <div
                                style={{ borderLeft: `6px solid ${companies.find(c => c.id === task.company_id)?.color || '#1976d2'}`, background: `${companies.find(c => c.id === task.company_id)?.color || '#1976d2'}22`, borderRadius: 8, padding: 12, cursor: 'pointer' }}
                                onClick={() => setDetailTask(task)}
                              >
                                <strong>{task.title}</strong> <span style={{ fontSize: 12, color: '#888' }}>({task.type})</span><br />
                                <span style={{ fontSize: 13 }}>{companies.find(c => c.id === task.company_id)?.name || ''}</span>
                                <div style={{ fontSize: 12, color: '#666' }}>{task.start_datetime?.replace('T', ' ').slice(0, 16)}</div>
                              </div>
                            </li>
                          ))}
                        </ul>
                      )}
                    </div>
                  );
                })()}
                {calendarView === 'mensual' && (
                  <ul style={{ padding: 0, margin: 0, listStyle: 'none' }}>
                    {tasks.map(task => (
                      <li key={task.id} style={{ marginBottom: 12 }}>
                        <div
                          style={{ borderLeft: `6px solid ${companies.find(c => c.id === task.company_id)?.color || '#1976d2'}`, background: `${companies.find(c => c.id === task.company_id)?.color || '#1976d2'}22`, borderRadius: 8, padding: 12, cursor: 'pointer' }}
                          onClick={() => setDetailTask(task)}
                        >
                          <strong>{task.title}</strong> <span style={{ fontSize: 12, color: '#888' }}>({task.type})</span><br />
                          <span style={{ fontSize: 13 }}>{companies.find(c => c.id === task.company_id)?.name || ''}</span>
                          <div style={{ fontSize: 12, color: '#666' }}>{task.start_datetime?.replace('T', ' ').slice(0, 16)}</div>
                        </div>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            )}
          </div>
        </div>
        {/* Menú lateral (2/6 ancho) */}
        <div style={{ flex: 2, background: '#f5f5f5', borderRadius: 12, padding: 16, minHeight: 400 }}>
          <div style={{ marginBottom: 16 }}>
            <label>
              <input type="checkbox" /> Vista facturación
            </label>
          </div>
          <button style={{ width: '100%', marginBottom: 12 }} onClick={openTaskModal}>Crear nueva tarea</button>
          <button style={{ width: '100%' }} onClick={openBillModal}>Crear nueva facturación</button>
          <div style={{ marginTop: 32 }}>
            <h4>Facturación</h4>
            {loadingBills ? (
              <div style={{ color: '#bbb' }}>Cargando facturación...</div>
            ) : bills.length === 0 ? (
              <div style={{ color: '#bbb' }}>[Sin facturación]</div>
            ) : (
              <ul style={{ padding: 0, margin: 0, listStyle: 'none' }}>
                {bills.map(bill => (
                  <li key={bill.id} style={{ marginBottom: 10 }}>
                    <div
                      style={{ borderLeft: `6px solid ${companies.find(c => c.id === bill.company_id)?.color || '#1976d2'}`, background: `${companies.find(c => c.id === bill.company_id)?.color || '#1976d2'}22`, borderRadius: 8, padding: 10, cursor: 'pointer' }}
                      onClick={() => setDetailBill(bill)}
                    >
                      <strong>{bill.title}</strong> <span style={{ fontSize: 12, color: '#888' }}>({bill.direction === 'cobrar' ? 'A cobrar' : 'A pagar'})</span><br />
                      <span style={{ fontSize: 13 }}>{companies.find(c => c.id === bill.company_id)?.name || ''}</span>
                      <div style={{ fontSize: 12, color: '#666' }}>{bill.billing_date}</div>
                      <div style={{ fontSize: 13, color: '#333' }}>{bill.amount} €</div>
                    </div>
                  </li>
                ))}
                    {/* Modal detalle tarea */}
                    {detailTask && (
                      <div style={{ position: 'fixed', top: 0, left: 0, width: '100vw', height: '100vh', background: '#0008', zIndex: 1100, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                        <div style={{ background: '#fff', borderRadius: 12, padding: 32, minWidth: 340, boxShadow: '0 4px 24px #0002', display: 'flex', flexDirection: 'column', gap: 12, maxWidth: 420 }}>
                          <h3 style={{ margin: 0 }}>{detailTask.title}</h3>
                          <div><b>Empresa:</b> {companies.find(c => c.id === detailTask.company_id)?.name || ''}</div>
                          <div><b>Tipo:</b> {detailTask.type}</div>
                          <div><b>Inicio:</b> {detailTask.start_datetime?.replace('T', ' ').slice(0, 16)}</div>
                          {detailTask.end_datetime && <div><b>Fin:</b> {detailTask.end_datetime.replace('T', ' ').slice(0, 16)}</div>}
                          <div><b>Todo el día:</b> {detailTask.is_all_day ? 'Sí' : 'No'}</div>
                          <div><b>Repetición:</b> {detailTask.recurrence_type !== 'none' ? `${detailTask.recurrence_type} (${detailTask.recurrence_value || 1})` : 'No'}</div>
                          {detailTask.description && <div><b>Descripción:</b> {detailTask.description}</div>}
                          {/* Archivos adjuntos y otros campos aquí si los añades */}
                          <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', marginTop: 12 }}>
                            <button onClick={() => setDetailTask(null)}>Cerrar</button>
                          </div>
                        </div>
                      </div>
                    )}
                    {/* Modal detalle facturación */}
                    {detailBill && (
                      <div style={{ position: 'fixed', top: 0, left: 0, width: '100vw', height: '100vh', background: '#0008', zIndex: 1100, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                        <div style={{ background: '#fff', borderRadius: 12, padding: 32, minWidth: 340, boxShadow: '0 4px 24px #0002', display: 'flex', flexDirection: 'column', gap: 12, maxWidth: 420 }}>
                          <h3 style={{ margin: 0 }}>{detailBill.title}</h3>
                          <div><b>Empresa:</b> {companies.find(c => c.id === detailBill.client_company_id)?.name || ''}</div>
                          <div><b>Tipo:</b> {detailBill.direction === 'cobrar' ? 'A cobrar' : 'A pagar'}</div>
                          <div><b>Fecha:</b> {detailBill.billing_date}</div>
                          <div><b>Cantidad:</b> {detailBill.amount} €</div>
                          <div><b>Repetición:</b> {detailBill.recurrence_type !== 'none' ? `${detailBill.recurrence_type} (${detailBill.recurrence_value || 1})` : 'No'}</div>
                          {detailBill.description && <div><b>Descripción:</b> {detailBill.description}</div>}
                          {/* Archivos adjuntos y otros campos aquí si los añades */}
                          <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', marginTop: 12 }}>
                            <button onClick={() => setDetailBill(null)}>Cerrar</button>
                          </div>
                        </div>
                      </div>
                    )}
              </ul>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default Planning;
