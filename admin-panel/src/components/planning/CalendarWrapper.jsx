import { useEffect, useState } from 'react';
import { addDays, addWeeks, addMonths, subDays, subWeeks, subMonths } from 'date-fns';
import DayView from './DayView';
import WeekView from './WeekView';
import MonthView from './MonthView';
import { visibleRange } from '../../lib/planningRange';
import { useLanguage } from '../../contexts/LanguageContext';
import Icon from '../ui/Icon';

const VIEWS = ['day', 'week', 'month'];

export default function CalendarWrapper({ tasks, defaultView = 'week', onDeleteTask, onEditTask, onMoveTask, onResizeTask, onSelectSlot, onRangeChange }) {
  const { t } = useLanguage();
  const [fullDay,setFullDay]=useState(false);
  const [view, setView] = useState(defaultView);
  const [current, setCurrent] = useState(new Date());

  const months = t('planning.months');
  const weekdaysLong = t('planning.weekdaysLong');

  // El padre pide a la base de datos solo el tramo que se está viendo
  const { from, to } = visibleRange(view, current);
  useEffect(() => { onRangeChange?.({ from, to }); }, [from, to, onRangeChange]);

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
    if (view === 'month') return `${months[current.getMonth()]} ${current.getFullYear()}`;
    if (view === 'week') {
      const ws = new Date(current);
      ws.setDate(ws.getDate() - ((ws.getDay() + 6) % 7));
      const we = new Date(ws);
      we.setDate(we.getDate() + 6);
      if (ws.getMonth() === we.getMonth()) return `${months[ws.getMonth()]} ${ws.getFullYear()}`;
      return `${months[ws.getMonth()]} – ${months[we.getMonth()]} ${we.getFullYear()}`;
    }
    return `${weekdaysLong[current.getDay()]}, ${current.getDate()} ${months[current.getMonth()]} ${current.getFullYear()}`;
  })();

  const viewProps = { date: current, tasks, onDelete: onDeleteTask, onEdit: onEditTask,onMoveTask,onResizeTask,onSelectSlot,fullDay };

  return (
    <div className="calendar-shell">
      <div className="calendar-toolbar">
        <div className="calendar-nav">
          <button type="button" className="icon-button" onClick={goBack} aria-label={t('planning.previous')}>
            <Icon name="chevronLeft" size={18} />
          </button>
          <button type="button" className="ghost-button small" onClick={() => setCurrent(new Date())}>
            {t('planning.today')}
          </button>
          <button type="button" className="icon-button" onClick={goFwd} aria-label={t('planning.next')}>
            <Icon name="chevronRight" size={18} />
          </button>
        </div>

        {view!=='month' && <button type="button" className="ghost-button small calendar-hours-toggle" aria-pressed={fullDay} onClick={()=>setFullDay(value=>!value)}>{t(fullDay ? 'planning.businessHours' : 'planning.fullSchedule')}</button>}
        <span className="calendar-title">{title}</span>

        <div className="segmented" role="group" aria-label={t('planning.viewMode')}>
          {VIEWS.map(key => (
            <button
              key={key}
              type="button"
              onClick={() => setView(key)}
              aria-pressed={view === key}
              style={{ width: 'auto', padding: '0 0.75rem', fontSize: '0.75rem' }}
            >
              {t(`planning.view${key[0].toUpperCase()}${key.slice(1)}`)}
            </button>
          ))}
        </div>
      </div>

      {view!=='month' && !fullDay && tasks.some(task=>!task.is_all_day && task.start_datetime && (new Date(task.start_datetime).getHours()<8 || new Date(task.start_datetime).getHours()>=20 || (task.end_datetime && new Date(task.end_datetime).getHours()>19))) && <button type="button" className="calendar-outside-hours" onClick={()=>setFullDay(true)}>{t('planning.outsideHours')}</button>}
      <div className="calendar-body">
        {view === 'day' && <DayView {...viewProps} />}
        {view === 'week' && <WeekView {...viewProps} />}
        {view === 'month' && <MonthView {...viewProps} />}
      </div>
    </div>
  );
}
