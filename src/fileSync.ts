import * as vscode from "vscode";
import * as path from "path";
import type { BtNode, SubtreeDescriptor } from "../shared/types";
import { serializeToJsonString } from "./serializer/btJsonSerializer";

// ──────────────────────────────────────────────────────────────────────────────
// Write-back: save a mutated AST to its .bt.json file
// ──────────────────────────────────────────────────────────────────────────────

/**
 * Write a mutated BtNode back to the descriptor's .bt.json file using
 * WorkspaceEdit (preserves VS Code undo history).
 */
export async function writeSubtreeToFile(
  descriptor: SubtreeDescriptor,
  root: BtNode,
): Promise<void> {
  if (!descriptor.jsonPath) {
    vscode.window.showErrorMessage(
      `BT Editor: no JSON path associated with "${descriptor.typePath}" — cannot save.`,
    );
    return;
  }

  const uri = vscode.Uri.file(descriptor.jsonPath);
  const dmType = descriptor.typePath?.startsWith("/") ? descriptor.typePath : undefined;
  const jsonText = serializeToJsonString(root, dmType);

  const edit = new vscode.WorkspaceEdit();

  // Replace the entire file content.
  try {
    const doc = await vscode.workspace.openTextDocument(uri);
    const fullRange = new vscode.Range(
      new vscode.Position(0, 0),
      doc.positionAt(doc.getText().length),
    );
    edit.replace(uri, fullRange, jsonText);
  } catch {
    // File not yet open — create it fresh
    edit.createFile(uri, { overwrite: true });
    edit.insert(uri, new vscode.Position(0, 0), jsonText);
  }

  await vscode.workspace.applyEdit(edit);
  const savedDoc = await vscode.workspace.openTextDocument(uri);
  await savedDoc.save();
}

// ──────────────────────────────────────────────────────────────────────────────
// Create: write a minimal empty-selector .bt.json file
// ──────────────────────────────────────────────────────────────────────────────

export async function createEmptyBtJson(uri: vscode.Uri): Promise<void> {
  const content = JSON.stringify({ type: "selector", children: [] }, null, "\t");
  await vscode.workspace.fs.writeFile(uri, Buffer.from(content, "utf-8"));
}

// ──────────────────────────────────────────────────────────────────────────────
// ScanResult & workspace scan
// ──────────────────────────────────────────────────────────────────────────────

export interface ScanResult {
  behaviors: string[];
  subtrees: Array<{ typePath: string; filePath: string; jsonPath?: string }>;
  controllers: Array<{ typePath: string; filePath: string; jsonPath?: string }>;
  typeVars: Record<string, Array<{ name: string; defaultValue: string }>>;
  /** Maps every scanned typePath to the file where it was first declared. */
  typeFilePaths: Record<string, string>;
}

const STRUCTURAL_VARS = new Set([
  "children",
  "child",
  "root",
  "tick_cooldowns",
  "tick_results",
  "children_typepaths",
  "behavior_nodes",
  "parent_type",
  "child_typepath",
  "behavior_tree_json",
  "child_active",
  "owning_controller",
  "has_observer_signals",
  "observers_registered",
]);

interface _RawTypeInfo {
  ownVars: Map<string, string>;
  performParams: Array<{ name: string; defaultValue: string }> | null;
}

/**
 * Single-pass scan of all .dm files: collects behaviors, subtrees, controllers,
 * type variables, and behavior_tree_json references.
 */
