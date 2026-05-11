export const ROOM_EVENT_TYPES = {
  PLAYER_JOINED: 'PLAYER_JOINED',
  START: 'START',
  PROGRESS: 'PROGRESS',
  MATCH_OVER: 'MATCH_OVER',
};

export const ROOM_STATUS = {
  WAITING: 'waiting',
  READY: 'ready',
  IN_PROGRESS: 'in_progress',
};

export function getRoomStatus(room) {
  if (!room) {
    return ROOM_STATUS.WAITING;
  }

  if (room.startedAt) {
    return ROOM_STATUS.IN_PROGRESS;
  }

  if ((room.players?.length || 0) >= 2) {
    return ROOM_STATUS.READY;
  }

  return ROOM_STATUS.WAITING;
}

export function createRoomStateSnapshot(room) {
  if (!room) {
    return null;
  }

  return {
    roomId: room.id,
    access: room.access,
    hostName: room.hostName,
    operationId: room.operationId,
    operationLabel: room.operationLabel,
    opponentMode: room.opponentMode,
    status: getRoomStatus(room),
    startedAt: room.startedAt || null,
    createdAt: room.createdAt || null,
    lastActivityAt: room.lastActivityAt || null,
    resetVersion: room.resetVersion || 0,
    players: (room.players || []).map((player) => ({
      id: player.id,
      name: player.name,
      role: player.role,
      clientId: player.clientId,
    })),
  };
}

export function createRoomEvent(type, payload = {}) {
  return {
    type,
    occurredAt: Date.now(),
    ...payload,
  };
}
