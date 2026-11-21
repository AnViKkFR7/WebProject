# Saldos de facturas rectificadas · entrega 7

## Decisión de cálculo

La factura original y sus rectificativas forman una familia por sus referencias, siempre dentro de la empresa. Los documentos y movimientos guardados no se reescriben. Una sustitución fija el nuevo total de la familia y deja sin efecto económico los totales y ajustes anteriores; las diferencias posteriores se suman con su signo. Sin sustitución, se parte del total original y se aplican todas las diferencias. Una nueva sustitución vuelve a fijar la base. También se admiten referencias a rectificativas anteriores dentro de la misma familia.

El orden se determina por fecha de creación, secuencia numérica de rectificación e ID como desempate estable. La fecha de emisión editable del documento no decide qué rectificación es la última. Los documentos heredados con numeración o fechas no representativas requieren revisión antes del despliegue.

Todos los cobros y sus reversiones de la familia se suman una sola vez, incluidos los anteriores a una sustitución. El saldo se asigna al documento más reciente, que representa la liquidación vigente; sus totales financieros son consolidados. Los demás muestran estado financiero Rectificada y cero saldo/cobrado en el resumen agregado para evitar duplicación. El total impreso de cada documento y su historial de movimientos siguen siendo los propios. El texto del panel aclara esta diferencia.

Ejemplos: 121 sustituida por 96,80 deja 96,80 pendientes; con un cobro previo de 40 deja 56,80. Original de 100 con diferencias -20 y +10 deja 90. Una sustitución posterior por 80 y otra diferencia -5 deja 75. Si se cobraron 100 y se sustituye por 80, hay 20 a favor del cliente. Un crédito no genera transferencia ni devolución bancaria automática.

## Cobros y avisos

Los nuevos cobros solo se registran sobre el documento vigente, con límite en el saldo consolidado. Los reintentos de solicitudes ya procesadas conservan su identidad aunque haya una rectificación posterior. Las reversiones se realizan desde el documento que conserva el movimiento y afectan al saldo de toda la familia. Los cambios de estado histórico de una factura no sustituyen el estado financiero consolidado.

Rectificar, cobrar y revertir bloquean la fila raíz de la familia antes de modificar datos, para serializar esas operaciones. Las pruebas locales no reproducen varias conexiones de producción.

Encolado, reclamación y payload de vencimientos comparten el cálculo consolidado; solo el documento vigente con deuda genera avisos. La entrega descarta trabajos antiguos de documentos rectificados o saldados. Un documento con estado persistido paid puede volver a tener saldo tras una reversión en otro miembro y sigue siendo elegible. El vencimiento y destinatario se toman del documento vigente. La exclusión de avisos sigue configurándose por documento.

## Aplicación y validación

Aplicar BILLING_RECTIFICATION_BALANCES.sql después de COMPANY_MODULES_RPC_COMPLETION.sql y BILLING_DUE_REMINDERS.sql. Publicar también el panel con textos ES/EN, filtro Rectificadas y visualización de crédito por exceso cobrado. La firma pública de get_invoice_financials se conserva. Los helpers nuevos quedan sin ejecución para anon/authenticated; se conserva service_role para el cálculo interno de los workers. No requiere cambio de Edge Functions ni ejecuta correos al aplicar la migración.

Antes de producción: revisar familias existentes, comparar saldos con la persona responsable, comprobar fechas/secuencias heredadas y probar cobros/reversiones y avisos en un entorno controlado. Las familias sin rectificaciones conservan su cálculo. Revisar coste de consulta con volumen representativo: el helper recorre familias de la empresa y se usa también en los procesos de recordatorios. Se añade índice por empresa y factura rectificada.

Las pruebas SQL usan PGlite y la cadena real de facturación. Cubren sustituciones, diferencias, cobros previos, reversiones, exceso cobrado, idempotencia, referencias sucesivas, aislamiento y módulo. Las pruebas de componente verifican explicación, crédito e historial conservado. No constituyen una validación fiscal ni acreditan aplicación en Supabase.
