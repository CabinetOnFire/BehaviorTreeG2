import React from "react";
import { Handle, Position } from "@xyflow/react";
import { ChildOrderBadge } from "./ChildOrderBadge";
import { useTypeVars, useResolveBinding } from "../../contexts/TypeVarsContext";
import { shortTypePath } from "../../utils/typeDisplay";
import { rowsFor } from "../../utils/nodeRows";

interface LeafNodeData {
  behaviorType?: string;
  vars?: Record<string, string | string[]>;
  childIndex?: number | null;
}

export function LeafNode({ data }: { data: LeafNodeData }) {
  const typeVars = useTypeVars();
  const resolveBinding = useResolveBinding();
  const short = data.behaviorType ? shortTypePath(resolveBinding(data.behaviorType)) : "(leaf)";
  const varDecls = typeVars?.[data.behaviorType ?? ""]?.vars ?? [];
  const config = data.vars ?? {};
  const rows = rowsFor(config, varDecls, resolveBinding);

  return (
    <div
      style={{
        position: "relative",
        width: 220,
        background: "#2a1e00",
        border: "1px solid #FF9800",
        borderLeft: "4px solid #FF9800",
        borderRadius: 4,
        fontFamily: "var(--vscode-font-family)",
        fontSize: 12,
        color: "var(--vscode-editor-foreground, #ccc)",
        boxShadow: "0 2px 8px rgba(0,0,0,0.4)",
        boxSizing: "border-box",
      }}
    >
      <Handle type="target" position={Position.Top} style={{ background: "#FF9800" }} />
      <ChildOrderBadge index={data.childIndex} />
      <div style={{ padding: "6px 10px 6px 10px" }}>
        <div
          style={{
            fontWeight: 700,
            color: "#FF9800",
            fontSize: 12,
            wordBreak: "break-all",
            marginBottom: rows.length > 0 ? 4 : 0,
          }}
        >
          {short}
        </div>
        {rows.map((row) => (
          <div key={row.key} style={{ fontSize: 10, lineHeight: "18px", display: "flex", gap: 3 }}>
            <span style={{ color: "#aaa", flexShrink: 0 }}>{row.key}</span>
            <span style={{ color: "#666" }}>=</span>
            <span
              style={{
                color: row.isDefault ? "#666" : "#e0e0e0",
                fontStyle: row.isDefault ? "italic" : "normal",
                overflow: "hidden",
                textOverflow: "ellipsis",
                whiteSpace: "nowrap",
              }}
              title={row.value}
            >
              {row.value}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
