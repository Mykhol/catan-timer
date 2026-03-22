import type { BoardDefinition, BoardTile } from './boardTypes';

// ─── Helpers ────────────────────────────────────────────────────

const DIRS: [number, number][] = [
  [1, 0], [0, 1], [-1, 1], [-1, 0], [0, -1], [1, -1],
];

/** Generate all axial hex positions for rings 0 through n */
function getHexRingPositions(maxRing: number): [number, number][] {
  const positions: [number, number][] = [[0, 0]];
  for (let ring = 1; ring <= maxRing; ring++) {
    let q = ring, r = 0;
    for (let side = 0; side < 6; side++) {
      for (let step = 0; step < ring; step++) {
        positions.push([q, r]);
        q += DIRS[(side + 2) % 6][0];
        r += DIRS[(side + 2) % 6][1];
      }
    }
  }
  return positions;
}

/** Get all 6 axial neighbors of a hex */
function getNeighbors(q: number, r: number): [number, number][] {
  return DIRS.map(([dq, dr]) => [q + dq, r + dr] as [number, number]);
}

/** Shuffle an array in-place (Fisher-Yates) */
function shuffle<T>(arr: T[]): T[] {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

// ─── Fairness validation ────────────────────────────────────────

interface FairnessOptions {
  noAdjacentSameNumbers?: boolean;
  noAdjacent6And8?: boolean;
  noAdjacent2And12?: boolean;
  maxSameResourceAtVertex?: number;
}

const DEFAULT_FAIRNESS: FairnessOptions = {
  noAdjacentSameNumbers: true,
  noAdjacent6And8: true,
  noAdjacent2And12: true,
  maxSameResourceAtVertex: 2,
};

/** Check if a board layout passes fairness rules */
function isFairBoard(tiles: BoardTile[], options: FairnessOptions = DEFAULT_FAIRNESS): boolean {
  const tileMap = new Map<string, BoardTile>();
  tiles.forEach(t => tileMap.set(`${t.q},${t.r}`, t));

  for (const tile of tiles) {
    if (!tile.number) continue;
    const neighbors = getNeighbors(tile.q, tile.r);

    for (const [nq, nr] of neighbors) {
      const neighbor = tileMap.get(`${nq},${nr}`);
      if (!neighbor || !neighbor.number) continue;

      // No adjacent same numbers
      if (options.noAdjacentSameNumbers && tile.number === neighbor.number) return false;

      // No adjacent 6 and 8
      if (options.noAdjacent6And8) {
        const pair = [tile.number, neighbor.number].sort();
        if (pair[0] === 6 && pair[1] === 8) return false;
      }

      // No adjacent 2 and 12
      if (options.noAdjacent2And12) {
        const pair = [tile.number, neighbor.number].sort();
        if (pair[0] === 2 && pair[1] === 12) return false;
      }
    }
  }

  // Check vertex resource diversity
  if (options.maxSameResourceAtVertex) {
    for (const tile of tiles) {
      if (tile.type === 'desert' || tile.type === 'water') continue;
      const neighbors = getNeighbors(tile.q, tile.r);
      for (const [nq, nr] of neighbors) {
        const n1 = tileMap.get(`${nq},${nr}`);
        // Check shared vertex — each pair of adjacent tiles shares 2 vertices
        // with a third tile. Check all triplets.
        const nextNeighbors = getNeighbors(nq, nr);
        for (const [nnq, nnr] of nextNeighbors) {
          const n2 = tileMap.get(`${nnq},${nnr}`);
          if (!n1 || !n2) continue;
          // Check if all three are the same resource
          const types = [tile.type, n1.type, n2.type].filter(t => t !== 'desert' && t !== 'water');
          if (types.length === 3 && types[0] === types[1] && types[1] === types[2]) {
            return false;
          }
        }
      }
    }
  }

  return true;
}

// ─── Standard 3-4 player board ──────────────────────────────────

const STANDARD_NUMBERS = [5, 2, 6, 3, 8, 10, 9, 12, 11, 4, 8, 10, 9, 4, 5, 6, 3, 11];

const STANDARD_TILES: BoardTile[] = [
  { q: 0, r: 0, type: 'desert' },
  { q: 1, r: 0, type: 'wheat', number: STANDARD_NUMBERS[0] },
  { q: 0, r: 1, type: 'forest', number: STANDARD_NUMBERS[1] },
  { q: -1, r: 1, type: 'sheep', number: STANDARD_NUMBERS[2] },
  { q: -1, r: 0, type: 'brick', number: STANDARD_NUMBERS[3] },
  { q: 0, r: -1, type: 'ore', number: STANDARD_NUMBERS[4] },
  { q: 1, r: -1, type: 'wheat', number: STANDARD_NUMBERS[5] },
  { q: 2, r: 0, type: 'forest', number: STANDARD_NUMBERS[6] },
  { q: 1, r: 1, type: 'sheep', number: STANDARD_NUMBERS[7] },
  { q: 0, r: 2, type: 'brick', number: STANDARD_NUMBERS[8] },
  { q: -1, r: 2, type: 'wheat', number: STANDARD_NUMBERS[9] },
  { q: -2, r: 2, type: 'ore', number: STANDARD_NUMBERS[10] },
  { q: -2, r: 1, type: 'forest', number: STANDARD_NUMBERS[11] },
  { q: -2, r: 0, type: 'sheep', number: STANDARD_NUMBERS[12] },
  { q: -1, r: -1, type: 'wheat', number: STANDARD_NUMBERS[13] },
  { q: 0, r: -2, type: 'brick', number: STANDARD_NUMBERS[14] },
  { q: 1, r: -2, type: 'forest', number: STANDARD_NUMBERS[15] },
  { q: 2, r: -2, type: 'ore', number: STANDARD_NUMBERS[16] },
  { q: 2, r: -1, type: 'sheep', number: STANDARD_NUMBERS[17] },
];

export const STANDARD_BOARD: BoardDefinition = {
  name: 'Standard (3-4)',
  tiles: STANDARD_TILES,
  waterRings: 3,
  variableSetup: { resources: true, numbers: true },
};

// ─── 5-6 player expansion ───────────────────────────────────────

function buildExpansionTiles(): BoardTile[] {
  const types: BoardTile['type'][] = [
    'desert',
    'wheat', 'forest', 'sheep', 'brick', 'ore', 'wheat',
    'forest', 'sheep', 'brick', 'wheat', 'ore', 'forest',
    'sheep', 'wheat', 'brick', 'forest', 'ore', 'sheep',
    'wheat', 'brick', 'ore', 'forest', 'sheep', 'wheat',
    'desert', 'brick', 'forest', 'ore', 'sheep',
  ];
  const numbers = [2, 5, 4, 6, 3, 9, 8, 11, 11, 10, 6, 3, 8, 4, 8, 10, 11, 12, 3, 4, 5, 9, 5, 9, 12, 10, 6, 2];
  const positions = getHexRingPositions(3);
  let numIdx = 0;

  return positions.map((pos, i) => {
    const type = types[i] || 'desert';
    const tile: BoardTile = { q: pos[0], r: pos[1], type };
    if (type !== 'desert' && numIdx < numbers.length) {
      tile.number = numbers[numIdx++];
    }
    return tile;
  });
}

export const EXPANSION_BOARD: BoardDefinition = {
  name: 'Expansion (5-6)',
  tiles: buildExpansionTiles(),
  waterRings: 4,
  variableSetup: { resources: true, numbers: true },
};

// ─── Seafarers scenarios ────────────────────────────────────────

export const SEAFARERS_FOUR_ISLANDS: BoardDefinition = {
  name: 'Four Islands',
  tiles: [
    { q: -3, r: 0, type: 'wheat', number: 5 },
    { q: -3, r: 1, type: 'forest', number: 9 },
    { q: -2, r: 0, type: 'sheep', number: 4 },
    { q: 2, r: -3, type: 'brick', number: 8 },
    { q: 3, r: -3, type: 'ore', number: 6 },
    { q: 2, r: -2, type: 'wheat', number: 10 },
    { q: -2, r: 3, type: 'ore', number: 3 },
    { q: -3, r: 3, type: 'brick', number: 11 },
    { q: -2, r: 2, type: 'forest', number: 5 },
    { q: 2, r: 1, type: 'sheep', number: 9 },
    { q: 3, r: 0, type: 'wheat', number: 6 },
    { q: 3, r: 1, type: 'forest', number: 8 },
    // Water between the four islands
    { q: 0, r: 0, type: 'water' }, { q: 1, r: 0, type: 'water' },
    { q: 0, r: 1, type: 'water' }, { q: -1, r: 1, type: 'water' },
    { q: 1, r: -1, type: 'water' }, { q: -1, r: 0, type: 'water' },
    { q: 0, r: -1, type: 'water' }, { q: 1, r: 1, type: 'water' },
    { q: -1, r: 2, type: 'water' }, { q: 0, r: 2, type: 'water' },
    { q: 1, r: -2, type: 'water' }, { q: -2, r: 1, type: 'water' },
    { q: 2, r: -1, type: 'water' }, { q: -1, r: -1, type: 'water' },
    { q: 2, r: 0, type: 'water' }, { q: 0, r: -2, type: 'water' },
  ],
  waterRings: 5,
  // Fixed layout recommended
};

export const SEAFARERS_NEW_SHORES: BoardDefinition = {
  name: 'New Shores',
  tiles: [
    // Main island (standard layout center)
    { q: 0, r: 0, type: 'wheat', number: 9 },
    { q: 1, r: 0, type: 'forest', number: 4 },
    { q: 0, r: 1, type: 'sheep', number: 5 },
    { q: -1, r: 1, type: 'brick', number: 6 },
    { q: -1, r: 0, type: 'ore', number: 10 },
    { q: 0, r: -1, type: 'wheat', number: 3 },
    { q: 1, r: -1, type: 'forest', number: 11 },
    // Outer ring partial — some land, some water
    { q: 2, r: 0, type: 'sheep', number: 8 },
    { q: 1, r: 1, type: 'water' },
    { q: 0, r: 2, type: 'water' },
    { q: -1, r: 2, type: 'water' },
    { q: -2, r: 2, type: 'water' },
    { q: -2, r: 1, type: 'brick', number: 4 },
    { q: -2, r: 0, type: 'water' },
    { q: -1, r: -1, type: 'water' },
    { q: 0, r: -2, type: 'water' },
    { q: 1, r: -2, type: 'water' },
    { q: 2, r: -2, type: 'water' },
    { q: 2, r: -1, type: 'ore', number: 8 },
    // Small islands
    { q: 3, r: -1, type: 'wheat', number: 6 },
    { q: -3, r: 2, type: 'forest', number: 5 },
    { q: 0, r: 3, type: 'gold', number: 10 },
    { q: 3, r: -3, type: 'sheep', number: 9 },
    { q: -3, r: 0, type: 'brick', number: 3 },
  ],
  waterRings: 5,
  variableSetup: { resources: true, numbers: true },
};

export const SEAFARERS_FOG_ISLANDS: BoardDefinition = {
  name: 'Fog Islands',
  tiles: [
    // Known main island
    { q: 0, r: 0, type: 'wheat', number: 9 },
    { q: 1, r: 0, type: 'forest', number: 4 },
    { q: 0, r: 1, type: 'sheep', number: 5 },
    { q: -1, r: 1, type: 'brick', number: 8 },
    { q: -1, r: 0, type: 'ore', number: 10 },
    { q: 0, r: -1, type: 'wheat', number: 3 },
    { q: 1, r: -1, type: 'forest', number: 11 },
    // Fog tiles — unknown until explored
    { q: 2, r: 0, type: 'fog' },
    { q: 2, r: -1, type: 'fog' },
    { q: 2, r: -2, type: 'fog' },
    { q: -2, r: 1, type: 'fog' },
    { q: -2, r: 2, type: 'fog' },
    { q: -2, r: 0, type: 'fog' },
    { q: 0, r: 2, type: 'fog' },
    { q: 1, r: 1, type: 'fog' },
    { q: -1, r: 2, type: 'fog' },
    { q: 0, r: -2, type: 'fog' },
    { q: 1, r: -2, type: 'fog' },
    { q: -1, r: -1, type: 'fog' },
    // Water
    { q: 3, r: -3, type: 'water' }, { q: 3, r: -2, type: 'water' },
    { q: 3, r: -1, type: 'water' }, { q: 3, r: 0, type: 'water' },
    { q: -3, r: 0, type: 'water' }, { q: -3, r: 1, type: 'water' },
    { q: -3, r: 2, type: 'water' }, { q: -3, r: 3, type: 'water' },
  ],
  waterRings: 4,
  variableSetup: { numbers: true },
};

export const SEAFARERS_THROUGH_DESERT: BoardDefinition = {
  name: 'Through the Desert',
  tiles: [
    // Western coast
    { q: -3, r: 0, type: 'wheat', number: 4 },
    { q: -3, r: 1, type: 'forest', number: 6 },
    { q: -3, r: 2, type: 'sheep', number: 9 },
    { q: -2, r: 0, type: 'brick', number: 5 },
    { q: -2, r: 1, type: 'ore', number: 10 },
    { q: -2, r: 2, type: 'wheat', number: 3 },
    // Desert strip through the middle
    { q: -1, r: 0, type: 'desert' },
    { q: -1, r: 1, type: 'desert' },
    { q: 0, r: 0, type: 'desert' },
    { q: 0, r: 1, type: 'desert' },
    { q: 1, r: -1, type: 'desert' },
    { q: 1, r: 0, type: 'desert' },
    // Eastern coast
    { q: 2, r: -2, type: 'forest', number: 8 },
    { q: 2, r: -1, type: 'sheep', number: 11 },
    { q: 2, r: 0, type: 'brick', number: 6 },
    { q: 3, r: -3, type: 'ore', number: 5 },
    { q: 3, r: -2, type: 'wheat', number: 8 },
    { q: 3, r: -1, type: 'forest', number: 9 },
    // Water
    { q: -1, r: -1, type: 'water' }, { q: 0, r: -1, type: 'water' },
    { q: 0, r: -2, type: 'water' }, { q: 1, r: -2, type: 'water' },
    { q: -1, r: 2, type: 'water' }, { q: 0, r: 2, type: 'water' },
    { q: 1, r: 1, type: 'water' }, { q: 2, r: 1, type: 'water' },
  ],
  waterRings: 5,
  // Fixed layout — balanced only with given setup
};

// ─── Fair random board generator ────────────────────────────────

export interface RandomBoardOptions {
  fairness?: FairnessOptions;
  maxAttempts?: number;
}

/** Generate a random standard board that passes fairness checks */
export function randomStandardBoard(options: RandomBoardOptions = {}): BoardDefinition {
  const fairness = options.fairness ?? DEFAULT_FAIRNESS;
  const maxAttempts = options.maxAttempts ?? 200;

  const resourcePool: BoardTile['type'][] = [
    'wheat', 'wheat', 'wheat', 'wheat',
    'forest', 'forest', 'forest', 'forest',
    'sheep', 'sheep', 'sheep', 'sheep',
    'brick', 'brick', 'brick',
    'ore', 'ore', 'ore',
  ];
  const numberPool = [2, 3, 3, 4, 4, 5, 5, 6, 6, 8, 8, 9, 9, 10, 10, 11, 11, 12];
  const positions = getHexRingPositions(2);

  // Desert at random position
  const desertIdx = Math.floor(Math.random() * positions.length);

  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    const resources = shuffle([...resourcePool]);
    const numbers = shuffle([...numberPool]);

    const tiles: BoardTile[] = [];
    let numIdx = 0;

    for (let i = 0; i < positions.length; i++) {
      if (i === desertIdx) {
        tiles.push({ q: positions[i][0], r: positions[i][1], type: 'desert' });
      } else {
        const resIdx = i > desertIdx ? i - 1 : i;
        tiles.push({
          q: positions[i][0],
          r: positions[i][1],
          type: resources[resIdx],
          number: numbers[numIdx++],
        });
      }
    }

    if (isFairBoard(tiles, fairness)) {
      return { name: 'Random Board', tiles, waterRings: 3 };
    }
  }

  // Fallback — return last attempt even if not perfectly fair
  const resources = shuffle([...resourcePool]);
  const numbers = shuffle([...numberPool]);
  const tiles: BoardTile[] = [];
  let numIdx = 0;
  for (let i = 0; i < positions.length; i++) {
    if (i === desertIdx) {
      tiles.push({ q: positions[i][0], r: positions[i][1], type: 'desert' });
    } else {
      const resIdx = i > desertIdx ? i - 1 : i;
      tiles.push({
        q: positions[i][0],
        r: positions[i][1],
        type: resources[resIdx],
        number: numbers[numIdx++],
      });
    }
  }
  return { name: 'Random Board', tiles, waterRings: 3 };
}

