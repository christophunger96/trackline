import { createServer } from "node:http";
import crypto from "node:crypto";
import { Server } from "socket.io";

const PORT = Number(process.env.PORT || 3001);
const rooms = new Map();
const spotifyLogins = new Map();

const STARTING_TRACKS = [
  { id: "s1", title: "Billie Jean", artist: "Michael Jackson", year: 1982, genre: "Pop" },
  { id: "s2", title: "Wonderwall", artist: "Oasis", year: 1995, genre: "Britpop" },
  { id: "s3", title: "Dancing Queen", artist: "ABBA", year: 1976, genre: "Disco" },
  { id: "s4", title: "Seven Nation Army", artist: "The White Stripes", year: 2003, genre: "Rock" },
  { id: "s5", title: "Rolling in the Deep", artist: "Adele", year: 2010, genre: "Soul Pop" },
  { id: "s6", title: "Smells Like Teen Spirit", artist: "Nirvana", year: 1991, genre: "Grunge" },
];

const initialGameState = {
  phase: "lobby",
  room: null,
  players: [],
  deck: [],
  activePlayerIndex: 0,
  currentTrack: null,
  selectedInsertIndex: null,
  lastResult: null,
  targetScore: 10,
  maxTurns: 0,
  turnNumber: 1,
  showDebugSong: false,
  discardedTracks: [],
  gameLog: [],
  eventHistory: [],
  playbackRequests: [],
};

