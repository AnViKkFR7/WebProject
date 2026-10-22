# DevelopmentBasics.md

> Léeme antes de tocar código en cualquier proyecto nuevo. Este documento no
> habla de colores ni de marca — eso lo define cada proyecto por su cuenta.
> Habla de cómo se debe **sentir** una web al usarla: distribución,
> transiciones, fluidez visual, fluidez de carga, y las prácticas de React
> que lo sostienen. Pégalo en la raíz de cada proyecto nuevo (o enlázalo
> desde el `CLAUDE.md` del proyecto) para que cualquier IA que trabaje en él
> arranque con estos criterios ya asumidos, no como algo que haya que
> recordarle cada vez.

---

## 0. Stack base

- **React 19 + Vite**, no Next.js ni CRA. SPA de cliente salvo que el
  proyecto pida explícitamente SSR/SSG. React 19 y no 18: `useOptimistic` y
  `use()` (§5) sólo existen a partir de la 19.
- **React Router** para las rutas.
- **Arquitectura de componentes reutilizables**: si un patrón visual se
  repite dos veces, es un componente, no una copia. Ver la estructura de
  carpetas en §7.
- **CSS Modules** por componente (`Componente.module.css` junto a
  `Componente.tsx`), con un fichero central de tokens (`tokens.css`) para
  color, tipografía, espaciado y movimiento — nunca valores mágicos sueltos
  en cada componente. Ver §4.
- **TypeScript en modo `strict`** salvo que el proyecto ya esté en JS.
- **Mobile-first, pero SIEMPRE responsive a tablet y escritorio**: se
  construye primero para móvil, y cada sección tiene que verse bien también
  en tablet y en PC de sobremesa antes de darla por terminada. Ver §4.

---

## 1. Setup inicial de cualquier proyecto nuevo

Antes de escribir la primera línea de UI, instala estas tres skills — dan
una base de criterio de diseño y animación que evita que la web se sienta
"hecha por una IA" o "una plantilla más":

```bash
# 1. Animación con criterio (Emil Kowalski) — elige curva, duración y
#    propiedades correctas en vez de "transition: all 0.3s" a ciegas.
#    Incluye también review-animations / improve-animations para auditar
#    lo ya construido, no sólo generar movimiento nuevo.
npx skills add https://github.com/emilkowalski/skills --skill animate

# 2. Impeccable (Pieter Bakaus) — 24 comandos + 61 reglas deterministas
#    contra los patrones "IA genérica" más comunes (degradados morado→azul,
#    fuentes por defecto, tarjetas todo-en-cajas). Cubre tipografía, color,
#    espaciado, estructura y motion.
npx impeccable install

# 3. Taste-skill (Leon) — infiere dirección de diseño a partir del brief
#    (palabras de tono, audiencia) antes de tocar código, para que el
#    resultado no se sienta plantillado.
npx skills add leonxlnx/taste-skill --agent claude-code
```

> Los comandos exactos pueden cambiar con nuevas versiones de estas
> herramientas — si alguno falla, busca el README del repo correspondiente
> antes de asumir que el comando de aquí sigue siendo el correcto.

Estas skills dan **criterio de diseño puntual** (qué curva usar, qué evitar).
El resto de este documento es sobre el **comportamiento** de la web como
sistema: cómo se mueve, cómo carga, cómo reacciona, cómo está construida.

---

## 2. Fluidez visual: acompañar, no distraer

La web debe sentirse como si **te acompañara** en el recorrido — el scroll
avanza y las cosas responden, sin que sea nunca la web quien lleve la
iniciativa. Dos fallos opuestos, igual de malos:

- **Estática/plantilla**: todo aparece de golpe, sin transición, sin
  jerarquía temporal. Se siente como un documento, no como una interfaz.
- **Excesivamente dinámica**: todo rebota, todo tiene parallax, todo entra
  con una animación distinta. Se siente ruidosa y, paradójicamente, más
  lenta — el usuario tiene que esperar a que "termine el espectáculo" antes
  de poder leer.

El objetivo es el punto intermedio: transiciones **pequeñas, coherentes y
con propósito**. Cada movimiento debe responder a una pregunta concreta
("¿qué elemento entra en pantalla?", "¿qué acaba de cambiar de estado?"),
nunca estar ahí "porque queda bien".

### Duraciones y curvas

- Duración corta por defecto. Ver la escala de tokens en §4 — la mayoría de
  transiciones de UI deben ser `--t-fast` (~220ms) o `--t-base` (~420ms).
  Reservar `--t-slow`/`--t-slower` para revelados de entrada de secciones
  grandes, nunca para hover/click. Las micro-interacciones (hover, focus,
  toggle) deben sentirse **instantáneas pero suavizadas**, no lentas.
- Curvas con salida suave (`--ease`, tipo ease-out), no lineales. Algo que
  arranca rápido y frena al llegar se siente intencional; algo que avanza a
  velocidad constante se siente mecánico.
- **Las salidas, más rápidas que las entradas** (~60-70% de la duración).
  Lo que entra se presenta; lo que sale sólo tiene que apartarse.
- Una única fuente de verdad para el movimiento — no mezclar varias
  librerías de animación en el mismo proyecto. CSS + los hooks de §3 cubren
  la gran mayoría de casos sin ninguna dependencia.

### Reglas de movimiento

- **Nada aparece desde cero**: nunca `scale(0)` ni desplazamientos de media
  pantalla. Entrar desde `scale(0.96)` o `translateY(16-32px)` + opacidad se
  percibe como aparición; desde cero se percibe como explosión.
- **Interrumpible**: para estados interactivos (hover, abierto/cerrado,
  activo) usar `transition`, no `@keyframes`. Una transición se reorienta si
  el usuario cambia de opinión a mitad; una animación de keyframes termina su
  recorrido o salta.
- **Escalonados cortos**: 40-80ms entre hermanos, y el conjunto entero no
  debería pasar de ~400ms. Con más de 6 elementos, escalonar por filas o
  grupos, no uno a uno — si no, el último tarda demasiado en llegar.
- **Sólo `transform` y `opacity`** (y `clip-path`/`filter` con moderación).
  Nunca animar `width`, `height`, `top`, `left`, `margin` o `padding`: obligan
  al navegador a recalcular el layout en cada fotograma.
- **El hover no mueve el layout**: nada de cambiar `font-weight`, `border`
  o `padding` al hover (provoca un salto de todo lo que hay alrededor). Usar
  `transform`, `opacity`, `color`, `box-shadow` o un pseudo-elemento.
