# Playbook de proyecto web «como Dios manda»

> **Para Claude:** este documento se copia tal cual en cada proyecto. Cuando el usuario pida el
> **roadmap** (o el plan de implementación) de un proyecto, léelo entero y úsalo como lista de
> comprobación: **todo lo que aplique al proyecto entra en el plan**, en su fase, y marcado como
> **MVP** o **versión final**. Lo que no aplique, dilo en una línea («no aplica: no hay pagos»).
> Si algo no está claro si es MVP o final, **pregunta** antes de planificarlo.
> Salió de un proyecto real (reservas con pagos, panel de administración, SEO y analítica);
> cada punto existe porque hizo falta o porque su ausencia dio problemas.

---

## 0. Cómo trabajar (reglas que valen para todo el proyecto)

1. **Documentación viva, no al final.** Desde el primer día:
   - `Features.md`: qué hace la web y las **decisiones** (tabla D1, D2… con el porqué). Se
     actualiza **en cada petición** que cambie algo, marcando el cambio con `[Pn]` (número de
     petición) y una entrada en el **Changelog**.
   - `roadmap-mvp.md` y `roadmap-final-version.md` con casillas `[ ]`/`[x]`.
   - `CLAUDE.md` corto: reglas de trabajo, decisiones fijas, convenciones y comandos.
   - Un documento de la base de datos (funciones, triggers, políticas, flujos con el orden de
     las llamadas) si hay backend propio.
   - Documentos por tema cuando crecen: `docs/entornos.md`, `docs/testing.md`,
     `docs/emails.md`, `docs/design-system.md`, `docs/seo-plan.md`, `docs/setup-servicios-externos.md`.
2. **Clasificar antes de construir:** cada funcionalidad es MVP o versión final. Si no está
   clasificada, se pregunta.
3. **Cada bug arreglado deja un test** que habría fallado antes del arreglo.
4. **La lógica de negocio en funciones puras** (sin red ni React) con tests unitarios; si la
   usan front y backend, en una carpeta compartida sin dependencias.
5. **Nada de cálculos sensibles en el navegador** (precios, permisos, importes): el servidor
   calcula y vuelve a calcular antes de cobrar.
6. **Migraciones**: nunca editar una ya aplicada en un entorno compartido; siempre una nueva,
   con sus tests. Nunca a mano en producción: por CLI o por CI.
7. **Secretos**: nunca en el repo ni en el chat; `.env.example` documentado; el usuario pone
   las claves.
8. **Preguntar solo lo que bloquea**; lo demás, decidir con criterio y decirlo.
9. **Verificar antes de decir «hecho»**: tests, tipos, lint, formato, build y, si es visual,
   mirarlo en el navegador (escritorio y móvil).

## 1. Fase 0 · Descubrimiento y decisiones

- [ ] Qué vende/hace la web, para quién, en qué zona, en qué **idiomas** (una URL por idioma).
- [ ] **Roles** (anónimo, cliente, staff, admin…) y qué puede hacer cada uno. ¿Se puede
      comprar/usar **sin cuenta**? (suele convertir mucho mejor).
- [ ] Decisiones de negocio fijas (plazos mínimos, políticas de cancelación y reembolso,
      zona de servicio, impuestos, facturación).
- [ ] Marca, dominio, email de la empresa, datos legales del titular (nombre, NIF, dirección,
      registro o «autónomo», autorizaciones administrativas si la actividad las exige).
- [ ] Servicios externos y su coste (pagos, emails, mapas, analítica, errores, anti-spam, hosting).
- [ ] Un único **CTA principal** por página (y cuál es el de la portada).

## 2. Arquitectura base

- [ ] Front con **rutas con carga diferida**, i18n con textos en ficheros (nunca en el código),
      constantes de rutas y helper de rutas por idioma.
- [ ] Backend con **seguridad a nivel de fila** (RLS) y permisos explícitos en cada tabla;
      columnas sensibles fuera del alcance del cliente (permisos por columna si hace falta).
- [ ] Funciones de servidor para lo que no puede hacer el cliente (pagos, emails, cálculos).
- [ ] Tareas programadas (caducar pendientes, reintentos, resúmenes de analítica).
- [ ] **Entornos separados** dev y prod (BD, hosting, claves, webhooks) y ramas
      `feature/* → develop (dev) → main (prod)`.
- [ ] Carpeta de código compartido front/backend sin dependencias, con sus tests.

## 3. Código, diseño y componentes

- [ ] **Tokens de diseño semánticos** (colores, espacios, tipografía, radios, sombras, tiempos)
      y modo de contraste; nada de colores sueltos.
- [ ] `components/ui` sin lógica de negocio ni textos (todo por props); `features/*` con un
      `index.ts` como frontera; `pages/` finas.
- [ ] **Catálogo vivo** de componentes (`/_ds`, solo en dev) con captura visual en los tests.
- [ ] Herramientas de dev (modo test con dobles de los servicios externos, galería de emails)
      detrás de una **constante de compilación** que las elimina en producción.
