import { createServer } from "node:http";
import crypto from "node:crypto";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname } from "node:path";
import { Server } from "socket.io";

const PORT = Number(process.env.PORT || 3001);
const rooms = new Map();
const spotifyLogins = new Map();
const DEFAULT_PLAY_LIMIT_SECONDS = 20;
const ROOM_STATE_FILE = process.env.TRACKLINE_ROOM_STATE_FILE || "./trackline-room-state.json";

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
  playLimitSeconds: DEFAULT_PLAY_LIMIT_SECONDS,
  difficulty: "normal",
  gameMode: "solo",
  turnNumber: 1,
  showDebugSong: false,
  discardedTracks: [],
  playedTrackHistory: [],
  songReports: [],
  blockedTrackKeys: [],
  usedTrackIds: [],
  usedTrackKeys: [],
  overtime: false,
  overtimePlayerIds: [],
  overtimePendingPlayerIds: [],
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
  const result = [...array];

  for (let index = result.length - 1; index > 0; index -= 1) {
    const swapIndex = crypto.randomInt(index + 1);
    [result[index], result[swapIndex]] = [result[swapIndex], result[index]];
  }

  return result;
}

function getEraBucket(track) {
  const year = Number(track?.year || 0);

  if (year < 1960) return "1950er";
  if (year < 1970) return "1960er";
  if (year < 1980) return "1970er";
  if (year < 1990) return "1980er";
  if (year < 2000) return "1990er";
  if (year < 2010) return "2000er";
  if (year < 2020) return "2010er";

  return "2020er";
}

function buildBalancedDeck(tracks) {
  const buckets = new Map();

  for (const track of shuffle(tracks)) {
    const bucket = getEraBucket(track);
    const group = buckets.get(bucket) || [];
    group.push(track);
    buckets.set(bucket, group);
  }

  const bucketOrder = shuffle(Array.from(buckets.keys()));
  const result = [];

  while (buckets.size > 0) {
    for (const bucket of [...bucketOrder]) {
      const group = buckets.get(bucket);

      if (!group || group.length === 0) {
        buckets.delete(bucket);
        continue;
      }

      result.push(group.shift());

      if (group.length === 0) buckets.delete(bucket);
    }
  }

  return result;
}

function sortTimeline(timeline) {
  return [...timeline].sort((a, b) => a.year - b.year || a.title.localeCompare(b.title));
}

