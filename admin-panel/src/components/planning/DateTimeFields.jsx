// Sustituye al <input type="datetime-local"> nativo: su selector de hora
// varía muchísimo entre navegadores/SO y es incómodo de usar. Aquí se
// separa en un <input type="date"> normal + dos <select> (hora y minuto),
// consistentes en cualquier navegador y fáciles de estilar.
const HOURS = Array.from({ length: 24 }, (_, h) => String(h).padStart(2, '0'));
const MINUTES = ['00', '05', '10', '15', '20', '25', '30', '35', '40', '45', '50', '55'];

const selectStyle = {
  padding: '9px 8px',
  borderRadius: 9,
  border: '1px solid #d1d1d6',
  fontSize: 14,
  outline: 'none',
  fontFamily: 'inherit',
  background: '#fff',
  color: '#1c1c1e',
};

const dateInputStyle = {
  padding: '9px 12px',
  borderRadius: 9,
  border: '1px solid #d1d1d6',
  fontSize: 14,
  outline: 'none',
  boxSizing: 'border-box',
  fontFamily: 'inherit',
  flex: 1,
  minWidth: 140,
};

// value: string 'yyyy-MM-ddTHH:mm' o '' — mismo formato que ya usaba el
// <input type="datetime-local">, así que no cambia nada fuera de este
// componente (taskForm.start_datetime/end_datetime siguen igual).
export default function DateTimeFields({ value, onChange, required = false }) {
  const datePart = value ? value.slice(0, 10) : '';
  const hourPart = value ? value.slice(11, 13) : '09';
  const minutePart = value ? value.slice(14, 16) : '00';

  const emit = (date, hour, minute) => {
    if (!date) { onChange(''); return; }
    onChange(`${date}T${hour}:${minute}`);
  };

  return (
    <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
      <input
        type="date"
        required={required}
        value={datePart}
        onChange={(e) => emit(e.target.value, hourPart, minutePart)}
        style={dateInputStyle}
      />
      <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
        <select
          value={hourPart}
          onChange={(e) => emit(datePart, e.target.value, minutePart)}
          style={selectStyle}
          disabled={!datePart}
        >
          {HOURS.map((h) => <option key={h} value={h}>{h}</option>)}
        </select>
        <span style={{ color: '#8e8e93' }}>:</span>
        <select
          value={minutePart}
          onChange={(e) => emit(datePart, hourPart, e.target.value)}
          style={selectStyle}
          disabled={!datePart}
        >
          {MINUTES.map((m) => <option key={m} value={m}>{m}</option>)}
        </select>
      </div>
    </div>
  );
}