function createId(prefix = "id") {
  return `${prefix}-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function createRoomCode() {
  return Math.random().toString(36).slice(2, 8).toUpperCase();
}

function shuffle(array) {
  return [...array].sort(() => Math.random() - 0.5);
}

function sortTimeline(timeline) {
  return [...timeline].sort((a, b) => a.year - b.year || a.title.localeCompare(b.title));
}

function createInitialPlayers(names) {
  const starters = shuffle(STARTING_TRACKS);

  return names.map((name, index) => ({
    id: createId("player"),
    name,
    role: index === 0 ? "host" : "player",
    timeline: [starters[index % starters.length]],
    score: 1,
    correct: 0,
    wrong: 0,
  }));
}

function isCorrectPlacement(timeline, track, insertIndex) {
  const orderedTimeline = sortTimeline(timeline);
  const left = orderedTimeline[insertIndex - 1];
  const right = orderedTimeline[insertIndex];

  return (!left || left.year <= track.year) && (!right || track.year <= right.year);
}

function sortedWithInsert(timeline, track) {
  return sortTimeline([...timeline, track]);
}

function getPlacementLabel(timeline, insertIndex) {
  const orderedTimeline = sortTimeline(timeline);

  if (insertIndex === 0) return `vor ${orderedTimeline[0]?.title || "Start"}`;
  if (insertIndex === orderedTimeline.length) return `nach ${orderedTimeline[orderedTimeline.length - 1]?.title || "Ende"}`;

  return `zwischen ${orderedTimeline[insertIndex - 1]?.title} und ${orderedTimeline[insertIndex]?.title}`;
}

function getWinner(players, targetScore) {
  return players.find((player) => player.score >= targetScore) || null;
}

function addEvent(state, type, details = "") {
  const entry = {
    id: createId("event"),
    type,
    details,
    turnNumber: state.turnNumber,
  };

  return {
    ...state,
    eventHistory: [entry, ...state.eventHistory].slice(0, 20),
  };
}

function gameReducer(state, action) {
  switch (action.type) {
    case "RESET_GAME":
      return initialGameState;

    case "START_GAME": {
      const playerNames = Array.isArray(action.playerNames) && action.playerNames.length > 0 ? action.playerNames : ["Host"];
      const deck = Array.isArray(action.deck) ? action.deck : [];
      const players = createInitialPlayers(playerNames);

      const nextState = {
        ...initialGameState,
        phase: "ready",
        room: {
          code: action.roomCode || createRoomCode(),
          hostPlayerId: players[0]?.id || null,
          hostName: players[0]?.name || "Host",
          visibility: "private",
        },
        players,
        deck: shuffle(deck),
        targetScore: Number(action.targetScore || 10),
        maxTurns: Number(action.maxTurns || 0),
        gameLog: [
          {
            id: createId("log"),
            text: `Spiel gestartet mit ${playerNames.length} Spielern und ${deck.length} Songs im Deck.`,
          },
        ],
      };

      return addEvent(nextState, "GAME_STARTED", `${playerNames.length} Spieler, ${deck.length} Songs`);
    }

    case "TRACK_DRAWN": {
      if (state.phase !== "ready" || state.deck.length === 0) return state;

      const [nextTrack, ...remainingDeck] = state.deck;

      return addEvent(
        {
          ...state,
          phase: "placing",
          currentTrack: nextTrack,
          deck: remainingDeck,
          selectedInsertIndex: null,
          lastResult: null,
          showDebugSong: false,
        },
        "TRACK_DRAWN",
        "Verdeckter Song gezogen"
      );
    }

    case "PLACEMENT_SELECTED": {
      if (state.phase !== "placing") return state;

      return addEvent(
        {
          ...state,
          selectedInsertIndex: action.insertIndex,
        },
        "PLACEMENT_SELECTED",
        `Index ${action.insertIndex}`
      );
    }

    case "TRACK_PLAY_REQUESTED": {
      if (state.phase !== "placing" || !state.currentTrack) return state;

      const activePlayer = state.players[state.activePlayerIndex];
      const requester = action.requesterName || activePlayer?.name || "Spieler";

      const request = {
        id: createId("playback"),
        requester,
        trackId: state.currentTrack.id,
        hiddenLabel: "Verdeckter Song",
        createdAt: new Date().toLocaleTimeString(),
      };

      return addEvent(
        {
          ...state,
          playbackRequests: [request, ...state.playbackRequests].slice(0, 8),
          gameLog: [
            {
              id: createId("log"),
              text: `${requester} hat den verdeckten Song gestartet oder erneut angefordert.`,
            },
            ...state.gameLog,
          ].slice(0, 12),
        },
        "TRACK_PLAY_REQUESTED",
        `${requester} fordert Playback an`
      );
    }

    case "TRACK_REVEALED": {
      if (state.phase !== "placing" || !state.currentTrack || state.selectedInsertIndex === null) return state;

      const activePlayer = state.players[state.activePlayerIndex];
      if (!activePlayer) return state;

      const correct = isCorrectPlacement(activePlayer.timeline, state.currentTrack, state.selectedInsertIndex);
      const placementLabel = getPlacementLabel(activePlayer.timeline, state.selectedInsertIndex);

      const players = state.players.map((player, index) => {
        if (index !== state.activePlayerIndex) return player;

        return {
          ...player,
          timeline: correct ? sortedWithInsert(player.timeline, state.currentTrack) : player.timeline,
          score: correct ? player.score + 1 : player.score,
          correct: correct ? player.correct + 1 : player.correct,
          wrong: correct ? player.wrong : player.wrong + 1,
        };
      });

      const logText = correct
        ? `${activePlayer.name} hat ${state.currentTrack.title} (${state.currentTrack.year}) richtig ${placementLabel} einsortiert.`
        : `${activePlayer.name} lag mit ${state.currentTrack.title} (${state.currentTrack.year}) falsch. Gewaehlt: ${placementLabel}.`;

      return addEvent(
        {
          ...state,
          players,
          phase: "reveal",
          lastResult: {
            correct,
            placementLabel,
            playerName: activePlayer.name,
            track: state.currentTrack,
          },
          discardedTracks: correct ? state.discardedTracks : [state.currentTrack, ...state.discardedTracks],
          gameLog: [{ id: createId("log"), text: logText }, ...state.gameLog].slice(0, 12),
        },
        "TRACK_REVEALED",
        correct ? "richtig" : "falsch"
      );
    }

    case "TRACK_SKIPPED": {
      if (state.phase !== "placing" || !state.currentTrack) return state;

      const activePlayer = state.players[state.activePlayerIndex];
      if (!activePlayer) return state;

      return addEvent(
        {
          ...state,
          phase: "reveal",
          showDebugSong: true,
          discardedTracks: [state.currentTrack, ...state.discardedTracks],
          lastResult: {
            correct: false,
            skipped: true,
            placementLabel: "uebersprungen",
            playerName: activePlayer.name,
            track: state.currentTrack,
          },
          gameLog: [
            {
              id: createId("log"),
              text: `${activePlayer.name} hat ${state.currentTrack.title} uebersprungen.`,
            },
            ...state.gameLog,
          ].slice(0, 12),
        },
        "TRACK_SKIPPED",
        "Song uebersprungen"
      );
    }

    case "NEXT_PLAYER": {
      const winner = getWinner(state.players, state.targetScore);
      const turnsFinished = state.maxTurns > 0 && state.turnNumber >= state.maxTurns;
      const deckFinished = state.deck.length === 0;

      if (winner || turnsFinished || deckFinished) {
        return addEvent(
          {
            ...state,
            phase: "finished",
          },
          "GAME_FINISHED",
          winner ? `Gewinner: ${winner.name}` : "Limit erreicht"
        );
      }

      const nextIndex = (state.activePlayerIndex + 1) % state.players.length;

      return addEvent(
        {
          ...state,
          activePlayerIndex: nextIndex,
          turnNumber: state.turnNumber + 1,
          currentTrack: null,
          selectedInsertIndex: null,
          lastResult: null,
          showDebugSong: false,
          phase: "ready",
        },
        "NEXT_PLAYER",
        state.players[nextIndex]?.name || "naechster Spieler"
      );
    }

    case "TOGGLE_DEBUG_SONG":
      return {
        ...state,
        showDebugSong: !state.showDebugSong,
      };

    default:
      return state;
  }
}


function readJsonBody(req) {
  return new Promise((resolve, reject) => {
    let raw = "";

    req.on("data", (chunk) => {
      raw += chunk;
      if (raw.length > 1_000_000) {
        reject(new Error("Request body too large."));
        req.destroy();
      }
    });

    req.on("end", () => {
      if (!raw) {
        resolve({});
        return;
      }

      try {
        resolve(JSON.parse(raw));
      } catch {
        reject(new Error("Invalid JSON."));
      }
    });

    req.on("error", reject);
  });
}

function createCodeVerifier() {
  return crypto.randomBytes(64).toString("base64url");
}

function createCodeChallenge(codeVerifier) {
  return crypto.createHash("sha256").update(codeVerifier).digest("base64url");
}

function createServerBaseUrl(req) {
  const forwardedProto = String(req.headers["x-forwarded-proto"] || "").split(",")[0].trim();
  const proto = forwardedProto || "http";
  return `${proto}://${req.headers.host}`;
}