- **Hover sólo donde hay puntero**: envolver los efectos de hover en
  `@media (hover: hover) and (pointer: fine)` y dar en táctil una
  alternativa real (el toque activa el mismo estado). Si una información
  sólo existe al hover, en móvil no existe.
- **El texto se lee al instante**: el contenido de la primera pantalla
  (titular, subtítulo, CTA) debe ser legible desde el primer pintado. Se
  puede animar su entrada (≤ 600ms), pero nunca esconderlo detrás de una
  espera ni de un `<Reveal>` (ver §3).
- **Nada de scroll-jacking**: no sustituir el scroll nativo por una
  librería de "smooth scroll" salvo petición explícita. Los efectos ligados
  al scroll (pin, zoom, parallax sutil) leen la posición del scroll, no la
  controlan. `scroll-behavior: smooth` sólo para anclas dentro de la misma
  página, nunca para cambios de ruta (ahí el salto arriba es instantáneo).
- **Alturas de pantalla completa con `dvh`, no `vh`/`svh`**: en móvil la
  barra de direcciones se oculta al hacer scroll y cambia el alto real del
  viewport — con `svh`/`vh` queda un hueco visible durante esa transición.
- **Efectos por fotograma fuera de React**: cualquier valor que cambia en
  cada frame de scroll (progreso de un pin, transform de un parallax) se
  escribe directamente en `element.style` dentro de un `requestAnimationFrame`
  — nunca en un `useState`, que re-renderizaría el componente 60 veces por
  segundo. Listeners de scroll/resize siempre `{ passive: true }`.
- **Un solo `requestAnimationFrame` / `IntersectionObserver` compartido**
  cuando haya muchas instancias del mismo efecto en pantalla (ver
  `useScrollReveal`, §3) — no un bucle ni un observer por componente.
- **`prefers-reduced-motion: reduce` en todo lo que anime**, sin excepción:
  desactivar la animación no esencial y mostrar el estado final directamente.

---

## 3. El componente `<Reveal>`

Todo proyecto nuevo debe incluir este componente (o su equivalente directo)
desde el primer commit. Es el mecanismo por defecto para que el contenido
entre en pantalla al hacer scroll, en vez de estar ya ahí de golpe al cargar
la página.

### Por qué existe

- Sin él, cada desarrollador (o cada sesión de IA) reinventa su propia
  transición de entrada, con timings y curvas ligeramente distintas — la web
  acaba sintiéndose incoherente sección a sección.
- Con él, "revelar algo al hacer scroll" es una decisión de una línea
  (`<Reveal variant="up">...</Reveal>`), no una nueva implementación cada
  vez.

### Variantes

- **`up`** (la que más se usa): ligada al scroll de forma continua y
  suavizada (LERP), no a una transición CSS de duración fija. El elemento
  sube ligeramente y se desvanece mientras entra, con una curva de salida
  suave — y es reversible sin lógica aparte: si subes, se deshace solo. Da
  la sensación de que la página "responde" al gesto de scroll en tiempo
  real, no que dispara una animación de reloj al cruzar un umbral.
- **`fade`**, **`left`**, **`right`**, **`clip`**: transición CSS de
  duración fija, disparada por `IntersectionObserver` al entrar en el
  viewport. Para casos donde no hace falta el ligado continuo al scroll (p.
  ej. una tarjeta que aparece una vez y ya está).

### Implementación de referencia (portable a cualquier proyecto React)

`hooks/useInView.ts` — detecta cuándo un elemento entra en el viewport:

```ts
import { useEffect, useRef, useState } from 'react'

interface Options {
  threshold?: number
  rootMargin?: string
  once?: boolean
}

export function useInView<T extends HTMLElement>({
  threshold = 0.15,
  rootMargin = '0px 0px -10% 0px',
  once = true,
}: Options = {}) {
  const ref = useRef<T | null>(null)
  const [inView, setInView] = useState(false)

  useEffect(() => {
    const el = ref.current
    if (!el) return
    if (typeof IntersectionObserver === 'undefined') {
      setInView(true)
      return
    }
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setInView(true)
          if (once) observer.disconnect()
        } else if (!once) {
          setInView(false)
        }
      },
      { threshold, rootMargin }
    )
    observer.observe(el)
    return () => observer.disconnect()
  }, [threshold, rootMargin, once])

  return { ref, inView }
}
```

`hooks/useScrollReveal.ts` — la variante `up`, ligada al scroll con un único
ticker compartido para toda la página (un solo `requestAnimationFrame` y un
solo `IntersectionObserver` para todos los `<Reveal variant="up">` de la
web, no uno por componente — con decenas de instancias en pantalla, un
bucle por componente multiplica el coste para hacer exactamente el mismo
trabajo):

