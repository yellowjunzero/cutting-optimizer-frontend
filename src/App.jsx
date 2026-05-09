/**
 * App.jsx — 3D Guillotine Cutting Optimizer Visualizer
 * ======================================================
 * npm install @react-three/fiber @react-three/drei three
 *
 * Vite 환경:  npm create vite@latest cutting-viz -- --template react
 * CRA  환경:  npx create-react-app cutting-viz
 *
 * 이후 src/App.jsx 를 이 파일로 교체하고 실행:
 *   npm run dev  (Vite)
 *   npm start    (CRA)
 */

import { useState, useRef, useCallback, useMemo, Suspense } from "react";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import {
  OrbitControls,
  PerspectiveCamera,
  Grid,
  Html,
  Environment,
  useHelper,
} from "@react-three/drei";
import * as THREE from "three";

// ══════════════════════════════════════════════════════════════════
// 1. 상수 & 유틸리티
// ══════════════════════════════════════════════════════════════════

const API_URL = "https://cutting-optimizer-backend.onrender.com/optimize";

/** Part ID → 결정론적 색상 (HSL 골든 앵글 분산) */
function partColor(partId, allPartIds) {
  const idx = allPartIds.indexOf(partId);
  const hue = (idx * 137.508) % 360; // 황금각
  return `hsl(${hue}, 72%, 58%)`;
}

/** Three.js Color 객체로 변환 */
function hslToThreeColor(hslStr) {
  const c = new THREE.Color();
  c.setStyle(hslStr);
  return c;
}

/**
 * 스케일 팩터: Three.js scene 단위와 mm 단위 맞춤
 * 2440mm 원장이 scene에서 약 2.44 unit이 되도록
 */
const SCALE = 0.001;

/** 원장 간 오프셋 (scene unit) */
const STOCK_GAP = 0.4;

// ══════════════════════════════════════════════════════════════════
// 2. 기본 Request 데이터 (Swagger 예시와 동일)
// ══════════════════════════════════════════════════════════════════

const DEFAULT_REQUEST = {
  settings: {
    kerf: 3.0,
    trimming: { x: 10, y: 10, z: 0 },
    optimization_goal: "MINIMIZE_WASTE",
  },
  stocks: [{ id: "S1", l: 2440, w: 1220, t: 18, qty: 3 }],
  parts: [
    { id: "P1", l: 600, w: 400, t: 18, qty: 10, lock_z: true, allow_xy_rotation: true, priority: 0 },
    { id: "P2", l: 300, w: 200, t: 18, qty: 8,  lock_z: true, allow_xy_rotation: true, priority: 1 },
    { id: "P3", l: 800, w: 600, t: 18, qty: 3,  lock_z: true, allow_xy_rotation: false, priority: 2 },
  ],
};

// ══════════════════════════════════════════════════════════════════
// 3. 응답 데이터를 3D 배치 데이터로 변환
//    각 Stock ID별로 그룹핑 후 offset 부여
// ══════════════════════════════════════════════════════════════════