function normalizeTrackText(value) {
  return String(value || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

function getTrackTitleKey(track) {
  return normalizeTrackText(track?.title)
    .replace(/\b(remaster(ed)?|radio edit|single version|album version|live|mono|stereo|explicit|clean)\b/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

function getTrackDedupeKey(track) {
  return getTrackTitleKey(track);
}

function dedupeTrackDeck(tracks) {
  const seenTitles = new Set();
  const result = [];

  for (const track of Array.isArray(tracks) ? tracks : []) {
    const key = getTrackDedupeKey(track);

    if (!key || seenTitles.has(key)) continue;

    seenTitles.add(key);
    result.push(track);
  }

  return result;
}

function preparePlayableDeck(tracks) {
  return shuffle(dedupeTrackDeck(tracks));
}

function normalizeTeamConfig(names, teamConfig = {}) {
  const safeNames = Array.isArray(names) && names.length ? names : ["Host"];
  const teamCount = Math.max(2, Math.min(4, Number(teamConfig.teamCount || 2), safeNames.length));
  const teamNames = Array.from({ length: teamCount }, (_, index) => {
    const configuredName = String(teamConfig.teamNames?.[index] || "").trim();
    return configuredName || `Team ${index + 1}`;
  });
  const assignments = teamConfig.assignments && typeof teamConfig.assignments === "object" ? teamConfig.assignments : {};

  return {
    safeNames,
    teamCount,
    teamNames,
    assignments,
  };
}

function splitIntoTeams(names, teamConfig = {}) {
  const { safeNames, teamCount, teamNames, assignments } = normalizeTeamConfig(names, teamConfig);
  const teams = Array.from({ length: teamCount }, (_, index) => ({
    name: teamNames[index],
    members: [],
  }));

  safeNames.forEach((name, index) => {
    const configuredIndex = Number(assignments[name]);
    const teamIndex = Number.isInteger(configuredIndex) && configuredIndex >= 0 && configuredIndex < teamCount ? configuredIndex : index % teamCount;
    teams[teamIndex].members.push(name);
  });

  const nonEmptyTeams = teams.filter((team) => team.members.length > 0);

  return nonEmptyTeams.length ? nonEmptyTeams : [{ name: teamNames[0] || "Team 1", members: safeNames }];
}

function createSoloPlayers(names) {
  const starters = shuffle(STARTING_TRACKS);

  return names.map((name, index) => ({
    id: createId("player"),
    name,
    role: index === 0 ? "host" : "player",
    teamMembers: [],
    activeMemberIndex: 0,
    timeline: [starters[index % starters.length]],
    score: 1,
    correct: 0,
    wrong: 0,
  }));
}

function createTeamPlayers(names, teamConfig = {}) {
  const starters = shuffle(STARTING_TRACKS);
  const teams = splitIntoTeams(names, teamConfig);

  return teams.map((team, index) => ({
    id: createId("team"),
    name: team.name || `Team ${index + 1}`,
    role: index === 0 ? "host" : "player",
    teamMembers: team.members,
    activeMemberIndex: 0,
    timeline: [starters[index % starters.length]],
    score: 1,
    correct: 0,
    wrong: 0,
  }));
}

function createInitialPlayers(names, gameMode = "solo", teamConfig = {}) {
  const safeNames = Array.isArray(names) && names.length ? names : ["Host"];

  return gameMode === "teams" && safeNames.length >= 2 ? createTeamPlayers(safeNames, teamConfig) : createSoloPlayers(safeNames);
}

function resetPlayersForNewRound(players) {
  const starters = shuffle(STARTING_TRACKS);

  return players.map((player, index) => ({
    ...player,
    role: index === 0 ? "host" : "player",
    activeMemberIndex: 0,
    timeline: [starters[index % starters.length]],
    score: 1,
    correct: 0,
    wrong: 0,
  }));
}

function isTeamPlayer(player) {
  return Array.isArray(player?.teamMembers) && player.teamMembers.length > 0;
}

function getActiveTeamMemberName(player) {
  if (!isTeamPlayer(player)) return "";

  return player.teamMembers[player.activeMemberIndex % player.teamMembers.length] || player.teamMembers[0] || "";
}

function getPlayerTurnLabel(player) {
  const memberName = getActiveTeamMemberName(player);

  return memberName ? `${player.name} · ${memberName}` : player?.name || "-";
}

function getPlayerSubLabel(player) {
  if (!isTeamPlayer(player)) return "";

  return player.teamMembers.join(", ");
}

function advanceTeamMember(player) {
  if (!isTeamPlayer(player)) return player;

  return {
    ...player,
    activeMemberIndex: (Number(player.activeMemberIndex || 0) + 1) % player.teamMembers.length,
  };
}

function advanceCurrentPlayerMember(players, activePlayerIndex) {
  return players.map((player, index) => (index === activePlayerIndex ? advanceTeamMember(player) : player));
}

function getStartPlayerIndex(players, startPlayerName) {
  const wantedName = String(startPlayerName || "").trim();

  if (!wantedName) return 0;

  const directIndex = players.findIndex((player) => player.name === wantedName);

  if (directIndex >= 0) return directIndex;

  const teamIndex = players.findIndex((player) => Array.isArray(player.teamMembers) && player.teamMembers.includes(wantedName));

  return teamIndex >= 0 ? teamIndex : 0;
}

function isInsertSlotAllowed(timeline, insertIndex) {
  const orderedTimeline = sortTimeline(timeline);
  const left = orderedTimeline[insertIndex - 1];
  const right = orderedTimeline[insertIndex];

  return !(left && right && left.year === right.year);
}

function isCorrectPlacement(timeline, track, insertIndex) {
  if (!isInsertSlotAllowed(timeline, insertIndex)) return false;

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

function getFinalWinner(players, targetScore) {
  const eligiblePlayers = players.filter((player) => player.score >= targetScore);

  if (!eligiblePlayers.length) return null;

  const topScore = Math.max(...eligiblePlayers.map((player) => player.score));
  const leaders = eligiblePlayers.filter((player) => player.score === topScore);

  return leaders.length === 1 ? leaders[0] : null;
}

function hasTargetTie(players, targetScore) {
  const eligiblePlayers = players.filter((player) => player.score >= targetScore);

  if (eligiblePlayers.length < 2) return false;

  const topScore = Math.max(...eligiblePlayers.map((player) => player.score));

  return eligiblePlayers.filter((player) => player.score === topScore).length > 1;
}

function getOvertimeContenderPlayerIds(players, targetScore, allowedPlayerIds = null) {
  const allowedSet = Array.isArray(allowedPlayerIds) && allowedPlayerIds.length ? new Set(allowedPlayerIds) : null;
  const eligible = players.filter((player) => player.score >= targetScore && (!allowedSet || allowedSet.has(player.id)));

  if (eligible.length < 2) return [];

  const topScore = Math.max(...eligible.map((player) => player.score));

  return eligible.filter((player) => player.score === topScore).map((player) => player.id);
}

function getPlayerIndexById(players, playerId) {
  return Math.max(0, players.findIndex((player) => player.id === playerId));
}

function getNextIndexFromAllowedPlayerIds(currentIndex, allowedPlayerIds, players) {
  if (!allowedPlayerIds.length) return (currentIndex + 1) % players.length;

  const allowedIndexes = allowedPlayerIds
    .map((playerId) => players.findIndex((player) => player.id === playerId))
    .filter((index) => index >= 0)
    .sort((a, b) => a - b);

  if (!allowedIndexes.length) return (currentIndex + 1) % players.length;

  const nextHigher = allowedIndexes.find((index) => index > currentIndex);

  return nextHigher ?? allowedIndexes[0];
}

function getBlockedTrackKeySet(state) {
  return new Set(Array.isArray(state.blockedTrackKeys) ? state.blockedTrackKeys : []);
}

function filterBlockedTracks(deck, state) {
  const blockedTrackKeys = getBlockedTrackKeySet(state);

  return (Array.isArray(deck) ? deck : []).filter((track) => !blockedTrackKeys.has(getTrackDedupeKey(track)));
}

function createPlayedTrackEntry(state, activePlayer, result = {}) {
  const track = state.currentTrack;

  return {
    id: createId("played"),
    trackId: track?.id || "",
    trackKey: getTrackDedupeKey(track),
    title: track?.title || "",
    artist: track?.artist || "",
    year: track?.year || "",
    genre: track?.genre || "",
    playerName: getPlayerTurnLabel(activePlayer),
    teamName: activePlayer?.name || "",
    activeMemberName: getActiveTeamMemberName(activePlayer),
    correct: Boolean(result.correct),
    skipped: Boolean(result.skipped),
    createdAt: new Date().toLocaleTimeString(),
  };
}

function createSongReportEntry(track, reason, actorName = "Host") {
  return {
    id: createId("report"),
    trackId: track?.id || "",
    trackKey: getTrackDedupeKey(track),
    title: track?.title || "",
    artist: track?.artist || "",
    year: track?.year || "",
    reason,
    actorName,
    createdAt: new Date().toLocaleTimeString(),
  };
}

function getUsedTrackIdSet(state) {
  return new Set(Array.isArray(state.usedTrackIds) ? state.usedTrackIds : []);
}

function getUsedTrackKeySet(state) {
  return new Set(Array.isArray(state.usedTrackKeys) ? state.usedTrackKeys : []);
}

function filterUnusedDeck(deck, state) {
  const usedTrackIds = getUsedTrackIdSet(state);
  const usedTrackKeys = getUsedTrackKeySet(state);

  const blockedTrackKeys = getBlockedTrackKeySet(state);

  return (Array.isArray(deck) ? deck : []).filter(
    (track) => !usedTrackIds.has(track.id) && !usedTrackKeys.has(getTrackDedupeKey(track)) && !blockedTrackKeys.has(getTrackDedupeKey(track))
  );
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

    case "NEW_ROUND": {
      if (!state.players.length || !state.room) return state;

      const deck = dedupeTrackDeck(filterUnusedDeck(action.deck, state));
      const players = resetPlayersForNewRound(state.players);

      const nextState = {
        ...initialGameState,
        phase: "ready",
        room: {
          ...state.room,
          hostPlayerId: players[0]?.id || state.room.hostPlayerId,
          hostName: players[0]?.name || state.room.hostName || "Host",
        },
        players,
        playedTrackHistory: state.playedTrackHistory || [],
        songReports: state.songReports || [],
        blockedTrackKeys: state.blockedTrackKeys || [],
        usedTrackIds: state.usedTrackIds || [],
        usedTrackKeys: state.usedTrackKeys || [],
        overtime: false,
        deck: preparePlayableDeck(deck),
        targetScore: Number(action.targetScore || state.targetScore || 10),
        maxTurns: Number(action.maxTurns ?? state.maxTurns ?? 0),
        playLimitSeconds: Math.max(1, Math.min(120, Number(action.playLimitSeconds || state.playLimitSeconds || DEFAULT_PLAY_LIMIT_SECONDS))),
        difficulty: action.difficulty || state.difficulty || "normal",
        gameMode: state.gameMode || action.gameMode || "solo",
        gameLog: [
          {
            id: createId("log"),
            text: `Neue Runde gestartet mit ${players.length} Spielern und ${deck.length} Songs im Deck.`,
          },
        ],
      };

      return addEvent(nextState, "NEW_ROUND", `${players.length} Spieler, ${deck.length} Songs`);
    }

    case "START_GAME": {
      const playerNames = Array.isArray(action.playerNames) && action.playerNames.length > 0 ? action.playerNames : ["Host"];
      const deck = Array.isArray(action.deck) ? action.deck : [];
      const players = createInitialPlayers(playerNames, action.gameMode || "solo", action.teamConfig || {});

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
        activePlayerIndex: getStartPlayerIndex(players, action.startPlayerName),
        deck: preparePlayableDeck(deck),
        targetScore: Number(action.targetScore || 10),
        maxTurns: Number(action.maxTurns || 0),
        playLimitSeconds: Math.max(1, Math.min(120, Number(action.playLimitSeconds || DEFAULT_PLAY_LIMIT_SECONDS))),
        difficulty: action.difficulty || "normal",
        gameMode: action.gameMode || "solo",
        gameLog: [
          {
            id: createId("log"),
            text: action.gameMode === "teams"
              ? `Teamspiel gestartet mit ${players.length} Teams und ${deck.length} Songs im Deck.`
              : `Spiel gestartet mit ${playerNames.length} Spielern und ${deck.length} Songs im Deck.`,
          },
        ],
      };

      return addEvent(nextState, "GAME_STARTED", `${playerNames.length} Spieler, ${deck.length} Songs`);
    }

    case "TRACK_DRAWN": {
      if (state.phase !== "ready" || state.deck.length === 0) return state;

      const blockedTrackKeys = getBlockedTrackKeySet(state);
      const nextTrackIndex = state.deck.findIndex((track) => !blockedTrackKeys.has(getTrackDedupeKey(track)));

      if (nextTrackIndex < 0) return state;

      const nextTrack = state.deck[nextTrackIndex];
      const remainingDeck = state.deck.filter((_, index) => index !== nextTrackIndex);

      return addEvent(
        {
          ...state,
          phase: "placing",
          currentTrack: nextTrack,
          deck: remainingDeck,
          usedTrackIds: Array.from(new Set([...(state.usedTrackIds || []), nextTrack.id])),
          usedTrackKeys: Array.from(new Set([...(state.usedTrackKeys || []), getTrackDedupeKey(nextTrack)])),
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

      const activePlayer = state.players[state.activePlayerIndex];
      if (!activePlayer || !isInsertSlotAllowed(activePlayer.timeline, action.insertIndex)) return state;

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
        playLimitSeconds: Math.max(1, Math.min(120, Number(action.playLimitSeconds || state.playLimitSeconds || DEFAULT_PLAY_LIMIT_SECONDS))),
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
        ? `${getPlayerTurnLabel(activePlayer)} hat ${state.currentTrack.title} (${state.currentTrack.year}) richtig ${placementLabel} einsortiert.`
        : `${getPlayerTurnLabel(activePlayer)} lag mit ${state.currentTrack.title} (${state.currentTrack.year}) falsch. Gewaehlt: ${placementLabel}.`;

      const playedEntry = createPlayedTrackEntry(state, activePlayer, { correct });

      return addEvent(
        {
          ...state,
          players,
          phase: "reveal",
          playedTrackHistory: [playedEntry, ...(state.playedTrackHistory || [])].slice(0, 80),
          lastResult: {
            correct,
            placementLabel,
            playerName: getPlayerTurnLabel(activePlayer),
            teamName: activePlayer.name,
            activeMemberName: getActiveTeamMemberName(activePlayer),
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

      const playedEntry = createPlayedTrackEntry(state, activePlayer, { correct: false, skipped: true });

      return addEvent(
        {
          ...state,
          phase: "reveal",
          showDebugSong: true,
          playedTrackHistory: [playedEntry, ...(state.playedTrackHistory || [])].slice(0, 80),
          discardedTracks: [state.currentTrack, ...state.discardedTracks],
          lastResult: {
            correct: false,
            skipped: true,
            placementLabel: "uebersprungen",
            playerName: getPlayerTurnLabel(activePlayer),
            teamName: activePlayer.name,
            activeMemberName: getActiveTeamMemberName(activePlayer),
            track: state.currentTrack,
          },
          gameLog: [
            {
              id: createId("log"),
              text: `${getPlayerTurnLabel(activePlayer)} hat ${state.currentTrack.title} uebersprungen.`,
            },
            ...state.gameLog,
          ].slice(0, 12),
        },
        "TRACK_SKIPPED",
        "Song uebersprungen"
      );
    }

    case "NEXT_PLAYER": {
      const turnsFinished = state.maxTurns > 0 && state.turnNumber >= state.maxTurns;
      const deckFinished = state.deck.length === 0;
      const finalWinner = getFinalWinner(state.players, state.targetScore);
      const targetTie = hasTargetTie(state.players, state.targetScore);
      const targetReached = state.players.some((player) => player.score >= state.targetScore);
      const playersAfterTurn = advanceCurrentPlayerMember(state.players, state.activePlayerIndex);

      if (deckFinished || turnsFinished) {
        return addEvent(
          {
            ...state,
            players: playersAfterTurn,
            phase: "finished",
            overtime: false,
            overtimePlayerIds: [],
            overtimePendingPlayerIds: [],
          },
          "GAME_FINISHED",
          finalWinner ? `Gewinner: ${finalWinner.name}` : "Limit erreicht"
        );
      }

      if (state.overtime) {
        const currentPlayerId = state.players[state.activePlayerIndex]?.id;
        const currentOvertimePlayerIds =
          Array.isArray(state.overtimePlayerIds) && state.overtimePlayerIds.length
            ? state.overtimePlayerIds
            : getOvertimeContenderPlayerIds(state.players, state.targetScore);

        const pendingAfterCurrent = (state.overtimePendingPlayerIds?.length ? state.overtimePendingPlayerIds : currentOvertimePlayerIds)
          .filter((playerId) => playerId !== currentPlayerId);

        if (pendingAfterCurrent.length > 0) {
          const nextOvertimeIndex = getNextIndexFromAllowedPlayerIds(state.activePlayerIndex, pendingAfterCurrent, playersAfterTurn);

          return addEvent(
            {
              ...state,
              players: playersAfterTurn,
              activePlayerIndex: nextOvertimeIndex,
              turnNumber: state.turnNumber + 1,
              currentTrack: null,
              selectedInsertIndex: null,
              lastResult: null,
              showDebugSong: false,
              overtime: true,
              overtimePlayerIds: currentOvertimePlayerIds,
              overtimePendingPlayerIds: pendingAfterCurrent,
              phase: "ready",
            },
            "OVERTIME_NEXT_PLAYER",
            getPlayerTurnLabel(playersAfterTurn[nextOvertimeIndex]) || "Verlaengerung"
          );
        }

        const nextContenderIds = getOvertimeContenderPlayerIds(state.players, state.targetScore, currentOvertimePlayerIds);

        if (nextContenderIds.length <= 1) {
          const winnerId = nextContenderIds[0] || finalWinner?.id;
          const winner = state.players.find((player) => player.id === winnerId) || finalWinner;

          return addEvent(
            {
              ...state,
              players: playersAfterTurn,
              phase: "finished",
              overtime: false,
              overtimePlayerIds: [],
              overtimePendingPlayerIds: [],
            },
            "GAME_FINISHED",
            winner ? `Gewinner nach Verlaengerung: ${winner.name}` : "Verlaengerung beendet"
          );
        }

        const nextOvertimeIndex = getNextIndexFromAllowedPlayerIds(state.activePlayerIndex, nextContenderIds, playersAfterTurn);

        return addEvent(
          {
            ...state,
            players: playersAfterTurn,
            activePlayerIndex: nextOvertimeIndex,
            turnNumber: state.turnNumber + 1,
            currentTrack: null,
            selectedInsertIndex: null,
            lastResult: null,
            showDebugSong: false,
            overtime: true,
            overtimePlayerIds: nextContenderIds,
            overtimePendingPlayerIds: nextContenderIds,
            phase: "ready",
          },
          "OVERTIME_ROUND_CONTINUES",
          getPlayerTurnLabel(playersAfterTurn[nextOvertimeIndex]) || "Verlaengerung"
        );
      }

      const normalNextIndex = (state.activePlayerIndex + 1) % state.players.length;
      const isEndOfRound = normalNextIndex === 0;

      if (isEndOfRound && finalWinner && !targetTie) {
        return addEvent(
          {
            ...state,
            players: playersAfterTurn,
            phase: "finished",
            overtime: false,
            overtimePlayerIds: [],
            overtimePendingPlayerIds: [],
          },
          "GAME_FINISHED",
          `Gewinner: ${finalWinner.name}`
        );
      }

      if (isEndOfRound && targetReached && targetTie) {
        const overtimePlayerIds = getOvertimeContenderPlayerIds(state.players, state.targetScore);
        const nextOvertimeIndex = getNextIndexFromAllowedPlayerIds(state.activePlayerIndex, overtimePlayerIds, playersAfterTurn);

        return addEvent(
          {
            ...state,
            players: playersAfterTurn,
            activePlayerIndex: nextOvertimeIndex,
            turnNumber: state.turnNumber + 1,
            currentTrack: null,
            selectedInsertIndex: null,
            lastResult: null,
            showDebugSong: false,
            overtime: true,
            overtimePlayerIds,
            overtimePendingPlayerIds: overtimePlayerIds,
            phase: "ready",
          },
          "OVERTIME_STARTED",
          getPlayerTurnLabel(playersAfterTurn[nextOvertimeIndex]) || "Verlaengerung"
        );
      }

      return addEvent(
        {
          ...state,
          players: playersAfterTurn,
          activePlayerIndex: normalNextIndex,
          turnNumber: state.turnNumber + 1,
          currentTrack: null,
          selectedInsertIndex: null,
          lastResult: null,
          showDebugSong: false,
          overtime: false,
          overtimePlayerIds: [],
          overtimePendingPlayerIds: [],
          phase: "ready",
        },
        "NEXT_PLAYER",
        getPlayerTurnLabel(playersAfterTurn[normalNextIndex]) || "naechster Spieler"
      );
    }

    case "BLOCK_TRACK": {
      const track = action.track || state.currentTrack || state.lastResult?.track;
      const trackKey = action.trackKey || getTrackDedupeKey(track);

      if (!trackKey) return state;

      const reportReason = action.reason || "blockiert";

      return addEvent(
        {
          ...state,
          blockedTrackKeys: Array.from(new Set([...(state.blockedTrackKeys || []), trackKey])),
          songReports: [createSongReportEntry(track, reportReason, action.actorName || "Host"), ...(state.songReports || [])].slice(0, 100),
          deck: (state.deck || []).filter((item) => getTrackDedupeKey(item) !== trackKey),
        },
        "TRACK_BLOCKED",
        track?.title || trackKey
      );
    }

    case "UNBLOCK_TRACK": {
      const trackKey = action.trackKey;

      if (!trackKey) return state;

      return addEvent(
        {
          ...state,
          blockedTrackKeys: (state.blockedTrackKeys || []).filter((key) => key !== trackKey),
        },
        "TRACK_UNBLOCKED",
        trackKey
      );
    }

    case "REPORT_TRACK": {
      const track = action.track || state.currentTrack || state.lastResult?.track;

      if (!track) return state;

      return addEvent(
        {
          ...state,
          songReports: [createSongReportEntry(track, action.reason || "markiert", action.actorName || "Host"), ...(state.songReports || [])].slice(0, 100),
        },
        "TRACK_REPORTED",
        `${track.title} · ${action.reason || "markiert"}`
      );
    }

    case "CLEAR_SONG_REPORTS":
      return addEvent(
        {
          ...state,
          songReports: [],
        },
        "SONG_REPORTS_CLEARED",
        "Song-Markierungen geleert"
      );

    case "CLEAR_BLOCKED_TRACKS":
      return addEvent(
        {
          ...state,
          blockedTrackKeys: [],
        },
        "BLOCKLIST_CLEARED",
        "Blacklist geleert"
      );

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


function createRoomRecord(seed = {}) {
  const savedSpotify = seed.spotify || {};

  return {
    gameState: seed.gameState || null,
    clients: new Map(),
    playerClaims: new Map(Array.isArray(seed.playerClaims) ? seed.playerClaims : []),
    spotify: {
      token: null,
      refreshToken: null,
      clientId: null,
      deviceId: savedSpotify.deviceId || "",
      deviceName: savedSpotify.deviceName || "",
      playbackTimeout: null,
    },
    updatedAt: seed.updatedAt || Date.now(),
  };
}

function serializeRoom(room) {
  return {
    gameState: room.gameState || null,
    playerClaims: Array.from(room.playerClaims?.entries?.() || []),
    spotify: {
      deviceId: room.spotify?.deviceId || "",
      deviceName: room.spotify?.deviceName || "",
    },
    updatedAt: room.updatedAt || Date.now(),
  };
}

function savePersistedRooms() {
  try {
    mkdirSync(dirname(ROOM_STATE_FILE), { recursive: true });

    const payload = {
      version: 1,
      savedAt: Date.now(),
      rooms: Array.from(rooms.entries()).map(([roomCode, room]) => [roomCode, serializeRoom(room)]),
    };

    writeFileSync(ROOM_STATE_FILE, JSON.stringify(payload, null, 2), "utf8");
  } catch (error) {
    console.log(`[persist save] ${error.message}`);
  }
}

function loadPersistedRooms() {
  try {
    if (!existsSync(ROOM_STATE_FILE)) return;

    const payload = JSON.parse(readFileSync(ROOM_STATE_FILE, "utf8"));
    const entries = Array.isArray(payload.rooms) ? payload.rooms : [];

    for (const [roomCode, roomData] of entries) {
      if (!roomCode) continue;

      rooms.set(String(roomCode).toUpperCase(), createRoomRecord(roomData));
    }

    console.log(`[persist load] ${rooms.size} room(s) restored from ${ROOM_STATE_FILE}`);
  } catch (error) {
    console.log(`[persist load] ${error.message}`);
  }
}

function getRoom(roomCode) {
  const normalizedRoomCode = String(roomCode || "DEFAULT").toUpperCase();

  if (!rooms.has(normalizedRoomCode)) {
    rooms.set(normalizedRoomCode, createRoomRecord());
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
    clientInstanceId: client.clientInstanceId || null,
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

  if (type === "NEW_ROUND") {
    return actor.isHost ? { ok: true } : { ok: false, message: "Nur der Host darf eine neue Runde starten." };
  }

  if (["TRACK_REVEALED", "NEXT_PLAYER"].includes(type)) {
    return actor.isHost || actor.isActivePlayer
      ? { ok: true }
      : { ok: false, message: "Nur Host/DJ oder der aktive Spieler darf aufdecken oder zum naechsten Spieler gehen." };
  }

  if (["TRACK_SKIPPED", "TOGGLE_DEBUG_SONG", "BLOCK_TRACK", "UNBLOCK_TRACK", "REPORT_TRACK", "CLEAR_SONG_REPORTS", "CLEAR_BLOCKED_TRACKS"].includes(type)) {
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

function getMainArtistName(artist = "") {
  return String(artist)
    .split(" feat.")[0]
    .split(" ft.")[0]
    .split(" featuring ")[0]
    .split("&")[0]
    .trim();
}

function scoreSpotifyCandidate(track, item) {
  const wantedTitle = normalizeTrackText(track.title);
  const wantedArtist = normalizeTrackText(getMainArtistName(track.artist));
  const itemTitle = normalizeTrackText(item?.name);
  const itemArtists = Array.isArray(item?.artists) ? item.artists.map((artist) => normalizeTrackText(artist.name)).join(" ") : "";

  let score = 0;

  if (itemTitle === wantedTitle) score += 8;
  if (itemTitle.includes(wantedTitle) || wantedTitle.includes(itemTitle)) score += 3;
  if (itemArtists.includes(wantedArtist)) score += 5;
  if (item?.popularity) score += Math.min(3, Math.floor(item.popularity / 25));

  return score;
}

async function searchSpotifyUriForRoom(room, track) {
  if (track.spotifyUri) return track.spotifyUri;

  const accessToken = await getRoomSpotifyAccessToken(room);
  const mainArtist = getMainArtistName(track.artist);
  const searchQueries = [
    `track:${track.title} artist:${mainArtist}`,
    `"${track.title}" "${mainArtist}"`,
    `${track.title} ${mainArtist}`,
  ];

  let bestItem = null;
  let bestScore = -1;
  let lastError = "";

  for (const query of searchQueries) {
    const params = new URLSearchParams({
      q: query,
      type: "track",
      limit: "5",
    });

    const response = await fetch(`https://api.spotify.com/v1/search?${params.toString()}`, {
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    });

    if (!response.ok) {
      lastError = await readSpotifyError(response);
      continue;
    }

    const data = await response.json();
    const items = Array.isArray(data?.tracks?.items) ? data.tracks.items : [];

    for (const item of items) {
      if (!item?.uri) continue;

      const score = scoreSpotifyCandidate(track, item);

      if (score > bestScore) {
        bestScore = score;
        bestItem = item;
      }
    }

    if (bestItem && bestScore >= 8) break;
  }

  if (!bestItem?.uri) {
    throw new Error(lastError ? `Keinen passenden Spotify-Track gefunden: ${lastError}` : "Keinen passenden Spotify-Track gefunden.");
  }

  return bestItem.uri;
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
    hasDevice: Boolean(room.spotify?.deviceId),
    deviceId: room.spotify?.deviceId || "",
    deviceName: room.spotify?.deviceName || "",
    restoredRoom: Boolean(room.gameState),
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
    room.updatedAt = Date.now();
    savePersistedRooms();

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
    const playLimitSeconds = Math.max(1, Math.min(120, Math.round(Number(body.playLimitSeconds || state?.playLimitSeconds || DEFAULT_PLAY_LIMIT_SECONDS))));

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

loadPersistedRooms();

io.on("connection", (socket) => {
  let currentRoomCode = null;

  socket.on("room:join", ({ roomCode, playerName, clientInstanceId } = {}) => {
    const result = getRoom(roomCode);
    currentRoomCode = result.roomCode;

    socket.join(currentRoomCode);

    const normalizedClientInstanceId = String(clientInstanceId || "").trim();
    const existingClaim = normalizedClientInstanceId
      ? Array.from(result.room.playerClaims.entries()).find(([, value]) => value.clientInstanceId === normalizedClientInstanceId)
      : null;
    const claimedPlayerId = existingClaim?.[0] || null;
    const claimedPlayer = result.room.gameState?.players?.find((player) => player.id === claimedPlayerId) || null;

    result.room.clients.set(socket.id, {
      socketId: socket.id,
      clientInstanceId: normalizedClientInstanceId || null,
      playerName: claimedPlayer?.name || playerName || "Spieler",
      playerId: claimedPlayer?.id || null,
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

  socket.on("room:claimPlayer", ({ roomCode, playerId, playerName, clientInstanceId } = {}) => {
    const result = getRoom(roomCode || currentRoomCode);
    currentRoomCode = result.roomCode;
    socket.join(currentRoomCode);

    const normalizedClientInstanceId = String(clientInstanceId || "").trim();
    const client = result.room.clients.get(socket.id) || {
      socketId: socket.id,
      joinedAt: Date.now(),
    };

    client.clientInstanceId = normalizedClientInstanceId || client.clientInstanceId || null;

    const claimedPlayer = result.room.gameState?.players?.find((player) => player.id === playerId);

    if (!claimedPlayer) {
      socket.emit("room:claimResult", { ok: false, playerId, message: "Dieser Spieler existiert im aktuellen Raum nicht." });
      socket.emit("room:error", { message: "Dieser Spieler existiert im aktuellen Raum nicht." });
      return;
    }

    const persistentClaim = result.room.playerClaims.get(playerId);
    const claimedByDifferentClient =
      persistentClaim?.clientInstanceId &&
      normalizedClientInstanceId &&
      persistentClaim.clientInstanceId !== normalizedClientInstanceId &&
      Array.from(result.room.clients.values()).some(
        (item) => item.socketId !== socket.id && item.playerId === playerId && item.clientInstanceId === persistentClaim.clientInstanceId
      );

    if (claimedByDifferentClient) {
      const message = `${claimedPlayer.name} ist bereits mit einem anderen Client verbunden.`;
      socket.emit("room:claimResult", { ok: false, playerId, playerName: claimedPlayer.name, message });
      socket.emit("room:error", { message });
      broadcastPresence(currentRoomCode, result.room);
      return;
    }

    const alreadyClaimed = Array.from(result.room.clients.values()).find(
      (item) =>
        item.socketId !== socket.id &&
        item.playerId === playerId &&
        item.clientInstanceId &&
        normalizedClientInstanceId &&
        item.clientInstanceId !== normalizedClientInstanceId
    );

    if (alreadyClaimed) {
      const message = `${claimedPlayer.name} ist bereits mit einem anderen Client verbunden.`;
      socket.emit("room:claimResult", { ok: false, playerId, playerName: claimedPlayer.name, message });
      socket.emit("room:error", { message });
      broadcastPresence(currentRoomCode, result.room);
      return;
    }

    client.playerId = playerId;
    client.playerName = claimedPlayer.name || playerName || client.playerName || "Spieler";

    result.room.playerClaims.set(playerId, {
      clientInstanceId: normalizedClientInstanceId || client.clientInstanceId || socket.id,
      playerName: client.playerName,
      claimedAt: Date.now(),
    });

    result.room.clients.set(socket.id, client);
    result.room.updatedAt = Date.now();
    savePersistedRooms();

    socket.emit("room:claimResult", {
      ok: true,
      playerId,
      playerName: client.playerName,
    });

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

    if (action.type === "RESET_GAME") {
      result.room.playerClaims = new Map();
    }

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

      result.room.playerClaims = new Map();

      if (hostPlayerId) {
        result.room.playerClaims.set(hostPlayerId, {
          clientInstanceId: updatedClient.clientInstanceId || socket.id,
          playerName: hostName,
          claimedAt: Date.now(),
        });
      }

      result.room.clients.set(socket.id, updatedClient);
    }

    savePersistedRooms();

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