```ts
import { useLayoutEffect, useRef } from 'react'

const START_VH = 1
const END_VH = 0.25
const LERP = 0.14
const OFFSET_RATIO = 0.45
const OFFSET_MIN = 28
const OFFSET_MAX = 110
const STAGGER_MS_FULL = 700
const STAGGER_MAX = 0.4
const OPACITY_BOOST = 1.25

interface Entry {
  el: HTMLElement
  stagger: number
  current: number
  target: number
  offset: number
  active: boolean
}

const entries = new Map<HTMLElement, Entry>()
let observer: IntersectionObserver | null = null
let frame = 0
let scrolled = true

const clamp01 = (v: number) => (v < 0 ? 0 : v > 1 ? 1 : v)
const easeOut = (p: number) => 1 - Math.pow(1 - p, 2)

function measure(e: Entry, vh: number) {
  const rect = e.el.getBoundingClientRect()
  e.offset = Math.min(Math.max(rect.height * OFFSET_RATIO, OFFSET_MIN), OFFSET_MAX)
  const raw = clamp01((START_VH * vh - rect.top) / ((START_VH - END_VH) * vh))
  e.target = clamp01((raw - e.stagger) / (1 - e.stagger))
}

function apply(e: Entry) {
  const p = easeOut(e.current)
  e.el.style.transform = `translate3d(0, ${((1 - p) * e.offset).toFixed(2)}px, 0)`
  e.el.style.opacity = String(Math.min(p * OPACITY_BOOST, 1))
}

function tick() {
  const vh = window.innerHeight
  const live: Entry[] = []
  for (const e of entries.values()) if (e.active) live.push(e)

  // Primero se mide todo y después se escribe todo: intercalar lecturas de
  // getBoundingClientRect() con escrituras de estilo fuerza un recálculo de
  // layout en cada vuelta del bucle.
  for (const e of live) measure(e, vh)

  let moving = false
  for (const e of live) {
    const d = e.target - e.current
    if (Math.abs(d) < 0.0005) {
      e.current = e.target
    } else {
      e.current += d * LERP
      moving = true
    }
    apply(e)
  }

  if (!moving && !scrolled) {
    frame = 0
    return
  }
  scrolled = false
  frame = requestAnimationFrame(tick)
}

function wake() {
  scrolled = true
  if (!frame) frame = requestAnimationFrame(tick)
}

function ensureObserver() {
  if (observer) return observer
  observer = new IntersectionObserver(
    (records) => {
      for (const r of records) {
        const e = entries.get(r.target as HTMLElement)
        if (e) e.active = r.isIntersecting
      }
      wake()
    },
    { rootMargin: '60% 0px 60% 0px' }
  )
  window.addEventListener('scroll', wake, { passive: true })
  window.addEventListener('resize', wake, { passive: true })
  return observer
}

function register(el: HTMLElement, delay: number) {
  const e: Entry = {
    el,
    stagger: Math.min(delay / STAGGER_MS_FULL, STAGGER_MAX),
    current: 0,
    target: 0,
    offset: OFFSET_MIN,
    active: true,
  }
  entries.set(el, e)
  measure(e, window.innerHeight)
  if (e.target >= 1) e.current = 1
  apply(e)
  ensureObserver().observe(el)
  wake()
}

function unregister(el: HTMLElement) {
  entries.delete(el)
  observer?.unobserve(el)
}

export function useScrollReveal<T extends HTMLElement>(delay = 0) {
  const ref = useRef<T | null>(null)

  useLayoutEffect(() => {
    const el = ref.current
    if (!el) return
    if (
      typeof IntersectionObserver === 'undefined' ||
      window.matchMedia('(prefers-reduced-motion: reduce)').matches
    ) {
      el.style.opacity = '1'
      el.style.transform = 'none'
      return
    }
    register(el, delay)
    return () => unregister(el)
  }, [delay])

  return ref
}
```

`components/ui/Reveal.tsx`:

```tsx
import type { ElementType, ReactNode } from 'react'
import { useInView } from '../../hooks/useInView'
import { useScrollReveal } from '../../hooks/useScrollReveal'
import styles from './Reveal.module.css'

type Variant = 'up' | 'fade' | 'left' | 'right' | 'clip'

interface RevealProps {
  children: ReactNode
  variant?: Variant
  /** Escalonado respecto a hermanos, en ms. En `up` se traduce en recorrido
   * de scroll (no un delay de reloj); en el resto, `transition-delay`. */
  delay?: number
  /** true (por defecto): se revela una vez. false: reversible al salir del
   * viewport. No aplica a `up`, que ya es reversible por sí solo. */
  once?: boolean
  as?: ElementType
  className?: string
}

// Dos componentes en vez de dos ramas dentro de uno: cada variante usa
// hooks distintos, y un hook llamado condicionalmente rompe las reglas de
// hooks. Mismo patrón para cualquier componente con "modos" que necesiten
// hooks diferentes.
export function Reveal({ variant = 'up', ...props }: RevealProps) {
  return variant === 'up' ? (
    <ScrollUpReveal {...props} />
  ) : (
    <TransitionReveal variant={variant} {...props} />
  )
}

function ScrollUpReveal({ children, delay = 0, as, className }: Omit<RevealProps, 'variant'>) {
  const Tag = (as ?? 'div') as ElementType
  const ref = useScrollReveal<HTMLDivElement>(delay)
  return (
    <Tag ref={ref} className={`${styles.reveal} ${styles.upScroll} ${className ?? ''}`}>
      {children}
    </Tag>
  )
}

function TransitionReveal({
  children,
  variant = 'fade',
  delay = 0,
  once = true,
  as,
  className,
}: RevealProps) {
  const Tag = (as ?? 'div') as ElementType
  const { ref, inView } = useInView<HTMLDivElement>({ once })
  return (
    <Tag
      ref={ref}
      className={`${styles.reveal} ${styles[variant]} ${inView ? styles.in : ''} ${className ?? ''}`}
      style={delay ? { transitionDelay: inView ? `${delay}ms` : '0ms' } : undefined}
    >
      {children}
    </Tag>
  )
}
```

`components/ui/Reveal.module.css`:

```css
.reveal {
  transition:
    opacity var(--t-slow) var(--ease),
    transform var(--t-slow) var(--ease),
    clip-path var(--t-slower) var(--ease);
  will-change: opacity, transform;
}

.upScroll {
  transition: none;
}

.fade { opacity: 0; }
.left { opacity: 0; transform: translateX(-32px); }
.right { opacity: 0; transform: translateX(32px); }
.clip { clip-path: inset(0 0 100% 0); }

.in.left, .in.right { opacity: 1; transform: none; }
.in.fade { opacity: 1; }
.in.clip { clip-path: inset(0 0 0 0); }

@media (prefers-reduced-motion: reduce) {
  .reveal {
    opacity: 1 !important;
    transform: none !important;
    clip-path: none !important;
  }
}
```

### Uso

```tsx
<Reveal variant="up">
  <h2>Título de sección</h2>
</Reveal>

<div className="grid">
  {items.map((item, i) => (
    <Reveal key={item.id} variant="up" delay={i * 80}>
      <Card {...item} />
    </Reveal>
  ))}
</div>
```

Para una rejilla de tarjetas, el `delay` escalonado (`i * 80`, ajustar el
multiplicador al gusto) es lo que hace que la rejilla "entre en escena" en
vez de aparecer en bloque — es uno de los detalles con más impacto en la
sensación de fluidez para el esfuerzo que cuesta.

### Cuándo NO usar `<Reveal>`

- **Nunca en la primera pantalla (above the fold)**: el contenido empieza
  invisible hasta que el JS lo revela — en el hero eso retrasa el LCP y se
  ve como un parpadeo de página vacía. La primera pantalla tiene su propia
  entrada (animación CSS corta al montar), no un revelado ligado al scroll.
- **No anidar `<Reveal>` dentro de `<Reveal>`**: los dos movimientos se
  suman y el hijo llega desplazado el doble.
- **No envolver cada párrafo suelto**: revelar por bloques con sentido
  (título + texto de una sección, una tarjeta), no línea a línea. Demasiados
  elementos moviéndose a la vez es exactamente la web "excesivamente
  dinámica" de §2.

