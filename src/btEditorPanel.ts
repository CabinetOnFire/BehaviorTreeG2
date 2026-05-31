import * as vscode from "vscode";
import * as path from "path";
import type { ExtMsg, WebMsg } from "../shared/messaging";
import type { SubtreeDescriptor } from "../shared/types";
import { parseJsonFile } from "./parser/btJsonParser";
import {
  writeSubtreeToFile,
  createEmptyBtJson,
  scanAll,
} from "./fileSync";
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
  static createNew(context: vscode.ExtensionContext, uri: vscode.Uri) {
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
    new BtEditorPanel(panel, context, uri);
  }

  constructor(
    panel: vscode.WebviewPanel,
    context: vscode.ExtensionContext,
    uri: vscode.Uri | undefined,
    typePath?: string,
  ) {
    this._panel = panel;
    this._context = context;

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
            const { root } = parseJsonFile(e.document.getText());
            const updated: SubtreeDescriptor = { ...this._subtrees[changedIndex], root };
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
    try {
      ({ root, dmType: parsedDmType } = parseJsonFile(Buffer.from(bytes).toString("utf8")));
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
    let bytes: Uint8Array;
    try {
      bytes = await vscode.workspace.fs.readFile(dmUri);
    } catch (e) {
      vscode.window.showErrorMessage(`BT Editor: cannot read ${dmUri.fsPath}: ${e}`);
      return;
    }
    const dmText = Buffer.from(bytes).toString("utf8");
    const dmDir = path.dirname(dmUri.fsPath);

    // Actually let's do a line-by-line scan to be precise
    const refs: Array<{ typePath: string; jsonPath: string }> = [];
    let currentType = "";
    for (const line of dmText.split(/\r?\n/)) {
      if (line.match(/^\/datum\//)) {
        const m = line.match(/^(\/datum\/[\w/]+)\s*(?:\/\/.*)?$/);
        if (m) currentType = m[1];
        else currentType = "";
      } else if (currentType && line.match(/^\t+behavior_tree_json\s*=\s*"([^"]+)"/)) {
        const m = line.match(/behavior_tree_json\s*=\s*"([^"]+)"/);
        if (m) {
          refs.push({
            typePath: currentType,
            jsonPath: path.resolve(dmDir, m[1]),
          });
        }
      }
    }

    if (refs.length === 0) {
      if (targetTypePath) {
        await this._promptCreateBtJson(dmUri, targetTypePath);
      } else {
        vscode.window.showWarningMessage(
          `BT Editor: no "behavior_tree_json" references found in ${path.basename(dmUri.fsPath)}.`,
        );
      }
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
        const answer = await vscode.window.showInformationMessage(
          `'${path.basename(ref.jsonPath)}' does not exist. Create it?`,
          "Create",
          "Skip",
        );
        if (answer !== "Create") continue;
        await createEmptyBtJson(jsonUri);
      }

      try {
        const jBytes = await vscode.workspace.fs.readFile(jsonUri);
        const { root, dmType } = parseJsonFile(Buffer.from(jBytes).toString("utf8"));
        const descriptor: SubtreeDescriptor = {
          typePath: ref.typePath,
          jsonPath: ref.jsonPath,
          dmPath: dmUri.fsPath,
          root,
        };
        // Migrate: write dm_type if the file is missing it. Can probably remove this before I PR because I'm doing this before v1.0
        if (!dmType) writeSubtreeToFile(descriptor, root).catch(() => undefined);
        subtrees.push(descriptor);
      } catch {
        // Skip unreadable JSON files. add errors later >:3
      }
    }

    if (subtrees.length === 0) {
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
    const typeName = typePath.split("/").filter(Boolean).pop() ?? "tree";
    const suggestedFileName = `${typeName}.bt.json`;

    const answer = await vscode.window.showInformationMessage(
      `No behavior_tree_json found for ${typePath}. Create '${suggestedFileName}'?`,
      "Create",
      "Cancel",
    );
    if (answer !== "Create") return;

    const jsonUri = vscode.Uri.file(path.join(path.dirname(dmUri.fsPath), suggestedFileName));
    await createEmptyBtJson(jsonUri);

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
        `\tbehavior_tree_json = "${suggestedFileName}"\n`,
      );
      await vscode.workspace.applyEdit(edit);
      await doc.save();
    }

    await this._openJsonFile(jsonUri);
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
      result = await scanAll();
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
        await writeSubtreeToFile(descriptor, msg.root);
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

      case "load_behaviors": {
        const r = await scanAll();
        this._post({ type: "behaviors_loaded", behaviors: r.behaviors });
        break;
      }

      case "load_subtrees": {
        const r = await scanAll();
        this._post({ type: "subtrees_loaded", subtrees: r.subtrees, controllers: r.controllers });
        break;
      }

      case "open_subtree": {
        const cache = this._context.workspaceState.get<ScanResult>(BtEditorPanel._CACHE_SCAN);
        const jsonPath =
          msg.jsonPath ??
          cache?.subtrees.find((r) => r.typePath === msg.typePath)?.jsonPath ??
          cache?.controllers.find((r) => r.typePath === msg.typePath)?.jsonPath;

        if (msg.newPanel) {
          const uri = jsonPath ? vscode.Uri.file(jsonPath) : vscode.Uri.file(msg.filePath);
          BtEditorPanel.createNew(this._context, uri);
        } else if (jsonPath) {
          await this._openJsonFile(vscode.Uri.file(jsonPath));
        } else {
          // Fallback: non-migrated subtree — open DM in same panel
          await this._openFile(vscode.Uri.file(msg.filePath), msg.typePath);
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
        const lineIdx = lines.findIndex((l) => l.startsWith(msg.typePath));
        const pos = new vscode.Position(Math.max(0, lineIdx), 0);
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
