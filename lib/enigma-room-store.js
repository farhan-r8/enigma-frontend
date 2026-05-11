import { createRoomStateSnapshot } from './enigma-room-contract';

const SESSION_KEY = 'enigma_client_session_v2';
const ROOMS_UPDATED_EVENT = 'enigma-rooms-updated';
const ROOM_REALTIME_EVENT = 'enigma-room-realtime';
const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL || '';
const WS_BASE_URL = process.env.NEXT_PUBLIC_WS_URL || '';
const API_TIMEOUT_MS = Number(process.env.NEXT_PUBLIC_API_TIMEOUT_MS || 8000);

export const ENIGMA_OPERATION_CHOICES = [
  { id: 'west-logistics', label: 'Sector: West Logistics', operationId: 'operation-sandi' },
  { id: 'core-server', label: 'Sector: Core Server', operationId: 'operation-virus' },
  { id: 'border-route', label: 'Sector: Border Route', operationId: 'operation-agent' },
  { id: 'random-selection', label: 'Protocol: Random Selection', operationId: null },
];

export const ENIGMA_OPPONENT_CHOICES = [
  { id: 'training-ai', label: 'Opponent: Training AI' },
  { id: 'local-network', label: 'Opponent: Local Network' },
];

const roomCache = new Map();
let publicRoomsCache = [];
const listeners = new Set();
const roomSockets = new Map();
const roomSocketReconnect = new Map();
let lobbySocket = null;
let lobbySocketConnecting = false;

function emitRoomsUpdated() {
  listeners.forEach((cb) => cb());
  if (typeof window !== 'undefined') window.dispatchEvent(new CustomEvent(ROOMS_UPDATED_EVENT));
}

function emitRealtime(detail) {
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent(ROOM_REALTIME_EVENT, { detail }));
  }
}

function sanitizeName(name, fallback) {
  const trimmed = name?.trim();
  return trimmed || fallback;
}

function randomItem(items) {
  return items[Math.floor(Math.random() * items.length)];
}

export function resolveOperationChoice(choiceId) {
  const choice = ENIGMA_OPERATION_CHOICES.find((item) => item.id === choiceId) || ENIGMA_OPERATION_CHOICES[3];
  if (choice.operationId) return choice;
  return randomItem(ENIGMA_OPERATION_CHOICES.slice(0, 3));
}

function toApi(path) {
  if (API_BASE_URL) {
    return `${API_BASE_URL}${path}`;
  }
  if (typeof window === 'undefined') {
    return path;
  }
  return `${window.location.protocol}//${window.location.hostname}:4000${path}`;
}

async function api(path, options = {}) {
  const sessionToken = getClientSessionId();
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), API_TIMEOUT_MS);
  try {
    const response = await fetch(toApi(path), {
      ...options,
      signal: controller.signal,
      headers: {
        'Content-Type': 'application/json',
        'x-session-token': sessionToken,
        ...(options.headers || {}),
      },
    });

    const payload = await response.json().catch(() => ({}));
    if (!response.ok) {
      const error = new Error(payload.error || 'Backend request failed');
      error.status = response.status;
      throw error;
    }
    return payload;
  } catch (error) {
    if (error?.name === 'AbortError') {
      throw new Error('Request timeout. Coba lagi.');
    }
    throw error;
  } finally {
    clearTimeout(timeout);
  }
}

function upsertRoom(room) {
  if (!room?.roomId) return;
  roomCache.set(room.roomId, room);
}

function removeRoom(roomId) {
  roomCache.delete(roomId);
  publicRoomsCache = publicRoomsCache.filter((r) => r.roomId !== roomId);
}

export function getClientSessionId() {
  if (typeof window === 'undefined' || typeof window.sessionStorage === 'undefined') return 'server-session';
  const existing = window.sessionStorage.getItem(SESSION_KEY);
  if (existing) return existing;
  const nextId = `sess_${Math.random().toString(36).slice(2, 12)}`;
  window.sessionStorage.setItem(SESSION_KEY, nextId);
  return nextId;
}

export function subscribeRoomStore(callback) {
  ensureLobbySocket();
  listeners.add(callback);
  return () => listeners.delete(callback);
}

