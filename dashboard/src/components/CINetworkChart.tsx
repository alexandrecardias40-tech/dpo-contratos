import { useEffect, useMemo, useState, useRef } from 'react';

type CINode = {
  centro_custo: string;
  empenhado: number;
  total_pago_tg: number;
  ressarcido: number;
  a_ressarcir: number;
  total_ci: number;
  qtd_nes: number;
  semaforo_verde: number;
  semaforo_amarelo: number;
  semaforo_vermelho: number;
};

type NetworkNode = {
  id: string; label: string; empenhado: number; pago: number;
  ressarcido: number; a_ressarcir: number; total_ci: number;
  qtd_nes: number; semaforo_verde: number; semaforo_amarelo: number; semaforo_vermelho: number;
  size: number; color: string; phase: number; isHub: boolean; ringIndex: number;
  originalData: CINode;
};

type Point = { x: number; y: number };
type Link = { id: string; source: string; target: string; speed: number; phase: number; glow: string };

const W = 1200; const H = 680;
const CX = W / 2; const CY = H / 2;
const MAX = 16;

const COLORS = ['#2f6bff','#13c7d6','#ff6b00','#f9d600','#2ed11e','#ff2d95','#7a4dff','#ff9f1c','#00d3a7','#d163ff','#4cc9f0','#f72585','#06d6a0','#ffd166','#e63946','#52b788'];
const seed = (s: number) => { const v = Math.sin(s * 12.9898) * 43758.5453; return v - Math.floor(v); };
const clamp = (v: number, a: number, b: number) => Math.max(a, Math.min(b, v));
const lerp = (a: number, b: number, t: number) => a + (b - a) * t;

