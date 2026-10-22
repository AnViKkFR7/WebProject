# Diseño del editor de documentos

## Referencias

Aplicar `DevelopmentBasics.md`, `PLAYBOOK-WEB.md` y las decisiones de `Features.md`. Este documento describe la entrega [P2] del editor; no sustituye el inventario del resto del panel.

## Composición

- `DocumentEditorPage.jsx` y su CSS Module: cabecera, navegación, estado, acciones y composición adaptable. H1 propio, nombre de compañía y estado de cambios; la topbar conserva el título de sección como párrafo en rutas de documento para evitar dos H1.
- `BillingDocumentForm.jsx`: formulario y resumen económico compartidos por factura/presupuesto. Reutiliza emisor, capítulos/partidas, fechas, descuentos y servicios actuales.
- `BillingField.jsx`: etiqueta, entrada, mensaje localizado y asociación accesible por ID único. Captura validación nativa; los errores no se mezclan entre campos con el mismo nombre en distintas partidas/secciones.
- `FormSection` permite nivel de encabezado 2/3/4; el valor por defecto conserva los formularios existentes. El editor usa H2.
- `Invoicing.jsx` coordina carga/guardado/permisos y selección de documento; `useDocumentNavigation` encapsula navegación protegida. Los servicios remotos siguen en `invoicingService.js`.

## Responsive y navegación

Container query a 1100 px disponibles: formulario y preview simultáneos, con opción de ocultar preview. Por debajo se alterna Editar/Vista previa sin desmontar el formulario. Campos numéricos reorganizados según el ancho del formulario, incluso con viewport de escritorio. En móvil, volver usa icono y conserva etiqueta accesible.

Cabecera persistente de acciones; en tablet/móvil respeta la topbar fija. Scroll nativo de la página; sin nueva trampa de foco, scroll artificial ni animaciones. Modales reservados a ajustes y confirmaciones.

Al entrar, foco en el H1 sin desplazar la página. Al volver al listado desde el editor, foco en búsqueda sin alterar la restauración del scroll. Al enviar con errores, mostrar formulario aunque estuviera en preview y enfocar el primer inválido. No se borra la entrada si falla el servidor.

Filtros `q` y `status` permanecen en la URL. Al volver/guardar se sustituye la entrada del editor en el historial para evitar regresar accidentalmente a un formulario nuevo tras guardar. Los documentos persistidos se pueden abrir/recargar por ID; el hosting debe conservar su rewrite de SPA.

## Previsualización

Carga diferida del componente. El preview reutiliza el renderizador de descarga y espera 200 ms sin cambios antes de generar. El objeto de entrada es diferido con React; las temporizaciones antiguas se cancelan al cambiar datos/desmontar.

Se reserva espacio A4 durante la primera carga. El enlace al PDF anterior sigue válido mientras se prepara el siguiente; las URLs se revocan al sustituirse o desmontar. Un fallo ofrece reintento. La descarga de cambios no guardados mantiene marca de borrador.

## Límite de esta entrega

La creación sigue necesitando guardar expresamente: el autoguardado no está implementado. El logo y el color existente se conservan; las nuevas paletas y su persistencia corresponden a fase 2. Cambiar de compañía/cuenta desmonta el estado del editor y descarta respuestas antiguas; no se recuperan borradores entre compañías.
