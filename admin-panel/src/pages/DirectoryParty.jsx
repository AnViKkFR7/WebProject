import { useCallback, useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { getDirectoryParty, getDirectoryPartySummary, updateClientCompany } from '../services/clientCompanyService'
import { useCompany } from '../contexts/CompanyContext'
import { useLanguage } from '../contexts/LanguageContext'
import { useFeedback } from '../contexts/FeedbackContext'
import { usePermissions } from '../hooks/usePermissions'
import { useCompanyModules } from '../hooks/useCompanyModules'
import { emptyPartyForm, lastTwelveMonths, partyToForm } from '../lib/directory'
import { formatPhoneNumber } from '../lib/phoneUtils'
import PageHeader from '../components/ui/PageHeader'
import Icon from '../components/ui/Icon'
import ClientCompanyModal from '../components/planning/ClientCompanyModal'
import styles from './DirectoryParty.module.css'

const fill = (text, values) => Object.entries(values).reduce((out, [key, value]) => out.replaceAll(`{${key}}`, value), text)
// «1 factura» frente a «2 facturas»: las claves con forma singular terminan en «One».
const countText = (t, key, count, name = 'count') => (Number(count) === 1 ? t(`${key}One`) : fill(t(key), { [name]: count }))

/**
 * Ficha de un cliente o colaborador: datos, y actividad calculada en el servidor
 * (facturas y presupuestos por NIF/CIF, tareas y movimientos de la agenda).
 * Cada bloque aparece solo si su módulo está activo.
 */
export default function DirectoryParty() {
  const { partyId } = useParams()
  const { selectedCompany } = useCompany()
  const companyId = selectedCompany?.id
  const { t, language } = useLanguage()
  const { toast } = useFeedback()
  const { canEdit } = usePermissions()
  const { modules } = useCompanyModules()
  const [state, setState] = useState({ status: 'loading', party: null, summary: null, summaryError: false })
  const [editing, setEditing] = useState(false)
  const [form, setForm] = useState(emptyPartyForm)
  const [formError, setFormError] = useState('')
  const [saving, setSaving] = useState(false)

  const locale = language === 'en' ? 'en-GB' : 'es-ES'
  const money = value => new Intl.NumberFormat(locale, { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 }).format(Number(value) || 0)
  const date = value => (value ? new Intl.DateTimeFormat(locale, { day: 'numeric', month: 'short', year: 'numeric' }).format(new Date(value)) : '')
  // Importe corto para la columna del mes («1,2k €»); el completo va en la etiqueta accesible y en móvil.
  const shortMoney = value => {
    const n = Math.max(Number(value) || 0, 0)
    const num = new Intl.NumberFormat(locale, { maximumFractionDigits: n >= 1000 && n < 10000 ? 1 : 0 })
    const text = n >= 1000 ? `${num.format(n / 1000)}k` : num.format(n)
    return language === 'en' ? `€${text}` : `${text} €`
  }
  const monthName = month => new Intl.DateTimeFormat(locale, { month: 'short', timeZone: 'UTC' }).format(new Date(`${month}-01T00:00:00Z`))
  const monthLong = month => new Intl.DateTimeFormat(locale, { month: 'long', year: 'numeric', timeZone: 'UTC' }).format(new Date(`${month}-01T00:00:00Z`))

  const load = useCallback(async () => {
    if (!companyId || !partyId) return
    // La empresa activa forma parte de la consulta: al cambiar de empresa no se muestra la ficha anterior.
    setState({ status: 'loading', party: null, summary: null, summaryError: false })
    try {
      const party = await getDirectoryParty(companyId, partyId)
      if (!party) { setState({ status: 'missing', party: null, summary: null, summaryError: false }); return }
      let summary = null; let summaryError = false
      try { summary = await getDirectoryPartySummary(companyId, partyId) } catch (error) { console.error(error); summaryError = true }
      setState({ status: 'ready', party, summary, summaryError })
    } catch (error) {
      console.error(error)
      setState({ status: 'error', party: null, summary: null, summaryError: false })
    }
  }, [companyId, partyId])

  useEffect(() => { void load() }, [load])

  if (!selectedCompany) return <div className="page-content"><p>{t('dashboard.selectCompanyDescription')}</p></div>

  const back = (
    <Link to="/companies" className={styles.back}>
      <Icon name="chevronLeft" size={16} />{t('directory.back')}
    </Link>
  )

  if (state.status === 'loading') return <div className="page-content">{back}<p className="attr-status" role="status">{t('common.loading')}</p></div>
  if (state.status === 'missing') return <div className="page-content">{back}<div className="error-state" role="alert">{t('directory.notFound')}</div></div>
  if (state.status === 'error') {
    return (
      <div className="page-content">{back}
        <div className="error-state" role="alert"><span>{t('errors.loadingCompanies')}</span><button type="button" onClick={() => void load()}>{t('feedback.retry')}</button></div>
      </div>
    )
  }

  const { party, summary } = state
  const individual = party.legal_form === 'individual'
  const isClient = party.is_client !== false
  const relationLabel = isClient && party.is_collaborator ? t('directory.both') : t(isClient ? 'directory.client' : 'directory.collaborator')

  const openEdit = () => { setForm(partyToForm(party)); setFormError(''); setEditing(true) }
  const submit = async event => {
    event.preventDefault()
    setSaving(true); setFormError('')
    try {
      const saved = await updateClientCompany(party.id, { ...form, company_id: companyId })
      setState(previous => ({ ...previous, party: saved }))
      setEditing(false)
      toast.success(t('companies.saved'))
      void load()
    } catch (error) {
      console.error(error)
      setFormError(t('companies.saveError')) // el formulario conserva lo escrito
    } finally { setSaving(false) }
  }

  const details = [
    [individual ? 'directory.taxIndividual' : 'directory.taxCompany', party.tax_id],
    [individual ? 'directory.addressIndividual' : 'directory.addressCompany', party.billing_address],
    ['companies.email', party.email && <a href={`mailto:${party.email}`}>{party.email}</a>],
    ['companies.phone', party.phone && <a href={`tel:${party.phone}`}>{formatPhoneNumber(party.phone)}</a>],
    ...(!individual ? [['directory.responsible', party.responsible]] : []),
    ...(party.is_collaborator ? [['directory.role', party.collaborator_role]] : []),
  ]

  const invoices = summary?.invoices
  const quotes = summary?.quotes
  const planning = summary?.planning
  const movements = summary?.movements
  const months = invoices ? lastTwelveMonths(invoices.monthly) : []
  const maxMonth = Math.max(0, ...months.map(m => m.total))

  return (
    <div className="page-content page-content-wide">
      {back}
      <PageHeader
        title={party.name}
        actions={canEdit && <button type="button" className="ghost-button" onClick={openEdit}><Icon name="edit" size={16} />{t('directory.edit')}</button>}
      >
        <p className={styles.badges}>
          <span className={`pill ${styles.relation}`}>{relationLabel}</span>
          <span className={`pill ${styles.neutral}`}>
            <Icon name={individual ? 'user' : 'companies'} size={12} />{t(individual ? 'directory.individual' : 'directory.company')}
          </span>
          {party.is_collaborator && party.collaborator_role && <span className={styles.role}>{party.collaborator_role}</span>}
        </p>
      </PageHeader>

      <div className={styles.layout}>
        <section className={`card ${styles.data}`} aria-labelledby="party-data-title">
          <h3 id="party-data-title" className={styles.sectionTitle}>{t('directory.dataTitle')}</h3>
          <dl className={styles.fields}>
            {details.map(([label, value]) => (
              <div key={label} className={styles.field}>
                <dt>{t(label)}</dt>
                <dd>{value || <span className="text-muted">{t('companies.notSet')}</span>}</dd>
              </div>
            ))}
          </dl>
          {party.notes && (
            <div className={styles.notes}>
              <h4>{t('directory.notes')}</h4>
              <p>{party.notes}</p>
            </div>
          )}
        </section>

        <section className={styles.activity} aria-labelledby="party-activity-title">
          <h3 id="party-activity-title" className={styles.sectionTitle}>{t('directory.activityTitle')}</h3>
          {state.summaryError && (
            <div className="error-state" role="alert"><span>{t('directory.summaryError')}</span><button type="button" onClick={() => void load()}>{t('feedback.retry')}</button></div>
          )}

          <div className={styles.metrics}>
            {invoices && (
              <article className={`stat-card ${styles.metric}`}>
                <h4 className="stat-card-title">{t('directory.invoiced')}</h4>
                <p className="stat-card-value">{money(invoices.total)}</p>
                <p className="stat-card-hint">{countText(t, 'directory.invoicedHint', invoices.count)}</p>
                {invoices.last_issued_on && <p className="stat-card-hint">{fill(t('directory.lastInvoice'), { date: date(invoices.last_issued_on) })}</p>}
              </article>
            )}
            {invoices && (
              <article className={`stat-card ${styles.metric}`}>
                <h4 className="stat-card-title">{t('directory.outstanding')}</h4>
                <p className="stat-card-value">{money(invoices.outstanding)}</p>
                <p className="stat-card-hint">{t('directory.collected')}: {money(invoices.paid)}</p>
                <p className={`stat-card-hint ${invoices.overdue_count > 0 ? styles.warning : ''}`}>
                  {invoices.overdue_count > 0 ? countText(t, 'directory.overdue', invoices.overdue_count) : t('directory.nothingOverdue')}
                </p>
              </article>
            )}
            {quotes && quotes.count > 0 && (
              <article className={`stat-card ${styles.metric}`}>
                <h4 className="stat-card-title">{t('directory.quotes')}</h4>
                <p className="stat-card-value">{money(quotes.accepted_total)}</p>
                <p className="stat-card-hint">{fill(t('directory.quotesHint'), { accepted: quotes.accepted, count: quotes.count })}</p>
                {quotes.open > 0 && <p className="stat-card-hint">{countText(t, 'directory.openQuotes', quotes.open)}</p>}
              </article>
            )}
            {planning && (
              <article className={`stat-card ${styles.metric}`}>
                <h4 className="stat-card-title">{t('directory.tasks')}</h4>
                <p className="stat-card-value">{planning.count}</p>
                <p className="stat-card-hint">{countText(t, 'directory.tasksHint', planning.upcoming, 'upcoming')}</p>
                <p className="stat-card-hint">{planning.next ? fill(t('directory.nextTask'), { title: planning.next.title, date: date(planning.next.start) }) : t('directory.noUpcoming')}</p>
              </article>
            )}
            {movements && movements.count > 0 && (
              <article className={`stat-card ${styles.metric}`}>
                <h4 className="stat-card-title">{party.is_collaborator && !isClient ? t('directory.toPay') : t('directory.toCollect')}</h4>
                <p className="stat-card-value">{money(party.is_collaborator && !isClient ? movements.to_pay : movements.to_collect)}</p>
                <p className="stat-card-hint">{countText(t, 'directory.movementsHint', movements.count)}</p>
                {isClient && party.is_collaborator && <p className="stat-card-hint">{t('directory.toPay')}: {money(movements.to_pay)}</p>}
              </article>
            )}
          </div>

          {invoices && (
            <div className={`card ${styles.chartCard}`}>
              <h4 className={styles.chartTitle}>{t('directory.monthlyTitle')}</h4>
              {maxMonth > 0 ? (
                <ol className={styles.chart}>
                  {months.map(({ month, total }) => (
                    <li key={month} aria-label={fill(t('directory.monthlyLabel'), { month: monthLong(month), amount: money(total) })}>
                      <span className={`${styles.amount} ${total > 0 ? '' : styles.empty}`} aria-hidden="true">
                        <span className={styles.amountShort}>{total > 0 ? shortMoney(total) : '–'}</span>
                        <span className={styles.amountFull}>{money(total)}</span>
                      </span>
                      <span className={styles.track} aria-hidden="true"><span className={styles.bar} style={{ '--h': `${Math.max(total > 0 ? 4 : 0, Math.round((Math.max(total, 0) / maxMonth) * 100))}%` }} /></span>
                      <span className={styles.month} aria-hidden="true">{monthName(month)}</span>
                    </li>
                  ))}
                </ol>
              ) : <p className="text-muted">{t('directory.monthlyEmpty')}</p>}
              <div className={styles.chartFooter}>
                <p className={styles.matchNote}>{summary.matched_by === 'name' ? t('directory.matchedByName') : t('directory.matchedByTax')}</p>
                {/* Abre Facturación con el listado ya filtrado por este cliente (mismo criterio que el resumen). */}
                <Link className="stat-card-cta" to={`/invoicing?q=${encodeURIComponent((summary.matched_by === 'name' ? party.name : party.tax_id) || party.name)}`}>
                  {t('directory.seeInvoices')}<Icon name="chevronRight" size={14} />
                </Link>
              </div>
            </div>
          )}

          {modules.planning && (
            <Link className="stat-card-cta" to="/planning">{t('companies.seeInPlanning')}<Icon name="chevronRight" size={14} /></Link>
          )}
        </section>
      </div>

      <ClientCompanyModal
        open={editing}
        editing={party}
        form={form}
        setForm={setForm}
        error={formError}
        saving={saving}
        onSubmit={submit}
        onClose={() => setEditing(false)}
      />
    </div>
  )
}
