# Rediseño «Glass» del panel

Rama: `redesign/glass-ui`. Objetivo: pasar de una estética plana a una translúcida tipo Apple (referencias Verdan/Maren aportadas por el usuario), con los colores actuales (índigo `#4f46e5` + acento turquesa), **sin cambiar pestañas, rutas ni funcionalidad**. Los cambios de flujo se proponen aquí y solo se aplican tras decidirlos juntos.

## Dirección de diseño

| Elemento | Decisión |
|---|---|
| Fondo | Degradado ambiental suave (índigo, turquesa, violeta) fijo detrás de todo, con deriva muy lenta. Sin fotos: no compite con los datos. |
| Superficies | Tarjetas translúcidas con borde de luz y sombra difusa. Desenfoque solo en menú lateral, barra superior, modales y desplegables (rendimiento y compatibilidad con calendarios/menús flotantes). |
| Navegación | Menú lateral flotante con esquinas de 1,6 rem; elemento activo en «píldora» elevada. Barra superior que se convierte en cristal al desplazar. |
| Controles | Botones píldora con degradado sutil y respuesta al pulsar; filtros segmentados tipo iOS; campos con borde de contraste ≥3:1. |
| Movimiento | Entrada de página de 360 ms, curvas *ease-out* y *spring* en hover/pulsación. Todo se desactiva con `prefers-reduced-motion`; con `prefers-reduced-transparency` las superficies pasan a opacas. |
| Temas | Claro y oscuro con el mismo lenguaje. Sin soporte de `backdrop-filter`, superficies casi opacas. |

Implementación: capa única `admin-panel/src/styles/glass.css` cargada la última, que redefine tokens y clases globales. Los CSS Modules heredan el aspecto a través de los tokens (`--bg-card`, `--border-color`, radios, sombras).

## Fases

- [x] **0. Base** — rama, inventario de estilos (App.css 4.750 líneas + 33 módulos con `--bg-card`), riesgos (`backdrop-filter` crea bloque contenedor para `position: fixed`).
- [x] **1. Tokens y fondo** — paleta glass clara/oscura, radios, sombras, curvas, fondo ambiental, fallbacks.
- [x] **2. Estructura** — menú lateral flotante, barra superior de cristal, modales, desplegables, avisos, login.
- [x] **3. Componentes globales** — botones, segmentados, campos, tarjetas, secciones de formulario, tablas, píldoras. Iconos distintos para cada pestaña (antes Presupuestos/Facturación, Solicitudes/Emails y Contactos/Usuarios compartían icono).
- [ ] **4. Repaso página a página** (requiere sesión iniciada en el navegador de revisión): Inicio, Items y ficha, Atributos, Blog, Solicitudes, Contactos, Planning, Presupuestos, Facturación (editor + vista previa), Analítica, Usuarios, Empresas, Ajustes, Mi cuenta. Ajustar CSS Modules con colores fijos o superficies que no encajen.
- [ ] **5. Accesibilidad y rendimiento** — contraste de textos sobre cristal (AA), foco visible, 375/768/1024/1440 px, tema oscuro, movimiento y transparencia reducidos, fluidez con listas largas.
- [ ] **6. Cambios de flujo acordados** (ver propuestas).
- [ ] **7. Cierre** — pruebas, lint, build, `Features.md`, PR a `main`.

## Auditoría de usabilidad

### Corregido en esta rama (sin cambiar flujos)
1. Iconos repetidos en el menú: Presupuestos y Facturación (`file`), Solicitudes y Emails a clientes (`mail`), Contactos y Usuarios (`users`). Ahora cada pestaña tiene icono propio.
2. Campos del login con borde `#e2e8f0` (contraste 1,2:1): no se distinguía dónde escribir. Ahora ≥3:1.

### Propuestas para decidir juntos
| # | Problema | Propuesta |
|---|---|---|
| P1 | **«Atributos» en el menú abre una página titulada «Mis Datos»**, y su descripción habla de «inmuebles». Tres nombres para lo mismo. | Un único nombre: «Tipos y atributos» (menú y título) y descripción neutra. |
| P2 | **Los ajustes de empresa están repartidos**: identidad/datos en *Mi cuenta → Empresa*; *Módulos*, *Privacidad* y *Emails a clientes* en *Administración*. Para cambiar algo de la empresa hay que saber dónde buscar. | Agrupar en «Ajustes de empresa» con pestañas (General, Módulos, Emails, Privacidad). *Mi cuenta* queda solo para datos personales y seguridad. |
| P3 | **«Empresas y Clientes»** (directorio de clientes) choca con «empresa» del selector superior (la empresa con la que trabajas). | Renombrar a «Clientes» (o «Directorio de clientes»). |
| P4 | **Mezcla de idiomas** en el menú: Dashboard, Items, Planning. | «Inicio», «Catálogo» (o el término de cada negocio), «Agenda». Opcional: mantener si el equipo ya los usa. |
| P5 | **Solicitudes → Contactos**: convertir una solicitud en contacto obliga a cambiar de pestaña para seguir el pipeline. | Desde la solicitud, acción «Abrir contacto» directa y contador de pendientes en el menú. |
| P6 | **Presupuesto → Factura**: son pestañas hermanas sin indicación del paso siguiente. | Al aceptar un presupuesto, botón destacado «Crear factura» y enlace de vuelta en la factura. (Verificar en el repaso si ya existe.) |
| P7 | **Inicio**: revisar que cada tarjeta lleve a su acción (p. ej. «3 solicitudes sin responder» → Solicitudes filtradas). | Tarjetas como accesos directos con la acción principal. |

P5–P7 se confirmarán en el repaso visual con sesión iniciada; pueden ajustarse tras verlo en uso real.
