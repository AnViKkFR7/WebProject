import React, { useRef, useEffect } from 'react';
import { format, startOfWeek, addDays, isToday, getHours, getMinutes, isSameDay } from 'date-fns';
import TaskCard from './TaskCard';

const HOUR_H   = 56;
const HOURS    = Array.from({ length: 24 }, (_, i) => i);
const DAY_SHORT = ['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom'];

function toGridEvent(task) {
  let startMin, endMin;
  if (task.is_all_day) {
    startMin = 8 * 60;
    endMin   = 8 * 60 + 30;
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

function layoutDay(events) {
  if (!events.length) return [];
  const sorted = [...events].sort((a, b) => a._start - b._start);
  const colEnds = [];
  return sorted.map(ev => {
    let col = colEnds.findIndex(end => end <= ev._start);
    if (col === -1) { col = colEnds.length; colEnds.push(ev._end); }
    else colEnds[col] = ev._end;
    return { ...ev, _col: col, _totalCols: colEnds.length };
  }).map((ev, _, arr) => ({ ...ev, _totalCols: colEnds.length }));
}

export default function WeekView({ date, tasks }) {
  const scrollRef = useRef(null);
  useEffect(() => {
    if (scrollRef.current) scrollRef.current.scrollTop = 7 * HOUR_H;
  }, []);

  const weekStart = startOfWeek(date, { weekStartsOn: 1 });
  const days = Array.from({ length: 7 }, (_, i) => addDays(weekStart, i));

  const now    = new Date();
  const nowMin = getHours(now) * 60 + getMinutes(now);

  // Agrupar tareas por día (separar all-day del grid)
  const byDay = {};
  const allDayByDay = {};
  days.forEach(day => {
    const k = format(day, 'yyyy-MM-dd');
    const dayTasks = tasks.filter(t => {
      if (!t.start_datetime) return false;
      return format(new Date(t.start_datetime), 'yyyy-MM-dd') === k;
    });
    allDayByDay[k] = dayTasks.filter(t => t.is_all_day);
    byDay[k] = layoutDay(dayTasks.filter(t => !t.is_all_day).map(toGridEvent).filter(Boolean));
  });
  const hasAnyAllDay = days.some(d => (allDayByDay[format(d, 'yyyy-MM-dd')] || []).length > 0);

  const colTemplate = `52px repeat(7, 1fr)`;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', flex: 1, minHeight: 0 }}>
      {/* Cabecera de días */}
      <div style={{ display: 'grid', gridTemplateColumns: colTemplate, borderBottom: '1px solid #e5e5ea', flexShrink: 0 }}>
        <div style={{ borderRight: '1px solid #e5e5ea' }} />
        {days.map((day, di) => {
          const today = isToday(day);
          return (
            <div key={di} style={{ textAlign: 'center', padding: '8px 4px 6px', borderRight: di < 6 ? '1px solid #f2f2f7' : 'none' }}>
              <div style={{ fontSize: 10, fontWeight: 600, color: di >= 5 ? '#c7c7cc' : '#8e8e93', textTransform: 'uppercase', letterSpacing: 0.5 }}>
                {DAY_SHORT[di]}
              </div>
              <span style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: 26, height: 26, borderRadius: '50%', fontSize: 14, fontWeight: today ? 700 : 400, color: today ? '#fff' : '#1c1c1e', background: today ? '#FF3B30' : 'transparent', marginTop: 2 }}>
                {format(day, 'd')}
              </span>
            </div>
          );
        })}
      </div>

      {/* Fila Todo el día */}
      {hasAnyAllDay && (
        <div style={{ display: 'grid', gridTemplateColumns: colTemplate, borderBottom: '1px solid #e5e5ea', flexShrink: 0, background: '#fafafa' }}>
          <div style={{ borderRight: '1px solid #e5e5ea', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '4px 0', fontSize: 10, color: '#8e8e93', userSelect: 'none', writingMode: 'vertical-rl', transform: 'rotate(180deg)', letterSpacing: 0.5 }}>
            Todo el día
          </div>
          {days.map((day, di) => {
            const k = format(day, 'yyyy-MM-dd');
            const evs = allDayByDay[k] || [];
            return (
              <div key={di} style={{ display: 'flex', flexDirection: 'column', gap: 2, padding: '3px 2px', borderRight: di < 6 ? '1px solid #f2f2f7' : 'none', minHeight: 26 }}>
                {evs.map((t, i) => (
                  <TaskCard key={t.id || i} task={t} view="week" style={{ position: 'relative', top: 'unset', left: 'unset', height: 'auto', width: '100%', zIndex: 1 }} />
                ))}
              </div>
            );
          })}
        </div>
      )}

      {/* Grid con scroll */}
      <div ref={scrollRef} style={{ flex: 1, overflowY: 'auto' }}>
        <div style={{ display: 'grid', gridTemplateColumns: colTemplate, height: 24 * HOUR_H, position: 'relative' }}>
          {/* Columna horas */}
          <div style={{ borderRight: '1px solid #e5e5ea', position: 'relative' }}>
            {HOURS.map(h => (
              <div key={h} style={{ position: 'absolute', top: h * HOUR_H - 7, right: 6, fontSize: 10, color: '#8e8e93', userSelect: 'none' }}>
                {h === 0 ? '' : `${h}:00`}
              </div>
            ))}
          </div>

          {/* Columnas de días */}
          {days.map((day, di) => {
            const k     = format(day, 'yyyy-MM-dd');
            const today = isToday(day);
            const evs   = byDay[k] || [];
            const totalCols = evs.length ? Math.max(...evs.map(e => e._totalCols)) : 1;

            return (
              <div key={di} style={{ position: 'relative', borderRight: di < 6 ? '1px solid #f2f2f7' : 'none', background: today ? '#fffaf9' : '#fff' }}>
                {/* Líneas */}
                {HOURS.map(h => (
                  <div key={h} style={{ position: 'absolute', top: h * HOUR_H, left: 0, right: 0, borderTop: h === 0 ? 'none' : '1px solid #f0f0f0', pointerEvents: 'none' }} />
                ))}
                {HOURS.map(h => (
                  <div key={`hf${h}`} style={{ position: 'absolute', top: h * HOUR_H + HOUR_H / 2, left: 0, right: 0, borderTop: '1px dashed #f7f7f7', pointerEvents: 'none' }} />
                ))}
                {/* Hora actual */}
                {today && (
                  <div style={{ position: 'absolute', top: nowMin * HOUR_H / 60, left: 0, right: 0, height: 2, background: '#FF3B30', zIndex: 3, pointerEvents: 'none' }}>
                    <div style={{ position: 'absolute', left: -1, top: -3, width: 7, height: 7, borderRadius: '50%', background: '#FF3B30' }} />
                  </div>
                )}
                {/* Tarjetas */}
                {evs.map((ev, i) => {
                  const tc   = Math.max(ev._totalCols, 1);
                  const pct  = 98 / tc;
                  const top    = ev._start * HOUR_H / 60 + 1;
                  const height = Math.max((ev._end - ev._start) * HOUR_H / 60 - 2, 20);
                  return (
                    <TaskCard
                      key={ev.id || i}
                      task={ev}
                      view="week"
                      style={{
                        position: 'absolute',
                        top,
                        height,
                        left: `calc(${ev._col * pct}% + 1px)`,
                        width: `calc(${pct}% - 2px)`,
                        zIndex: 2,
                      }}
                    />
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
