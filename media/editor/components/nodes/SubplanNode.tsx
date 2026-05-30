import React from "react";
import { Handle, Position } from "@xyflow/react";
import { ChildOrderBadge } from "./ChildOrderBadge";
import { BT_LABELS } from "../../../../shared/btConstants";
import { COMPOSITE_SCHEMAS } from "../../../../shared/compositeSchema";

const SCHEMA = COMPOSITE_SCHEMAS["subplan"]!;

interface SubplanNodeData extends Record<string, unknown> {
  childIndex?: number | null;
}

export function SubplanNode({ data }: { data: SubplanNodeData }) {
  return (
    <div
      style={{
        position: "relative",
        width: 220,
        background: "#2a1e00",
        border: "1px solid #FFB300",
        borderLeft: "4px solid #FFB300",
        borderRadius: 4,
        fontFamily: "var(--vscode-font-family)",
        fontSize: 12,
        color: "var(--vscode-editor-foreground, #ccc)",
        boxShadow: "0 2px 8px rgba(0,0,0,0.4)",
        boxSizing: "border-box",
      }}
    >
      <Handle type="target" position={Position.Top} style={{ background: "#FFB300" }} />
      <ChildOrderBadge index={data.childIndex} />
      <div style={{ padding: "6px 10px 6px 10px" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 5 }}>
          <span style={{ fontSize: 16, color: "#FFB300", fontWeight: "bold", lineHeight: 1 }}>
            ↺
          </span>
          <span style={{ fontWeight: 700, fontSize: 12 }}>Subplan</span>
        </div>
        {SCHEMA.map((prop) => {
          const raw = data[prop.key];
          // Optional text fields: skip if not set
          if (prop.type === "text" && (raw == null || raw === "")) return null;
          let display: string;
          if (prop.type === "enum") {
            display = raw != null ? (BT_LABELS[raw as string] ?? String(raw)) : "—";
          } else if (prop.type === "boolean") {
            display = raw != null ? (raw ? "yes" : "no") : "—";
          } else {
            display = String(raw);
          }
          return <Row key={prop.key} label={prop.label} value={display} />;
        })}
      </div>
      <Handle type="source" position={Position.Bottom} style={{ background: "#FFB300" }} />
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div style={{ fontSize: 10, lineHeight: "18px", display: "flex", gap: 3 }}>
      <span style={{ color: "#aaa", flexShrink: 0 }}>{label}:</span>
      <span style={{ color: "#e0e0e0" }}>{value}</span>
    </div>
  );
}
