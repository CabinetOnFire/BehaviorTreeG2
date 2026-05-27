import React from "react";
import { Handle, Position } from "@xyflow/react";

export function RootNode() {
  return (
    <div
      style={{
        width: 80,
        background: "#1e1e1e",
        border: "2px dashed #666",
        borderRadius: 14,
        fontFamily: "var(--vscode-font-family)",
        fontSize: 11,
        color: "#888",
        textAlign: "center",
        padding: "5px 0",
        userSelect: "none",
      }}
    >
      Root
      <Handle
        type="source"
        position={Position.Bottom}
        style={{ background: "#666" }}
      />
    </div>
  );
}
