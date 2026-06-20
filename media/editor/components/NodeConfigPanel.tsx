import React, { useState, useEffect } from "react";
import type { BtBindingDeclarations, BtNode } from "../../../shared/types";
import {
  BT_ABORT_POLICIES,
  BT_LABELS,
} from "../../../shared/btConstants";
import { COMPOSITE_SCHEMAS } from "../../../shared/compositeSchema";
import { generateBindingId } from "../utils/bindingId";

interface NodeConfigPanelProps {
  node: BtNode & { id: string };
  onUpdate: (updated: BtNode) => void;
  onUpdateWithBindings: (updated: BtNode, bindings: BtBindingDeclarations | undefined) => void;
  onRenameBinding: (oldName: string, newName: string) => void;
  onClose: () => void;
  typeVars: Record<string, { params: Array<{ name: string; defaultValue: string }>; vars: Array<{ name: string; defaultValue: string }> }> | null;
  activeSubtreeBindings: BtBindingDeclarations | undefined;
  subtreeBindings: Record<string, BtBindingDeclarations>;
}

export function NodeConfigPanel({
  node,
  onUpdate,
  onUpdateWithBindings,
  onRenameBinding,
  onClose,
  typeVars,
  activeSubtreeBindings,
  subtreeBindings,
}: NodeConfigPanelProps) {
  return (
    <div
      style={{
        width: 280,
        height: "100%",
        background: "var(--vscode-sideBar-background, #1e1e1e)",
        borderLeft: "1px solid var(--vscode-sideBar-border, #333)",
        display: "flex",
        flexDirection: "column",
        fontFamily: "var(--vscode-font-family)",
        fontSize: 12,
        color: "var(--vscode-editor-foreground, #ccc)",
        overflow: "hidden",
      }}
    >
      <div
        style={{
          padding: "8px 10px",
          borderBottom: "1px solid #333",
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          fontWeight: 600,
          fontSize: 11,
          textTransform: "uppercase",
          opacity: 0.7,
        }}
      >
        <span>Node Config</span>
        <button
          onClick={onClose}
          style={{
            background: "none",
            border: "none",
            color: "inherit",
            cursor: "pointer",
            fontSize: 14,
            opacity: 0.6,
            padding: 0,
          }}
        >
          ✕
        </button>
      </div>

      <div style={{ flex: 1, overflowY: "auto", padding: "10px" }}>
        <NodeConfigBody
          key={node.id}
          node={node}
          onUpdate={onUpdate}
          onUpdateWithBindings={onUpdateWithBindings}
          onRenameBinding={onRenameBinding}
          typeVars={typeVars}
          activeSubtreeBindings={activeSubtreeBindings}
          subtreeBindings={subtreeBindings}
        />
      </div>
    </div>
  );
}

function NodeConfigBody({
  node,
  onUpdate,
  onUpdateWithBindings,
  onRenameBinding,
  typeVars,
  activeSubtreeBindings,
  subtreeBindings,
}: {
  node: BtNode;
  onUpdate: (n: BtNode) => void;
  onUpdateWithBindings: (n: BtNode, bindings: BtBindingDeclarations | undefined) => void;
  onRenameBinding: (oldName: string, newName: string) => void;
  typeVars: Record<string, { params: Array<{ name: string; defaultValue: string }>; vars: Array<{ name: string; defaultValue: string }> }> | null;
  activeSubtreeBindings: BtBindingDeclarations | undefined;
  subtreeBindings: Record<string, BtBindingDeclarations>;
}) {
  switch (node.kind) {
    case "leaf":
    case "decorator":
      return (
        <TypedNodeConfig
          node={node}
          onUpdate={onUpdate}
          onUpdateWithBindings={onUpdateWithBindings}
          onRenameBinding={onRenameBinding}
          typeVars={typeVars}
          activeSubtreeBindings={activeSubtreeBindings}
        />
      );
    case "subtree":
      return (
        <SubtreeConfig
          node={node}
          onUpdate={onUpdate}
          onUpdateWithBindings={onUpdateWithBindings}
          onRenameBinding={onRenameBinding}
          subtreeBindings={subtreeBindings}
          activeSubtreeBindings={activeSubtreeBindings}
        />
      );
    case "parallel":
    case "subplan":
      return <CompositeConfig node={node} onUpdate={onUpdate} />;
    case "selector":
    case "sequence":
      return (
        <div style={{ opacity: 0.6 }}>
          <em>{node.kind}</em> — {node.children.length} children
        </div>
      );
  }
}

// ── Field spec ────────────────────────────────────────────────────────────────

interface _FieldSpec {
  key: string;
  name: string;
  defaultValue: string;
  value: string;
  updateNode: (val: string) => BtNode;
  bindNode: (bindName: string) => BtNode;
  unbindNode: (restored: string) => BtNode;
}

