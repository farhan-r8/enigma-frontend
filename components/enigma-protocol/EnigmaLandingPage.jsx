'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';

const IDENTITY_STORAGE_KEY = 'enigma_agent_identity_v1';
const SESSION_KEY = 'enigma_client_session_v2';
const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL || '';

function resolveApiBaseUrl() {
  if (API_BASE_URL) {
    return API_BASE_URL;
  }
  if (typeof window === 'undefined') {
    return '';
  }
  return `${window.location.protocol}//${window.location.hostname}:4000`;
}

const PROFILE_MODES = [
  {
    id: 'radar',
    label: 'Radar Scan',
    accent: 'cyan',
  },
  {
    id: 'globe',
    label: 'Global Mesh',
    accent: 'purple',
  },
  {
    id: 'signal',
    label: 'Signal Wave',
    accent: 'amber',
  },
];

const LANDING_FEATURES = [
  { icon: 'bolt', label: 'Real-time' },
  { icon: 'users', label: 'Multiplayer' },
  { icon: 'trophy', label: 'Leaderboard' },
];

function loadIdentity() {
  if (typeof window === 'undefined') {
    return null;
  }

  try {
    const raw = window.localStorage.getItem(IDENTITY_STORAGE_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

function saveIdentity(identity) {
  if (typeof window === 'undefined') {
    return;
  }

  window.localStorage.setItem(IDENTITY_STORAGE_KEY, JSON.stringify(identity));
}

function toDisplayName(rawName) {
  return rawName?.replace(/^(agent|agen)\s+/i, '').trim() || '';
}

function getSessionToken() {
  if (typeof window === 'undefined' || typeof window.sessionStorage === 'undefined') return '';
  const existing = window.sessionStorage.getItem(SESSION_KEY);
  if (existing) return existing;
  const token = `sess_${Math.random().toString(36).slice(2, 12)}`;
  window.sessionStorage.setItem(SESSION_KEY, token);
  return token;
}

function FeatureIcon({ type }) {
  if (type === 'users') {
    return (
      <span className="landing-feature-icon users" aria-hidden="true">
        <span />
        <span />
        <span />
      </span>
    );
  }

  if (type === 'trophy') {
    return (
      <span className="landing-feature-icon trophy" aria-hidden="true">
        <span className="trophy-cup" />
        <span className="trophy-stem" />
        <span className="trophy-base" />
      </span>
    );
  }

  return (
    <span className="landing-feature-icon bolt" aria-hidden="true">
      <span />
    </span>
  );
}

export default function EnigmaLandingPage() {
  const router = useRouter();
  const [typedTitle, setTypedTitle] = useState('');
  const [codename, setCodename] = useState('');
  const [profileMode, setProfileMode] = useState(PROFILE_MODES[0].id);
  const [isReady, setIsReady] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [onlinePlayers, setOnlinePlayers] = useState(null);

  useEffect(() => {
    const existingIdentity = loadIdentity();

    if (existingIdentity?.codename) {
      setCodename(toDisplayName(existingIdentity.codename));
    }

    if (existingIdentity?.profileMode) {
      setProfileMode(existingIdentity.profileMode);
    }

    setIsReady(true);
  }, []);

  useEffect(() => {
    const title = 'Enigma Protocol';
    setTypedTitle('');

    let index = 0;
    const interval = window.setInterval(() => {
      index += 1;
      setTypedTitle(title.slice(0, index));
      if (index >= title.length) {
        window.clearInterval(interval);
      }
    }, 70);

    return () => window.clearInterval(interval);
  }, []);

  useEffect(() => {
    let cancelled = false;

    async function fetchOnlinePlayers() {
      try {
        const response = await fetch(`${resolveApiBaseUrl()}/api/players/online`, {
          cache: 'no-store',
          headers: {
            'x-session-token': getSessionToken(),
          },
        });
        const payload = await response.json().catch(() => ({}));
        if (!cancelled && response.ok) {
          setOnlinePlayers(Number(payload.online) || 0);
        }
      } catch {
        if (!cancelled) {
          setOnlinePlayers(null);
        }
      }
    }

    fetchOnlinePlayers();
    const interval = window.setInterval(fetchOnlinePlayers, 5000);
    return () => {
      cancelled = true;
      window.clearInterval(interval);
    };
  }, []);

  async function initializeConnection() {
    const rawName = codename.trim();
    if (!rawName) {
      setErrorMessage('Nama agent wajib diisi.');
      return;
    }
    if (/\b(agent|agen)\b/i.test(rawName)) {
      setErrorMessage('Isi nama saja tanpa kata Agent/Agen.');
      return;
    }

    const normalizedCodename = `Agent ${rawName}`;
    const sessionToken = getSessionToken();

    try {
      const response = await fetch(`${resolveApiBaseUrl()}/api/session/guest`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sessionToken, codename: normalizedCodename }),
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) {
        setErrorMessage(payload.error || 'Gagal login. Coba nama lain.');
        return;
      }
    } catch {
      setErrorMessage('Server tidak merespons. Coba lagi.');
      return;
    }

    setErrorMessage('');
    saveIdentity({
      codename: normalizedCodename,
      profileMode,
      savedAt: Date.now(),
    });
    if (typeof window !== 'undefined') {
      window.sessionStorage.setItem('enigma_entry_transition', 'landing-to-lobby');
    }
    router.push('/enigma-protocol/lobby');
  }

  const [titleFirst = '', ...titleRest] = typedTitle.split(' ');
  const titleSecond = titleRest.join(' ');

  return (
    <main className="landing-shell">
      <div className="landing-grid-overlay" />
      <section className="landing-stage">
        <div className="landing-copy-panel">
          <span className="landing-version-pill">Beta v2.0</span>
          <h1 className="landing-title">
            <span>{titleFirst}</span>
            <span className="landing-title-accent">
              {titleSecond}
              <span className="type-caret" aria-hidden="true" />
            </span>
          </h1>
          <p className="landing-subtitle">Adu kecepatan mengetik melawan player lain</p>

          <div className="landing-feature-grid">
            {LANDING_FEATURES.map((feature) => (
              <div key={feature.label} className="landing-feature-card">
                <FeatureIcon type={feature.icon} />
                <span>{feature.label}</span>
              </div>
            ))}
          </div>
        </div>

        <section className="landing-card">
          <label className="landing-form-field">
            <span>Agent Name</span>
            <input
              type="text"
              value={codename}
              onChange={(event) => {
                setCodename(event.target.value);
                if (errorMessage) setErrorMessage('');
              }}
              placeholder="Masukkan nama kamu"
              autoComplete="off"
              suppressHydrationWarning
            />
            {errorMessage ? <small>{errorMessage}</small> : null}
          </label>

          <button
            type="button"
            className="landing-button"
            onClick={initializeConnection}
            suppressHydrationWarning
          >
            <span className="landing-play-icon" aria-hidden="true" />
            Mulai Bermain
          </button>

          <div className="landing-card-footer">
            <span>Players online</span>
            <strong>{onlinePlayers ?? '-'}</strong>
          </div>
        </section>
      </section>
    </main>
  );
}
