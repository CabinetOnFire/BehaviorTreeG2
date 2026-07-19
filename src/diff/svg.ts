import type { Node, Edge } from "@xyflow/react";
import type { BtNode } from "../../shared/types";
import { COMPOSITE_SCHEMAS } from "../../shared/compositeSchema";
import { BT_LABELS } from "../../shared/btConstants";
import { buildLayout, nodeSize } from "../../media/editor/layout/dagreLayout";
import { rowsFor } from "../../media/editor/utils/nodeRows";
import { shortTypePath } from "../../media/editor/utils/typeDisplay";
import type { TypeVarsMap } from "../../media/editor/contexts/TypeVarsContext";
import type { DiffNode, DiffStatus } from "./diff";

// Kind fill/border colors, lifted from the editor's node components so keep parity pls.
const KIND_STYLE: Record<string, { bg: string; border: string }> = {
  selector: { bg: "#1e3a1e", border: "#4CAF50" },
  sequence: { bg: "#1a2a3a", border: "#2196F3" },
  parallel: { bg: "#2a1a3a", border: "#9C27B0" },
  subplan: { bg: "#2a1e00", border: "#FFB300" },
  leaf: { bg: "#2a1e00", border: "#FF9800" },
  decorator: { bg: "#1a1a1a", border: "#607D8B" },
  subtree: { bg: "#00292d", border: "#26C6DA" },
};

const KIND_ICON: Record<string, string> = {
  selector: "?",
  sequence: "→",
  parallel: "⇉",
  subplan: "↺",
  subtree: "↵",
};

// Diff-status overlay: border override + corner badge
const STATUS_STYLE: Record<DiffStatus, { border?: string; badge?: string; dash?: boolean; opacity?: number }> = {
  unchanged: {},
  added: { border: "#4CAF50", badge: "+" },
  removed: { border: "#f44336", badge: "−", dash: true, opacity: 0.55 },
  changed: { border: "#FFC107", badge: "~" },
};

function escapeXml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function truncate(s: string, max: number): string {
  return s.length > max ? s.slice(0, max - 1) + "…" : s;
}

interface ConfigRow {
  key: string;
  value: string;
  isDefault?: boolean;
}

interface NodeContent {
  title: string;
  rows: ConfigRow[];
}

function nodeContent(
  node: BtNode,
  typeVars: TypeVarsMap | null | undefined,
  resolveBinding: (v: string) => string,
): NodeContent {
  switch (node.kind) {
    case "selector":
      return { title: "Selector", rows: [] };
    case "sequence":
      return { title: "Sequence", rows: [] };

    case "parallel":
    case "subplan": {
      const schema = COMPOSITE_SCHEMAS[node.kind] ?? [];
      const src = node as unknown as Record<string, unknown>;
      const rows: ConfigRow[] = [];
      for (const prop of schema) {
        const raw = src[prop.key];
        if (prop.type === "text" && (raw == null || raw === "")) continue;
        let display: string;
        if (prop.type === "enum") display = raw != null ? (BT_LABELS[raw as string] ?? String(raw)) : "—";
        else if (prop.type === "boolean") display = raw != null ? (raw ? "yes" : "no") : "—";
        else display = String(raw);
        rows.push({ key: prop.label, value: display });
      }
      return { title: node.kind === "parallel" ? "Parallel" : "Subplan", rows };
    }

    case "leaf": {
      const varDecls = typeVars?.[node.behaviorType]?.vars ?? [];
      return { title: shortTypePath(resolveBinding(node.behaviorType)), rows: rowsFor(node.vars, varDecls, resolveBinding) };
    }
    case "decorator": {
      const varDecls = typeVars?.[node.nodeType]?.vars ?? [];
      return { title: shortTypePath(resolveBinding(node.nodeType)), rows: rowsFor(node.vars, varDecls, resolveBinding) };
    }

    case "subtree": {
      const rows: ConfigRow[] = [{ key: "path", value: shortTypePath(resolveBinding(node.behaviorType)) }];
      if (node.overrideId) rows.push({ key: "id", value: node.overrideId });
      const bindingCount = node.bindings ? Object.keys(node.bindings).length : 0;
      if (bindingCount > 0) rows.push({ key: "overrides", value: String(bindingCount) });
      return { title: "Subtree Ref", rows };
    }
  }
}

