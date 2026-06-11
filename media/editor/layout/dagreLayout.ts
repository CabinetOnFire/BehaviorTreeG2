import dagre from "@dagrejs/dagre";
import type { Node, Edge } from "@xyflow/react";
import type { BtNode } from "../../../shared/types";
import { COMPOSITE_SCHEMAS } from "../../../shared/compositeSchema";

export const ROOT_NODE_ID = "__root__";
const ROOT_W = 80;
const ROOT_H = 30;

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
  siblingIndex: number | null; // position among siblings in a composite; null for root/decorator children
}

function collectNodes(
  btNode: BtNode,
  parentId: string | null,
  isDecoratorChild: boolean,
  siblingIndex: number | null,
  out: LayoutNode[],
  edges: { source: string; target: string; isDecorator: boolean }[],
): string {
  const id = nextId();
  out.push({ id, btNode, parentId, isDecoratorChild, siblingIndex });

  if (parentId !== null) {
    edges.push({ source: parentId, target: id, isDecorator: isDecoratorChild });
  }

  switch (btNode.kind) {
    case "selector":
    case "sequence":
    case "parallel":
    case "subplan":
      for (let i = 0; i < btNode.children.length; i++) {
        collectNodes(btNode.children[i], id, false, i, out, edges);
      }
      break;
    case "leaf":
      break;
    case "subtree":
      break;
    case "decorator":
      if (btNode.child) collectNodes(btNode.child, id, true, null, out, edges);
      break;
  }

  return id;
}

function nodeSize(btNode: BtNode): { width: number; height: number } {
  const W = 220;
  switch (btNode.kind) {
    case "leaf": {
      const n = Object.keys(btNode.vars).length;
      return { width: W, height: n > 0 ? 34 + n * 18 : 52 };
    }
    case "decorator": {
      const n = Object.keys(btNode.vars).length;
      return { width: W, height: 36 + (n > 0 ? n * 18 + 4 : 0) };
    }
    case "parallel":
      return { width: W, height: 108 };
    case "subplan":
      return { width: W, height: 88 };
    case "subtree":
      return { width: W, height: 52 };
    default:
      return { width: W, height: 48 };
  }
}

function nodeType(btNode: BtNode): string {
  switch (btNode.kind) {
    case "selector":
      return "selectorNode";
    case "sequence":
      return "sequenceNode";
    case "parallel":
      return "parallelNode";
    case "subplan":
      return "subplanNode";
    case "leaf":
      return "leafNode";
    case "subtree":
      return "subtreeNode";
    case "decorator":
      return "decoratorNode";
  }
}

function nodeData(btNode: BtNode): Record<string, unknown> {
  switch (btNode.kind) {
    case "selector":
    case "sequence":
      return {};
    case "parallel":
    case "subplan": {
      const src = btNode as unknown as Record<string, unknown>;
      const data: Record<string, unknown> = {};
      for (const prop of COMPOSITE_SCHEMAS[btNode.kind] ?? []) data[prop.key] = src[prop.key];
      return data;
    }
    case "leaf":
      return { behaviorType: btNode.behaviorType, vars: btNode.vars };
    case "subtree":
      return { behaviorType: btNode.behaviorType };
    case "decorator":
      return { nodeType: btNode.nodeType, vars: btNode.vars };
  }
}

