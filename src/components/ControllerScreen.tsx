import { useState, useEffect, useRef, useCallback } from 'react';
import { useGameSync } from '../hooks/useGameSync';
import { useSyncedTimer } from '../hooks/useSyncedTimer';
import { supabase } from '../lib/supabase';
import { useElapsedTime } from '../hooks/useElapsedTime';
import StatsScreen from './StatsScreen';

const playerColors = ['#e74c3c', '#3498db', '#f39c12', '#2ecc71', '#9b59b6', '#e67e22'];

interface ControllerScreenProps {
  gameCode: string;
  onBack: () => void;
}

export default function ControllerScreen({ gameCode, onBack }: ControllerScreenProps) {
  const { gameState, connected, error, actions } = useGameSync(gameCode);
  const timeLeft = useSyncedTimer(gameState);
  const completionFallbackRef = useRef<number | null>(null);
  const gameElapsed = useElapsedTime(gameState?.game_started_at);

  // Local volume state with debounced sync to DB
  const [localVolume, setLocalVolume] = useState(gameState?.music_volume ?? 40);
  const volumeTimerRef = useRef<number | null>(null);

  // Sync from DB when it changes externally
  useEffect(() => {
    if (gameState?.music_volume != null) {
      setLocalVolume(gameState.music_volume);
    }
  }, [gameState?.music_volume]);

  const handleVolumeChange = useCallback((val: number) => {
    setLocalVolume(val);
    if (volumeTimerRef.current) clearTimeout(volumeTimerRef.current);
    volumeTimerRef.current = window.setTimeout(() => {
      actions.setVolume(val);
    }, 300);
  }, [actions]);

  // Fallback completion detector: if display hasn't written completed after 500ms
  useEffect(() => {
    if (completionFallbackRef.current !== null) {
      clearTimeout(completionFallbackRef.current);
      completionFallbackRef.current = null;
    }

    if (timeLeft <= 0 && gameState?.timer_state === 'running' && supabase) {
      completionFallbackRef.current = window.setTimeout(async () => {
        // Re-check: only write if still running
        if (gameState.timer_state === 'running') {
          await supabase!
            .from('games')
            .update({ timer_state: 'completed', timer_remaining: 0, timer_started_at: null })
            .eq('id', gameState.id)
            .eq('timer_state', 'running'); // Only if still running (display might have already written)
        }
      }, 500);
    }

    return () => {
      if (completionFallbackRef.current !== null) {
        clearTimeout(completionFallbackRef.current);
      }
    };
  }, [timeLeft, gameState?.timer_state, gameState?.id]);

  if (error) {
    return (
      <div className="setup-screen">
        <div className="setup-header">
          <div className="hex-icon">&#x2B22;</div>
          <h1>Game Not Found</h1>
          <h2>Check the code and try again</h2>
        </div>
        <div className="setup-card lobby-card">
          <button className="start-button lobby-btn" onClick={onBack}>
            Back to Lobby
          </button>
        </div>
      </div>
    );
  }

  if (!gameState) {
    return (
      <div className="setup-screen">
        <div className="setup-header">
          <div className="hex-icon">&#x2B22;</div>
          <h1>{connected ? 'Loading...' : 'Connecting...'}</h1>
        </div>
      </div>
    );
  }

  if (gameState.timer_state === 'ended') {
    return <StatsScreen game={gameState} gameCode={gameCode} onBack={onBack} />;
  }

  const currentPlayer = gameState.players[gameState.current_player_index];
  const currentColor = playerColors[gameState.current_player_index % playerColors.length];
  const isCompleted = gameState.timer_state === 'completed' || timeLeft === 0;
  const isIdle = gameState.timer_state === 'idle';
  const isRunning = gameState.timer_state === 'running' && timeLeft > 0;
  const isPaused = gameState.timer_state === 'paused';

  const minutes = Math.floor(timeLeft / 60);
  const seconds = timeLeft % 60;
  const timeDisplay = minutes > 0
    ? `${minutes}:${seconds.toString().padStart(2, '0')}`
    : `${seconds}`;

  const handleStartPause = () => {
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

  return (
    <div className="controller-screen">
      <div className="controller-header">
        <button className="back-button" onClick={onBack}>&#x2190;</button>
        <span className="game-code-badge">{gameCode}</span>
        <div className="controller-header-right">
          {gameElapsed && <span className="game-elapsed">{gameElapsed}</span>}
          <div className={`connection-dot ${connected ? 'connected' : 'disconnected'}`} />
        </div>
      </div>

      <div className="controller-player" style={{ borderColor: currentColor }}>
        <div className="player-color-dot" style={{ backgroundColor: currentColor }} />
        <span>{currentPlayer.name}</span>
      </div>

      <div className="controller-round">Round {gameState.turn_number}</div>

      <div className={`controller-time ${isCompleted ? 'controller-time-up' : ''} ${!isCompleted && timeLeft <= 5 && timeLeft > 0 ? 'controller-time-urgent' : ''} ${!isCompleted && timeLeft <= 10 && timeLeft > 5 ? 'controller-time-warning' : ''}`}>
        {isCompleted ? "TIME'S UP!" : timeDisplay}
      </div>

      <div className="controller-buttons">
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

      <div className="controller-music-section">
        <button
          className={`controller-btn controller-music ${gameState.music_playing ? 'controller-music-active' : ''}`}
          onClick={() => actions.toggleMusic()}
        >
          {gameState.music_playing ? 'Stop Music' : 'Play Music'}
        </button>
        {gameState.music_playing && (
          <div className="volume-row">
            <span className="volume-label">Vol</span>
            <input
              type="range"
              min="0"
              max="100"
              value={localVolume}
              onChange={(e) => handleVolumeChange(Number(e.target.value))}
              className="volume-slider"
            />
            <span className="volume-value">{localVolume}</span>
          </div>
        )}
      </div>

      <button
        className="controller-btn controller-music"
        onClick={() => window.open(`/board?game=${gameCode}`, '_blank')}
      >
        Explore Board
      </button>

      <button
        className="controller-btn controller-end"
        onClick={() => actions.endGame()}
      >
        End Game
      </button>
    </div>
  );
}
