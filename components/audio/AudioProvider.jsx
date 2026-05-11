'use client';

import { createContext, useContext, useEffect, useMemo, useRef, useState } from 'react';

const AUDIO_MUTED_KEY = 'enigma_audio_muted_v1';

const AUDIO_MAP = {
  click: { src: '/audio/click.wav', volume: 0.28, poolSize: 4 },
  type: { src: '/audio/type.wav', volume: 0.06, poolSize: 8 },
  word_done: { src: '/audio/word_done.mp3', volume: 0.38, poolSize: 4 },
  stage_clear: { src: '/audio/stage_clear.mp3', volume: 0.46, poolSize: 3 },
  timeout: { src: '/audio/timeout.mp3', volume: 0.26, poolSize: 1, loop: true },
  error: { src: '/audio/error.mp3', volume: 0.48, poolSize: 3 },
  hard_reset: { src: '/audio/hard_reset.mp3', volume: 0.4, poolSize: 2 },
  access_granted: { src: '/audio/access_granted.mp3', volume: 0.48, poolSize: 2 },
  data_reveal: { src: '/audio/data_reveal.mp3', volume: 0.18, poolSize: 1, loop: true },
  mission_success: { src: '/audio/mission_success.mp3', volume: 0.52, poolSize: 2 },
  bgm: { src: '/audio/bgm.mp3', volume: 0.16, poolSize: 1, loop: false },
  bgm1: { src: '/audio/bgm1.mp3', volume: 0.17, poolSize: 1, loop: false },
};

const AudioContextState = createContext({
  muted: false,
  toggleMute: () => {},
  play: () => {},
  stop: () => {},
});

function createAudioPool(config) {
  return Array.from({ length: config.poolSize || 1 }, () => {
    const audio = new Audio(config.src);
    audio.preload = 'auto';
    audio.volume = config.volume ?? 1;
    audio.loop = Boolean(config.loop);
    return audio;
  });
}

