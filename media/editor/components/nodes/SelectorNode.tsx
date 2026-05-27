import React from "react";
import { Handle, Position } from "@xyflow/react";
import { ChildOrderBadge } from "./ChildOrderBadge";

interface SelectorNodeData {
  label?: string;
  childIndex?: number | null;
}

export function SelectorNode({ data }: { data: SelectorNodeData }) {
  return (
    <div
      style={{
        position: "relative",
        width: 220,
        background: "#1e3a1e",
        border: "1px solid #4CAF50",
        borderLeft: "4px solid #4CAF50",
        borderRadius: 4,
        fontFamily: "var(--vscode-font-family)",
        fontSize: 12,
        color: "var(--vscode-editor-foreground, #ccc)",
        boxShadow: "0 2px 8px rgba(0,0,0,0.4)",
      }}
    >
      <Handle type="target" position={Position.Top} style={{ background: "#4CAF50" }} />
      <ChildOrderBadge index={data.childIndex} />
      <div style={{ padding: "6px 10px", display: "flex", alignItems: "center", gap: 6 }}>
        <span style={{ fontSize: 16, color: "#4CAF50", fontWeight: "bold" }}>?</span>
        <span style={{ fontWeight: 700 }}>Selector</span>
      </div>
      <Handle type="source" position={Position.Bottom} style={{ background: "#4CAF50" }} />
    </div>
  );
}
