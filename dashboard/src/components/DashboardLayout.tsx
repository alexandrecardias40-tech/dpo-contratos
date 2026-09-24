import { useEffect, useMemo, useState } from "react";
import { Link, useLocation } from "wouter";
import metaData from "../metadata.json";
import {
  Settings, Menu, X, Home, Activity,
  GitCompare, ChevronDown, Download,
} from "lucide-react";

interface MenuItem {
  href: string;
  label: React.ReactNode;
  icon: React.ReactNode;
  external?: boolean;
}

interface MenuSectionConfig {
  key: string;
  title: string;
  items: MenuItem[];
}

interface DashboardLayoutProps {
  children: React.ReactNode;
  menuConfig?: MenuSectionConfig[];
  hideUpdateBadge?: boolean;
}

export default function DashboardLayout({ children, menuConfig, hideUpdateBadge }: DashboardLayoutProps) {
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [location] = useLocation();
  const [isMobile, setIsMobile] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  useEffect(() => {
    const handleResize = () => {
      setIsMobile(window.innerWidth <= 768);
    };
    handleResize();
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  const indicatorItems: MenuItem[] = [
    { href: "/dashboard", label: "Dashboard Principal", icon: <Home size={16} /> },
  ];

  const sections: MenuSectionConfig[] = useMemo(
    () =>
      menuConfig && menuConfig.length > 0
        ? menuConfig
        : [
            { key: "indicators", title: "📊 Indicadores", items: indicatorItems },
          ],
    [menuConfig]
  );

  const [expandedSections, setExpandedSections] = useState<Record<string, boolean>>(() =>
    Object.fromEntries(sections.map((s) => [s.key, s.key === "indicators" || isMobile]))
  );

  useEffect(() => {
    setExpandedSections((prev) => {
      const next = { ...prev };
      sections.forEach((s) => { if (!(s.key in next)) next[s.key] = isMobile ? true : (s.key === "indicators"); });
      return next;
    });
  }, [sections, isMobile]);

  const toggleSection = (key: string) =>
    setExpandedSections((prev) => ({ ...prev, [key]: !prev[key] }));

  const isActive = (href: string) => location === href;

  // Fechar menu mobile ao trocar de página
  useEffect(() => {
    setMobileMenuOpen(false);
  }, [location]);

  return (
    <div style={{ display: "flex", height: "100vh", overflow: "hidden", background: "#f8fafc", flexDirection: "column" }}>
      
      {/* HEADER MOBILE */}
      {isMobile && (
        <header
          style={{
            display: "flex",
            alignItems: "center",
            padding: "0.625rem 1rem",
            background: "linear-gradient(90deg, #0f172a 0%, #1e293b 100%)",
            color: "white",
            borderBottom: "1px solid #334155",
            boxShadow: "0 2px 8px rgba(0,0,0,0.15)",
            zIndex: 40,
            justifyContent: "space-between"
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            <button
              onClick={() => setMobileMenuOpen(true)}
              style={{
                background: "transparent",
                border: "none",
                color: "white",
                cursor: "pointer",
                padding: "4px",
                display: "flex",
                alignItems: "center"
              }}
            >
              <Menu size={24} />
            </button>
            <span style={{ fontWeight: 800, fontSize: 15, letterSpacing: "-0.025em" }}>Contratos UnB</span>
          </div>
          
          {/* Metadata Compacta no Topo */}
          {!hideUpdateBadge && (
            <div style={{ fontSize: 9, color: "#94a3b8", display: "flex", alignItems: "center", gap: 5 }}>
              <span style={{ width: 6, height: 6, borderRadius: "50%", background: "#10b981" }} />
              <span>{metaData.lastUpdated.split(' ')[0]}</span>
            </div>
          )}
        </header>
      )}

      <div style={{ display: "flex", flex: 1, height: isMobile ? "calc(100vh - 44px)" : "100vh", overflow: "hidden", position: "relative" }}>
        
        {/* OVERLAY MOBILE */}
        {isMobile && mobileMenuOpen && (
          <div
            onClick={() => setMobileMenuOpen(false)}
            style={{
              position: "fixed",
              top: 0,
              left: 0,
              width: "100vw",
              height: "100vh",
              background: "rgba(0,0,0,0.5)",
              zIndex: 90,
              backdropFilter: "blur(2px)",
              transition: "opacity 0.3s ease"
            }}
          />
        )}

        {/* ===== SIDEBAR ===== */}
        <aside
          style={{
            position: isMobile ? "fixed" : "static",
            top: 0,
            left: 0,
            height: isMobile ? "100vh" : "auto",
            zIndex: isMobile ? 100 : 1,
            transform: isMobile ? (mobileMenuOpen ? "translateX(0)" : "translateX(-100%)") : "none",
            width: (isMobile || sidebarOpen) ? "18rem" : "5rem",
            minWidth: (isMobile || sidebarOpen) ? "18rem" : "5rem",
            flexShrink: 0,
            background: "linear-gradient(180deg, #0f172a 0%, #1e293b 100%)",
            color: "white",
            display: "flex",
            flexDirection: "column",
            borderRight: "1px solid #334155",
            boxShadow: "4px 0 16px rgba(0,0,0,0.25)",
            transition: isMobile ? "transform 0.3s ease" : "width 0.3s ease, min-width 0.3s ease",
            overflow: "hidden",
          }}
        >
          {/* Logo */}
          <div
            style={{
              padding: "1rem",
              borderBottom: "1px solid #334155",
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
            }}
          >
            {(isMobile || sidebarOpen) && (
              <div>
                <div style={{ fontWeight: 700, fontSize: 14, color: "white", letterSpacing: "-0.025em" }}>
                  Contratos
                </div>
                <div style={{ fontSize: 10, color: "#94a3b8", marginTop: 2 }}>Dashboard UnB</div>
              </div>
            )}
            
            {/* Botão de Fechar no Mobile ou Toggle no Desktop */}
            <button
              onClick={() => isMobile ? setMobileMenuOpen(false) : setSidebarOpen(!sidebarOpen)}
              style={{
                padding: "0.375rem",
                background: "transparent",
                border: "none",
                color: "#94a3b8",
                cursor: "pointer",
                borderRadius: "0.5rem",
                display: "flex",
                alignItems: "center",
                marginLeft: "auto",
              }}
              onMouseEnter={(e) => (e.currentTarget.style.background = "#334155")}
              onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
            >
              {(isMobile || sidebarOpen) ? <X size={20} /> : <Menu size={20} />}
            </button>
          </div>

          {/* Nav */}
          <nav style={{ flex: 1, padding: "1rem", overflowY: "auto", display: "flex", flexDirection: "column", gap: 4 }}>
            {sections.map((section) => (
              <div key={section.key} style={{ marginBottom: 4 }}>
                <button
                  onClick={() => toggleSection(section.key)}
                  style={{
                    width: "100%",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    padding: "0.625rem 1rem",
                    color: "#cbd5e1",
                    background: "transparent",
                    border: "none",
                    borderRadius: "0.5rem",
                    cursor: "pointer",
                    fontWeight: 600,
                    fontSize: 13,
                    textAlign: "left",
                  }}
                  onMouseEnter={(e) => (e.currentTarget.style.background = "#1e293b")}
                  onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
                >
                  {(isMobile || sidebarOpen) && <span>{section.title}</span>}
                  {(isMobile || sidebarOpen) && (
                    <ChevronDown
                      size={16}
                      style={{ transform: expandedSections[section.key] ? "rotate(0deg)" : "rotate(-90deg)", transition: "transform 0.2s" }}
                    />
                  )}
                </button>

                {(isMobile || sidebarOpen) && expandedSections[section.key] && (
                  <div style={{ marginLeft: 8, display: "flex", flexDirection: "column", gap: 2, marginTop: 4 }}>
                    {section.items.map((item) => {
                      const active = isActive(item.href);
                      const style: React.CSSProperties = {
                        display: "flex",
                        alignItems: "center",
                        gap: 10,
                        padding: "0.5rem 1rem",
                        borderRadius: "0.5rem",
                        textDecoration: "none",
                        fontSize: 13,
                        color: active ? "white" : "#94a3b8",
                        background: active ? "#2563eb" : "transparent",
                        fontWeight: active ? 600 : 400,
                        cursor: "pointer",
                        border: "none",
                        width: "100%",
                        textAlign: "left",
                      };

                      if (item.external) {
                        return (
                          <a key={item.href} href={item.href} style={style}>
                            {item.icon}
                            <span>{item.label}</span>
                          </a>
                        );
                      }
                      return (
                        <Link key={item.href} href={item.href} style={style}>
                          {item.icon}
                          <span>{item.label}</span>
                        </Link>
                      );
                    })}
                  </div>
                )}
              </div>
            ))}
          </nav>

          {/* Footer */}
          <div style={{ padding: "1rem", borderTop: "1px solid #334155" }}>
            <a
              href="/"
              style={{
                display: "flex",
                alignItems: "center",
                gap: 8,
                padding: "0.5rem 1rem",
                color: "#94a3b8",
                textDecoration: "none",
                borderRadius: 8,
                fontSize: 13,
                fontWeight: 500,
              }}
            >
              <Home size={16} />
              {(isMobile || sidebarOpen) && <span>Sair</span>}
            </a>
          </div>
        </aside>

        {/* ===== MAIN CONTENT ===== */}
        <main style={{ flex: 1, overflowY: "auto", overflowX: "hidden", background: "#f8fafc", position: "relative", minWidth: 0 }}>
          
          {/* Badge de atualização no desktop */}
          {!isMobile && !hideUpdateBadge && (
            <div style={{ position: "absolute", top: 16, right: 32, zIndex: 10 }}>
              <div
                title={`Atualizado a partir do arquivo: ${metaData.filename}`}
                style={{
                  fontSize: 11,
                  color: "#64748b",
                  background: "rgba(255,255,255,0.95)",
                  padding: "6px 14px",
                  borderRadius: 9999,
                  border: "1px solid #e2e8f0",
                  boxShadow: "0 1px 3px rgba(0,0,0,0.08)",
                  backdropFilter: "blur(8px)",
                  display: "flex",
                  alignItems: "center",
                  gap: 8,
                  cursor: "help"
                }}
              >
                <span
                  style={{
                    width: 8,
                    height: 8,
                    borderRadius: "50%",
                    background: "#10b981",
                    display: "inline-block",
                    animation: "pulse 2s infinite",
                  }}
                />
                <span style={{ fontWeight: 600 }}>Atualizado:</span>
                {metaData.lastUpdated}
              </div>
            </div>
          )}

          <div style={{ padding: isMobile ? "0.5rem" : "1rem 1.5rem" }}>
            {children}
          </div>
        </main>
      </div>
    </div>
  );
}
