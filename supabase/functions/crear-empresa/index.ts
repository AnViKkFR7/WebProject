import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  })

serve(async (req) => {
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

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const anonKey = Deno.env.get('SUPABASE_ANON_KEY')!;

    const authHeaderValue = req.headers.get('Authorization') ?? ''
    const userClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeaderValue } },
    })

    const { data: { user } } = await userClient.auth.getUser();
    if (!user) return json({ error: "Unauthorized" }, 401);

    const { data: isAdmin } = await userClient.rpc("is_platform_admin");
    if (!isAdmin) return json({ error: "Forbidden" }, 403);

    let body: Record<string, unknown> | null = null;
    try {
      body = await req.json();
    } catch {
      body = null;
    }
    if (!body) return json({ error: "Invalid JSON body" }, 400);

    const { name, logo_url, description, contact_email, contact_phone, website_url } = body as {
      name?: string;
      logo_url?: string;
      description?: string;
      contact_email?: string;
      contact_phone?: string;
      website_url?: string;
    };

    if (!name || !contact_email || !contact_phone) {
      return json({ error: "Missing required fields" }, 400);
    }

    const { data: company, error } = await userClient
      .from("companies")
      .insert({
        name,
        logo_url,
        description,
        contact_email,
        contact_phone,
        website_url,
        created_by: user.id,
        last_edited_by: user.id,
      })
      .select()
      .single();

    if (error) return json({ error: error.message }, 400);

    // El creador pasa a ser editor de la empresa
    await userClient.from("company_members").insert({
      company_id: company.id,
      user_id: user.id,
      role: "editor",
      created_by: user.id,
      last_edited_by: user.id,
    });

    return json({ company });
  } catch (error) {
    console.error('[CREATE-USER] Unexpected error:', error)
    return new Response(
      JSON.stringify({ error: error.message || 'Internal server error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
});