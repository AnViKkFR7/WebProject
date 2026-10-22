# Guía de trabajo del repositorio

Antes de implementar cambios, leer `DevelopmentBasics.md` y `PLAYBOOK-WEB.md` en la raíz. El usuario ha pedido expresamente que se tengan en cuenta en todas las implementaciones. Aplicar sus criterios al contexto de este proyecto existente; las instrucciones actuales del usuario tienen prioridad sobre las referencias.

- Stack existente: React 19, Vite, React Router, JavaScript y Supabase. Conservarlo; no migrar todo a TypeScript ni reinstalar herramientas por recomendaciones de setup para proyectos nuevos.
- Plan de evolución de facturación y planning: `ROADMAP-FACTURACION-PLANNING.md`, `roadmap-mvp.md` y `roadmap-final-version.md`. Decisiones y cambios: `Features.md`. El roadmap de analítica de `admin-panel/roadmap.md` tiene otro alcance.
- Consultar el estado real del código y las migraciones antes de implementar. No equiparar código local con cambios desplegados. Preservar los cambios existentes del usuario.
- Nuevas facturas y presupuestos: editor en una vista completa dentro de la pestaña, conservando la navegación del panel; previsualización simultánea cuando haya espacio. Reservar modales para acciones breves.
- Identidad visual por empresa: logo, tres paletas predefinidas y paleta personalizada con HEX y muestras; sin colorPicker nativo. Documentos guardan una copia de la identidad usada.
- Toda lectura, escritura, caché, borrador, archivo e historial debe aislarse por empresa y usuario según permisos. Comprobar permisos en servidor, no solo en UI. Probar denegaciones entre empresas.
- Nuevas migraciones para cambios de BD; no modificar migraciones ya aplicadas. Mantener documentación de despliegue y validar antes de producción.
- Formularios accesibles, traducciones ES/EN, tokens y componentes reutilizables, estilos nuevos preferentemente CSS Modules. Conservar entrada de usuario al fallar una petición. Movimiento reducido y revisión móvil/tablet/escritorio.
- Actualizar decisiones, changelog y casillas al completar cada entrega. Una tarea solo se marca terminada con evidencia de las comprobaciones pertinentes.

Comandos existentes: en `admin-panel`, `npm test`, `npm run lint`, `npm run build`; en la raíz, `npm run check:functions`. Ejecutar los relevantes al cambio, documentando fallos previos y límites de verificación.