---

## 4. Tokens y distribución

Un fichero central de tokens (`src/styles/tokens.css` o similar), nunca
valores sueltos repetidos por los componentes.

### Movimiento

```css
:root {
  --ease: cubic-bezier(0.16, 1, 0.3, 1);       /* salida suave, para la mayoría de transiciones */
  --ease-inout: cubic-bezier(0.65, 0, 0.35, 1); /* para animaciones que van y vuelven */
  --t-fast: 220ms;    /* hover, focus, toggles */
  --t-base: 420ms;    /* cambios de estado de UI */
  --t-slow: 720ms;    /* revelados de entrada */
  --t-slower: 1100ms; /* revelados grandes, heroes */
}
```

### Espaciado, tipografía y layout

```css
:root {
  /* Escala de 4px: todos los márgenes/paddings/gaps salen de aquí. */
  --sp-1: 0.25rem; --sp-2: 0.5rem;  --sp-3: 0.75rem; --sp-4: 1rem;
  --sp-6: 1.5rem;  --sp-8: 2rem;    --sp-12: 3rem;   --sp-16: 4rem;

  /* Ritmo vertical entre secciones, fluido: una sola variable para toda la web. */
  --section-y: clamp(4.5rem, 10vw, 9rem);

  /* Contenedor y márgenes laterales. */
  --container: 1320px;
  --container-narrow: 780px;
  --gutter: clamp(1.25rem, 4vw, 3rem);

  /* Tipografía fluida: clamp(mínimo, preferido en vw, máximo). */
  --fs-h1: clamp(2.25rem, 6vw, 4.25rem);
  --fs-h2: clamp(1.75rem, 4.2vw, 3rem);
  --fs-body: 1rem;
}
```

Reglas de distribución:

- **Un único ritmo vertical**: todas las secciones separadas por
  `--section-y`, no un padding distinto inventado en cada una. La
  coherencia del espaciado es lo que más contribuye a que una web se sienta
  "diseñada" y no montada.
- **Largo de línea legible**: párrafos con `max-width` de 45-75 caracteres
  (`max-width: 60ch`), incluso en pantallas anchas.
- **Tipografía fluida con `clamp()`**, no tamaños fijos por breakpoint: el
  texto escala de forma continua en vez de saltar de golpe al cruzar un
  `@media`.
- **Mobile-first, pero SIEMPRE responsive a tablet y escritorio**: el CSS
  base se escribe para móvil y la complejidad se añade con `min-width`
  (breakpoints de referencia: 480 / 768 / 1024 / 1280 / 1536). Mobile-first
  es el orden en que se construye, no una prioridad que deje las otras
  pantallas a medias: **ninguna sección se da por terminada hasta que se ha
  revisado en móvil (~375px), tablet (~768px y ~1024px, vertical y
  horizontal) y escritorio (≥1280px)**. En escritorio, el contenido no se
  estira sin límite (contenedor con `max-width`) ni se queda como una
  columna de móvil perdida en el centro: las rejillas ganan columnas y la
  composición aprovecha el ancho. En tablet, cuidar los casos intermedios
  (rejillas de 2 columnas, menú que cabe o no cabe, imágenes que no quedan
  ni demasiado altas ni recortadas). Nunca scroll horizontal en ningún
  ancho.
- **Una acción principal por pantalla**: un CTA destacado por sección
  visible, no tres botones compitiendo por la atención.

Los comandos de Impeccable (§1) auditan justo esto (escalas, jerarquía,
espaciado) — usarlos para revisar la escala en vez de darla por buena a ojo.

---

## 5. Los cuatro patrones de "psicología de la fluidez"

Referencia de código: `react-fluency-demos-master/src/demos/` (cuatro
carpetas: `anticipation`, `continuity`, `control`, `intention`). Antes de
implementar cualquiera de estos patrones en un proyecto nuevo, mirar la
carpeta correspondiente — son demos ejecutables con el contraste
"sin"/"con" lado a lado, más ilustrativo que cualquier resumen.

> Ojo al copiar de las demos: usan `key={i}` (el índice como key) en
> algunas listas. En código real, siempre un id estable (ver §7).

Los cuatro se apoyan en tres herramientas de React: **`useTransition`**
(React 18+: no bloquear ni vaciar la pantalla mientras algo se prepara),
**`useDeferredValue`** (React 18+: la versión de un solo estado de lo
mismo) y **`useOptimistic`** (React 19: reflejar la intención del usuario
antes de que el servidor confirme). No son animaciones — son **decisiones
de cuándo actualizar el estado**, y sin embargo son las que más pesan en si
una web "se siente lenta", más que cualquier spinner bien diseñado.

### Leer datos con Suspense: `use()` y promesas cacheadas

Las demos usan un patrón casero (`resource.read()`). En React 19 el
equivalente idiomático es `use(promise)`. La regla crítica en ambos casos:
**la promesa se crea fuera del render y se cachea por clave**. Si se crea
dentro del componente, cada render genera una promesa nueva, Suspense
vuelve a suspender, y entra en bucle.

```tsx
import { use } from 'react'

const cache = new Map<string, Promise<Article>>()
function getArticle(id: string) {
  if (!cache.has(id)) cache.set(id, fetchArticle(id))
  return cache.get(id)!
}

function ArticleDetail({ id }: { id: string }) {
  const article = use(getArticle(id)) // suspende hasta que resuelve
  return <h1>{article.title}</h1>
}
```

En proyectos con muchas peticiones, usar **TanStack Query** (con
`useSuspenseQuery`) en lugar de una caché a mano: da caché, reintentos,
invalidación y stale-while-revalidate (§6) sin reinventarlos.

### Anticipation — preparar el siguiente estado antes de mostrarlo

**Problema que resuelve**: al navegar a una vista nueva (siguiente
artículo, siguiente pestaña de detalle...), lo normal es que el contenido
actual desaparezca de golpe y aparezca un skeleton/spinner hasta que llega
lo nuevo. Se siente como una interrupción aunque la latencia real sea baja.

**Patrón**: envolver el contenido en un único `<Suspense>` que persiste
entre estados, y usar `startTransition` al cambiar de recurso en vez de
`setState` directo. React mantiene la vista anterior visible (con
`isPending` para atenuarla ligeramente) hasta que la nueva está lista —
nunca vacía la pantalla de por medio.

