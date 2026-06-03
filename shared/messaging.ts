import type { BtBindingDeclarations, BtNode, SubtreeDescriptor } from "./types";

/** Messages sent from the extension host to the webview */
export type ExtMsg =
  | { type: "init"; subtrees: SubtreeDescriptor[]; activeIndex: number }
  | { type: "file_changed"; subtrees: SubtreeDescriptor[]; activeIndex: number }
  | { type: "behaviors_loaded"; behaviors: string[] }
  | {
      type: "subtrees_loaded";
      subtrees: Array<{ typePath: string; filePath: string; jsonPath?: string; inherited?: boolean; bindings?: BtBindingDeclarations }>;
      controllers: Array<{ typePath: string; filePath: string; jsonPath?: string; inherited?: boolean; bindings?: BtBindingDeclarations }>;
    }
  | { type: "type_vars_loaded"; typeVars: Record<string, Array<{ name: string; defaultValue: string }>> }
  | { type: "clipboard_update"; nodes: BtNode[] };

/** Messages sent from the webview to the extension host */
export type WebMsg =
  | { type: "ready" }
  | { type: "select_subtree"; index: number }
  | { type: "save_ast"; index: number; root: BtNode; bindings?: BtBindingDeclarations }
  | { type: "reveal_in_file"; index: number }
  | { type: "load_behaviors" }
  | { type: "load_subtrees" }
  | { type: "open_subtree"; typePath: string; filePath: string; jsonPath?: string; newPanel?: boolean; inherited?: boolean }
  | { type: "reveal_type"; typePath: string }
  | { type: "refresh_types" }
  | { type: "set_dirty"; dirty: boolean }
  | { type: "copy_nodes"; nodes: BtNode[] };
