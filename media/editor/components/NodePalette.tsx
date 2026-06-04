import React, { useState, useEffect } from "react";
import type { WebMsg } from "../../../shared/messaging";
import { shortTypePath } from "../utils/typeDisplay";

interface NodePaletteProps {
  postMessage: (msg: WebMsg) => void;
  behaviors: string[] | null;
  typeVars: Record<string, { params: Array<{ name: string; defaultValue: string }>; vars: Array<{ name: string; defaultValue: string }> }> | null;
  subtreeRefs: Array<{ typePath: string; filePath: string; jsonPath?: string; inherited?: boolean }> | null;
  controllerRefs: Array<{ typePath: string; filePath: string; jsonPath?: string; inherited?: boolean }> | null;
  onOpen: (typePath: string, filePath: string, jsonPath?: string, newPanel?: boolean, inherited?: boolean) => void;
  onRevealType: (typePath: string) => void;
}

const STATIC_TILES = [
  { label: "Selector", kind: "selector", color: "#4CAF50", icon: "?" },
  { label: "Sequence", kind: "sequence", color: "#2196F3", icon: "→" },
  { label: "Parallel", kind: "parallel", color: "#9C27B0", icon: "⇉" },
  { label: "Subplan", kind: "subplan", color: "#FFB300", icon: "↺" },
];

