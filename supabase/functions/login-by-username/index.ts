import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const allowedOrigins = new Set([
  "https://negativestudios.akjon.dev",
  "https://mrlion303.github.io",
  "http://localhost:5500",
]);

function corsHeadersFor(origin: string | null): Record<string, string> {
  const headers: Record<string, string> = {
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Vary": "Origin",
    "Cache-Control": "no-store",
  };
  if (origin && allowedOrigins.has(origin)) headers["Access-Control-Allow-Origin"] = origin;
  return headers;
}

function json(body: unknown, status: number, origin: string | null): Response {
  return Response.json(body, { status, headers: corsHeadersFor(origin) });
}

function badCredentials(origin: string | null): Response {
  return json({ error: "El usuario o la contraseña no son correctos." }, 401, origin);
}

Deno.serve(async (req: Request) => {
  const origin = req.headers.get("origin");
  const headers = corsHeadersFor(origin);

  if (origin && !allowedOrigins.has(origin)) {
    return json({ error: "Origen no autorizado." }, 403, origin);
  }
  if (req.method === "OPTIONS") return new Response("ok", { headers });
  if (req.method !== "POST") return json({ error: "Método no permitido." }, 405, origin);

  let identifier = "";
  let password = "";
  try {
    const body = await req.json();
    identifier = String(body?.username || "").trim().toLowerCase();
    password = String(body?.password || "");
  } catch {
    return badCredentials(origin);
  }
  if (!/^[a-z0-9_]{3,24}$/.test(identifier) || password.length < 1 || password.length > 256) {
    return badCredentials(origin);
  }

  const url = Deno.env.get("SUPABASE_URL");
  const anonKey = Deno.env.get("SUPABASE_ANON_KEY");
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!url || !anonKey || !serviceRoleKey) {
    return json({ error: "El inicio de sesión con usuario no está configurado en el servidor." }, 500, origin);
  }

  const admin = createClient(url, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const publicClient = createClient(url, anonKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const { data: profile, error: profileError } = await admin.from("profiles")
    .select("id").eq("username", identifier).maybeSingle();
  if (profileError || !profile) return badCredentials(origin);

  const { data: userData, error: userError } = await admin.auth.admin.getUserById(profile.id);
  const email = userData?.user?.email;
  if (userError || !email) return badCredentials(origin);

  const { data: authData, error: authError } = await publicClient.auth.signInWithPassword({ email, password });
  if (authError || !authData.session) return badCredentials(origin);

  return json({
    access_token: authData.session.access_token,
    refresh_token: authData.session.refresh_token,
    expires_in: authData.session.expires_in,
    token_type: authData.session.token_type,
  }, 200, origin);
});
