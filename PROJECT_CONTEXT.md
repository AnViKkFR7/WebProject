# Contexto global del proyecto web

Este archivo define el **contexto, objetivos, stack tecnológico y principios de diseño** del proyecto.
Debe ser tenido en cuenta **en todos los prompts posteriores** relacionados con el desarrollo de esta aplicación.

---

## 1. Objetivo general

El objetivo es construir una **plataforma web altamente genérica y reutilizable**, capaz de servir como base para múltiples tipos de negocios (inmobiliarias, restaurantes, tiendas, etc.) **sin modificar el modelo de datos**.

La idea central es:

* Diseñar un **backend + base de datos genéricos**
* Poder crear **múltiples frontends especializados** que consuman ese mismo backend
* Cambiar únicamente la configuración y la presentación, no la estructura de datos

---

## 2. Stack tecnológico

### Backend y Base de Datos

* **Supabase**

  * PostgreSQL como base de datos
  * Auth de Supabase para autenticación de usuarios
  * Políticas RLS (Row Level Security)
  * Storage (si es necesario para imágenes u otros assets)

### Frontend

* **Remix**
* **Vite**
* **React**
* **TypeScript**
* Arquitectura moderna basada en componentes y hooks

### Infraestructura

* **Repositorio**: GitHub
* **Deploy**: Vercel
* Enfoque CI/CD sencillo y automático desde GitHub

---

## 3. Principios clave de arquitectura

1. **Modelo de datos genérico**

   * El backend debe permitir almacenar cualquier tipo de elemento:

     * Propiedades inmobiliarias
     * Platos de restaurante
     * Productos de una tienda
     * Otros tipos futuros
   * No se deben crear tablas específicas por sector.
   * La especialización ocurre en el frontend.

2. **Multi-tenant**

   * Un usuario puede pertenecer a una o varias empresas.
   * Cada empresa tiene sus propios datos y elementos.
   * Los datos están completamente aislados entre empresas.

3. **Escalabilidad funcional**

   * El mismo backend debe poder alimentar:

     * Una web inmobiliaria
     * Un catálogo de restaurante
     * Una tienda online
   * El frontend decide:

     * Qué atributos mostrar
     * Cómo filtrarlos
     * Cómo presentarlos

---

## 4. Modelo conceptual de datos (alto nivel)

### Usuarios

* Autenticados mediante Supabase Auth (`auth.users`)
* El email y credenciales viven únicamente en `auth.users`
* Los datos de perfil (nombre, teléfono, avatar) viven en `company_members`
* Pueden pertenecer a una o varias empresas
* Pueden tener diferentes perfiles (nombre, etc.) en cada empresa

### Empresas

* Representan un negocio (inmobiliaria, restaurante, tienda, etc.)
* Tienen:

  * Información básica (nombre, logo, descripción, contacto)
  * Un conjunto de elementos genéricos asociados
  * Miembros con perfiles y roles específicos

### Elementos genéricos

* Representan cualquier cosa que se quiera mostrar en la web
* Ejemplos:

  * Propiedades
  * Productos
  * Platos
* Cada elemento:

  * Pertenece a una empresa
  * Tiene atributos dinámicos (ej: precio, ubicación, tamaño, categoría)
  * Tiene atributos destacados usados para filtros y listados

### Nota importante sobre el modelo de usuarios

**No existe tabla `user_profiles` independiente.**

Los datos de perfil del usuario (nombre completo, teléfono, avatar) están almacenados en la tabla `company_members`, lo que significa:

* Un usuario solo "existe" en el contexto de una empresa
* Un mismo usuario puede tener diferentes nombres/perfiles en diferentes empresas (útil para multi-tenant)
* El email es único y vive solo en `auth.users` (Supabase Auth)
* Los datos de autenticación están completamente separados de los datos de perfil

Esta arquitectura:
- Elimina duplicación de datos (especialmente email)
- Simplifica la gestión de usuarios por parte de editores
- Permite perfiles contextualizados por empresa
- Mantiene la autenticación centralizada en Supabase Auth

---

## 5. Autenticación, roles y permisos

La aplicación utiliza un **sistema de roles simple y estricto**, alineado con el modelo **multi-tenant** descrito en el punto 2, garantizando aislamiento entre empresas y reutilización del backend.

---

### 5.1 Roles disponibles

Solo existen **tres roles** en todo el sistema:

