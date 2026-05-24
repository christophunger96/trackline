// Supabase Edge Function: trackline-spotify
// Replaces the old Render Spotify helper.
// Deploy with verify_jwt=false because Spotify callback and browser calls are public/private-link based.
// Secrets/tokens stay server-side in Supabase.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const SPOTIFY_ACCOUNTS_BASE = "https://accounts.spotify.com";
const SPOTIFY_API_BASE = "https://api.spotify.com/v1";
const DEFAULT_PLAY_LIMIT_SECONDS = 20;
const CANONICAL_SPOTIFY_REDIRECT_URI =
  Deno.env.get("SPOTIFY_REDIRECT_URI") ||
  "https://cdjgxdffyqnsuxdxuplf.functions.supabase.co/trackline-spotify/spotify/callback";
const SPOTIFY_SCOPES = [
  "streaming",
  "user-read-email",
  "user-read-private",
  "user-read-playback-state",
  "user-modify-playback-state",
].join(" ");

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "GET, POST, PUT, PATCH, OPTIONS",
};

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      ...corsHeaders,
      "Content-Type": "application/json; charset=utf-8",
    },
  });
}

function html(content: string, status = 200) {
  return new Response(content, {
    status,
    headers: {
      ...corsHeaders,
      "Content-Type": "text/html; charset=utf-8",
    },
  });
}

function getSupabaseAdmin() {
  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const serviceRoleKey =
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ||
    Deno.env.get("SUPABASE_SECRET_KEY") ||
    "";

  if (!supabaseUrl || !serviceRoleKey) {
    throw new Error("Supabase Edge Function Secrets fehlen: SUPABASE_URL oder SERVICE_ROLE/SECRET Key.");
  }

  return createClient(supabaseUrl, serviceRoleKey, {
    auth: {
      persistSession: false,
    },
  });
}

async function readJsonBody(req: Request) {
  try {
    return await req.json();
  } catch {
    return {};
  }
}

function cleanRoomCode(value: string) {
  return String(value || "").trim().toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 16);
}

function createId(prefix = "id") {
  const bytes = crypto.getRandomValues(new Uint8Array(12));
  const raw = Array.from(bytes).map((byte) => byte.toString(16).padStart(2, "0")).join("");

  return `${prefix}-${Date.now()}-${raw}`;
}

function base64UrlEncode(bytes: ArrayBuffer | Uint8Array) {
  const uint8 = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes);
  let binary = "";

  for (const byte of uint8) {
    binary += String.fromCharCode(byte);
  }

  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}

function createCodeVerifier() {
  const bytes = crypto.getRandomValues(new Uint8Array(64));

  return base64UrlEncode(bytes);
}

async function createCodeChallenge(verifier: string) {
  const encoded = new TextEncoder().encode(verifier);
  const digest = await crypto.subtle.digest("SHA-256", encoded);

  return base64UrlEncode(digest);
}

function getFunctionBaseUrl(req: Request) {
  const url = new URL(req.url);
  const pathname = url.pathname;

  // Supabase Edge Functions may receive an internal/proxied URL.
  // Spotify requires the redirect_uri to match the dashboard entry exactly,
  // so force the public HTTPS protocol for callbacks.
  url.protocol = "https:";

  if (pathname.includes("/spotify/")) {
    url.pathname = pathname.replace(/\/spotify\/.*$/, "");
  } else if (pathname.includes("/room/")) {
    url.pathname = pathname.replace(/\/room\/.*$/, "");
  }

  url.search = "";
  url.hash = "";
  return url.toString().replace(/\/+$/, "");
}

function getCallbackUrl(_req: Request) {
  // Spotify requires the redirect_uri to match the Developer Dashboard entry exactly.
  // Do not derive this from the incoming Supabase request URL, because the same
  // Edge Function can be reached through different public URLs.
  return CANONICAL_SPOTIFY_REDIRECT_URI;
}

function safeJsonError(error: unknown) {
  if (error instanceof Error) return error.message;

  if (typeof error === "object" && error !== null) {
    const err = error as Record<string, unknown>;
    const message =
      err.message ||
      err.error_description ||
      err.error ||
      err.details ||
      err.hint ||
      err.code;

    if (message) return String(message);

    try {
      return JSON.stringify(error);
    } catch {
      return "Unbekannter Objekt-Fehler";
    }
  }

  return String(error || "Unbekannter Fehler");
}

