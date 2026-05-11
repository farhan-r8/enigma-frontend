'use client';

import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { useEffect, useMemo, useRef, useState } from 'react';
import EnigmaFrame from './EnigmaFrame';
import {
  ensureRoomSocket,
  getClientSessionId,
  getRoomById,
  leaveRoom,
  markRoomStarted,
  sendRoomRealtimeEvent,
  subscribeRoomRealtime,
  subscribeRoomStore,
} from '../../lib/enigma-room-store';
import { saveMatchRecord } from '../../lib/enigma-player-storage';
import { useStageTypingEngine } from '../../lib/use-stage-typing-engine';
import { useAudio } from '../audio/AudioProvider';

const STAGE_DURATION_SECONDS = 70;
const BONUS_PHASE_DURATION_SECONDS = 50;
const MATCH_OVER_DELAY_MS = 3000;
const ROOM_COUNTDOWN_SECONDS = 20;
const ALL_TIME_RECORD = {
  label: 'All-Time Best Record',
  codename: 'Archive Prime',
  score: 4880,
  wpm: 92,
  result: 'Record',
};

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

function formatMatchDate(timestamp) {
  return new Intl.DateTimeFormat('id-ID', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(timestamp));
}

function buildPostMatchRows(localSummary, rivalSummary) {
  const ordered = [localSummary, rivalSummary].sort((left, right) => right.score - left.score);

  return [
    {
      rank: 1,
      codename: ordered[0].codename,
      result: ordered[0].result,
      score: ordered[0].score,
      wpm: ordered[0].wpm,
    },
    {
      rank: 2,
      codename: ordered[1].codename,
      result: ordered[1].result,
      score: ordered[1].score,
      wpm: ordered[1].wpm,
    },
    {
      rank: 3,
      codename: ALL_TIME_RECORD.codename,
      result: ALL_TIME_RECORD.result,
      score: ALL_TIME_RECORD.score,
      wpm: ALL_TIME_RECORD.wpm,
      label: ALL_TIME_RECORD.label,
    },
  ];
}