- [ ] Animaciones de entrada nunca en la primera pantalla; respetar `prefers-reduced-motion`.
- [ ] Botones sobre fotos oscuras: **claros con texto oscuro**; sobre fondo claro, oscuros.
- [ ] Sin franjas vacías antes del pie; una foto final se funde con el pie.
- [ ] Formularios: validación con esquemas compartidos cliente/servidor, mensajes por campo,
      **al enviar con errores, scroll y foco al primer campo inválido**.

## 4. Seguridad

- [ ] Auditoría de **secretos en el bundle** (solo claves públicas por diseño) y en el
      historial de git; prefijos de variables públicas explícitos (nunca uno genérico).
- [ ] **HTTPS forzado** + cabeceras: HSTS, `X-Content-Type-Options`, `Referrer-Policy`,
      `X-Frame-Options`/`frame-ancestors`, `Permissions-Policy` (sin romper pagos con Apple/Google Pay).
- [ ] **CORS** de las funciones de servidor con lista de orígenes (nunca `*.dominio-de-hosting`).
- [ ] **Límite de peticiones** por IP en cada función pública; **honeypot** en formularios
      públicos; **Turnstile/captcha** (opcional, activable por variables) en formularios,
      compra y acceso; captcha también en registro/acceso si hay cuentas.
- [ ] Funciones de BD con `search_path` vacío y nombres cualificados; helpers en un esquema privado.
- [ ] Datos de terceros siempre escapados en emails y HTML; JSON-LD con `<` escapado.
- [ ] Tests de permisos (RLS) por rol: lo que cada uno **no** puede leer o cambiar.
- [ ] Revisión adversaria antes de lanzar (dinero, permisos, privacidad).

## 5. Pagos (si hay)

- [ ] Modo test primero; métodos **instantáneos** solamente (los diferidos llegan tarde).
- [ ] La compra se confirma **solo por el webhook** (firma verificada), nunca por la vuelta del navegador.
- [ ] El servidor recalcula el importe; importes que no cuadran → no se confirma y se avisa.
- [ ] Reembolsos con **clave de idempotencia** que no se repita entre reintentos; estados
      (pendiente, hecho, fallido) con eventos del proveedor (`refund.failed`); acciones para
      lo fallido (reintentar, avisar al cliente, devolución manual registrada).
- [ ] Facturas numeradas e inmutables (simplificada, completa, rectificativa) si aplica.
- [ ] Cobros posteriores con **enlace de pago** (Checkout) y su propia factura.
- [ ] Aviso interno a la empresa de ventas, cancelaciones y reembolsos (hechos y fallidos).

## 6. Emails

- [ ] **Matriz de emails** (`docs/emails.md`): plantilla, disparador, destinatarios, adjuntos,
      clave de idempotencia.
- [ ] Cola en BD con reintentos y backoff; envío idempotente; panel con los fallidos.
- [ ] En dev, **redirigir todo** a un buzón de pruebas; en prod, vacío.
- [ ] Dominio verificado (SPF, DKIM, DMARC); SMTP del sistema de cuentas por el mismo proveedor;
      plantillas de autenticación con la marca.
- [ ] Galería de plantillas en dev y tests de render (asunto, HTML, texto plano, sin `undefined`).

## 7. Legal y consentimiento (UE/España)

- [ ] **Aviso legal** (LSSI: titular, NIF, dirección, registro, contacto, autorizaciones).
- [ ] **Política de privacidad** (RGPD/LOPDGDD: responsable, finalidades, bases, plazos,
      destinatarios y encargados, transferencias, derechos, AEPD) + primera capa en formularios.
- [ ] **Política de cookies** y **condiciones de contratación/cancelación** (derecho de
      desistimiento y sus excepciones).
- [ ] Datos legales en **ajustes de la BD** (no en el código) para cambiarlos sin desplegar;
      lo que falte se ve como «[pendiente]».
- [ ] **Banner de consentimiento**: aceptar y rechazar con el mismo peso, configurar por
      categorías, caducidad del consentimiento, reabrible desde el pie; nada de cookies de
      analítica/publicidad sin consentimiento.
- [ ] Revisión de un abogado antes de lanzar.

## 8. SEO y búsqueda con IA

- [ ] Páginas públicas **pregeneradas** (HTML completo por página e idioma) e **hidratadas**
      (no repintadas) en el navegador; test sin JavaScript y test de **hidratación sin
      desajustes** (lo que depende del navegador espera a `useHydrated()`).
- [ ] **404 real** (estado 404) y personalizada; la zona de la app con `noindex`.
- [ ] Por página: `<title>`, meta descripción, canonical, `hreflang` (+ `x-default`),
      Open Graph/Twitter con **imagen propia 1200×630**.
- [ ] `sitemap.xml`, `robots.txt` (dev bloquea todo; prod permite, también bots de IA si se
      decide) y `llms.txt`.
