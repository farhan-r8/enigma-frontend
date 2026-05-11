'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { enigmaOperations } from './stage-typing-data';

const MAX_PASSWORD_ATTEMPTS = 3;

function randomOperationIndex() {
  return Math.floor(Math.random() * enigmaOperations.length);
}

function getOperationIndexById(operationId) {
  if (!operationId) {
    return randomOperationIndex();
  }

  const index = enigmaOperations.findIndex((operation) => operation.id === operationId);
  return index >= 0 ? index : randomOperationIndex();
}

function buildInitialQueue(stages, initialStageIndex) {
  return stages.map((_, index) => index).slice(initialStageIndex);
}

export function useStageTypingEngine({ initialStageIndex = 0, operationId } = {}) {
  const [operationIndex, setOperationIndex] = useState(() => getOperationIndexById(operationId));
  const activeOperation = enigmaOperations[operationIndex];
  const stages = activeOperation.stages;
  const totalStageCount = stages.length;

  const [stageQueue, setStageQueue] = useState(() => buildInitialQueue(stages, initialStageIndex));
  const [currentWordIndex, setCurrentWordIndex] = useState(0);
  const [currentInput, setCurrentInput] = useState('');
  const [completedWords, setCompletedWords] = useState([]);
  const [collectedAnomalies, setCollectedAnomalies] = useState([]);
  const [wordStatus, setWordStatus] = useState('idle');
  const [gameMode, setGameMode] = useState('typing');
  const [stageTransitioning, setStageTransitioning] = useState(false);
  const [passwordInput, setPasswordInput] = useState('');
  const [passwordStatus, setPasswordStatus] = useState('idle');
  const [targetIpInput, setTargetIpInput] = useState('');
  const [ipStatus, setIpStatus] = useState('idle');
  const [masterFileUnlocked, setMasterFileUnlocked] = useState(false);
  const [winState, setWinState] = useState(false);
  const [lastTransitionReason, setLastTransitionReason] = useState('idle');
  const [passwordAttemptsLeft, setPasswordAttemptsLeft] = useState(MAX_PASSWORD_ATTEMPTS);
  const [hardResetTriggered, setHardResetTriggered] = useState(false);
  const transitionLockRef = useRef(false);

  useEffect(() => {
    transitionLockRef.current = false;
    const nextIndex = getOperationIndexById(operationId);
    setOperationIndex(nextIndex);
    setStageQueue(buildInitialQueue(enigmaOperations[nextIndex].stages, initialStageIndex));
    setCollectedAnomalies([]);
    setGameMode('typing');
    setStageTransitioning(false);
    setPasswordInput('');
    setPasswordStatus('idle');
    setTargetIpInput('');
    setIpStatus('idle');
    setMasterFileUnlocked(false);
    setWinState(false);
    setLastTransitionReason('idle');
    setCurrentWordIndex(0);
    setCurrentInput('');
    setCompletedWords([]);
    setWordStatus('idle');
    setPasswordAttemptsLeft(MAX_PASSWORD_ATTEMPTS);
    setHardResetTriggered(false);
  }, [initialStageIndex, operationId]);

  const currentStageIndex = stageQueue[0] ?? totalStageCount;
  const currentStage = stages[currentStageIndex] || null;
  const currentTargetWord = currentStage?.englishWords[currentWordIndex] || '';
  const expectedPassword = useMemo(
    () => stages.map((stage) => stage.anomalyKey).join(''),
    [stages],
  );
  const anomalyPassword = collectedAnomalies.join('');
  const allStagesCompleted = stageQueue.length === 0;
  const completedStageCount = totalStageCount - stageQueue.length;
  const currentStageNumber = currentStageIndex >= 0 && currentStageIndex < totalStageCount
    ? currentStageIndex + 1
    : totalStageCount;

  function resetWordProgress() {
    setCurrentWordIndex(0);
    setCurrentInput('');
    setCompletedWords([]);
    setWordStatus('idle');
  }

  function resetEndChallenge() {
    setPasswordInput('');
    setPasswordStatus('idle');
    setTargetIpInput('');
    setIpStatus('idle');
    setMasterFileUnlocked(false);
    setWinState(false);
    setPasswordAttemptsLeft(MAX_PASSWORD_ATTEMPTS);
  }

  function finalizeTransition(getNextQueue, reason) {
    if (transitionLockRef.current) {
      return false;
    }

    transitionLockRef.current = true;
    setStageTransitioning(true);
    setLastTransitionReason(reason);
    setWordStatus(reason === 'timeout' ? 'stage-timeout' : 'stage-complete');

    window.setTimeout(() => {
      setStageQueue((previousQueue) => {
        const nextQueue = getNextQueue(previousQueue);
        if (nextQueue.length === 0) {
          setGameMode('end-challenge');
        }
        return nextQueue;
      });
      setCurrentInput('');
      setCurrentWordIndex(0);
      setCompletedWords([]);
      setStageTransitioning(false);
      setWordStatus('idle');
      transitionLockRef.current = false;
    }, 550);

    return true;
  }

  function transitionToNextStage() {
    return finalizeTransition((previousQueue) => previousQueue.slice(1), 'completed');
  }

  function timeoutCurrentStage() {
    if (gameMode !== 'typing' || stageTransitioning || transitionLockRef.current || stageQueue.length === 0) {
      return false;
    }

    // Single pass only: on timeout move forward to next stage, never rotate back.
    return finalizeTransition((previousQueue) => previousQueue.slice(1), 'timeout');
  }

  function commitCurrentWord() {
    if (transitionLockRef.current) {
      return;
    }

    const translatedWord = currentStage.translatedWords[currentWordIndex];
    const nextWordIndex = currentWordIndex + 1;

    setCompletedWords((previousWords) => [...previousWords, translatedWord]);

    if (
      currentTargetWord.includes(currentStage.anomalyKey) &&
      !collectedAnomalies.includes(currentStage.anomalyKey)
    ) {
      setCollectedAnomalies((previousKeys) => [...previousKeys, currentStage.anomalyKey]);
    }

    setCurrentInput('');
    setCurrentWordIndex(nextWordIndex);
    setWordStatus('matched');

    if (nextWordIndex >= currentStage.englishWords.length) {
      transitionToNextStage();
    }
  }

  function handleTypingChange(nextValue) {
    if (
      gameMode !== 'typing' ||
      stageTransitioning ||
      allStagesCompleted ||
      !currentStage
    ) {
      return { accepted: false, completed: false, reason: 'typing-locked' };
    }

    if (nextValue === '') {
      setCurrentInput('');
      setWordStatus('idle');
      return { accepted: true, completed: false, reason: 'cleared' };
    }

    setCurrentInput(nextValue);
    const isExactMatch = nextValue === currentTargetWord;
    const isValidPrefix = currentTargetWord.startsWith(nextValue);
    setWordStatus(isExactMatch ? 'ready' : isValidPrefix ? 'typing' : 'blocked');

    if (isExactMatch) {
      return {
        accepted: true,
        completed: false,
        reason: 'word-ready',
      };
    }

    return {
      accepted: true,
      completed: false,
      reason: isValidPrefix ? 'partial-match' : 'case-sensitive-mismatch',
    };
  }

  function handleTypingKeyDown(event) {
    if (event.key === ' ') {
      event.preventDefault();
      if (
        gameMode !== 'typing' ||
        stageTransitioning ||
        allStagesCompleted ||
        !currentStage
      ) {
        return { confirmed: false, reason: 'typing-locked' };
      }

      if (currentInput === currentTargetWord && currentInput !== '') {
        commitCurrentWord();
        return { confirmed: true, reason: 'word-commit' };
      }

      setWordStatus('blocked');
      return { confirmed: false, reason: 'word-incomplete' };
    }

    if (event.key === 'Enter') {
      event.preventDefault();
      return { confirmed: false };
    }

    return { confirmed: false };
  }

  function hardResetToStageOne() {
    transitionLockRef.current = false;
    const nextIndex = getOperationIndexById(operationId);
    setOperationIndex(nextIndex);
    setStageQueue(buildInitialQueue(enigmaOperations[nextIndex].stages, 0));
    setCollectedAnomalies([]);
    setGameMode('typing');
    setStageTransitioning(false);
    setLastTransitionReason('hard-reset');
    setHardResetTriggered((previous) => !previous);
    resetWordProgress();
    resetEndChallenge();
  }

  function validatePassword(inputValue) {
    setPasswordInput(inputValue);

    if (!inputValue) {
      setPasswordStatus('idle');
      setMasterFileUnlocked(false);
      return false;
    }

    if (inputValue === expectedPassword) {
      setPasswordStatus('valid');
      setMasterFileUnlocked(true);
      return true;
    }

    const nextAttemptsLeft = Math.max(0, passwordAttemptsLeft - 1);
    setPasswordStatus('invalid');
    setMasterFileUnlocked(false);
    setPasswordAttemptsLeft(nextAttemptsLeft);

    if (nextAttemptsLeft === 0) {
      hardResetToStageOne();
    }

    return false;
  }

  function validateIpv4(inputValue) {
    setTargetIpInput(inputValue);

    if (!inputValue) {
      setIpStatus('idle');
      return false;
    }

    const ipv4Regex = /^(?:[0-9]{1,3}\.){3}[0-9]{1,3}$/;
    if (!ipv4Regex.test(inputValue)) {
      setIpStatus('invalid-format');
      return false;
    }

    if (inputValue === activeOperation.targetIp) {
      setIpStatus('target-match');
      triggerWinCondition();
      return true;
    }

    setIpStatus('valid-format');
    return false;
  }

  function triggerWinCondition() {
    setWinState(true);
  }

  function resetEngine() {
    transitionLockRef.current = false;
    const nextIndex = getOperationIndexById(operationId);
    setOperationIndex(nextIndex);
    setStageQueue(buildInitialQueue(enigmaOperations[nextIndex].stages, initialStageIndex));
    setCollectedAnomalies([]);
    setGameMode('typing');
    setStageTransitioning(false);
    setLastTransitionReason('idle');
    setHardResetTriggered(false);
    resetWordProgress();
    resetEndChallenge();
  }

  return {
    operationIndex,
    activeOperation,
    stages,
    stageQueue,
    totalStageCount,
    completedStageCount,
    currentStageNumber,
    currentStageIndex,
    currentStage,
    currentWordIndex,
    currentInput,
    completedWords,
    collectedAnomalies,
    currentTargetWord,
    wordStatus,
    gameMode,
    stageTransitioning,
    passwordInput,
    passwordStatus,
    targetIpInput,
    ipStatus,
    masterFileUnlocked,
    winState,
    anomalyPassword,
    expectedPassword,
    allStagesCompleted,
    lastTransitionReason,
    passwordAttemptsLeft,
    hardResetTriggered,
    handleTypingChange,
    handleTypingKeyDown,
    validatePassword,
    validateIpv4,
    triggerWinCondition,
    resetWordProgress,
    timeoutCurrentStage,
    hardResetToStageOne,
    resetEngine,
  };
}
