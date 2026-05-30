import * as vscode from "vscode";
import { scanAll } from "./fileSync";
import type { ScanResult } from "./fileSync";

type Ref = { typePath: string; filePath: string; jsonPath?: string };

const CACHE_KEY = "btEditor.scanCache";

class BtTreeItem extends vscode.TreeItem {
  constructor(
    label: string,
    collapsibleState: vscode.TreeItemCollapsibleState,
    public readonly itemKind: "category" | "entry" | "empty",
    public readonly category?: "subtrees" | "controllers",
  ) {
    super(label, collapsibleState);
  }
}

export class BtBrowserProvider implements vscode.TreeDataProvider<BtTreeItem> {
  private readonly _onDidChangeTreeData = new vscode.EventEmitter<void>();
  readonly onDidChangeTreeData = this._onDidChangeTreeData.event;

  private _subtrees: Ref[] = [];
  private _controllers: Ref[] = [];
  private _context: vscode.ExtensionContext;
  private _scanning = false;

  constructor(context: vscode.ExtensionContext) {
    this._context = context;
    const cached = context.workspaceState.get<ScanResult>(CACHE_KEY);
    if (cached) {
      this._subtrees = cached.subtrees;
      this._controllers = cached.controllers;
    }
  }

  update(subtrees: Ref[], controllers: Ref[]): void {
    this._subtrees = subtrees;
    this._controllers = controllers;
    this._onDidChangeTreeData.fire();
  }

  async doScan(notifyPanel?: (result: ScanResult) => void): Promise<void> {
    if (this._scanning) return;
    this._scanning = true;
    try {
      const result = await scanAll();
      await this._context.workspaceState.update(CACHE_KEY, result);
      this.update(result.subtrees, result.controllers);
      notifyPanel?.(result);
    } finally {
      this._scanning = false;
    }
  }

  getTreeItem(element: BtTreeItem): vscode.TreeItem {
    return element;
  }

  getChildren(element?: BtTreeItem): BtTreeItem[] {
    if (!element) {
      if (this._subtrees.length === 0 && this._controllers.length === 0) {
        return [];
      }
      return [
        this._makeCategoryItem("Subtrees", "subtrees"),
        this._makeCategoryItem("AI Controllers", "controllers"),
      ];
    }

    if (element.itemKind === "category") {
      const refs = element.category === "subtrees" ? this._subtrees : this._controllers;
      if (refs.length === 0) {
        const empty = new BtTreeItem("(none)", vscode.TreeItemCollapsibleState.None, "empty");
        empty.description = "";
        return [empty];
      }
      return refs.map((ref) => this._makeLeafItem(ref));
    }

    return [];
  }

  private _makeCategoryItem(label: string, category: "subtrees" | "controllers"): BtTreeItem {
    const item = new BtTreeItem(
      label,
      vscode.TreeItemCollapsibleState.Expanded,
      "category",
      category,
    );
    const count = category === "subtrees" ? this._subtrees.length : this._controllers.length;
    item.description = `${count}`;
    return item;
  }

  private _makeLeafItem(ref: Ref): BtTreeItem {
    const segments = ref.typePath.split("/").filter(Boolean);
    const label = segments.pop() ?? ref.typePath;
    const item = new BtTreeItem(label, vscode.TreeItemCollapsibleState.None, "entry");
    item.description = ref.typePath;
    item.tooltip = ref.typePath;
    item.contextValue = "btEntry";

    const fileToOpen = ref.jsonPath ?? ref.filePath;
    item.command = {
      command: "bt-editor.open-json",
      title: "Open",
      arguments: [vscode.Uri.file(fileToOpen)],
    };
    return item;
  }
}
