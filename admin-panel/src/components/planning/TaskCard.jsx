import { useState } from 'react';
import { supabase } from '../../lib/supabaseClient';
import { useLanguage } from '../../contexts/LanguageContext';
import { useFeedback } from '../../contexts/FeedbackContext';
import { plannerAttachmentPath } from '../../lib/attachments';
import { formatRecurrence } from '../../lib/recurrence';
import { formatTime, formatDateTime } from '../../lib/dates';
import Modal from '../ui/Modal';
import Icon from '../ui/Icon';

// ── Modal de detalle completo ──────────────────────────────────────
function DetailModal({ task, color, onClose, onEdit, onDelete }) {
  const { t } = useLanguage();
  const { confirm } = useFeedback();
  const typeLabels = t('planning.taskTypeLabels');
  const isRecurring = task.recurrence_type && task.recurrence_type !== 'none';

  const handleDelete = async () => {
    // Las ocurrencias de una recurrencia comparten la fila real: borrar una
    // borra la serie entera. Antes ocurría sin avisar.
    const ok = await confirm({
      title: t('planning.deleteTaskTitle').replace('{name}', task.title),
      message: isRecurring ? t('planning.deleteSeriesWarning') : t('planning.deleteTaskMessage'),
      confirmLabel: t('common.delete'),
      danger: true,
    });
    if (!ok) return;
    onDelete(task.id);
    onClose();
  };

  return (
    <Modal
      open
      onClose={onClose}
      size="sm"
      title={task.title}
      description={task.company?.name || t('planning.noCompanyLabel')}
      footer={(
        <>
          {onEdit && (
            <button type="button" className="ghost-button" onClick={() => { onEdit(task); onClose(); }}>
              <Icon name="edit" size={16} />{t('common.edit')}
            </button>
          )}
          {onDelete && (
            <button type="button" className="button button-danger button-medium" onClick={handleDelete}>
              <Icon name="trash" size={16} />{t('common.delete')}
            </button>
          )}
          <button type="button" className="primary-button" onClick={onClose}>{t('common.close')}</button>
        </>
      )}
    >
      <div className="detail-accent" style={{ '--accent-color': color }} />
      <dl className="planning-form">
        <Row label={t('planning.typeLabel')}>{typeLabels[task.type] || task.type}</Row>
        <Row label={t('planning.startLabel')}>{formatDateTime(task.start_datetime)}</Row>
        {task.end_datetime && <Row label={t('planning.endLabel')}>{formatDateTime(task.end_datetime)}</Row>}
        <Row label={t('planning.allDayLabel')}>{task.is_all_day ? t('common.yes') : t('common.no')}</Row>
        {isRecurring && (
          <Row label={t('planning.recurrenceLabel')}>
            {formatRecurrence(task.recurrence_type, task.recurrence_value, t)}
          </Row>
        )}
        {task.description && <Row label={t('planning.descriptionLabel')}>{task.description}</Row>}
        {task.attachments?.length > 0 && (
          <Row label={t('planning.attachmentsLabel')}>
            <span style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem' }}>
              {task.attachments.map((file, i) => <AttachmentLink key={i} file={file} index={i} />)}
            </span>
          </Row>
        )}
      </dl>
    </Modal>
  );
}

export function AttachmentLink({ file, index }) {
  const { t } = useLanguage();
  const { toast } = useFeedback();

  const handleClick = async (e) => {
    e.preventDefault();
    try {
      // El bucket es privado: se pide una URL firmada al abrirlo
      const path = plannerAttachmentPath(file, import.meta.env.VITE_SUPABASE_URL);
      if (path) {
        const { data, error } = await supabase.storage
          .from('media-planner')
          .createSignedUrl(path, 300);
        if (error) throw error;
        window.open(data.signedUrl, '_blank', 'noopener');
      } else {
        throw new Error('Invalid attachment URL');
      }
    } catch {
      toast.error(t('planning.fileOpenError'));
    }
  };

  return (
    <a href="#" onClick={handleClick} className="attachment-link">
      <Icon name="paperclip" size={14} />
      {file.name || `${index + 1}`}
    </a>
  );
}

function Row({ label, children }) {
  return (
    <div className="detail-row">
      <dt>{label}</dt>
      <dd>{children}</dd>
    </div>
  );
}

// ── TaskCard principal ─────────────────────────────────────────────
// view: 'day' | 'week' | 'month'
// style: posicionamiento calculado por la vista (top/left/width/height)
export default function TaskCard({ task, view, style = {}, onDelete, onEdit }) {
  const { t } = useLanguage();
  const [open, setOpen] = useState(false);
  const color = task._color || task.company?.color || 'var(--text-tertiary)';
  const typeLabels = t('planning.taskTypeLabels');
  const typeLabel = typeLabels[task.type] || task.type;
  const companyName = task.company?.name || t('planning.noCompanyLabel');

  // Evita que el clic en la tarjeta dispare también el "crear tarea" del hueco
  const handleOpen = (e) => {
    e.stopPropagation();
    setOpen(true);
  };

  const cardProps = {
    type: 'button',
    onClick: handleOpen,
    'aria-haspopup': 'dialog',
    title: companyName,
    style: { ...style, '--task-color': color },
  };

  return (
    <>
      {view === 'day' && (
        <button {...cardProps} className="task-card task-card-button task-card-day">
          <span className="task-card-time">
            {formatTime(task.start_datetime)}
            {task.end_datetime ? ` – ${formatTime(task.end_datetime)}` : ''}
          </span>
          <span className="task-card-title">{task.title}</span>
          <span className="task-card-meta">
            <span className="task-card-ellipsis">{companyName}</span>
            <span>{typeLabel}</span>
          </span>
        </button>
      )}

      {view === 'week' && (
        <button {...cardProps} className="task-card task-card-button task-card-week">
          <span className="task-card-time">{formatTime(task.start_datetime)}</span>
          <span className="task-card-title">{task.title}</span>
          <span className="task-card-meta">{typeLabel}</span>
        </button>
      )}

      {view === 'month' && (
        <button
          {...cardProps}
          className="task-card task-card-button task-card-month"
          aria-label={`${task.title} · ${typeLabel}`}
        >
          <span className="company-dot" style={{ '--company-color': color }} />
          <span className="task-card-meta">{task.title}</span>
        </button>
      )}

      {open && (
        <DetailModal
          task={task}
          color={color}
          onClose={() => setOpen(false)}
          onEdit={onEdit}
          onDelete={onDelete}
        />
      )}
    </>
  );
}
