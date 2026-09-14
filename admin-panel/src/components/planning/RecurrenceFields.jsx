import { useLanguage } from '../../contexts/LanguageContext';
import { RECURRENCE_UNIT_KEYS } from '../../lib/recurrence';

const inputStyle = { padding: '9px 12px', borderRadius: 9, border: '1px solid #d1d1d6', fontSize: 14, outline: 'none', boxSizing: 'border-box', fontFamily: 'inherit' };

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
      <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 14, padding: '2px 0' }}>
        <input type="checkbox" checked={enabled} onChange={(e) => handleToggle(e.target.checked)} />
        <span style={{ fontWeight: 500 }}>{t('planning.repeatTask')}</span>
      </label>

      {enabled && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 6 }}>
          <span style={{ fontSize: 14, color: '#3a3a3c', flexShrink: 0 }}>{t('planning.repeatEvery')}</span>
          <input
            type="number"
            min="1"
            value={currentValue}
            onChange={(e) => onChange({ recurrence_type: type, recurrence_value: Math.max(1, Number(e.target.value) || 1) })}
            style={{ ...inputStyle, width: 64, flexShrink: 0 }}
          />
          <select
            value={type}
            onChange={(e) => onChange({ recurrence_type: e.target.value, recurrence_value: currentValue })}
            style={{ ...inputStyle, flex: 1 }}
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
