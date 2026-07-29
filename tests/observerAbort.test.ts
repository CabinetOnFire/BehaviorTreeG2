import type { Edge, Node } from "@xyflow/react";
import { BT_ABORT_BOTH, BT_ABORT_LOWER_PRIORITY, BT_ABORT_SELF } from "../shared/btConstants";
import { observerAbortTargets } from "../media/editor/utils/observerAbort";

function node(id: string, kind: string, childIndex?: number, vars: Record<string, string> = {}): Node {
  const btNode = kind === "decorator"
    ? { kind, nodeType: "/datum/bt_node/decorator/observer", vars }
    : kind === "selector"
      ? { kind, children: [] }
      : { kind: "leaf", behaviorType: "/datum/bt_node/ai_behavior/test", vars: {} };
  return { id, position: { x: 0, y: 0 }, data: { _btNode: btNode, childIndex } };
}

const edges: Edge[] = [
  { id: "e0", source: "selector", target: "decorator" },
  { id: "e1", source: "decorator", target: "self-child" },
  { id: "e2", source: "selector", target: "lower" },
  { id: "e3", source: "lower", target: "lower-child" },
];

const baseNodes = [
  node("selector", "selector"),
  node("decorator", "decorator", 0),
  node("self-child", "leaf"),
  node("lower", "leaf", 1),
  node("lower-child", "leaf"),
];

describe("observerAbortTargets", () => {
  it("highlights the decorator branch for self aborts", () => {
    const nodes = baseNodes.map((n) => n.id === "decorator"
      ? node("decorator", "decorator", 0, { observer_abort: BT_ABORT_SELF })
      : n);
    const targets = observerAbortTargets(nodes, edges, "decorator", null, undefined);
    expect(targets.mode).toBe("self");
    expect([...targets.self]).toEqual(["decorator", "self-child"]);
    expect(targets.lowerPriority).toEqual(new Set());
  });

  it("highlights later selector branches for lower-priority aborts", () => {
    const nodes = baseNodes.map((n) => n.id === "decorator"
      ? node("decorator", "decorator", 0, { observer_abort: BT_ABORT_LOWER_PRIORITY })
      : n);
    const targets = observerAbortTargets(nodes, edges, "decorator", null, undefined);
    expect(targets.mode).toBe("lower");
    expect(targets.self).toEqual(new Set());
    expect([...targets.lowerPriority]).toEqual(["lower", "lower-child"]);
  });

  it("uses the scanned default and active binding when the decorator does not override it", () => {
    const typeVars = {
      "/datum/bt_node/decorator/observer": {
        params: [],
        vars: [{ name: "observer_abort", defaultValue: "$abort_mode" }],
      },
    };
    const targets = observerAbortTargets(
      baseNodes,
      edges,
      "decorator",
      typeVars,
      { abort_mode: { label: "Abort mode", default: BT_ABORT_BOTH } },
    );
    expect(targets.mode).toBe("both");
    expect([...targets.self]).toEqual(["decorator", "self-child"]);
    expect([...targets.lowerPriority]).toEqual(["lower", "lower-child"]);
  });
});
