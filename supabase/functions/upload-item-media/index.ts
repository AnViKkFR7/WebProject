import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

const MAX_FILE_SIZE = 50 * 1024 * 1024 // 50MB

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

    // 2. Parsear FormData
    const formData = await req.formData()
    const file = formData.get('file') as File
    const itemId = formData.get('item_id') as string
    const fileType = formData.get('file_type') as string // 'image' | 'pdf'
    const altText = formData.get('alt_text') as string | null
    const isCover = formData.get('is_cover') === 'true'
    const sortOrder = parseInt(formData.get('sort_order') as string || '0')

    // Validaciones
    if (!file || !itemId || !fileType) {
      return new Response(
        JSON.stringify({ error: 'Missing required fields: file, item_id, file_type' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    if (!['image', 'pdf'].includes(fileType)) {
      return new Response(
        JSON.stringify({ error: 'file_type must be "image" or "pdf"' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Validar tamaño
    if (file.size > MAX_FILE_SIZE) {
      return new Response(
        JSON.stringify({ error: 'File size exceeds 50MB limit' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Validar MIME types
    const allowedMimeTypes = ['image/jpeg', 'image/png', 'image/webp', 'application/pdf']
    if (!allowedMimeTypes.includes(file.type)) {
      return new Response(
        JSON.stringify({ error: `Invalid file type. Allowed: ${allowedMimeTypes.join(', ')}` }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Validar que PDFs tengan descripción
    if (fileType === 'pdf' && (!altText || altText.trim() === '')) {
      return new Response(
        JSON.stringify({ error: 'PDFs require a description (alt_text)' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // 3. Verificar que el item existe y obtener su company_id
    const { data: item, error: itemError } = await supabaseAdmin
      .from('items')
      .select('id, company_id')
      .eq('id', itemId)
      .single()

    if (itemError || !item) {
      return new Response(
        JSON.stringify({ error: 'Item not found' }),
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
        .eq('company_id', item.company_id)
        .eq('user_id', user.id)
        .single()

      if (!membership || membership.role !== 'editor') {
        return new Response(
          JSON.stringify({ error: 'Forbidden: Only admin or company editor can upload media' }),
          { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
      }
    }

    // 5. Subir archivo al Storage
    const timestamp = Date.now()
    const fileExtension = file.name.split('.').pop()
    const storagePath = `${item.company_id}/${itemId}/${timestamp}_${crypto.randomUUID()}.${fileExtension}`

    const { data: uploadData, error: uploadError } = await supabaseAdmin.storage
      .from('items-media')
      .upload(storagePath, file, {
        contentType: file.type,
        upsert: false
      })

    if (uploadError) {
      return new Response(
        JSON.stringify({ error: `Upload failed: ${uploadError.message}` }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // 6. Obtener URL pública
    const { data: { publicUrl } } = supabaseAdmin.storage
      .from('items-media')
      .getPublicUrl(storagePath)

    // 7. Crear registro en item_media
    const { data: mediaRecord, error: insertError } = await supabaseAdmin
      .from('item_media')
      .insert({
        item_id: itemId,
        file_type: fileType,
        url_externa: publicUrl,
        title: file.name,
        alt_text: altText || null,
        is_cover: isCover,
        sort_order: sortOrder
      })
      .select()
      .single()

    if (insertError) {
      // Si falla el insert, intentar borrar el archivo subido
      await supabaseAdmin.storage.from('items-media').remove([storagePath])
      
      return new Response(
        JSON.stringify({ error: `Database insert failed: ${insertError.message}` }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    return new Response(
      JSON.stringify({ 
        success: true, 
        data: mediaRecord,
        message: 'File uploaded successfully'
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
