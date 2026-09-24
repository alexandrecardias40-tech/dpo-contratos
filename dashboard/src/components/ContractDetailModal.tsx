import React, { useState, useEffect } from "react";

interface RecordType {
  tem_contrato?: boolean;
  contrato_id?: number | string;
  contrato_numero?: string;
  contrato_tipo?: string;
  contrato_situacao?: string;
  contrato_objeto?: string;
  contrato_categoria?: string;
  contrato_modalidade?: string;
  contrato_processo?: string;
  contrato_lic?: string;
  contrato_amparo?: string;
  contrato_valor_global?: number;
  contrato_valor_acumulado?: number;
  vigencia_inicio?: string;
  vigencia_fim?: string;
  dias_restantes?: number | null;
  alerta_vigencia?: string;
  label_amigavel?: string;
  favorecido_nome?: string;
  cnpj_cpf?: string;
  cnpj_cpf_fmt?: string;
  fornecedor_nome?: string;
  fornecedor_cnpj?: string;
  pi?: string;
  pi_nome?: string;
  ug_resp?: string;
  ug_resp_nome?: string;
  qtd_ugrs?: number;
  ugr_breakdown?: Array<{
    ug_key: string;
    emp: number;
    liq: number;
    pago: number;
    a_liquidar: number;
  }>;
  item_info?: string;
  emp?: number;
  liq?: number;
  pago?: number;
  a_liquidar?: number;
  pct_execucao?: number;
  status?: string;
  status_cor?: string;
  detalhes?: {
    historico?: any[];
    empenhos?: any[];
    itens?: any[];
    responsaveis?: any[];
  };
}

const fmtCurr = (v: number | undefined | null) =>
  v == null || isNaN(Number(v))
    ? "R$ 0,00"
    : new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(Number(v));

const fmtDate = (str: string | undefined | null) => {
  if (!str) return "—";
  if (str.includes("-")) {
    const parts = str.split("-");
    if (parts.length === 3) return `${parts[2]}/${parts[1]}/${parts[0]}`;
  }
  return str;
};

