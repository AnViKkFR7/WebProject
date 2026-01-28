# Configuración de Edge Functions

Este directorio contiene las Edge Functions de Supabase para operaciones administrativas que requieren `service_role_key`.

## Edge Functions Disponibles

### 1. `create-user`
Crea un nuevo usuario con contraseña establecida por el administrador.

**Endpoint:** `https://[PROJECT_ID].supabase.co/functions/v1/create-user`

**Método:** `POST`

**Headers:**
```json
{
  "Authorization": "Bearer [ACCESS_TOKEN]",
  "Content-Type": "application/json"
}
```

**Body:**
```json
{
  "email": "usuario@email.com",
  "password": "contraseña_segura",
  "full_name": "Nombre Completo",
  "company_id": "uuid-de-la-empresa",
  "role": "editor" // o "viewer"
}
```

**Respuesta exitosa:**
```json
{
  "success": true,
  "user": {
    "id": "uuid",
    "email": "usuario@email.com",
    "full_name": "Nombre Completo",
    "company_id": "uuid-de-la-empresa",
    "role": "editor"
  },
  "message": "User created successfully with password"
}
```

---

### 2. `invite-user`
Crea un nuevo usuario y envía email de invitación para que establezca su contraseña.

**Endpoint:** `https://[PROJECT_ID].supabase.co/functions/v1/invite-user`

**Método:** `POST`

**Headers:**
```json
{
  "Authorization": "Bearer [ACCESS_TOKEN]",
  "Content-Type": "application/json"
}
```

**Body:**
```json
{
  "email": "usuario@email.com",
  "full_name": "Nombre Completo",
  "company_id": "uuid-de-la-empresa",
  "role": "editor" // o "viewer"
}
```

**Respuesta exitosa:**
```json
{
  "success": true,
  "user": {
    "id": "uuid",
    "email": "usuario@email.com",
    "full_name": "Nombre Completo",
    "company_id": "uuid-de-la-empresa",
    "role": "editor"
  },
  "message": "User created successfully. Invitation email sent."
}
```

---

## Despliegue de Edge Functions

Para desplegar las Edge Functions en Supabase:

### 1. Instalar Supabase CLI

```bash
# Windows (con Scoop)
scoop install supabase

# o con npm
npm install -g supabase
```

### 2. Login en Supabase

```bash
supabase login
```

### 3. Link al proyecto

```bash
supabase link --project-ref [PROJECT_ID]
```

### 4. Desplegar funciones

```bash
# Desplegar todas las funciones
supabase functions deploy

# O desplegar una función específica
supabase functions deploy create-user
supabase functions deploy invite-user
```

---

## Variables de Entorno Requeridas

Las Edge Functions necesitan acceso a estas variables de entorno:

- `SUPABASE_URL`: URL del proyecto de Supabase (configurada automáticamente)
- `SUPABASE_SERVICE_ROLE_KEY`: Clave de service role (configurada automáticamente)
- `SUPABASE_ANON_KEY`: Clave anon key (DEBES configurarla manualmente)

### Configurar SUPABASE_ANON_KEY

1. Ve al Dashboard de Supabase
2. Navega a **Edge Functions → Settings** (o **Project Settings → Edge Functions**)
3. En la sección "Environment Variables", añade:
   - **Name**: `SUPABASE_ANON_KEY`
   - **Value**: Copia el valor desde **Settings → API → Project API keys → anon public**
4. Guarda los cambios
5. Re-despliega las funciones:
   ```bash
   supabase functions deploy create-user
   supabase functions deploy invite-user
   ```

**IMPORTANTE:** Nunca expongas el `SUPABASE_SERVICE_ROLE_KEY` en el frontend. Solo debe usarse en Edge Functions o backend seguro.

---

## Seguridad

Ambas funciones verifican que:

1. El usuario esté autenticado (token válido)
2. El usuario tenga el rol de `admin` en `app_metadata.app_role`
3. Los datos de entrada sean válidos

Solo los usuarios marcados como admin en `auth.users.raw_app_meta_data` pueden ejecutar estas funciones.

---

## Testing Local

Para probar las funciones localmente:

```bash
# Iniciar Supabase local
supabase start

# Servir función localmente
supabase functions serve create-user --no-verify-jwt

# Hacer request de prueba
curl -i --location --request POST 'http://localhost:54321/functions/v1/create-user' \
  --header 'Authorization: Bearer [TOKEN]' \
  --header 'Content-Type: application/json' \
  --data '{
    "email": "test@email.com",
    "password": "password123",
    "full_name": "Test User",
    "company_id": "uuid",
    "role": "viewer"
  }'
```

---

## Troubleshooting

### Error: "Forbidden: Admin only"
- Verifica que tu usuario tenga `app_metadata.app_role = 'admin'`
- Ejecuta en SQL Editor:
  ```sql
  update auth.users
  set raw_app_meta_data = raw_app_meta_data || '{"app_role": "admin"}'::jsonb
  where id = 'tu-user-id';
  ```

### Error: "Failed to create user"
- Verifica que el email no exista ya en `auth.users`
- Verifica que el `company_id` exista en la tabla `companies`

### Error: "Failed to add user to company"
- Verifica las policies RLS de `company_members`
- Verifica que el usuario admin tenga permisos para insertar en esa empresa
