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
import { Canvas, useFrame } from "@react-three/fiber";
import { OrbitControls, PerspectiveCamera, Grid, Html, Environment } from "@react-three/drei";
import * as THREE from "three";

// ══════════════════════════════════════════════════════════════════
// GLOBAL STYLES
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
    --mono:      'JetBrains Mono', monospace;
  }

  body { background: var(--bg); overflow: hidden; }

  ::-webkit-scrollbar { width: 3px; }
  ::-webkit-scrollbar-track { background: transparent; }
  ::-webkit-scrollbar-thumb { background: rgba(74,158,255,0.3); border-radius: 2px; }

  @keyframes spin   { to { transform: rotate(360deg); } }
  @keyframes fadeUp { from { opacity:0; transform:translateY(5px); } to { opacity:1; transform:none; } }

  /* ── Input base ── */
  .fi {
    width: 100%;
    background: rgba(0, 8, 22, 0.75);
    border: 1px solid var(--border);
    border-radius: 5px;
    color: var(--text);
    font-family: var(--mono);
    font-size: 12px;
    padding: 6px 9px;
    outline: none;
    transition: border-color 0.15s, box-shadow 0.15s;
    -webkit-appearance: none;
  }
  .fi:focus {
    border-color: var(--blue);
    box-shadow: 0 0 0 2px rgba(74,158,255,0.1);
  }
  .fi::placeholder { color: var(--text-dim); }
  .fi[type=number]::-webkit-inner-spin-button { opacity: 0.35; }

  /* ── Checkbox ── */
  .fc {
    appearance: none;
    width: 14px; height: 14px;
    border: 1px solid var(--border-hi);
    border-radius: 3px;
    background: rgba(0,8,22,0.75);
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
    font-size: 9px;
    font-weight: 700;
    letter-spacing: 0.16em;
    text-transform: uppercase;
    color: var(--blue);
    margin-bottom: 8px;
    display: flex;
    align-items: center;
    gap: 7px;
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
  .card:hover { border-color: rgba(74,158,255,0.3); }

  /* ── Grid layouts ── */
  .g2 { display: grid; grid-template-columns: 1fr 1fr; gap: 6px; }
  .g4 { display: grid; grid-template-columns: 1fr 1fr 1fr 1fr; gap: 4px; }

  /* ── Micro label ── */
  .mlabel {
    font-family: var(--mono);
    font-size: 8px;
    letter-spacing: 0.07em;
    color: var(--text-dim);
    margin-bottom: 3px;
  }
  .mlabel .u { color: rgba(74,158,255,0.7); margin-left: 2px; }

  /* ── Delete button ── */
  .del {
    background: rgba(248,113,113,0.07);
    border: 1px solid rgba(248,113,113,0.18);
    border-radius: 4px;
    color: var(--red);
    font-size: 11px;
    width: 22px; height: 22px;
    cursor: pointer;
    display: flex; align-items: center; justify-content: center;
    flex-shrink: 0;
    transition: all 0.12s;
    font-family: var(--mono);
    line-height: 1;
  }
  .del:hover { background: rgba(248,113,113,0.16); border-color: rgba(248,113,113,0.45); }

  /* ── Add button ── */
  .add {
    width: 100%;
    padding: 8px 0;
    background: var(--blue-dim);
    border: 1px dashed rgba(74,158,255,0.35);
    border-radius: 6px;
    color: var(--blue);
    font-family: var(--mono);
    font-size: 11px;
    font-weight: 600;
    letter-spacing: 0.05em;
    cursor: pointer;
    transition: all 0.14s;
  }
  .add:hover { background: rgba(74,158,255,0.18); border-color: var(--blue); }

  /* ── Tag badge ── */
  .tag {
    display: inline-flex; align-items: center;
    padding: 1px 6px;
    border-radius: 3px;
    font-size: 9px;
    font-weight: 600;
    letter-spacing: 0.07em;
    font-family: var(--mono);
  }
  .tb { background: rgba(74,158,255,0.1); color:var(--blue); border:1px solid rgba(74,158,255,0.22); }
  .tg { background: rgba(74,222,128,0.08); color:var(--green); border:1px solid rgba(74,222,128,0.22); }

  /* ── Optimize button ── */
  .opt {
    width: 100%;
    padding: 13px 0;
    background: linear-gradient(135deg, #1560c8 0%, #0c3d8a 100%);
    border: 1px solid rgba(74,158,255,0.55);
    border-radius: 8px;
    color: #e8f0fe;
    font-family: var(--mono);
    font-size: 13px;
    font-weight: 700;
    letter-spacing: 0.09em;
    cursor: pointer;
    transition: all 0.16s;
    position: relative;
    overflow: hidden;
    box-shadow: 0 3px 18px rgba(21,96,200,0.32);
  }
  .opt::before {
    content:'';
    position:absolute; inset:0;
    background: linear-gradient(135deg, rgba(255,255,255,0.07) 0%, transparent 55%);
    pointer-events:none;
  }
  .opt:hover:not(:disabled) {
    background: linear-gradient(135deg, #1a70e0 0%, #1050b0 100%);
    box-shadow: 0 4px 26px rgba(74,158,255,0.4);
    transform: translateY(-1px);
  }
  .opt:active:not(:disabled) { transform: translateY(0); }
  .opt:disabled {
    background: rgba(74,158,255,0.08);
    border-color: rgba(74,158,255,0.18);
    color: rgba(74,158,255,0.35);
    cursor: not-allowed;
    box-shadow: none;
  }
`;

// ══════════════════════════════════════════════════════════════════
// 1. 상수 & 유틸리티
// ══════════════════════════════════════════════════════════════════

const API_URL   = "https://cutting-optimizer-backend.onrender.com/optimize";
const SCALE     = 0.001;
const STOCK_GAP = 0.4;

let _uid = 0;
const uid = () => `u${++_uid}`;

function partColor(partId, allPartIds) {
  const idx = allPartIds.indexOf(partId);
  const hue = (idx * 137.508) % 360;
  return `hsl(${hue}, 70%, 58%)`;
}

function toThreeColor(hsl) {
  return new THREE.Color().setStyle(hsl);
}

// ══════════════════════════════════════════════════════════════════
// 2. 기본 상태
// ══════════════════════════════════════════════════════════════════

const DEFAULT_SETTINGS = { kerf: 3.0, trimming: { x: 10, y: 10, z: 0 } };

const DEFAULT_STOCKS = [
  { _uid: "s1", id: "S1", l: 2440, w: 1220, t: 18, qty: 3 },
];

const DEFAULT_PARTS = [
  { _uid: "p1", id: "P1", l: 600, w: 400, t: 18, qty: 10, lock_z: true,  allow_xy_rotation: true  },
  { _uid: "p2", id: "P2", l: 300, w: 200, t: 18, qty: 8,  lock_z: true,  allow_xy_rotation: true  },
  { _uid: "p3", id: "P3", l: 800, w: 600, t: 18, qty: 3,  lock_z: true,  allow_xy_rotation: false },
];

// ══════════════════════════════════════════════════════════════════
// 3. buildSceneData
// ══════════════════════════════════════════════════════════════════

function buildSceneData(response, stocks) {
  if (!response?.placements) return { groups: [], allPartIds: [] };

  const stockOrder = [];
  response.placements.forEach((p) => {
    if (!stockOrder.includes(p.stock_id)) stockOrder.push(p.stock_id);
  });

  const dimsMap = {};
  (response.stock_summaries || []).forEach((s) => { dimsMap[s.stock_id] = s.usable_dims; });
  stocks.forEach((s) => { if (!dimsMap[s.id]) dimsMap[s.id] = { l: s.l, w: s.w, t: s.t }; });

  const allPartIds = [...new Set(response.placements.map((p) => p.part_id))];

  const groups = stockOrder.map((stockId, si) => {
    const pls = response.placements.filter((p) => p.stock_id === stockId);

    let zOff = 0;
    for (let i = 0; i < si; i++) {
      const d = dimsMap[stockOrder[i]] || { t: 18 };
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
      size:     [p.placed_dims.l * SCALE, p.placed_dims.w * SCALE, p.placed_dims.t * SCALE],
      color:    toThreeColor(partColor(p.part_id, allPartIds)),
      hsl:      partColor(p.part_id, allPartIds),
      label:    `${p.part_id}  ${p.placed_dims.l}×${p.placed_dims.w}×${p.placed_dims.t}mm`,
      cuts:     p.cut_history?.length ?? 0,
    }));

    const d = dimsMap[stockId] || { l: 2440, w: 1220, t: 18 };
    const stockMesh = {
      stockId, zOff,
      position: [(d.l / 2) * SCALE, (d.w / 2) * SCALE, (d.t / 2) * SCALE + zOff],
      size:     [d.l * SCALE, d.w * SCALE, d.t * SCALE],
    };

    return { stockId, boxes, stockMesh };
  });

  return { groups, allPartIds };
}

// ══════════════════════════════════════════════════════════════════
// 4. 3D 컴포넌트 (기존 로직 완전 유지)
// ══════════════════════════════════════════════════════════════════

function PlacedBox({ box, onHover }) {
  const ref = useRef();
  const [hovered, setHovered] = useState(false);

  useFrame(() => {
    if (!ref.current) return;
    ref.current.material.emissiveIntensity = THREE.MathUtils.lerp(
      ref.current.material.emissiveIntensity, hovered ? 0.18 : 0, 0.12
    );
  });

  return (
    <mesh
      ref={ref}
      position={box.position}
      onPointerOver={(e) => { e.stopPropagation(); setHovered(true); onHover(box); document.body.style.cursor = "pointer"; }}
      onPointerOut={() => { setHovered(false); onHover(null); document.body.style.cursor = "auto"; }}
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
      <lineBasicMaterial color={hi ? "#ffffff" : "#00000033"} transparent opacity={hi ? 0.9 : 0.28} />
    </lineSegments>
  );
}

function StockOutline({ sm, label }) {
  return (
    <group>
      <lineSegments position={sm.position}>
        <edgesGeometry args={[new THREE.BoxGeometry(...sm.size)]} />
        <lineBasicMaterial color="#4a9eff" transparent opacity={0.45} />
      </lineSegments>
      <Html
        position={[sm.position[0] - sm.size[0] / 2, sm.position[1] + sm.size[1] / 2 + 0.06, sm.position[2]]}
        style={{ pointerEvents: "none" }}
      >
        <div style={{
          background: "rgba(10,20,42,0.88)", color: "#4a9eff",
          fontFamily: "var(--mono)", fontSize: "11px", fontWeight: 600,
          padding: "3px 8px", borderRadius: "4px",
          border: "1px solid rgba(74,158,255,0.38)", whiteSpace: "nowrap",
        }}>
          {label}
        </div>
      </Html>
    </group>
  );
}

function Scene({ sceneData }) {
  const [hov, setHov] = useState(null);
  const { groups } = sceneData;

  const center = useMemo(() => {
    const all = groups.flatMap((g) => g.boxes);
    if (!all.length) return [1.22, 0.61, 0];
    return [
      all.reduce((s, b) => s + b.position[0], 0) / all.length,
      all.reduce((s, b) => s + b.position[1], 0) / all.length,
      all.reduce((s, b) => s + b.position[2], 0) / all.length,
    ];
  }, [groups]);

  return (
    <>
      <PerspectiveCamera makeDefault position={[4, 3, 5]} fov={45} />
      <OrbitControls target={center} enableDamping dampingFactor={0.06} minDistance={0.5} maxDistance={20} />
      <ambientLight intensity={0.6} />
      <directionalLight position={[5, 8, 5]} intensity={1.4} castShadow shadow-mapSize={[2048, 2048]} />
      <directionalLight position={[-4, 3, -4]} intensity={0.4} color="#b0c8ff" />
      <Environment preset="city" />
      <Grid
        args={[20, 20]} position={[center[0], -0.01, center[2]]}
        cellSize={0.244} cellThickness={0.5} cellColor="#1a3558"
        sectionSize={2.44} sectionThickness={1} sectionColor="#254d80"
        fadeDistance={15} fadeStrength={1} followCamera={false} infiniteGrid
      />

      {groups.map((g) => (
        <group key={g.stockId}>
          <StockOutline sm={g.stockMesh} label={`Stock: ${g.stockId}  (${g.boxes.length} parts)`} />
          {g.boxes.map((box) => (
            <group key={box.nodeId}>
              <PlacedBox box={box} onHover={setHov} />
              <BoxEdges box={box} hi={hov?.nodeId === box.nodeId} />
            </group>
          ))}
        </group>
      ))}

      {hov && (
        <Html position={hov.position} style={{ pointerEvents: "none" }}>
          <div style={{
            background: "rgba(4,12,28,0.96)",
            border: `1px solid ${hov.hsl}`,
            borderRadius: 6, padding: "8px 12px",
            fontFamily: "var(--mono)", fontSize: 12, color: "#e8f0fe",
            whiteSpace: "nowrap", transform: "translate(14px,-50%)",
            boxShadow: `0 0 14px ${hov.hsl}44`,
          }}>
            <div style={{ color: hov.hsl, fontWeight: 700, marginBottom: 4 }}>{hov.partId}</div>
            <div style={{ opacity: 0.8 }}>{hov.label}</div>
            <div style={{ opacity: 0.45, fontSize: 10, marginTop: 4 }}>{hov.cuts} cuts · {hov.nodeId}</div>
          </div>
        </Html>
      )}
    </>
  );
}

// ══════════════════════════════════════════════════════════════════
// 5. Legend (뷰어 우하단)
// ══════════════════════════════════════════════════════════════════

function Legend({ allPartIds, stats }) {
  return (
    <div style={{
      position: "absolute", bottom: 20, right: 20, zIndex: 5,
      background: "rgba(5,12,28,0.9)", border: "1px solid var(--border)",
      borderRadius: 9, padding: "13px 15px",
      fontFamily: "var(--mono)", fontSize: 12, color: "var(--text)",
      backdropFilter: "blur(10px)", maxWidth: 200,
    }}>
      <div style={{ fontSize: 9, letterSpacing: "0.14em", color: "var(--blue)", marginBottom: 9, fontWeight: 700 }}>
        PART LEGEND
      </div>
      {allPartIds.map((pid) => (
        <div key={pid} style={{ display: "flex", alignItems: "center", gap: 7, marginBottom: 5 }}>
          <div style={{ width: 10, height: 10, borderRadius: 2, background: partColor(pid, allPartIds), flexShrink: 0 }} />
          <span style={{ opacity: 0.85, fontSize: 11 }}>{pid}</span>
        </div>
      ))}
      {stats && (
        <div style={{ marginTop: 11, paddingTop: 9, borderTop: "1px solid var(--border)" }}>
          {[["배치", stats.total_placed + "개"], ["효율", stats.overall_efficiency_pct + "%", stats.overall_efficiency_pct >= 85], ["원장", stats.stocks_used + "장"]].map(([l, v, hi]) => (
            <div key={l} style={{ display: "flex", justifyContent: "space-between", gap: 12, marginBottom: 4, fontSize: 11 }}>
              <span style={{ opacity: 0.5 }}>{l}</span>
              <span style={{ color: hi ? "var(--green)" : "var(--text)", fontWeight: 600 }}>{v}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ══════════════════════════════════════════════════════════════════
// 6. 뷰어 힌트 & 오버레이
// ══════════════════════════════════════════════════════════════════

function ViewerHints() {
  return (
    <div style={{
      position: "absolute", top: 14, right: 16, zIndex: 5,
      fontFamily: "var(--mono)", fontSize: 9,
      color: "var(--blue)", opacity: 0.4, lineHeight: 2, textAlign: "right",
    }}>
      <div>Drag · Rotate</div><div>Scroll · Zoom</div><div>Right-drag · Pan</div>
    </div>
  );
}

function LoadingOverlay() {
  return (
    <div style={{
      position: "absolute", inset: 0, zIndex: 10,
      display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center",
      background: "rgba(3,8,20,0.72)", backdropFilter: "blur(4px)",
      fontFamily: "var(--mono)", color: "var(--blue)", gap: 16,
    }}>
      <div style={{
        width: 38, height: 38,
        border: "3px solid rgba(74,158,255,0.15)", borderTop: "3px solid var(--blue)",
        borderRadius: "50%", animation: "spin 0.8s linear infinite",
      }} />
      <div style={{ fontSize: 12, letterSpacing: "0.1em" }}>COMPUTING LAYOUT...</div>
    </div>
  );
}

function EmptyState() {
  return (
    <div style={{
      position: "absolute", inset: 0, zIndex: 2,
      display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center",
      fontFamily: "var(--mono)", color: "rgba(74,158,255,0.3)",
      gap: 10, pointerEvents: "none",
    }}>
      <div style={{ fontSize: 34, opacity: 0.2 }}>⬛</div>
      <div style={{ fontSize: 11, letterSpacing: "0.07em" }}>좌측 패널에서 데이터를 입력하고 OPTIMIZE를 누르세요</div>
    </div>
  );
}

// ══════════════════════════════════════════════════════════════════
// 7. 폼 원자 컴포넌트
// ══════════════════════════════════════════════════════════════════

function SLabel({ children }) {
  return <div className="slabel">{children}</div>;
}

function MLabel({ children, unit }) {
  return (
    <div className="mlabel">
      {children}{unit && <span className="u">{unit}</span>}
    </div>
  );
}

function NInput({ value, onChange, min = 0, step = 1, center = false }) {
  return (
    <input
      className="fi" type="number" min={min} step={step} value={value}
      onChange={(e) => onChange(Number(e.target.value))}
      style={{ padding: "5px 7px", ...(center ? { textAlign: "center" } : {}) }}
    />
  );
}

function Check({ label, hint, checked, onChange }) {
  return (
    <label style={{
      display: "flex", alignItems: "flex-start", gap: 7, cursor: "pointer",
      fontFamily: "var(--mono)", fontSize: 11, color: "var(--text)", lineHeight: 1.4,
    }}>
      <input className="fc" type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} />
      <span>{label}<span style={{ color: "var(--text-dim)", fontSize: 9, marginLeft: 4 }}>{hint}</span></span>
    </label>
  );
}

// ══════════════════════════════════════════════════════════════════
// 8. Stock 카드
// ══════════════════════════════════════════════════════════════════

function StockCard({ s, idx, onChange, onDel }) {
  const u = (k, v) => onChange({ ...s, [k]: v });
  return (
    <div className="card">
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 8 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
          <div style={{
            background: "rgba(74,158,255,0.1)", border: "1px solid rgba(74,158,255,0.3)",
            borderRadius: 3, padding: "1px 7px",
            fontFamily: "var(--mono)", fontSize: 10, fontWeight: 700, color: "var(--blue)",
          }}>
            {s.id || `S${idx + 1}`}
          </div>
          <input
            className="fi" type="text" value={s.id}
            onChange={(e) => u("id", e.target.value)}
            placeholder="ID" style={{ width: 50, padding: "3px 7px", fontSize: 11 }}
          />
        </div>
        <button className="del" onClick={onDel}>✕</button>
      </div>

      <div className="g4" style={{ marginBottom: 0 }}>
        {[["L", "l", "mm"], ["W", "w", "mm"], ["T", "t", "mm"], ["Qty", "qty", "장"]].map(([lbl, key, unit]) => (
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
// 9. Part 카드
// ══════════════════════════════════════════════════════════════════

function PartCard({ p, idx, allIds, onChange, onDel }) {
  const u = (k, v) => onChange({ ...p, [k]: v });
  const dot = partColor(p.id, allIds);
  return (
    <div className="card">
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 8 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 7 }}>
          <div style={{
            width: 9, height: 9, borderRadius: 2, background: dot, flexShrink: 0,
            boxShadow: `0 0 6px ${dot}99`,
          }} />
          <input
            className="fi" type="text" value={p.id}
            onChange={(e) => u("id", e.target.value)}
            placeholder={`P${idx + 1}`} style={{ width: 50, padding: "3px 7px", fontSize: 11 }}
          />
          <span style={{ fontFamily: "var(--mono)", fontSize: 9, color: "var(--text-dim)" }}>×{p.qty}</span>
        </div>
        <button className="del" onClick={onDel}>✕</button>
      </div>

      <div className="g4" style={{ marginBottom: 8 }}>
        {[["L", "l", "mm"], ["W", "w", "mm"], ["T", "t", "mm"], ["Qty", "qty", "개"]].map(([lbl, key, unit]) => (
          <div key={key}>
            <MLabel unit={unit}>{lbl}</MLabel>
            <NInput value={p[key]} min={1} onChange={(v) => u(key, v)} center />
          </div>
        ))}
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
        <Check label="Z축 고정" hint="(두께 방향 고정)" checked={p.lock_z} onChange={(v) => u("lock_z", v)} />
        <Check label="XY 회전 허용" hint="(90° 전환)" checked={p.allow_xy_rotation} onChange={(v) => u("allow_xy_rotation", v)} />
      </div>
    </div>
  );
}

// ══════════════════════════════════════════════════════════════════
// 10. 좌측 입력 사이드바
// ══════════════════════════════════════════════════════════════════

function Sidebar({ settings, onSettings, stocks, onStocks, parts, onParts, onRun, loading, error, stats }) {
  const addStock = () => {
    const n = stocks.length + 1;
    onStocks([...stocks, { _uid: uid(), id: `S${n}`, l: 2440, w: 1220, t: 18, qty: 1 }]);
  };
  const updStock = (id, v) => onStocks(stocks.map((s) => s._uid === id ? v : s));
  const delStock = (id) => onStocks(stocks.filter((s) => s._uid !== id));

  const addPart = () => {
    const n = parts.length + 1;
    onParts([...parts, { _uid: uid(), id: `P${n}`, l: 400, w: 300, t: 18, qty: 1, lock_z: true, allow_xy_rotation: true }]);
  };
  const updPart = (id, v) => onParts(parts.map((p) => p._uid === id ? v : p));
  const delPart = (id) => onParts(parts.filter((p) => p._uid !== id));

  const allIds = parts.map((p) => p.id);
  const canRun = stocks.length > 0 && parts.length > 0 && !loading;

  return (
    <div style={{
      width: 292, flexShrink: 0, height: "100vh",
      display: "flex", flexDirection: "column",
      background: "var(--panel)", borderRight: "1px solid var(--border)",
      backdropFilter: "blur(20px)",
    }}>

      {/* ── 헤더 ─────────────────────────────────────────── */}
      <div style={{ padding: "18px 18px 14px", borderBottom: "1px solid var(--border)", flexShrink: 0 }}>
        <div style={{ fontFamily: "var(--mono)", fontSize: 15, fontWeight: 700, color: "#e8f0fe", letterSpacing: "-0.01em" }}>
          3D Cut Optimizer
        </div>
        <div style={{ fontFamily: "var(--mono)", fontSize: 9, color: "var(--blue)", opacity: 0.65, marginTop: 3, letterSpacing: "0.1em" }}>
          GUILLOTINE · KERF · TRIM · LOCK
        </div>
      </div>

      {/* ── 스크롤 폼 영역 ──────────────────────────────── */}
      <div style={{ flex: 1, overflowY: "auto", padding: "15px 15px 6px" }}>

        {/* SETTINGS */}
        <SLabel>Settings</SLabel>
        <div className="card" style={{ marginBottom: 14 }}>
          <div className="g2" style={{ marginBottom: 8 }}>
            <div>
              <MLabel unit="mm">Kerf (톱날)</MLabel>
              <NInput value={settings.kerf} min={0} step={0.5}
                onChange={(v) => onSettings({ ...settings, kerf: v })} />
            </div>
            <div>
              <MLabel>Trimming X/Y</MLabel>
              <div style={{ display: "flex", gap: 4 }}>
                <NInput value={settings.trimming.x} min={0}
                  onChange={(v) => onSettings({ ...settings, trimming: { ...settings.trimming, x: v } })} center />
                <NInput value={settings.trimming.y} min={0}
                  onChange={(v) => onSettings({ ...settings, trimming: { ...settings.trimming, y: v } })} center />
              </div>
            </div>
          </div>
          <div style={{ fontFamily: "var(--mono)", fontSize: 9, color: "var(--text-dim)", lineHeight: 1.5 }}>
            Trimming은 원장 양단에서 각각 제거되는 여백(mm)입니다.
          </div>
        </div>

        {/* STOCKS */}
        <SLabel>
          원장 (Stocks)
          <span className="tag tb">{stocks.length}장</span>
        </SLabel>
        {stocks.map((s, i) => (
          <StockCard key={s._uid} s={s} idx={i}
            onChange={(v) => updStock(s._uid, v)}
            onDel={() => delStock(s._uid)} />
        ))}
        <button className="add" onClick={addStock} style={{ marginBottom: 14 }}>
          + 원장 추가
        </button>

        {/* PARTS */}
        <SLabel>
          부품 (Parts)
          <span className="tag tb">{parts.length}종</span>
          <span className="tag tg">{parts.reduce((s, p) => s + p.qty, 0)}개</span>
        </SLabel>
        {parts.map((p, i) => (
          <PartCard key={p._uid} p={p} idx={i} allIds={allIds}
            onChange={(v) => updPart(p._uid, v)}
            onDel={() => delPart(p._uid)} />
        ))}
        <button className="add" onClick={addPart} style={{ marginBottom: 8 }}>
          + 부품 추가
        </button>
      </div>

      {/* ── 하단 고정 영역 ──────────────────────────────── */}
      <div style={{
        padding: "12px 15px 18px",
        borderTop: "1px solid var(--border)",
        flexShrink: 0,
        background: "rgba(2,6,18,0.65)",
      }}>

        {/* 결과 요약 미니 카드 */}
        {stats && (
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 5, marginBottom: 12 }}>
            {[
              ["배치 완료", `${stats.total_placed}개`],
              ["효율",     `${stats.overall_efficiency_pct}%`, stats.overall_efficiency_pct >= 85],
              ["원장 사용", `${stats.stocks_used}장`],
              ["연산",     `${(stats.processing_time_sec * 1000).toFixed(0)}ms`],
            ].map(([lbl, val, good]) => (
              <div key={lbl} style={{
                background: "rgba(0,8,22,0.6)", border: "1px solid var(--border)",
                borderRadius: 6, padding: "7px 10px", fontFamily: "var(--mono)",
              }}>
                <div style={{ fontSize: 8, color: "var(--text-dim)", letterSpacing: "0.06em", marginBottom: 2 }}>{lbl}</div>
                <div style={{ fontSize: 15, fontWeight: 700, color: good ? "var(--green)" : "var(--text)" }}>{val}</div>
              </div>
            ))}
          </div>
        )}

        {/* 에러 */}
        {error && (
          <div style={{
            marginBottom: 10, padding: "8px 10px",
            background: "rgba(248,113,113,0.07)",
            border: "1px solid rgba(248,113,113,0.22)",
            borderRadius: 6, color: "var(--red)",
            fontFamily: "var(--mono)", fontSize: 10, lineHeight: 1.5,
          }}>
            ⚠ {error}
          </div>
        )}

        {/* OPTIMIZE 버튼 */}
        <button className="opt" onClick={onRun} disabled={!canRun}>
          {loading
            ? <span style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 10 }}>
                <span style={{
                  display: "inline-block", width: 13, height: 13,
                  border: "2px solid rgba(74,158,255,0.25)", borderTop: "2px solid var(--blue)",
                  borderRadius: "50%", animation: "spin 0.8s linear infinite",
                }} />
                COMPUTING...
              </span>
            : "▶  OPTIMIZE  계산하기"
          }
        </button>

        <div style={{
          marginTop: 7, fontFamily: "var(--mono)", fontSize: 9,
          color: "var(--text-dim)", textAlign: "center", lineHeight: 1.6,
        }}>
          {!canRun && !loading
            ? "원장과 부품을 각 1개 이상 추가하세요"
            : `원장 ${stocks.reduce((s, st) => s + st.qty, 0)}장 · 부품 ${parts.reduce((s, p) => s + p.qty, 0)}개 준비됨`
          }
        </div>
      </div>
    </div>
  );
}

// ══════════════════════════════════════════════════════════════════
// 11. 메인 App
// ══════════════════════════════════════════════════════════════════

export default function App() {
  const [settings, setSettings] = useState(DEFAULT_SETTINGS);
  const [stocks,   setStocks]   = useState(DEFAULT_STOCKS);
  const [parts,    setParts]    = useState(DEFAULT_PARTS);
  const [response, setResponse] = useState(null);
  const [loading,  setLoading]  = useState(false);
  const [error,    setError]    = useState(null);

  // _uid 필드 제거 후 requestBody 조립
  const requestBody = useMemo(() => ({
    settings: { kerf: settings.kerf, trimming: settings.trimming, optimization_goal: "MINIMIZE_WASTE" },
    stocks:   stocks.map(({ _uid, ...s }) => s),
    parts:    parts.map(({ _uid, ...p }) => p),
  }), [settings, stocks, parts]);

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
        const e = await res.json().catch(() => ({}));
        throw new Error(e.detail || e.error || `HTTP ${res.status}`);
      }
      setResponse(await res.json());
    } catch (e) {
      setError(
        e.message.includes("Failed to fetch")
          ? "FastAPI 서버(localhost:8000)에 연결할 수 없습니다."
          : e.message
      );
    } finally {
      setLoading(false);
    }
  }, [requestBody]);

  // 씬 데이터
  const sceneData  = useMemo(() => buildSceneData(response, requestBody.stocks), [response, requestBody.stocks]);
  const allPartIds = sceneData.allPartIds ?? [];
  const hasData    = (sceneData.groups?.length ?? 0) > 0;

  return (
    <>
      <style>{GLOBAL_CSS}</style>

      <div style={{ display: "flex", width: "100vw", height: "100vh", background: "var(--bg)", overflow: "hidden" }}>

        {/* ── 좌측 입력 패널 ───────────────────── */}
        <Sidebar
          settings={settings}   onSettings={setSettings}
          stocks={stocks}       onStocks={setStocks}
          parts={parts}         onParts={setParts}
          onRun={handleOptimize}
          loading={loading}     error={error}
          stats={response?.stats ?? null}
        />

        {/* ── 우측 3D 뷰어 ────────────────────── */}
        <div style={{ flex: 1, position: "relative", overflow: "hidden" }}>
          <Canvas
            shadows
            gl={{ antialias: true, toneMapping: THREE.ACESFilmicToneMapping }}
            style={{ position: "absolute", inset: 0 }}
          >
            <color attach="background" args={["#030814"]} />
            <fog attach="fog" args={["#030814", 12, 32]} />
            <Suspense fallback={null}>
              {hasData ? (
                <Scene sceneData={sceneData} />
              ) : (
                <>
                  <PerspectiveCamera makeDefault position={[4, 3, 5]} fov={45} />
                  <OrbitControls enableDamping dampingFactor={0.06} />
                  <ambientLight intensity={0.4} />
                  <Grid
                    args={[20, 20]} position={[1.22, -0.01, 0]}
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
