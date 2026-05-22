import React from "react";
import { Handle, Position } from "@xyflow/react";

interface ParallelNodeData {
  failurePolicy?: string;
  successPolicy?: string;
}

export function ParallelNode({ data }: { data: ParallelNodeData }) {
  return (
    <div
      style={{
        width: 220,
        background: "#2a1a3a",
        border: "1px solid #9C27B0",
        borderLeft: "4px solid #9C27B0",
        borderRadius: 4,
        fontFamily: "var(--vscode-font-family)",
        fontSize: 12,
        color: "var(--vscode-editor-foreground, #ccc)",
        boxShadow: "0 2px 8px rgba(0,0,0,0.4)",
      }}
    >
      <Handle type="target" position={Position.Top} style={{ background: "#9C27B0" }} />
      <div style={{ padding: "6px 10px" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
          <span style={{ fontSize: 16, color: "#9C27B0", fontWeight: "bold" }}>⇉</span>
          <span style={{ fontWeight: 600 }}>Parallel</span>
        </div>
        <div style={{ display: "flex", gap: 4, marginTop: 4, flexWrap: "wrap" }}>
          {data.failurePolicy && (
            <span
              style={{
                background: "rgba(156,39,176,0.3)",
                border: "1px solid #9C27B0",
                borderRadius: 3,
                padding: "1px 5px",
                fontSize: 10,
              }}
            >
              fail: {shortPolicy(data.failurePolicy)}
            </span>
          )}
          {data.successPolicy && data.successPolicy !== "BT_PARALLEL_SUCCESS_ALL" && (
            <span
              style={{
                background: "rgba(156,39,176,0.3)",
                border: "1px solid #9C27B0",
                borderRadius: 3,
                padding: "1px 5px",
                fontSize: 10,
              }}
            >
              ok: {shortPolicy(data.successPolicy)}
            </span>
          )}
        </div>
      </div>
      <Handle type="source" position={Position.Bottom} style={{ background: "#9C27B0" }} />
    </div>
  );
}

function shortPolicy(p: string): string {
  if (p.includes("ONE")) return "ONE";
  if (p.includes("ALL")) return "ALL";
  return p;
}