#### Admin
- Permisos completos **(read, write, delete)** sobre **todas las tablas**.
- Puede:
  - Crear nuevas empresas.
  - Acceder y modificar datos de cualquier empresa.
  - Asignar y modificar roles de cualquier usuario.
- Es el **único rol** que puede:
  - Cambiar el rol de un usuario.
  - Elevar o degradar permisos.

---

#### Editor
- Permisos **(read, write, delete)** únicamente sobre las tablas relacionadas con **su propia empresa**.
- **No puede**:
  - Acceder a información de otras empresas.
  - Modificar la tabla global de usuarios.
  - Crear nuevas empresas.
- **Sí puede**:
  - Gestionar los elementos, atributos y contenidos de su empresa.
  - Crear usuarios de tipo **Viewer** asociados exclusivamente a su empresa.

---

#### Viewer
- Permisos de **solo lectura (read)** sobre las tablas de **su propia empresa**.
- No puede:
  - Crear, modificar ni eliminar datos.
  - Gestionar usuarios.
  - Acceder a información de otras empresas.

---

### 5.2 Gestión de empresas y usuarios

- **Creación de empresas**
  - Solo el **Admin** puede crear nuevas empresas.
- **Asignación de usuarios a empresas**
  - Un usuario puede pertenecer a una o varias empresas.
  - En cada empresa tendrá un rol específico (editor o viewer).
- **Creación de usuarios**
  - El **Admin** puede crear usuarios de cualquier rol.
  - Un **Editor** solo puede crear usuarios **Viewer** y únicamente para su propia empresa.
- **Cambios de rol**
  - Cualquier cambio de rol de un usuario **solo puede ser realizado por un Admin**.

Este modelo garantiza:
- Control centralizado de permisos.
- Delegación limitada y segura.
- Aislamiento total entre empresas.

---

### 5.3 Visibilidad de la información de usuario

- Cada usuario puede ver:
  - Su propia información.
  - Las empresas a las que pertenece.
  - Su rol dentro de cada empresa.
- Los **Editores** de una empresa pueden ver:
  - Los usuarios asociados a su empresa.
  - El rol de cada uno dentro de esa empresa.
- Nunca es visible:
  - Información de usuarios de otras empresas.
  - Roles fuera del contexto de la empresa compartida.

---

### 5.4 Acceso público a contenidos publicados

Los siguientes contenidos deben ser **públicamente accesibles**, sin necesidad de autenticación:

- Items genéricos.
- Entidades derivadas de items (atributos, categorías, etc.).
- Blog posts / artículos.

Condición obligatoria:
- status = 'published'

#### Reglas

- El acceso público es **solo de lectura**.
- Los contenidos en estado:
  - `draft`
  - `private`
  - `archived`
  
  **no son públicos**.
- El frontend puede consumir estos datos **sin sesión activa**.
- El backend debe garantizar este comportamiento mediante **políticas RLS explícitas**.

---

### 5.5 Auditoría y trazabilidad de cambios

Todas las tablas del sistema deben incluir los siguientes campos estándar:

- `created_by`
  - Referencia al usuario que creó el registro.
- `last_edited_by`
  - Referencia al usuario que realizó la última modificación.

#### Objetivos

- Trazabilidad completa de cambios.
- Auditoría por empresa y por usuario.
- Base para futuras funcionalidades como:
  - Historial de cambios.
  - Logs administrativos.
  - Análisis de actividad.

---

### 5.6 Consideraciones de seguridad (RLS)

Todas las reglas de acceso se implementan mediante **Row Level Security (RLS)** en Supabase.

#### Principios clave

- Un usuario solo puede acceder a filas de empresas a las que pertenece.
- Los permisos dependen del rol del usuario dentro de la empresa.
- El rol **nunca se confía al frontend**, siempre se valida en la base de datos.


---

## 6. Frontend inicial: Web inmobiliaria

El primer frontend que se construirá es una **web para una inmobiliaria**, utilizando el backend genérico.

### Estructura del frontend

#### Landing Page

* Logo de la marca
* Descripción clara del valor de la empresa
* Llamadas a la acción principales

#### Ventana de servicios

* Qué servicios ofrece la inmobiliaria
* Enfoque comercial y de confianza

#### Ventana de compras (propiedades en cartera)

* Listado de propiedades en venta
* Información clave visible:

  * Precio
  * Ubicación
  * Tipo de propiedad
  * Superficie
  * Habitaciones
* Navegación clara y usable

#### Ventana de ventas

* Sección orientada a propietarios
* Mensaje tipo:
  **“¿Quieres vender tu propiedad?”**
