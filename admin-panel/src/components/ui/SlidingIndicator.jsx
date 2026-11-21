import { useLayoutEffect, useRef } from 'react'

/**
 * Píldora que se desliza hasta el elemento activo de su contenedor (menú, pestañas, filtros).
 * Se coloca como hijo del contenedor; el contenedor necesita `position: relative`.
 * Mientras no puede medirse (pruebas, sin JS, elemento oculto) no marca el contenedor y cada
 * elemento activo conserva su propio fondo, así que nunca se pierde la indicación.
 */
function place(indicator, selector, target) {
  const container = indicator.parentElement
  if (!container) return
  const active = target || container.querySelector(selector)
  const rect = active?.getBoundingClientRect()
  if (!rect || rect.width === 0 || rect.height === 0) {
    indicator.style.opacity = '0'
    delete container.dataset.indicator
    indicator.dataset.visible = ''
    return
  }
  const box = container.getBoundingClientRect()
  const x = rect.left - box.left + container.scrollLeft - container.clientLeft
  const y = rect.top - box.top + container.scrollTop - container.clientTop
  const wasVisible = indicator.dataset.visible === '1'
  // Al aparecer se coloca sin recorrido (solo funde); después se desliza.
  if (!wasVisible) indicator.style.transition = 'opacity 200ms ease'
  indicator.style.width = `${rect.width}px`
  indicator.style.height = `${rect.height}px`
  indicator.style.transform = `translate3d(${x}px, ${y}px, 0)`
  indicator.style.opacity = '1'
  if (!wasVisible) {
    void indicator.offsetWidth
    indicator.style.transition = ''
    indicator.dataset.visible = '1'
  }
  container.dataset.indicator = 'ready'
}

export default function SlidingIndicator({ activeSelector, itemSelector, className = '' }) {
  const ref = useRef(null)

  // En cada render: la ruta o la opción activa pueden haber cambiado.
  useLayoutEffect(() => {
    if (ref.current) place(ref.current, activeSelector)
  })

  // Cambios de tamaño (menú plegado, fuentes, ventana) sin nuevo render.
  useLayoutEffect(() => {
    const indicator = ref.current
    const container = indicator?.parentElement
    if (!container || typeof ResizeObserver === 'undefined') return undefined
    let frame = 0
    const schedule = () => {
      cancelAnimationFrame(frame)
      frame = requestAnimationFrame(() => place(indicator, activeSelector))
    }
    const observer = new ResizeObserver(schedule)
    observer.observe(container)
    Array.from(container.children).forEach(child => { if (child !== indicator) observer.observe(child) })
    // Con páginas que cargan en diferido la ruta activa cambia al terminar la carga: la píldora
    // sale en el mismo clic para que el menú responda al instante.
    const onClick = event => {
      if (!itemSelector || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return
      const item = event.target.closest?.(itemSelector)
      if (item && container.contains(item)) place(indicator, activeSelector, item)
    }
    container.addEventListener('click', onClick)
    return () => {
      cancelAnimationFrame(frame)
      observer.disconnect()
      container.removeEventListener('click', onClick)
      delete container.dataset.indicator
    }
  }, [activeSelector, itemSelector])

  return <span ref={ref} className={`slide-indicator ${className}`.trim()} aria-hidden="true" />
}