function sendJson(res, statusCode, payload) {
  res.writeHead(statusCode, {
    "content-type": "application/json",
    "access-control-allow-origin": "*",
    "access-control-allow-methods": "GET,POST,OPTIONS",
    "access-control-allow-headers": "content-type",
  });
  res.end(JSON.stringify(payload));
}

function sendHtml(res, statusCode, html) {
  res.writeHead(statusCode, {
    "content-type": "text/html; charset=utf-8",
    "access-control-allow-origin": "*",
  });
  res.end(html);
}

function cleanExpiredSpotifyLogins() {
  const now = Date.now();

  for (const [loginId, login] of spotifyLogins.entries()) {
    if (login.expiresAt < now) {
      spotifyLogins.delete(loginId);
    }
  }
}

async function handleSpotifyCreateLogin(req, res) {
  try {
    const body = await readJsonBody(req);
    const clientId = String(body.clientId || "").trim();
    const requestedRoomCode = String(body.roomCode || "DEFAULT").toUpperCase();

    if (!clientId) {
      sendJson(res, 400, { error: "Spotify Client ID fehlt." });
      return;
    }

    cleanExpiredSpotifyLogins();

    const { roomCode } = getRoom(requestedRoomCode);
    const loginId = crypto.randomUUID();
    const codeVerifier = createCodeVerifier();
    const codeChallenge = createCodeChallenge(codeVerifier);
    const redirectUri = `${createServerBaseUrl(req)}/spotify/callback`;

    spotifyLogins.set(loginId, {
      loginId,
      clientId,
      roomCode,
      codeVerifier,
      redirectUri,
      token: null,
      error: null,
      expiresAt: Date.now() + 10 * 60 * 1000,
    });

    const params = new URLSearchParams({
      client_id: clientId,
      response_type: "code",
      redirect_uri: redirectUri,
      code_challenge_method: "S256",
      code_challenge: codeChallenge,
      scope: [
        "streaming",
        "user-read-email",
        "user-read-private",
        "user-read-playback-state",
        "user-modify-playback-state",
      ].join(" "),
      state: loginId,
    });

    sendJson(res, 200, {
      loginId,
      redirectUri,
      authorizeUrl: `https://accounts.spotify.com/authorize?${params.toString()}`,
    });
  } catch (error) {
    sendJson(res, 500, { error: error.message || "Spotify Login konnte nicht vorbereitet werden." });
  }
}

