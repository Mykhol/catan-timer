import { useRef, useMemo, createContext, useContext } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import { Float, Environment, OrbitControls } from '@react-three/drei';
import * as THREE from 'three';

// Context to let decorations sample terrain height
type TerrainHeightFn = (x: number, z: number) => number;
const HexTileContext = createContext<TerrainHeightFn>(() => 0.125);
const useTerrainY = () => useContext(HexTileContext);

// ─── Seeded random for deterministic "randomness" ───────────────

function seededRandom(seed: number) {
  let s = seed;
  return () => {
    s = (s * 16807 + 0) % 2147483647;
    return (s - 1) / 2147483646;
  };
}

// ─── Hex tile layout ────────────────────────────────────────────

const HEX_SIZE = 1.0;
const GAP = 0.06;

type TileType = 'wheat' | 'forest' | 'sheep' | 'brick' | 'ore' | 'desert';

const BOARD: { q: number; r: number; type: TileType }[] = [
  { q: 0, r: 0, type: 'desert' },
  { q: 1, r: 0, type: 'wheat' },
  { q: 0, r: 1, type: 'forest' },
  { q: -1, r: 1, type: 'sheep' },
  { q: -1, r: 0, type: 'brick' },
  { q: 0, r: -1, type: 'ore' },
  { q: 1, r: -1, type: 'wheat' },
  { q: 2, r: 0, type: 'forest' },
  { q: 1, r: 1, type: 'sheep' },
  { q: 0, r: 2, type: 'brick' },
  { q: -1, r: 2, type: 'wheat' },
  { q: -2, r: 2, type: 'ore' },
  { q: -2, r: 1, type: 'forest' },
  { q: -2, r: 0, type: 'sheep' },
  { q: -1, r: -1, type: 'wheat' },
  { q: 0, r: -2, type: 'brick' },
  { q: 1, r: -2, type: 'forest' },
  { q: 2, r: -2, type: 'ore' },
  { q: 2, r: -1, type: 'sheep' },
];

const TILE_COLORS: Record<TileType, { base: string; dark: string; light: string }> = {
  wheat:  { base: '#e8c84a', dark: '#c9a227', light: '#f0d86a' },
  forest: { base: '#2d8a4e', dark: '#1a6b3a', light: '#3aad62' },
  sheep:  { base: '#7ec850', dark: '#5aa832', light: '#9ade70' },
  brick:  { base: '#c0542d', dark: '#8b3a1f', light: '#d4704a' },
  ore:    { base: '#6b7b8d', dark: '#4a5568', light: '#8a9aac' },
  desert: { base: '#d4b483', dark: '#b8956a', light: '#e8cfa0' },
};

function axialToWorld(q: number, r: number): [number, number] {
  const s = HEX_SIZE + GAP;
  const x = s * (Math.sqrt(3) * q + (Math.sqrt(3) / 2) * r);
  const z = s * (1.5 * r);
  return [x, z];
}

// ─── Hex tile with terrain detail ───────────────────────────────

// Get hex boundary radius at a given angle, matching CylinderGeometry(r, r, h, 6)
function hexRadiusAtAngle(angle: number): number {
  let a = ((angle + Math.PI / 6) % (Math.PI * 2) + Math.PI * 2) % (Math.PI * 2);
  const sectorSize = Math.PI / 3;
  const sector = Math.floor(a / sectorSize);
  const sectorStart = sector * sectorSize;
  const relAngle = a - sectorStart - sectorSize / 2;
  return (HEX_SIZE * Math.cos(Math.PI / 6)) / Math.cos(relAngle);
}

// How far (0-1) a point is from center to hex edge
function hexNormalizedDist(x: number, z: number): number {
  if (x === 0 && z === 0) return 0;
  const angle = Math.atan2(z, x);
  const maxR = hexRadiusAtAngle(angle);
  const dist = Math.sqrt(x * x + z * z);
  return Math.min(dist / maxR, 1);
}