export async function scanAll(): Promise<ScanResult> {
  const files = await vscode.workspace.findFiles("**/*.dm", "**/node_modules/**");

  const behaviorSet = new Set<string>();
  const seenSubtrees = new Set<string>();
  const seenControllers = new Set<string>();
  const subtrees: Array<{ typePath: string; filePath: string; jsonPath?: string }> = [];
  const controllers: Array<{ typePath: string; filePath: string; jsonPath?: string }> = [];
  const allTypes = new Map<string, _RawTypeInfo>();
  const typeFilePaths: Record<string, string> = {};

  // typePath → { relPath, dmFsPath } — resolved to absolute after the loop
  const rawBtJsonRefs = new Map<string, { relPath: string; dmFsPath: string }>();
  // typePath → resolved absolute path of the .bt.json file
  const btJsonRefs = new Map<string, string>();

  for (const uri of files) {
    let text: string;
    try {
      const bytes = await vscode.workspace.fs.readFile(uri);
      text = Buffer.from(bytes).toString("utf8");
    } catch {
      continue;
    }

    const fsPath = uri.fsPath;
    let m: RegExpExecArray | null;

    const behaviorRe = /^\/datum\/bt_node\/ai_behavior\/[\w/]+(?=\s*(?:\/\/.*)?$)/gm;
    while ((m = behaviorRe.exec(text)) !== null) {
      const tp = m[0].trim();
      behaviorSet.add(tp);
      if (!(tp in typeFilePaths)) typeFilePaths[tp] = fsPath;
    }

    const subtreeRe = /^\/datum\/bt_node\/subtree\/[\w/]+(?=\s*(?:\/\/.*)?$)/gm;
    while ((m = subtreeRe.exec(text)) !== null) {
      const tp = m[0].trim();
      if (!seenSubtrees.has(tp)) {
        seenSubtrees.add(tp);
        subtrees.push({ typePath: tp, filePath: fsPath });
      }
      if (!(tp in typeFilePaths)) typeFilePaths[tp] = fsPath;
    }

    const controllerRe = /^\/datum\/ai_controller\/[\w/]+(?=\s*(?:\/\/.*)?$)/gm;
    while ((m = controllerRe.exec(text)) !== null) {
      const tp = m[0].trim();
      if (!seenControllers.has(tp)) {
        seenControllers.add(tp);
        controllers.push({ typePath: tp, filePath: fsPath });
      }
      if (!(tp in typeFilePaths)) typeFilePaths[tp] = fsPath;
    }

    _parseBtJsonRefs(text, rawBtJsonRefs, fsPath);
    _parseTypeVarsFromText(text, allTypes, fsPath, typeFilePaths);
  }

  // Resolve .bt.json paths — prefer relative to the DM file, fall back to workspace glob
  for (const [typePath, { relPath, dmFsPath }] of rawBtJsonRefs) {
    const absPath = path.resolve(path.dirname(dmFsPath), relPath);
    try {
      await vscode.workspace.fs.stat(vscode.Uri.file(absPath));
      btJsonRefs.set(typePath, absPath);
      continue;
    } catch { /* not at DM-relative path — try workspace glob */ }
    const found = await vscode.workspace.findFiles(relPath.replace(/\\/g, "/"), null, 1);
    if (found[0]) btJsonRefs.set(typePath, found[0].fsPath);
  }

  // Attach jsonPath to subtrees and controllers that have one
  for (const s of subtrees) {
    const jp = btJsonRefs.get(s.typePath);
    if (jp) s.jsonPath = jp;
  }
  for (const c of controllers) {
    const jp = btJsonRefs.get(c.typePath);
    if (jp) c.jsonPath = jp;
  }

  const typeVars: Record<string, Array<{ name: string; defaultValue: string }>> = {};
  for (const [typePath] of allTypes) {
    const isBehavior = /^\/datum\/bt_node\/ai_behavior\//.test(typePath);
    const isDecorator = /^\/datum\/bt_node\/decorator\//.test(typePath);
    if (!isBehavior && !isDecorator) continue;
    const stopAt = isBehavior ? "/datum/bt_node/ai_behavior" : "/datum/bt_node/decorator";
    typeVars[typePath] = _resolveTypeVars(typePath, allTypes, stopAt);
  }

  return {
    behaviors: [...behaviorSet].sort(),
    subtrees: subtrees.sort((a, b) => a.typePath.localeCompare(b.typePath)),
    controllers: controllers.sort((a, b) => a.typePath.localeCompare(b.typePath)),
    typeVars,
    typeFilePaths,
  };
}

// ──────────────────────────────────────────────────────────────────────────────
// behavior_tree_json reference scanner
// ──────────────────────────────────────────────────────────────────────────────

function _parseBtJsonRefs(
  text: string,
  btJsonRefs: Map<string, { relPath: string; dmFsPath: string }>,
  dmFsPath: string,
): void {
  let currentType: string | null = null;

  for (const rawLine of text.split(/\r?\n/)) {
    // Column-0 type declaration
    if (rawLine.startsWith("/datum/")) {
      const typeM = rawLine.match(/^(\/datum\/(?:[\w]+\/)*[\w]+)\s*(?:\/\/.*)?$/);
      currentType = typeM ? typeM[1] : null;
      continue;
    }

    // Reset context on non-indented non-empty lines
    if (
      rawLine.trim() &&
      !rawLine.startsWith("\t") &&
      !rawLine.startsWith("//") &&
      !rawLine.startsWith("#")
    ) {
      currentType = null;
      continue;
    }

    if (!currentType) continue;

    // Single-tab behavior_tree_json assignment
    if (rawLine.startsWith("\t") && !rawLine.startsWith("\t\t")) {
      const btM = rawLine.match(/^\t+behavior_tree_json\s*=\s*"([^"]+)"/);
      if (btM && !btJsonRefs.has(currentType)) {
        btJsonRefs.set(currentType, { relPath: btM[1], dmFsPath });
      }
    }
  }
}

// ──────────────────────────────────────────────────────────────────────────────
// Type-var scanner
// ──────────────────────────────────────────────────────────────────────────────