* Explicación del proceso y beneficios

#### Formulario de contacto

* Para solicitar:

  * Valoración gratuita
  * Contacto sin compromiso
* Integrado con el backend

---

## 7. Filtros de búsqueda (inmobiliaria)

La ventana de compras debe incluir filtros específicos del sector inmobiliario, como:

* Rango de precio
* Ubicación
* Tipo de propiedad
* Número de habitaciones
* Superficie
* Otros atributos relevantes

Estos filtros se basan en los **atributos genéricos del modelo**, no en campos hardcodeados.

---

## 8. Filosofía de desarrollo

* Código limpio, tipado y mantenible
* Prioridad a la reutilización
* Evitar lógica específica de negocio en el backend
* El frontend interpreta y presenta los datos
* Pensar siempre en:

  > “¿Esto seguirá funcionando si mañana el negocio no es una inmobiliaria?”

---

## 9. Expectativas para la IA asistente

Cuando se genere código, arquitectura o sugerencias:

* Debe respetar este contexto
* Debe priorizar soluciones genéricas y escalables
* Debe evitar decisiones que acoplen el backend a un único sector
* Debe usar TypeScript de forma estricta
* Debe alinearse con Supabase + Remix como stack principal

---

## 10. Principios de interfaz de usuario

**Todo lo desarrollado en el proyecto debe cumplir con:**

* **Responsive design**: La interfaz debe adaptarse correctamente a todos los tamaños de pantalla (móvil, tablet, desktop)
* **Modo claro/oscuro**: Toda la interfaz debe soportar ambos modos de visualización sin pérdida de usabilidad o legibilidad
* **Internacionalización (i18n)**: Todos los textos fijos de la interfaz deben estar traducidos al español e inglés
  * Los textos se gestionan a través del sistema de traducciones en `/src/locales/`
  * Se utiliza el contexto `LanguageContext` para cambiar entre idiomas
  * Los usuarios pueden cambiar el idioma desde el botón en la barra superior (entre el perfil y cerrar sesión)
  * La preferencia de idioma se guarda en localStorage
  * Todos los componentes nuevos deben usar el hook `useLanguage()` y la función `t()` para mostrar textos traducidos
* Los componentes deben diseñarse pensando en estos requisitos desde el inicio

---

## 11. Panel de administración - Especificaciones por módulo

### 11.1 Módulo de Items (/items)

El módulo de gestión de items es el núcleo del panel de administración. Permite crear, editar, filtrar y visualizar todos los elementos genéricos de la compañía.

#### Estructura de la pantalla

1. **Tabla de items**
   * Muestra todos los items de la compañía del usuario autenticado
   * Paginación tanto en frontend como en el servicio backend
   * Columnas visibles: Título, Tipo, Estado, Actualizado
   * Ordenación y filtrado integrados

2. **Sistema de filtros**
   
   **Filtros fijos (siempre visibles):**
   * **Status (Estado)**: Multi-selección de estados (draft, published, archived)
   * **Item Type (Tipo de ítem)**: Multi-selección de tipos de item
   * **Created By**: Ordenación por fecha de creación (ascendente/descendente)
   
   **Filtros avanzados (configurables):**
   * Basados en los `attribute_definitions` de la compañía
   * Flujo de configuración:
     1. Usuario activa "Filtros avanzados"
     2. Se muestra lista de definiciones con checkboxes
     3. Usuario selecciona las definiciones que desea usar como filtros
     4. Se cierra/minimiza el selector y aparecen los filtros seleccionados
     5. Todos los filtros son multi-seleccionables con búsqueda por texto
   * **Persistencia**: La selección de filtros avanzados se guarda en base de datos por usuario
   * Al volver a entrar, se cargan los filtros previamente configurados
   
   **Reseteo de filtros:**
   * Botón "Borrar filtros" que limpia todos los filtros (fijos y avanzados)
   * Realiza una búsqueda sin filtros (solo paginación)

3. **Acciones principales**
   
   * **Botón "Nuevo Item"**: Abre un popup/modal con formulario de creación
     * Incluye todos los campos de `items`: title, summary, status, item_type
     * Incluye campos dinámicos según las `attribute_definitions` del tipo seleccionado
     * Validación según `is_required` de cada definición
     * Por ahora omite la gestión de media (se añadirá más adelante)
   
   * **Botón "Importar"**: Eliminado de la interfaz (funcionalidad futura)

