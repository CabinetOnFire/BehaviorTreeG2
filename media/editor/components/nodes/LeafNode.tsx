import React from "react";
import { Handle, Position } from "@xyflow/react";

interface LeafNodeData {
  behaviorType?: string;
  args?: string[];
}

export function LeafNode({ data }: { data: LeafNodeData }) {
  const short = data.behaviorType
    ? data.behaviorType.split("/").filter(Boolean).pop() ?? data.behaviorType
    : "(leaf)";

  return (
    <div
      style={{
        width: 220,
        background: "#2a1e00",
        border: "1px solid #FF9800",
        borderLeft: "4px solid #FF9800",
        borderRadius: 4,
        fontFamily: "var(--vscode-font-family)",
        fontSize: 12,
        color: "var(--vscode-editor-foreground, #ccc)",
        boxShadow: "0 2px 8px rgba(0,0,0,0.4)",
      }}
    >
      <Handle type="target" position={Position.Top} style={{ background: "#FF9800" }} />
      <div style={{ padding: "6px 10px" }}>
        <div style={{ fontWeight: 600, color: "#FF9800", wordBreak: "break-all" }}>{short}</div>
        {data.args && data.args.length > 0 && (
          <div style={{ marginTop: 3, fontSize: 10, opacity: 0.75, wordBreak: "break-all" }}>
            {data.args.join(", ")}
          </div>
        )}
      </div>
      {/* Leaf nodes have no children so no source handle needed, but we add one for drag-connect */}
    </div>
  );
}
