import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    // 1. Verificar autenticación
    const authHeader = req.headers.get('Authorization')
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: 'Authorization header required' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    const token = authHeader.replace('Bearer ', '')
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    
    const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false
      }
    })

    // Verificar usuario
    const { data: { user }, error: userError } = await supabaseAdmin.auth.getUser(token)
    
    if (userError || !user) {
      return new Response(
        JSON.stringify({ error: 'Invalid token' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // 2. Obtener media_id del body
    const { media_id } = await req.json()

    if (!media_id) {
      return new Response(
        JSON.stringify({ error: 'Missing required field: media_id' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // 3. Obtener el registro de media con el item asociado
    const { data: media, error: mediaError } = await supabaseAdmin
      .from('item_media')
      .select(`
        id,
        url_externa,
        file_type,
        is_cover,
        item_id,
        items!inner (
          company_id
        )
      `)
      .eq('id', media_id)
      .single()

    if (mediaError || !media) {
      return new Response(
        JSON.stringify({ error: 'Media record not found' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // 4. Verificar permisos: usuario debe ser admin o editor de la compañía
    const isAdmin = user.app_metadata?.app_role === 'admin'
    
    if (!isAdmin) {
      // Verificar si es editor de la compañía
      const { data: membership } = await supabaseAdmin
        .from('company_members')
        .select('role')
        .eq('company_id', media.items.company_id)
        .eq('user_id', user.id)
        .single()

      if (!membership || membership.role !== 'editor') {
        return new Response(
          JSON.stringify({ error: 'Forbidden: Only admin or company editor can delete media' }),
          { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
      }
    }

    // 5. Extraer el path del Storage desde la URL
    // URL format: https://[project].supabase.co/storage/v1/object/public/items-media/[path]
    const urlParts = media.url_externa.split('/items-media/')
    if (urlParts.length !== 2) {
      return new Response(
        JSON.stringify({ error: 'Invalid storage URL format' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }
    const storagePath = urlParts[1]

    // 6. Borrar el registro de la base de datos
    // El trigger validate_item_media verificará que si es portada y hay más imágenes,
    // debe haber otra portada
    const { error: deleteError } = await supabaseAdmin
      .from('item_media')
      .delete()
      .eq('id', media_id)

    if (deleteError) {
      return new Response(
        JSON.stringify({ error: `Failed to delete record: ${deleteError.message}` }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // 7. Borrar el archivo del Storage
    const { error: storageError } = await supabaseAdmin.storage
      .from('items-media')
      .remove([storagePath])

    if (storageError) {
      // Log pero no fallar la operación (el registro ya fue borrado)
      console.error('Failed to delete from storage:', storageError)
      
      return new Response(
        JSON.stringify({ 
          success: true, 
          warning: 'Record deleted but storage cleanup failed',
          storage_error: storageError.message 
        }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    return new Response(
      JSON.stringify({ 
        success: true, 
        message: 'Media deleted successfully'
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )

  } catch (error) {
    console.error('Error:', error)
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})
