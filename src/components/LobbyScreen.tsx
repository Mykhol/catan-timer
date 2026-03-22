import { useState } from 'react';

type LobbyAction =
  | { type: 'new-game' }
  | { type: 'join'; gameCode: string };

interface LobbyScreenProps {
  onAction: (action: LobbyAction) => void;
}

export default function LobbyScreen({ onAction }: LobbyScreenProps) {
  const [joinCode, setJoinCode] = useState('');
  const [joinError, setJoinError] = useState('');

  const handleJoin = () => {
    const code = joinCode.trim().toUpperCase();
    if (!code) {
      setJoinError('Enter a game code');
      return;
    }
    setJoinError('');
    onAction({ type: 'join', gameCode: code });
  };

  return (
    <div className="setup-screen">
      <div className="setup-header">
        <div className="hex-icon">&#x2B22;</div>
        <h1>Settlers of Catan</h1>
        <h2>Turn Timer</h2>
      </div>

      <div className="setup-card lobby-card">
        <button
          className="start-button lobby-btn"
          onClick={() => onAction({ type: 'new-game' })}
        >
          New Game
        </button>

        <div className="lobby-divider">
          <span>or join a game</span>
        </div>

        <div className="lobby-join">
          <input
            type="text"
            placeholder="CATAN-XXXX"
            value={joinCode}
            onChange={(e) => {
              setJoinCode(e.target.value.toUpperCase());
              setJoinError('');
            }}
            onKeyDown={(e) => e.key === 'Enter' && handleJoin()}
            className="lobby-join-input"
            maxLength={10}
          />
          <button className="start-button lobby-btn lobby-btn-join" onClick={handleJoin}>
            Join Game
          </button>
        </div>
        {joinError && <p className="lobby-error">{joinError}</p>}
      </div>
    </div>
  );
}
