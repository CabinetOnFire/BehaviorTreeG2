import { useState, useCallback } from "react";
import {
  applyNodeChanges,
  applyEdgeChanges,
  type Node,
  type Edge,
  type NodeChange,
  type EdgeChange,
} from "@xyflow/react";
import type { BtBindingDeclarations, BtNode, SubtreeDescriptor } from "../../../shared/types";
import type { ExtMsg } from "../../../shared/messaging";
import { buildLayout, ROOT_NODE_ID } from "../layout/dagreLayout";
import { useVsCodeMessage } from "./useVsCodeMessage";

export interface PendingGroup {
  groupId: string;
  rootNodeId: string;  // RF node ID of the subtree root
  btNode: BtNode;      // full hierarchy (children included) — used for reconnection
  nodeIds: string[];   // all RF node IDs in this group
  edgeIds: string[];   // all RF edge IDs internal to this group
}

type HistoryEntry = {
  subtrees: SubtreeDescriptor[];
  pendingGroups: PendingGroup[];
  pendingRfNodes: Node[];
  pendingRfEdges: Edge[];
};

export interface BtEditorState {
  subtrees: SubtreeDescriptor[];
  activeIndex: number;
  nodes: Node[];
  edges: Edge[];
  pendingGroups: PendingGroup[];
  clipboard: BtNode[];
  isDirty: boolean;
  layoutVersion: number;
  behaviors: string[] | null;
  typeVars: Record<string, Array<{ name: string; defaultValue: string }>> | null;
  subtreeRefs: Array<{ typePath: string; filePath: string; jsonPath?: string; inherited?: boolean }> | null;
  controllerRefs: Array<{ typePath: string; filePath: string; jsonPath?: string; inherited?: boolean }> | null;
  /** Binding declarations keyed by typePath, populated from subtrees_loaded. */
  subtreeBindings: Record<string, BtBindingDeclarations>;
  past: HistoryEntry[];
  future: HistoryEntry[];
}

// ──────────────────────────────────────────────────────────────────────────────
// Pending-group helpers
// ──────────────────────────────────────────────────────────────────────────────

let _groupCounter = 0;

/**
 * Lay out a BtNode subtree and wrap it in a PendingGroup so it floats on the
 * canvas with all its nodes and internal edges intact.
 */
function ejectSubtreeAsGroup(
  btNode: BtNode,
  baseX: number,
  baseY: number,
): { group: PendingGroup; rfNodes: Node[]; rfEdges: Edge[] } {
  const groupId = `pg${_groupCounter++}`;
  const { nodes: layoutNodes, edges: layoutEdges } = buildLayout(btNode);

  const idMap = new Map<string, string>();
  for (const n of layoutNodes) {
    idMap.set(n.id, `pending-${groupId}-${n.id}`);
  }

  // Position root at (baseX, baseY)
  const rootLayout = layoutNodes[0];
  const offsetX = rootLayout ? baseX - rootLayout.position.x : baseX;
  const offsetY = rootLayout ? baseY - rootLayout.position.y : baseY;

  const rfNodes: Node[] = layoutNodes.map((n) => ({
    ...n,
    id: idMap.get(n.id)!,
    position: { x: n.position.x + offsetX, y: n.position.y + offsetY },
    style: { ...n.style, opacity: 0.75 },
  }));

  const rfEdges: Edge[] = layoutEdges.map((e, i) => ({
    ...e,
    id: `pending-${groupId}-e${i}`,
    source: idMap.get(e.source)!,
    target: idMap.get(e.target)!,
    deletable: false,
  }));

  const rootNodeId = rootLayout ? idMap.get(rootLayout.id)! : "";

  return {
    group: {
      groupId,
      rootNodeId,
      btNode,
      nodeIds: rfNodes.map((n) => n.id),
      edgeIds: rfEdges.map((e) => e.id),
    },
    rfNodes,
    rfEdges,
  };
}

function snapshot(s: BtEditorState): HistoryEntry {
  return {
    subtrees: s.subtrees,
    pendingGroups: s.pendingGroups,
    pendingRfNodes: s.nodes.filter((n) => n.id.startsWith("pending-")),
    pendingRfEdges: s.edges.filter((e) => e.id.startsWith("pending-")),
  };
}

function btTreeNodes(nodes: Node[]): Node[] {
  return nodes.filter((n) => !n.id.startsWith("pending-") && n.id !== ROOT_NODE_ID);
}

// ──────────────────────────────────────────────────────────────────────────────
// Hook
// ──────────────────────────────────────────────────────────────────────────────

