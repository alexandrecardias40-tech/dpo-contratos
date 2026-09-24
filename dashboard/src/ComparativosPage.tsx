import { useMemo, useState, useEffect } from "react";
import { useData } from "./DataProvider";
import DashboardLayout from "./components/DashboardLayout";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  Legend, Cell, AreaChart, Area
} from "recharts";
import { TrendingUp, DollarSign, AlertTriangle, Target, Wallet, ArrowUpRight } from "lucide-react";
import { FonteBadge } from "./components/ui/FonteBadge";

const fmt  = (v: number) => new Intl.NumberFormat("pt-BR",{style:"currency",currency:"BRL",minimumFractionDigits:0,maximumFractionDigits:0}).format(v||0);
const fmtM = (v: number) => `R$ ${((v||0)/1e6).toFixed(1)}M`;
const pct  = (a:number,b:number) => b>0?((a/b)*100).toFixed(1)+"%":"—";

export function calcUnidadeValues(d: any) {
  // Para Emendas, confiamos 100% no dado do backend (build_data.py)
  if (d.fonte === "Emenda") {
    const a = Number(d.a_ressarcir) || 0;
    const r = Number(d.ressarcido) || 0;
    const emp = Number(d.empenhado) || 0;
    const pago = Number(d.total_pago_tg) || 0;
    
    // Regra solicitada: só entra o valor "a ressarcir" quando houver empenho e pagamento juntos
    const canHaveRessarcir = (emp > 0 && pago > 0);

    return {
      aRessarcirVal: (a > 0 && canHaveRessarcir) ? a / 2 : null,
      ressarcidoVal: r > 0 ? r / 2 : null,
    };
  }

  // Para TED, mantemos a lógica clássica da interface (que baseia no TG)
  const sem = d.semaforo;
  const pago = Number(d.total_pago_tg) || 0;
  const emp = Number(d.empenhado) || 0;

  let aRessarcirVal: number | null = null;
  let ressarcidoVal: number | null = null;

  if (sem === 'verde') {
    ressarcidoVal = pago / 2;
    aRessarcirVal = null;
  } else if (sem === 'amarelo') {
    aRessarcirVal = pago / 2;
    ressarcidoVal = null;
  } else if (emp > 0 && pago > 0) {
    aRessarcirVal = pago / 2;
    ressarcidoVal = null;
  } else {
    aRessarcirVal = null;
    ressarcidoVal = null;
  }

  return { aRessarcirVal, ressarcidoVal };
}

/* ── palette ── */
const C = { blue:"#3b82f6", green:"#10b981", red:"#ef4444", amber:"#f59e0b", purple:"#8b5cf6", teal:"#14b8a6", slate:"#64748b" };

/* ── custom legend ── */
const RessLegend = () => (
  <div style={{ display:"flex", justifyContent:"center", gap:20, paddingTop:10, fontSize:11 }}>
    <span style={{ display:"flex", alignItems:"center", gap:5 }}>
      <span style={{ width:10, height:10, borderRadius:"50%", background:C.teal, display:"inline-block" }}/>
      Ressarcido
    </span>
    <span style={{ display:"flex", alignItems:"center", gap:5 }}>
      <span style={{ width:10, height:10, borderRadius:"50%", background:C.red, display:"inline-block" }}/>
      A Ressarcir
    </span>
  </div>
);