type ZippedRow =
  | { key: string; status: "same"; value: string }
  | { key: string; status: "added"; value: string }
  | { key: string; status: "removed"; value: string }
  | { key: string; status: "changed"; oldValue: string; newValue: string };

/** Merge old/new content rows by key so changed nodes can show old vs new per field, not just a blunt badge. */
function zipRows(oldRows: ConfigRow[], newRows: ConfigRow[]): ZippedRow[] {
  const oldMap = new Map(oldRows.map((r) => [r.key, r.value]));
  const newMap = new Map(newRows.map((r) => [r.key, r.value]));

  const keys: string[] = [];
  for (const r of newRows) if (!keys.includes(r.key)) keys.push(r.key);
  for (const r of oldRows) if (!keys.includes(r.key)) keys.push(r.key);

  return keys.map((key): ZippedRow => {
    const hasOld = oldMap.has(key);
    const hasNew = newMap.has(key);
    if (hasOld && hasNew) {
      const oldValue = oldMap.get(key)!;
      const newValue = newMap.get(key)!;
      return oldValue === newValue
        ? { key, status: "same", value: newValue }
        : { key, status: "changed", oldValue, newValue };
    }
    if (hasNew) return { key, status: "added", value: newMap.get(key)! };
    return { key, status: "removed", value: oldMap.get(key)! };
  });
}

interface DiffContent {
  title: string;
  oldTitle?: string; // present only when the title itself changed
  rows: ZippedRow[];
}

/** Content for a "changed" node: zips old vs new rows/title so specific field diffs are visible. */
function diffContent(
  d: DiffNode,
  typeVars: TypeVarsMap | null | undefined,
  resolveBinding: (v: string) => string,
): DiffContent {
  const oldNode = d.counterpart;
  if (!oldNode || oldNode.kind !== d.node.kind) {
    // Root-level kind change (the only case a DiffNode can reach us without going through
    // signature-matched pairing, which never pairs across differing kinds).
    const newContent = nodeContent(d.node, typeVars, resolveBinding);
    if (!oldNode) return { title: newContent.title, rows: newContent.rows.map((r) => ({ ...r, status: "same" as const })) };
    return {
      title: newContent.title,
      rows: [{ key: "kind", status: "changed", oldValue: oldNode.kind, newValue: d.node.kind }],
    };
  }

  const oldContent = nodeContent(oldNode, typeVars, resolveBinding);
  const newContent = nodeContent(d.node, typeVars, resolveBinding);
  return {
    title: newContent.title,
    oldTitle: oldContent.title !== newContent.title ? oldContent.title : undefined,
    rows: zipRows(oldContent.rows, newContent.rows),
  };
}

/** Row count a diffContent's rows will occupy once rendered (changed rows are stacked two lines). */
function diffRowLines(rows: ZippedRow[]): number {
  return rows.reduce((n, r) => n + (r.status === "changed" ? 2 : 1), 0);
}

const BASE_W = 220;

/** Box size for a node, given its diff status. Changed nodes may be taller than nodeSize() assumes
 * because differing field values are stacked two lines (old above, new below). */
