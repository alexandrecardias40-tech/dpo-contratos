import { useState, useMemo } from "react";
import { useData } from "./DataProvider";
import DashboardLayout from "./components/DashboardLayout";
import ContractDetailModal from "./components/ContractDetailModal";

const fmt = (v: number) =>
  isNaN(v) ? "R$ 0" : new Intl.NumberFormat("pt-BR",{style:"currency",currency:"BRL",minimumFractionDigits:0,maximumFractionDigits:0}).format(v||0);
const pct = (a:number,b:number) => b>0 ? ((a/b)*100).toFixed(1)+"%" : "0%";

const COR: Record<string,{bg:string;border:string;color:string;label:string}> = {
  verde:   {bg:"#dcfce7",border:"#86efac",color:"#166534",label:"Executado"},
  amarelo: {bg:"#fef9c3",border:"#fde047",color:"#854d0e",label:"Em Execução"},
  vermelho:{bg:"#fee2e2",border:"#fca5a5",color:"#991b1b",label:"A Executar"},
  cinza:   {bg:"#f1f5f9",border:"#e2e8f0",color:"#475569",label:"Sem Valor"},
};

const ALERTA_COR: Record<string,{bg:string;color:string;border:string}> = {
  "Vencido":    {bg:"#fee2e2",color:"#991b1b",border:"#fca5a5"},
  "Vence 30d":  {bg:"#ffedd5",color:"#9a3412",border:"#fdba74"},
  "Vence 90d":  {bg:"#fef9c3",color:"#854d0e",border:"#fde047"},
  "Vence 180d": {bg:"#dbeafe",color:"#1e40af",border:"#93c5fd"},
  "Vigente":    {bg:"#dcfce7",color:"#166534",border:"#86efac"},
};

// ── KPI Card ────────────────────────────────────────────────────
function KPI({icon,title,value,sub,color}:{icon:string;title:string;value:string;sub:string;color:string}) {
  return (
    <div style={{
      background:"white",border:"1px solid #e2e8f0",borderRadius:12,padding:"12px 14px",
      borderTop:`4px solid ${color}`,boxShadow:"0 1px 3px rgba(0,0,0,0.06)",minWidth:120,flex:1
    }}>
      <div style={{fontSize:22,marginBottom:4}}>{icon}</div>
      <div style={{fontSize:11,color:"#64748b",fontWeight:600,textTransform:"uppercase",letterSpacing:"0.06em"}}>{title}</div>
      <div style={{fontSize:22,fontWeight:800,color:"#1e293b",marginTop:4,letterSpacing:"-0.03em"}}>{value}</div>
      <div style={{fontSize:12,color:"#64748b",marginTop:3}}>{sub}</div>
    </div>
  );
}

// ── Progress Bar ────────────────────────────────────────────────
function Bar({pct:p,color}:{pct:number;color:string}) {
  return (
    <div style={{height:6,background:"#f1f5f9",borderRadius:99,overflow:"hidden",minWidth:60}}>
      <div style={{height:"100%",width:`${Math.min(p,100)}%`,background:color,borderRadius:99,transition:"width .4s"}}/>
    </div>
  );
}

// ── Dynamic Vigência Calculator ─────────────────────────────────────
function calcVigenciaDynamic(vigenciaFim: string | null) {
  if (!vigenciaFim) return { dias_restantes: null, alerta_vigencia: null, label_amigavel: null };
  try {
    const parts = vigenciaFim.split("-").map(Number);
    if (parts.length !== 3) return { dias_restantes: null, alerta_vigencia: null, label_amigavel: null };
    
    const hoje = new Date();
    hoje.setHours(0, 0, 0, 0);
    const fim = new Date(parts[0], parts[1] - 1, parts[2]);
    fim.setHours(0, 0, 0, 0);
    
    const diffMs = fim.getTime() - hoje.getTime();
    const dias = Math.ceil(diffMs / (1000 * 60 * 60 * 24));
    
    let alerta = "Vigente";
    let label = "";
    if (dias < 0) {
      alerta = "Vencido";
      const absD = Math.abs(dias);
      label = `Vencido há ${absD} ${absD === 1 ? "dia" : "dias"}`;
    } else if (dias === 0) {
      alerta = "Vence 30d";
      label = "Vence hoje";
    } else if (dias <= 30) {
      alerta = "Vence 30d";
      label = `Vence em ${dias} ${dias === 1 ? "dia" : "dias"}`;
    } else if (dias <= 90) {
      alerta = "Vence 90d";
      label = `Vence em ${dias} ${dias === 1 ? "dia" : "dias"}`;
    } else if (dias <= 180) {
      alerta = "Vence 180d";
      label = `Vence em ${dias} ${dias === 1 ? "dia" : "dias"}`;
    } else {
      alerta = "Vigente";
      label = `Vence em ${dias} ${dias === 1 ? "dia" : "dias"}`;
    }
    return { dias_restantes: dias, alerta_vigencia: alerta, label_amigavel: label };
  } catch {
    return { dias_restantes: null, alerta_vigencia: null, label_amigavel: null };
  }
}