/* ── aggregation ── */
function buildData(data: any[]) {
  // by centro_custo
  const byCC: Record<string,any> = {};
  data.forEach(d => {
    const cc = (d.centro_custo||"Outros").trim();
    if (!byCC[cc]) byCC[cc] = { cc, emp:0, pago:0, ress:0, a_ress:0, total_ci:0, n:0, verde:0, amarelo:0, verm:0 };
    byCC[cc].emp     += Number(d.empenhado)||0;
    byCC[cc].pago    += Number(d.total_pago_tg)||0;
    byCC[cc].total_ci+= Number(d.total_ci)||0;

    const { aRessarcirVal, ressarcidoVal } = calcUnidadeValues(d);
    byCC[cc].ress    += (ressarcidoVal || 0);
    byCC[cc].a_ress  += (aRessarcirVal || 0);

    byCC[cc].n++;
    if (d.semaforo==="verde")    byCC[cc].verde++;
    if (d.semaforo==="amarelo")  byCC[cc].amarelo++;
    if (d.semaforo==="vermelho") byCC[cc].verm++;
  });

  // by ano
  const byAno: Record<number,any> = {};
  data.forEach(d => {
    const ano = Number(d.ano)||0; if (!ano) return;
    if (!byAno[ano]) byAno[ano] = { ano, emp:0, pago:0, ress:0, a_ress:0, n:0 };
    byAno[ano].emp   += Number(d.empenhado)||0;
    byAno[ano].pago  += Number(d.total_pago_tg)||0;

    const { aRessarcirVal, ressarcidoVal } = calcUnidadeValues(d);
    byAno[ano].ress  += (ressarcidoVal || 0);
    byAno[ano].a_ress+= (aRessarcirVal || 0);

    byAno[ano].n++;
  });

  const ccArr = Object.values(byCC).sort((a:any,b:any)=>b.emp-a.emp);
  const anoArr = Object.values(byAno).sort((a:any,b:any)=>a.ano-b.ano);

  const totEmp  = ccArr.reduce((s:number,r:any)=>s+r.emp,0);
  const totPago = ccArr.reduce((s:number,r:any)=>s+r.pago,0);
  const totRess = ccArr.reduce((s:number,r:any)=>s+r.ress,0);
  const totARess= ccArr.reduce((s:number,r:any)=>s+r.a_ress,0);
  const totVerde= data.filter(d=>d.semaforo==="verde").length;
  const totVerm = data.filter(d=>d.semaforo==="vermelho").length;

  // Top 15 for charts and table
  const top12 = ccArr.slice(0,15).map((r:any)=>({
    name: r.cc.length>14?r.cc.slice(0,13)+"…":r.cc,
    fullName: r.cc,
    Empenhado: r.emp, "Pago (TG)": r.pago, Ressarcido: r.ress, "A Ressarcir": r.a_ress,
    pctRess: (r.total_ci / 2)>0?((r.ress/(r.total_ci / 2))*100):0,
    registros: r.n,
  }));

  // Maior pendente
  const maisPendente = ccArr.sort((a:any,b:any)=>b.a_ress-a.a_ress)[0];
  const maisRessarcida= [...Object.values(byCC)].sort((a:any,b:any)=>b.ress-a.ress)[0];

  return { top12, anoArr, totEmp, totPago, totRess, totARess, totVerde, totVerm, maisPendente, maisRessarcida, nCC: ccArr.length };
}

/* ── custom tooltip ── */
const DarkTooltip = ({ active, payload, label }: any) => {
  if (!active||!payload?.length) return null;
  return (
    <div style={{ background:"#0f172a", color:"#f1f5f9", borderRadius:10, padding:"10px 14px", fontSize:11, boxShadow:"0 8px 24px rgba(0,0,0,0.3)", minWidth:180 }}>
      <div style={{ fontWeight:700, marginBottom:6, borderBottom:"1px solid #1e293b", paddingBottom:4 }}>{payload[0]?.payload?.fullName||label}</div>
      {payload.map((p:any)=>(
        <div key={p.name} style={{ display:"flex", justifyContent:"space-between", gap:16, marginTop:3 }}>
          <span style={{ color:"#94a3b8" }}>{p.name}</span>
          <span style={{ fontWeight:700, color:p.color||"#f1f5f9" }}>{fmt(p.value)}</span>
        </div>
      ))}
    </div>
  );
};

/* ── Bar label ── */
const PctLabel = ({ x, y, width, value }: any) => {
  if (!value||value<1) return null;
  return <text x={x+width+4} y={y+10} fontSize={9} fill="#64748b">{value.toFixed(0)}%</text>;
};

