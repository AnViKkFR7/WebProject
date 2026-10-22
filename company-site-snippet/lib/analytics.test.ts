import { describe, expect, it } from 'vitest'
import { keyForClick } from './analytics'

// Un "elemento" mínimo: solo lo que keyForClick usa (closest y getAttribute)
const el = (attrs: { track?: string; href?: string }) =>
  ({
    closest: (selector: string) => {
      if (selector === '[data-track-event]') {
        return attrs.track !== undefined ? { getAttribute: () => attrs.track } : null
      }
      if (selector === 'a[href]') {
        return attrs.href !== undefined ? { getAttribute: () => attrs.href } : null
      }
      return null
    },
  }) as unknown as Element

describe('analytics — qué clave corresponde a un clic', () => {
  it('un enlace de teléfono es phone_click, sin tocar el HTML', () => {
    expect(keyForClick(el({ href: 'tel:+34600112233' }))).toBe('phone_click')
  })

  it('un enlace de email es email_click', () => {
    expect(keyForClick(el({ href: 'mailto:hola@empresa.com' }))).toBe('email_click')
  })

  it('no distingue mayúsculas ni espacios al principio', () => {
    expect(keyForClick(el({ href: '  TEL:600112233' }))).toBe('phone_click')
    expect(keyForClick(el({ href: 'MAILTO:a@b.com' }))).toBe('email_click')
  })

  it('un enlace normal no cuenta', () => {
    expect(keyForClick(el({ href: 'https://empresa.com/servicios' }))).toBeNull()
    expect(keyForClick(el({ href: '/contacto' }))).toBeNull()
    expect(keyForClick(el({ href: '#arriba' }))).toBeNull()
  })

  it('data-track-event gana a tel: si el cliente puso su propia clave', () => {
    expect(keyForClick(el({ track: 'llamar_oficina', href: 'tel:600112233' }))).toBe('llamar_oficina')
  })

  it('data-track-event vale en cualquier elemento, no solo en enlaces', () => {
    expect(keyForClick(el({ track: 'whatsapp_click' }))).toBe('whatsapp_click')
  })

  it('un data-track-event vacío no cuenta, y se cae al enlace', () => {
    expect(keyForClick(el({ track: '', href: 'tel:600112233' }))).toBe('phone_click')
  })

  it('un clic fuera de todo no rompe', () => {
    expect(keyForClick(null)).toBeNull()
    expect(keyForClick(el({}))).toBeNull()
  })
})