export function useBtEditor() {
  const [state, setState] = useState<BtEditorState>({
    subtrees: [],
    activeIndex: 0,
    nodes: [],
    edges: [],
    pendingGroups: [],
    clipboard: [],
    isDirty: false,
    layoutVersion: 0,
    behaviors: null,
    typeVars: null,
    subtreeRefs: null,
    controllerRefs: null,
    subtreeBindings: {},
    past: [],
    future: [],
  });

  const rebuildLayout = useCallback((subtrees: SubtreeDescriptor[], index: number) => {
    const sub = subtrees[index];
    if (!sub) {
      setState((s) => {
        const pn = s.nodes.filter((n) => n.id.startsWith("pending-"));
        const pe = s.edges.filter((e) => e.id.startsWith("pending-"));
        return { ...s, subtrees, activeIndex: index, nodes: pn, edges: pe, layoutVersion: s.layoutVersion + 1, past: [], future: [] };
      });
      return;
    }
    const { nodes: treeNodes, edges: treeEdges } = buildLayout(sub.root, true);
    setState((s) => {
      const pn = s.nodes.filter((n) => n.id.startsWith("pending-"));
      const pe = s.edges.filter((e) => e.id.startsWith("pending-"));
      return {
        ...s,
        subtrees,
        activeIndex: index,
        nodes: [...treeNodes, ...pn],
        edges: [...treeEdges, ...pe],
        layoutVersion: s.layoutVersion + 1,
        past: [],
        future: [],
      };
    });
  }, []);

  const handleExtMsg = useCallback(
    (msg: ExtMsg) => {
      switch (msg.type) {
        case "init":
          setState((s) => ({ ...s, isDirty: false }));
          rebuildLayout(msg.subtrees, msg.activeIndex);
          break;
        case "file_changed":
          rebuildLayout(msg.subtrees, msg.activeIndex);
          break;
        case "behaviors_loaded":
          setState((s) => ({ ...s, behaviors: msg.behaviors }));
          break;
        case "type_vars_loaded":
          setState((s) => ({ ...s, typeVars: msg.typeVars }));
          break;
        case "subtrees_loaded": {
          const subtreeBindings: Record<string, BtBindingDeclarations> = {};
          for (const ref of [...msg.subtrees, ...msg.controllers]) {
            if (ref.bindings) subtreeBindings[ref.typePath] = ref.bindings;
          }
          setState((s) => ({ ...s, subtreeRefs: msg.subtrees, controllerRefs: msg.controllers, subtreeBindings }));
          break;
        }
        case "clipboard_update":
          setState((s) => ({ ...s, clipboard: msg.nodes }));
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
      setState((s) => {
        const bindings = s.subtrees[index]?.bindings;
        postMessage({ type: "save_ast", index, root, bindings });
        postMessage({ type: "set_dirty", dirty: false });
        return { ...s, isDirty: false };
      });
    },
    [postMessage],
  );

  const revealInFile = useCallback(
    (index: number) => { postMessage({ type: "reveal_in_file", index }); },
    [postMessage],
  );

  const loadBehaviors = useCallback(() => { postMessage({ type: "load_behaviors" }); }, [postMessage]);
  const loadSubtrees = useCallback(() => { postMessage({ type: "load_subtrees" }); }, [postMessage]);

  const openSubtree = useCallback(
    (typePath: string, filePath: string, jsonPath?: string, newPanel?: boolean) => {
      postMessage({ type: "open_subtree", typePath, filePath, jsonPath, newPanel });
    },
    [postMessage],
  );

  const revealType = useCallback(
    (typePath: string) => { postMessage({ type: "reveal_type", typePath }); },
    [postMessage],
  );

  const onNodesChange = useCallback(
    (changes: NodeChange[]) => {
      const removals = changes.filter((c) => c.type === "remove");
      const others = changes.filter((c) => c.type !== "remove");

      if (removals.length === 0) {
        setState((s) => ({ ...s, nodes: applyNodeChanges(others, s.nodes) }));
        return;
      }

      setState((s) => {
        const sub = s.subtrees[s.activeIndex];
        if (!sub) return s;

        const treeNodes = btTreeNodes(s.nodes);
        let root = sub.root;
        let newPendingGroups = [...s.pendingGroups];
        const removedNodeIds = new Set<string>();
        const removedEdgeIds = new Set<string>();

        // Collect tree-node IDs to remove in one pass, and handle pending nodes per group
        const treeRemoveIds = new Set<string>();
        for (const change of removals) {
          if (change.type !== "remove") continue;
          const nodeId = change.id;
          if (nodeId === ROOT_NODE_ID) continue;

          if (nodeId.startsWith("pending-")) {
            const groupIdx = newPendingGroups.findIndex((g) => g.nodeIds.includes(nodeId));
            if (groupIdx < 0) continue;
            const result = extractFromPendingGroup(newPendingGroups[groupIdx], nodeId, s.edges);
            if (!result) continue;
            result.removedNodeIds.forEach((id) => removedNodeIds.add(id));
            result.removedEdgeIds.forEach((id) => removedEdgeIds.add(id));
            if (result.updatedGroup === null) {
              newPendingGroups.splice(groupIdx, 1);
            } else {
              newPendingGroups[groupIdx] = result.updatedGroup;
            }
          } else {
            treeRemoveIds.add(nodeId);
          }
        }

        let changed = removedNodeIds.size > 0;
        if (treeRemoveIds.size > 0) {
          const newRoot = removeMultipleFromTree(root, treeRemoveIds, treeNodes);
          if (newRoot !== root) { root = newRoot; changed = true; }
        }

        if (!changed) return { ...s, nodes: applyNodeChanges(others, s.nodes) };

        const pn = s.nodes.filter((n) => n.id.startsWith("pending-") && !removedNodeIds.has(n.id));
        const pe = s.edges.filter((e) => e.id.startsWith("pending-") && !removedEdgeIds.has(e.id));
        const newSubtrees = s.subtrees.map((st, i) => i === s.activeIndex ? { ...st, root } : st);
        const { nodes: treeNodes2, edges: treeEdges } = buildLayout(root, true);

        return {
          ...s,
          subtrees: newSubtrees,
          nodes: [...treeNodes2, ...pn],
          edges: [...treeEdges, ...pe],
          pendingGroups: newPendingGroups,
          isDirty: true,
          past: [...s.past, snapshot(s)].slice(-50),
          future: [],
        };
      });
      postMessage({ type: "set_dirty", dirty: true });
    },
    [postMessage],
  );

  const updateNode = useCallback(
    (nodeId: string, updated: BtNode) => {
      setState((s) => {
        const sub = s.subtrees[s.activeIndex];
        if (!sub) return s;
        const treeNodes = btTreeNodes(s.nodes);
        const newRoot = _replaceNodeInTree(sub.root, nodeId, treeNodes, updated);
        const newSubtrees = s.subtrees.map((st, i) => i === s.activeIndex ? { ...st, root: newRoot } : st);
        const pn = s.nodes.filter((n) => n.id.startsWith("pending-"));
        const pe = s.edges.filter((e) => e.id.startsWith("pending-"));
        const { nodes: treeNodes2, edges: treeEdges } = buildLayout(newRoot, true);
        const prevSelected = new Set(s.nodes.filter((n) => n.selected).map((n) => n.id));
        const restoredNodes = treeNodes2.map((n) => prevSelected.has(n.id) ? { ...n, selected: true } : n);
        return {
          ...s,
          subtrees: newSubtrees,
          nodes: [...restoredNodes, ...pn],
          edges: [...treeEdges, ...pe],
          isDirty: true,
          past: [...s.past, snapshot(s)].slice(-50),
          future: [],
        };
      });
      postMessage({ type: "set_dirty", dirty: true });
    },
    [postMessage],
  );

  const updateNodeAndBindings = useCallback(
    (nodeId: string, updated: BtNode, updatedRootBindings: BtBindingDeclarations | undefined) => {
      setState((s) => {
        const sub = s.subtrees[s.activeIndex];
        if (!sub) return s;
        const treeNodes = btTreeNodes(s.nodes);
        const newRoot = _replaceNodeInTree(sub.root, nodeId, treeNodes, updated);
        const newSubtrees = s.subtrees.map((st, i) =>
          i === s.activeIndex
            ? { ...st, root: newRoot, bindings: updatedRootBindings }
            : st,
        );
        const pn = s.nodes.filter((n) => n.id.startsWith("pending-"));
        const pe = s.edges.filter((e) => e.id.startsWith("pending-"));
        const { nodes: treeNodes2, edges: treeEdges } = buildLayout(newRoot, true);
        const prevSelected = new Set(s.nodes.filter((n) => n.selected).map((n) => n.id));
        const restoredNodes = treeNodes2.map((n) => prevSelected.has(n.id) ? { ...n, selected: true } : n);
        return {
          ...s,
          subtrees: newSubtrees,
          nodes: [...restoredNodes, ...pn],
          edges: [...treeEdges, ...pe],
          isDirty: true,
          past: [...s.past, snapshot(s)].slice(-50),
          future: [],
        };
      });
      postMessage({ type: "set_dirty", dirty: true });
    },
    [postMessage],
  );

  const renameBinding = useCallback(
    (oldName: string, newName: string) => {
      setState((s) => {
        const sub = s.subtrees[s.activeIndex];
        if (!sub) return s;
        if (!newName || newName === oldName) return s;

        const oldDecl = sub.bindings?.[oldName];
        if (!oldDecl) return s;
        // Refuse merge if newName already exists
        if (sub.bindings?.[newName]) return s;

        const newRoot = _substituteBindingNameInTree(sub.root, oldName, newName);
        const newBindings: BtBindingDeclarations = {};
        for (const [k, v] of Object.entries(sub.bindings ?? {})) {
          newBindings[k === oldName ? newName : k] = v;
        }
        const newSubtrees = s.subtrees.map((st, i) =>
          i === s.activeIndex ? { ...st, root: newRoot, bindings: newBindings } : st,
        );
        const pn = s.nodes.filter((n) => n.id.startsWith("pending-"));
        const pe = s.edges.filter((e) => e.id.startsWith("pending-"));
        const { nodes: treeNodes2, edges: treeEdges } = buildLayout(newRoot, true);
        return {
          ...s,
          subtrees: newSubtrees,
          nodes: [...treeNodes2, ...pn],
          edges: [...treeEdges, ...pe],
          isDirty: true,
          past: [...s.past, snapshot(s)].slice(-50),
          future: [],
        };
      });
      postMessage({ type: "set_dirty", dirty: true });
    },
    [postMessage],
  );

  const clearSelection = useCallback(() => {
    setState((s) => ({
      ...s,
      nodes: s.nodes.map((n) => (n.selected ? { ...n, selected: false } : n)),
    }));
  }, []);

  const addPendingNode = useCallback((newChild: BtNode, x: number, y: number) => {
    const { group, rfNodes, rfEdges } = ejectSubtreeAsGroup(newChild, x, y);
    setState((s) => ({
      ...s,
      pendingGroups: [...s.pendingGroups, group],
      nodes: [...s.nodes, ...rfNodes],
      edges: [...s.edges, ...rfEdges],
      past: [...s.past, snapshot(s)].slice(-50),
      future: [],
    }));
  }, []);

  const clearPendingNodes = useCallback(() => {
    setState((s) => ({
      ...s,
      pendingGroups: [],
      nodes: s.nodes.filter((n) => !n.id.startsWith("pending-")),
      edges: s.edges.filter((e) => !e.id.startsWith("pending-")),
      past: [...s.past, snapshot(s)].slice(-50),
      future: [],
    }));
  }, []);

  const connectOrMove = useCallback(
    (parentId: string, childId: string) => {
      if (parentId === ROOT_NODE_ID) {
        setState((s) => {
          const sub = s.subtrees[s.activeIndex];
          if (!sub) return s;

          const snap = snapshot(s);
          let childBtNode: BtNode | null = null;
          let newPendingGroups = [...s.pendingGroups];
          const removedNodeIds = new Set<string>();
          const removedEdgeIds = new Set<string>();
          let oldRootBt = sub.root;

          const pendingGroupIdx = s.pendingGroups.findIndex((g) => g.nodeIds.includes(childId));
          if (pendingGroupIdx >= 0) {
            const result = extractFromPendingGroup(s.pendingGroups[pendingGroupIdx], childId, s.edges);
            if (!result) return s;
            childBtNode = result.extracted;
            result.removedNodeIds.forEach((id) => removedNodeIds.add(id));
            result.removedEdgeIds.forEach((id) => removedEdgeIds.add(id));
            if (result.updatedGroup === null) {
              newPendingGroups.splice(pendingGroupIdx, 1);
            } else {
              newPendingGroups[pendingGroupIdx] = result.updatedGroup;
            }
          } else {
            const alreadyConnected = s.edges.find(
              (e) => e.source === ROOT_NODE_ID && e.target === childId,
            );
            if (alreadyConnected) return s;
            const treeNodesForOp = btTreeNodes(s.nodes);
            const { newRoot: treeAfterExtract, extracted } = extractNodeFromTree(
              sub.root, childId, treeNodesForOp,
            );
            if (!extracted) return s;
            childBtNode = extracted;
            oldRootBt = treeAfterExtract;
          }

          if (!childBtNode) return s;

          const treeNodesForPos = btTreeNodes(s.nodes);
          const oldRootRf = treeNodesForPos[0];
          const ejected = ejectSubtreeAsGroup(
            oldRootBt,
            (oldRootRf?.position.x ?? 100) + 280,
            oldRootRf?.position.y ?? 60,
          );

          const basePn = s.nodes.filter(
            (n) => n.id.startsWith("pending-") && !removedNodeIds.has(n.id),
          );
          const basePe = s.edges.filter(
            (e) => e.id.startsWith("pending-") && !removedEdgeIds.has(e.id),
          );

          const newSubtrees = s.subtrees.map((st, i) =>
            i === s.activeIndex ? { ...st, root: childBtNode! } : st,
          );
          const { nodes: newTreeNodes, edges: newTreeEdges } = buildLayout(childBtNode, true);

          return {
            ...s,
            subtrees: newSubtrees,
            nodes: [...newTreeNodes, ...basePn, ...ejected.rfNodes],
            edges: [...newTreeEdges, ...basePe, ...ejected.rfEdges],
            pendingGroups: [...newPendingGroups, ejected.group],
            isDirty: true,
            past: [...s.past, snap].slice(-50),
            future: [],
          };
        });
        postMessage({ type: "set_dirty", dirty: true });
        return;
      }

      setState((s) => {
        const sub = s.subtrees[s.activeIndex];
        if (!sub) return s;

        const treeNodes = btTreeNodes(s.nodes);
        const parentIdx = treeNodes.findIndex((n) => n.id === parentId);
        if (parentIdx < 0) return s;
        const parentBt = treeNodes[parentIdx].data._btNode as BtNode;
        if (!isComposite(parentBt) && parentBt.kind !== "decorator") return s;

        let childBtNode: BtNode | null = null;
        let newPendingGroups = [...s.pendingGroups];
        const removedNodeIds = new Set<string>();
        const removedEdgeIds = new Set<string>();
        let treeRoot = sub.root;
        let adjustedParentIdx = parentIdx;

        const pendingGroupIdx = s.pendingGroups.findIndex((g) => g.nodeIds.includes(childId));
        if (pendingGroupIdx >= 0) {
          const result = extractFromPendingGroup(s.pendingGroups[pendingGroupIdx], childId, s.edges);
          if (!result) return s;
          childBtNode = result.extracted;
          result.removedNodeIds.forEach((id) => removedNodeIds.add(id));
          result.removedEdgeIds.forEach((id) => removedEdgeIds.add(id));
          if (result.updatedGroup === null) {
            newPendingGroups.splice(pendingGroupIdx, 1);
          } else {
            newPendingGroups[pendingGroupIdx] = result.updatedGroup;
          }
        } else {
          const existingEdge = s.edges.find((e) => e.source === parentId && e.target === childId);
          if (existingEdge) return s;

          const childIdx = treeNodes.findIndex((n) => n.id === childId);
          if (childIdx < 0) return s;
          const { newRoot, extracted, removedCount } = extractNodeFromTree(treeRoot, childId, treeNodes);
          if (!extracted) return s;
          treeRoot = newRoot;
          childBtNode = extracted;
          if (childIdx < parentIdx) adjustedParentIdx = parentIdx - removedCount;
        }
        if (!childBtNode) return s;

        const basePn = s.nodes.filter((n) => n.id.startsWith("pending-") && !removedNodeIds.has(n.id));
        const basePe = s.edges.filter((e) => e.id.startsWith("pending-") && !removedEdgeIds.has(e.id));
        const snap = snapshot(s);

        if (parentBt.kind === "decorator") {
          const oldChild = parentBt.child;
          let extraGroups: PendingGroup[] = [];
          let extraNodes: Node[] = [];
          let extraEdges: Edge[] = [];
          if (oldChild) {
            const parentRf = treeNodes[parentIdx];
            const ejected = ejectSubtreeAsGroup(oldChild, (parentRf.position.x ?? 0) + 240, parentRf.position.y ?? 0);
            extraGroups = [ejected.group];
            extraNodes = ejected.rfNodes;
            extraEdges = ejected.rfEdges;
          }
          const newRoot = setDecoratorChildByIndex(treeRoot, adjustedParentIdx, childBtNode);
          const newSubtrees = s.subtrees.map((st, i) => i === s.activeIndex ? { ...st, root: newRoot } : st);
          const { nodes: treeNodes2, edges: treeEdges } = buildLayout(newRoot, true);
          return {
            ...s,
            subtrees: newSubtrees,
            nodes: [...treeNodes2, ...basePn, ...extraNodes],
            edges: [...treeEdges, ...basePe, ...extraEdges],
            pendingGroups: [...newPendingGroups, ...extraGroups],
            isDirty: true,
            past: [...s.past, snap].slice(-50),
            future: [],
          };
        }

        const newRoot = addChildToCompositeByIndex(treeRoot, adjustedParentIdx, childBtNode);
        const newSubtrees = s.subtrees.map((st, i) => i === s.activeIndex ? { ...st, root: newRoot } : st);
        const { nodes: treeNodes2, edges: treeEdges } = buildLayout(newRoot, true);
        return {
          ...s,
          subtrees: newSubtrees,
          nodes: [...treeNodes2, ...basePn],
          edges: [...treeEdges, ...basePe],
          pendingGroups: newPendingGroups,
          isDirty: true,
          past: [...s.past, snap].slice(-50),
          future: [],
        };
      });
      postMessage({ type: "set_dirty", dirty: true });
    },
    [postMessage],
  );

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

        const treeNodes = btTreeNodes(s.nodes);
        let root = sub.root;
        const newPendingGroups = [...s.pendingGroups];
        const extraNodes: Node[] = [];
        const extraEdges: Edge[] = [];
        let changed = false;

        for (const change of removals) {
          if (change.type !== "remove") continue;
          const edge = s.edges.find((e) => e.id === change.id);
          if (!edge || edge.id.startsWith("pending-") || edge.source === ROOT_NODE_ID) continue;

          const childId = edge.target;
          const childRf = treeNodes.find((n) => n.id === childId);
          if (!childRf) continue;

          const { newRoot, extracted } = extractNodeFromTree(root, childId, treeNodes);
          if (!extracted) continue;

          root = newRoot;
          changed = true;
          const ejected = ejectSubtreeAsGroup(
            extracted,
            (childRf.position.x ?? 0) + 40,
            (childRf.position.y ?? 0) + 80,
          );
          newPendingGroups.push(ejected.group);
          extraNodes.push(...ejected.rfNodes);
          extraEdges.push(...ejected.rfEdges);
        }

        if (!changed) return { ...s, edges: applyEdgeChanges(others, s.edges) };

        const existingPn = s.nodes.filter((n) => n.id.startsWith("pending-"));
        const existingPe = s.edges.filter((e) => e.id.startsWith("pending-"));
        const newSubtrees = s.subtrees.map((st, i) => i === s.activeIndex ? { ...st, root } : st);
        const { nodes: newTreeNodes, edges: newTreeEdges } = buildLayout(root, true);

        return {
          ...s,
          subtrees: newSubtrees,
          nodes: [...newTreeNodes, ...existingPn, ...extraNodes],
          edges: [...newTreeEdges, ...existingPe, ...extraEdges],
          pendingGroups: newPendingGroups,
          isDirty: true,
          past: [...s.past, snapshot(s)].slice(-50),
          future: [],
        };
      });
      postMessage({ type: "set_dirty", dirty: true });
    },
    [postMessage],
  );

  const onNodeDragStop = useCallback(
    (_e: unknown, draggedNode: Node) => {
      if (draggedNode.id.startsWith("pending-")) return;

      setState((s) => {
        const sub = s.subtrees[s.activeIndex];
        if (!sub) return s;

        const parentEdge = s.edges.find((e) => e.target === draggedNode.id);
        if (!parentEdge) return s;

        const parentId = parentEdge.source;
        if (parentId === ROOT_NODE_ID) return s;

        const treeNodes = btTreeNodes(s.nodes);
        const parentNode = treeNodes.find((n) => n.id === parentId);
        if (!parentNode) return s;

        const parentBt = parentNode.data._btNode as BtNode;
        if (!isComposite(parentBt)) return s;

        const siblingEdges = s.edges.filter((e) => e.source === parentId);
        const siblings = siblingEdges
          .map((e) => treeNodes.find((n) => n.id === e.target))
          .filter((n): n is Node => n !== undefined);

        const sorted = [...siblings].sort((a, b) => a.position.x - b.position.x);
        const newChildren = sorted.map((n) => n.data._btNode as BtNode);

        if (newChildren.length === parentBt.children.length &&
            newChildren.every((n, i) => n === parentBt.children[i])) {
          return s;
        }

        const updatedParent: BtNode = { ...parentBt, children: newChildren };
        const newRoot = _replaceNodeInTree(sub.root, parentId, treeNodes, updatedParent);
        const newSubtrees = s.subtrees.map((st, i) => i === s.activeIndex ? { ...st, root: newRoot } : st);
        const pn = s.nodes.filter((n) => n.id.startsWith("pending-"));
        const pe = s.edges.filter((e) => e.id.startsWith("pending-"));
        const { nodes: treeNodes2, edges: treeEdges } = buildLayout(newRoot, true);

        return {
          ...s,
          subtrees: newSubtrees,
          nodes: [...treeNodes2, ...pn],
          edges: [...treeEdges, ...pe],
          isDirty: true,
          past: [...s.past, snapshot(s)].slice(-50),
          future: [],
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
      const { nodes: treeNodes, edges: treeEdges } = buildLayout(sub.root, true);
      const pn = s.nodes.filter((n) => n.id.startsWith("pending-"));
      const pe = s.edges.filter((e) => e.id.startsWith("pending-"));
      return { ...s, nodes: [...treeNodes, ...pn], edges: [...treeEdges, ...pe], layoutVersion: s.layoutVersion + 1 };
    });
  }, []);

  const undo = useCallback(() => {
    setState((s) => {
      if (s.past.length === 0) return s;
      const entry = s.past[s.past.length - 1];
      const sub = entry.subtrees[s.activeIndex];
      const { nodes: treeNodes, edges: treeEdges } = sub
        ? buildLayout(sub.root, true)
        : { nodes: [] as Node[], edges: [] as Edge[] };
      const cur = snapshot(s);
      return {
        ...s,
        subtrees: entry.subtrees,
        pendingGroups: entry.pendingGroups,
        nodes: [...treeNodes, ...entry.pendingRfNodes],
        edges: [...treeEdges, ...entry.pendingRfEdges],
        past: s.past.slice(0, -1),
        future: [cur, ...s.future].slice(0, 50),
        selectedNodeId: null,
        isDirty: true,
        layoutVersion: s.layoutVersion + 1,
      };
    });
  }, []);

  const redo = useCallback(() => {
    setState((s) => {
      if (s.future.length === 0) return s;
      const entry = s.future[0];
      const sub = entry.subtrees[s.activeIndex];
      const { nodes: treeNodes, edges: treeEdges } = sub
        ? buildLayout(sub.root, true)
        : { nodes: [] as Node[], edges: [] as Edge[] };
      const cur = snapshot(s);
      return {
        ...s,
        subtrees: entry.subtrees,
        pendingGroups: entry.pendingGroups,
        nodes: [...treeNodes, ...entry.pendingRfNodes],
        edges: [...treeEdges, ...entry.pendingRfEdges],
        past: [...s.past, cur].slice(0, 50),
        future: s.future.slice(1),
        selectedNodeId: null,
        isDirty: true,
        layoutVersion: s.layoutVersion + 1,
      };
    });
  }, []);

  const replaceNode = useCallback(
    (targetId: string, newNode: BtNode) => {
      setState((s) => {
        const sub = s.subtrees[s.activeIndex];
        if (!sub) return s;

        const treeNodes = btTreeNodes(s.nodes);
        const targetRf = treeNodes.find((n) => n.id === targetId);
        if (!targetRf) return s;

        const targetBt = targetRf.data._btNode as BtNode;
        const newRoot = _replaceNodeInTree(sub.root, targetId, treeNodes, newNode);
        const ejected = ejectSubtreeAsGroup(
          targetBt,
          (targetRf.position.x ?? 0) + 260,
          targetRf.position.y ?? 0,
        );

        const newSubtrees = s.subtrees.map((st, i) => i === s.activeIndex ? { ...st, root: newRoot } : st);
        const pn = s.nodes.filter((n) => n.id.startsWith("pending-"));
        const pe = s.edges.filter((e) => e.id.startsWith("pending-"));
        const { nodes: treeNodes2, edges: treeEdges } = buildLayout(newRoot, true);

        return {
          ...s,
          subtrees: newSubtrees,
          nodes: [...treeNodes2, ...pn, ...ejected.rfNodes],
          edges: [...treeEdges, ...pe, ...ejected.rfEdges],
          pendingGroups: [...s.pendingGroups, ejected.group],
          isDirty: true,
          past: [...s.past, snapshot(s)].slice(-50),
          future: [],
        };
      });
      postMessage({ type: "set_dirty", dirty: true });
    },
    [postMessage],
  );

  const copyNodes = useCallback((nodeIds: string[]) => {
    setState((s) => {
      const items: BtNode[] = [];
      for (const nodeId of nodeIds) {
        if (nodeId === ROOT_NODE_ID) continue;
        const node = s.nodes.find((n) => n.id === nodeId);
        if (node) items.push(node.data._btNode as BtNode);
      }
      if (items.length === 0) return s;
      postMessage({ type: "copy_nodes", nodes: items });
      return { ...s, clipboard: items };
    });
  }, [postMessage]);

  const replaceRoot = useCallback(
    (newNode: BtNode) => {
      setState((s) => {
        const sub = s.subtrees[s.activeIndex];
        if (!sub) return s;

        const snap = snapshot(s);
        const treeNodesForPos = btTreeNodes(s.nodes);
        const oldRootRf = treeNodesForPos[0];
        const ejected = ejectSubtreeAsGroup(
          sub.root,
          (oldRootRf?.position.x ?? 100) + 280,
          oldRootRf?.position.y ?? 60,
        );

        const newSubtrees = s.subtrees.map((st, i) =>
          i === s.activeIndex ? { ...st, root: newNode } : st,
        );
        const pn = s.nodes.filter((n) => n.id.startsWith("pending-"));
        const pe = s.edges.filter((e) => e.id.startsWith("pending-"));
        const { nodes: treeNodes2, edges: treeEdges } = buildLayout(newNode, true);

        return {
          ...s,
          subtrees: newSubtrees,
          nodes: [...treeNodes2, ...pn, ...ejected.rfNodes],
          edges: [...treeEdges, ...pe, ...ejected.rfEdges],
          pendingGroups: [...s.pendingGroups, ejected.group],
          isDirty: true,
          past: [...s.past, snap].slice(-50),
          future: [],
        };
      });
      postMessage({ type: "set_dirty", dirty: true });
    },
    [postMessage],
  );

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
    updateNodeAndBindings,
    renameBinding,
    addPendingNode,
    clearPendingNodes,
    connectOrMove,
    replaceNode,
    replaceRoot,
    copyNodes,
    clearSelection,
    relayout,
    undo,
    redo,
    onNodeDragStop,
  };
}

