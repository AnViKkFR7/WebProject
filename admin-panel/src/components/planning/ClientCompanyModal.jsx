import { useLanguage } from '../../contexts/LanguageContext';
import Modal from '../ui/Modal';
import Icon from '../ui/Icon';
import ColorSelector from '../ui/ColorSelector';

/** Alta de una empresa cliente (las que se planifican y facturan). */
export default function ClientCompanyModal({ open, editing, form, setForm, error, saving, onSubmit, onClose }) {
  const { t } = useLanguage();
  const formId = 'client-company-form';
  const update = (patch) => setForm(f => ({ ...f, ...patch }));

  const FIELDS = [
    ['name', 'planning.namePlaceholder', 'text', true],
    ['tax_id','invoicing.taxId','text',false],
    ['billing_address','invoicing.address','text',false],
    ['phone', 'planning.phonePlaceholder', 'tel', false],
    ['email', 'planning.emailPlaceholder', 'email', false],
    ['responsible', 'planning.responsiblePlaceholder', 'text', false],
  ];

  return (
    <Modal
      open={open}
      onClose={onClose}
      size="md"
      icon="companies"
      description={t('formDesign.clientHelp')}
      title={editing ? t('companies.editClientTitle') : t('planning.newCompanyTitle')}
      footer={(
        <>
          <button type="button" className="ghost-button" onClick={onClose} disabled={saving}>{t('common.cancel')}</button>
          <button type="submit" form={formId} className="primary-button" disabled={saving}>
            {!saving && <Icon name="save" size={16} />}
            {saving ? t('common.savingChanges') : t('common.save')}
          </button>
        </>
      )}
    >
      <form id={formId} onSubmit={onSubmit} className="planning-form client-company-form">
        {FIELDS.map(([key, labelKey, type, required]) => (
          <div className="field" key={key}>
            <label htmlFor={`client-${key}`} className="field-label">
              {t(labelKey)}
              {required && <span className="required-mark" aria-hidden="true">*</span>}
            </label>
            <input
              id={`client-${key}`}
              type={type}
              className="input"
              required={required}
              value={form[key]}
              onChange={e => update({ [key]: e.target.value })}
            />
          </div>
        ))}

        <ColorSelector label={t('planning.colorLabel')} value={form.color} onChange={color => update({ color })}/>

        {error && <p className="field-error" role="alert">{error}</p>}
      </form>
    </Modal>
  );
}
