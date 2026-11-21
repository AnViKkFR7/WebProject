# Rediseño «Glass» del panel

Rama: `redesign/glass-ui`, fusionada en `main` el 2026-11-21. Objetivo: pasar de una estética plana a una translúcida tipo Apple (referencias Verdan/Maren aportadas por el usuario), con los colores actuales (índigo `#4f46e5` + acento turquesa), **sin cambiar rutas ni funcionalidad**. Los cambios de flujo P1–P7 se aprobaron el 2026-11-21 y están aplicados (fase 6).

## Dirección de diseño

| Elemento | Decisión |
|---|---|
| Fondo | Degradado ambiental suave (índigo, turquesa, violeta) fijo detrás de todo, con deriva muy lenta. Sin fotos: no compite con los datos. |
| Superficies | Tarjetas translúcidas con borde de luz y sombra difusa. Desenfoque solo en menú lateral, barra superior, modales y desplegables (rendimiento y compatibilidad con calendarios/menús flotantes). |
| Navegación | Menú lateral flotante con esquinas de 1,6 rem; elemento activo en «píldora» elevada. Barra superior que se convierte en cristal al desplazar. |
| Controles | Botones píldora con degradado sutil y respuesta al pulsar; filtros segmentados tipo iOS; campos con borde de contraste ≥3:1. |
| Movimiento | Píldora deslizante hacia la opción activa (menú, pestañas, filtros), entrada de página en cascada, modales con escala suave; curvas *ease-out*, *spring* y *glide* (tipo iOS). Todo se desactiva con `prefers-reduced-motion`; con `prefers-reduced-transparency` las superficies pasan a opacas. |
| Temas | Claro y oscuro con el mismo lenguaje. Sin soporte de `backdrop-filter`, superficies casi opacas. |

Implementación: capa única `admin-panel/src/styles/glass.css` cargada la última, que redefine tokens y clases globales. Los CSS Modules heredan el aspecto a través de los tokens (`--bg-card`, `--border-color`, radios, sombras).

## Fases

- [x] **0. Base** — rama, inventario de estilos (App.css 4.750 líneas + 33 módulos con `--bg-card`), riesgos (`backdrop-filter` crea bloque contenedor para `position: fixed`).
- [x] **1. Tokens y fondo** — paleta glass clara/oscura, radios, sombras, curvas, fondo ambiental, fallbacks.
- [x] **2. Estructura** — menú lateral flotante, barra superior de cristal, modales, desplegables, avisos, login.
- [x] **3. Componentes globales** — botones, segmentados, campos, tarjetas, secciones de formulario, tablas, píldoras. Iconos distintos para cada pestaña (antes Presupuestos/Facturación, Solicitudes/Emails y Contactos/Usuarios compartían icono).
- [x] **4. Repaso página a página** (2026-11-21, empresa WatchEcommerceDemo con datos en todo, 1440 px, oscuro, tablet 768 y móvil 375): Inicio, Catálogo y ficha, Tipos y atributos, Blog, Solicitudes, Contactos, Agenda, Presupuestos (editor + vista previa), Facturación, Analítica, Usuarios, Clientes, Ajustes. Corregido:
  - Más separación tarjeta/fondo (petición del usuario, «algo más, no mucho»): superficies 64→74 % de opacidad, filo oscuro suave `--surface-edge`, sombra algo más marcada y fondo un punto más oscuro; en oscuro 58→66 %.
  - Tipos y atributos: con la vista previa al lado (≥1400 px) el nombre del atributo quedaba en ~23 px y se montaba sobre los interruptores. Ahora la fila responde al ancho del panel (container query) y los interruptores bajan a otra línea.
  - Barra de acciones del editor de documentos: mezclaba botones cuadrados con píldoras; `DocumentActionButton` pasa al mismo lenguaje.
  - Móvil (fallo previo, también en `main`): la barra fija ocupaba dos filas y tapaba el título. Ahora es una fila y el contenido reserva su altura.
  - Textos: «+» duplicado en «Nueva tarea»; restos de «inmueble» en la ficha; «Planning», «Items» y «empresa cliente» como nombres de sección.
  - Pendiente fuera del rediseño: la lista del Blog muestra un identificador bajo el título (slug con forma de UUID en los artículos de esta empresa).
- [ ] **5. Accesibilidad y rendimiento** — contraste de textos sobre cristal (AA), foco visible, 375/768/1024/1440 px, tema oscuro, movimiento y transparencia reducidos, fluidez con listas largas.
  - Hecho: revisión en 375/768/1440 px y oscuro (fase 4); movimiento reducido cubre las nuevas animaciones (píldora, cascada, modales, elevación de tarjetas); el indicador deslizante es `aria-hidden` y no cambia el foco ni la semántica (`aria-current`/`aria-pressed`).
  - Falta: medición sistemática de contraste AA sobre cristal y prueba de fluidez con listas largas (>500 filas).
- [x] **6. Cambios de flujo acordados** — P1–P7 aplicados (ver tabla).
- [x] **7. Cierre** — pruebas, lint, build, `Features.md` y fusión en `main` (2026-11-21, autorizada por el usuario).

## Auditoría de usabilidad

### Corregido en esta rama (sin cambiar flujos)
1. Iconos repetidos en el menú: Presupuestos y Facturación (`file`), Solicitudes y Emails a clientes (`mail`), Contactos y Usuarios (`users`). Ahora cada pestaña tiene icono propio.
2. Campos del login con borde `#e2e8f0` (contraste 1,2:1): no se distinguía dónde escribir. Ahora ≥3:1.

### Propuestas (aprobadas y aplicadas el 2026-11-21)
| # | Problema | Propuesta → aplicado |
|---|---|---|
| P1 | **«Atributos» en el menú abre una página titulada «Mis Datos»**, y su descripción habla de «inmuebles». Tres nombres para lo mismo. | ✅ «Tipos y atributos» en menú, título, Inicio y módulos; descripción neutra (ES/EN). |
| P2 | **Los ajustes de empresa están repartidos**: identidad/datos en *Mi cuenta → Empresa*; *Módulos*, *Privacidad* y *Emails a clientes* en *Administración*. Para cambiar algo de la empresa hay que saber dónde buscar. | ✅ `/settings` con pestañas General, Módulos, Emails, Privacidad según permisos; URLs antiguas válidas; `/profile/company` redirige. |
| P3 | **«Empresas y Clientes»** (directorio de clientes) choca con «empresa» del selector superior (la empresa con la que trabajas). | ✅ «Clientes» (menú, página y tarjeta de Inicio). |
| P4 | **Mezcla de idiomas** en el menú: Dashboard, Items, Planning. | ✅ Inicio, Catálogo, Agenda (EN: Home, Catalog, Schedule). |
| P5 | **Solicitudes → Contactos**: convertir una solicitud en contacto obliga a cambiar de pestaña para seguir el pipeline. | ✅ «Abrir contacto» / «Revisar en Contactos» en la ficha y contador de nuevas en el menú. |
| P6 | **Presupuesto → Factura**: son pestañas hermanas sin indicación del paso siguiente. | ✅ Ya existía la conversión; ahora «Crear factura» también en la lista, abre la factura creada y hay enlaces presupuesto ⇄ factura. |
| P7 | **Inicio**: revisar que cada tarjeta lleve a su acción (p. ej. «3 solicitudes sin responder» → Solicitudes filtradas). | ✅ Ya lo eran (Solicitudes filtra por nuevas); se ocultan las de módulos desactivados. |

P5 e Inicio revisados en navegador con sesión real. P6 cubierto por pruebas; falta verlo con un presupuesto aceptado real.
