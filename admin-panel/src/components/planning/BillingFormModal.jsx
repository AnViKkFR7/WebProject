import { useLanguage } from '../../contexts/LanguageContext';
import DatePicker from '../DatePicker';
import FormSection from '../ui/FormSection';
import Modal from '../ui/Modal';
import Icon from '../ui/Icon';
import RecurrenceFields from './RecurrenceFields';
import AttachmentsField from './AttachmentsField';

export default function BillingFormModal({
  open, editing, form, setForm, clientCompanies,
  existingAttachments, files, onRemoveExisting, onFilesChange,
  error, saving, onSubmit, onClose,
}) {
  const { t } = useLanguage();
  const formId = 'planning-bill-form';
  const update = (patch) => setForm(f => ({ ...f, ...patch }));

  return (
    <Modal
      open={open}
      size="lg"
      icon="file"
      description={t('formDesign.planningBillHelp')}
      onClose={onClose}
      title={editing ? t('planning.editBillingTitle') : t('planning.newBillingTitle')}
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
      <form id={formId} onSubmit={onSubmit} className="planning-form form-columns">
        <FormSection icon="file" title={t('formDesign.movement')} step="01">
        <div className="field">
          <label htmlFor="bill-title" className="field-label">
            {t('planning.titlePlaceholder')}<span className="required-mark" aria-hidden="true">*</span>
          </label>
          <input id="bill-title" className="input" required value={form.title} onChange={e => update({ title: e.target.value })} />
        </div>

        <div className="field">
          <label htmlFor="bill-description" className="field-label">{t('planning.descriptionLabel')}</label>
          <textarea id="bill-description" className="input" rows={3} value={form.description} onChange={e => update({ description: e.target.value })} />
        </div>

        <div className="field">
          <label htmlFor="bill-company" className="field-label">
            {t('planning.companyLabel')}<span className="required-mark" aria-hidden="true">*</span>
          </label>
          <select id="bill-company" className="select" required value={form.client_company_id} onChange={e => update({ client_company_id: e.target.value })}>
            <option value="">{t('planning.selectCompanyOption')}</option>
            {clientCompanies.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
        </div>

        <div className="field">
          <label htmlFor="bill-date" className="field-label">
            {t('planning.billingDateLabel')}<span className="required-mark" aria-hidden="true">*</span>
          </label>
          <DatePicker id="bill-date" label={t('planning.billingDateLabel')} required value={form.billing_date} onChange={billing_date => update({ billing_date })} />
        </div>

        <div className="field">
          <label htmlFor="bill-amount" className="field-label">
            {t('planning.amountLabel')}<span className="required-mark" aria-hidden="true">*</span>
          </label>
          <input id="bill-amount" type="number" step="0.01" className="input" required value={form.amount} onChange={e => update({ amount: e.target.value })} />
        </div>

        <div className="field">
          <label htmlFor="bill-direction" className="field-label">{t('planning.typeLabel')}</label>
          <select id="bill-direction" className="select" value={form.direction} onChange={e => update({ direction: e.target.value })}>
            <option value="cobrar">{t('planning.directionReceive')}</option>
            <option value="pagar">{t('planning.directionPay')}</option>
          </select>
        </div>

        </FormSection>
        <FormSection icon="repeat" title={t('formDesign.additional')} tone="teal" step="02">
        <RecurrenceFields
          type={form.recurrence_type}
          value={form.recurrence_value}
          onChange={({ recurrence_type, recurrence_value }) => update({ recurrence_type, recurrence_value })}
        />

        <AttachmentsField
          existing={existingAttachments}
          files={files}
          onRemoveExisting={onRemoveExisting}
          onFilesChange={onFilesChange}
        />

        </FormSection>
        {error && <p className="field-error" role="alert">{error}</p>}
      </form>
    </Modal>
  );
}
