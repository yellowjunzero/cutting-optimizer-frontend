/**
 * App.jsx — 3D Guillotine Cutting Optimizer Visualizer  (v4 — UX Polish)
 * ========================================================================
 * npm install @react-three/fiber @react-three/drei three
 *
 * Vite:  npm create vite@latest cutting-viz -- --template react
 *        → src/App.jsx 교체 후  npm run dev
 * CRA:   npx create-react-app cutting-viz
 *        → src/App.jsx 교체 후  npm start
 *
 * 변경 이력 (v4)
 *  [1] 입력 필드 순서  T(두께) → W(폭) → L(길이) → Qty
 *  [2] 카메라 좌측 오프셋  — 사이드바 292px 보정 (-0.73 unit)
 *  [3] StockOutline  usable_dims 기준으로 크기·위치 보정
 *  [4] 작업 지시서(Cut List) 모달 추가
 */

import { useState, useRef, useCallback, useMemo, Suspense, useEffect } from "react";
import { Canvas, useFrame } from "@react-three/fiber";
import { OrbitControls, PerspectiveCamera, Grid, Html, Environment } from "@react-three/drei";
import * as THREE from "three";

// ══════════════════════════════════════════════════════════════════
// GLOBAL CSS
// ══════════════════════════════════════════════════════════════════

const GLOBAL_CSS = `
  @import url('https://fonts.googleapis.com/css2?family=JetBrains+Mono:wght@300;400;500;600;700&display=swap');

  *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }

  :root {
    --bg:        #030814;
    --panel:     rgba(6, 14, 32, 0.96);
    --border:    rgba(74, 158, 255, 0.16);
    --border-hi: rgba(74, 158, 255, 0.42);
    --blue:      #4a9eff;
    --blue-dim:  rgba(74, 158, 255, 0.10);
    --text:      #c8d8f0;
    --text-dim:  rgba(200, 216, 240, 0.42);
    --red:       #f87171;
    --green:     #4ade80;
    --amber:     #fbbf24;
    --mono:      'JetBrains Mono', monospace;
    --sidebar-w: 292px;
  }

  body { background: var(--bg); overflow: hidden; }

  ::-webkit-scrollbar { width: 3px; }
  ::-webkit-scrollbar-track { background: transparent; }
  ::-webkit-scrollbar-thumb { background: rgba(74,158,255,0.28); border-radius: 2px; }

  @keyframes spin    { to { transform: rotate(360deg); } }
  @keyframes fadeUp  { from { opacity:0; transform:translateY(6px); } to { opacity:1; transform:none; } }
  @keyframes slideIn { from { opacity:0; transform:translateX(32px); } to { opacity:1; transform:none; } }
  @keyframes bgFade  { from { opacity:0; } to { opacity:1; } }

  /* ── Base input ── */
  .fi {
    width: 100%;
    background: rgba(0, 8, 22, 0.78);
    border: 1px solid var(--border);
    border-radius: 5px;
    color: var(--text);
    font-family: var(--mono);
    font-size: 12px;
    padding: 6px 8px;
    outline: none;
    transition: border-color 0.15s, box-shadow 0.15s;
    -webkit-appearance: none;
  }
  .fi:focus { border-color: var(--blue); box-shadow: 0 0 0 2px rgba(74,158,255,0.1); }
  .fi::placeholder { color: var(--text-dim); }
  .fi[type=number]::-webkit-inner-spin-button { opacity: 0.3; }

  /* ── Checkbox ── */
  .fc {
    appearance: none;
    width: 14px; height: 14px;
    border: 1px solid var(--border-hi);
    border-radius: 3px;
    background: rgba(0,8,22,0.78);
    cursor: pointer;
    flex-shrink: 0;
    position: relative;
    transition: all 0.12s;
    margin-top: 1px;
  }
  .fc:checked { background: var(--blue); border-color: var(--blue); }
  .fc:checked::after {
    content: '';
    position: absolute;
    left: 3px; top: 1px;
    width: 5px; height: 8px;
    border: 1.8px solid #03080e;
    border-top: none; border-left: none;
    transform: rotate(45deg);
  }

  /* ── Section label ── */
  .slabel {
    font-family: var(--mono);
    font-size: 9px; font-weight: 700;
    letter-spacing: 0.16em; text-transform: uppercase;
    color: var(--blue); margin-bottom: 8px;
    display: flex; align-items: center; gap: 7px;
  }
  .slabel::after { content:''; flex:1; height:1px; background: var(--border); }

  /* ── Card ── */
  .card {
    background: rgba(0, 8, 22, 0.52);
    border: 1px solid var(--border);
    border-radius: 7px;
    padding: 10px 11px;
    margin-bottom: 6px;
    animation: fadeUp 0.18s ease;
    transition: border-color 0.15s;
  }
  .card:hover { border-color: rgba(74,158,255,0.28); }

  /* ── Grid helpers ── */
  .g2 { display: grid; grid-template-columns: 1fr 1fr; gap: 6px; }
  .g4 { display: grid; grid-template-columns: 1fr 1fr 1fr 1fr; gap: 4px; }

  /* ── Micro-label ── */
  .mlabel { font-family: var(--mono); font-size: 8px; letter-spacing: 0.06em; color: var(--text-dim); margin-bottom: 3px; }
  .mlabel .u { color: rgba(74,158,255,0.65); margin-left: 2px; }

  /* ── Buttons ── */
  .del {
    background: rgba(248,113,113,0.07);
    border: 1px solid rgba(248,113,113,0.18);
    border-radius: 4px; color: var(--red);
    font-size: 11px; width: 22px; height: 22px;
    cursor: pointer; display: flex; align-items: center; justify-content: center;
    flex-shrink: 0; transition: all 0.12s; font-family: var(--mono); line-height:1;
  }
  .del:hover { background: rgba(248,113,113,0.16); border-color: rgba(248,113,113,0.45); }

  .add {
    width: 100%; padding: 8px 0;
    background: var(--blue-dim);
    border: 1px dashed rgba(74,158,255,0.32);
    border-radius: 6px; color: var(--blue);
    font-family: var(--mono); font-size: 11px; font-weight: 600;
    letter-spacing: 0.05em; cursor: pointer; transition: all 0.14s;
  }
  .add:hover { background: rgba(74,158,255,0.17); border-color: var(--blue); }

  /* ── Tag ── */
  .tag {
    display: inline-flex; align-items: center;
    padding: 1px 6px; border-radius: 3px;
    font-size: 9px; font-weight: 600;
    letter-spacing: 0.07em; font-family: var(--mono);
  }
  .tb { background: rgba(74,158,255,0.1); color:var(--blue); border:1px solid rgba(74,158,255,0.22); }
  .tg { background: rgba(74,222,128,0.08); color:var(--green); border:1px solid rgba(74,222,128,0.22); }

  /* ── Optimize button ── */
  .opt {
    width: 100%; padding: 13px 0;
    background: linear-gradient(135deg, #1560c8 0%, #0c3d8a 100%);
    border: 1px solid rgba(74,158,255,0.55);
    border-radius: 8px; color: #e8f0fe;
    font-family: var(--mono); font-size: 13px; font-weight: 700;
    letter-spacing: 0.09em; cursor: pointer;
    transition: all 0.16s; position: relative; overflow: hidden;
    box-shadow: 0 3px 18px rgba(21,96,200,0.3);
  }
  .opt::before {
    content:''; position:absolute; inset:0;
    background: linear-gradient(135deg, rgba(255,255,255,0.07) 0%, transparent 55%);
    pointer-events:none;
  }
  .opt:hover:not(:disabled) {
    background: linear-gradient(135deg, #1a70e0 0%, #1050b0 100%);
    box-shadow: 0 4px 26px rgba(74,158,255,0.38);
    transform: translateY(-1px);
  }
  .opt:active:not(:disabled) { transform: translateY(0); }
  .opt:disabled {
    background: rgba(74,158,255,0.08);
    border-color: rgba(74,158,255,0.16);
    color: rgba(74,158,255,0.32);
    cursor: not-allowed; box-shadow: none;
  }

  /* ── Cut-list button ── */
  .cutlist-btn {
    width: 100%; padding: 9px 0;
    background: rgba(251,191,36,0.07);
    border: 1px solid rgba(251,191,36,0.28);
    border-radius: 7px; color: var(--amber);
    font-family: var(--mono); font-size: 12px; font-weight: 600;
    letter-spacing: 0.06em; cursor: pointer; transition: all 0.15s;
    display: flex; align-items: center; justify-content: center; gap: 7px;
  }
  .cutlist-btn:hover {
    background: rgba(251,191,36,0.14);
    border-color: rgba(251,191,36,0.5);
    box-shadow: 0 0 14px rgba(251,191,36,0.15);
  }
  .cutlist-btn:disabled { opacity: 0.3; cursor: not-allowed; }

  /* ── Modal backdrop ── */
  .modal-backdrop {
    position: fixed; inset: 0; z-index: 100;
    background: rgba(1, 5, 16, 0.82);
    backdrop-filter: blur(6px);
    display: flex; align-items: center; justify-content: center;
    animation: bgFade 0.2s ease;
  }

  /* ── Modal panel ── */
  .modal-panel {
    background: rgba(6, 14, 34, 0.98);
    border: 1px solid rgba(74,158,255,0.25);
    border-radius: 14px;
    width: min(780px, 96vw);
    max-height: 88vh;
    display: flex; flex-direction: column;
    box-shadow: 0 24px 80px rgba(0,0,0,0.7), 0 0 0 1px rgba(74,158,255,0.08);
    animation: slideIn 0.22s ease;
  }

  /* ── Cut table ── */
  .cut-table {
    width: 100%; border-collapse: collapse;
    font-family: var(--mono); font-size: 11px;
  }
  .cut-table th {
    background: rgba(74,158,255,0.07);
    color: var(--blue); font-size: 9px; font-weight: 700;
    letter-spacing: 0.1em; text-transform: uppercase;
    padding: 8px 10px; text-align: left;
    border-bottom: 1px solid var(--border);
    white-space: nowrap;
  }
  .cut-table td {
    padding: 7px 10px; color: var(--text);
    border-bottom: 1px solid rgba(74,158,255,0.06);
    vertical-align: middle; line-height: 1.4;
  }
  .cut-table tr:last-child td { border-bottom: none; }
  .cut-table tr:hover td { background: rgba(74,158,255,0.04); }

  /* ── Step badge ── */
  .step-badge {
    display: inline-flex; align-items: center; justify-content: center;
    width: 22px; height: 22px; border-radius: 50%;
    background: rgba(74,158,255,0.12);
    border: 1px solid rgba(74,158,255,0.28);
    color: var(--blue); font-size: 10px; font-weight: 700;
    font-family: var(--mono); flex-shrink: 0;
  }

  /* ── Axis pill ── */
  .axis-x { background: rgba(239,68,68,0.12); color:#f87171; border:1px solid rgba(239,68,68,0.25); }
  .axis-y { background: rgba(74,222,128,0.1); color:var(--green); border:1px solid rgba(74,222,128,0.22); }
  .axis-z { background: rgba(96,165,250,0.12); color:#60a5fa; border:1px solid rgba(96,165,250,0.25); }
`;

