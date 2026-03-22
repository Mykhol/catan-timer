import { useState, useEffect, useRef, useCallback, type MouseEvent } from 'react';
import { useGameSync } from '../hooks/useGameSync';
import { useSyncedTimer } from '../hooks/useSyncedTimer';
import { supabase } from '../lib/supabase';
import { playWarningTick, playUrgentTick, initAudio } from '../utils/sound';
import { startMusic, stopMusic, setMusicVolume } from '../utils/music';
import { playRandomVoiceClip, playTimesUpClip, stopVoiceClip } from '../utils/voiceClips';
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
  const voicePlayedRef = useRef(false);
  const voiceTriggerRef = useRef(Math.floor(Math.random() * 11) + 15); // 15-25s
  const timesUpPlayedRef = useRef(false);
  const completionWrittenRef = useRef(false);
  const [shareCopied, setShareCopied] = useState(false);
  const gameElapsed = useElapsedTime(gameState?.game_started_at);
  const [menuOpen, setMenuOpen] = useState(false);

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

  // All sound effects + voice clips — single effect on timeLeft
  useEffect(() => {
    const prev = prevTimeLeftRef.current;
    prevTimeLeftRef.current = timeLeft;
    if (prev === null) return;
    if (timeLeft === prev) return;

    if (timeLeft > 0) {
      // Tick sounds
      if (timeLeft <= 5) {
        playUrgentTick();
      } else if (timeLeft <= 10) {
        playWarningTick();
      }

      // Voice clip — play once per turn at a random threshold
      if (!voicePlayedRef.current && timeLeft <= voiceTriggerRef.current && timeLeft > 5) {
        voicePlayedRef.current = true;
        playRandomVoiceClip();
      }
    }

    // Time's up — prev was >0 and now we're at 0
    if (prev > 0 && timeLeft <= 0 && !timesUpPlayedRef.current) {
      timesUpPlayedRef.current = true;
      stopVoiceClip();
      playTimesUpClip();
    }
  }, [timeLeft]);

  // Reset voice clip state when turn changes
  useEffect(() => {
    voicePlayedRef.current = false;
    voiceTriggerRef.current = Math.floor(Math.random() * 11) + 15;
    timesUpPlayedRef.current = false;
    stopVoiceClip();
  }, [gameState?.current_player_index]);

  // Authoritative completion detector — writes to DB
  const writeCompletion = useCallback(async () => {
    if (!supabase || !gameState || completionWrittenRef.current) return;
    if (gameState.timer_state !== 'running') return;
    if (gameState.timer_remaining > 1) return;
    completionWrittenRef.current = true;
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

  // Handle receiving completed state from remote
  useEffect(() => {
    if (gameState?.timer_state === 'completed' && !completionWrittenRef.current) {
      completionWrittenRef.current = true;
      if (!timesUpPlayedRef.current) {
        timesUpPlayedRef.current = true;
        stopVoiceClip();
        playTimesUpClip();
      }
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

  const urgencyLevel = !isCompleted && timeLeft > 0
    ? timeLeft <= 5 ? 'critical'
    : timeLeft <= 10 ? 'urgent'
    : timeLeft <= 20 ? 'warning'
    : timeLeft <= 30 ? 'caution'
    : null
    : null;

  const timerClass = [
    'timer-display',
    urgencyLevel === 'critical' ? 'pulse-red' : '',
    urgencyLevel === 'urgent' ? 'pulse-yellow' : '',
    isCompleted ? 'time-up' : '',
  ].filter(Boolean).join(' ');

  const screenClass = [
    'timer-screen',
    urgencyLevel ? `screen-glow-${urgencyLevel}` : '',
    isCompleted ? 'screen-flash-up' : '',
  ].filter(Boolean).join(' ');

  return (
    <div className={screenClass}>
      <div className="timer-top-bar">
        <div className="top-bar-left">
          <span className="game-code-badge">{gameCode}</span>
        </div>
        <div className="top-bar-right">
          {gameElapsed && <span className="game-elapsed">{gameElapsed}</span>}
          <span className="round-indicator">Round {gameState.turn_number}</span>
          <button className="hamburger-btn" onClick={() => setMenuOpen(!menuOpen)}>
            &#x2630;
          </button>
        </div>
      </div>

      {menuOpen && (
        <div className="game-menu-overlay" onClick={() => setMenuOpen(false)}>
          <div className="game-menu" onClick={(e: MouseEvent) => e.stopPropagation()}>
            <button className="game-menu-item" onClick={handleShare}>
              {shareCopied ? 'Copied!' : 'Share Game'}
            </button>
            <button className="game-menu-item" onClick={() => { actions.toggleMusic(); }}>
              {gameState.music_playing ? 'Stop Music' : 'Play Music'}
            </button>
            {gameState.music_playing && (
              <div className="game-menu-volume">
                <span>Volume</span>
                <input
                  type="range"
                  min="0"
                  max="100"
                  value={gameState.music_volume ?? 30}
                  onChange={(e) => actions.setVolume(Number(e.target.value))}
                  className="volume-slider"
                />
              </div>
            )}
            <button className="game-menu-item" onClick={() => window.open(`/board?game=${gameCode}`, '_blank')}>
              Explore Board
            </button>
            <button className="game-menu-item game-menu-danger" onClick={() => { actions.endGame(); setMenuOpen(false); }}>
              End Game
            </button>
            <button className="game-menu-item" onClick={() => { setMenuOpen(false); onBack(); }}>
              Leave to Lobby
            </button>
          </div>
        </div>
      )}

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