function _parseTypeVarsFromText(
  text: string,
  allTypes: Map<string, _RawTypeInfo>,
  filePath = "",
  typeFilePaths: Record<string, string> = {},
): void {
  let currentType: string | null = null;
  let currentIsBehavior = false;

  for (const rawLine of text.split(/\r?\n/)) {
    if (rawLine.startsWith("/datum/")) {
      const perfM = rawLine.match(
        /^(\/datum\/bt_node\/ai_behavior(?:\/[\w]+)+)\/perform\s*\(([^)]*)\)\s*(?:\/\/.*)?$/,
      );
      if (perfM) {
        const typeForPerform = perfM[1];
        if (!allTypes.has(typeForPerform)) {
          allTypes.set(typeForPerform, { ownVars: new Map(), performParams: null });
        }
        if (filePath && !(typeForPerform in typeFilePaths))
          typeFilePaths[typeForPerform] = filePath;
        const info = allTypes.get(typeForPerform)!;
        if (info.performParams === null) {
          info.performParams = _parsePerformParams(perfM[2]);
        }
        continue;
      }

      const typeM = rawLine.match(/^(\/datum\/(?:[\w]+\/)*[\w]+)\s*(?:\/\/.*)?$/);
      if (typeM) {
        currentType = typeM[1];
        currentIsBehavior = /^\/datum\/bt_node\/ai_behavior\//.test(currentType);
        if (!allTypes.has(currentType)) {
          allTypes.set(currentType, { ownVars: new Map(), performParams: null });
        }
        if (filePath && !(currentType in typeFilePaths)) typeFilePaths[currentType] = filePath;
        continue;
      }

      currentType = null;
      currentIsBehavior = false;
      continue;
    }

    if (
      rawLine.trim() &&
      !rawLine.startsWith("\t") &&
      !rawLine.startsWith("//") &&
      !rawLine.startsWith("#") &&
      !rawLine.startsWith("/*")
    ) {
      currentType = null;
      currentIsBehavior = false;
      continue;
    }

    if (!currentType) continue;

    if (rawLine.startsWith("\t") && !rawLine.startsWith("\t\t")) {
      if (currentIsBehavior) {
        const perfM = rawLine.match(/^\t(?:\/proc\/)?perform\s*\(([^)]*)\)\s*(?:\/\/.*)?$/);
        if (perfM) {
          const info = allTypes.get(currentType)!;
          if (info.performParams === null) {
            info.performParams = _parsePerformParams(perfM[1]);
          }
        }
      } else {
        const varM = rawLine.match(/^\tvar\/(?:[\w/]*\/)?(\w+)(?:\s*=\s*(.+?))?\s*(?:\/\/.*)?$/);
        if (varM) {
          const [, varName, defaultVal = ""] = varM;
          if (!STRUCTURAL_VARS.has(varName)) {
            allTypes.get(currentType)!.ownVars.set(varName, defaultVal);
          }
        }
      }
    }
  }
}

function _parsePerformParams(paramsStr: string): Array<{ name: string; defaultValue: string }> {
  const parts = paramsStr
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
  return parts.slice(2).map(_parseOneParam);
}

function _parseOneParam(param: string): { name: string; defaultValue: string } {
  let defaultValue = "";
  const eqIdx = param.indexOf("=");
  if (eqIdx !== -1) {
    defaultValue = param.slice(eqIdx + 1).trim();
    param = param.slice(0, eqIdx).trim();
  }
  if (param.startsWith("var/")) param = param.slice(4);
  const segments = param.split("/").filter(Boolean);
  const name = segments[segments.length - 1] ?? param;
  return { name, defaultValue };
}

function _resolveTypeVars(
  typePath: string,
  allTypes: Map<string, _RawTypeInfo>,
  stopAt: string,
): Array<{ name: string; defaultValue: string }> {
  const isBehavior = stopAt === "/datum/bt_node/ai_behavior";

  if (isBehavior) {
    let cur = typePath;
    for (;;) {
      const info = allTypes.get(cur);
      if (info && info.performParams !== null) {
        return info.performParams;
      }
      if (cur === stopAt) break;
      const segs = cur.split("/").filter(Boolean);
      if (segs.length <= 1) break;
      cur = "/" + segs.slice(0, -1).join("/");
    }
    return [];
  }

  const chain: string[] = [];
  let cur = typePath;
  for (;;) {
    if (allTypes.has(cur)) chain.push(cur);
    if (cur === stopAt) break;
    const segs = cur.split("/").filter(Boolean);
    if (segs.length <= 1) break;
    cur = "/" + segs.slice(0, -1).join("/");
  }
  chain.reverse();

  const merged = new Map<string, string>();
  const order: string[] = [];
  for (const tp of chain) {
    const info = allTypes.get(tp)!;
    for (const [name, defaultVal] of info.ownVars) {
      if (!merged.has(name)) order.push(name);
      merged.set(name, defaultVal);
    }
  }

  return order.map((n) => ({ name: n, defaultValue: merged.get(n)! }));
}