function buildSceneData(response, stocks) {
  if (!response?.placements) return { groups: [], stockMeshes: [] };

  // stock_id → index 매핑 (배치 순서 보존)
  const stockOrder = [];
  response.placements.forEach((p) => {
    if (!stockOrder.includes(p.stock_id)) stockOrder.push(p.stock_id);
  });

  // 원장 치수 맵 (stock_summaries 활용)
  const stockDimsMap = {};
  (response.stock_summaries || []).forEach((s) => {
    stockDimsMap[s.stock_id] = s.usable_dims;
  });

  // stocks input에서 원본 치수 보완
  stocks.forEach((s) => {
    if (!stockDimsMap[s.id]) {
      stockDimsMap[s.id] = { l: s.l, w: s.w, t: s.t };
    }
  });

  const allPartIds = [...new Set(response.placements.map((p) => p.part_id))];

  // 각 Stock 그룹에 Z 오프셋 부여
  const groups = stockOrder.map((stockId, stockIdx) => {
    const placements = response.placements.filter(
      (p) => p.stock_id === stockId
    );

    // 이전 원장들의 두께 + 간격을 누적한 Z 오프셋 계산
    let zOffset = 0;
    for (let i = 0; i < stockIdx; i++) {
      const prevId = stockOrder[i];
      const prevDims = stockDimsMap[prevId] || { t: 18 };
      zOffset += prevDims.t * SCALE + STOCK_GAP;
    }

    const boxes = placements.map((p) => ({
      nodeId: p.node_id,
      partId: p.part_id,
      // Three.js BoxGeometry는 중심 기준 → origin + dims/2 로 center 계산
      position: [
        (p.origin.x + p.placed_dims.l / 2) * SCALE,
        (p.origin.y + p.placed_dims.w / 2) * SCALE,
        (p.origin.z + p.placed_dims.t / 2) * SCALE + zOffset,
      ],
      size: [
        p.placed_dims.l * SCALE,
        p.placed_dims.w * SCALE,
        p.placed_dims.t * SCALE,
      ],
      color: hslToThreeColor(partColor(p.part_id, allPartIds)),
      hsl: partColor(p.part_id, allPartIds),
      label: `${p.part_id}  ${p.placed_dims.l}×${p.placed_dims.w}×${p.placed_dims.t}mm`,
      cutSteps: p.cut_history?.length ?? 0,
    }));

    // 원장 윤곽선 박스
    const dims = stockDimsMap[stockId] || { l: 2440, w: 1220, t: 18 };
    const stockMesh = {
      stockId,
      zOffset,
      position: [
        (dims.l / 2) * SCALE,
        (dims.w / 2) * SCALE,
        (dims.t / 2) * SCALE + zOffset,
      ],
      size: [dims.l * SCALE, dims.w * SCALE, dims.t * SCALE],
    };

    return { stockId, stockIdx, zOffset, boxes, stockMesh };
  });

  return { groups, allPartIds };
}

// ══════════════════════════════════════════════════════════════════
// 4. 개별 배치 박스 컴포넌트 (Hover 툴팁 포함)
// ══════════════════════════════════════════════════════════════════

function PlacedBox({ box, onHover }) {
  const meshRef = useRef();
  const [hovered, setHovered] = useState(false);

  useFrame(() => {
    if (!meshRef.current) return;
    // Hover 시 살짝 밝아지는 emissive 애니메이션
    const target = hovered ? 0.18 : 0.0;
    meshRef.current.material.emissiveIntensity = THREE.MathUtils.lerp(
      meshRef.current.material.emissiveIntensity,
      target,
      0.12
    );
  });

  return (
    <mesh
      ref={meshRef}
      position={box.position}
      onPointerOver={(e) => {
        e.stopPropagation();
        setHovered(true);
        onHover(box);
        document.body.style.cursor = "pointer";
      }}
      onPointerOut={() => {
        setHovered(false);
        onHover(null);
        document.body.style.cursor = "auto";
      }}
    >
      <boxGeometry args={box.size} />
      <meshStandardMaterial
        color={box.color}
        emissive={box.color}
        emissiveIntensity={0}
        roughness={0.35}
        metalness={0.08}
        transparent
        opacity={0.92}
      />
    </mesh>
  );
}

/** 박스 외곽선 (EdgeGeometry) */
function BoxEdges({ box, hovered }) {
  const color = hovered ? "#ffffff" : "#00000033";
  return (
    <lineSegments position={box.position}>
      <edgesGeometry args={[new THREE.BoxGeometry(...box.size)]} />
      <lineBasicMaterial color={color} transparent opacity={hovered ? 0.9 : 0.3} />
    </lineSegments>
  );
}

