'use client';

import { useEffect, useMemo, useState } from 'react';
import EnigmaFrame from '../../../components/enigma-protocol/EnigmaFrame';
import { fetchMyProfile, loadAgentIdentity, loadMatchHistory } from '../../../lib/enigma-player-storage';

function formatRecordDate(timestamp) {
  return new Intl.DateTimeFormat('id-ID', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(timestamp));
}

export default function EnigmaProtocolProfilePage() {
  const [agentName, setAgentName] = useState('Agent Farhan');
  const [history, setHistory] = useState([]);

  useEffect(() => {
    const identity = loadAgentIdentity();
    const records = loadMatchHistory();

    if (identity?.codename) setAgentName(identity.codename);
    setHistory(records);

    fetchMyProfile().then((profile) => {
      if (!profile) return;
      setAgentName(profile.codename || identity?.codename || 'Agent Farhan');
      const normalized = (profile.recentOperations || []).map((item) => ({
        operation: item.operation,
        status: item.success ? 'Success' : 'Failed',
        score: item.score,
        wpm: item.wpm,
        date: item.timestamp,
      }));
      if (normalized.length > 0) setHistory(normalized);
    });
  }, []);

  const profileStats = useMemo(() => {
    if (history.length === 0) {
      return {
        totalScore: 0,
        bestWpm: 0,
        missionWin: 0,
        totalMatches: 0,
        winRate: 0,
      };
    }

    const missionWin = history.filter((item) => item.status === 'Success').length;

    return {
      totalScore: history.reduce((sum, item) => sum + (item.score || 0), 0),
      bestWpm: history.reduce((best, item) => Math.max(best, item.wpm || 0), 0),
      missionWin,
      totalMatches: history.length,
      winRate: Math.round((missionWin / history.length) * 100),
    };
  }, [history]);

  return (
    <EnigmaFrame activeKey="profile">
      <section className="profile-page">
        <div className="profile-hero">
          <div className="profile-identity">
            <div className="profile-avatar" aria-hidden="true">
              <span>{agentName.replace(/^Agent\s+/i, '').slice(0, 2).toUpperCase() || 'AG'}</span>
            </div>
            <div>
              <span className="landing-version-pill">Profile</span>
              <h1>{agentName}</h1>
              <p>Ringkasan performa dari match yang sudah selesai.</p>
            </div>
          </div>

          <div className="profile-quick-panel">
            <div>
              <span>Total Match</span>
              <strong>{profileStats.totalMatches}</strong>
            </div>
            <div>
              <span>Win Rate</span>
              <strong>{profileStats.winRate}%</strong>
            </div>
          </div>
        </div>

        <div className="profile-stats">
          <article>
            <span>Total Score</span>
            <strong>{profileStats.totalScore.toLocaleString('id-ID')}</strong>
            <small>Akumulasi hasil match</small>
          </article>
          <article>
            <span>Mission Win</span>
            <strong>{profileStats.missionWin}</strong>
            <small>Operasi berhasil</small>
          </article>
          <article>
            <span>Peak WPM</span>
            <strong>{profileStats.bestWpm}</strong>
            <small>Kecepatan tertinggi</small>
          </article>
        </div>

        <section className="profile-history-board">
          <div className="profile-board-head">
            <h2>Riwayat Operasi</h2>
          </div>
          {history.length === 0 ? (
            <div className="profile-empty-state">
              <h3>Belum ada riwayat operasi</h3>
              <p>Selesaikan satu match agar riwayat muncul di profile.</p>
            </div>
          ) : (
            <div className="profile-history-list">
              {history.map((operation, index) => (
                <article key={`${operation.operation}-${operation.date}-${index}`} className="profile-history-entry">
                  <div className="profile-history-main">
                    <strong>{operation.operation}</strong>
                    <p>{formatRecordDate(operation.date)}</p>
                  </div>
                  <div className="profile-history-status">
                    <span className={operation.status === 'Success' ? 'success' : 'failed'}>
                      {operation.status}
                    </span>
                  </div>
                  <div className="profile-history-metric">
                    <span>Score</span>
                    <strong>{operation.score}</strong>
                  </div>
                  <div className="profile-history-metric">
                    <span>WPM</span>
                    <strong>{operation.wpm}</strong>
                  </div>
                </article>
              ))}
            </div>
          )}
        </section>
      </section>
    </EnigmaFrame>
  );
}
