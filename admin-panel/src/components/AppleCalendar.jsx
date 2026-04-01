import React, { useState, useRef, useEffect } from 'react';
import {
  format, startOfMonth, endOfMonth, startOfWeek, endOfWeek,
  addDays, addWeeks, addMonths, subDays, subWeeks, subMonths,
  isSameDay, isSameMonth, isToday, getHours, getMinutes,
  setHours, setMinutes,
} from 'date-fns';

const HOUR_HEIGHT = 64; // px per hour
const DAY_SHORT = ['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom'];
const MONTHS_ES = ['Enero','Febrero','Marzo','Abril','Mayo','Junio','Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre'];
const DAYS_ES   = ['Domingo','Lunes','Martes','Miércoles','Jueves','Viernes','Sábado'];

// Convierte un color hex a una versión más clara
function lightenHex(hex, factor = 0.80) {
  try {
    const h = (hex || '#999999').replace('#', '');
    const r = parseInt(h.substring(0, 2), 16);
    const g = parseInt(h.substring(2, 4), 16);
    const b = parseInt(h.substring(4, 6), 16);
    return `rgb(${Math.round(r + (255 - r) * factor)},${Math.round(g + (255 - g) * factor)},${Math.round(b + (255 - b) * factor)})`;
  } catch { return '#e8e8e8'; }
}

// Asigna columnas a eventos solapados en un día
function layoutDay(events) {
  if (!events.length) return [];
  const sorted = [...events].sort((a, b) => a.start - b.start);
  const colEnds = [];
  const placed = sorted.map(ev => {
    let col = colEnds.findIndex(end => end <= ev.start);
    if (col === -1) { col = colEnds.length; colEnds.push(ev.end); }
    else colEnds[col] = ev.end;
    return { ...ev, col };
  });
  const total = colEnds.length;
  return placed.map(ev => ({ ...ev, totalCols: total }));
}

