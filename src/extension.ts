import * as vscode from "vscode";
import { BtEditorPanel, BtEditorProvider } from "./btEditorPanel";
import { deployAllJsonToDm } from "./fileSync";

export function activate(context: vscode.ExtensionContext) {
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

    vscode.commands.registerCommand("bt-editor.deploy-all", async () => {
      const result = await deployAllJsonToDm(BtEditorPanel.outputChannel);
      if (result.success) {
        vscode.window.showInformationMessage(`BT Editor: ${result.message}`);
      } else {
        vscode.window.showWarningMessage(`BT Editor: ${result.message}`);
      }
    }),
  );

  // Auto-open the editor when the activity bar icon is clicked.
  const treeView = vscode.window.createTreeView("bt-editor.treeView", {
    treeDataProvider: {
      onDidChangeTreeData: new vscode.EventEmitter<void>().event,
      getTreeItem: (el: never) => el,
      getChildren: () => [],
    },
  });
  context.subscriptions.push(
    treeView,
    treeView.onDidChangeVisibility((e) => {
      if (e.visible) {
        vscode.commands.executeCommand("bt-editor.open");
      }
    }),
  );
}

export function deactivate() {}