async function spotifyTokenRequest(form: URLSearchParams) {
  const response = await fetch(`${SPOTIFY_ACCOUNTS_BASE}/api/token`, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: form,
  });

  if (!response.ok) {
    throw new Error(`Spotify Token Fehler: ${await response.text()}`);
  }

  return response.json();
}

async function getRoomSpotify(admin: ReturnType<typeof createClient>, roomCode: string) {
  const { data, error } = await admin
    .from("room_spotify")
    .select("*")
    .eq("room_code", roomCode)
    .maybeSingle();

  if (error) throw error;
  if (!data) throw new Error("Spotify ist für diesen Raum noch nicht verbunden.");

  return data;
}

async function saveRoomSpotify(admin: ReturnType<typeof createClient>, roomCode: string, patch: Record<string, unknown>) {
  const payload = {
    ...patch,
    updated_at: new Date().toISOString(),
  };

  const hasInsertRequiredClientId = Boolean(
    payload.client_id ||
    payload.clientId ||
    patch.client_id ||
    patch.clientId
  );

  if (hasInsertRequiredClientId) {
    const normalizedPayload = {
      room_code: roomCode,
      ...payload,
      client_id: String(payload.client_id || payload.clientId || ""),
    };

    delete (normalizedPayload as Record<string, unknown>).clientId;

    const { error } = await admin
      .from("room_spotify")
      .upsert(normalizedPayload, {
        onConflict: "room_code",
      });

    if (error) {
      throw new Error(error.message || JSON.stringify(error));
    }

    return;
  }

  // For device saves and token refreshes we must update the existing row.
  // A plain upsert without client_id can violate the NOT NULL constraint before
  // Postgres resolves the ON CONFLICT path.
  const { data, error } = await admin
    .from("room_spotify")
    .update(payload)
    .eq("room_code", roomCode)
    .select("room_code")
    .maybeSingle();

  if (error) {
    throw new Error(error.message || JSON.stringify(error));
  }

  if (!data) {
    throw new Error("Spotify ist für diesen Raum noch nicht verbunden. Bitte Spotify Host-Login zuerst abschließen.");
  }
}

async function refreshAccessTokenIfNeeded(admin: ReturnType<typeof createClient>, room: any) {
  const expiresAt = room.expires_at ? new Date(room.expires_at).getTime() : 0;
  const shouldRefresh = !room.access_token || expiresAt < Date.now() + 60_000;

  if (!shouldRefresh) return room.access_token;

  if (!room.refresh_token) {
    throw new Error("Spotify Refresh Token fehlt. Bitte Spotify neu verbinden.");
  }

  const form = new URLSearchParams({
    grant_type: "refresh_token",
    refresh_token: room.refresh_token,
    client_id: room.client_id,
  });

  const token = await spotifyTokenRequest(form);
  const nextExpiresAt = new Date(Date.now() + Number(token.expires_in || 3600) * 1000).toISOString();

  await saveRoomSpotify(admin, room.room_code, {
    access_token: token.access_token,
    refresh_token: token.refresh_token || room.refresh_token,
    expires_at: nextExpiresAt,
    scope: token.scope || room.scope || "",
  });

  return token.access_token;
}

async function spotifyFetch(admin: ReturnType<typeof createClient>, room: any, url: string, options: RequestInit = {}) {
  const accessToken = await refreshAccessTokenIfNeeded(admin, room);

  const response = await fetch(url, {
    ...options,
    headers: {
      Authorization: `Bearer ${accessToken}`,
      ...(options.headers || {}),
    },
  });

  if (response.status === 401) {
    await saveRoomSpotify(admin, room.room_code, {
      access_token: null,
      expires_at: null,
    });
  }

  if (!response.ok) {
    const text = await response.text();

    if (response.status === 404) {
      throw new Error(
        `Spotify Fehler 404: Kein aktiver Spotify-Kontext gefunden. Starte im Host-Spotify einmal manuell einen Song im Jam und versuche es erneut. Details: ${text || response.statusText}`
      );
    }

    throw new Error(`Spotify Fehler ${response.status}: ${text || response.statusText}`);
  }

  return response;
}

