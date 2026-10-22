// Qué significan los eventos de la analítica y cómo se resumen para el panel.
// Solo cálculo, sin llamadas a la base de datos, para poder probarlo.

/**
 * Claves de clic que valen en todas las empresas sin darlas de alta.
 * DEBE coincidir con RESERVED_EVENT_KEYS de company-site-snippet/lib/trackCore.ts
 * (hay un test que lo comprueba).
 */
export const RESERVED_EVENT_KEYS = ['phone_click', 'email_click', 'form_submit']

export const SCROLL_THRESHOLDS = [25, 50, 75, 100]

/** Tramos de tiempo en página, de menor a mayor. lt10 = "rebote": menos de 10 s. */
export const ENGAGEMENT_BUCKETS = ['lt10', '10_30', '30_60', '60_180', 'gt180']

export const isReservedEventKey = (key) => RESERVED_EVENT_KEYS.includes(key)

/** Porcentaje entero, acotado a 0-100 y sin dividir por cero */
const percentOf = (value, total) => (total > 0 ? Math.min(100, Math.round((value / total) * 100)) : 0)

/**
 * Cuántas veces ocurrió cada conversión reservada (siempre las tres, aunque
 * sea 0: que el cliente vea que se están midiendo) y cuántas por cada 100
 * visitantes.
 */
export function conversionStats(byEvent, visitors) {
  const rows = RESERVED_EVENT_KEYS.map((key) => ({ key, value: Number(byEvent?.[key]) || 0 }))
  const total = rows.reduce((sum, row) => sum + row.value, 0)
  // visitors suma los únicos de cada día: es una aproximación, no un único real
  const per100 = visitors > 0 ? Math.round((total / visitors) * 1000) / 10 : 0
  return { rows, total, per100 }
}

/**
 * Tabla de lectura: por cada página, qué porcentaje de sus visitas llegó a
 * cada umbral. El porcentaje es sobre las visitas de la página.
 * Las páginas que apenas se desplazan no mandan scroll, así que no salen aquí.
 */
export function scrollRows(byScroll, byPath, limit = 8) {
  return Object.entries(byScroll || {})
    .map(([path, depths]) => {
      const reached = Object.fromEntries(
        SCROLL_THRESHOLDS.map((threshold) => [threshold, Number(depths?.[threshold]) || 0]),
      )
      // Sin visitas conocidas, la base es quien llegó al primer umbral
      const views = Number(byPath?.[path]) || reached[SCROLL_THRESHOLDS[0]]
      return {
        path,
        views,
        reached,
        percent: Object.fromEntries(SCROLL_THRESHOLDS.map((t) => [t, percentOf(reached[t], views)])),
      }
    })
    .filter((row) => row.views > 0)
    .sort((a, b) => b.views - a.views)
    .slice(0, limit)
}

/**
 * Tiempo en página: reparto por tramos y el porcentaje de visitas cortas.
 * "Rebote" aquí significa visita de menos de 10 segundos con la pestaña visible.
 */
export function engagementStats(byEngagement) {
  const total = ENGAGEMENT_BUCKETS.reduce((sum, key) => sum + (Number(byEngagement?.[key]) || 0), 0)
  const rows = ENGAGEMENT_BUCKETS.map((key) => {
    const value = Number(byEngagement?.[key]) || 0
    return { key, value, percent: percentOf(value, total) }
  })
  return { total, rows, bounceRate: percentOf(Number(byEngagement?.lt10) || 0, total) }
}
