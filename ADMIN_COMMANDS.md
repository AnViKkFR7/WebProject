# Comandos Útiles - Gestión de Usuarios Admin

## SQL: Gestión de Roles Admin

### Ver todos los usuarios y sus roles
```sql
select 
  id,
  email,
  raw_app_meta_data->>'app_role' as app_role,
  created_at,
  last_sign_in_at
from auth.users
order by created_at desc;
```

### Marcar usuario como admin
```sql
-- Por email
update auth.users
set raw_app_meta_data = 
  coalesce(raw_app_meta_data, '{}'::jsonb) || '{"app_role": "admin"}'::jsonb
where email = 'tu-email@ejemplo.com';

-- Por ID
update auth.users
set raw_app_meta_data = 
  coalesce(raw_app_meta_data, '{}'::jsonb) || '{"app_role": "admin"}'::jsonb
where id = 'uuid-del-usuario';
```

### Quitar rol de admin
```sql
update auth.users
set raw_app_meta_data = raw_app_meta_data - 'app_role'
where email = 'email@ejemplo.com';
```

### Ver usuarios admin
```sql
select 
  id,
  email,
  raw_app_meta_data
from auth.users
where raw_app_meta_data->>'app_role' = 'admin';
```

---

## SQL: Verificar Membresías

### Ver todos los miembros de una compañía
```sql
select 
  cm.company_id,
  c.name as company_name,
  cm.user_id,
  cm.full_name,
  cm.role,
  cm.created_at
from company_members cm
join companies c on c.id = cm.company_id
where cm.company_id = 'uuid-de-la-empresa'
order by cm.created_at desc;
```

### Ver todas las empresas de un usuario
```sql
select 
  c.id,
  c.name,
  cm.role,
  cm.full_name
from company_members cm
join companies c on c.id = cm.company_id
where cm.user_id = 'uuid-del-usuario';
```

### Ver usuarios por email en auth y sus membresías
```sql
select 
  u.email,
  u.id as user_id,
  c.name as company,
  cm.role,
  cm.full_name
from auth.users u
left join company_members cm on cm.user_id = u.id
left join companies c on c.id = cm.company_id
where u.email = 'email@ejemplo.com';
```

---

## SQL: Limpiar datos de prueba

### Eliminar usuario y sus membresías
```sql
-- Las membresías se eliminan automáticamente por cascade
delete from auth.users
where email = 'usuario-prueba@ejemplo.com';
```

### Eliminar compañía y todo lo relacionado
```sql
-- Elimina compañía, membresías, items, etc. (cascade)
delete from companies
where name = 'Compañía de Prueba';
```

---

## Supabase CLI: Edge Functions

### Listar funciones desplegadas
```bash
supabase functions list
```

### Ver logs de una función
```bash
supabase functions logs create-user
supabase functions logs invite-user
```

### Re-desplegar una función después de cambios
```bash
supabase functions deploy create-user
```

### Desplegar todas las funciones
```bash
supabase functions deploy
```

### Test local de una función
```bash
# Servir localmente
supabase functions serve create-user --no-verify-jwt

# En otra terminal, hacer un request
curl -i --location --request POST 'http://localhost:54321/functions/v1/create-user' \
  --header 'Authorization: Bearer eyJhbGc...' \
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

## PowerShell: Testing Edge Functions desde Frontend

### Test create-user (con password)
```powershell
$token = "tu-access-token-aqui"
$url = "https://[PROJECT-ID].supabase.co/functions/v1/create-user"

$body = @{
    email = "nuevo-usuario@email.com"
    password = "password123"
    full_name = "Usuario de Prueba"
    company_id = "uuid-de-empresa"
    role = "viewer"
} | ConvertTo-Json

Invoke-RestMethod -Uri $url -Method POST `
    -Headers @{
        "Authorization" = "Bearer $token"
        "Content-Type" = "application/json"
    } `
    -Body $body
```

### Test invite-user
```powershell
$token = "tu-access-token-aqui"
$url = "https://[PROJECT-ID].supabase.co/functions/v1/invite-user"

$body = @{
    email = "nuevo-usuario@email.com"
    full_name = "Usuario de Prueba"
    company_id = "uuid-de-empresa"
    role = "editor"
} | ConvertTo-Json

Invoke-RestMethod -Uri $url -Method POST `
    -Headers @{
        "Authorization" = "Bearer $token"
        "Content-Type" = "application/json"
    } `
    -Body $body
```

---

## Obtener Access Token desde DevTools

1. Abre DevTools (F12)
2. Ve a **Application → Local Storage**
3. Busca la key relacionada con Supabase auth
4. Copia el `access_token` del JSON

O desde la consola del navegador:
```javascript
// Si estás usando el cliente de Supabase
const { data: { session } } = await supabase.auth.getSession()
console.log(session.access_token)
```

---

## Verificar que todo funciona

### 1. Verificar admin status
```sql
select 
  email,
  raw_app_meta_data->>'app_role' as role
from auth.users
where email = 'tu-email@ejemplo.com';
```

Debería devolver: `role = 'admin'`

### 2. Verificar Edge Functions
```bash
supabase functions list
```

Deberías ver:
- `create-user`
- `invite-user`

### 3. Verificar desde el frontend
- Ve a `/profile`
- Deberías ver las pestañas "Crear Compañía" y "Crear Usuario"

---

## Troubleshooting Común

### El usuario se crea pero no aparece en company_members
```sql
-- Verificar que el usuario existe en auth
select id, email from auth.users where email = 'email@ejemplo.com';

-- Añadir manualmente a company_members si es necesario
insert into company_members (company_id, user_id, role, full_name)
values (
  'uuid-de-empresa',
  'uuid-del-usuario',
  'viewer',
  'Nombre del Usuario'
);
```

### Edge Function da error 404
- Verifica que está desplegada: `supabase functions list`
- Verifica la URL en el código: debe ser `/functions/v1/create-user`
- Re-despliega: `supabase functions deploy create-user`

### "Forbidden: Admin only"
```sql
-- Verificar app_metadata
select raw_app_meta_data from auth.users where email = 'tu-email';

-- Si está vacío o incorrecto, actualizar:
update auth.users
set raw_app_meta_data = '{"app_role": "admin"}'::jsonb
where email = 'tu-email@ejemplo.com';
```

---

## Monitoreo

### Ver usuarios creados recientemente
```sql
select 
  email,
  created_at,
  raw_app_meta_data->>'app_role' as role
from auth.users
where created_at > now() - interval '24 hours'
order by created_at desc;
```

### Ver actividad de membresías
```sql
select 
  cm.created_at,
  cm.full_name,
  cm.role,
  c.name as company,
  creator.email as created_by_email
from company_members cm
join companies c on c.id = cm.company_id
left join auth.users creator on creator.id = cm.created_by
where cm.created_at > now() - interval '7 days'
order by cm.created_at desc;
```
