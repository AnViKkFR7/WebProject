import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { ownedItemMediaPath } from '../_shared/itemMediaStorage.ts'

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
        .eq('is_active', true)
        .eq('company_id', media.items.company_id)
        .eq('user_id', user.id)
        .single()

      if (!membership || !['admin','editor'].includes(membership.role)) {
        return new Response(
          JSON.stringify({ error: 'Forbidden: Only admin or company editor can delete media' }),
          { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
      }
    }

    // 5. Only delete objects in the authorized item's canonical namespace.
    // Unknown/legacy URLs may be detached, but never authorize Storage cleanup.
    const storagePath = ownedItemMediaPath(media.url_externa, supabaseUrl, media.items.company_id, media.item_id)

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

    // The transactional outbox handles Storage after shared-reference checks.
    // Never remove directly here: database success must survive Storage outages.
    return new Response(
      JSON.stringify({success:true,cleanup:storagePath?'deferred':'review',
        ...(!storagePath?{warning:'Storage cleanup requires manual review (unrecognized URL format)'}:{})}),
      {status:200,headers:{...corsHeaders,'Content-Type':'application/json'}}
    )

  } catch (error) {
    console.error('[DELETE-ITEM-MEDIA] unexpected_error')
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})
