import React, { useCallback, useEffect } from "react";
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
import { SubtreeNode } from "./components/nodes/SubtreeNode";
import { NodePalette } from "./components/NodePalette";
import { NodeConfigPanel } from "./components/NodeConfigPanel";
import { useBtEditor } from "./hooks/useBtEditor";
import type { BtNode } from "../../shared/types";
import { BT_PARALLEL_FAILURE_ONE, BT_PARALLEL_SUCCESS_ALL } from "../../shared/btConstants";

const nodeTypes = {
  selectorNode: SelectorNode,
  sequenceNode: SequenceNode,
  parallelNode: ParallelNode,
  leafNode: LeafNode,
  decoratorNode: DecoratorNode,
  subtreeNode: SubtreeNode,
};

function BtEditorInner() {
  const { state, postMessage, saveAst, revealInFile, revealType, updateNode, selectNode, relayout, onNodesChange, onEdgesChange, addPendingNode, clearPendingNodes, connectOrMove, openSubtree } =
    useBtEditor();

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

  // Ctrl+S to save
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === "s") {
        e.preventDefault();
        const sub = state.subtrees[state.activeIndex];
        if (sub) saveAst(state.activeIndex, sub.root);
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [saveAst, state]);

  const onNodeClick: NodeMouseHandler = useCallback(
    (_e, node: Node) => {
      selectNode(node.id);
    },
    [selectNode],
  );

  const onNodeDoubleClick: NodeMouseHandler = useCallback(
    (_e, node: Node) => {
      const btNode = node.data._btNode as BtNode;
      if (btNode.kind === "subtree" || btNode.kind === "leaf") {
        revealType(btNode.behaviorType);
      } else if (btNode.kind === "decorator") {
        revealType(btNode.nodeType);
      }
    },
    [revealType],
  );

  const onPaneClick = useCallback(() => {
    selectNode(null);
  }, [selectNode]);

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
          newNode = { kind: "parallel", failurePolicy: BT_PARALLEL_FAILURE_ONE, successPolicy: BT_PARALLEL_SUCCESS_ALL, children: [] };
          break;
        case "leaf":
          newNode = { kind: "leaf", behaviorType: behaviorType || "/datum/ai_behavior/todo", args: [] };
          break;
        case "decorator":
          newNode = {
            kind: "decorator",
            nodeType: decoratorType || "/datum/bt_node/decorator/todo",
            child: { kind: "leaf", behaviorType: "/datum/ai_behavior/todo", args: [] },
            config: {},
          };
          break;
        case "subtree":
          newNode = { kind: "subtree", behaviorType: subtreePath || "/datum/bt_node/subtree/todo" };
          break;
        default:
          return;
      }
      const pos = screenToFlowPosition({ x: e.clientX, y: e.clientY });
      addPendingNode(newNode, pos.x, pos.y);
    },
    [addPendingNode, screenToFlowPosition],
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

  const selectedNode = state.selectedNodeId
    ? state.nodes.find((n) => n.id === state.selectedNodeId)
    : null;

  const selectedBtNode = selectedNode
    ? (selectedNode.data._btNode as BtNode)
    : null;

  const activeSub = state.subtrees[state.activeIndex];

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100vh", background: "var(--vscode-editor-background, #1e1e1e)" }}>
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

        <button onClick={relayout} style={btnStyle}>Re-layout</button>

        <button
          onClick={() => postMessage({ type: "refresh_types" })}
          style={btnStyle}
          title="Re-scan workspace for behavior/decorator type definitions"
        >
          Refresh Types
        </button>

        <button
          onClick={() => {
            if (state.pendingNodes.length > 0) clearPendingNodes();
            if (activeSub) saveAst(state.activeIndex, activeSub.root);
          }}
          style={{ ...btnStyle, ...(state.isDirty ? { borderColor: "#f0a500", color: "#f0a500" } : {}) }}
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
        {state.pendingNodes.length > 0 && (
          <div style={{ background: "#f0a50018", border: "1px solid #f0a500", borderLeft: "none", borderRight: "none", padding: "4px 12px", fontSize: 11, color: "#f0a500", flexShrink: 0, display: "flex", alignItems: "center", gap: 8 }}>
            ⚠ {state.pendingNodes.length} unconnected node{state.pendingNodes.length > 1 ? "s" : ""} — connect them to the tree, or they will be discarded on save.
            <button onClick={clearPendingNodes} style={{ ...btnStyle, fontSize: 10, padding: "1px 7px" }}>Discard</button>
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
            deleteKeyCode={["Delete", "Backspace"]}
            onNodeClick={onNodeClick}
            onNodeDoubleClick={onNodeDoubleClick}
            onPaneClick={onPaneClick}
            fitView
            panOnDrag={false}
            panOnScroll={true}
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
                if (type.includes("selector")) return "#4CAF50";
                if (type.includes("sequence")) return "#2196F3";
                if (type.includes("parallel")) return "#9C27B0";
                if (type.includes("leaf")) return "#FF9800";
                if (type.includes("subtree")) return "#26C6DA";
                return "#607D8B";
              }}
            />
            <Background color="#333" gap={20} />
          </ReactFlow>
          </div>
        </div>

        {selectedBtNode && state.selectedNodeId && (
          <NodeConfigPanel
            node={{ ...selectedBtNode, id: state.selectedNodeId }}
            onUpdate={(updated) => updateNode(state.selectedNodeId!, updated)}
            onClose={() => selectNode(null)}
            typeVars={state.typeVars}
          />
        )}
        </div>{/* end main canvas row */}
      </div>
    </div>
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