function diffNodeSize(
  d: DiffNode,
  typeVars: TypeVarsMap | null | undefined,
  resolveBinding: (v: string) => string,
): { width: number; height: number } {
  if (d.status !== "changed") return nodeSize(d.node, typeVars);

  const content = diffContent(d, typeVars, resolveBinding);
  const n = diffRowLines(content.rows);
  const titleExtra = content.oldTitle ? 14 : 0;

  switch (d.node.kind) {
    case "leaf":
      return { width: BASE_W, height: (n > 0 ? 34 + n * 18 : 52) + titleExtra };
    case "decorator":
      return { width: BASE_W, height: 36 + (n > 0 ? n * 18 + 4 : 0) + titleExtra };
    case "parallel":
    case "subplan":
    case "subtree":
      return { width: BASE_W, height: Math.max(nodeSize(d.node, typeVars).height, 34 + n * 18) + titleExtra };
    default:
      return { width: BASE_W, height: 48 + titleExtra };
  }
}

interface SyntheticContext {
  diffOf: WeakMap<BtNode, DiffNode>;
}

/** Mirror the DiffNode tree into a real BtNode tree (children ordered per the diff, not the
 * original tree) so the existing dagre-based buildLayout() can position it without modification. */
function toSyntheticTree(d: DiffNode, ctx: SyntheticContext): BtNode {
  const base = d.node;
  let synthetic: BtNode;

  switch (base.kind) {
    case "selector":
    case "sequence":
    case "parallel":
    case "subplan":
      synthetic = { ...base, children: d.children.map((c) => toSyntheticTree(c, ctx)) };
      break;
    case "decorator":
      synthetic = { ...base, child: d.children[0] ? toSyntheticTree(d.children[0], ctx) : undefined };
      break;
    case "leaf":
    case "subtree":
      synthetic = { ...base };
      break;
  }

  ctx.diffOf.set(synthetic, d);
  return synthetic;
}

