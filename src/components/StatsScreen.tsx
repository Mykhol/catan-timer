import { useEffect, useState } from 'react';
import { fetchGameByCode } from '../lib/supabase';
import type { GameRow, TurnLogEntry } from '../types';

const playerColors = ['#e74c3c', '#3498db', '#f39c12', '#2ecc71', '#9b59b6', '#e67e22'];

interface StatsScreenProps {
  gameCode?: string;
  game?: GameRow;
  onBack: () => void;
}

interface PlayerStats {
  name: string;
  color: string;
  turns: number;
  min: number;
  max: number;
  avg: number;
  total: number;
}

function computeStats(game: GameRow): PlayerStats[] {
  const log = game.turn_log || [];
  const byPlayer = new Map<number, number[]>();

  game.players.forEach((_, i) => byPlayer.set(i, []));
  log.forEach((entry: TurnLogEntry) => {
    const arr = byPlayer.get(entry.player_index);
    if (arr) arr.push(entry.duration);
  });

  return game.players.map((player, i) => {
    const durations = byPlayer.get(i) || [];
    if (durations.length === 0) {
      return {
        name: player.name,
        color: playerColors[i % playerColors.length],
        turns: 0,
        min: 0,
        max: 0,
        avg: 0,
        total: 0,
      };
    }
    const total = durations.reduce((a, b) => a + b, 0);
    return {
      name: player.name,
      color: playerColors[i % playerColors.length],
      turns: durations.length,
      min: Math.min(...durations),
      max: Math.max(...durations),
      avg: Math.round(total / durations.length),
      total,
    };
  });
}

function formatTime(seconds: number): string {
  if (seconds >= 60) {
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${m}:${s.toString().padStart(2, '0')}`;
  }
  return `${seconds}s`;
}

function formatDuration(seconds: number): string {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = seconds % 60;
  if (h > 0) return `${h}h ${m}m`;
  if (m > 0) return `${m}m ${s}s`;
  return `${s}s`;
}

function getGameDuration(game: GameRow): number {
  if (!game.game_started_at) return 0;
  const start = new Date(game.game_started_at).getTime();
  const end = game.game_ended_at
    ? new Date(game.game_ended_at).getTime()
    : Date.now();
  return Math.floor((end - start) / 1000);
}

function buildStatsText(game: GameRow, stats: PlayerStats[], gameDuration: number): string {
  const lines: string[] = [];
  lines.push(`Catan Game - ${game.game_code}`);
  lines.push(`Rounds: ${game.turn_number} | Turns: ${stats.reduce((a, s) => a + s.turns, 0)} | Duration: ${formatDuration(gameDuration)}`);
  lines.push('');
  stats.forEach((s) => {
    if (s.turns > 0) {
      lines.push(`${s.name}: ${s.turns} turns | Avg: ${formatTime(s.avg)} | Min: ${formatTime(s.min)} | Max: ${formatTime(s.max)} | Total: ${formatDuration(s.total)}`);
    } else {
      lines.push(`${s.name}: 0 turns`);
    }
  });
  return lines.join('\n');
}

function StatsView({ game, gameCode, onBack }: { game: GameRow; gameCode: string; onBack: () => void }) {
  const [copied, setCopied] = useState(false);
  const stats = computeStats(game);
  const totalTurns = stats.reduce((a, s) => a + s.turns, 0);
  const gameDuration = getGameDuration(game);
  const maxAvg = Math.max(...stats.map((s) => s.avg), 1);

  const handleCopyStats = async () => {
    const text = buildStatsText(game, stats, gameDuration);
    await navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleShareStats = async () => {
    const text = buildStatsText(game, stats, gameDuration);
    if (navigator.share) {
      try {
        await navigator.share({ title: `Catan Game - ${gameCode}`, text });
        return;
      } catch {
        // Fall through to clipboard
      }
    }
    handleCopyStats();
  };

  return (
    <div className="setup-screen">
      <div className="setup-header">
        <div className="hex-icon">&#x2B22;</div>
        <h1>Game Over</h1>
        <h2>{gameCode}</h2>
      </div>

      <div className="setup-card stats-card">
        <div className="stats-summary">
          <div className="stats-summary-item">
            <span className="stats-label">Rounds</span>
            <span className="stats-value">{game.turn_number}</span>
          </div>
          <div className="stats-summary-item">
            <span className="stats-label">Turns</span>
            <span className="stats-value">{totalTurns}</span>
          </div>
          <div className="stats-summary-item">
            <span className="stats-label">Duration</span>
            <span className="stats-value">{formatDuration(gameDuration)}</span>
          </div>
        </div>

        <div className="stats-divider">
          <span>Player Stats</span>
        </div>

        <div className="stats-players">
          {stats.map((s) => (
            <div key={s.name} className="stats-player">
              <div className="stats-player-header">
                <div className="stats-player-dot" style={{ backgroundColor: s.color }} />
                <span className="stats-player-name">{s.name}</span>
                <span className="stats-player-turns">{s.turns} turns</span>
              </div>

              {s.turns > 0 && (
                <>
                  <div className="stats-bar-row">
                    <div
                      className="stats-bar"
                      style={{
                        width: `${(s.avg / maxAvg) * 100}%`,
                        backgroundColor: s.color,
                      }}
                    />
                    <span className="stats-bar-label">avg {formatTime(s.avg)}</span>
                  </div>

                  <div className="stats-detail-row">
                    <span>Min: {formatTime(s.min)}</span>
                    <span>Max: {formatTime(s.max)}</span>
                    <span>Total: {formatDuration(s.total)}</span>
                  </div>
                </>
              )}
            </div>
          ))}
        </div>

        <div className="stats-actions">
          <button className="start-button" onClick={handleShareStats}>
            {copied ? 'Copied!' : 'Share Stats'}
          </button>
          <button className="start-button lobby-btn-secondary" onClick={onBack}>
            Back to Lobby
          </button>
        </div>
      </div>
    </div>
  );
}

export default function StatsScreen({ gameCode, game: gameProp, onBack }: StatsScreenProps) {
  const [fetchedGame, setFetchedGame] = useState<GameRow | null>(null);
  const [error, setError] = useState(false);

  useEffect(() => {
    if (gameProp || !gameCode) return;
    fetchGameByCode(gameCode).then((g) => {
      if (g) setFetchedGame(g);
      else setError(true);
    });
  }, [gameCode, gameProp]);

  const game = gameProp || fetchedGame;
  const code = gameCode || game?.game_code || '';

  if (error) {
    return (
      <div className="setup-screen">
        <div className="setup-header">
          <div className="hex-icon">&#x2B22;</div>
          <h1>Game Not Found</h1>
        </div>
        <div className="setup-card lobby-card">
          <button className="start-button lobby-btn" onClick={onBack}>Back to Lobby</button>
        </div>
      </div>
    );
  }

  if (!game) {
    return (
      <div className="setup-screen">
        <div className="setup-header">
          <div className="hex-icon">&#x2B22;</div>
          <h1>Loading Stats...</h1>
        </div>
      </div>
    );
  }

  return <StatsView game={game} gameCode={code} onBack={onBack} />;
}
