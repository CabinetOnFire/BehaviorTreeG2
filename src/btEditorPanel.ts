import * as vscode from "vscode";
import * as path from "path";
import type { ExtMsg, WebMsg } from "../shared/messaging";
import type { BtNode, SubtreeDescriptor } from "../shared/types";
import { parseJsonFile } from "./parser/btJsonParser";
import { writeSubtreeToFile, createEmptyBtJson, scanAll } from "./fileSync";
import type { ScanResult } from "./fileSync";

function debounce<T extends (...args: Parameters<T>) => void>(fn: T, ms: number): T {
  let timer: ReturnType<typeof setTimeout>;
  return ((...args: Parameters<T>) => {
    clearTimeout(timer);
    timer = setTimeout(() => fn(...args), ms);
  }) as T;
}

export class BtEditorPanel {
  static currentPanel: BtEditorPanel | undefined;
  private static readonly viewType = "btEditor";
  static readonly outputChannel = vscode.window.createOutputChannel("BT Editor");

  /** Called after every successful workspace scan so the sidebar browser can refresh. */
  static onScanComplete: ((result: ScanResult) => void) | undefined;

  private static _allPanels: Set<BtEditorPanel> = new Set();
  private static _sharedClipboard: BtNode[] = [];

  private readonly _panel: vscode.WebviewPanel;
  private readonly _context: vscode.ExtensionContext;
  private _disposables: vscode.Disposable[] = [];

  /** URI of the active .bt.json file (source of truth after migration). */
  private _activeUri: vscode.Uri | undefined;
  private _pendingUri: vscode.Uri | undefined;
  private _pendingTypePath: string | undefined;
  private _subtrees: SubtreeDescriptor[] = [];
  private _activeIndex = 0;
  private _isDirtyMirror = false;

  static readonly CACHE_SCAN = "btEditor.scanCache";
  private static readonly _CACHE_SCAN = BtEditorPanel.CACHE_SCAN;

  static createOrShow(
    context: vscode.ExtensionContext,
    uri: vscode.Uri | undefined,
    typePath?: string,
  ) {
    const column = vscode.ViewColumn.Active;
    if (BtEditorPanel.currentPanel) {
      BtEditorPanel.currentPanel._panel.reveal(column);
      if (uri) BtEditorPanel.currentPanel._openFile(uri, typePath);
      return;
    }
    const panel = vscode.window.createWebviewPanel(BtEditorPanel.viewType, "BT Editor", column, {
      enableScripts: true,
      retainContextWhenHidden: true,
      localResourceRoots: [vscode.Uri.joinPath(context.extensionUri, "dist")],
    });
    BtEditorPanel.currentPanel = new BtEditorPanel(panel, context, uri, typePath);
  }

  /** Open a new independent BT editor panel without replacing the existing one. */
  static createNew(context: vscode.ExtensionContext, uri: vscode.Uri, typePath?: string) {
    const panel = vscode.window.createWebviewPanel(
      BtEditorPanel.viewType,
      "BT Editor",
      vscode.ViewColumn.Active,
      {
        enableScripts: true,
        retainContextWhenHidden: true,
        localResourceRoots: [vscode.Uri.joinPath(context.extensionUri, "dist")],
      },
    );
    new BtEditorPanel(panel, context, uri, typePath);
  }

  /**
   * Open a controller in its own panel. If a panel already shows this controller,
   * focus that one instead of opening a duplicate.
   */
  static openController(context: vscode.ExtensionContext, uri: vscode.Uri, typePath: string) {
    const isJson = uri.fsPath.endsWith(".bt.json");
    for (const panel of BtEditorPanel._allPanels) {
      const alreadyOpen = panel._subtrees.some(
        (s) =>
          s.typePath === typePath ||
          (isJson && s.jsonPath && vscode.Uri.file(s.jsonPath).toString() === uri.toString()),
      );
      if (alreadyOpen) {
        panel._panel.reveal(vscode.ViewColumn.Active);
        return;
      }
    }
    BtEditorPanel.createNew(context, uri, typePath);
  }