// ──────────────────────────────────────────────────────────────────────────────
// Tree mutation helpers
// ──────────────────────────────────────────────────────────────────────────────

function _countBtNodes(node: BtNode): number {
  let n = 1;
  switch (node.kind) {
    case "selector":
    case "sequence":
    case "parallel":
    case "subplan":
      for (const c of node.children) n += _countBtNodes(c);
      break;
    case "decorator":
      if (node.child) n += _countBtNodes(node.child);
      break;
  }
  return n;
}

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
      counter += removedCount - 1;
      return null;
    }
    switch (node.kind) {
      case "selector":
      case "sequence":
      case "parallel":
      case "subplan": {
        const kids: BtNode[] = [];
        for (const c of node.children) {
          const r = walk(c);
          if (r !== null) kids.push(r);
        }
        return { ...node, children: kids };
      }
      case "decorator": {
        if (!node.child) return node;
        const newChild = walk(node.child);
        if (newChild === null) return { ...node, child: undefined };
        return { ...node, child: newChild };
      }
      case "leaf":
      case "subtree":
        return node;
    }
  }

  const newRoot = walk(root) ?? root;
  return { newRoot, extracted, removedCount };
}

function addChildToCompositeByIndex(root: BtNode, compositeIdx: number, child: BtNode): BtNode {
  let counter = 0;

  function skipDesc(node: BtNode) {
    switch (node.kind) {
      case "selector":
      case "sequence":
      case "parallel":
      case "subplan":
        for (const c of node.children) { counter++; skipDesc(c); }
        break;
      case "decorator":
        if (node.child) { counter++; skipDesc(node.child); }
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
      case "selector":
      case "sequence":
      case "parallel":
      case "subplan":
        return { ...node, children: node.children.map(walk) };
      case "decorator":
        return { ...node, child: node.child ? walk(node.child) : undefined };
      case "leaf":
      case "subtree":
        return node;
    }
  }

  return walk(root);
}

