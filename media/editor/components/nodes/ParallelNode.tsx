import React from "react";
import { Handle, Position } from "@xyflow/react";
import { ChildOrderBadge } from "./ChildOrderBadge";

interface ParallelNodeData {
  failurePolicy?: string;
  successPolicy?: string;
  repeatSecondary?: boolean;
  finishOnPrimary?: boolean;
  childIndex?: number | null;
}

const POLICY_LABELS: Record<string, string> = {
  BT_PARALLEL_FAILURE_CHILD_ONE: "Child 1 fails",
  BT_PARALLEL_FAILURE_ANY: "Any child fails",
  BT_PARALLEL_SUCCESS_CHILD_ONE: "Child 1 succeeds",
  BT_PARALLEL_SUCCESS_ALL: "All children succeed",
};

export function ParallelNode({ data }: { data: ParallelNodeData }) {
  const failLabel = data.failurePolicy ? (POLICY_LABELS[data.failurePolicy] ?? data.failurePolicy) : "—";
  const okLabel = data.successPolicy ? (POLICY_LABELS[data.successPolicy] ?? data.successPolicy) : "—";

  return (
    <div
      style={{
        position: "relative",
        width: 220,
        background: "#2a1a3a",
        border: "1px solid #9C27B0",
        borderLeft: "4px solid #9C27B0",
        borderRadius: 4,
        fontFamily: "var(--vscode-font-family)",
        fontSize: 12,
        color: "var(--vscode-editor-foreground, #ccc)",
        boxShadow: "0 2px 8px rgba(0,0,0,0.4)",
        boxSizing: "border-box",
      }}
    >
      <Handle type="target" position={Position.Top} style={{ background: "#9C27B0" }} />
      <ChildOrderBadge index={data.childIndex} />
      <div style={{ padding: "6px 10px 6px 10px" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 5 }}>
          <span style={{ fontSize: 16, color: "#9C27B0", fontWeight: "bold", lineHeight: 1 }}>⇉</span>
          <span style={{ fontWeight: 700, fontSize: 12 }}>Parallel</span>
        </div>
        <Row label="fail" value={failLabel} />
        <Row label="ok" value={okLabel} />
        <Row label="repeat 2nd" value={data.repeatSecondary ? "yes" : "no"} />
        <Row label="finish 1st" value={data.finishOnPrimary ? "yes" : "no"} />
      </div>
      <Handle type="source" position={Position.Bottom} style={{ background: "#9C27B0" }} />
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
