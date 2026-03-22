import { useRef, useMemo, createContext, useContext } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import { Float, Environment, OrbitControls, Text, Billboard } from '@react-three/drei';
import * as THREE from 'three';
import type { BoardDefinition, TileType } from '../lib/boardTypes';
import { TILE_COLORS, isHotNumber, getNumberDots } from '../lib/boardTypes';
import { STANDARD_BOARD } from '../lib/boardLayouts';

// Context to let decorations sample terrain height
type TerrainHeightFn = (x: number, z: number) => number;
const HexTileContext = createContext<TerrainHeightFn>(() => 0.125);
const useTerrainY = () => useContext(HexTileContext);

// Context to let children know if the parent tile is hovered
const HexHoverContext = createContext<React.MutableRefObject<boolean>>({ current: false });
const useHexHovered = () => useContext(HexHoverContext);

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
const GAP = 0;

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
// Adds per-vertex color attribute driven by noise to give light/dark terrain patches
function createHexTopGeometry(
  seed: number,
  hilliness: number,
  yBase: number,
  tileType: TileType,
): THREE.BufferGeometry {
  const numRings = 12;
  const vertsPerRing = 36; // smooth rings

  // Uses top-level hexRadiusAtAngle

  const verts: number[] = [];
  const vertColors: number[] = [];
  const idxs: number[] = [];

  const palette = TILE_COLORS[tileType];
  const baseCol = new THREE.Color(palette.base);
  const darkCol = new THREE.Color(palette.dark);
  const lightCol = new THREE.Color(palette.light);

  // Noise for color variation — separate from terrain height noise
  const colorNoise = (x: number, z: number): number => {
    const rng = seededRandom(seed + 900);
    const f1 = 2.5 + rng() * 1.5, p1 = rng() * Math.PI * 2;
    const f2 = 5.0 + rng() * 2.0, p2 = rng() * Math.PI * 2;
    const n1 = Math.sin(x * f1 + p1) * Math.cos(z * f1 + p1 + 0.7);
    const n2 = Math.sin(x * f2 + p2) * Math.sin(z * f2 + p2) * 0.5;
    return (n1 + n2 + 1.5) / 3.0; // 0-1 range
  };

  const pushVertColor = (x: number, z: number, y: number) => {
    const noiseVal = colorNoise(x, z);
    // Blend: low noise → dark (valleys), high noise → light (hilltops)
    // Also factor in actual height for extra variation
    const heightFactor = hilliness > 0.01 ? (y - yBase) / (hilliness * 0.8 + 0.01) : 0.5;
    const blend = noiseVal * 0.6 + Math.min(heightFactor, 1) * 0.4;
    const col = new THREE.Color();
    if (blend < 0.5) {
      col.lerpColors(darkCol, baseCol, blend * 2);
    } else {
      col.lerpColors(baseCol, lightCol, (blend - 0.5) * 2);
    }
    vertColors.push(col.r, col.g, col.b);
  };

  // Center vertex
  const centerY = yBase + terrainHeight(0, 0, hilliness, seed);
  verts.push(0, centerY, 0);
  pushVertColor(0, 0, centerY);

  // Build concentric rings
  for (let ring = 1; ring <= numRings; ring++) {
    const t = ring / numRings;
    for (let v = 0; v < vertsPerRing; v++) {
      const angle = (v / vertsPerRing) * Math.PI * 2;
      const maxR = hexRadiusAtAngle(angle) * 0.97;
      const r = t * maxR;
      const x = Math.cos(angle) * r;
      const z = Math.sin(angle) * r;
      const y = yBase + terrainHeight(x, z, hilliness, seed);
      verts.push(x, y, z);
      pushVertColor(x, z, y);
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
  geo.setAttribute('color', new THREE.BufferAttribute(new Float32Array(vertColors), 3));
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
  const terrainMatRef = useRef<THREE.MeshStandardMaterial>(null);
  const hovered = useRef(false);
  const liftY = useRef(0);
  const glowIntensity = useRef(0);

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
  // Displaced hex top surface — now with vertex colors
  const topGeo = useMemo(
    () => createHexTopGeometry(seed, hilliness, tileHeight / 2, type),
    [seed, hilliness, tileHeight, type]
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
    groupRef.current.position.y = liftY.current;

    // Rim lighting glow on hover
    if (terrainMatRef.current) {
      const glowTarget = hovered.current ? 0.2 : 0;
      glowIntensity.current += (glowTarget - glowIntensity.current) * Math.min(delta * 6, 1);
      terrainMatRef.current.emissiveIntensity = glowIntensity.current;
    }
  });

  return (
    <HexTileContext.Provider value={getTerrainY}>
    <HexHoverContext.Provider value={hovered}>
      <group position={position}>
        {/* Static hit area — doesn't move with lift */}
        <mesh
          visible={false}
          onPointerOver={(e) => { e.stopPropagation(); hovered.current = true; }}
          onPointerOut={(e) => { e.stopPropagation(); hovered.current = false; }}
        >
          <cylinderGeometry args={[HEX_SIZE, HEX_SIZE, tileHeight + 0.5, 6]} />
        </mesh>
        {/* Visual group — lifts on hover */}
        <group ref={groupRef}>
        {/* Hex body — closed cylinder with brown border color, no gaps */}
        <mesh castShadow>
          <cylinderGeometry args={[HEX_SIZE, HEX_SIZE, tileHeight, 6]} />
          <meshToonMaterial color="#c4a06a" />
        </mesh>
        {/* Top border — rendered just below terrain so terrain always covers it */}
        <mesh position={[0, tileHeight / 2 - 0.003, 0]} rotation={[Math.PI / 2, 0, Math.PI / 6]} renderOrder={-1}>
          <ringGeometry args={[HEX_SIZE * 0.65, HEX_SIZE * 1.02, 6, 1]} />
          <meshToonMaterial color="#c4a06a" side={THREE.DoubleSide} depthWrite={false} />
        </mesh>
        {/* Top surface — displaced terrain with vertex colors */}
        <mesh geometry={topGeo} castShadow receiveShadow>
          <meshStandardMaterial
            ref={terrainMatRef}
            vertexColors
            roughness={0.85}
            emissive={colors.base}
            emissiveIntensity={0}
          />
        </mesh>
        {children}
        </group>
      </group>
    </HexHoverContext.Provider>
    </HexTileContext.Provider>
  );
}

// ─── Number Token ───────────────────────────────────────────────

function NumberToken({ number, position }: { number: number; position: [number, number, number] }) {
  const hot = isHotNumber(number);
  const dots = getNumberDots(number);
  const textColor = hot ? '#cc0000' : '#2a2a2a';
  const groupRef = useRef<THREE.Group>(null);
  const chipMatRef = useRef<THREE.Mesh>(null);
  const floatY = useRef(0);
  const parentHovered = useHexHovered();

  useFrame((_, delta) => {
    if (!groupRef.current?.parent) return;
    const parentY = groupRef.current.parent.position.y;
    const target = position[1] + parentY * 1.5;
    floatY.current += (target - floatY.current) * Math.min(delta * 4, 1);
    groupRef.current.position.y = floatY.current;

    // Yellow ring scale on hover
    if (chipMatRef.current) {
      const targetScale = parentHovered.current ? 1 : 0;
      chipMatRef.current.scale.x += (targetScale - chipMatRef.current.scale.x) * Math.min(delta * 8, 1);
      chipMatRef.current.scale.y += (targetScale - chipMatRef.current.scale.y) * Math.min(delta * 8, 1);
    }
  });

  const chipH = 0.04;

  return (
    <group ref={groupRef} position={position}>
      <Billboard follow lockX={false} lockY={false} lockZ={false}>
        {/* Yellow glow ring — flat disc behind the chip */}
        <mesh ref={chipMatRef} position={[0, 0, -chipH / 2 - 0.002]} scale={[0, 0, 1]}>
          <circleGeometry args={[0.32, 32]} />
          <meshBasicMaterial color="#f0c030" transparent opacity={0.7} side={THREE.DoubleSide} />
        </mesh>
        {/* Cardboard chip — facing camera via Billboard */}
        <mesh position={[0, 0, 0]} rotation={[Math.PI / 2, 0, 0]} castShadow>
          <cylinderGeometry args={[0.24, 0.25, chipH, 24]} />
          <meshToonMaterial color="#c4a06a" />
        </mesh>
        {/* Number text — on front face */}
        <Text
          position={[0, 0.02, chipH / 2 + 0.005]}
          fontSize={0.18}
          color={textColor}
          anchorX="center"
          anchorY="middle"
        >
          {number.toString()}
        </Text>
        {/* Probability dots */}
        {Array.from({ length: dots }, (_, i) => {
          const dotX = (i - (dots - 1) / 2) * 0.05;
          return (
            <mesh key={i} position={[dotX, -0.1, chipH / 2 + 0.005]}>
              <circleGeometry args={[0.015, 8]} />
              <meshBasicMaterial color={textColor} />
          </mesh>
        );
      })}
      </Billboard>
    </group>
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
        return (
        <group key={i} position={[wx, 0, wz]} rotation={[0, 0, s.lean]}>
          <mesh position={[0, s.height / 2, 0]}>
            <cylinderGeometry args={[0.004, 0.005, s.height, 4]} />
            <meshToonMaterial color="#c9a227" />
          </mesh>
          <mesh position={[0, s.height + 0.005, 0]}>
            <capsuleGeometry args={[0.008, 0.015, 4, 4]} />
            <meshToonMaterial color={s.color} />
          </mesh>
        </group>
        );
      })}
    </group>
  );
}

