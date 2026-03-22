import { useState } from 'react';
import { supabase } from '../lib/supabase';

type LobbyAction =
  | { type: 'local' }
  | { type: 'host' }
  | { type: 'join'; gameCode: string }
  | { type: 'generate-board' };

interface LobbyScreenProps {
  onAction: (action: LobbyAction) => void;
}

export default function LobbyScreen({ onAction }: LobbyScreenProps) {
  const [joinCode, setJoinCode] = useState('');
  const [joinError, setJoinError] = useState('');

  const remoteEnabled = !!supabase;

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
          onClick={() => onAction({ type: 'local' })}
        >
          Play Locally
        </button>

        <button
          className="start-button lobby-btn lobby-btn-secondary"
          onClick={() => onAction({ type: 'generate-board' })}
        >
          Generate Board
        </button>

        {remoteEnabled && (
          <>
            <div className="lobby-divider">
              <span>or play remotely</span>
            </div>

            <button
              className="start-button lobby-btn lobby-btn-secondary"
              onClick={() => onAction({ type: 'host' })}
            >
              Host Game
            </button>

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
          </>
        )}
      </div>
    </div>
  );
}
