import * as vscode from "vscode";
import * as path from "path";
import * as cp from "child_process";
import type { BtBindingDeclarations, BtNode, SubtreeDescriptor } from "../shared/types";
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
  bindings?: BtBindingDeclarations,
): Promise<void> {
  if (!descriptor.jsonPath) {
    vscode.window.showErrorMessage(
      `BT Editor: no JSON path associated with "${descriptor.typePath}" — cannot save.`,
    );
    return;
  }

  const uri = vscode.Uri.file(descriptor.jsonPath);
  const dmType = descriptor.typePath?.startsWith("/") ? descriptor.typePath : undefined;
  const jsonText = serializeToJsonString(root, dmType, bindings);

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
// Output channel — set by extension.ts on activation to avoid circular imports
// ──────────────────────────────────────────────────────────────────────────────

let _outputChannel: vscode.OutputChannel | undefined;
export function setOutputChannel(ch: vscode.OutputChannel): void {
  _outputChannel = ch;
}

// ──────────────────────────────────────────────────────────────────────────────
// ScanResult & workspace scan
// ──────────────────────────────────────────────────────────────────────────────

export interface TypeVarsEntry {
  /** Positional params from perform() — retained for scanning but not used in the editor. */
  params: Array<{ name: string; defaultValue: string }>;
  /** Declared vars on the type — map to config{} in the leaf/decorator node. */
  vars: Array<{ name: string; defaultValue: string }>;
}

export interface ScanResult {
  behaviors: string[];
  subtrees: Array<{
    typePath: string;
    filePath: string;
    jsonPath?: string;
    inherited?: boolean;
    bindings?: BtBindingDeclarations;
  }>;
  controllers: Array<{
    typePath: string;
    filePath: string;
    jsonPath?: string;
    inherited?: boolean;
    bindings?: BtBindingDeclarations;
  }>;
  typeVars: Record<string, TypeVarsEntry>;
  /** Maps every scanned typePath to the file where it was first declared. */
  typeFilePaths: Record<string, string>;
}

// This is where we keep nodes the editor shouldnt edit.
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
  "behavior_flags",
  "default_behavior_args",
  "running",
  "next_perform_time",
  "only_set_cooldown_on_success",
  "last_poll_result",
  "is_polled",
  "node_type",
]);

interface _RawTypeInfo {
  ownVars: Map<string, string>;
  performParams: Array<{ name: string; defaultValue: string }> | null;
}

// ──────────────────────────────────────────────────────────────────────────────
// Per-file incremental cache — survives across refreshes within a VS Code session
// ──────────────────────────────────────────────────────────────────────────────

interface _FileScanPartial {
  mtime: number;
  behaviors: string[];
  subtrees: Array<{ typePath: string; filePath: string }>;
  controllers: Array<{ typePath: string; filePath: string }>;
  rawBtJsonRefs: Array<{ typePath: string; relPath: string; dmFsPath: string }>;
  rawTypeInfos: Array<{ typePath: string; info: _RawTypeInfo }>;
  typeFilePaths: Record<string, string>;
}
const _fileCache = new Map<string, _FileScanPartial>();

// Resolved .bt.json paths — keyed by DM typePath, only re-resolved when source file changes
const _btJsonRefsCache = new Map<string, string>();

// Which .dm files had BT content on the last scan — used to skip statting irrelevant files
const _knownBtFilePaths = new Set<string>();

// Only one scan may run at a time; callers that arrive while one is in-flight
// get the same promise instead of spawning a second scan.
let _activeScan: Promise<ScanResult> | null = null;

export function scanAll(forceRefresh = false): Promise<ScanResult> {
  if (_activeScan) return _activeScan;
  _activeScan = _doScanAll(forceRefresh).finally(() => {
    _activeScan = null;
  });
  return _activeScan;
}

// ──────────────────────────────────────────────────────────────────────────────
// Ripgrep-based BT file discovery
// ──────────────────────────────────────────────────────────────────────────────

function _getRgPath(): string {
  const exe = process.platform === "win32" ? "rg.exe" : "rg";
  return path.join(vscode.env.appRoot, "node_modules", "@vscode", "ripgrep", "bin", exe);
}