// ══════════════════════════════════════════════════════════════════
// 1. 상수 & 유틸리티
// ══════════════════════════════════════════════════════════════════

const API_URL   = "https://cutting-optimizer-backend.onrender.com/optimize";
const SCALE     = 0.001;
const STOCK_GAP = 0.4;

// [2] 사이드바 292px → scene unit 오프셋 (캔버스 폭의 ~15% 보정)
const CAM_X_OFFSET = -0.73;

let _uid = 0;
const uid = () => `u${++_uid}`;

function partColor(partId, allPartIds) {
  const idx = allPartIds.indexOf(partId);
  const hue = (idx * 137.508) % 360;
  return `hsl(${hue}, 70%, 58%)`;
}
function toThreeColor(hsl) { return new THREE.Color().setStyle(hsl); }

// ══════════════════════════════════════════════════════════════════
// 2. 기본 상태
// ══════════════════════════════════════════════════════════════════

const DEFAULT_SETTINGS = { kerf: 3.0, trimming: { x: 10, y: 10, z: 0 } };
const DEFAULT_STOCKS   = [{ _uid:"s1", id:"S1", l:2440, w:1220, t:18, qty:3 }];
const DEFAULT_PARTS    = [
  { _uid:"p1", id:"P1", l:600, w:400, t:18, qty:10, lock_z:true,  allow_xy_rotation:true  },
  { _uid:"p2", id:"P2", l:300, w:200, t:18, qty:8,  lock_z:true,  allow_xy_rotation:true  },
  { _uid:"p3", id:"P3", l:800, w:600, t:18, qty:3,  lock_z:true,  allow_xy_rotation:false },
];