async function searchSpotifyUri(admin: ReturnType<typeof createClient>, room: any, track: any) {
  if (track.spotifyUri) return track.spotifyUri;

  const title = String(track.title || "").trim();
  const artist = String(track.artist || "").trim();
  const mainArtist = artist
    .split(" feat.")[0]
    .split(" ft.")[0]
    .split(" featuring ")[0]
    .trim();

  if (!title || !mainArtist) {
    throw new Error("Track hat keinen Titel oder Artist.");
  }

  const queries = [
    `track:${title} artist:${mainArtist}`,
    `"${title}" "${mainArtist}"`,
    `${title} ${mainArtist}`,
  ];

  for (const query of queries) {
    const params = new URLSearchParams({
      q: query,
      type: "track",
      limit: "5",
    });

    const response = await spotifyFetch(admin, room, `${SPOTIFY_API_BASE}/search?${params.toString()}`);
    const data = await response.json();
    const items = data?.tracks?.items || [];
    const best = items.find((item: any) => item?.uri) || null;

    if (best?.uri) return best.uri;
  }

  throw new Error("Keinen passenden Spotify-Track gefunden. Trage spotifyUri im Track-Datensatz ein.");
}

async function getCurrentTrackFromSupabase(admin: ReturnType<typeof createClient>, roomCode: string) {
  const { data, error } = await admin
    .from("game_states")
    .select("state")
    .eq("room_code", roomCode)
    .maybeSingle();

  if (error) throw error;

  return data?.state?.currentTrack || null;
}

async function createLogin(req: Request) {
  const admin = getSupabaseAdmin();
  const body = await readJsonBody(req);
  const roomCode = cleanRoomCode(body.roomCode);
  const clientId = String(body.clientId || Deno.env.get("SPOTIFY_CLIENT_ID") || "").trim();

  if (!roomCode) throw new Error("roomCode fehlt.");
  if (!clientId) throw new Error("Spotify Client ID fehlt.");

  const loginId = createId("spotify-login");
  const codeVerifier = createCodeVerifier();
  const codeChallenge = await createCodeChallenge(codeVerifier);
  const redirectUri = getCallbackUrl(req);
  const expiresAt = new Date(Date.now() + 10 * 60_000).toISOString();

  const { error } = await admin.from("room_spotify_auth_sessions").insert({
    login_id: loginId,
    room_code: roomCode,
    client_id: clientId,
    code_verifier: codeVerifier,
    redirect_uri: redirectUri,
    status: "pending",
    expires_at: expiresAt,
  });

  if (error) throw error;

  const params = new URLSearchParams({
    client_id: clientId,
    response_type: "code",
    redirect_uri: redirectUri,
    scope: SPOTIFY_SCOPES,
    state: loginId,
    code_challenge_method: "S256",
    code_challenge: codeChallenge,
  });

  return json({
    loginId,
    authorizeUrl: `${SPOTIFY_ACCOUNTS_BASE}/authorize?${params.toString()}`,
    redirectUri,
  });
}