export default function ComparativosPage() {
  const { data: rawData, loading } = useData();
  const [selAno, setSelAno] = useState("all");
  const [selFonte, setSelFonte] = useState("all");
  const [isMobile, setIsMobile] = useState(false);
  const [activeSlide, setActiveSlide] = useState(0);

  useEffect(() => {
    const handleResize = () => setIsMobile(window.innerWidth <= 768);
    handleResize();
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  const all = useMemo(() => {
    return rawData.map((d: any) => {
      let fav = (d.favorecido || "").trim();
      const upperFav = fav.toUpperCase();
      if (upperFav.includes("COMPANHIA DE SANEAMENTO")) {
        fav = "CAESB";
      } else if (upperFav.includes("NEOENERGIA") || upperFav.includes("NEO ENERGIA")) {
        fav = "NEO ENERGIA";
      } else if (upperFav.includes("RCA PRODUTOS")) {
        fav = "RCA";
      }
      return { ...d, favorecido: fav };
    }).filter((d: any) => d.ano >= 2020);
  }, [rawData]);
  const [view, setView] = useState<"empenhado"|"ressarcimento">("empenhado");

  const anos = useMemo(() => {
    const dataByFonte = selFonte === "all" ? all : all.filter((d: any) => d.fonte === selFonte);
    return Array.from(new Set(dataByFonte.map((d: any) => d.ano).filter(Boolean))).sort() as number[];
  }, [all, selFonte]);

  useEffect(() => {
    if (selAno !== "all" && !anos.includes(Number(selAno))) {
      setSelAno("all");
    }
  }, [anos, selAno]);

  const filteredData = useMemo(() => {
    return all.filter((d: any) => {
      if (selAno !== "all" && String(d.ano) !== selAno) return false;
      if (selFonte !== "all" && d.fonte !== selFonte) return false;
      return true;
    });
  }, [all, selAno, selFonte]);

  const labelFonte = selFonte === "all" ? "TED / Emenda" : selFonte;

  const D = useMemo(() => buildData(filteredData), [filteredData]);

  const s = {
    card: { background:"white", borderRadius:12, border:"1px solid #e2e8f0", boxShadow:"0 1px 6px rgba(0,0,0,0.06)" } as React.CSSProperties,
    section: { fontWeight:700, fontSize:13, color:"#0f172a", marginBottom:4 } as React.CSSProperties,
  };

  return (
    <DashboardLayout>
      {loading ? (
        <div style={{ padding: "40px", textAlign: "center", color: "#64748b" }}>Carregando dados em tempo real...</div>
      ) : (
      <div style={{ display:"flex", flexDirection:"column", gap:24 }}>

        {/* ── Header ── */}
        <div style={{ borderBottom:"1px solid #e2e8f0", paddingBottom:18, display:"flex", justifyContent:"space-between", alignItems:isMobile?"flex-start":"center", flexWrap:"wrap", flexDirection:isMobile?"column":"row", gap:14 }}>
          <div>
            <h1 style={{ fontSize:isMobile?20:26, fontWeight:800, color:"#0f172a", margin:0, letterSpacing:"-0.5px", display:"flex", alignItems:isMobile?"flex-start":"center", flexDirection:isMobile?"column":"row", gap:isMobile?6:10 }}>
              Painel de Inteligência — Contratos <FonteBadge fonte={selFonte} size={isMobile?"sm":"lg"} />
            </h1>
            <p style={{ fontSize:13, color:"#64748b", marginTop:4 }}>
              Visão estratégica de execução, ressarcimento e comparativos por unidade e ano · {filteredData.length} registros · {D.nCC} unidades
            </p>
          </div>
        </div>

        {/* ── KPIs ── */}
        {isMobile ? (
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, padding: "2px 0", width: "100%", boxSizing: "border-box" }}>
            <div style={{ background:"white", borderRadius:10, border:"1px solid #e2e8f0", borderLeft:"3.5px solid #3b82f6", boxShadow:"0 2px 4px rgba(0,0,0,0.03)", padding:"8px 10px", display:"flex", flexDirection:"column", justifyContent:"space-between", minHeight:68, boxSizing:"border-box", overflow:"hidden" }}>
              <div style={{ fontSize:9, fontWeight:700, color:"#64748b", textTransform:"uppercase", letterSpacing:"0.02em", display:"flex", alignItems:"center", gap:3, whiteSpace:"nowrap", overflow:"hidden", textOverflow:"ellipsis" }}>
                <span>📋</span> Empenhado
              </div>
              <div style={{ fontSize:13.5, fontWeight:800, color:"#0f172a", marginTop:3, lineHeight:1.1, whiteSpace:"nowrap", overflow:"hidden", textOverflow:"ellipsis" }}>{fmt(D.totEmp)}</div>
              <div style={{ fontSize:8.5, color:"#94a3b8", marginTop:2, whiteSpace:"nowrap", overflow:"hidden", textOverflow:"ellipsis" }}>Base TG</div>
            </div>

            <div style={{ background:"white", borderRadius:10, border:"1px solid #e2e8f0", borderLeft:"3.5px solid #10b981", boxShadow:"0 2px 4px rgba(0,0,0,0.03)", padding:"8px 10px", display:"flex", flexDirection:"column", justifyContent:"space-between", minHeight:68, boxSizing:"border-box", overflow:"hidden" }}>
              <div style={{ fontSize:9, fontWeight:700, color:"#64748b", textTransform:"uppercase", letterSpacing:"0.02em", display:"flex", alignItems:"center", gap:3, whiteSpace:"nowrap", overflow:"hidden", textOverflow:"ellipsis" }}>
                <span>💳</span> Pago (TG)
              </div>
              <div style={{ fontSize:13.5, fontWeight:800, color:"#0f172a", marginTop:3, lineHeight:1.1, whiteSpace:"nowrap", overflow:"hidden", textOverflow:"ellipsis" }}>{fmt(D.totPago)}</div>
              <div style={{ fontSize:8.5, color:"#94a3b8", marginTop:2, whiteSpace:"nowrap", overflow:"hidden", textOverflow:"ellipsis" }}>{pct(D.totPago, D.totEmp)} do emp.</div>
            </div>

            <div style={{ background:"white", borderRadius:10, border:"1px solid #e2e8f0", borderLeft:"3.5px solid #14b8a6", boxShadow:"0 2px 4px rgba(0,0,0,0.03)", padding:"8px 10px", display:"flex", flexDirection:"column", justifyContent:"space-between", minHeight:68, boxSizing:"border-box", overflow:"hidden" }}>
              <div style={{ fontSize:9, fontWeight:700, color:"#64748b", textTransform:"uppercase", letterSpacing:"0.02em", display:"flex", alignItems:"center", gap:3, whiteSpace:"nowrap", overflow:"hidden", textOverflow:"ellipsis" }}>
                <span>💰</span> Ressarcido
              </div>
              <div style={{ fontSize:13.5, fontWeight:800, color:"#0f172a", marginTop:3, lineHeight:1.1, whiteSpace:"nowrap", overflow:"hidden", textOverflow:"ellipsis" }}>{fmt(D.totRess)}</div>
              <div style={{ fontSize:8.5, color:"#94a3b8", marginTop:2, whiteSpace:"nowrap", overflow:"hidden", textOverflow:"ellipsis" }}>{pct(D.totRess, D.totRess + D.totARess)} do tot. CI</div>
            </div>

            <div style={{ background:"white", borderRadius:10, border:"1px solid #e2e8f0", borderLeft:"3.5px solid #ef4444", boxShadow:"0 2px 4px rgba(0,0,0,0.03)", padding:"8px 10px", display:"flex", flexDirection:"column", justifyContent:"space-between", minHeight:68, boxSizing:"border-box", overflow:"hidden" }}>
              <div style={{ fontSize:9, fontWeight:700, color:"#64748b", textTransform:"uppercase", letterSpacing:"0.02em", display:"flex", alignItems:"center", gap:3, whiteSpace:"nowrap", overflow:"hidden", textOverflow:"ellipsis" }}>
                <span>⚠️</span> A Ressarcir
              </div>
              <div style={{ fontSize:13.5, fontWeight:800, color:"#0f172a", marginTop:3, lineHeight:1.1, whiteSpace:"nowrap", overflow:"hidden", textOverflow:"ellipsis" }}>{fmt(D.totARess)}</div>
              <div style={{ fontSize:8.5, color:"#94a3b8", marginTop:2, whiteSpace:"nowrap", overflow:"hidden", textOverflow:"ellipsis" }}>{pct(D.totARess, D.totRess + D.totARess)} do tot. CI</div>
            </div>
          </div>
        ) : (
          <div style={{ display:"grid", gridTemplateColumns:"repeat(auto-fit,minmax(240px,1fr))", gap:14 }}>
            {[
              { label:<span style={{display:"flex",alignItems:"center",gap:3,whiteSpace:"nowrap"}}>Total Empenhado <FonteBadge fonte={selFonte} size="xs" /></span>,      value:fmt(D.totEmp),                  color:C.blue,   icon:<span style={{fontSize:15,fontWeight:800}}>R$</span>,    sub:"Base Tesouro Gerencial" },
              { label:<span style={{display:"flex",alignItems:"center",gap:3,whiteSpace:"nowrap"}}>Total Pago (TG) <FonteBadge fonte={selFonte} size="xs" /></span>,            value:fmt(D.totPago),                 color:C.green,  icon:<TrendingUp size={16}/>,    sub:pct(D.totPago,D.totEmp)+" do empenhado" },
              { label:<span style={{display:"flex",alignItems:"center",gap:3,whiteSpace:"nowrap"}}>Ressarcido (Unid) <FonteBadge fonte={selFonte} size="xs" /></span>,       value:fmt(D.totRess),                 color:C.teal,   icon:<Wallet size={16}/>,        sub:pct(D.totRess,D.totRess+D.totARess)+" do total CI" },
              { label:<span style={{display:"flex",alignItems:"center",gap:3,whiteSpace:"nowrap"}}>A Ressarcir (Unid) <FonteBadge fonte={selFonte} size="xs" /></span>,      value:fmt(D.totARess),                color:C.red,    icon:<AlertTriangle size={16}/>, sub:pct(D.totARess,D.totRess+D.totARess)+" do total CI" },
              { label:<span style={{display:"flex",alignItems:"center",gap:3,whiteSpace:"nowrap"}}>Índice Ressarc. <FonteBadge fonte={selFonte} size="xs" /></span>,    value:pct(D.totVerde,filteredData.length),     color:"#0f172a",icon:<Target size={16}/>,        sub:`${D.totVerde} de ${filteredData.length} registros` },
              { label:<span style={{display:"flex",alignItems:"center",gap:3,whiteSpace:"nowrap"}}>Pendências <FonteBadge fonte={selFonte} size="xs" /></span>,        value:`${D.totVerm}`,                 color:C.red,    icon:<ArrowUpRight size={16}/>,  sub:"Registros sem ressarcimento" },
            ].map(k=>(
              <div key={typeof k.label === 'string' ? k.label : Math.random()} style={{ ...s.card, borderLeft:`4px solid ${k.color}`, padding:"14px 16px" }}>
                <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:6, gap: 8 }}>
                  <div style={{ fontSize:9, fontWeight:600, color:"#64748b", textTransform:"uppercase", letterSpacing:"0.04em", flex:1, overflow:"hidden" }}>{k.label}</div>
                  <span style={{ color:k.color, opacity:0.7, flexShrink:0 }}>{k.icon}</span>
                </div>
                <div style={{ fontSize:20, fontWeight:800, color:"#0f172a", lineHeight:1 }}>{k.value}</div>
                <div style={{ fontSize:10, color:"#94a3b8", marginTop:4 }}>{k.sub}</div>
              </div>
            ))}
          </div>
        )}

        {/* ── Toggle + Bar chart por unidade ── */}
        <div style={{ ...s.card, padding:0, overflow:"hidden" }}>
          <div style={{ padding:"14px 18px", borderBottom:"1px solid #e2e8f0", display:"flex", justifyContent:"space-between", alignItems:"center", flexWrap:"wrap", gap:12 }}>
            <div>
              <div style={s.section}>Top 12 Unidades — Comparativo de Execução e Ressarcimento</div>
              <div style={{ fontSize:11, color:"#64748b" }}>Valores em milhões · Ordenado por volume empenhado</div>
            </div>
            
            <div style={{ display:"flex", alignItems:"center", gap:14, flexWrap:"wrap" }}>
              <div style={{ display:"flex", flexDirection:"column", gap:3, alignItems:"center" }}>
                <div style={{fontSize:11,fontWeight:600,color:"#475569", display: "flex", gap: 4, alignItems: "center"}}>
                  Origem
                  <span style={{background: "#e2e8f0", color: "#1e293b", padding: "2px 6px", borderRadius: 4, fontSize: 10, fontWeight: 700}}>
                    {selFonte === "all" ? "TED / EMENDA" : selFonte.toUpperCase()}
                  </span>
                </div>
                <select value={selFonte} onChange={e=>setSelFonte(e.target.value)}
                  style={{ padding:"4px 8px", border:"1px solid #d1d5db", borderRadius:6, fontSize:11, background:"white", cursor:"pointer", minWidth:140, boxShadow:"0 1px 2px rgba(0,0,0,0.05)" }}>
                  <option value="all">Todas as Origens</option>
                  <option value="TED">Somente TED</option>
                  <option value="Emenda">Somente Emenda</option>
                </select>
              </div>

              <div style={{ display:"flex", flexDirection:"column", gap:3, alignItems:"center" }}>
                <span style={{ fontSize:11, fontWeight:600, color:"#475569" }}>Ano</span>
                <select value={selAno} onChange={e=>setSelAno(e.target.value)}
                  style={{ padding:"4px 8px", border:"1px solid #d1d5db", borderRadius:6, fontSize:11, background:"white", cursor:"pointer", minWidth:100, boxShadow:"0 1px 2px rgba(0,0,0,0.05)" }}>
                  <option value="all">Todos</option>
                  {anos.map(a=><option key={a} value={String(a)}>{a}</option>)}
                </select>
              </div>

              <div style={{ display:"flex", gap:0, border:"1px solid #e2e8f0", borderRadius:8, overflow:"hidden" }}>
                {(["empenhado","ressarcimento"] as const).map(v=>(
                  <button key={v} onClick={()=>setView(v)}
                    style={{ padding:"5px 13px", fontSize:11, fontWeight:600, border:"none", cursor:"pointer",
                      background:view===v?"#0f172a":"white", color:view===v?"white":"#64748b", transition:"all 0.15s" }}>
                    {v==="empenhado"?"Execução TG":"Ressarcimento"}
                  </button>
                ))}
              </div>
            </div>
          </div>
          <div style={{ padding:"18px 20px 10px" }}>
            <ResponsiveContainer width="100%" height={420}>
              <BarChart data={D.top12} layout="vertical" margin={{ left:10, right:60, top:0, bottom:0 }} barCategoryGap={6} barGap={2}>
                <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#f1f5f9" />
                <XAxis type="number" tickFormatter={v=>`R$${(v/1e6).toFixed(0)}M`} tick={{ fontSize:10, fill:"#94a3b8" }} tickLine={false} axisLine={false} />
                <YAxis type="category" dataKey="name" width={90} tick={{ fontSize:11, fill:"#374151" }} tickLine={false} axisLine={false} interval={0} />
                <Tooltip content={<DarkTooltip/>} cursor={{ fill:"#f8fafc" }} />
                {view==="empenhado" ? <>
                  <Legend iconType="circle" wrapperStyle={{ fontSize:11, paddingTop:10 }} />
                  <Bar dataKey="Empenhado"   fill={C.blue}  radius={[0,4,4,0]} barSize={11} />
                  <Bar dataKey="Pago (TG)"   fill={C.green} radius={[0,4,4,0]} barSize={11} />
                </> : <>
                  <Legend content={<RessLegend/>} />
                  <Bar dataKey="Ressarcido"  fill={C.teal}  radius={[0,4,4,0]} barSize={11}>
                    <PctLabel/>
                  </Bar>
                  <Bar dataKey="A Ressarcir" fill={C.red}   radius={[0,4,4,0]} barSize={11} />
                </>}
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* ── Evolução por Ano + Painel lateral ── */}
        <div style={{ display:"grid", gridTemplateColumns:isMobile?"1fr":"1fr 300px", gap:16, alignItems:"start" }}>

          {/* Area chart por ano */}
          <div style={{ ...s.card, padding:0, overflow:"hidden" }}>
            <div style={{ padding:"14px 18px", borderBottom:"1px solid #e2e8f0" }}>
              <div style={s.section}>Evolução por Ano — Empenhado vs Pago vs Ressarcido</div>
              <div style={{ fontSize:11, color:"#64748b" }}>Série histórica acumulada por exercício financeiro</div>
            </div>
            <div style={{ padding:"18px 20px 10px" }}>
              <ResponsiveContainer width="100%" height={300}>
                <AreaChart data={D.anoArr} margin={{ top:10, right:20, left:0, bottom:0 }}>
                  <defs>
                    {[["emp",C.blue],["pago",C.green],["ress",C.teal]].map(([k,c])=>(
                      <linearGradient key={k} id={`g-${k}`} x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%"  stopColor={c} stopOpacity={0.25}/>
                        <stop offset="95%" stopColor={c} stopOpacity={0}/>
                      </linearGradient>
                    ))}
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                  <XAxis dataKey="ano" tick={{ fontSize:11, fill:"#94a3b8" }} tickLine={false} axisLine={false} />
                  <YAxis tickFormatter={v=>`R$${(v/1e6).toFixed(0)}M`} tick={{ fontSize:10, fill:"#94a3b8" }} tickLine={false} axisLine={false} />
                  <Tooltip content={<DarkTooltip/>} />
                  <Legend iconType="circle" wrapperStyle={{ fontSize:11 }} />
                  <Area type="monotone" dataKey="emp"  name="Empenhado"  stroke={C.blue}  fill={`url(#g-emp)`}  strokeWidth={2}/>
                  <Area type="monotone" dataKey="pago" name="Pago (TG)"  stroke={C.green} fill={`url(#g-pago)`} strokeWidth={2}/>
                  <Area type="monotone" dataKey="ress" name="Ressarcido" stroke={C.teal}  fill={`url(#g-ress)`} strokeWidth={2} strokeDasharray="5 5"/>
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Painel de destaques */}
          <div style={{ display:"flex", flexDirection:"column", gap:14 }}>
            {/* Dark card — destaques */}
            <div style={{ ...s.card, background:"#0f172a", border:"none", padding:"16px 18px" }}>
              <div style={{ fontWeight:700, fontSize:13, color:"white", marginBottom:14, display:"flex", alignItems:"center", gap:8 }}>
                <Target size={15} style={{ color:"#34d399" }}/> Destaques
              </div>
              {[
                { label:"Maior Aguardando Finan. (Unidade)",     value:D.maisPendente?.cc||"—",    sub:fmt(D.maisPendente?.a_ress||0), color:"#f87171" },
                { label:"Maior Ressarcimento (Unidade)", value:D.maisRessarcida?.cc||"—",  sub:fmt(D.maisRessarcida?.ress||0), color:"#34d399" },
                { label:"Total de Unidades",             value:`${D.nCC} centros`,          sub:"com dados cruzados",                 color:"#60a5fa" },
              ].map(h=>(
                <div key={h.label} style={{ background:"rgba(255,255,255,0.07)", borderRadius:8, padding:"10px 12px", marginBottom:8, border:"1px solid rgba(255,255,255,0.05)" }}>
                  <div style={{ fontSize:9, color:"#94a3b8", textTransform:"uppercase", letterSpacing:"0.08em", marginBottom:3 }}>{h.label}</div>
                  <div style={{ fontWeight:700, color:h.color, fontSize:13, whiteSpace:"nowrap", overflow:"hidden", textOverflow:"ellipsis" }}>{h.value}</div>
                  <div style={{ fontSize:10, color:"#64748b", marginTop:2 }}>{h.sub}</div>
                </div>
              ))}
            </div>

            {/* Resumo semáforo */}
            <div style={{ ...s.card, padding:"16px 18px" }}>
              <div style={{ fontWeight:700, fontSize:13, color:"#0f172a", marginBottom:12 }}>Status Global</div>
              {[
                { label:"🟢 Ressarcidos",  n:D.totVerde,               color:"#22c55e", bg:"#f0fdf4" },
                { label:"🔴 Aguardando Financeiro",    n:D.totVerm,                 color:"#ef4444", bg:"#fff5f5" },
                { label:"🟡 Parciais",     n:filteredData.length-D.totVerde-D.totVerm, color:"#eab308", bg:"#fefce8" },
              ].map(r=>(
                <div key={r.label} style={{ marginBottom:10 }}>
                  <div style={{ display:"flex", justifyContent:"space-between", marginBottom:3 }}>
                    <span style={{ fontSize:11, color:"#374151", fontWeight:600 }}>{r.label}</span>
                    <span style={{ fontSize:11, fontWeight:700, color:r.color }}>{r.n} <span style={{ fontWeight:400, color:"#94a3b8" }}>({pct(r.n,filteredData.length)})</span></span>
                  </div>
                  <div style={{ height:5, background:"#f1f5f9", borderRadius:3, overflow:"hidden" }}>
                    <div style={{ height:"100%", width:pct(r.n,filteredData.length), background:r.color, borderRadius:3, transition:"width 0.5s" }}/>
                  </div>
                </div>
              ))}
            </div>

            {/* Alerta */}
            <div style={{ ...s.card, background:"#fff7ed", border:"1px solid #fed7aa", padding:"14px 16px" }}>
              <div style={{ display:"flex", gap:8, alignItems:"flex-start" }}>
                <AlertTriangle size={15} style={{ color:"#f97316", flexShrink:0, marginTop:1 }}/>
                <div>
                  <div style={{ fontWeight:700, fontSize:12, color:"#9a3412", marginBottom:4 }}>Atenção</div>
                  <p style={{ fontSize:11, color:"#c2410c", lineHeight:1.6, margin:0 }}>
                    Registros com semáforo <strong>vermelho</strong> indicam ausência de pagamento e ND de ressarcimento — requerem acompanhamento prioritário.
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* ── Mini ranking table ── */}
        <div style={isMobile ? undefined : { ...s.card, padding:0, overflow:"hidden" }}>
          <div style={{ padding:"14px 18px", borderBottom:isMobile?undefined:"1px solid #e2e8f0" }}>
            <div style={s.section}>Ranking de Ressarcimento por Unidade</div>
            <div style={{ fontSize:11, color:"#64748b" }}>Percentual de registros ressarcidos vs total · Top 15</div>
          </div>

          {isMobile ? (
            <div style={{ display: "flex", flexDirection: "column", gap: 12, padding: "4px 2px" }}>
              {D.top12.map((r:any,i:number)=>{
                const pctV = r["Ressarcido"]>0||(r["Ressarcido"]+r["A Ressarcir"])>0
                  ? ((r["Ressarcido"]/(r["Ressarcido"]+r["A Ressarcir"]))*100) : 0;
                const barColor = pctV>=80?C.green:pctV>=40?C.amber:C.red;
                const statusBg = pctV>=80?"#dcfce7":pctV>=40?"#fef9c3":"#fee2e2";
                const statusText = pctV>=80?"#166534":pctV>=40?"#713f12":"#991b1b";
                const statusBorder = pctV>=80?"#86efac":pctV>=40?"#fde047":"#fca5a5";
                const statusLabel = pctV>=80?"🟢 Em dia":pctV>=40?"🟡 Parcial":"🔴 Crítico";

                return (
                  <div key={r.name} style={{
                    background: "white",
                    borderRadius: 12,
                    border: "1px solid #e2e8f0",
                    padding: "14px 16px",
                    display: "flex",
                    flexDirection: "column",
                    gap: 12,
                    boxShadow: "0 2px 5px rgba(0,0,0,0.03)"
                  }}>
                    {/* Header: Rank, Name, Status */}
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                        <span style={{
                          background: "#f1f5f9",
                          color: "#64748b",
                          borderRadius: "50%",
                          width: 24,
                          height: 24,
                          display: "flex",
                          justifyContent: "center",
                          alignItems: "center",
                          fontSize: 10,
                          fontWeight: 800
                        }}>
                          #{i+1}
                        </span>
                        <span style={{ fontSize: 13, fontWeight: 700, color: "#0f172a", maxWidth: 150, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }} title={r.fullName}>
                          {r.fullName}
                        </span>
                      </div>
                      <span style={{
                        display: "inline-block",
                        padding: "2px 8px",
                        borderRadius: 12,
                        fontSize: 9,
                        fontWeight: 700,
                        background: statusBg,
                        color: statusText,
                        border: `1px solid ${statusBorder}`
                      }}>
                        {statusLabel}
                      </span>
                    </div>

                    {/* Progress bar and index */}
                    <div>
                      <div style={{ display: "flex", justifyContent: "space-between", fontSize: 10, color: "#64748b", marginBottom: 4 }}>
                        <span>Índice de Ressarcimento</span>
                        <span style={{ fontWeight: 700, color: barColor }}>{pctV.toFixed(0)}%</span>
                      </div>
                      <div style={{ height: 6, background: "#f1f5f9", borderRadius: 3, overflow: "hidden" }}>
                        <div style={{ height: "100%", width: `${pctV}%`, background: barColor, borderRadius: 3 }}/>
                      </div>
                    </div>

                    {/* Stats grid */}
                    <div style={{
                      display: "grid",
                      gridTemplateColumns: "1fr 1fr 1fr",
                      background: "#f8fafc",
                      borderRadius: 8,
                      padding: "8px 10px",
                      textAlign: "center",
                      fontSize: 10,
                      gap: 6
                    }}>
                      <div>
                        <div style={{ color: "#64748b", marginBottom: 2 }}>Empenhado</div>
                        <div style={{ fontWeight: 700, color: C.blue }}>{fmt(r.Empenhado)}</div>
                      </div>
                      <div>
                        <div style={{ color: "#64748b", marginBottom: 2 }}>Ressarcido</div>
                        <div style={{ fontWeight: 700, color: C.teal }}>{fmt(r.Ressarcido)}</div>
                      </div>
                      <div>
                        <div style={{ color: "#64748b", marginBottom: 2 }}>A Ressarcir</div>
                        <div style={{ fontWeight: 700, color: r["A Ressarcir"]>0?C.red:"#10b981" }}>{r["A Ressarcir"]>0?fmt(r["A Ressarcir"]):"✓"}</div>
                      </div>
                    </div>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", fontSize: 9.5, color: "#94a3b8" }}>
                      <span>Registros: <strong style={{ color: "#475569" }}>{r.registros}</strong></span>
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <div style={{ overflowX:"auto" }}>
              <table style={{ width:"100%", borderCollapse:"collapse", fontSize:11 }}>
                <thead>
                  <tr>
                    {["#","Unidade","Registros","Empenhado","Ressarcido","A Ressarcir","% Ressarcido","Status"].map(h=>(
                      <th key={h} style={{ fontSize:10, color:"#64748b", textTransform:"uppercase", letterSpacing:"0.06em", padding:"10px 14px", background:"#f8fafc", borderBottom:"1px solid #e2e8f0", fontWeight:600, textAlign: h==="#"||h==="Registros"||h==="% Ressarcido"?"center":"left" as any }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {D.top12.map((r:any,i:number)=>{
                    const pctV = r["Ressarcido"]>0||(r["Ressarcido"]+r["A Ressarcir"])>0
                      ? ((r["Ressarcido"]/(r["Ressarcido"]+r["A Ressarcir"]))*100) : 0;
                    const barColor = pctV>=80?C.green:pctV>=40?C.amber:C.red;
                    return (
                      <tr key={r.name} style={{ background:i%2===0?"white":"#fafbfc" }}>
                        <td style={{ padding:"10px 14px", textAlign:"center", fontWeight:700, color:"#94a3b8", fontSize:10 }}>#{i+1}</td>
                        <td style={{ padding:"10px 14px", fontWeight:600, color:"#0f172a", maxWidth:200 }}>
                          <div style={{ overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" }} title={r.fullName}>{r.fullName}</div>
                        </td>
                        <td style={{ padding:"10px 14px", textAlign:"center", color:"#64748b" }}>{r.registros}</td>
                        <td style={{ padding:"10px 14px", fontWeight:700, color:C.blue }}>{fmt(r.Empenhado)}</td>
                        <td style={{ padding:"10px 14px", color:C.teal, fontWeight:600 }}>{fmt(r.Ressarcido)}</td>
                        <td style={{ padding:"10px 14px", color:r["A Ressarcir"]>0?C.red:"#10b981", fontWeight:600 }}>{r["A Ressarcir"]>0?fmt(r["A Ressarcir"]):"✓"}</td>
                        <td style={{ padding:"10px 14px", minWidth:140 }}>
                          <div style={{ display:"flex", alignItems:"center", justifyContent: "center", gap:8 }}>
                            <div style={{ flex:1, height:5, background:"#f1f5f9", borderRadius:3, overflow:"hidden" }}>
                              <div style={{ height:"100%", width:`${pctV}%`, background:barColor, borderRadius:3 }}/>
                            </div>
                            <span style={{ fontWeight:700, color:barColor, minWidth:34, fontSize:10, textAlign:"right" }}>{pctV.toFixed(0)}%</span>
                          </div>
                        </td>
                        <td style={{ padding:"10px 14px" }}>
                          <span style={{ display:"inline-block", padding:"2px 8px", borderRadius:12, fontSize:10, fontWeight:700,
                            background:pctV>=80?"#dcfce7":pctV>=40?"#fef9c3":"#fee2e2",
                            color:pctV>=80?"#166534":pctV>=40?"#713f12":"#991b1b",
                            border:`1px solid ${pctV>=80?"#86efac":pctV>=40?"#fde047":"#fca5a5"}` }}>
                            {pctV>=80?"🟢 Em dia":pctV>=40?"🟡 Parcial":"🔴 Crítico"}
                          </span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>

      </div>
      )}
    </DashboardLayout>
  );
}
