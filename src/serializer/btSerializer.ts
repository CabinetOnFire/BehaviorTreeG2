import type { BtNode } from "../../shared/types";

/**
 * Serialize a BtNode AST back to indented DM BT_* macro syntax.
 * @param node  The root node to serialize
 * @param depth Indentation depth (tabs). Default 0.
 */
export function serialize(node: BtNode, depth = 0): string {
  const indent = "\t".repeat(depth);
  const innerIndent = "\t".repeat(depth + 1);

  switch (node.kind) {
    case "selector":
    case "sequence": {
      const macro = node.kind === "selector" ? "BT_SELECTOR" : "BT_SEQUENCE";
      if (node.children.length === 0) {
        return `${macro}()`;
      }
      const childLines = node.children
        .map((c) => `${innerIndent}${serialize(c, depth + 1)}`)
        .join(",\n");
      return `${macro}(\\\n${childLines}\\\n${indent})`;
    }

    case "parallel": {
      const childLines = node.children
        .map((c) => `${innerIndent}${serialize(c, depth + 1)}`)
        .join(",\n");
      if (node.children.length === 0) {
        return `BT_PARALLEL(${node.failurePolicy})`;
      }
      return `BT_PARALLEL(${node.failurePolicy},\\\n${childLines}\\\n${indent})`;
    }

    case "leaf": {
      if (node.args.length === 0) {
        return `BT_LEAF(${node.behaviorType})`;
      }
      const args = node.args.join(", ");
      return `BT_LEAF(${node.behaviorType}, ${args})`;
    }

    case "subtree":
      return `BT_SUBTREE(${node.behaviorType})`;

    case "decorator": {
      const configEntries = Object.entries(node.config);
      const childStr = `${innerIndent}${serialize(node.child, depth + 1)}`;
      if (configEntries.length === 0) {
        return `BT_DECORATOR(${node.nodeType},\\\n${childStr}\\\n${indent})`;
      }
      const configLines = configEntries
        .map(([k, v]) => {
          const val = Array.isArray(v)
            ? `list(${v.join(", ")})`
            : v;
          return `${innerIndent}"${k}" = ${val}`;
        })
        .join(",\\\n");
      return `BT_DECORATOR(${node.nodeType},\\\n${childStr},\\\n${configLines}\\\n${indent})`;
    }
  }
}