async function callback(req: Request) {
  const admin = getSupabaseAdmin();
  const url = new URL(req.url);
  const code = url.searchParams.get("code") || "";
  const state = url.searchParams.get("state") || "";
  const errorParam = url.searchParams.get("error") || "";

  if (!state) {
    return html("<h1>Trackline Spotify</h1><p>State fehlt.</p>", 400);
  }

  const { data: session, error } = await admin
    .from("room_spotify_auth_sessions")
    .select("*")
    .eq("login_id", state)
    .maybeSingle();

  if (error || !session) {
    return html("<h1>Trackline Spotify</h1><p>Login-Session nicht gefunden.</p>", 400);
  }

  if (errorParam) {
    await admin
      .from("room_spotify_auth_sessions")
      .update({ status: "error", error_message: errorParam, updated_at: new Date().toISOString() })
      .eq("login_id", state);

    return html(`<h1>Trackline Spotify</h1><p>Spotify Login abgebrochen: ${errorParam}</p>`, 400);
  }

  if (!code) {
    return html("<h1>Trackline Spotify</h1><p>Code fehlt.</p>", 400);
  }

  try {
    const form = new URLSearchParams({
      grant_type: "authorization_code",
      code,
      redirect_uri: session.redirect_uri,
      client_id: session.client_id,
      code_verifier: session.code_verifier,
    });

    const token = await spotifyTokenRequest(form);
    const expiresAt = new Date(Date.now() + Number(token.expires_in || 3600) * 1000).toISOString();

    await saveRoomSpotify(admin, session.room_code, {
      client_id: session.client_id,
      access_token: token.access_token,
      refresh_token: token.refresh_token,
      expires_at: expiresAt,
      scope: token.scope || SPOTIFY_SCOPES,
      connected_at: new Date().toISOString(),
    });

    await admin
      .from("room_spotify_auth_sessions")
      .update({ status: "ready", updated_at: new Date().toISOString() })
      .eq("login_id", state);

    return html(`
      <html>
        <body style="font-family: system-ui; background:#020617; color:#f8fafc; display:grid; place-items:center; min-height:100vh;">
          <main style="max-width:560px; padding:24px; border:1px solid #1e293b; border-radius:18px; background:#0f172a;">
            <h1>Spotify verbunden</h1>
            <p>Du kannst dieses Fenster schließen und zu Trackline zurückkehren.</p>
          </main>
        </body>
      </html>
    `);
  } catch (err) {
    const message = safeJsonError(err);

    await admin
      .from("room_spotify_auth_sessions")
      .update({ status: "error", error_message: message, updated_at: new Date().toISOString() })
      .eq("login_id", state);

    return html(`<h1>Trackline Spotify</h1><p>${message}</p>`, 500);
  }
}

async function tokenStatus(loginId: string) {
  const admin = getSupabaseAdmin();

  const { data, error } = await admin
    .from("room_spotify_auth_sessions")
    .select("status,error_message")
    .eq("login_id", loginId)
    .maybeSingle();

  if (error) throw error;

  return json({
    status: data?.status || "pending",
    message: data?.error_message || "",
  });
}

async function roomStatus(roomCode: string) {
  const admin = getSupabaseAdmin();

  try {
    const room = await getRoomSpotify(admin, roomCode);

    return json({
      connected: Boolean(room.refresh_token),
      deviceId: room.device_id || "",
      deviceName: room.device_name || "",
      expiresAt: room.expires_at || null,
    });
  } catch {
    return json({
      connected: false,
      deviceId: "",
      deviceName: "",
    });
  }
}

async function devices(roomCode: string) {
  const admin = getSupabaseAdmin();
  const room = await getRoomSpotify(admin, roomCode);
  const response = await spotifyFetch(admin, room, `${SPOTIFY_API_BASE}/me/player/devices`);
  const data = await response.json();

  return json({
    connected: true,
    deviceId: room.device_id || "",
    deviceName: room.device_name || "",
    devices: Array.isArray(data.devices) ? data.devices : [],
  });
}

async function saveDevice(req: Request, roomCode: string) {
  const admin = getSupabaseAdmin();
  const body = await readJsonBody(req);
  const deviceId = String(body.deviceId || "").trim();
  const deviceName = String(body.deviceName || "Spotify-Geraet").trim();

  if (!deviceId || deviceId === "undefined" || deviceId === "null" || deviceId === "[object Object]") {
    throw new Error("deviceId fehlt oder ist ungueltig. Bitte Spotify-Geraete neu laden und ein echtes Zielgeraet auswaehlen.");
  }

  await getRoomSpotify(admin, roomCode);
  await saveRoomSpotify(admin, roomCode, {
    device_id: deviceId,
    device_name: deviceName,
  });

  return json({
    roomCode,
    deviceId,
    deviceName,
  });
}

