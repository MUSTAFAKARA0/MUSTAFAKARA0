import { Component, Suspense, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { Canvas } from "@react-three/fiber";
import { Bounds, Grid, OrbitControls, useGLTF, useBounds, Center, type BoundsApi } from "@react-three/drei";
import * as THREE from "three";

class ViewerErrorBoundary extends Component<{ children: ReactNode }, { failed: boolean }> {
  state = { failed: false };
  static getDerivedStateFromError() {
    return { failed: true };
  }
  render() {
    if (this.state.failed) {
      return (
        <div style={{ padding: 24, color: "var(--text-dim)", fontSize: "0.85rem" }}>
          3D önizleme bu tarayıcıda yüklenemedi (WebGL desteklenmiyor olabilir). STL dosyasını yine de
          aşağıdan indirebilirsiniz.
        </div>
      );
    }
    return this.props.children;
  }
}

function BoundsApiBridge({ apiRef }: { apiRef: React.MutableRefObject<BoundsApi | null> }) {
  const api = useBounds();
  useEffect(() => {
    apiRef.current = api;
  }, [api, apiRef]);
  return null;
}

function ModelMesh({ url, wireframe }: { url: string; wireframe: boolean }) {
  const { scene } = useGLTF(url);

  const cloned = useMemo(() => {
    const clone = scene.clone(true);
    clone.traverse((obj) => {
      const mesh = obj as THREE.Mesh;
      if ((mesh as THREE.Mesh).isMesh) {
        mesh.material = new THREE.MeshStandardMaterial({
          color: "#7aa8ff",
          metalness: 0.15,
          roughness: 0.55,
          wireframe,
          side: THREE.DoubleSide,
        });
        mesh.castShadow = true;
        mesh.receiveShadow = true;
      }
    });
    return clone;
  }, [scene, wireframe]);

  // backend mesh convention is Z-up (Z = height, sits at z=0), glTF/three.js
  // scenes are Y-up -- rotate -90deg on X so the model's real "up" axis
  // matches the viewer's up axis and sits on the y=0 print-bed grid.
  return (
    <group rotation={[-Math.PI / 2, 0, 0]}>
      <primitive object={cloned} />
    </group>
  );
}

interface Props {
  url: string;
}

export default function Viewer3D({ url }: Props) {
  const [wireframe, setWireframe] = useState(false);
  const [showBed, setShowBed] = useState(true);
  const boundsRef = useRef<BoundsApi | null>(null);

  const refit = () => boundsRef.current?.refresh().fit();

  return (
    <div className="viewer-wrap">
      <div className="viewer-toolbar">
        <div className="group">
          <button className={!wireframe ? "active" : ""} onClick={() => setWireframe(false)}>Solid</button>
          <button className={wireframe ? "active" : ""} onClick={() => setWireframe(true)}>Wireframe</button>
        </div>
        <div className="group">
          <button onClick={refit}>Ortala</button>
          <button onClick={refit}>Tabana Oturt</button>
          <button className={showBed ? "active" : ""} onClick={() => setShowBed((v) => !v)}>
            Destek Yüzeyi
          </button>
        </div>
      </div>

      <ViewerErrorBoundary>
        <Canvas shadows camera={{ position: [140, 120, 160], fov: 42, near: 0.1, far: 5000 }}>
          <color attach="background" args={["#05080d"]} />
          {/* Self-contained studio-style lighting (no external HDR fetch, so
              the viewer works fully offline / behind restrictive networks). */}
          <ambientLight intensity={0.6} />
          <directionalLight position={[120, 200, 100]} intensity={1.15} castShadow />
          <directionalLight position={[-120, 80, -80]} intensity={0.35} />
          <pointLight position={[0, 60, 0]} intensity={0.25} />
          <Suspense fallback={null}>
            <Bounds fit clip observe margin={1.35}>
              <BoundsApiBridge apiRef={boundsRef} />
              <Center>
                <ModelMesh url={url} wireframe={wireframe} />
              </Center>
            </Bounds>
          </Suspense>
          {showBed && (
            <Grid
              position={[0, 0, 0]}
              args={[10, 10]}
              cellSize={10}
              cellThickness={0.5}
              sectionSize={50}
              sectionThickness={1}
              sectionColor={"#3f5b8c"}
              cellColor={"#233046"}
              infiniteGrid
              fadeDistance={800}
            />
          )}
          <OrbitControls makeDefault enableDamping dampingFactor={0.08} />
        </Canvas>
      </ViewerErrorBoundary>
    </div>
  );
}
