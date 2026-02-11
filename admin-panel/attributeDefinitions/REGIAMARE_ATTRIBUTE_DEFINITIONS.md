# Definiciones de Atributos para RegiaMare

## Información General

**Empresa:** RegiaMare  
**Company ID:** `eac2ccbe-cc36-40cd-bb7e-d5fe44de972d`  
**Sector:** Inmobiliaria - Venta de propiedades residenciales en España  
**Tipo de Item:** `property` (Propiedad inmobiliaria)  
**Total de Atributos:** 66  
**Última actualización:** 2026-02-06

---

## Índice de Contenidos

1. [Resumen Ejecutivo](#resumen-ejecutivo)
2. [Tipos de Datos](#tipos-de-datos)
3. [Atributos Obligatorios](#atributos-obligatorios)
4. [Catálogo Completo de Atributos](#catálogo-completo-de-atributos)
5. [Valores Predefinidos Recomendados](#valores-predefinidos-recomendados)
6. [Guía de Implementación](#guía-de-implementación)
7. [Validaciones Recomendadas](#validaciones-recomendadas)

---

## Resumen Ejecutivo

### Distribución por Requisitos

| Clasificación | Cantidad | Descripción |
|---------------|----------|-------------|
| **Obligatorios** (`is_required = true`) | 11 | Campos esenciales que deben completarse antes de publicar |
| **Filtrables** (`is_filterable = true`) | 5 | Campos que pueden usarse como criterios de búsqueda |
| **Solo Informativos** | 61 | Campos adicionales no filtrables |

### Distribución por Tipo de Dato

| Tipo de Dato | Cantidad | Uso Principal |
|--------------|----------|---------------|
| `text` | 31 | Textos cortos, categorías, descripciones (incluyendo textos largos) |
| `number` | 22 | Valores numéricos (precios, superficies, cantidades) |
| `boolean` | 20 | Valores sí/no (tiene ascensor, terraza, etc.) |
| `text_array` | 2 | Múltiples valores de texto (vistas, características) |
| `date` | 1 | Fechas (disponibilidad) |
---

## Tipos de Datos

### `text`
Cadenas de texto de longitud variable (sin límite en PostgreSQL).
- **Uso:** Nombres, descripciones cortas y largas, categorías
- **Ejemplo:** `"Barcelona"`, `"Piso"`, `"Reformado"`, descripciones extensas multiidioma
- **Nota:** En PostgreSQL, el tipo `text` puede almacenar textos de cualquier longitud (equivalente a `longtext` en MySQL)

### `number`
Valores numéricos (enteros o decimales).
- **Uso:** Precios, superficies, cantidades
- **Ejemplo:** `450000`, `120.5`, `3`

### `boolean`
Valores lógicos verdadero/falso.
- **Uso:** Presencia o ausencia de características
- **Ejemplo:** `true` (tiene ascensor), `false` (no tiene piscina)

### `text_array`
Array/lista de cadenas de texto.
- **Uso:** Características múltiples
- **Ejemplo:** `["Mar", "Montaña", "Panorámicas"]`

### `date`
Fechas en formato ISO.
- **Uso:** Fechas de disponibilidad
- **Ejemplo:** `"2026-03-01"`

---

## Atributos Obligatorios

Estos 11 atributos **DEBEN** completarse antes de publicar una propiedad (cambiar status a `published`):

| # | Key | Label | Tipo | Descripción |
|---|-----|-------|------|-------------|
| 1 | `price` | Precio | `number` | Precio de venta/alquiler en euros |
| 2 | `operation_type` | Tipo de Operación | `text` | Venta, Alquiler, etc. **(FILTRABLE)** |
| 3 | `property_type` | Tipo de Propiedad | `text` | Piso, Casa, Villa, etc. |
| 4 | `province` | Provincia | `text` | Provincia donde se ubica |
| 5 | `city` | Ciudad/Municipio | `text` | Ciudad o municipio |
| 6 | `zone` | Zona | `text` | Zona/barrio específico **(FILTRABLE)** |
| 7 | `built_surface` | Superficie Construida (m²) | `number` | Metros cuadrados construidos |
| 8 | `bedrooms` | Habitaciones | `number` | Número de dormitorios |
| 9 | `bathrooms` | Baños | `number` | Número de baños completos |
| 10 | `condition` | Estado | `text` | Obra Nueva, Reformado, etc. |
| 11 | `description` | Descripción Completa | `text` | Descripción detallada de la propiedad (texto largo) |

---

## Catálogo Completo de Atributos

### 📍 SECCIÓN 1: Información Básica y Ubicación

| Key | Label | Tipo | Req | Filt | Descripción |
|-----|-------|------|-----|------|-------------|
| `price` | Precio | `number` | ✅ | ✅ | Precio en euros |
| `operation_type` | Tipo de Operación | `text` | ✅ | ✅ | Venta/Alquiler/Traspaso **(FILTRABLE)** |
| `property_type` | Tipo de Propiedad | `text` | ✅ | ✅ | Piso/Casa/Villa/Ático |
| `province` | Provincia | `text` | ✅ | ✅ | Barcelona, Madrid, etc. |
| `city` | Ciudad/Municipio | `text` | ✅ | ✅ | Vilanova, Sitges, etc. |
| `zone` | Zona/Barrio | `text` | ✅ | ✅ | Barrio o zona específica **(OBLIGATORIO)** |
| `description` | Descripción Completa (Español) | `text` | ✅ | ❌ | Texto descriptivo extenso (sin límite de longitud) |
| `description_english` | Descripción en Inglés | `text` | ❌ | ❌ | Descripción completa en inglés (opcional, texto largo) |
| `description_french` | Descripción en Francés | `text` | ❌ | ❌ | Descripción completa en francés (opcional, texto largo) |

### 📐 SECCIÓN 2: Superficies y Dimensiones

| Key | Label | Tipo | Req | Filt | Descripción |
|-----|-------|------|-----|------|-------------|
| `built_surface` | Superficie Construida (m²) | `number` | ✅ | ✅ | Metros cuadrados construidos |
| `usable_surface` | Superficie Útil (m²) | `number` | ❌ | ✅ | Metros cuadrados útiles |
| `plot_surface` | Superficie Parcela (m²) | `number` | ❌ | ✅ | Tamaño del terreno |

### 🏠 SECCIÓN 3: Características Principales

| Key | Label | Tipo | Req | Filt | Descripción |
|-----|-------|------|-----|------|-------------|
| `bedrooms` | Habitaciones | `number` | ✅ | ✅ | Número de dormitorios |
| `bathrooms` | Baños | `number` | ✅ | ✅ | Número de baños completos |
| `condition` | Estado | `text` | ✅ | ✅ | Obra Nueva/Reformado/A Reformar |

### 🏢 SECCIÓN 4: Ubicación en Edificio

| Key | Label | Tipo | Req | Filt | Descripción |
|-----|-------|------|-----|------|-------------|
| `floor` | Planta | `text` | ❌ | ✅ | Planta Baja/1ª/2ª/Ático |
| `has_elevator` | Ascensor | `boolean` | ❌ | ✅ | Tiene ascensor |
| `year_built` | Año de Construcción | `number` | ❌ | ✅ | Año de construcción |

### 🚗 SECCIÓN 5: Parking y Almacenamiento

| Key | Label | Tipo | Req | Filt | Descripción |
|-----|-------|------|-----|------|-------------|
| `parking_type` | Tipo de Parking | `text` | ❌ | ✅ | Incluido/No incluido/Opcional |
| `parking_spaces` | Plazas de Parking | `number` | ❌ | ✅ | Número de plazas |
| `has_storage_room` | Trastero | `boolean` | ❌ | ✅ | Tiene trastero |
| `storage_surface` | Superficie Trastero (m²) | `number` | ❌ | ❌ | Tamaño del trastero |

### 🌳 SECCIÓN 6: Espacios Exteriores

| Key | Label | Tipo | Req | Filt | Descripción |
|-----|-------|------|-----|------|-------------|
| `has_terrace` | Terraza | `boolean` | ❌ | ✅ | Tiene terraza |
| `terrace_surface` | Superficie Terraza (m²) | `number` | ❌ | ✅ | Tamaño de la terraza |
| `has_balcony` | Balcón | `boolean` | ❌ | ✅ | Tiene balcón |
| `has_garden` | Jardín | `boolean` | ❌ | ✅ | Tiene jardín |
| `garden_surface` | Superficie Jardín (m²) | `number` | ❌ | ✅ | Tamaño del jardín |
| `has_patio` | Patio | `boolean` | ❌ | ✅ | Tiene patio |

### 🏊 SECCIÓN 7: Piscina

| Key | Label | Tipo | Req | Filt | Descripción |
|-----|-------|------|-----|------|-------------|
| `pool_type` | Piscina | `text` | ❌ | ✅ | Privada/Comunitaria/Infinity/No |

### 🧭 SECCIÓN 8: Orientación y Vistas

| Key | Label | Tipo | Req | Filt | Descripción |
|-----|-------|------|-----|------|-------------|
| `orientation` | Orientación | `text` | ❌ | ✅ | Norte/Sur/Este/Oeste |
| `views` | Vistas | `text_array` | ❌ | ✅ | Array: Mar, Montaña, etc. |
| `is_exterior` | Exterior | `boolean` | ❌ | ✅ | Da a la calle/fachada |

### 🌡️ SECCIÓN 9: Climatización

| Key | Label | Tipo | Req | Filt | Descripción |
|-----|-------|------|-----|------|-------------|
| `heating_type` | Tipo de Calefacción | `text` | ❌ | ✅ | Gas/Eléctrica/Aerotermia |
| `air_conditioning` | Aire Acondicionado | `text` | ❌ | ✅ | Splits/Conductos/No |

### 🍳 SECCIÓN 10: Cocina y Equipamiento

| Key | Label | Tipo | Req | Filt | Descripción |
|-----|-------|------|-----|------|-------------|
| `kitchen_type` | Tipo de Cocina | `text` | ❌ | ✅ | Americana/Office/Independiente |
| `built_in_wardrobes` | Armarios Empotrados | `boolean` | ❌ | ✅ | Tiene armarios empotrados |
| `furnished` | Amueblado | `text` | ❌ | ✅ | Totalmente/Parcial/Sin amueblar |
| `has_fireplace` | Chimenea | `boolean` | ❌ | ✅ | Tiene chimenea |

### ⚡ SECCIÓN 11: Eficiencia Energética

| Key | Label | Tipo | Req | Filt | Descripción |
|-----|-------|------|-----|------|-------------|
| `energy_certificate` | Certificación Energética | `text` | ❌ | ✅ | A/B/C/D/E/F/G |
| `energy_consumption` | Consumo Energético (kWh/m²·año) | `number` | ❌ | ❌ | Consumo anual |
| `co2_emissions` | Emisiones CO₂ (kg/m²·año) | `number` | ❌ | ❌ | Emisiones anuales |

### 💶 SECCIÓN 12: Información Fiscal

| Key | Label | Tipo | Req | Filt | Descripción |
|-----|-------|------|-----|------|-------------|
| `cadastral_reference` | Referencia Catastral | `text` | ❌ | ❌ | Código catastral |
| `ibi_annual` | IBI Anual (€) | `number` | ❌ | ❌ | Impuesto anual |
| `community_fees` | Gastos Comunidad (€/mes) | `number` | ❌ | ✅ | Gastos mensuales |

### ✨ SECCIÓN 13: Características Adicionales

| Key | Label | Tipo | Req | Filt | Descripción |
|-----|-------|------|-----|------|-------------|
| `features` | Características Destacadas | `text_array` | ❌ | ✅ | Array de características |
| `flooring_type` | Tipo de Suelo | `text` | ❌ | ❌ | Parquet/Gres/Mármol |
| `high_ceilings` | Techos Altos | `boolean` | ❌ | ✅ | Techos > 3m |
| `ceiling_height` | Altura Techos (m) | `number` | ❌ | ❌ | Altura en metros |
| `has_concierge` | Portería/Conserje | `boolean` | ❌ | ✅ | Tiene portería |
| `security_type` | Sistema de Seguridad | `text` | ❌ | ✅ | Alarma/Vigilancia/Cámaras |
| `has_home_automation` | Domótica | `boolean` | ❌ | ✅ | Sistema domótico |
| `wheelchair_accessible` | Accesible Movilidad Reducida | `boolean` | ❌ | ✅ | Adaptado PMR |

### 🏋️ SECCIÓN 14: Servicios Comunitarios

| Key | Label | Tipo | Req | Filt | Descripción |
|-----|-------|------|-----|------|-------------|
| `has_gym` | Gimnasio | `boolean` | ❌ | ✅ | Gimnasio comunitario |
| `has_playground` | Zona Infantil | `boolean` | ❌ | ✅ | Área de juegos |
| `has_paddle_tennis` | Pádel/Tenis | `boolean` | ❌ | ✅ | Pistas deportivas |
| `has_communal_gardens` | Jardines Comunitarios | `boolean` | ❌ | ✅ | Zonas verdes comunes |

### 📋 SECCIÓN 15: Uso y Disponibilidad

| Key | Label | Tipo | Req | Filt | Descripción |
|-----|-------|------|-----|------|-------------|
| `has_tourist_license` | Licencia Turística | `boolean` | ❌ | ✅ | Tiene licencia turística |
| `tourist_license_number` | Nº Licencia Turística | `text` | ❌ | ❌ | Número de licencia |
| `available_from` | Disponible Desde | `date` | ❌ | ❌ | Fecha disponibilidad |
| `pets_allowed` | Se Admiten Mascotas | `boolean` | ❌ | ✅ | Permite mascotas |

### 🏷️ SECCIÓN 16: Información Interna

| Key | Label | Tipo | Req | Filt | Descripción |
|-----|-------|------|-----|------|-------------|
| `internal_reference` | Referencia | `text` | ❌ | ❌ | Código interno |
| `additional_notes` | Notas Adicionales | `text` | ❌ | ❌ | Notas internas |
| `previous_price` | Precio Anterior | `number` | ❌ | ❌ | Para tracking de cambios |
| `assigned_agent` | Agente Asignado | `text` | ❌ | ❌ | Nombre del agente |
| `is_exclusive` | En Exclusiva | `boolean` | ❌ | ✅ | Exclusiva de RegiaMare |
| `is_featured` | Propiedad Destacada | `boolean` | ❌ | ✅ | Destacar en web |

---

## Valores Predefinidos Recomendados

Para mejorar la experiencia de usuario y mantener consistencia, se recomienda usar valores predefinidos (selectores) en el frontend para estos campos:

### `operation_type` - Tipo de Operación ⚠️ OBLIGATORIO Y FILTRABLE
```javascript
const operationTypes = [
  "Venta",
  "Alquiler",
  "Alquiler Vacacional",
  "Traspaso"
];
```

### `property_type` - Tipo de Propiedad
```javascript
const propertyTypes = [
  "Piso",
  "Casa",
  "Casa Pareada",
  "Villa",
  "Chalet",
  "Ático",
  "Dúplex",
  "Planta Baja",
  "Estudio",
  "Loft",
  "Masía",
  "Finca Rústica",
  "Local Comercial",
  "Oficina",
  "Nave Industrial",
  "Terreno",
  "Garaje",
  "Trastero"
];
```

### `condition` - Estado
```javascript
const conditions = [
  "Obra Nueva",
  "A Estrenar",
  "Reformado",
  "Buen Estado",
  "Para Entrar a Vivir",
  "A Reformar",
  "Necesita Reforma"
];
```

### `floor` - Planta
```javascript
const floors = [
  "Sótano",
  "Semisótano",
  "Planta Baja",
  "Entresuelo",
  "1ª Planta",
  "2ª Planta",
  "3ª Planta",
  "4ª Planta",
  "5ª Planta",
  "6ª Planta",
  "7ª Planta",
  "8ª Planta",
  "Ático",
  "Sobreático"
];
```

### `parking_type` - Tipo de Parking
```javascript
const parkingTypes = [
  "Incluido en Precio",
  "No Incluido en Precio",
  "Opcional",
  "Garaje Privado",
  "Garaje Comunitario",
  "Plaza de Calle",
  "Sin Parking"
];
```

### `pool_type` - Piscina
```javascript
const poolTypes = [
  "Privada",
  "Comunitaria",
  "Privada Infinity",
  "Privada Climatizada",
  "Comunitaria Climatizada",
  "Sin Piscina"
];
```

### `orientation` - Orientación
```javascript
const orientations = [
  "Norte",
  "Sur",
  "Este",
  "Oeste",
  "Noreste",
  "Noroeste",
  "Sureste",
  "Suroeste"
];
```

### `views` - Vistas (Multi-selección)
```javascript
const viewTypes = [
  "Mar",
  "Montaña",
  "Ciudad",
  "Parque",
  "Jardín",
  "Panorámicas",
  "Despejadas",
  "Playa",
  "Bosque",
  "Campo",
  "Río",
  "Lago",
  "Patio Interior",
  "Calle"
];
```

### `heating_type` - Tipo de Calefacción
```javascript
const heatingTypes = [
  "Individual Gas Natural",
  "Central",
  "Radiadores Gas",
  "Aerotermia Suelo Radiante",
  "Bomba de Calor",
  "Eléctrica",
  "Gasoil",
  "Pellets",
  "Suelo Radiante",
  "No"
];
```

### `air_conditioning` - Aire Acondicionado
```javascript
const airConditioningTypes = [
  "Splits",
  "Conductos Centralizado",
  "Bomba de Calor",
  "Preinstalación",
  "Cassette",
  "No"
];
```

### `kitchen_type` - Tipo de Cocina
```javascript
const kitchenTypes = [
  "Americana Equipada",
  "Americana Abierta",
  "Office Equipada",
  "Office con Isla",
  "Independiente Equipada",
  "Integrada",
  "Rústica",
  "Sin Equipar"
];
```

### `furnished` - Amueblado
```javascript
const furnishedOptions = [
  "Totalmente Amueblado",
  "Parcialmente Amueblado",
  "Sin Amueblar",
  "Opcional"
];
```

### `energy_certificate` - Certificación Energética
```javascript
const energyCertificates = [
  "A",
  "B",
  "C",
  "D",
  "E",
  "F",
  "G",
  "En Trámite",
  "Exento"
];
```

### `flooring_type` - Tipo de Suelo
```javascript
const flooringTypes = [
  "Parquet",
  "Gres",
  "Mármol",
  "Hidráulicos",
  "Piedra Natural",
  "Terrazo",
  "Laminado",
  "Porcelánico",
  "Tarima",
  "Cerámica"
];
```

### `security_type` - Sistema de Seguridad
```javascript
const securityTypes = [
  "Alarma",
  "Vigilancia 24h",
  "Cámaras de Seguridad",
  "Puerta Blindada",
  "Video Portero",
  "Control de Acceso",
  "No"
];
```

### `features` - Características Destacadas (Multi-selección)
```javascript
const features = [
  "Luminoso",
  "Exterior",
  "Primera Línea Playa",
  "Vistas al Mar",
  "Reformado",
  "Obra Nueva",
  "Finca Regia",
  "Garaje Incluido",
  "Trastero Incluido",
  "Portería",
  "Seguridad 24h",
  "Domótica",
  "Placas Solares",
  "Aerotermia",
  "Piscina Privada",
  "Piscina Comunitaria",
  "Jardín Privado",
  "Zona Infantil",
  "Gimnasio",
  "Cerca de Colegios",
  "Cerca del Mar",
  "Bien Comunicado",
  "Céntrico",
  "Zona Tranquila",
  "Parking Privado",
  "Terraza Amplia",
  "Balcón",
  "Ascensor",
  "Aire Acondicionado",
  "Calefacción",
  "Chimenea",
  "Armarios Empotrados",
  "Cocina Equipada",
  "Amueblado",
  "Mascotas Permitidas",
  "Licencia Turística"
];
```

---

## Guía de Implementación

### 1. Orden de Creación de Items

Cuando un usuario crea una nueva propiedad, el flujo recomendado es:

1. **Crear item base** con status `draft`
2. **Completar campos obligatorios** (mínimo los 10 obligatorios)
3. **Añadir campos opcionales** según disponibilidad
4. **Subir imágenes** (mínimo 1 imagen de portada)
5. **Cambiar status a `published`** cuando todo esté listo

### 2. Validación al Publicar

Antes de permitir cambiar el status de `draft` a `published`, validar:

```javascript
// Validación mínima para publicar
const requiredAttributes = [
  'price',
  'operation_type',  // AHORA FILTRABLE
  'property_type',
  'province',
  'city',
  'zone',  // OBLIGATORIO desde 2026-02-06
  'built_surface',
  'bedrooms',
  'bathrooms',
  'condition',
  'description'  // Descripción principal en español
  // description_english y description_french son OPCIONALES
];

// Además validar:
- Al menos 1 imagen de portada en item_media
- price > 0
- built_surface > 0
- bedrooms >= 0
- bathrooms >= 0
```

### 3. Filtros de Búsqueda Más Comunes

Implementar estos filtros en orden de prioridad:

**Prioridad Alta (5 filtros principales):**
1. Rango de precio (`price`) ⭐ FILTRABLE
2. Tipo de operación (`operation_type`) ⭐ FILTRABLE Y OBLIGATORIO
3. Ubicación geográfica (`zone`) ⭐ FILTRABLE Y OBLIGATORIO
4. Habitaciones mínimas (`bedrooms`) ⭐ FILTRABLE
5. Tipo de propiedad (`property_type`) ⭐ FILTRABLE

**Filtros Adicionales (No activos por defecto):**
6. Superficie mínima (`built_surface`)
7. Ubicación (`province`, `city`)

**Prioridad Media:**
6. Superficie mínima (`built_surface`)
7. Tipo de operación (`operation_type`)
8. Estado (`condition`)
9. Planta (`floor`)
10. Parking (`parking_spaces`)

**Prioridad Baja (Filtros Avanzados):**
11. Piscina (`pool_type`)
12. Terraza (`has_terrace`)
13. Jardín (`has_garden`)
14. Vistas (`views`)
15. Orientación (`orientation`)
16. Características (`features`)

### 4. Visualización en Listados

**Card de Propiedad (Vista Mínima):**
- Imagen de portada
- `price`
- `property_type`
- `city`
- `built_surface`
- `bedrooms`
- `bathrooms`

**Vista Detallada:**
- Agrupar atributos por secciones (ubicación, características, equipamiento, etc.)
- Mostrar solo atributos con valor
- Usar iconos para boolean (`true` = ✓, `false` = ✗ o no mostrar)

### 5. Integración con Portales Inmobiliarios

Este esquema es compatible con exportación a:

- **Idealista**
- **Fotocasa**
- **Habitaclia**
- **Pisos.com**
- **Portales internacionales:** Green-Acres, Kyero, A Place in the Sun

Mapeo directo de campos sin necesidad de transformaciones complejas.

---

## Validaciones Recomendadas

### Validaciones de Backend (PostgreSQL)

```sql
-- Precio positivo
CHECK (price > 0)

-- Superficie positiva
CHECK (built_surface > 0)

-- Habitaciones no negativas
CHECK (bedrooms >= 0)

-- Baños no negativos
CHECK (bathrooms >= 0)

-- Año de construcción válido
CHECK (year_built >= 1800 AND year_built <= EXTRACT(YEAR FROM CURRENT_DATE))

-- Certificación energética válida
CHECK (energy_certificate IN ('A', 'B', 'C', 'D', 'E', 'F', 'G', 'En Trámite', 'Exento') OR energy_certificate IS NULL)

-- Superficie útil no mayor que construida
CHECK (usable_surface <= built_surface OR usable_surface IS NULL)
```

### Validaciones de Frontend (JavaScript)

```javascript
// Validación de precio
const validatePrice = (price) => {
  if (!price || price <= 0) {
    return "El precio debe ser mayor que 0";
  }
  if (price > 100000000) {
    return "El precio parece excesivamente alto";
  }
  return null;
};

// Validación de superficie
const validateSurface = (surface, min = 10, max = 10000) => {
  if (!surface || surface < min) {
    return `La superficie debe ser al menos ${min} m²`;
  }
  if (surface > max) {
    return `La superficie no puede superar ${max} m²`;
  }
  return null;
};

// Validación de habitaciones
const validateBedrooms = (bedrooms) => {
  if (bedrooms < 0 || bedrooms > 20) {
    return "El número de habitaciones debe estar entre 0 y 20";
  }
  return null;
};

// Validación de año construcción
const validateYearBuilt = (year) => {
  const currentYear = new Date().getFullYear();
  if (year < 1800 || year > currentYear + 2) {
    return `El año debe estar entre 1800 y ${currentYear + 2}`;
  }
  return null;
};
```

---

## Notas Finales

### Multi-idioma

Los **labels** están en español. Para implementación multi-idioma:
- Los labels deben traducirse en el **frontend** (archivos i18n)
- La base de datos mantiene solo las **keys** (invariantes)
- Los **valores** también pueden requerir traducción según el caso

### Extensibilidad

Este esquema es fácilmente extensible:
- Se pueden añadir nuevos atributos sin modificar items existentes
- Los atributos opcionales permiten flexibilidad
- Los arrays (`text_array`) permiten características múltiples sin duplicar filas

### Buenas Prácticas

1. **No usar atributos como categorías rígidas** - Usar valores predefinidos en frontend pero almacenar como texto
2. **Mantener descripciones ricas** - El campo `description` es crítico para SEO y experiencia del usuario
3. **Arrays para características** - Usar `features` y `views` para características múltiples
4. **Validar antes de publicar** - Asegurar calidad de datos antes de status `published`
5. **Imágenes obligatorias** - Mínimo 1 portada, recomendado 5-15 imágenes por propiedad

---

## Changelog

**Versión 1.0** - 2026-02-05
- Definición inicial de 64 atributos para RegiaMare
- Basado en análisis de Premium Houses, Durán Carasso y Apple Houses
- Compatible con estándares del mercado inmobiliario español

**Versión 1.1** - 2026-02-06
- ✅ Añadido `description_english` (Descripción en inglés) - Opcional, texto largo
- ✅ Añadido `description_french` (Descripción en francés) - Opcional, texto largo
- ✅ Actualizado `operation_type`: Ahora es **FILTRABLE y OBLIGATORIO**
- ✅ Confirmado que `zone` es **OBLIGATORIO** (desde versión anterior)
- ⚠️ Total de atributos: 66 (antes 64)
- ⚠️ Atributos obligatorios: 11 (antes 10)
- ⚠️ Atributos filtrables: 5 (price, operation_type, zone, bedrooms, property_type)
- 📝 Nota sobre tipos de datos: `text` en PostgreSQL soporta textos de longitud ilimitada
---

## Contacto y Soporte

Para consultas sobre las definiciones de atributos o sugerencias de mejora:
- Revisar archivo SQL: `RegiaMare.sql`
- Contactar al equipo de desarrollo

---

**© 2026 RegiaMare - Sistema de Gestión Inmobiliaria**
