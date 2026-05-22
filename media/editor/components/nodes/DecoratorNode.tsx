import React from "react";
import { Handle, Position } from "@xyflow/react";

interface DecoratorNodeData {
  nodeType?: string;
  config?: Record<string, string | string[]>;
}

export function DecoratorNode({ data }: { data: DecoratorNodeData }) {
  const shortName = data.nodeType
    ? data.nodeType.split("/").filter(Boolean).pop() ?? data.nodeType
    : "(decorator)";

  const entries = Object.entries(data.config ?? {});

  return (
    <div
      style={{
        width: 220,
        height: 36,
        background: "#1a1a1a",
        border: "1px solid #607D8B",
        borderLeft: "4px solid #607D8B",
        borderRadius: "4px 4px 0 0",
        fontFamily: "var(--vscode-font-family)",
        fontSize: 11,
        color: "var(--vscode-editor-foreground, #ccc)",
        boxShadow: "0 2px 8px rgba(0,0,0,0.4)",
        display: "flex",
        alignItems: "center",
        padding: "0 8px",
        gap: 6,
        overflow: "hidden",
        boxSizing: "border-box",
      }}
    >
      <Handle type="target" position={Position.Top} style={{ background: "#607D8B" }} />
      <span
        style={{ color: "#607D8B", fontWeight: 600, flexShrink: 0, maxWidth: 100, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}
        title={data.nodeType}
      >
        {shortName}
      </span>
      <span style={{ display: "flex", gap: 3, flexWrap: "nowrap", overflow: "hidden" }}>
        {entries.slice(0, 2).map(([k, v]) => (
          <span
            key={k}
            title={`${k} = ${Array.isArray(v) ? v.join(", ") : v}`}
            style={{
              background: "rgba(96,125,139,0.3)",
              border: "1px solid #607D8B",
              borderRadius: 3,
              padding: "0 4px",
              fontSize: 9,
              whiteSpace: "nowrap",
            }}
          >
            {k}={Array.isArray(v) ? `[${v.length}]` : shortVal(v)}
          </span>
        ))}
        {entries.length > 2 && (
          <span style={{ fontSize: 9, opacity: 0.6 }}>+{entries.length - 2}</span>
        )}
      </span>
      <Handle type="source" position={Position.Bottom} style={{ background: "#607D8B" }} />
    </div>
  );
}

function shortVal(v: string): string {
  // Just show last segment or last 8 chars
  const parts = v.split("_");
  return parts[parts.length - 1].slice(0, 8);
}
