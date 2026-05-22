export type BtNode =
  | { kind: "selector"; children: BtNode[] }
  | { kind: "sequence"; children: BtNode[] }
  | {
      kind: "parallel";
      failurePolicy: string;
      successPolicy: string;
      children: BtNode[];
    }
  | { kind: "leaf"; behaviorType: string; args: string[] }
  | { kind: "subtree"; behaviorType: string }
  | {
      kind: "decorator";
      nodeType: string;
      child: BtNode;
      config: Record<string, string | string[]>;
    };

export interface SubtreeDescriptor {
  /** e.g. "/datum/bt_node/subtree/simple_hostile_combat" */
  typePath: string;
  /** char offset of "behavior_nodes" keyword in the (pre-processed) file text */
  startOffset: number;
  /** char offset after the closing ")" of the outermost BT_* macro */
  endOffset: number;
  root: BtNode;
}