async function handleSpotifyCallback(req, res) {
  const url = new URL(req.url, createServerBaseUrl(req));
  const code = url.searchParams.get("code");
  const state = url.searchParams.get("state");
  const spotifyError = url.searchParams.get("error");

  const login = spotifyLogins.get(state || "");

  if (!login) {
    sendHtml(
      res,
      400,
      "<h1>Trackline Spotify Login</h1><p>Login-Session nicht gefunden oder abgelaufen. Bitte in Trackline erneut starten.</p>"
    );
    return;
  }

  if (spotifyError) {
    login.error = spotifyError;
    sendHtml(res, 400, `<h1>Trackline Spotify Login</h1><p>Spotify Fehler: ${spotifyError}</p>`);
    return;
  }

  if (!code) {
    login.error = "Spotify Code fehlt.";
    sendHtml(res, 400, "<h1>Trackline Spotify Login</h1><p>Spotify Code fehlt.</p>");
    return;
  }

  try {
    const body = new URLSearchParams({
      grant_type: "authorization_code",
      code,
      redirect_uri: login.redirectUri,
      client_id: login.clientId,
      code_verifier: login.codeVerifier,
    });

    const response = await fetch("https://accounts.spotify.com/api/token", {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body,
    });

    if (!response.ok) {
      const details = await response.text();
      login.error = details || `Spotify Token Fehler ${response.status}`;
      sendHtml(
        res,
        500,
        `<h1>Trackline Spotify Login</h1><p>Token-Austausch fehlgeschlagen.</p><pre>${details}</pre>`
      );
      return;
    }

    const data = await response.json();

    login.token = {
      accessToken: data.access_token,
      expiresAt: Date.now() + Number(data.expires_in || 3600) * 1000,
    };
    login.refreshToken = data.refresh_token || login.refreshToken || null;
    login.error = null;
    login.expiresAt = Date.now() + 5 * 60 * 1000;

    if (login.roomCode) {
      const { room } = getRoom(login.roomCode);
      room.spotify.token = login.token;
      room.spotify.refreshToken = login.refreshToken;
      room.spotify.clientId = login.clientId;
    }

    sendHtml(
      res,
      200,
      "<h1>Trackline Spotify Login erfolgreich</h1><p>Du kannst dieses Fenster schließen und zur Discord Activity zurückkehren.</p>"
    );
  } catch (error) {
    login.error = error.message || "Spotify Login fehlgeschlagen.";
    sendHtml(res, 500, `<h1>Trackline Spotify Login</h1><p>${login.error}</p>`);
  }
}

function handleSpotifyToken(req, res) {
  const loginId = decodeURIComponent(req.url.split("/").pop() || "");
  const login = spotifyLogins.get(loginId);

  if (!login) {
    sendJson(res, 404, { status: "error", message: "Spotify Login-Session nicht gefunden oder abgelaufen." });
    return;
  }

  if (login.error) {
    sendJson(res, 200, { status: "error", message: login.error });
    return;
  }

  if (!login.token) {
    sendJson(res, 200, { status: "pending" });
    return;
  }

  sendJson(res, 200, {
    status: "ready",
    connected: Boolean(login.token),
    roomCode: login.roomCode || null,
  });
}

function getRoom(roomCode) {
  const normalizedRoomCode = String(roomCode || "DEFAULT").toUpperCase();

  if (!rooms.has(normalizedRoomCode)) {
    rooms.set(normalizedRoomCode, {
      gameState: null,
      clients: new Map(),
      spotify: {
        token: null,
        refreshToken: null,
        clientId: null,
        deviceId: null,
        deviceName: "",
        playbackTimeout: null,
      },
      updatedAt: Date.now(),
    });
  }

  return {
    roomCode: normalizedRoomCode,
    room: rooms.get(normalizedRoomCode),
  };
}

function getClientCount(room) {
  return room.clients.size;
}

