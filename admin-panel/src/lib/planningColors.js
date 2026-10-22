// Color de cada empresa cliente. Si no tiene uno guardado, se le asigna uno
// estable de la paleta: por posición en la lista, o por hash del id cuando se
// pinta fuera de ella (así no cambia de color entre pantallas).
export const PALETTE = [
  '#007AFF', '#FF3B30', '#34C759', '#FF9500', '#AF52DE',
  '#5856D6', '#FF2D55', '#00C7BE', '#FF6B6B', '#FFD60A',
  '#BF5AF2', '#4ECDC4', '#45B7D1', '#30D158', '#FF8C42',
  '#6BCB77',
]

export function getCompanyColor(company, idx) {
  if (!company) return PALETTE[0]
  if (company.color) return company.color
  if (idx !== undefined && idx >= 0) return PALETTE[idx % PALETTE.length]
  let hash = 0
  const str = company.id || company.name || ''
  for (let i = 0; i < str.length; i++) hash = str.charCodeAt(i) + ((hash << 5) - hash)
  return PALETTE[Math.abs(hash) % PALETTE.length]
}