// Create a cone geometry with vertex color gradient: brown base → grey rock → white snow
function createGradientConeGeo(radius: number, height: number, segments: number): THREE.BufferGeometry {
  const geo = new THREE.ConeGeometry(radius, height, segments);
  const pos = geo.attributes.position;
  const colors = new Float32Array(pos.count * 3);
  const brownBase = new THREE.Color('#6b4226');
  const greyRock = new THREE.Color('#6b7b8d');
  const whiteCap = new THREE.Color('#e8e8f0');
  const tmpCol = new THREE.Color();
  for (let i = 0; i < pos.count; i++) {
    // ConeGeometry y goes from -height/2 (base) to +height/2 (tip)
    const y = pos.getY(i);
    const t = (y + height / 2) / height; // 0 = base, 1 = tip
    if (t < 0.4) {
      tmpCol.lerpColors(brownBase, greyRock, t / 0.4);
    } else if (t < 0.75) {
      tmpCol.lerpColors(greyRock, greyRock, 1);
    } else {
      tmpCol.lerpColors(greyRock, whiteCap, (t - 0.75) / 0.25);
    }
    colors[i * 3] = tmpCol.r;
    colors[i * 3 + 1] = tmpCol.g;
    colors[i * 3 + 2] = tmpCol.b;
  }
  geo.setAttribute('color', new THREE.BufferAttribute(colors, 3));
  return geo;
}