function buildVarsSpecs(
  node: Extract<BtNode, { kind: "leaf" | "decorator" }>,
  varDecls: Array<{ name: string; defaultValue: string }>,
): _FieldSpec[] {
  const flatValues: Record<string, string> = {};
  for (const [k, v] of Object.entries(node.vars)) {
    flatValues[k] = Array.isArray(v) ? v.join(", ") : v;
  }

  const applyConfig = (values: Record<string, string>): Record<string, string | string[]> => {
    const parsed: Record<string, string | string[]> = {};
    for (const v of varDecls) {
      const raw = values[v.name] ?? "";
      if (raw.trim()) {
        parsed[v.name] = raw.includes(",")
          ? raw.split(",").map((s) => s.trim()).filter(Boolean)
          : raw;
      }
    }
    return parsed;
  };

  return varDecls.map((v) => {
    const key = v.name;
    return {
      key,
      name: v.name,
      defaultValue: v.defaultValue,
      value: flatValues[key] ?? "",
      updateNode: (val) => ({ ...node, vars: applyConfig({ ...flatValues, [key]: val }) }),
      bindNode: (bindName) => ({ ...node, vars: { ...node.vars, [key]: `$${bindName}` } }),
      unbindNode: (restored) => {
        const restoredVal: string | string[] = restored.includes(",")
          ? restored.split(",").map((s) => s.trim()).filter(Boolean)
          : restored;
        return { ...node, vars: { ...node.vars, [key]: restoredVal } };
      },
    };
  });
}

// ── Unified leaf + decorator config ──────────────────────────────────────────

