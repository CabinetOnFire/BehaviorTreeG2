import React from "react";
import { Handle, Position } from "@xyflow/react";
import { ChildOrderBadge } from "./ChildOrderBadge";
import { useTypeVars, useResolveBinding } from "../../contexts/TypeVarsContext";
import { shortTypePath } from "../../utils/typeDisplay";

interface DecoratorNodeData {
  nodeType?: string;
  vars?: Record<string, string | string[]>;
  childIndex?: number | null;
}

export function DecoratorNode({ data }: { data: DecoratorNodeData }) {
  const typeVars = useTypeVars();
  const resolveBinding = useResolveBinding();
  const shortName = data.nodeType ? shortTypePath(data.nodeType) : "(decorator)";
  const params = typeVars?.[data.nodeType ?? ""]?.vars ?? [];
  const config = data.vars ?? {};

  type Row = { key: string; value: string; isDefault: boolean };
  const rows: Row[] = [];

  if (params.length > 0) {
    for (const p of params) {
      const val = config[p.name];
      if (val !== undefined) {
        rows.push({ key: p.name, value: Array.isArray(val) ? `[${val.length}]` : lastSegment(resolveBinding(val)), isDefault: false });
      } else if (p.defaultValue !== "null") {
        rows.push({ key: p.name, value: p.defaultValue, isDefault: true });
      }
    }
  } else {
    for (const [k, v] of Object.entries(config)) {
      rows.push({ key: k, value: Array.isArray(v) ? `[${v.length}]` : lastSegment(resolveBinding(v)), isDefault: false });
    }
  }

  return (
    <div
      style={{
        position: "relative",
        width: 220,
        background: "#1a1a1a",
        border: "1px solid #607D8B",
        borderLeft: "4px solid #607D8B",
        borderRadius: "4px 4px 0 0",
        fontFamily: "var(--vscode-font-family)",
        fontSize: 11,
        color: "var(--vscode-editor-foreground, #ccc)",
        boxShadow: "0 2px 8px rgba(0,0,0,0.4)",
        boxSizing: "border-box",
      }}
    >
      <Handle type="target" position={Position.Top} style={{ background: "#607D8B" }} />
      <ChildOrderBadge index={data.childIndex} />
      <div style={{ padding: "6px 10px 6px 10px" }}>
        <div
          style={{
            fontWeight: 700,
            color: "#607D8B",
            fontSize: 11,
            overflow: "hidden",
            textOverflow: "ellipsis",
            whiteSpace: "nowrap",
            marginBottom: rows.length > 0 ? 3 : 0,
            display: "flex",
            alignItems: "center",
            gap: 4,
          }}
          title={data.nodeType}
        >
          {config.invert === "TRUE" && (
            <span style={{ color: "#f44336", flexShrink: 0 }}>!</span>
          )}
          {shortName}
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
      <Handle type="source" position={Position.Bottom} style={{ background: "#607D8B" }} />
    </div>
  );
}

function lastSegment(v: string): string {
  const trimmed = v.trim();
  const parts = trimmed.split("/").filter(Boolean);
  return parts.length > 1 ? parts[parts.length - 1] : trimmed;
}
