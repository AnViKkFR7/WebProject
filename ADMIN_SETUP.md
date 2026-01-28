# Configuración del Usuario Admin

## Paso 1: Marcar tu usuario como Admin del Sistema

Para poder usar las funcionalidades administrativas (crear compañías y usuarios), necesitas marcar tu cuenta como `admin` en Supabase.

### Opción A: Desde el Dashboard de Supabase

1. Ve a tu proyecto en [app.supabase.com](https://app.supabase.com)
2. Navega a **Authentication → Users**
3. Encuentra y selecciona tu usuario
4. En la sección **User Metadata**, busca **"Raw App Metadata"**
5. Añade o edita el campo para que contenga:
   ```json
   {
     "app_role": "admin"
   }
   ```
6. Guarda los cambios

### Opción B: Desde SQL Editor

1. Ve a tu proyecto en Supabase
2. Abre **SQL Editor**
3. Ejecuta el siguiente script (reemplaza `'tu-email@ejemplo.com'` con tu email):

```sql
-- Encontrar tu user_id
select id, email, raw_app_meta_data 
from auth.users 
where email = 'tu-email@ejemplo.com';

-- Marcar como admin (reemplaza 'tu-user-id' con el UUID obtenido arriba)
update auth.users
set raw_app_meta_data = 
  coalesce(raw_app_meta_data, '{}'::jsonb) || '{"app_role": "admin"}'::jsonb
where id = 'tu-user-id';

-- Verificar que se aplicó correctamente
select id, email, raw_app_meta_data 
from auth.users 
where id = 'tu-user-id';
```

4. El campo `raw_app_meta_data` debería mostrar algo como:
   ```json
   {"app_role": "admin"}
   ```

---

## Paso 2: Verificar que funciona

1. Cierra sesión y vuelve a iniciar sesión en el admin panel
2. Ve a la página **Profile** (`/profile`)
3. Deberías ver dos pestañas adicionales:
   - **🏢 Crear Compañía**
   - **👤 Crear Usuario**

Si no las ves:
- Verifica que el `app_metadata` se guardó correctamente
- Limpia la caché del navegador
- Vuelve a hacer login

---

## Paso 3: Desplegar las Edge Functions

Las funcionalidades de crear usuarios requieren Edge Functions desplegadas en Supabase.

### Instalación de Supabase CLI

**Windows (con Scoop):**
```powershell
scoop install supabase
```

**Windows (con npm):**
```powershell
npm install -g supabase
```

**Verificar instalación:**
```bash
supabase --version
```

### Desplegar las funciones

1. **Login en Supabase:**
   ```bash
   supabase login
   ```

2. **Link al proyecto:**
   ```bash
   cd c:\development\webs-joselyn\Regiamare\WebProject
   supabase link --project-ref [TU-PROJECT-ID]
   ```
   
   Encuentra tu PROJECT_ID en:
   - Dashboard de Supabase → Settings → General → Reference ID

3. **Desplegar las Edge Functions:**
   ```bash
   supabase functions deploy create-user
   supabase functions deploy invite-user
   ```

4. **Configurar variables de entorno en Supabase:**
   
   Las Edge Functions necesitan acceso al `SUPABASE_ANON_KEY`. Por defecto Supabase proporciona `SUPABASE_URL` y `SUPABASE_SERVICE_ROLE_KEY`, pero debes añadir manualmente el anon key.
   
   En el Dashboard de Supabase:
   - Ve a **Edge Functions → Settings**
   - Añade una nueva variable de entorno:
     - Name: `SUPABASE_ANON_KEY`
     - Value: [Tu Anon Key desde Settings → API]
   
   Luego re-despliega:
   ```bash
   supabase functions deploy create-user
   supabase functions deploy invite-user
   ```

5. **Verificar despliegue:**
   Ve a Dashboard → Edge Functions y verifica que ambas funciones estén listadas.

---

## Paso 4: Configurar Variables de Entorno (Frontend)

Asegúrate de que tu archivo `.env` en `admin-panel/` contiene:

```env
VITE_SUPABASE_URL=https://[TU-PROJECT-ID].supabase.co
VITE_SUPABASE_ANON_KEY=[TU-ANON-KEY]
```

**Nunca** incluyas el `SUPABASE_SERVICE_ROLE_KEY` en el frontend. Este solo se usa en las Edge Functions.

---

## Paso 5: Probar la Funcionalidad

### Crear una Compañía

1. Ve a `/profile`
2. Click en la pestaña **🏢 Crear Compañía**
3. Rellena el formulario:
   - Nombre de la Compañía
   - Email de Contacto
   - Teléfono de Contacto
   - (Opcional) Descripción, sitio web, logo
4. Click en **Crear Compañía**

### Crear un Usuario

1. Ve a `/profile`
2. Click en la pestaña **👤 Crear Usuario**
3. Rellena el formulario:
   - Email del usuario
   - Nombre completo
   - Selecciona una compañía
   - Selecciona un rol (Editor o Viewer)
   - Elige modo de creación:
     - **Con contraseña**: Estableces la contraseña ahora
     - **Por invitación**: El usuario recibe un email para establecer su contraseña
4. Click en **Crear Usuario**

---

## Troubleshooting

### "Forbidden: Admin only"
- Verifica que tu `raw_app_meta_data` tiene `"app_role": "admin"`
- Cierra sesión y vuelve a iniciar sesión
- Verifica en el navegador (DevTools → Application → Local Storage) que el token tiene el claim

### Las pestañas admin no aparecen
- Verifica el `app_metadata` en la base de datos
- Limpia caché del navegador
- Vuelve a hacer login

### "Error al crear usuario"
- Verifica que las Edge Functions estén desplegadas
- Verifica la URL de Supabase en el `.env`
- Revisa los logs de las Edge Functions en el Dashboard

### Edge Functions no se despliegan
- Verifica que tienes Supabase CLI instalado: `supabase --version`
- Verifica que estás logueado: `supabase projects list`
- Verifica que el proyecto está linkeado correctamente

---

## Seguridad

⚠️ **Importante:**

- Solo debe haber **un** usuario con `app_role: admin` (tú)
- Nunca expongas el `SUPABASE_SERVICE_ROLE_KEY` en el frontend
- Los Editors **no pueden** crear otros Editors, solo Viewers
- Solo el Admin puede cambiar roles de usuarios
- Las Edge Functions validan automáticamente los permisos

---

## Próximos pasos

Una vez configurado:

1. Crea tu primera compañía desde el panel admin
2. Crea usuarios para esa compañía
3. Los usuarios podrán acceder con sus credenciales
4. Los Editors podrán gestionar items, atributos, etc.
5. Los Viewers solo podrán ver (read-only)

---

## Documentación adicional

- [Edge Functions README](./functions/README.md)
- [Supabase Edge Functions Docs](https://supabase.com/docs/guides/functions)
- [Supabase Auth Metadata](https://supabase.com/docs/guides/auth/managing-user-data#using-custom-claims)