// ══════════════════════════════════════════════════════════════════
// 3. buildSceneData  (usable_dims 기준 StockOutline 보정 포함)
// ══════════════════════════════════════════════════════════════════

function buildSceneData(response, stocks, trimming) {
  if (!response?.placements) return { groups: [], allPartIds: [] };

  const stockOrder = [];
  response.placements.forEach((p) => {
    if (!stockOrder.includes(p.stock_id)) stockOrder.push(p.stock_id);
  });

  // usable_dims: stock_summaries 우선, 없으면 직접 계산
  const usableMap = {};
  (response.stock_summaries || []).forEach((s) => { usableMap[s.stock_id] = s.usable_dims; });
  stocks.forEach((s) => {
    if (!usableMap[s.id]) {
      usableMap[s.id] = {
        l: s.l - 2 * (trimming?.x ?? 0),
        w: s.w - 2 * (trimming?.y ?? 0),
        t: s.t - 2 * (trimming?.z ?? 0),
      };
    }
  });

  const allPartIds = [...new Set(response.placements.map((p) => p.part_id))];

  const groups = stockOrder.map((stockId, si) => {
    const pls = response.placements.filter((p) => p.stock_id === stockId);

    let zOff = 0;
    for (let i = 0; i < si; i++) {
      const d = usableMap[stockOrder[i]] || { t: 18 };
      zOff += d.t * SCALE + STOCK_GAP;
    }

    const boxes = pls.map((p) => ({
      nodeId:   p.node_id,
      partId:   p.part_id,
      position: [
        (p.origin.x + p.placed_dims.l / 2) * SCALE,
        (p.origin.y + p.placed_dims.w / 2) * SCALE,
        (p.origin.z + p.placed_dims.t / 2) * SCALE + zOff,
      ],
      size:  [p.placed_dims.l * SCALE, p.placed_dims.w * SCALE, p.placed_dims.t * SCALE],
      color: toThreeColor(partColor(p.part_id, allPartIds)),
      hsl:   partColor(p.part_id, allPartIds),
      label: `${p.part_id}  ${p.placed_dims.l}×${p.placed_dims.w}×${p.placed_dims.t}mm`,
      cuts:  p.cut_history?.length ?? 0,
    }));

    // [3] StockOutline: usable_dims 크기 + trimming 오프셋 반영
    const ud = usableMap[stockId] || { l:2440, w:1220, t:18 };
    const tx = trimming?.x ?? 0, ty = trimming?.y ?? 0, tz = trimming?.z ?? 0;
    const stockMesh = {
      stockId, zOff,
      // 중심 = trimming 오프셋 + usable_dim / 2
      position: [
        (tx + ud.l / 2) * SCALE,
        (ty + ud.w / 2) * SCALE,
        (tz + ud.t / 2) * SCALE + zOff,
      ],
      size: [ud.l * SCALE, ud.w * SCALE, ud.t * SCALE],
    };

    return { stockId, boxes, stockMesh };
  });

  return { groups, allPartIds };
}

// ══════════════════════════════════════════════════════════════════
// 4. 작업 지시서 데이터 빌드
// ══════════════════════════════════════════════════════════════════

/**
 * response.placements → 원장별 절단 단계 배열 생성
 *
 * 동일 cut_id는 같은 "물리적 절단 1회"를 의미하므로
 * cut_id로 dedup 후 stock_id + step 순으로 정렬합니다.
 */
function buildCutList(response) {
  if (!response?.placements) return [];

  // cut_id → cut 기록 (중복 제거)
  const cutMap = new Map();
  // cut_id → stock_id 역매핑
  const cutStock = new Map();

  response.placements.forEach((p) => {
    (p.cut_history || []).forEach((cut) => {
      if (!cutMap.has(cut.cut_id)) {
        cutMap.set(cut.cut_id, cut);
        cutStock.set(cut.cut_id, p.stock_id);
      }
    });
  });

  // 원장별 그룹화
  const byStock = {};
  cutMap.forEach((cut, cutId) => {
    const sid = cutStock.get(cutId);
    if (!byStock[sid]) byStock[sid] = [];
    byStock[sid].push(cut);
  });

  // 각 원장 내에서 step 번호 부여 (parent_node_id depth 기준 대신 삽입 순서 그대로)
  return Object.entries(byStock).map(([stockId, cuts]) => ({
    stockId,
    cuts: cuts.map((c, i) => ({ ...c, step: i + 1 })),
  }));
}

// ══════════════════════════════════════════════════════════════════
// 5. 3D 컴포넌트
// ══════════════════════════════════════════════════════════════════

function PlacedBox({ box, onHover }) {
  const ref = useRef();
  const [hov, setHov] = useState(false);

  useFrame(() => {
    if (!ref.current) return;
    ref.current.material.emissiveIntensity = THREE.MathUtils.lerp(
      ref.current.material.emissiveIntensity, hov ? 0.18 : 0, 0.12
    );
  });

  return (
    <mesh
      ref={ref} position={box.position}
      onPointerOver={(e) => { e.stopPropagation(); setHov(true); onHover(box); document.body.style.cursor="pointer"; }}
      onPointerOut={() => { setHov(false); onHover(null); document.body.style.cursor="auto"; }}
    >
      <boxGeometry args={box.size} />
      <meshStandardMaterial
        color={box.color} emissive={box.color} emissiveIntensity={0}
        roughness={0.35} metalness={0.08} transparent opacity={0.92}
      />
    </mesh>
  );
}

function BoxEdges({ box, hi }) {
  return (
    <lineSegments position={box.position}>
      <edgesGeometry args={[new THREE.BoxGeometry(...box.size)]} />
      <lineBasicMaterial color={hi ? "#ffffff" : "#00000033"} transparent opacity={hi ? 0.9 : 0.25} />
    </lineSegments>
  );
}

// [3] StockOutline — usable_dims 기준 위치/크기 적용
function StockOutline({ sm, label }) {
  return (
    <group>
      <lineSegments position={sm.position}>
        <edgesGeometry args={[new THREE.BoxGeometry(...sm.size)]} />
        <lineBasicMaterial color="#4a9eff" transparent opacity={0.45} />
      </lineSegments>
      <Html
        position={[sm.position[0] - sm.size[0]/2, sm.position[1] + sm.size[1]/2 + 0.06, sm.position[2]]}
        style={{ pointerEvents:"none" }}
      >
        <div style={{
          background:"rgba(10,20,42,0.88)", color:"#4a9eff",
          fontFamily:"var(--mono)", fontSize:"11px", fontWeight:600,
          padding:"3px 8px", borderRadius:"4px",
          border:"1px solid rgba(74,158,255,0.38)", whiteSpace:"nowrap",
        }}>
          {label}
        </div>
      </Html>
    </group>
  );
}