```tsx
const [articleId, setArticleId] = useState<string | null>(null)
const [isPending, startTransition] = useTransition()

function handleSelect(id: string) {
  startTransition(() => setArticleId(id)) // no setArticleId(id) a secas
}

return (
  <Suspense fallback={<Skeleton />}>
    <div style={{ opacity: isPending ? 0.6 : 1, transition: 'opacity 0.2s' }}>
      {articleId === null ? <List onSelect={handleSelect} /> : <ArticleDetail id={articleId} />}
    </div>
  </Suspense>
)
```

El `fallback` de `Suspense` sólo se ve en la carga inicial. En cada
transición posterior, lo que había en pantalla se queda hasta que lo nuevo
esté listo. La anticipación se lleva también a la red: precargar el
siguiente recurso cuando el usuario muestra intención (hover o focus sobre
el enlace) — ver §6.

### Continuity — no cortar el contexto visual entre estados

**Problema que resuelve**: cambiar de pestaña/filtro/tab y que el contenido
se desmonte al instante (`setItems(null)` seguido de un fetch) provoca un
parpadeo — un fotograma en blanco entre lo viejo y lo nuevo.

**Patrón**: el mismo `useTransition` de arriba, aplicado a cualquier cambio
de contenido dentro de la misma vista (tabs, filtros, paginación), no sólo a
la navegación entre pantallas. La regla general: **nunca desmontar
contenido visible como primer paso de una actualización** — desmontar es lo
último que pasa, no lo primero.

```tsx
function handleTabChange(nextTab: string) {
  setActiveTab(nextTab) // la pestaña activa cambia ya (feedback inmediato)
  startTransition(() => setContentTab(nextTab)) // el contenido, cuando esté listo
}
```

### Control — que la interacción del usuario nunca espere al trabajo pesado

**Problema que resuelve**: un input de búsqueda/filtro sobre una lista larga
se nota "congelado" al escribir, porque cada tecla dispara un render caro
de toda la lista antes de que el navegador pueda pintar el carácter nuevo.

**Patrón**: separar lo **urgente** (lo que ve el usuario al teclear, se
actualiza siempre al instante) de lo **diferido** (lo que alimenta el
cálculo caro), con `memo()` en el componente caro para que la actualización
urgente no lo re-renderice de más. La forma más simple es `useDeferredValue`:

```tsx
const SlowList = memo(function SlowList({ query }: { query: string }) {
  return filter(query).map((item) => <Row key={item.id} item={item} />)
})

function Search() {
  const [query, setQuery] = useState('')
  const deferredQuery = useDeferredValue(query)
  const isStale = query !== deferredQuery

  return (
    <>
      <input value={query} onChange={(e) => setQuery(e.target.value)} />
      <div style={{ opacity: isStale ? 0.5 : 1 }}>
        <SlowList query={deferredQuery} />
      </div>
    </>
  )
}
```

La demo usa dos `useState` + `startTransition`, que es equivalente y útil
cuando el valor diferido viene de otro sitio que no sea un único estado.
La entrada de texto nunca debe sentirse bloqueada por trabajo de
renderizado pesado, sea cual sea el tamaño de la lista.

### Intention — reflejar la acción del usuario antes de que el servidor confirme

**Problema que resuelve**: dar like, enviar un comentario, marcar algo como
hecho — si la UI espera la respuesta del servidor para reaccionar, cada
acción se siente con retardo, aunque sea de medio segundo.

**Patrón**: `useOptimistic` (React 19) refleja el cambio de inmediato con
un reducer puro. El valor optimista sólo vive mientras dura la transición:
si el servidor confirma, se actualiza el estado real; si falla, el estado
real no cambia y la UI vuelve sola a lo que había.

```tsx
const [likes, setLikes] = useState<Record<string, boolean>>({})
const [optimisticLikes, addOptimisticLike] = useOptimistic(
  likes,
  (state, { id, liked }: { id: string; liked: boolean }) => ({ ...state, [id]: liked })
)
const [, startTransition] = useTransition()

function toggleLike(id: string) {
  const liked = !optimisticLikes[id]
  startTransition(async () => {
    addOptimisticLike({ id, liked }) // instantáneo
    try {
      await likeOnServer(id, liked) // en segundo plano
      setLikes((prev) => ({ ...prev, [id]: liked })) // confirma el estado real
    } catch {
      showToast('No se ha podido guardar') // el revertido visual lo hace React
    }
  })
}
```

Reservar `useOptimistic` para acciones donde el servidor casi nunca falla
(likes, comentarios, marcar como leído) y **avisar siempre si falla** — un
revertido silencioso es peor que esperar. Para envíos importantes
(formularios de contacto, pagos) no usar optimismo: estado de carga claro,
botón deshabilitado y confirmación real.

---

## 6. Fluidez de carga

La percepción de velocidad se decide en los primeros segundos y en cada
espera posterior. Objetivos medibles (Core Web Vitals, medir con Lighthouse
y PageSpeed Insights en móvil, no sólo en escritorio):

| Métrica | Qué mide | Objetivo |
|---|---|---|
| **LCP** | Cuándo se pinta el elemento principal | < 2,5 s |
| **INP** | Cuánto tarda la página en responder a una interacción | < 200 ms |
| **CLS** | Cuánto "salta" el layout mientras carga | < 0,1 |

### El elemento LCP (normalmente la imagen del hero)

- Debe ser un **`<img>` real en el HTML**, no un `background-image` puesto
  por JavaScript: el navegador no lo descubre hasta que el JS se ejecuta, y
  llega tarde siempre, se haga lo que se haga después.
- `fetchpriority="high"` y **nunca** `loading="lazy"` en ella.
- Si viene de una ruta dinámica, precargarla en `index.html`
  (`<link rel="preload" as="image" href="..." fetchpriority="high">`).
- Nada de animaciones de entrada que la oculten (`opacity: 0` inicial) — ver
  "Cuándo NO usar `<Reveal>`", §3.

### Sin saltos de layout (CLS)

- **Todas las imágenes y vídeos con `width`/`height`** (o `aspect-ratio` en
  CSS): el navegador reserva el hueco antes de que lleguen.
- **Los skeletons miden lo mismo que el contenido final**. Un skeleton de
  otra altura sólo cambia el salto de sitio.
- Reservar el espacio de todo lo que llega asíncrono (banners, avisos de
  cookies como overlay, no empujando el contenido).
- **Fuentes**: `font-display: swap`, `preconnect` al dominio de las fuentes,
  `preload` de la fuente del titular (la que se ve en la primera pantalla),
  y una fuente de reserva con métricas ajustadas (`size-adjust`,
  `ascent-override` — herramientas como `fontaine` o Capsize las calculan)
  para que el cambio de fuente no mueva el texto.