export function subscribeRoomRealtime(callback) {
  if (typeof window === 'undefined') return () => {};
  const handler = (event) => callback(event.detail);
  window.addEventListener(ROOM_REALTIME_EVENT, handler);
  return () => window.removeEventListener(ROOM_REALTIME_EVENT, handler);
}

export function isRoomPubliclyVisible(room) {
  return Boolean(room) && room.access === 'public' && room.status === 'waiting';
}

export async function loadRooms() {
  try {
    const payload = await api('/api/rooms/public');
    publicRoomsCache = payload.rooms || [];
    publicRoomsCache.forEach(upsertRoom);
    emitRoomsUpdated();
  } catch {}
  return publicRoomsCache.map((room) => ({
    ...room,
    id: room.roomId,
    hostName: room.hostName,
  }));
}

export async function getRoomById(roomId) {
  const normalized = roomId.trim().toUpperCase();
  const cached = roomCache.get(normalized);

  try {
    const payload = await api(`/api/rooms/${normalized}`);
    upsertRoom(payload.room);
    return payload.room ? { ...payload.room, id: payload.room.roomId } : null;
  } catch (error) {
    if (error?.status === 404) {
      removeRoom(normalized);
      return null;
    }
    return cached ? { ...cached, id: cached.roomId } : null;
  }
}

export function getRoomStateSnapshot(roomId) {
  const room = roomCache.get(roomId.trim().toUpperCase());
  if (!room) return null;
  return createRoomStateSnapshot({
    id: room.roomId,
    access: room.access,
    hostName: room.hostName,
    operationId: room.operationId,
    operationLabel: room.operationLabel,
    opponentMode: room.opponentMode,
    startedAt: room.startedAt,
    createdAt: room.createdAt,
    lastActivityAt: room.lastActivityAt,
    resetVersion: room.resetVersion,
    players: room.players,
  });
}

export async function createRoom({ hostName, access, operationChoiceId, clientId, opponentMode }) {
  const op = resolveOperationChoice(operationChoiceId);
  const payload = await api('/api/rooms', {
    method: 'POST',
    body: JSON.stringify({
      hostName: sanitizeName(hostName, 'Agent Host'),
      access,
      operationId: op.operationId,
      operationLabel: op.label,
      clientId,
      opponentMode,
    }),
  });

  upsertRoom(payload.room);
  await ensureRoomSocket(payload.room.roomId, clientId);
  emitRoomsUpdated();
  return { ...payload.room, id: payload.room.roomId };
}

export async function joinRoom(roomId, playerName, clientId) {
  try {
    const payload = await api(`/api/rooms/${roomId.trim().toUpperCase()}/join`, {
      method: 'POST',
      body: JSON.stringify({ playerName, clientId }),
    });
    upsertRoom(payload.room);
    await ensureRoomSocket(payload.room.roomId, clientId);
    emitRoomsUpdated();
    return { room: { ...payload.room, id: payload.room.roomId }, error: null };
  } catch (error) {
    return { room: null, error: error.message };
  }
}

export async function leaveRoom(roomId, clientId) {
  try {
    await api(`/api/rooms/${roomId.trim().toUpperCase()}/leave`, {
      method: 'POST',
      body: JSON.stringify({ clientId }),
    });
    closeRoomSocket(roomId);
    removeRoom(roomId.trim().toUpperCase());
    emitRoomsUpdated();
    return { success: true, error: null };
  } catch (error) {
    return { success: false, error: error.message };
  }
}

export async function resetRoom(roomId, clientId) {
  try {
    const payload = await api(`/api/rooms/${roomId.trim().toUpperCase()}/reset`, {
      method: 'POST',
      body: JSON.stringify({ clientId }),
    });
    upsertRoom(payload.room);
    emitRoomsUpdated();
    return { success: true, error: null };
  } catch (error) {
    return { success: false, error: error.message };
  }
}

