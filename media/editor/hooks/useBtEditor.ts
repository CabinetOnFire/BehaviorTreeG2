import { useState, useCallback, useRef } from "react";
import { applyNodeChanges, applyEdgeChanges, type Node, type Edge, type NodeChange, type EdgeChange } from "@xyflow/react";
import type { BtNode, SubtreeDescriptor } from "../../../shared/types";
import type { ExtMsg } from "../../../shared/messaging";
import { buildLayout } from "../layout/dagreLayout";
import { useVsCodeMessage } from "./useVsCodeMessage";

export interface PendingNode {
  id: string;
  btNode: BtNode;
  x: number;
  y: number;
}

export interface BtEditorState {
  subtrees: SubtreeDescriptor[];
  activeIndex: number;
  nodes: Node[];  // combined: tree nodes + pending nodes (as ReactFlow nodes)
  edges: Edge[];
  pendingNodes: PendingNode[];  // raw pending data, for save-warning check
  selectedNodeId: string | null;
  isDirty: boolean;
  layoutVersion: number;  // incremented by rebuildLayout/relayout; drives fitView
  behaviors: string[] | null;
  typeVars: Record<string, Array<{ name: string; defaultValue: string }>> | null;
  subtreeRefs: Array<{ typePath: string; filePath: string }> | null;
  controllerRefs: Array<{ typePath: string; filePath: string }> | null;
}