### Imágenes

- Formato moderno (`.webp`/`.avif`) y **dimensionadas al tamaño real en el
  que se muestran** (con margen para pantallas 2×): una foto de 1.900px para
  una tarjeta de 400px desperdicia la mayoría de lo que se descarga.
- `srcset` + `sizes` para servir tamaños distintos a móvil y escritorio.
- Todo lo que está por debajo de la primera pantalla: `loading="lazy"` y
  `decoding="async"`.
- **Presupuesto orientativo**: fotos de contenido < 200 KB, imagen del hero
  < 300 KB. Comprobar el peso real en la pestaña Network de DevTools, no el
  del archivo de origen.
- `alt` descriptivo siempre, salvo imágenes puramente decorativas
  (`alt=""`).

### JavaScript: menos, y en el momento justo

- **Code-splitting por ruta** con `lazy()` + `<Suspense>`: la portada no
  debe descargar el código de todas las páginas.

  ```tsx
  // lazy() espera un export default; con exports con nombre:
  const ServicesPage = lazy(() =>
    import('./pages/ServicesPage').then((m) => ({ default: m.ServicesPage }))
  )
  ```

- **Precargar por intención** (Anticipation aplicada a la red): cuando el
  usuario pasa el ratón o enfoca un enlace, descargar ya el chunk de esa
  ruta y sus datos. Entre el hover y el clic suelen pasar 200-400ms — a
  menudo suficiente para que la página siguiente ya esté lista al llegar.

  ```tsx
  const preloadServices = () => import('./pages/ServicesPage')
  <Link to="/servicios" onMouseEnter={preloadServices} onFocus={preloadServices}>
  ```

- **Navegación sin pantalla en blanco**: el cambio de ruta debe mantener la
  página anterior visible mientras carga la siguiente (Continuity, §5), no
  mostrar un spinner a pantalla completa. Comprobar que la navegación va
  dentro de una transición (React Router v7 lo hace por defecto; si no,
  envolver el `navigate()` en `startTransition`).
- **Vigilar el tamaño del bundle**: si Vite avisa de chunks > 500 KB, no
  ignorarlo — dividir con `lazy()` o `build.rollupOptions.output.manualChunks`
  antes de añadir más dependencias. Antes de instalar una librería, mirar
  cuánto pesa (bundlephobia) y si hace falta de verdad.
- Scripts de terceros (analítica, chat, mapas) siempre `async`/diferidos y,
  si se puede, cargados tras la interacción o el consentimiento, nunca
  bloqueando el primer pintado.

### Datos: caché y esperas

- **Stale-while-revalidate**: al volver a una vista ya visitada, mostrar al
  instante los datos que ya había y refrescar en segundo plano. Volver
  atrás nunca debería mostrar un skeleton de algo que ya se vio (TanStack
  Query lo hace por defecto).
- **Indicadores de carga con retardo**: no mostrar spinner/skeleton en
  esperas de menos de ~300ms (sólo produce un parpadeo). Y si se muestra,
  mantenerlo un mínimo de ~400ms para que no destelle.

  ```ts
  function useDelayedFlag(active: boolean, delay = 300) {
    const [show, setShow] = useState(false)
    useEffect(() => {
      if (!active) { setShow(false); return }
      const t = setTimeout(() => setShow(true), delay)
      return () => clearTimeout(t)
    }, [active, delay])
    return show
  }
  ```

- **Timeout en todas las peticiones de red**: una petición que se cuelga es
  peor que una que falla — el usuario ve un spinner eterno sin saber qué
  pasa. En el cliente, `AbortSignal.timeout()`; en funciones serverless,
  además un `Promise.race` con un temporizador, porque el abort no siempre
  corta una conexión que no responde.

  ```ts
  export async function fetchJSON<T>(url: string, init: RequestInit = {}, ms = 8000): Promise<T> {
    const res = await fetch(url, { ...init, signal: AbortSignal.timeout(ms) })
    if (!res.ok) throw new Error(`${res.status} ${res.statusText}`)
    return res.json() as Promise<T>
  }
  ```

- **Medios pesados** (secuencias de imágenes, vídeo de fondo): primero un
  póster ligero que se pinta al instante; el resto se descarga en segundo
  plano, en paralelo y en un orden que dé cobertura útil cuanto antes (p.
  ej. primero y último fotograma, luego los intermedios), nunca en serie de
  principio a fin. Y con variantes distintas para móvil y escritorio.

---

## 7. Arquitectura y buenas prácticas de React

### Estructura de carpetas

```
src/
  components/
    ui/         # genéricos, sin conocimiento del negocio: Button, Reveal, Modal, PageHero
    layout/     # Header, Footer, Layout, meta/SEO, aviso de cookies
    sections/   # bloques de página reutilizables: Hero, CtaBand, grids de servicios
  pages/        # una por ruta; componen secciones, casi sin lógica propia
  hooks/        # useInView, useScrollReveal, usePinProgress, useDelayedFlag...
  lib/          # clientes (supabase...), helpers de fetch, utilidades puras
  context/      # sólo estado global de baja frecuencia (modal abierto, idioma)
  styles/       # tokens.css, global.css
  types/
  i18n/         # si es multilingüe
```

Regla de dependencia: `ui/` no importa de `sections/` ni de `pages/`;
`sections/` puede usar `ui/`; `pages/` compone todo. Si un componente de
`ui/` necesita conocer datos del negocio, no es de `ui/`.

**Proyectos grandes: organizar por feature.** Cuando la web tiene varias
áreas con lógica propia (auth, reservas, panel, carrito...), agrupar por
área en vez de por tipo de archivo. Una web corporativa sencilla no lo
necesita; no complicarla por adelantado.

```
src/features/auth/
  components/   # LoginForm...
  hooks/        # useAuth...
  services/     # authService.ts (llamadas a la API, ver "Capa de servicios")
  types.ts
  index.ts      # la única puerta de entrada de la feature
```

**Barrel exports (`index.ts`) como frontera pública**: cada feature (y cada
carpeta de `components/ui` con varios archivos) expone en su `index.ts`
solo lo que el resto de la app necesita ver. Lo demás es privado.

```ts
// features/auth/index.ts
export { LoginForm } from './components/LoginForm'
export { useAuth } from './hooks/useAuth'
```

