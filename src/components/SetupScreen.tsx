import { useState } from 'react';
import type { Player } from '../types';

interface SetupScreenProps {
  onStart: (players: Player[], turnTime: number) => void | Promise<void>;
  title?: string;
  submitLabel?: string;
}

export default function SetupScreen({ onStart, title, submitLabel }: SetupScreenProps) {
  const [creating, setCreating] = useState(false);
  const [numPlayers, setNumPlayers] = useState(4);
  const [turnTime, setTurnTime] = useState(60);
  const [players, setPlayers] = useState<Player[]>(
    Array.from({ length: 4 }, (_, i) => ({ id: i, name: `Player ${i + 1}` }))
  );

  const handleNumPlayersChange = (n: number) => {
    const clamped = Math.max(2, Math.min(6, n));
    setNumPlayers(clamped);
    setPlayers((prev) => {
      if (clamped > prev.length) {
        return [
          ...prev,
          ...Array.from({ length: clamped - prev.length }, (_, i) => ({
            id: prev.length + i,
            name: `Player ${prev.length + i + 1}`,
          })),
        ];
      }
      return prev.slice(0, clamped);
    });
  };

  const handleNameChange = (index: number, name: string) => {
    setPlayers((prev) =>
      prev.map((p, i) => (i === index ? { ...p, name } : p))
    );
  };

  const movePlayer = (index: number, direction: -1 | 1) => {
    const newIndex = index + direction;
    if (newIndex < 0 || newIndex >= players.length) return;
    setPlayers((prev) => {
      const next = [...prev];
      [next[index], next[newIndex]] = [next[newIndex], next[index]];
      return next;
    });
  };

  const canStart = players.every((p) => p.name.trim().length > 0);

  return (
    <div className="setup-screen">
      <div className="setup-header">
        <div className="hex-icon">&#x2B22;</div>
        <h1>Settlers of Catan</h1>
        <h2>{title || 'Turn Timer'}</h2>
      </div>

      <div className="setup-card">
        <div className="setup-field">
          <label>Turn Time (seconds)</label>
          <div className="stepper">
            <button onClick={() => setTurnTime((t) => Math.max(10, t - 10))}>-</button>
            <input
              type="number"
              value={turnTime}
              onChange={(e) => setTurnTime(Math.max(5, parseInt(e.target.value) || 5))}
              min={5}
            />
            <button onClick={() => setTurnTime((t) => t + 10)}>+</button>
          </div>
        </div>

        <div className="setup-field">
          <label>Number of Players</label>
          <div className="stepper">
            <button onClick={() => handleNumPlayersChange(numPlayers - 1)}>-</button>
            <span className="stepper-value">{numPlayers}</span>
            <button onClick={() => handleNumPlayersChange(numPlayers + 1)}>+</button>
          </div>
        </div>

        <div className="setup-field">
          <label>Player Names &amp; Order</label>
          <div className="player-list">
            {players.map((player, index) => (
              <div key={player.id} className="player-row">
                <span className="player-order">{index + 1}</span>
                <input
                  type="text"
                  value={player.name}
                  onChange={(e) => handleNameChange(index, e.target.value)}
                  placeholder={`Player ${index + 1}`}
                />
                <div className="order-buttons">
                  <button
                    onClick={() => movePlayer(index, -1)}
                    disabled={index === 0}
                    title="Move up"
                  >
                    &#9650;
                  </button>
                  <button
                    onClick={() => movePlayer(index, 1)}
                    disabled={index === players.length - 1}
                    title="Move down"
                  >
                    &#9660;
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>

        <button
          className="start-button"
          onClick={async () => {
            setCreating(true);
            try {
              await onStart(players, turnTime);
            } catch {
              setCreating(false);
            }
          }}
          disabled={!canStart || creating}
        >
          {creating ? 'Creating...' : (submitLabel || 'Start Game')}
        </button>
      </div>
    </div>
  );
}
