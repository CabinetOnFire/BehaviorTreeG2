import * as vscode from "vscode";
import { BtEditorPanel } from "./btEditorPanel";

export function activate(context: vscode.ExtensionContext) {
  context.subscriptions.push(
    vscode.commands.registerCommand("bt-editor.open", () => {
      const editor = vscode.window.activeTextEditor;
      const uri = editor?.document.uri;
      BtEditorPanel.createOrShow(context, uri);
    }),
  );
}

export function deactivate() {}