  constructor(
    panel: vscode.WebviewPanel,
    context: vscode.ExtensionContext,
    uri: vscode.Uri | undefined,
    typePath?: string,
  ) {
    this._panel = panel;
    this._context = context;
    BtEditorPanel._allPanels.add(this);

    this._panel.webview.html = this._buildHtml();
    this._panel.onDidDispose(() => this.dispose(), null, this._disposables);

    // Live sync: watch text document changes on any tracked .bt.json file
    this._disposables.push(
      vscode.workspace.onDidChangeTextDocument(
        debounce((e: vscode.TextDocumentChangeEvent) => {
          const changedUriStr = e.document.uri.toString();
          const changedIndex = this._subtrees.findIndex(
            (s) => s.jsonPath && vscode.Uri.file(s.jsonPath).toString() === changedUriStr,
          );
          if (changedIndex < 0) return;

          if (this._isDirtyMirror) {
            if (changedIndex === this._activeIndex) {
              vscode.window.showInformationMessage(
                "BT Editor: file changed externally — your unsaved edits are preserved.",
              );
            }
            return;
          }

          try {
            const { root, bindings } = parseJsonFile(e.document.getText());
            const updated: SubtreeDescriptor = { ...this._subtrees[changedIndex], root, bindings };
            this._subtrees = this._subtrees.map((s, i) => (i === changedIndex ? updated : s));
            this._post({
              type: "file_changed",
              subtrees: this._subtrees,
              activeIndex: this._activeIndex,
            });
          } catch {
            // Ignore parse errors during live edits
          }
        }, 300),
      ),
    );

    // Messages from webview
    this._panel.webview.onDidReceiveMessage(
      (msg: WebMsg) => this._handleWebMsg(msg),
      null,
      this._disposables,
    );

    this._pendingUri = uri;
    this._pendingTypePath = typePath;
  }

  // ── File opening ──────────────────────────────────────────────────────────

  private async _openFile(uri: vscode.Uri, targetTypePath?: string) {
    if (uri.fsPath.endsWith(".bt.json")) {
      await this._openJsonFile(uri);
    } else {
      await this._openDmFile(uri, targetTypePath);
    }
  }

  /** Open a .bt.json file directly. */
  private async _openJsonFile(uri: vscode.Uri) {
    let bytes: Uint8Array;
    try {
      bytes = await vscode.workspace.fs.readFile(uri);
    } catch (e) {
      vscode.window.showErrorMessage(`BT Editor: cannot read ${uri.fsPath}: ${e}`);
      return;
    }

    let root;
    let parsedDmType: string | undefined;
    let parsedBindings: SubtreeDescriptor["bindings"];
    try {
      ({ root, dmType: parsedDmType, bindings: parsedBindings } = parseJsonFile(Buffer.from(bytes).toString("utf8")));
    } catch (e) {
      vscode.window.showErrorMessage(
        `BT Editor: JSON parse error in ${path.basename(uri.fsPath)}: ${e}`,
      );
      return;
    }

    // Try to resolve typePath and dmPath from workspace scan cache
    const cached = this._context.workspaceState.get<ScanResult>(BtEditorPanel._CACHE_SCAN);
    const allRefs = [...(cached?.subtrees ?? []), ...(cached?.controllers ?? [])];
    const ref = allRefs.find(
      (s) => s.jsonPath && vscode.Uri.file(s.jsonPath).toString() === uri.toString(),
    );
    const typePath = ref?.typePath ?? parsedDmType ?? path.basename(uri.fsPath, ".bt.json");
    const dmPath = ref?.filePath;

    const descriptor: SubtreeDescriptor = {
      typePath,
      jsonPath: uri.fsPath,
      dmPath,
      root,
      ...(parsedBindings ? { bindings: parsedBindings } : {}),
    };

    // Migrate: if the file lacks dm_type but we resolved a real type path, write it now.
    if (!parsedDmType && typePath.startsWith("/")) {
      writeSubtreeToFile(descriptor, root).catch(() => undefined);
    }

    this._activeUri = uri;
    this._subtrees = [descriptor];
    this._activeIndex = 0;
    this._isDirtyMirror = false;
    this._panel.title = `BT — ${path.basename(uri.fsPath)}`;
    this._post({ type: "init", subtrees: [descriptor], activeIndex: 0 });
  }

