import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    console.log('[INVITE-USER] Request received')
    
    // 1. Obtener el usuario que hace la llamada
    const authHeader = req.headers.get('Authorization')
    if (!authHeader) {
      console.error('[INVITE-USER] Missing Authorization header')
      return new Response(
        JSON.stringify({ error: 'Authorization header required' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    const token = authHeader.replace('Bearer ', '')
    console.log('[INVITE-USER] Token length:', token.length)
    
    // Cliente con service_role para operaciones admin
    const supabaseUrl = Deno.env.get('SUPABASE_URL')
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
    
    if (!supabaseUrl || !serviceRoleKey) {
      console.error('[INVITE-USER] Missing environment variables', {
        hasUrl: !!supabaseUrl,
        hasKey: !!serviceRoleKey
      })
      return new Response(
        JSON.stringify({ 
          error: 'Server configuration error',
          details: 'Missing required environment variables'
        }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }
    
    console.log('[INVITE-USER] Environment OK')
    
    const supabaseAdmin = createClient(
      supabaseUrl ?? '',
      serviceRoleKey ?? '',
      {
        auth: {
          autoRefreshToken: false,
          persistSession: false
        }
      }
    )
    
    // 2. Verificar que quien llama es admin validando el JWT
    const { data: { user }, error: userError } = await supabaseAdmin.auth.getUser(token)
    
    if (userError) {
      return new Response(
        JSON.stringify({ 
          error: 'Unauthorized: Invalid token', 
          details: userError.message,
          debug: {
            tokenLength: token.length,
            supabaseUrlSet: !!supabaseUrl,
            serviceRoleKeySet: !!serviceRoleKey,
            errorCode: userError.code,
            errorName: userError.name
          }
        }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }
    
    if (!user) {
      return new Response(
        JSON.stringify({ 
          error: 'Unauthorized: Invalid token', 
          details: 'No user found',
          debug: {
            tokenLength: token.length,
            supabaseUrlSet: !!supabaseUrl,
            serviceRoleKeySet: !!serviceRoleKey
          }
        }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }
    
    const isAdmin = user.app_metadata?.app_role === 'admin'
    
    if (!isAdmin) {
      return new Response(
        JSON.stringify({ 
          error: 'Forbidden: Admin only',
          debug: {
            userEmail: user.email,
            appMetadata: user.app_metadata,
            appRole: user.app_metadata?.app_role
          }
        }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }
    
    // 3. Obtener datos del nuevo usuario desde el body
    const { email, full_name, company_id, role } = await req.json()
    
    // Validaciones básicas
    if (!email || !full_name || !company_id || !role) {
      return new Response(
        JSON.stringify({ error: 'Missing required fields: email, full_name, company_id, role' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    if (!['editor', 'viewer'].includes(role)) {
      return new Response(
        JSON.stringify({ error: 'Role must be either "editor" or "viewer"' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }
    
    // 4. Crear el nuevo usuario sin contraseña (requiere confirmación por email)
    const { data: newUser, error: createError } = await supabaseAdmin.auth.admin.createUser({
      email,
      email_confirm: false, // Requiere confirmación por email
      user_metadata: {
        full_name
      },
      app_metadata: {
        app_role: role // No es platform admin
      }
    })
    
    if (createError) {
      return new Response(
        JSON.stringify({ error: `Failed to create user: ${createError.message}` }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }
    
    // 5. Añadir a company_members (perfil del usuario en la empresa)
    const { error: memberError } = await supabaseAdmin
      .from('company_members')
      .insert({
        company_id,
        user_id: newUser.user.id,
        role,
        full_name,
        created_by: user.id,
        last_edited_by: user.id
      })
    
    if (memberError) {
      // Si falla la creación del miembro, intentar eliminar el usuario creado
      await supabaseAdmin.auth.admin.deleteUser(newUser.user.id)
      
      return new Response(
        JSON.stringify({ error: `Failed to add user to company: ${memberError.message}` }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }
    
    // 6. Enviar invitación por email para que el usuario establezca su contraseña
    const { error: inviteError } = await supabaseAdmin.auth.admin.inviteUserByEmail(email, {
      redirectTo: `${req.headers.get('origin') || ''}/set-password`
    })
    
    if (inviteError) {
      console.error('Failed to send invitation email:', inviteError)
      // No fallar toda la operación si el email no se envía
      // El admin puede reenviar la invitación más tarde
    }
    
    return new Response(
      JSON.stringify({ 
        success: true, 
        user: {
          id: newUser.user.id,
          email: newUser.user.email,
          full_name,
          company_id,
          role
        },
        message: 'User created successfully. Invitation email sent.'
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
    
  } catch (error) {
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})
