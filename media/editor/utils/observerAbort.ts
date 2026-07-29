import type { Edge, Node } from "@xyflow/react";
import {
  BT_ABORT_BOTH,
  BT_ABORT_LOWER_PRIORITY,
  BT_ABORT_NONE,
  BT_ABORT_SELF,
} from "../../../shared/btConstants";
import type { BtBindingDeclarations, BtNode } from "../../../shared/types";
import type { TypeVarsMap } from "../contexts/TypeVarsContext";

export type ObserverAbortHighlight = "none" | "self" | "lower" | "both";

export interface ObserverAbortTargets {
  mode: ObserverAbortHighlight;
  self: Set<string>;
  lowerPriority: Set<string>;
}

function btNodeFor(node: Node | undefined): BtNode | undefined {
  return node?.data._btNode as BtNode | undefined;
}

function observerAbortMode(
  decorator: Extract<BtNode, { kind: "decorator" }>,
  typeVars: TypeVarsMap | null,
  bindings: BtBindingDeclarations | undefined,
): ObserverAbortHighlight {
  const declaredDefault = typeVars?.[decorator.nodeType]?.vars.find(
    (variable) => variable.name === "observer_abort",
  )?.defaultValue;
  let value = decorator.vars.observer_abort ?? declaredDefault ?? BT_ABORT_NONE;
  if (Array.isArray(value)) value = value[0] ?? BT_ABORT_NONE;
  if (value.startsWith("$") && bindings) value = bindings[value.slice(1)]?.default ?? value;

  switch (value.trim()) {
    case BT_ABORT_SELF:
      return "self";
    case BT_ABORT_LOWER_PRIORITY:
      return "lower";
    case BT_ABORT_BOTH:
      return "both";
    default:
      return "none";
  }
}

function descendants(rootId: string, childrenByParent: Map<string, string[]>): Set<string> {
  const result = new Set<string>();
  const pending = [rootId];
  while (pending.length > 0) {
    const id = pending.pop()!;
    if (result.has(id)) continue;
    result.add(id);
    pending.push(...(childrenByParent.get(id) ?? []));
  }
  return result;
}

/**
 * Identify the branches that an observer decorator can abort. Lower-priority
 * branches are the later children of the closest enclosing selector.
 */
export function observerAbortTargets(
  nodes: Node[],
  edges: Edge[],
  decoratorId: string | undefined,
  typeVars: TypeVarsMap | null,
  bindings: BtBindingDeclarations | undefined,
): ObserverAbortTargets {
  const empty: ObserverAbortTargets = { mode: "none", self: new Set(), lowerPriority: new Set() };
  if (!decoratorId) return empty;

  const nodeById = new Map(nodes.map((node) => [node.id, node]));
  const decorator = btNodeFor(nodeById.get(decoratorId));
  if (decorator?.kind !== "decorator") return empty;

  const mode = observerAbortMode(decorator, typeVars, bindings);
  if (mode === "none") return empty;

  const parentByChild = new Map<string, string>();
  const childrenByParent = new Map<string, string[]>();
  for (const edge of edges) {
    parentByChild.set(edge.target, edge.source);
    const children = childrenByParent.get(edge.source) ?? [];
    children.push(edge.target);
    childrenByParent.set(edge.source, children);
  }

  const self = mode === "self" || mode === "both"
    ? descendants(decoratorId, childrenByParent)
    : new Set<string>();
  const lowerPriority = new Set<string>();

  if (mode === "lower" || mode === "both") {
    let branchId = decoratorId;
    let parentId = parentByChild.get(branchId);
    while (parentId) {
      const parent = btNodeFor(nodeById.get(parentId));
      if (parent?.kind === "selector") {
        const branchIndex = Number(nodeById.get(branchId)?.data.childIndex);
        for (const siblingId of childrenByParent.get(parentId) ?? []) {
          const siblingIndex = Number(nodeById.get(siblingId)?.data.childIndex);
          if (Number.isFinite(branchIndex) && siblingIndex > branchIndex) {
            for (const id of descendants(siblingId, childrenByParent)) lowerPriority.add(id);
          }
        }
        break;
      }
      branchId = parentId;
      parentId = parentByChild.get(branchId);
    }
  }

  return { mode, self, lowerPriority };
}