// ─────────────── VISTA MES ───────────────
function MonthView({ date, events, onSelectEvent, onSelectSlot, getCompanyColor }) {
  const ms = startOfMonth(date);
  const gridStart = startOfWeek(ms, { weekStartsOn: 1 });
  const gridEnd   = endOfWeek(endOfMonth(date), { weekStartsOn: 1 });

  const days = [];
  let d = gridStart;
  while (d <= gridEnd) { days.push(new Date(d)); d = addDays(d, 1); }

  const byDay = {};
  events.forEach(ev => {
    const k = format(ev.start, 'yyyy-MM-dd');
    (byDay[k] = byDay[k] || []).push(ev);
  });

  const weeks = [];
  for (let i = 0; i < days.length; i += 7) weeks.push(days.slice(i, i + 7));

  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
      {/* Cabecera días */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', borderBottom: '1px solid #e5e5ea', flexShrink: 0 }}>
        {DAY_SHORT.map((n, i) => (
          <div key={n} style={{ textAlign: 'center', padding: '7px 0', fontSize: 11, fontWeight: 600, letterSpacing: 0.5, color: i >= 5 ? '#c7c7cc' : '#8e8e93', textTransform: 'uppercase' }}>
            {n}
          </div>
        ))}
      </div>
      {/* Grid semanas */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
        {weeks.map((week, wi) => (
          <div key={wi} style={{ flex: 1, display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', borderBottom: wi < weeks.length - 1 ? '1px solid #f2f2f7' : 'none', minHeight: 0 }}>
            {week.map((day, di) => {
              const k = format(day, 'yyyy-MM-dd');
              const dayEvs = byDay[k] || [];
              const currMonth = isSameMonth(day, date);
              const today = isToday(day);
              const weekend = di >= 5;
              return (
                <div
                  key={k}
                  onClick={() => onSelectSlot(day)}
                  style={{ borderRight: di < 6 ? '1px solid #f2f2f7' : 'none', padding: '4px 5px 3px', background: today ? '#fff8f7' : weekend && currMonth ? '#fafafa' : '#fff', cursor: 'pointer', overflow: 'hidden', display: 'flex', flexDirection: 'column' }}
                >
                  {/* Número del día */}
                  <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 2, flexShrink: 0 }}>
                    <span style={{ width: 22, height: 22, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12, fontWeight: today ? 700 : 400, color: today ? '#fff' : currMonth ? (weekend ? '#8e8e93' : '#1c1c1e') : '#c7c7cc', background: today ? '#FF3B30' : 'transparent' }}>
                      {format(day, 'd')}
                    </span>
                  </div>
                  {/* Eventos (máx 3 + "+N más") */}
                  {dayEvs.slice(0, 3).map(ev => {
                    const col = getCompanyColor(ev.company || {});
                    return (
                      <div
                        key={ev.id}
                        onClick={e => { e.stopPropagation(); onSelectEvent(ev); }}
                        title={ev.title}
                        style={{ background: lightenHex(col, 0.78), borderLeft: `3px solid ${col}`, borderRadius: 4, padding: '1px 4px', marginBottom: 2, fontSize: 10.5, fontWeight: 500, color: '#1c1c1e', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', cursor: 'pointer', lineHeight: 1.5, flexShrink: 0 }}
                      >
                        {!ev.is_all_day && <span style={{ color: '#636366', marginRight: 3, fontSize: 10 }}>{format(ev.start, 'H:mm')}</span>}
                        {ev.title}
                      </div>
                    );
                  })}
                  {dayEvs.length > 3 && <div style={{ fontSize: 10, color: '#8e8e93', paddingLeft: 4 }}>+{dayEvs.length - 3} más</div>}
                </div>
              );
            })}
          </div>
        ))}
      </div>
    </div>
  );
}

// ─────────────── GRID DE HORAS (semana / día) ───────────────
function TimeGrid({ days, events, onSelectEvent, onSelectSlot, getCompanyColor }) {
  const scrollRef = useRef(null);
  useEffect(() => {
    if (scrollRef.current) scrollRef.current.scrollTop = 7 * HOUR_HEIGHT;
  }, [days.length]);

  const allDay = events.filter(ev => ev.is_all_day);
  const timedByDay = {};
  days.forEach(day => {
    const k = format(day, 'yyyy-MM-dd');
    const evs = events.filter(ev => !ev.is_all_day && isSameDay(ev.start, day));
    timedByDay[k] = layoutDay(evs);
  });

  const now = new Date();
  const nowTop = (getHours(now) * 60 + getMinutes(now)) * HOUR_HEIGHT / 60;
  const cols = days.length;
  const colTemplate = `56px repeat(${cols}, 1fr)`;

  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
      {/* Cabecera de días */}
      <div style={{ display: 'grid', gridTemplateColumns: colTemplate, borderBottom: '1px solid #e5e5ea', flexShrink: 0 }}>
        <div style={{ borderRight: '1px solid #e5e5ea' }} />
        {days.map(day => {
          const today = isToday(day);
          const di = (day.getDay() + 6) % 7; // 0=Lun
          return (
            <div key={day.toISOString()} style={{ textAlign: 'center', padding: '8px 4px 6px', borderRight: '1px solid #f2f2f7' }}>
              <div style={{ fontSize: 10, fontWeight: 600, color: di >= 5 ? '#c7c7cc' : '#8e8e93', textTransform: 'uppercase', letterSpacing: 0.5 }}>
                {DAY_SHORT[di]}
              </div>
              <span style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: 28, height: 28, borderRadius: '50%', fontSize: 16, fontWeight: today ? 700 : 400, color: today ? '#fff' : '#1c1c1e', background: today ? '#FF3B30' : 'transparent', marginTop: 1 }}>
                {format(day, 'd')}
              </span>
            </div>
          );
        })}
      </div>

      {/* Banda "Todo el día" */}
      {allDay.length > 0 && (
        <div style={{ display: 'grid', gridTemplateColumns: colTemplate, borderBottom: '1px solid #e5e5ea', flexShrink: 0 }}>
          <div style={{ fontSize: 9, color: '#8e8e93', textAlign: 'right', paddingRight: 6, paddingTop: 6, lineHeight: 1.3, borderRight: '1px solid #e5e5ea' }}>todo<br/>el día</div>
          {days.map(day => {
            const dayEvs = allDay.filter(ev => isSameDay(ev.start, day));
            return (
              <div key={day.toISOString()} style={{ padding: '3px 4px', borderRight: '1px solid #f2f2f7', minHeight: 28 }}>
                {dayEvs.map(ev => {
                  const col = getCompanyColor(ev.company || {});
                  return (
                    <div key={ev.id} onClick={e => { e.stopPropagation(); onSelectEvent(ev); }} style={{ background: lightenHex(col, 0.78), borderLeft: `3px solid ${col}`, borderRadius: 4, padding: '2px 6px', fontSize: 11, fontWeight: 500, color: '#1c1c1e', cursor: 'pointer', marginBottom: 2, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                      {ev.title}
                    </div>
                  );
                })}
              </div>
            );
          })}
        </div>
      )}

      {/* Grid de horas con scroll */}
      <div ref={scrollRef} style={{ flex: 1, overflowY: 'auto', position: 'relative' }}>
        <div style={{ display: 'grid', gridTemplateColumns: colTemplate, height: 24 * HOUR_HEIGHT, position: 'relative' }}>
          {/* Columna de horas */}
          <div style={{ position: 'relative', borderRight: '1px solid #e5e5ea' }}>
            {Array.from({ length: 24 }, (_, h) => (
              <div key={h} style={{ position: 'absolute', top: h * HOUR_HEIGHT - 7, right: 8, fontSize: 10, color: '#8e8e93', lineHeight: 1, userSelect: 'none' }}>
                {h === 0 ? '' : `${h}:00`}
              </div>
            ))}
          </div>

          {/* Columnas de días */}
          {days.map(day => {
            const k = format(day, 'yyyy-MM-dd');
            const dayEvs = timedByDay[k] || [];
            const today = isToday(day);
            return (
              <div
                key={k}
                onClick={e => {
                  const rect = e.currentTarget.getBoundingClientRect();
                  const relY = e.clientY - rect.top;
                  const h = Math.min(Math.floor(relY / HOUR_HEIGHT), 23);
                  const m = Math.min(Math.round(((relY % HOUR_HEIGHT) / HOUR_HEIGHT) * 60 / 15) * 15, 59);
                  onSelectSlot(setMinutes(setHours(new Date(day), h), m));
                }}
                style={{ position: 'relative', borderRight: '1px solid #f2f2f7', background: today ? '#fffaf9' : '#fff', cursor: 'crosshair' }}
              >
                {/* Líneas de horas */}
                {Array.from({ length: 24 }, (_, h) => (
                  <div key={h} style={{ position: 'absolute', top: h * HOUR_HEIGHT, left: 0, right: 0, borderTop: h === 0 ? 'none' : '1px solid #f0f0f0', pointerEvents: 'none' }} />
                ))}
                {/* Líneas de media hora */}
                {Array.from({ length: 24 }, (_, h) => (
                  <div key={`hf${h}`} style={{ position: 'absolute', top: h * HOUR_HEIGHT + HOUR_HEIGHT / 2, left: 0, right: 0, borderTop: '1px dashed #f7f7f7', pointerEvents: 'none' }} />
                ))}
                {/* Indicador hora actual */}
                {today && (
                  <div style={{ position: 'absolute', top: nowTop, left: 0, right: 0, height: 2, background: '#FF3B30', zIndex: 3, pointerEvents: 'none' }}>
                    <div style={{ position: 'absolute', left: -1, top: -3, width: 8, height: 8, borderRadius: '50%', background: '#FF3B30' }} />
                  </div>
                )}
                {/* Eventos */}
                {dayEvs.map(ev => {
                  const col = getCompanyColor(ev.company || {});
                  const sm = getHours(ev.start) * 60 + getMinutes(ev.start);
                  const em = getHours(ev.end) * 60 + getMinutes(ev.end);
                  const dur = Math.max(em - sm, 20);
                  const top = sm * HOUR_HEIGHT / 60;
                  const height = dur * HOUR_HEIGHT / 60;
                  const pct = 100 / ev.totalCols;
                  return (
                    <div
                      key={ev.id}
                      onClick={e => { e.stopPropagation(); onSelectEvent(ev); }}
                      style={{
                        position: 'absolute',
                        top: top + 1, height: height - 2,
                        left: `calc(${ev.col * pct}% + 3px)`,
                        width: `calc(${pct}% - 6px)`,
                        background: lightenHex(col, 0.80),
                        borderLeft: `3px solid ${col}`,
                        borderRadius: 6,
                        padding: '3px 6px',
                        overflow: 'hidden', cursor: 'pointer', zIndex: 2,
                        boxShadow: '0 1px 3px rgba(0,0,0,0.08)',
                        display: 'flex', flexDirection: 'column',
                      }}
                    >
                      <div style={{ fontSize: 11, fontWeight: 600, color: '#1c1c1e', lineHeight: 1.3, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {ev.title}
                      </div>
                      {height >= 36 && (
                        <div style={{ fontSize: 10, color: '#636366', lineHeight: 1.2 }}>
                          {format(ev.start, 'H:mm')} – {format(ev.end, 'H:mm')}
                        </div>
                      )}
                      {height >= 52 && ev.company?.name && (
                        <div style={{ fontSize: 10, color: '#636366', lineHeight: 1.2, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          {ev.company.name}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

// ─────────────── COMPONENTE PRINCIPAL ───────────────
export default function AppleCalendar({ events = [], getCompanyColor, onSelectEvent, onSelectSlot }) {
  const [view, setView]       = useState('week');
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

  const title = (() => {
    if (view === 'month') return `${MONTHS_ES[current.getMonth()]} ${current.getFullYear()}`;
    if (view === 'week') {
      const ws = startOfWeek(current, { weekStartsOn: 1 });
      const we = endOfWeek(current, { weekStartsOn: 1 });
      if (ws.getMonth() === we.getMonth()) return `${MONTHS_ES[ws.getMonth()]} ${ws.getFullYear()}`;
      return `${MONTHS_ES[ws.getMonth()]} – ${MONTHS_ES[we.getMonth()]} ${we.getFullYear()}`;
    }
    return `${DAYS_ES[current.getDay()]}, ${current.getDate()} de ${MONTHS_ES[current.getMonth()]} ${current.getFullYear()}`;
  })();

  const days = view === 'week'
    ? Array.from({ length: 7 }, (_, i) => addDays(startOfWeek(current, { weekStartsOn: 1 }), i))
    : [current];

  const btnBase = { all: 'unset', cursor: 'pointer', borderRadius: 7, transition: 'background 0.12s' };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', background: '#fff', borderRadius: 12, overflow: 'hidden', border: '1px solid #e5e5ea', fontFamily: '-apple-system, BlinkMacSystemFont, "SF Pro Text", "Segoe UI", sans-serif' }}>
      {/* ── Barra superior ── */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 16px', borderBottom: '1px solid #e5e5ea', flexShrink: 0, background: '#fff' }}>

        {/* Navegación */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 2 }}>
          <button {...btnBase} onClick={goBack} style={{ ...btnBase, width: 28, height: 28, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 20, color: '#1c1c1e' }}
            onMouseEnter={e => e.currentTarget.style.background = '#f2f2f7'}
            onMouseLeave={e => e.currentTarget.style.background = 'transparent'}>‹</button>
          <button {...btnBase} onClick={() => setCurrent(new Date())} style={{ ...btnBase, padding: '4px 10px', fontSize: 12, fontWeight: 500, color: '#1c1c1e', border: '1px solid #d1d1d6', background: '#fff' }}
            onMouseEnter={e => e.currentTarget.style.background = '#f2f2f7'}
            onMouseLeave={e => e.currentTarget.style.background = '#fff'}>Hoy</button>
          <button {...btnBase} onClick={goFwd} style={{ ...btnBase, width: 28, height: 28, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 20, color: '#1c1c1e' }}
            onMouseEnter={e => e.currentTarget.style.background = '#f2f2f7'}
            onMouseLeave={e => e.currentTarget.style.background = 'transparent'}>›</button>
        </div>

        {/* Título */}
        <span style={{ fontSize: 15, fontWeight: 600, color: '#1c1c1e', letterSpacing: -0.3, textTransform: 'capitalize', userSelect: 'none' }}>
          {title}
        </span>

        {/* Selector de vista (segmented control estilo Apple) */}
        <div style={{ display: 'flex', background: '#f2f2f7', borderRadius: 9, padding: 2 }}>
          {[{ k: 'day', l: 'Día' }, { k: 'week', l: 'Semana' }, { k: 'month', l: 'Mes' }].map(v => (
            <button
              key={v.k}
              onClick={() => setView(v.k)}
              style={{ all: 'unset', cursor: 'pointer', padding: '4px 12px', borderRadius: 7, fontSize: 12, fontWeight: view === v.k ? 600 : 400, color: '#1c1c1e', background: view === v.k ? '#fff' : 'transparent', boxShadow: view === v.k ? '0 1px 4px rgba(0,0,0,0.14)' : 'none', transition: 'all 0.15s' }}
            >{v.l}</button>
          ))}
        </div>
      </div>

      {/* ── Cuerpo del calendario ── */}
      {view === 'month'
        ? <MonthView date={current} events={events} onSelectEvent={onSelectEvent} onSelectSlot={onSelectSlot} getCompanyColor={getCompanyColor} />
        : <TimeGrid days={days} events={events} onSelectEvent={onSelectEvent} onSelectSlot={onSelectSlot} getCompanyColor={getCompanyColor} />
      }
    </div>
  );
}
