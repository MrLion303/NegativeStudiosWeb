import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const siteOrigin = "https://mrlion303.github.io";
const settingsReturnUrl = siteOrigin + "/NegativeStudiosWeb/configurar-perfil.html?connections=";
const corsHeaders = {
  "Access-Control-Allow-Origin": siteOrigin,
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, GET, OPTIONS",
  "Vary": "Origin",
};
const json = (body: unknown, status = 200) => Response.json(body, { status, headers: corsHeaders });
const env = (key: string) => Deno.env.get(key) || "";
const redirectToSettings = (state: string) => Response.redirect(settingsReturnUrl + encodeURIComponent(state), 302);

function decodeBase64Url(value: string): Uint8Array {
  const base64 = value.replace(/-/g, "+").replace(/_/g, "/");
  const padded = base64 + "=".repeat((4 - (base64.length % 4)) % 4);
  const binary = atob(padded);
  return Uint8Array.from(binary, char => char.charCodeAt(0));
}

function decodeJwtPart(value: string): Record<string, unknown> {
  return JSON.parse(new TextDecoder().decode(decodeBase64Url(value)));
}

async function verifiedIdentityClaims(idToken: string, clientId: string, expectedNonce: string) {
  const parts = idToken.split(".");
  if (parts.length !== 3) throw new Error("ID token inválido.");
  const header = decodeJwtPart(parts[0]);
  const claims = decodeJwtPart(parts[1]);
  if (header.alg !== "RS256" || typeof header.kid !== "string") throw new Error("Firma Microsoft no admitida.");
  const jwksResponse = await fetch("https://login.microsoftonline.com/common/discovery/v2.0/keys");
  if (!jwksResponse.ok) throw new Error("No se pudieron validar las claves de Microsoft.");
  const jwks = await jwksResponse.json();
  const jwk = (jwks.keys || []).find((key: Record<string, unknown>) => key.kid === header.kid);
  if (!jwk) throw new Error("No se encontró la clave de firma de Microsoft.");
  const publicKey = await crypto.subtle.importKey("jwk", jwk, {
    name: "RSASSA-PKCS1-v1_5", hash: "SHA-256",
  }, false, ["verify"]);
  const signedPart = new TextEncoder().encode(parts[0] + "." + parts[1]);
  const verified = await crypto.subtle.verify("RSASSA-PKCS1-v1_5", publicKey, decodeBase64Url(parts[2]), signedPart);
  if (!verified) throw new Error("La firma del ID token de Microsoft no es válida.");
  const now = Math.floor(Date.now() / 1000);
  if (claims.aud !== clientId || Number(claims.exp) <= now || Number(claims.nbf || 0) > now) throw new Error("El ID token de Microsoft ha caducado o no corresponde a esta aplicación.");
  if (claims.nonce !== expectedNonce) throw new Error("El nonce OAuth de Microsoft no coincide.");
  const tid = String(claims.tid || "");
  if (!tid || claims.iss !== "https://login.microsoftonline.com/" + tid + "/v2.0") throw new Error("El emisor del ID token de Microsoft no es válido.");
  return claims;
}

