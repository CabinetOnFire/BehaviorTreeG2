import * as vscode from "vscode";
import * as path from "path";
import type { BtNode, SubtreeDescriptor } from "../shared/types";
import { serializeToJsonString } from "./serializer/btJsonSerializer";
import { generateStandaloneDmFile } from "./serializer/btDmCodegen";
import { parseJsonFile } from "./parser/btJsonParser";

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
  const jsonText = serializeToJsonString(root);

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
// Deploy: generate a standalone .dm file with behavior_nodes = list(...)
// ──────────────────────────────────────────────────────────────────────────────

/**
 * Deploy a single .bt.json file's tree to a standalone generated .dm file.
 *
 * The output file is written to the directory configured in
 * `btEditor.outputDirectory` (default: `code/_generated/behavior_trees/`),
 * named after the leaf segment of the datum typePath (e.g. `repairbot_emagged.dm`).
 *
 * Returns a human-readable result message.
 */
export async function deployJsonToDm(
  jsonUri: vscode.Uri,
): Promise<{ success: boolean; message: string }> {
  // 1. Parse JSON
  let root: BtNode;
  try {
    const bytes = await vscode.workspace.fs.readFile(jsonUri);
    root = parseJsonFile(Buffer.from(bytes).toString("utf8"));
  } catch (e) {
    return { success: false, message: `Failed to parse JSON: ${e}` };
  }

  const jsonFileName = path.basename(jsonUri.fsPath);
  const jsonDir = path.dirname(jsonUri.fsPath);

  // 2. Find the co-located .dm file and extract the typePath that references this JSON
  const dmFiles = await vscode.workspace.findFiles(
    new vscode.RelativePattern(jsonDir, "*.dm"),
    "**/node_modules/**",
  );

  let typePath: string | undefined;

  for (const candidate of dmFiles) {
    try {
      const bytes = await vscode.workspace.fs.readFile(candidate);
      typePath = _extractTypePath(Buffer.from(bytes).toString("utf8"), jsonFileName);
      if (typePath) break;
    } catch {
      continue;
    }
  }

  if (!typePath) {
    return {
      success: false,
      message: `No .dm file found referencing "${jsonFileName}" in ${jsonDir}`,
    };
  }

  // 3. Resolve output path from config
  const workspaceFolders = vscode.workspace.workspaceFolders;
  if (!workspaceFolders?.length) {
    return { success: false, message: "No workspace folder open." };
  }
  const workspaceRoot = workspaceFolders[0].uri.fsPath;
  const config = vscode.workspace.getConfiguration("btEditor");
  const outputDir: string = config.get("outputDirectory") ?? "code/_generated/behavior_trees";
  const leafName = typePath.split("/").filter(Boolean).pop()!;
  const outPath = path.join(workspaceRoot, outputDir, `${leafName}.dm`);
  const outUri = vscode.Uri.file(outPath);

  // 4. Generate and write the standalone .dm file
  const content = generateStandaloneDmFile(typePath, root);
  const edit = new vscode.WorkspaceEdit();
  try {
    const doc = await vscode.workspace.openTextDocument(outUri);
    edit.replace(
      outUri,
      new vscode.Range(new vscode.Position(0, 0), doc.positionAt(doc.getText().length)),
      content,
    );
  } catch {
    edit.createFile(outUri, { overwrite: true });
    edit.insert(outUri, new vscode.Position(0, 0), content);
  }
  await vscode.workspace.applyEdit(edit);
  await (await vscode.workspace.openTextDocument(outUri)).save();

  return {
    success: true,
    message: `Deployed "${jsonFileName}" → ${path.relative(workspaceRoot, outPath)}`,
  };
}

/**
 * Deploy all .bt.json files in the workspace to their co-located .dm files.
 * Unaccounted files (no matching DM reference) are logged to `log` if provided.
 */
export async function deployAllJsonToDm(
  log?: vscode.OutputChannel,
): Promise<{ success: boolean; message: string }> {
  const jsonFiles = await vscode.workspace.findFiles("**/*.bt.json", "**/node_modules/**");

  if (jsonFiles.length === 0) {
    return { success: false, message: "No .bt.json files found in workspace." };
  }

  const results: string[] = [];
  let errors = 0;

  for (const uri of jsonFiles) {
    const r = await deployJsonToDm(uri);
    results.push((r.success ? "✓" : "✗") + " " + r.message);
    if (!r.success) {
      errors++;
      if (log) {
        log.appendLine(`[deploy] unaccounted: ${uri.fsPath} — ${r.message}`);
      }
    }
  }

  const summary =
    errors === 0
      ? `Deployed ${jsonFiles.length} file(s) successfully.`
      : `${jsonFiles.length - errors}/${jsonFiles.length} deployed; ${errors} error(s).`;

  return {
    success: errors === 0,
    message: summary + "\n" + results.join("\n"),
  };
}

// ──────────────────────────────────────────────────────────────────────────────
// Deploy helpers
// ──────────────────────────────────────────────────────────────────────────────

/**
 * Scan DM source text for a datum that declares `behavior_tree_json = "jsonFileName"`.
 * Returns the typePath of that datum, or undefined if not found.
 */
function _extractTypePath(dmText: string, jsonFileName: string): string | undefined {
  let currentType: string | undefined;
  for (const line of dmText.split(/\r?\n/)) {
    if (line.startsWith("/datum/")) {
      const m = line.match(/^(\/datum\/(?:[\w]+\/)*[\w]+)\s*(?:\/\/.*)?$/);
      currentType = m ? m[1] : undefined;
      continue;
    }
    if (line.trim() && !line.startsWith("\t") && !line.startsWith("//") && !line.startsWith("#")) {
      currentType = undefined;
      continue;
    }
    if (currentType) {
      const m = line.match(/behavior_tree_json\s*=\s*"([^"]+)"/);
      if (m && path.basename(m[1]) === jsonFileName) return currentType;
    }
  }
  return undefined;
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
    const dir = path.dirname(fsPath);
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

    // Collect behavior_tree_json references
    _parseBtJsonRefs(text, dir, btJsonRefs);

    _parseTypeVarsFromText(text, allTypes, fsPath, typeFilePaths);
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

function _parseBtJsonRefs(text: string, dmDir: string, btJsonRefs: Map<string, string>): void {
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
      if (btM) {
        const jsonPath = path.resolve(dmDir, btM[1]);
        if (!btJsonRefs.has(currentType)) {
          btJsonRefs.set(currentType, jsonPath);
        }
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