/** Returns absolute fsPaths of .dm files that contain a BT type declaration. */
async function _findBtDmFiles(): Promise<string[] | null> {
  const roots = vscode.workspace.workspaceFolders?.map((f) => f.uri.fsPath);
  if (!roots || roots.length === 0) return null;

  return new Promise((resolve) => {
    const args = [
      "--files-with-matches",
      "--glob",
      "**/*.dm",
      "--glob",
      "!**/node_modules/**",
      "/datum/(bt_node|ai_controller)/",
      ...roots,
    ];
    const proc = cp.spawn(_getRgPath(), args, { stdio: ["ignore", "pipe", "ignore"] });
    const lines: string[] = [];
    proc.stdout.on("data", (chunk: Buffer) =>
      lines.push(...chunk.toString("utf8").split("\n").filter(Boolean)),
    );
    proc.on("close", () => resolve(lines));
    proc.on("error", () => resolve(null)); // null = fall back to findFiles
  });
}

// ──────────────────────────────────────────────────────────────────────────────
// Bounded-concurrency file reader
// ──────────────────────────────────────────────────────────────────────────────

async function _readFilesInBatches(
  uris: vscode.Uri[],
  concurrency = 20,
): Promise<Array<{ fsPath: string; text: string } | null>> {
  const results: Array<{ fsPath: string; text: string } | null> = new Array(uris.length).fill(null);
  let idx = 0;
  async function worker() {
    while (idx < uris.length) {
      const i = idx++;
      try {
        const bytes = await vscode.workspace.fs.readFile(uris[i]);
        results[i] = { fsPath: uris[i].fsPath, text: Buffer.from(bytes).toString("utf8") };
      } catch {
        results[i] = null;
      }
    }
  }
  await Promise.all(Array.from({ length: Math.min(concurrency, uris.length) }, worker));
  return results;
}

// ──────────────────────────────────────────────────────────────────────────────
// Main scan
// ──────────────────────────────────────────────────────────────────────────────