- Desde fuera se importa siempre de la feature (`from '@/features/auth'`),
  nunca de sus archivos internos (`.../auth/components/LoginForm`). Así se
  puede reorganizar el interior sin tocar al resto.
- Una feature no importa de los archivos internos de otra; sólo de su
  `index.ts`.
- Cuidado con los barrels gigantes en rutas con `lazy()`: si un `index.ts`
  reexporta toda la feature, importarlo arrastra todo al mismo chunk. Para
  una página con `lazy()` se importa su archivo directamente, y `lazy()`
  espera un export `default` (o el wrapper con `.then` de §6).
- Alias de importación (`@/` → `src/`) configurado en `vite.config` y
  `tsconfig`, para no escribir `../../../`.

**Nada de números mágicos ni cadenas sueltas**: rutas, roles, claves de
almacenamiento, límites y breakpoints en JS viven en constantes
declarativas, en un único sitio.

```ts
// lib/constants.ts
export const ROUTES = {
  HOME: '/',
  SERVICES: '/servicios',
  CONTACT: '/contacto',
} as const
export const MAX_UPLOAD_MB = 5
```

Así un cambio de URL es un cambio de una línea, y el compilador avisa de
los usos rotos en vez de dejar un enlace muerto.

### Componentes

- **Un componente por archivo**, con export con nombre, y su
  `.module.css` al lado.
- **Pequeños y con una responsabilidad**. Si un componente pasa de ~150
  líneas o mezcla obtener datos con pintarlos, dividirlo.
- **Composición antes que configuración**: preferir `children` y
  subcomponentes a una lista creciente de props booleanas
  (`showIcon`, `isCompact`, `hasBorder`...). Tres booleanos son ocho
  combinaciones que nadie ha probado.
- **Props tipadas** y con valores por defecto en la desestructuración.
- **No sobre-abstraer por adelantado**: un patrón usado dos veces es un
  componente; "podría hacer falta en el futuro" no es motivo para
  construirlo ya.
- **Estilos con CSS Modules y tokens**; `style` en línea sólo para valores
  que cambian en tiempo de ejecución (un progreso, una imagen de fondo
  dinámica, un delay calculado).

### Responsabilidad única: lógica en hooks, UI en componentes

Un componente hace una sola cosa. Si maneja a la vez la UI, el estado del
formulario, la petición HTTP y el formateo de datos, se divide:

- **Componentes de presentación**: reciben props y pintan. Fáciles de
  reutilizar y de revisar visualmente.
- **Custom hooks**: sacan del archivo visual el `useEffect`, los estados y
  la lógica pesada. Se pueden probar y reutilizar sin tocar la UI.

```tsx
// ❌ Componente saturado: UI + petición + estado, sin error ni cancelación
export function UserProfile() {
  const [user, setUser] = useState<User | null>(null)
  useEffect(() => {
    fetch('/api/user').then((r) => r.json()).then(setUser)
  }, [])
  if (!user) return <p>Cargando...</p>
  return <div>{user.name} - {user.email}</div>
}

// ✅ hooks/useUser.ts — lógica aislada, con error y cancelación
export function useUser() {
  const [user, setUser] = useState<User | null>(null)
  const [error, setError] = useState<Error | null>(null)

  useEffect(() => {
    const ctrl = new AbortController()
    userService.getCurrent(ctrl.signal).then(setUser).catch((e) => {
      if (e.name !== 'AbortError') setError(e)
    })
    return () => ctrl.abort()
  }, [])

  return { user, error, isLoading: !user && !error }
}

// ✅ UserProfile.tsx — UI limpia
export function UserProfile() {
  const { user, error, isLoading } = useUser()
  if (isLoading) return <Skeleton />
  if (error) return <ErrorState />
  return <div>{user?.name} - {user?.email}</div>
}
```

(En proyectos con muchas peticiones, este hook lo sustituye TanStack Query,
§5/§6; el principio de separar lógica y UI es el mismo.)

### Sintaxis y hábitos del día a día

- **Valores por defecto en la desestructuración** de las props:
  `function Card({ variant = 'default', size = 'md' }: CardProps)`.
- **Booleanos en forma corta**: `<Input disabled />`, no
  `<Input disabled={true} />`.
- **Manejadores definidos fuera del JSX** cuando tengan más de una línea o
  se pasen a un hijo con `memo`: `const handleSave = () => {...}` y
  `onClick={handleSave}`. Una función anónima de una línea
  (`onClick={() => setOpen(true)}`) en un elemento normal es aceptable: el
  coste sólo importa si el hijo está memoizado y se re-renderizaría por
  ello. No optimizar lo que no duele.
- **Inmutabilidad estricta**: nunca mutar el estado (`state.push(item)`,
  `user.name = '...'`). Siempre copias: `setItems((prev) => [...prev, item])`,
  `setUser((u) => ({ ...u, name }))`. Una mutación no dispara el render y
  produce bugs que sólo aparecen a veces.
- **Actualizaciones que dependen del valor anterior** con la forma
  funcional (`setCount((c) => c + 1)`), no con el valor capturado.
- **Early return** para los casos especiales (cargando, error, vacío) antes
  del JSX principal, en vez de ternarios anidados.

### Estado y efectos

- **Estado lo más local posible**; subirlo sólo cuando dos componentes lo
  necesitan de verdad.
- **Derivar en vez de duplicar**: si un valor se puede calcular a partir
  del estado o las props, se calcula en el render — no se guarda en otro
  `useState` que haya que mantener sincronizado.
- **`useEffect` sólo para sincronizar con algo externo** (DOM, suscripciones,
  red, timers). No para calcular datos derivados ni para reaccionar a un
  evento del usuario — eso va en el propio manejador del evento.
- **Todo efecto limpia lo que crea**: listeners, observers, timers,
  `requestAnimationFrame`, peticiones (`AbortController`).
- **Context sólo para valores de baja frecuencia** (idioma, sesión, modal
  abierto). Nunca para valores que cambian en cada scroll o tecla: cada
  cambio re-renderiza a todos los consumidores.
- **Hooks siempre en el mismo orden**: nunca dentro de un `if`. Si un
  componente tiene modos que necesitan hooks distintos, separarlo en dos
  componentes (como `Reveal`, §3).
- **`key` estables** (el id del dato), nunca el índice en listas que se
  reordenan, filtran o insertan.
- **`memo`/`useMemo`/`useCallback` sólo cuando hay un coste medido** (como
  la lista de Control, §5) — no por defecto en todos los componentes. Si el
  proyecto usa React Compiler, no hace falta ponerlos a mano.