export function NodePalette({ postMessage, behaviors, typeVars, subtreeRefs, controllerRefs, onOpen, onRevealType }: NodePaletteProps) {
  const [behaviorsOpen, setBehaviorsOpen] = useState(false);
  const [behaviorsLoaded, setBehaviorsLoaded] = useState(false);
  const [behaviorFilter, setBehaviorFilter] = useState("");
  const [decoratorsOpen, setDecoratorsOpen] = useState(false);
  const [decoratorFilter, setDecoratorFilter] = useState("");
  const [browserOpen, setBrowserOpen] = useState(true);
  const [browserFilter, setBrowserFilter] = useState("");

  // Auto-load subtrees and behaviors on mount
  useEffect(() => {
    postMessage({ type: "load_subtrees" });
  // eslint-disable-next-line react-hooks/exhaustive-deps -- intentionally fires once on mount
  }, []);

  const handleToggleBehaviors = () => {
    setBehaviorsOpen((v) => !v);
    if (!behaviorsLoaded) {
      setBehaviorsLoaded(true);
      postMessage({ type: "load_behaviors" });
    }
  };

  const lc = browserFilter.toLowerCase();
  const filteredBehaviors = behaviors
    ? behaviors.filter((b) => b.toLowerCase().includes(behaviorFilter.toLowerCase()))
    : [];
  const filteredControllers = controllerRefs
    ? controllerRefs
        .filter((c) => c.typePath.toLowerCase().includes(lc))
        .sort((a, b) => a.typePath.localeCompare(b.typePath))
    : [];
  const filteredSubtrees = subtreeRefs
    ? subtreeRefs
        .filter((s) => s.typePath.toLowerCase().includes(lc))
        .sort((a, b) => a.typePath.localeCompare(b.typePath))
    : [];

  const decoratorList = typeVars
    ? Object.keys(typeVars).filter((k) => /^\/datum\/bt_node\/decorator\//.test(k)).sort()
    : null;
  const filteredDecorators = decoratorList
    ? decoratorList.filter((d) => d.toLowerCase().includes(decoratorFilter.toLowerCase()))
    : [];

  return (
    <div
      style={{
        width: 240,
        height: "100%",
        background: "var(--vscode-sideBar-background, #1e1e1e)",
        borderRight: "1px solid var(--vscode-sideBar-border, #333)",
        display: "flex",
        flexDirection: "column",
        overflow: "hidden",
        fontFamily: "var(--vscode-font-family)",
        fontSize: 12,
        color: "var(--vscode-editor-foreground, #ccc)",
      }}
    >
      {/* Static drag tiles */}
      <div style={{ padding: "8px 8px 4px", flexShrink: 0 }}>
        {STATIC_TILES.map((tile) => (
          <div
            key={tile.kind}
            draggable
            onDragStart={(e) => {
              e.dataTransfer.setData("application/bt-node-kind", tile.kind);
              e.dataTransfer.effectAllowed = "copy";
            }}
            style={{
              display: "flex",
              alignItems: "center",
              gap: 8,
              padding: "5px 8px",
              marginBottom: 3,
              background: "var(--vscode-editor-background, #252526)",
              border: `1px solid ${tile.color}44`,
              borderLeft: `3px solid ${tile.color}`,
              borderRadius: 3,
              cursor: "grab",
              userSelect: "none",
            }}
          >
            <span style={{ color: tile.color, fontSize: 14 }}>{tile.icon}</span>
            <span>{tile.label}</span>
          </div>
        ))}
      </div>

      {/* ── Behavior Types (collapsible, lazy) ── */}
      <SectionHeader label="Behavior Types" open={behaviorsOpen} onToggle={handleToggleBehaviors} />
      {behaviorsOpen && (
        <div style={{ display: "flex", flexDirection: "column", maxHeight: 220, flexShrink: 0 }}>
          {behaviorsLoaded && behaviors === null && (
            <div style={{ padding: "6px 10px", opacity: 0.6, fontSize: 11 }}>Loading…</div>
          )}
          {behaviors !== null && (
            <>
              <div style={{ padding: "4px 8px", flexShrink: 0 }}>
                <PaletteFilter value={behaviorFilter} onChange={setBehaviorFilter} />
              </div>
              <div style={{ overflowY: "auto", padding: "0 8px 6px" }}>
                {filteredBehaviors.map((b) => (
                  <div
                    key={b}
                    draggable
                    onDragStart={(e) => {
                      e.dataTransfer.setData("application/bt-node-kind", "leaf");
                      e.dataTransfer.setData("application/bt-behavior-type", b);
                      e.dataTransfer.effectAllowed = "copy";
                    }}
                    onDoubleClick={() => onRevealType(b)}
                    title={b}
                    style={{
                      padding: "3px 6px",
                      marginBottom: 2,
                      background: "var(--vscode-editor-background, #252526)",
                      border: "1px solid #FF980044",
                      borderLeft: "3px solid #FF9800",
                      borderRadius: 3,
                      cursor: "grab",
                      fontSize: 10,
                      overflow: "hidden",
                      textOverflow: "ellipsis",
                      whiteSpace: "nowrap",
                      userSelect: "none",
                    }}
                  >
                    {shortTypePath(b)}
                  </div>
                ))}
              </div>
            </>
          )}
        </div>
      )}

      {/* ── Decorator Types (auto-loaded from typeVars scan) ── */}
      <SectionHeader label="Decorator Types" open={decoratorsOpen} onToggle={() => setDecoratorsOpen((v) => !v)} />
      {decoratorsOpen && (
        <div style={{ display: "flex", flexDirection: "column", maxHeight: 220, flexShrink: 0 }}>
          {typeVars === null && (
            <div style={{ padding: "6px 10px", opacity: 0.6, fontSize: 11 }}>Scanning…</div>
          )}
          {decoratorList !== null && (
            <>
              <div style={{ padding: "4px 8px", flexShrink: 0 }}>
                <PaletteFilter value={decoratorFilter} onChange={setDecoratorFilter} />
              </div>
              <div style={{ overflowY: "auto", padding: "0 8px 6px" }}>
                {filteredDecorators.map((d) => (
                  <div
                    key={d}
                    draggable
                    onDragStart={(e) => {
                      e.dataTransfer.setData("application/bt-node-kind", "decorator");
                      e.dataTransfer.setData("application/bt-decorator-type", d);
                      e.dataTransfer.effectAllowed = "copy";
                    }}
                    onDoubleClick={() => onRevealType(d)}
                    title={d}
                    style={{
                      padding: "3px 6px",
                      marginBottom: 2,
                      background: "var(--vscode-editor-background, #252526)",
                      border: "1px solid #607D8B44",
                      borderLeft: "3px solid #607D8B",
                      borderRadius: 3,
                      cursor: "grab",
                      fontSize: 10,
                      overflow: "hidden",
                      textOverflow: "ellipsis",
                      whiteSpace: "nowrap",
                      userSelect: "none",
                    }}
                  >
                    {shortTypePath(d)}
                  </div>
                ))}
                {filteredDecorators.length === 0 && decoratorFilter && (
                  <div style={{ opacity: 0.5, fontSize: 11, padding: "4px 6px" }}>No matches.</div>
                )}
                {filteredDecorators.length === 0 && !decoratorFilter && decoratorList.length === 0 && (
                  <div style={{ opacity: 0.5, fontSize: 11, padding: "4px 6px" }}>No decorators found.</div>
                )}
              </div>
            </>
          )}
        </div>
      )}

      {/* ── Browser (auto-loaded, controllers + subtrees) ── */}
      <SectionHeader label="Browser" open={browserOpen} onToggle={() => setBrowserOpen((v) => !v)} />
      {browserOpen && (
        <div style={{ flex: 1, display: "flex", flexDirection: "column", minHeight: 0 }}>
          <div style={{ padding: "4px 8px", flexShrink: 0 }}>
            <PaletteFilter value={browserFilter} onChange={setBrowserFilter} />
          </div>

          {subtreeRefs === null && controllerRefs === null && (
            <div style={{ padding: "6px 10px", opacity: 0.6, fontSize: 11 }}>Scanning workspace…</div>
          )}

          <div style={{ flex: 1, overflowY: "auto", padding: "0 8px 8px" }}>
            {/* AI Controllers */}
            {filteredControllers.length > 0 && (
              <>
                <BrowserGroupLabel label="AI Controllers" />
                {filteredControllers.map((c) => (
                  <BrowserItem
                    key={c.typePath}
                    typePath={c.typePath}
                    color={c.inherited ? "#FFB74D" : c.jsonPath ? "#F06292" : "#F44336"}
                    inherited={c.inherited}
                    onClick={() => onOpen(c.typePath, c.filePath, c.jsonPath, true, c.inherited)}
                    onDoubleClick={() => onRevealType(c.typePath)}
                  />
                ))}
              </>
            )}

            {/* Subtrees */}
            {filteredSubtrees.length > 0 && (
              <>
                <BrowserGroupLabel label="Subtrees" />
                {filteredSubtrees.map((s) => (
                  <BrowserItem
                    key={s.typePath}
                    typePath={s.typePath}
                    color="#26C6DA"
                    draggable
                    onDragStart={(e) => {
                      e.dataTransfer.setData("application/bt-node-kind", "subtree");
                      e.dataTransfer.setData("application/bt-subtree-path", s.typePath);
                      e.dataTransfer.effectAllowed = "copy";
                    }}
                    onClick={() => onOpen(s.typePath, s.filePath, s.jsonPath, true)}
                    onDoubleClick={() => onRevealType(s.typePath)}
                  />
                ))}
              </>
            )}

            {(subtreeRefs !== null || controllerRefs !== null) &&
              filteredControllers.length === 0 &&
              filteredSubtrees.length === 0 && (
                <div style={{ padding: "4px 6px", opacity: 0.5, fontSize: 11 }}>
                  {browserFilter ? "No matches." : "No controllers or subtrees found."}
                </div>
              )}
          </div>
        </div>
      )}
    </div>
  );
}

// ── Helper components ──────────────────────────────────────────────────────

function SectionHeader({
  label,
  open,
  onToggle,
}: {
  label: string;
  open: boolean;
  onToggle: () => void;
}) {
  return (
    <button
      onClick={onToggle}
      style={{
        display: "flex",
        alignItems: "center",
        gap: 4,
        width: "100%",
        padding: "5px 10px",
        background: "none",
        border: "none",
        borderTop: "1px solid #333",
        color: "var(--vscode-editor-foreground, #ccc)",
        fontFamily: "var(--vscode-font-family)",
        fontSize: 11,
        fontWeight: 600,
        textTransform: "uppercase" as const,
        opacity: 0.7,
        cursor: "pointer",
        textAlign: "left" as const,
        flexShrink: 0,
      }}
    >
      <span style={{ fontSize: 9 }}>{open ? "▼" : "▶"}</span>
      {label}
    </button>
  );
}

function PaletteFilter({
  value,
  onChange,
}: {
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <input
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder="Filter…"
      style={{
        width: "100%",
        boxSizing: "border-box" as const,
        background: "var(--vscode-input-background, #3c3c3c)",
        color: "var(--vscode-input-foreground, #ccc)",
        border: "1px solid var(--vscode-input-border, #555)",
        borderRadius: 3,
        padding: "3px 6px",
        fontSize: 11,
      }}
    />
  );
}

function BrowserGroupLabel({ label }: { label: string }) {
  return (
    <div
      style={{
        fontSize: 10,
        fontWeight: 600,
        textTransform: "uppercase" as const,
        opacity: 0.5,
        padding: "6px 2px 2px",
        letterSpacing: "0.05em",
      }}
    >
      {label}
    </div>
  );
}

function BrowserItem({
  typePath,
  color,
  inherited,
  onClick,
  onDoubleClick,
  draggable,
  onDragStart,
}: {
  typePath: string;
  color: string;
  inherited?: boolean;
  onClick: () => void;
  onDoubleClick?: () => void;
  draggable?: boolean;
  onDragStart?: (e: React.DragEvent) => void;
}) {
  return (
    <div
      draggable={draggable}
      onDragStart={onDragStart}
      onClick={onClick}
      onDoubleClick={onDoubleClick}
      title={inherited ? `${typePath}\n(inherits tree from parent)` : typePath}
      style={{
        padding: "3px 6px",
        marginBottom: 2,
        background: "var(--vscode-editor-background, #252526)",
        border: `1px solid ${color}44`,
        borderLeft: `3px solid ${color}`,
        borderRadius: 3,
        cursor: draggable ? "grab" : "pointer",
        fontSize: 10,
        overflow: "hidden",
        textOverflow: "ellipsis",
        whiteSpace: "nowrap" as const,
        userSelect: "none" as const,
        display: "flex",
        alignItems: "center",
        gap: 4,
      }}
    >
      {inherited && <span style={{ opacity: 0.7, flexShrink: 0 }}>↑</span>}
      <span style={{ overflow: "hidden", textOverflow: "ellipsis" }}>{shortTypePath(typePath)}</span>
    </div>
  );
}
