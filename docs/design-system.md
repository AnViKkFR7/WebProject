# Diseño del editor de documentos

## Galería solo de desarrollo · P14

En `npm run dev`, abrir `/__dev/gallery` para revisar los estilos compartidos de acciones, campos, estados, interruptores y una vista HTML/texto del email de Planning. El email usa `buildPlanningReminder` y datos ficticios; la página no guarda ni envía. El import y la ruta se compilan solo con `import.meta.env.DEV`; `npm run check:production-output` falla si el marcador o los archivos de preview aparecen en `dist`. La galería no tiene captura visual validada aún.

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

La creación sigue necesitando guardar expresamente: el autoguardado no está implementado. Cambiar de compañía/cuenta desmonta el estado del editor y descarta respuestas antiguas; no se recuperan borradores entre compañías.

## Identidad visual · P3

`DocumentAppearance` comparte gestión de logo, paletas y muestra entre los ajustes de compañía y el editor de cada documento. El editor usa un bloque desplegable «Logo y colores del documento»; los ajustes generales siguen accesibles desde «Datos y plantilla».

Grafito, Océano y Oliva se seleccionan con botones de estado `aria-pressed`, con nombre y muestras. Personalizada reutiliza `ColorSelector`: cinco roles con HEX escrito y muestras, sin selector de color nativo. Campos y acciones conservan foco visible y no dependen solo del color. Un contraste inválido se anuncia y bloquea el guardado de ese diseño. Los errores del archivo se asocian al input mediante `aria-describedby`/`aria-invalid`; la ayuda ES/EN explica tamaño y dimensiones.

La miniatura de un logo usa el papel de la paleta para conservar la legibilidad en el panel oscuro. No se deforma la imagen. Preview y PDF comparten renderizador: si un acento personalizado pierde contraste en tablas del presupuesto, el texto de esas superficies usa `ink`, ya validado. Se conserva el acento original en papel y en los datos guardados. Los documentos antiguos sin paleta mantienen su composición anterior.

Validación y revisiones locales de P3 en `docs/testing.md`; contrato de persistencia y permisos en `docs/facturacion-datos.md`. No se añaden animaciones en esta entrega.

### Selección guiada de colores · P4

La personalizada presenta cinco bloques adaptables. `billingColorSamples` propone acentos vivos/oscuros, textos oscuros con alternativas claras para fondos oscuros y blancos/pasteles para papel/tablas. `billingColorConflicts` evalúa las relaciones de contraste que afectan al bloque: acento/papel y texto principal/secundario frente a papel/superficie. No cambia las reglas del servidor.

Cada muestra incompatible se tacha y deshabilita con motivo accesible en su nombre y título; una ayuda visible explica el tachado también en táctil. La marca seleccionada usa fondo y texto del panel para verse en muestras claras y oscuras. La disponibilidad se recalcula sin modificar el valor de ningún otro bloque.

El HEX sigue siendo editable. Un error señala las relaciones incompatibles en ese bloque, se asocia mediante `aria-describedby` y valida el input correspondiente, en lugar de asignar cualquier error al primer color. El resumen global remite a los bloques señalados. Los HEX incompletos de otro bloque no bloquean todas las muestras: se comprueban las relaciones que ya tienen ambos colores completos para permitir recuperar la combinación.

`ColorSelector` recibe muestras y razones de bloqueo por props; sus usos ajenos a facturación conservan el conjunto por defecto sin restricciones. Nuevos estilos en CSS Modules y sin animaciones.

### Paletas con nombre · P5

`BillingPaletteLibrary` aparece en «Logo y colores del documento» y en los ajustes de identidad. Lista nombres y muestras de las paletas de la compañía; la personalizada ofrece nombre y «Guardar paleta con nombre». Nombre/estado de carga/errores tienen etiquetas y mensajes ES/EN. Enter en el nombre guarda la paleta y no envía el formulario de factura/presupuesto. Los lectores ven la biblioteca sin controles de guardado.

Los errores conservan la entrada. Guardar no modifica logo, perfil de compañía ni documento guardado; seleccionar una entrada aplica una copia de colores al formulario actual. No se anidan formularios. La biblioteca comparte estado entre editor y ajustes mediante un hook del workspace por usuario/compañía. Nuevos estilos en CSS Modules con rejilla adaptable, nombres con salto de línea y foco visible. Persistencia/RPC en `docs/facturacion-datos.md`.

### Autoguardado y recuperación · P7

`DocumentDraftRecovery` anuncia estado mediante texto (`role=status`) antes del formulario: preparado, pendiente, guardando, guardado, fallo, desconexión, permisos o conflicto. Recupera contenido incompleto sin numerar ni emitir; Guardar conserva validación completa. Preview refleja entrada actual. Una copia confirmada remotamente permite volver sin aviso de cambios; una copia solo local no se presenta como guardado remoto.