### Qué herramienta para qué estado

Dividir el estado por proximidad y por tipo; usar lo más simple que sirva:

| Tipo de estado | Cuándo | Herramienta |
|---|---|---|
| **Local** | UI, pestañas, modal abierto, valores de formulario | `useState` / `useReducer` |
| **Global de UI** | Tema, idioma, avisos del sistema (cambian poco) | Context API |
| **Del servidor** | Caché de datos de la API, sincronización con el backend | TanStack Query |
| **Global complejo** | Carrito, flujos de varios pasos con mucha lógica | Zustand o Redux Toolkit |

No guardar datos del servidor en `useState` + `useEffect` a mano cuando hay
varias pantallas que los comparten: es justo lo que resuelve TanStack Query
(caché, reintentos, estado de carga/error). Y no subir a un store global lo
que puede vivir en un componente.

### Capa de servicios de API

Nunca `fetch`/`axios` directo dentro de un componente o hook sin
abstracción. Un cliente HTTP único (con la URL base, el timeout y el
manejo de errores de §6) y un servicio por dominio:

```ts
// lib/apiClient.ts  (el fetchJSON de §6, o axios.create({ baseURL: '/api' }))
// features/auth/services/authService.ts
import { apiClient } from '@/lib/apiClient'

export const authService = {
  login: (credentials: LoginCredentials) =>
    apiClient.post<Session>('/auth/login', credentials),
}
```

Los componentes y hooks llaman a `authService.login(...)`, no saben qué
URL, cabeceras ni librería hay debajo. Cambiar de backend o de librería es
tocar un archivo, y los tests pueden sustituir el servicio entero.

### Estados de toda vista asíncrona

Cualquier componente que dependa de datos remotos tiene que contemplar
**cuatro** estados, no uno: cargando, error, vacío y con datos. El estado de
error ofrece siempre una salida (reintentar, o un contacto alternativo). El
vacío explica qué pasa, no es un hueco en blanco.

- **Error boundary por ruta**: un fallo en una sección no debe tumbar toda
  la web.
- **Ruta 404** (`path="*"`) con una página propia — en una SPA, sin ella
  cualquier URL mal escrita muestra una página en blanco.

### Accesibilidad (también es fluidez: una web que no se puede usar con teclado no es fluida para nadie que lo necesite)

- **HTML semántico**: `<button>` para acciones, `<a>`/`<Link>` para
  navegación. Nunca `onClick` en un `<div>`, `<span>` o `<article>` — no se
  pueden enfocar con teclado. Si una tarjeta entera es clicable, la tarjeta
  entera es un enlace o un botón.
- **Foco visible**: estilos para `:focus-visible` en todo lo interactivo;
  nunca `outline: none` sin sustituto.
- `aria-expanded` en lo que abre/cierra, `aria-label` en botones de sólo
  icono, `lang` correcto en el `<html>`.
- Contraste de texto suficiente sobre imágenes (una capa oscura o degradado
  debajo del texto, no confiar en que la foto sea oscura).

### Configuración y seguridad

- **Las variables `VITE_*` son públicas**: acaban dentro del bundle que se
  descarga cualquiera. Ningún secreto (claves de servicio, API keys
  privadas) lleva ese prefijo; lo que necesita un secreto se ejecuta en una
  función de servidor (edge/serverless), nunca en el cliente.
- Validar siempre en el servidor lo que llega de un formulario, aunque el
  cliente ya valide. Escapar cualquier texto del usuario que se inserte en
  HTML (emails, plantillas).

### SPA en producción

- **Rewrite de SPA** en el hosting (en Vercel, `vercel.json` con
  `{ "source": "/(.*)", "destination": "/index.html" }`): sin él, entrar
  directamente a `/servicios` o recargar la página da 404.
- **`<title>` y meta description por ruta**, no los mismos en toda la web,
  y un idioma por defecto fijo (no detectado del navegador) si la web es
  multilingüe con una sola URL por página.

### Calidad antes de dar algo por terminado

- `tsc` y el build (`npm run build`) limpios, sin warnings ignorados.
- **Probar en el navegador de verdad**: la interacción real (hover, foco,
  teclado, scroll), en móvil, tablet y escritorio, con `prefers-reduced-motion`
  activado al menos una vez. Leer el código y asumir que se ve bien no
  cuenta como verificado.
- Lighthouse en móvil sobre la build de producción, no sobre el servidor
  de desarrollo.
- **Comentarios en el código**: sólo cuando expliquen un "por qué" no obvio
  (una decisión, una restricción, un bug evitado) — nunca describir lo que
  el código ya dice por sí solo.

---

## 8. Checklist rápida al arrancar un proyecto nuevo

**Setup**
- [ ] React 19 + Vite + TypeScript strict + React Router
- [ ] `npx skills add https://github.com/emilkowalski/skills --skill animate`
- [ ] `npx impeccable install`
- [ ] `npx skills add leonxlnx/taste-skill --agent claude-code`
- [ ] Estructura de carpetas de §7
- [ ] `tokens.css` con movimiento, espaciado, contenedor y tipografía fluida (§4)
- [ ] `<Reveal>` + `useInView` + `useScrollReveal` copiados de §3
- [ ] `fetchJSON` con timeout y `useDelayedFlag` (§6)
- [ ] Rutas con `lazy()`, error boundary, ruta 404 y rewrite de SPA en el hosting

**Por cada pantalla/sección**
- [ ] La primera pantalla se lee al instante; nada de `<Reveal>` en ella
- [ ] La imagen LCP es un `<img>` con `fetchpriority="high"`, sin lazy
- [ ] Todas las imágenes con dimensiones, formato moderno y peso razonable
- [ ] Cada interacción con espera usa el patrón de §5 que le toca
      (navegación → Anticipation; tabs/filtros → Continuity; input sobre
      algo caro → Control; acción rápida del usuario → Intention)
- [ ] Estados de carga / error / vacío contemplados
- [ ] Hover con alternativa táctil; foco visible; elementos clicables son
      `<button>` o `<a>`
- [ ] `prefers-reduced-motion` cubierto en cualquier animación nueva

**Antes de entregar**
- [ ] Build limpio, sin chunks > 500 KB sin justificar
- [ ] Lighthouse móvil: LCP < 2,5 s, CLS < 0,1, INP < 200 ms
- [ ] Probado en el navegador en móvil (~375px), tablet (768 y 1024px) y
      escritorio (≥1280px), sin scroll horizontal en ninguno