export async function markRoomStarted(roomId, clientId) {
  try {
    const payload = await api(`/api/rooms/${roomId.trim().toUpperCase()}/start`, {
      method: 'POST',
      body: JSON.stringify({ clientId }),
    });
    upsertRoom(payload.room);
    emitRoomsUpdated();
    return { success: true, room: { ...payload.room, id: payload.room.roomId }, error: null };
  } catch (error) {
    return { success: false, room: null, error: error.message || 'Gagal memulai room.' };
  }
}

export async function removeHostedRooms(clientId) {
  // Host cleanup now handled by WebSocket disconnect + leave endpoint.
  return { success: Boolean(clientId) };
}

function wsUrl(roomId, sessionToken) {
  if (WS_BASE_URL) return `${WS_BASE_URL}?roomId=${roomId}&sessionToken=${sessionToken}`;
  if (typeof window === 'undefined') return '';
  const protocol = window.location.protocol === 'https:' ? 'wss' : 'ws';
  return `${protocol}://${window.location.hostname}:4000/ws?roomId=${roomId}&sessionToken=${sessionToken}`;
}

function lobbyWsUrl(sessionToken) {
  if (WS_BASE_URL) return `${WS_BASE_URL}?sessionToken=${sessionToken}`;
  if (typeof window === 'undefined') return '';
  const protocol = window.location.protocol === 'https:' ? 'wss' : 'ws';
  return `${protocol}://${window.location.hostname}:4000/ws?sessionToken=${sessionToken}`;
}

function ensureLobbySocket() {
  if (typeof window === 'undefined' || lobbySocket || lobbySocketConnecting) return;
  lobbySocketConnecting = true;
  const sessionToken = getClientSessionId();
  const socket = new WebSocket(lobbyWsUrl(sessionToken));
  lobbySocket = socket;

  socket.onmessage = (event) => {
    try {
      const message = JSON.parse(event.data);
      if (message.event === 'rooms_updated') {
        loadRooms();
      }
    } catch {}
  };

  socket.onclose = () => {
    lobbySocket = null;
    lobbySocketConnecting = false;
    window.setTimeout(() => ensureLobbySocket(), 1200);
  };

  socket.onopen = () => {
    lobbySocketConnecting = false;
  };
}

export async function ensureRoomSocket(roomId, sessionToken = getClientSessionId()) {
  const normalized = roomId.trim().toUpperCase();
  if (roomSockets.has(normalized) || typeof window === 'undefined') return;

  const socket = new WebSocket(wsUrl(normalized, sessionToken));
  roomSockets.set(normalized, socket);
  roomSocketReconnect.set(normalized, true);

  socket.onmessage = (event) => {
    try {
      const message = JSON.parse(event.data);
      if (message.room) upsertRoom(message.room);
      if (message.event) emitRealtime({ roomId: normalized, ...message });
      if (message.event === 'host_left' || message.event === 'host_disconnected' || message.event === 'room_idle_deleted') {
        removeRoom(message.roomId || normalized);
      }
      emitRoomsUpdated();
    } catch {}
  };

  socket.onclose = () => {
    roomSockets.delete(normalized);
    const shouldReconnect = roomSocketReconnect.get(normalized) !== false;
    roomSocketReconnect.delete(normalized);
    emitRealtime({ roomId: normalized, event: 'socket_closed' });
    if (!shouldReconnect) return;
    window.setTimeout(() => {
      ensureRoomSocket(normalized, sessionToken);
      getRoomById(normalized).then((room) => {
        if (room) {
          upsertRoom(room);
          emitRoomsUpdated();
        }
      });
    }, 1500);
  };

  socket.onopen = () => {
    emitRealtime({ roomId: normalized, event: 'socket_open' });
  };
}

export function closeRoomSocket(roomId) {
  const normalized = roomId.trim().toUpperCase();
  const socket = roomSockets.get(normalized);
  if (socket) {
    roomSocketReconnect.set(normalized, false);
    socket.close();
    roomSockets.delete(normalized);
  }
}

export function sendRoomRealtimeEvent(roomId, event, payload = {}) {
  const socket = roomSockets.get(roomId.trim().toUpperCase());
  if (!socket || socket.readyState !== WebSocket.OPEN) return;
  const data = { event, by: getClientSessionId(), ...payload };
  socket.send(JSON.stringify(data));
}