function TypedNodeConfig({
  node,
  onUpdate,
  onUpdateWithBindings,
  onRenameBinding,
  typeVars,
  activeSubtreeBindings,
}: {
  node: Extract<BtNode, { kind: "leaf" | "decorator" }>;
  onUpdate: (n: BtNode) => void;
  onUpdateWithBindings: (n: BtNode, bindings: BtBindingDeclarations | undefined) => void;
  onRenameBinding: (oldName: string, newName: string) => void;
  typeVars: Record<string, { params: Array<{ name: string; defaultValue: string }>; vars: Array<{ name: string; defaultValue: string }> }> | null;
  activeSubtreeBindings: BtBindingDeclarations | undefined;
}) {
  const typePath = node.kind === "leaf" ? node.behaviorType : node.nodeType;
  const label = node.kind === "leaf" ? "Behavior Type" : "Decorator Type";
  const entry = typeVars?.[typePath];
  const varDecls = entry?.vars ?? [];
  const specs = buildVarsSpecs(node, varDecls);

  const setTypePath = (val: string): BtNode =>
    node.kind === "leaf" ? { ...node, behaviorType: val } : { ...node, nodeType: val };

  const isTypeBound = typePath.startsWith("$");
  const typeBindingId = isTypeBound ? typePath.slice(1) : null;
  const typeBindingDecl = typeBindingId ? activeSubtreeBindings?.[typeBindingId] : undefined;

  const [pendingTypeBind, setPendingTypeBind] = useState(false);
  const [pendingTypeBindName, setPendingTypeBindName] = useState("");

  const confirmTypeBind = (rawLabel: string) => {
    const lbl = rawLabel.trim();
    if (!lbl) { setPendingTypeBind(false); return; }
    const id = generateBindingId();
    const newBindings: BtBindingDeclarations = {
      ...(activeSubtreeBindings ?? {}),
      [id]: { label: lbl, default: typePath || "" },
    };
    onUpdateWithBindings(setTypePath(`$${id}`), newBindings);
    setPendingTypeBind(false);
  };

  const removeTypeBinding = () => {
    if (!typeBindingId) return;
    const restored = typeBindingDecl?.default ?? "";
    const newBindings = { ...(activeSubtreeBindings ?? {}) };
    delete newBindings[typeBindingId];
    onUpdateWithBindings(
      setTypePath(restored),
      Object.keys(newBindings).length > 0 ? newBindings : undefined,
    );
  };

  const updateTypeBindingDefault = (newDefault: string) => {
    if (!typeBindingDecl || !typeBindingId) return;
    onUpdateWithBindings(node, {
      ...(activeSubtreeBindings ?? {}),
      [typeBindingId]: { ...typeBindingDecl, default: newDefault },
    });
  };

  const [fallbackText, setFallbackText] = useState(() =>
    Object.entries(node.vars)
      .map(([k, v]) => `${k} = ${Array.isArray(v) ? v.join(", ") : v}`)
      .join("\n"),
  );

  const commitFallback = () => {
    const parsed: Record<string, string | string[]> = {};
    for (const line of fallbackText.split("\n")) {
      const eq = line.indexOf("=");
      if (eq === -1) continue;
      const k = line.slice(0, eq).trim();
      const v = line.slice(eq + 1).trim();
      parsed[k] = v.includes(",") ? v.split(",").map((s) => s.trim()).filter(Boolean) : v;
    }
    onUpdate({ ...node, vars: parsed } as BtNode);
  };

  const fallbackHint = typeVars === null
    ? "— scanning…"
    : typePath in typeVars
      ? "— no configurable variables"
      : "— type not found in workspace";

  return (
    <div>
      <FieldLabel>{label}</FieldLabel>
      {isTypeBound && typeBindingId ? (
        <BoundArgRow
          bindingId={typeBindingId}
          bindingDecl={typeBindingDecl}
          onRenameLabel={(id, newLabel) => onRenameBinding(id, newLabel)}
          onRemove={removeTypeBinding}
          onDefaultChange={updateTypeBindingDefault}
        />
      ) : pendingTypeBind ? (
        <div style={{ display: "flex", flexDirection: "column", gap: 2, marginBottom: 4 }}>
          <div style={{ opacity: 0.6, fontSize: 10 }}>Binding slot name:</div>
          <div style={{ display: "flex", gap: 4 }}>
            <input
              autoFocus
              value={pendingTypeBindName}
              onChange={(e) => setPendingTypeBindName(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") confirmTypeBind(pendingTypeBindName);
                if (e.key === "Escape") setPendingTypeBind(false);
              }}
              onBlur={() => confirmTypeBind(pendingTypeBindName)}
              placeholder="slot name"
              style={{ ...inputStyle, flex: 1, fontFamily: "monospace" }}
            />
            <button
              onMouseDown={(e) => { e.preventDefault(); setPendingTypeBind(false); }}
              style={smallButtonStyle}
            >
              ✕
            </button>
          </div>
        </div>
      ) : (
        <div style={{ display: "flex", gap: 4, alignItems: "flex-start" }}>
          <div style={{ flex: 1, minWidth: 0 }}>
            <TypePathLabel>{typePath}</TypePathLabel>
          </div>
          <button
            onClick={() => {
              setPendingTypeBind(true);
              setPendingTypeBindName(node.kind === "leaf" ? "behavior_slot" : "decorator_slot");
            }}
            title="Make this type a binding slot"
            style={{ ...smallButtonStyle, opacity: 0.5 }}
          >
            ⬡
          </button>
        </div>
      )}
      {isTypeBound ? (
        <div style={{ opacity: 0.6, fontSize: 10, fontStyle: "italic", marginTop: 4 }}>
          Type is bound — its value is supplied by the binding override.
        </div>
      ) : specs.length > 0 ? (
        <TypedFieldRows
          specs={specs}
          onUpdate={onUpdate}
          onUpdateWithBindings={onUpdateWithBindings}
          onRenameBinding={onRenameBinding}
          activeSubtreeBindings={activeSubtreeBindings}
        />
      ) : (
        <>
          <FieldLabel>
            Vars (key = value, one per line)
            <HintText>{fallbackHint}</HintText>
          </FieldLabel>
          <textarea
            value={fallbackText}
            onChange={(e) => setFallbackText(e.target.value)}
            onBlur={commitFallback}
            rows={6}
            style={textAreaStyle}
          />
        </>
      )}
    </div>
  );
}

// ── Shared field row rendering ────────────────────────────────────────────────

