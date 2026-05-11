'use client';

import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import EnigmaFrame from './EnigmaFrame';
import {
  ENIGMA_OPERATION_CHOICES,
  ENIGMA_OPPONENT_CHOICES,
  createRoom,
  getClientSessionId,
  isRoomPubliclyVisible,
  joinRoom,
  loadRooms,
  subscribeRoomStore,
} from '../../lib/enigma-room-store';

const ROOM_CAPACITY = 5;
const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL || '';

function resolveApiBaseUrl() {
  if (API_BASE_URL) return API_BASE_URL;
  if (typeof window === 'undefined') return '';
  return `${window.location.protocol}//${window.location.hostname}:4000`;
}

export default function EnigmaLobbyView() {
  const router = useRouter();
  const [playerName, setPlayerName] = useState('Agent Raka');
  const [roomAccess, setRoomAccess] = useState('public');
  const [opponentMode, setOpponentMode] = useState('training-ai');
  const [operationChoice, setOperationChoice] = useState(ENIGMA_OPERATION_CHOICES[3].id);
  const [roomCode, setRoomCode] = useState('');
  const [rooms, setRooms] = useState([]);
  const [helperMessage, setHelperMessage] = useState(
    'Pilih mode room lalu mulai.',
  );
  const [enteringFromLanding, setEnteringFromLanding] = useState(false);
  const [onlinePlayers, setOnlinePlayers] = useState(null);
  const [roomPanelOpen, setRoomPanelOpen] = useState(false);
  const [setupTab, setSetupTab] = useState('create');

  useEffect(() => {
    try {
      const rawIdentity = window.localStorage.getItem('enigma_agent_identity_v1');
      if (rawIdentity) {
        const parsedIdentity = JSON.parse(rawIdentity);
        if (parsedIdentity?.codename) {
          setPlayerName(parsedIdentity.codename);
        }
      }

      const transitionFlag = window.sessionStorage.getItem('enigma_entry_transition');
      if (transitionFlag === 'landing-to-lobby') {
        setEnteringFromLanding(true);
        window.sessionStorage.removeItem('enigma_entry_transition');
        window.setTimeout(() => setEnteringFromLanding(false), 1200);
      }
    } catch {}

    const syncRooms = async () => {
      const nextRooms = await loadRooms();
      setRooms(nextRooms);
    };

    syncRooms();
    return subscribeRoomStore(() => {
      syncRooms();
    });
  }, []);

  useEffect(() => {
    let cancelled = false;

    async function syncOnlinePlayers() {
      try {
        const response = await fetch(`${resolveApiBaseUrl()}/api/players/online`, {
          cache: 'no-store',
          headers: {
            'x-session-token': getClientSessionId(),
          },
        });
        const payload = await response.json().catch(() => ({}));
        if (!cancelled && response.ok) {
          setOnlinePlayers(Number(payload.online) || 0);
        }
      } catch {
        if (!cancelled) setOnlinePlayers(null);
      }
    }

    syncOnlinePlayers();
    const interval = window.setInterval(syncOnlinePlayers, 5000);
    return () => {
      cancelled = true;
      window.clearInterval(interval);
    };
  }, []);

  const publicRooms = useMemo(
    () => rooms.filter((room) => isRoomPubliclyVisible(room)),
    [rooms],
  );

  function navigateToRoom(room, nextPlayerName, role) {
    const params = new URLSearchParams({
      roomId: room.id,
      player: nextPlayerName,
      role,
    });
    router.push(`/enigma-protocol/room?${params.toString()}`);
  }

  async function handleCreateRoom() {
    const clientId = getClientSessionId();
    let room = null;
    try {
      room = await createRoom({
        hostName: playerName,
        access: roomAccess,
        operationChoiceId: operationChoice,
        clientId,
        opponentMode,
      });
    } catch (error) {
      setHelperMessage(error?.message || 'Gagal membuat room. Pastikan backend aktif.');
      return;
    }

    setHelperMessage(
      room.access === 'public'
        ? `Room public ${room.id} dibuat untuk ${room.opponentMode === 'local-network' ? 'PvP 2 tab' : 'Training AI'}.`
        : `Room private ${room.id} dibuat. Bagikan Room ID ke lawan jika memakai Local Network.`,
    );
    navigateToRoom(room, playerName.trim() || 'Agent Host', 'host');
  }

  async function handleJoinByCode() {
    const nextName = playerName.trim() || 'Agent Guest';
    const { room, error } = await joinRoom(roomCode, nextName, getClientSessionId());

    if (error || !room) {
      setHelperMessage(error || 'Room tidak ditemukan.');
      return;
    }

    setHelperMessage(`Berhasil masuk ke ${room.id}.`);
    navigateToRoom(room, nextName, 'guest');
  }

  async function handleJoinPublic(roomId) {
    const nextName = playerName.trim() || 'Agent Guest';
    const { room, error } = await joinRoom(roomId, nextName, getClientSessionId());

    if (error || !room) {
      setHelperMessage(error || 'Room tidak dapat dimasuki.');
      return;
    }

    setHelperMessage(`Masuk ke room public ${room.id}.`);
    navigateToRoom(room, nextName, 'guest');
  }

  return (
    <EnigmaFrame activeKey="lobby">
      <section className={`lobby-page ${enteringFromLanding ? 'lobby-enter lobby-enter-active' : ''}`}>
        <div className="lobby-heading">
          <div>
            <span className="landing-version-pill">Lobby</span>
            <h1>Room Tersedia</h1>
            <p>Pilih room public yang aktif atau buat room baru untuk mulai bermain.</p>
          </div>
        </div>

        <section className="lobby-room-section">
          <div className="lobby-section-head">
            <div>
              <h2>Public room</h2>
              <p>{publicRooms.length} room aktif</p>
            </div>
            <div className="lobby-heading-actions">
              <button
                type="button"
                className="lobby-primary-button"
                onClick={() => {
                  setRoomPanelOpen(true);
                  setSetupTab('create');
                }}
                suppressHydrationWarning
              >
                Buat Room
              </button>
              <button
                type="button"
                className="lobby-ghost-button"
                onClick={() => {
                  setRoomPanelOpen(true);
                  setSetupTab('join');
                }}
                suppressHydrationWarning
              >
                Masukan Kode
              </button>
              <div className="lobby-online-card">
                <span>Player aktif</span>
                <strong>{onlinePlayers ?? '-'}</strong>
              </div>
              <button
                type="button"
                className="lobby-ghost-button"
                onClick={async () => setRooms(await loadRooms())}
                suppressHydrationWarning
              >
                Refresh
              </button>
            </div>
          </div>

          {publicRooms.length === 0 ? (
            <div className="lobby-empty-state">
              <h3>Belum ada room public</h3>
              <p>Buat room public agar pemain lain bisa langsung join dari lobby.</p>
            </div>
          ) : (
            <div className="lobby-room-list">
              {publicRooms.map((room) => (
                <article key={room.id} className="lobby-room-card">
                  <div>
                    <strong>{room.id}</strong>
                    <p>{`Host: ${room.hostName}`}</p>
                  </div>
                  <div>
                    <span>{room.opponentMode === 'local-network' ? 'Local Network' : 'Training AI'}</span>
                    <small>{`${room.players.length}/${ROOM_CAPACITY} pemain`}</small>
                  </div>
                  <button
                    type="button"
                    className="lobby-join-button"
                    onClick={() => handleJoinPublic(room.id)}
                    disabled={room.players.length >= ROOM_CAPACITY}
                    suppressHydrationWarning
                  >
                    {room.players.length >= ROOM_CAPACITY ? 'Full' : 'Join'}
                  </button>
                </article>
              ))}
            </div>
          )}
        </section>

        {roomPanelOpen ? (
          <div className="lobby-modal-backdrop" role="presentation" onMouseDown={() => setRoomPanelOpen(false)}>
          <section className="lobby-setup-panel" role="dialog" aria-modal="true" onMouseDown={(event) => event.stopPropagation()}>
            <button
              type="button"
              className="lobby-modal-close"
              onClick={() => setRoomPanelOpen(false)}
              aria-label="Tutup panel"
            >
              x
            </button>
            <div className="lobby-setup-tabs">
              <button
                type="button"
                className={setupTab === 'create' ? 'active' : ''}
                onClick={() => setSetupTab('create')}
              >
                Buat Room
              </button>
              <button
                type="button"
                className={setupTab === 'join' ? 'active' : ''}
                onClick={() => setSetupTab('join')}
              >
                Masuk Kode
              </button>
            </div>

            {setupTab === 'create' ? (
              <div className="lobby-form-grid">
                <div className="lobby-field-group">
                  <span>Akses room</span>
                  <div className="lobby-choice-grid two">
                    {['public', 'private'].map((access) => (
                      <button
                        key={access}
                        type="button"
                        className={roomAccess === access ? 'active' : ''}
                        onClick={() => setRoomAccess(access)}
                      >
                        <strong>{access === 'public' ? 'Public' : 'Private'}</strong>
                        <small>{access === 'public' ? 'Muncul di lobby' : 'Masuk lewat kode'}</small>
                      </button>
                    ))}
                  </div>
                </div>

                <div className="lobby-field-group">
                  <span>Mode lawan</span>
                  <div className="lobby-choice-grid two">
                    {ENIGMA_OPPONENT_CHOICES.map((option) => (
                      <button
                        key={option.id}
                        type="button"
                        className={opponentMode === option.id ? 'active' : ''}
                        onClick={() => setOpponentMode(option.id)}
                      >
                        <strong>{option.id === 'training-ai' ? 'Training AI' : 'Local Network'}</strong>
                        <small>{option.id === 'training-ai' ? 'Lawan bot lokal' : 'Lawan pemain lain'}</small>
                      </button>
                    ))}
                  </div>
                </div>

                <label className="lobby-field-group">
                  <span>Sektor misi</span>
                  <select
                    value={operationChoice}
                    onChange={(event) => setOperationChoice(event.target.value)}
                    aria-label="Sektor misi"
                    suppressHydrationWarning
                  >
                    {ENIGMA_OPERATION_CHOICES.map((option) => (
                      <option key={option.id} value={option.id}>
                        {option.label}
                      </option>
                    ))}
                  </select>
                </label>

                <button
                  type="button"
                  onClick={handleCreateRoom}
                  className="lobby-primary-button wide"
                  suppressHydrationWarning
                >
                  {roomAccess === 'public' ? 'Buat Public Room' : 'Buat Private Room'}
                </button>
              </div>
            ) : (
              <div className="lobby-code-panel">
                <label className="lobby-field-group">
                  <span>Kode room</span>
                  <input
                    type="text"
                    value={roomCode}
                    onChange={(event) => setRoomCode(event.target.value.toUpperCase())}
                    placeholder="PUB-104"
                    suppressHydrationWarning
                  />
                </label>
                <button
                  type="button"
                  onClick={handleJoinByCode}
                  className="lobby-primary-button wide"
                  disabled={!roomCode.trim()}
                  suppressHydrationWarning
                >
                  Gabung Room
                </button>
              </div>
            )}

            <div className="lobby-status-line">{helperMessage}</div>
          </section>
          </div>
        ) : null}
      </section>
    </EnigmaFrame>
  );
}