function setDecoratorChildByIndex(root: BtNode, decoratorIdx: number, newChild: BtNode): BtNode {
  let counter = 0;

  function skipDesc(node: BtNode) {
    switch (node.kind) {
      case "selector":
      case "sequence":
      case "parallel":
      case "subplan":
        for (const c of node.children) { counter++; skipDesc(c); }
        break;
      case "decorator":
        if (node.child) { counter++; skipDesc(node.child); }
        break;
    }
  }

  function walk(node: BtNode): BtNode {
    const idx = counter++;
    if (idx === decoratorIdx && node.kind === "decorator") {
      if (node.child) { counter++; skipDesc(node.child); }
      return { ...node, child: newChild };
    }
    switch (node.kind) {
      case "selector":
      case "sequence":
      case "parallel":
      case "subplan":
        return { ...node, children: node.children.map(walk) };
      case "decorator":
        return { ...node, child: node.child ? walk(node.child) : undefined };
      case "leaf":
      case "subtree":
        return node;
    }
  }

  return walk(root);
}

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
      case "selector":
      case "sequence":
      case "parallel":
      case "subplan":
        for (const c of node.children) { counter++; skipDesc(c); }
        break;
      case "decorator":
        if (node.child) { counter++; skipDesc(node.child); }
        break;
    }
  }

  function walk(node: BtNode): BtNode {
    const id = idOrder[counter++];
    if (id === targetId) { skipDesc(node); return updated; }
    switch (node.kind) {
      case "selector":
      case "sequence":
      case "parallel":
      case "subplan":
        return { ...node, children: node.children.map(walk) };
      case "decorator":
        return { ...node, child: node.child ? walk(node.child) : undefined };
      case "leaf":
      case "subtree":
        return node;
    }
  }

  return walk(root);
}

