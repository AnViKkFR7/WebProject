import React, { useState } from 'react';

// Aclara un color hex mezclándolo con blanco
function lighten(hex, amount = 0.82) {
  try {
    const h = (hex || '#8e8e93').replace('#', '').padStart(6, '0');
    const r = parseInt(h.slice(0, 2), 16);
    const g = parseInt(h.slice(2, 4), 16);
    const b = parseInt(h.slice(4, 6), 16);
    return `rgb(${Math.round(r + (255 - r) * amount)},${Math.round(g + (255 - g) * amount)},${Math.round(b + (255 - b) * amount)})`;
  } catch { return '#f5f5f7'; }
}

const TYPE_LABELS = {
  recibir_pago: '💰 Recibir pago',
  realizar_pago: '💸 Realizar pago',
  todo: '✅ ToDo',
  entregable: '📦 Entregable',
  reunion: '🤝 Reunión',
};

function fmt(dt) {
  if (!dt) return '';
  return dt.replace('T', ' ').slice(0, 16);
}

// ── Modal de detalle completo ──────────────────────────────────────
function DetailModal({ task, color, onClose }) {
  return (
    <div
      onClick={onClose}
      style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.45)', zIndex: 2000, display: 'flex', alignItems: 'center', justifyContent: 'center' }}
    >
      <div
        onClick={e => e.stopPropagation()}
        style={{ background: '#fff', borderRadius: 16, padding: 28, minWidth: 320, maxWidth: 460, width: '90%', boxShadow: '0 8px 40px rgba(0,0,0,0.2)', display: 'flex', flexDirection: 'column', gap: 10, maxHeight: '88vh', overflowY: 'auto', borderTop: `4px solid ${color}` }}
      >
        {/* Cabecera */}
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12 }}>
          <div>
            <div style={{ fontSize: 18, fontWeight: 700, color: '#1c1c1e', lineHeight: 1.3 }}>{task.title}</div>
            <div style={{ fontSize: 13, fontWeight: 600, color, marginTop: 2 }}>{task.company?.name || ''}</div>
          </div>
          <button onClick={onClose} style={{ all: 'unset', cursor: 'pointer', fontSize: 22, color: '#8e8e93', lineHeight: 1, flexShrink: 0 }}>×</button>
        </div>

        <hr style={{ border: 'none', borderTop: '1px solid #f2f2f7', margin: '2px 0' }} />

        <Row label="Tipo">{TYPE_LABELS[task.type] || task.type}</Row>
        <Row label="Inicio">{fmt(task.start_datetime)}</Row>
        {task.end_datetime && <Row label="Fin">{fmt(task.end_datetime)}</Row>}
        <Row label="Todo el día">{task.is_all_day ? 'Sí' : 'No'}</Row>
        {task.recurrence_type && task.recurrence_type !== 'none' && (
          <Row label="Repetición">{task.recurrence_type}{task.recurrence_value ? ` · cada ${task.recurrence_value}` : ''}</Row>
        )}
        {task.description && (
          <div style={{ marginTop: 4 }}>
            <div style={{ fontSize: 11, fontWeight: 600, color: '#8e8e93', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 4 }}>Descripción</div>
            <div style={{ fontSize: 14, color: '#3a3a3c', lineHeight: 1.6 }}>{task.description}</div>
          </div>
        )}
        {task.attachments && task.attachments.length > 0 && (
          <div style={{ marginTop: 4 }}>
            <div style={{ fontSize: 11, fontWeight: 600, color: '#8e8e93', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 6 }}>Adjuntos</div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
              {task.attachments.map((f, i) => (
                <a key={i} href={f.url || '#'} target="_blank" rel="noreferrer"
                  style={{ display: 'inline-flex', alignItems: 'center', gap: 5, padding: '4px 10px', borderRadius: 8, background: '#f2f2f7', fontSize: 12, color: '#007AFF', textDecoration: 'none' }}>
                  📎 {f.name || `Archivo ${i + 1}`}
                </a>
              ))}
            </div>
          </div>
        )}

        <button onClick={onClose} style={{ marginTop: 10, padding: '9px 0', borderRadius: 10, border: 'none', background: '#007AFF', color: '#fff', fontWeight: 600, fontSize: 14, cursor: 'pointer' }}>
          Cerrar
        </button>
      </div>
    </div>
  );
}

function Row({ label, children }) {
  return (
    <div style={{ display: 'flex', gap: 10, fontSize: 14, padding: '3px 0', borderBottom: '1px solid #f2f2f7' }}>
      <span style={{ minWidth: 90, fontSize: 11, fontWeight: 600, color: '#8e8e93', textTransform: 'uppercase', letterSpacing: 0.4, paddingTop: 1 }}>{label}</span>
      <span style={{ color: '#1c1c1e', flex: 1 }}>{children}</span>
    </div>
  );
}

// ── TaskCard principal ─────────────────────────────────────────────
// view: 'day' | 'week' | 'month'
// style prop: estilos de posicionamiento desde el padre (top/left/width/height etc.)
export default function TaskCard({ task, view, style = {} }) {
  const [open, setOpen] = useState(false);
  const color = task._color || task.company?.color || '#8e8e93';
  const bg = lighten(color, 0.82);

  const base = {
    borderLeft: `3px solid ${color}`,
    background: bg,
    borderRadius: view === 'month' ? 5 : 8,
    cursor: 'pointer',
    overflow: 'hidden',
    boxSizing: 'border-box',
    ...style,
  };

  return (
    <>
      {view === 'day' && (
        <div onClick={() => setOpen(true)} style={{ ...base, padding: '6px 8px', display: 'flex', flexDirection: 'column', gap: 2 }}>
          <div style={{ fontSize: 13, fontWeight: 700, color: '#1c1c1e', lineHeight: 1.3, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {task.title}
          </div>
          <div style={{ fontSize: 11, fontWeight: 600, color, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {task.company?.name || ''}
          </div>
          <div style={{ fontSize: 11, color: '#636366' }}>
            {TYPE_LABELS[task.type] || task.type}
          </div>
        </div>
      )}

      {view === 'week' && (
        <div onClick={() => setOpen(true)} style={{ ...base, padding: '3px 5px', display: 'flex', flexDirection: 'column', gap: 1 }}>
          <div style={{ fontSize: 11, fontWeight: 700, color: '#1c1c1e', lineHeight: 1.3, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {task.title}
          </div>
          <div style={{ fontSize: 10, color: '#636366', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {TYPE_LABELS[task.type] || task.type}
          </div>
        </div>
      )}

      {view === 'month' && (
        <div onClick={() => setOpen(true)} style={{ ...base, padding: '2px 5px', display: 'flex', alignItems: 'center', gap: 4, minHeight: 20 }}>
          <span style={{ fontSize: 10, color: '#636366', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', flex: 1 }}>
            {TYPE_LABELS[task.type] || task.type}
          </span>
        </div>
      )}

      {open && <DetailModal task={task} color={color} onClose={() => setOpen(false)} />}
    </>
  );
}
