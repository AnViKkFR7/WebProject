import { useLanguage } from '../../contexts/LanguageContext'
import { conversionStats } from '../../lib/analyticsEvents'
import Icon from '../ui/Icon'

const ICONS = { phone_click: 'link', email_click: 'mail', form_submit: 'file' }

/**
 * Las tres conversiones que valen en cualquier web: llamar, escribir un email
 * y enviar el formulario. Salen siempre, aunque valgan 0, para que el cliente
 * vea que se están midiendo.
 */
const ConversionsCard = ({ byEvent, visitors }) => {
  const { t } = useLanguage()
  const { rows, total, per100 } = conversionStats(byEvent, visitors)

  return (
    <div className="card analytics-card">
      <h3 className="analytics-card-title">{t('analytics.conversionsTitle')}</h3>
      <p className="field-help analytics-card-help">{t('analytics.conversionsHelp')}</p>

      <ul className="conversion-list">
        {rows.map(row => (
          <li key={row.key}>
            <span className="conversion-icon"><Icon name={ICONS[row.key]} size={16} /></span>
            <span className="conversion-name">{t(`analytics.reserved.${row.key}`)}</span>
            <strong className="conversion-value">{row.value}</strong>
          </li>
        ))}
      </ul>

      {total > 0 && (
        <p className="conversion-rate">
          {t('analytics.conversionRate').replace('{rate}', per100.toLocaleString('es-ES'))}
        </p>
      )}
    </div>
  )
}

export default ConversionsCard