function getClientList(room) {
  return Array.from(room.clients.values()).map((client) => ({
    socketId: client.socketId,
    playerName: client.playerName,
    playerId: client.playerId || null,
    joinedAt: client.joinedAt,
  }));
}

function broadcastPresence(roomCode, room) {
  io.to(roomCode).emit("room:presence", {
    roomCode,
    clientCount: getClientCount(room),
    clients: getClientList(room),
  });
}

function broadcastState(roomCode, room) {
  io.to(roomCode).emit("room:state", {
    roomCode,
    gameState: room.gameState,
    clientCount: getClientCount(room),
    clients: getClientList(room),
  });
}


function getActor(state, action) {
  const actorPlayerId = action.actorPlayerId || null;
  const actor = state.players.find((player) => player.id === actorPlayerId) || null;
  const activePlayer = state.players[state.activePlayerIndex] || null;
  const isHost = Boolean(actorPlayerId && state.room?.hostPlayerId === actorPlayerId);
  const isActivePlayer = Boolean(actorPlayerId && activePlayer?.id === actorPlayerId);

  return {
    actor,
    actorPlayerId,
    activePlayer,
    isHost,
    isActivePlayer,
  };
}

function authorizeAction(state, action) {
  const type = action.type;

  if (type === "START_GAME") {
    return { ok: true };
  }

  if (!state || state.phase === "lobby" || !state.room) {
    if (type === "RESET_GAME") return { ok: true };
    return { ok: false, message: "Es laeuft noch kein Spiel." };
  }

  const actor = getActor(state, action);

  if (type === "RESET_GAME") {
    return actor.isHost ? { ok: true } : { ok: false, message: "Nur der Host darf das Spiel beenden." };
  }

  if (["TRACK_REVEALED", "NEXT_PLAYER"].includes(type)) {
    return actor.isHost || actor.isActivePlayer
      ? { ok: true }
      : { ok: false, message: "Nur Host/DJ oder der aktive Spieler darf aufdecken oder zum naechsten Spieler gehen." };
  }

  if (["TRACK_SKIPPED", "TOGGLE_DEBUG_SONG"].includes(type)) {
    return actor.isHost ? { ok: true } : { ok: false, message: "Nur der Host/DJ darf diese Aktion ausfuehren." };
  }

  if (["TRACK_DRAWN", "TRACK_PLAY_REQUESTED", "PLACEMENT_SELECTED"].includes(type)) {
    return actor.isHost || actor.isActivePlayer
      ? { ok: true }
      : { ok: false, message: "Nur Host/DJ oder der aktive Spieler darf diese Aktion ausfuehren." };
  }

  return { ok: false, message: `Unbekannte Aktion: ${type}` };
}

function enrichActionForServer(state, action) {
  const actor = getActor(state, action);

  if (action.type === "TRACK_PLAY_REQUESTED") {
    return {
      ...action,
      requesterName: actor.actor?.name || action.actorName || action.requesterName || "Spieler",
    };
  }

  return action;
}


async function getRoomSpotifyAccessToken(room) {
  if (!room.spotify?.token?.accessToken) {
    throw new Error("Spotify ist fuer diesen Raum noch nicht verbunden.");
  }

  if (Date.now() < Number(room.spotify.token.expiresAt || 0) - 30000) {
    return room.spotify.token.accessToken;
  }

  if (!room.spotify.refreshToken || !room.spotify.clientId) {
    throw new Error("Spotify Login ist abgelaufen. Host muss Spotify erneut verbinden.");
  }

  const body = new URLSearchParams({
    grant_type: "refresh_token",
    refresh_token: room.spotify.refreshToken,
    client_id: room.spotify.clientId,
  });

  const response = await fetch("https://accounts.spotify.com/api/token", {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body,
  });

  if (!response.ok) {
    throw new Error(`Spotify Refresh fehlgeschlagen: ${await response.text()}`);
  }

  const data = await response.json();

  room.spotify.token = {
    accessToken: data.access_token,
    expiresAt: Date.now() + Number(data.expires_in || 3600) * 1000,
  };

  if (data.refresh_token) {
    room.spotify.refreshToken = data.refresh_token;
  }

  return room.spotify.token.accessToken;
}

async function readSpotifyError(response) {
  try {
    const data = await response.json();
    return data?.error?.message || data?.error_description || JSON.stringify(data);
  } catch {
    try {
      return await response.text();
    } catch {
      return response.statusText;
    }
  }
}

