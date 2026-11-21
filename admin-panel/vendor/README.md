# SheetJS Community Edition 0.20.3

Distribución oficial: https://cdn.sheetjs.com/xlsx-0.20.3/xlsx-0.20.3.tgz

Instrucciones del fabricante: https://docs.sheetjs.com/docs/getting-started/installation/frameworks/

Archivo original sin modificar: xlsx-0.20.3.tgz (2.409.319 bytes).
SHA-256: 8dc73fc3b00203e72d176e85b50938627c7b086e607c682e8d3c22c02bb99fe8
La integridad SHA-512 queda fijada además en package-lock.json.

Licencia Apache-2.0: copia en SheetJS-LICENSE.txt y dentro del paquete. La dependencia se instala como file:vendor/xlsx-0.20.3.tgz; conservar este archivo en el repositorio y en el contexto de build para npm ci. No requiere descargar código del CDN en el navegador.

La versión del registro npm xlsx 0.18.5 es antigua. No reemplazar esta dependencia por ^0.18.5: se reintroducirían CVE-2023-30533 (<0.19.3) y CVE-2024-22363 (<0.20.2). Para actualizar, verificar distribución, licencia, avisos y hash; renovar paquete local y lockfile y ejecutar las pruebas reales XLSX/XLS/exportación y la compilación del worker.
