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
  if (!isAdmin) return json({ error: "Forbidden" }, 403);

  let body: Record<string, unknown> | null = null;
  try {
    body = await req.json();
  } catch {
    body = null;
  }
  if (!body) return json({ error: "Invalid JSON body" }, 400);

  const { company_id, user_id, role } = body as {
    company_id?: string;
    user_id?: string;
    role?: string;
  };

  if (!company_id || !user_id || !role) {
    return json({ error: "Missing required fields" }, 400);
  }

  const allowedRoles = ["editor", "viewer"];
  if (!allowedRoles.includes(role)) {
    return json({ error: "Invalid role" }, 400);
  }

  const { error } = await userClient
    .from("company_members")
    .update({ role, last_edited_by: user.id })
    .eq("company_id", company_id)
    .eq("user_id", user_id);

  if (error) return json({ error: error.message }, 400);
  return json({ ok: true });
});