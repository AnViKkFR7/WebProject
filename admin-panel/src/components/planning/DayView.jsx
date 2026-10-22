import useCalendarHours from '../../hooks/useCalendarHours';
import { format, isToday, getHours, getMinutes, setHours, setMinutes } from 'date-fns';
import TaskCard from './TaskCard';
import { useLanguage } from '../../contexts/LanguageContext';
import { minuteFromClick, layoutCalendarEvents, calendarEventBox } from '../../lib/calendarGrid';


function toGridEvent(task) {
  let startMin, endMin;
  if (task.is_all_day) {
    startMin = 8 * 60;
    endMin = 8 * 60 + 30;
  } else {
    const s = task.start_datetime ? new Date(task.start_datetime) : null;
    const e = task.end_datetime ? new Date(task.end_datetime) : null;
    if (!s || isNaN(s)) return null;
    startMin = getHours(s) * 60 + getMinutes(s);
    endMin = e && !isNaN(e) ? (format(e,'yyyy-MM-dd')>format(s,'yyyy-MM-dd') ? 1440 : getHours(e)*60+getMinutes(e)) : startMin+60;
    if (endMin <= startMin) endMin = startMin + 30;
  }
  return { ...task, _start: startMin, _end: endMin };
}

export default function DayView({ date, tasks, onDelete, onEdit, onSelectSlot, fullDay=false }) {
  const { t } = useLanguage();
  const {scrollRef,firstHour,lastHour,hourHeight:HOUR_H,hours:HOURS}=useCalendarHours(fullDay);

  const weekdaysLong = t('planning.weekdaysLong');
  const months = t('planning.months');

  const today = isToday(date);
  const nowMin = today ? getHours(new Date()) * 60 + getMinutes(new Date()) : null;

  const dayTasks = tasks.filter(task => {
    if (!task.start_datetime) return false;
    return format(new Date(task.start_datetime), 'yyyy-MM-dd') === format(date, 'yyyy-MM-dd');
  });

  const allDayTasks = dayTasks.filter(task => task.is_all_day);
  const laid = layoutCalendarEvents(dayTasks.filter(task => !task.is_all_day).map(toGridEvent).filter(Boolean));

  const handleGridClick = (e) => {
    const { h, m } = minuteFromClick(e.clientY - e.currentTarget.getBoundingClientRect().top, HOUR_H,firstHour);
    onSelectSlot(setMinutes(setHours(new Date(date), h), m));
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', flex: 1, minHeight: 0 }}>
      <div className="cal-head">
        <span className="cal-weekday">{weekdaysLong[date.getDay()]}</span>
        <span className={`cal-daynum${today ? ' is-today' : ''}`}>{date.getDate()}</span>
        <span className="cal-month">{months[date.getMonth()]} {date.getFullYear()}</span>
      </div>

      {allDayTasks.length > 0 && (
        <div className="cal-allday">
          <span className="cal-allday-label">{t('planning.allDayColumn')}</span>
          <div className="cal-allday-items">
            {allDayTasks.map((task, i) => (
              <TaskCard
                key={task._occurrenceKey || task.id || i}
                task={task}
                view="day"
                onDelete={onDelete}
                onEdit={onEdit}
                style={{ position: 'relative', height: 'auto', width: 'auto', flex: '0 0 auto', maxWidth: '100%' }}
              />
            ))}
          </div>
        </div>
      )}

      <div className={`cal-scroll ${fullDay ? 'cal-full-day' : 'cal-business'}`} ref={scrollRef}>
        <div className="cal-grid" style={{ height: (lastHour-firstHour) * HOUR_H, gridTemplateColumns: '52px 1fr' }}>
          <div className="cal-hours">
            {HOURS.map(h => (
              <span key={h} className="cal-hour-label" style={{ top: (h-firstHour) * HOUR_H + 2 }}>
                {h === 0 ? '' : `${h}:00`}
              </span>
            ))}
          </div>

          <div className={`cal-col${today ? ' is-today' : ''}`}>
            {onSelectSlot && (
              <button type="button" className="cal-slot-layer" tabIndex={-1} aria-hidden="true" onClick={handleGridClick} />
            )}

            {HOURS.map(h => (
              <span key={h} className="cal-line" style={{ top: (h-firstHour) * HOUR_H, display: h === 0 ? 'none' : undefined }} />
            ))}
            {HOURS.map(h => (
              <span key={`half-${h}`} className="cal-line cal-line-half" style={{ top: (h-firstHour) * HOUR_H + HOUR_H / 2 }} />
            ))}

            {today && nowMin !== null && nowMin>=firstHour*60 && nowMin<lastHour*60 && (
              <span className="cal-now" style={{ top: (nowMin-firstHour*60) * HOUR_H / 60 }} />
            )}

            {laid.filter(ev=>ev._end>firstHour*60 && ev._start<lastHour*60).map((ev, i) => {
              const totalCols = Math.max(ev._totalCols, 1);
              const pct = 98 / totalCols;
              return (
                <TaskCard
                  key={ev._occurrenceKey || ev.id || i}
                  task={ev}
                  view="day"
                  onDelete={onDelete}
                  onEdit={onEdit}
                  style={{
                    position: 'absolute',
                    ...calendarEventBox(ev,firstHour,lastHour,HOUR_H),
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
