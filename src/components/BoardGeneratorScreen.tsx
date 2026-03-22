import type { BoardDefinition } from '../lib/boardTypes';
import { ALL_BOARDS, randomStandardBoard } from '../lib/boardLayouts';

interface BoardGeneratorScreenProps {
  currentBoard: BoardDefinition;
  onSelectBoard: (board: BoardDefinition) => void;
  onContinue: () => void;
  onBack: () => void;
}

export default function BoardGeneratorScreen({
  currentBoard,
  onSelectBoard,
  onContinue,
  onBack,
}: BoardGeneratorScreenProps) {
  return (
    <div className="setup-screen">
      <div className="setup-header">
        <div className="hex-icon">&#x2B22;</div>
        <h1>Generate Board</h1>
        <h2>{currentBoard.name}</h2>
      </div>

      <div className="setup-card">
        <div className="setup-field">
          <label>Board Type</label>
          <div className="board-type-picker">
            {ALL_BOARDS.map((board) => (
              <button
                key={board.name}
                className={`board-type-btn ${currentBoard.name === board.name ? 'active' : ''}`}
                onClick={() => onSelectBoard(board)}
              >
                {board.name}
              </button>
            ))}
            <button
              className={`board-type-btn ${currentBoard.name === 'Random Board' ? 'active' : ''}`}
              onClick={() => onSelectBoard(randomStandardBoard())}
            >
              Random
            </button>
          </div>
        </div>

        {currentBoard.name === 'Random Board' && (
          <button
            className="start-button lobby-btn-secondary"
            onClick={() => onSelectBoard(randomStandardBoard())}
          >
            Shuffle Again
          </button>
        )}

        <button className="start-button" onClick={onContinue}>
          Continue to Setup
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
