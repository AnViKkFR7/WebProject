import { useState, useEffect, useCallback } from 'react'
import { format, subDays } from 'date-fns'
import {
  ResponsiveContainer, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip,
  BarChart, Bar, Legend
} from 'recharts'
import { analyticsService, summarizeDailyRows, toChartData } from '../services/analyticsService'
import CreateEventDefinitionModal from '../components/analytics/CreateEventDefinitionModal'
import Button from '../components/Button'
import { useCompany } from '../contexts/CompanyContext'
import { useLanguage } from '../contexts/LanguageContext'

const RANGE_PRESETS = [
  { days: 7, key: 'last7' },
  { days: 30, key: 'last30' },
  { days: 90, key: 'last90' }
]

const CHART_COLOR = 'var(--primary-color)'

const StatCard = ({ label, value }) => (
  <div className="card" style={{ padding: '1.25rem', textAlign: 'center' }}>
    <div style={{ fontSize: '2rem', fontWeight: 700, color: 'var(--text-primary)' }}>{value}</div>
    <div style={{ fontSize: '0.875rem', color: 'var(--text-secondary)', marginTop: '0.25rem' }}>{label}</div>
  </div>
)

const Analytics = () => {
  const { selectedCompany } = useCompany()
  const { t } = useLanguage()
  const canManageEvents = selectedCompany?.userRole === 'admin' || selectedCompany?.userRole === 'editor'

  const [rangeDays, setRangeDays] = useState(30)
  const [dailyRows, setDailyRows] = useState([])
  const [eventDefinitions, setEventDefinitions] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  const [showCreateModal, setShowCreateModal] = useState(false)
  const [savingEvent, setSavingEvent] = useState(false)
  const [togglingId, setTogglingId] = useState(null)
  const [aggregating, setAggregating] = useState(false)
  const [aggregateMessage, setAggregateMessage] = useState(null)

  const loadData = useCallback(async () => {
    if (!selectedCompany?.id) return
    setLoading(true)
    setError(null)
    try {
      const endDate = format(new Date(), 'yyyy-MM-dd')
      const startDate = format(subDays(new Date(), rangeDays - 1), 'yyyy-MM-dd')
      const [rows, definitions] = await Promise.all([
        analyticsService.getDailyAnalytics(selectedCompany.id, startDate, endDate),
        analyticsService.getEventDefinitions(selectedCompany.id)
      ])
      setDailyRows(rows)
      setEventDefinitions(definitions)
    } catch (err) {
      console.error('Error loading analytics:', err)
      setError(t('analytics.loadError'))
    } finally {
      setLoading(false)
    }
  }, [selectedCompany?.id, rangeDays, t])

  useEffect(() => {
    loadData()
  }, [loadData])

  const handleCreateEvent = async ({ key, label }) => {
    setSavingEvent(true)
    try {
      const created = await analyticsService.createEventDefinition({
        companyId: selectedCompany.id,
        key,
        label
      })
      setEventDefinitions((prev) => [...prev, created])
      setShowCreateModal(false)
    } finally {
      setSavingEvent(false)
    }
  }

  const handleAggregateNow = async () => {
    setAggregating(true)
    setAggregateMessage(null)
    try {
      await analyticsService.aggregateNow(selectedCompany.id)
      await loadData()
      setAggregateMessage({ type: 'success', text: t('analytics.aggregateSuccess') })
    } catch (err) {
      console.error('Error aggregating now:', err)
      setAggregateMessage({ type: 'error', text: t('analytics.aggregateError') })
    } finally {
      setAggregating(false)
    }
  }

  const handleToggleEvent = async (definition) => {
    setTogglingId(definition.id)
    try {
      const updated = await analyticsService.setEventDefinitionActive(definition.id, !definition.is_active)
      setEventDefinitions((prev) => prev.map((d) => (d.id === updated.id ? updated : d)))
    } catch (err) {
      console.error('Error toggling event definition:', err)
    } finally {
      setTogglingId(null)
    }
  }

  if (!selectedCompany) {
    return (
      <div className="page">
        <div className="page-content">
          <p>{t('dashboard.selectCompanyDescription')}</p>
        </div>
      </div>
    )
  }

  const summary = summarizeDailyRows(dailyRows)
  const timeline = dailyRows.map((row) => ({
    day: format(new Date(row.day + 'T00:00:00'), 'dd/MM'),
    [t('analytics.uniqueVisitors')]: row.unique_visitors,
    [t('analytics.pageViews')]: row.page_views
  }))
  const topPaths = toChartData(summary.byPath, 8)
  const eventCounts = toChartData(summary.byEvent)
  const labelForKey = (key) => eventDefinitions.find((d) => d.key === key)?.label || key

  return (
    <div className="page">
      <div className="page-content">
        <div className="page-header">
          <div>
            <h2>{t('analytics.title')}</h2>
            <p>{t('analytics.description')}</p>
          </div>
        </div>

        {/* Rango de fechas: presets simples, cómodos en móvil (un tap, sin picker) */}
        <div style={{
          display: 'flex', gap: '0.5rem', flexWrap: 'wrap', justifyContent: 'space-between',
          alignItems: 'center', marginBottom: '0.75rem'
        }}>
          <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
            {RANGE_PRESETS.map((preset) => (
              <Button
                key={preset.days}
                variant={rangeDays === preset.days ? 'primary' : 'ghost'}
                size="medium"
                onClick={() => setRangeDays(preset.days)}
              >
                {t(`analytics.${preset.key}`)}
              </Button>
            ))}
          </div>

          {canManageEvents && (
            <Button variant="ghost" size="medium" onClick={handleAggregateNow} disabled={aggregating}>
              {aggregating ? t('analytics.aggregating') : `🔄 ${t('analytics.aggregateNow')}`}
            </Button>
          )}
        </div>

        {aggregateMessage && (
          <p style={{
            fontSize: '0.85rem',
            marginBottom: '1rem',
            color: aggregateMessage.type === 'error' ? 'var(--danger, #dc2626)' : 'var(--text-secondary)'
          }}>
            {aggregateMessage.text}
          </p>
        )}

        {error && (
          <div className="card" style={{ padding: '1rem', marginBottom: '1.5rem', color: 'var(--danger, #dc2626)' }}>
            {error}
          </div>
        )}

        {loading ? (
          <p>{t('common.loading')}</p>
        ) : (
          <>
            <div style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))',
              gap: '1rem',
              marginBottom: '1.5rem'
            }}>
              <StatCard label={t('analytics.uniqueVisitors')} value={summary.uniqueVisitors} />
              <StatCard label={t('analytics.pageViews')} value={summary.pageViews} />
              <StatCard
                label={t('analytics.totalEvents')}
                value={Object.values(summary.byEvent).reduce((a, b) => a + b, 0)}
              />
            </div>

            <div className="card" style={{ padding: '1.25rem', marginBottom: '1.5rem' }}>
              <h3 style={{ fontSize: '1.05rem', fontWeight: 600, marginBottom: '1rem' }}>
                {t('analytics.timelineTitle')}
              </h3>
              {timeline.length === 0 ? (
                <p style={{ color: 'var(--text-secondary)' }}>{t('analytics.noData')}</p>
              ) : (
                <ResponsiveContainer width="100%" height={260}>
                  <LineChart data={timeline}>
                    <CartesianGrid strokeDasharray="3 3" stroke="var(--border-color)" />
                    <XAxis dataKey="day" stroke="var(--text-secondary)" fontSize={12} />
                    <YAxis stroke="var(--text-secondary)" fontSize={12} allowDecimals={false} />
                    <Tooltip contentStyle={{ background: 'var(--bg-card)', border: '1px solid var(--border-color)' }} />
                    <Legend />
                    <Line type="monotone" dataKey={t('analytics.uniqueVisitors')} stroke={CHART_COLOR} strokeWidth={2} dot={false} />
                    <Line type="monotone" dataKey={t('analytics.pageViews')} stroke="var(--text-secondary)" strokeWidth={2} dot={false} />
                  </LineChart>
                </ResponsiveContainer>
              )}
            </div>

            <div className="card" style={{ padding: '1.25rem', marginBottom: '1.5rem' }}>
              <h3 style={{ fontSize: '1.05rem', fontWeight: 600, marginBottom: '1rem' }}>
                {t('analytics.topPathsTitle')}
              </h3>
              {topPaths.length === 0 ? (
                <p style={{ color: 'var(--text-secondary)' }}>{t('analytics.noData')}</p>
              ) : (
                <ResponsiveContainer width="100%" height={Math.max(200, topPaths.length * 40)}>
                  <BarChart data={topPaths} layout="vertical" margin={{ left: 24 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="var(--border-color)" />
                    <XAxis type="number" stroke="var(--text-secondary)" fontSize={12} allowDecimals={false} />
                    <YAxis type="category" dataKey="name" stroke="var(--text-secondary)" fontSize={12} width={120} />
                    <Tooltip contentStyle={{ background: 'var(--bg-card)', border: '1px solid var(--border-color)' }} />
                    <Bar dataKey="value" fill={CHART_COLOR} radius={[0, 4, 4, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              )}
            </div>

            <div className="card" style={{ padding: '1.25rem', marginBottom: '1.5rem' }}>
              <h3 style={{ fontSize: '1.05rem', fontWeight: 600, marginBottom: '1rem' }}>
                {t('analytics.eventsTitle')}
              </h3>
              {eventCounts.length === 0 ? (
                <p style={{ color: 'var(--text-secondary)' }}>{t('analytics.noEventData')}</p>
              ) : (
                <div style={{ display: 'grid', gap: '0.5rem' }}>
                  {eventCounts.map((e) => (
                    <div key={e.name} style={{
                      display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                      padding: '0.6rem 0.75rem', borderRadius: '6px', background: 'var(--bg-table-header)'
                    }}>
                      <span>{labelForKey(e.name)}</span>
                      <strong>{e.value}</strong>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </>
        )}

        {/* Gestión de eventos: siempre visible (para ver el snippet a copiar),
            acciones de escritura ocultas para viewers */}
        <div className="card" style={{ padding: '1.25rem' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem', flexWrap: 'wrap', gap: '0.75rem' }}>
            <h3 style={{ fontSize: '1.05rem', fontWeight: 600, margin: 0 }}>{t('analytics.manageEventsTitle')}</h3>
            {canManageEvents && (
              <Button variant="primary" size="medium" onClick={() => setShowCreateModal(true)}>
                + {t('analytics.newEvent')}
              </Button>
            )}
          </div>

          {eventDefinitions.length === 0 ? (
            <p style={{ color: 'var(--text-secondary)' }}>{t('analytics.noEvents')}</p>
          ) : (
            <div style={{ display: 'grid', gap: '0.75rem' }}>
              {eventDefinitions.map((def) => (
                <div key={def.id} style={{
                  display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                  gap: '0.75rem', flexWrap: 'wrap',
                  padding: '0.75rem', border: '1px solid var(--border-color)', borderRadius: '8px',
                  opacity: def.is_active ? 1 : 0.55
                }}>
                  <div style={{ minWidth: 0 }}>
                    <div style={{ fontWeight: 600 }}>{def.label}</div>
                    <code style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
                      data-track-event="{def.key}"
                    </code>
                  </div>
                  {canManageEvents && (
                    <Button
                      variant="ghost"
                      size="small"
                      disabled={togglingId === def.id}
                      onClick={() => handleToggleEvent(def)}
                    >
                      {def.is_active ? t('analytics.deactivate') : t('analytics.activate')}
                    </Button>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>

        <CreateEventDefinitionModal
          show={showCreateModal}
          loading={savingEvent}
          existingKeys={eventDefinitions.map((d) => d.key)}
          onClose={() => setShowCreateModal(false)}
          onSave={handleCreateEvent}
        />
      </div>
    </div>
  )
}

export default Analytics
