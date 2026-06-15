import * as vscode from "vscode";
import { BtEditorPanel, BtEditorProvider } from "./btEditorPanel";
import { BtBrowserProvider, BtTreeItem } from "./btBrowserProvider";
import { setOutputChannel } from "./fileSync";

export function activate(context: vscode.ExtensionContext) {
  setOutputChannel(BtEditorPanel.outputChannel);

  const browserProvider = new BtBrowserProvider(context);

  // Wire scan results from the editor panel into the sidebar browser.
  BtEditorPanel.onScanComplete = (result) => {
    browserProvider.update(result.subtrees, result.controllers);
  };

  // "Open BT Editor" section — welcome-content only, no items.
  const openView = vscode.window.createTreeView("bt-editor.treeView", {
    treeDataProvider: {
      onDidChangeTreeData: new vscode.EventEmitter<void>().event,
      getTreeItem: (el: never) => el,
      getChildren: () => [],
    },
  });

  // "Subtrees & Controllers" browser with type-to-search filtering.
  const browserView = vscode.window.createTreeView("bt-editor.browserView", {
    treeDataProvider: browserProvider,
    showCollapseAll: true,
    canSelectMany: false,
  });

  context.subscriptions.push(
    vscode.window.registerCustomEditorProvider(
      BtEditorProvider.viewType,
      new BtEditorProvider(context),
      { webviewOptions: { retainContextWhenHidden: true } },
    ),

    vscode.commands.registerCommand("bt-editor.open", () => {
      const editor = vscode.window.activeTextEditor;
      const uri = editor?.document.uri;
      BtEditorPanel.createOrShow(context, uri);
    }),

    vscode.commands.registerCommand("bt-editor.open-json", (uri: vscode.Uri, typePath?: string) => {
      BtEditorPanel.createOrShow(context, uri, typePath);
    }),

    vscode.commands.registerCommand("bt-editor.refresh-browser", async () => {
      await browserProvider.doScan(BtEditorPanel.onScanComplete);
    }),

    vscode.commands.registerCommand("bt-editor.create-bt-json", async (item: BtTreeItem) => {
      if (!item?.ref) return;
      await BtEditorPanel.createBtJsonForType(context, item.ref.filePath, item.ref.typePath);
      await browserProvider.doScan(BtEditorPanel.onScanComplete);
    }),

    openView,
    openView.onDidChangeVisibility((e) => {
      if (e.visible) {
        vscode.commands.executeCommand("bt-editor.open");
      }
    }),
    browserView,
  );
}

export function deactivate() {}
