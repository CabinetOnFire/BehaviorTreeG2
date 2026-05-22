import type { BtNode, SubtreeDescriptor } from "./types";

/** Messages sent from the extension host to the webview */
export type ExtMsg =
  | { type: "init"; subtrees: SubtreeDescriptor[]; activeIndex: number }
  | { type: "file_changed"; subtrees: SubtreeDescriptor[] }
  | { type: "behaviors_loaded"; behaviors: string[] }
  | { type: "subtrees_loaded"; subtrees: Array<{ typePath: string; filePath: string }>; controllers: Array<{ typePath: string; filePath: string }> }
  | { type: "type_vars_loaded"; typeVars: Record<string, Array<{ name: string; defaultValue: string }>> };

/** Messages sent from the webview to the extension host */
export type WebMsg =
  | { type: "ready" }
  | { type: "select_subtree"; index: number }
  | { type: "save_ast"; index: number; root: BtNode }
  | { type: "reveal_in_file"; index: number }
  | { type: "load_behaviors" }
  | { type: "load_subtrees" }
  | { type: "open_subtree"; typePath: string; filePath: string }
  | { type: "reveal_type"; typePath: string }
  | { type: "refresh_types" }
  | { type: "set_dirty"; dirty: boolean };
