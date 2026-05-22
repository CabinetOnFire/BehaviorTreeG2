import React from "react";
import { Handle, Position } from "@xyflow/react";

export function SequenceNode({ data }: { data: Record<string, unknown> }) {
  return (
    <div
      style={{
        width: 220,
        background: "#1a2a3a",
        border: "1px solid #2196F3",
        borderLeft: "4px solid #2196F3",
        borderRadius: 4,
        fontFamily: "var(--vscode-font-family)",
        fontSize: 12,
        color: "var(--vscode-editor-foreground, #ccc)",
        boxShadow: "0 2px 8px rgba(0,0,0,0.4)",
      }}
    >
      <Handle type="target" position={Position.Top} style={{ background: "#2196F3" }} />
      <div style={{ padding: "6px 10px", display: "flex", alignItems: "center", gap: 6 }}>
        <span style={{ fontSize: 16, color: "#2196F3", fontWeight: "bold" }}>→</span>
        <span style={{ fontWeight: 600 }}>Sequence</span>
      </div>
      <Handle type="source" position={Position.Bottom} style={{ background: "#2196F3" }} />
    </div>
  );
}