async function spotifyFetch(room, url, options = {}) {
  const accessToken = await getRoomSpotifyAccessToken(room);
  const response = await fetch(url, {
    ...options,
    headers: {
      ...(options.headers || {}),
      Authorization: `Bearer ${accessToken}`,
    },
  });

  if (!response.ok && response.status !== 204) {
    throw new Error(`Spotify Fehler ${response.status}: ${await readSpotifyError(response)}`);
  }

  return response;
}

async function searchSpotifyUriForRoom(room, track) {
  if (track.spotifyUri) return track.spotifyUri;

  const accessToken = await getRoomSpotifyAccessToken(room);
  const mainArtist = String(track.artist || "").split(" feat.")[0].split(" ft.")[0].trim();
  const query = `track:${track.title} artist:${mainArtist}`;
  const params = new URLSearchParams({
    q: query,
    type: "track",
    limit: "1",
  });

  const response = await fetch(`https://api.spotify.com/v1/search?${params.toString()}`, {
    headers: {
      Authorization: `Bearer ${accessToken}`,
    },
  });

  if (!response.ok) {
    throw new Error(`Spotify Suche fehlgeschlagen: ${await readSpotifyError(response)}`);
  }

  const data = await response.json();
  const item = data?.tracks?.items?.[0];

  if (!item?.uri) {
    throw new Error("Keinen passenden Spotify-Track gefunden.");
  }

  return item.uri;
}

function getRoomFromSpotifyPath(req) {
  const url = new URL(req.url, "http://localhost");
  const parts = url.pathname.split("/").filter(Boolean);
  const roomCode = decodeURIComponent(parts[1] || "DEFAULT").toUpperCase();
  return getRoom(roomCode);
}

async function handleRoomSpotifyStatus(req, res) {
  const { roomCode, room } = getRoomFromSpotifyPath(req);
  sendJson(res, 200, {
    roomCode,
    connected: Boolean(room.spotify?.token?.accessToken),
    deviceId: room.spotify?.deviceId || "",
    deviceName: room.spotify?.deviceName || "",
  });
}

async function handleRoomSpotifyDevices(req, res) {
  try {
    const { roomCode, room } = getRoomFromSpotifyPath(req);
    const response = await spotifyFetch(room, "https://api.spotify.com/v1/me/player/devices");
    const data = await response.json();

    sendJson(res, 200, {
      roomCode,
      connected: true,
      deviceId: room.spotify.deviceId || "",
      deviceName: room.spotify.deviceName || "",
      devices: Array.isArray(data.devices) ? data.devices : [],
    });
  } catch (error) {
    sendJson(res, 400, { error: error.message || "Spotify-Geraete konnten nicht geladen werden." });
  }
}

async function handleRoomSpotifyDevice(req, res) {
  try {
    const body = await readJsonBody(req);
    const { roomCode, room } = getRoomFromSpotifyPath(req);
    const deviceId = String(body.deviceId || "").trim();
    const deviceName = String(body.deviceName || "Spotify-Geraet").trim();

    if (!deviceId) {
      sendJson(res, 400, { error: "deviceId fehlt." });
      return;
    }

    room.spotify.deviceId = deviceId;
    room.spotify.deviceName = deviceName;

    sendJson(res, 200, {
      roomCode,
      deviceId,
      deviceName,
    });
  } catch (error) {
    sendJson(res, 400, { error: error.message || "Spotify-Geraet konnte nicht gespeichert werden." });
  }
}