function delay(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function play(req: Request, roomCode: string) {
  const admin = getSupabaseAdmin();
  const body = await readJsonBody(req);
  const room = await getRoomSpotify(admin, roomCode);
  const track = body.track || await getCurrentTrackFromSupabase(admin, roomCode);
  const requestedJamMode = Boolean(body.jamMode || body.playbackMode === "jam" || body.useActiveContext);
  const useActiveSpotifyContext = requestedJamMode || !room.device_id;
  const playLimitSeconds = Math.max(1, Math.min(120, Math.round(Number(body.playLimitSeconds || DEFAULT_PLAY_LIMIT_SECONDS))));

  if (!track) throw new Error("Kein aktueller Song im Raum.");

  const spotifyUri = await searchSpotifyUri(admin, room, track);

  if (useActiveSpotifyContext) {
    // Active-context mode:
    // - Jam mode explicitly uses this path.
    // - If no device is saved, we also use this path instead of failing.
    // This prevents player browsers from getting "Kein Spotify-Zielgeraet gespeichert"
    // while the host already has an active Spotify/Jam session.
    await spotifyFetch(admin, room, `${SPOTIFY_API_BASE}/me/player/play`, {
      method: "PUT",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        uris: [spotifyUri],
      }),
    });

    return json({
      roomCode,
      ok: true,
      jamMode: requestedJamMode,
      activeContext: true,
      trackId: track.id,
      hiddenLabel: "Verdeckter Song",
      deviceId: "",
      deviceName: requestedJamMode ? "Aktiver Spotify/Jam-Kontext" : "Aktiver Spotify-Kontext",
      playLimitSeconds,
    });
  }

  await spotifyFetch(admin, room, `${SPOTIFY_API_BASE}/me/player`, {
    method: "PUT",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      device_ids: [room.device_id],
      play: false,
    }),
  });

  await delay(700);

  await spotifyFetch(admin, room, `${SPOTIFY_API_BASE}/me/player/play?device_id=${encodeURIComponent(room.device_id)}`, {
    method: "PUT",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      uris: [spotifyUri],
    }),
  });

  return json({
    roomCode,
    ok: true,
    jamMode: false,
    activeContext: false,
    trackId: track.id,
    hiddenLabel: "Verdeckter Song",
    deviceId: room.device_id,
    deviceName: room.device_name || "Spotify-Geraet",
    playLimitSeconds,
  });
}

async function pause(req: Request, roomCode: string) {
  const admin = getSupabaseAdmin();
  const body = await readJsonBody(req);
  const room = await getRoomSpotify(admin, roomCode);
  const requestedJamMode = Boolean(body.jamMode || body.playbackMode === "jam" || body.useActiveContext);
  const useActiveSpotifyContext = requestedJamMode || !room.device_id;

  if (useActiveSpotifyContext) {
    await spotifyFetch(admin, room, `${SPOTIFY_API_BASE}/me/player/pause`, {
      method: "PUT",
    });

    return json({
      roomCode,
      ok: true,
      jamMode: requestedJamMode,
      activeContext: true,
    });
  }

  await spotifyFetch(admin, room, `${SPOTIFY_API_BASE}/me/player/pause?device_id=${encodeURIComponent(room.device_id)}`, {
    method: "PUT",
  });

  return json({
    roomCode,
    ok: true,
    jamMode: false,
    activeContext: false,
  });
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, {
      status: 204,
      headers: corsHeaders,
    });
  }

  try {
    const url = new URL(req.url);
    const pathname = url.pathname;

    if (req.method === "POST" && pathname.endsWith("/spotify/create-login")) {
      return await createLogin(req);
    }

    if (req.method === "GET" && pathname.endsWith("/spotify/callback")) {
      return await callback(req);
    }

    const tokenMatch = pathname.match(/\/spotify\/token\/([^/]+)$/);
    if (req.method === "GET" && tokenMatch) {
      return await tokenStatus(decodeURIComponent(tokenMatch[1]));
    }

    const roomMatch = pathname.match(/\/room\/([^/]+)\/spotify(\/.*)?$/);
    if (roomMatch) {
      const roomCode = cleanRoomCode(decodeURIComponent(roomMatch[1]));
      const actionPath = roomMatch[2] || "";

      if (!roomCode) throw new Error("roomCode fehlt.");

      if (req.method === "GET" && actionPath === "/status") return await roomStatus(roomCode);
      if (req.method === "GET" && actionPath === "/devices") return await devices(roomCode);
      if (req.method === "POST" && actionPath === "/device") return await saveDevice(req, roomCode);
      if (req.method === "POST" && actionPath === "/play") return await play(req, roomCode);
      if (req.method === "POST" && actionPath === "/pause") return await pause(req, roomCode);
    }

    return json({ error: "Route nicht gefunden.", pathname }, 404);
  } catch (err) {
    return json({ error: safeJsonError(err) }, 400);
  }
});