export default function ContractDetailModal({
  record,
  onClose,
}: {
  record: RecordType | null;
  onClose: () => void;
}) {
  const [tab, setTab] = useState<"geral" | "rateio" | "historico" | "empenhos" | "itens" | "responsaveis">("geral");
  const [loading, setLoading] = useState<boolean>(false);
  const [activeGesconPdf, setActiveGesconPdf] = useState<{ url: string; neNum: string } | null>(null);
  const [dataCache, setDataCache] = useState<{
    historico?: any[];
    empenhos?: any[];
    itens?: any[];
    responsaveis?: any[];
  }>({});

  const cid = record?.contrato_id;

  // ESC key listener to close modal
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        if (activeGesconPdf) setActiveGesconPdf(null);
        else onClose();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [onClose, activeGesconPdf]);

  // Fetch API sub-resources on tab change if not already in record.detalhes or dataCache
  useEffect(() => {
    if (!cid || tab === "geral") return;
    if (record?.detalhes && record.detalhes[tab] !== undefined) return;
    if (dataCache[tab] !== undefined) return;

    setLoading(true);
    const proxyUrl = `/api_comprasnet/api/contrato/${cid}/${tab}`;

    fetch(proxyUrl, { headers: { Accept: "application/json" } })
      .then((res) => {
        if (res.ok) return res.json();
        return fetch(`https://contratos.comprasnet.gov.br/api/contrato/${cid}/${tab}`).then((r) => r.json());
      })
      .then((json) => {
        setDataCache((prev) => ({ ...prev, [tab]: Array.isArray(json) ? json : [] }));
      })
      .finally(() => setLoading(false));
  }, [tab, cid, record, dataCache]);

  const handleOpenGesconPdf = (neNum?: string) => {
    if (!cid) {
      alert("Código do contrato não disponível para busca de arquivos.");
      return;
    }

    const processFiles = (files: any[]) => {
      if (Array.isArray(files) && files.length > 0) {
        let match = null;
        if (neNum) {
          match = files.find(
            (f) =>
              (f.descricao && f.descricao.toLowerCase().includes(neNum.toLowerCase())) ||
              (f.path_arquivo && f.path_arquivo.toLowerCase().includes(neNum.toLowerCase()))
          );
        }
        if (!match) {
          match = files.find((f) => f.id || f.path_arquivo);
        }

        if (match) {
          const fid = match.id;
          const downloadUrl = match.gescon_url || (fid ? `https://contratos.comprasnet.gov.br/gescon/consulta/download-arquivo-contrato/${fid}` : match.path_arquivo);
          if (downloadUrl) {
            setActiveGesconPdf({ url: downloadUrl, neNum: neNum || match.descricao || "Empenho" });
            return;
          }
        }
      }
      alert(
        `O arquivo PDF original da Nota de Empenho ${neNum || ""} ainda não foi disponibilizado na área de arquivos do Comprasnet pelo órgão emitente.`
      );
    };

    // Use preloaded arquivos if present
    if (record?.detalhes?.arquivos) {
      processFiles(record.detalhes.arquivos);
      return;
    }

    // Otherwise fetch live from API
    const apiUrl = `/api_comprasnet/api/contrato/${cid}/arquivos`;
    fetch(apiUrl, { headers: { Accept: "application/json" } })
      .then((res) => {
        if (res.ok) return res.json();
        return fetch(`https://contratos.comprasnet.gov.br/api/contrato/${cid}/arquivos`).then((r) => r.json());
      })
      .then((files) => processFiles(files))
      .catch(() => {
        alert(
          `O arquivo PDF original da Nota de Empenho ${neNum || ""} ainda não foi disponibilizado na área de arquivos do Comprasnet pelo órgão emitente.`
        );
      });
  };

  if (!record) return null;

  const titleFornecedor = record.favorecido_nome || record.fornecedor_nome || "Fornecedor não identificado";
  const numContrato = record.contrato_numero || "Empenho Direto";

  // Data resolution: prefer pre-loaded record.detalhes over runtime dataCache
  const historicoData: any[] = record.detalhes?.historico ?? dataCache.historico ?? [];
  const empenhosData: any[]  = record.detalhes?.empenhos  ?? dataCache.empenhos  ?? [];
  const itensData: any[]     = record.detalhes?.itens     ?? dataCache.itens     ?? [];
  const respData: any[]      = record.detalhes?.responsaveis ?? dataCache.responsaveis ?? [];

  return (
    <div
      style={{
        position: "fixed",
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        backgroundColor: "rgba(15, 23, 42, 0.65)",
        backdropFilter: "blur(4px)",
        zIndex: 9999,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: "16px",
      }}
      onClick={onClose}
    >
      <div
        style={{
          background: "#ffffff",
          borderRadius: "16px",
          width: "95vw",
          maxWidth: "1100px",
          maxHeight: "92vh",
          display: "flex",
          flexDirection: "column",
          boxShadow: "0 25px 50px -12px rgba(0, 0, 0, 0.25)",
          overflow: "hidden",
          border: "1px solid #e2e8f0",
          animation: "modalFadeIn 0.2s ease-out",
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <style>{`
          @keyframes modalFadeIn {
            from { opacity: 0; transform: scale(0.97); }
            to { opacity: 1; transform: scale(1); }
          }
        `}</style>

        {/* ── HEADER ── */}
        <div
          style={{
            padding: "20px 24px 16px",
            borderBottom: "1px solid #e2e8f0",
            background: "linear-gradient(to right, #f8fafc, #ffffff)",
            display: "flex",
            alignItems: "flex-start",
            justifyContent: "space-between",
          }}
        >
          <div>
            <div style={{ display: "flex", alignItems: "center", gap: "10px", flexWrap: "wrap" }}>
              <span
                style={{
                  fontSize: "11px",
                  fontWeight: 700,
                  textTransform: "uppercase",
                  padding: "3px 10px",
                  borderRadius: "99px",
                  background: record.tem_contrato ? "#dbeafe" : "#f1f5f9",
                  color: record.tem_contrato ? "#1e40af" : "#475569",
                  border: `1px solid ${record.tem_contrato ? "#93c5fd" : "#cbd5e1"}`,
                }}
              >
                {record.tem_contrato ? "Comprasnet API" : "Execução SIAFI / TG"}
              </span>

              {record.contrato_situacao && (
                <span
                  style={{
                    fontSize: "11px",
                    fontWeight: 700,
                    padding: "3px 10px",
                    borderRadius: "99px",
                    background: record.contrato_situacao === "Ativo" ? "#dcfce7" : "#fee2e2",
                    color: record.contrato_situacao === "Ativo" ? "#166534" : "#991b1b",
                  }}
                >
                  {record.contrato_situacao}
                </span>
              )}
            </div>

            <h2
              style={{
                fontSize: "20px",
                fontWeight: 800,
                color: "#0f172a",
                margin: "8px 0 4px 0",
                letterSpacing: "-0.02em",
              }}
            >
              {numContrato.startsWith("Contrato") || numContrato.includes("/")
                ? `Contrato nº ${numContrato}`
                : numContrato}
            </h2>

            <div style={{ fontSize: "13px", color: "#64748b", fontWeight: 500 }}>
              🏢 {titleFornecedor} &bull;{" "}
              <span style={{ fontFamily: "monospace", color: "#334155" }}>
                {record.cnpj_cpf_fmt || record.cnpj_cpf}
              </span>
            </div>
          </div>

          <button
            onClick={onClose}
            style={{
              border: "none",
              background: "#f1f5f9",
              borderRadius: "50%",
              width: "36px",
              height: "36px",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontSize: "18px",
              cursor: "pointer",
              color: "#64748b",
              transition: "all 0.15s",
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.background = "#e2e8f0";
              e.currentTarget.style.color = "#0f172a";
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.background = "#f1f5f9";
              e.currentTarget.style.color = "#64748b";
            }}
            title="Fechar (Esc)"
          >
            ✕
          </button>
        </div>

        {/* ── TABS NAVIGATION ── */}
        <div
          style={{
            display: "flex",
            borderBottom: "1px solid #e2e8f0",
            background: "#f8fafc",
            padding: "8px 24px",
            gap: "6px",
            flexWrap: "wrap",
            alignItems: "center",
          }}
        >
          {[
            { id: "geral", label: "📌 Visão Geral & Objeto", count: null },
            { id: "rateio", label: "🏛️ Rateio por Unidade (UGR)", count: record?.qtd_ugrs || record?.ugr_breakdown?.length || null },
            { id: "historico", label: "📜 Aditivos & Histórico", disabled: !cid, count: historicoData.length },
            { id: "empenhos", label: "💳 Empenhos (NEs)", disabled: !cid, count: empenhosData.length },
            { id: "itens", label: "📦 Itens Contratados", disabled: !cid, count: itensData.length },
            { id: "responsaveis", label: "👥 Fiscalização", disabled: !cid, count: respData.length },
          ].map((t) => (
            <button
              key={t.id}
              disabled={t.disabled}
              onClick={() => setTab(t.id as any)}
              style={{
                padding: "8px 12px",
                fontSize: "12.5px",
                fontWeight: tab === t.id ? 700 : 500,
                color: tab === t.id ? "#1d4ed8" : t.disabled ? "#cbd5e1" : "#475569",
                border: tab === t.id ? "1px solid #bfdbfe" : "1px solid transparent",
                borderRadius: "8px",
                background: tab === t.id ? "#eff6ff" : "transparent",
                cursor: t.disabled ? "not-allowed" : "pointer",
                whiteSpace: "nowrap",
                transition: "all 0.15s",
                display: "inline-flex",
                alignItems: "center",
                gap: "6px",
              }}
            >
              <span>{t.label}</span>
              {t.count !== null && t.count > 0 && (
                <span
                  style={{
                    fontSize: "10px",
                    fontWeight: 700,
                    padding: "1px 6px",
                    borderRadius: "99px",
                    background: tab === t.id ? "#dbeafe" : "#e2e8f0",
                    color: tab === t.id ? "#1e40af" : "#475569",
                  }}
                >
                  {t.count}
                </span>
              )}
            </button>
          ))}
        </div>

        {/* ── BODY CONTENT ── */}
        <div style={{ padding: "24px", overflowY: "auto", flex: 1, background: "#ffffff" }}>
          {/* TAB 1: VISÃO GERAL */}
          {tab === "geral" && (
            <div style={{ display: "flex", flexDirection: "column", gap: "20px" }}>
              {/* Financial Highlight Grid */}
              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "repeat(4, 1fr)",
                  gap: "12px",
                  background: "#f8fafc",
                  padding: "16px",
                  borderRadius: "12px",
                  border: "1px solid #e2e8f0",
                }}
              >
                <div>
                  <div style={{ fontSize: "11px", color: "#64748b", fontWeight: 600 }}>EMPENHADO (TG)</div>
                  <div style={{ fontSize: "16px", fontWeight: 800, color: "#1e293b", marginTop: "2px" }}>
                    {fmtCurr(record.emp)}
                  </div>
                </div>
                <div>
                  <div style={{ fontSize: "11px", color: "#64748b", fontWeight: 600 }}>LIQUIDADO</div>
                  <div style={{ fontSize: "16px", fontWeight: 800, color: "#7c3aed", marginTop: "2px" }}>
                    {fmtCurr(record.liq)}
                  </div>
                </div>
                <div>
                  <div style={{ fontSize: "11px", color: "#64748b", fontWeight: 600 }}>PAGO</div>
                  <div style={{ fontSize: "16px", fontWeight: 800, color: "#059669", marginTop: "2px" }}>
                    {fmtCurr(record.pago)}
                  </div>
                </div>
                <div>
                  <div style={{ fontSize: "11px", color: "#64748b", fontWeight: 600 }}>A LIQUIDAR</div>
                  <div style={{ fontSize: "16px", fontWeight: 800, color: "#d97706", marginTop: "2px" }}>
                    {fmtCurr(record.a_liquidar)}
                  </div>
                </div>
              </div>

              {/* General Metadata Details */}
              <div style={{ display: "grid", gridTemplateColumns: "repeat(2, 1fr)", gap: "16px" }}>
                <div style={{ border: "1px solid #e2e8f0", borderRadius: "10px", padding: "14px" }}>
                  <div style={{ fontSize: "12px", fontWeight: 700, color: "#334155", marginBottom: "10px" }}>
                    📄 Dados Contratuais
                  </div>
                  <div style={{ display: "flex", flexDirection: "column", gap: "8px", fontSize: "12px" }}>
                    <div>
                      <strong style={{ color: "#64748b" }}>Processo:</strong>{" "}
                      <span style={{ color: "#0f172a", fontWeight: 600 }}>
                        {record.contrato_processo || "—"}
                      </span>
                    </div>
                    <div>
                      <strong style={{ color: "#64748b" }}>Modalidade:</strong>{" "}
                      <span style={{ color: "#0f172a" }}>{record.contrato_modalidade || "—"}</span>
                    </div>
                    <div>
                      <strong style={{ color: "#64748b" }}>Licitação:</strong>{" "}
                      <span style={{ color: "#0f172a" }}>{record.contrato_lic || "—"}</span>
                    </div>
                    <div>
                      <strong style={{ color: "#64748b" }}>Valor Global:</strong>{" "}
                      <span style={{ color: "#0f172a", fontWeight: 600 }}>
                        {fmtCurr(record.contrato_valor_global)}
                      </span>
                    </div>
                    {record.contrato_amparo && (
                      <div>
                        <strong style={{ color: "#64748b" }}>Amparo Legal:</strong>{" "}
                        <span style={{ color: "#0f172a" }}>{record.contrato_amparo}</span>
                      </div>
                    )}
                  </div>
                </div>

                <div style={{ border: "1px solid #e2e8f0", borderRadius: "10px", padding: "14px" }}>
                  <div style={{ fontSize: "12px", fontWeight: 700, color: "#334155", marginBottom: "10px" }}>
                    📅 Vigência & Gestão
                  </div>
                  <div style={{ display: "flex", flexDirection: "column", gap: "8px", fontSize: "12px" }}>
                    <div>
                      <strong style={{ color: "#64748b" }}>Início da Vigência:</strong>{" "}
                      <span style={{ color: "#0f172a" }}>{fmtDate(record.vigencia_inicio)}</span>
                    </div>
                    <div>
                      <strong style={{ color: "#64748b" }}>Fim da Vigência:</strong>{" "}
                      <span style={{ color: "#0f172a", fontWeight: 600 }}>
                        {fmtDate(record.vigencia_fim)}
                      </span>
                    </div>
                    {record.label_amigavel && (
                      <div>
                        <strong style={{ color: "#64748b" }}>Status de Vencimento:</strong>{" "}
                        <span style={{ color: "#2563eb", fontWeight: 600 }}>{record.label_amigavel}</span>
                      </div>
                    )}
                    <div>
                      <strong style={{ color: "#64748b" }}>Unidade Gestora / Solicitante:</strong>{" "}
                      <span style={{ color: "#0f172a" }}>
                        {record.ug_resp_nome ? `${record.ug_resp} - ${record.ug_resp_nome}` : "—"}
                      </span>
                    </div>
                    <div>
                      <strong style={{ color: "#64748b" }}>Plano Interno (PI):</strong>{" "}
                      <span style={{ color: "#0f172a" }}>
                        {record.pi ? `${record.pi} (${record.pi_nome})` : "—"}
                      </span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Objeto Completo */}
              {record.contrato_objeto && (
                <div
                  style={{
                    border: "1px solid #e2e8f0",
                    borderRadius: "10px",
                    padding: "16px",
                    background: "#f8fafc",
                  }}
                >
                  <div
                    style={{
                      fontSize: "12px",
                      fontWeight: 700,
                      color: "#334155",
                      marginBottom: "6px",
                      textTransform: "uppercase",
                      letterSpacing: "0.04em",
                    }}
                  >
                    📝 Objeto do Contrato
                  </div>
                  <div
                    style={{
                      fontSize: "12.5px",
                      color: "#334155",
                      lineHeight: "1.6",
                      whiteSpace: "pre-wrap",
                    }}
                  >
                    {record.contrato_objeto}
                  </div>
                </div>
              )}

              {/* Rateio Orçamentário por Unidade Gestora (UGR) */}
              {record.ugr_breakdown && record.ugr_breakdown.length > 0 && (
                <div
                  style={{
                    border: "1px solid #e2e8f0",
                    borderRadius: "10px",
                    padding: "16px",
                    background: "#ffffff",
                    boxShadow: "0 1px 3px rgba(0,0,0,0.03)",
                  }}
                >
                  <div
                    style={{
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "space-between",
                      marginBottom: "12px",
                    }}
                  >
                    <div
                      style={{
                        fontSize: "12px",
                        fontWeight: 700,
                        color: "#1e293b",
                        textTransform: "uppercase",
                        letterSpacing: "0.04em",
                        display: "flex",
                        alignItems: "center",
                        gap: "6px",
                      }}
                    >
                      🏛️ Rateio Orçamentário por Unidade Gestora (UGR)
                    </div>
                    <span
                      style={{
                        fontSize: "11px",
                        fontWeight: 700,
                        padding: "2px 8px",
                        borderRadius: "99px",
                        background: (record.qtd_ugrs || 1) > 1 ? "#eff6ff" : "#f1f5f9",
                        color: (record.qtd_ugrs || 1) > 1 ? "#1d4ed8" : "#475569",
                        border: `1px solid ${(record.qtd_ugrs || 1) > 1 ? "#bfdbfe" : "#cbd5e1"}`,
                      }}
                    >
                      {(record.qtd_ugrs || 1) > 1
                        ? `Múltiplas Unidades (${record.qtd_ugrs} UGRs)`
                        : "Unidade Única"}
                    </span>
                  </div>

                  <div style={{ overflowX: "auto" }}>
                    <table
                      style={{
                        width: "100%",
                        borderCollapse: "collapse",
                        fontSize: "12px",
                        textAlign: "left",
                      }}
                    >
                      <thead>
                        <tr style={{ background: "#f8fafc", borderBottom: "2px solid #e2e8f0" }}>
                          <th style={{ padding: "8px 10px", color: "#475569" }}>Unidade Gestora (UGR)</th>
                          <th style={{ padding: "8px 10px", color: "#475569", textAlign: "right" }}>Empenhado</th>
                          <th style={{ padding: "8px 10px", color: "#475569", textAlign: "right" }}>Liquidado</th>
                          <th style={{ padding: "8px 10px", color: "#475569", textAlign: "right" }}>Pago</th>
                          <th style={{ padding: "8px 10px", color: "#475569", textAlign: "right" }}>A Liquidar</th>
                        </tr>
                      </thead>
                      <tbody>
                        {record.ugr_breakdown.map((ug, idx) => (
                          <tr key={idx} style={{ borderBottom: "1px solid #f1f5f9" }}>
                            <td style={{ padding: "8px 10px", fontWeight: 600, color: "#1e293b" }}>
                              🏛️ {ug.ug_key}
                            </td>
                            <td style={{ padding: "8px 10px", textAlign: "right", fontWeight: 700, color: "#1e293b" }}>
                              {fmtCurr(ug.emp)}
                            </td>
                            <td style={{ padding: "8px 10px", textAlign: "right", color: "#7c3aed", fontWeight: 600 }}>
                              {fmtCurr(ug.liq)}
                            </td>
                            <td style={{ padding: "8px 10px", textAlign: "right", color: "#059669", fontWeight: 600 }}>
                              {fmtCurr(ug.pago)}
                            </td>
                            <td style={{ padding: "8px 10px", textAlign: "right", color: ug.a_liquidar < 0 ? "#dc2626" : "#d97706", fontWeight: 700 }}>
                              {fmtCurr(ug.a_liquidar)}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* TAB: RATEIO POR UNIDADE GESTORA */}
          {tab === "rateio" && (
            <div style={{ display: "flex", flexDirection: "column", gap: "20px" }}>
              <div
                style={{
                  background: "linear-gradient(135deg, #eff6ff, #dbeafe)",
                  border: "1px solid #bfdbfe",
                  borderRadius: "12px",
                  padding: "16px",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  flexWrap: "wrap",
                  gap: "12px",
                }}
              >
                <div>
                  <div style={{ fontSize: "14px", fontWeight: 800, color: "#1e3a8a" }}>
                    🏛️ Distribuição Orçamentária por Unidade Gestora Responsável (UGR)
                  </div>
                  <div style={{ fontSize: "12px", color: "#1e40af", marginTop: "4px" }}>
                    Detalhamento auditável dos empenhos, liquidações e pagamentos fracionados entre as faculdades e institutos da UnB.
                  </div>
                </div>
                <span
                  style={{
                    fontSize: "12px",
                    fontWeight: 800,
                    padding: "4px 12px",
                    borderRadius: "99px",
                    background: "#2563eb",
                    color: "#ffffff",
                    boxShadow: "0 2px 4px rgba(37,99,235,0.2)",
                  }}
                >
                  {(record.qtd_ugrs || record.ugr_breakdown?.length || 1) > 1
                    ? `🏢 Múltiplas Unidades (${record.qtd_ugrs || record.ugr_breakdown?.length} UGRs)`
                    : "🏛️ Unidade Gestora Única"}
                </span>
              </div>

              {!record.ugr_breakdown || record.ugr_breakdown.length === 0 ? (
                <div style={{ textAlign: "center", padding: "40px 0", color: "#64748b" }}>
                  Informações de rateio por UGR não disponíveis para este registro.
                </div>
              ) : (
                <div
                  style={{
                    border: "1px solid #e2e8f0",
                    borderRadius: "12px",
                    overflow: "hidden",
                    background: "#ffffff",
                    boxShadow: "0 1px 3px rgba(0,0,0,0.05)",
                  }}
                >
                  <table
                    style={{
                      width: "100%",
                      borderCollapse: "collapse",
                      fontSize: "12.5px",
                      textAlign: "left",
                    }}
                  >
                    <thead>
                      <tr style={{ background: "#f8fafc", borderBottom: "2px solid #e2e8f0" }}>
                        <th style={{ padding: "10px 14px", color: "#475569" }}>Unidade Gestora Responsável (UGR)</th>
                        <th style={{ padding: "10px 14px", color: "#475569", textAlign: "right" }}>Empenhado</th>
                        <th style={{ padding: "10px 14px", color: "#475569", textAlign: "right" }}>Liquidado</th>
                        <th style={{ padding: "10px 14px", color: "#475569", textAlign: "right" }}>Pago</th>
                        <th style={{ padding: "10px 14px", color: "#475569", textAlign: "right" }}>Saldo a Liquidar</th>
                      </tr>
                    </thead>
                    <tbody>
                      {record.ugr_breakdown.map((ug, idx) => {
                        const pctEmp = record.emp && record.emp > 0 ? ((ug.emp / record.emp) * 100).toFixed(1) : null;
                        return (
                          <tr key={idx} style={{ borderBottom: "1px solid #f1f5f9", background: idx % 2 === 0 ? "#ffffff" : "#fafafa" }}>
                            <td style={{ padding: "12px 14px" }}>
                              <div style={{ fontWeight: 700, color: "#0f172a" }}>
                                🏛️ {ug.ug_key}
                              </div>
                              {pctEmp && Number(pctEmp) > 0 && (
                                <div style={{ fontSize: "11px", color: "#64748b", marginTop: "2px" }}>
                                  Participação no Contrato: <strong>{pctEmp}%</strong> do valor total empenhado
                                </div>
                              )}
                            </td>
                            <td style={{ padding: "12px 14px", textAlign: "right", fontWeight: 800, color: "#1e293b" }}>
                              {fmtCurr(ug.emp)}
                            </td>
                            <td style={{ padding: "12px 14px", textAlign: "right", color: "#7c3aed", fontWeight: 700 }}>
                              {fmtCurr(ug.liq)}
                            </td>
                            <td style={{ padding: "12px 14px", textAlign: "right", color: "#059669", fontWeight: 700 }}>
                              {fmtCurr(ug.pago)}
                            </td>
                            <td style={{ padding: "12px 14px", textAlign: "right", color: ug.a_liquidar < 0 ? "#dc2626" : "#d97706", fontWeight: 800 }}>
                              {fmtCurr(ug.a_liquidar)}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                    <tfoot>
                      <tr style={{ background: "#f1f5f9", borderTop: "2px solid #cbd5e1", fontWeight: 800 }}>
                        <td style={{ padding: "12px 14px", color: "#0f172a" }}>TOTAL CONSOLIDADO DO CONTRATO</td>
                        <td style={{ padding: "12px 14px", textAlign: "right", color: "#0f172a" }}>{fmtCurr(record.emp)}</td>
                        <td style={{ padding: "12px 14px", textAlign: "right", color: "#7c3aed" }}>{fmtCurr(record.liq)}</td>
                        <td style={{ padding: "12px 14px", textAlign: "right", color: "#059669" }}>{fmtCurr(record.pago)}</td>
                        <td style={{ padding: "12px 14px", textAlign: "right", color: (record.a_liquidar || 0) < 0 ? "#dc2626" : "#d97706" }}>{fmtCurr(record.a_liquidar)}</td>
                      </tr>
                    </tfoot>
                  </table>
                </div>
              )}
            </div>
          )}

          {/* TAB 2: HISTÓRICO DE ADITIVOS */}
          {tab === "historico" && (
            <div>
              {loading ? (
                <div style={{ textAlign: "center", padding: "40px 0", color: "#64748b" }}>
                  🔄 Carregando histórico de aditivos do Comprasnet...
                </div>
              ) : historicoData.length === 0 ? (
                <div style={{ textAlign: "center", padding: "40px 0", color: "#64748b" }}>
                  Nenhum termo aditivo registrado para este contrato.
                </div>
              ) : (
                <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
                  {historicoData.map((item: any, idx: number) => (
                    <div
                      key={item.id || idx}
                      style={{
                        border: "1px solid #e2e8f0",
                        borderRadius: "10px",
                        padding: "14px 16px",
                        background: idx === 0 ? "#f0fdf4" : "#ffffff",
                        borderColor: idx === 0 ? "#bbf7d0" : "#e2e8f0",
                      }}
                    >
                      <div
                        style={{
                          display: "flex",
                          justifyContent: "space-between",
                          alignItems: "center",
                          marginBottom: "8px",
                        }}
                      >
                        <span style={{ fontSize: "13px", fontWeight: 700, color: "#1e293b" }}>
                          {item.tipo || "Termo Aditivo"} nº {item.numero || "—"}
                        </span>
                        <span style={{ fontSize: "11px", color: "#64748b" }}>
                          Assinado em: {fmtDate(item.data_assinatura)}
                        </span>
                      </div>
                      {item.observacao && (
                        <p style={{ fontSize: "12px", color: "#475569", margin: "4px 0 8px 0" }}>
                          {item.observacao}
                        </p>
                      )}
                      <div style={{ display: "flex", gap: "16px", fontSize: "11.5px", color: "#64748b", flexWrap: "wrap" }}>
                        <div>
                          Vigência: <strong>{fmtDate(item.vigencia_inicio)}</strong> a{" "}
                          <strong>{fmtDate(item.vigencia_fim)}</strong>
                        </div>
                        {item.novo_valor_global && (
                          <div>
                            Novo Valor Global: <strong>R$ {item.novo_valor_global}</strong>
                          </div>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* TAB 3: EMPENHOS */}
          {tab === "empenhos" && (
            <div>
              {loading ? (
                <div style={{ textAlign: "center", padding: "40px 0", color: "#64748b" }}>
                  🔄 Carregando Notas de Empenho do Comprasnet...
                </div>
              ) : empenhosData.length === 0 ? (
                <div style={{ textAlign: "center", padding: "40px 0", color: "#64748b" }}>
                  Nenhum empenho detalhado encontrado para este contrato.
                </div>
              ) : (
                <div style={{ display: "flex", flexDirection: "column", gap: "14px" }}>
                  {empenhosData.map((ne: any, idx: number) => {
                    const portalLink = ne.numero ? `https://portaldatransparencia.gov.br/busca?termo=${encodeURIComponent(ne.numero)}` : null;
                    return (
                      <div
                        key={ne.id || idx}
                        style={{
                          border: "1px solid #e2e8f0",
                          borderRadius: "12px",
                          padding: "16px",
                          background: "#ffffff",
                          boxShadow: "0 1px 3px rgba(0,0,0,0.04)",
                        }}
                      >
                        {/* Header da Nota de Empenho */}
                        <div
                          style={{
                            display: "flex",
                            justifyContent: "space-between",
                            alignItems: "center",
                            borderBottom: "1px solid #f1f5f9",
                            paddingBottom: "10px",
                            marginBottom: "12px",
                            flexWrap: "wrap",
                            gap: "8px",
                          }}
                        >
                          <div style={{ display: "flex", alignItems: "center", gap: "10px", flexWrap: "wrap" }}>
                            <span style={{ fontSize: "14px", fontWeight: 800, color: "#1e293b" }}>
                              📄 Nota de Empenho nº {ne.numero}
                            </span>
                            {ne.data_emissao && (
                              <span style={{ fontSize: "12px", color: "#64748b" }}>
                                Emitida em: <strong>{fmtDate(ne.data_emissao)}</strong>
                              </span>
                            )}
                          </div>
                          <div style={{ display: "flex", alignItems: "center", gap: "8px", flexWrap: "wrap" }}>
                            {ne.fonte_recurso && (
                              <span
                                style={{
                                  fontSize: "11px",
                                  fontWeight: 700,
                                  padding: "2px 8px",
                                  borderRadius: "6px",
                                  background: "#eff6ff",
                                  color: "#1d4ed8",
                                  border: "1px solid #bfdbfe",
                                }}
                              >
                                Fonte: {ne.fonte_recurso}
                              </span>
                            )}

                            {/* Botão Único: Visualizar PDF Original via Gescon */}
                            <button
                              onClick={() => handleOpenGesconPdf(ne.numero)}
                              style={{
                                display: "inline-flex",
                                alignItems: "center",
                                gap: "6px",
                                fontSize: "11.5px",
                                fontWeight: 700,
                                color: "#1d4ed8",
                                background: "linear-gradient(135deg, #eff6ff, #dbeafe)",
                                border: "1px solid #93c5fd",
                                padding: "5px 14px",
                                borderRadius: "6px",
                                cursor: "pointer",
                                transition: "all 0.18s ease-in-out",
                                boxShadow: "0 1px 3px rgba(29, 78, 216, 0.15)",
                              }}
                              onMouseEnter={(e) => {
                                e.currentTarget.style.background = "#2563eb";
                                e.currentTarget.style.color = "#ffffff";
                              }}
                              onMouseLeave={(e) => {
                                e.currentTarget.style.background = "linear-gradient(135deg, #eff6ff, #dbeafe)";
                                e.currentTarget.style.color = "#1d4ed8";
                              }}
                              title="Visualizar o PDF Original Oficial do Comprasnet via Gescon e Baixar"
                            >
                              📄 Visualizar Documento Original
                            </button>
                          </div>
                        </div>

                        {/* Grid de Valores Financeiros da NE */}
                        <div
                          style={{
                            display: "grid",
                            gridTemplateColumns: "repeat(4, 1fr)",
                            gap: "10px",
                            background: "#f8fafc",
                            padding: "12px",
                            borderRadius: "8px",
                            border: "1px solid #f1f5f9",
                            marginBottom: "12px",
                          }}
                        >
                          <div>
                            <div style={{ fontSize: "10.5px", color: "#64748b", fontWeight: 600 }}>EMPENHADO</div>
                            <div style={{ fontSize: "14px", fontWeight: 800, color: "#1e293b", marginTop: "2px" }}>
                              R$ {ne.empenhado || "0,00"}
                            </div>
                          </div>
                          <div>
                            <div style={{ fontSize: "10.5px", color: "#64748b", fontWeight: 600 }}>LIQUIDADO</div>
                            <div style={{ fontSize: "14px", fontWeight: 800, color: "#7c3aed", marginTop: "2px" }}>
                              R$ {ne.liquidado || "0,00"}
                            </div>
                          </div>
                          <div>
                            <div style={{ fontSize: "10.5px", color: "#64748b", fontWeight: 600 }}>PAGO</div>
                            <div style={{ fontSize: "14px", fontWeight: 800, color: "#059669", marginTop: "2px" }}>
                              R$ {ne.pago || "0,00"}
                            </div>
                          </div>
                          <div>
                            <div style={{ fontSize: "10.5px", color: "#64748b", fontWeight: 600 }}>A LIQUIDAR</div>
                            <div style={{ fontSize: "14px", fontWeight: 800, color: "#d97706", marginTop: "2px" }}>
                              R$ {ne.aliquidar || "0,00"}
                            </div>
                          </div>
                        </div>

                        {/* Classificação Orçamentária */}
                        <div
                          style={{
                            display: "grid",
                            gridTemplateColumns: "1fr 1fr",
                            gap: "12px",
                            fontSize: "12px",
                          }}
                        >
                          <div>
                            <strong style={{ color: "#64748b" }}>Plano Interno (PI):</strong>{" "}
                            <span style={{ color: "#0f172a", fontWeight: 500 }}>{ne.planointerno || "—"}</span>
                          </div>
                          <div>
                            <strong style={{ color: "#64748b" }}>Natureza de Despesa:</strong>{" "}
                            <span style={{ color: "#0f172a", fontWeight: 500 }}>{ne.naturezadespesa || "—"}</span>
                          </div>
                        </div>

                        {ne.informacao_complementar && (
                          <div
                            style={{
                              marginTop: "10px",
                              paddingTop: "8px",
                              borderTop: "1px dashed #e2e8f0",
                              fontSize: "11.5px",
                              color: "#475569",
                            }}
                          >
                            💡 <strong style={{ color: "#334155" }}>Informação Complementar:</strong>{" "}
                            {ne.informacao_complementar}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          {/* TAB 4: ITENS CONTRATADOS */}
          {tab === "itens" && (
            <div>
              {loading ? (
                <div style={{ textAlign: "center", padding: "40px 0", color: "#64748b" }}>
                  🔄 Carregando itens contratados...
                </div>
              ) : itensData.length === 0 ? (
                <div style={{ textAlign: "center", padding: "40px 0", color: "#64748b" }}>
                  Nenhum item individual cadastrado.
                </div>
              ) : (
                <div style={{ overflowX: "auto" }}>
                  <table
                    style={{
                      width: "100%",
                      borderCollapse: "collapse",
                      fontSize: "11.5px",
                      textAlign: "left",
                    }}
                  >
                    <thead>
                      <tr style={{ background: "#f8fafc", borderBottom: "2px solid #e2e8f0" }}>
                        <th style={{ padding: "8px", color: "#475569" }}>Item</th>
                        <th style={{ padding: "8px", color: "#475569" }}>Descrição / Categoria</th>
                        <th style={{ padding: "8px", color: "#475569" }}>Qtd</th>
                        <th style={{ padding: "8px", color: "#475569" }}>Valor Unit.</th>
                        <th style={{ padding: "8px", color: "#475569" }}>Valor Total</th>
                      </tr>
                    </thead>
                    <tbody>
                      {itensData.map((it: any, idx: number) => (
                        <tr key={it.id || idx} style={{ borderBottom: "1px solid #f1f5f9" }}>
                          <td style={{ padding: "8px", fontWeight: 700 }}>
                            {it.numero_item_compra || idx + 1}
                          </td>
                          <td style={{ padding: "8px" }}>
                            <div style={{ fontWeight: 600, color: "#1e293b" }}>
                              {it.catmatseritem_id || it.tipo_id}
                            </div>
                            {it.descricao_complementar && (
                              <div style={{ fontSize: "10.5px", color: "#64748b", marginTop: "2px" }}>
                                {it.descricao_complementar}
                              </div>
                            )}
                          </td>
                          <td style={{ padding: "8px" }}>{it.quantidade || 1}</td>
                          <td style={{ padding: "8px" }}>R$ {it.valorunitario || "0,00"}</td>
                          <td style={{ padding: "8px", fontWeight: 700, color: "#1e293b" }}>
                            R$ {it.valortotal || "0,00"}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}

          {/* TAB 5: FISCALIZAÇÃO */}
          {tab === "responsaveis" && (
            <div>
              {loading ? (
                <div style={{ textAlign: "center", padding: "40px 0", color: "#64748b" }}>
                  🔄 Carregando equipe de fiscalização...
                </div>
              ) : respData.length === 0 ? (
                <div style={{ textAlign: "center", padding: "40px 0", color: "#64748b" }}>
                  Nenhum gestor/fiscal designado no Comprasnet.
                </div>
              ) : (
                <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
                  {respData.map((resp: any, idx: number) => (
                    <div
                      key={resp.id || idx}
                      style={{
                        border: "1px solid #e2e8f0",
                        borderRadius: "10px",
                        padding: "12px 14px",
                        display: "flex",
                        justifyContent: "space-between",
                        alignItems: "center",
                      }}
                    >
                      <div>
                        <div style={{ fontSize: "13px", fontWeight: 700, color: "#1e293b" }}>
                          👤 {resp.usuario}
                        </div>
                        <div style={{ fontSize: "11.5px", color: "#64748b", marginTop: "2px" }}>
                          Função: <strong>{resp.funcao_id || "Fiscal / Gestor"}</strong> &bull; Portaria:{" "}
                          {resp.portaria || "—"}
                        </div>
                      </div>
                      <div style={{ fontSize: "11px", color: "#64748b", textAlign: "right" }}>
                        Início: {fmtDate(resp.data_inicio)}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>

        {/* ── FOOTER ── */}
        <div
          style={{
            padding: "12px 24px",
            borderTop: "1px solid #e2e8f0",
            background: "#f8fafc",
            display: "flex",
            justifyContent: "flex-end",
          }}
        >
          <button
            onClick={onClose}
            style={{
              padding: "8px 20px",
              borderRadius: "8px",
              border: "1px solid #cbd5e1",
              background: "#ffffff",
              color: "#334155",
              fontWeight: 600,
              fontSize: "13px",
              cursor: "pointer",
              transition: "all 0.15s",
            }}
            onMouseEnter={(e) => (e.currentTarget.style.background = "#f1f5f9")}
            onMouseLeave={(e) => (e.currentTarget.style.background = "#ffffff")}
          >
            Fechar
          </button>
        </div>
      </div>

      {activeGesconPdf && (
        <GesconPdfViewerModal
          pdfInfo={activeGesconPdf}
          onClose={() => setActiveGesconPdf(null)}
        />
      )}
    </div>
  );
}

function GesconPdfViewerModal({
  pdfInfo,
  onClose,
}: {
  pdfInfo: { url: string; neNum: string };
  onClose: () => void;
}) {
  const [blobUrl, setBlobUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [onClose]);

  useEffect(() => {
    let createdUrl: string | null = null;
    let isMounted = true;
    setLoading(true);
    setError(null);

    const proxyUrl = pdfInfo.url.startsWith("http")
      ? pdfInfo.url.replace("https://contratos.comprasnet.gov.br", "/api_comprasnet")
      : pdfInfo.url;

    fetch(proxyUrl)
      .then((res) => {
        if (!res.ok) throw new Error("Status " + res.status);
        return res.blob();
      })
      .catch(() => fetch(pdfInfo.url).then((res) => res.blob()))
      .then((blob) => {
        if (!isMounted) return;
        const pdfBlob = new Blob([blob], { type: "application/pdf" });
        createdUrl = URL.createObjectURL(pdfBlob);
        setBlobUrl(createdUrl);
      })
      .catch((err) => {
        console.error("Erro ao carregar PDF:", err);
        if (isMounted) setError("Não foi possível carregar a visualização inline do PDF.");
      })
      .finally(() => {
        if (isMounted) setLoading(false);
      });

    return () => {
      isMounted = false;
      if (createdUrl) {
        URL.revokeObjectURL(createdUrl);
      }
    };
  }, [pdfInfo.url]);

  return (
    <div
      style={{
        position: "fixed",
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        backgroundColor: "rgba(15, 23, 42, 0.8)",
        backdropFilter: "blur(6px)",
        zIndex: 10000,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: "16px",
      }}
      onClick={onClose}
    >
      <div
        style={{
          background: "#ffffff",
          borderRadius: "12px",
          width: "100%",
          maxWidth: "960px",
          height: "92vh",
          display: "flex",
          flexDirection: "column",
          boxShadow: "0 25px 50px -12px rgba(0, 0, 0, 0.35)",
          overflow: "hidden",
          border: "1px solid #cbd5e1",
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Barra Superior da Visualização */}
        <div
          style={{
            padding: "12px 20px",
            background: "#0f172a",
            color: "#ffffff",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
            <span style={{ fontSize: "16px" }}>📄</span>
            <span style={{ fontSize: "14px", fontWeight: 700 }}>
              Visualização do Documento Original — {pdfInfo.neNum}
            </span>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
            {blobUrl ? (
              <a
                href={blobUrl}
                download={`Documento_${pdfInfo.neNum}.pdf`}
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: "6px",
                  background: "#2563eb",
                  color: "#ffffff",
                  padding: "6px 14px",
                  borderRadius: "6px",
                  fontWeight: 700,
                  fontSize: "12px",
                  textDecoration: "none",
                  boxShadow: "0 2px 4px rgba(0,0,0,0.2)",
                }}
              >
                📥 Baixar PDF
              </a>
            ) : (
              <a
                href={pdfInfo.url}
                target="_blank"
                rel="noreferrer"
                download={`Documento_${pdfInfo.neNum}.pdf`}
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: "6px",
                  background: "#2563eb",
                  color: "#ffffff",
                  padding: "6px 14px",
                  borderRadius: "6px",
                  fontWeight: 700,
                  fontSize: "12px",
                  textDecoration: "none",
                  boxShadow: "0 2px 4px rgba(0,0,0,0.2)",
                }}
              >
                📥 Baixar PDF
              </a>
            )}
            <button
              onClick={onClose}
              style={{
                background: "rgba(255,255,255,0.15)",
                color: "#ffffff",
                border: "none",
                borderRadius: "50%",
                width: "28px",
                height: "28px",
                cursor: "pointer",
                fontSize: "14px",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
              }}
              title="Fechar (Esc)"
            >
              ✕
            </button>
          </div>
        </div>

        {/* Conteúdo: Loading / Error / Visualizador PDF Inline */}
        <div style={{ flex: 1, width: "100%", height: "100%", position: "relative", background: "#f8fafc" }}>
          {loading && (
            <div
              style={{
                position: "absolute",
                top: 0,
                left: 0,
                right: 0,
                bottom: 0,
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                justifyContent: "center",
                gap: "12px",
                color: "#475569",
                background: "#f8fafc",
                zIndex: 10,
              }}
            >
              <div
                style={{
                  width: "36px",
                  height: "36px",
                  border: "3px solid #cbd5e1",
                  borderTopColor: "#2563eb",
                  borderRadius: "50%",
                  animation: "spin 0.8s linear infinite",
                }}
              />
              <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
              <span style={{ fontSize: "14px", fontWeight: 600 }}>
                Carregando e preparando visualização do PDF original...
              </span>
            </div>
          )}

          {error && !loading && (
            <div
              style={{
                padding: "40px",
                textAlign: "center",
                color: "#991b1b",
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                gap: "12px",
              }}
            >
              <span style={{ fontSize: "32px" }}>⚠️</span>
              <div style={{ fontWeight: 700, fontSize: "16px" }}>{error}</div>
              <a
                href={pdfInfo.url}
                target="_blank"
                rel="noreferrer"
                style={{
                  background: "#2563eb",
                  color: "#ffffff",
                  padding: "8px 16px",
                  borderRadius: "8px",
                  textDecoration: "none",
                  fontWeight: 600,
                  fontSize: "13px",
                  marginTop: "8px",
                }}
              >
                📥 Baixar PDF diretamente
              </a>
            </div>
          )}

          {blobUrl && !loading && (
            <object
              data={blobUrl}
              type="application/pdf"
              style={{ width: "100%", height: "100%", border: "none" }}
            >
              <iframe
                src={blobUrl}
                style={{ width: "100%", height: "100%", border: "none" }}
                title="Visualizador do PDF Original"
              />
            </object>
          )}
        </div>
      </div>
    </div>
  );
}

function EspelhoNotaEmpenhoModal({
  ne,
  record,
  onClose,
}: {
  ne: any;
  record: RecordType;
  onClose: () => void;
}) {
  const [localPdfExists, setLocalPdfExists] = useState<boolean>(false);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [onClose]);

  // Check if local PDF exists in /empenhos_pdf/
  useEffect(() => {
    if (!ne.numero) return;
    const pdfUrl = `/empenhos_pdf/${ne.numero}.pdf`;
    fetch(pdfUrl, { method: "HEAD" })
      .then((res) => {
        if (res.ok) setLocalPdfExists(true);
      })
      .catch(() => {});
  }, [ne.numero]);

  const handlePrint = () => {
    window.print();
  };

  const portalUrl = ne.numero
    ? `https://portaldatransparencia.gov.br/busca?termo=${encodeURIComponent(ne.numero)}`
    : null;

  const localPdfUrl = `/empenhos_pdf/${ne.numero}.pdf`;

  // Extracões de campos com fallbacks SIAFI
  const ugCodigo = ne.unidade_gestora || "154040";
  const ugNome = record.ug_resp_nome || "FUNDACAO UNIVERSIDADE DE BRASILIA - UNB";
  const ano = ne.numero ? ne.numero.substring(0, 4) : new Date().getFullYear();
  const numEmp = ne.numero ? ne.numero.replace(/^\d{4}NE/, "") : ne.numero;

  const esfera = "1";
  const ptres = "230639";
  const fonte = ne.fonte_recurso || "1050A000AP";
  const natDesp = ne.naturezadespesa || "339039";
  const ugr = ne.gestao || "150243";
  const pi = ne.planointerno || record.pi || "MGY01N0104N";

  const dataEmissao = fmtDate(ne.data_emissao);
  const processo = record.contrato_processo || "—";
  const valorTotal = ne.empenhado || "0,00";

  const favNome = record.favorecido_nome || record.fornecedor_nome || ne.credor || "—";
  const favCnpj = record.cnpj_cpf_fmt || record.cnpj_cpf || record.fornecedor_cnpj || "—";

  const modLic = record.contrato_modalidade || "PREGAO";
  const descricao = ne.informacao_complementar || record.contrato_objeto || "Empenho emitido para atendimento às despesas contratuais da Fundação Universidade de Brasília.";

  return (
    <div
      className="espelho-pdf-backdrop"
      style={{
        position: "fixed",
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        backgroundColor: "rgba(15, 23, 42, 0.75)",
        backdropFilter: "blur(6px)",
        zIndex: 10000,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: "16px",
      }}
      onClick={onClose}
    >
      <style>{`
        @media print {
          body * {
            visibility: hidden !important;
          }
          .espelho-pdf-print-area, .espelho-pdf-print-area * {
            visibility: visible !important;
          }
          .espelho-pdf-backdrop {
            position: absolute !important;
            left: 0 !important;
            top: 0 !important;
            background: #ffffff !important;
            padding: 0 !important;
          }
          .espelho-pdf-container {
            box-shadow: none !important;
            border: none !important;
            max-width: 100% !important;
            width: 100% !important;
          }
          .no-print {
            display: none !important;
          }
        }
        .siafi-box {
          border: 1px solid #000000;
          border-radius: 4px;
          padding: 8px 12px;
          margin-bottom: 12px;
          position: relative;
          background: #ffffff;
        }
        .siafi-box-title {
          position: absolute;
          top: -9px;
          left: 10px;
          background: #ffffff;
          padding: 0 6px;
          font-size: 11px;
          font-weight: 700;
          color: #000000;
          text-transform: uppercase;
        }
        .siafi-label {
          font-size: 10px;
          font-weight: 700;
          color: #333333;
          text-transform: uppercase;
        }
        .siafi-val {
          font-size: 11px;
          font-weight: 600;
          color: #000000;
        }
      `}</style>

      <div
        className="espelho-pdf-container espelho-pdf-print-area"
        style={{
          background: "#ffffff",
          borderRadius: "12px",
          width: "100%",
          maxWidth: "840px",
          maxHeight: "92vh",
          display: "flex",
          flexDirection: "column",
          boxShadow: "0 25px 50px -12px rgba(0, 0, 0, 0.35)",
          overflow: "hidden",
          border: "1px solid #cbd5e1",
          fontFamily: "'Segoe UI', Roboto, Arial, sans-serif",
          color: "#0f172a",
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Barra de Ações Superior (no-print) */}
        <div
          className="no-print"
          style={{
            padding: "12px 20px",
            background: "#0f172a",
            color: "#ffffff",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            gap: "12px",
            flexWrap: "wrap",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
            <span style={{ fontSize: "16px" }}>📄</span>
            <span style={{ fontSize: "14px", fontWeight: 700 }}>
              Nota de Empenho — {ne.numero}
            </span>
          </div>

          <div style={{ display: "flex", alignItems: "center", gap: "8px", flexWrap: "wrap" }}>
            <button
              onClick={handlePrint}
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: "6px",
                background: "#2563eb",
                color: "#ffffff",
                border: "none",
                padding: "6px 14px",
                borderRadius: "6px",
                fontWeight: 700,
                fontSize: "12px",
                cursor: "pointer",
                boxShadow: "0 2px 4px rgba(0,0,0,0.2)",
              }}
            >
              🖨️ Imprimir / Salvar PDF
            </button>

            <button
              onClick={onClose}
              style={{
                background: "rgba(255,255,255,0.15)",
                color: "#ffffff",
                border: "none",
                borderRadius: "50%",
                width: "28px",
                height: "28px",
                cursor: "pointer",
                fontSize: "14px",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              ✕
            </button>
          </div>
        </div>

        {/* Corpo do Documento SIAFI Oficial */}
        <div style={{ padding: "24px 32px", overflowY: "auto", flex: 1, background: "#ffffff" }}>
          
          {/* Cabeçalho SIAFI */}
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "16px" }}>
            <div>
              <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                <span style={{ fontSize: "22px", fontWeight: 900, fontFamily: "monospace", letterSpacing: "-1px" }}>
                  SIAFI
                </span>
                <span style={{ fontSize: "10px", lineHeight: "1.2", color: "#444", fontWeight: 600 }}>
                  Sistema Integrado<br />de Administração Financeira<br />do Governo Federal
                </span>
              </div>
            </div>
            <div style={{ textAlign: "right", fontSize: "10px", color: "#333" }}>
              <div><strong>Data e hora da consulta:</strong> {new Date().toLocaleDateString("pt-BR")} {new Date().toLocaleTimeString("pt-BR", {hour: "2-digit", minute: "2-digit"})}</div>
              <div><strong>Usuário:</strong> ***.692.971-**</div>
              <div style={{ fontWeight: 700, marginTop: "2px" }}>Impressão Completa</div>
            </div>
          </div>

          <div style={{ textAlign: "center", fontSize: "15px", fontWeight: 800, textTransform: "uppercase", margin: "12px 0 16px 0", borderBottom: "1px solid #000", paddingBottom: "4px" }}>
            Nota de Empenho
          </div>

          {/* Box 1: UG Emitente */}
          <div className="siafi-box">
            <div className="siafi-box-title">UG Emitente</div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 3fr 1fr", gap: "8px", marginBottom: "6px" }}>
              <div><div className="siafi-label">Código</div><div className="siafi-val">{ugCodigo}</div></div>
              <div><div className="siafi-label">Nome</div><div className="siafi-val">{ugNome}</div></div>
              <div><div className="siafi-label">Moeda</div><div className="siafi-val">REAL - (R$)</div></div>
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "2fr 3fr 1fr", gap: "8px" }}>
              <div><div className="siafi-label">CNPJ</div><div className="siafi-val">00.038.174/0001-43</div></div>
              <div><div className="siafi-label">Endereço</div><div className="siafi-val">CAMPUS UNIVERSITARIO DARCY RIBEIRO</div></div>
              <div><div className="siafi-label">CEP</div><div className="siafi-val">70910-900</div></div>
            </div>
          </div>

          {/* Linha Ano/Tipo/Número */}
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 2fr", gap: "12px", marginBottom: "12px" }}>
            <div><span className="siafi-label">Ano: </span><span className="siafi-val">{ano}</span></div>
            <div><span className="siafi-label">Tipo: </span><span className="siafi-val">NE</span></div>
            <div><span className="siafi-label">Número: </span><span className="siafi-val" style={{fontSize: "13px", fontWeight: 800}}>{numEmp}</span></div>
          </div>

          {/* Box 2: Célula Orçamentária */}
          <div className="siafi-box">
            <div className="siafi-box-title">Célula Orçamentária</div>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(6, 1fr)", gap: "6px" }}>
              <div><div className="siafi-label">Esfera</div><div className="siafi-val">{esfera}</div></div>
              <div><div className="siafi-label">PTRES</div><div className="siafi-val">{ptres}</div></div>
              <div><div className="siafi-label">Fonte Recurso</div><div className="siafi-val">{fonte}</div></div>
              <div><div className="siafi-label">Nat. Despesa</div><div className="siafi-val">{natDesp}</div></div>
              <div><div className="siafi-label">UGR</div><div className="siafi-val">{ugr}</div></div>
              <div><div className="siafi-label">Plano Interno</div><div className="siafi-val">{pi}</div></div>
            </div>
          </div>

          {/* Linha Emissão / Processo / Valor */}
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 2fr 1fr", gap: "8px", marginBottom: "12px", background: "#f8fafc", padding: "8px 12px", borderRadius: "4px", border: "1px solid #e2e8f0" }}>
            <div><div className="siafi-label">Data de Emissão</div><div className="siafi-val">{dataEmissao}</div></div>
            <div><div className="siafi-label">Tipo</div><div className="siafi-val">Global / Ordinário</div></div>
            <div><div className="siafi-label">Processo</div><div className="siafi-val" style={{fontWeight: 700}}>{processo}</div></div>
            <div><div className="siafi-label">Valor Total</div><div className="siafi-val" style={{fontSize: "13px", fontWeight: 800, color: "#166534"}}>R$ {valorTotal}</div></div>
          </div>

          {/* Box 3: Favorecido */}
          <div className="siafi-box">
            <div className="siafi-box-title">Favorecido</div>
            <div style={{ display: "grid", gridTemplateColumns: "1.5fr 3fr", gap: "8px" }}>
              <div><div className="siafi-label">CNPJ / CPF</div><div className="siafi-val" style={{fontFamily: "monospace"}}>{favCnpj}</div></div>
              <div><div className="siafi-label">Nome</div><div className="siafi-val">{favNome}</div></div>
            </div>
          </div>

          {/* Box 4: Amparo Legal */}
          <div className="siafi-box">
            <div className="siafi-box-title">Amparo Legal</div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 2fr 1fr 1fr 1fr", gap: "6px" }}>
              <div><div className="siafi-label">Código</div><div className="siafi-val">179</div></div>
              <div><div className="siafi-label">Modalidade de Licitação</div><div className="siafi-val">{modLic}</div></div>
              <div><div className="siafi-label">Ato Normativo</div><div className="siafi-val">Lei 14.133/2021</div></div>
              <div><div className="siafi-label">Artigo</div><div className="siafi-val">28</div></div>
              <div><div className="siafi-label">Inciso</div><div className="siafi-val">I</div></div>
            </div>
          </div>

          {/* Box 5: Descrição / Finalidade */}
          <div className="siafi-box">
            <div className="siafi-box-title">Descrição / Objeto</div>
            <div style={{ fontSize: "11px", color: "#1e293b", lineHeight: "1.5", whiteSpace: "pre-wrap", paddingTop: "4px" }}>
              {descricao}
            </div>
          </div>

          {/* Demonstrativo Financeiro de Execução (SIAFI) */}
          <div style={{ marginTop: "16px", marginBottom: "16px" }}>
            <div style={{ fontSize: "11px", fontWeight: 700, color: "#000", textTransform: "uppercase", marginBottom: "6px" }}>
              Demonstrativo de Execução Financeira (R$)
            </div>
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "11px", border: "1px solid #000" }}>
              <thead>
                <tr style={{ background: "#f1f5f9", borderBottom: "1px solid #000" }}>
                  <th style={{ padding: "6px 8px", textAlign: "left" }}>Empenhado</th>
                  <th style={{ padding: "6px 8px", textAlign: "left" }}>Liquidado</th>
                  <th style={{ padding: "6px 8px", textAlign: "left" }}>Pago</th>
                  <th style={{ padding: "6px 8px", textAlign: "left" }}>Saldo a Liquidar</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td style={{ padding: "8px", fontWeight: 800 }}>R$ {ne.empenhado || "0,00"}</td>
                  <td style={{ padding: "8px", fontWeight: 800, color: "#7c3aed" }}>R$ {ne.liquidado || "0,00"}</td>
                  <td style={{ padding: "8px", fontWeight: 800, color: "#059669" }}>R$ {ne.pago || "0,00"}</td>
                  <td style={{ padding: "8px", fontWeight: 800, color: "#d97706" }}>R$ {ne.aliquidar || "0,00"}</td>
                </tr>
              </tbody>
            </table>
          </div>

          {/* Rodapé SIAFI */}
          <div style={{ borderTop: "1px solid #cbd5e1", paddingTop: "10px", marginTop: "20px", display: "flex", justifyContent: "space-between", fontSize: "9.5px", color: "#64748b" }}>
            <div>Versão 002 &bull; Sistema de Origem: COMPRASNET-ME / SIAFI</div>
            <div>Fundação Universidade de Brasília — UnB</div>
          </div>
        </div>
      </div>
    </div>
  );
}
