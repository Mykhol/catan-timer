import { useMemo } from 'react';

// Resource tile types with colors and icons
const RESOURCE_TILES = [
  { type: 'wheat',   bg: '#e8c84a', accent: '#d4a017', icon: '\u{1F33E}', label: 'wheat' },
  { type: 'wood',    bg: '#2d6a1e', accent: '#1a4a0f', icon: '\u{1F332}', label: 'wood' },
  { type: 'brick',   bg: '#c0542d', accent: '#8b3a1f', icon: '\u{1F9F1}', label: 'brick' },
  { type: 'ore',     bg: '#6b7b8d', accent: '#4a5568', icon: '\u26F0\uFE0F', label: 'ore' },
  { type: 'sheep',   bg: '#7ec850', accent: '#55a630', icon: '\u{1F411}', label: 'sheep' },
  { type: 'desert',  bg: '#d4b483', accent: '#b8956a', icon: '\u{1F3DC}\uFE0F', label: 'desert' },
];

interface HexTile {
  x: number;
  y: number;
  resource: typeof RESOURCE_TILES[number];
}

function generateHexGrid(): HexTile[] {
  const tiles: HexTile[] = [];
  const hexW = 120;
  const hexH = 104;
  const cols = Math.ceil(2000 / (hexW * 0.75)) + 2;
  const rows = Math.ceil(1400 / hexH) + 2;

  for (let row = -1; row < rows; row++) {
    for (let col = -1; col < cols; col++) {
      const offset = row % 2 === 0 ? 0 : hexW * 0.375;
      const x = col * hexW * 0.75 + offset - 60;
      const y = row * hexH * 0.88 - 60;
      const resourceIndex = Math.abs(((row * 7 + col * 13 + row * col) % RESOURCE_TILES.length));
      tiles.push({
        x,
        y,
        resource: RESOURCE_TILES[resourceIndex],
      });
    }
  }
  return tiles;
}

// SVG hexagon path (pointy-top, centered)
const HEX_PATH = 'M 52 0 L 104 30 L 104 78 L 52 108 L 0 78 L 0 30 Z';

export default function CatanBackground() {
  const tiles = useMemo(generateHexGrid, []);

  return (
    <div className="catan-bg">
      <svg
        className="catan-bg-svg"
        viewBox="0 0 1920 1080"
        preserveAspectRatio="xMidYMid slice"
        xmlns="http://www.w3.org/2000/svg"
      >
        <defs>
          <filter id="hex-glow">
            <feGaussianBlur stdDeviation="2" result="blur" />
            <feMerge>
              <feMergeNode in="blur" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
        </defs>

        {tiles.map((tile, i) => (
          <g
            key={i}
            className="hex-tile"
          >
            <g transform={`translate(${tile.x}, ${tile.y})`}>
              <path
                d={HEX_PATH}
                fill={tile.resource.bg}
                opacity="0.12"
                stroke={tile.resource.accent}
                strokeWidth="1.5"
                strokeOpacity="0.2"
              />
              <text
                x="52"
                y="62"
                textAnchor="middle"
                dominantBaseline="central"
                fontSize="24"
                opacity="0.18"
                className="hex-icon-text"
              >
                {tile.resource.icon}
              </text>
            </g>
          </g>
        ))}

        {Array.from({ length: 20 }, (_, i) => {
          const icons = ['\u{1F33E}', '\u{1FAB5}', '\u{1F411}', '\u{1F48E}', '\u{1F9F1}'];
          return (
            <text
              key={`particle-${i}`}
              className="floating-particle"
              x={((i * 137) % 1920)}
              y={((i * 89) % 1080)}
              fontSize="16"
              opacity="0.25"
            >
              {icons[i % icons.length]}
            </text>
          );
        })}
      </svg>

      <div className="catan-bg-overlay" />
    </div>
  );
}