// ── Vigência Calendar ────────────────────────────────────────────────
function VigenciaCalendar({
  records,
  selectedMonth,
  onSelectMonth,
  selectedAlerta,
  onSelectAlerta,
}:{
  records:any[],
  selectedMonth:string|null,
  onSelectMonth:(m:string|null)=>void,
  selectedAlerta:string|null,
  onSelectAlerta:(a:string|null)=>void,
}) {
  const hoje = new Date();
  const meses = [];
  for (let i = 0; i < 12; i++) {
    const d = new Date(hoje.getFullYear(), hoje.getMonth() + i, 1);
    const key = `${d.getFullYear()}-${d.getMonth()}`;
    meses.push({ label: d.toLocaleDateString("pt-BR",{month:"short",year:"2-digit"}), date: d, key });
  }

  const contratosComVigencia = records.filter((r: any) => r.tem_contrato && r.vigencia_fim);
  const uniqueContratos = Array.from(
    new Map(contratosComVigencia.map((r: any) => [r.contrato_numero + r.vigencia_fim, r])).values()
  );

  const porMes = meses.map(m => {
    const ano = m.date.getFullYear();
    const mes = m.date.getMonth();
    const vencendo = uniqueContratos.filter((r: any) => {
      if (!r.vigencia_fim) return false;
      try {
        const [y,mo] = r.vigencia_fim.split("-").map(Number);
        return y === ano && (mo - 1) === mes;
      } catch { return false; }
    });
    return { ...m, vencendo };
  });

  const totais = { vencidos: 0, vence30: 0, vence90: 0, vence180: 0, vigente: 0 };
  uniqueContratos.forEach((r: any) => {
    const a = r.alerta_vigencia;
    if (a === "Vencido")    totais.vencidos++;
    else if (a === "Vence 30d")  totais.vence30++;
    else if (a === "Vence 90d")  totais.vence90++;
    else if (a === "Vence 180d") totais.vence180++;
    else if (a === "Vigente")    totais.vigente++;
  });

  const badgeItems = [
    { key: "Vencido",    label: `${totais.vencidos} Vencidos`,    bg: "#fee2e2", color: "#991b1b" },
    { key: "Vence 30d",  label: `${totais.vence30} Vence 30d`,    bg: "#ffedd5", color: "#9a3412" },
    { key: "Vence 90d",  label: `${totais.vence90} Vence 90d`,    bg: "#fef9c3", color: "#854d0e" },
    { key: "Vence 180d", label: `${totais.vence180} Vence 180d`,  bg: "#dbeafe", color: "#1e40af" },
    { key: "Vigente",    label: `${totais.vigente} Vigentes`,    bg: "#dcfce7", color: "#166534" },
  ];

  return (
    <div style={{background:"white",border:"1px solid #e2e8f0",borderRadius:12,padding:20,boxShadow:"0 1px 3px rgba(0,0,0,0.06)"}}>
      <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:16,flexWrap:"wrap",gap:8}}>
        <div style={{display:"flex",alignItems:"center",gap:12}}>
          <div style={{fontSize:13,fontWeight:700,color:"#1e293b"}}>📅 Calendário de Vigências dos Contratos</div>
          {(selectedMonth || selectedAlerta) && (
            <button
              onClick={() => { onSelectMonth(null); onSelectAlerta(null); }}
              style={{fontSize:11,padding:"2px 8px",background:"#f1f5f9",borderRadius:4,border:"1px solid #e2e8f0",cursor:"pointer",color:"#64748b"}}
            >
              ✕ Limpar Filtros do Calendário
            </button>
          )}
        </div>
      </div>
      <div style={{display:"grid",gridTemplateColumns:"repeat(12,1fr)",gap:6}}>
        {porMes.map(m => {
          const max = Math.max(...porMes.map(x => x.vencendo.length), 1);
          const h = Math.max(8, (m.vencendo.length / max) * 60);
          const temVencido = m.vencendo.some((r: any) => r.alerta_vigencia === "Vencido");
          const tem30      = m.vencendo.some((r: any) => r.alerta_vigencia === "Vence 30d");
          const tem90      = m.vencendo.some((r: any) => r.alerta_vigencia === "Vence 90d");
          const barColor   = temVencido ? "#ef4444" : tem30 ? "#f97316" : tem90 ? "#eab308" : "#3b82f6";
          const estesMes   = m.date.getFullYear() === hoje.getFullYear() && m.date.getMonth() === hoje.getMonth();
          const isSelected = selectedMonth === m.key;
          const isFaded    = selectedMonth && !isSelected;
          return (
            <div key={m.label} onClick={() => onSelectMonth(isSelected ? null : m.key)} style={{textAlign:"center",position:"relative",cursor:"pointer",opacity: isFaded ? 0.4 : 1, transition:"opacity 0.2s"}}>
              {estesMes && (
                <div style={{position:"absolute",top:-4,left:"50%",transform:"translateX(-50%)",
                  fontSize:9,fontWeight:700,color:"#6366f1",textTransform:"uppercase",letterSpacing:"0.05em"}}>Hoje</div>
              )}
              <div style={{height:70,display:"flex",alignItems:"flex-end",justifyContent:"center",paddingTop:14}}>
                <div style={{
                  width:"70%",height:m.vencendo.length > 0 ? h : 4,
                  background: m.vencendo.length > 0 ? barColor : "#f1f5f9",
                  borderRadius:4,transition:"height .3s",position:"relative",
                  border: isSelected ? "2px solid #1e293b" : "none"
                }}>
                  {m.vencendo.length > 0 && (
                    <div style={{
                      position:"absolute",top:-18,left:"50%",transform:"translateX(-50%)",
                      fontSize:11,fontWeight:700,color:barColor,whiteSpace:"nowrap"
                    }}>{m.vencendo.length}</div>
                  )}
                </div>
              </div>
              <div style={{fontSize:10,color: estesMes ? "#6366f1" : (isSelected ? "#1e293b" : "#64748b"),fontWeight: estesMes || isSelected ? 700 : 400,marginTop:4}}>
                {m.label}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

const CHAVE_MAP: Record<string, { label: string; bg: string; color: string; border: string }> = {
  minuta:          { label: "Chave 1: Minuta Exata",     bg: "#dcfce7", color: "#166534", border: "#86efac" },
  cnpj_num_minuta: { label: "Chave 2: CNPJ + N°Contrato",bg: "#dbeafe", color: "#1e40af", border: "#93c5fd" },
  cnpj_lic:        { label: "Chave 3: CNPJ + Licitação", bg: "#fef9c3", color: "#854d0e", border: "#fde047" },
  cnpj_unico:      { label: "Chave 4: CNPJ Único",      bg: "#f3e8ff", color: "#6b21a8", border: "#d8b4fe" },
  cnpj_recente:    { label: "Chave 5: CNPJ Recente",    bg: "#ffedd5", color: "#9a3412", border: "#fdba74" },
  sem_match:       { label: "Execução Direta SIAFI",    bg: "#f1f5f9", color: "#475569", border: "#cbd5e1" },
};

// ── Main Dashboard ───────────────────────────────────────────────
export default function App() {
  const { data: rawRecords, meta: metadata, loading, error } = useData();

  const records = useMemo(() => {
    return rawRecords.map((r: any) => {
      const calc = calcVigenciaDynamic(r.vigencia_fim);
      return {
        ...r,
        dias_restantes: calc.dias_restantes ?? r.dias_restantes,
        alerta_vigencia: calc.alerta_vigencia ?? r.alerta_vigencia,
        label_amigavel: calc.label_amigavel,
      };
    });
  }, [rawRecords]);

  const [search,          setSearch]          = useState("");
  const [filtMes,         setFiltMes]         = useState<string|null>(null);
  const [filtAlertaSingle, setFiltAlertaSingle] = useState<string|null>(null);
  const [filtChave,       setFiltChave]       = useState<string|null>(null);
  const [filtSit,         setFiltSit]         = useState<string[]>([]);
  const [filtAlerta,      setFiltAlerta]      = useState<string[]>([]);
  const [filtMod,         setFiltMod]         = useState<string[]>([]);
  const [sortBy,          setSortBy]          = useState<"nome"|"emp"|"liq"|"pago"|"vig">("nome");
  const [page,            setPage]            = useState(1);
  const [selectedRecord,  setSelectedRecord]  = useState<any|null>(null);
  const PAGE_SIZE = 50;

  const allSituacoes = useMemo(() => Array.from(new Set(records.map((r: any) => String(r.status)).filter((s: string) => s && s !== "undefined"))).sort(), [records]);
  const allAlertas   = useMemo(() => Array.from(new Set(records.map((r: any) => String(r.alerta_vigencia)).filter((s: string) => s && s !== "undefined"))).sort(), [records]);
  const allMods      = useMemo(() => Array.from(new Set(records.map((r: any) => String(r.contrato_modalidade)).filter((s: string) => s && s !== "undefined"))).sort(), [records]);

  // Contagem por chave
  const chaveCounts = useMemo(() => {
    const c: Record<string, number> = {};
    records.forEach((r: any) => {
      const k = r.chave_usada || "sem_match";
      c[k] = (c[k] || 0) + 1;
    });
    return c;
  }, [records]);

  const filtered = useMemo(() => {
    let arr = records.filter((r: any) =>
      // Mostrar registros com vigencia_fim OU que foram cruzados com o Comprasnet (tem_contrato=true)
      (Boolean(r.vigencia_fim) || Boolean(r.tem_contrato)) &&
      ((Number(r.emp) || 0) > 0 || (Number(r.liq) || 0) > 0 || (Number(r.pago) || 0) > 0)
    );
    if (search) {
      const q = search.toLowerCase();
      arr = arr.filter((r: any) =>
        r.favorecido_nome?.toLowerCase().includes(q) ||
        r.fornecedor_nome?.toLowerCase().includes(q) ||
        r.cnpj_cpf?.includes(q) ||
        r.contrato_numero?.toLowerCase().includes(q) ||
        r.contrato_objeto?.toLowerCase().includes(q) ||
        r.contrato_processo?.toLowerCase().includes(q) ||
        r.pi?.toLowerCase().includes(q) ||
        r.pi_nome?.toLowerCase().includes(q) ||
        r.ug_resp?.toLowerCase().includes(q) ||
        r.ug_resp_nome?.toLowerCase().includes(q) ||
        r.ugr_breakdown?.some((ug: any) => ug.ug_key?.toLowerCase().includes(q))
      );
    }
    if (filtChave)          arr = arr.filter((r: any) => r.chave_usada === filtChave);
    if (filtSit.length)     arr = arr.filter((r: any) => filtSit.includes(r.status));
    if (filtAlerta.length)  arr = arr.filter((r: any) => filtAlerta.includes(r.alerta_vigencia));
    if (filtAlertaSingle)  arr = arr.filter((r: any) => r.alerta_vigencia === filtAlertaSingle);
    if (filtMod.length)     arr = arr.filter((r: any) => filtMod.includes(r.contrato_modalidade));
    
    if (filtMes) {
      arr = arr.filter((r: any) => {
        if (!r.vigencia_fim) return false;
        try {
          const [y, mo] = r.vigencia_fim.split("-").map(Number);
          return `${y}-${mo - 1}` === filtMes;
        } catch { return false; }
      });
    }
    arr = [...arr].sort((a: any, b: any) => {
      if (sortBy === "emp")  return (Number(b.emp)||0) - (Number(a.emp)||0);
      if (sortBy === "liq")  return (Number(b.liq)||0) - (Number(a.liq)||0);
      if (sortBy === "pago") return (Number(b.pago)||0) - (Number(a.pago)||0);
      if (sortBy === "vig")  return (a.dias_restantes ?? 9999) - (b.dias_restantes ?? 9999);
      return (a.favorecido_nome || "").localeCompare(b.favorecido_nome || "", "pt-BR");
    });
    return arr;
  }, [records, search, filtChave, filtSit, filtAlerta, filtAlertaSingle, filtMod, sortBy, filtMes]);

  const T = useMemo(() => ({
    emp:   filtered.reduce((s: number, r: any) => s + (Number(r.emp)||0), 0),
    liq:   filtered.reduce((s: number, r: any) => s + (Number(r.liq)||0), 0),
    pago:  filtered.reduce((s: number, r: any) => s + (Number(r.pago)||0), 0),
    aliq:  filtered.reduce((s: number, r: any) => s + (Number(r.a_liquidar)||0), 0),
  }), [filtered]);

  const paginated = filtered;
  const totalPages = Math.ceil(filtered.length / PAGE_SIZE);

  if (loading) return (
    <DashboardLayout>
      <div style={{display:"flex",alignItems:"center",justifyContent:"center",height:"60vh",flexDirection:"column",gap:16}}>
        <div style={{width:40,height:40,border:"4px solid #e2e8f0",borderTop:"4px solid #6366f1",borderRadius:"50%",animation:"spin 1s linear infinite"}}/>
        <p style={{color:"#64748b",fontSize:14}}>Carregando dados...</p>
      </div>
    </DashboardLayout>
  );

  if (error) return (
    <DashboardLayout>
      <div style={{padding:24,textAlign:"center",color:"#dc2626"}}>❌ Erro ao carregar dados: {error}</div>
    </DashboardLayout>
  );

  return (
    <DashboardLayout>
      <style>{`@keyframes spin{to{transform:rotate(360deg)}} @media(max-width:768px){.kpi-grid{grid-template-columns:repeat(2,1fr)!important}.cal-grid{grid-template-columns:repeat(6,1fr)!important}}`}</style>
      <div style={{padding:"12px 16px",display:"flex",flexDirection:"column",gap:16,width:"100%",boxSizing:"border-box"}}>

        {/* ── Cabeçalho ── */}
        <div style={{display:"flex",alignItems:"flex-start",justifyContent:"space-between",flexWrap:"wrap",gap:12}}>
          <div>
            <h1 style={{fontSize:22,fontWeight:800,color:"#1e293b",margin:0,letterSpacing:"-0.03em"}}>
              📄 Dashboard de Contratos — UnB
            </h1>
            <p style={{fontSize:13,color:"#64748b",margin:"4px 0 0"}}>
              Tesouro Gerencial + Comprasnet API · {filtered.length} registros · UG 154040
            </p>
          </div>
        </div>

        {/* ── KPIs ── */}
        <div className="kpi-grid" style={{display:"grid",gridTemplateColumns:"repeat(4,1fr)",gap:10}}>
          <KPI icon="📋" title="Empenhado"  value={fmt(T.emp)}  sub="Tesouro Gerencial"               color="#3b82f6"/>
          <KPI icon="💧" title="Liquidado"  value={fmt(T.liq)}  sub={pct(T.liq,T.emp)+" do empenhado"} color="#8b5cf6"/>
          <KPI icon="💳" title="Pago"       value={fmt(T.pago)} sub={pct(T.pago,T.emp)+" do empenhado"} color="#10b981"/>
          <KPI icon="⏳" title="A Liquidar" value={fmt(T.aliq)} sub={pct(T.aliq,T.emp)+" do empenhado"} color="#f59e0b"/>
        </div>

        {/* ── Calendário de Vigências ── */}
        <VigenciaCalendar
          records={records}
          selectedMonth={filtMes}
          onSelectMonth={setFiltMes}
          selectedAlerta={filtAlertaSingle}
          onSelectAlerta={setFiltAlertaSingle}
        />

        {/* ── Painel de Pesquisa ── */}
        <div style={{background:"white",border:"1px solid #e2e8f0",borderRadius:12,padding:16,boxShadow:"0 1px 3px rgba(0,0,0,0.06)"}}>
          <div style={{display:"flex",gap:12,flexWrap:"wrap",alignItems:"center"}}>
            <input
              placeholder="🔍  Buscar por favorecido, CNPJ, contrato, processo, unidade (UGR), PI..."
              value={search}
              onChange={e => { setSearch(e.target.value); setPage(1); }}
              style={{
                flex:1,minWidth:250,padding:"10px 14px",border:"1px solid #d1d5db",borderRadius:8,
                fontSize:13,outline:"none",fontFamily:"inherit"
              }}
            />
            {(search || filtMes || filtAlertaSingle) && (
              <button
                onClick={() => { setSearch(""); setFiltMes(null); setFiltAlertaSingle(null); setPage(1); }}
                style={{
                  padding:"10px 16px",borderRadius:8,fontSize:12.5,fontWeight:600,
                  border:"1px solid #cbd5e1",background:"#f8fafc",cursor:"pointer",color:"#475569",
                  transition:"all 0.15s"
                }}
              >
                ✕ Limpar Filtros
              </button>
            )}
          </div>
        </div>

        {/* ── Tabela ── */}
        <div style={{background:"white",border:"1px solid #e2e8f0",borderRadius:12,boxShadow:"0 1px 3px rgba(0,0,0,0.06)",overflow:"hidden",width:"100%"}}>
          <div style={{padding:"8px 14px",borderBottom:"1px solid #f1f5f9",display:"flex",alignItems:"center",justifyContent:"space-between"}}>
            <span style={{fontSize:12,fontWeight:700,color:"#1e293b"}}>
              📋 Registros ({filtered.length.toLocaleString("pt-BR")})
            </span>
          </div>
          <div style={{width:"100%",overflowX:"hidden"}}>
            <table style={{width:"100%",tableLayout:"fixed",borderCollapse:"collapse",fontSize:11}}>
              <colgroup>
                <col style={{width:"22%"}}/>
                <col style={{width:"17%"}}/>
                <col style={{width:"11%"}}/>
                <col style={{width:"11%"}}/>
                <col style={{width:"11%"}}/>
                <col style={{width:"10%"}}/>
                <col style={{width:"13%"}}/>
                <col style={{width:"5%"}}/>
              </colgroup>
              <thead>
                <tr style={{background:"#f8fafc"}}>
                  {["Favorecido / CNPJ","Processo","Empenhado","Liquidado","Pago","A Liquidar","Vigência","Ação"].map(h => (
                    <th key={h} style={{padding:"6px 8px",textAlign:(h==="Ação"||h==="Vigência")?"center":"left",fontSize:9.5,fontWeight:700,color:"#475569",
                      textTransform:"uppercase",letterSpacing:"0.04em",whiteSpace:"nowrap",borderBottom:"1px solid #e2e8f0"}}>
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {paginated.map((r: any, i: number) => {
                  const ac = r.alerta_vigencia ? ALERTA_COR[r.alerta_vigencia] : null;
                  return (
                    <tr key={i} style={{borderBottom:"1px solid #f1f5f9",transition:"background .15s"}}
                      onMouseEnter={e=>(e.currentTarget.style.background="#f8fafc")}
                      onMouseLeave={e=>(e.currentTarget.style.background="")}>
                      
                      {/* Favorecido (Tesouro Gerencial) */}
                      <td style={{padding:"6px 8px"}}>
                        <div style={{fontWeight:600,color:"#1e293b",overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap",fontSize:10.5}} title={r.favorecido_nome || "—"}>
                          {r.favorecido_nome || "—"}
                        </div>
                        <div style={{fontSize:9.5,color:"#94a3b8",fontFamily:"monospace",overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{r.cnpj_cpf_fmt || r.cnpj_cpf}</div>
                      </td>

                      {/* Processo */}
                      <td style={{padding:"6px 8px"}}>
                        <div style={{fontSize:10,color:"#334155",fontWeight:500,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}} title={r.contrato_processo || "—"}>
                          {r.contrato_processo || "—"}
                        </div>
                      </td>

                      {/* Valores */}
                      <td style={{padding:"6px 8px",color:"#1e293b",fontWeight:600,fontSize:10.5}}>{fmt(r.emp)}</td>
                      <td style={{padding:"6px 8px",fontSize:10.5}}>
                        <div style={{color:"#7c3aed",fontWeight:600}}>{fmt(r.liq)}</div>
                        <Bar pct={(r.liq/r.emp)*100} color="#8b5cf6"/>
                      </td>
                      <td style={{padding:"6px 8px",fontSize:10.5}}>
                        <div style={{color:"#059669",fontWeight:600}}>{fmt(r.pago)}</div>
                        <Bar pct={(r.pago/r.emp)*100} color="#10b981"/>
                      </td>
                      <td style={{padding:"6px 8px",color:"#d97706",fontWeight:600,fontSize:10.5}}>{fmt(r.a_liquidar)}</td>

                      {/* Vigência Centralizada */}
                      <td style={{padding:"6px 8px",textAlign:"center"}}>
                        {r.vigencia_fim ? (
                          <div style={{display:"flex",flexDirection:"column",alignItems:"center",gap:2}}>
                            <span style={{fontSize:10.5,color:"#1e293b",fontWeight:600,whiteSpace:"nowrap"}}>
                              {r.vigencia_fim.split("-").reverse().join("/")}
                            </span>
                            {r.alerta_vigencia && (
                              <span style={{
                                fontSize:9,fontWeight:700,padding:"1px 5px",borderRadius:99,
                                background: ac?.bg,color: ac?.color,border:`1px solid ${ac?.border}`,
                                whiteSpace:"nowrap",display:"inline-block",width:"fit-content"
                              }}>
                                {r.label_amigavel || r.alerta_vigencia}
                              </span>
                            )}
                          </div>
                        ) : <span style={{color:"#94a3b8",fontSize:10.5}}>—</span>}
                      </td>

                      {/* Botão Ícone Luneta / Detalhamento */}
                      <td style={{padding:"6px 8px",textAlign:"center"}}>
                        <button
                          onClick={() => setSelectedRecord(r)}
                          style={{
                            width: 30,
                            height: 30,
                            borderRadius: 8,
                            border: "1px solid #bfdbfe",
                            background: "linear-gradient(135deg, #eff6ff, #dbeafe)",
                            color: "#1d4ed8",
                            cursor: "pointer",
                            display: "inline-flex",
                            alignItems: "center",
                            justifyContent: "center",
                            fontSize: 13,
                            transition: "all .18s ease-in-out",
                            boxShadow: "0 1px 3px rgba(37, 99, 235, 0.12)",
                          }}
                          onMouseEnter={e => {
                            e.currentTarget.style.background = "#2563eb";
                            e.currentTarget.style.color = "#ffffff";
                            e.currentTarget.style.borderColor = "#1d4ed8";
                            e.currentTarget.style.transform = "scale(1.12)";
                            e.currentTarget.style.boxShadow = "0 4px 12px rgba(37, 99, 235, 0.35)";
                          }}
                          onMouseLeave={e => {
                            e.currentTarget.style.background = "linear-gradient(135deg, #eff6ff, #dbeafe)";
                            e.currentTarget.style.color = "#1d4ed8";
                            e.currentTarget.style.borderColor = "#bfdbfe";
                            e.currentTarget.style.transform = "scale(1)";
                            e.currentTarget.style.boxShadow = "0 1px 3px rgba(37, 99, 235, 0.12)";
                          }}
                          title="🔍 Ver Detalhamento do Contrato"
                        >
                          🔍
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>

        {/* Modal de Detalhes do Contrato */}
        {selectedRecord && (
          <ContractDetailModal
            record={selectedRecord}
            onClose={() => setSelectedRecord(null)}
          />
        )}

      </div>
    </DashboardLayout>
  );
}
