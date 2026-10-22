import { format, startOfMonth, endOfMonth, startOfWeek, endOfWeek, addDays, isSameMonth, isToday } from 'date-fns';
import TaskCard from './TaskCard';
import { useLanguage } from '../../contexts/LanguageContext';

const MAX_PER_DAY = 3;

export default function MonthView({ date, tasks, onDelete, onEdit, onSelectSlot }) {
  const { t } = useLanguage();
  const dayShort = t('planning.weekdaysShort');

  const gridStart = startOfWeek(startOfMonth(date), { weekStartsOn: 1 });
  const gridEnd = endOfWeek(endOfMonth(date), { weekStartsOn: 1 });

  const days = [];
  for (let d = gridStart; d <= gridEnd; d = addDays(d, 1)) days.push(new Date(d));

  const byDay = {};
  tasks.forEach(task => {
    if (!task.start_datetime) return;
    const key = format(new Date(task.start_datetime), 'yyyy-MM-dd');
    (byDay[key] = byDay[key] || []).push(task);
  });

  return (
    <div className="cal-month-grid">
      {dayShort.map(name => (
        <div key={name} className="cal-month-weekday">{name}</div>
      ))}

      {days.map(day => {
        const key = format(day, 'yyyy-MM-dd');
        const dayTasks = byDay[key] || [];
        const outside = !isSameMonth(day, date);

        return (
          <div key={key} className={`cal-month-cell${outside ? ' is-outside' : ''}`}>
            {onSelectSlot && (
              <button
                type="button"
                className="cal-slot-layer"
                tabIndex={-1}
                aria-hidden="true"
                onClick={() => onSelectSlot(day)}
              />
            )}

            <span className={`cal-month-daynum${isToday(day) ? ' is-today' : ''}`}>{format(day, 'd')}</span>

            {dayTasks.slice(0, MAX_PER_DAY).map((task, i) => (
              <TaskCard
                key={task._occurrenceKey || task.id || i}
                task={task}
                view="month"
                onDelete={onDelete}
                onEdit={onEdit}
                style={{ flexShrink: 0 }}
              />
            ))}
            {dayTasks.length > MAX_PER_DAY && (
              <span className="cal-month-more">+{dayTasks.length - MAX_PER_DAY} {t('planning.more')}</span>
            )}
          </div>
        );
      })}
    </div>
  );
}