function TypedFieldRows({
  specs,
  onUpdate,
  onUpdateWithBindings,
  onRenameBinding,
  activeSubtreeBindings,
}: {
  specs: _FieldSpec[];
  onUpdate: (n: BtNode) => void;
  onUpdateWithBindings: (n: BtNode, bindings: BtBindingDeclarations | undefined) => void;
  onRenameBinding: (oldName: string, newName: string) => void;
  activeSubtreeBindings: BtBindingDeclarations | undefined;
}) {
  const [pendingBindKey, setPendingBindKey] = useState<string | null>(null);
  const [pendingBindName, setPendingBindName] = useState("");

  return (
    <>
      {specs.map((f) => {
        const isBound = f.value.startsWith("$");
        const bindingName = isBound ? f.value.slice(1) : null;
        const decl = bindingName ? activeSubtreeBindings?.[bindingName] : undefined;
        const isPendingBind = pendingBindKey === f.key;

        const confirmBind = (rawLabel: string) => {
          const label = rawLabel.trim();
          if (!label) { setPendingBindKey(null); return; }
          const id = generateBindingId();
          const newBindings: BtBindingDeclarations = {
            ...(activeSubtreeBindings ?? {}),
            [id]: { label, default: f.value || f.defaultValue },
          };
          onUpdateWithBindings(f.bindNode(id), newBindings);
          setPendingBindKey(null);
        };

        const removeBinding = () => {
          if (!bindingName) return;
          const restored = decl?.default ?? "";
          const newBindings = { ...(activeSubtreeBindings ?? {}) };
          delete newBindings[bindingName];
          onUpdateWithBindings(
            f.unbindNode(restored),
            Object.keys(newBindings).length > 0 ? newBindings : undefined,
          );
        };

        const updateBindingDefault = (newDefault: string) => {
          if (!decl || !bindingName) return;
          onUpdateWithBindings(f.updateNode(f.value), {
            ...(activeSubtreeBindings ?? {}),
            [bindingName]: { ...decl, default: newDefault || f.defaultValue },
          });
        };

        return (
          <div key={f.key}>
            <VarFieldLabel name={f.name} defaultValue={f.defaultValue} />
            {isBound && bindingName ? (
              <BoundArgRow
                bindingId={bindingName}
                bindingDecl={decl}
                onRenameLabel={(id, newLabel) => onRenameBinding(id, newLabel)}
                onRemove={removeBinding}
                onDefaultChange={updateBindingDefault}
              />
            ) : isPendingBind ? (
              <div style={{ display: "flex", flexDirection: "column", gap: 2, marginBottom: 2 }}>
                <div style={{ opacity: 0.6, fontSize: 10 }}>Binding name:</div>
                <div style={{ display: "flex", gap: 4 }}>
                  <input
                    autoFocus
                    value={pendingBindName}
                    onChange={(e) => setPendingBindName(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") confirmBind(pendingBindName);
                      if (e.key === "Escape") setPendingBindKey(null);
                    }}
                    onBlur={() => confirmBind(pendingBindName)}
                    placeholder={f.name}
                    style={{ ...inputStyle, flex: 1, fontFamily: "monospace" }}
                  />
                  <button
                    onMouseDown={(e) => { e.preventDefault(); setPendingBindKey(null); }}
                    style={smallButtonStyle}
                  >
                    ✕
                  </button>
                </div>
              </div>
            ) : (
              <div style={{ display: "flex", gap: 4, alignItems: "flex-start" }}>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <TypedVarInput
                    varName={f.name}
                    defaultValue={f.defaultValue}
                    value={f.value}
                    onChange={(val) => onUpdate(f.updateNode(val))}
                  />
                </div>
                <button
                  onClick={() => { setPendingBindKey(f.key); setPendingBindName(f.name); }}
                  title="Make this a binding"
                  style={{ ...smallButtonStyle, marginTop: 2, opacity: 0.5 }}
                >
                  ⬡
                </button>
              </div>
            )}
          </div>
        );
      })}
    </>
  );
}