// [2] Scene — 카메라·OrbitControls 에 CAM_X_OFFSET 적용
function Scene({ sceneData }) {
  const [hov, setHov] = useState(null);
  const { groups } = sceneData;

  const rawCenter = useMemo(() => {
    const all = groups.flatMap((g) => g.boxes);
    if (!all.length) return [1.22, 0.61, 0];
    return [
      all.reduce((s,b) => s+b.position[0], 0) / all.length,
      all.reduce((s,b) => s+b.position[1], 0) / all.length,
      all.reduce((s,b) => s+b.position[2], 0) / all.length,
    ];
  }, [groups]);

  // 사이드바 때문에 씬이 우측 쏠림 → target을 왼쪽으로 offset
  const target   = [rawCenter[0] + CAM_X_OFFSET, rawCenter[1], rawCenter[2]];
  const camStart = [rawCenter[0] + CAM_X_OFFSET + 4, rawCenter[1] + 3, rawCenter[2] + 5];

  return (
    <>
      <PerspectiveCamera makeDefault position={camStart} fov={45} />
      <OrbitControls
        target={target}
        enableDamping dampingFactor={0.06}
        minDistance={0.5} maxDistance={24}
      />
      <ambientLight intensity={0.6} />
      <directionalLight position={[5,8,5]} intensity={1.4} castShadow shadow-mapSize={[2048,2048]} />
      <directionalLight position={[-4,3,-4]} intensity={0.4} color="#b0c8ff" />
      <Environment preset="city" />
      <Grid
        args={[24,24]} position={[rawCenter[0], -0.01, rawCenter[2]]}
        cellSize={0.244} cellThickness={0.5} cellColor="#1a3558"
        sectionSize={2.44} sectionThickness={1} sectionColor="#254d80"
        fadeDistance={16} fadeStrength={1} followCamera={false} infiniteGrid
      />

      {groups.map((g) => (
        <group key={g.stockId}>
          <StockOutline sm={g.stockMesh} label={`Stock: ${g.stockId}  (${g.boxes.length}개)`} />
          {g.boxes.map((box) => (
            <group key={box.nodeId}>
              <PlacedBox box={box} onHover={setHov} />
              <BoxEdges box={box} hi={hov?.nodeId === box.nodeId} />
            </group>
          ))}
        </group>
      ))}

      {hov && (
        <Html position={hov.position} style={{ pointerEvents:"none" }}>
          <div style={{
            background:"rgba(4,12,28,0.96)", border:`1px solid ${hov.hsl}`,
            borderRadius:6, padding:"8px 12px",
            fontFamily:"var(--mono)", fontSize:12, color:"#e8f0fe",
            whiteSpace:"nowrap", transform:"translate(14px,-50%)",
            boxShadow:`0 0 14px ${hov.hsl}44`,
          }}>
            <div style={{ color:hov.hsl, fontWeight:700, marginBottom:4 }}>{hov.partId}</div>
            <div style={{ opacity:0.8 }}>{hov.label}</div>
            <div style={{ opacity:0.45, fontSize:10, marginTop:4 }}>{hov.cuts} cuts · {hov.nodeId}</div>
          </div>
        </Html>
      )}
    </>
  );
}

// ══════════════════════════════════════════════════════════════════
// 6. Legend (뷰어 우하단)
// ══════════════════════════════════════════════════════════════════

