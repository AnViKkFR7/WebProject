import React, { useState } from 'react';
import { format, addDays, addWeeks, addMonths, subDays, subWeeks, subMonths } from 'date-fns';
import DayView   from './DayView';
import WeekView  from './WeekView';
import MonthView from './MonthView';

const MONTHS_ES = ['Enero','Febrero','Marzo','Abril','Mayo','Junio','Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre'];
const DAYS_ES   = ['Domingo','Lunes','Martes','Miércoles','Jueves','Viernes','Sábado'];

function getTitle(view, date) {
  if (view === 'month') return `${MONTHS_ES[date.getMonth()]} ${date.getFullYear()}`;
  if (view === 'week') {
    const { startOfWeek, endOfWeek } = require('date-fns');
    // Calcular manualmente para no importar dinámicamente
    const ws = new Date(date);
    const day = (ws.getDay() + 6) % 7; // 0=Lun
    ws.setDate(ws.getDate() - day);
    const we = new Date(ws); we.setDate(we.getDate() + 6);
    if (ws.getMonth() === we.getMonth())
      return `${MONTHS_ES[ws.getMonth()]} ${ws.getFullYear()}`;
    return `${MONTHS_ES[ws.getMonth()]} – ${MONTHS_ES[we.getMonth()]} ${we.getFullYear()}`;
  }
  return `${DAYS_ES[date.getDay()]}, ${date.getDate()} de ${MONTHS_ES[date.getMonth()]} ${date.getFullYear()}`;
}

export default function CalendarWrapper({ tasks, defaultView = 'week' }) {
  const [view, setView]       = useState(defaultView);
  const [current, setCurrent] = useState(new Date());

  const goBack = () => {
    if (view === 'month') setCurrent(d => subMonths(d, 1));
    else if (view === 'week') setCurrent(d => subWeeks(d, 1));
    else setCurrent(d => subDays(d, 1));
  };
  const goFwd = () => {
    if (view === 'month') setCurrent(d => addMonths(d, 1));
    else if (view === 'week') setCurrent(d => addWeeks(d, 1));
    else setCurrent(d => addDays(d, 1));
  };

  // Título según vista
  const title = (() => {
    if (view === 'month') return `${MONTHS_ES[current.getMonth()]} ${current.getFullYear()}`;
    if (view === 'week') {
      const ws = new Date(current);
      const day = (ws.getDay() + 6) % 7;
      ws.setDate(ws.getDate() - day);
      const we = new Date(ws); we.setDate(we.getDate() + 6);
      if (ws.getMonth() === we.getMonth())
        return `${MONTHS_ES[ws.getMonth()]} ${ws.getFullYear()}`;
      return `${MONTHS_ES[ws.getMonth()]} – ${MONTHS_ES[we.getMonth()]} ${we.getFullYear()}`;
    }
    return `${DAYS_ES[current.getDay()]}, ${current.getDate()} de ${MONTHS_ES[current.getMonth()]} ${current.getFullYear()}`;
  })();

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', background: '#fff', borderRadius: 14, overflow: 'hidden', border: '1px solid #e5e5ea', fontFamily: '-apple-system, BlinkMacSystemFont, "SF Pro Text", "Segoe UI", sans-serif' }}>

      {/* ── Barra superior ── */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 16px', borderBottom: '1px solid #e5e5ea', flexShrink: 0 }}>

        {/* Navegación */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 2 }}>
          <NavBtn onClick={goBack}>‹</NavBtn>
          <button
            onClick={() => setCurrent(new Date())}
            style={{ all: 'unset', cursor: 'pointer', padding: '4px 11px', fontSize: 12, fontWeight: 500, color: '#1c1c1e', border: '1px solid #d1d1d6', borderRadius: 8, background: '#fff' }}
            onMouseEnter={e => e.currentTarget.style.background = '#f2f2f7'}
            onMouseLeave={e => e.currentTarget.style.background = '#fff'}
          >Hoy</button>
          <NavBtn onClick={goFwd}>›</NavBtn>
        </div>

        {/* Título */}
        <span style={{ fontSize: 14, fontWeight: 600, color: '#1c1c1e', letterSpacing: -0.2, textTransform: 'capitalize', userSelect: 'none' }}>
          {title}
        </span>

        {/* Segmented control */}
        <div style={{ display: 'flex', background: '#f2f2f7', borderRadius: 9, padding: 2 }}>
          {[{ k: 'day', l: 'Día' }, { k: 'week', l: 'Semana' }, { k: 'month', l: 'Mes' }].map(v => (
            <button
              key={v.k}
              onClick={() => setView(v.k)}
              style={{ all: 'unset', cursor: 'pointer', padding: '4px 13px', borderRadius: 7, fontSize: 12, fontWeight: view === v.k ? 600 : 400, color: '#1c1c1e', background: view === v.k ? '#fff' : 'transparent', boxShadow: view === v.k ? '0 1px 4px rgba(0,0,0,0.14)' : 'none', transition: 'all 0.12s' }}
            >{v.l}</button>
          ))}
        </div>
      </div>

      {/* ── Cuerpo ── */}
      <div style={{ flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
        {view === 'day'   && <DayView   date={current} tasks={tasks} />}
        {view === 'week'  && <WeekView  date={current} tasks={tasks} />}
        {view === 'month' && <MonthView date={current} tasks={tasks} />}
      </div>
    </div>
  );
}

function NavBtn({ onClick, children }) {
  const [hover, setHover] = useState(false);
  return (
    <button
      onClick={onClick}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      style={{ all: 'unset', cursor: 'pointer', width: 28, height: 28, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', fontSize: 20, color: '#1c1c1e', borderRadius: 7, background: hover ? '#f2f2f7' : 'transparent' }}
    >{children}</button>
  );
}
