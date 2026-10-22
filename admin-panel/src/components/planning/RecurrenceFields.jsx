import { useLanguage } from '../../contexts/LanguageContext';
import { RECURRENCE_UNIT_KEYS } from '../../lib/recurrence';
import Toggle from '../ui/Toggle';

/**
 * Checkbox "Repetir tarea" + "cada N [unidad]" — reemplaza al select
 * (Semanal/Diaria/...) + input numérico sin contexto de antes, que no
 * dejaba claro qué significaba ese número.
 *
 * type: 'none' | 'hourly' | 'daily' | 'weekly' | 'yearly'
 * value: número >= 1 (o null/vacío, tratado como 1)
 * onChange({ recurrence_type, recurrence_value })
 */
export default function RecurrenceFields({ type, value, onChange }) {
  const { t } = useLanguage();
  const enabled = type !== 'none';
  const currentValue = value || 1;

  const handleToggle = (checked) => {
    if (checked) {
      onChange({ recurrence_type: type !== 'none' ? type : 'weekly', recurrence_value: currentValue });
    } else {
      onChange({ recurrence_type: 'none', recurrence_value: null });
    }
  };

  const unitOption = (recurrenceType) => {
    const [singular, plural] = RECURRENCE_UNIT_KEYS[recurrenceType];
    return t(`planning.${currentValue === 1 ? singular : plural}`);
  };

  return (
    <div>
      <Toggle checked={enabled} onChange={handleToggle} label={t('planning.repeatTask')} />

      {enabled && (
        <div className="datetime-fields" style={{ alignItems: 'center', marginTop: '0.5rem' }}>
          <span style={{ flexShrink: 0, fontSize: '0.875rem', color: 'var(--text-secondary)' }}>{t('planning.repeatEvery')}</span>
          <input
            type="number"
            min="1"
            className="input"
            aria-label={t('planning.repeatEvery')}
            value={currentValue}
            onChange={(e) => onChange({ recurrence_type: type, recurrence_value: Math.max(1, Number(e.target.value) || 1) })}
            style={{ width: 70, flex: '0 0 auto', minWidth: 0 }}
          />
          <select
            className="select"
            aria-label={t('planning.repeatTask')}
            value={type}
            onChange={(e) => onChange({ recurrence_type: e.target.value, recurrence_value: currentValue })}
            style={{ flex: 1 }}
          >
            <option value="hourly">{unitOption('hourly')}</option>
            <option value="daily">{unitOption('daily')}</option>
            <option value="weekly">{unitOption('weekly')}</option>
            <option value="yearly">{unitOption('yearly')}</option>
          </select>
        </div>
      )}
    </div>
  );
}