  /**
   * Open a .dm file: find its `behavior_tree_json = "..."` reference and load
   * the co-located .bt.json file as the editor's source of truth.
   * Falls back to the workspace scan cache to match multiple subtrees in one dm.
   */
  private async _openDmFile(dmUri: vscode.Uri, targetTypePath?: string) {
    const log = BtEditorPanel.outputChannel;
    log.appendLine(
      `[openDmFile] ${dmUri.fsPath}${targetTypePath ? ` (target: ${targetTypePath})` : ""}`,
    );

    let bytes: Uint8Array;
    try {
      bytes = await vscode.workspace.fs.readFile(dmUri);
    } catch (e) {
      log.appendLine(`[openDmFile] ERROR reading DM file: ${e}`);
      vscode.window.showErrorMessage(`BT Editor: cannot read ${dmUri.fsPath}: ${e}`);
      return;
    }
    const dmText = Buffer.from(bytes).toString("utf8");

    // Line-by-line scan for behavior_tree_json assignments
    const rawRefs: Array<{ typePath: string; relPath: string }> = [];
    let currentType = "";
    for (const line of dmText.split(/\r?\n/)) {
      if (line.match(/^\/datum\//)) {
        const m = line.match(/^(\/datum\/[\w/]+)\s*(?:\/\/.*)?$/);
        if (m) currentType = m[1];
        else currentType = "";
      } else if (currentType && line.match(/^\t+behavior_tree_json\s*=\s*"([^"]+)"/)) {
        const m = line.match(/behavior_tree_json\s*=\s*"([^"]+)"/);
        if (m) rawRefs.push({ typePath: currentType, relPath: m[1] });
      }
    }
    log.appendLine(`[openDmFile] found ${rawRefs.length} behavior_tree_json ref(s): ${rawRefs.map((r) => `${r.typePath} → "${r.relPath}"`).join(", ") || "(none)"}`);

    const refs: Array<{ typePath: string; jsonPath: string }> = [];
    for (const { typePath, relPath } of rawRefs) {
      // Resolve relative to the DM file's directory first (bare filenames live alongside the DM)
      const absPath = path.resolve(path.dirname(dmUri.fsPath), relPath);
      let jsonFsPath: string | undefined;
      try {
        await vscode.workspace.fs.stat(vscode.Uri.file(absPath));
        jsonFsPath = absPath;
        log.appendLine(`[openDmFile] ${typePath}: resolved DM-relative → ${absPath}`);
      } catch {
        log.appendLine(`[openDmFile] ${typePath}: DM-relative path not found, trying workspace search for "${relPath}"`);
        const found = await vscode.workspace.findFiles(relPath.replace(/\\/g, "/"), null, 1);
        if (found[0]) {
          jsonFsPath = found[0].fsPath;
          log.appendLine(`[openDmFile] ${typePath}: workspace search found → ${jsonFsPath}`);
        }
      }
      if (!jsonFsPath) {
        // File not found — compute best-guess path (workspace-root-relative) so the
        // "does not exist, create?" prompt downstream can handle it instead of silently skipping.
        const wsRoot = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath;
        jsonFsPath = wsRoot ? path.join(wsRoot, ...relPath.split("/")) : absPath;
        log.appendLine(`[openDmFile] ${typePath}: file not found anywhere, guessed path → ${jsonFsPath}`);
      }
      refs.push({ typePath, jsonPath: jsonFsPath });
    }

    if (refs.length === 0) {
      if (targetTypePath) {
        log.appendLine(`[openDmFile] no behavior_tree_json in file, prompting to create for ${targetTypePath}`);
        await this._promptCreateBtJson(dmUri, targetTypePath);
      } else {
        log.appendLine(`[openDmFile] no behavior_tree_json refs and no target type — nothing to open`);
        vscode.window.showWarningMessage(
          `BT Editor: no "behavior_tree_json" references found in ${path.basename(dmUri.fsPath)}.`,
        );
      }
      return;
    }

