import { useState } from 'react';
import { useGameSync } from '../hooks/useGameSync';
import { useSyncedTimer } from '../hooks/useSyncedTimer';
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
  const gameElapsed = useElapsedTime(gameState?.game_started_at);
  const [menuOpen, setMenuOpen] = useState(false);

  if (error) {
    return (
      <div className="rc-screen">
        <div className="rc-error">
          <h2>Game Not Found</h2>
          <p>Check the code and try again</p>
          <button className="rc-btn rc-btn-primary" onClick={onBack}>Back</button>
        </div>
      </div>
    );
  }

  if (!gameState) {
    return (
      <div className="rc-screen">
        <div className="rc-loading">{connected ? 'Loading...' : 'Connecting...'}</div>
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
    if (isIdle || isCompleted) actions.startTimer();
    else if (isRunning) actions.pauseTimer();
    else if (isPaused) actions.resumeTimer();
  };

  const getStartPauseLabel = () => {
    if (isIdle || isCompleted) return 'Start';
    if (isRunning) return 'Pause';
    if (isPaused) return 'Resume';
    return 'Start';
  };

  return (
    <div className="rc-screen">
      {/* Compact header */}
      <div className="rc-header">
        <span className="rc-code">{gameCode}</span>
        <div className={`connection-dot ${connected ? 'connected' : 'disconnected'}`} />
        <button className="rc-menu-btn" onClick={() => setMenuOpen(!menuOpen)}>&#x2630;</button>
      </div>

      {/* Menu overlay */}
      {menuOpen && (
        <div className="rc-menu-overlay" onClick={() => setMenuOpen(false)}>
          <div className="rc-menu" onClick={(e) => e.stopPropagation()}>
            <button className="rc-menu-item" onClick={() => { actions.toggleMusic(); }}>
              {gameState.music_playing ? 'Stop Music' : 'Play Music'}
            </button>
            <button className="rc-menu-item" onClick={() => window.open(`/board?game=${gameCode}`, '_blank')}>
              Explore Board
            </button>
            <button className="rc-menu-item rc-menu-danger" onClick={() => { actions.endGame(); setMenuOpen(false); }}>
              End Game
            </button>
            <button className="rc-menu-item" onClick={() => { setMenuOpen(false); onBack(); }}>
              Leave
            </button>
          </div>
        </div>
      )}

      {/* Player + timer */}
      <div className="rc-player" style={{ borderColor: currentColor }}>
        <div className="rc-player-dot" style={{ backgroundColor: currentColor }} />
        <span className="rc-player-name">{currentPlayer.name}</span>
      </div>

      <div className={`rc-timer ${isCompleted ? 'rc-timer-up' : ''} ${!isCompleted && timeLeft <= 10 && timeLeft > 0 ? 'rc-timer-warn' : ''}`}>
        {isCompleted ? "TIME'S UP" : timeDisplay}
      </div>

      <div className="rc-info">
        <span>Round {gameState.turn_number}</span>
        {gameElapsed && <span>{gameElapsed}</span>}
      </div>

      {/* Big action buttons */}
      <div className="rc-actions">
        <button className="rc-btn rc-btn-secondary" onClick={() => actions.prevPlayer()}>
          &#x2190; Prev
        </button>
        <button className="rc-btn rc-btn-primary rc-btn-big" onClick={handleStartPause}>
          {getStartPauseLabel()}
        </button>
        <button className="rc-btn rc-btn-next" onClick={() => actions.nextPlayer()}>
          Next &#x2192;
        </button>
      </div>

      <button className="rc-btn rc-btn-reset" onClick={() => actions.resetTimer()}>
        Reset Timer
      </button>
    </div>
  );
}
