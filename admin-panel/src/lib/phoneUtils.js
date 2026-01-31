/**
 * Formatea un número de teléfono para visualización
 * Soporta formatos españoles e internacionales
 * @param {string} phone - Número de teléfono sin formatear
 * @returns {string} - Número de teléfono formateado
 */
export const formatPhoneNumber = (phone) => {
  if (!phone) return ''
  
  // Eliminar espacios, guiones y paréntesis
  const cleaned = phone.replace(/[\s\-()]/g, '')
  
  // Si empieza con +34 (España)
  if (cleaned.startsWith('+34')) {
    const number = cleaned.substring(3)
    if (number.length === 9) {
      // +34 XXX XX XX XX
      return `+34 ${number.substring(0, 3)} ${number.substring(3, 5)} ${number.substring(5, 7)} ${number.substring(7, 9)}`
    }
  }
  
  // Si empieza con 34 sin +
  if (cleaned.startsWith('34') && cleaned.length === 11) {
    const number = cleaned.substring(2)
    return `+34 ${number.substring(0, 3)} ${number.substring(3, 5)} ${number.substring(5, 7)} ${number.substring(7, 9)}`
  }
  
  // Si es un número español sin prefijo (9 dígitos)
  if (cleaned.length === 9 && /^[6789]/.test(cleaned)) {
    return `+34 ${cleaned.substring(0, 3)} ${cleaned.substring(3, 5)} ${cleaned.substring(5, 7)} ${cleaned.substring(7, 9)}`
  }
  
  // Formato internacional genérico
  if (cleaned.startsWith('+')) {
    // Separar código de país (primeros 2-3 dígitos después del +)
    const match = cleaned.match(/^(\+\d{1,3})(\d+)$/)
    if (match) {
      const countryCode = match[1]
      const number = match[2]
      
      // Agrupar el resto en bloques de 3 dígitos
      const formatted = number.match(/.{1,3}/g)?.join(' ') || number
      return `${countryCode} ${formatted}`
    }
  }
  
  // Si no coincide con ningún formato, agrupar en bloques de 3
  const formatted = cleaned.match(/.{1,3}/g)?.join(' ') || cleaned
  return formatted
}

/**
 * Normaliza un número de teléfono para guardarlo en BD
 * Elimina formato y mantiene solo dígitos y el prefijo +
 * @param {string} phone - Número de teléfono formateado
 * @returns {string} - Número normalizado
 */
export const normalizePhoneNumber = (phone) => {
  if (!phone) return ''
  
  // Mantener el + inicial si existe, eliminar todo lo demás excepto dígitos
  if (phone.startsWith('+')) {
    return '+' + phone.substring(1).replace(/\D/g, '')
  }
  
  return phone.replace(/\D/g, '')
}
