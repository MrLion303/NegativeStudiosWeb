import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "https://mrlion303.github.io",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Vary": "Origin",
};

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }
  if (req.method !== "POST") {
    return Response.json({ error: "Método no permitido." }, { status: 405, headers: corsHeaders });
  }
  const origin = req.headers.get("origin");
  if (origin && origin !== "https://mrlion303.github.io" && !origin.startsWith("http://localhost:")) {
    return Response.json({ error: "Origen no autorizado." }, { status: 403, headers: corsHeaders });
  }

  const authorization = req.headers.get("authorization");
  if (!authorization?.startsWith("Bearer ")) {
    return Response.json({ error: "Inicia sesión para continuar." }, { status: 401, headers: corsHeaders });
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const anonKey = Deno.env.get("SUPABASE_ANON_KEY");
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!supabaseUrl || !anonKey || !serviceRoleKey) {
    return Response.json({ error: "La función de eliminación no está configurada en Supabase." }, { status: 500, headers: corsHeaders });
  }

  const userClient = createClient(supabaseUrl, anonKey, {
    global: { headers: { Authorization: authorization } },
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { data: userData, error: userError } = await userClient.auth.getUser();
  if (userError || !userData.user) {
    return Response.json({ error: "La sesión ha caducado. Inicia sesión de nuevo." }, { status: 401, headers: corsHeaders });
  }

  const adminClient = createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  // Borra los archivos del usuario antes de eliminar la cuenta. Los perfiles,
  // comentarios y relaciones restantes se eliminan mediante sus claves foráneas.
  for (const bucket of ["avatars", "banners"]) {
    const { data: files, error: listError } = await adminClient.storage.from(bucket).list(userData.user.id, { limit: 1000 });
    if (listError) {
      return Response.json({ error: "No se pudieron preparar los archivos de tu perfil para eliminarlos." }, { status: 500, headers: corsHeaders });
    }
    if (files?.length) {
      const paths = files.filter((file) => file.name && file.id).map((file) => userData.user.id + "/" + file.name);
      if (paths.length) {
        const { error: removeError } = await adminClient.storage.from(bucket).remove(paths);
        if (removeError) {
          return Response.json({ error: "No se pudieron eliminar los archivos de tu perfil." }, { status: 500, headers: corsHeaders });
        }
      }
    }
  }

  const { error: deleteError } = await adminClient.auth.admin.deleteUser(userData.user.id);
  if (deleteError) {
    return Response.json({ error: "No se pudo eliminar la cuenta. Inténtalo de nuevo o contacta con NegativeStudios." }, { status: 500, headers: corsHeaders });
  }

  return Response.json({ success: true }, { status: 200, headers: corsHeaders });
});
