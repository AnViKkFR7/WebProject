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
  if (req.method !== 'POST') return json({ error: 'Method not allowed' }, 405)

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
  const authHeader = req.headers.get("Authorization") ?? "";
  const userClient = createClient(supabaseUrl, anonKey, {
    global: { headers: { Authorization: authHeader } },
  });

  const { data: { user } } = await userClient.auth.getUser();
  if (!user) return json({ error: "Unauthorized" }, 401);

  const { data: isAdmin } = await userClient.rpc("is_platform_admin");

  let body: Record<string, unknown> | null = null;
  try {
    body = await req.json();
  } catch {
    body = null;
  }
  if (!body) return json({ error: "Invalid JSON body" }, 400);

  const { company_id, user_id, role, full_name, phone } = body as {
    company_id?: string;
    user_id?: string;
    role?: string;
    full_name?: string;
    phone?: string;
  };

  if (!company_id || !user_id) {
    return json({ error: "Missing required fields" }, 400);
  }

  const allowedRoles = ["editor", "viewer"];
  const resolvedRole = role || "viewer";
  if (!allowedRoles.includes(resolvedRole)) {
    return json({ error: "Invalid role" }, 400);
  }

  if (!isAdmin) {
    const { data: isEditor, error: editorError } = await userClient.rpc("has_company_role", {
      _company_id: company_id,
      _roles: ["editor"],
    });

    if (editorError) return json({ error: editorError.message }, 400);
    if (!isEditor) return json({ error: "Forbidden" }, 403);

    if (resolvedRole !== "viewer") {
      return json({ error: "Editors can only create viewers" }, 403);
    }
  }

  const { data: member, error } = await userClient
    .from("company_members")
    .insert({
      company_id,
      user_id,
      role: resolvedRole,
      full_name: full_name ?? "",
      phone: phone ?? null,
      created_by: user.id,
      last_edited_by: user.id,
    })
    .select()
    .single();

  if (error) return json({ error: error.message }, 400);
  return json({ member });
});