#### Requisitos técnicos

* Servicio backend con paginación real (no solo frontend)
* Query eficiente que combine items, attribute_definitions y attribute_values
* Gestión de estado para filtros activos
* Integración con Supabase para persistir preferencias de filtros
* Formularios dinámicos basados en definiciones de atributos

---

## 12. Definiciones de Atributos para Propiedades Inmobiliarias

Esta sección documenta los atributos estándar definidos para propiedades inmobiliarias, basados en análisis de inmobiliarias reales (Premium Houses, Duran Carasso). Estos atributos sirven como referencia para implementaciones futuras.

### 12.1 Clasificación de Atributos

Los atributos se clasifican según dos criterios independientes:

- **is_required**: El atributo debe tener valor obligatoriamente al crear/publicar un item
- **is_filterable**: El atributo puede usarse como criterio de búsqueda/filtrado

### 12.2 Atributos Básicos (Obligatorios + Filtrables)

Estos atributos son fundamentales para cualquier propiedad y se usan siempre en búsquedas:

| Key | Label | Data Type | Required | Filterable | Descripción |
|-----|-------|-----------|----------|------------|-------------|
| `price` | Precio | number | ✅ | ✅ | Precio de venta o alquiler en euros |
| `province` | Provincia | text | ✅ | ✅ | Provincia donde se ubica (Barcelona, Madrid, etc.) |
| `city` | Ciudad/Municipio | text | ✅ | ✅ | Ciudad o municipio |
| `property_type` | Tipo de Propiedad | text | ✅ | ✅ | Piso, Casa, Villa, Ático, etc. |
| `built_surface` | Superficie Construida (m²) | number | ✅ | ✅ | Superficie total construida |
| `bedrooms` | Habitaciones | number | ✅ | ✅ | Número de dormitorios |
| `bathrooms` | Baños | number | ✅ | ✅ | Número de baños completos |
| `condition` | Estado | text | ✅ | ✅ | Obra Nueva, Reformado, A Reformar, etc. |
| `operation_type` | Operación | text | ✅ | ✅ | Venta, Alquiler, Traspaso |

### 12.3 Atributos de Ubicación (Opcionales + Filtrables)

| Key | Label | Data Type | Required | Filterable |
|-----|-------|-----------|----------|------------|
| `zone` | Zona/Barrio | text | ❌ | ✅ |
| `usable_surface` | Superficie Útil (m²) | number | ❌ | ✅ |

### 12.4 Atributos de Características Principales (Filtrables)

Características que los usuarios suelen buscar activamente:

| Key | Label | Data Type | Required | Filterable |
|-----|-------|-----------|----------|------------|
| `floor` | Planta | text | ❌ | ✅ |
| `has_elevator` | Ascensor | boolean | ❌ | ✅ |
| `parking_type` | Tipo de Parking | text | ❌ | ✅ |
| `parking_spaces` | Plazas de Parking | number | ❌ | ✅ |
| `has_terrace` | Terraza | boolean | ❌ | ✅ |
| `terrace_surface` | Superficie Terraza (m²) | number | ❌ | ✅ |
| `has_garden` | Jardín | boolean | ❌ | ✅ |
| `pool_type` | Piscina | text | ❌ | ✅ |
| `orientation` | Orientación | text | ❌ | ✅ |

**Valores típicos:**
- `parking_type`: "Incluido en precio", "No incluido", "Garaje privado", "Comunitario"
- `pool_type`: "Privada", "Comunitaria", "Privada infinity", "Sin piscina"
- `orientation`: "Norte", "Sur", "Este", "Oeste", "Norte-Sur", "Este-Oeste", etc.
- `floor`: "Planta baja", "1ª planta", "2ª planta", "Ático", "Sótano", etc.

### 12.5 Atributos Técnicos y Legales

Información importante pero menos usada en filtros de búsqueda:

| Key | Label | Data Type | Required | Filterable |
|-----|-------|-----------|----------|------------|
| `year_built` | Año de Construcción | number | ❌ | ✅ |
| `energy_certificate` | Certificación Energética | text | ❌ | ✅ |
| `energy_consumption` | Consumo Energético (kWh/m²·año) | number | ❌ | ❌ |
| `co2_emissions` | Emisiones CO₂ (kg/m²·año) | number | ❌ | ❌ |
| `cadastral_reference` | Referencia Catastral | text | ❌ | ❌ |
| `ibi_annual` | IBI Anual (€) | number | ❌ | ❌ |
| `community_fees` | Gastos Comunidad (€/mes) | number | ❌ | ❌ |