/** 원장 윤곽선 (점선 느낌의 EdgesGeometry) */
function StockOutline({ stockMesh, label }) {
  return (
    <group>
      <lineSegments position={stockMesh.position}>
        <edgesGeometry
          args={[new THREE.BoxGeometry(...stockMesh.size)]}
        />
        <lineBasicMaterial color="#4a9eff" transparent opacity={0.5} />
      </lineSegments>
      {/* 원장 레이블 */}
      <Html
        position={[
          stockMesh.position[0] - stockMesh.size[0] / 2,
          stockMesh.position[1] + stockMesh.size[1] / 2 + 0.05,
          stockMesh.position[2],
        ]}
        style={{ pointerEvents: "none" }}
      >
        <div
          style={{
            background: "rgba(10,20,40,0.82)",
            color: "#4a9eff",
            fontFamily: "'JetBrains Mono', monospace",
            fontSize: "11px",
            fontWeight: 600,
            padding: "3px 8px",
            borderRadius: "4px",
            border: "1px solid rgba(74,158,255,0.4)",
            whiteSpace: "nowrap",
            letterSpacing: "0.05em",
          }}
        >
          {label}
        </div>
      </Html>
    </group>
  );
}

// ══════════════════════════════════════════════════════════════════
// 5. 3D 씬 전체 컴포넌트
// ══════════════════════════════════════════════════════════════════

function Scene({ sceneData }) {
  const [hoveredBox, setHoveredBox] = useState(null);
  const { groups } = sceneData;

  // 전체 씬의 중심을 계산해 카메라가 중앙을 바라보게
  const sceneCenter = useMemo(() => {
    if (!groups.length) return [1.22, 0.61, 0];
    const allBoxes = groups.flatMap((g) => g.boxes);
    if (!allBoxes.length) return [1.22, 0.61, 0];
    const avgX = allBoxes.reduce((s, b) => s + b.position[0], 0) / allBoxes.length;
    const avgY = allBoxes.reduce((s, b) => s + b.position[1], 0) / allBoxes.length;
    const avgZ = allBoxes.reduce((s, b) => s + b.position[2], 0) / allBoxes.length;
    return [avgX, avgY, avgZ];
  }, [groups]);

  return (
    <>
      {/* 카메라 */}
      <PerspectiveCamera makeDefault position={[4, 3, 5]} fov={45} />
      <OrbitControls
        target={sceneCenter}
        enableDamping
        dampingFactor={0.06}
        minDistance={0.5}
        maxDistance={20}
      />

      {/* 조명 */}
      <ambientLight intensity={0.6} />
      <directionalLight
        position={[5, 8, 5]}
        intensity={1.4}
        castShadow
        shadow-mapSize={[2048, 2048]}
      />
      <directionalLight position={[-4, 3, -4]} intensity={0.4} color="#b0c8ff" />
      <pointLight position={[0, 6, 0]} intensity={0.3} color="#ffffff" />

      {/* 환경 반사 */}
      <Environment preset="city" />

      {/* 그리드 바닥 */}
      <Grid
        args={[20, 20]}
        position={[sceneCenter[0], -0.01, sceneCenter[2]]}
        cellSize={0.244}
        cellThickness={0.5}
        cellColor="#1e3a5f"
        sectionSize={2.44}
        sectionThickness={1}
        sectionColor="#2a5a8f"
        fadeDistance={15}
        fadeStrength={1}
        followCamera={false}
        infiniteGrid
      />

      {/* 원장 그룹별 렌더링 */}
      {groups.map((group) => (
        <group key={group.stockId}>
          {/* 원장 윤곽선 */}
          <StockOutline
            stockMesh={group.stockMesh}
            label={`Stock: ${group.stockId}  (${group.boxes.length} parts)`}
          />

          {/* 배치 박스들 */}
          {group.boxes.map((box) => (
            <group key={box.nodeId}>
              <PlacedBox
                box={box}
                onHover={setHoveredBox}
              />
              <BoxEdges box={box} hovered={hoveredBox?.nodeId === box.nodeId} />
            </group>
          ))}
        </group>
      ))}

      {/* 호버 툴팁 (3D Html 오버레이) */}
      {hoveredBox && (
        <Html position={hoveredBox.position} style={{ pointerEvents: "none" }}>
          <div
            style={{
              background: "rgba(5,15,30,0.95)",
              border: `1px solid ${hoveredBox.hsl}`,
              borderRadius: "6px",
              padding: "8px 12px",
              fontFamily: "'JetBrains Mono', monospace",
              fontSize: "12px",
              color: "#e8f0fe",
              whiteSpace: "nowrap",
              boxShadow: `0 0 12px ${hoveredBox.hsl}55`,
              transform: "translate(12px, -50%)",
            }}
          >
            <div style={{ color: hoveredBox.hsl, fontWeight: 700, marginBottom: 4 }}>
              {hoveredBox.partId}
            </div>
            <div style={{ opacity: 0.8 }}>{hoveredBox.label}</div>
            <div style={{ opacity: 0.5, fontSize: 10, marginTop: 4 }}>
              {hoveredBox.cutSteps} cuts · node {hoveredBox.nodeId}
            </div>
          </div>
        </Html>
      )}
    </>
  );
}