export function useBtEditor() {
  const pendingCounterRef = useRef(0);

  const [state, setState] = useState<BtEditorState>({
    subtrees: [],
    activeIndex: 0,
    nodes: [],
    edges: [],
    pendingNodes: [],
    selectedNodeId: null,
    isDirty: false,
    layoutVersion: 0,
    behaviors: null,
    typeVars: null,
    subtreeRefs: null,
    controllerRefs: null,
  });

  // Rebuild dagre layout and combine with any existing pending nodes
  const rebuildLayout = useCallback(
    (subtrees: SubtreeDescriptor[], index: number) => {
      const sub = subtrees[index];
      if (!sub) {
        setState((s) => ({ ...s, nodes: s.pendingNodes.map(toPendingRfNode), edges: [], subtrees, activeIndex: index, layoutVersion: s.layoutVersion + 1 }));
        return;
      }
      const { nodes: treeNodes, edges } = buildLayout(sub.root);
      setState((s) => ({
        ...s,
        subtrees,
        activeIndex: index,
        nodes: [...treeNodes, ...s.pendingNodes.map(toPendingRfNode)],
        edges,
        layoutVersion: s.layoutVersion + 1,
      }));
    },
    [],
  );

  const handleExtMsg = useCallback(
    (msg: ExtMsg) => {
      switch (msg.type) {
        case "init":
          // behaviors/subtreeRefs/controllerRefs/typeVars are workspace-wide — don't reset on file switch
          setState((s) => ({ ...s, isDirty: false }));
          rebuildLayout(msg.subtrees, msg.activeIndex);
          break;

        case "file_changed":
          rebuildLayout(msg.subtrees, 0);
          break;

        case "behaviors_loaded":
          setState((s) => ({ ...s, behaviors: msg.behaviors }));
          break;

        case "type_vars_loaded":
          setState((s) => ({ ...s, typeVars: msg.typeVars }));
          break;

        case "subtrees_loaded":
          setState((s) => ({ ...s, subtreeRefs: msg.subtrees, controllerRefs: msg.controllers }));
          break;
      }
    },
    [rebuildLayout],
  );

  const { postMessage } = useVsCodeMessage(handleExtMsg);

  const selectSubtree = useCallback(
    (index: number) => {
      postMessage({ type: "select_subtree", index });
      rebuildLayout(state.subtrees, index);
    },
    [postMessage, rebuildLayout, state.subtrees],
  );

  const saveAst = useCallback(
    (index: number, root: BtNode) => {
      postMessage({ type: "save_ast", index, root });
      setState((s) => ({ ...s, isDirty: false }));
      postMessage({ type: "set_dirty", dirty: false });
    },
    [postMessage],
  );

  const revealInFile = useCallback(
    (index: number) => {
      postMessage({ type: "reveal_in_file", index });
    },
    [postMessage],
  );

  const loadBehaviors = useCallback(() => {
    postMessage({ type: "load_behaviors" });
  }, [postMessage]);

  const loadSubtrees = useCallback(() => {
    postMessage({ type: "load_subtrees" });
  }, [postMessage]);

  const openSubtree = useCallback(
    (typePath: string, filePath: string) => {
      postMessage({ type: "open_subtree", typePath, filePath });
    },
    [postMessage],
  );

  const revealType = useCallback(
    (typePath: string) => {
      postMessage({ type: "reveal_type", typePath });
    },
    [postMessage],
  );

  // Fix 3: allow nodes to be repositioned by drag inside the canvas
  const onNodesChange = useCallback((changes: NodeChange[]) => {
    setState((s) => {
      const newNodes = applyNodeChanges(changes, s.nodes);
      // Sync position changes back to pendingNodes
      const newPending = s.pendingNodes.map((p) => {
        const rf = newNodes.find((n) => n.id === p.id);
        return rf ? { ...p, x: rf.position.x, y: rf.position.y } : p;
      });
      return { ...s, nodes: newNodes, pendingNodes: newPending };
    });
  }, []);

  const updateNode = useCallback(
    (nodeId: string, updated: BtNode) => {
      setState((s) => {
        const sub = s.subtrees[s.activeIndex];
        if (!sub) return s;
        const treeNodes = s.nodes.filter((n) => !n.id.startsWith("pending-"));
        const newRoot = _replaceNodeInTree(sub.root, nodeId, treeNodes, updated);
        const newSubtrees = s.subtrees.map((st, i) =>
          i === s.activeIndex ? { ...st, root: newRoot } : st,
        );
        const { nodes: treeNodes2, edges } = buildLayout(newRoot);
        return { ...s, subtrees: newSubtrees, nodes: [...treeNodes2, ...s.pendingNodes.map(toPendingRfNode)], edges, isDirty: true };
      });
      postMessage({ type: "set_dirty", dirty: true });
    },
    [postMessage],
  );

  const selectNode = useCallback((nodeId: string | null) => {
    setState((s) => ({ ...s, selectedNodeId: nodeId }));
  }, []);

  /** Drop a new node onto the canvas without connecting it to the tree. */
  const addPendingNode = useCallback((newChild: BtNode, x: number, y: number) => {
    const id = `pending-${pendingCounterRef.current++}`;
    setState((s) => ({
      ...s,
      pendingNodes: [...s.pendingNodes, { id, btNode: newChild, x, y }],
      nodes: [...s.nodes, toPendingRfNode({ id, btNode: newChild, x, y })],
    }));
  }, []);

  /** Remove all unconnected floating nodes (called on save). */
  const clearPendingNodes = useCallback(() => {
    setState((s) => ({
      ...s,
      pendingNodes: [],
      nodes: s.nodes.filter((n) => !n.id.startsWith("pending-")),
    }));
  }, []);

  /**
   * Connect a pending or tree node to a composite parent.
   * source = composite (new parent), target = child to connect.
   * If target is a tree node it is extracted and moved under source.
   */
  const connectOrMove = useCallback(
    (parentId: string, childId: string) => {
      setState((s) => {
        const sub = s.subtrees[s.activeIndex];
        if (!sub) return s;

        // Only tree nodes (no pending-) are valid parents
        const treeNodes = s.nodes.filter((n) => !n.id.startsWith("pending-"));
        const parentIdx = treeNodes.findIndex((n) => n.id === parentId);
        if (parentIdx < 0) return s;
        const parentBt = treeNodes[parentIdx].data._btNode as BtNode;
        if (!isComposite(parentBt)) return s;

        let childBtNode: BtNode | null = null;
        let newPendingNodes = s.pendingNodes;
        let treeRoot = sub.root;
        let adjustedParentIdx = parentIdx;

        const pendingIdx = s.pendingNodes.findIndex((p) => p.id === childId);
        if (pendingIdx >= 0) {
          childBtNode = s.pendingNodes[pendingIdx].btNode;
          newPendingNodes = s.pendingNodes.filter((_, i) => i !== pendingIdx);
        } else {
          const childIdx = treeNodes.findIndex((n) => n.id === childId);
          if (childIdx < 0) return s;
          const { newRoot, extracted, removedCount } = extractNodeFromTree(treeRoot, childId, treeNodes);
          if (!extracted) return s;
          treeRoot = newRoot;
          childBtNode = extracted;
          if (childIdx < parentIdx) adjustedParentIdx = parentIdx - removedCount;
        }
        if (!childBtNode) return s;

        const newRoot = addChildToCompositeByIndex(treeRoot, adjustedParentIdx, childBtNode);
        const newSubtrees = s.subtrees.map((st, i) =>
          i === s.activeIndex ? { ...st, root: newRoot } : st,
        );
        const { nodes: treeNodes2, edges } = buildLayout(newRoot);
        return {
          ...s,
          subtrees: newSubtrees,
          nodes: [...treeNodes2, ...newPendingNodes.map(toPendingRfNode)],
          edges,
          pendingNodes: newPendingNodes,
          isDirty: true,
        };
      });
      postMessage({ type: "set_dirty", dirty: true });
    },
    [postMessage],
  );

  /** Handle edge changes — apply selection etc. and handle deletions (detach child → pending). */
  const onEdgesChange = useCallback(
    (changes: EdgeChange[]) => {
      const removals = changes.filter((c) => c.type === "remove");
      const others = changes.filter((c) => c.type !== "remove");

      if (removals.length === 0) {
        setState((s) => ({ ...s, edges: applyEdgeChanges(others, s.edges) }));
        return;
      }

      setState((s) => {
        const sub = s.subtrees[s.activeIndex];
        if (!sub) return s;

        const treeNodes = s.nodes.filter((n) => !n.id.startsWith("pending-"));
        let root = sub.root;
        const newPendingNodes = [...s.pendingNodes];
        let changed = false;

        for (const change of removals) {
          if (change.type !== "remove") continue;
          const edge = s.edges.find((e) => e.id === change.id);
          if (!edge) continue;

          const childId = edge.target;
          const childRf = treeNodes.find((n) => n.id === childId);
          if (!childRf) continue;

          const { newRoot, extracted } = extractNodeFromTree(root, childId, treeNodes);
          if (!extracted) continue;

          root = newRoot;
          changed = true;
          const pendingId = `pending-${pendingCounterRef.current++}`;
          newPendingNodes.push({
            id: pendingId,
            btNode: extracted,
            x: (childRf.position.x ?? 0) + 40,
            y: (childRf.position.y ?? 0) + 80,
          });
        }

        if (!changed) {
          const newEdges = applyEdgeChanges(others, s.edges);
          return { ...s, edges: newEdges };
        }

        const newSubtrees = s.subtrees.map((st, i) =>
          i === s.activeIndex ? { ...st, root } : st,
        );
        const { nodes: newTreeNodes, edges: newEdges } = buildLayout(root);
        return {
          ...s,
          subtrees: newSubtrees,
          nodes: [...newTreeNodes, ...newPendingNodes.map(toPendingRfNode)],
          edges: newEdges,
          pendingNodes: newPendingNodes,
          isDirty: true,
        };
      });
      postMessage({ type: "set_dirty", dirty: true });
    },
    [postMessage],
  );

  const relayout = useCallback(() => {
    setState((s) => {
      const sub = s.subtrees[s.activeIndex];
      if (!sub) return s;
      const { nodes, edges } = buildLayout(sub.root);
      return { ...s, nodes, edges, layoutVersion: s.layoutVersion + 1 };
    });
  }, []);

  return {
    state,
    postMessage,
    selectSubtree,
    saveAst,
    revealInFile,
    revealType,
    loadBehaviors,
    loadSubtrees,
    openSubtree,
    onNodesChange,
    onEdgesChange,
    updateNode,
    addPendingNode,
    clearPendingNodes,
    connectOrMove,
    selectNode,
    relayout,
  };
}