function Legend({ allPartIds, stats }) {
  return (
    <div style={{
      position:"absolute", bottom:20, right:20, zIndex:5,
      background:"rgba(5,12,28,0.92)", border:"1px solid var(--border)",
      borderRadius:9, padding:"13px 15px",
      fontFamily:"var(--mono)", color:"var(--text)",
      backdropFilter:"blur(10px)", maxWidth:200,
    }}>
      <div style={{ fontSize:9, letterSpacing:"0.14em", color:"var(--blue)", marginBottom:9, fontWeight:700 }}>PART LEGEND</div>
      {allPartIds.map((pid) => (
        <div key={pid} style={{ display:"flex", alignItems:"center", gap:7, marginBottom:5 }}>
          <div style={{ width:10, height:10, borderRadius:2, background:partColor(pid,allPartIds), flexShrink:0 }} />
          <span style={{ opacity:0.85, fontSize:11 }}>{pid}</span>
        </div>
      ))}
      {stats && (
        <div style={{ marginTop:11, paddingTop:9, borderTop:"1px solid var(--border)" }}>
          {[["배치",`${stats.total_placed}개`],["효율",`${stats.overall_efficiency_pct}%`,stats.overall_efficiency_pct>=85],["원장",`${stats.stocks_used}장`]].map(([l,v,hi]) => (
            <div key={l} style={{ display:"flex", justifyContent:"space-between", gap:12, marginBottom:4, fontSize:11 }}>
              <span style={{ opacity:0.5 }}>{l}</span>
              <span style={{ color:hi?"var(--green)":"var(--text)", fontWeight:600 }}>{v}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ══════════════════════════════════════════════════════════════════
// 7. 뷰어 오버레이 (힌트 / 로딩 / 빈 상태)
// ══════════════════════════════════════════════════════════════════

function ViewerHints() {
  return (
    <div style={{
      position:"absolute", top:14, right:16, zIndex:5,
      fontFamily:"var(--mono)", fontSize:9,
      color:"var(--blue)", opacity:0.38, lineHeight:2, textAlign:"right",
    }}>
      <div>Drag · Rotate</div><div>Scroll · Zoom</div><div>Right-drag · Pan</div>
    </div>
  );
}

function LoadingOverlay() {
  return (
    <div style={{
      position:"absolute", inset:0, zIndex:10,
      display:"flex", flexDirection:"column", alignItems:"center", justifyContent:"center",
      background:"rgba(3,8,20,0.72)", backdropFilter:"blur(4px)",
      fontFamily:"var(--mono)", color:"var(--blue)", gap:16,
    }}>
      <div style={{
        width:38, height:38,
        border:"3px solid rgba(74,158,255,0.15)", borderTop:"3px solid var(--blue)",
        borderRadius:"50%", animation:"spin 0.8s linear infinite",
      }} />
      <div style={{ fontSize:12, letterSpacing:"0.1em" }}>COMPUTING LAYOUT...</div>
    </div>
  );
}

function EmptyState() {
  return (
    <div style={{
      position:"absolute", inset:0, zIndex:2, pointerEvents:"none",
      display:"flex", flexDirection:"column", alignItems:"center", justifyContent:"center",
      fontFamily:"var(--mono)", color:"rgba(74,158,255,0.3)", gap:10,
    }}>
      <div style={{ fontSize:34, opacity:0.2 }}>⬛</div>
      <div style={{ fontSize:11, letterSpacing:"0.07em" }}>좌측 패널에서 데이터를 입력하고 OPTIMIZE를 누르세요</div>
    </div>
  );
}

// ══════════════════════════════════════════════════════════════════
// 8. 작업 지시서 모달  [4]
// ══════════════════════════════════════════════════════════════════

const AXIS_LABEL = {
  X: { label: "X축 (길이)", cls: "axis-x", arrow: "↔" },
  Y: { label: "Y축 (폭)",   cls: "axis-y", arrow: "↕" },
  Z: { label: "Z축 (두께)", cls: "axis-z", arrow: "↕" },
};

const AXIS_DESC = {
  X: "길이 방향 수직 절단",
  Y: "폭 방향 수직 절단",
  Z: "두께 방향 수평 절단",
};

function AxisPill({ axis }) {
  const a = AXIS_LABEL[axis] || { label: axis, cls: "tb", arrow: "" };
  return (
    <span className={`tag ${a.cls}`} style={{ padding:"2px 8px", fontSize:10 }}>
      {a.label}
    </span>
  );
}

function CutListModal({ cutList, onClose }) {
  // ESC 키 닫기
  useEffect(() => {
    const handler = (e) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [onClose]);

  const [activeStock, setActiveStock] = useState(cutList[0]?.stockId ?? null);
  const activeGroup = cutList.find((g) => g.stockId === activeStock);

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal-panel" onClick={(e) => e.stopPropagation()}>

        {/* ── 모달 헤더 ──────────────────────────────── */}
        <div style={{
          display:"flex", alignItems:"center", justifyContent:"space-between",
          padding:"18px 22px 14px",
          borderBottom:"1px solid var(--border)",
          flexShrink:0,
        }}>
          <div>
            <div style={{ fontFamily:"var(--mono)", fontSize:15, fontWeight:700, color:"#e8f0fe" }}>
              📝 작업 지시서 (Cut List)
            </div>
            <div style={{ fontFamily:"var(--mono)", fontSize:9, color:"var(--text-dim)", marginTop:3, letterSpacing:"0.08em" }}>
              원장별 절단 순서 · 축 · 위치를 순서대로 확인하세요
            </div>
          </div>
          <button
            onClick={onClose}
            style={{
              background:"rgba(248,113,113,0.08)", border:"1px solid rgba(248,113,113,0.2)",
              borderRadius:6, color:"var(--red)", fontFamily:"var(--mono)",
              fontSize:13, width:30, height:30, cursor:"pointer",
              display:"flex", alignItems:"center", justifyContent:"center",
              transition:"all 0.12s",
            }}
          >✕</button>
        </div>

        {/* ── 원장 탭 ────────────────────────────────── */}
        {cutList.length > 1 && (
          <div style={{
            display:"flex", gap:6, padding:"12px 22px 0",
            borderBottom:"1px solid var(--border)", flexShrink:0,
          }}>
            {cutList.map((g) => (
              <button
                key={g.stockId}
                onClick={() => setActiveStock(g.stockId)}
                style={{
                  fontFamily:"var(--mono)", fontSize:11, fontWeight:600,
                  padding:"6px 14px",
                  background: activeStock === g.stockId
                    ? "rgba(74,158,255,0.14)"
                    : "rgba(74,158,255,0.04)",
                  border: activeStock === g.stockId
                    ? "1px solid rgba(74,158,255,0.45)"
                    : "1px solid rgba(74,158,255,0.14)",
                  borderBottom: "none",
                  borderRadius:"6px 6px 0 0",
                  color: activeStock === g.stockId ? "var(--blue)" : "var(--text-dim)",
                  cursor:"pointer", transition:"all 0.12s",
                  marginBottom:-1,
                }}
              >
                Stock {g.stockId}
                <span style={{
                  marginLeft:6, fontSize:9, opacity:0.7,
                  color: activeStock===g.stockId ? "var(--blue)" : "var(--text-dim)",
                }}>
                  {g.cuts.length}단계
                </span>
              </button>
            ))}
          </div>
        )}

        {/* ── 절단 테이블 ────────────────────────────── */}
        <div style={{ flex:1, overflowY:"auto", padding:"0 22px 22px" }}>
          {activeGroup ? (
            <>
              {/* 안내 배너 */}
              <div style={{
                margin:"14px 0 12px",
                padding:"10px 14px",
                background:"rgba(251,191,36,0.06)",
                border:"1px solid rgba(251,191,36,0.2)",
                borderRadius:7,
                fontFamily:"var(--mono)", fontSize:10, color:"var(--amber)",
                lineHeight:1.6,
              }}>
                ⚠ 아래 순서대로 절단하세요. 각 절단 후 잔재를 동일 작업대에 유지하세요.
                Kerf(톱날 손실)가 포함된 위치입니다.
              </div>

              <table className="cut-table">
                <thead>
                  <tr>
                    <th style={{ width:48 }}>Step</th>
                    <th>절단 축</th>
                    <th>절단 위치</th>
                    <th>톱날 손실</th>
                    <th>작업 지시</th>
                  </tr>
                </thead>
                <tbody>
                  {activeGroup.cuts.map((cut) => {
                    const axInfo = AXIS_LABEL[cut.axis] || {};
                    return (
                      <tr key={cut.cut_id}>
                        {/* Step 번호 */}
                        <td>
                          <div style={{ display:"flex", justifyContent:"center" }}>
                            <span className="step-badge">{cut.step}</span>
                          </div>
                        </td>

                        {/* 축 */}
                        <td><AxisPill axis={cut.axis} /></td>

                        {/* 위치 */}
                        <td>
                          <span style={{ fontSize:13, fontWeight:700, color:"#e8f0fe" }}>
                            {cut.position.toFixed(1)}
                          </span>
                          <span style={{ color:"var(--text-dim)", fontSize:10, marginLeft:4 }}>mm</span>
                        </td>

                        {/* kerf */}
                        <td>
                          <span style={{ color:"var(--red)", fontWeight:600 }}>
                            {cut.kerf.toFixed(1)}
                          </span>
                          <span style={{ color:"var(--text-dim)", fontSize:10, marginLeft:3 }}>mm</span>
                        </td>

                        {/* 자연어 지시 */}
                        <td style={{ color:"var(--text-dim)", fontSize:11 }}>
                          <div>
                            <span style={{ color:"var(--text)", fontWeight:500 }}>
                              {AXIS_DESC[cut.axis] || cut.axis}
                            </span>
                            <span style={{ marginLeft:6 }}>
                              {axInfo.arrow} {cut.position.toFixed(1)}mm 지점에서 절단
                            </span>
                          </div>
                          <div style={{ marginTop:2, fontSize:10, opacity:0.55 }}>
                            잔재 시작 위치: {(cut.position + cut.kerf).toFixed(1)}mm
                            &nbsp;·&nbsp; Cut ID: {cut.cut_id}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>

              {/* 요약 footer */}
              <div style={{
                marginTop:16, padding:"12px 14px",
                background:"rgba(74,158,255,0.05)",
                border:"1px solid var(--border)",
                borderRadius:7,
                display:"flex", gap:24,
                fontFamily:"var(--mono)", fontSize:11,
              }}>
                <div>
                  <span style={{ color:"var(--text-dim)" }}>총 절단 횟수 </span>
                  <span style={{ color:"var(--blue)", fontWeight:700 }}>{activeGroup.cuts.length}회</span>
                </div>
                {["X","Y","Z"].map((ax) => {
                  const cnt = activeGroup.cuts.filter((c) => c.axis === ax).length;
                  if (!cnt) return null;
                  return (
                    <div key={ax}>
                      <span style={{ color:"var(--text-dim)" }}>{ax}축 </span>
                      <span style={{ fontWeight:700, color:"var(--text)" }}>{cnt}회</span>
                    </div>
                  );
                })}
                <div style={{ marginLeft:"auto" }}>
                  <span style={{ color:"var(--text-dim)" }}>총 kerf 손실 </span>
                  <span style={{ color:"var(--red)", fontWeight:700 }}>
                    {activeGroup.cuts.reduce((s,c) => s+c.kerf, 0).toFixed(1)}mm
                  </span>
                </div>
              </div>
            </>
          ) : (
            <div style={{
              padding:"48px 0", textAlign:"center",
              fontFamily:"var(--mono)", color:"var(--text-dim)", fontSize:12,
            }}>
              절단 이력 데이터가 없습니다.
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ══════════════════════════════════════════════════════════════════
// 9. 폼 원자 컴포넌트
// ══════════════════════════════════════════════════════════════════

function SLabel({ children }) { return <div className="slabel">{children}</div>; }

function MLabel({ children, unit }) {
  return (
    <div className="mlabel">
      {children}{unit && <span className="u">{unit}</span>}
    </div>
  );
}

function NInput({ value, onChange, min=0, step=1, center=false }) {
  return (
    <input
      className="fi" type="number" min={min} step={step} value={value}
      onChange={(e) => onChange(Number(e.target.value))}
      style={{ padding:"5px 6px", ...(center ? { textAlign:"center" } : {}) }}
    />
  );
}

function Check({ label, hint, checked, onChange }) {
  return (
    <label style={{
      display:"flex", alignItems:"flex-start", gap:7, cursor:"pointer",
      fontFamily:"var(--mono)", fontSize:11, color:"var(--text)", lineHeight:1.4,
    }}>
      <input className="fc" type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} />
      <span>{label}<span style={{ color:"var(--text-dim)", fontSize:9, marginLeft:4 }}>{hint}</span></span>
    </label>
  );
}

// ══════════════════════════════════════════════════════════════════
// 10. Stock 카드  [1] 순서: T → W → L → Qty
// ══════════════════════════════════════════════════════════════════

function StockCard({ s, idx, onChange, onDel }) {
  const u = (k, v) => onChange({ ...s, [k]: v });
  return (
    <div className="card">
      <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", marginBottom:8 }}>
        <div style={{ display:"flex", alignItems:"center", gap:6 }}>
          <div style={{
            background:"rgba(74,158,255,0.1)", border:"1px solid rgba(74,158,255,0.28)",
            borderRadius:3, padding:"1px 7px",
            fontFamily:"var(--mono)", fontSize:10, fontWeight:700, color:"var(--blue)",
          }}>
            {s.id || `S${idx+1}`}
          </div>
          <input
            className="fi" type="text" value={s.id}
            onChange={(e) => u("id", e.target.value)}
            placeholder="ID" style={{ width:50, padding:"3px 7px", fontSize:11 }}
          />
        </div>
        <button className="del" onClick={onDel}>✕</button>
      </div>

      {/* [1] T → W → L → Qty 순서 */}
      <div className="g4">
        {[
          ["T (두께)", "t", "mm"],
          ["W (폭)",   "w", "mm"],
          ["L (길이)", "l", "mm"],
          ["Qty",     "qty", "장"],
        ].map(([lbl, key, unit]) => (
          <div key={key}>
            <MLabel unit={unit}>{lbl}</MLabel>
            <NInput value={s[key]} min={1} onChange={(v) => u(key, v)} center />
          </div>
        ))}
      </div>
    </div>
  );
}

// ══════════════════════════════════════════════════════════════════
// 11. Part 카드  [1] 순서: T → W → L → Qty
// ══════════════════════════════════════════════════════════════════

function PartCard({ p, idx, allIds, onChange, onDel }) {
  const u = (k, v) => onChange({ ...p, [k]: v });
  const dot = partColor(p.id, allIds);
  return (
    <div className="card">
      <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", marginBottom:8 }}>
        <div style={{ display:"flex", alignItems:"center", gap:7 }}>
          <div style={{
            width:9, height:9, borderRadius:2,
            background:dot, flexShrink:0,
            boxShadow:`0 0 6px ${dot}99`,
          }} />
          <input
            className="fi" type="text" value={p.id}
            onChange={(e) => u("id", e.target.value)}
            placeholder={`P${idx+1}`} style={{ width:50, padding:"3px 7px", fontSize:11 }}
          />
          <span style={{ fontFamily:"var(--mono)", fontSize:9, color:"var(--text-dim)" }}>×{p.qty}</span>
        </div>
        <button className="del" onClick={onDel}>✕</button>
      </div>

      {/* [1] T → W → L → Qty 순서 */}
      <div className="g4" style={{ marginBottom:8 }}>
        {[
          ["T (두께)", "t", "mm"],
          ["W (폭)",   "w", "mm"],
          ["L (길이)", "l", "mm"],
          ["Qty",     "qty", "개"],
        ].map(([lbl, key, unit]) => (
          <div key={key}>
            <MLabel unit={unit}>{lbl}</MLabel>
            <NInput value={p[key]} min={1} onChange={(v) => u(key, v)} center />
          </div>
        ))}
      </div>

      <div style={{ display:"flex", flexDirection:"column", gap:6 }}>
        <Check label="Z축 고정" hint="(두께 방향 고정)" checked={p.lock_z} onChange={(v) => u("lock_z", v)} />
        <Check label="XY 회전 허용" hint="(90° 전환)" checked={p.allow_xy_rotation} onChange={(v) => u("allow_xy_rotation", v)} />
      </div>
    </div>
  );
}

// ══════════════════════════════════════════════════════════════════
// 12. 좌측 사이드바
// ══════════════════════════════════════════════════════════════════

function Sidebar({ settings, onSettings, stocks, onStocks, parts, onParts,
                   onRun, loading, error, stats, response }) {

  const [showCutList, setShowCutList] = useState(false);
  const cutList = useMemo(() => buildCutList(response), [response]);

  const addStock = () => {
    const n = stocks.length + 1;
    onStocks([...stocks, { _uid:uid(), id:`S${n}`, l:2440, w:1220, t:18, qty:1 }]);
  };
  const updStock = (id, v) => onStocks(stocks.map((s) => s._uid===id ? v : s));
  const delStock = (id) => onStocks(stocks.filter((s) => s._uid!==id));

  const addPart = () => {
    const n = parts.length + 1;
    onParts([...parts, { _uid:uid(), id:`P${n}`, l:400, w:300, t:18, qty:1, lock_z:true, allow_xy_rotation:true }]);
  };
  const updPart = (id, v) => onParts(parts.map((p) => p._uid===id ? v : p));
  const delPart = (id) => onParts(parts.filter((p) => p._uid!==id));

  const allIds = parts.map((p) => p.id);
  const canRun = stocks.length > 0 && parts.length > 0 && !loading;

  return (
    <>
      <div style={{
        width:292, flexShrink:0, height:"100vh",
        display:"flex", flexDirection:"column",
        background:"var(--panel)", borderRight:"1px solid var(--border)",
        backdropFilter:"blur(20px)",
      }}>
        {/* 헤더 */}
        <div style={{ padding:"17px 17px 13px", borderBottom:"1px solid var(--border)", flexShrink:0 }}>
          <div style={{ fontFamily:"var(--mono)", fontSize:15, fontWeight:700, color:"#e8f0fe", letterSpacing:"-0.01em" }}>
            3D Cut Optimizer
          </div>
          <div style={{ fontFamily:"var(--mono)", fontSize:9, color:"var(--blue)", opacity:0.6, marginTop:3, letterSpacing:"0.1em" }}>
            GUILLOTINE · KERF · TRIM · LOCK
          </div>
        </div>

        {/* 스크롤 폼 */}
        <div style={{ flex:1, overflowY:"auto", padding:"14px 14px 6px" }}>

          {/* SETTINGS */}
          <SLabel>Settings</SLabel>
          <div className="card" style={{ marginBottom:14 }}>
            <div className="g2" style={{ marginBottom:8 }}>
              <div>
                <MLabel unit="mm">Kerf (톱날)</MLabel>
                <NInput value={settings.kerf} min={0} step={0.5}
                  onChange={(v) => onSettings({ ...settings, kerf:v })} />
              </div>
              <div>
                <MLabel>Trimming X / Y</MLabel>
                <div style={{ display:"flex", gap:4 }}>
                  <NInput value={settings.trimming.x} min={0}
                    onChange={(v) => onSettings({ ...settings, trimming:{...settings.trimming, x:v} })} center />
                  <NInput value={settings.trimming.y} min={0}
                    onChange={(v) => onSettings({ ...settings, trimming:{...settings.trimming, y:v} })} center />
                </div>
              </div>
            </div>
            <div style={{ fontFamily:"var(--mono)", fontSize:9, color:"var(--text-dim)", lineHeight:1.55 }}>
              Trimming: 원장 양단에서 각각 제거되는 여백(mm)
            </div>
          </div>

          {/* STOCKS */}
          <SLabel>
            원장 (Stocks)
            <span className="tag tb">{stocks.length}장</span>
          </SLabel>
          {stocks.map((s,i) => (
            <StockCard key={s._uid} s={s} idx={i}
              onChange={(v) => updStock(s._uid, v)}
              onDel={() => delStock(s._uid)} />
          ))}
          <button className="add" onClick={addStock} style={{ marginBottom:14 }}>+ 원장 추가</button>

          {/* PARTS */}
          <SLabel>
            부품 (Parts)
            <span className="tag tb">{parts.length}종</span>
            <span className="tag tg">{parts.reduce((s,p)=>s+p.qty,0)}개</span>
          </SLabel>
          {parts.map((p,i) => (
            <PartCard key={p._uid} p={p} idx={i} allIds={allIds}
              onChange={(v) => updPart(p._uid, v)}
              onDel={() => delPart(p._uid)} />
          ))}
          <button className="add" onClick={addPart} style={{ marginBottom:8 }}>+ 부품 추가</button>
        </div>

        {/* 하단 고정 영역 */}
        <div style={{
          padding:"11px 14px 16px",
          borderTop:"1px solid var(--border)",
          flexShrink:0, background:"rgba(2,5,16,0.65)",
        }}>

          {/* 결과 요약 미니 카드 */}
          {stats && (
            <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:5, marginBottom:10 }}>
              {[
                ["배치 완료", `${stats.total_placed}개`],
                ["효율", `${stats.overall_efficiency_pct}%`, stats.overall_efficiency_pct>=85],
                ["원장 사용", `${stats.stocks_used}장`],
                ["연산", `${(stats.processing_time_sec*1000).toFixed(0)}ms`],
              ].map(([lbl, val, good]) => (
                <div key={lbl} style={{
                  background:"rgba(0,8,22,0.62)", border:"1px solid var(--border)",
                  borderRadius:6, padding:"6px 9px", fontFamily:"var(--mono)",
                }}>
                  <div style={{ fontSize:8, color:"var(--text-dim)", letterSpacing:"0.06em", marginBottom:2 }}>{lbl}</div>
                  <div style={{ fontSize:14, fontWeight:700, color:good?"var(--green)":"var(--text)" }}>{val}</div>
                </div>
              ))}
            </div>
          )}

          {/* 에러 */}
          {error && (
            <div style={{
              marginBottom:10, padding:"8px 10px",
              background:"rgba(248,113,113,0.07)",
              border:"1px solid rgba(248,113,113,0.22)",
              borderRadius:6, color:"var(--red)",
              fontFamily:"var(--mono)", fontSize:10, lineHeight:1.5,
            }}>
              ⚠ {error}
            </div>
          )}

          {/* [4] 작업 지시서 버튼 */}
          <button
            className="cutlist-btn"
            style={{ marginBottom:8 }}
            onClick={() => setShowCutList(true)}
            disabled={!response}
          >
            📝 작업 지시서 보기
            {cutList.length > 0 && (
              <span className="tag tb" style={{ fontSize:9 }}>
                {cutList.reduce((s,g)=>s+g.cuts.length,0)}단계
              </span>
            )}
          </button>

          {/* OPTIMIZE 버튼 */}
          <button className="opt" onClick={onRun} disabled={!canRun}>
            {loading
              ? <span style={{ display:"flex", alignItems:"center", justifyContent:"center", gap:10 }}>
                  <span style={{
                    display:"inline-block", width:13, height:13,
                    border:"2px solid rgba(74,158,255,0.22)", borderTop:"2px solid var(--blue)",
                    borderRadius:"50%", animation:"spin 0.8s linear infinite",
                  }} />
                  COMPUTING...
                </span>
              : "▶  OPTIMIZE  계산하기"
            }
          </button>

          <div style={{
            marginTop:7, fontFamily:"var(--mono)", fontSize:9,
            color:"var(--text-dim)", textAlign:"center", lineHeight:1.6,
          }}>
            {!canRun && !loading
              ? "원장과 부품을 각 1개 이상 추가하세요"
              : `원장 ${stocks.reduce((s,st)=>s+st.qty,0)}장 · 부품 ${parts.reduce((s,p)=>s+p.qty,0)}개`
            }
          </div>
        </div>
      </div>

      {/* [4] Cut List 모달 */}
      {showCutList && (
        <CutListModal
          cutList={cutList}
          onClose={() => setShowCutList(false)}
        />
      )}
    </>
  );
}

// ══════════════════════════════════════════════════════════════════
// 13. 메인 App
// ══════════════════════════════════════════════════════════════════

export default function App() {
  const [settings, setSettings] = useState(DEFAULT_SETTINGS);
  const [stocks,   setStocks]   = useState(DEFAULT_STOCKS);
  const [parts,    setParts]    = useState(DEFAULT_PARTS);
  const [response, setResponse] = useState(null);
  const [loading,  setLoading]  = useState(false);
  const [error,    setError]    = useState(null);

  const requestBody = useMemo(() => ({
    settings: { kerf:settings.kerf, trimming:settings.trimming, optimization_goal:"MINIMIZE_WASTE" },
    stocks:   stocks.map(({ _uid, ...s }) => s),
    parts:    parts.map(({ _uid, ...p }) => p),
  }), [settings, stocks, parts]);

  const handleOptimize = useCallback(async () => {
    setLoading(true); setError(null);
    try {
      const res = await fetch(API_URL, {
        method:"POST",
        headers:{ "Content-Type":"application/json" },
        body: JSON.stringify(requestBody),
      });
      if (!res.ok) {
        const e = await res.json().catch(()=>({}));
        throw new Error(e.detail || e.error || `HTTP ${res.status}`);
      }
      setResponse(await res.json());
    } catch (e) {
      setError(e.message.includes("Failed to fetch")
        ? "FastAPI 서버(localhost:8000)에 연결할 수 없습니다."
        : e.message);
    } finally { setLoading(false); }
  }, [requestBody]);

  // [3] trimming을 buildSceneData에 전달
  const sceneData  = useMemo(
    () => buildSceneData(response, requestBody.stocks, settings.trimming),
    [response, requestBody.stocks, settings.trimming]
  );
  const allPartIds = sceneData.allPartIds ?? [];
  const hasData    = (sceneData.groups?.length ?? 0) > 0;

  return (
    <>
      <style>{GLOBAL_CSS}</style>
      <div style={{ display:"flex", width:"100vw", height:"100vh", background:"var(--bg)", overflow:"hidden" }}>

        {/* 좌측 사이드바 */}
        <Sidebar
          settings={settings}   onSettings={setSettings}
          stocks={stocks}       onStocks={setStocks}
          parts={parts}         onParts={setParts}
          onRun={handleOptimize}
          loading={loading}     error={error}
          stats={response?.stats ?? null}
          response={response}
        />

        {/* 우측 3D 뷰어 */}
        <div style={{ flex:1, position:"relative", overflow:"hidden" }}>
          <Canvas
            shadows
            gl={{ antialias:true, toneMapping:THREE.ACESFilmicToneMapping }}
            style={{ position:"absolute", inset:0 }}
          >
            <color attach="background" args={["#030814"]} />
            <fog attach="fog" args={["#030814", 12, 32]} />
            <Suspense fallback={null}>
              {hasData ? (
                <Scene sceneData={sceneData} />
              ) : (
                <>
                  {/* [2] 빈 상태도 오프셋 카메라 */}
                  <PerspectiveCamera makeDefault position={[4 + CAM_X_OFFSET, 3, 5]} fov={45} />
                  <OrbitControls
                    target={[CAM_X_OFFSET, 0, 0]}
                    enableDamping dampingFactor={0.06}
                  />
                  <ambientLight intensity={0.4} />
                  <Grid
                    args={[20,20]} position={[1.22 + CAM_X_OFFSET, -0.01, 0]}
                    cellSize={0.244} cellColor="#0d1e3a"
                    sectionSize={2.44} sectionColor="#182f5a"
                    fadeDistance={15} infiniteGrid
                  />
                </>
              )}
            </Suspense>
          </Canvas>

          <ViewerHints />
          {loading  && <LoadingOverlay />}
          {!loading && !hasData && <EmptyState />}
          {hasData  && !loading && <Legend allPartIds={allPartIds} stats={response?.stats} />}
        </div>
      </div>
    </>
  );
}