Con trabajo recuperable se bloquea formulario hasta elegir copia/descartar. Acciones: recuperar servidor/local, descargar JSON, descartar con control de revisión y reintentar/revisar versiones. Se advierte que elegir local puede sustituir la remota. Con versión original cambiada solo exportar/descartar; con guardado ya completado se ofrece abrir resultado. Un fallo conserva entrada; migración ausente avisa y mantiene guardado manual.

ES/EN, acciones apiladas en móvil, foco visible y tokens del panel. CSS Module y sin animaciones nuevas. Controlador separado del formulario compartido. Retención/permisos en `facturacion-datos.md` y `entornos.md`.

### Selector visible · P6

La lista de tarjetas de P5 se sustituye por `BillingPaletteSelector`: desplegable «Aplicar paleta guardada» inmediatamente después de Grafito/Océano/Oliva/Personalizada y antes de los campos HEX. Está disponible aunque todavía no se haya elegido Personalizada. Muestra los nombres recuperados de la compañía; seleccionar uno aplica sus colores, activa Personalizada y conserva el logo. El nombre seleccionado y sus muestras reflejan la combinación actual. Carga, vacío, error y reintento están junto al selector.

`BillingPaletteLibrary` queda dedicado a guardar una combinación con nombre al final de los bloques personalizados. No cambia la persistencia, el contrato SQL ni los permisos. Ambos componentes conservan etiquetas ES/EN y el selector usa un control HTML nativo accesible por teclado.

### Retícula PDF y reutilización · P8

Factura y presupuesto comparten márgenes de página (`14–196 mm`). Los títulos de sección Cliente y Concepto parten del mismo eje; el contenido de celdas mantiene su sangría interna. En la cabecera comercial, cliente y total se miden como dos columnas: el separador inferior se dibuja cinco milímetros después del bloque que termine más abajo. Así, un cliente vacío, uno multilínea o un total grande no puede quedar atravesado por la regla.

`BillingReusePanel` presenta dos buscadores independientes antes de los campos de cliente y partidas. Los resultados son botones con resumen; crear un cliente o concepto despliega campos con etiquetas ES/EN y conserva la entrada si falla. Los conceptos ofrecen archivo con confirmación. La selección solo rellena la copia del documento, cuyos campos continúan editables.

En móvil los bloques pasan a una columna, las acciones conservan foco visible y no hay desplazamiento horizontal. El componente usa CSS Module, controles HTML y mensajes de estado; no añade animaciones.

### Duplicación y plantillas · P9

La acción Duplicar aparece en cada fila y en la cabecera de un documento guardado. Abre el editor completo con el título de documento nuevo y un aviso junto a las fechas: identifica el origen y exige nuevas fechas antes de guardar. El número no se presenta como heredado.

En presupuestos, `BillingChapterTemplates` precede a los capítulos. Permite buscar y aplicar una plantilla, guardar la estructura actual con nombre y archivar con confirmación. Los fallos conservan el nombre escrito. Los resultados muestran nombre y número de partidas; en móvil pasan a una columna.

Cada cabecera de capítulo y cada partida incluye botones subir/bajar con nombre accesible y estado deshabilitado en los extremos. El orden cambia sin animaciones ni arrastre y conserva el foco y los IDs de las líneas. Los controles usan iconos del sistema, CSS Module para la biblioteca y los breakpoints existentes del editor.

### Planning: arrastrar y ajustar tareas · P13

Las tarjetas de Día/Semana pueden moverse con puntero; un asa inferior cambia la duración. El destino se anticipa con una previsualización y el cambio no se persiste hasta confirmarlo. Escape o cancelar puntero termina sin escribir. En táctil y teclado se conserva el formulario **Editar**, que permite introducir fecha y hora. Al mover una tarea recurrente el diálogo informa que se mueve toda la serie. Tras confirmar se ofrece Deshacer durante diez segundos; la operación inversa requiere que la versión siga siendo la creada por ese movimiento. No se oculta el control de edición directa detrás del arrastre.

### Galería de desarrollo · P16 parcial

`/__dev/gallery` se conserva únicamente en `import.meta.env.DEV` y usa datos ficticios. Su retícula presenta acciones y controles en dos columnas desde escritorio ancho y pasa a una columna en tablet/móvil; el bloque de email ocupa todo el ancho disponible. Inputs e iframe limitan su caja al contenedor para evitar desbordes. La revisión de esta entrega fue estática: todavía falta abrirla y comprobarla visualmente en navegador y guardar capturas antes de completar la casilla de galería del roadmap.

### Menú lateral contraído · P18

El ancho del sidebar incluye padding y borde (`border-box`), de modo que las anchuras expandidas/contraídas coinciden con las del layout. En estado contraído se recorta overflow horizontal en el contenedor y en la navegación; el menú conserva desplazamiento vertical cuando sus opciones no caben en alto. El selector de empresa usa un menú `fixed` para seguir abriéndose hacia el área principal.
