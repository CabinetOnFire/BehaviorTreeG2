import * as vscode from "vscode";
import * as path from "path";
import * as cp from "child_process";
import type { BtBindingDeclarations, BtNode, SubtreeDescriptor } from "../shared/types";
import { serializeToJsonString } from "./serializer/btJsonSerializer";
import type { RawTypeInfo, TypeVarsEntry as _TypeVarsEntry } from "./dmScan";
import { scanDmFileText, buildTypeVars } from "./dmScan";

export type { TypeVarsEntry } from "./dmScan";

// Save a mutated AST to its .bt.json file.

// Writes a mutated BtNode back to the descriptor's .bt.json file using
// WorkspaceEdit so VS Code undo history is preserved.
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
    // File not yet open, so create it fresh.
    edit.createFile(uri, { overwrite: true });
    edit.insert(uri, new vscode.Position(0, 0), jsonText);
  }

  await vscode.workspace.applyEdit(edit);
  const savedDoc = await vscode.workspace.openTextDocument(uri);
  await savedDoc.save();
}

// Write a minimal empty selector .bt.json file.

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

export interface ScanResult {
  behaviors: string[];
  subtrees: Array<{
    typePath: string;
    filePath: string;
    jsonPath?: string;
    inherited?: boolean;
    abstract?: boolean;
    bindings?: BtBindingDeclarations;
  }>;
  controllers: Array<{
    typePath: string;
    filePath: string;
    jsonPath?: string;
    inherited?: boolean;
    abstract?: boolean;
    bindings?: BtBindingDeclarations;
  }>;
  typeVars: Record<string, _TypeVarsEntry>;
  /** Maps every scanned typePath to the file where it was first declared. */
  typeFilePaths: Record<string, string>;
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
  rawTypeInfos: Map<string, RawTypeInfo>;
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
        rawTypeInfos: new Map(),
        typeFilePaths: {},
      };
      continue;
    }

    const { fsPath, text } = entry;

    // Fallback path: skip files that don't contain BT declarations
    if (!usedRipgrep && !BT_QUICK_CHECK.test(text)) {
      allPartials[i] = {
        mtime,
        behaviors: [],
        subtrees: [],
        controllers: [],
        rawBtJsonRefs: [],
        rawTypeInfos: new Map(),
        typeFilePaths: {},
      };
      _fileCache.set(fsPath, allPartials[i]!);
      continue;
    }

    const scanned = await scanDmFileText(text, fsPath, yield_);
    const partial: _FileScanPartial = { mtime, ...scanned };

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
    abstract?: boolean;
    bindings?: BtBindingDeclarations;
  }> = [];
  const controllers: Array<{
    typePath: string;
    filePath: string;
    jsonPath?: string;
    inherited?: boolean;
    abstract?: boolean;
    bindings?: BtBindingDeclarations;
  }> = [];
  const allTypes = new Map<string, RawTypeInfo>();
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
    for (const [typePath, info] of partial.rawTypeInfos) {
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
      // Try DM-relative first
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

  // Attach jsonPath + bindings in parallel
  const bindingCache = new Map<string, Promise<BtBindingDeclarations | undefined>>();
  const cachedBindings = (jp: string) => {
    if (!bindingCache.has(jp)) bindingCache.set(jp, _readBtJsonBindings(jp));
    return bindingCache.get(jp)!;
  };

  await Promise.all(
    [...subtrees, ...controllers].map(async (entry) => {
      // `behavior_tree_json = "Abstract"` flags an intentionally tree-less base type.
      if (rawBtJsonRefs.get(entry.typePath)?.relPath === "Abstract") {
        entry.abstract = true;
        return;
      }
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
  const typeVars = buildTypeVars(allTypes);
  log(`[scan] typeVar chain: ${Object.keys(typeVars).length} entries in ${Date.now() - t5}ms`);
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


