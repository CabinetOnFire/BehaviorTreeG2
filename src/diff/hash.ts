import * as crypto from "crypto";
import type { BtNode } from "../../shared/types";
import { COMPOSITE_SCHEMAS } from "../../shared/compositeSchema";
import { getChildren } from "./btNodeUtils";
import { canonicalVars, canonicalBindings } from "./canonical";

/** Content hash of a whole subtree (kind, fields, children, in order). Identical hash = byte-identical. */
export function subtreeHash(node: BtNode): string {
  const parts: string[] = [node.kind];

  switch (node.kind) {
    case "selector":
    case "sequence":
      break;
    case "parallel":
    case "subplan": {
      const schema = COMPOSITE_SCHEMAS[node.kind] ?? [];
      const src = node as unknown as Record<string, unknown>;
      for (const prop of schema) parts.push(`${prop.key}=${String(src[prop.key])}`);
      break;
    }
    case "leaf":
      parts.push(`behaviorType=${node.behaviorType}`);
      parts.push(`vars=${canonicalVars(node.vars)}`);
      break;
    case "subtree":
      parts.push(`behaviorType=${node.behaviorType}`);
      parts.push(`overrideId=${node.overrideId ?? ""}`);
      parts.push(`bindings=${canonicalBindings(node.bindings)}`);
      break;
    case "decorator":
      parts.push(`nodeType=${node.nodeType}`);
      parts.push(`vars=${canonicalVars(node.vars)}`);
      break;
  }

  for (const child of getChildren(node)) parts.push(subtreeHash(child));

  return crypto.createHash("sha1").update(parts.join("|")).digest("hex");
}

/** Coarse identity for pairing non-identical nodes: kind + discriminator, no vars/children. */
export function signature(node: BtNode): string {
  switch (node.kind) {
    case "selector":
    case "sequence":
    case "parallel":
    case "subplan":
      return node.kind;
    case "leaf":
    case "subtree":
      return `${node.kind}:${node.behaviorType}`;
    case "decorator":
      return `${node.kind}:${node.nodeType}`;
  }
}