function SubtreeConfig({
  node,
  onUpdate,
  onUpdateWithBindings,
  onRenameBinding,
  subtreeBindings,
  activeSubtreeBindings,
}: {
  node: Extract<BtNode, { kind: "subtree" }>;
  onUpdate: (n: BtNode) => void;
  onUpdateWithBindings: (n: BtNode, bindings: BtBindingDeclarations | undefined) => void;
  onRenameBinding: (oldName: string, newName: string) => void;
  subtreeBindings: Record<string, BtBindingDeclarations>;
  activeSubtreeBindings: BtBindingDeclarations | undefined;
}) {
  const [path, setPath] = useState(node.behaviorType);
  const [overrideId, setOverrideId] = useState(node.overrideId ?? "");
  const [pendingBind, setPendingBind] = useState(false);
  const [pendingBindName, setPendingBindName] = useState("");

  const isPathBound = node.behaviorType.startsWith("$");
  const pathBindingId = isPathBound ? node.behaviorType.slice(1) : null;
  const pathBindingDecl = pathBindingId ? activeSubtreeBindings?.[pathBindingId] : undefined;

  const decls = isPathBound ? undefined : subtreeBindings[node.behaviorType];
  const declEntries = decls ? Object.entries(decls) : [];

  const commitNodeUpdate = (overrides?: Record<string, string>) => {
    onUpdate({
      ...node,
      behaviorType: path,
      overrideId: overrideId.trim() || undefined,
      bindings: overrides && Object.keys(overrides).length > 0 ? overrides : undefined,
    });
  };

  const buildNode = (overrides: Record<string, string> | undefined): Extract<BtNode, { kind: "subtree" }> => ({
    ...node,
    behaviorType: path,
    overrideId: overrideId.trim() || undefined,
    bindings: overrides && Object.keys(overrides).length > 0 ? overrides : undefined,
  });

  const setBindingOverride = (name: string, value: string) => {
    const updated: Record<string, string> = { ...(node.bindings ?? {}) };
    if (value === "") {
      delete updated[name];
    } else {
      updated[name] = value;
    }
    onUpdate(buildNode(updated));
  };

  // Bind an override value to a slot on *this* subtree (nested / pass-through binding).
  const bindOverride = (name: string, rawLabel: string) => {
    const label = rawLabel.trim();
    if (!label) return;
    const id = generateBindingId();
    const innerDefault = decls?.[name]?.default ?? "";
    const newDecls: BtBindingDeclarations = {
      ...(activeSubtreeBindings ?? {}),
      [id]: { label, default: node.bindings?.[name] || innerDefault },
    };
    onUpdateWithBindings(buildNode({ ...(node.bindings ?? {}), [name]: `$${id}` }), newDecls);
  };

  const unbindOverride = (name: string) => {
    const val = node.bindings?.[name];
    if (!val?.startsWith("$")) return;
    const id = val.slice(1);
    const restored = activeSubtreeBindings?.[id]?.default ?? "";
    const newDecls = { ...(activeSubtreeBindings ?? {}) };
    delete newDecls[id];
    const overrides = { ...(node.bindings ?? {}) };
    if (restored) overrides[name] = restored;
    else delete overrides[name];
    onUpdateWithBindings(
      buildNode(overrides),
      Object.keys(newDecls).length > 0 ? newDecls : undefined,
    );
  };

  const updateOverrideBindingDefault = (id: string, newDefault: string) => {
    const decl = activeSubtreeBindings?.[id];
    if (!decl) return;
    onUpdateWithBindings(node, {
      ...(activeSubtreeBindings ?? {}),
      [id]: { ...decl, default: newDefault },
    });
  };

  const confirmPathBind = (rawLabel: string) => {
    const label = rawLabel.trim();
    if (!label) { setPendingBind(false); return; }
    const id = generateBindingId();
    const newBindings: BtBindingDeclarations = {
      ...(activeSubtreeBindings ?? {}),
      [id]: { label, default: path || "" },
    };
    onUpdateWithBindings(
      { ...node, behaviorType: `$${id}`, overrideId: overrideId.trim() || undefined },
      newBindings,
    );
    setPendingBind(false);
  };

  const removePathBinding = () => {
    if (!pathBindingId) return;
    const restored = pathBindingDecl?.default ?? "";
    const newBindings = { ...(activeSubtreeBindings ?? {}) };
    delete newBindings[pathBindingId];
    setPath(restored);
    onUpdateWithBindings(
      { ...node, behaviorType: restored, overrideId: overrideId.trim() || undefined },
      Object.keys(newBindings).length > 0 ? newBindings : undefined,
    );
  };

  const updatePathBindingDefault = (newDefault: string) => {
    if (!pathBindingDecl || !pathBindingId) return;
    onUpdateWithBindings(node, {
      ...(activeSubtreeBindings ?? {}),
      [pathBindingId]: { ...pathBindingDecl, default: newDefault },
    });
  };

  return (
    <div>
      <FieldLabel>Subtree Path</FieldLabel>
      {isPathBound && pathBindingId ? (
        <BoundArgRow
          bindingId={pathBindingId}
          bindingDecl={pathBindingDecl}
          onRenameLabel={(id, newLabel) => onRenameBinding(id, newLabel)}
          onRemove={removePathBinding}
          onDefaultChange={updatePathBindingDefault}
        />
      ) : pendingBind ? (
        <div style={{ display: "flex", flexDirection: "column", gap: 2, marginBottom: 2 }}>
          <div style={{ opacity: 0.6, fontSize: 10 }}>Binding slot name:</div>
          <div style={{ display: "flex", gap: 4 }}>
            <input
              autoFocus
              value={pendingBindName}
              onChange={(e) => setPendingBindName(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") confirmPathBind(pendingBindName);
                if (e.key === "Escape") setPendingBind(false);
              }}
              onBlur={() => confirmPathBind(pendingBindName)}
              placeholder="slot name"
              style={{ ...inputStyle, flex: 1, fontFamily: "monospace" }}
            />
            <button
              onMouseDown={(e) => { e.preventDefault(); setPendingBind(false); }}
              style={smallButtonStyle}
            >
              ✕
            </button>
          </div>
        </div>
      ) : (
        <div style={{ display: "flex", gap: 4 }}>
          <input
            value={path}
            onChange={(e) => setPath(e.target.value)}
            onBlur={() => commitNodeUpdate(node.bindings)}
            style={{ ...textAreaStyle, padding: "4px 6px", height: "auto", flex: 1 }}
          />
          <button
            onClick={() => { setPendingBind(true); setPendingBindName("subtree_slot"); }}
            title="Make this subtree path a binding slot"
            style={{ ...smallButtonStyle, marginTop: 2, opacity: 0.5 }}
          >
            ⬡
          </button>
        </div>
      )}
      <FieldLabel>
        Override ID <HintText>— leave blank for none</HintText>
      </FieldLabel>
      <input
        value={overrideId}
        onChange={(e) => setOverrideId(e.target.value)}
        onBlur={() => commitNodeUpdate(node.bindings)}
        placeholder="e.g. my_override"
        style={{ ...inputStyle }}
      />
      {declEntries.length > 0 && (
        <>
          <FieldLabel>Bindings</FieldLabel>
          {declEntries.map(([name, decl]) => (
            <BindingOverrideField
              key={name}
              name={name}
              decl={decl}
              value={node.bindings?.[name] ?? ""}
              activeSubtreeBindings={activeSubtreeBindings}
              onCommitLiteral={(val) => setBindingOverride(name, val)}
              onBind={(label) => bindOverride(name, label)}
              onUnbind={() => unbindOverride(name)}
              onRenameLabel={onRenameBinding}
              onDefaultChange={updateOverrideBindingDefault}
            />
          ))}
        </>
      )}
    </div>
  );
}

