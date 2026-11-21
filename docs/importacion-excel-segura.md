# Importación de atributos Excel · entrega 10

## Dependencia y procedencia

Se sustituye SheetJS 0.18.5 por 0.20.3 de su distribución oficial, conservada sin modificar en admin-panel/vendor/xlsx-0.20.3.tgz. package.json referencia el tarball local; package-lock.json fija su integridad. Licencia Apache-2.0 incluida. npm ls xlsx verifica que solo está instalada 0.20.3. Las ocho dependencias antiguas eliminadas por npm eran exclusivas del paquete anterior.

Fuentes: https://docs.sheetjs.com/docs/getting-started/installation/frameworks/ ; https://github.com/advisories/GHSA-4r6h-8v6p-xvw6 ; https://github.com/advisories/GHSA-5pgg-2g8v-p4x9 . Los avisos afectan a versiones anteriores a 0.19.3 y 0.20.2 respectivamente. Esta revisión no acredita ausencia de cualquier vulnerabilidad futura ni sustituye la revisión del resto de dependencias.

## Límites y comportamiento

- Solo .xlsx y .xls no vacíos de hasta 2 MiB. Se comprueba extensión y contenedor ZIP/OLE; el MIME declarado no se usa como autoridad.
- Lectura en worker independiente, cancelado a los 10 segundos, sin ejecutar fórmulas ni realizar operaciones de red con datos del documento. Un navegador sin Worker falla sin recurrir a lectura bloqueante.
- Antes de inflar XLSX, se inspecciona el directorio ZIP: hasta 128 entradas, 8 MiB de tamaño expandido declarado, relación máxima 200:1 y sin cifrado/ZIP64 o compresiones no admitidas. Estos límites de metadatos y tiempo no constituyen una cuota absoluta de memoria del sistema.
- Primera hoja, cuatro columnas de plantilla, hasta 500 atributos y rango máximo de 505 filas contando encabezado/ejemplos/notas. No se procesa silenciosamente un recorte de filas.
- Nombres de texto de hasta 200 caracteres sin controles, únicos sin distinguir mayúsculas; tipos existentes de la plantilla, indicadores SI/NO o YES/NO y booleanos equivalentes. Se rechazan fórmulas y filas inválidas sin aplicar resultados parciales. No se importan ejemplos ni la nota informativa de la plantilla.
- Fallos de lectura, worker, formato, estructura o tiempo se comunican en ES/EN. Un error conserva el borrador existente; un éxito sustituye las filas como antes. Reintentar permite elegir el mismo archivo.
- Nuevo archivo, reset/cierre del borrador, cambio de empresa/tipo y desmontaje cancelan la lectura pendiente. Los archivos no se suben a ningún servidor.

La plantilla conserva sus columnas, ejemplos y descarga diferida. Las validaciones del servidor al guardar atributos siguen siendo necesarias; un parser en navegador no otorga permisos de escritura.

## Comprobaciones y despliegue

Pruebas con la librería real generan XLSX y XLS BIFF8; verifican límites, fórmulas, nombres/filas, directorio ZIP manipulado y plantilla exportada/importada. Pruebas del coordinador simulan Worker para comprobar transferencia, terminación, timeout, abort y fallos. Pruebas del hook comprueban cancelación por contexto y conservación del trabajo. La simulación no sustituye una prueba de interacción con Worker nativo en navegador.

Publicar el panel completo, incluyendo el asset del worker generado por Vite. Si existe una CSP externa, debe permitir workers del propio origen. Verificar importación válida, rechazo por tamaño, cancelación y exportación de plantilla en entorno controlado. No requiere SQL ni despliegue Edge. Conservar vendor y lockfile al construir; no hace falta red hacia SheetJS durante npm ci ni en ejecución.
