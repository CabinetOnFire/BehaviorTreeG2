import React from "react";

interface Props {
  index: number | null | undefined;
}

export function ChildOrderBadge({ index }: Props) {
  if (index == null) return null;
  return (
    <div
      style={{
        position: "absolute",
        top: 4,
        right: 6,
        fontSize: 10,
        fontWeight: 700,
        color: "rgba(200,200,200,0.5)",
        lineHeight: 1,
        pointerEvents: "none",
        userSelect: "none",
      }}
    >
      {index + 1}
    </div>
  );
}