// Noise function for terrain — returns POSITIVE height offset at any (x, z)
function terrainHeight(x: number, z: number, hilliness: number, seed: number): number {
  const rng = seededRandom(seed + 500);
  const f1 = 1.8 + rng() * 1.0, p1 = rng() * Math.PI * 2;
  const f2 = 3.5 + rng() * 1.5, p2 = rng() * Math.PI * 2;
  const f3 = 6.0 + rng() * 2.0, p3 = rng() * Math.PI * 2;
  const n1 = Math.sin(x * f1 + p1) * Math.cos(z * f1 + p1);
  const n2 = Math.sin(x * f2 + p2) * Math.sin(z * f2 + p2) * 0.4;
  const n3 = Math.sin(x * f3 + p3) * Math.cos(z * f3 + p3 + 1.0) * 0.15;
  const raw = (n1 + n2 + n3 + 1.55) / 3.1;
  // Fade using hex-aware distance — matches geometry's ringFade exactly
  const t = hexNormalizedDist(x, z);
  const edgeFade = Math.max(0, 1 - t * t);
  return raw * hilliness * edgeFade;
}

// Build a hex-shaped top cap with concentric vertex rings for smooth displacement
function createHexTopGeometry(seed: number, hilliness: number, yBase: number): THREE.BufferGeometry {
  const numRings = 12;
  const vertsPerRing = 36; // smooth rings

  // Uses top-level hexRadiusAtAngle

  const verts: number[] = [];
  const idxs: number[] = [];

  // Center vertex
  verts.push(0, yBase + terrainHeight(0, 0, hilliness, seed), 0);

  // Build concentric rings
  for (let ring = 1; ring <= numRings; ring++) {
    const t = ring / numRings;
    for (let v = 0; v < vertsPerRing; v++) {
      const angle = (v / vertsPerRing) * Math.PI * 2;
      const maxR = hexRadiusAtAngle(angle);
      const r = t * maxR;
      const x = Math.cos(angle) * r;
      const z = Math.sin(angle) * r;
      const y = yBase + terrainHeight(x, z, hilliness, seed);
      verts.push(x, y, z);
    }
  }

  // Triangulate ring 0 (center) to ring 1
  for (let v = 0; v < vertsPerRing; v++) {
    const next = (v + 1) % vertsPerRing;
    idxs.push(0, 1 + next, 1 + v);
  }

  // Triangulate ring N to ring N+1
  for (let ring = 1; ring < numRings; ring++) {
    const innerStart = 1 + (ring - 1) * vertsPerRing;
    const outerStart = 1 + ring * vertsPerRing;
    for (let v = 0; v < vertsPerRing; v++) {
      const next = (v + 1) % vertsPerRing;
      idxs.push(innerStart + v, outerStart + next, outerStart + v);
      idxs.push(innerStart + v, innerStart + next, outerStart + next);
    }
  }

  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(verts), 3));
  geo.setIndex(idxs);
  geo.computeVertexNormals();
  return geo;
}

