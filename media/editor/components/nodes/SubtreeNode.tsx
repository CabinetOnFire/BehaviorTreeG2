import React from "react";
import { Handle, Position, type NodeProps } from "@xyflow/react";
import type { BtNode } from "../../../../shared/types";
import { ChildOrderBadge } from "./ChildOrderBadge";
import { shortTypePath } from "../../utils/typeDisplay";

interface SubtreeNodeData {
  label: string;
  _btNode: Extract<BtNode, { kind: "subtree" }>;
  selected: boolean;
  childIndex?: number | null;
  [key: string]: unknown;
}

export function SubtreeNode({ data, selected }: NodeProps) {
  const d = data as SubtreeNodeData;
  const bt = d._btNode;
  const lastSegment = shortTypePath(bt.behaviorType);

  const accent = "#26C6DA";
  const bg = selected ? "#003740" : "#00292d";

  return (
    <div
      style={{
        position: "relative",
        background: bg,
        border: `1px solid ${selected ? accent : "#335"}`,
        borderLeft: `4px solid ${accent}`,
        borderRadius: 6,
        width: 220,
        height: 52,
        display: "flex",
        alignItems: "center",
        gap: 8,
        padding: "0 12px",
        boxSizing: "border-box",
        cursor: "pointer",
        transition: "background 0.1s",
      }}
    >
      <Handle type="target" position={Position.Top} style={{ background: accent }} />
      <ChildOrderBadge index={d.childIndex} />
      <span style={{ fontSize: 18, lineHeight: 1, color: accent }}>⤵</span>
      <div style={{ flex: 1, overflow: "hidden" }}>
        <div
          style={{
            color: "#e0e0e0",
            fontSize: 11,
            fontWeight: 600,
            letterSpacing: "0.04em",
            opacity: 0.7,
            textTransform: "uppercase",
          }}
        >
          Subtree Ref
        </div>
        <div
          style={{
            color: accent,
            fontSize: 12,
            fontWeight: 500,
            overflow: "hidden",
            textOverflow: "ellipsis",
            whiteSpace: "nowrap",
          }}
          title={bt.behaviorType}
        >
          {lastSegment}
        </div>
        {bt.overrideId && (
          <div
            style={{
              color: "#e0e0e0",
              fontSize: 10,
              opacity: 0.6,
              overflow: "hidden",
              textOverflow: "ellipsis",
              whiteSpace: "nowrap",
              fontFamily: "monospace",
            }}
            title={`override_id: ${bt.overrideId}`}
          >
            id: {bt.overrideId}
          </div>
        )}
      </div>
    </div>
  );
}
