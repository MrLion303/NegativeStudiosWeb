import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const allowedOrigin = "https://mrlion303.github.io";
const corsHeaders = {
  "Access-Control-Allow-Origin": allowedOrigin,
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Vary": "Origin",
};
const badCredentials = () => Response.json(
  { error: "El usuario o la contraseña no son correctos." },
  { status: 401, headers: corsHeaders },
);

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return Response.json({ error: "Método no permitido." }, { status: 405, headers: corsHeaders });
  const origin = req.headers.get("origin");
  if (origin && origin !== allowedOrigin) return Response.json({ error: "Origen no autorizado." }, { status: 403, headers: corsHeaders });

  let identifier = "";
  let password = "";
  try {
    const body = await req.json();
    identifier = String(body?.username || "").trim().toLowerCase();
    password = String(body?.password || "");
  } catch {
    return badCredentials();
  }
  if (!/^[a-z0-9_]{3,24}$/.test(identifier) || password.length < 1 || password.length > 256) return badCredentials();

  const url = Deno.env.get("SUPABASE_URL");
  const anonKey = Deno.env.get("SUPABASE_ANON_KEY");
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!url || !anonKey || !serviceRoleKey) {
    return Response.json({ error: "El inicio de sesión con usuario no está configurado en el servidor." }, { status: 500, headers: corsHeaders });
  }

  const admin = createClient(url, serviceRoleKey, { auth: { persistSession: false, autoRefreshToken: false } });
  const publicClient = createClient(url, anonKey, { auth: { persistSession: false, autoRefreshToken: false } });
  const { data: profile, error: profileError } = await admin.from("profiles")
    .select("id").eq("username", identifier).maybeSingle();
  if (profileError || !profile) return badCredentials();

  const { data: userData, error: userError } = await admin.auth.admin.getUserById(profile.id);
  const email = userData?.user?.email;
  if (userError || !email) return badCredentials();

  const { data: authData, error: authError } = await publicClient.auth.signInWithPassword({ email, password });
  if (authError || !authData.session) return badCredentials();

  return Response.json({
    access_token: authData.session.access_token,
    refresh_token: authData.session.refresh_token,
    expires_in: authData.session.expires_in,
    token_type: authData.session.token_type,
  }, { status: 200, headers: corsHeaders });
});
