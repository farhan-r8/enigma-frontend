'use client';

import { useEffect, useMemo, useState } from 'react';
import EnigmaFrame from '../../../components/enigma-protocol/EnigmaFrame';
import { fetchLeaderboard } from '../../../lib/enigma-player-storage';

export default function EnigmaProtocolLeaderboardPage() {
  const [rows, setRows] = useState([]);

  useEffect(() => {
    fetchLeaderboard('global', 20)
      .then((nextRows) => {
        setRows(nextRows);
      })
      .catch(() => {
        setRows([]);
      });
  }, []);

  const top = rows[0] || { codename: '-', score: 0, wpm: 0 };

  const rankedRows = useMemo(
    () => rows.map((row, index) => ({ ...row, rank: row.rank || index + 1 })),
    [rows],
  );
  const peakWpm = rankedRows.reduce((best, row) => Math.max(best, Number(row.wpm) || 0), 0);

  return (
    <EnigmaFrame activeKey="leaderboard">
      <section className="leaderboard-page">
        <div className="leaderboard-hero">
          <div>
            <span className="landing-version-pill">Leaderboard</span>
            <h1>Ranking Agen</h1>
            <p>Skor terbaik dari match yang sudah selesai.</p>
          </div>
        </div>

        <div className="leaderboard-stats">
          <article>
            <span>Top Score</span>
            <strong>{top.score}</strong>
            <small>{top.codename}</small>
          </article>
          <article>
            <span>Peak WPM</span>
            <strong>{peakWpm}</strong>
            <small>Kecepatan tertinggi</small>
          </article>
          <article>
            <span>Total Agent</span>
            <strong>{rankedRows.length}</strong>
            <small>Masuk ranking</small>
          </article>
        </div>

        <section className="leaderboard-board">
          <div className="leaderboard-board-head">
            <div>
              <h2>Global Leaderboard</h2>
            </div>
          </div>

          {rankedRows.length === 0 ? (
            <div className="leaderboard-empty-state">
              <h3>Belum ada match tersimpan</h3>
              <p>Selesaikan satu match agar skor muncul di leaderboard.</p>
            </div>
          ) : rankedRows.map((entry) => (
            <article key={`${entry.rank}-${entry.codename}-${entry.timestamp}`} className="leaderboard-card">
              <span className="leaderboard-rank">{entry.rank}</span>
              <div className="leaderboard-agent">
                <strong>{entry.codename}</strong>
                <span>{entry.operation || 'Operation belum tercatat'}</span>
              </div>
              <div className="leaderboard-metric">
                <span>Score</span>
                <strong>{entry.score}</strong>
              </div>
              <div className="leaderboard-metric">
                <span>WPM</span>
                <strong>{entry.wpm}</strong>
              </div>
            </article>
          ))}
        </section>
      </section>
    </EnigmaFrame>
  );
}
