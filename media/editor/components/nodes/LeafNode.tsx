import React from "react";
import { Handle, Position } from "@xyflow/react";
import { ChildOrderBadge } from "./ChildOrderBadge";
import { useTypeVars, useResolveBinding } from "../../contexts/TypeVarsContext";
import { shortTypePath } from "../../utils/typeDisplay";

interface LeafNodeData {
  behaviorType?: string;
  args?: string[];
  vars?: Record<string, string>;
  childIndex?: number | null;
}

export function LeafNode({ data }: { data: LeafNodeData }) {
  const typeVars = useTypeVars();
  const resolveBinding = useResolveBinding();
  const short = data.behaviorType ? shortTypePath(data.behaviorType) : "(leaf)";

  const entryParams = typeVars?.[data.behaviorType ?? ""]?.params ?? [];
  const entryVars = typeVars?.[data.behaviorType ?? ""]?.vars ?? [];
  const args = data.args ?? [];
  const vars = data.vars ?? {};

  type Row = { name: string; value: string; isDefault: boolean };
  const rows: Row[] = [];

  if (entryParams.length > 0 || entryVars.length > 0) {
    for (let i = 0; i < entryParams.length; i++) {
      const arg = args[i];
      const def = entryParams[i].defaultValue;
      if (arg !== undefined) {
        rows.push({ name: entryParams[i].name, value: lastSegment(resolveBinding(arg)), isDefault: false });
      } else if (def !== "null") {
        rows.push({ name: entryParams[i].name, value: def, isDefault: true });
      }
    }
    for (const v of entryVars) {
      const val = vars[v.name];
      if (val !== undefined) {
        rows.push({ name: v.name, value: lastSegment(resolveBinding(val)), isDefault: false });
      } else if (v.defaultValue !== "null") {
        rows.push({ name: v.name, value: v.defaultValue, isDefault: true });
      }
    }
  } else {
    for (let i = 0; i < args.length; i++) {
      rows.push({ name: `arg${i + 1}`, value: lastSegment(resolveBinding(args[i])), isDefault: false });
    }
  }

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
        {rows.map((row, i) => (
          <div key={i} style={{ fontSize: 10, lineHeight: "18px", display: "flex", gap: 3 }}>
            <span style={{ color: "#aaa", flexShrink: 0 }}>{row.name}</span>
            <span style={{ color: "#666" }}>=</span>
            <span
              style={{
                color: row.isDefault ? "#666" : "#e0e0e0",
                fontStyle: row.isDefault ? "italic" : "normal",
                overflow: "hidden",
                textOverflow: "ellipsis",
                whiteSpace: "nowrap",
              }}
            >
              {row.value}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

function lastSegment(v: string): string {
  const trimmed = v.trim();
  const parts = trimmed.split("/").filter(Boolean);
  return parts.length > 1 ? parts[parts.length - 1] : trimmed;
}
