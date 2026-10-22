import { useLanguage } from '../../contexts/LanguageContext';
import { changeTaskStart, taskHourLater } from '../../lib/dateInput';
import DatePicker from '../DatePicker';
import { REMINDER_OPTIONS, toggleReminder } from '../../lib/reminders';
import FormSection from '../ui/FormSection';
import Modal from '../ui/Modal';
import Toggle from '../ui/Toggle';
import Icon from '../ui/Icon';
import DateTimeFields from './DateTimeFields';
import RecurrenceFields from './RecurrenceFields';
import AttachmentsField from './AttachmentsField';

const TASK_TYPES = [
  ['todo', 'planning.typeTodo'],
  ['reunion', 'planning.typeMeeting'],
  ['entregable', 'planning.typeDeliverable'],
  ['recibir_pago', 'planning.typeReceivePayment'],
  ['realizar_pago', 'planning.typeMakePayment'],
];

export default function TaskFormModal({
  open, editing, form, setForm, clientCompanies,
  existingAttachments, files, onRemoveExisting, onFilesChange,
  error, saving, onSubmit, onClose,
}) {
  const { t } = useLanguage();
  const formId = 'planning-task-form';
  const minutes=Math.round((new Date(form.end_datetime)-new Date(form.start_datetime))/60000);
  const validDuration=Number.isFinite(minutes) && minutes>0;
  const duration=validDuration ? [minutes>=60 ? `${Math.floor(minutes/60)} h` : '',minutes%60 ? `${minutes%60} min` : ''].filter(Boolean).join(' ') : '';
  const update = (patch) => setForm(f => ({ ...f, ...patch }));

  return (
    <Modal
      open={open}
      size="lg"
      className="task-form-modal"
      icon="planning"
      eyebrow={t('nav.planning')}
      description={t('formDesign.taskHelp')}
      onClose={onClose}
      title={editing ? t('planning.editTaskTitle') : t('planning.newTaskTitle')}
      footer={(
        <>
          <button type="button" className="ghost-button" onClick={onClose}>{t('common.cancel')}</button>
          <button type="submit" form={formId} className="primary-button" disabled={saving}>
            {!saving && <Icon name="save" size={16} />}
            {saving ? t('common.savingChanges') : t('common.save')}
          </button>
        </>
      )}
    >
      <form id={formId} onSubmit={onSubmit} className="planning-form task-form-grid">
        <div className="form-column">
          <FormSection icon="edit" title={t('formDesign.taskDetails')} step="01">
        <div className="field">
          <label htmlFor="task-title" className="field-label">
            {t('planning.titlePlaceholder')}<span className="required-mark" aria-hidden="true">*</span>
          </label>
          <input
            id="task-title"
            className="input"
            required
            value={form.title}
            onChange={e => update({ title: e.target.value })}
          />
        </div>

        <div className="field">
          <label htmlFor="task-description" className="field-label">{t('planning.descriptionLabel')}</label>
          <textarea
            id="task-description"
            className="input"
            rows={3}
            value={form.description}
            onChange={e => update({ description: e.target.value })}
          />
        </div>

            <div className="form-field-row">
        <div className="field">
          <label htmlFor="task-company" className="field-label">{t('planning.companyLabel')}</label>
          <select
            id="task-company"
            className="select"
            value={form.client_company_id}
            onChange={e => update({ client_company_id: e.target.value })}
          >
            <option value="">{t('planning.noCompanyOption')}</option>
            {clientCompanies.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
        </div>

        <div className="field">
          <label htmlFor="task-type" className="field-label">{t('planning.typeLabel')}</label>
          <select
            id="task-type"
            className="select"
            value={form.type}
            onChange={e => update({ type: e.target.value })}
          >
            {TASK_TYPES.map(([value, key]) => <option key={value} value={value}>{t(key)}</option>)}
          </select>
        </div>

            </div>
          </FormSection>
          <FormSection icon="paperclip" title={t('planning.attachFiles')} tone="amber">
        <AttachmentsField
          existing={existingAttachments}
          files={files}
          onRemoveExisting={onRemoveExisting}
          onFilesChange={onFilesChange}
        />
          </FormSection>
        </div>
        <div className="form-column">
          <FormSection icon="clock" title={t('formDesign.schedule')} tone="teal" step="02">
            <div className="task-form-schedule">

        <Toggle
          checked={form.is_all_day}
          onChange={checked => setForm(current => {
            const date=current.start_datetime?.slice(0,10)
            const start=checked && date ? `${date}T08:00` : current.start_datetime
            return { ...current,is_all_day:checked,start_datetime:start,end_datetime:date ? (checked ? `${date}T08:30` : taskHourLater(start)) : '' }
          })}
          label={t('planning.allDayLabel')}
          description={t('planning.allDayHint')}
        />

        {form.is_all_day ? (
          <div className="field">
            <label htmlFor="task-date" className="field-label">{t('planning.dateLabel')}</label>
            <DatePicker id="task-date" required label={t('planning.dateLabel')} value={form.start_datetime?.slice(0,10) || ''}
              onChange={date => update({ start_datetime:date ? `${date}T08:00` : '',end_datetime:date ? `${date}T08:30` : '' })}/>

          </div>
        ) : (
          <>
            <div className="field">
              <span className="field-label">{t('planning.startDateLabel')}</span>
              <DateTimeFields
                required
                label={t('planning.startDateLabel')}
                value={form.start_datetime}
                onChange={value => setForm(current => changeTaskStart(current,value))}
              />
            </div>
            <div className="field">
              <div className="task-end-heading"><span className="field-label">{t('planning.endDateLabel')}</span>
                <button type="button" className="task-hour-shortcut" disabled={!form.start_datetime} onClick={()=>update({end_datetime:taskHourLater(form.start_datetime)})}>+1 h</button></div>
              <DateTimeFields
                label={t('planning.endDateLabel')}
                min={form.start_datetime}
                defaultValue={taskHourLater(form.start_datetime)}
                value={form.end_datetime}
                onChange={v => update({ end_datetime: v })}
              />
              {form.end_datetime && form.start_datetime && <p className={validDuration ? "task-duration" : "field-error"} role={validDuration ? "status" : "alert"}>{validDuration ? `${t('dateInput.duration')}: ${duration}` : t('dateInput.endAfterStart')}</p>}
            </div>
          </>
        )}

        <RecurrenceFields
          type={form.recurrence_type}
          value={form.recurrence_value}
          onChange={({ recurrence_type, recurrence_value }) => update({ recurrence_type, recurrence_value })}
        />
            </div>
          </FormSection>
          <FormSection icon="mail" title={t('planning.remindersLabel')} step="03">
        <fieldset className="field">
          <legend className="field-label">{t('planning.remindersLabel')}</legend>
          <div className="reminder-options">
            {REMINDER_OPTIONS.map(option => (
              <label key={option.minutes} className="reminder-option">
                <input
                  type="checkbox"
                  checked={(form.reminders || []).includes(option.minutes)}
                  onChange={() => update({ reminders: toggleReminder(form.reminders, option.minutes) })}
                />
                {t(option.labelKey)}
              </label>
            ))}
          </div>
          <p className="field-help">{t('planning.remindersHelp')}</p>
        </fieldset>
          </FormSection>
        </div>
        {error && <p className="field-error" role="alert">{error}</p>}
      </form>
    </Modal>
  );
}