function renderNode(
  n: Node,
  typeVars: TypeVarsMap | null | undefined,
  resolveBinding: (v: string) => string,
  diffOf: WeakMap<BtNode, DiffNode>,
): string {
  const syntheticNode = n.data._btNode as BtNode;
  const d = diffOf.get(syntheticNode)!;
  const status = d.status;
  const { width, height } = diffNodeSize(d, typeVars, resolveBinding);
  const style = KIND_STYLE[syntheticNode.kind];
  const icon = KIND_ICON[syntheticNode.kind];
  const s = STATUS_STYLE[status];

  let g = `<g transform="translate(${n.position.x},${n.position.y})" opacity="${s.opacity ?? 1}">`;
  g += `<rect width="${width}" height="${height}" rx="4" fill="${style.bg}" stroke="${s.border ?? style.border}" stroke-width="${s.border ? 2 : 1}"${s.dash ? ' stroke-dasharray="4 3"' : ""}/>`;
  g += `<rect width="4" height="${height}" fill="${style.border}"/>`;

  let ty = 20;

  if (status === "changed") {
    const content = diffContent(d, typeVars, resolveBinding);
    const titleText = icon
      ? `<text x="10" y="${ty}" font-size="14" font-weight="700" fill="${style.border}">${icon}</text><text x="26" y="${ty}" font-size="12" font-weight="700" fill="#ccc">${escapeXml(truncate(content.title, 22))}</text>`
      : `<text x="10" y="${ty}" font-size="12" font-weight="700" fill="${style.border}">${escapeXml(truncate(content.title, 28))}</text>`;
    g += titleText;
    ty += 18;
    if (content.oldTitle) {
      g += `<text x="10" y="${ty}" font-size="9" fill="#f44336" text-decoration="line-through">${escapeXml(truncate(content.oldTitle, 30))}</text>`;
      ty += 14;
    }

    for (const row of content.rows) {
      if (row.status === "same") {
        g += `<text x="10" y="${ty}" font-size="10" fill="#aaa">${escapeXml(truncate(row.key, 14))}</text>`;
        g += `<text x="80" y="${ty}" font-size="10" fill="#e0e0e0">${escapeXml(truncate(row.value, 22))}</text>`;
        ty += 18;
      } else if (row.status === "added") {
        g += `<text x="10" y="${ty}" font-size="10" fill="#aaa">${escapeXml(truncate(row.key, 14))}</text>`;
        g += `<text x="80" y="${ty}" font-size="10" fill="#4CAF50">+ ${escapeXml(truncate(row.value, 20))}</text>`;
        ty += 18;
      } else if (row.status === "removed") {
        g += `<text x="10" y="${ty}" font-size="10" fill="#aaa">${escapeXml(truncate(row.key, 14))}</text>`;
        g += `<text x="80" y="${ty}" font-size="10" fill="#f44336" text-decoration="line-through">${escapeXml(truncate(row.value, 20))}</text>`;
        ty += 18;
      } else {
        g += `<text x="10" y="${ty}" font-size="10" fill="#aaa">${escapeXml(truncate(row.key, 14))}</text>`;
        g += `<text x="80" y="${ty}" font-size="9" fill="#f44336" text-decoration="line-through">${escapeXml(truncate(row.oldValue, 22))}</text>`;
        ty += 14;
        g += `<text x="80" y="${ty}" font-size="10" fill="#FFC107">${escapeXml(truncate(row.newValue, 22))}</text>`;
        ty += 18;
      }
    }
  } else {
    const { title, rows } = nodeContent(syntheticNode, typeVars, resolveBinding);
    if (icon) {
      g += `<text x="10" y="${ty}" font-size="14" font-weight="700" fill="${style.border}">${icon}</text>`;
      g += `<text x="26" y="${ty}" font-size="12" font-weight="700" fill="#ccc">${escapeXml(truncate(title, 22))}</text>`;
    } else {
      g += `<text x="10" y="${ty}" font-size="12" font-weight="700" fill="${style.border}">${escapeXml(truncate(title, 28))}</text>`;
    }
    ty += 18;

    for (const row of rows) {
      const valColor = row.isDefault ? "#666" : "#e0e0e0";
      g += `<text x="10" y="${ty}" font-size="10" fill="#aaa">${escapeXml(truncate(row.key, 14))}</text>`;
      g += `<text x="80" y="${ty}" font-size="10" fill="${valColor}"${row.isDefault ? ' font-style="italic"' : ""}>${escapeXml(truncate(row.value, 22))}</text>`;
      ty += 18;
    }
  }

  if (typeof n.data.childIndex === "number") {
    g += `<text x="${width - 8}" y="12" font-size="9" font-weight="700" fill="rgba(200,200,200,0.5)" text-anchor="end">${n.data.childIndex + 1}</text>`;
  }
  if (s.badge) {
    g += `<circle cx="10" cy="10" r="8" fill="${s.border}"/>`;
    g += `<text x="10" y="13" font-size="10" font-weight="700" text-anchor="middle" fill="#111">${s.badge}</text>`;
  }
  g += "</g>";
  return g;
}

function renderEdges(
  nodes: Node[],
  edges: Edge[],
  typeVars: TypeVarsMap | null | undefined,
  resolveBinding: (v: string) => string,
  diffOf: WeakMap<BtNode, DiffNode>,
): string {
  const byId = new Map(nodes.map((n) => [n.id, n]));
  const sizeOf = (n: Node) => diffNodeSize(diffOf.get(n.data._btNode as BtNode)!, typeVars, resolveBinding);
  let out = "";
  for (const e of edges) {
    const source = byId.get(e.source);
    const target = byId.get(e.target);
    if (!source || !target) continue;

    const sSize = sizeOf(source);
    const tSize = sizeOf(target);
    const sx = source.position.x + sSize.width / 2;
    const sy = source.position.y + sSize.height;
    const tx = target.position.x + tSize.width / 2;
    const ty = target.position.y;
    const isDecorator = e.type === "straight";
    const stroke = isDecorator ? "#607D8B" : "#555";
    const w = isDecorator ? 3 : 1.5;

    if (isDecorator) {
      out += `<line x1="${sx}" y1="${sy}" x2="${tx}" y2="${ty}" stroke="${stroke}" stroke-width="${w}"/>`;
    } else {
      const midY = (sy + ty) / 2;
      out += `<path d="M ${sx} ${sy} L ${sx} ${midY} L ${tx} ${midY} L ${tx} ${ty}" fill="none" stroke="${stroke}" stroke-width="${w}"/>`;
      out += `<polygon points="${tx - 4},${ty - 6} ${tx + 4},${ty - 6} ${tx},${ty}" fill="${stroke}"/>`;
    }
  }
  return out;
}