function isComposite(node: BtNode): node is Extract<BtNode, { children: BtNode[] }> {
  return node.kind === "selector" || node.kind === "sequence" || node.kind === "parallel" || node.kind === "subplan";
}

function _substituteBindingNameInTree(node: BtNode, oldName: string, newName: string): BtNode {
  const placeholder = `$${oldName}`;
  const newPlaceholder = `$${newName}`;

  function subStr(v: string): string {
    return v === placeholder ? newPlaceholder : v;
  }

  function subStrOrArr(v: string | string[]): string | string[] {
    return Array.isArray(v) ? v.map(subStr) : subStr(v);
  }

  function walk(n: BtNode): BtNode {
    switch (n.kind) {
      case "selector":
      case "sequence":
      case "parallel":
      case "subplan":
        return { ...n, children: n.children.map(walk) };
      case "decorator": {
        const config: Record<string, string | string[]> = {};
        for (const [k, v] of Object.entries(n.config)) config[k] = subStrOrArr(v);
        return { ...n, config, child: n.child ? walk(n.child) : undefined };
      }
      case "leaf":
        return { ...n, args: n.args.map(subStr) };
      case "subtree":
        return n;
    }
  }

  return walk(node);
}

// ──────────────────────────────────────────────────────────────────────────────
// Pending-group extraction helpers
// ──────────────────────────────────────────────────────────────────────────────