    // Specific type requested but has no behavior_tree_json (other types in the file do)
    if (targetTypePath && !refs.some((r) => r.typePath === targetTypePath)) {
      log.appendLine(`[openDmFile] ${targetTypePath} has no behavior_tree_json (${refs.length} other ref(s) in file), prompting to create`);
      await this._promptCreateBtJson(dmUri, targetTypePath);
      return;
    }

    // Load all referenced JSON files
    const subtrees: SubtreeDescriptor[] = [];
    for (const ref of refs) {
      const jsonUri = vscode.Uri.file(ref.jsonPath);

      let fileExists = true;
      try {
        await vscode.workspace.fs.stat(jsonUri);
      } catch {
        fileExists = false;
      }

      if (!fileExists) {
        log.appendLine(`[openDmFile] ${ref.typePath}: JSON file missing at ${ref.jsonPath}, prompting user`);
        const answer = await vscode.window.showInformationMessage(
          `No JSON initialized for ${ref.typePath}. Create '${path.basename(ref.jsonPath)}' now?`,
          "Create",
          "Skip",
        );
        if (answer !== "Create") {
          log.appendLine(`[openDmFile] ${ref.typePath}: user skipped creation`);
          continue;
        }
        await createEmptyBtJson(jsonUri);
        log.appendLine(`[openDmFile] ${ref.typePath}: created empty JSON at ${ref.jsonPath}`);
      }

      try {
        const jBytes = await vscode.workspace.fs.readFile(jsonUri);
        const { root, dmType, bindings } = parseJsonFile(Buffer.from(jBytes).toString("utf8"));
        const descriptor: SubtreeDescriptor = {
          typePath: ref.typePath,
          jsonPath: ref.jsonPath,
          dmPath: dmUri.fsPath,
          root,
          ...(bindings ? { bindings } : {}),
        };
        if (!dmType) writeSubtreeToFile(descriptor, root).catch(() => undefined);
        subtrees.push(descriptor);
        log.appendLine(`[openDmFile] ${ref.typePath}: loaded OK`);
      } catch (e) {
        log.appendLine(`[openDmFile] ${ref.typePath}: ERROR parsing JSON at ${ref.jsonPath}: ${e}`);
      }
    }

    if (subtrees.length === 0) {
      log.appendLine(`[openDmFile] no subtrees loaded — all refs failed or were skipped`);
      vscode.window.showWarningMessage(
        `BT Editor: could not load any .bt.json files referenced by ${path.basename(dmUri.fsPath)}.`,
      );
      return;
    }

    // Use the first JSON URI as the active URI for file watching
    const activeIndex = targetTypePath
      ? Math.max(
          0,
          subtrees.findIndex((s) => s.typePath === targetTypePath),
        )
      : 0;
    const activeJsonUri = vscode.Uri.file(subtrees[activeIndex].jsonPath!);

