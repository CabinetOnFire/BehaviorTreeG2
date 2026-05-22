import * as vscode from "vscode";
import type { BtNode, SubtreeDescriptor } from "../shared/types";
import { parseFile } from "./parser/btParser";
import { serialize } from "./serializer/btSerializer";

/**
 * Write a mutated BtNode back to the DM file using WorkspaceEdit,
 * preserving VS Code undo history.
 */
export async function writeSubtreeToFile(
  uri: vscode.Uri,
  _originalDescriptor: SubtreeDescriptor,
  root: BtNode,
): Promise<void> {
  const doc = await vscode.workspace.openTextDocument(uri);
  const text = doc.getText();

  // Re-parse to get fresh offsets (file may have changed since last parse)
  const freshSubtrees = parseFile(text);
  const fresh = freshSubtrees.find(
    (s) => s.typePath === _originalDescriptor.typePath,
  );
  if (!fresh) {
    vscode.window.showErrorMessage(
      `BT Editor: could not locate "${_originalDescriptor.typePath}" in file for write-back.`,
    );
    return;
  }

  const serialized = serialize(root, 1);
  const replacement = `behavior_nodes = ${serialized}`;

  // Convert char offsets to vscode.Position (using the pre-processed offsets
  // which match the original document because we only strip backslash continuations
  // for parsing — we still write back into the original text).
  //
  // NOTE: offsets from btParser are in pre-processed text. For write-back we
  // use the raw document positions by scanning for the same pattern.
  const rawRe = /behavior_nodes\s*=\s*BT_/g;
  const targetTypeDecl = fresh.typePath;
  let foundStart = -1;
  let foundEnd = -1;

  // Find the behavior_nodes assignment belonging to this typePath in raw text
  const rawLines = text;
  // Strategy: find the type declaration in raw text, then the next behavior_nodes = BT_
  const typeIdx = rawLines.indexOf(targetTypeDecl);
  if (typeIdx === -1) {
    vscode.window.showErrorMessage(`BT Editor: typePath not found in raw file.`);
    return;
  }

  rawRe.lastIndex = typeIdx;
  const rawMatch = rawRe.exec(rawLines);
  if (!rawMatch) {
    vscode.window.showErrorMessage(`BT Editor: behavior_nodes not found after typePath.`);
    return;
  }

  foundStart = rawMatch.index;
  foundEnd = findEndOffsetRaw(rawLines, rawMatch.index + rawMatch[0].length - 3); // rewind to BT_

  const startPos = doc.positionAt(foundStart);
  const endPos = doc.positionAt(foundEnd);

  const edit = new vscode.WorkspaceEdit();
  edit.replace(uri, new vscode.Range(startPos, endPos), replacement);
  await vscode.workspace.applyEdit(edit);
}

function findEndOffsetRaw(text: string, from: number): number {
  // scan from the BT_ macro name forward to find the matching close paren
  let depth = 0;
  let inString = false;
  let i = from;

  while (i < text.length && text[i] !== "(") i++;

  for (; i < text.length; i++) {
    const ch = text[i];
    if (ch === "\\" && text[i + 1] === "\n") { i++; continue; }
    if (ch === '"' && !inString) { inString = true; continue; }
    if (ch === '"' && inString) { inString = false; continue; }
    if (inString) continue;
    if (ch === "(") depth++;
    else if (ch === ")") {
      depth--;
      if (depth === 0) return i + 1;
    }
  }
  return i;
}

export interface ScanResult {
  behaviors: string[];
  subtrees: Array<{ typePath: string; filePath: string }>;
  controllers: Array<{ typePath: string; filePath: string }>;
  typeVars: Record<string, Array<{ name: string; defaultValue: string }>>;
  /** Maps every scanned typePath to the file where it was first declared. */
  typeFilePaths: Record<string, string>;
}

// ──────────────────────────────────────────────────────────────────────────────
// Type-var scanner — resolves inherited vars for decorator and behavior types
// ──────────────────────────────────────────────────────────────────────────────

const STRUCTURAL_VARS = new Set([
  "children", "child", "root", "tick_cooldowns", "tick_results",
  "children_typepaths", "behavior_nodes", "parent_type", "child_typepath"
]);

interface _RawTypeInfo {
  ownVars: Map<string, string>;    // decorator: type-level vars
  performParams: Array<{ name: string; defaultValue: string }> | null;  // behavior: perform() params [2..]
}

/**
 * Single-pass scan: one findFiles call, files read sequentially, all data
 * collected in one loop — no racing parallel findFiles/read calls.
 */
