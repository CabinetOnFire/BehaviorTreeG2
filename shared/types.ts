export type BtNode =
  | { kind: "selector"; children: BtNode[] }
  | { kind: "sequence"; children: BtNode[] }
  | {
      kind: "parallel";
      failurePolicy: string;
      successPolicy: string;
      repeatSecondary: boolean;
      finishOnPrimary: boolean;
      children: BtNode[];
    }
  | { kind: "leaf"; behaviorType: string; args: string[] }
  | { kind: "subtree"; behaviorType: string }
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
}
