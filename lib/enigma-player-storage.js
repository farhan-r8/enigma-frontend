const IDENTITY_STORAGE_KEY = 'enigma_agent_identity_v1';
const MATCH_HISTORY_STORAGE_KEY = 'enigma_match_history_v1';
const SESSION_KEY = 'enigma_client_session_v2';
const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL || '';

function canUseStorage() {
  return typeof window !== 'undefined' && typeof window.localStorage !== 'undefined';
}

function getSessionToken() {
  if (typeof window === 'undefined' || typeof window.sessionStorage === 'undefined') return null;
  const existing = window.sessionStorage.getItem(SESSION_KEY);
  if (existing) return existing;
  const token = `sess_${Math.random().toString(36).slice(2, 12)}`;
  window.sessionStorage.setItem(SESSION_KEY, token);
  return token;
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
  const token = getSessionToken();
  const response = await fetch(toApi(path), {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      'x-session-token': token || '',
      ...(options.headers || {}),
    },
  });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(payload.error || 'Request gagal');
  return payload;
}

export function loadAgentIdentity() {
  if (!canUseStorage()) return null;
  try {
    const raw = window.localStorage.getItem(IDENTITY_STORAGE_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

export function saveAgentIdentity(identity) {
  if (!canUseStorage()) return;
  window.localStorage.setItem(IDENTITY_STORAGE_KEY, JSON.stringify(identity));
}

export function loadMatchHistory() {
  if (!canUseStorage()) return [];
  try {
    const raw = window.localStorage.getItem(MATCH_HISTORY_STORAGE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

export async function fetchMyProfile() {
  try {
    const result = await api('/api/profile/me');
    return result.profile || null;
  } catch {
    return null;
  }
}

export async function fetchLeaderboard(scope = 'global', limit = 20) {
  const result = await api(`/api/leaderboard?scope=${scope}&limit=${limit}`);
  return result.rows || [];
}

export async function saveMatchRecord(record) {
  const fallback = () => {
    if (!canUseStorage()) return [];
    const nextHistory = [record, ...loadMatchHistory()].slice(0, 20);
    window.localStorage.setItem(MATCH_HISTORY_STORAGE_KEY, JSON.stringify(nextHistory));
    return nextHistory;
  };

  try {
    const identity = loadAgentIdentity();
    await api('/api/matches', {
      method: 'POST',
      body: JSON.stringify({
        codename: identity?.codename || 'Agent',
        operation: record.operation,
        success: record.status === 'Success',
        score: record.score,
        wpm: record.wpm,
        timestamp: record.date,
      }),
    });
    return fallback();
  } catch {
    return fallback();
  }
}
