import type { BtNode } from "../../shared/types";

// ---------------------------------------------------------------------------
// Value emission helpers
// ---------------------------------------------------------------------------

/** Regex for all-caps identifiers (DM macro names) — emitted without quotes. */
const BARE_IDENT_RE = /^[A-Z][A-Z0-9_]*$/;

/**
 * Emit a single scalar value as DM source.
 * - All-caps identifiers (BB_*, BT_*, TRUE, FALSE, …) → bare
 * - Type-paths (/datum/…) → bare
 * - Numbers → bare
 * - Everything else → double-quoted string
 */
function emitValue(v: string): string {
  if (v === "") return "null";
  if (BARE_IDENT_RE.test(v)) return v;
  if (v.startsWith("/")) return v;
  if (/^-?\d+(\.\d+)?$/.test(v)) return v;
  return `"${v}"`;
}

function emitConfigValue(v: string | string[]): string {
  if (Array.isArray(v)) {
    if (v.length === 0) return "list()";
    return `list(${v.map(emitValue).join(", ")})`;
  }
  return emitValue(v);
}

// ---------------------------------------------------------------------------
// Recursive codegen
// ---------------------------------------------------------------------------

/**
 * Generate a DM list(...) expression for a BtNode.
 *
 * depth controls indentation:
 *   - outerIndent  = depth tabs   → placed before the closing ")"
 *   - innerIndent  = depth+1 tabs → placed before each key inside list(...)
 *   - childrenIndent = depth+2 tabs → placed before each child node inside "__c"
 *
 * Leaf and subtree nodes are always emitted as single-line strings.
 * Composite / decorator nodes use backslash-continued multi-line form.
 */
function codegenNode(node: BtNode, depth: number): string {
  const outerIndent = "\t".repeat(depth);
  const innerIndent = "\t".repeat(depth + 1);
  const childrenIndent = "\t".repeat(depth + 2);

  switch (node.kind) {
    case "selector":
    case "sequence": {
      const typePath =
        node.kind === "selector"
          ? "/datum/bt_node/composite/selector"
          : "/datum/bt_node/composite/sequence";

      if (node.children.length === 0) {
        return `list("__t" = ${typePath}, "__c" = list())`;
      }

      const childLines = node.children
        .map((c) => `${childrenIndent}${codegenNode(c, depth + 2)}`)
        .join(",\n");

      return (
        `list(\n` +
        `${innerIndent}"__t" = ${typePath},\n` +
        `${innerIndent}"__c" = list(\n` +
        `${childLines}\n` +
        `${innerIndent})\n` +
        `${outerIndent})`
      );
    }

    case "parallel": {
      const fp = node.failurePolicy;
      const sp = node.successPolicy;
      const rs = node.repeatSecondary ? "TRUE" : "FALSE";
      const rsd = node.repeatSecondaryDelay;
      const fop = node.finishOnPrimary ? "TRUE" : "FALSE";

      if (node.children.length === 0) {
        return (
          `list("__t" = /datum/bt_node/composite/parallel, ` +
          `"failure_policy" = ${fp}, "success_policy" = ${sp}, ` +
          `"repeat_secondary" = ${rs}` +
          `${rsd !== undefined ? `, "repeat_secondary_delay" = ${emitValue(rsd)}` : ""}` +
          `, "finish_on_primary" = ${fop}, "__c" = list())`
        );
      }

      const childLines = node.children
        .map((c) => `${childrenIndent}${codegenNode(c, depth + 2)}`)
        .join(",\n");

      return (
        `list(\n` +
        `${innerIndent}"__t" = /datum/bt_node/composite/parallel,\n` +
        `${innerIndent}"failure_policy" = ${fp},\n` +
        `${innerIndent}"success_policy" = ${sp},\n` +
        `${innerIndent}"repeat_secondary" = ${rs},\n` +
        (rsd !== undefined ? `${innerIndent}"repeat_secondary_delay" = ${emitValue(rsd)},\n` : "") +
        `${innerIndent}"finish_on_primary" = ${fop},\n` +
        `${innerIndent}"__c" = list(\n` +
        `${childLines}\n` +
        `${innerIndent})\n` +
        `${outerIndent})`
      );
    }

    case "subplan": {
      const sp = node.successPolicy;
      const fp = node.failurePolicy;
      const ld = node.loopDelay;

      if (node.children.length === 0) {
        return (
          `list("__t" = /datum/bt_node/composite/subplan, ` +
          `"success_policy" = ${sp}, "failure_policy" = ${fp}` +
          `${ld !== undefined ? `, "loop_delay" = ${emitValue(ld)}` : ""}, "__c" = list())`
        );
      }

      const childLines = node.children
        .map((c) => `${childrenIndent}${codegenNode(c, depth + 2)}`)
        .join(",\n");

      return (
        `list(\n` +
        `${innerIndent}"__t" = /datum/bt_node/composite/subplan,\n` +
        `${innerIndent}"success_policy" = ${sp},\n` +
        `${innerIndent}"failure_policy" = ${fp},\n` +
        (ld !== undefined ? `${innerIndent}"loop_delay" = ${emitValue(ld)},\n` : "") +
        `${innerIndent}"__c" = list(\n` +
        `${childLines}\n` +
        `${innerIndent})\n` +
        `${outerIndent})`
      );
    }

    case "decorator": {
      const configEntries = Object.entries(node.config);
      const childStr = node.child ? `${childrenIndent}${codegenNode(node.child, depth + 2)}` : "";

      let result =
        `list(\n` + `${innerIndent}"__t" = ${node.nodeType},\n` + `${innerIndent}"__c" = list(\n`;

      if (node.child) result += `${childStr}\n`;
      result += `${innerIndent})`;

      for (const [k, v] of configEntries) {
        result += `,\n${innerIndent}"${k}" = ${emitConfigValue(v)}`;
      }

      result += `\n${outerIndent})`;
      return result;
    }

    case "leaf": {
      if (node.args.length === 0) {
        return `list("__t" = ${node.behaviorType}, "default_behavior_args" = list())`;
      }
      return (
        `list("__t" = ${node.behaviorType}, ` +
        `"default_behavior_args" = list(${node.args.map(emitValue).join(", ")}))`
      );
    }

    case "subtree":
      return node.behaviorType;
  }
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Generate a full `behavior_nodes = list(...)` DM assignment from a BtNode.
 * Uses depth=1 so the list's content is indented at two tabs relative to the
 * file's left margin — correct for a var override inside a /datum/ type body.
 */
function addLineContinuations(s: string): string {
  const lines = s.split("\n");
  return lines.map((line, i) => (i < lines.length - 1 ? line + "\\" : line)).join("\n");
}

export function generateDmListForm(node: BtNode): string {
  return addLineContinuations(`behavior_nodes = ${codegenNode(node, 1)}`);
}

/**
 * Generate a complete standalone .dm file containing a single datum override
 * with the behavior_nodes assignment.
 *
 * Output format:
 *   /datum/bt_node/subtree/foo
 *   \tbehavior_nodes = list(...)
 */
export function generateStandaloneDmFile(typePath: string, node: BtNode): string {
  return `${typePath}\n\t${generateDmListForm(node)}\n`;
}
