import { useState } from 'react';
import { useLanguage } from '../../contexts/LanguageContext';
import { useFeedback } from '../../contexts/FeedbackContext';
import { formatRecurrence } from '../../lib/recurrence';
import { getCompanyColor } from '../../lib/planningColors';
import { downloadInvoicePDF } from '../../lib/invoicePdf';
import Modal from '../ui/Modal';
import Icon from '../ui/Icon';
import { AttachmentLink } from './TaskCard';

const byDate = (a, b) => new Date(a.billing_date) - new Date(b.billing_date);
const sum = (list) => list.reduce((total, bill) => total + Number(bill.amount || 0), 0);

function BillCard({ bill, tone, onClick }) {
  return (
    <button type="button" className="bill-card" onClick={onClick} aria-haspopup="dialog" style={{ '--accent-color': tone }}>
      <span>
        <span className="bill-card-title">{bill.title}</span>
        <span className="bill-card-date">{bill.billing_date}</span>
      </span>
      <span className="bill-card-amount">{bill.amount} EUR</span>
    </button>
  );
}

function Column({ titleKey, tone, bills, onSelect }) {
  const { t } = useLanguage();
  return (
    <div>
      <h4 className="planning-section-title" style={{ color: tone }}>{t(titleKey)}</h4>
      {bills.length === 0
        ? <p className="planning-empty" style={{ paddingTop: 0, fontSize: '0.75rem' }}>{t('planning.noPending')}</p>
        : bills.map(bill => (
          <BillCard key={bill._occurrenceKey || bill.id} bill={bill} tone={tone} onClick={() => onSelect(bill)} />
        ))}
    </div>
  );
}

export default function BillingView({ bills, clientCompanies, onDelete, onEdit }) {
  const { t } = useLanguage();
  const { toast, confirm } = useFeedback();
  const [detail, setDetail] = useState(null);

  const income = 'var(--planning-income)';
  const expense = 'var(--planning-expense)';

  const handleDelete = async () => {
    const isRecurring = detail.recurrence_type && detail.recurrence_type !== 'none';
    const ok = await confirm({
      title: t('planning.deleteBillTitle').replace('{name}', detail.title),
      message: isRecurring ? t('planning.deleteSeriesWarning') : t('planning.deleteBillMessage'),
      confirmLabel: t('common.delete'),
      danger: true,
    });
    if (!ok) return;
    onDelete(detail.id);
    setDetail(null);
  };

  return (
    <>
      {clientCompanies.map(company => {
        const color = getCompanyColor(company);
        const companyBills = bills.filter(b => b.client_company_id === company.id);
        const toReceive = companyBills.filter(b => b.direction === 'cobrar').sort(byDate);
        const toPay = companyBills.filter(b => b.direction === 'pagar').sort(byDate);

        return (
          <section key={company.id} className="bill-group">
            <h3 className="planning-section-title" style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <span className="company-dot" style={{ '--company-color': color }} />
              {company.name}
            </h3>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
              <Column titleKey="planning.toReceive" tone={income} bills={toReceive} onSelect={setDetail} />
              <Column titleKey="planning.toPay" tone={expense} bills={toPay} onSelect={setDetail} />
            </div>

            {companyBills.length > 0 && (
              <p className="bill-total">
                <span className="bill-total-income">+{sum(toReceive).toFixed(2)} EUR</span>
                <span className="bill-total-expense">−{sum(toPay).toFixed(2)} EUR</span>
              </p>
            )}
          </section>
        );
      })}

      {detail && (
        <Modal
          open
          size="sm"
          onClose={() => setDetail(null)}
          title={detail.title}
          description={clientCompanies.find(c => c.id === detail.client_company_id)?.name}
          footer={(
            <>
              {onEdit && (
                <button type="button" className="ghost-button" onClick={() => { onEdit(detail); setDetail(null); }}>
                  <Icon name="edit" size={16} />{t('common.edit')}
                </button>
              )}
              {onDelete && (
                <button type="button" className="button button-danger button-medium" onClick={handleDelete}>
                  <Icon name="trash" size={16} />{t('common.delete')}
                </button>
              )}
              <button type="button" className="primary-button" onClick={() => setDetail(null)}>{t('common.close')}</button>
            </>
          )}
        >
          <div className="detail-accent" style={{ '--accent-color': detail.direction === 'cobrar' ? income : expense }} />
          <dl className="planning-form">
            <div className="detail-row">
              <dt>{t('planning.typeLabel')}</dt>
              <dd>{detail.direction === 'cobrar' ? t('planning.directionReceive') : t('planning.directionPay')}</dd>
            </div>
            <div className="detail-row">
              <dt>{t('planning.dateLabel')}</dt>
              <dd>{detail.billing_date}</dd>
            </div>
            <div className="detail-row">
              <dt>{t('planning.amountLabel')}</dt>
              <dd style={{ fontWeight: 700, color: detail.direction === 'cobrar' ? income : expense }}>
                {detail.direction === 'cobrar' ? '+' : '−'}{detail.amount} EUR
              </dd>
            </div>
            {detail.recurrence_type && detail.recurrence_type !== 'none' && (
              <div className="detail-row">
                <dt>{t('planning.recurrenceLabel')}</dt>
                <dd>{formatRecurrence(detail.recurrence_type, detail.recurrence_value, t)}</dd>
              </div>
            )}
            {detail.description && (
              <div className="detail-row">
                <dt>{t('planning.descriptionLabel')}</dt>
                <dd>{detail.description}</dd>
              </div>
            )}
            {detail.attachments?.length > 0 && (
              <div className="detail-row">
                <dt>{t('planning.attachmentsLabel')}</dt>
                <dd style={{ display: 'flex', flexWrap: 'wrap', gap: '0.375rem' }}>
                  {detail.attachments.map((file, i) => <AttachmentLink key={i} file={file} index={i} />)}
                </dd>
              </div>
            )}
          </dl>

          <button
            type="button"
            className="ghost-button"
            style={{ width: '100%', marginTop: '0.75rem' }}
            onClick={() => downloadInvoicePDF(detail, clientCompanies, t, toast.error)}
          >
            <Icon name="download" size={16} />
            {t('planning.downloadInvoicePdf')}
          </button>
        </Modal>
      )}
    </>
  );
}