// ══════════════════════════════════════════════════════════════════
// 6. 범례 (Legend) 패널
// ══════════════════════════════════════════════════════════════════

function Legend({ allPartIds, stats }) {
  return (
    <div
      style={{
        position: "absolute",
        bottom: 24,
        left: 24,
        background: "rgba(5,12,28,0.88)",
        border: "1px solid rgba(74,158,255,0.25)",
        borderRadius: 10,
        padding: "14px 18px",
        fontFamily: "'JetBrains Mono', monospace",
        fontSize: 12,
        color: "#c8d8f0",
        backdropFilter: "blur(8px)",
        maxWidth: 240,
      }}
    >
      <div
        style={{
          fontSize: 10,
          letterSpacing: "0.12em",
          color: "#4a9eff",
          marginBottom: 10,
          textTransform: "uppercase",
        }}
      >
        Part Legend
      </div>
      {allPartIds.map((pid, i) => (
        <div
          key={pid}
          style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6 }}
        >
          <div
            style={{
              width: 12,
              height: 12,
              borderRadius: 3,
              background: partColor(pid, allPartIds),
              flexShrink: 0,
            }}
          />
          <span style={{ opacity: 0.9 }}>{pid}</span>
        </div>
      ))}

      {stats && (
        <div
          style={{
            marginTop: 14,
            paddingTop: 12,
            borderTop: "1px solid rgba(74,158,255,0.2)",
          }}
        >
          <StatRow label="Placed" value={stats.total_placed} />
          <StatRow label="Stocks used" value={stats.stocks_used} />
          <StatRow
            label="Efficiency"
            value={`${stats.overall_efficiency_pct}%`}
            highlight={stats.overall_efficiency_pct >= 85}
          />
          <StatRow
            label="Compute"
            value={`${(stats.processing_time_sec * 1000).toFixed(1)}ms`}
          />
        </div>
      )}
    </div>
  );
}

function StatRow({ label, value, highlight }) {
  return (
    <div
      style={{
        display: "flex",
        justifyContent: "space-between",
        gap: 16,
        marginBottom: 5,
        fontSize: 11,
      }}
    >
      <span style={{ opacity: 0.55 }}>{label}</span>
      <span style={{ color: highlight ? "#4ade80" : "#e8f0fe", fontWeight: 600 }}>
        {value}
      </span>
    </div>
  );
}

// ══════════════════════════════════════════════════════════════════
// 7. JSON 편집기 패널
// ══════════════════════════════════════════════════════════════════