export function AudioProvider({ children }) {
  const [muted, setMuted] = useState(false);
  const poolsRef = useRef({});
  const loopRef = useRef({});
  const availabilityRef = useRef({});
  const synthContextRef = useRef(null);
  const synthLoopRef = useRef({});
  const fadeRef = useRef({});
  const stopDelayRef = useRef({});
  const lastTypePulseRef = useRef(0);
  const bgmStartedRef = useRef(false);

  function ensureSynthContext() {
    if (typeof window === 'undefined') {
      return null;
    }

    if (!synthContextRef.current) {
      const AudioCtx = window.AudioContext || window.webkitAudioContext;
      if (!AudioCtx) {
        return null;
      }
      synthContextRef.current = new AudioCtx();
    }

    if (synthContextRef.current.state === 'suspended') {
      void synthContextRef.current.resume().catch(() => {});
    }

    return synthContextRef.current;
  }

  function pulseSynth({
    frequency,
    duration = 0.06,
    gainValue = 0.03,
    type = 'triangle',
    delaySeconds = 0,
  }) {
    const context = ensureSynthContext();
    if (!context) {
      return;
    }

    const oscillator = context.createOscillator();
    const gain = context.createGain();
    const startAt = context.currentTime + delaySeconds;

    oscillator.type = type;
    oscillator.frequency.value = frequency;
    gain.gain.value = gainValue;

    oscillator.connect(gain);
    gain.connect(context.destination);

    oscillator.start(startAt);
    gain.gain.exponentialRampToValueAtTime(0.0001, startAt + duration);
    oscillator.stop(startAt + duration);
  }

  function stopSynthLoop(name) {
    const loopHandle = synthLoopRef.current[name];
    if (loopHandle) {
      window.clearInterval(loopHandle);
      delete synthLoopRef.current[name];
    }
  }

  function playSynth(name) {
    if (muted) {
      return;
    }

    switch (name) {
      case 'click':
        pulseSynth({ frequency: 460, duration: 0.035, gainValue: 0.02, type: 'triangle' });
        break;
      case 'type': {
        const now = performance.now();
        if (now - lastTypePulseRef.current < 18) {
          return;
        }
        lastTypePulseRef.current = now;
        pulseSynth({ frequency: 210, duration: 0.014, gainValue: 0.009, type: 'square' });
        break;
      }
      case 'word_done':
        pulseSynth({ frequency: 720, duration: 0.028, gainValue: 0.02, type: 'triangle' });
        pulseSynth({ frequency: 980, duration: 0.04, gainValue: 0.026, type: 'triangle', delaySeconds: 0.03 });
        break;
      case 'stage_clear':
        pulseSynth({ frequency: 540, duration: 0.05, gainValue: 0.028, type: 'triangle' });
        pulseSynth({ frequency: 760, duration: 0.06, gainValue: 0.032, type: 'triangle', delaySeconds: 0.04 });
        break;
      case 'timeout':
      case 'error':
        pulseSynth({ frequency: 132, duration: 0.09, gainValue: 0.03, type: 'sawtooth' });
        break;
      case 'hard_reset':
        pulseSynth({ frequency: 240, duration: 0.08, gainValue: 0.03, type: 'sawtooth' });
        pulseSynth({ frequency: 180, duration: 0.09, gainValue: 0.028, type: 'sawtooth', delaySeconds: 0.06 });
        pulseSynth({ frequency: 126, duration: 0.1, gainValue: 0.03, type: 'sawtooth', delaySeconds: 0.12 });
        break;
      case 'access_granted':
        pulseSynth({ frequency: 620, duration: 0.04, gainValue: 0.028, type: 'triangle' });
        pulseSynth({ frequency: 820, duration: 0.06, gainValue: 0.032, type: 'triangle', delaySeconds: 0.04 });
        pulseSynth({ frequency: 1080, duration: 0.08, gainValue: 0.034, type: 'triangle', delaySeconds: 0.09 });
        break;
      case 'mission_success':
        pulseSynth({ frequency: 560, duration: 0.05, gainValue: 0.028, type: 'triangle' });
        pulseSynth({ frequency: 760, duration: 0.06, gainValue: 0.032, type: 'triangle', delaySeconds: 0.05 });
        pulseSynth({ frequency: 1020, duration: 0.09, gainValue: 0.036, type: 'triangle', delaySeconds: 0.11 });
        break;
      case 'data_reveal':
        if (synthLoopRef.current[name]) {
          return;
        }
        synthLoopRef.current[name] = window.setInterval(() => {
          pulseSynth({ frequency: 360, duration: 0.035, gainValue: 0.012, type: 'square' });
          pulseSynth({ frequency: 520, duration: 0.022, gainValue: 0.01, type: 'triangle', delaySeconds: 0.04 });
        }, 180);
        break;
      case 'bgm':
        if (synthLoopRef.current[name]) {
          return;
        }
        synthLoopRef.current[name] = window.setInterval(() => {
          pulseSynth({ frequency: 220, duration: 0.22, gainValue: 0.008, type: 'sine' });
          pulseSynth({ frequency: 330, duration: 0.18, gainValue: 0.006, type: 'triangle', delaySeconds: 0.12 });
          pulseSynth({ frequency: 440, duration: 0.14, gainValue: 0.004, type: 'sine', delaySeconds: 0.26 });
        }, 520);
        break;
      default:
        pulseSynth({ frequency: 420, duration: 0.04, gainValue: 0.02, type: 'triangle' });
        break;
    }
  }

  useEffect(() => {
    try {
      const raw = window.localStorage.getItem(AUDIO_MUTED_KEY);
      setMuted(raw === 'true');
    } catch {}
  }, []);

  useEffect(() => {
    try {
      window.localStorage.setItem(AUDIO_MUTED_KEY, String(muted));
    } catch {}
  }, [muted]);

  function getPool(name) {
    if (!AUDIO_MAP[name]) {
      return [];
    }

    if (!poolsRef.current[name]) {
      poolsRef.current[name] = createAudioPool(AUDIO_MAP[name]);
    }

    return poolsRef.current[name];
  }

  function clearFade(name) {
    const fadeHandle = fadeRef.current[name];
    if (fadeHandle) {
      window.clearInterval(fadeHandle);
      delete fadeRef.current[name];
    }
  }

  function clearStopDelay(name) {
    const stopHandle = stopDelayRef.current[name];
    if (stopHandle) {
      window.clearTimeout(stopHandle);
      delete stopDelayRef.current[name];
    }
  }

  function stop(name, options = {}) {
    const { fadeMs = 0 } = options;
    stopSynthLoop(name);
    const audio = loopRef.current[name] || getPool(name)[0];
    if (!audio) {
      return;
    }

    clearFade(name);
    clearStopDelay(name);

    if (fadeMs > 0) {
      const startVolume = audio.volume;
      const stepTime = 40;
      const totalSteps = Math.max(1, Math.ceil(fadeMs / stepTime));
      let stepIndex = 0;

      fadeRef.current[name] = window.setInterval(() => {
        stepIndex += 1;
        const progress = stepIndex / totalSteps;
        audio.volume = Math.max(0, startVolume * (1 - progress));

        if (stepIndex >= totalSteps) {
          clearFade(name);
          try {
            audio.pause();
            audio.currentTime = 0;
            audio.volume = AUDIO_MAP[name]?.volume ?? 1;
          } catch {}
        }
      }, stepTime);
      return;
    }

    try {
      audio.pause();
      audio.currentTime = 0;
      audio.volume = AUDIO_MAP[name]?.volume ?? 1;
    } catch {}
  }

  function play(name, options = {}) {
    if (muted || typeof window === 'undefined') {
      return;
    }

    const config = AUDIO_MAP[name];
    if (!config) {
      return;
    }

    if (availabilityRef.current[name] === false) {
      playSynth(name);
      return;
    }

    const pool = getPool(name);
    const audio = config.loop
      ? pool[0]
      : pool.find((item) => item.paused || item.ended) || pool[0];

    if (!audio) {
      playSynth(name);
      return;
    }

    clearFade(name);
    clearStopDelay(name);

    const preserveTrackProgress = name === 'bgm' || name === 'bgm1';
    if (preserveTrackProgress && !audio.paused && !audio.ended) {
      return;
    }

    if (config.loop) {
      loopRef.current[name] = audio;
    }

    try {
      if (!preserveTrackProgress || audio.ended || audio.currentTime === 0) {
        audio.currentTime = 0;
      }
      const targetVolume = config.volume ?? 1;
      const fadeInMs = options.fadeInMs ?? 0;
      audio.volume = fadeInMs > 0 ? 0.0001 : targetVolume;
      audio.loop = Boolean(config.loop);
      void audio.play().catch(() => {
        playSynth(name);
      });

      if (fadeInMs > 0) {
        const stepTime = 40;
        const totalSteps = Math.max(1, Math.ceil(fadeInMs / stepTime));
        let stepIndex = 0;

        fadeRef.current[name] = window.setInterval(() => {
          stepIndex += 1;
          const progress = stepIndex / totalSteps;
          audio.volume = Math.min(targetVolume, targetVolume * progress);

          if (stepIndex >= totalSteps) {
            clearFade(name);
            audio.volume = targetVolume;
          }
        }, stepTime);
      }

      if (name === 'error') {
        stopDelayRef.current[name] = window.setTimeout(() => {
          stop(name, { fadeMs: 120 });
        }, 1000);
      }
    } catch {
      playSynth(name);
    }
  }

  useEffect(() => {
    let cancelled = false;

    async function probeAssets() {
      const entries = await Promise.all(
        Object.entries(AUDIO_MAP).map(async ([name, config]) => {
          try {
            const response = await fetch(config.src, { method: 'HEAD', cache: 'no-store' });
            return [name, response.ok];
          } catch {
            return [name, false];
          }
        }),
      );

      if (!cancelled) {
        availabilityRef.current = Object.fromEntries(entries);
      }
    }

    probeAssets();

    return () => {
      cancelled = true;
      Object.keys(synthLoopRef.current).forEach((name) => stopSynthLoop(name));
      Object.keys(stopDelayRef.current).forEach((name) => clearStopDelay(name));
    };
  }, []);

  useEffect(() => {
    const onClick = (event) => {
      const target = event.target;
      if (!(target instanceof Element)) {
        return;
      }

      if (target.closest('button') || target.closest('.top-nav a')) {
        play('click');
      }
    };

    document.addEventListener('click', onClick, true);
    return () => document.removeEventListener('click', onClick, true);
  }, [muted]);

  useEffect(() => {
    const bootstrapBgm = () => {
      if (muted || bgmStartedRef.current) {
        return;
      }

      bgmStartedRef.current = true;
      play('bgm', { fadeInMs: 700 });
    };

    window.addEventListener('pointerdown', bootstrapBgm, { passive: true });
    window.addEventListener('keydown', bootstrapBgm);

    return () => {
      window.removeEventListener('pointerdown', bootstrapBgm);
      window.removeEventListener('keydown', bootstrapBgm);
    };
  }, [muted]);

  useEffect(() => {
    if (muted) {
      stop('bgm');
      stop('bgm1');
      return;
    }

    if (bgmStartedRef.current) {
      play('bgm', { fadeInMs: 700 });
    }
  }, [muted]);

  function toggleMute() {
    setMuted((current) => {
      const next = !current;
      if (next) {
        Object.keys(loopRef.current).forEach((key) => stop(key));
        Object.keys(synthLoopRef.current).forEach((key) => stopSynthLoop(key));
      } else if (bgmStartedRef.current) {
        play('bgm', { fadeInMs: 700 });
      }
      return next;
    });
  }

  const value = useMemo(
    () => ({
      muted,
      toggleMute,
      play,
      stop,
    }),
    [muted],
  );

  return (
    <AudioContextState.Provider value={value}>
      {children}
      <button
        type="button"
        className="audio-fab"
        onClick={toggleMute}
        aria-label={muted ? 'Unmute audio' : 'Mute audio'}
        suppressHydrationWarning
      >
        {muted ? (
          <span className="audio-icon audio-icon-muted">
            <span className="audio-bar" />
            <span className="audio-slash" />
          </span>
        ) : (
          <span className="audio-icon">
            <span className="audio-bar" />
            <span className="audio-wave wave-a" />
            <span className="audio-wave wave-b" />
          </span>
        )}
      </button>
    </AudioContextState.Provider>
  );
}

export function useAudio() {
  return useContext(AudioContextState);
}