export default function CINetworkChart({
  data, height = 680, onNodeClick
}: {
  data: CINode[];
  height?: number;
  onNodeClick?: (node: CINode | null) => void;
}) {
  const [time, setTime] = useState(0);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });
  const [draggedNodeId, setDraggedNodeId] = useState<string | null>(null);
  const [nodeOverrides, setNodeOverrides] = useState<Map<string, Point>>(new Map());
  const [lastMouse, setLastMouse] = useState({ x: 0, y: 0 });
  const [mouseDownPos, setMouseDownPos] = useState({ x: 0, y: 0 });
  const [hoveredId, setHoveredId] = useState<string | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const svgRef = useRef<SVGSVGElement>(null);
  
  const [windowWidth, setWindowWidth] = useState(typeof window !== "undefined" ? window.innerWidth : 1200);

  useEffect(() => {
    const handleResize = () => setWindowWidth(window.innerWidth);
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  const isMobileSize = windowWidth <= 768;
  const viewBoxW = isMobileSize ? 550 : 1200;
  const viewBoxH = isMobileSize ? 550 : 680;
  const cx = viewBoxW / 2;
  const cy = viewBoxH / 2;

  useEffect(() => {
    let af = 0;
    const animate = (t: number) => { setTime(t); af = requestAnimationFrame(animate); };
    af = requestAnimationFrame(animate);
    return () => cancelAnimationFrame(af);
  }, []);

  const getSVGPoint = (cx: number, cy: number): Point => {
    const svg = svgRef.current; if (!svg) return { x: 0, y: 0 };
    const pt = svg.createSVGPoint(); pt.x = cx; pt.y = cy;
    return pt.matrixTransform(svg.getScreenCTM()?.inverse()) as Point;
  };

  const handleBgDown = (e: React.MouseEvent) => {
    setLastMouse({ x: e.clientX, y: e.clientY });
    setMouseDownPos({ x: e.clientX, y: e.clientY });
    setIsDragging(true);
  };
  const handleNodeDown = (e: React.MouseEvent, nodeId: string) => {
    e.stopPropagation();
    setMouseDownPos({ x: e.clientX, y: e.clientY });
    setLastMouse({ x: e.clientX, y: e.clientY });
    setDraggedNodeId(nodeId);
  };
  const handleMouseMove = (e: React.MouseEvent) => {
    if (isDragging && !draggedNodeId) {
      setPan(p => ({ x: p.x + e.clientX - lastMouse.x, y: p.y + e.clientY - lastMouse.y }));
      setLastMouse({ x: e.clientX, y: e.clientY });
    } else if (draggedNodeId) {
      const pos = getSVGPoint(e.clientX, e.clientY);
      setNodeOverrides(prev => { const m = new Map(prev); m.set(draggedNodeId, pos); return m; });
      setLastMouse({ x: e.clientX, y: e.clientY });
    }
  };
  const handleUp = () => { setIsDragging(false); setDraggedNodeId(null); };

  const handleNodeClick = (e: React.MouseEvent, node: NetworkNode) => {
    e.stopPropagation();
    const dist = Math.hypot(e.clientX - mouseDownPos.x, e.clientY - mouseDownPos.y);
    if (dist < 6) {
      if (node.isHub) { setSelectedId(null); onNodeClick?.(null); return; }
      setSelectedId(node.id);
      onNodeClick?.(node.originalData);
    }
  };

  const stars = useMemo(() => Array.from({ length: 260 }, (_, i) => ({
    id: i, x: seed(i + 11) * viewBoxW, y: seed(i + 73) * viewBoxH,
    r: 0.3 + seed(i + 131) * 1.7, phase: seed(i + 211) * Math.PI * 2, int: 0.15 + seed(i + 271) * 0.85
  })), [viewBoxW, viewBoxH]);

  const nodes = useMemo<NetworkNode[]>(() => {
    const ordered = [...(data || [])].sort((a, b) => (b.empenhado || 0) - (a.empenhado || 0)).slice(0, MAX);
    const maxE = Math.max(...ordered.map(d => d.empenhado || 0), 1);
    const minE = Math.min(...ordered.map(d => d.empenhado || 0), maxE);

    const sats = ordered.map((item, i) => {
      const norm = maxE === minE ? 0.5 : (item.empenhado - minE) / (maxE - minE);
      return {
        id: `ci-${i}`, label: item.centro_custo || `CC${i}`,
        empenhado: item.empenhado || 0, pago: item.total_pago_tg || 0,
        ressarcido: item.ressarcido || 0, a_ressarcir: item.a_ressarcir || 0,
        total_ci: item.total_ci || 0, qtd_nes: item.qtd_nes || 0,
        semaforo_verde: item.semaforo_verde || 0,
        semaforo_amarelo: item.semaforo_amarelo || 0,
        semaforo_vermelho: item.semaforo_vermelho || 0,
        size: clamp(24 + norm * 30, 22, 56),
        color: COLORS[i % COLORS.length], phase: seed(i + 541) * Math.PI * 2,
        isHub: false, ringIndex: i, originalData: item,
      };
    });

    const hub: NetworkNode = {
      id: 'hub', label: 'UnB CI',
      empenhado: sats.reduce((s, n) => s + n.empenhado, 0),
      pago: sats.reduce((s, n) => s + n.pago, 0),
      ressarcido: sats.reduce((s, n) => s + n.ressarcido, 0),
      a_ressarcir: sats.reduce((s, n) => s + n.a_ressarcir, 0),
      total_ci: sats.reduce((s, n) => s + n.total_ci, 0),
      qtd_nes: sats.reduce((s, n) => s + n.qtd_nes, 0),
      semaforo_verde: sats.reduce((s, n) => s + n.semaforo_verde, 0),
      semaforo_amarelo: sats.reduce((s, n) => s + n.semaforo_amarelo, 0),
      semaforo_vermelho: sats.reduce((s, n) => s + n.semaforo_vermelho, 0),
      size: 62, color: '#2f6bff', phase: 0, isHub: true, ringIndex: -1,
      originalData: { centro_custo: 'UnB CI', empenhado: 0, total_pago_tg: 0, ressarcido: 0, a_ressarcir: 0, total_ci: 0, qtd_nes: 0, semaforo_verde: 0, semaforo_amarelo: 0, semaforo_vermelho: 0 },
    };
    return [hub, ...sats];
  }, [data]);

  const positions = useMemo(() => {
    const m = new Map<string, Point>();
    const ring = nodes.filter(n => !n.isHub);
    const count = Math.max(ring.length, 1);
    nodes.forEach(n => {
      // If overridden (dragged), use that position
      if (nodeOverrides.has(n.id)) { m.set(n.id, nodeOverrides.get(n.id)!); return; }
      if (n.isHub) {
        m.set(n.id, { x: cx + Math.sin(time * 0.00028) * 14, y: cy - 18 + Math.cos(time * 0.00024) * 8 });
        return;
      }
      
      const isEven = n.ringIndex % 2 === 0;
      const angle = (n.ringIndex / count) * Math.PI * 2 + time * 0.00012;
      
      // Órbitas em dois anéis alternados para evitar qualquer colisão e sobreposição (ligeiramente mais afastados)
      const r = isMobileSize 
        ? (135 + (isEven ? 0 : 40)) 
        : (255 + (isEven ? 0 : 60));
        
      const w = 4 + n.size * 0.05; // Oscilação sutil para um efeito flutuante elegante sem colidir
      
      m.set(n.id, {
        x: cx + Math.cos(angle) * r + Math.sin(time * 0.0008 + n.phase) * w,
        y: cy + Math.sin(angle) * (r * (isMobileSize ? 0.72 : 0.6)) + Math.cos(time * 0.0006 + n.phase) * w * 0.5
      });
    });
    return m;
  // hoveredId in deps: when hovered, we snapshot position and stop moving that node
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [nodes, hoveredId ? null : time, nodeOverrides, hoveredId, cx, cy, isMobileSize]);

  const links = useMemo<Link[]>(() => {
    const ring = nodes.filter(n => !n.isHub);
    const ls: Link[] = [];
    ring.forEach((n, i) => {
      ls.push({ id: `h-${n.id}`, source: 'hub', target: n.id, speed: 0.00020 + (i % 4) * 0.00003, phase: seed(i + 41), glow: 'rgba(255,255,255,0.9)' });
      const next = ring[(i + 1) % ring.length];
      ls.push({ id: `r-${n.id}`, source: n.id, target: next.id, speed: 0.00013 + (i % 3) * 0.00003, phase: seed(i + 113), glow: 'rgba(255,255,255,0.5)' });
      if (ring.length > 5 && i % 2 === 0) {
        const jump = ring[(i + 3) % ring.length];
        ls.push({ id: `j-${n.id}`, source: n.id, target: jump.id, speed: 0.00012, phase: seed(i + 181), glow: 'rgba(255,200,100,0.55)' });
      }
    });
    return ls;
  }, [nodes]);

  const shortLabel = (s: string, max = 5) => s.length <= max ? s : s.slice(0, max - 1) + '…';

  return (
    <div
      style={{ position: 'relative', borderRadius: 0, overflow: 'hidden', background: '#030b1c', cursor: isDragging ? 'grabbing' : 'grab', userSelect: 'none' }}
      onMouseDown={handleBgDown} onMouseMove={handleMouseMove} onMouseUp={handleUp} onMouseLeave={handleUp}
    >
      <svg ref={svgRef} viewBox={`${-pan.x} ${-pan.y} ${viewBoxW} ${viewBoxH}`} width="100%" height={height} preserveAspectRatio="xMidYMid meet">
        <defs>
          <radialGradient id="bg-g" cx="50%" cy="45%" r="75%">
            <stop offset="0%" stopColor="#102a58" />
            <stop offset="35%" stopColor="#071a3a" />
            <stop offset="100%" stopColor="#030b1c" />
          </radialGradient>
          {nodes.map(n => (
            <radialGradient key={`g${n.id}`} id={`g${n.id}`} cx="35%" cy="30%" r="70%">
              <stop offset="0%" stopColor="#fff" stopOpacity="0.9" />
              <stop offset="26%" stopColor={n.color} stopOpacity="0.98" />
              <stop offset="100%" stopColor={n.color} stopOpacity="0.45" />
            </radialGradient>
          ))}
          <filter id="glow-strong"><feGaussianBlur stdDeviation="3" result="blur"/><feMerge><feMergeNode in="blur"/><feMergeNode in="SourceGraphic"/></feMerge></filter>
        </defs>

        {/* Space background */}
        <rect x={-pan.x - viewBoxW} y={-pan.y - viewBoxH} width={viewBoxW * 3} height={viewBoxH * 3} fill="url(#bg-g)" />

        {/* Stars */}
        {stars.map(s => <circle key={s.id} cx={s.x} cy={s.y} r={s.r} fill="white" opacity={s.int * (0.45 + 0.55 * Math.sin(time * 0.0011 + s.phase))} />)}

        {/* Links */}
        {links.map(link => {
          const src = positions.get(link.source); const tgt = positions.get(link.target);
          if (!src || !tgt) return null;
          return (
            <g key={link.id} style={{ pointerEvents: 'none' }}>
              <line x1={src.x} y1={src.y} x2={tgt.x} y2={tgt.y} stroke="rgba(180,210,255,0.12)" strokeWidth={1.5} />
              <line x1={src.x} y1={src.y} x2={tgt.x} y2={tgt.y} stroke={link.glow} strokeOpacity={0.25} strokeWidth={1} />
              {[0, 0.5].map((off, idx) => {
                const t = (time * link.speed + link.phase + off) % 1;
                return <circle key={idx} cx={lerp(src.x, tgt.x, t)} cy={lerp(src.y, tgt.y, t)} r={idx === 0 ? 2.5 : 1.8} fill="white" opacity={0.8} style={{ filter: 'drop-shadow(0 0 5px rgba(255,255,255,0.9))' }} />;
              })}
            </g>
          );
        })}

        {/* Nodes */}
        {nodes.map(n => {
          const pos = positions.get(n.id); if (!pos) return null;
          const isHov = hoveredId === n.id;
          const isSel = selectedId === n.id;
          const labelSize = n.isHub ? 15 : Math.max(10, Math.min(14, n.size * 0.28));
          const scale = isHov || isSel ? 1.15 : 1;

          return (
            <g key={n.id}
              onMouseDown={e => handleNodeDown(e, n.id)}
              onClick={e => handleNodeClick(e, n)}
              onMouseEnter={() => setHoveredId(n.id)}
              onMouseLeave={() => setHoveredId(null)}
              style={{ cursor: 'pointer', transform: `scale(${scale})`, transformOrigin: `${pos.x}px ${pos.y}px`, transition: 'transform 0.2s' }}
            >
              {/* Outer halo */}
              <circle cx={pos.x} cy={pos.y} r={n.size + (n.isHub ? 18 : 14)} fill={n.color}
                opacity={isSel ? 0.45 : isHov ? 0.35 : n.isHub ? 0.22 : 0.16}
                style={{ filter: `blur(${n.isHub ? 5 : 3}px)`, transition: 'opacity 0.2s' }} />
              {/* Selection ring */}
              {isSel && <circle cx={pos.x} cy={pos.y} r={n.size + 4} fill="none" stroke="white" strokeWidth={2} strokeDasharray="6 3" opacity={0.9}
                style={{ animation: 'spin 4s linear infinite' }} />}
              {/* Main sphere */}
              <circle cx={pos.x} cy={pos.y} r={n.size} fill={`url(#g${n.id})`}
                stroke={isSel ? 'rgba(255,255,255,0.95)' : n.isHub ? 'rgba(132,204,255,0.9)' : 'rgba(255,255,255,0.4)'}
                strokeWidth={isSel ? 2.5 : n.isHub ? 2.2 : 1.4}
                style={{ filter: `drop-shadow(0 0 ${n.isHub ? 20 : isHov ? 16 : 11}px ${n.color})`, transition: 'filter 0.2s' }} />
              {/* Specular highlight */}
              <circle cx={pos.x - n.size * 0.22} cy={pos.y - n.size * 0.24} r={n.size * 0.15} fill="white" opacity={0.32} style={{ pointerEvents: 'none' }} />
              {/* Label */}
              <text x={pos.x} y={pos.y + labelSize * 0.32} textAnchor="middle" fontSize={labelSize} fontWeight={700} fill="#f8fafc"
                style={{ letterSpacing: '0.2px', textShadow: '0 1px 4px rgba(0,0,0,0.7)', pointerEvents: 'none' }}>
                {shortLabel(n.label, n.isHub ? 7 : 5)}
              </text>
              {/* Click hint on hover (non-hub) */}
              {isHov && !n.isHub && (
                <text x={pos.x} y={pos.y + n.size + 18} textAnchor="middle" fontSize={9} fill="rgba(255,255,255,0.7)" style={{ pointerEvents: 'none' }}>
                  clique para detalhes
                </text>
              )}
            </g>
          );
        })}
      </svg>

      {/* Legend bottom */}
      <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0, padding: '7px 18px', background: 'rgba(3,11,28,0.82)', backdropFilter: 'blur(8px)', borderTop: '1px solid rgba(51,65,85,0.5)', fontSize: 10, color: '#64748b', display: 'flex', gap: 18, alignItems: 'center' }}>
        <span style={{ color: '#475569' }}>• Tamanho do nó = volume empenhado</span>
        <span style={{ color: '#475569' }}>• Linhas = fluxo financeiro entre unidades</span>
        <span style={{ color: '#93c5fd', marginLeft: 'auto', fontWeight: 600 }}>🖱️ Clique no nó para detalhes • Arraste para navegar</span>
      </div>

      <style>{`@keyframes spin { from { stroke-dashoffset: 0 } to { stroke-dashoffset: -18 } }`}</style>
    </div>
  );
}
