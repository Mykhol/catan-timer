import { useState, useCallback, useEffect } from 'react';
import type { Player } from '../types';
import { useTimer } from '../hooks/useTimer';
import { playWarningTick, playUrgentTick, initAudio } from '../utils/sound';

interface TimerScreenProps {
  players: Player[];
  turnTime: number;
  onBack: () => void;
}

export default function TimerScreen({ players, turnTime, onBack }: TimerScreenProps) {
  const [currentPlayerIndex, setCurrentPlayerIndex] = useState(0);
  const [turnNumber, setTurnNumber] = useState(1);

  const currentPlayer = players[currentPlayerIndex];

  const onTick = useCallback((timeLeft: number) => {
    if (timeLeft <= 5 && timeLeft > 0) {
      playUrgentTick();
    } else if (timeLeft <= 10 && timeLeft > 5) {
      playWarningTick();
    }
  }, []);

  const onComplete = useCallback(() => {
    // Time's up — handled by voice clips in DisplayScreen
  }, []);

  const { timeLeft, isRunning, isPaused, start, pause, resume, reset } = useTimer(
    turnTime,
    onTick,
    onComplete
  );

  useEffect(() => {
    initAudio();
  }, []);

  const handleStartPause = () => {
    if (!isRunning && !isPaused) {
      initAudio();
      start();
    } else if (isRunning && !isPaused) {
      pause();
    } else {
      resume();
    }
  };

  const handleNextPlayer = () => {
    const nextIndex = (currentPlayerIndex + 1) % players.length;
    if (nextIndex === 0) {
      setTurnNumber((t) => t + 1);
    }
    setCurrentPlayerIndex(nextIndex);
    reset(turnTime);
    setTimeout(() => start(), 0);
  };

  const handleResetTurn = () => {
    reset(turnTime);
  };

  const minutes = Math.floor(timeLeft / 60);
  const seconds = timeLeft % 60;
  const timeDisplay = minutes > 0
    ? `${minutes}:${seconds.toString().padStart(2, '0')}`
    : `${seconds}`;

  const timerClass = [
    'timer-display',
    timeLeft <= 5 && timeLeft > 0 ? 'pulse-red' : '',
    timeLeft <= 10 && timeLeft > 5 ? 'pulse-yellow' : '',
    timeLeft === 0 ? 'time-up' : '',
  ].filter(Boolean).join(' ');

  const playerColors = ['#e74c3c', '#3498db', '#f39c12', '#2ecc71', '#9b59b6', '#e67e22'];
  const currentColor = playerColors[currentPlayerIndex % playerColors.length];

  const screenClass = [
    'timer-screen',
    timeLeft <= 5 && timeLeft > 0 ? 'screen-flash-red' : '',
    timeLeft <= 10 && timeLeft > 5 ? 'screen-flash-yellow' : '',
    timeLeft === 0 ? 'screen-flash-up' : '',
  ].filter(Boolean).join(' ');

  return (
    <div className={screenClass}>
      <div className="timer-top-bar">
        <button className="back-button" onClick={onBack}>&#x2190; Setup</button>
        <span className="round-indicator">Round {turnNumber}</span>
      </div>

      <div className="player-banner" style={{ borderColor: currentColor }}>
        <div className="player-color-dot" style={{ backgroundColor: currentColor }} />
        <h2>{currentPlayer.name}'s Turn</h2>
      </div>

      <div className="timer-container">
        <div className={timerClass}>
          <span className="time-value">{timeDisplay}</span>
          {timeLeft === 0 && <span className="time-up-text">TIME'S UP!</span>}
        </div>
      </div>

      <div className="timer-controls">
        <button className="control-btn reset-btn" onClick={handleResetTurn}>
          Reset
        </button>
        <button
          className="control-btn play-btn"
          onClick={handleStartPause}
        >
          {!isRunning && !isPaused ? 'Start' : isPaused ? 'Resume' : 'Pause'}
        </button>
        <button className="control-btn next-btn" onClick={handleNextPlayer}>
          Next &#x2192;
        </button>
      </div>

      <div className="player-queue">
        {players.map((player, index) => (
          <div
            key={player.id}
            className={`queue-player ${index === currentPlayerIndex ? 'active' : ''}`}
            style={{
              borderColor: playerColors[index % playerColors.length],
              opacity: index === currentPlayerIndex ? 1 : 0.5,
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
    </div>
  );
}
