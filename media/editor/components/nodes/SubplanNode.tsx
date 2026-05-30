import React from "react";
import { Handle, Position } from "@xyflow/react";
import { ChildOrderBadge } from "./ChildOrderBadge";

interface SubplanNodeData {
  successPolicy?: string;
  failurePolicy?: string;
  childIndex?: number | null;
}

const POLICY_LABELS: Record<string, string> = {
  BT_SUBPLAN_SUCCEED_ON_SUCCESS: "Succeed on success",
  BT_SUBPLAN_LOOP_ON_SUCCESS: "Loop on success",
  BT_SUBPLAN_FAIL_ON_FAILURE: "Fail on failure",
  BT_SUBPLAN_LOOP_ON_FAILURE: "Loop on failure",
};

export function SubplanNode({ data }: { data: SubplanNodeData }) {
  const okLabel = data.successPolicy
    ? (POLICY_LABELS[data.successPolicy] ?? data.successPolicy)
    : "—";
  const failLabel = data.failurePolicy
    ? (POLICY_LABELS[data.failurePolicy] ?? data.failurePolicy)
    : "—";

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
        <Row label="ok" value={okLabel} />
        <Row label="fail" value={failLabel} />
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
