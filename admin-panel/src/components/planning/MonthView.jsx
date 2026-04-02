import React from 'react';
import { format, startOfMonth, endOfMonth, startOfWeek, endOfWeek, addDays, isSameMonth, isToday } from 'date-fns';
import TaskCard from './TaskCard';

const DAY_SHORT = ['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom'];

export default function MonthView({ date, tasks, onDelete, onEdit }) {
  const monthStart = startOfMonth(date);
  const gridStart  = startOfWeek(monthStart, { weekStartsOn: 1 });
  const gridEnd    = endOfWeek(endOfMonth(date), { weekStartsOn: 1 });

  const days = [];
  let d = gridStart;
  while (d <= gridEnd) { days.push(new Date(d)); d = addDays(d, 1); }

  // Agrupar tareas por día
  const byDay = {};
  tasks.forEach(task => {
    if (!task.start_datetime) return;
    const k = format(new Date(task.start_datetime), 'yyyy-MM-dd');
    (byDay[k] = byDay[k] || []).push(task);
  });

  const weeks = [];
  for (let i = 0; i < days.length; i += 7) weeks.push(days.slice(i, i + 7));

  return (
    <div style={{ display: 'flex', flexDirection: 'column', flex: 1, minHeight: 0, overflow: 'hidden' }}>
      {/* Cabecera días semana */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', borderBottom: '1px solid #e5e5ea', flexShrink: 0 }}>
        {DAY_SHORT.map((n, i) => (
          <div key={n} style={{ textAlign: 'center', padding: '7px 0', fontSize: 11, fontWeight: 600, letterSpacing: 0.5, color: i >= 5 ? '#c7c7cc' : '#8e8e93', textTransform: 'uppercase' }}>
            {n}
          </div>
        ))}
      </div>

      {/* Grid de semanas */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
        {weeks.map((week, wi) => (
          <div key={wi} style={{ flex: 1, display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', borderBottom: wi < weeks.length - 1 ? '1px solid #f2f2f7' : 'none', minHeight: 0 }}>
            {week.map((day, di) => {
              const k         = format(day, 'yyyy-MM-dd');
              const dayTasks  = byDay[k] || [];
              const inMonth   = isSameMonth(day, date);
              const today     = isToday(day);
              const weekend   = di >= 5;

              return (
                <div
                  key={k}
                  style={{ borderRight: di < 6 ? '1px solid #f2f2f7' : 'none', padding: '4px 4px 3px', background: today ? '#fff8f7' : !inMonth ? '#fafafa' : '#fff', overflow: 'hidden', display: 'flex', flexDirection: 'column', gap: 2 }}
                >
                  {/* Número del día */}
                  <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 1, flexShrink: 0 }}>
                    <span style={{ width: 22, height: 22, borderRadius: '50%', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', fontSize: 12, fontWeight: today ? 700 : 400, color: today ? '#fff' : inMonth ? (weekend ? '#8e8e93' : '#1c1c1e') : '#c7c7cc', background: today ? '#FF3B30' : 'transparent' }}>
                      {format(day, 'd')}
                    </span>
                  </div>

                  {/* Tarjetas pequeñas (máx 3 + "+N") */}
                  {dayTasks.slice(0, 3).map((task, ti) => (
                    <TaskCard key={task.id || ti} task={task} view="month" onDelete={onDelete} onEdit={onEdit} style={{ flexShrink: 0 }} />
                  ))}
                  {dayTasks.length > 3 && (
                    <div style={{ fontSize: 10, color: '#8e8e93', paddingLeft: 4 }}>+{dayTasks.length - 3} más</div>
                  )}
                </div>
              );
            })}
          </div>
        ))}
      </div>
    </div>
  );
}