// Mountain range for ore tiles — big and imposing
function Mountain({ position, seed }: { position: [number, number, number]; seed: number }) {
  const rng = seededRandom(seed);

  const peaks = useMemo(() => {
    const r = seededRandom(seed + 300);
    return [
      { x: 0, z: 0, h: 1.6 + r() * 0.5, w: 0.7 },
      { x: 0.4 + r() * 0.2, z: 0.2, h: 1.1 + r() * 0.4, w: 0.55 },
      { x: -0.35, z: -0.2 + r() * 0.15, h: 0.9 + r() * 0.3, w: 0.5 },
      { x: 0.15, z: -0.35, h: 0.7 + r() * 0.3, w: 0.4 },
      { x: -0.15, z: 0.3, h: 0.6 + r() * 0.25, w: 0.35 },
    ];
  }, [seed]);

  const peakGeos = useMemo(
    () => peaks.map((p) => createGradientConeGeo(p.w, p.h, 6)),
    [peaks]
  );

  return (
    <group position={position} scale={0.55}>
      {peaks.map((p, i) => (
        <group key={i} position={[p.x, 0, p.z]}>
          {/* Mountain body with gradient vertex colors */}
          <mesh geometry={peakGeos[i]} position={[0, p.h * 0.4, 0]} castShadow>
            <meshStandardMaterial vertexColors roughness={0.9} />
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

// ─── Animated water tile — Y oscillation + color cycling ────────

function AnimatedWaterTile({ position, seed }: { position: [number, number, number]; seed: number }) {
  const meshRef = useRef<THREE.Mesh>(null);
  const matRef = useRef<THREE.MeshToonMaterial>(null);
  const rng = seededRandom(seed);
  const speed = 0.6 + rng() * 0.3;
  const phase = rng() * Math.PI * 2;
  const colorA = useMemo(() => new THREE.Color('#2980b9'), []);
  const colorB = useMemo(() => new THREE.Color('#1a5276'), []);
  const colorC = useMemo(() => new THREE.Color('#5dade2'), []);
  const tmpColor = useMemo(() => new THREE.Color(), []);

  useFrame((state) => {
    if (!meshRef.current || !matRef.current) return;
    const t = state.clock.elapsedTime;
    // Y oscillation
    meshRef.current.position.y = position[1] + Math.sin(t * speed + phase) * 0.04;
    // Color cycling between blue tones
    const cycle = (Math.sin(t * 0.25 + phase) + 1) / 2; // 0-1
    if (cycle < 0.5) {
      tmpColor.lerpColors(colorA, colorB, cycle * 2);
    } else {
      tmpColor.lerpColors(colorB, colorC, (cycle - 0.5) * 2);
    }
    matRef.current.color.copy(tmpColor);
  });

  return (
    <group>
      <mesh ref={meshRef} position={position}>
        <cylinderGeometry args={[HEX_SIZE, HEX_SIZE * 1.02, 0.12, 6]} />
        <meshToonMaterial ref={matRef} color="#2980b9" transparent opacity={0.55} />
      </mesh>
      {/* Wave highlights */}
      <Float speed={speed} floatIntensity={0.03} rotationIntensity={0}>
        <mesh position={[position[0] + (rng() - 0.5) * 0.4, position[1] + 0.07, position[2] + (rng() - 0.5) * 0.3]}>
          <boxGeometry args={[0.3, 0.01, 0.06]} />
          <meshToonMaterial color="#5dade2" transparent opacity={0.4} />
        </mesh>
      </Float>
    </group>
  );
}

// ─── Floating pollen/dust motes over wheat tiles ────────────────

function PollenMotes({ seed }: { seed: number }) {
  const groupRef = useRef<THREE.Group>(null);
  const getY = useTerrainY();

  const motes = useMemo(() => {
    const rng = seededRandom(seed + 700);
    return Array.from({ length: 12 }, () => ({
      x: (rng() - 0.5) * 1.2,
      z: (rng() - 0.5) * 1.2,
      phase: rng() * Math.PI * 2,
      speed: 0.15 + rng() * 0.25,
      driftX: (rng() - 0.5) * 0.3,
      driftZ: (rng() - 0.5) * 0.3,
      size: 0.008 + rng() * 0.008,
    }));
  }, [seed]);

  useFrame((state) => {
    if (!groupRef.current) return;
    const t = state.clock.elapsedTime;
    const children = groupRef.current.children;
    for (let i = 0; i < motes.length; i++) {
      const m = motes[i];
      const child = children[i] as THREE.Mesh;
      if (!child) continue;
      // Drift upward, wrapping back down
      const cycleY = ((t * m.speed + m.phase) % 3) / 3; // 0-1 cycle over ~3 sec
      const baseY = getY(m.x, m.z);
      child.position.x = m.x + Math.sin(t * 0.4 + m.phase) * m.driftX;
      child.position.z = m.z + Math.cos(t * 0.3 + m.phase) * m.driftZ;
      child.position.y = baseY + cycleY * 0.5;
      // Fade out near top of drift
      const mat = child.material as THREE.MeshToonMaterial;
      mat.opacity = cycleY < 0.8 ? 0.6 : 0.6 * (1 - (cycleY - 0.8) / 0.2);
    }
  });

  return (
    <group ref={groupRef}>
      {motes.map((m, i) => (
        <mesh key={i} position={[m.x, getY(m.x, m.z), m.z]}>
          <sphereGeometry args={[m.size, 4, 4]} />
          <meshToonMaterial color="#f5e6a0" transparent opacity={0.6} />
        </mesh>
      ))}
    </group>
  );
}

// ─── Board scene ────────────────────────────────────────────────

function BoardScene({ board }: { board: BoardDefinition }) {
  const boardRef = useRef<THREE.Group>(null);
  const landTiles = board.tiles.filter(t => t.type !== 'water');
  const waterRings = board.waterRings ?? 3;

  // Find all occupied positions
  const occupied = useMemo(() => {
    const set = new Set<string>();
    board.tiles.forEach(t => set.add(`${t.q},${t.r}`));
    return set;
  }, [board]);

  // Compute max ring from tile positions
  const maxRing = useMemo(() => {
    let mr = 0;
    board.tiles.forEach(t => {
      const d = Math.max(Math.abs(t.q), Math.abs(t.r), Math.abs(-t.q - t.r));
      if (d > mr) mr = d;
    });
    return mr;
  }, [board]);

  // Fill all empty positions within the board extent with water
  const fillWaterTiles = useMemo(() => {
    const tiles: [number, number][] = [];
    for (let q = -maxRing; q <= maxRing; q++) {
      for (let r = -maxRing; r <= maxRing; r++) {
        const s = -q - r;
        if (Math.max(Math.abs(q), Math.abs(r), Math.abs(s)) > maxRing) continue;
        if (!occupied.has(`${q},${r}`)) {
          tiles.push([q, r]);
        }
      }
    }
    return tiles;
  }, [maxRing, occupied]);

  // Also include explicitly defined water tiles
  const explicitWater = board.tiles.filter(t => t.type === 'water');

  return (
    <group ref={boardRef}>
      {/* Hex tiles with decorations as children */}
      {landTiles.map((tile, i) => {
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
                <PollenMotes seed={tileSeed} />
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
            {tile.number != null && (
              <NumberToken number={tile.number} position={[0, 1.0, 0]} />
            )}
          </HexTile>
        );
      })}

      {/* Fill water — all empty positions within the board */}
      {fillWaterTiles.map(([wq, wr], i) => {
        const [wx, wz] = axialToWorld(wq, wr);
        return (
          <AnimatedWaterTile
            key={`fill-water-${i}`}
            position={[wx, -0.05, wz]}
            seed={i * 73 + 500}
          />
        );
      })}

      {/* Explicit water tiles from board definition */}
      {explicitWater.map((tile, i) => {
        const [wx, wz] = axialToWorld(tile.q, tile.r);
        return (
          <AnimatedWaterTile
            key={`explicit-water-${i}`}
            position={[wx, -0.05, wz]}
            seed={i * 73 + 700}
          />
        );
      })}

      {/* Water rings — surrounding ocean */}
      {(() => {
        const dirs: [number, number][] = [
          [1, 0], [0, 1], [-1, 1], [-1, 0], [0, -1], [1, -1],
        ];
        const allWater: React.ReactElement[] = [];
        for (let ring = waterRings; ring <= waterRings + 2; ring++) {
          const waterTiles: [number, number][] = [];
          let q = ring, r = 0;
          for (let side = 0; side < 6; side++) {
            for (let step = 0; step < ring; step++) {
              waterTiles.push([q, r]);
              q += dirs[(side + 2) % 6][0];
              r += dirs[(side + 2) % 6][1];
            }
          }
          waterTiles.forEach(([wq, wr], i) => {
            const [wx, wz] = axialToWorld(wq, wr);
            allWater.push(
              <AnimatedWaterTile
                key={`water-${ring}-${i}`}
                position={[wx, -0.05, wz]}
                seed={ring * 100 + i * 73 + 999}
              />
            );
          });
        }
        return allWater;
      })()}

    </group>
  );
}

// ─── Main export ────────────────────────────────────────────────

// Slow auto-rotation wrapper for background mode
function SlowSpin({ children }: { children: React.ReactNode }) {
  const ref = useRef<THREE.Group>(null);
  useFrame((state) => {
    if (!ref.current) return;
    ref.current.rotation.y = state.clock.elapsedTime * 0.04;
  });
  return <group ref={ref}>{children}</group>;
}

// Smoothly moves camera to frame the board
function AutoFrameCamera({ distance, interactive }: { distance: number; interactive: boolean }) {
  useFrame((state) => {
    const cam = state.camera;
    const targetY = interactive ? distance * 0.85 : distance;
    const targetZ = interactive ? distance * 0.35 : distance * 0.4;
    cam.position.x += (0 - cam.position.x) * 0.02;
    cam.position.y += (targetY - cam.position.y) * 0.02;
    cam.position.z += (targetZ - cam.position.z) * 0.02;
    cam.lookAt(0, 0, 0);
  });
  return null;
}

export default function CatanBoard3D({ interactive = false, spinning = true, dimOverlay = true, board = STANDARD_BOARD }: { interactive?: boolean; spinning?: boolean; dimOverlay?: boolean; board?: BoardDefinition }) {
  // Background mode: pull camera back and up to show the full board
  // Auto-frame camera based on board extent
  const boardExtent = useMemo(() => {
    let maxD = 5;
    board.tiles.forEach(t => {
      const [x, z] = axialToWorld(t.q, t.r);
      const d = Math.sqrt(x * x + z * z);
      if (d > maxD) maxD = d;
    });
    return maxD;
  }, [board]);

  const camDist = boardExtent * 2.5 + 5;
  const bgCamera = { position: [0, camDist, camDist * 0.4] as [number, number, number], fov: 35 };
  const interactiveCamera = { position: [0, camDist * 0.85, camDist * 0.35] as [number, number, number], fov: 30 };
  const cam = interactive ? interactiveCamera : bgCamera;

  return (
    <div className={interactive ? 'catan-3d-interactive' : 'catan-3d-bg'}>
      <Canvas
        shadows
        gl={{ antialias: true, alpha: true }}
        camera={{ position: cam.position, fov: cam.fov }}
        style={{ background: interactive ? '#87CEEB' : 'transparent' }}
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

        {!interactive && <AutoFrameCamera distance={camDist} interactive={false} />}

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

        {interactive || !spinning ? (
          <BoardScene board={board} />
        ) : (
          <SlowSpin>
            <BoardScene board={board} />
          </SlowSpin>
        )}

        {/* Ocean floor */}
        <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.2, 0]} receiveShadow>
          <planeGeometry args={[80, 80]} />
          <meshStandardMaterial color="#1a6b8a" roughness={0.3} />
        </mesh>
      </Canvas>
      {!interactive && dimOverlay && <div className="catan-3d-overlay" />}
      {!interactive && !dimOverlay && <div className="catan-3d-overlay-light" />}
    </div>
  );
}