function RequestEditor({ value, onChange, onRun, loading, error }) {
  const [open, setOpen] = useState(false);
  const [localText, setLocalText] = useState(
    JSON.stringify(value, null, 2)
  );
  const [parseError, setParseError] = useState(null);

  const handleChange = (e) => {
    setLocalText(e.target.value);
    try {
      const parsed = JSON.parse(e.target.value);
      setParseError(null);
      onChange(parsed);
    } catch {
      setParseError("JSON 파싱 오류");
    }
  };

  return (
    <div
      style={{
        position: "absolute",
        top: 24,
        right: 24,
        width: open ? 380 : 180,
        background: "rgba(5,12,28,0.92)",
        border: "1px solid rgba(74,158,255,0.25)",
        borderRadius: 10,
        overflow: "hidden",
        fontFamily: "'JetBrains Mono', monospace",
        backdropFilter: "blur(8px)",
        transition: "width 0.25s ease",
      }}
    >
      {/* 헤더 */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          padding: "10px 14px",
          borderBottom: open ? "1px solid rgba(74,158,255,0.2)" : "none",
          cursor: "pointer",
        }}
        onClick={() => setOpen((o) => !o)}
      >
        <span style={{ fontSize: 11, color: "#4a9eff", letterSpacing: "0.1em" }}>
          REQUEST EDITOR
        </span>
        <span style={{ color: "#4a9eff", fontSize: 14 }}>{open ? "▲" : "▼"}</span>
      </div>

      {open && (
        <div style={{ padding: "10px 14px 14px" }}>
          <textarea
            value={localText}
            onChange={handleChange}
            spellCheck={false}
            style={{
              width: "100%",
              height: 280,
              background: "rgba(0,10,25,0.7)",
              border: `1px solid ${parseError ? "#f87171" : "rgba(74,158,255,0.2)"}`,
              borderRadius: 6,
              color: "#c8d8f0",
              fontFamily: "'JetBrains Mono', monospace",
              fontSize: 11,
              padding: "8px",
              resize: "vertical",
              outline: "none",
              lineHeight: 1.5,
              boxSizing: "border-box",
            }}
          />
          {parseError && (
            <div style={{ color: "#f87171", fontSize: 10, marginTop: 4 }}>
              {parseError}
            </div>
          )}
        </div>
      )}

      {/* 실행 버튼 */}
      <div style={{ padding: "0 14px 14px" }}>
        <button
          onClick={onRun}
          disabled={loading || !!parseError}
          style={{
            width: "100%",
            padding: "9px 0",
            background: loading
              ? "rgba(74,158,255,0.15)"
              : "linear-gradient(135deg, #1a6bcc, #0f4a99)",
            border: "1px solid rgba(74,158,255,0.5)",
            borderRadius: 6,
            color: loading ? "#4a9eff99" : "#e8f0fe",
            fontFamily: "'JetBrains Mono', monospace",
            fontSize: 12,
            fontWeight: 700,
            letterSpacing: "0.08em",
            cursor: loading ? "not-allowed" : "pointer",
            transition: "all 0.15s",
          }}
        >
          {loading ? "▶ COMPUTING..." : "▶ OPTIMIZE"}
        </button>

        {error && (
          <div
            style={{
              marginTop: 8,
              padding: "6px 8px",
              background: "rgba(248,113,113,0.1)",
              border: "1px solid rgba(248,113,113,0.3)",
              borderRadius: 4,
              color: "#f87171",
              fontSize: 10,
              lineHeight: 1.4,
            }}
          >
            {error}
          </div>
        )}
      </div>
    </div>
  );
}

// ══════════════════════════════════════════════════════════════════
// 8. 타이틀 & 카메라 안내
// ══════════════════════════════════════════════════════════════════

function HUD() {
  return (
    <>
      {/* 타이틀 */}
      <div
        style={{
          position: "absolute",
          top: 24,
          left: 24,
          fontFamily: "'JetBrains Mono', monospace",
        }}
      >
        <div
          style={{
            fontSize: 18,
            fontWeight: 700,
            color: "#e8f0fe",
            letterSpacing: "-0.01em",
          }}
        >
          3D Cut Optimizer
        </div>
        <div style={{ fontSize: 11, color: "#4a9eff", opacity: 0.7, marginTop: 2 }}>
          Guillotine · Kerf · Trimming · OrientLock
        </div>
      </div>

      {/* 조작 안내 */}
      <div
        style={{
          position: "absolute",
          bottom: 24,
          right: 24,
          fontFamily: "'JetBrains Mono', monospace",
          fontSize: 10,
          color: "#4a9eff",
          opacity: 0.5,
          lineHeight: 1.8,
          textAlign: "right",
        }}
      >
        <div>Drag · Rotate</div>
        <div>Scroll · Zoom</div>
        <div>Right-drag · Pan</div>
      </div>
    </>
  );
}

// ══════════════════════════════════════════════════════════════════
// 9. 로딩 오버레이
// ══════════════════════════════════════════════════════════════════

