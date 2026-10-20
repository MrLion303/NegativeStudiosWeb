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
  if (origin && origin !== "https://mrlion303.github.io") {
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

  // Elimina todos los archivos del usuario antes de borrar su cuenta.
  // Incluye imágenes del foro y recorre todas las páginas y subcarpetas.
  async function removeUserFiles(bucket: string, folder: string): Promise<boolean> {
    while (true) {
      const { data: entries, error: listError } = await adminClient.storage
        .from(bucket)
        .list(folder, { limit: 100, offset: 0, sortBy: { column: "name", order: "asc" } });
      if (listError) return false;
      if (!entries?.length) return true;

      const files = entries.filter((entry) => entry.name && entry.id);
      const folders = entries.filter((entry) => entry.name && !entry.id);
      for (const subfolder of folders) {
        if (!await removeUserFiles(bucket, folder + "/" + subfolder.name)) return false;
      }

      if (files.length) {
        const paths = files.map((file) => folder + "/" + file.name);
        const { error: removeError } = await adminClient.storage.from(bucket).remove(paths);
        if (removeError) return false;
      }

      // Volvemos a consultar desde el principio: borrar una página desplaza
      // los elementos siguientes y usar offset podría saltarse archivos.
      if (!files.length && !folders.length) return true;
    }
  }

  for (const bucket of ["avatars", "banners", "post-images"]) {
    if (!await removeUserFiles(bucket, userData.user.id)) {
      return Response.json({ error: "No se pudieron eliminar todos los archivos de tu cuenta." }, { status: 500, headers: corsHeaders });
    }
  }

  const { error: deleteError } = await adminClient.auth.admin.deleteUser(userData.user.id);
  if (deleteError) {
    return Response.json({ error: "No se pudo eliminar la cuenta. Inténtalo de nuevo o contacta con NegativeStudios." }, { status: 500, headers: corsHeaders });
  }

  return Response.json({ success: true }, { status: 200, headers: corsHeaders });
});
