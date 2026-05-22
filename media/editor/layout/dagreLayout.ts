import dagre from "@dagrejs/dagre";
import type { Node, Edge } from "@xyflow/react";
import type { BtNode } from "../../../shared/types";

interface LayoutResult {
  nodes: Node[];
  edges: Edge[];
}

let nodeCounter = 0;

function nextId(): string {
  return `n${nodeCounter++}`;
}

interface LayoutNode {
  id: string;
  btNode: BtNode;
  parentId: string | null;
  isDecoratorChild: boolean; // direct child of a decorator (for tight ranksep)
}

function collectNodes(
  btNode: BtNode,
  parentId: string | null,
  isDecoratorChild: boolean,
  out: LayoutNode[],
  edges: { source: string; target: string; isDecorator: boolean }[],
): string {
  const id = nextId();
  out.push({ id, btNode, parentId, isDecoratorChild });

  if (parentId !== null) {
    edges.push({ source: parentId, target: id, isDecorator: isDecoratorChild });
  }

  switch (btNode.kind) {
    case "selector":
    case "sequence":
      for (const child of btNode.children) {
        collectNodes(child, id, false, out, edges);
      }
      break;
    case "parallel":
      for (const child of btNode.children) {
        collectNodes(child, id, false, out, edges);
      }
      break;
    case "leaf":
      break;
    case "subtree":
      break;
    case "decorator":
      collectNodes(btNode.child, id, true, out, edges);
      break;
  }

  return id;
}

function nodeSize(btNode: BtNode): { width: number; height: number } {
  if (btNode.kind === "decorator") return { width: 220, height: 36 };
  if (btNode.kind === "leaf" || btNode.kind === "subtree") return { width: 220, height: 52 };
  return { width: 220, height: 48 };
}

function nodeType(btNode: BtNode): string {
  switch (btNode.kind) {
    case "selector": return "selectorNode";
    case "sequence": return "sequenceNode";
    case "parallel": return "parallelNode";
    case "leaf": return "leafNode";
    case "subtree": return "subtreeNode";
    case "decorator": return "decoratorNode";
  }
}

function nodeData(btNode: BtNode): Record<string, unknown> {
  switch (btNode.kind) {
    case "selector":
    case "sequence":
      return {};
    case "parallel":
      return { failurePolicy: btNode.failurePolicy, successPolicy: btNode.successPolicy };
    case "leaf":
      return { behaviorType: btNode.behaviorType, args: btNode.args };
    case "subtree":
      return { behaviorType: btNode.behaviorType };
    case "decorator":
      return { nodeType: btNode.nodeType, config: btNode.config };
  }
}

export function buildLayout(root: BtNode): LayoutResult {
  nodeCounter = 0;

  const layoutNodes: LayoutNode[] = [];
  const rawEdges: { source: string; target: string; isDecorator: boolean }[] = [];

  collectNodes(root, null, false, layoutNodes, rawEdges);

  // Build dagre graph
  const g = new dagre.graphlib.Graph();
  g.setDefaultEdgeLabel(() => ({}));
  g.setGraph({ rankdir: "TB", ranksep: 50, nodesep: 60 });

  for (const ln of layoutNodes) {
    const size = nodeSize(ln.btNode);
    g.setNode(ln.id, { width: size.width, height: size.height });
  }

  for (const e of rawEdges) {
    // Decorator → child: tighter ranksep (dagre edge weight doesn't change ranksep,
    // but we can use minlen=1 and rely on the tight default for close nodes)
    g.setEdge(e.source, e.target, e.isDecorator ? { minlen: 1 } : { minlen: 2 });
  }

  dagre.layout(g);

  const nodes: Node[] = layoutNodes.map((ln) => {
    const pos = g.node(ln.id);
    const size = nodeSize(ln.btNode);
    return {
      id: ln.id,
      type: nodeType(ln.btNode),
      position: { x: pos.x - size.width / 2, y: pos.y - size.height / 2 },
      data: { ...nodeData(ln.btNode), _btNode: ln.btNode },
      style: { width: size.width },
    };
  });

  const edges: Edge[] = rawEdges.map((e, i) => ({
    id: `e${i}`,
    source: e.source,
    target: e.target,
    type: e.isDecorator ? "straight" : "smoothstep",
    style: e.isDecorator
      ? { stroke: "#607D8B", strokeWidth: 3 }
      : { stroke: "#555", strokeWidth: 1.5 },
    markerEnd: e.isDecorator ? undefined : { type: "arrowclosed" as const },
  }));

  return { nodes, edges };
}
