import { useState } from 'react';
import SetupScreen, { type Player } from './components/SetupScreen';
import TimerScreen from './components/TimerScreen';
import CatanBackground from './components/CatanBackground';
import './index.css';

function App() {
  const [gameState, setGameState] = useState<{
    started: boolean;
    players: Player[];
    turnTime: number;
  }>({ started: false, players: [], turnTime: 60 });

  return (
    <>
      <CatanBackground />
      {!gameState.started ? (
        <SetupScreen
          onStart={(players, turnTime) =>
            setGameState({ started: true, players, turnTime })
          }
        />
      ) : (
        <TimerScreen
          players={gameState.players}
          turnTime={gameState.turnTime}
          onBack={() => setGameState({ started: false, players: [], turnTime: 60 })}
        />
      )}
    </>
  );
}

export default App;