function boundingBox(
  nodes: Node[],
  typeVars: TypeVarsMap | null | undefined,
  resolveBinding: (v: string) => string,
  diffOf: WeakMap<BtNode, DiffNode>,
): { width: number; height: number } {
  let maxX = 0;
  let maxY = 0;
  for (const n of nodes) {
    const { width, height } = diffNodeSize(diffOf.get(n.data._btNode as BtNode)!, typeVars, resolveBinding);
    maxX = Math.max(maxX, n.position.x + width);
    maxY = Math.max(maxY, n.position.y + height);
  }
  return { width: maxX, height: maxY };
}

const LEGEND_ITEMS: Array<{ badge: string; color: string; label: string }> = [
  { badge: "+", color: "#4CAF50", label: "added" },
  { badge: "−", color: "#f44336", label: "removed" },
  { badge: "~", color: "#FFC107", label: "changed" },
];

function renderLegend(): { svg: string; width: number; height: number } {
  const ITEM_W = 100;
  const H = 20;
  let svg = "";
  LEGEND_ITEMS.forEach((item, i) => {
    const x = i * ITEM_W;
    svg += `<circle cx="${x + 8}" cy="${H / 2}" r="8" fill="${item.color}"/>`;
    svg += `<text x="${x + 8}" y="${H / 2 + 3}" font-size="10" font-weight="700" text-anchor="middle" fill="#111">${item.badge}</text>`;
    svg += `<text x="${x + 22}" y="${H / 2 + 4}" font-size="11" fill="#ccc">${escapeXml(item.label)}</text>`;
  });
  return { svg, width: LEGEND_ITEMS.length * ITEM_W, height: H };
}

/** Single unified tree: one node per DiffNode, add/remove/changed annotated inline. */
export function renderDiffSvg(diff: DiffNode, typeVars?: TypeVarsMap | null): string {
  const resolveBinding = (v: string) => v;
  const diffOf = new WeakMap<BtNode, DiffNode>();
  const syntheticRoot = toSyntheticTree(diff, { diffOf });

  const sizeFn = (btNode: BtNode, tv?: TypeVarsMap | null) => diffNodeSize(diffOf.get(btNode)!, tv, resolveBinding);
  const { nodes, edges } = buildLayout(syntheticRoot, false, typeVars, sizeFn);
  const { width: treeWidth, height: treeHeight } = boundingBox(nodes, typeVars, resolveBinding, diffOf);

  const PAD = 20;
  const LEGEND_H = 24;

  const legend = renderLegend();

  const totalWidth = PAD * 2 + Math.max(treeWidth, legend.width);
  const totalHeight = PAD * 2 + LEGEND_H + treeHeight;

  let svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${totalWidth}" height="${totalHeight}" viewBox="0 0 ${totalWidth} ${totalHeight}" font-family="Segoe UI, Helvetica, Arial, sans-serif">`;
  svg += `<rect width="${totalWidth}" height="${totalHeight}" fill="#1e1e1e"/>`;
  svg += `<g transform="translate(${PAD},${PAD})">${legend.svg}</g>`;
  svg += `<g transform="translate(${PAD},${PAD + LEGEND_H})">`;
  svg += renderEdges(nodes, edges, typeVars, resolveBinding, diffOf);
  for (const n of nodes) svg += renderNode(n, typeVars, resolveBinding, diffOf);
  svg += "</g>";
  svg += "</svg>";
  return svg;
}
