import { useLanguage } from '../../contexts/LanguageContext';
import Modal from '../ui/Modal';
import Icon from '../ui/Icon';
import ColorSelector from '../ui/ColorSelector';
import SlidingIndicator from '../ui/SlidingIndicator';
import styles from './ClientCompanyModal.module.css';
import { emptyPartyForm } from '../../lib/directory';


/**
 * Alta y edición de una ficha del directorio: cliente, colaborador o ambos, y persona física
 * o empresa. Los nombres de los campos cambian con el tipo (razón social/CIF frente a
 * nombre/NIF) y la persona de contacto solo existe para empresas.
 */
export default function ClientCompanyModal({ open, editing, form, setForm, error, saving, onSubmit, onClose }) {
  const { t } = useLanguage();
  const formId = 'client-company-form';
  const values = { ...emptyPartyForm, ...form };
  const update = (patch) => setForm(f => ({ ...emptyPartyForm, ...f, ...patch }));
  const individual = values.legal_form === 'individual';
  const noRelationship = !values.is_client && !values.is_collaborator;

  const field = (key, label, { type = 'text', required = false, placeholder, autoComplete } = {}) => (
    <div className="field" key={key}>
      <label htmlFor={`client-${key}`} className="field-label">
        {label}
        {required && <span className="required-mark" aria-hidden="true">*</span>}
      </label>
      <input
        id={`client-${key}`}
        type={type}
        className="input"
        required={required}
        placeholder={placeholder}
        autoComplete={autoComplete}
        value={values[key] ?? ''}
        onChange={e => update({ [key]: e.target.value })}
      />
    </div>
  );

  const submit = (event) => {
    if (noRelationship) { event.preventDefault(); return; }
    onSubmit(event);
  };

  const title = editing
    ? t('directory.editTitle')
    : (values.is_collaborator && !values.is_client ? t('directory.newCollaborator') : t('directory.newClient'));

  return (
    <Modal
      open={open}
      onClose={onClose}
      size="md"
      icon="companies"
      description={t('formDesign.clientHelp')}
      title={title}
      footer={(
        <>
          <button type="button" className="ghost-button" onClick={onClose} disabled={saving}>{t('common.cancel')}</button>
          <button type="submit" form={formId} className="primary-button" disabled={saving || noRelationship}>
            {!saving && <Icon name="save" size={16} />}
            {saving ? t('common.savingChanges') : t('common.save')}
          </button>
        </>
      )}
    >
      <form id={formId} onSubmit={submit} className="planning-form client-company-form">
        <fieldset className={styles.group}>
          <legend className="field-label">{t('directory.relationship')}</legend>
          <div className={styles.choices}>
            {[['is_client', 'client'], ['is_collaborator', 'collaborator']].map(([key, label]) => (
              <label key={key} className={`${styles.choice}${values[key] ? ` ${styles.checked}` : ''}`}>
                <input type="checkbox" checked={values[key]} onChange={e => update({ [key]: e.target.checked })} aria-describedby={`client-${key}-hint`} />
                <span className={styles.choiceText}>
                  <strong>{t(`directory.${label}`)}</strong>
                  <span id={`client-${key}-hint`}>{t(`directory.${label}Hint`)}</span>
                </span>
              </label>
            ))}
          </div>
          <p className={noRelationship ? 'field-error' : 'field-help'} role={noRelationship ? 'alert' : undefined}>
            {noRelationship ? t('directory.relationshipRequired') : t('directory.relationshipHelp')}
          </p>
        </fieldset>

        <div className={`field ${styles.wide}`}>
          <span id="client-legal-form" className="field-label">{t('directory.legalForm')}</span>
          <div className={`segmented ${styles.legalForm}`} role="group" aria-labelledby="client-legal-form">
            <SlidingIndicator activeSelector="[aria-pressed='true']" />
            {['company', 'individual'].map(form => (
              <button key={form} type="button" aria-pressed={values.legal_form === form} onClick={() => update({ legal_form: form })}>
                <Icon name={form === 'company' ? 'companies' : 'user'} size={15} />
                {t(`directory.${form}`)}
              </button>
            ))}
          </div>
        </div>

        {field('name', individual ? t('directory.nameIndividual') : t('directory.nameCompany'), { required: true, autoComplete: individual ? 'name' : 'organization' })}
        {field('tax_id', individual ? t('directory.taxIndividual') : t('directory.taxCompany'))}
        {field('billing_address', individual ? t('directory.addressIndividual') : t('directory.addressCompany'), { autoComplete: 'street-address' })}
        {field('phone', t('planning.phonePlaceholder'), { type: 'tel', autoComplete: 'tel' })}
        {field('email', t('planning.emailPlaceholder'), { type: 'email', autoComplete: 'email' })}
        {!individual && field('responsible', t('directory.responsible'))}
        {values.is_collaborator && field('collaborator_role', t('directory.role'), { placeholder: t('directory.rolePlaceholder') })}

        <div className={`field ${styles.wide}`}>
          <label htmlFor="client-notes" className="field-label">{t('directory.notes')}</label>
          <textarea id="client-notes" className="input" rows={3} maxLength={4000} aria-describedby="client-notes-help"
            value={values.notes} onChange={e => update({ notes: e.target.value })} />
          <p id="client-notes-help" className="field-help">{t('directory.notesHelp')}</p>
        </div>

        <ColorSelector label={t('planning.colorLabel')} value={values.color} onChange={color => update({ color })}/>

        {error && <p className="field-error" role="alert">{error}</p>}
      </form>
    </Modal>
  );
}