function HexTile({ position, type, seed, children }: {
  position: [number, number, number];
  type: TileType;
  seed: number;
  children?: React.ReactNode;
}) {
  const groupRef = useRef<THREE.Group>(null);
  const hovered = useRef(false);
  const liftY = useRef(0);

  const rng = seededRandom(seed);
  const colors = TILE_COLORS[type];
  const tileHeight = 0.25;

  // Hilliness per tile type
  const hilliness = type === 'sheep' ? 0.45
    : type === 'desert' ? 0.3
    : type === 'forest' ? 0.3
    : type === 'wheat' ? 0.2
    : type === 'brick' ? 0.06
    : type === 'ore' ? 0.15
    : 0.15;

  // Single hex geometry with displaced top surface
  // Displaced hex top surface
  const topGeo = useMemo(
    () => createHexTopGeometry(seed, hilliness, tileHeight / 2),
    [seed, hilliness, tileHeight]
  );

  // Function to get terrain Y at any (x, z) — for placing decorations
  const getTerrainY = useMemo(() => {
    return (x: number, z: number) => {
      return tileHeight / 2 + terrainHeight(x, z, hilliness, seed);
    };
  }, [hilliness, seed, tileHeight]);

  useFrame((_, delta) => {
    if (!groupRef.current) return;
    const target = hovered.current ? 0.3 : 0;
    liftY.current += (target - liftY.current) * Math.min(delta * 8, 1);
    groupRef.current.position.y = position[1] + liftY.current;
  });

  return (
    <HexTileContext.Provider value={getTerrainY}>
      <group
        ref={groupRef}
        position={position}
      >
        {/* Invisible hit area */}
        <mesh
          visible={false}
          position={[0, 0.3, 0]}
          onPointerOver={(e) => { e.stopPropagation(); hovered.current = true; }}
          onPointerOut={(e) => { e.stopPropagation(); hovered.current = false; }}
        >
          <cylinderGeometry args={[HEX_SIZE * 1.05, HEX_SIZE * 1.05, 1.5, 6]} />
        </mesh>
        {/* Hex walls — open-ended cylinder */}
        <mesh castShadow>
          <cylinderGeometry args={[HEX_SIZE, HEX_SIZE, tileHeight, 6, 1, true]} />
          <meshToonMaterial color={colors.base} side={THREE.DoubleSide} />
        </mesh>
        {/* Bottom cap — flat hex, rotated to match cylinder walls */}
        <mesh position={[0, -tileHeight / 2, 0]} rotation={[-Math.PI / 2, 0, Math.PI / 6]}>
          <circleGeometry args={[HEX_SIZE, 6]} />
          <meshToonMaterial color={colors.dark} />
        </mesh>
        {/* Top surface — displaced terrain */}
        <mesh geometry={topGeo} castShadow receiveShadow>
          <meshStandardMaterial color={colors.base} roughness={0.85} />
        </mesh>
        {children}
      </group>
    </HexTileContext.Provider>
  );
}

// Helper: place a child on the terrain surface at (x, z)
function OnTerrain({ x, z, children }: { x: number; z: number; children: React.ReactNode }) {
  const getY = useTerrainY();
  const y = getY(x, z);
  return <group position={[x, y, z]}>{children}</group>;
}

// ─── Decorations ────────────────────────────────────────────────

function Sheep({ position, rotation = 0 }: {
  position: [number, number, number];
  rotation?: number;
}) {
  const groupRef = useRef<THREE.Group>(null);
  const offset = useMemo(() => Math.random() * Math.PI * 2, []);

  useFrame((state) => {
    if (!groupRef.current) return;
    const t = state.clock.elapsedTime;
    const wanderR = 0.08;
    groupRef.current.position.x = position[0] + Math.cos(t * 0.3 + offset) * wanderR;
    groupRef.current.position.z = position[2] + Math.sin(t * 0.3 + offset) * wanderR;
    groupRef.current.position.y = position[1] + Math.sin(t * 1.5 + offset) * 0.015;
    groupRef.current.rotation.y = Math.atan2(
      Math.cos(t * 0.3 + offset),
      -Math.sin(t * 0.3 + offset)
    );
  });

  return (
    <group ref={groupRef} position={position} rotation={[0, rotation, 0]} scale={0.1}>
      <mesh position={[0, 0.55, 0]} castShadow>
        <sphereGeometry args={[0.9, 8, 6]} />
        <meshToonMaterial color="#f5f0e8" />
      </mesh>
      {[[0.3, 0.9, 0.3], [-0.3, 0.85, -0.2], [0, 1.0, 0], [0.2, 0.8, -0.3]].map((p, i) => (
        <mesh key={`wool-${i}`} position={p as [number, number, number]} castShadow>
          <sphereGeometry args={[0.35, 6, 4]} />
          <meshToonMaterial color="#ebe6dc" />
        </mesh>
      ))}
      <mesh position={[0.9, 0.65, 0]} castShadow>
        <sphereGeometry args={[0.4, 8, 6]} />
        <meshToonMaterial color="#3a3a3a" />
      </mesh>
      <mesh position={[1.15, 0.75, 0.15]}>
        <sphereGeometry args={[0.08, 6, 4]} />
        <meshToonMaterial color="#ffffff" />
      </mesh>
      <mesh position={[1.15, 0.75, -0.15]}>
        <sphereGeometry args={[0.08, 6, 4]} />
        <meshToonMaterial color="#ffffff" />
      </mesh>
      {[[-0.35, 0, -0.25], [-0.35, 0, 0.25], [0.35, 0, -0.25], [0.35, 0, 0.25]].map((pos, i) => (
        <mesh key={`leg-${i}`} position={pos as [number, number, number]} castShadow>
          <cylinderGeometry args={[0.1, 0.08, 0.55, 6]} />
          <meshToonMaterial color="#3a3a3a" />
        </mesh>
      ))}
    </group>
  );
}

