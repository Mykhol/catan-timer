import { useState, useEffect, useRef, useCallback } from 'react';
import { useGameSync } from '../hooks/useGameSync';
import { useSyncedTimer } from '../hooks/useSyncedTimer';
import { supabase } from '../lib/supabase';
import { playCatanHorn, playWarningTick, playUrgentTick, initAudio } from '../utils/sound';
import { startMusic, stopMusic, setMusicVolume } from '../utils/music';
import { useElapsedTime } from '../hooks/useElapsedTime';
import StatsScreen from './StatsScreen';

const playerColors = ['#e74c3c', '#3498db', '#f39c12', '#2ecc71', '#9b59b6', '#e67e22'];

interface DisplayScreenProps {
  gameCode: string;
  onBack: () => void;
}

export default function DisplayScreen({ gameCode, onBack }: DisplayScreenProps) {
  const { gameState, connected, actions } = useGameSync(gameCode);
  const timeLeft = useSyncedTimer(gameState);
  const prevTimeLeftRef = useRef<number | null>(null);
  const completionWrittenRef = useRef(false);
  const [shareCopied, setShareCopied] = useState(false);
  const gameElapsed = useElapsedTime(gameState?.game_started_at);

  const handleShare = async () => {
    const url = `${window.location.origin}${window.location.pathname}?join=${gameCode}`;
    if (navigator.share) {
      try {
        await navigator.share({ title: 'Join my Catan game', text: `Join my Catan game! Code: ${gameCode}`, url });
        return;
      } catch {
        // User cancelled or share failed — fall through to clipboard
      }
    }
    await navigator.clipboard.writeText(url);
    setShareCopied(true);
    setTimeout(() => setShareCopied(false), 2000);
  };

  useEffect(() => {
    initAudio();
  }, []);

  // Reset completion flag when turn changes
  useEffect(() => {
    if (gameState?.timer_state !== 'completed') {
      completionWrittenRef.current = false;
    }
  }, [gameState?.current_player_index, gameState?.timer_state]);

  // Sound effects based on timeLeft changes
  useEffect(() => {
    const prev = prevTimeLeftRef.current;
    prevTimeLeftRef.current = timeLeft;
    if (prev === null) return;

    if (timeLeft !== prev && timeLeft > 0) {
      if (timeLeft <= 5) {
        playUrgentTick();
      } else if (timeLeft <= 10) {
        playWarningTick();
      }
    }
  }, [timeLeft]);

  // Authoritative completion detector
  const writeCompletion = useCallback(async () => {
    if (!supabase || !gameState || completionWrittenRef.current) return;
    if (gameState.timer_state !== 'running') return;
    // Guard: only complete if the DB timer_remaining is also near 0.
    // This prevents a race where "Next" sets running + fresh timer_remaining
    // but the realtime update arrives before useSyncedTimer recomputes.
    if (gameState.timer_remaining > 1) return;
    completionWrittenRef.current = true;
    playCatanHorn();
    await supabase
      .from('games')
      .update({ timer_state: 'completed', timer_remaining: 0, timer_started_at: null })
      .eq('id', gameState.id);
  }, [gameState]);

  useEffect(() => {
    if (timeLeft <= 0 && gameState?.timer_state === 'running') {
      writeCompletion();
    }
  }, [timeLeft, gameState?.timer_state, writeCompletion]);

  // Play horn when we receive completed state (e.g. from controller fallback)
  useEffect(() => {
    if (gameState?.timer_state === 'completed' && !completionWrittenRef.current) {
      playCatanHorn();
    }
  }, [gameState?.timer_state]);

  // Background music — controlled via remote
  useEffect(() => {
    if (gameState?.music_playing) {
      startMusic();
    } else {
      stopMusic();
    }
  }, [gameState?.music_playing]);

  // Sync volume
  useEffect(() => {
    if (gameState?.music_volume != null) {
      setMusicVolume(gameState.music_volume);
    }
  }, [gameState?.music_volume]);

  // Stop music on unmount
  useEffect(() => {
    return () => stopMusic();
  }, []);

  if (!gameState) {
    return (
      <div className="setup-screen">
        <div className="setup-header">
          <div className="hex-icon">&#x2B22;</div>
          <h1>{connected ? 'Loading game...' : 'Connecting...'}</h1>
        </div>
      </div>
    );
  }

  if (gameState.timer_state === 'ended') {
    return <StatsScreen game={gameState} gameCode={gameCode} onBack={onBack} />;
  }

  const currentPlayer = gameState.players[gameState.current_player_index];
  const currentColor = playerColors[gameState.current_player_index % playerColors.length];

  const minutes = Math.floor(timeLeft / 60);
  const seconds = timeLeft % 60;
  const timeDisplay = minutes > 0
    ? `${minutes}:${seconds.toString().padStart(2, '0')}`
    : `${seconds}`;

  const isCompleted = gameState.timer_state === 'completed' || timeLeft === 0;
  const isIdle = gameState.timer_state === 'idle';
  const isRunning = gameState.timer_state === 'running' && timeLeft > 0;
  const isPaused = gameState.timer_state === 'paused';

  const handleStartPause = () => {
    initAudio();
    if (isIdle || isCompleted) {
      actions.startTimer();
    } else if (isRunning) {
      actions.pauseTimer();
    } else if (isPaused) {
      actions.resumeTimer();
    }
  };

  const getStartPauseLabel = () => {
    if (isIdle || isCompleted) return 'Start';
    if (isRunning) return 'Pause';
    if (isPaused) return 'Resume';
    return 'Start';
  };

  const timerClass = [
    'timer-display',
    !isCompleted && timeLeft <= 5 && timeLeft > 0 ? 'pulse-red' : '',
    !isCompleted && timeLeft <= 10 && timeLeft > 5 ? 'pulse-yellow' : '',
    isCompleted ? 'time-up' : '',
  ].filter(Boolean).join(' ');

  const screenClass = [
    'timer-screen',
    !isCompleted && timeLeft <= 5 && timeLeft > 0 ? 'screen-flash-red' : '',
    !isCompleted && timeLeft <= 10 && timeLeft > 5 ? 'screen-flash-yellow' : '',
    isCompleted ? 'screen-flash-up' : '',
  ].filter(Boolean).join(' ');

  return (
    <div className={screenClass}>
      <div className="timer-top-bar">
        <div className="top-bar-left">
          <button className="back-button" onClick={onBack}>&#x2190; Lobby</button>
          <button className="back-button end-game-btn" onClick={() => actions.endGame()}>End Game</button>
          <button className="back-button" onClick={() => window.open(`/board?game=${gameCode}`, '_blank')}>Board</button>
        </div>
        <div className="game-code-group">
          <span className="game-code-badge">{gameCode}</span>
          <button className="share-button" onClick={handleShare}>
            {shareCopied ? 'Copied!' : 'Share'}
          </button>
          <button
            className={`share-button ${gameState.music_playing ? 'music-active' : ''}`}
            onClick={() => actions.toggleMusic()}
            title={gameState.music_playing ? 'Stop music' : 'Play music'}
          >
            {gameState.music_playing ? '♫' : '♪'}
          </button>
        </div>
        <div className="top-bar-right">
          {gameElapsed && <span className="game-elapsed">{gameElapsed}</span>}
          <span className="round-indicator">Round {gameState.turn_number}</span>
        </div>
      </div>

      <div className="player-banner" style={{ borderColor: currentColor }}>
        <div className="player-color-dot" style={{ backgroundColor: currentColor }} />
        <h2>{currentPlayer.name}'s Turn</h2>
      </div>

      <div className="timer-container">
        <div className={timerClass}>
          <span className="time-value">{timeDisplay}</span>
          {isCompleted && <span className="time-up-text">TIME'S UP!</span>}
        </div>
      </div>

      <div className="controller-buttons display-controls">
        <button
          className="controller-btn controller-reset"
          onClick={() => actions.prevPlayer()}
        >
          &#x2190; Prev
        </button>
        <button
          className="controller-btn controller-reset"
          onClick={() => actions.resetTimer()}
        >
          Reset
        </button>
        <button
          className="controller-btn controller-play"
          onClick={handleStartPause}
        >
          {getStartPauseLabel()}
        </button>
        <button
          className="controller-btn controller-next"
          onClick={() => actions.nextPlayer()}
        >
          Next &#x2192;
        </button>
      </div>

      <div className="display-music-controls">
        <button
          className={`controller-btn controller-music ${gameState.music_playing ? 'controller-music-active' : ''}`}
          onClick={() => actions.toggleMusic()}
        >
          {gameState.music_playing ? 'Stop Music' : 'Music'}
        </button>
        {gameState.music_playing && (
          <input
            type="range"
            min="0"
            max="100"
            value={gameState.music_volume ?? 40}
            onChange={(e) => actions.setVolume(Number(e.target.value))}
            className="volume-slider"
          />
        )}
      </div>

      <div className="player-queue">
        {gameState.players.map((player, index) => (
          <div
            key={player.id}
            className={`queue-player ${index === gameState.current_player_index ? 'active' : ''}`}
            style={{
              borderColor: playerColors[index % playerColors.length],
              opacity: index === gameState.current_player_index ? 1 : 0.5,
            }}
          >
            <div
              className="queue-dot"
              style={{ backgroundColor: playerColors[index % playerColors.length] }}
            />
            <span>{player.name}</span>
          </div>
        ))}
      </div>

      <div className="connection-dot-wrapper">
        <div className={`connection-dot ${connected ? 'connected' : 'disconnected'}`} />
      </div>
    </div>
  );
}