// ──────────────────────────────────────────────────────────────────────────────
// Pending-node helpers
// ──────────────────────────────────────────────────────────────────────────────

function _rfNodeType(btNode: BtNode): string {
  switch (btNode.kind) {
    case "selector": return "selectorNode";
    case "sequence": return "sequenceNode";
    case "parallel": return "parallelNode";
    case "leaf":     return "leafNode";
    case "subtree":  return "subtreeNode";
    case "decorator": return "decoratorNode";
  }
}

function _rfNodeData(btNode: BtNode): Record<string, unknown> {
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

function toPendingRfNode(p: PendingNode): Node {
  return {
    id: p.id,
    type: _rfNodeType(p.btNode),
    position: { x: p.x, y: p.y },
    data: { ..._rfNodeData(p.btNode), _btNode: p.btNode },
    style: { width: 220, opacity: 0.75 },
  };
}

// ──────────────────────────────────────────────────────────────────────────────
// Tree mutation helpers (DFS-counter based, counter-correct)
// ──────────────────────────────────────────────────────────────────────────────

function _countBtNodes(node: BtNode): number {
  let n = 1;
  switch (node.kind) {
    case "selector": case "sequence": case "parallel":
      for (const c of node.children) n += _countBtNodes(c);
      break;
    case "decorator":
      n += _countBtNodes(node.child);
      break;
  }
  return n;
}

/**
 * Remove a node by ID from the tree (using DFS counter matching `nodes` array order).
 * Returns the new root, the extracted BtNode, and how many DFS positions were removed.
 * Counter advancement is correct: after returning from the target, `counter` is past
 * all of the target's descendants so siblings get the right IDs.
 */
function extractNodeFromTree(
  root: BtNode,
  nodeId: string,
  treeNodes: Node[],
): { newRoot: BtNode; extracted: BtNode | null; removedCount: number } {
  const idOrder = treeNodes.map((n) => n.id);
  let counter = 0;
  let extracted: BtNode | null = null;
  let removedCount = 0;

  function walk(node: BtNode): BtNode | null {
    const id = idOrder[counter++];
    if (id === nodeId) {
      extracted = node;
      removedCount = _countBtNodes(node);
      // Advance counter past all descendants (we already consumed 1 for the node itself)
      counter += removedCount - 1;
      return null;
    }
    switch (node.kind) {
      case "selector": case "sequence": case "parallel": {
        const kids: BtNode[] = [];
        for (const c of node.children) {
          const r = walk(c);
          if (r !== null) kids.push(r);
        }
        return { ...node, children: kids };
      }
      case "decorator": {
        const newChild = walk(node.child);
        // If decorator's only child was removed, put a placeholder so the tree stays valid
        return {
          ...node,
          child: newChild ?? { kind: "leaf", behaviorType: "/datum/ai_behavior/todo", args: [] },
        };
      }
      case "leaf": case "subtree": return node;
    }
  }

  const newRoot = walk(root) ?? root;
  return { newRoot, extracted, removedCount };
}

/**
 * Append a child to the composite node at DFS index `compositeIdx` in the tree.
 * Uses skip-descendants so siblings after the composite get the correct counter.
 */
function addChildToCompositeByIndex(
  root: BtNode,
  compositeIdx: number,
  child: BtNode,
): BtNode {
  let counter = 0;

  function skipDesc(node: BtNode) {
    switch (node.kind) {
      case "selector": case "sequence": case "parallel":
        for (const c of node.children) { counter++; skipDesc(c); }
        break;
      case "decorator":
        counter++; skipDesc(node.child);
        break;
    }
  }

  function walk(node: BtNode): BtNode {
    const idx = counter++;
    if (idx === compositeIdx && isComposite(node)) {
      skipDesc(node);
      return { ...node, children: [...node.children, child] };
    }
    switch (node.kind) {
      case "selector": case "sequence": case "parallel":
        return { ...node, children: node.children.map(walk) };
      case "decorator":
        return { ...node, child: walk(node.child) };
      case "leaf": case "subtree": return node;
    }
  }

  return walk(root);
}

/**
 * Replace the BtNode at `targetId` (DFS order) with `updated`.
 * Correctly advances counter past the replaced node's descendants.
 */
function _replaceNodeInTree(
  root: BtNode,
  targetId: string,
  treeNodes: Node[],
  updated: BtNode,
): BtNode {
  const idOrder = treeNodes.map((n) => n.id);
  let counter = 0;

  function skipDesc(node: BtNode) {
    switch (node.kind) {
      case "selector": case "sequence": case "parallel":
        for (const c of node.children) { counter++; skipDesc(c); }
        break;
      case "decorator":
        counter++; skipDesc(node.child);
        break;
    }
  }

  function walk(node: BtNode): BtNode {
    const id = idOrder[counter++];
    if (id === targetId) {
      skipDesc(node); // advance past old node's descendants
      return updated;
    }
    switch (node.kind) {
      case "selector": case "sequence": case "parallel":
        return { ...node, children: node.children.map(walk) };
      case "decorator":
        return { ...node, child: walk(node.child) };
      case "leaf": case "subtree": return node;
    }
  }

  return walk(root);
}

function isComposite(node: BtNode): node is Extract<BtNode, { children: BtNode[] }> {
  return node.kind === "selector" || node.kind === "sequence" || node.kind === "parallel";
}
