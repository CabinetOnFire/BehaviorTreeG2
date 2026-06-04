export type BtNode =
  | { kind: "selector"; children: BtNode[] }
  | { kind: "sequence"; children: BtNode[] }
  | {
      kind: "parallel";
      failurePolicy: string;
      successPolicy: string;
      repeatSecondary: boolean;
      repeatSecondaryDelay?: string;
      finishOnPrimary: boolean;
      children: BtNode[];
    }
  | {
      kind: "subplan";
      successPolicy: string;
      failurePolicy: string;
      loopDelay?: string;
      children: BtNode[];
    }
  | { kind: "leaf"; behaviorType: string; args: string[]; vars?: Record<string, string> }
  | { kind: "subtree"; behaviorType: string; overrideId?: string; bindings?: Record<string, string> }
  | {
      kind: "decorator";
      nodeType: string;
      child?: BtNode;
      config: Record<string, string | string[]>;
    };

export interface SubtreeDescriptor {
  /** e.g. "/datum/bt_node/subtree/simple_hostile_combat" */
  typePath: string;
  /** Absolute path to the .bt.json source file (new JSON-based system). */
  jsonPath?: string;
  /** Absolute path to the .dm file that contains the behavior_tree_json reference (for navigation). */
  dmPath?: string;
  root: BtNode;
  /** Root-level binding declarations from the .bt.json file. Keys are binding names. */
  bindings?: Record<string, { label: string; default: string }>;
}

/** Binding declarations as stored in the root of a .bt.json file. */
export type BtBindingDeclarations = Record<string, { label: string; default: string }>;