function BindingOverrideField({
  name,
  decl,
  value,
  activeSubtreeBindings,
  onCommitLiteral,
  onBind,
  onUnbind,
  onRenameLabel,
  onDefaultChange,
}: {
  name: string;
  decl: { label: string; default: string };
  value: string;
  activeSubtreeBindings: BtBindingDeclarations | undefined;
  onCommitLiteral: (val: string) => void;
  onBind: (label: string) => void;
  onUnbind: () => void;
  onRenameLabel: (id: string, newLabel: string) => void;
  onDefaultChange: (id: string, newDefault: string) => void;
}) {
  const isBound = value.startsWith("$");
  const bindingId = isBound ? value.slice(1) : null;
  const bindingDecl = bindingId ? activeSubtreeBindings?.[bindingId] : undefined;

  const [local, setLocal] = useState(value);
  const [pendingBind, setPendingBind] = useState(false);
  const [pendingName, setPendingName] = useState("");
  useEffect(() => setLocal(value), [value]);

  const confirmBind = (raw: string) => {
    const lbl = raw.trim();
    setPendingBind(false);
    if (lbl) onBind(lbl);
  };

  return (
    <div>
      <FieldLabel>{decl.label}</FieldLabel>
      {isBound && bindingId ? (
        <BoundArgRow
          bindingId={bindingId}
          bindingDecl={bindingDecl}
          onRenameLabel={onRenameLabel}
          onRemove={onUnbind}
          onDefaultChange={(d) => onDefaultChange(bindingId, d)}
        />
      ) : pendingBind ? (
        <div style={{ display: "flex", flexDirection: "column", gap: 2, marginBottom: 2 }}>
          <div style={{ opacity: 0.6, fontSize: 10 }}>Binding slot name:</div>
          <div style={{ display: "flex", gap: 4 }}>
            <input
              autoFocus
              value={pendingName}
              onChange={(e) => setPendingName(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") confirmBind(pendingName);
                if (e.key === "Escape") setPendingBind(false);
              }}
              onBlur={() => confirmBind(pendingName)}
              placeholder={decl.label}
              style={{ ...inputStyle, flex: 1, fontFamily: "monospace" }}
            />
            <button
              onMouseDown={(e) => { e.preventDefault(); setPendingBind(false); }}
              style={smallButtonStyle}
            >
              ✕
            </button>
          </div>
        </div>
      ) : (
        <div style={{ display: "flex", gap: 4, alignItems: "flex-start" }}>
          <input
            value={local}
            onChange={(e) => setLocal(e.target.value)}
            onBlur={() => onCommitLiteral(local.trim())}
            onKeyDown={(e) => { if (e.key === "Enter") e.currentTarget.blur(); }}
            placeholder={decl.default || "(use default)"}
            style={{ ...inputStyle, flex: 1, fontFamily: "monospace" }}
          />
          <button
            onClick={() => { setPendingBind(true); setPendingName(name); }}
            title="Bind this override to a slot on this subtree (pass-through)"
            style={{ ...smallButtonStyle, opacity: 0.5 }}
          >
            ⬡
          </button>
        </div>
      )}
    </div>
  );
}

function BoundArgRow({
  bindingId,
  bindingDecl,
  onRenameLabel,
  onRemove,
  onDefaultChange,
}: {
  bindingId: string;
  bindingDecl: { label: string; default: string } | undefined;
  onRenameLabel: (id: string, newLabel: string) => void;
  onRemove: () => void;
  onDefaultChange: (newDefault: string) => void;
}) {
  const currentLabel = bindingDecl?.label ?? bindingId;
  const [localLabel, setLocalLabel] = useState(currentLabel);
  const [localDefault, setLocalDefault] = useState(bindingDecl?.default ?? "");

  useEffect(() => setLocalLabel(bindingDecl?.label ?? bindingId), [bindingDecl?.label, bindingId]);
  useEffect(() => setLocalDefault(bindingDecl?.default ?? ""), [bindingDecl?.default]);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 2, marginBottom: 4 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
        <span style={{ fontFamily: "monospace", fontSize: 10, opacity: 0.5, flex: "0 0 auto" }}>$</span>
        <input
          value={localLabel}
          onChange={(e) => setLocalLabel(e.target.value)}
          onBlur={() => {
            const trimmed = localLabel.trim();
            if (trimmed && trimmed !== currentLabel) {
              onRenameLabel(bindingId, trimmed);
            } else {
              setLocalLabel(currentLabel);
            }
          }}
          onKeyDown={(e) => { if (e.key === "Enter") e.currentTarget.blur(); }}
          placeholder="binding name"
          style={{ ...inputStyle, flex: 1, fontFamily: "monospace" }}
        />
        <button onClick={onRemove} style={smallButtonStyle}>×</button>
      </div>
      <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
        <span style={{ fontSize: 10, opacity: 0.5, flex: "0 0 auto", minWidth: 38 }}>default</span>
        <input
          value={localDefault}
          onChange={(e) => setLocalDefault(e.target.value)}
          onBlur={() => onDefaultChange(localDefault)}
          onKeyDown={(e) => { if (e.key === "Enter") e.currentTarget.blur(); }}
          placeholder="default value"
          style={{ ...inputStyle, flex: 1 }}
        />
      </div>
    </div>
  );
}

function CompositeConfig({
  node,
  onUpdate,
}: {
  node: Extract<BtNode, { kind: "parallel" | "subplan" }>;
  onUpdate: (n: BtNode) => void;
}) {
  const schema = COMPOSITE_SCHEMAS[node.kind] ?? [];
  const data = node as unknown as Record<string, unknown>;

  const [textValues, setTextValues] = useState<Record<string, string>>(() => {
    const init: Record<string, string> = {};
    for (const prop of schema) {
      if (prop.type === "text") {
        init[prop.key] = data[prop.key] !== undefined ? String(data[prop.key]) : "";
      }
    }
    return init;
  });

  function commitText(key: string, raw: string) {
    const trimmed = raw.trim();
    if (trimmed === "") {
      const copy = { ...node } as Record<string, unknown>;
      delete copy[key];
      onUpdate(copy as unknown as BtNode);
    } else {
      onUpdate({ ...node, [key]: trimmed } as BtNode);
    }
  }

  return (
    <div>
      {schema.map((prop) => {
        if (prop.type === "enum") {
          return (
            <div key={prop.key}>
              <FieldLabel>{prop.label}</FieldLabel>
              <select
                value={(data[prop.key] as string | undefined) ?? prop.default}
                onChange={(e) => onUpdate({ ...node, [prop.key]: e.target.value } as BtNode)}
                style={selectStyle}
              >
                {prop.values.map((v) => (
                  <option key={v} value={v}>
                    {BT_LABELS[v] ?? v}
                  </option>
                ))}
              </select>
            </div>
          );
        }

        if (prop.type === "boolean") {
          const checked = (data[prop.key] as boolean | undefined) ?? prop.default;
          return (
            <div key={prop.key}>
              <FieldLabel>{prop.label}</FieldLabel>
              <input
                type="checkbox"
                checked={checked}
                onChange={(e) => onUpdate({ ...node, [prop.key]: e.target.checked } as BtNode)}
              />
            </div>
          );
        }

        return (
          <div key={prop.key}>
            <FieldLabel>
              {prop.label} <HintText>— leave blank for default</HintText>
            </FieldLabel>
            <input
              type="text"
              value={textValues[prop.key] ?? ""}
              placeholder={prop.placeholder}
              onChange={(e) =>
                setTextValues((prev) => ({ ...prev, [prop.key]: e.target.value }))
              }
              onBlur={() => commitText(prop.key, textValues[prop.key] ?? "")}
              style={inputStyle}
            />
          </div>
        );
      })}
      {node.kind === "subplan" && (
        <div style={{ marginTop: 10, fontSize: 10, opacity: 0.5, lineHeight: "16px" }}>
          <div>Succeed/Fail → identical to sequence</div>
          <div>Loop/Fail → repeat while succeeding</div>
          <div>Succeed/Loop → retry until success</div>
          <div>Loop/Loop → infinite loop</div>
        </div>
      )}
    </div>
  );
}

function FieldLabel({ children }: { children: React.ReactNode }) {
  return (
    <div
      style={{
        fontSize: 10,
        textTransform: "uppercase",
        opacity: 0.6,
        marginBottom: 3,
        marginTop: 8,
      }}
    >
      {children}
    </div>
  );
}

function TypePathLabel({ children }: { children: React.ReactNode }) {
  return (
    <div
      style={{
        fontFamily: "monospace",
        fontSize: 11,
        wordBreak: "break-all",
        marginBottom: 8,
        opacity: 0.8,
      }}
    >
      {children}
    </div>
  );
}

function VarFieldLabel({ name, defaultValue }: { name: string; defaultValue: string }) {
  return (
    <FieldLabel>
      {name}
      <span style={{ opacity: 0.4, marginLeft: 6, fontSize: 9, fontFamily: "monospace" }}>
        = {defaultValue}
      </span>
    </FieldLabel>
  );
}

function HintText({ children }: { children: React.ReactNode }) {
  return (
    <span style={{ opacity: 0.5, fontStyle: "italic", marginLeft: 4, textTransform: "none" }}>
      {children}
    </span>
  );
}

type _FieldType = "checkbox" | "abort_policy" | "bbkey" | "typepath" | "number" | "text";

function _inferFieldType(varName: string, defaultValue: string): _FieldType {
  const v = defaultValue.trim();
  if (v === "TRUE" || v === "FALSE") return "checkbox";
  if (/^BT_ABORT_/.test(v)) return "abort_policy";
  if (v === "list()" || v.startsWith("list(")) return "text";
  const n = varName.toLowerCase();
  if (n.endsWith("_key") || n === "key") return "bbkey";
  if (/^\/(?:datum|mob|obj|atom|area|turf|client)\//.test(v)) return "typepath";
  if (/^\d+(\.\d+)?$/.test(v)) return "number";
  return "text";
}

function TypedVarInput({
  varName,
  defaultValue,
  value,
  onChange,
  onBlur,
}: {
  varName: string;
  defaultValue: string;
  value: string;
  onChange: (v: string) => void;
  onBlur?: () => void;
}) {
  const ft = _inferFieldType(varName, defaultValue);

  if (ft === "checkbox") {
    const checked = value === "TRUE" || (value === "" && defaultValue === "TRUE");
    return (
      <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 2 }}>
        <input
          type="checkbox"
          checked={checked}
          onChange={(e) => onChange(e.target.checked ? "TRUE" : "FALSE")}
        />
        <span style={{ fontSize: 11, opacity: 0.7 }}>{checked ? "TRUE" : "FALSE"}</span>
      </div>
    );
  }

  if (ft === "abort_policy") {
    return (
      <select
        value={value || defaultValue}
        onChange={(e) => onChange(e.target.value)}
        style={selectStyle}
      >
        {BT_ABORT_POLICIES.map((p) => (
          <option key={p} value={p}>
            {BT_LABELS[p] ?? p}
          </option>
        ))}
      </select>
    );
  }

  const placeholder = defaultValue && defaultValue !== "null" ? defaultValue : "";

  return (
    <input
      type="text"
      inputMode={ft === "number" ? "numeric" : undefined}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      onBlur={onBlur}
      placeholder={placeholder}
      style={{
        ...inputStyle,
        ...(ft === "bbkey" || ft === "typepath" ? { fontFamily: "monospace" } : {}),
      }}
    />
  );
}

const textAreaStyle: React.CSSProperties = {
  width: "100%",
  boxSizing: "border-box",
  background: "var(--vscode-input-background, #3c3c3c)",
  color: "var(--vscode-input-foreground, #ccc)",
  border: "1px solid var(--vscode-input-border, #555)",
  borderRadius: 3,
  padding: "4px 6px",
  fontSize: 11,
  fontFamily: "monospace",
  resize: "vertical",
};

const inputStyle: React.CSSProperties = {
  width: "100%",
  boxSizing: "border-box",
  background: "var(--vscode-input-background, #3c3c3c)",
  color: "var(--vscode-input-foreground, #ccc)",
  border: "1px solid var(--vscode-input-border, #555)",
  borderRadius: 3,
  padding: "4px 6px",
  fontSize: 11,
  fontFamily: "monospace",
};

const selectStyle: React.CSSProperties = {
  width: "100%",
  background: "var(--vscode-input-background, #3c3c3c)",
  color: "var(--vscode-input-foreground, #ccc)",
  border: "1px solid var(--vscode-input-border, #555)",
  borderRadius: 3,
  padding: "3px 6px",
  fontSize: 11,
  marginBottom: 4,
};

const smallButtonStyle: React.CSSProperties = {
  background: "none",
  border: "1px solid var(--vscode-input-border, #555)",
  color: "inherit",
  cursor: "pointer",
  fontSize: 11,
  padding: "2px 5px",
  borderRadius: 3,
  flex: "0 0 auto",
  lineHeight: 1,
};