export async function scanAll(): Promise<ScanResult> {
  const files = await vscode.workspace.findFiles("**/*.dm", "**/node_modules/**");

  const behaviorSet = new Set<string>();
  const seenSubtrees = new Set<string>();
  const seenControllers = new Set<string>();
  const subtrees: Array<{ typePath: string; filePath: string }> = [];
  const controllers: Array<{ typePath: string; filePath: string }> = [];
  const allTypes = new Map<string, _RawTypeInfo>();
  const typeFilePaths: Record<string, string> = {};

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

    const behaviorRe = /^\/datum\/ai_behavior\/[^\s(]+/gm;
    while ((m = behaviorRe.exec(text)) !== null) {
      const tp = m[0].trim();
      behaviorSet.add(tp);
      if (!(tp in typeFilePaths)) typeFilePaths[tp] = fsPath;
    }

    const subtreeRe = /^\/datum\/bt_node\/subtree\/[^\s(]+/gm;
    while ((m = subtreeRe.exec(text)) !== null) {
      const tp = m[0].trim();
      if (!seenSubtrees.has(tp)) { seenSubtrees.add(tp); subtrees.push({ typePath: tp, filePath: fsPath }); }
      if (!(tp in typeFilePaths)) typeFilePaths[tp] = fsPath;
    }

    const controllerRe = /^\/datum\/ai_controller\/[^\s(]+/gm;
    while ((m = controllerRe.exec(text)) !== null) {
      const tp = m[0].trim();
      if (!seenControllers.has(tp)) { seenControllers.add(tp); controllers.push({ typePath: tp, filePath: fsPath }); }
      if (!(tp in typeFilePaths)) typeFilePaths[tp] = fsPath;
    }

    _parseTypeVarsFromText(text, allTypes, fsPath, typeFilePaths);
  }

  const typeVars: Record<string, Array<{ name: string; defaultValue: string }>> = {};
  for (const [typePath] of allTypes) {
    const isBehavior = /^\/datum\/ai_behavior\//.test(typePath);
    const isDecorator = /^\/datum\/bt_node\/decorator\//.test(typePath);
    if (!isBehavior && !isDecorator) continue;
    const stopAt = isBehavior ? "/datum/ai_behavior" : "/datum/bt_node/decorator";
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

function _parseTypeVarsFromText(
  text: string,
  allTypes: Map<string, _RawTypeInfo>,
  filePath = "",
  typeFilePaths: Record<string, string> = {},
): void {
  let currentType: string | null = null;
  let currentIsBehavior = false;

  for (const rawLine of text.split(/\r?\n/)) {
    // ── Column-0 lines ────────────────────────────────────────────────────────
    if (rawLine.startsWith("/datum/")) {
      // Full-path perform override: /datum/ai_behavior/foo/.../perform(params)
      const perfM = rawLine.match(
        /^(\/datum\/ai_behavior(?:\/[\w]+)+)\/perform\s*\(([^)]*)\)\s*(?:\/\/.*)?$/,
      );
      if (perfM) {
        const typeForPerform = perfM[1];
        if (!allTypes.has(typeForPerform)) {
          allTypes.set(typeForPerform, { ownVars: new Map(), performParams: null });
        }
        if (filePath && !(typeForPerform in typeFilePaths)) typeFilePaths[typeForPerform] = filePath;
        const info = allTypes.get(typeForPerform)!;
        if (info.performParams === null) {
          info.performParams = _parsePerformParams(perfM[2]);
        }
        // A proc-override line is not a type body scope; leave currentType as-is
        continue;
      }

      // Plain type declaration: /datum/foo/bar (nothing after the path)
      const typeM = rawLine.match(/^(\/datum\/(?:[\w]+\/)*[\w]+)\s*(?:\/\/.*)?$/);
      if (typeM) {
        currentType = typeM[1];
        currentIsBehavior = /^\/datum\/ai_behavior\//.test(currentType);
        if (!allTypes.has(currentType)) {
          allTypes.set(currentType, { ownVars: new Map(), performParams: null });
        }
        if (filePath && !(currentType in typeFilePaths)) typeFilePaths[currentType] = filePath;
        continue;
      }

      // Other column-0 /datum/ lines (proc overrides, etc.) — leave context
      currentType = null;
      currentIsBehavior = false;
      continue;
    }

    // Non-indented, non-empty, non-comment → leave type context
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

    // Single-tab lines inside a type body
    if (rawLine.startsWith("\t") && !rawLine.startsWith("\t\t")) {
      if (currentIsBehavior) {
        // Indented perform() declaration
        const perfM = rawLine.match(
          /^\t(?:\/proc\/)?perform\s*\(([^)]*)\)\s*(?:\/\/.*)?$/,
        );
        if (perfM) {
          const info = allTypes.get(currentType)!;
          if (info.performParams === null) {
            info.performParams = _parsePerformParams(perfM[1]);
          }
        }
      } else {
        // Decorator: collect var/ declarations (with or without default value)
        const varM = rawLine.match(
          /^\tvar\/(?:[\w/]*\/)?(\w+)(?:\s*=\s*(.+?))?\s*(?:\/\/.*)?$/,
        );
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

/**
 * Split a perform() param string, skip the first two args (seconds_per_tick +
 * controller), and return the rest as named params with optional default values.
 */
function _parsePerformParams(
  paramsStr: string,
): Array<{ name: string; defaultValue: string }> {
  const parts = paramsStr.split(",").map((s) => s.trim()).filter(Boolean);
  return parts.slice(2).map(_parseOneParam);
}

/**
 * Extract { name, defaultValue } from a single DM proc param token such as:
 *   target_key
 *   datum/ai_controller/target_key
 *   var/datum/ai_controller/target_key = null
 */
function _parseOneParam(param: string): { name: string; defaultValue: string } {
  let defaultValue = "";
  const eqIdx = param.indexOf("=");
  if (eqIdx !== -1) {
    defaultValue = param.slice(eqIdx + 1).trim();
    param = param.slice(0, eqIdx).trim();
  }
  // Strip leading "var/"
  if (param.startsWith("var/")) param = param.slice(4);
  // Take the last path segment as the name
  const segments = param.split("/").filter(Boolean);
  const name = segments[segments.length - 1] ?? param;
  return { name, defaultValue };
}

function _resolveTypeVars(
  typePath: string,
  allTypes: Map<string, _RawTypeInfo>,
  stopAt: string,
): Array<{ name: string; defaultValue: string }> {
  const isBehavior = stopAt === "/datum/ai_behavior";

  if (isBehavior) {
    // For behaviors: walk ancestor chain, return nearest perform() params found
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

  // For decorators: merge ownVars up the inheritance chain (child overrides parent)
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
