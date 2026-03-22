import { useState } from 'react';
import type { BoardDefinition } from '../lib/boardTypes';
import { ALL_BOARDS, randomStandardBoard, shuffleBoard } from '../lib/boardLayouts';
import type { RandomBoardOptions } from '../lib/boardLayouts';

interface BoardGeneratorScreenProps {
  currentBoard: BoardDefinition;
  onSelectBoard: (board: BoardDefinition) => void;
  onContinue: () => void;
  onBack: () => void;
}

type Step = 'settings' | 'preview';

export default function BoardGeneratorScreen({
  currentBoard,
  onSelectBoard,
  onContinue,
  onBack,
}: BoardGeneratorScreenProps) {
  const [step, setStep] = useState<Step>('settings');
  const [selectedName, setSelectedName] = useState(currentBoard.name);
  const [fairness, setFairness] = useState({
    noAdjacentSameNumbers: true,
    noAdjacent6And8: true,
    noAdjacent2And12: true,
    maxSameResourceAtVertex: 2 as number | undefined,
  });

  const isRandom = selectedName === 'Random';

  const generateRandom = () => {
    const options: RandomBoardOptions = { fairness };
    onSelectBoard(randomStandardBoard(options));
    setSelectedName('Random');
  };

  const selectPreset = (board: BoardDefinition) => {
    onSelectBoard(board);
    setSelectedName(board.name);
  };

  const toggleFairness = (key: keyof typeof fairness) => {
    const next = { ...fairness, [key]: !fairness[key] };
    if (key === 'maxSameResourceAtVertex') {
      next.maxSameResourceAtVertex = fairness.maxSameResourceAtVertex ? undefined : 2;
    }
    setFairness(next);
  };

  const handleShuffle = () => {
    const options: RandomBoardOptions = { fairness };
    if (isRandom) {
      onSelectBoard(randomStandardBoard(options));
    } else {
      onSelectBoard(shuffleBoard(currentBoard, options));
    }
  };

  const handleNext = () => {
    if (isRandom) generateRandom();
    setStep('preview');
  };

  if (step === 'preview') {
    return (
      <div className="setup-screen board-preview-screen">
        <div className="board-preview-bar">
          <button className="back-button" onClick={() => setStep('settings')}>
            &#x2190; Settings
          </button>
          <span className="board-preview-name">{currentBoard.name}</span>
          <div className="board-preview-actions">
            {(isRandom || currentBoard.variableSetup?.numbers || currentBoard.variableSetup?.resources) && (
              <button className="back-button" onClick={handleShuffle}>
                Shuffle
              </button>
            )}
            <button className="share-button" onClick={onContinue}>
              Continue
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="setup-screen">
      <div className="setup-header">
        <div className="hex-icon">&#x2B22;</div>
        <h1>New Game</h1>
        <h2>Choose your board</h2>
      </div>

      <div className="setup-card">
        <div className="setup-field">
          <label>Board Type</label>
          <div className="board-type-picker">
            {ALL_BOARDS.map((board) => (
              <button
                key={board.name}
                className={`board-type-btn ${selectedName === board.name ? 'active' : ''}`}
                onClick={() => selectPreset(board)}
              >
                {board.name}
              </button>
            ))}
            <button
              className={`board-type-btn ${isRandom ? 'active' : ''}`}
              onClick={() => { setSelectedName('Random'); generateRandom(); }}
            >
              Random
            </button>
          </div>
        </div>

        <div className="setup-field">
          <label>Fairness Rules</label>
          <div className="fairness-toggles">
            <button
              className={`fairness-toggle ${fairness.noAdjacent6And8 ? 'active' : ''}`}
              onClick={() => toggleFairness('noAdjacent6And8')}
            >
              No adjacent 6 &amp; 8
            </button>
            <button
              className={`fairness-toggle ${fairness.noAdjacentSameNumbers ? 'active' : ''}`}
              onClick={() => toggleFairness('noAdjacentSameNumbers')}
            >
              No same numbers touching
            </button>
            <button
              className={`fairness-toggle ${fairness.noAdjacent2And12 ? 'active' : ''}`}
              onClick={() => toggleFairness('noAdjacent2And12')}
            >
              No adjacent 2 &amp; 12
            </button>
            <button
              className={`fairness-toggle ${fairness.maxSameResourceAtVertex ? 'active' : ''}`}
              onClick={() => toggleFairness('maxSameResourceAtVertex')}
            >
              Resource diversity at vertices
            </button>
          </div>
        </div>

        <button className="start-button" onClick={handleNext}>
          Next
        </button>

        <button
          className="start-button lobby-btn-secondary"
          onClick={onBack}
        >
          Back
        </button>
      </div>
    </div>
  );
}
