# Directorio compartido de clientes · entrega 15

Corrección local del hallazgo 14. Pendiente aplicar `CLIENT_DIRECTORY_MODULE_ACCESS.sql` y publicar el panel.

El directorio `client_company` ya se reutiliza desde Facturación y Planning. Antes, su RLS y su trigger exigían Planning, pero las RPC de alta, edición y archivo exigían Facturación. Con un solo módulo activo se producían lecturas vacías o escrituras rechazadas.

## Regla de acceso

| Planning | Facturación | Directorio |
|---|---|---|
| Activo | Inactivo | Lectura y gestión según el rol |
| Inactivo | Activo | Lectura y gestión según el rol |
| Activo | Activo | Lectura y gestión según el rol |
| Inactivo | Inactivo | Sin lectura ni gestión |

La lectura mantiene las políticas de pertenencia a la empresa. Los miembros activos pueden consultar; solo administradores y editores pueden crear, editar y archivar. El administrador de plataforma conserva su acceso transversal, sujeto al bloqueo cuando ambos módulos están desactivados. Miembros suspendidos, usuarios ajenos y anónimos quedan fuera.

Una nueva comprobación privada autoriza las dos RPC existentes. Conservan sus firmas, validación de datos, autoría, empresa y archivo lógico. Se mantienen la inmutabilidad del tenant y las claves foráneas compuestas. Archivar no elimina el cliente ni altera documentos ya guardados.

El trigger se sustituye exclusivamente en `client_company`. Las tareas, movimientos, archivos y avisos siguen exigiendo Planning; el catálogo, facturas, presupuestos, cobros y demás RPC fiscales siguen exigiendo Facturación. Se revocan los permisos directos sobre el directorio y se concede solo lectura al rol autenticado; las escrituras pasan por las RPC. Los helpers nuevos son privados.

El menú y la ruta `/companies` admiten cualquiera de los dos módulos y muestran el estado de módulo desactivado cuando faltan ambos. El directorio deja de ofrecer el enlace a Planning si ese módulo está desactivado. Usa los componentes y traducciones ES/EN existentes; no añade estilos ni cambia la distribución de las tarjetas.

## Aplicación y verificación

1. Contrastar el estado remoto y confirmar `PLANNING_SCHEMA.sql`, `PLANNING_TENANT_HARDENING.sql`, `BILLING_DIRECTORY_CATALOG.sql`, `COMPANY_MEMBER_ACCESS.sql`, `COMPANY_MODULES.sql` y `COMPANY_MODULES_RPC_COMPLETION.sql`. La configuración mantiene el valor por defecto existente para módulos sin fila; verificar las filas y los switches efectivos de cada empresa.
2. Aplicar la nueva migración después de esas dependencias. No reaplicar después los cuerpos originales de directorio ni el trigger/policy antiguo de módulos.
3. Publicar el panel. No necesita cambios de Edge Functions, Storage ni cron.
4. En un entorno controlado, comprobar con dos empresas y usuarios de cada rol: lectura, alta, edición y archivo con cada combinación de módulos; suspensión; IDs ajenos; denegación de Planning con solo Facturación y del catálogo con solo Planning. Verificar permisos efectivos de tabla/RPC y políticas reales de Storage.

## Evidencia local

- 44 pruebas pasan en siete archivos. La nueva suite SQL reproduce los dos bloqueos originales antes de aplicar la corrección y cubre las combinaciones de módulos, RLS, roles, anonimato, permisos directos, helpers privados, validación, archivo y separación de tareas/Storage/catálogo.
- Pruebas de menú, guard de ruta y directorio renderizado con DOM simulado; regresión de directorio/catálogo, seguridad de Planning y servicio de reutilización fiscal.
- ESLint de los archivos JS/JSX modificados y `npm run build` correctos. Persiste el aviso de tamaño de chunks del hallazgo 22, excluido por el usuario.
- No se han ejecutado migraciones ni comprobaciones de permisos remotos. Las pruebas DOM no sustituyen la comprobación visual del panel desplegado en móvil, tablet y escritorio.
