import re

with open('dashboard/src/App.tsx', 'r', encoding='utf-8') as f:
    code = f.read()

# 1. Remove KPIs "Com Contrato" and "Vencidos"
code = re.sub(r'<KPI icon="📑".*?\n', '', code)
code = re.sub(r'<KPI icon="🔴".*?\n', '', code)

# 2. Modify VigenciaCalendar to be clickable
calendar_component_new = """// ── Vigência Calendar ────────────────────────────────────────────────
function VigenciaCalendar({records, selectedMonth, onSelectMonth}:{records:any[], selectedMonth:string|null, onSelectMonth:(m:string|null)=>void}) {
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

  return (
    <div style={{background:"white",border:"1px solid #e2e8f0",borderRadius:12,padding:20,boxShadow:"0 1px 3px rgba(0,0,0,0.06)"}}>
      <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:16,flexWrap:"wrap",gap:8}}>
        <div style={{display:"flex",alignItems:"center",gap:12}}>
          <div style={{fontSize:13,fontWeight:700,color:"#1e293b"}}>📅 Calendário de Vigências dos Contratos</div>
          {selectedMonth && (
            <button onClick={() => onSelectMonth(null)} style={{fontSize:11,padding:"2px 8px",background:"#f1f5f9",borderRadius:4,border:"1px solid #e2e8f0",cursor:"pointer",color:"#64748b"}}>✕ Limpar Mês</button>
          )}
        </div>
        <div style={{display:"flex",gap:8,flexWrap:"wrap"}}>
          {[
            {label:`${totais.vencidos} Vencidos`,bg:"#fee2e2",color:"#991b1b"},
            {label:`${totais.vence30} Vence 30d`,bg:"#ffedd5",color:"#9a3412"},
            {label:`${totais.vence90} Vence 90d`,bg:"#fef9c3",color:"#854d0e"},
            {label:`${totais.vence180} Vence 180d`,bg:"#dbeafe",color:"#1e40af"},
            {label:`${totais.vigente} Vigentes`,bg:"#dcfce7",color:"#166534"},
          ].map(({label,bg,color})=>(
            <span key={label} style={{fontSize:11,fontWeight:600,padding:"3px 8px",borderRadius:99,background:bg,color}}>{label}</span>
          ))}
        </div>
      </div>
      <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(80px,1fr))",gap:8}}>
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
            <div key={m.label} onClick={() => onSelectMonth(m.key)} style={{textAlign:"center",position:"relative",cursor:"pointer",opacity: isFaded ? 0.4 : 1, transition:"opacity 0.2s"}}>
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
"""
code = re.sub(r'// ── Vigência Calendar[\s\S]*?// ── Main Dashboard', calendar_component_new + "\n// ── Main Dashboard", code)

# 3. Add state for filtMes
code = code.replace('const [search,  setSearch]  = useState("");', 'const [search,  setSearch]  = useState("");\n  const [filtMes, setFiltMes] = useState<string|null>(null);')

# 4. Filter by filtMes
filter_logic = """
    if (filtMes) {
      arr = arr.filter((r: any) => {
        if (!r.vigencia_fim) return false;
        try {
          const [y, mo] = r.vigencia_fim.split("-").map(Number);
          return `${y}-${mo - 1}` === filtMes;
        } catch { return false; }
      });
    }"""
code = code.replace('arr = [...arr].sort((a: any, b: any) => {', filter_logic + '\n    arr = [...arr].sort((a: any, b: any) => {')

# Update calendar call
code = code.replace('<VigenciaCalendar records={filtered} />', '<VigenciaCalendar records={records} selectedMonth={filtMes} onSelectMonth={setFiltMes} />')

# Remove "Status" column
code = code.replace('"{["Status",', '"{[')

# Remove Status TD
code = re.sub(r'{/\* Status \*/}\s*<td style={{padding:"10px 14px",whiteSpace:"nowrap"}}>\s*<span[^>]*>\s*\{c\.label\}\s*</span>\s*</td>', '', code)

# Remove sort options and status/alerta filters
remove_filters_regex = r'\{/\* Filtro Status \*/\}[\s\S]*?\{/\* Filtro Alerta \*/\}[\s\S]*?\{/\* Tabela \*/\}'
code = re.sub(r'<option value="vig">↑ Vencimento</option>', '', code)
code = re.sub(r'\{/\* Filtro Status \*/\}[\s\S]*?\{(filtSit\.length>0\|\|filtAlerta\.length>0\|\|filtMod\.length>0\|\|search)', r'{(search || filtMes)', code)
code = code.replace('setFiltSit([]); setFiltAlerta([]); setFiltMod([]); setSearch("");', 'setSearch(""); setFiltMes(null);')

# Remove pagination
code = code.replace('const paginated = filtered.slice((page-1)*PAGE_SIZE, page*PAGE_SIZE);', 'const paginated = filtered;')
code = re.sub(r'\{/\* Paginação \*/\}[\s\S]*?</div>\s*\)\}\s*</div>', '</div>', code)
code = re.sub(r'<span style={{fontSize:12,color:"#94a3b8"}}>\s*Página \{page\} de \{totalPages\}\s*</span>', '', code)

with open('dashboard/src/App.tsx', 'w', encoding='utf-8') as f:
    f.write(code)