// Bushy deciduous tree — round canopy
function BushyTree({ position, scale = 1, variant = 0 }: {
  position: [number, number, number];
  scale?: number;
  variant?: number;
}) {
  const ref = useRef<THREE.Group>(null);
  const offset = useMemo(() => Math.random() * Math.PI * 2, []);

  useFrame((state) => {
    if (!ref.current) return;
    ref.current.rotation.z = Math.sin(state.clock.elapsedTime * 0.6 + offset) * 0.025;
    ref.current.rotation.x = Math.cos(state.clock.elapsedTime * 0.4 + offset) * 0.015;
  });

  const trunkColor = variant % 2 === 0 ? '#6b3a10' : '#7a4a1f';
  const greens = [
    ['#1a6b3a', '#228B46', '#1d7a3e'],
    ['#1a5c30', '#1d7a3e', '#25984c'],
    ['#2d7a3e', '#35a84e', '#1a6b3a'],
  ][variant % 3];

  return (
    <group ref={ref} position={position} scale={scale * 0.22}>
      <mesh position={[0, 0.35, 0]} castShadow>
        <cylinderGeometry args={[0.08, 0.18, 0.7, 6]} />
        <meshToonMaterial color={trunkColor} />
      </mesh>
      <mesh position={[0, 0.9, 0]} castShadow>
        <sphereGeometry args={[0.55, 8, 6]} />
        <meshToonMaterial color={greens[0]} />
      </mesh>
      <mesh position={[0.2, 1.05, 0.15]} castShadow>
        <sphereGeometry args={[0.4, 7, 5]} />
        <meshToonMaterial color={greens[1]} />
      </mesh>
      <mesh position={[-0.15, 1.0, -0.1]} castShadow>
        <sphereGeometry args={[0.38, 7, 5]} />
        <meshToonMaterial color={greens[2]} />
      </mesh>
      <mesh position={[0.05, 1.2, 0]} castShadow>
        <sphereGeometry args={[0.3, 6, 5]} />
        <meshToonMaterial color={greens[1]} />
      </mesh>
    </group>
  );
}

// Conifer / pine tree — pointed cone layers
function PineTree({ position, scale = 1, variant = 0 }: {
  position: [number, number, number];
  scale?: number;
  variant?: number;
}) {
  const ref = useRef<THREE.Group>(null);
  const offset = useMemo(() => Math.random() * Math.PI * 2, []);

  useFrame((state) => {
    if (!ref.current) return;
    ref.current.rotation.z = Math.sin(state.clock.elapsedTime * 0.5 + offset) * 0.02;
  });

  const trunkColor = variant % 2 === 0 ? '#7a4a1f' : '#8B5A2B';
  const leafColors = [
    ['#1a5c30', '#1d7a3e', '#25984c'],
    ['#1a6b3a', '#228B46', '#2aad58'],
    ['#14522a', '#1a6b3a', '#1d7a3e'],
  ][variant % 3];

  return (
    <group ref={ref} position={position} scale={scale * 0.22}>
      <mesh position={[0, 0.4, 0]} castShadow>
        <cylinderGeometry args={[0.08, 0.16, 0.8, 6]} />
        <meshToonMaterial color={trunkColor} />
      </mesh>
      <mesh position={[0, 0.9, 0]} castShadow>
        <coneGeometry args={[0.65, 0.85, 7]} />
        <meshToonMaterial color={leafColors[0]} />
      </mesh>
      <mesh position={[0, 1.35, 0]} castShadow>
        <coneGeometry args={[0.5, 0.7, 7]} />
        <meshToonMaterial color={leafColors[1]} />
      </mesh>
      <mesh position={[0, 1.7, 0]} castShadow>
        <coneGeometry args={[0.3, 0.5, 6]} />
        <meshToonMaterial color={leafColors[2]} />
      </mesh>
    </group>
  );
}

