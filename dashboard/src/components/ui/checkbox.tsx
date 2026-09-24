import * as React from "react";
import * as CheckboxPrimitive from "@radix-ui/react-checkbox";
import { CheckIcon } from "lucide-react";

function Checkbox({
  className,
  checked,
  style,
  ...props
}: React.ComponentProps<typeof CheckboxPrimitive.Root>) {
  const isChecked = checked === true || checked === "checked";

  return (
    <CheckboxPrimitive.Root
      data-slot="checkbox"
      checked={checked}
      style={{
        width: 16,
        height: 16,
        minWidth: 16,
        borderRadius: 4,
        border: isChecked ? "2px solid #2563eb" : "2px solid #9ca3af",
        background: isChecked ? "#2563eb" : "white",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        flexShrink: 0,
        cursor: "pointer",
        transition: "all 0.15s ease",
        outline: "none",
        ...style,
      }}
      className={className}
      {...props}
    >
      <CheckboxPrimitive.Indicator forceMount style={{ display: "flex", alignItems: "center", justifyContent: "center" }}>
        <CheckIcon
          style={{
            width: 11,
            height: 11,
            color: isChecked ? "white" : "transparent",
            strokeWidth: 3,
            transition: "color 0.1s ease",
          }}
        />
      </CheckboxPrimitive.Indicator>
    </CheckboxPrimitive.Root>
  );
}

export { Checkbox };