function wait(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function handleRoomSpotifyPlay(req, res) {
  try {
    const body = await readJsonBody(req);
    const { roomCode, room } = getRoomFromSpotifyPath(req);
    const state = room.gameState;
    const track = state?.currentTrack || body.track;
    const playLimitSeconds = Math.max(1, Math.min(120, Math.round(Number(body.playLimitSeconds || 20))));

    if (!track) {
      sendJson(res, 400, { error: "Kein aktueller Song im Raum." });
      return;
    }

    if (!room.spotify.deviceId) {
      sendJson(res, 400, { error: "Kein Spotify-Zielgeraet gespeichert. Host muss Geraete laden und Zielgeraet speichern." });
      return;
    }

    const spotifyUri = await searchSpotifyUriForRoom(room, track);

    await spotifyFetch(room, "https://api.spotify.com/v1/me/player", {
      method: "PUT",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        device_ids: [room.spotify.deviceId],
        play: false,
      }),
    });

    await wait(700);

    await spotifyFetch(room, `https://api.spotify.com/v1/me/player/play?device_id=${encodeURIComponent(room.spotify.deviceId)}`, {
      method: "PUT",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        uris: [spotifyUri],
      }),
    });

    if (room.spotify.playbackTimeout) {
      clearTimeout(room.spotify.playbackTimeout);
    }

    room.spotify.playbackTimeout = setTimeout(async () => {
      try {
        await spotifyFetch(room, `https://api.spotify.com/v1/me/player/pause?device_id=${encodeURIComponent(room.spotify.deviceId)}`, {
          method: "PUT",
        });
      } catch (error) {
        console.log(`[spotify pause timeout] ${roomCode}: ${error.message}`);
      }
    }, playLimitSeconds * 1000);

    sendJson(res, 200, {
      roomCode,
      ok: true,
      trackId: track.id,
      hiddenLabel: "Verdeckter Song",
      deviceId: room.spotify.deviceId,
      deviceName: room.spotify.deviceName || "Spotify-Geraet",
      playLimitSeconds,
    });
  } catch (error) {
    sendJson(res, 400, { error: error.message || "Spotify Wiedergabe fehlgeschlagen." });
  }
}

async function handleRoomSpotifyPause(req, res) {
  try {
    const { roomCode, room } = getRoomFromSpotifyPath(req);

    if (room.spotify.playbackTimeout) {
      clearTimeout(room.spotify.playbackTimeout);
      room.spotify.playbackTimeout = null;
    }

    if (!room.spotify.deviceId) {
      sendJson(res, 400, { error: "Kein Spotify-Zielgeraet gespeichert." });
      return;
    }

    await spotifyFetch(room, `https://api.spotify.com/v1/me/player/pause?device_id=${encodeURIComponent(room.spotify.deviceId)}`, {
      method: "PUT",
    });

    sendJson(res, 200, { roomCode, ok: true });
  } catch (error) {
    sendJson(res, 400, { error: error.message || "Spotify Pause fehlgeschlagen." });
  }
}

const httpServer = createServer(async (req, res) => {
  if (req.method === "OPTIONS") {
    sendJson(res, 204, {});
    return;
  }

  if (req.url === "/health") {
    sendJson(res, 200, { ok: true, rooms: rooms.size, spotifyLogins: spotifyLogins.size });
    return;
  }

  if (req.method === "POST" && req.url === "/spotify/create-login") {
    await handleSpotifyCreateLogin(req, res);
    return;
  }

  if (req.method === "GET" && req.url.startsWith("/spotify/callback")) {
    await handleSpotifyCallback(req, res);
    return;
  }

  if (req.method === "GET" && req.url.startsWith("/spotify/token/")) {
    handleSpotifyToken(req, res);
    return;
  }

  if (req.method === "GET" && req.url.match(/^\/room\/[^/]+\/spotify\/status/)) {
    await handleRoomSpotifyStatus(req, res);
    return;
  }

  if (req.method === "GET" && req.url.match(/^\/room\/[^/]+\/spotify\/devices/)) {
    await handleRoomSpotifyDevices(req, res);
    return;
  }

  if (req.method === "POST" && req.url.match(/^\/room\/[^/]+\/spotify\/device/)) {
    await handleRoomSpotifyDevice(req, res);
    return;
  }

  if (req.method === "POST" && req.url.match(/^\/room\/[^/]+\/spotify\/play/)) {
    await handleRoomSpotifyPlay(req, res);
    return;
  }

  if (req.method === "POST" && req.url.match(/^\/room\/[^/]+\/spotify\/pause/)) {
    await handleRoomSpotifyPause(req, res);
    return;
  }

  res.writeHead(200, { "content-type": "text/plain; charset=utf-8" });
  res.end("Trackline web game sync and Spotify auth server is running.");
});

const io = new Server(httpServer, {
  cors: {
    origin: "*",
    methods: ["GET", "POST"],
  },
});

