import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { Float, Points, PointMaterial } from "@react-three/drei";
import { useMemo, useRef } from "react";
import * as THREE from "three";

function CameraRig() {
  const { camera, pointer } = useThree();
  useFrame((state, delta) => {
    const t = state.clock.elapsedTime;
    const targetX = pointer.x * 1.6 + Math.sin(t * 0.12) * 0.4;
    const targetY = 0.4 + pointer.y * 0.9 + Math.cos(t * 0.1) * 0.25;
    camera.position.x += (targetX - camera.position.x) * Math.min(1, delta * 2);
    camera.position.y += (targetY - camera.position.y) * Math.min(1, delta * 2);
    camera.lookAt(0, 0, 0);
  });
  return null;
}

function Node({ position, color }: { position: [number, number, number]; color: string }) {
  const ref = useRef<THREE.Mesh>(null);
  useFrame((state) => {
    if (!ref.current) return;
    const pulse = 1 + Math.sin(state.clock.elapsedTime * 1.6 + position[0]) * 0.12;
    ref.current.scale.setScalar(pulse);
  });
  return (
    <mesh ref={ref} position={position}>
      <icosahedronGeometry args={[0.16, 1]} />
      <meshBasicMaterial color={color} toneMapped={false} />
    </mesh>
  );
}

function GlassCard({
  position,
  rotation,
  color,
}: {
  position: [number, number, number];
  rotation: [number, number, number];
  color: string;
}) {
  return (
    <Float speed={1.1} rotationIntensity={0.35} floatIntensity={0.8}>
      <mesh position={position} rotation={rotation}>
        <planeGeometry args={[0.95, 1.7]} />
        <meshBasicMaterial color={color} transparent opacity={0.16} side={THREE.DoubleSide} />
      </mesh>
      <mesh position={[position[0], position[1], position[2] - 0.01]} rotation={rotation}>
        <planeGeometry args={[1.02, 1.78]} />
        <meshBasicMaterial color={color} transparent opacity={0.35} wireframe side={THREE.DoubleSide} />
      </mesh>
    </Float>
  );
}

function Grid() {
  const ref = useRef<THREE.LineSegments>(null);
  const geometry = useMemo(() => {
    const g = new THREE.PlaneGeometry(40, 40, 32, 32);
    return new THREE.WireframeGeometry(g);
  }, []);
  useFrame((state) => {
    if (!ref.current) return;
    ref.current.position.z = (state.clock.elapsedTime * 0.6) % 1.25;
  });
  return (
    <lineSegments ref={ref} geometry={geometry} rotation={[-Math.PI / 2, 0, 0]} position={[0, -2.2, 0]}>
      <lineBasicMaterial color="#3b2bd6" transparent opacity={0.28} />
    </lineSegments>
  );
}

function Particles() {
  const positions = useMemo(() => {
    const count = 700;
    const arr = new Float32Array(count * 3);
    for (let i = 0; i < count; i += 1) {
      arr[i * 3] = (Math.random() - 0.5) * 22;
      arr[i * 3 + 1] = (Math.random() - 0.5) * 12;
      arr[i * 3 + 2] = (Math.random() - 0.5) * 18;
    }
    return arr;
  }, []);
  const ref = useRef<THREE.Points>(null);
  useFrame((state) => {
    if (ref.current) ref.current.rotation.y = state.clock.elapsedTime * 0.02;
  });
  return (
    <Points ref={ref} positions={positions} stride={3}>
      <PointMaterial transparent size={0.035} color="#8b7bff" sizeAttenuation depthWrite={false} opacity={0.75} />
    </Points>
  );
}

export default function Hero3D() {
  return (
    <Canvas
      camera={{ position: [0, 0.4, 6.5], fov: 55 }}
      dpr={[1, 1.5]}
      frameloop="always"
      gl={{ antialias: false, powerPreference: "low-power" }}
      style={{ position: "absolute", inset: 0 }}
    >
      <color attach="background" args={["#05030f"]} />
      <fog attach="fog" args={["#05030f", 8, 22]} />
      <CameraRig />
      <Grid />
      <Particles />
      <GlassCard position={[-2.6, 0.2, -0.6]} rotation={[0, 0.35, 0.05]} color="#7c5cff" />
      <GlassCard position={[2.6, -0.1, -0.9]} rotation={[0, -0.38, -0.05]} color="#29d3ff" />
      <GlassCard position={[0.2, 0.9, -2.2]} rotation={[0, 0.05, 0.02]} color="#ff5ca8" />
      <Node position={[-1.5, 1.2, 0.4]} color="#29d3ff" />
      <Node position={[1.8, 1.4, -0.6]} color="#7c5cff" />
      <Node position={[-2.1, -1.2, -0.2]} color="#ff5ca8" />
      <Node position={[2.2, -1.4, 0.3]} color="#29d3ff" />
      <Node position={[0, -0.6, 1.2]} color="#a78bfa" />
    </Canvas>
  );
}
