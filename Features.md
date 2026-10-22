# Funcionalidades y decisiones de evolución

Este documento inicia el registro de decisiones de esta nueva etapa; no pretende reconstruir ni sustituir el inventario histórico del panel.

## Peticiones

**[P1] 22/10/2026.** Aceptadas las ocho mejoras propuestas de facturación/planning. Solicitado roadmap, consulta permanente de `DevelopmentBasics.md` y `PLAYBOOK-WEB.md`, reconsideración del editor modal, logo y paletas predefinidas/personalizadas.

**[P2] 22/10/2026.** Comenzar la primera fase: editor de documento en una vista completa con navegación, preview adaptable y validación accesible.

## Decisiones

| ID | Petición | Decisión | Motivo |
|---|---|---|---|
| D1 | P1 | Editor de documento como vista completa dentro de su pestaña, con ruta propia. | Formulario largo y preview necesitan espacio; preservar contexto y navegación. |
| D2 | P1 | Preview simultáneo en escritorio y adaptable por conmutador en pantallas estrechas. | Mantener formulario y documento legibles sin perder entrada. |
| D3 | P1 | Logo y tres paletas iniciales (Grafito, Océano, Oliva), más personalizada por HEX. | Personalización controlada, legible y coherente con los modelos aportados. |
| D4 | P1 | Copia de identidad y datos fiscales en cada documento. | Los cambios posteriores de compañía/cliente no deben alterar el histórico. |
| D5 | P1 | Primera entrega: editor, validación, marca, autoguardado, reutilización y duplicación. | Establecer primero un flujo diario fiable; el resto sigue planificado. |
| D6 | P1 | Versión final: cobros/vencimientos, historial/versiones y mover tareas con deshacer. | Construir sobre contratos de versión, auditoría y permisos ya estabilizados. |
| D7 | P1 | Mantener stack existente y compatibilidad; aislar todos los recursos por compañía. | Evolucionar sin regresiones ni migraciones generales innecesarias. |
| D8 | P1 | Autoguardado solo de borradores; emisión explícita y cambios de emitidas trazables. | Evitar numeración/efectos definitivos durante la escritura y preservar historial. |
| D9 | P2 | Rutas `/invoicing/new`, `/invoicing/:id`, `/quotes/new` y `/quotes/:id`, con data router de React Router. | Permitir enlaces directos y bloquear salidas con cambios mediante la API del router, incluido atrás del navegador. |
| D10 | P2 | Dividir preview a partir de 1100 px de espacio disponible en la pestaña; alternar por debajo. | Decidir según el espacio real del editor, incluyendo el ancho ocupado por el menú lateral. |
| D11 | P2 | Generar preview tras una pausa de 200 ms y diferir su entrada; conservar el PDF anterior hasta sustituirlo. | Evitar regeneraciones por cada pulsación y enlaces temporales revocados demasiado pronto. |

## Changelog

- **22/10/2026 [P1]:** creados `AGENTS.md`, `ROADMAP-FACTURACION-PLANNING.md`, `roadmap-mvp.md` y `roadmap-final-version.md`. Referencias permanentes a las dos guías aportadas. Entrega documental: no cambia UI, BD, emails ni despliegues.
- **22/10/2026 [P2]:** fase 1 implementada localmente. Editor fuera del modal, formulario separado, rutas, preview adaptable, filtros en URL, restauración del scroll, aviso al navegar/recargar con cambios, errores por campo en ES/EN y conservación de entrada ante fallos. Ajustes de marca continúan en su modal. Sin cambios de BD ni despliegue; autoguardado y nuevas paletas siguen pendientes.
