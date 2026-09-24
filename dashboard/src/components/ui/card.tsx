import * as React from "react"

// Card - componentes simples com estilos inline para garantir visual correto
const Card = React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(
  ({ className, style, ...props }, ref) => (
    <div
      ref={ref}
      style={{
        borderRadius: "0.5rem",
        border: "1px solid #e2e8f0",
        background: "white",
        boxShadow: "0 1px 3px rgba(0,0,0,0.06)",
        ...style,
      }}
      className={className}
      {...props}
    />
  )
)
Card.displayName = "Card"

const CardHeader = React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(
  ({ style, ...props }, ref) => (
    <div
      ref={ref}
      style={{ display: "flex", flexDirection: "column", padding: "0.25rem 0.75rem", ...style }}
      {...props}
    />
  )
)
CardHeader.displayName = "CardHeader"

const CardTitle = React.forwardRef<HTMLParagraphElement, React.HTMLAttributes<HTMLHeadingElement>>(
  ({ style, ...props }, ref) => (
    <h3
      ref={ref}
      style={{ fontSize: "0.65rem", fontWeight: 600, color: "#64748b", letterSpacing: "0.06em", textTransform: "uppercase", ...style }}
      {...props}
    />
  )
)
CardTitle.displayName = "CardTitle"

const CardDescription = React.forwardRef<HTMLParagraphElement, React.HTMLAttributes<HTMLParagraphElement>>(
  ({ style, ...props }, ref) => (
    <p ref={ref} style={{ fontSize: "0.75rem", color: "#94a3b8", ...style }} {...props} />
  )
)
CardDescription.displayName = "CardDescription"

const CardContent = React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(
  ({ style, ...props }, ref) => (
    <div ref={ref} style={{ padding: "0 0.75rem 0.75rem 0.75rem", paddingTop: 0, ...style }} {...props} />
  )
)
CardContent.displayName = "CardContent"

const CardFooter = React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(
  ({ style, ...props }, ref) => (
    <div ref={ref} style={{ display: "flex", alignItems: "center", padding: "0 1.5rem 1.5rem", ...style }} {...props} />
  )
)
CardFooter.displayName = "CardFooter"

export { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter }
