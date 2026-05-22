import React, { useState } from "react";
import type { BtNode } from "../../../shared/types";
import {
  BT_PARALLEL_FAILURE_POLICIES,
  BT_PARALLEL_SUCCESS_POLICIES,
  BT_ABORT_POLICIES,
  BT_LABELS,
} from "../../../shared/btConstants";

interface NodeConfigPanelProps {
  node: BtNode & { id: string };
  onUpdate: (updated: BtNode) => void;
  onClose: () => void;
  typeVars: Record<string, Array<{ name: string; defaultValue: string }>> | null;
}

export function NodeConfigPanel({ node, onUpdate, onClose, typeVars }: NodeConfigPanelProps) {
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
        {/* key on id forces remount when selected node changes */}
        <NodeConfigBody key={node.id} node={node} onUpdate={onUpdate} typeVars={typeVars} />
      </div>
    </div>
  );
}

function NodeConfigBody({
  node,
  onUpdate,
  typeVars,
}: {
  node: BtNode;
  onUpdate: (n: BtNode) => void;
  typeVars: Record<string, Array<{ name: string; defaultValue: string }>> | null;
}) {
  switch (node.kind) {
    case "leaf":
      return <LeafConfig node={node} onUpdate={onUpdate} typeVars={typeVars} />;
    case "subtree":
      return <SubtreeConfig node={node} onUpdate={onUpdate} />;
    case "decorator":
      return <DecoratorConfig node={node} onUpdate={onUpdate} typeVars={typeVars} />;
    case "parallel":
      return <ParallelConfig node={node} onUpdate={onUpdate} />;
    case "selector":
    case "sequence":
      return (
        <div style={{ opacity: 0.6 }}>
          <em>{node.kind}</em> — {node.children.length} children
        </div>
      );
  }
}

function SubtreeConfig({
  node,
  onUpdate,
}: {
  node: Extract<BtNode, { kind: "subtree" }>;
  onUpdate: (n: BtNode) => void;
}) {
  const [path, setPath] = useState(node.behaviorType);
  return (
    <div>
      <FieldLabel>Subtree Path</FieldLabel>
      <input
        value={path}
        onChange={(e) => setPath(e.target.value)}
        style={{ ...textAreaStyle, padding: "4px 6px", height: "auto" }}
      />
      <SaveBtn onClick={() => onUpdate({ ...node, behaviorType: path })} />
    </div>
  );
}

function LeafConfig({
  node,
  onUpdate,
  typeVars,
}: {
  node: Extract<BtNode, { kind: "leaf" }>;
  onUpdate: (n: BtNode) => void;
  typeVars: Record<string, Array<{ name: string; defaultValue: string }>> | null;
}) {
  const entry = typeVars?.[node.behaviorType] ?? [];
  const [fieldValues, setFieldValues] = useState<string[]>(
    () => entry.map((_, i) => node.args[i] ?? ""),
  );
  const [textValue, setTextValue] = useState(() => node.args.join("\n"));

  const setField = (i: number, v: string) =>
    setFieldValues((prev) => prev.map((x, j) => (j === i ? v : x)));

  if (entry.length > 0) {
    return (
      <div>
        <FieldLabel>Behavior Type</FieldLabel>
        <TypePathLabel>{node.behaviorType}</TypePathLabel>
        {entry.map((v, i) => (
          <div key={v.name}>
            <VarFieldLabel name={v.name} defaultValue={v.defaultValue} />
            <TypedVarInput
              varName={v.name}
              defaultValue={v.defaultValue}
              value={fieldValues[i] ?? ""}
              onChange={(val) => setField(i, val)}
            />
          </div>
        ))}
        <SaveBtn onClick={() => onUpdate({ ...node, args: entry.map((_, i) => (fieldValues[i] ?? "").trim()) })} />
      </div>
    );
  }

  // Fallback textarea when type is not found in workspace
  return (
    <div>
      <FieldLabel>Behavior Type</FieldLabel>
      <TypePathLabel>{node.behaviorType}</TypePathLabel>
      <FieldLabel>
        Args (one per line)
        <HintText>{typeVars === null ? "— scanning…" : node.behaviorType in typeVars ? "— no configurable variables" : "— type not found in workspace"}</HintText>
      </FieldLabel>
      <textarea
        value={textValue}
        onChange={(e) => setTextValue(e.target.value)}
        rows={5}
        style={textAreaStyle}
      />
      <SaveBtn
        onClick={() =>
          onUpdate({ ...node, args: textValue.split("\n").map((s) => s.trim()).filter(Boolean) })
        }
      />
    </div>
  );
}

function DecoratorConfig({
  node,
  onUpdate,
  typeVars,
}: {
  node: Extract<BtNode, { kind: "decorator" }>;
  onUpdate: (n: BtNode) => void;
  typeVars: Record<string, Array<{ name: string; defaultValue: string }>> | null;
}) {
  const entry = typeVars?.[node.nodeType] ?? [];

  const [configValues, setConfigValues] = useState<Record<string, string>>(() => {
    const base: Record<string, string> = {};
    for (const [k, v] of Object.entries(node.config)) {
      base[k] = Array.isArray(v) ? v.join(", ") : v;
    }
    return base;
  });
  const [textConfig, setTextConfig] = useState(() =>
    Object.entries(node.config)
      .map(([k, v]) => `${k} = ${Array.isArray(v) ? v.join(", ") : v}`)
      .join("\n"),
  );

  const setValue = (k: string, v: string) =>
    setConfigValues((prev) => ({ ...prev, [k]: v }));

  if (entry.length > 0) {
    const handleSave = () => {
      const parsed: Record<string, string | string[]> = {};
      for (const v of entry) {
        const raw = (configValues[v.name] ?? "").trim();
        if (raw) {
          parsed[v.name] = raw.includes(",")
            ? raw.split(",").map((s) => s.trim()).filter(Boolean)
            : raw;
        }
      }
      onUpdate({ ...node, config: parsed });
    };
    return (
      <div>
        <FieldLabel>Decorator Type</FieldLabel>
        <TypePathLabel>{node.nodeType}</TypePathLabel>
        {entry.map((v) => (
          <div key={v.name}>
            <VarFieldLabel name={v.name} defaultValue={v.defaultValue} />
            <TypedVarInput
              varName={v.name}
              defaultValue={v.defaultValue}
              value={configValues[v.name] ?? ""}
              onChange={(val) => setValue(v.name, val)}
            />
          </div>
        ))}
        <SaveBtn onClick={handleSave} />
      </div>
    );
  }

  // Fallback textarea
  const handleSaveText = () => {
    const parsed: Record<string, string | string[]> = {};
    for (const line of textConfig.split("\n")) {
      const eq = line.indexOf("=");
      if (eq === -1) continue;
      const k = line.slice(0, eq).trim();
      const v = line.slice(eq + 1).trim();
      parsed[k] = v.includes(",") ? v.split(",").map((s) => s.trim()).filter(Boolean) : v;
    }
    onUpdate({ ...node, config: parsed });
  };

  return (
    <div>
      <FieldLabel>Decorator Type</FieldLabel>
      <TypePathLabel>{node.nodeType}</TypePathLabel>
      <FieldLabel>
        Config (key = value, one per line)
        <HintText>{typeVars === null ? "— scanning…" : node.nodeType in typeVars ? "— no configurable variables" : "— type not found in workspace"}</HintText>
      </FieldLabel>
      <textarea
        value={textConfig}
        onChange={(e) => setTextConfig(e.target.value)}
        rows={6}
        style={textAreaStyle}
      />
      <SaveBtn onClick={handleSaveText} />
    </div>
  );
}

function ParallelConfig({
  node,
  onUpdate,
}: {
  node: Extract<BtNode, { kind: "parallel" }>;
  onUpdate: (n: BtNode) => void;
}) {
  return (
    <div>
      <FieldLabel>Failure Policy</FieldLabel>
      <select
        value={node.failurePolicy}
        onChange={(e) => onUpdate({ ...node, failurePolicy: e.target.value })}
        style={selectStyle}
      >
        {BT_PARALLEL_FAILURE_POLICIES.map((p) => (
          <option key={p} value={p}>{BT_LABELS[p] ?? p}</option>
        ))}
      </select>

      <FieldLabel>Success Policy</FieldLabel>
      <select
        value={node.successPolicy}
        onChange={(e) => onUpdate({ ...node, successPolicy: e.target.value })}
        style={selectStyle}
      >
        {BT_PARALLEL_SUCCESS_POLICIES.map((p) => (
          <option key={p} value={p}>{BT_LABELS[p] ?? p}</option>
        ))}
      </select>
    </div>
  );
}

function FieldLabel({ children }: { children: React.ReactNode }) {
  return (
    <div style={{ fontSize: 10, textTransform: "uppercase", opacity: 0.6, marginBottom: 3, marginTop: 8 }}>
      {children}
    </div>
  );
}

function TypePathLabel({ children }: { children: React.ReactNode }) {
  return (
    <div style={{ fontFamily: "monospace", fontSize: 11, wordBreak: "break-all", marginBottom: 8, opacity: 0.8 }}>
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
}: {
  varName: string;
  defaultValue: string;
  value: string;
  onChange: (v: string) => void;
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
          <option key={p} value={p}>{BT_LABELS[p] ?? p}</option>
        ))}
      </select>
    );
  }

  const placeholder =
    ft === "bbkey" ? "BB_KEY_NAME"
    : ft === "typepath" ? "/datum/type/path"
    : ft === "number" ? "0"
    : defaultValue !== "null" ? defaultValue
    : "";

  return (
    <input
      type={ft === "number" ? "number" : "text"}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder}
      style={{
        ...inputStyle,
        ...(ft === "bbkey" || ft === "typepath" ? { fontFamily: "monospace" } : {}),
      }}
    />
  );
}

function SaveBtn({ onClick }: { onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      style={{
        marginTop: 8,
        padding: "4px 12px",
        background: "var(--vscode-button-background, #0e639c)",
        color: "var(--vscode-button-foreground, #fff)",
        border: "none",
        borderRadius: 3,
        cursor: "pointer",
        fontSize: 11,
      }}
    >
      Apply
    </button>
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
