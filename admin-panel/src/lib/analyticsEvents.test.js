import { describe, expect, it } from 'vitest'
import { summarizeDailyRows } from '../services/analyticsService'
import {
  conversionStats, engagementStats, isReservedEventKey, RESERVED_EVENT_KEYS, scrollRows, SCROLL_THRESHOLDS,
} from './analyticsEvents'
// El núcleo del snippet de las webs: ambos lados tienen que estar de acuerdo
import {
  RESERVED_EVENT_KEYS as SNIPPET_RESERVED, SCROLL_THRESHOLDS as SNIPPET_THRESHOLDS,
} from '../../../company-site-snippet/lib/trackCore'

describe('analyticsEvents — el panel y el snippet hablan igual', () => {
  it('las claves reservadas coinciden con las del snippet', () => {
    // Si este test falla, una de las dos listas se ha tocado sin la otra: el
    // panel dejaría que alguien registre una clave que el servidor ya acepta.
    expect([...RESERVED_EVENT_KEYS].sort()).toEqual([...SNIPPET_RESERVED].sort())
  })

  it('los umbrales de scroll coinciden con los del snippet', () => {
    expect(SCROLL_THRESHOLDS).toEqual([...SNIPPET_THRESHOLDS])
  })

  it('reconoce las reservadas', () => {
    expect(isReservedEventKey('form_submit')).toBe(true)
    expect(isReservedEventKey('whatsapp_click')).toBe(false)
  })
})

describe('analyticsEvents — conversiones', () => {
  it('siempre salen las tres, aunque valgan 0', () => {
    const { rows } = conversionStats({ whatsapp_click: 9 }, 100)
    expect(rows.map(r => r.key)).toEqual(['phone_click', 'email_click', 'form_submit'])
    expect(rows.every(r => r.value === 0)).toBe(true)
  })

  it('suma solo las reservadas, no los clics propios del cliente', () => {
    const stats = conversionStats({ phone_click: 6, email_click: 2, form_submit: 4, whatsapp_click: 50 }, 200)
    expect(stats.total).toBe(12)
    expect(stats.per100).toBe(6)
  })

  it('sin visitantes no divide por cero', () => {
    expect(conversionStats({ phone_click: 3 }, 0).per100).toBe(0)
    expect(conversionStats(null, 10).total).toBe(0)
  })
})

describe('analyticsEvents — lectura por página', () => {
  const byScroll = {
    '/servicios': { 25: 40, 50: 22, 75: 9, 100: 4 },
    '/': { 25: 70, 50: 30 },
  }
  const byPath = { '/servicios': 50, '/': 200 }

  it('el porcentaje es sobre las visitas de la página', () => {
    const [servicios] = scrollRows(byScroll, byPath).filter(r => r.path === '/servicios')
    expect(servicios.percent).toEqual({ 25: 80, 50: 44, 75: 18, 100: 8 })
  })

  it('un umbral que nadie alcanzó es 0, no undefined', () => {
    const [home] = scrollRows(byScroll, byPath).filter(r => r.path === '/')
    expect(home.percent[75]).toBe(0)
    expect(home.percent[100]).toBe(0)
  })

  it('ordena por visitas y respeta el límite', () => {
    const rows = scrollRows(byScroll, byPath, 1)
    expect(rows).toHaveLength(1)
    expect(rows[0].path).toBe('/')
  })

  it('nunca pasa de 100 aunque falte alguna visita en el recuento', () => {
    const rows = scrollRows({ '/x': { 25: 10 } }, { '/x': 4 })
    expect(rows[0].percent[25]).toBe(100)
  })

  it('sin visitas conocidas usa el primer umbral como base', () => {
    const rows = scrollRows({ '/nueva': { 25: 8, 50: 4 } }, {})
    expect(rows[0].views).toBe(8)
    expect(rows[0].percent[50]).toBe(50)
  })

  it('aguanta datos vacíos', () => {
    expect(scrollRows(null, null)).toEqual([])
    expect(scrollRows({}, {})).toEqual([])
  })
})

describe('analyticsEvents — tiempo en página', () => {
  it('reparte por tramos y calcula el rebote', () => {
    const stats = engagementStats({ lt10: 30, '10_30': 20, '30_60': 30, '60_180': 15, gt180: 5 })
    expect(stats.total).toBe(100)
    expect(stats.bounceRate).toBe(30)
    expect(stats.rows.map(r => r.key)).toEqual(['lt10', '10_30', '30_60', '60_180', 'gt180'])
  })

  it('los tramos que faltan cuentan 0', () => {
    const stats = engagementStats({ lt10: 5 })
    expect(stats.rows.find(r => r.key === 'gt180').value).toBe(0)
    expect(stats.bounceRate).toBe(100)
  })

  it('sin datos no hay rebote que mostrar', () => {
    expect(engagementStats(undefined)).toMatchObject({ total: 0, bounceRate: 0 })
  })
})

describe('analyticsEvents — sumar varios días', () => {
  const days = [
    { by_scroll: { '/a': { 25: 10, 50: 4 } }, by_engagement: { lt10: 3, gt180: 1 }, by_not_found: { '/viejo': 2 } },
    { by_scroll: { '/a': { 25: 5 }, '/b': { 25: 2 } }, by_engagement: { lt10: 1 }, by_not_found: { '/viejo': 1, '/otro': 5 } },
  ]

  it('fusiona el scroll por página y por umbral', () => {
    const summary = summarizeDailyRows(days)
    expect(summary.byScroll['/a']).toEqual({ 25: 15, 50: 4 })
    expect(summary.byScroll['/b']).toEqual({ 25: 2 })
  })

  it('suma el tiempo y los 404', () => {
    const summary = summarizeDailyRows(days)
    expect(summary.byEngagement).toEqual({ lt10: 4, gt180: 1 })
    expect(summary.byNotFound).toEqual({ '/viejo': 3, '/otro': 5 })
  })

  it('los días anteriores a esta mejora (sin esas columnas) no rompen nada', () => {
    const summary = summarizeDailyRows([{ unique_visitors: 4, page_views: 9 }])
    expect(summary.byScroll).toEqual({})
    expect(summary.byEngagement).toEqual({})
    expect(summary.byNotFound).toEqual({})
  })
})