- [ ] **Datos estructurados**: organización/negocio local, servicios con oferta «desde»,
      migas de pan, FAQ; test que los compruebe.
- [ ] Una sola versión de URL (https, con o sin `www` con 301, sin barra final).
- [ ] **Páginas por intención de búsqueda** (rutas, servicios, ocasiones) con una plantilla,
      texto propio en cada idioma, precio «desde» calculado en el build y enlace a la
      acción ya encaminada; **enlazado interno** (pie, índices, relacionadas) y test de que
      ninguna queda huérfana.
- [ ] Favicon SVG + PNG, `apple-touch-icon`, `manifest` con iconos 192/512 y `theme-color`.
- [ ] Guía para el cliente: Search Console, Bing Webmaster Tools, **IndexNow**, Perfil de
      Empresa de Google, Apple Business Connect, reseñas y revisión mensual en asistentes de IA.

## 9. Rendimiento

- [ ] Imagen LCP como `<img>` real con prioridad alta (nunca lazy) y `srcset`; resto lazy.
- [ ] Imágenes en WebP/AVIF a varios tamaños; fuentes autoalojadas (sin Google Fonts remoto).
- [ ] Presupuesto de chunks (ninguno > 500 KB sin justificar) y librerías en chunks propios.
- [ ] **Lighthouse CI** en cada PR (móvil): LCP < 2,5 s, CLS < 0,1, TBT < 200 ms, a11y ≥ 0,95.
- [ ] Monitorización y analítica cargadas en diferido; navegadores antiguos sin romper.

## 10. Accesibilidad y móvil

- [ ] axe en los tests de componentes y en navegador real (WCAG 2.2 AA) a 375/768/1024/1280 px.
- [ ] Un único `<h1>` por página, `lang` del documento, sin scroll horizontal, foco visible,
      contraste correcto, textos ALT (vacío si la imagen es decorativa).

## 11. Analítica

- [ ] GA4/píxeles **solo en producción y con consentimiento**; ID de medición solo en prod.
- [ ] **Atribución** (utm, referrer, landing) guardada con cada conversión.
- [ ] Medición propia **sin cookies** (visitas, embudo, errores por paso) con resúmenes diarios
      y panel; **canales** (incluido «Asistentes de IA»).

## 12. Testing y CI

- [ ] Unitarios (lógica pura), componentes (+ axe), **BD** (migraciones, RLS y flujos, sin
      Docker si se puede), **E2E** en 3 tamaños con el backend simulado, **capturas visuales**
      por plataforma, pruebas de pagos reales en modo test, pruebas nocturnas contra dev.
- [ ] CI: tipos, lint, formato, unitarios, BD, E2E, Lighthouse; workflow para regenerar
      capturas de Linux; despliegue de migraciones y funciones por CI.
- [ ] **Enlaces rotos**: test que recorre todas las páginas y comprueba cada enlace interno.

## 13. Observabilidad y operación

- [ ] Errores (Sentry o similar) en front y servidor, por entorno, con versión, source maps
      subidos y borrados del despliegue, **túnel** en el propio dominio y datos personales filtrados.
- [ ] Avisos internos por email de lo que requiere acción (pagos que no cuadran, reembolsos
      fallidos, falta de capacidad…).
- [ ] Panel de administración con auditoría (quién cambió qué), decisiones manuales con
      justificación obligatoria, filtros de «pendiente de acción» y **manual de uso** en PDF
      para personal no técnico.
- [ ] Scripts de datos de prueba (crear y borrar) en dev.

## 14. Checklist de lanzamiento

- [ ] Dominio y DNS; HTTPS; redirección de la versión secundaria; correo del dominio.
- [ ] Claves **live** (pagos, emails, mapas) y webhooks de prod con sus eventos.
- [ ] Ajustes de prod (datos legales, emails de avisos, sin redirección de emails).
- [ ] Variables de prod del hosting (URL del sitio, entorno, analítica, errores, anti-spam).
- [ ] Textos legales revisados; autorizaciones administrativas publicadas.
- [ ] Compra real de importe bajo + reembolso, de principio a fin.
- [ ] Search Console, Bing, IndexNow, Perfil de Empresa.
- [ ] Copias de seguridad de la BD y plan de estabilización tras el lanzamiento.

## 15. Plantilla del roadmap

```markdown
# Roadmap MVP
## Fase 0 · Decisiones            (§1)
## Fase 1 · Base técnica          (§2, §3, §12 mínimos)
## Fase 2 · Flujo principal       (la conversión de punta a punta)
## Fase 3 · Pagos y emails        (§5, §6)
## Fase 4 · Panel                 (§13)
## Fase 5 · Legal y consentimiento(§7)
## Fase 6 · SEO, rendimiento y a11y(§8, §9, §10)
## Fase 7 · Analítica             (§11)
## Fase 8 · Calidad y seguridad   (§4, §12 completos)
## Fase 9 · Lanzamiento           (§14)
Cada tarea: [ ] descripción · MVP/final · documento que se actualiza
```