    this._activeUri = activeJsonUri;
    this._subtrees = subtrees;
    this._activeIndex = activeIndex;
    this._isDirtyMirror = false;
    this._panel.title = `BT — ${path.basename(dmUri.fsPath)}`;
    this._post({ type: "init", subtrees, activeIndex });
  }

  /** Offer to create a .bt.json and wire it into the DM file for an unmigrated type. */
  private async _promptCreateBtJson(dmUri: vscode.Uri, typePath: string): Promise<void> {
    await BtEditorPanel.createBtJsonForType(this._context, dmUri.fsPath, typePath);
    // Refresh the active panel with the newly created file (createBtJsonForType calls createOrShow,
    // which will reuse this panel since it's currentPanel).
  }

  /**
   * Create a new .bt.json for `typePath` in the same directory as `dmFilePath`,
   * insert the `behavior_tree_json` var into the DM file, update the workspace
   * cache, and open the new file in the BT Editor.  Called both from instance
   * context (via _promptCreateBtJson) and from the sidebar "Create New JSON"
   * context-menu command.
   */
  static async createBtJsonForType(
    context: vscode.ExtensionContext,
    dmFilePath: string,
    typePath: string,
  ): Promise<void> {
    const log = BtEditorPanel.outputChannel;
    const dmUri = vscode.Uri.file(dmFilePath);
    const typeName = typePath.split("/").filter(Boolean).pop() ?? "tree";
    const suggestedFileName = `${typeName}.bt.json`;

    log.appendLine(`[createBtJsonForType] ${typePath} → ${suggestedFileName} in ${path.dirname(dmFilePath)}`);

    const jsonUri = vscode.Uri.file(path.join(path.dirname(dmFilePath), suggestedFileName));
    await createEmptyBtJson(jsonUri);
    log.appendLine(`[createBtJsonForType] created ${jsonUri.fsPath}`);

    // Reference the JSON by its workspace-root-relative path (forward slashes),
    // falling back to the bare filename if it lives outside any workspace folder.
    const wsRoot = vscode.workspace.getWorkspaceFolder(jsonUri)?.uri.fsPath;
    const jsonRef = wsRoot
      ? path.relative(wsRoot, jsonUri.fsPath).replace(/\\/g, "/")
      : suggestedFileName;

    // Insert the behavior_tree_json line after the type declaration in the DM file
    const doc = await vscode.workspace.openTextDocument(dmUri);
    const lines = doc.getText().split(/\r?\n/);
    const typePathEscaped = typePath.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const typeLineRe = new RegExp(`^${typePathEscaped}\\s*(?:\\/\\/.*)?$`);
    const insertLine = lines.findIndex((l) => typeLineRe.test(l));
    if (insertLine >= 0) {
      const edit = new vscode.WorkspaceEdit();
      edit.insert(
        dmUri,
        new vscode.Position(insertLine + 1, 0),
        `\tbehavior_tree_json = "${jsonRef}"\n`,
      );
      await vscode.workspace.applyEdit(edit);
      await doc.save();
      log.appendLine(`[createBtJsonForType] inserted behavior_tree_json at DM line ${insertLine + 1}`);
    } else {
      log.appendLine(`[createBtJsonForType] WARNING: could not find type declaration for ${typePath} in ${dmFilePath}`);
    }

    // Update the cache so future opens find the jsonPath directly
    const cached = context.workspaceState.get<ScanResult>(BtEditorPanel.CACHE_SCAN);
    if (cached) {
      const entry =
        cached.subtrees.find((s) => s.typePath === typePath) ??
        cached.controllers.find((c) => c.typePath === typePath);
      if (entry) {
        entry.jsonPath = jsonUri.fsPath;
        entry.inherited = false;
        await context.workspaceState.update(BtEditorPanel.CACHE_SCAN, cached);
        log.appendLine(`[createBtJsonForType] cache updated: ${typePath} → ${jsonUri.fsPath}`);
      }
    }

    BtEditorPanel.createOrShow(context, jsonUri);
  }

  // ── Auto-scan ─────────────────────────────────────────────────────────────

  private async _autoScan(forceRefresh = false): Promise<void> {
    const log = BtEditorPanel.outputChannel;
    const ws = this._context.workspaceState;

    if (!forceRefresh) {
      const cached = ws.get<ScanResult>(BtEditorPanel._CACHE_SCAN);
      log.appendLine(
        `[autoScan] cache check — ${
          cached
            ? `subtrees:${cached.subtrees.length}/${cached.controllers.length} behaviors:${cached.behaviors.length}`
            : "MISS"
        }`,
      );
      if (cached) {
        this._postScanResult(cached);
        return;
      }
    } else {
      log.appendLine(`[autoScan] forceRefresh=true, bypassing cache`);
    }

    log.appendLine(`[autoScan] starting full scan…`);
    const t0 = Date.now();
    let result: ScanResult;
    try {
      result = await scanAll(forceRefresh);
    } catch (e) {
      log.appendLine(`[autoScan] scanAll threw: ${e}`);
      return;
    }
    log.appendLine(
      `[autoScan] done in ${Date.now() - t0}ms — ` +
        `subtrees:${result.subtrees.length} controllers:${result.controllers.length} ` +
        `behaviors:${result.behaviors.length}`,
    );

    await ws.update(BtEditorPanel._CACHE_SCAN, result);
    this._postScanResult(result);
  }

  private _postScanResult(r: ScanResult): void {
    this._post({ type: "subtrees_loaded", subtrees: r.subtrees, controllers: r.controllers });
    this._post({ type: "behaviors_loaded", behaviors: r.behaviors });
    this._post({ type: "type_vars_loaded", typeVars: r.typeVars });
    BtEditorPanel.onScanComplete?.(r);
  }

  // ── Message handling ──────────────────────────────────────────────────────

  private async _handleWebMsg(msg: WebMsg) {
    switch (msg.type) {
      case "ready":
        if (this._pendingUri) {
          await this._openFile(this._pendingUri, this._pendingTypePath);
          this._pendingUri = undefined;
          this._pendingTypePath = undefined;
        }
        this._autoScan().catch((e) =>
          BtEditorPanel.outputChannel.appendLine(`[autoScan] unhandled: ${e}`),
        );
        if (BtEditorPanel._sharedClipboard.length > 0) {
          this._post({ type: "clipboard_update", nodes: BtEditorPanel._sharedClipboard });
        }
        break;

      case "select_subtree":
        this._activeIndex = msg.index;
        // Switch the watched file to the newly selected subtree's JSON
        if (this._subtrees[msg.index]?.jsonPath) {
          this._activeUri = vscode.Uri.file(this._subtrees[msg.index].jsonPath!);
        }
        break;

      case "save_ast": {
        const descriptor = this._subtrees[msg.index];
        if (!descriptor) return;
        if (msg.bindings !== undefined) {
          this._subtrees[msg.index] = { ...descriptor, bindings: msg.bindings };
        }
        await writeSubtreeToFile(this._subtrees[msg.index], msg.root, msg.bindings);
        this._isDirtyMirror = false;
        break;
      }

      case "reveal_in_file": {
        const descriptor = this._subtrees[msg.index];
        if (!descriptor) return;

        if (descriptor.dmPath) {
          // Navigate to the behavior_tree_json line in the DM file
          const dmUri = vscode.Uri.file(descriptor.dmPath);
          const doc = await vscode.workspace.openTextDocument(dmUri);
          const lines = doc.getText().split(/\r?\n/);
          const lineIdx = lines.findIndex((l) =>
            l.includes("behavior_tree_json") && descriptor.jsonPath
              ? l.includes(path.basename(descriptor.jsonPath))
              : true,
          );
          const pos = new vscode.Position(Math.max(0, lineIdx), 0);
          const editor = await vscode.window.showTextDocument(doc, {
            viewColumn: vscode.ViewColumn.One,
            preserveFocus: true,
          });
          editor.revealRange(new vscode.Range(pos, pos), vscode.TextEditorRevealType.InCenter);
        } else if (descriptor.jsonPath) {
          // No DM reference — just open the JSON file itself
          await vscode.window.showTextDocument(vscode.Uri.file(descriptor.jsonPath), {
            viewColumn: vscode.ViewColumn.One,
            preserveFocus: true,
          });
        }
        break;
      }

      case "load_behaviors":
      case "load_subtrees":
        // Route through _autoScan so these share the cache and coalesce with any
        // in-flight scan rather than launching independent ones.
        this._autoScan().catch((e) =>
          BtEditorPanel.outputChannel.appendLine(`[autoScan] unhandled: ${e}`),
        );
        break;

      case "open_subtree": {
        const log = BtEditorPanel.outputChannel;
        log.appendLine(
          `[open_subtree] typePath=${msg.typePath} filePath=${msg.filePath} ` +
          `jsonPath=${msg.jsonPath ?? "(none)"} newPanel=${msg.newPanel ?? false}`,
        );
        const cache = this._context.workspaceState.get<ScanResult>(BtEditorPanel._CACHE_SCAN);

        // Direct lookup from cache: find the entry for this exact type and use its jsonPath.
        // This avoids re-scanning the DM file and accidentally opening a different type's json.
        const cacheEntry =
          cache?.subtrees.find((r) => r.typePath === msg.typePath) ??
          cache?.controllers.find((r) => r.typePath === msg.typePath);
        let jsonPath = msg.jsonPath ?? cacheEntry?.jsonPath;
        log.appendLine(
          `[open_subtree] cache entry: ${cacheEntry ? `filePath=${cacheEntry.filePath} jsonPath=${cacheEntry.jsonPath ?? "(none)"}` : "NOT FOUND"}`,
        );

        // Verify the file still exists before trusting the path
        if (jsonPath) {
          try {
            await vscode.workspace.fs.stat(vscode.Uri.file(jsonPath));
            log.appendLine(`[open_subtree] jsonPath verified on disk: ${jsonPath}`);
          } catch {
            log.appendLine(`[open_subtree] jsonPath no longer on disk (${jsonPath}), will prompt to create`);
            jsonPath = undefined;
          }
        }

        if (!jsonPath) {
          // No JSON for this type — prompt to create regardless of newPanel flag.
          const dmFilePath = cacheEntry?.filePath ?? msg.filePath;
          log.appendLine(`[open_subtree] no JSON for ${msg.typePath}, prompting to create in ${dmFilePath}`);
          await this._promptCreateBtJson(vscode.Uri.file(dmFilePath), msg.typePath);
        } else if (msg.inherited) {
          // Type inherits JSON from a parent — offer to create its own or just open the parent.
          const dmFilePath = cacheEntry?.filePath ?? msg.filePath;
          log.appendLine(`[open_subtree] ${msg.typePath} is inherited, prompting`);
          const answer = await vscode.window.showInformationMessage(
            `"${msg.typePath}" has no behavior tree of its own — it inherits from a parent type.`,
            "Create New Tree",
            "Open Parent Tree",
          );
          if (answer === "Create New Tree") {
            await this._promptCreateBtJson(vscode.Uri.file(dmFilePath), msg.typePath);
          } else if (answer === "Open Parent Tree") {
            if (msg.newPanel) {
              BtEditorPanel.createNew(this._context, vscode.Uri.file(jsonPath));
            } else {
              await this._openJsonFile(vscode.Uri.file(jsonPath));
            }
          }
        } else if (msg.newPanel) {
          log.appendLine(`[open_subtree] opening new panel → ${jsonPath}`);
          BtEditorPanel.createNew(this._context, vscode.Uri.file(jsonPath));
        } else {
          log.appendLine(`[open_subtree] opening JSON: ${jsonPath}`);
          await this._openJsonFile(vscode.Uri.file(jsonPath));
        }
        break;
      }

      case "refresh_types":
        this._autoScan(true).catch((e) =>
          BtEditorPanel.outputChannel.appendLine(`[autoScan] unhandled: ${e}`),
        );
        break;

      case "reveal_type": {
        let cached = this._context.workspaceState.get<ScanResult>(BtEditorPanel._CACHE_SCAN);
        let filePath = cached?.typeFilePaths?.[msg.typePath];

        if (!filePath) {
          try {
            const fresh = await scanAll();
            await this._context.workspaceState.update(BtEditorPanel._CACHE_SCAN, fresh);
            this._postScanResult(fresh);
            cached = fresh;
            filePath = fresh.typeFilePaths?.[msg.typePath];
          } catch {
            // ignore scan errors
          }
        }

        if (!filePath) {
          vscode.window.showWarningMessage(
            `BT Editor: "${msg.typePath}" not found in workspace — is the type defined in a .dm file?`,
          );
          return;
        }
        const uri = vscode.Uri.file(filePath);
        const doc = await vscode.workspace.openTextDocument(uri);
        const lines = doc.getText().split(/\r?\n/);
        const lineIdx = Math.max(0, lines.findIndex((l) => l.startsWith(msg.typePath)));
        const pos = new vscode.Position(lineIdx, 0);

        // Try the DM language server first (dm-langserver via dreammaker-lsp extension)
        try {
          const lspResults = await vscode.commands.executeCommand<
            (vscode.Location | vscode.LocationLink)[]
          >("vscode.executeDefinitionProvider", uri, pos);
          if (lspResults && lspResults.length > 0) {
            const first = lspResults[0];
            const targetUri = "targetUri" in first ? first.targetUri : first.uri;
            const targetRange = "targetRange" in first ? first.targetRange : first.range;
            const targetDoc = await vscode.workspace.openTextDocument(targetUri);
            const lspEditor = await vscode.window.showTextDocument(targetDoc, {
              viewColumn: vscode.ViewColumn.One,
              preserveFocus: false,
            });
            lspEditor.revealRange(targetRange, vscode.TextEditorRevealType.InCenter);
            lspEditor.selection = new vscode.Selection(targetRange.start, targetRange.start);
            break;
          }
        } catch {
          // dm-langserver not active, fall through to scan-based navigation
        }

        const editor = await vscode.window.showTextDocument(doc, {
          viewColumn: vscode.ViewColumn.One,
          preserveFocus: false,
        });
        editor.revealRange(new vscode.Range(pos, pos), vscode.TextEditorRevealType.InCenter);
        editor.selection = new vscode.Selection(pos, pos);
        break;
      }

      case "set_dirty":
        this._isDirtyMirror = msg.dirty;
        break;

      case "copy_nodes":
        BtEditorPanel._sharedClipboard = msg.nodes;
        for (const panel of BtEditorPanel._allPanels) {
          if (panel !== this) {
            panel._post({ type: "clipboard_update", nodes: msg.nodes });
          }
        }
        break;
    }
  }

  // ── HTML & lifecycle ──────────────────────────────────────────────────────

  private _post(msg: ExtMsg) {
    this._panel.webview.postMessage(msg);
  }

  private _buildHtml(): string {
    const webview = this._panel.webview;
    const scriptUri = webview.asWebviewUri(
      vscode.Uri.joinPath(this._context.extensionUri, "dist", "editor.js"),
    );
    const cssUri = webview.asWebviewUri(
      vscode.Uri.joinPath(this._context.extensionUri, "dist", "editor.css"),
    );
    const nonce = getNonce();
    return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta http-equiv="Content-Security-Policy"
    content="default-src 'none'; script-src 'nonce-${nonce}'; style-src 'unsafe-inline' ${webview.cspSource}; img-src ${webview.cspSource} data:; font-src ${webview.cspSource} data:;" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>BT Editor</title>
  <link rel="stylesheet" href="${cssUri}" />
  <style>
    html, body, #root { margin: 0; padding: 0; width: 100%; height: 100%; overflow: hidden; }
  </style>
</head>
<body>
  <div id="root"></div>
  <script nonce="${nonce}" src="${scriptUri}"></script>
</body>
</html>`;
  }

  dispose() {
    if (this === BtEditorPanel.currentPanel) {
      BtEditorPanel.currentPanel = undefined;
    }
    BtEditorPanel._allPanels.delete(this);
    this._panel.dispose();
    while (this._disposables.length) {
      this._disposables.pop()?.dispose();
    }
  }
}

export class BtEditorProvider implements vscode.CustomTextEditorProvider {
  static readonly viewType = "btEditor.visualEditor";

  constructor(private readonly context: vscode.ExtensionContext) {}

  async resolveCustomTextEditor(
    document: vscode.TextDocument,
    webviewPanel: vscode.WebviewPanel,
    _token: vscode.CancellationToken,
  ): Promise<void> {
    webviewPanel.webview.options = {
      enableScripts: true,
      localResourceRoots: [vscode.Uri.joinPath(this.context.extensionUri, "dist")],
    };
    new BtEditorPanel(webviewPanel, this.context, document.uri);
  }
}

function getNonce(): string {
  let text = "";
  const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
  for (let i = 0; i < 32; i++) {
    text += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return text;
}