function LoadingOverlay() {
  return (
    <div
      style={{
        position: "absolute",
        inset: 0,
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        background: "rgba(3,8,20,0.7)",
        backdropFilter: "blur(4px)",
        fontFamily: "'JetBrains Mono', monospace",
        color: "#4a9eff",
        gap: 16,
        zIndex: 10,
      }}
    >
      <div
        style={{
          width: 40,
          height: 40,
          border: "3px solid rgba(74,158,255,0.2)",
          borderTop: "3px solid #4a9eff",
          borderRadius: "50%",
          animation: "spin 0.8s linear infinite",
        }}
      />
      <div style={{ fontSize: 13, letterSpacing: "0.1em" }}>
        COMPUTING LAYOUT...
      </div>
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}

// ══════════════════════════════════════════════════════════════════
// 10. Empty State
// ══════════════════════════════════════════════════════════════════

function EmptyState() {
  return (
    <div
      style={{
        position: "absolute",
        inset: 0,
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        fontFamily: "'JetBrains Mono', monospace",
        color: "rgba(74,158,255,0.4)",
        gap: 12,
        pointerEvents: "none",
      }}
    >
      <div style={{ fontSize: 40, opacity: 0.3 }}>⬛</div>
      <div style={{ fontSize: 13, letterSpacing: "0.08em" }}>
        OPTIMIZE를 눌러 결과를 시각화하세요
      </div>
      <div style={{ fontSize: 10, opacity: 0.6 }}>
        우측 상단 패널에서 Stock / Part 파라미터를 수정할 수 있습니다
      </div>
    </div>
  );
}

// ══════════════════════════════════════════════════════════════════
// 11. 메인 App 컴포넌트
// ══════════════════════════════════════════════════════════════════

export default function App() {
  const [requestBody, setRequestBody] = useState(DEFAULT_REQUEST);
  const [response, setResponse] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  // API 호출
  const handleOptimize = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(API_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(requestBody),
      });

      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        throw new Error(
          errData.detail || errData.error || `HTTP ${res.status}`
        );
      }

      const data = await res.json();
      setResponse(data);
    } catch (e) {
      setError(
        e.message.includes("Failed to fetch")
          ? "서버에 연결할 수 없습니다. FastAPI 서버(localhost:8000)가 실행 중인지 확인하세요."
          : e.message
      );
    } finally {
      setLoading(false);
    }
  }, [requestBody]);

  // 3D 씬 데이터 계산
  const sceneData = useMemo(
    () => buildSceneData(response, requestBody.stocks),
    [response, requestBody.stocks]
  );

  const allPartIds = sceneData.allPartIds ?? [];
  const hasData = sceneData.groups?.length > 0;

  return (
    <div
      style={{
        width: "100vw",
        height: "100vh",
        background: "#030814",
        position: "relative",
        overflow: "hidden",
      }}
    >
      {/* Three.js Canvas */}
      <Canvas
        shadows
        gl={{ antialias: true, toneMapping: THREE.ACESFilmicToneMapping }}
        style={{ position: "absolute", inset: 0 }}
      >
        <color attach="background" args={["#030814"]} />
        <fog attach="fog" args={["#030814", 10, 30]} />

        <Suspense fallback={null}>
          {hasData ? (
            <Scene sceneData={sceneData} />
          ) : (
            /* 빈 상태에서도 OrbitControls + 카메라 유지 */
            <>
              <PerspectiveCamera makeDefault position={[4, 3, 5]} fov={45} />
              <OrbitControls enableDamping dampingFactor={0.06} />
              <ambientLight intensity={0.4} />
              <Grid
                args={[20, 20]}
                position={[1.22, -0.01, 0]}
                cellSize={0.244}
                cellColor="#0e1f3d"
                sectionSize={2.44}
                sectionColor="#1a3a6a"
                fadeDistance={15}
                infiniteGrid
              />
            </>
          )}
        </Suspense>
      </Canvas>

      {/* UI 오버레이 레이어 */}
      <HUD />

      {loading && <LoadingOverlay />}
      {!loading && !hasData && <EmptyState />}

      {hasData && !loading && (
        <Legend allPartIds={allPartIds} stats={response?.stats} />
      )}

      <RequestEditor
        value={requestBody}
        onChange={setRequestBody}
        onRun={handleOptimize}
        loading={loading}
        error={error}
      />
    </div>
  );
}
