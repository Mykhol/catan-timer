// ─── Board definition types ─────────────────────────────────────
// This is the clean interface between board generators and the 3D renderer.

export type TileType = 'wheat' | 'forest' | 'sheep' | 'brick' | 'ore' | 'desert' | 'water' | 'gold' | 'fog';

export interface BoardTile {
  /** Axial hex coordinate */
  q: number;
  r: number;
  /** Resource type */
  type: TileType;
  /** Number token (2-12), undefined for desert/water/fog */
  number?: number;
  /** Whether this tile has a harbor, and what type */
  harbor?: HarborType;
  /** Harbor edge direction (0-5, which hex edge the harbor faces) */
  harborEdge?: number;
}

export type HarborType = '3:1' | 'wheat' | 'forest' | 'sheep' | 'brick' | 'ore';

export interface BoardDefinition {
  /** Display name */
  name: string;
  /** All land tiles */
  tiles: BoardTile[];
  /** Water tile positions (rendered as ocean) — if omitted, auto-generated as surrounding rings */
  waterRings?: number;
  /** Harbors on the water ring */
  harbors?: BoardTile[];
  /** What can be shuffled on this board */
  variableSetup?: {
    /** Can resource hex types be shuffled? */
    resources?: boolean;
    /** Can number tokens be shuffled? */
    numbers?: boolean;
  };
}

// ─── Tile color palette ─────────────────────────────────────────

export const TILE_COLORS: Record<TileType, { base: string; dark: string; light: string }> = {
  wheat:  { base: '#e8c84a', dark: '#c9a227', light: '#f0d86a' },
  forest: { base: '#2d8a4e', dark: '#1a6b3a', light: '#3aad62' },
  sheep:  { base: '#7ec850', dark: '#5aa832', light: '#9ade70' },
  brick:  { base: '#c0542d', dark: '#8b3a1f', light: '#d4704a' },
  ore:    { base: '#6b7b8d', dark: '#4a5568', light: '#8a9aac' },
  desert: { base: '#d4b483', dark: '#b8956a', light: '#e8cfa0' },
  water:  { base: '#2980b9', dark: '#1a5276', light: '#5dade2' },
  gold:   { base: '#ffd700', dark: '#cca800', light: '#ffe44d' },
  fog:    { base: '#8899aa', dark: '#667788', light: '#aabbcc' },
};

// ─── Number token styling ───────────────────────────────────────

/** Dots shown on number tokens (probability indicator) */
export function getNumberDots(num: number): number {
  return 6 - Math.abs(7 - num);
}

/** Whether this number is "hot" (6 or 8) */
export function isHotNumber(num: number): boolean {
  return num === 6 || num === 8;
}