/**
 * Extract the BtNode subtree rooted at DFS index `targetIdx` from `root`.
 * Returns the modified tree (null if root itself was extracted), the extracted
 * subtree, and the count of nodes removed.
 */
function extractBtNodeAtDfsIndex(
  root: BtNode,
  targetIdx: number,
): { newRoot: BtNode | null; extracted: BtNode | null; removedCount: number } {
  let counter = 0;
  let extracted: BtNode | null = null;
  let removedCount = 0;

  function walk(node: BtNode): BtNode | null {
    const idx = counter++;
    if (idx === targetIdx) {
      extracted = node;
      removedCount = _countBtNodes(node);
      counter += removedCount - 1;
      return null;
    }
    switch (node.kind) {
      case "selector":
      case "sequence":
      case "parallel":
      case "subplan": {
        const kids: BtNode[] = [];
        for (const c of node.children) {
          const r = walk(c);
          if (r !== null) kids.push(r);
        }
        return { ...node, children: kids };
      }
      case "decorator": {
        if (!node.child) return node;
        const newChild = walk(node.child);
        return { ...node, child: newChild ?? undefined };
      }
      case "leaf":
      case "subtree":
        return node;
    }
  }

  const newRoot = walk(root);
  return { newRoot, extracted, removedCount };
}