**Valores típicos:**
- `energy_certificate`: "A", "B", "C", "D", "E", "F", "G"

### 12.6 Atributos de Equipamiento (Filtrables)

| Key | Label | Data Type | Required | Filterable |
|-----|-------|-----------|----------|------------|
| `heating_type` | Tipo de Calefacción | text | ❌ | ✅ |
| `air_conditioning` | Aire Acondicionado | text | ❌ | ✅ |
| `kitchen_type` | Tipo de Cocina | text | ❌ | ✅ |
| `built_in_wardrobes` | Armarios Empotrados | boolean | ❌ | ✅ |
| `has_storage_room` | Trastero | boolean | ❌ | ✅ |
| `furnished` | Amueblado | text | ❌ | ✅ |

**Valores típicos:**
- `heating_type`: "Individual gas natural", "Central", "Radiadores gas", "Aerotermia suelo radiante", "Bomba de calor", "Eléctrica", "No"
- `air_conditioning`: "Splits", "Conductos centralizado", "Bomba de calor", "Preinstalación", "No"
- `kitchen_type`: "Americana equipada", "Office equipada", "Independiente equipada", "Americana abierta", "Rústica equipada"
- `furnished`: "Totalmente", "Parcialmente", "Sin amueblar"

### 12.7 Atributos Adicionales (Arrays para Múltiples Valores)

| Key | Label | Data Type | Required | Filterable |
|-----|-------|-----------|----------|------------|
| `features` | Características | text_array | ❌ | ✅ |
| `views` | Vistas | text_array | ❌ | ❌ |
| `garden_surface` | Superficie Jardín (m²) | number | ❌ | ❌ |

**Valores típicos para `features`:**
- "Luminoso", "Exterior", "Piscina privada", "Piscina comunitaria", "Vistas al mar", "Primera línea playa", "Garaje incluido", "Trastero", "Zona infantil", "Gimnasio", "Portería", "Seguridad 24h", "Domótica", "Placas solares", "Aerotermia", "Obra nueva", "Reformado", "Cerca colegios", "Bien comunicado", "Céntrico", "Zona tranquila"

**Valores típicos para `views`:**
- "Mar", "Montaña", "Ciudad", "Parque", "Jardín", "Panorámicas", "Despejadas", "Playa", "Bosque", "Campo", "Patio interior", "Calle"

### 12.8 Atributos Descriptivos (Textos Largos)

| Key | Label | Data Type | Required | Filterable |
|-----|-------|-----------|----------|------------|
| `description` | Descripción Completa | text | ✅ | ❌ |
| `additional_notes` | Notas Adicionales | text | ❌ | ❌ |

**Nota:** La descripción es obligatoria y debe contener información detallada de la propiedad: distribución, características especiales, entorno, servicios cercanos, etc.

### 12.9 Atributos de Disponibilidad

| Key | Label | Data Type | Required | Filterable |
|-----|-------|-----------|----------|------------|
| `available_from` | Disponible Desde | date | ❌ | ❌ |
| `exclusive_agent` | Agente Exclusivo | text | ❌ | ❌ |

### 12.10 Resumen Estadístico

**Total de atributos:** 42

**Distribución:**
- Obligatorios + Filtrables: 9 atributos
- Opcionales + Filtrables: 19 atributos
- Opcionales + No Filtrables: 14 atributos

**Por tipo de dato:**
- `text`: 20 atributos
- `number`: 14 atributos
- `boolean`: 5 atributos
- `text_array`: 2 atributos
- `date`: 1 atributo

### 12.11 Notas de Implementación

1. **Valores de texto libre vs predefinidos**: Para atributos como `property_type`, `condition`, `heating_type`, etc., se recomienda usar valores predefinidos (selects) en el frontend, pero almacenarlos como texto para flexibilidad futura.

2. **Campos calculados**: Algunos campos como `usable_surface` pueden calcularse automáticamente en base a `built_surface` si se conoce el coeficiente del edificio.

3. **Validaciones**: Los atributos marcados como `is_required` deben validarse antes de permitir cambiar el estado del item a "published".

4. **Búsqueda**: Los atributos marcados como `is_filterable` deben estar indexados y optimizados para consultas rápidas.

5. **Localización**: Todos los labels están en español. En una implementación multiidioma, estos labels deberían traducirse en el frontend.

---

Este documento es la referencia base del proyecto.