// ─── All boards ─────────────────────────────────────────────────

/** Shuffle the number tokens on any board while keeping tile types + positions fixed.
 *  Retries up to maxAttempts to satisfy fairness rules. */
export function shuffleBoard(board: BoardDefinition, options: RandomBoardOptions = {}): BoardDefinition {
  const fairness = options.fairness ?? DEFAULT_FAIRNESS;
  const maxAttempts = options.maxAttempts ?? 200;
  const canShuffleResources = board.variableSetup?.resources ?? false;
  const canShuffleNumbers = board.variableSetup?.numbers ?? false;

  // Collect shuffleable resource types (non-desert/water/fog)
  const resourceIndices: number[] = [];
  const resources: BoardTile['type'][] = [];
  // Collect number tokens
  const numberedIndices: number[] = [];
  const numbers: number[] = [];

  board.tiles.forEach((tile, i) => {
    if (canShuffleResources && tile.type !== 'desert' && tile.type !== 'water' && tile.type !== 'fog') {
      resourceIndices.push(i);
      resources.push(tile.type);
    }
    if (canShuffleNumbers && tile.number != null) {
      numberedIndices.push(i);
      numbers.push(tile.number);
    }
  });

  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    const shuffledResources = canShuffleResources ? shuffle([...resources]) : resources;
    const shuffledNumbers = canShuffleNumbers ? shuffle([...numbers]) : numbers;

    const newTiles = board.tiles.map((tile, i) => {
      const newTile = { ...tile };
      const ri = resourceIndices.indexOf(i);
      if (ri !== -1 && canShuffleResources) {
        newTile.type = shuffledResources[ri];
      }
      const ni = numberedIndices.indexOf(i);
      if (ni !== -1 && canShuffleNumbers) {
        newTile.number = shuffledNumbers[ni];
      }
      return newTile;
    });

    if (isFairBoard(newTiles, fairness)) {
      return { ...board, name: board.name, tiles: newTiles };
    }
  }

  // Fallback
  const shuffledResources = canShuffleResources ? shuffle([...resources]) : resources;
  const shuffledNumbers = canShuffleNumbers ? shuffle([...numbers]) : numbers;
  const newTiles = board.tiles.map((tile, i) => {
    const newTile = { ...tile };
    const ri = resourceIndices.indexOf(i);
    if (ri !== -1 && canShuffleResources) {
      newTile.type = shuffledResources[ri];
    }
    const ni = numberedIndices.indexOf(i);
    if (ni !== -1 && canShuffleNumbers) {
      newTile.number = shuffledNumbers[ni];
    }
    return newTile;
  });
  return { ...board, name: board.name, tiles: newTiles };
}

export const ALL_BOARDS: BoardDefinition[] = [
  STANDARD_BOARD,
  EXPANSION_BOARD,
  SEAFARERS_FOUR_ISLANDS,
  SEAFARERS_NEW_SHORES,
  SEAFARERS_FOG_ISLANDS,
  SEAFARERS_THROUGH_DESERT,
];
