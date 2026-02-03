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
    console.log('[CREATE-USER] Request received')
    
    // 1. Obtener el usuario que hace la llamada
    const authHeader = req.headers.get('Authorization')
    if (!authHeader) {
      console.error('[CREATE-USER] Missing Authorization header');
      console.log(req.headers);
      return new Response(
        JSON.stringify({ error: 'Authorization header required' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    const token = authHeader.replace('Bearer ', '')
    console.log('[CREATE-USER] Token length:', token.length)
    
    // Cliente con service_role para operaciones admin
    const supabaseUrl = Deno.env.get('SUPABASE_URL')
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
    
    if (!supabaseUrl || !serviceRoleKey) {
      console.error('[CREATE-USER] Missing environment variables', {
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
    
    console.log('[CREATE-USER] Environment OK')
    
    const supabaseAdmin = createClient(
      supabaseUrl,
      serviceRoleKey,
      {
        auth: {
          autoRefreshToken: false,
          persistSession: false
        }
      }
    )
    
    // 2. Verificar que quien llama es admin validando el JWT
    console.log('[CREATE-USER] Validating user token')
    const { data: { user }, error: userError } = await supabaseAdmin.auth.getUser(token)
    
    if (userError) {
      console.error('[CREATE-USER] Token validation error:', userError.message)
      return new Response(
        JSON.stringify({ 
          error: 'Unauthorized: Invalid token', 
          message: userError.message
        }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }
    
    if (!user) {
      console.error('[CREATE-USER] No user found in token')
      return new Response(
        JSON.stringify({ 
          error: 'Unauthorized: Invalid token', 
          message: 'No user found'
        }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }
    
    console.log('[CREATE-USER] User validated:', user.email)
    
    const isAdmin = user.app_metadata?.app_role === 'admin'
    console.log('[CREATE-USER] Is admin?', isAdmin, 'Role:', user.app_metadata?.app_role)
    
    if (!isAdmin) {
      return new Response(
        JSON.stringify({ 
          error: 'Forbidden: Admin only',
          message: 'Only administrators can create users'
        }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }
    
    // 3. Obtener datos del nuevo usuario desde el body
    const { email, password, full_name, company_id, role } = await req.json()
    console.log('[CREATE-USER] Creating user:', { email, company_id, role })
    
    // Validaciones básicas
    if (!email || !password || !full_name || !company_id || !role) {
      console.error('[CREATE-USER] Missing required fields')
      return new Response(
        JSON.stringify({ error: 'Missing required fields: email, password, full_name, company_id, role' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    if (!['editor', 'viewer'].includes(role)) {
      console.error('[CREATE-USER] Invalid role:', role)
      return new Response(
        JSON.stringify({ error: 'Role must be either "editor" or "viewer"' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }
    
    // 4. Crear el nuevo usuario en auth.users
    console.log('[CREATE-USER] Creating user in auth.users')
    const { data: newUser, error: createError } = await supabaseAdmin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: {
        full_name
      },
      app_metadata: {
        app_role: role
      }
    })
    
    if (createError) {
      console.error('[CREATE-USER] Failed to create user:', createError.message)
      return new Response(
        JSON.stringify({ error: `Failed to create user: ${createError.message}` }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }
    
    console.log('[CREATE-USER] User created in auth:', newUser.user.id)
    
    // 5. Añadir a company_members
    console.log('[CREATE-USER] Adding user to company_members')
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
      console.error('[CREATE-USER] Failed to add to company_members:', memberError.message)
      console.log('[CREATE-USER] Cleaning up: deleting user from auth')
      await supabaseAdmin.auth.admin.deleteUser(newUser.user.id)
      
      return new Response(
        JSON.stringify({ error: `Failed to add user to company: ${memberError.message}` }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }
    
    console.log('[CREATE-USER] Success! User created:', newUser.user.email)
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
        message: 'User created successfully with password'
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
    
  } catch (error) {
    console.error('[CREATE-USER] Unexpected error:', error)
    return new Response(
      JSON.stringify({ error: error.message || 'Internal server error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})