io.on("connection", (socket) => {
  let currentRoomCode = null;

  socket.on("room:join", ({ roomCode, playerName } = {}) => {
    const result = getRoom(roomCode);
    currentRoomCode = result.roomCode;

    socket.join(currentRoomCode);

    result.room.clients.set(socket.id, {
      socketId: socket.id,
      playerName: playerName || "Spieler",
      playerId: null,
      joinedAt: Date.now(),
    });

    const clientCount = getClientCount(result.room);

    socket.emit("room:joined", {
      roomCode: currentRoomCode,
      gameState: result.room.gameState,
      clientCount,
      clients: getClientList(result.room),
    });

    broadcastPresence(currentRoomCode, result.room);

    console.log(`[join] ${socket.id} -> ${currentRoomCode} (${clientCount} clients)`);
  });

  socket.on("room:claimPlayer", ({ roomCode, playerId, playerName } = {}) => {
    const result = getRoom(roomCode || currentRoomCode);
    currentRoomCode = result.roomCode;
    socket.join(currentRoomCode);

    const client = result.room.clients.get(socket.id) || {
      socketId: socket.id,
      joinedAt: Date.now(),
    };

    const claimedPlayer = result.room.gameState?.players?.find((player) => player.id === playerId);

    if (!claimedPlayer) {
      socket.emit("room:error", { message: "Dieser Spieler existiert im aktuellen Raum nicht." });
      return;
    }

    const alreadyClaimed = Array.from(result.room.clients.values()).find(
      (item) => item.socketId !== socket.id && item.playerId === playerId
    );

    if (alreadyClaimed) {
      socket.emit("room:error", { message: `${claimedPlayer.name} ist bereits mit einem anderen Client verbunden.` });
      broadcastPresence(currentRoomCode, result.room);
      return;
    }

    client.playerId = playerId;
    client.playerName = claimedPlayer.name || playerName || client.playerName || "Spieler";

    result.room.clients.set(socket.id, client);

    broadcastPresence(currentRoomCode, result.room);

    console.log(`[claim] ${socket.id} -> ${currentRoomCode} player=${client.playerName} id=${client.playerId || "-"}`);
  });

  socket.on("room:event", ({ roomCode, action } = {}) => {
    const result = getRoom(roomCode || currentRoomCode);
    currentRoomCode = result.roomCode;

    if (!action?.type) {
      socket.emit("room:error", { message: "Ungueltige Aktion." });
      return;
    }

    const previousState = result.room.gameState || initialGameState;
    const client = result.room.clients.get(socket.id);
    const socketBoundAction = {
      ...action,
      actorPlayerId: action.type === "START_GAME" ? action.actorPlayerId || null : client?.playerId || null,
      actorName: client?.playerName || action.actorName || "Spieler",
    };

    const authorization = authorizeAction(previousState, socketBoundAction);

    if (!authorization.ok) {
      socket.emit("room:error", { message: authorization.message });
      console.log(`[reject] ${currentRoomCode} ${action.type}: ${authorization.message}`);
      return;
    }

    const serverAction = enrichActionForServer(previousState, socketBoundAction);
    const nextState = gameReducer(previousState, serverAction);

    result.room.gameState = nextState;
    result.room.updatedAt = Date.now();

    if (action.type === "START_GAME") {
      const hostPlayerId = nextState.room?.hostPlayerId || null;
      const hostName = nextState.room?.hostName || client?.playerName || "Host";
      const updatedClient = result.room.clients.get(socket.id) || {
        socketId: socket.id,
        joinedAt: Date.now(),
      };

      updatedClient.playerId = hostPlayerId;
      updatedClient.playerName = hostName;
      result.room.clients.set(socket.id, updatedClient);
    }

    broadcastState(currentRoomCode, result.room);

    console.log(`[event] ${currentRoomCode} ${action.type} actor=${serverAction.actorPlayerId || "-"} -> ${nextState.phase}`);
  });

  socket.on("disconnect", () => {
    if (!currentRoomCode || !rooms.has(currentRoomCode)) return;

    const room = rooms.get(currentRoomCode);
    room.clients.delete(socket.id);

    const clientCount = getClientCount(room);

    broadcastPresence(currentRoomCode, room);

    console.log(`[disconnect] ${socket.id} from ${currentRoomCode} (${clientCount} clients)`);
  });
});

httpServer.listen(PORT, () => {
  console.log(`Trackline authoritative sync server listening on http://localhost:${PORT}`);
});
