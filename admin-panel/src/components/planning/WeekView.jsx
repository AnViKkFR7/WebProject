import useCalendarHours from '../../hooks/useCalendarHours';
import { format, isToday, startOfWeek, addDays, getHours, getMinutes, setHours, setMinutes } from 'date-fns';
import TaskCard from './TaskCard';
import { minuteFromClick, layoutCalendarEvents, calendarEventBox } from '../../lib/calendarGrid';
import { useLanguage } from '../../contexts/LanguageContext';

const COLS = '52px repeat(7, minmax(0, 1fr))';

function toGridEvent(task) {
  const s = task.start_datetime ? new Date(task.start_datetime) : null;
  if (!s || isNaN(s)) return null;
  const e = task.end_datetime ? new Date(task.end_datetime) : null;
  const startMin = getHours(s) * 60 + getMinutes(s);
  let endMin = e && !isNaN(e) ? (format(e,'yyyy-MM-dd')>format(s,'yyyy-MM-dd') ? 1440 : getHours(e)*60+getMinutes(e)) : startMin+60;
  if (endMin <= startMin) endMin = startMin + 30;
  return { ...task, _start: startMin, _end: endMin };
}

export default function WeekView({ date, tasks, onDelete, onEdit, onSelectSlot, onMoveTask, onResizeTask, fullDay=false }) {
  const { t } = useLanguage();
  const {scrollRef,firstHour,lastHour,hourHeight:HOUR_H,hours:HOURS}=useCalendarHours(fullDay);

  const dayShort = t('planning.weekdaysShort');
  const weekStart = startOfWeek(date, { weekStartsOn: 1 });
  const days = Array.from({ length: 7 }, (_, i) => addDays(weekStart, i));
  const nowMin = getHours(new Date()) * 60 + getMinutes(new Date());

  const byDay = {};
  const allDayByDay = {};
  days.forEach(day => {
    const key = format(day, 'yyyy-MM-dd');
    const dayTasks = tasks.filter(task =>
      task.start_datetime && format(new Date(task.start_datetime), 'yyyy-MM-dd') === key);
    allDayByDay[key] = dayTasks.filter(task => task.is_all_day);
    byDay[key] = layoutCalendarEvents(dayTasks.filter(task => !task.is_all_day).map(toGridEvent).filter(Boolean));
  });
  const hasAnyAllDay = days.some(d => allDayByDay[format(d, 'yyyy-MM-dd')].length > 0);

  const handleColumnClick = (day) => (e) => {
    const { h, m } = minuteFromClick(e.clientY - e.currentTarget.getBoundingClientRect().top, HOUR_H,firstHour);
    onSelectSlot(setMinutes(setHours(new Date(day), h), m));
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', flex: 1, minHeight: 0 }}>
      <div className="cal-head" style={{ display: 'grid', gridTemplateColumns: COLS, padding: 0 }}>
        <span />
        {days.map((day, di) => (
          <span key={di} style={{ textAlign: 'center', padding: '0.5rem 0.25rem' }}>
            <span className="cal-weekday" style={{ display: 'block' }}>{dayShort[di]}</span>
            <span className={`cal-daynum${isToday(day) ? ' is-today' : ''}`} style={{ width: 26, height: 26, fontSize: '0.875rem' }}>
              {format(day, 'd')}
            </span>
          </span>
        ))}
      </div>

      {hasAnyAllDay && (
        <div className="cal-allday" style={{ gridTemplateColumns: COLS }}>
          <span className="cal-allday-label">{t('planning.allDayColumn')}</span>
          {days.map((day, di) => (
            <div key={di} className="cal-allday-items" style={{ flexDirection: 'column', minHeight: 26 }}>
              {allDayByDay[format(day, 'yyyy-MM-dd')].map((task, i) => (
                <TaskCard
                  key={task._occurrenceKey || task.id || i}
                  task={task}
                  view="week"
                  onDelete={onDelete}
                  onEdit={onEdit}
                  onMoveTask={onMoveTask} onResizeTask={onResizeTask} hourHeight={HOUR_H}
                  style={{ position: 'relative', height: 'auto', width: '100%' }}
                />
              ))}
            </div>
          ))}
        </div>
      )}

      <div className={`cal-scroll ${fullDay ? 'cal-full-day' : 'cal-business'}`} ref={scrollRef}>
        <div className="cal-grid" style={{ height: (lastHour-firstHour) * HOUR_H, gridTemplateColumns: COLS }}>
          <div className="cal-hours">
            {HOURS.map(h => (
              <span key={h} className="cal-hour-label" style={{ top: (h-firstHour) * HOUR_H + 2 }}>
                {h === 0 ? '' : `${h}:00`}
              </span>
            ))}
          </div>

          {days.map((day, di) => {
            const key = format(day, 'yyyy-MM-dd');
            const today = isToday(day);

            return (
              <div key={di} className={`cal-col${today ? ' is-today' : ''}`}>
                {onSelectSlot && (
                  <button type="button" className="cal-slot-layer" tabIndex={-1} aria-hidden="true" onClick={handleColumnClick(day)} />
                )}

                {HOURS.map(h => (
                  <span key={h} className="cal-line" style={{ top: (h-firstHour) * HOUR_H, display: h === 0 ? 'none' : undefined }} />
                ))}
                {HOURS.map(h => (
                  <span key={`half-${h}`} className="cal-line cal-line-half" style={{ top: (h-firstHour) * HOUR_H + HOUR_H / 2 }} />
                ))}

                {today && nowMin>=firstHour*60 && nowMin<lastHour*60 && <span className="cal-now" style={{ top: (nowMin-firstHour*60) * HOUR_H / 60 }} />}

                {byDay[key].filter(ev=>ev._end>firstHour*60 && ev._start<lastHour*60).map((ev, i) => {
                  const totalCols = Math.max(ev._totalCols, 1);
                  const pct = 98 / totalCols;
                  return (
                    <TaskCard
                      key={ev._occurrenceKey || ev.id || i}
                      task={ev}
                      view="week"
                      onDelete={onDelete}
                      onEdit={onEdit}
                      onMoveTask={onMoveTask} onResizeTask={onResizeTask} hourHeight={HOUR_H}
                      style={{
                        position: 'absolute',
                        ...calendarEventBox(ev,firstHour,lastHour,HOUR_H),
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
