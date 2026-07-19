import * as fs from "fs";
import { parseJsonFile } from "../parser/btJsonParser";
import type { BtNode } from "../../shared/types";
import type { TypeVarsMap } from "../../media/editor/contexts/TypeVarsContext";
import { getChildren } from "./btNodeUtils";
import { diffTree } from "./diff";
import { renderDiffSvg } from "./svg";

export const DEFAULT_MAX_NODES = 500;

export class TreeTooLargeError extends Error {
  constructor(
    public count: number,
    public max: number,
  ) {
    super(`tree has ${count} nodes, exceeding the limit of ${max}`);
  }
}

function countNodes(node: BtNode): number {
  return 1 + getChildren(node).reduce((sum, c) => sum + countNodes(c), 0);
}

function parseOrNull(text: string | null): BtNode | null {
  return text === null ? null : parseJsonFile(text).root;
}

/** Diff and render two .bt.json contents. Either side may be null (file added/deleted). gonna look real good and fancy*/
export function diffBtJsonTexts(
  oldText: string | null,
  newText: string | null,
  typeVars?: TypeVarsMap | null,
  maxNodes: number = DEFAULT_MAX_NODES,
): string {
  const oldRoot = parseOrNull(oldText);
  const newRoot = parseOrNull(newText);

  for (const root of [oldRoot, newRoot]) {
    if (!root) continue;
    const count = countNodes(root);
    if (count > maxNodes) throw new TreeTooLargeError(count, maxNodes);
  }

  return renderDiffSvg(diffTree(oldRoot, newRoot), typeVars);
}

export function diffBtJsonFiles(
  oldPath: string | null,
  newPath: string | null,
  typeVars?: TypeVarsMap | null,
): string {
  const oldText = oldPath ? fs.readFileSync(oldPath, "utf8") : null;
  const newText = newPath ? fs.readFileSync(newPath, "utf8") : null;
  return diffBtJsonTexts(oldText, newText, typeVars);
}
