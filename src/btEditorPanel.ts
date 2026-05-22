import * as vscode from "vscode";
import * as path from "path";
import type { ExtMsg, WebMsg } from "../shared/messaging";
import type { SubtreeDescriptor } from "../shared/types";
import { parseFile } from "./parser/btParser";
import { writeSubtreeToFile, scanAll } from "./fileSync";
import type { ScanResult } from "./fileSync";

function debounce<T extends (...args: Parameters<T>) => void>(
  fn: T,
  ms: number,
): T {
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

  private readonly _panel: vscode.WebviewPanel;
  private readonly _context: vscode.ExtensionContext;
  private _disposables: vscode.Disposable[] = [];

  private _activeUri: vscode.Uri | undefined;
  private _pendingUri: vscode.Uri | undefined;
  private _subtrees: SubtreeDescriptor[] = [];
  private _activeIndex = 0;
  private _isDirtyMirror = false;

  private static readonly _CACHE_SCAN = "btEditor.scanCache";

  static createOrShow(
    context: vscode.ExtensionContext,
    uri: vscode.Uri | undefined,
  ) {
    const column = vscode.ViewColumn.Beside;
    if (BtEditorPanel.currentPanel) {
      BtEditorPanel.currentPanel._panel.reveal(column);
      if (uri) BtEditorPanel.currentPanel._openFile(uri);
      return;
    }
    const panel = vscode.window.createWebviewPanel(
      BtEditorPanel.viewType,
      "BT Editor",
      column,
      {
        enableScripts: true,
        retainContextWhenHidden: true,
        localResourceRoots: [
          vscode.Uri.joinPath(context.extensionUri, "dist"),
        ],
      },
    );
    BtEditorPanel.currentPanel = new BtEditorPanel(panel, context, uri);
  }

  private constructor(
    panel: vscode.WebviewPanel,
    context: vscode.ExtensionContext,
    uri: vscode.Uri | undefined,
  ) {
    this._panel = panel;
    this._context = context;

    this._panel.webview.html = this._buildHtml();
    this._panel.onDidDispose(() => this.dispose(), null, this._disposables);

    // Live sync: watch text document changes
    this._disposables.push(
      vscode.workspace.onDidChangeTextDocument(
        debounce((e: vscode.TextDocumentChangeEvent) => {
          if (!this._activeUri) return;
          if (e.document.uri.toString() !== this._activeUri.toString()) return;

          if (this._isDirtyMirror) {
            vscode.window.showInformationMessage(
              "BT Editor: file changed externally — your unsaved edits are preserved.",
            );
            return;
          }
          const subtrees = parseFile(e.document.getText());
          this._subtrees = subtrees;
          this._post({ type: "file_changed", subtrees });
        }, 300),
      ),
    );

    // Messages from webview
    this._panel.webview.onDidReceiveMessage(
      (msg: WebMsg) => this._handleWebMsg(msg),
      null,
      this._disposables,
    );

    // Don't call _openFile yet — wait for the webview to send "ready"
    // (prevents the race between postMessage and React's useEffect listener registration)
    this._pendingUri = uri;
  }

  private async _openFile(uri: vscode.Uri, targetTypePath?: string) {
    this._activeUri = uri;
    const doc = await vscode.workspace.openTextDocument(uri);
    const subtrees = parseFile(doc.getText());
    this._subtrees = subtrees;
    const activeIndex = targetTypePath
      ? Math.max(0, subtrees.findIndex((s) => s.typePath === targetTypePath))
      : 0;
    this._activeIndex = activeIndex;
    this._isDirtyMirror = false;
    this._panel.title = `BT — ${path.basename(uri.fsPath)}`;
    this._post({ type: "init", subtrees, activeIndex });
  }

  /**
   * If cache is warm, post cached results immediately and return.
   * If forceRefresh or no cache, run a single scanAll(), store, then post.
   */
  private async _autoScan(forceRefresh = false): Promise<void> {
    const log = BtEditorPanel.outputChannel;
    const ws = this._context.workspaceState;

    if (!forceRefresh) {
      const cached = ws.get<ScanResult>(BtEditorPanel._CACHE_SCAN);
      log.appendLine(`[autoScan] cache check — ${cached ? `subtrees:${cached.subtrees.length}/${cached.controllers.length} behaviors:${cached.behaviors.length} typeVars:${Object.keys(cached.typeVars).length}` : 'MISS'}`);
      if (cached) {
        log.appendLine(`[autoScan] using cache → posting results`);
        this._postScanResult(cached);
        return;
      }
    } else {
      log.appendLine(`[autoScan] forceRefresh=true, bypassing cache`);
    }

    log.appendLine(`[autoScan] starting full scan…`);
    const t0 = Date.now();
    const folders = vscode.workspace.workspaceFolders?.map((f) => f.uri.fsPath) ?? [];
    log.appendLine(`[autoScan] workspaceFolders: [${folders.join(", ")}]`);
    const probe = await vscode.workspace.findFiles("**/*.dm", "**/node_modules/**", 1);
    log.appendLine(`[autoScan] findFiles probe (limit 1): ${probe.length} result(s)${probe[0] ? ` — e.g. ${probe[0].fsPath}` : ""}`);
    let result: ScanResult;
    try {
      result = await scanAll();
    } catch (e) {
      log.appendLine(`[autoScan] scanAll threw: ${e}`);
      return;
    }
    log.appendLine(`[autoScan] scan done in ${Date.now() - t0}ms — subtrees:${result.subtrees.length} controllers:${result.controllers.length} behaviors:${result.behaviors.length} typeVars:${Object.keys(result.typeVars).length} files:${Object.keys(result.typeFilePaths).length > 0 ? "ok" : "0-types"}`);

    await ws.update(BtEditorPanel._CACHE_SCAN, result);
    log.appendLine(`[autoScan] cache written`);
    this._postScanResult(result);
  }

  private _postScanResult(r: ScanResult): void {
    this._post({ type: "subtrees_loaded", subtrees: r.subtrees, controllers: r.controllers });
    this._post({ type: "behaviors_loaded", behaviors: r.behaviors });
    this._post({ type: "type_vars_loaded", typeVars: r.typeVars });
  }

  private async _handleWebMsg(msg: WebMsg) {
    switch (msg.type) {
      case "ready":
        if (this._pendingUri) {
          await this._openFile(this._pendingUri);
          this._pendingUri = undefined;
        }
        // Auto-scan behaviors + workspace subtrees/controllers in background
        this._autoScan().catch((e) => BtEditorPanel.outputChannel.appendLine(`[autoScan] unhandled: ${e}`));
        break;

      case "select_subtree":
        this._activeIndex = msg.index;
        break;

      case "save_ast": {
        if (!this._activeUri) return;
        const descriptor = this._subtrees[msg.index];
        if (!descriptor) return;
        await writeSubtreeToFile(this._activeUri, descriptor, msg.root);
        this._isDirtyMirror = false;
        break;
      }

      case "reveal_in_file": {
        if (!this._activeUri) return;
        const descriptor = this._subtrees[msg.index];
        if (!descriptor) return;
        const doc = await vscode.workspace.openTextDocument(this._activeUri);
        const pos = doc.positionAt(descriptor.startOffset);
        const textEditor = await vscode.window.showTextDocument(doc, {
          viewColumn: vscode.ViewColumn.One,
          preserveFocus: true,
        });
        textEditor.revealRange(
          new vscode.Range(pos, pos),
          vscode.TextEditorRevealType.InCenter,
        );
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
        const uri = vscode.Uri.file(msg.filePath);
        await this._openFile(uri, msg.typePath);
        break;
      }

      case "refresh_types":
        // Force a full re-scan, bypassing cache
        this._autoScan(true).catch((e) => BtEditorPanel.outputChannel.appendLine(`[autoScan] unhandled: ${e}`));
        break;

      case "reveal_type": {
        const cached = this._context.workspaceState.get<ScanResult>(BtEditorPanel._CACHE_SCAN);
        const filePath = cached?.typeFilePaths?.[msg.typePath];
        if (!filePath) {
          vscode.window.showWarningMessage(
            `BT Editor: "${msg.typePath}" not found in scan cache — try Refresh Types.`,
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
        editor.revealRange(
          new vscode.Range(pos, pos),
          vscode.TextEditorRevealType.InCenter,
        );
        editor.selection = new vscode.Selection(pos, pos);
        break;
      }

      case "set_dirty":
        this._isDirtyMirror = msg.dirty;
        break;
    }
  }

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
    BtEditorPanel.currentPanel = undefined;
    this._panel.dispose();
    while (this._disposables.length) {
      this._disposables.pop()?.dispose();
    }
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
