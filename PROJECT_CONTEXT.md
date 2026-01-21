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

* Autenticados mediante Supabase Auth
* Pueden pertenecer a una o varias empresas

### Empresas

* Representan un negocio (inmobiliaria, restaurante, tienda, etc.)
* Tienen:

  * Información básica (nombre, logo, descripción, contacto)
  * Un conjunto de elementos genéricos asociados

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

Este documento es la referencia base del proyecto.
