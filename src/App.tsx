import { useState } from 'react';
import type { Player } from './types';
import { createGame } from './lib/supabase';
import SetupScreen from './components/SetupScreen';
import TimerScreen from './components/TimerScreen';
import LobbyScreen from './components/LobbyScreen';
import DisplayScreen from './components/DisplayScreen';
import ControllerScreen from './components/ControllerScreen';
import CatanBoard3D from './components/CatanBoard3D';
import './index.css';

type Screen =
  | { type: 'lobby' }
  | { type: 'local-setup' }
  | { type: 'local-game'; players: Player[]; turnTime: number }
  | { type: 'host-setup' }
  | { type: 'display'; gameCode: string }
  | { type: 'controller'; gameCode: string };

function getInitialScreen(): Screen {
  const params = new URLSearchParams(window.location.search);
  const hostCode = params.get('host');
  const joinCode = params.get('join');
  if (hostCode) {
    return { type: 'display', gameCode: hostCode.toUpperCase() };
  }
  if (joinCode) {
    return { type: 'controller', gameCode: joinCode.toUpperCase() };
  }
  return { type: 'lobby' };
}

function syncUrl(screen: Screen) {
  const url = new URL(window.location.href);
  url.search = '';
  if (screen.type === 'display') {
    url.searchParams.set('host', screen.gameCode);
  } else if (screen.type === 'controller') {
    url.searchParams.set('join', screen.gameCode);
  }
  window.history.replaceState({}, '', url.toString());
}

function App() {
  const [screen, setScreen] = useState<Screen>(getInitialScreen);

  // Standalone board preview at /board — interactive 3D scene
  if (window.location.pathname === '/board') {
    return <CatanBoard3D interactive />;
  }

  const navigate = (next: Screen) => {
    setScreen(next);
    syncUrl(next);
  };

  const handleHostStart = async (players: Player[], turnTime: number) => {
    try {
      const game = await createGame(players, turnTime);
      navigate({ type: 'display', gameCode: game.game_code });
    } catch (err) {
      console.error('Failed to create game:', err);
      alert('Failed to create game. Check your Supabase configuration.');
    }
  };

  return (
    <>
      <CatanBoard3D />
      {screen.type === 'lobby' && (
        <LobbyScreen
          onAction={(action) => {
            switch (action.type) {
              case 'local':
                navigate({ type: 'local-setup' });
                break;
              case 'host':
                navigate({ type: 'host-setup' });
                break;
              case 'join':
                navigate({ type: 'controller', gameCode: action.gameCode });
                break;
            }
          }}
        />
      )}
      {screen.type === 'local-setup' && (
        <SetupScreen
          onStart={(players, turnTime) =>
            navigate({ type: 'local-game', players, turnTime })
          }
        />
      )}
      {screen.type === 'local-game' && (
        <TimerScreen
          players={screen.players}
          turnTime={screen.turnTime}
          onBack={() => navigate({ type: 'lobby' })}
        />
      )}
      {screen.type === 'host-setup' && (
        <SetupScreen
          title="Host Game"
          submitLabel="Create Game"
          onStart={handleHostStart}
        />
      )}
      {screen.type === 'display' && (
        <DisplayScreen
          gameCode={screen.gameCode}
          onBack={() => navigate({ type: 'lobby' })}
        />
      )}
      {screen.type === 'controller' && (
        <ControllerScreen
          gameCode={screen.gameCode}
          onBack={() => navigate({ type: 'lobby' })}
        />
      )}
    </>
  );
}

export default App;