export function buildLayout(root: BtNode, includeRootStub = false): LayoutResult {
  nodeCounter = 0;

  const layoutNodes: LayoutNode[] = [];
  const rawEdges: { source: string; target: string; isDecorator: boolean }[] = [];

  collectNodes(root, null, false, null, layoutNodes, rawEdges);

  // Build dagre graph
  const g = new dagre.graphlib.Graph();
  g.setDefaultEdgeLabel(() => ({}));
  g.setGraph({ rankdir: "TB", ranksep: 50, nodesep: 60 });

  if (includeRootStub) {
    g.setNode(ROOT_NODE_ID, { width: ROOT_W, height: ROOT_H });
    g.setEdge(ROOT_NODE_ID, layoutNodes[0].id, { minlen: 2 });
  }

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

  // Enforce left-to-right ordering: child with siblingIndex 0 must be leftmost.
  // Dagre may assign positions in wrong order; fix by shifting entire subtrees.
  {
    function subtreeIds(id: string): string[] {
      const result: string[] = [id];
      for (const ln of layoutNodes) {
        if (ln.parentId === id) result.push(...subtreeIds(ln.id));
      }
      return result;
    }

    for (const ln of layoutNodes) {
      // Only fix composite nodes whose direct (non-decorator) children have siblingIndex
      const children = layoutNodes.filter(
        (c) => c.parentId === ln.id && !c.isDecoratorChild && c.siblingIndex !== null,
      );
      if (children.length < 2) continue;

      const byIndex = [...children].sort((a, b) => (a.siblingIndex ?? 0) - (b.siblingIndex ?? 0));
      const xSlots = byIndex.map((c) => g.node(c.id).x).sort((a, b) => a - b);

      if (byIndex.every((c, i) => Math.abs(g.node(c.id).x - xSlots[i]) < 0.5)) continue;

      const moves = byIndex.map((c, i) => ({
        ids: subtreeIds(c.id),
        dx: xSlots[i] - g.node(c.id).x,
      }));
      for (const { ids, dx } of moves) {
        if (Math.abs(dx) < 0.01) continue;
        for (const id of ids) {
          const pos = g.node(id);
          g.setNode(id, { ...pos, x: pos.x + dx });
        }
      }
    }
  }

  // Resolve sibling-subtree overlaps bottom-up.
  // The ordering fix above only swaps node centers; it ignores subtree widths, so
  // wide children (e.g. sequences with many leaves) can still overlap each other.
  {
    const GAP = 20;

    const _subtreeIdCache = new Map<string, string[]>();
    function allSubtreeIds(id: string): string[] {
      const cached = _subtreeIdCache.get(id);
      if (cached) return cached;
      const result: string[] = [id];
      for (const ln of layoutNodes) {
        if (ln.parentId === id) result.push(...allSubtreeIds(ln.id));
      }
      _subtreeIdCache.set(id, result);
      return result;
    }

    function subtreeBounds(id: string): { minX: number; maxX: number } {
      let minX = Infinity,
        maxX = -Infinity;
      for (const sid of allSubtreeIds(id)) {
        const ln2 = layoutNodes.find((n) => n.id === sid)!;
        const sz = nodeSize(ln2.btNode);
        const pos = g.node(sid);
        if (pos.x - sz.width / 2 < minX) minX = pos.x - sz.width / 2;
        if (pos.x + sz.width / 2 > maxX) maxX = pos.x + sz.width / 2;
      }
      return { minX, maxX };
    }

    function shiftSubtree(id: string, dx: number) {
      if (Math.abs(dx) < 0.01) return;
      for (const sid of allSubtreeIds(id)) {
        const pos = g.node(sid);
        g.setNode(sid, { ...pos, x: pos.x + dx });
      }
    }

    // Reversed DFS pre-order = bottom-up: children processed before their parent.
    for (const ln of [...layoutNodes].reverse()) {
      const children = layoutNodes.filter(
        (c) => c.parentId === ln.id && !c.isDecoratorChild && c.siblingIndex !== null,
      );
      if (children.length < 2) continue;

      const byIndex = [...children].sort((a, b) => (a.siblingIndex ?? 0) - (b.siblingIndex ?? 0));

      // Push each sibling right if it overlaps the previous one.
      for (let i = 1; i < byIndex.length; i++) {
        const prevBounds = subtreeBounds(byIndex[i - 1].id);
        const currBounds = subtreeBounds(byIndex[i].id);
        const gap = currBounds.minX - prevBounds.maxX;
        if (gap < GAP) {
          shiftSubtree(byIndex[i].id, GAP - gap);
        }
      }

      // Re-center parent above its children.
      const firstX = g.node(byIndex[0].id).x;
      const lastX = g.node(byIndex[byIndex.length - 1].id).x;
      const parentPos = g.node(ln.id);
      g.setNode(ln.id, { ...parentPos, x: (firstX + lastX) / 2 });
    }
  }

  const nodes: Node[] = layoutNodes.map((ln) => {
    const pos = g.node(ln.id);
    const size = nodeSize(ln.btNode);
    return {
      id: ln.id,
      type: nodeType(ln.btNode),
      position: { x: pos.x - size.width / 2, y: pos.y - size.height / 2 },
      data: { ...nodeData(ln.btNode), _btNode: ln.btNode, childIndex: ln.siblingIndex },
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

  if (includeRootStub) {
    const pos = g.node(ROOT_NODE_ID);
    nodes.unshift({
      id: ROOT_NODE_ID,
      type: "rootNode",
      position: { x: pos.x - ROOT_W / 2, y: pos.y - ROOT_H / 2 },
      data: {},
      deletable: false,
      draggable: false,
      selectable: false,
      style: { width: ROOT_W },
    });
    edges.unshift({
      id: "e__root__",
      source: ROOT_NODE_ID,
      target: layoutNodes[0].id,
      type: "smoothstep",
      style: { stroke: "#555", strokeWidth: 1.5, strokeDasharray: "4 3" },
      markerEnd: { type: "arrowclosed" as const },
      deletable: false,
      reconnectable: false,
    } as Edge);
  }

  return { nodes, edges };
}