async function encryptToken(value: string, secret: string): Promise<string> {
  const keyBytes = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(secret));
  const key = await crypto.subtle.importKey("raw", keyBytes, { name: "AES-GCM" }, false, ["encrypt"]);
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const cipher = await crypto.subtle.encrypt({ name: "AES-GCM", iv }, key, new TextEncoder().encode(value));
  const bytes = new Uint8Array(iv.length + cipher.byteLength);
  bytes.set(iv, 0); bytes.set(new Uint8Array(cipher), iv.length);
  return btoa(String.fromCharCode(...bytes));
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  const url = env("SUPABASE_URL");
  const anonKey = env("SUPABASE_ANON_KEY");
  const serviceKey = env("SUPABASE_SERVICE_ROLE_KEY");
  const clientId = env("MICROSOFT_CLIENT_ID");
  const clientSecret = env("MICROSOFT_CLIENT_SECRET");
  const encryptionKey = env("MICROSOFT_TOKEN_ENCRYPTION_KEY");
  if (!url || !anonKey || !serviceKey || !clientId || !clientSecret || !encryptionKey) {
    if (req.method === "GET") return redirectToSettings("microsoft-error-config");
    return json({ error: "Falta configurar Microsoft OAuth en las variables secretas de la Edge Function." }, 500);
  }

  const admin = createClient(url, serviceKey, { auth: { persistSession: false, autoRefreshToken: false } });
  const redirectUri = url.replace(/\/$/, "") + "/functions/v1/microsoft-link";

  if (req.method === "GET") {
    const paramsIn = new URL(req.url).searchParams;
    const oauthError = paramsIn.get("error");
    if (oauthError) return redirectToSettings("microsoft-error");
    const code = paramsIn.get("code") || "";
    const state = paramsIn.get("state") || "";
    if (!code || !state) return redirectToSettings("microsoft-error");
    const { data: savedState, error: stateError } = await admin.from("microsoft_oauth_states")
      .select("state,user_id,slot,nonce,expires_at").eq("state", state).maybeSingle();
    if (stateError || !savedState || new Date(savedState.expires_at).getTime() < Date.now()) {
      if (savedState) await admin.from("microsoft_oauth_states").delete().eq("state", state);
      return redirectToSettings("microsoft-error-state");
    }
    await admin.from("microsoft_oauth_states").delete().eq("state", state);

    const tokenResponse = await fetch("https://login.microsoftonline.com/common/oauth2/v2.0/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        client_id: clientId,
        client_secret: clientSecret,
        grant_type: "authorization_code",
        code,
        redirect_uri: redirectUri,
        scope: "openid profile email offline_access XboxLive.signin",
      }),
    });
    const tokens = await tokenResponse.json();
    if (!tokenResponse.ok || !tokens.access_token) return redirectToSettings("microsoft-error-token");

    if (!tokens.id_token) return redirectToSettings("microsoft-error-token");
    let account: Record<string, unknown>;
    try {
      account = await verifiedIdentityClaims(String(tokens.id_token), clientId, String(savedState.nonce || ""));
    } catch {
      return redirectToSettings("microsoft-error-identity");
    }
    const microsoftId = String(account.oid || account.sub || "");
    if (!microsoftId) return redirectToSettings("microsoft-error-account");

    let accessTokenEncrypted = "";
    let refreshTokenEncrypted: string | null = null;
    try {
      accessTokenEncrypted = await encryptToken(String(tokens.access_token), encryptionKey);
      if (tokens.refresh_token) refreshTokenEncrypted = await encryptToken(String(tokens.refresh_token), encryptionKey);
    } catch {
      return redirectToSettings("microsoft-error-encryption");
    }

    const email = String(account.preferred_username || account.email || account.upn || "");
    const displayName = String(account.name || email || "Cuenta Microsoft").slice(0, 160);
    const { error: saveError } = await admin.from("microsoft_account_connections").upsert({
      user_id: savedState.user_id,
      slot: savedState.slot,
      microsoft_user_id: microsoftId,
      email,
      display_name: displayName,
      access_token_encrypted: accessTokenEncrypted,
      refresh_token_encrypted: refreshTokenEncrypted,
      expires_at: tokens.expires_in ? new Date(Date.now() + Number(tokens.expires_in) * 1000).toISOString() : null,
      scopes: String(tokens.scope || ""),
      updated_at: new Date().toISOString(),
    }, { onConflict: "user_id,slot" });
    if (saveError) return redirectToSettings("microsoft-error-save");
    return redirectToSettings("microsoft-linked");
  }

  if (req.method !== "POST") return json({ error: "Método no permitido." }, 405);
  const origin = req.headers.get("origin");
  if (origin && origin !== siteOrigin) return json({ error: "Origen no autorizado." }, 403);
  const authorization = req.headers.get("authorization");
  if (!authorization?.startsWith("Bearer ")) return json({ error: "Inicia sesión para administrar conexiones." }, 401);
  const caller = createClient(url, anonKey, {
    global: { headers: { Authorization: authorization } },
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { data: userData, error: userError } = await caller.auth.getUser();
  if (userError || !userData.user) return json({ error: "Tu sesión caducó. Inicia sesión de nuevo." }, 401);
  let body: { action?: string; slot?: number };
  try { body = await req.json(); } catch { return json({ error: "Solicitud no válida." }, 400); }
  const action = String(body.action || "");
  const slot = Number(body.slot);
  if (!Number.isInteger(slot) || slot < 1 || slot > 3) return json({ error: "Elige una de las tres posiciones de Microsoft." }, 400);

  if (action === "list") {
    const { data, error } = await admin.from("microsoft_account_connections")
      .select("slot,email,display_name,expires_at,created_at")
      .eq("user_id", userData.user.id).order("slot");
    if (error) return json({ error: "No se pudieron cargar las conexiones Microsoft." }, 500);
    return json({ accounts: data || [] });
  }
  if (action === "unlink") {
    const { error } = await admin.from("microsoft_account_connections")
      .delete().eq("user_id", userData.user.id).eq("slot", slot);
    if (error) return json({ error: "No se pudo desvincular la cuenta Microsoft." }, 500);
    return json({ success: true });
  }
  if (action !== "start") return json({ error: "Acción no válida." }, 400);

  const state = crypto.randomUUID();
  const nonce = crypto.randomUUID();
  const { error: stateError } = await admin.from("microsoft_oauth_states").insert({
    state, nonce, user_id: userData.user.id, slot,
    expires_at: new Date(Date.now() + 10 * 60 * 1000).toISOString(),
  });
  if (stateError) return json({ error: "No se pudo iniciar la vinculación de Microsoft." }, 500);

  const params = new URLSearchParams({
    client_id: clientId,
    response_type: "code",
    redirect_uri: redirectUri,
    response_mode: "query",
    scope: "openid profile email offline_access XboxLive.signin",
    state,
    nonce,
    prompt: "select_account",
  });
  return json({ authorization_url: "https://login.microsoftonline.com/common/oauth2/v2.0/authorize?" + params.toString() });
});