async function _doScanAll(forceRefresh: boolean): Promise<ScanResult> {
  const log = (msg: string) => _outputChannel?.appendLine(msg);
  const yield_ = () => new Promise<void>((resolve) => setImmediate(resolve));

  // Phase 0: Find BT-relevant .dm files via ripgrep; fall back to findFiles if unavailable.
  const t0 = Date.now();
  const BT_QUICK_CHECK = /\/datum\/(?:bt_node|ai_controller)\//;
  let allDmUris: vscode.Uri[];
  let usedRipgrep = false;

  const rgPaths = await _findBtDmFiles();
  if (rgPaths !== null) {
    allDmUris = rgPaths.map((p) => vscode.Uri.file(p));
    usedRipgrep = true;
    log(`[scan] ripgrep: ${allDmUris.length} relevant .dm files in ${Date.now() - t0}ms`);
  } else {
    allDmUris = await vscode.workspace.findFiles("**/*.dm", "**/node_modules/**");
    log(`[scan] discover (rg unavailable): ${allDmUris.length} .dm files in ${Date.now() - t0}ms`);
  }

  // Phase 1: Stat pass — only stat BT-known files + brand-new files when using fallback.
  // When ripgrep succeeded allDmUris is already small, so stat everything.
  // forceRefresh stats everything regardless (catches newly added BT content in any file).
  const t1 = Date.now();
  const allPartials: (_FileScanPartial | null)[] = new Array(allDmUris.length).fill(null);
  const toStatIndices: number[] = [];

  for (let i = 0; i < allDmUris.length; i++) {
    const fsPath = allDmUris[i].fsPath;
    if (!usedRipgrep && !forceRefresh && _fileCache.has(fsPath) && !_knownBtFilePaths.has(fsPath)) {
      // Fallback path only: known non-BT file — reuse cached empty partial without statting
      allPartials[i] = _fileCache.get(fsPath)!;
    } else {
      toStatIndices.push(i);
    }
  }

  // Build mtime map keyed by allDmUris index to avoid index aliasing bugs
  const mtimeByIdx = new Map<number, number>();
  await Promise.all(
    toStatIndices.map(async (i) => {
      try {
        const s = await vscode.workspace.fs.stat(allDmUris[i]);
        mtimeByIdx.set(i, s.mtime);
      } catch {
        mtimeByIdx.set(i, -1);
      }
    }),
  );

  const missUris: vscode.Uri[] = [];
  const missIndices: number[] = [];

  for (const i of toStatIndices) {
    const uri = allDmUris[i];
    const mtime = mtimeByIdx.get(i)!;
    const cached = _fileCache.get(uri.fsPath);
    if (cached && cached.mtime === mtime) {
      allPartials[i] = cached;
    } else {
      missUris.push(uri);
      missIndices.push(i);
    }
  }
  const skipped = allDmUris.length - toStatIndices.length;
  const hits = toStatIndices.length - missUris.length;
  log(
    `[scan] stat: ${toStatIndices.length} checked (${skipped} skipped), ${missUris.length} miss / ${hits} hit in ${Date.now() - t1}ms`,
  );

  // Phase 2: Read cache-miss files with bounded concurrency
  const t2 = Date.now();
  const fileTexts = await _readFilesInBatches(missUris, 20);
  log(`[scan] read: ${missUris.length} files in ${Date.now() - t2}ms`);

  // Phase 3: Parse cache-miss files
  const t3 = Date.now();
  let parsedCount = 0;
  let totalBehaviors = 0;
  let totalSubtrees = 0;
  let totalControllers = 0;

  for (let k = 0; k < fileTexts.length; k++) {
    const entry = fileTexts[k];
    const i = missIndices[k];
    const mtime = mtimeByIdx.get(i)!;

    if (!entry) {
      allPartials[i] = {
        mtime,
        behaviors: [],
        subtrees: [],
        controllers: [],
        rawBtJsonRefs: [],
        rawTypeInfos: [],
        typeFilePaths: {},
      };
      continue;
    }

    const { fsPath, text } = entry;

    // Fallback path: skip files that don't contain BT declarations
    if (!usedRipgrep && !BT_QUICK_CHECK.test(text)) {
      allPartials[i] = { mtime, behaviors: [], subtrees: [], controllers: [], rawBtJsonRefs: [], rawTypeInfos: [], typeFilePaths: {} };
      _fileCache.set(fsPath, allPartials[i]!);
      continue;
    }

    const partial: _FileScanPartial = {
      mtime,
      behaviors: [],
      subtrees: [],
      controllers: [],
      rawBtJsonRefs: [],
      rawTypeInfos: [],
      typeFilePaths: {},
    };

    let m: RegExpExecArray | null;

    const behaviorRe = /^\/datum\/bt_node\/ai_behavior\/[\w/]+(?=\s*(?:\/\/.*)?$)/gm;
    while ((m = behaviorRe.exec(text)) !== null) {
      partial.behaviors.push(m[0].trim());
    }

    const subtreeRe = /^\/datum\/bt_node\/subtree\/[\w/]+(?=\s*(?:\/\/.*)?$)/gm;
    while ((m = subtreeRe.exec(text)) !== null) {
      partial.subtrees.push({ typePath: m[0].trim(), filePath: fsPath });
    }

    const controllerRe = /^\/datum\/ai_controller\/[\w/]+(?=\s*(?:\/\/.*)?$)/gm;
    while ((m = controllerRe.exec(text)) !== null) {
      partial.controllers.push({ typePath: m[0].trim(), filePath: fsPath });
    }

    const fileRawRefs = new Map<string, { relPath: string; dmFsPath: string }>();
    await _parseBtJsonRefs(text, fileRawRefs, fsPath, yield_);
    for (const [typePath, { relPath, dmFsPath }] of fileRawRefs) {
      partial.rawBtJsonRefs.push({ typePath, relPath, dmFsPath });
    }

    const fileAllTypes = new Map<string, _RawTypeInfo>();
    await _parseTypeVarsFromText(text, fileAllTypes, fsPath, partial.typeFilePaths, yield_);
    for (const [typePath, info] of fileAllTypes) {
      partial.rawTypeInfos.push({ typePath, info });
    }

    // Ensure regex-found types appear in typeFilePaths even if the line parser missed them
    for (const b of partial.behaviors) {
      if (!(b in partial.typeFilePaths)) partial.typeFilePaths[b] = fsPath;
    }
    for (const s of partial.subtrees) {
      if (!(s.typePath in partial.typeFilePaths)) partial.typeFilePaths[s.typePath] = fsPath;
    }
    for (const c of partial.controllers) {
      if (!(c.typePath in partial.typeFilePaths)) partial.typeFilePaths[c.typePath] = fsPath;
    }

    _fileCache.set(fsPath, partial);
    allPartials[i] = partial;
    parsedCount++;
    totalBehaviors += partial.behaviors.length;
    totalSubtrees += partial.subtrees.length;
    totalControllers += partial.controllers.length;
  }
  log(
    `[scan] parse: ${parsedCount} files — behaviors:${totalBehaviors} subtrees:${totalSubtrees} controllers:${totalControllers} in ${Date.now() - t3}ms`,
  );

  // Merge all partials into shared accumulators
  const behaviorSet = new Set<string>();
  const seenSubtrees = new Set<string>();
  const seenControllers = new Set<string>();
  const subtrees: Array<{
    typePath: string;
    filePath: string;
    jsonPath?: string;
    inherited?: boolean;
    bindings?: BtBindingDeclarations;
  }> = [];
  const controllers: Array<{
    typePath: string;
    filePath: string;
    jsonPath?: string;
    inherited?: boolean;
    bindings?: BtBindingDeclarations;
  }> = [];
  const allTypes = new Map<string, _RawTypeInfo>();
  const typeFilePaths: Record<string, string> = {};
  const rawBtJsonRefs = new Map<string, { relPath: string; dmFsPath: string }>();

  for (const partial of allPartials) {
    if (!partial) continue;
    for (const b of partial.behaviors) behaviorSet.add(b);
    for (const s of partial.subtrees) {
      if (!seenSubtrees.has(s.typePath)) {
        seenSubtrees.add(s.typePath);
        subtrees.push({ typePath: s.typePath, filePath: s.filePath });
      }
    }
    for (const c of partial.controllers) {
      if (!seenControllers.has(c.typePath)) {
        seenControllers.add(c.typePath);
        controllers.push({ typePath: c.typePath, filePath: c.filePath });
      }
    }
    for (const ref of partial.rawBtJsonRefs) {
      if (!rawBtJsonRefs.has(ref.typePath)) {
        rawBtJsonRefs.set(ref.typePath, { relPath: ref.relPath, dmFsPath: ref.dmFsPath });
      }
    }
    for (const { typePath, info } of partial.rawTypeInfos) {
      if (!allTypes.has(typePath)) {
        allTypes.set(typePath, info);
      } else {
        // Merge split-file declarations: copy vars/params not yet seen
        const existing = allTypes.get(typePath)!;
        for (const [name, val] of info.ownVars) {
          if (!existing.ownVars.has(name)) existing.ownVars.set(name, val);
        }
        if (existing.performParams === null && info.performParams !== null) {
          existing.performParams = info.performParams;
        }
      }
    }
    // typeFilePaths: first-declaration wins
    for (const [tp, fp] of Object.entries(partial.typeFilePaths)) {
      if (!(tp in typeFilePaths)) typeFilePaths[tp] = fp;
    }
  }

  // Phase 4: Resolve .bt.json paths.
  // Pre-fetch all .bt.json paths once, then resolve via exact set lookup or suffix match.
  // _btJsonRefsCache persists across scans — only re-resolve entries whose source file changed.
  const t4 = Date.now();
  const missedFsPaths = new Set(missUris.map((u) => u.fsPath));

  // Remove cache entries for changed/removed types
  for (const [typePath] of _btJsonRefsCache) {
    if (!rawBtJsonRefs.has(typePath)) _btJsonRefsCache.delete(typePath);
  }
  const toResolve = [...rawBtJsonRefs.entries()].filter(
    ([typePath, { dmFsPath }]) => missedFsPaths.has(dmFsPath) || !_btJsonRefsCache.has(typePath),
  );

  if (toResolve.length > 0) {
    // ONE findFiles call for all .bt.json files in the workspace
    const allBtJsonUris = await vscode.workspace.findFiles("**/*.bt.json", "**/node_modules/**");
    const btJsonAbsPaths = new Set(allBtJsonUris.map((u) => u.fsPath));
    // Suffix-match fallback: basename → [absolute paths]
    const btJsonBySuffix = new Map<string, string[]>();
    for (const uri of allBtJsonUris) {
      const base = path.basename(uri.fsPath);
      const list = btJsonBySuffix.get(base);
      if (list) list.push(uri.fsPath);
      else btJsonBySuffix.set(base, [uri.fsPath]);
    }

    for (const [typePath, { relPath, dmFsPath }] of toResolve) {
      _btJsonRefsCache.delete(typePath);
      // Try DM-relative first (exact, no I/O)
      const absPath = path.resolve(path.dirname(dmFsPath), relPath);
      if (btJsonAbsPaths.has(absPath)) {
        _btJsonRefsCache.set(typePath, absPath);
        continue;
      }
      // Suffix match: find a known .bt.json whose path ends with the relative ref
      const normalizedRel = relPath.replace(/\\/g, "/");
      const candidates = btJsonBySuffix.get(path.basename(relPath)) ?? [];
      const match = candidates.find((p) => p.replace(/\\/g, "/").endsWith(normalizedRel));
      if (match) _btJsonRefsCache.set(typePath, match);
    }
  }

  const btJsonRefs = _btJsonRefsCache;
  log(
    `[scan] btJsonRef resolve: ${toResolve.length} new / ${btJsonRefs.size} total in ${Date.now() - t4}ms`,
  );

  // Attach jsonPath + bindings in parallel (direct hit or ancestor inheritance).
  const bindingCache = new Map<string, Promise<BtBindingDeclarations | undefined>>();
  const cachedBindings = (jp: string) => {
    if (!bindingCache.has(jp)) bindingCache.set(jp, _readBtJsonBindings(jp));
    return bindingCache.get(jp)!;
  };

  await Promise.all(
    [...subtrees, ...controllers].map(async (entry) => {
      const jp = btJsonRefs.get(entry.typePath);
      if (jp) {
        entry.jsonPath = jp;
        entry.bindings = await cachedBindings(jp);
        return;
      }
      // Walk up the DM path hierarchy to find an inherited tree
      let cur = entry.typePath;
      for (;;) {
        const segs = cur.split("/").filter(Boolean);
        if (segs.length <= 1) break;
        cur = "/" + segs.slice(0, -1).join("/");
        const inheritedJp = btJsonRefs.get(cur);
        if (inheritedJp) {
          entry.jsonPath = inheritedJp;
          entry.inherited = true;
          entry.bindings = await cachedBindings(inheritedJp);
          break;
        }
      }
    }),
  );

  // Phase 5: Type var resolution
  const t5 = Date.now();
  const typeVars: Record<string, TypeVarsEntry> = {};
  let typeVarCount = 0;
  for (const [typePath] of allTypes) {
    const isBehavior = /^\/datum\/bt_node\/ai_behavior\//.test(typePath);
    const isDecorator = /^\/datum\/bt_node\/decorator\//.test(typePath);
    if (!isBehavior && !isDecorator) continue;
    const stopAt = isBehavior ? "/datum/bt_node/ai_behavior" : "/datum/bt_node/decorator";
    typeVars[typePath] = _resolveTypeVars(typePath, allTypes, stopAt);
    typeVarCount++;
  }
  log(`[scan] typeVar chain: ${typeVarCount} entries in ${Date.now() - t5}ms`);
  log(`[scan] total: ${Date.now() - t0}ms`);

  // Update known-BT set so the next scan skips non-BT files without statting them
  _knownBtFilePaths.clear();
  for (let i = 0; i < allDmUris.length; i++) {
    const partial = allPartials[i];
    if (
      partial &&
      (partial.behaviors.length > 0 ||
        partial.subtrees.length > 0 ||
        partial.controllers.length > 0 ||
        partial.rawBtJsonRefs.length > 0)
    ) {
      _knownBtFilePaths.add(allDmUris[i].fsPath);
    }
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
// .bt.json binding declarations reader
// ──────────────────────────────────────────────────────────────────────────────

async function _readBtJsonBindings(jsonPath: string): Promise<BtBindingDeclarations | undefined> {
  try {
    const bytes = await vscode.workspace.fs.readFile(vscode.Uri.file(jsonPath));
    const obj = JSON.parse(Buffer.from(bytes).toString("utf8"));
    const raw = obj["bindings"];
    if (!raw || typeof raw !== "object" || Array.isArray(raw)) return undefined;
    const result: BtBindingDeclarations = {};
    for (const [name, entry] of Object.entries(raw)) {
      if (entry && typeof entry === "object" && !Array.isArray(entry)) {
        const e = entry as Record<string, unknown>;
        result[name] = {
          label: typeof e["label"] === "string" ? e["label"] : name,
          default: e["default"] !== undefined ? String(e["default"]) : "",
        };
      }
    }
    return Object.keys(result).length > 0 ? result : undefined;
  } catch {
    return undefined;
  }
}

// ──────────────────────────────────────────────────────────────────────────────
// behavior_tree_json reference scanner
// ──────────────────────────────────────────────────────────────────────────────

async function _parseBtJsonRefs(
  text: string,
  btJsonRefs: Map<string, { relPath: string; dmFsPath: string }>,
  dmFsPath: string,
  yield_: () => Promise<void>,
): Promise<void> {
  let currentType: string | null = null;
  let lineCount = 0;

  for (const rawLine of text.split(/\r?\n/)) {
    if (++lineCount % 500 === 0) await yield_();

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

async function _parseTypeVarsFromText(
  text: string,
  allTypes: Map<string, _RawTypeInfo>,
  filePath = "",
  typeFilePaths: Record<string, string> = {},
  yield_: () => Promise<void> = () => Promise.resolve(),
): Promise<void> {
  let currentType: string | null = null;
  let currentIsBehavior = false;
  let pendingVar: { name: string; accum: string; depth: number } | null = null;
  let lineCount = 0;

  const finalizePendingVar = () => {
    if (!pendingVar || !currentType) return;
    if (!STRUCTURAL_VARS.has(pendingVar.name)) {
      allTypes.get(currentType)!.ownVars.set(pendingVar.name, pendingVar.accum.trim());
    }
    pendingVar = null;
  };

  for (const rawLine of text.split(/\r?\n/)) {
    if (++lineCount % 200 === 0) await yield_();

    // If we're accumulating a multi-line list value, keep collecting until parens balance
    if (pendingVar) {
      for (const ch of rawLine) {
        if (ch === "(") pendingVar.depth++;
        else if (ch === ")") pendingVar.depth--;
      }
      pendingVar.accum += " " + rawLine.trim();
      if (pendingVar.depth <= 0) finalizePendingVar();
      continue;
    }

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
        currentType = null;
        currentIsBehavior = false;
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
      }
      const varM = rawLine.match(/^\tvar\/(?:[\w/]*\/)?(\w+)(?:\s*=\s*(.+?))?\s*(?:\/\/.*)?$/);
      if (varM) {
        const [, varName, defaultVal = ""] = varM;
        if (!STRUCTURAL_VARS.has(varName)) {
          // Count unmatched open parens — if > 0 the value spans multiple lines
          let depth = 0;
          for (const ch of defaultVal) {
            if (ch === "(") depth++;
            else if (ch === ")") depth--;
          }
          if (depth > 0) {
            pendingVar = { name: varName, accum: defaultVal, depth };
          } else {
            allTypes.get(currentType)!.ownVars.set(varName, defaultVal);
          }
        }
      }
      // Also catch plain subtype var-default overrides: `\tvarname = value` (no var/ prefix).
      // DM subtypes commonly set a parent var's default this way without re-declaring it.
      const plainVarM = !varM && rawLine.match(/^\t(\w+)\s*=\s*(.+?)\s*(?:\/\/.*)?$/);
      if (plainVarM) {
        const [, varName, defaultVal] = plainVarM;
        if (!STRUCTURAL_VARS.has(varName)) {
          let depth = 0;
          for (const ch of defaultVal) {
            if (ch === "(") depth++;
            else if (ch === ")") depth--;
          }
          if (depth > 0) {
            pendingVar = { name: varName, accum: defaultVal, depth };
          } else {
            allTypes.get(currentType)!.ownVars.set(varName, defaultVal);
          }
        }
      }
    }
  }
  // Flush any still-open accumulator at EOF
  finalizePendingVar();
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

function _resolveOwnVarsChain(
  typePath: string,
  allTypes: Map<string, _RawTypeInfo>,
  stopAt: string,
): Array<{ name: string; defaultValue: string }> {
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

function _resolveTypeVars(
  typePath: string,
  allTypes: Map<string, _RawTypeInfo>,
  stopAt: string,
): TypeVarsEntry {
  const isBehavior = stopAt === "/datum/bt_node/ai_behavior";

  if (isBehavior) {
    let params: Array<{ name: string; defaultValue: string }> = [];
    let cur = typePath;
    for (;;) {
      const info = allTypes.get(cur);
      if (info && info.performParams !== null) {
        params = info.performParams;
        break;
      }
      if (cur === stopAt) break;
      const segs = cur.split("/").filter(Boolean);
      if (segs.length <= 1) break;
      cur = "/" + segs.slice(0, -1).join("/");
    }
    const vars = _resolveOwnVarsChain(typePath, allTypes, stopAt);
    return { params, vars };
  }

  // Decorators: no perform params, only ownVars
  return { params: [], vars: _resolveOwnVarsChain(typePath, allTypes, stopAt) };
}

// ──────────────────────────────────────────────────────────────────────────────
// Deploy: generate DM behavior_nodes block from a .bt.json file
// ──────────────────────────────────────────────────────────────────────────────