// Dense wheat field — lots of stalks, no rocks
function WheatField({ position, seed }: { position: [number, number, number]; seed: number }) {
  const ref = useRef<THREE.Group>(null);
  const getY = useTerrainY();
  const rng = seededRandom(seed);
  const offset = rng() * Math.PI * 2;

  useFrame((state) => {
    if (!ref.current) return;
    ref.current.rotation.z = Math.sin(state.clock.elapsedTime * 0.8 + offset) * 0.04;
    ref.current.rotation.x = Math.cos(state.clock.elapsedTime * 0.6 + offset) * 0.02;
  });

  const stalks = useMemo(() => {
    const r = seededRandom(seed + 100);
    return Array.from({ length: 30 + Math.floor(r() * 15) }, () => {
      const angle = r() * Math.PI * 2;
      const dist = Math.sqrt(r()) * 0.18;
      // World-space offset from cluster center
      const ox = Math.cos(angle) * dist;
      const oz = Math.sin(angle) * dist;
      return {
        x: ox,
        z: oz,
        height: 0.06 + r() * 0.06,
        lean: (r() - 0.5) * 0.12,
        color: r() > 0.5 ? '#e8c84a' : '#ddb83a',
      };
    });
  }, [seed]);

  return (
    <group ref={ref}>
      {stalks.map((s, i) => {
        const wx = position[0] + s.x;
        const wz = position[2] + s.z;
        const y = getY(wx, wz);
        return (
        <group key={i} position={[wx, y, wz]} rotation={[0, 0, s.lean]}>
          <mesh position={[0, s.height / 2, 0]}>
            <cylinderGeometry args={[0.004, 0.005, s.height, 4]} />
            <meshToonMaterial color="#c9a227" />
          </mesh>
          <mesh position={[0, s.height + 0.005, 0]}>
            <capsuleGeometry args={[0.008, 0.015, 4, 4]} />
            <meshToonMaterial color={s.color} />
          </mesh>
        </group>
      ))}
    </group>
  );
}

// Mountain range for ore tiles — big and imposing
function Mountain({ position, seed }: { position: [number, number, number]; seed: number }) {
  const rng = seededRandom(seed);

  const peaks = useMemo(() => {
    const r = seededRandom(seed + 300);
    return [
      { x: 0, z: 0, h: 1.6 + r() * 0.5, w: 0.7, color: '#5c6b7a' },
      { x: 0.4 + r() * 0.2, z: 0.2, h: 1.1 + r() * 0.4, w: 0.55, color: '#6b7b8d' },
      { x: -0.35, z: -0.2 + r() * 0.15, h: 0.9 + r() * 0.3, w: 0.5, color: '#7a8a9c' },
      { x: 0.15, z: -0.35, h: 0.7 + r() * 0.3, w: 0.4, color: '#5c6b7a' },
      { x: -0.15, z: 0.3, h: 0.6 + r() * 0.25, w: 0.35, color: '#6b7b8d' },
    ];
  }, [seed]);

  return (
    <group position={position} scale={0.55}>
      {peaks.map((p, i) => (
        <group key={i} position={[p.x, 0, p.z]}>
          {/* Mountain body */}
          <mesh position={[0, p.h * 0.4, 0]} castShadow>
            <coneGeometry args={[p.w, p.h, 6]} />
            <meshToonMaterial color={p.color} />
          </mesh>
          {/* Snow cap */}
          <mesh position={[0, p.h * 0.75, 0]} castShadow>
            <coneGeometry args={[p.w * 0.35, p.h * 0.3, 6]} />
            <meshToonMaterial color="#e8e8f0" />
          </mesh>
        </group>
      ))}
      {/* Boulders at base */}
      {Array.from({ length: 4 }, (_, i) => {
        const angle = rng() * Math.PI * 2;
        const dist = 0.5 + rng() * 0.3;
        return (
          <mesh key={`boulder-${i}`} position={[Math.cos(angle) * dist, 0.08, Math.sin(angle) * dist]} castShadow>
            <dodecahedronGeometry args={[0.12 + rng() * 0.1, 0]} />
            <meshToonMaterial color={rng() > 0.5 ? '#5c6b7a' : '#6b7b8d'} />
          </mesh>
        );
      })}
      {/* Ore veins — sparkly crystals */}
      {Array.from({ length: 5 }, (_, i) => {
        const angle = rng() * Math.PI * 2;
        const dist = 0.15 + rng() * 0.25;
        return (
          <mesh key={`ore-${i}`} position={[Math.cos(angle) * dist, 0.15 + rng() * 0.2, Math.sin(angle) * dist]}>
            <octahedronGeometry args={[0.05, 0]} />
            <meshToonMaterial color="#a8c0d8" />
          </mesh>
        );
      })}
    </group>
  );
}

// Quarry pit for brick tiles — sunken hole with clay walls
function Quarry({ position, seed }: { position: [number, number, number]; seed: number }) {
  const rng = seededRandom(seed);

  return (
    <group position={position} scale={0.7}>
      {/* Pit — dark sunken hole */}
      <mesh position={[0, -0.1, 0]} receiveShadow>
        <cylinderGeometry args={[0.75, 0.85, 0.2, 8]} />
        <meshToonMaterial color="#3a1a08" />
      </mesh>
      {/* Stepped inner walls */}
      <mesh position={[0, -0.02, 0]} receiveShadow>
        <cylinderGeometry args={[0.85, 0.95, 0.08, 8]} />
        <meshToonMaterial color="#6b3a1f" />
      </mesh>
      {/* Clay rim walls — stacked bricks around the edge */}
      {Array.from({ length: 10 }, (_, i) => {
        const angle = (i / 10) * Math.PI * 2 + rng() * 0.2;
        const dist = 0.8;
        const h = 0.1 + rng() * 0.12;
        return (
          <mesh
            key={`wall-${i}`}
            position={[Math.cos(angle) * dist, h / 2, Math.sin(angle) * dist]}
            castShadow
          >
            <boxGeometry args={[0.22, h, 0.15]} />
            <meshToonMaterial color={['#c0542d', '#a8452a', '#d4704a', '#8b3a1f'][i % 4]} />
          </mesh>
        );
      })}
      {/* Clay chunks and rubble scattered across pit */}
      {Array.from({ length: 12 }, (_, i) => {
        const angle = rng() * Math.PI * 2;
        const dist = Math.sqrt(rng()) * 0.6;
        return (
          <mesh key={`clay-${i}`} position={[Math.cos(angle) * dist, 0.02 + rng() * 0.04, Math.sin(angle) * dist]} rotation={[0, rng() * Math.PI, 0]}>
            <boxGeometry args={[0.14, 0.07, 0.1]} />
            <meshToonMaterial color={['#b5603a', '#c0542d', '#a8452a', '#d4704a'][i % 4]} />
          </mesh>
        );
      })}
    </group>
  );
}

// Cactus for desert tiles
function Cactus({ position, seed }: { position: [number, number, number]; seed: number }) {
  const rng = seededRandom(seed);
  const height = 0.4 + rng() * 0.3;
  const hasArm1 = rng() > 0.3;
  const hasArm2 = rng() > 0.5;
  const arm1H = 0.15 + rng() * 0.15;
  const arm2H = 0.1 + rng() * 0.15;

  return (
    <group position={position} scale={0.3}>
      {/* Main trunk */}
      <mesh position={[0, height / 2, 0]} castShadow>
        <cylinderGeometry args={[0.08, 0.1, height, 6]} />
        <meshToonMaterial color="#3a7a3a" />
      </mesh>
      {/* Top */}
      <mesh position={[0, height + 0.03, 0]}>
        <sphereGeometry args={[0.08, 6, 4]} />
        <meshToonMaterial color="#4a8a4a" />
      </mesh>
      {/* Arms */}
      {hasArm1 && (
        <group position={[0.08, height * 0.55, 0]}>
          <mesh rotation={[0, 0, -Math.PI / 2]} position={[0.07, 0, 0]}>
            <cylinderGeometry args={[0.05, 0.06, 0.14, 5]} />
            <meshToonMaterial color="#3a7a3a" />
          </mesh>
          <mesh position={[0.14, arm1H / 2, 0]}>
            <cylinderGeometry args={[0.05, 0.06, arm1H, 5]} />
            <meshToonMaterial color="#4a8a4a" />
          </mesh>
        </group>
      )}
      {hasArm2 && (
        <group position={[-0.08, height * 0.4, 0]}>
          <mesh rotation={[0, 0, Math.PI / 2]} position={[-0.07, 0, 0]}>
            <cylinderGeometry args={[0.05, 0.06, 0.14, 5]} />
            <meshToonMaterial color="#3a7a3a" />
          </mesh>
          <mesh position={[-0.14, arm2H / 2, 0]}>
            <cylinderGeometry args={[0.05, 0.06, arm2H, 5]} />
            <meshToonMaterial color="#4a8a4a" />
          </mesh>
        </group>
      )}
    </group>
  );
}

// Dense grass coverage for sheep pastures
function GrassCoverage({ seed }: { seed: number }) {
  const getY = useTerrainY();
  const tufts = useMemo(() => {
    const rng = seededRandom(seed + 200);
    return Array.from({ length: 40 + Math.floor(rng() * 15) }, () => {
      const angle = rng() * Math.PI * 2;
      const dist = Math.sqrt(rng()) * 0.7;
      return {
        x: Math.cos(angle) * dist,
        z: Math.sin(angle) * dist,
        scale: 0.04 + rng() * 0.06,
        height: 0.02 + rng() * 0.03,
        color: ['#5aa832', '#6bc048', '#4d9a28', '#72d050', '#5cb83a'][Math.floor(rng() * 5)],
      };
    });
  }, [seed]);

  return (
    <>
      {tufts.map((t, i) => (
        <mesh key={i} position={[t.x, getY(t.x, t.z) + t.height * 0.4, t.z]} scale={t.scale}>
          <coneGeometry args={[1, 1, 4]} />
          <meshToonMaterial color={t.color} />
        </mesh>
      ))}
    </>
  );
}

// ─── Board scene ────────────────────────────────────────────────

function BoardScene() {
  const boardRef = useRef<THREE.Group>(null);

  return (
    <group ref={boardRef}>
      {/* Hex tiles with decorations as children */}
      {BOARD.map((tile, i) => {
        const [wx, wz] = axialToWorld(tile.q, tile.r);
        const tileSeed = i * 137 + 42;
        const rng = seededRandom(tileSeed);

        return (
          <HexTile
            key={`tile-${i}`}
            position={[wx, 0, wz]}
            type={tile.type}
            seed={tileSeed}
          >
            {tile.type === 'sheep' && (
              <>
                <GrassCoverage seed={tileSeed} />
                <GrassCoverage seed={tileSeed + 77} />
                {Array.from({ length: 3 + Math.floor(rng() * 3) }, (_, s) => {
                  const angle = rng() * Math.PI * 2;
                  const r = Math.sqrt(rng()) * 0.6;
                  const sx = Math.cos(angle) * r, sz = Math.sin(angle) * r;
                  return (
                    <OnTerrain key={`sheep-${s}`} x={sx} z={sz}>
                      <Sheep position={[0, 0, 0]} rotation={rng() * Math.PI * 2} />
                    </OnTerrain>
                  );
                })}
              </>
            )}
            {tile.type === 'forest' && (
              <>
                {Array.from({ length: 8 + Math.floor(rng() * 4) }, (_, t) => {
                  const angle = rng() * Math.PI * 2;
                  const r = Math.sqrt(rng()) * 0.7;
                  const tx = Math.cos(angle) * r, tz = Math.sin(angle) * r;
                  const isPine = rng() > 0.5;
                  const TreeComp = isPine ? PineTree : BushyTree;
                  return (
                    <OnTerrain key={`tree-${t}`} x={tx} z={tz}>
                      <TreeComp position={[0, 0, 0]} scale={0.6 + rng() * 0.6} variant={Math.floor(rng() * 3)} />
                    </OnTerrain>
                  );
                })}
              </>
            )}
            {tile.type === 'wheat' && (
              <>
                {Array.from({ length: 8 + Math.floor(rng() * 4) }, (_, w) => {
                  const angle = rng() * Math.PI * 2;
                  const r = Math.sqrt(rng()) * 0.7;
                  const wx2 = Math.cos(angle) * r, wz2 = Math.sin(angle) * r;
                  return (
                    <OnTerrain key={`wheat-${w}`} x={wx2} z={wz2}>
                      <WheatField position={[0, 0, 0]} seed={tileSeed + w * 31} />
                    </OnTerrain>
                  );
                })}
              </>
            )}
            {tile.type === 'ore' && (
              <OnTerrain x={0} z={0}><Mountain position={[0, 0, 0]} seed={tileSeed} /></OnTerrain>
            )}
            {tile.type === 'brick' && (
              <OnTerrain x={0} z={0}><Quarry position={[0, 0, 0]} seed={tileSeed} /></OnTerrain>
            )}
            {tile.type === 'desert' && (
              <>
                <OnTerrain x={0.2} z={0.15}><Cactus position={[0, 0, 0]} seed={tileSeed} /></OnTerrain>
                <OnTerrain x={-0.25} z={-0.1}><Cactus position={[0, 0, 0]} seed={tileSeed + 50} /></OnTerrain>
                <OnTerrain x={0.0} z={-0.3}><Cactus position={[0, 0, 0]} seed={tileSeed + 99} /></OnTerrain>
              </>
            )}
          </HexTile>
        );
      })}

      {/* Water ring — ring 3 */}
      {(() => {
        const waterTiles: [number, number][] = [];
        const dirs: [number, number][] = [
          [1, 0], [0, 1], [-1, 1], [-1, 0], [0, -1], [1, -1],
        ];
        let q = 3, r = 0;
        for (let side = 0; side < 6; side++) {
          for (let step = 0; step < 3; step++) {
            waterTiles.push([q, r]);
            q += dirs[(side + 2) % 6][0];
            r += dirs[(side + 2) % 6][1];
          }
        }
        return waterTiles.map(([wq, wr], i) => {
          const [wx, wz] = axialToWorld(wq, wr);
          const rng = seededRandom(i * 73 + 999);
          return (
            <Float key={`water-${i}`} speed={1.2 + rng() * 0.6} floatIntensity={0.04} rotationIntensity={0}>
              <group position={[wx, -0.05, wz]}>
                <mesh>
                  <cylinderGeometry args={[HEX_SIZE, HEX_SIZE * 1.02, 0.12, 6]} />
                  <meshToonMaterial color={rng() > 0.5 ? '#2980b9' : '#2471a3'} transparent opacity={0.55} />
                </mesh>
                {/* Wave highlights */}
                <mesh position={[(rng() - 0.5) * 0.4, 0.07, (rng() - 0.5) * 0.3]}>
                  <boxGeometry args={[0.3, 0.01, 0.06]} />
                  <meshToonMaterial color="#5dade2" transparent opacity={0.4} />
                </mesh>
              </group>
            </Float>
          );
        });
      })()}

    </group>
  );
}

// ─── Main export ────────────────────────────────────────────────

export default function CatanBoard3D({ interactive = false }: { interactive?: boolean }) {
  return (
    <div className={interactive ? 'catan-3d-interactive' : 'catan-3d-bg'}>
      <Canvas
        shadows
        gl={{ antialias: true, alpha: true }}
        camera={{ position: [0, 12, 5], fov: 30 }}
        style={{ background: interactive ? '#1a0f0a' : 'transparent' }}
      >
        {interactive && (
          <OrbitControls
            enablePan
            enableZoom
            enableRotate
            minDistance={5}
            maxDistance={25}
            maxPolarAngle={Math.PI / 2.2}
          />
        )}

        <ambientLight intensity={0.5} />
        <directionalLight
          position={[5, 10, 5]}
          intensity={1.2}
          castShadow
          shadow-mapSize-width={1024}
          shadow-mapSize-height={1024}
        />
        <pointLight position={[-3, 5, -3]} intensity={0.4} color="#f0a030" />

        <Environment preset="sunset" environmentIntensity={0.3} />

        <BoardScene />

        {/* Ground */}
        <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.2, 0]} receiveShadow>
          <planeGeometry args={[40, 40]} />
          <meshToonMaterial color="#1a0f0a" />
        </mesh>
      </Canvas>
      {!interactive && <div className="catan-3d-overlay" />}
    </div>
  );
}
