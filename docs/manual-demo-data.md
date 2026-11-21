# Datos ficticios para las capturas del manual

El usuario confirma que **WatchEcommerceDemo es una empresa ficticia de pruebas** y autoriza añadir datos para ilustrar el manual sin taparlos. Se conserva el diseño editorial y las explicaciones de la edición 3; la siguiente revisión sustituirá las capturas por imágenes del escenario poblado.

## Cargar el escenario

1. Abrir el SQL Editor del Supabase de este proyecto.
2. Pegar y ejecutar **todo** `database/maintenance/WATCH_MANUAL_DEMO_DATA.sql`, incluidos `begin` y `commit`.
3. Comprobar la fila de resultado:

| empresa | solicitudes_demo | contactos_demo | tareas_demo | presupuestos_demo | facturas_demo | dias_analitica |
| --- | ---: | ---: | ---: | ---: | ---: | ---: |
| WatchEcommerceDemo | 12 | 8 | 10 | 4 | 5 | 30 |

4. Recargar el panel en `localhost:5174` con **WatchEcommerceDemo** seleccionada.

No se necesita copiar IDs, claves ni secretos. Si falta una tabla, función, módulo o administrador activo, el script cancela la transacción. Para continuar se necesita la confirmación de ejecución y, si falla, el mensaje de error.

## Qué contiene

- Ocho personas y fichas fiscales ficticias, repartidas entre las seis etapas del pipeline, con responsable, seguimientos y cronología.
- Doce solicitudes de relojería, con mensajes, origen, campañas y consentimiento sintético. Los triggers reales las vinculan al CRM.
- Diez tareas en esta semana y la siguiente, y cuatro previsiones de cobrar/pagar en Planning.
- Seis conceptos de catálogo y una plantilla de capítulos con personalización y entrega.
- Cuatro presupuestos: borrador, enviado, aceptado y rechazado. Las dos respuestas se generan mediante las RPC reales, sin invocar las Edge de envío.
- Cuatro facturas ordinarias: pagada, parcial, vencida y borrador con varias versiones; más una rectificativa. Los cobros son registros ficticios, no transferencias.
- Dos artículos de blog y treinta días de visitas, eventos, scroll y tiempo en página. Las gráficas se calculan con la agregación real y conservan los eventos crudos.

Los emails usan `example.test`, un dominio reservado para pruebas. No se llama a servicios externos; las tareas no llevan recordatorios y las facturas nuevas quedan excluidas de avisos automáticos. La configuración general de la empresa, sus miembros, los items existentes y las otras empresas permanecen intactos. La analítica sintética contará en los resúmenes normales de esta empresa de pruebas.

## Repetición y aislamiento

El lote usa el identificador `watch-manual-v1`, UUID derivados del tenant y claves de sesión de analítica. Una segunda ejecución no duplica los mismos datos ni restablece ediciones realizadas después. Si se ejecuta otro día, incorpora los días nuevos necesarios para mantener la ventana de treinta días; no refecha ni borra el escenario anterior.

El script exige exactamente una empresa llamada `WatchEcommerceDemo`, toma un administrador activo de ella y cancela ante colisiones de IDs con otra empresa. Las facturas, respuestas y cobros usan las RPC del servidor para conservar numeración, validaciones e historial. No se modifican migraciones, RLS ni grants.

## Capturas y revisión completadas

- [x] Carga confirmada por el usuario (28/10/2026) y datos comprobados en el panel autenticado: 12 solicitudes, 8 contactos, Planning, documentos y analítica.
- [x] Sustituir las 31 capturas de escritorio y actualizar las coordenadas de los números.
- [x] Mostrar los datos ficticios completos y retirar las notas sobre ocultación/estados vacíos que ya no correspondan.
- [x] Mantener la maquetación y las explicaciones aprobadas; representar cobros, solicitudes, CRM, Planning y analítica con datos.
- [x] Regenerar el PDF, revisar todas las páginas y validar índice, marcadores y leyendas.

## Comprobación local del lote

`cd admin-panel` y `npm test -- --run tests/database/watchManualDemoData.test.js`.

La prueba usa PGlite con las migraciones reales de facturación, CRM, respuestas, cobros, recordatorios y agregación. Comprueba precondiciones, rollback ante colisión entre empresas, creación coherente, repetición sin sobrescribir ediciones, conservación de eventos existentes, ausencia de envíos encolados y denegaciones RLS entre empresas. No acredita que el SQL esté ya aplicado en Supabase.

## Entrega de capturas · 29/10/2026

PDF actualizado conservando 35 páginas, 17 capítulos y la maquetación aprobada. Las 31 capturas de escritorio muestran datos ficticios completos, sin máscaras; cada marcador corresponde a su leyenda. Se revisó el render de todas las páginas y se verificaron capítulos, 18 enlaces del índice, marcadores PDF y dimensiones de las imágenes. Capturas iniciadas en localhost:5174 y completadas en la sesión activa localhost:5173 con WatchEcommerceDemo seleccionada. No se enviaron correos, registraron nuevos cobros ni emitieron nuevas rectificativas al capturar.
