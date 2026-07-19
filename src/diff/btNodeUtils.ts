import type { BtNode } from "../../shared/types";

/** Uniform child accessor: composites return their list, decorator returns 0-or-1, leaf/subtree none. */
export function getChildren(node: BtNode): BtNode[] {
  switch (node.kind) {
    case "selector":
    case "sequence":
    case "parallel":
    case "subplan":
      return node.children;
    case "decorator":
      return node.child ? [node.child] : [];
    case "leaf":
    case "subtree":
      return [];
  }
}
