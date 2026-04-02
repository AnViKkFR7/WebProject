import React, { useRef, useEffect } from 'react';
import { format, isToday, getHours, getMinutes } from 'date-fns';
import TaskCard from './TaskCard';

const HOUR_H = 64; // px por hora
const HOURS = Array.from({ length: 24 }, (_, i) => i);

// Asigna columnas a eventos que se solapan
function layoutEvents(events) {
  if (!events.length) return [];
  const sorted = [...events].sort((a, b) => a._start - b._start);
  const cols = [];
  return sorted.map(ev => {
    let col = cols.findIndex(end => end <= ev._start);
    if (col === -1) { col = cols.length; cols.push(ev._end); }
    else cols[col] = ev._end;
    return { ...ev, _col: col, _totalCols: 0 };
  }).map((ev, _, arr) => ({
    ...ev,
    _totalCols: arr.filter(e => e._col >= 0 && overlaps(e, ev)).length || 1,
  }));
}

function overlaps(a, b) {
  return a._start < b._end && b._start < a._end;
}

// Convierte una tarea al formato interno para la grid
function toGridEvent(task) {
  let startMin, endMin;
  if (task.is_all_day) {
    startMin = 8 * 60;      // 08:00
    endMin   = 8 * 60 + 30; // 08:30
  } else {
    const s = task.start_datetime ? new Date(task.start_datetime) : null;
    const e = task.end_datetime   ? new Date(task.end_datetime)   : null;
    if (!s || isNaN(s)) return null;
    startMin = getHours(s) * 60 + getMinutes(s);
    endMin   = e && !isNaN(e) ? getHours(e) * 60 + getMinutes(e) : startMin + 60;
    if (endMin <= startMin) endMin = startMin + 30;
  }
  return { ...task, _start: startMin, _end: endMin };
}

export default function DayView({ date, tasks }) {
  const scrollRef = useRef(null);
  useEffect(() => {
    // Hacer scroll al inicio de la jornada laboral
    if (scrollRef.current) scrollRef.current.scrollTop = 7 * HOUR_H;
  }, []);

  const today = isToday(date);
  const nowMin = today ? getHours(new Date()) * 60 + getMinutes(new Date()) : null;

  // Filtrar tareas del día
  const dayTasks = tasks.filter(t => {
    if (!t.start_datetime) return false;
    const d = new Date(t.start_datetime);
    return format(d, 'yyyy-MM-dd') === format(date, 'yyyy-MM-dd');
  });

  const allDayTasks = dayTasks.filter(t => t.is_all_day);
  const timedTasks  = dayTasks.filter(t => !t.is_all_day);
  const gridEvents  = timedTasks.map(toGridEvent).filter(Boolean);
  const laid        = layoutEvents(gridEvents);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', flex: 1, minHeight: 0 }}>
      {/* Cabecera del día */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '10px 16px 8px', borderBottom: '1px solid #e5e5ea', flexShrink: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{ fontSize: 12, fontWeight: 600, color: '#8e8e93', textTransform: 'uppercase', letterSpacing: 0.5 }}>
            {format(date, 'EEEE')}
          </span>
          <span style={{ width: 32, height: 32, borderRadius: '50%', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', fontSize: 18, fontWeight: today ? 700 : 500, background: today ? '#FF3B30' : 'transparent', color: today ? '#fff' : '#1c1c1e' }}>
            {format(date, 'd')}
          </span>
          <span style={{ fontSize: 13, color: '#8e8e93' }}>{format(date, 'MMMM yyyy')}</span>
        </div>
      </div>

      {/* Fila Todo el día */}
      {allDayTasks.length > 0 && (
        <div style={{ display: 'grid', gridTemplateColumns: '52px 1fr', borderBottom: '1px solid #e5e5ea', flexShrink: 0, background: '#fafafa' }}>
          <div style={{ borderRight: '1px solid #e5e5ea', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '4px 0', fontSize: 10, color: '#8e8e93', userSelect: 'none', writingMode: 'vertical-rl', transform: 'rotate(180deg)', letterSpacing: 0.5 }}>
            Todo el día
          </div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, padding: '4px 6px' }}>
            {allDayTasks.map((t, i) => (
              <TaskCard key={t.id || i} task={t} view="day" style={{ position: 'relative', top: 'unset', left: 'unset', height: 'auto', width: 'auto', flex: '0 0 auto', maxWidth: '100%' }} />
            ))}
          </div>
        </div>
      )}

      {/* Grid con scroll */}
      <div ref={scrollRef} style={{ flex: 1, overflowY: 'auto', position: 'relative' }}>
        <div style={{ position: 'relative', height: 24 * HOUR_H, display: 'grid', gridTemplateColumns: '52px 1fr' }}>
          {/* Columna de horas */}
          <div style={{ borderRight: '1px solid #e5e5ea', position: 'relative' }}>
            {HOURS.map(h => (
              <div key={h} style={{ position: 'absolute', top: h * HOUR_H - 7, right: 8, fontSize: 10, color: '#8e8e93', userSelect: 'none' }}>
                {h === 0 ? '' : `${h}:00`}
              </div>
            ))}
          </div>

          {/* Columna de eventos */}
          <div style={{ position: 'relative', background: today ? '#fffaf9' : '#fff' }}>
            {/* Líneas de horas */}
            {HOURS.map(h => (
              <div key={h} style={{ position: 'absolute', top: h * HOUR_H, left: 0, right: 0, borderTop: h === 0 ? 'none' : '1px solid #f0f0f0', pointerEvents: 'none' }} />
            ))}
            {/* Líneas de media hora */}
            {HOURS.map(h => (
              <div key={`h${h}`} style={{ position: 'absolute', top: h * HOUR_H + HOUR_H / 2, left: 0, right: 0, borderTop: '1px dashed #f7f7f7', pointerEvents: 'none' }} />
            ))}
            {/* Línea de hora actual */}
            {today && nowMin !== null && (
              <div style={{ position: 'absolute', top: nowMin * HOUR_H / 60, left: 0, right: 0, height: 2, background: '#FF3B30', zIndex: 3, pointerEvents: 'none' }}>
                <div style={{ position: 'absolute', left: -1, top: -3, width: 8, height: 8, borderRadius: '50%', background: '#FF3B30' }} />
              </div>
            )}
            {/* Tarjetas */}
            {laid.map((ev, i) => {
              const top    = ev._start * HOUR_H / 60 + 1;
              const height = Math.max((ev._end - ev._start) * HOUR_H / 60 - 2, 22);
              const totalCols = Math.max(ev._totalCols, 1);
              const pct    = 98 / totalCols;
              return (
                <TaskCard
                  key={ev.id || i}
                  task={ev}
                  view="day"
                  style={{
                    position: 'absolute',
                    top,
                    height,
                    left: `calc(${ev._col * pct}% + 2px)`,
                    width: `calc(${pct}% - 4px)`,
                    zIndex: 2,
                  }}
                />
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}
