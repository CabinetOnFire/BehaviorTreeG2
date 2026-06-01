import React, { useCallback, useEffect, useState } from "react";
import {
  ReactFlow,
  Controls,
  MiniMap,
  Background,
  useReactFlow,
  ReactFlowProvider,
  type NodeMouseHandler,
  type Node,
  type Edge,
  type Connection,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import "./btEditor.css";

import { SelectorNode } from "./components/nodes/SelectorNode";
import { SequenceNode } from "./components/nodes/SequenceNode";
import { ParallelNode } from "./components/nodes/ParallelNode";
import { LeafNode } from "./components/nodes/LeafNode";
import { DecoratorNode } from "./components/nodes/DecoratorNode";
import { SubplanNode } from "./components/nodes/SubplanNode";
import { SubtreeNode } from "./components/nodes/SubtreeNode";
import { RootNode } from "./components/nodes/RootNode";
import { ROOT_NODE_ID } from "./layout/dagreLayout";
import { NodePalette } from "./components/NodePalette";
import { NodeConfigPanel } from "./components/NodeConfigPanel";
import { useBtEditor } from "./hooks/useBtEditor";
import type { BtNode } from "../../shared/types";
import {
  BT_PARALLEL_FAILURE_CHILD_ONE,
  BT_PARALLEL_SUCCESS_CHILD_ONE,
  BT_SUBPLAN_SUCCEED_ON_SUCCESS,
  BT_SUBPLAN_FAIL_ON_FAILURE,
} from "../../shared/btConstants";
import { TypeVarsContext } from "./contexts/TypeVarsContext";

const nodeTypes = {
  selectorNode: SelectorNode,
  sequenceNode: SequenceNode,
  parallelNode: ParallelNode,
  subplanNode: SubplanNode,
  leafNode: LeafNode,
  decoratorNode: DecoratorNode,
  subtreeNode: SubtreeNode,
  rootNode: RootNode,
};

function BtEditorInner() {
  const {
    state,
    postMessage,
    saveAst,
    revealInFile,
    revealType,
    updateNode,
    updateNodeAndBindings,
    renameBinding,
    clearSelection,
    relayout,
    onNodesChange,
    onEdgesChange,
    addPendingNode,
    clearPendingNodes,
    connectOrMove,
    replaceNode,
    replaceRoot,
    copyNodes,
    openSubtree,
    undo,
    redo,
    onNodeDragStop,
  } = useBtEditor();

  const { fitView, screenToFlowPosition } = useReactFlow();

  // Signal extension host that React has mounted and is ready to receive messages
  useEffect(() => {
    postMessage({ type: "ready" });
    // fires once on mount
  }, []);

  // Re-fit view only when a true layout rebuild happens (file open, relayout button)
  // — NOT on drag or click, which also mutate state.nodes.
  useEffect(() => {
    if (state.nodes.length > 0) {
      setTimeout(() => fitView({ padding: 0.15 }), 50);
    }
  }, [state.layoutVersion, fitView]);

  // Keyboard shortcuts: Ctrl+S save, Ctrl+Z undo, Ctrl+Y / Ctrl+Shift+Z redo, Ctrl+C copy, Ctrl+V paste, Delete/Backspace
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      const mod = e.ctrlKey || e.metaKey;
      const t = e.target as HTMLElement;
      const active = document.activeElement as HTMLElement;
      const inField =
        t.tagName === "INPUT" || t.tagName === "TEXTAREA" ||
        t.tagName === "SELECT" || t.isContentEditable ||
        active.tagName === "INPUT" || active.tagName === "TEXTAREA" ||
        active.tagName === "SELECT" || active.isContentEditable;

      if (mod && e.key === "s") {
        if (inField) return;
        e.preventDefault();
        const sub = state.subtrees[state.activeIndex];
        if (sub) saveAst(state.activeIndex, sub.root);
      } else if (mod && e.key === "z" && !e.shiftKey) {
        if (inField) return;
        e.preventDefault();
        undo();
      } else if (mod && (e.key === "y" || (e.key === "z" && e.shiftKey))) {
        if (inField) return;
        e.preventDefault();
        redo();
      } else if (mod && e.key === "c") {
        if (inField) return;
        const selectedIds = state.nodes
          .filter((n) => n.selected && n.id !== ROOT_NODE_ID)
          .map((n) => n.id);
        if (selectedIds.length > 0) {
          e.preventDefault();
          copyNodes(selectedIds);
        }
      } else if (mod && e.key === "v") {
        if (inField) return;
        if (state.clipboard.length > 0) {
          e.preventDefault();
          const center = screenToFlowPosition({
            x: window.innerWidth / 2,
            y: window.innerHeight / 2,
          });
          state.clipboard.forEach((btNode, i) => {
            addPendingNode(btNode, center.x + i * 30, center.y + i * 30);
          });
        }
      } else if ((e.key === "Delete" || e.key === "Backspace") && !inField) {
        const selectedIds = state.nodes
          .filter((n) => n.selected && n.id !== ROOT_NODE_ID)
          .map((n) => n.id);
        if (selectedIds.length > 0) {
          e.preventDefault();
          onNodesChange(selectedIds.map((id) => ({ type: "remove" as const, id })));
        }
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [saveAst, undo, redo, copyNodes, addPendingNode, screenToFlowPosition, onNodesChange, state]);

  // ReactFlow handles single/multi-selection natively; no manual tracking needed.
  const onNodeClick: NodeMouseHandler = useCallback((_e, _node: Node) => {}, []);

  const onNodeDoubleClick: NodeMouseHandler = useCallback(
    (_e, node: Node) => {
      if (node.id === ROOT_NODE_ID) return;
      const btNode = node.data._btNode as BtNode;
      if (btNode.kind === "subtree") {
        const allRefs = [...(state.subtreeRefs ?? []), ...(state.controllerRefs ?? [])];
        const ref = allRefs.find((r) => r.typePath === btNode.behaviorType);
        if (ref) openSubtree(ref.typePath, ref.filePath, ref.jsonPath);
      } else if (btNode.kind === "leaf") {
        revealType(btNode.behaviorType);
      } else if (btNode.kind === "decorator") {
        revealType(btNode.nodeType);
      }
    },
    [revealType, openSubtree, state.subtreeRefs, state.controllerRefs],
  );

  const [ctxMenu, setCtxMenu] = useState<{
    x: number;
    y: number;
    btNode: BtNode;
  } | null>(null);

  const onNodeContextMenu = useCallback(
    (e: React.MouseEvent, node: Node) => {
      if (node.id === ROOT_NODE_ID) return;
      e.preventDefault();
      setCtxMenu({ x: e.clientX, y: e.clientY, btNode: node.data._btNode as BtNode });
    },
    [],
  );

  const onPaneClick = useCallback(() => {
    setCtxMenu(null);
  }, []);

  const onDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      const kind = e.dataTransfer.getData("application/bt-node-kind");
      if (!kind) return;
      const behaviorType = e.dataTransfer.getData("application/bt-behavior-type");
      const subtreePath = e.dataTransfer.getData("application/bt-subtree-path");
      const decoratorType = e.dataTransfer.getData("application/bt-decorator-type");

      let newNode: BtNode;
      switch (kind) {
        case "selector":
          newNode = { kind: "selector", children: [] };
          break;
        case "sequence":
          newNode = { kind: "sequence", children: [] };
          break;
        case "parallel":
          newNode = {
            kind: "parallel",
            failurePolicy: BT_PARALLEL_FAILURE_CHILD_ONE,
            successPolicy: BT_PARALLEL_SUCCESS_CHILD_ONE,
            repeatSecondary: false,
            finishOnPrimary: false,
            children: [],
          };
          break;
        case "leaf":
          newNode = {
            kind: "leaf",
            behaviorType: behaviorType || "/datum/bt_node/ai_behavior/todo",
            args: [],
          };
          break;
        case "decorator":
          newNode = {
            kind: "decorator",
            nodeType: decoratorType || "/datum/bt_node/decorator/todo",
            config: {},
          };
          break;
        case "subplan":
          newNode = {
            kind: "subplan",
            successPolicy: BT_SUBPLAN_SUCCEED_ON_SUCCESS,
            failurePolicy: BT_SUBPLAN_FAIL_ON_FAILURE,
            children: [],
          };
          break;
        case "subtree":
          newNode = { kind: "subtree", behaviorType: subtreePath || "/datum/bt_node/subtree/todo" };
          break;
        default:
          return;
      }
      // Walk up the DOM from the cursor to find a ReactFlow node element
      let el: Element | null = document.elementFromPoint(e.clientX, e.clientY);
      while (el && !el.classList.contains("react-flow__node")) {
        el = el.parentElement;
      }
      const hitNodeId = el?.getAttribute("data-id") ?? null;

      if (hitNodeId === ROOT_NODE_ID) {
        replaceRoot(newNode);
      } else if (hitNodeId && !hitNodeId.startsWith("pending-")) {
        replaceNode(hitNodeId, newNode);
      } else {
        const pos = screenToFlowPosition({ x: e.clientX, y: e.clientY });
        addPendingNode(newNode, pos.x, pos.y);
      }
    },
    [addPendingNode, replaceNode, screenToFlowPosition],
  );

  const onConnect = useCallback(
    (connection: Connection) => {
      if (connection.source && connection.target) {
        connectOrMove(connection.source, connection.target);
      }
    },
    [connectOrMove],
  );

  const onReconnect = useCallback(
    (oldEdge: Edge, newConnection: Connection) => {
      if (newConnection.source && oldEdge.target) {
        connectOrMove(newConnection.source, oldEdge.target);
      }
    },
    [connectOrMove],
  );

  // Show config panel only for a single selected tree node (not root, not pending).
  const selectedTreeNodes = state.nodes.filter(
    (n) => n.selected && n.id !== ROOT_NODE_ID && !n.id.startsWith("pending-"),
  );
  const selectedNode = selectedTreeNodes.length === 1 ? selectedTreeNodes[0] : null;
  const selectedBtNode = selectedNode ? (selectedNode.data._btNode as BtNode) : null;

  const activeSub = state.subtrees[state.activeIndex];

  return (
    <TypeVarsContext.Provider value={state.typeVars}>
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          height: "100vh",
          background: "var(--vscode-editor-background, #1e1e1e)",
        }}
      >
        {/* Top bar */}
        <div
          style={{
            height: 38,
            display: "flex",
            alignItems: "center",
            gap: 8,
            padding: "0 10px",
            background: "var(--vscode-titleBar-activeBackground, #252526)",
            borderBottom: "1px solid var(--vscode-titleBar-border, #333)",
            flexShrink: 0,
            fontFamily: "var(--vscode-font-family)",
            fontSize: 12,
            color: "var(--vscode-editor-foreground, #ccc)",
          }}
        >
          {/* Current subtree name */}
          <span
            style={{
              fontFamily: "monospace",
              fontSize: 11,
              opacity: 0.8,
              maxWidth: 320,
              overflow: "hidden",
              textOverflow: "ellipsis",
              whiteSpace: "nowrap",
            }}
            title={activeSub?.typePath}
          >
            {activeSub?.typePath ?? "—"}
          </span>

          <button
            onClick={undo}
            disabled={state.past.length === 0}
            style={{ ...btnStyle, opacity: state.past.length === 0 ? 0.4 : 1 }}
            title="Undo (Ctrl+Z)"
          >
            Undo
          </button>

          <button
            onClick={redo}
            disabled={state.future.length === 0}
            style={{ ...btnStyle, opacity: state.future.length === 0 ? 0.4 : 1 }}
            title="Redo (Ctrl+Y)"
          >
            Redo
          </button>

          <button onClick={relayout} style={btnStyle}>
            Re-layout
          </button>

          <button
            onClick={() => postMessage({ type: "refresh_types" })}
            style={btnStyle}
            title="Re-scan workspace for behavior/decorator type definitions"
          >
            Refresh Types
          </button>

          <button
            onClick={() => {
              if (state.pendingGroups.length > 0) clearPendingNodes();
              if (activeSub) saveAst(state.activeIndex, activeSub.root);
            }}
            style={{
              ...btnStyle,
              ...(state.isDirty ? { borderColor: "#f0a500", color: "#f0a500" } : {}),
            }}
            title="Save changes to .bt.json (Ctrl+S)"
          >
            Save {state.isDirty ? "●" : ""}
          </button>

          <button onClick={() => revealInFile(state.activeIndex)} style={btnStyle}>
            Go to Source
          </button>

          {state.isDirty && (
            <span style={{ marginLeft: 4, color: "#f0a500", fontSize: 11 }}>● Unsaved changes</span>
          )}
        </div>

        {/* Body */}
        <div style={{ flex: 1, display: "flex", overflow: "hidden", flexDirection: "column" }}>
          {/* Pending nodes warning */}
          {state.pendingGroups.length > 0 && (
            <div
              style={{
                background: "#f0a50018",
                border: "1px solid #f0a500",
                borderLeft: "none",
                borderRight: "none",
                padding: "4px 12px",
                fontSize: 11,
                color: "#f0a500",
                flexShrink: 0,
                display: "flex",
                alignItems: "center",
                gap: 8,
              }}
            >
              ⚠ {state.pendingGroups.length} disconnected subtree
              {state.pendingGroups.length > 1 ? "s" : ""} — connect them to the tree, or they will
              be discarded on save.
              <button
                onClick={clearPendingNodes}
                style={{ ...btnStyle, fontSize: 10, padding: "1px 7px" }}
              >
                Discard
              </button>
            </div>
          )}
          {/* Main canvas row */}
          <div style={{ flex: 1, display: "flex", overflow: "hidden" }}>
            <NodePalette
              postMessage={postMessage}
              behaviors={state.behaviors}
              typeVars={state.typeVars}
              subtreeRefs={state.subtreeRefs}
              controllerRefs={state.controllerRefs}
              onOpen={openSubtree}
              onRevealType={revealType}
            />

            <div style={{ flex: 1, position: "relative", minHeight: 0, minWidth: 0 }}>
              <div
                style={{ position: "absolute", inset: 0 }}
                onDragOver={(e) => e.preventDefault()}
                onDrop={onDrop}
              >
                <ReactFlow
                  nodes={state.nodes}
                  edges={state.edges}
                  nodeTypes={nodeTypes}
                  onNodesChange={onNodesChange}
                  onEdgesChange={onEdgesChange}
                  onConnect={onConnect}
                  onReconnect={onReconnect}
                  edgesReconnectable={true}
                  deleteKeyCode={null}
                  onNodeClick={onNodeClick}
                  onNodeDoubleClick={onNodeDoubleClick}
                  onNodeContextMenu={onNodeContextMenu}
                  onNodeDragStop={onNodeDragStop}
                  onPaneClick={onPaneClick}
                  fitView
                  panOnDrag={[1, 2]}
                  panOnScroll={true}
                  multiSelectionKeyCode="Control"
                  selectionKeyCode={null}
                  proOptions={{ hideAttribution: true }}
                >
                  <Controls />
                  <MiniMap
                    style={{
                      background: "var(--vscode-editor-background, #1e1e1e)",
                      border: "1px solid #444",
                    }}
                    nodeColor={(n) => {
                      const type = n.type ?? "";
                      if (type === "rootNode") return "#444";
                      if (type.includes("selector")) return "#4CAF50";
                      if (type.includes("sequence")) return "#2196F3";
                      if (type.includes("parallel")) return "#9C27B0";
                      if (type.includes("subplan")) return "#FFB300";
                      if (type.includes("leaf")) return "#FF9800";
                      if (type.includes("subtree")) return "#26C6DA";
                      return "#607D8B";
                    }}
                  />
                  <Background color="#333" gap={20} />
                </ReactFlow>
              </div>
            </div>

            {selectedBtNode && selectedNode && (
              <NodeConfigPanel
                node={{ ...selectedBtNode, id: selectedNode.id }}
                onUpdate={(updated) => updateNode(selectedNode.id, updated)}
                onUpdateWithBindings={(updated, bindings) => updateNodeAndBindings(selectedNode.id, updated, bindings)}
                onRenameBinding={renameBinding}
                onClose={() => clearSelection()}
                typeVars={state.typeVars}
                activeSubtreeBindings={state.subtrees[state.activeIndex]?.bindings}
                subtreeBindings={state.subtreeBindings}
              />
            )}
          </div>
          {/* end main canvas row */}
        </div>
      </div>

      {ctxMenu && (
        <div
          style={{
            position: "fixed",
            left: ctxMenu.x,
            top: ctxMenu.y,
            background: "var(--vscode-menu-background, #252526)",
            border: "1px solid var(--vscode-menu-border, #454545)",
            boxShadow: "0 2px 8px rgba(0,0,0,0.4)",
            zIndex: 9999,
            minWidth: 180,
            padding: "4px 0",
          }}
          onMouseLeave={() => setCtxMenu(null)}
        >
          {ctxMenu.btNode.kind === "subtree" && (<>
            <CtxItem label="Open in New Window" onClick={() => {
              const allRefs = [...(state.subtreeRefs ?? []), ...(state.controllerRefs ?? [])];
              const ref = allRefs.find((r) => r.typePath === (ctxMenu.btNode as Extract<BtNode, { kind: "subtree" }>).behaviorType);
              if (ref) openSubtree(ref.typePath, ref.filePath, ref.jsonPath);
              setCtxMenu(null);
            }} />
            <CtxItem label="Go to DM Source" onClick={() => {
              revealType((ctxMenu.btNode as Extract<BtNode, { kind: "subtree" }>).behaviorType);
              setCtxMenu(null);
            }} />
          </>)}
          {ctxMenu.btNode.kind === "leaf" && (
            <CtxItem label="Go to Type Definition" onClick={() => {
              revealType((ctxMenu.btNode as Extract<BtNode, { kind: "leaf" }>).behaviorType);
              setCtxMenu(null);
            }} />
          )}
          {ctxMenu.btNode.kind === "decorator" && (
            <CtxItem label="Go to Type Definition" onClick={() => {
              revealType((ctxMenu.btNode as Extract<BtNode, { kind: "decorator" }>).nodeType);
              setCtxMenu(null);
            }} />
          )}
        </div>
      )}
    </TypeVarsContext.Provider>
  );
}

function CtxItem({ label, onClick }: { label: string; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      style={{
        display: "block",
        width: "100%",
        padding: "5px 12px",
        background: "none",
        border: "none",
        textAlign: "left",
        color: "var(--vscode-menu-foreground, #ccc)",
        cursor: "pointer",
        fontSize: 12,
      }}
    >
      {label}
    </button>
  );
}

export function BtEditorApp() {
  return (
    <ReactFlowProvider>
      <BtEditorInner />
    </ReactFlowProvider>
  );
}

const btnStyle: React.CSSProperties = {
  padding: "3px 10px",
  background: "var(--vscode-button-secondaryBackground, #3c3c3c)",
  color: "var(--vscode-button-secondaryForeground, #ccc)",
  border: "1px solid #555",
  borderRadius: 3,
  cursor: "pointer",
  fontSize: 11,
};

// ---- Entrypoint ----
import ReactDOM from "react-dom/client";

const root = document.getElementById("root");
if (root) {
  ReactDOM.createRoot(root).render(<BtEditorApp />);
}
