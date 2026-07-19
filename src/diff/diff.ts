import type { BtNode } from "../../shared/types";
import { COMPOSITE_SCHEMAS } from "../../shared/compositeSchema";
import { getChildren } from "./btNodeUtils";
import { subtreeHash, signature } from "./hash";
import { canonicalVars, canonicalBindings } from "./canonical";

export type DiffStatus = "unchanged" | "added" | "removed" | "changed";

export interface DiffNode {
  status: DiffStatus;
  /** New-side node; old-side node when status is "removed". */
  node: BtNode;
  /** Matched old-side node, when one exists (absent only for "added"/"removed"). */
  counterpart?: BtNode;
  /** Present only when status is "changed". */
  changedFields?: string[];
  children: DiffNode[];
}

// oldRoot/newRoot are null when the .bt.json didn't exist on that side (file added/deleted in the PR).
export function diffTree(oldRoot: BtNode | null, newRoot: BtNode | null): DiffNode {
  if (oldRoot === null && newRoot === null) {
    throw new Error("diffTree: at least one of oldRoot/newRoot must be present");
  }
  if (oldRoot === null) return makeTree(newRoot!, undefined, "added");
  if (newRoot === null) return makeTree(oldRoot, undefined, "removed");
  return diffPairedNode(oldRoot, newRoot);
}

function diffPairedNode(oldNode: BtNode, newNode: BtNode): DiffNode {
  const changedFields = compareOwnFields(oldNode, newNode);
  const children = diffChildren(getChildren(oldNode), getChildren(newNode));

  if (changedFields.length === 0) {
    return { status: "unchanged", node: newNode, counterpart: oldNode, children };
  }
  return { status: "changed", node: newNode, counterpart: oldNode, changedFields, children };
}

function makeTree(
  node: BtNode,
  counterpart: BtNode | undefined,
  status: "unchanged" | "removed" | "added",
): DiffNode {
  const counterpartKids = counterpart ? getChildren(counterpart) : [];
  return {
    status,
    node,
    counterpart,
    children: getChildren(node).map((c, i) => makeTree(c, counterpartKids[i], status)),
  };
}

// Pass 1 matches by content hash regardless of position, so a pure reorder shows as
// unchanged-but-moved instead of a false remove+add (a strict LCS mishandles simple swaps).
// Pass 2 pairs whatever's left by signature so real changes get a field diff, not remove+add.
function diffChildren(oldKids: BtNode[], newKids: BtNode[]): DiffNode[] {
  const oldHashes = oldKids.map(subtreeHash);
  const newHashes = newKids.map(subtreeHash);
  const oldSigs = oldKids.map(signature);
  const newSigs = newKids.map(signature);

  const usedOld = new Array(oldKids.length).fill(false);
  const usedNew = new Array(newKids.length).fill(false);

  const hashMatch = new Map<number, number>(); // newIdx -> oldIdx
  for (let ni = 0; ni < newKids.length; ni++) {
    const oi = oldHashes.findIndex((h, idx) => !usedOld[idx] && h === newHashes[ni]);
    if (oi !== -1) {
      usedOld[oi] = true;
      usedNew[ni] = true;
      hashMatch.set(ni, oi);
    }
  }

  const sigMatch = new Map<number, number>(); // newIdx -> oldIdx
  for (let ni = 0; ni < newKids.length; ni++) {
    if (usedNew[ni]) continue;
    const oi = oldSigs.findIndex((s, idx) => !usedOld[idx] && s === newSigs[ni]);
    if (oi !== -1) {
      usedOld[oi] = true;
      usedNew[ni] = true;
      sigMatch.set(ni, oi);
    }
  }

  const results: DiffNode[] = [];
  for (let oi = 0; oi < oldKids.length; oi++) {
    if (!usedOld[oi]) results.push(makeTree(oldKids[oi], undefined, "removed"));
  }
  for (let ni = 0; ni < newKids.length; ni++) {
    if (hashMatch.has(ni)) {
      results.push(makeTree(newKids[ni], oldKids[hashMatch.get(ni)!], "unchanged"));
    } else if (sigMatch.has(ni)) {
      results.push(diffPairedNode(oldKids[sigMatch.get(ni)!], newKids[ni]));
    } else {
      results.push(makeTree(newKids[ni], undefined, "added"));
    }
  }
  return results;
}

// Container kinds (selector/sequence) own no fields.
function compareOwnFields(oldNode: BtNode, newNode: BtNode): string[] {
  if (oldNode.kind !== newNode.kind) return ["kind"];

  switch (oldNode.kind) {
    case "selector":
    case "sequence":
      return [];

    case "parallel":
    case "subplan": {
      const schema = COMPOSITE_SCHEMAS[oldNode.kind] ?? [];
      const a = oldNode as unknown as Record<string, unknown>;
      const b = newNode as unknown as Record<string, unknown>;
      return schema.filter((prop) => a[prop.key] !== b[prop.key]).map((prop) => prop.key);
    }

    case "leaf": {
      const b = newNode as Extract<BtNode, { kind: "leaf" }>;
      const changed: string[] = [];
      if (oldNode.behaviorType !== b.behaviorType) changed.push("behaviorType");
      if (canonicalVars(oldNode.vars) !== canonicalVars(b.vars)) changed.push("vars");
      return changed;
    }

    case "subtree": {
      const b = newNode as Extract<BtNode, { kind: "subtree" }>;
      const changed: string[] = [];
      if (oldNode.behaviorType !== b.behaviorType) changed.push("behaviorType");
      if (oldNode.overrideId !== b.overrideId) changed.push("overrideId");
      if (canonicalBindings(oldNode.bindings) !== canonicalBindings(b.bindings)) {
        changed.push("bindings");
      }
      return changed;
    }

    case "decorator": {
      const b = newNode as Extract<BtNode, { kind: "decorator" }>;
      const changed: string[] = [];
      if (oldNode.nodeType !== b.nodeType) changed.push("nodeType");
      if (canonicalVars(oldNode.vars) !== canonicalVars(b.vars)) changed.push("vars");
      return changed;
    }
  }
}