/**
 * Extract the sub-tree rooted at `nodeId` from a pending group.
 * Returns the updated group (null if the whole group was extracted),
 * the extracted BtNode, and the sets of RF node/edge IDs that were removed.
 * Returns null if `nodeId` is not found in the group.
 */
function extractFromPendingGroup(
  group: PendingGroup,
  nodeId: string,
  rfEdges: Edge[],
): {
  updatedGroup: PendingGroup | null;
  extracted: BtNode | null;
  removedNodeIds: Set<string>;
  removedEdgeIds: Set<string>;
} | null {
  const idx = group.nodeIds.indexOf(nodeId);
  if (idx < 0) return null;

  const { newRoot, extracted, removedCount } = extractBtNodeAtDfsIndex(group.btNode, idx);
  const removedNodeIds = new Set(group.nodeIds.slice(idx, idx + removedCount));
  const removedEdgeIds = new Set<string>(
    group.edgeIds.filter((eid) => {
      const e = rfEdges.find((e) => e.id === eid);
      return e !== undefined && (removedNodeIds.has(e.source) || removedNodeIds.has(e.target));
    }),
  );

  const updatedGroup: PendingGroup | null =
    newRoot === null
      ? null
      : {
          ...group,
          btNode: newRoot,
          nodeIds: group.nodeIds.filter((id) => !removedNodeIds.has(id)),
          edgeIds: group.edgeIds.filter((id) => !removedEdgeIds.has(id)),
        };

  return { updatedGroup, extracted, removedNodeIds, removedEdgeIds };
}

/**
 * Remove all nodes whose RF id is in `removeIds` from the BtNode tree in one
 * DFS pass. Uses `treeNodes` (in DFS order) to map RF ids to tree positions.
 */
function removeMultipleFromTree(root: BtNode, removeIds: Set<string>, treeNodes: Node[]): BtNode {
  const idOrder = treeNodes.map((n) => n.id);
  let counter = 0;

  function walk(node: BtNode): BtNode | null {
    const id = idOrder[counter++];
    if (removeIds.has(id)) {
      counter += _countBtNodes(node) - 1;
      return null;
    }
    switch (node.kind) {
      case "selector":
      case "sequence":
      case "parallel":
      case "subplan": {
        const kids: BtNode[] = [];
        for (const c of node.children) {
          const r = walk(c);
          if (r !== null) kids.push(r);
        }
        return { ...node, children: kids };
      }
      case "decorator": {
        if (!node.child) return node;
        const newChild = walk(node.child);
        return { ...node, child: newChild ?? undefined };
      }
      case "leaf":
      case "subtree":
        return node;
    }
  }

  return walk(root) ?? root;
}
