import React from 'react';

interface FonteBadgeProps {
  fonte: string;
  size?: "xs" | "sm" | "md" | "lg";
}

export function FonteBadge({ fonte, size = "md" }: FonteBadgeProps) {
  const fs = size === "xs" ? 8 : size === "sm" ? 9 : size === "md" ? 11 : 13;
  const px = size === "xs" ? 4 : size === "sm" ? 6 : size === "md" ? 8 : 10;
  const py = size === "xs" ? 1 : size === "sm" ? 2 : size === "md" ? 3 : 4;
  const ml = size === "lg" ? 10 : size === "xs" ? 4 : 6;

  const baseStyle: React.CSSProperties = {
    padding: `${py}px ${px}px`,
    borderRadius: 6,
    fontSize: fs,
    fontWeight: 800,
    letterSpacing: "0.05em",
    verticalAlign: "middle",
    marginLeft: ml,
    display: "inline-flex",
    alignItems: "center",
    whiteSpace: "nowrap",
  };

  if (fonte === "TED") {
    return (
      <span style={{ ...baseStyle, background: "#eff6ff", color: "#2563eb", border: "1px solid #bfdbfe" }}>
        TED
      </span>
    );
  }
  if (fonte === "Emenda") {
    return (
      <span style={{ ...baseStyle, background: "#fdf4ff", color: "#c026d3", border: "1px solid #f5d0fe" }}>
        EMENDA
      </span>
    );
  }
  
  // "all"
  return (
    <span style={{ ...baseStyle, background: "#f8fafc", color: "#475569", border: "1px solid #e2e8f0" }}>
      TED <span style={{ color: "#8b5cf6", margin: "0 4px", fontSize: "1.1em" }}>+</span> EMENDA
    </span>
  );
}
