import { useState } from "react";
import { X } from "lucide-react";

export default function SimulatorPage() {
  const [currentPath, setCurrentPath] = useState("dashboard");

  const paths = [
    { label: "Dashboard Geral", path: "dashboard" },
    { label: "Ecossistema de Custos", path: "graficos" },
    { label: "Comparativos", path: "comparisons" },
  ];

  return (
    <div style={{
      display: "flex",
      width: "100vw",
      height: "100vh",
      background: "#0f172a",
      color: "#f1f5f9",
      fontFamily: "Inter, system-ui, sans-serif",
      overflow: "hidden"
    }}>
      {/* Painel de Instruções Esquerdo */}
      <div style={{
        width: "380px",
        background: "#1e293b",
        borderRight: "1px solid #334155",
        padding: "30px",
        display: "flex",
        flexDirection: "column",
        justifyContent: "space-between",
        boxShadow: "4px 0 24px rgba(0,0,0,0.25)",
        zIndex: 10
      }}>
        <div>
          <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 8 }}>
            <span style={{ fontSize: 24 }}>📱</span>
            <h1 style={{ fontSize: 20, fontWeight: 800, color: "#3b82f6", margin: 0 }}>Simulador Mobile</h1>
          </div>
          <div style={{ background: "#2563eb1f", border: "1px solid #2563eb4a", borderRadius: 8, padding: "10px 14px", fontSize: 11.5, color: "#60a5fa", marginBottom: 24, lineHeight: 1.4 }}>
            <strong>Ambiente Isolado:</strong> As mudanças abaixo rodam apenas localmente. O site principal na internet continua intacto no formato original para desktop.
          </div>

          <h3 style={{ fontSize: 13, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.05em", color: "#94a3b8", marginBottom: 12 }}>Navegação Rápida</h3>
          <div style={{ display: "flex", flexDirection: "column", gap: 8, marginBottom: 30 }}>
            {paths.map(p => (
              <button
                key={p.path}
                onClick={() => setCurrentPath(p.path)}
                style={{
                  padding: "12px 14px",
                  borderRadius: 8,
                  border: currentPath === p.path ? "1px solid #3b82f6" : "1px solid #334155",
                  background: currentPath === p.path ? "#3b82f6" : "#0f172a",
                  color: "white",
                  fontSize: 12.5,
                  fontWeight: 600,
                  textAlign: "left",
                  cursor: "pointer",
                  transition: "all 0.2s ease",
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center"
                }}
              >
                {p.label}
                <span>{currentPath === p.path ? "●" : "○"}</span>
              </button>
            ))}
          </div>

          <h3 style={{ fontSize: 13, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.05em", color: "#94a3b8", marginBottom: 12 }}>Novidades do Celular</h3>
          <ul style={{ paddingLeft: 16, fontSize: 12, color: "#cbd5e1", lineHeight: 1.7, display: "flex", flexDirection: "column", gap: 8 }}>
            <li><strong>Gaveta de Filtros</strong>: Clique no botão azul "🔍 Filtrar Lançamentos" no topo da tela do celular.</li>
            <li><strong>Carrossel de KPIs</strong>: Toque nas setinhas ou círculos abaixo do bloco de KPIs para alternar slides.</li>
            <li><strong>Cards de Processo</strong>: Clique em qualquer card de processo para expandir/recolher seus detalhes.</li>
            <li><strong>Menu Hamburguer</strong>: Clique no ícone de três linhas no topo para revelar a barra lateral.</li>
          </ul>
        </div>

        <div style={{ fontSize: 11, color: "#64748b", textAlign: "center", borderTop: "1px solid #334155", paddingTop: 16 }}>
          Projeto Contratos · Simulador v1.0
        </div>
      </div>

      {/* Área Central com o Telefone */}
      <div style={{
        flex: 1,
        display: "flex",
        justifyContent: "center",
        alignItems: "center",
        position: "relative",
        background: "radial-gradient(circle, #1e293b 0%, #0f172a 100%)",
        height: "100%"
      }}>
        {/* Celular Mockup */}
        <div style={{
          width: "375px",
          height: "812px",
          background: "#f8fafc",
          borderRadius: "40px",
          border: "12px solid #334155",
          boxShadow: "0 25px 50px -12px rgba(0, 0, 0, 0.7)",
          position: "relative",
          overflow: "hidden",
          display: "flex",
          flexDirection: "column"
        }}>
          {/* Caixa de Som / Câmera Notch do iPhone */}
          <div style={{
            position: "absolute",
            top: 0,
            left: "50%",
            transform: "translateX(-50%)",
            width: "150px",
            height: "22px",
            background: "#334155",
            borderBottomLeftRadius: "15px",
            borderBottomRightRadius: "15px",
            zIndex: 9999,
            display: "flex",
            justifyContent: "center",
            alignItems: "center"
          }}>
            <div style={{ width: "40px", height: "4px", background: "#1e293b", borderRadius: "2px", marginBottom: "4px" }} />
          </div>

          {/* Iframe que carrega o app em tamanho celular */}
          <iframe
            src={`#/${currentPath}`}
            style={{
              width: "100%",
              height: "100%",
              border: "none",
              background: "#f8fafc",
              paddingTop: "24px" // dá espaço para o notch superior
            }}
          />
        </div>
      </div>
    </div>
  );
}