export default function EnigmaProtocolGame() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const inputRef = useRef(null);
  const matchTimeoutRef = useRef(null);
  const countdownIntervalRef = useRef(null);
  const botProgressRef = useRef(0);
  const recordSavedRef = useRef(false);
  const completedWordAudioRef = useRef(0);
  const revealLoopStartedRef = useRef(false);
  const timeoutWarningActiveRef = useRef(false);
  const stageClearStageRef = useRef('');
  const operationLaunchTokenRef = useRef(null);
  const { muted, play, stop } = useAudio();

  const [isHydrated, setIsHydrated] = useState(false);
  const [roomState, setRoomState] = useState(null);
  const [systemMessage, setSystemMessage] = useState('Connection stable.');
  const [passwordValue, setPasswordValue] = useState('');
  const [ipValue, setIpValue] = useState('');
  const [briefingAccepted, setBriefingAccepted] = useState(false);
  const [copyStatus, setCopyStatus] = useState('Copy ID');
  const [stageTimeLeft, setStageTimeLeft] = useState(STAGE_DURATION_SECONDS);
  const [bonusTimeLeft, setBonusTimeLeft] = useState(BONUS_PHASE_DURATION_SECONDS);
  const [lastObservedResetVersion, setLastObservedResetVersion] = useState(0);
  const [rivalProgress, setRivalProgress] = useState(0);
  const [rivalReady, setRivalReady] = useState(false);
  const [channelLive, setChannelLive] = useState(false);
  const [matchOverlay, setMatchOverlay] = useState(null);
  const [postMatchData, setPostMatchData] = useState(null);
  const [matchStartedAt, setMatchStartedAt] = useState(null);
  const [completedWordTotal, setCompletedWordTotal] = useState(0);
  const [typoCount, setTypoCount] = useState(0);
  const [matchLocked, setMatchLocked] = useState(false);
  const [revealedMasterFile, setRevealedMasterFile] = useState('');
  const [roomCountdownLeft, setRoomCountdownLeft] = useState(null);
  const [rivalName, setRivalName] = useState('Enemy Agent');
  const [leavePrompt, setLeavePrompt] = useState(null);

  const roomId = searchParams.get('roomId') || 'ROOM-LOCAL';
  const playerName = searchParams.get('player') || 'Agent Farhan';
  const playerRole = searchParams.get('role') || 'host';
  const clientSessionId = isHydrated ? getClientSessionId() : 'server-session';
  const isLockedInGameplay = briefingAccepted || Boolean(roomState?.startedAt) || roomCountdownLeft === 0;

  function clearCountdownInterval() {
    if (countdownIntervalRef.current) {
      window.clearInterval(countdownIntervalRef.current);
      countdownIntervalRef.current = null;
    }
  }

  function resolveSynchronizedStart(startedAt) {
    const normalizedStartedAt = Number(startedAt) || Date.now();
    const elapsedSeconds = Math.max(0, Math.floor((Date.now() - normalizedStartedAt) / 1000));
    return {
      startedAt: normalizedStartedAt,
      stageTimeLeft: Math.max(0, STAGE_DURATION_SECONDS - elapsedSeconds),
    };
  }

  const {
    activeOperation,
    stages,
    stageQueue,
    totalStageCount,
    completedStageCount,
    currentStageNumber,
    currentStage,
    currentWordIndex,
    currentInput,
    completedWords,
    collectedAnomalies,
    currentTargetWord,
    wordStatus,
    gameMode,
    stageTransitioning,
    passwordStatus,
    ipStatus,
    masterFileUnlocked,
    winState,
    anomalyPassword,
    allStagesCompleted,
    lastTransitionReason,
    passwordAttemptsLeft,
    hardResetTriggered,
    handleTypingChange,
    handleTypingKeyDown,
    validatePassword,
    validateIpv4,
    timeoutCurrentStage,
    resetEngine,
  } = useStageTypingEngine({
    initialStageIndex: 0,
    operationId: roomState?.operationId,
  });

  useEffect(() => {
    setIsHydrated(true);
  }, []);

  useEffect(() => {
    if (!isHydrated) {
      return undefined;
    }

    const syncRoom = async () => {
      const nextRoom = await getRoomById(roomId);
      setRoomState(nextRoom);
    };

    syncRoom();
    return subscribeRoomStore(() => {
      syncRoom();
    });
  }, [isHydrated, roomId]);

  const opponentMode = roomState?.opponentMode || 'training-ai';
  const isLocalNetwork = opponentMode === 'local-network';
  const hasRivalJoined = (roomState?.players?.length || 0) > 1;
  const isRealtimeCompetitive = hasRivalJoined;
  const hasStartRequirement = isLocalNetwork ? hasRivalJoined : true;

  const currentPlayerRoleLabel = useMemo(() => {
    const activePlayer = roomState?.players?.find((player) => player.clientId === clientSessionId);
    if (activePlayer?.role === 'host') {
      return 'Host';
    }
    if (activePlayer?.role === 'guest') {
      return 'Guest';
    }
    return playerRole === 'host' ? 'Host' : 'Guest';
  }, [clientSessionId, playerRole, roomState?.players]);

  const playerProgress = useMemo(() => {
    if (!totalStageCount) {
      return 0;
    }

    const stageWordCount = currentStage?.englishWords.length || 0;
    const activeWordLength = currentTargetWord?.length || 0;
    const activeWordProgress = activeWordLength ? Math.min(currentInput.length / activeWordLength, 1) : 0;
    const stageFraction = stageWordCount ? (currentWordIndex + activeWordProgress) / stageWordCount : 0;
    return clamp(((completedStageCount + stageFraction) / totalStageCount) * 100, 0, 100);
  }, [completedStageCount, currentInput.length, currentStage?.englishWords.length, currentTargetWord, currentWordIndex, totalStageCount]);

  useEffect(() => {
    botProgressRef.current = rivalProgress;
  }, [rivalProgress]);

  useEffect(() => {
    if (!isHydrated) {
      setChannelLive(false);
      return undefined;
    }

    ensureRoomSocket(roomId, clientSessionId);
    setChannelLive(true);

    return () => {
      setChannelLive(false);
    };
  }, [clientSessionId, isHydrated, roomId]);

  useEffect(() => {
    if (isLocalNetwork) {
      setRivalReady(hasRivalJoined);
    } else {
      setRivalReady(true);
    }
  }, [hasRivalJoined, isLocalNetwork]);

  useEffect(() => {
    const opponent = roomState?.players?.find((player) => player.clientId !== clientSessionId);
    if (opponent?.name) {
      setRivalName(opponent.name);
    }
  }, [clientSessionId, roomState?.players]);

  useEffect(() => {
    return subscribeRoomRealtime((message) => {
      if (!message || message.roomId !== roomId || message.by === clientSessionId) {
        return;
      }

      if (message.event === 'progress_update') {
        setRivalProgress(message.progress ?? 0);
        if (message.playerName) {
          setRivalName(message.playerName);
        }
      } else if (message.event === 'start_match') {
        startOperation('remote', message.startedAt);
      } else if (message.event === 'match_over' && message.payload) {
        handleRemoteMatchOver(message.payload);
      } else if (message.event === 'disconnect_leave') {
        setSystemMessage(`${message.playerName || 'Player'} keluar dari pertandingan.`);
      } else if (message.event === 'countdown_started') {
        setSystemMessage('Countdown mulai. Match akan dimulai otomatis.');
      } else if (message.event === 'countdown_cancelled') {
        setSystemMessage('Countdown dibatalkan. Menunggu pemain lain masuk.');
      } else if (message.event === 'match_forfeit') {
        setSystemMessage('Pemain keluar. Pertandingan gugur karena anggota kurang dari 50%.');
        setMatchLocked(true);
        window.setTimeout(() => router.push('/enigma-protocol/lobby'), 1600);
      } else if (message.event === 'host_left' || message.event === 'host_disconnected' || message.event === 'room_forfeit_closed') {
        setSystemMessage('Room ditutup oleh host atau dihentikan sistem.');
        window.setTimeout(() => router.push('/enigma-protocol/lobby'), 1200);
      } else if (message.event === 'socket_closed') {
        setSystemMessage('Koneksi realtime terputus. Mencoba menyambung ulang...');
      } else if (message.event === 'socket_open') {
        setSystemMessage('Koneksi realtime tersambung kembali.');
      }
    });
  }, [clientSessionId, roomId, router]);

  useEffect(() => {
    if (briefingAccepted || !roomState?.startedAt) {
      return;
    }

    startOperation('remote', roomState.startedAt);
  }, [briefingAccepted, roomState?.startedAt]);

  useEffect(() => {
    if (!isHydrated) {
      return undefined;
    }

    const onBeforeUnload = (event) => {
      if (!isLockedInGameplay) {
        return;
      }
      event.preventDefault();
      event.returnValue = 'Pertandingan sedang berjalan. Keluar sekarang akan menggagalkan match.';
    };

    const onPopState = () => {
      if (!isLockedInGameplay) {
        return;
      }
      window.history.pushState(null, '', window.location.href);
      setLeavePrompt({
        title: 'Keluar dari match?',
        body: 'Pertandingan sedang berjalan. Keluar sekarang akan menggagalkan match untuk tim.',
        confirmLabel: 'Ya, keluar',
        source: 'navigation',
      });
    };

    window.history.pushState(null, '', window.location.href);
    window.addEventListener('beforeunload', onBeforeUnload);
    window.addEventListener('popstate', onPopState);
    return () => {
      window.removeEventListener('beforeunload', onBeforeUnload);
      window.removeEventListener('popstate', onPopState);
    };
  }, [isHydrated, isLockedInGameplay]);

  useEffect(() => {
    if (roomState?.startedAt) {
      setRoomCountdownLeft(0);
      return undefined;
    }
    if (!roomState?.countdownStartedAt) {
      setRoomCountdownLeft(null);
      return undefined;
    }

    const update = () => {
      const elapsedSeconds = Math.floor((Date.now() - roomState.countdownStartedAt) / 1000);
      const left = Math.max(0, ROOM_COUNTDOWN_SECONDS - elapsedSeconds);
      setRoomCountdownLeft(left);
    };

    update();
    const timer = window.setInterval(update, 500);
    return () => window.clearInterval(timer);
  }, [roomState?.countdownStartedAt, roomState?.startedAt]);

  useEffect(() => {
    return () => {
      if (matchTimeoutRef.current) {
        window.clearTimeout(matchTimeoutRef.current);
      }
      clearCountdownInterval();
      stop('timeout', { fadeMs: 120 });
      stop('data_reveal');
      stop('bgm1', { fadeMs: 420 });
      play('bgm', { fadeInMs: 700 });
    };
  }, [play, stop]);

  useEffect(() => {
    if (briefingAccepted && !postMatchData) {
      stop('bgm', { fadeMs: 500 });
      play('bgm1', { fadeInMs: 650 });
      return;
    }

    stop('bgm1', { fadeMs: 420 });
    play('bgm', { fadeInMs: 700 });
  }, [briefingAccepted, postMatchData, play, stop]);

  useEffect(() => {
    const nextResetVersion = roomState?.resetVersion || 0;
    if (nextResetVersion === 0 || nextResetVersion === lastObservedResetVersion) {
      return;
    }

    handleLocalReset('Room direset oleh host. Semua progress kembali ke awal.');
    setLastObservedResetVersion(nextResetVersion);
  }, [lastObservedResetVersion, roomState?.resetVersion]);

  useEffect(() => {
    if (completedWords.length <= completedWordAudioRef.current) {
      return;
    }

    const gainedWords = completedWords.length - completedWordAudioRef.current;
    setCompletedWordTotal((current) => current + gainedWords);
    completedWordAudioRef.current = completedWords.length;
    play('word_done');
  }, [completedWords.length, play]);

  useEffect(() => {
    completedWordAudioRef.current = 0;
    clearCountdownInterval();
    timeoutWarningActiveRef.current = false;
    stop('timeout', { fadeMs: 120 });
    setStageTimeLeft(STAGE_DURATION_SECONDS);
  }, [completedStageCount, currentStage?.id]);

  useEffect(() => {
    if (gameMode !== 'end-challenge' || !briefingAccepted || matchLocked || postMatchData) {
      return undefined;
    }

    setBonusTimeLeft(BONUS_PHASE_DURATION_SECONDS);
    const timer = window.setInterval(() => {
      setBonusTimeLeft((prev) => {
        if (prev <= 1) {
          window.clearInterval(timer);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => window.clearInterval(timer);
  }, [briefingAccepted, gameMode, matchLocked, postMatchData]);

  useEffect(() => {
    if (gameMode !== 'end-challenge' || bonusTimeLeft !== 0 || postMatchData || matchLocked) {
      return;
    }

    finalizeMatch({
      localStatus: 'failed',
      winnerName: 'Timer System',
      winnerId: 'timer-system',
      rivalSummary: {
        codename: rivalName || 'Rival',
        result: 'Success',
        score: Math.max(2500, completedWordTotal * 100),
        wpm: Math.max(30, Math.round(completedWordTotal / 2)),
      },
    });
  }, [bonusTimeLeft, completedWordTotal, gameMode, matchLocked, postMatchData, rivalName]);

  useEffect(() => {
    if (
      !stageTransitioning ||
      lastTransitionReason !== 'completed' ||
      !currentStage?.id ||
      stageClearStageRef.current === currentStage.id
    ) {
      return;
    }

    stageClearStageRef.current = currentStage.id;
    clearCountdownInterval();
    setStageTimeLeft(STAGE_DURATION_SECONDS);
    play('stage_clear');
  }, [currentStage?.id, lastTransitionReason, play, stageTransitioning]);

  useEffect(() => {
    if (
      !briefingAccepted ||
      matchLocked ||
      gameMode !== 'typing' ||
      stageTransitioning ||
      !currentStage
    ) {
      if (timeoutWarningActiveRef.current) {
        timeoutWarningActiveRef.current = false;
        stop('timeout', { fadeMs: 120 });
      }
      return;
    }

    if (stageTimeLeft <= 7 && stageTimeLeft > 0) {
      if (!timeoutWarningActiveRef.current) {
        timeoutWarningActiveRef.current = true;
        play('timeout');
      }
      return;
    }

    if (timeoutWarningActiveRef.current) {
      timeoutWarningActiveRef.current = false;
      stop('timeout', { fadeMs: 120 });
    }
  }, [briefingAccepted, currentStage, gameMode, matchLocked, play, stageTimeLeft, stageTransitioning, stop]);

  useEffect(() => {
    if (
      !briefingAccepted ||
      matchLocked ||
      gameMode !== 'typing' ||
      stageTransitioning ||
      !currentStage ||
      allStagesCompleted
    ) {
      clearCountdownInterval();
      return undefined;
    }

    clearCountdownInterval();
    countdownIntervalRef.current = window.setInterval(() => {
      setStageTimeLeft((previousTimeLeft) => {
        if (previousTimeLeft <= 1) {
          clearCountdownInterval();
          return 0;
        }

        return previousTimeLeft - 1;
      });
    }, 1000);

    return () => {
      clearCountdownInterval();
    };
  }, [
    allStagesCompleted,
    briefingAccepted,
    currentStage?.id,
    gameMode,
    matchLocked,
    stageTransitioning,
  ]);

  useEffect(() => {
    if (
      !briefingAccepted ||
      matchLocked ||
      gameMode !== 'typing' ||
      stageTransitioning ||
      !currentStage ||
      stageTimeLeft !== 0
    ) {
      return;
    }

    clearCountdownInterval();
    timeoutWarningActiveRef.current = false;
    stop('timeout', { fadeMs: 120 });
    const rotated = timeoutCurrentStage();
    if (rotated) {
      setSystemMessage('Waktu habis. Stage dianggap selesai gagal dan lanjut ke stage berikutnya.');
    }
  }, [briefingAccepted, currentStage, gameMode, matchLocked, stageTimeLeft, stageTransitioning, stop, timeoutCurrentStage]);

  useEffect(() => {
    if (!briefingAccepted || matchLocked || postMatchData) {
      return undefined;
    }

    if (!isRealtimeCompetitive) {
      const interval = window.setInterval(() => {
        setRivalProgress((current) => {
          const next = clamp(
            current + (gameMode === 'typing' ? 1.2 + Math.random() * 2.8 : 0.8 + Math.random() * 1.8),
            0,
            100,
          );
          botProgressRef.current = next;
          return next;
        });
      }, gameMode === 'typing' ? 850 : 1100);

      return () => window.clearInterval(interval);
    }

    sendRoomRealtimeEvent(roomId, 'progress_update', {
      playerId: clientSessionId,
      playerName,
      progress: Math.round(playerProgress),
    });

    return undefined;
  }, [briefingAccepted, clientSessionId, gameMode, isRealtimeCompetitive, matchLocked, playerName, playerProgress, postMatchData, roomId]);

  useEffect(() => {
    if (postMatchData || matchLocked) {
      return;
    }

    if (!isRealtimeCompetitive && briefingAccepted && botProgressRef.current >= 100 && !winState) {
      finalizeMatch({
        localStatus: 'failed',
        winnerName: 'Training AI',
        winnerId: 'training-ai',
        rivalSummary: {
          codename: 'Training AI',
          result: 'Success',
          score: 4520,
          wpm: 79,
        },
      });
    }
  }, [briefingAccepted, isRealtimeCompetitive, matchLocked, postMatchData, winState]);

  useEffect(() => {
    if (gameMode !== 'typing' || stageTransitioning || !briefingAccepted || matchLocked) {
      return undefined;
    }

    const timeout = window.setTimeout(() => {
      inputRef.current?.focus();
    }, 80);

    return () => window.clearTimeout(timeout);
  }, [briefingAccepted, gameMode, matchLocked, stageTransitioning, currentStage?.id]);

  useEffect(() => {
    if (!postMatchData || recordSavedRef.current) {
      return;
    }

    const localSummary = postMatchData.localSummary;
    saveMatchRecord({
      operation: activeOperation.alias,
      status: localSummary.result,
      score: localSummary.score,
      wpm: localSummary.wpm,
      date: postMatchData.finishedAt,
    });
    recordSavedRef.current = true;
  }, [activeOperation.alias, postMatchData]);

  useEffect(() => {
    if (!masterFileUnlocked) {
      stop('data_reveal', { fadeMs: 320 });
      revealLoopStartedRef.current = false;
      setRevealedMasterFile('');
      return undefined;
    }

    if (!revealLoopStartedRef.current) {
      play('data_reveal');
      revealLoopStartedRef.current = true;
    }

    const target = activeOperation.masterFile;
    const glyphs = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789#$%*';
    let frame = 0;

    const interval = window.setInterval(() => {
      frame += 1;
      const revealCount = Math.min(target.length, Math.floor(frame * 3.6));

      const nextText = target
        .split('')
        .map((character, index) => {
          if (index < revealCount || character === ' ') {
            return character;
          }

          return glyphs[(index + frame) % glyphs.length];
        })
        .join('');

      setRevealedMasterFile(nextText);

      if (revealCount >= target.length) {
        window.clearInterval(interval);
        stop('data_reveal', { fadeMs: 420 });
        revealLoopStartedRef.current = false;
      }
    }, 30);

    return () => {
      window.clearInterval(interval);
      stop('data_reveal', { fadeMs: 320 });
      revealLoopStartedRef.current = false;
    };
  }, [activeOperation.masterFile, masterFileUnlocked, play, stop]);

  useEffect(() => {
    if (!isHydrated || postMatchData || roomState) {
      return;
    }

    setSystemMessage('Room sudah tidak tersedia. Kembali ke lobby untuk membuat atau join room baru.');
  }, [isHydrated, postMatchData, roomState]);

  useEffect(() => {
    if (!leavePrompt) {
      return undefined;
    }

    const onKeyDown = (event) => {
      if (event.key === 'Escape') {
        setLeavePrompt(null);
      }
    };

    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [leavePrompt]);

  useEffect(() => {
    if (!hardResetTriggered) {
      return;
    }

    play('hard_reset');
    operationLaunchTokenRef.current = null;
    setBriefingAccepted(false);
    setPasswordValue('');
    setIpValue('');
    completedWordAudioRef.current = 0;
    setStageTimeLeft(STAGE_DURATION_SECONDS);
    setRivalProgress(0);
    setMatchStartedAt(null);
    setCompletedWordTotal(0);
    setTypoCount(0);
    setMatchLocked(false);
    setMatchOverlay(null);
    setPostMatchData(null);
    setRevealedMasterFile('');
    recordSavedRef.current = false;
    setSystemMessage('Security lock triggered. Hard reset to Stage 1.');
  }, [hardResetTriggered, play]);

  async function copyRoomId() {
    try {
      await navigator.clipboard.writeText(roomId);
      setCopyStatus('Copy successful');
      window.setTimeout(() => setCopyStatus('Copy ID'), 1200);
    } catch (error) {
      setCopyStatus(`Copy failed: ${error?.message || 'Clipboard denied'}`);
      window.setTimeout(() => setCopyStatus('Copy ID'), 2200);
    }
  }

  function resetOperationalState() {
    resetEngine();
    setBriefingAccepted(false);
    setPasswordValue('');
    setIpValue('');
    completedWordAudioRef.current = 0;
    setStageTimeLeft(STAGE_DURATION_SECONDS);
    setBonusTimeLeft(BONUS_PHASE_DURATION_SECONDS);
    setRivalProgress(0);
    setMatchStartedAt(null);
    setCompletedWordTotal(0);
    setTypoCount(0);
    setMatchLocked(false);
    setMatchOverlay(null);
    setPostMatchData(null);
    setRevealedMasterFile('');
    operationLaunchTokenRef.current = null;
    stageClearStageRef.current = '';
    clearCountdownInterval();
    timeoutWarningActiveRef.current = false;
    stop('timeout', { fadeMs: 120 });
    recordSavedRef.current = false;
    stop('data_reveal');
  }

  function handleLocalReset(message = 'Sesi operasi kembali ke awal.') {
    resetOperationalState();
    setSystemMessage(message);
  }

  async function startOperation(origin = 'local', remoteStartedAt = null) {
    if (briefingAccepted || matchLocked || operationLaunchTokenRef.current) {
      return;
    }

    let synchronizedStartedAt = remoteStartedAt;

    if (origin === 'local' && currentPlayerRoleLabel === 'Host') {
      const result = await markRoomStarted(roomId, clientSessionId);
      if (!result.success) {
        setSystemMessage(result.error || 'Gagal memulai operasi. Pastikan ada minimal 2 pemain.');
        return;
      }
      synchronizedStartedAt = result.room?.startedAt || result.room?.countdownStartedAt || synchronizedStartedAt;
    }

    if (operationLaunchTokenRef.current) {
      return;
    }

    const synchronizedStart = resolveSynchronizedStart(synchronizedStartedAt);
    operationLaunchTokenRef.current = synchronizedStart.startedAt;
    clearCountdownInterval();
    timeoutWarningActiveRef.current = false;
    stop('timeout', { fadeMs: 120 });
    setBriefingAccepted(true);
    setStageTimeLeft(synchronizedStart.stageTimeLeft);
    setRivalProgress(0);
    setMatchStartedAt(synchronizedStart.startedAt);
    setSystemMessage(origin === 'remote' ? 'Host memulai operasi.' : 'Operation initialized.');

    window.setTimeout(() => {
      inputRef.current?.focus();
    }, 80);
  }

  function handleRemoteMatchOver(message) {
    if (matchLocked) {
      return;
    }

    const localFailSummary = message.rivalSummary
      ? {
          codename: playerName,
          result: 'Failed',
          score: message.rivalSummary.score,
          wpm: message.rivalSummary.wpm,
        }
      : undefined;

    finalizeMatch({
      localStatus: message.winnerId === clientSessionId ? 'success' : 'failed',
      winnerName: message.winnerName,
      winnerId: message.winnerId,
      rivalSummary: message.localSummary,
      localSummaryOverride: localFailSummary,
    });
  }

  function computeLocalScore() {
    const elapsedMinutes = matchStartedAt ? Math.max((Date.now() - matchStartedAt) / 60000, 1 / 60) : 1;
    const wpm = Math.round(completedWordTotal / elapsedMinutes);
    const accuracy = Math.round((completedWordTotal / Math.max(completedWordTotal + typoCount, 1)) * 100);
    const baseWordScore = completedWordTotal * 100;
    const bonusScore = winState ? Math.max(0, bonusTimeLeft) * 20 + 500 : 0;
    const score = Math.round(baseWordScore + bonusScore);
    return { score, wpm, accuracy };
  }

  function finalizeMatch({ localStatus, winnerName, winnerId, rivalSummary, localSummaryOverride }) {
    if (matchLocked) {
      return;
    }

    setMatchLocked(true);
    const localMetrics = computeLocalScore();
    const localSummary = localSummaryOverride || {
      codename: playerName,
      result: localStatus === 'success' ? 'Success' : 'Failed',
      score: localMetrics.score,
      wpm: localMetrics.wpm,
    };

    const fallbackRivalSummary = rivalSummary || {
      codename: isRealtimeCompetitive
        ? roomPlayers.find((player) => player.name !== playerName)?.name || rivalName || 'Enemy Agent'
        : 'Training AI',
      result: localStatus === 'success' ? 'Failed' : 'Success',
      score: localStatus === 'success' ? Math.max(2800, localSummary.score - 360) : Math.max(3600, localSummary.score + 280),
      wpm: localStatus === 'success' ? Math.max(40, localSummary.wpm - 8) : Math.max(58, localSummary.wpm + 6),
    };

    setMatchOverlay({
      tone: localStatus === 'success' ? 'submitted' : 'timeout',
      title:
        localStatus === 'success'
          ? 'MISSION SUCCESS: OVERRIDE ACCEPTED'
          : 'MISSION FAILED: ENEMY AGENT WAS FASTER',
      subtitle:
        localStatus === 'success'
          ? `${winnerName} completed the override first.`
          : `${winnerName} completed the override first.`,
    });

    if (localStatus === 'success') {
      play('mission_success');
    } else {
      play('error');
    }

    if (matchTimeoutRef.current) {
      window.clearTimeout(matchTimeoutRef.current);
    }

    matchTimeoutRef.current = window.setTimeout(() => {
      setPostMatchData({
        winnerName,
        winnerId,
        finishedAt: Date.now(),
        localSummary,
        rivalSummary: fallbackRivalSummary,
        leaderboardRows: buildPostMatchRows(localSummary, fallbackRivalSummary),
      });
      setMatchOverlay(null);
    }, MATCH_OVER_DELAY_MS);
  }

  function onTypingKeyDown(event) {
    if (matchLocked || !briefingAccepted) {
      event.preventDefault();
      return;
    }

    if (
      event.key.length === 1 &&
      event.key !== ' ' &&
      !event.ctrlKey &&
      !event.metaKey &&
      !event.altKey
    ) {
      play('type');
    }

    if (gameMode === 'typing' && currentTargetWord && event.key.length === 1 && event.key !== ' ') {
      const expectedCharacter = currentTargetWord[currentInput.length];
      if (event.key !== expectedCharacter) {
        setTypoCount((current) => current + 1);
        play('error');
      }
    }

    handleTypingKeyDown(event);
  }

  function onTypingChange(event) {
    const result = handleTypingChange(event.target.value);

    if (result.reason === 'case-sensitive-mismatch') {
      setTypoCount((current) => current + 1);
      play('error');
      return;
    }
  }

  function onValidatePassword() {
    const valid = validatePassword(passwordValue);
    if (valid) {
      play('access_granted');
    } else {
      play('error');
    }
  }

  function onValidateIp() {
    const valid = validateIpv4(ipValue);
    if (!valid) {
      play('error');
      return;
    }

    const localMetrics = computeLocalScore();
    const localSummary = {
      codename: playerName,
      result: 'Success',
      score: localMetrics.score,
      wpm: localMetrics.wpm,
    };

    const rivalSummary = {
      codename: isRealtimeCompetitive
        ? roomPlayers.find((player) => player.name !== playerName)?.name || rivalName || 'Enemy Agent'
        : 'Training AI',
      result: 'Failed',
      score: Math.max(2500, Math.round((rivalProgress || 0) * 32)),
      wpm: Math.max(36, Math.round((rivalProgress || 0) * 0.7)),
    };

    if (isRealtimeCompetitive) {
      sendRoomRealtimeEvent(roomId, 'match_over', {
        by: clientSessionId,
        payload: { winnerId: clientSessionId, winnerName: playerName, localSummary, rivalSummary },
      });
    }

    finalizeMatch({
      localStatus: 'success',
      winnerName: playerName,
      winnerId: clientSessionId,
      rivalSummary,
      localSummaryOverride: localSummary,
    });
  }

  async function handleLeaveRoom(forceConfirmed = false) {
    if (isLockedInGameplay && !forceConfirmed) {
      setLeavePrompt({
        title: 'Abort match?',
        body: 'Pertandingan sedang berjalan. Keluar sekarang akan menggagalkan match untuk seluruh room.',
        confirmLabel: 'Abort & keluar',
        source: 'abort',
      });
      return;
    }
    const result = await leaveRoom(roomId, clientSessionId);
    if (result.success) {
      router.push('/enigma-protocol/lobby');
    }
  }

  function closeLeavePrompt() {
    setLeavePrompt(null);
  }

  async function confirmLeavePrompt() {
    setLeavePrompt(null);
    await handleLeaveRoom(true);
  }

  function handleReturnToLobby() {
    if (postMatchData || !roomState) {
      if (roomState) {
        void leaveRoom(roomId, clientSessionId);
      }
      router.push('/enigma-protocol/lobby');
      return;
    }

    if (isLockedInGameplay) {
      setSystemMessage('Tidak bisa keluar lobby saat gameplay sedang berjalan.');
      return;
    }
    router.push('/enigma-protocol/lobby');
  }

  async function handleStartOperation() {
    if (currentPlayerRoleLabel !== 'Host') {
      return;
    }

    await startOperation('local');
  }

  const roomPlayers = useMemo(() => {
    const players = roomState?.players || [{ name: playerName, role: playerRole }];

    return players.map((player, index) => ({
      ...player,
      status: player.clientId === clientSessionId ? 'You' : 'Linked', 

      progress: player.clientId === clientSessionId ? Math.round(playerProgress) : Math.round(rivalProgress),
    }));
  }, [clientSessionId, playerName, playerProgress, playerRole, rivalProgress, roomState?.players]);
  const activeTimer = gameMode === 'end-challenge' ? bonusTimeLeft : stageTimeLeft;
  const isTimerDanger = activeTimer <= 7;
  const timerToneClass = isTimerDanger ? 'offline' : 'online';
  const briefingBlocks = stages.map((_, index) => `Stage ${index + 1}`);
  const queuePreview = stageQueue.map((stageIndex) => `Stage ${stageIndex + 1}`);
  const canStartOperation =
    currentPlayerRoleLabel === 'Host' &&
    !briefingAccepted &&
    !matchLocked &&
    hasStartRequirement;

  if (!isHydrated) {
    return (
      <EnigmaFrame hideNav className="room-game">
        <section className="hero-shell room-header">
          <div>
            <p className="section-tag cyan">ROOM INIT</p>
            <h1>Enigma Protocol</h1>
            <p>Menyelaraskan room dan sinkronisasi pemain.</p>
          </div>
          <div className="hero-actions">
            <span className="status-chip online">Syncing</span>
            <Link
              href="/enigma-protocol/lobby"
              className="shell-button subtle"
              style={{ textDecoration: 'none' }}
            >
              Kembali ke Lobby
            </Link>
          </div>
        </section>
      </EnigmaFrame>
    );
  }

  if (!roomState && !postMatchData) {
    return (
      <EnigmaFrame hideNav className="room-game">
        <section className="hero-shell room-header">
          <div>
            <p className="section-tag cyan">ROOM CLOSED</p>
            <h1>Enigma Protocol</h1>
            <p>Room ini sudah tidak tersedia atau telah dibersihkan dari sistem dummy.</p>
          </div>
          <div className="hero-actions">
            <span className="status-chip offline">Unavailable</span>
            <button type="button" className="shell-button subtle" onClick={handleReturnToLobby}>
              Kembali ke Lobby
            </button>
          </div>
        </section>

        <section className="summary-grid room-summary">
          <article className="shell-card mini-card">
            <p className="section-tag amber">STATUS</p>
            <h3>Room tidak aktif</h3>
            <p>{systemMessage}</p>
          </article>
        </section>
      </EnigmaFrame>
    );
  }

  if (postMatchData) {
    const isSuccess = postMatchData.localSummary.result === 'Success';
    return (
      <EnigmaFrame hideNav className="room-game">
        <div style={{ maxWidth: '1000px', margin: '0 auto', padding: '60px 24px' }}>
          <header style={{ textAlign: 'center', marginBottom: '60px' }}>
            <p className="section-tag cyan" style={{ marginBottom: '16px', letterSpacing: '0.1em' }}>OPERATION BRIEFING COMPLETE</p>
            <h1 style={{ fontSize: 'clamp(2.5rem, 6vw, 4rem)', fontWeight: 800, marginBottom: '12px', letterSpacing: '-0.04em' }}>
              {isSuccess ? 'Mission Accomplished' : 'System Compromised'}
            </h1>
            <p style={{ color: 'var(--text-soft)', fontSize: '1.15rem', opacity: 0.8 }}>
              {activeOperation.alias} • {formatMatchDate(postMatchData.finishedAt)}
            </p>
          </header>

          <div style={{ 
            display: 'grid', 
            gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', 
            gap: '20px', 
            marginBottom: '60px' 
          }}>
            <div className="shell-card" style={{ padding: '32px', textAlign: 'center', background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.05)' }}>
              <p className="section-tag magenta" style={{ marginBottom: '12px' }}>FINAL SCORE</p>
              <h2 style={{ fontSize: '3.5rem', margin: 0, fontWeight: 800, color: 'var(--magenta)' }}>{postMatchData.localSummary.score}</h2>
            </div>
            <div className="shell-card" style={{ padding: '32px', textAlign: 'center', background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.05)' }}>
              <p className="section-tag cyan" style={{ marginBottom: '12px' }}>TYPING SPEED</p>
              <h2 style={{ fontSize: '3.5rem', margin: 0, fontWeight: 800, color: 'var(--cyan)' }}>
                {postMatchData.localSummary.wpm} 
                <span style={{ fontSize: '1.2rem', color: 'var(--text-faint)', marginLeft: '8px', fontWeight: 400 }}>WPM</span>
              </h2>
            </div>
            <div className="shell-card" style={{ padding: '32px', textAlign: 'center', background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.05)' }}>
              <p className="section-tag amber" style={{ marginBottom: '12px' }}>SECTOR WINNER</p>
              <h2 style={{ fontSize: '1.8rem', margin: '0.6rem 0', fontWeight: 700 }}>{postMatchData.winnerName}</h2>
              <p style={{ margin: 0, fontSize: '0.9rem', color: 'var(--text-faint)' }}>Sync verified</p>
            </div>
          </div>

          <section className="shell-card" style={{ padding: '0', overflow: 'hidden', background: 'rgba(10, 15, 30, 0.4)' }}>
            <div style={{ padding: '24px 32px', borderBottom: '1px solid rgba(255,255,255,0.06)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                <h2 style={{ margin: 0, fontSize: '1.2rem', fontWeight: 700 }}>Mission Ranking</h2>
                <p style={{ margin: '4px 0 0', fontSize: '0.85rem', color: 'var(--text-faint)' }}>Comparative agent performance</p>
              </div>
              <button type="button" className="shell-button gradient" onClick={handleReturnToLobby} style={{ padding: '0.8rem 2rem' }}>
                Return to Lobby
              </button>
            </div>

            <div className="leaderboard-table" style={{ marginTop: '0' }}>
              <div className="leaderboard-head" style={{ padding: '16px 32px', background: 'rgba(255,255,255,0.02)' }}>
                <span>Rank</span>
                <span>Agent Codename</span>
                <span>Status</span>
                <span style={{ textAlign: 'right' }}>Score</span>
                <span style={{ textAlign: 'right' }}>WPM</span>
              </div>
              {postMatchData.leaderboardRows.map((entry) => (
                <div
                  key={`${entry.rank}-${entry.codename}`}
                  className={`leaderboard-row ${entry.codename === playerName ? 'self' : ''}`}
                  style={{ padding: '20px 32px', borderBottom: '1px solid rgba(255,255,255,0.03)' }}
                >
                  <span style={{ fontWeight: 800, color: 'var(--cyan)', fontSize: '1.1rem' }}>#{entry.rank}</span>
                  <span style={{ fontWeight: 600 }}>{entry.label || entry.codename}</span>
                  <span style={{ 
                    color: entry.result === 'Success' ? 'var(--cyan)' : 'var(--danger)',
                    fontSize: '0.85rem',
                    fontWeight: 700,
                    textTransform: 'uppercase'
                  }}>
                    {entry.result}
                  </span>
                  <span style={{ textAlign: 'right', fontFamily: 'var(--font-mono)' }}>{entry.score}</span>
                  <span style={{ textAlign: 'right', fontWeight: 700, color: 'var(--text-bright)' }}>{entry.wpm} <small style={{ fontWeight: 400, opacity: 0.6 }}>WPM</small></span>
                </div>
              ))}
            </div>
          </section>
        </div>
      </EnigmaFrame>
    );
  }

  return (
    <EnigmaFrame hideNav className="room-game">
      {!briefingAccepted ? (
        <>
          <section className="hero-shell room-header">
            <div>
              <p className="section-tag cyan">ROOM {roomId}</p>
              <h1>Enigma Protocol</h1>
              <p>Ruang dekripsi aktif untuk simulasi operasi dua agen.</p>
            </div>
            <div className="hero-actions">
              <span className={`status-chip ${channelLive ? 'online' : 'offline'}`}>
                {hasRivalJoined ? 'Linked' : 'Waiting'}
              </span>
              <Link
                href="/enigma-protocol/lobby"
                className="shell-button subtle"
                style={{ textDecoration: 'none' }}
              >
                Kembali ke Lobby
              </Link>
            </div>
          </section>

          <section className="summary-grid room-summary">
            <article className="shell-card mini-card">
              <p className="section-tag cyan">AGENT</p>
              <h3>{playerName}</h3>
              <p>{`${currentPlayerRoleLabel} • ${hasRivalJoined ? 'Link active.' : 'Waiting for Player 2.'}`}</p>
            </article>
            <article className="shell-card mini-card">
              <p className="section-tag magenta">PVP</p>
              <h3>{isLocalNetwork ? 'Local Network' : 'Training AI'}</h3>
              <p>{roomState?.operationLabel || activeOperation.alias}</p>
            </article>
            <article className="shell-card mini-card">
              <p className="section-tag amber">STATUS</p>
              <h3>{gameMode === 'typing' ? `${currentStageNumber} / ${totalStageCount}` : 'END'}</h3>
              <p>{`Timer ${activeTimer}s • Queue ${stageQueue.length} • ${muted ? 'Muted' : 'Audio Live'}`}</p>
            </article>
          </section>
        </>
      ) : (
        <div 
          className="gameplay-nav" 
          style={{ 
            width: 'min(1320px, 100%)', 
            margin: '0 auto 20px', 
            display: 'flex', 
            justifyContent: 'space-between', 
            alignItems: 'center', 
            padding: '16px 24px', 
            borderRadius: '18px', 
            background: 'rgba(12, 18, 36, 0.78)', 
            border: '1px solid rgba(105, 129, 171, 0.24)', 
            backdropFilter: 'blur(14px)' 
          }}
        >
          <div style={{ display: 'flex', gap: '20px', alignItems: 'center' }}>
            <div className="nav-operation-info">
              <p className="section-tag cyan" style={{ fontSize: '0.7rem', marginBottom: '2px' }}>OPERATION ACTIVE</p>
              <h2 style={{ margin: 0, fontSize: '1.2rem', color: '#fff' }}>
                {roomState?.operationLabel || activeOperation.alias}
              </h2>
            </div>
            <div style={{ height: '30px', width: '1px', background: 'rgba(255,255,255,0.1)' }} />
            <div>
              <p className="section-tag amber" style={{ fontSize: '0.7rem', marginBottom: '2px' }}>CURRENT SECTOR</p>
              <p style={{ margin: 0, fontWeight: 700, color: 'var(--cyan)' }}>
                {gameMode === 'typing' ? `Stage ${currentStageNumber} of ${totalStageCount}` : 'Final Override'}
              </p>
            </div>
          </div>
          
          <div style={{ display: 'flex', gap: '16px', alignItems: 'center' }}>
            <div className={`status-chip ${timerToneClass}`} style={{ minWidth: '80px', fontSize: '1.1rem' }}>
              {activeTimer}s
            </div>
            {!matchLocked && (
              <button 
                type="button" 
                className="shell-button subtle" 
                style={{ padding: '0.6rem 1.2rem', color: 'var(--danger)', borderColor: 'rgba(255,143,158,0.2)' }} 
                onClick={() => handleLeaveRoom()}
              >
                Abort
              </button>
            )}
          </div>
        </div>
      )}

      <section className="typing-layout">
        <div className="typing-main">
          <article className="shell-card typing-card">
            <div className="card-head">
              <div>
                <p className="section-tag cyan">MISSION FEED</p>
                <h2>
                  {gameMode === 'typing'
                    ? briefingAccepted
                      ? `Stage ${currentStageNumber}`
                      : 'Operation Briefing'
                    : 'End Challenge'}
                </h2>
                {!briefingAccepted && (
                  <p>
                    Siapkan room lalu mulai bersama.
                  </p>
                )}
              </div>
              <div className="pill-row">
                {gameMode === 'typing' && !briefingAccepted && (
                  <span className={`status-chip ${timerToneClass}`}>{`${activeTimer}s`}</span>
                )}
                <span className={`status-chip ${channelLive ? 'online' : 'offline'}`}>
                  {channelLive ? 'Channel Live' : 'Channel Idle'}
                </span>
                <span className={`status-chip ${muted ? 'offline' : 'online'}`}>
                  {muted ? 'Audio Off' : 'Audio On'}
                </span>
              </div>
            </div>

            {gameMode === 'typing' && !briefingAccepted ? (
              <>
                <div className="mission-box" style={{ marginTop: '22px' }}>
                  <p className="section-tag magenta">OPERATION BRIEFING</p>
                  <h2 style={{ marginTop: '0.8rem', marginBottom: '0.7rem' }}>
                    {roomState?.operationLabel || activeOperation.alias}
                  </h2>
                  <p>Dekripsi 5 stage. Detail target tetap terenkripsi sampai akhir.</p>
                  <div className="file-list-grid">
                    <span className="info-pill">
                      Room ID: <strong style={{ marginLeft: '6px' }}>{roomId}</strong>
                    </span>
                    <button type="button" className="shell-button subtle" onClick={copyRoomId}>
                      {copyStatus}
                    </button>
                    <span className={`info-pill ${hasRivalJoined ? 'decoded-flash' : ''}`}>
                      {roomCountdownLeft === null
                        ? (hasRivalJoined ? 'Rival Joined' : 'Waiting for Rival')
                        : `Auto start in ${roomCountdownLeft}s`}
                    </span>
                  </div>
                </div>

                <div className="openbook-grid" style={{ marginTop: '18px' }}>
                  {briefingBlocks.map((label) => (
                    <div key={label} className="openbook-item">
                      <strong>{label}</strong>
                    </div>
                  ))}
                </div>

                <div className="action-row">
                  <button
                    type="button"
                    className="shell-button gradient"
                    onClick={handleStartOperation}
                    disabled={!canStartOperation}
                    style={{
                      opacity: canStartOperation ? 1 : 0.55,
                      cursor: canStartOperation ? 'pointer' : 'not-allowed',
                    }}
                  >
                    {currentPlayerRoleLabel === 'Host'
                      ? hasStartRequirement
                        ? 'Force Start'
                        : roomCountdownLeft === null
                          ? 'Waiting for Rival'
                          : `Auto ${roomCountdownLeft}s`
                      : 'Menunggu Host'}
                  </button>
                </div>
              </>
            ) : gameMode === 'typing' ? (
              <>
                <div className="token-reference">
                  <p className="section-tag magenta">DECRYPTION FLOW</p>
                  <p>Ketik kata aktif secara case-sensitive. Stage timeout kembali ke akhir antrean.</p>
                </div>

                <div className="arena-center">
                  <div
                    className={`arena-timer ${isTimerDanger ? 'text-red-500 animate-pulse' : 'text-cyan-300'}`}
                    style={{
                      color: isTimerDanger ? '#ef4444' : '#67e8f9',
                      animation: isTimerDanger ? 'pulse 1s ease-in-out infinite' : 'none',
                    }}
                  >
                    {String(activeTimer).padStart(2, '0')}
                  </div>
                  <p>{`Progress stage ${currentStageNumber}`}</p>
                </div>

                <div
                  className={`word-stream ${stageTransitioning ? 'stage-shift' : ''}`}
                >
                  {currentStage.englishWords.map((word, index) => {
                    const isCompleted = index < currentWordIndex;
                    const isCurrent = index === currentWordIndex;
                    const currentError = isCurrent && wordStatus === 'blocked' && currentInput.length > 0;
                    const currentReady = isCurrent && wordStatus === 'ready';

                    return (
                      <span
                        key={`${word}-${index}`}
                        className={[
                          'word',
                          isCompleted ? 'done decoded-flash' : '',
                          isCurrent ? 'active' : '',
                          currentReady ? 'ready' : '',
                          currentError ? 'error' : '',
                        ].join(' ')}
                      >
                        {isCompleted ? currentStage.translatedWords[index] : word}
                      </span>
                    );
                  })}
                </div>

                <div className="typing-input-shell">
                  <input
                    ref={inputRef}
                    value={currentInput}
                    onChange={onTypingChange}
                    onKeyDown={onTypingKeyDown}
                    placeholder="Ketik kata aktif di sini..."
                    className="typing-input"
                    autoFocus
                    disabled={matchLocked}
                    autoComplete="off"
                    autoCorrect="off"
                    autoCapitalize="off"
                    spellCheck={false}
                  />
                  <div className="typing-stats">
                    <span>{`Target: ${currentTargetWord || '-'}`}</span>
                    <span>{`Word status: ${wordStatus}`}</span>
                    <span>{`Recovered key: ${anomalyPassword || '-'}`}</span>
                  </div>
                </div>

                <div className="progress-stack">
                  <div>
                    <div className="progress-label">
                      <span>Progress pemain</span>
                      <span>{Math.round(playerProgress)}%</span>
                    </div>
                    <div className="progress-track">
                      <div className="progress-fill player" style={{ width: `${playerProgress}%` }} />
                    </div>
                  </div>
                  <div>
                    <div className="progress-label">
                      <span>Progress lawan</span>
                      <span>{Math.round(rivalProgress)}%</span>
                    </div>
                    <div className="progress-track">
                      <div className="progress-fill enemy" style={{ width: `${rivalProgress}%` }} />
                    </div>
                  </div>
                </div>

                <div className="helper-box">
                  <strong>Completed Translation</strong>
                  <p>
                    {completedWords.length === 0
                      ? 'Belum ada kata yang selesai diterjemahkan.'
                      : completedWords.join(' ')}
                  </p>
                </div>

                {stageTransitioning ? (
                  <div className={`feedback-box ${lastTransitionReason === 'timeout' ? 'timeout' : 'submitted'}`}>
                    <strong>{lastTransitionReason === 'timeout' ? 'Waktu habis' : 'Stage selesai'}</strong>
                  <p>
                      {lastTransitionReason === 'timeout'
                        ? 'Stage timeout, lanjut ke stage berikutnya tanpa pengulangan.'
                        : 'Menyiapkan stage berikutnya.'}
                    </p>
                  </div>
                ) : null}
              </>
            ) : (
              <>
                <div className="locked-box">
                  <p className="section-tag magenta">DECRYPTION LOCK</p>
                  <p>Seluruh antrean stage selesai. Masukkan Decryption Key untuk membuka master file.</p>
                </div>

                <div className="check-grid" style={{ marginTop: '18px' }}>
                  {[1, 2, 3].map((attemptIndex) => (
                    <div
                      key={`attempt-${attemptIndex}`}
                      className={`check ${attemptIndex <= passwordAttemptsLeft ? 'ok' : ''}`}
                    >
                      {`Security Attempt ${attemptIndex}`}
                    </div>
                  ))}
                </div>

                <label className="input-block">
                  <span>Decryption Key</span>
                  <input
                    value={passwordValue}
                    onChange={(event) => setPasswordValue(event.target.value.toUpperCase())}
                    placeholder="Masukkan 5 huruf kapital"
                    autoComplete="off"
                    autoCorrect="off"
                    autoCapitalize="characters"
                    spellCheck={false}
                  />
                </label>

                <div className="action-row">
                  <button type="button" className="shell-button gradient" onClick={onValidatePassword}>
                    Validasi Password
                  </button>
                </div>

                {passwordStatus === 'invalid' ? (
                  <div className="feedback-box timeout">
                    <strong>Password salah</strong>
                    <p>{`Sisa percobaan: ${passwordAttemptsLeft}. Setelah 3 kali salah, sistem akan hard reset ke Stage 1.`}</p>
                  </div>
                ) : null}

                {masterFileUnlocked ? (
                  <>
                    <div className="typewriter-box">
                      <p className="section-tag cyan">MASTER FILE</p>
                      <p>{revealedMasterFile || activeOperation.masterFile}</p>
                    </div>

                    <label className="input-block">
                      <span>Confirm Target IP</span>
                      <input
                        value={ipValue}
                        onChange={(event) => setIpValue(event.target.value)}
                        placeholder={activeOperation.targetIp}
                        autoComplete="off"
                        autoCorrect="off"
                        autoCapitalize="off"
                        spellCheck={false}
                      />
                    </label>

                    <div className="action-row">
                      <button type="button" className="shell-button gradient" onClick={onValidateIp}>
                        Validasi IP
                      </button>
                    </div>

                    {ipStatus === 'invalid-format' ? (
                      <div className="feedback-box timeout">
                        <strong>Format tidak valid</strong>
                        <p>Gunakan format IPv4.</p>
                      </div>
                    ) : null}
                    {ipStatus === 'valid-format' ? (
                      <div className="feedback-box">
                        <strong>IP valid, target belum cocok</strong>
                        <p>Periksa kembali master file.</p>
                      </div>
                    ) : null}
                  </>
                ) : null}
              </>
            )}
          </article>
        </div>

        <aside className="typing-side">
          <article className="shell-card side-card">
            <p className="section-tag cyan">ROOM DOSSIER</p>
            <h3>{`${roomState?.operationLabel || activeOperation.alias} • ${gameMode === 'typing' ? 'Live Room' : 'End Challenge'}`}</h3>
            <div className="player-stack">
              {roomPlayers.map((player) => (
                <div key={`${player.id}-${player.name}`} className="player-row">
                  <div>
                    <strong>{player.name}</strong>
                    <p>{`${player.role === 'host' ? 'Host' : 'Guest'} • ${player.clientId === clientSessionId ? 'You' : 'Linked'}`}</p>
                  </div>
                  <span>{player.progress}%</span>
                </div>
              ))}
            </div>

            <div className="verify-box">
              <div>
                <span>Operation</span>
                <strong>{roomState?.operationLabel || activeOperation.alias}</strong>
              </div>
              <div>
                <span>Opponent</span>
                <strong>{isLocalNetwork ? 'Local Network' : 'Training AI'}</strong>
              </div>
              <div>
                <span>Recovered Key</span>
                <strong>{anomalyPassword || '[PENDING]'}</strong>
              </div>
              <div>
                <span>Target IP</span>
                <strong>{masterFileUnlocked ? activeOperation.targetIp : '[ENCRYPTED]'}</strong>
              </div>
            </div>
          </article>

          {!briefingAccepted && (
            <>
              <article className="shell-card side-card">
                <p className="section-tag magenta">SYSTEM FEED</p>
                <h3>{muted ? 'Muted Channel' : 'Signal Stable'}</h3>
                <p>{systemMessage}</p>
                <div className="check-grid">
                  <div className={`check ${muted ? '' : 'ok'}`}>
                    {muted ? 'Audio Off' : 'Audio Ready'}
                  </div>
                  <div className={`check ${channelLive ? 'ok' : ''}`}>
                    {channelLive ? 'Channel Live' : 'Channel Idle'}
                  </div>
                  <div className={`check ${hasRivalJoined ? 'ok' : ''}`}>
                    {hasRivalJoined ? 'Player 2 Joined' : 'Waiting Link'}
                  </div>
                </div>
              </article>

              <article className="shell-card side-card">
                <p className="section-tag amber">ALGORITHM RULES</p>
                <h3>Flow terbaru</h3>
                <div className="result-list">
                  <div className="result-item">
                    <div>
                      <strong>Typing</strong>
                      <p>Word-by-word, case-sensitive, dan 70 detik per stage.</p>
                    </div>
                  </div>
                  <div className="result-item">
                    <div>
                      <strong>Single Pass</strong>
                      <p>Setiap stage hanya satu putaran, tidak ada pengulangan stage.</p>
                    </div>
                  </div>
                  <div className="result-item">
                    <div>
                      <strong>Bonus Phase</strong>
                      <p>Setelah 5 stage selesai, ada 50 detik bonus untuk pengiriman file.</p>
                    </div>
                  </div>
                </div>
                <div className="helper-box">
                  <strong>Progress operasi</strong>
                  <div style={{ marginTop: '12px', display: 'grid', gap: '12px' }}>
                    <div>
                      <div className="progress-label">
                        <span>Overall</span>
                        <span>{Math.round(playerProgress)}%</span>
                      </div>
                      <div className="progress-track">
                        <div className="progress-fill player" style={{ width: `${playerProgress}%` }} />
                      </div>
                    </div>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
                      {stages.map((_, index) => {
                        const isActive = stageQueue[0] === index && gameMode === 'typing';
                        const isPending = stageQueue.includes(index);

                        return (
                          <span
                            key={`progress-stage-${index + 1}`}
                            className="info-pill"
                            style={{
                              border: isActive
                                ? '1px solid rgba(82, 227, 255, 0.38)'
                                : !isPending
                                  ? '1px solid rgba(137, 255, 168, 0.28)'
                                  : '1px solid rgba(255,255,255,0.06)',
                              background: isActive
                                ? 'rgba(82, 227, 255, 0.12)'
                                : !isPending
                                  ? 'rgba(137, 255, 168, 0.10)'
                                  : 'rgba(255,255,255,0.04)',
                            }}
                          >
                            {`Stage ${index + 1}`}
                          </span>
                        );
                      })}
                    </div>
                    {stageQueue.length > 0 ? <p style={{ margin: 0 }}>{queuePreview.join(' • ')}</p> : null}
                  </div>
                </div>
                <div className="action-row">
                  {isLockedInGameplay ? null : (
                    <button type="button" className="shell-button subtle" onClick={handleLeaveRoom}>
                      Leave Room
                    </button>
                  )}
                </div>
              </article>
            </>
          )}
        </aside>
      </section>

      {leavePrompt ? (
        <div className="room-modal-backdrop" onMouseDown={closeLeavePrompt}>
          <div className="room-modal room-abort-modal" onMouseDown={(event) => event.stopPropagation()}>
            <div className="room-modal-chip">Warning</div>
            <h3>{leavePrompt.title}</h3>
            <p>{leavePrompt.body}</p>
            <div className="room-modal-actions">
              <button type="button" className="shell-button subtle room-modal-cancel" onClick={closeLeavePrompt}>
                Tetap di room
              </button>
              <button type="button" className="shell-button room-modal-confirm" onClick={confirmLeavePrompt}>
                {leavePrompt.confirmLabel}
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {matchOverlay ? (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(4, 8, 20, 0.72)',
            display: 'grid',
            placeItems: 'center',
            zIndex: 20,
            padding: '24px',
          }}
        >
          <div className={`feedback-box ${matchOverlay.tone}`} style={{ maxWidth: '620px', width: '100%' }}>
            <strong>{matchOverlay.title}</strong>
            <p>{matchOverlay.subtitle}</p>
          </div>
        </div>
      ) : null}
    </EnigmaFrame>
  );
}
