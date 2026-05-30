import type { BtNode } from "../../shared/types";
import { COMPOSITE_SCHEMAS } from "../../shared/compositeSchema";

// ---------------------------------------------------------------------------
// JSON node shapes (as written in .bt.json files)
// ---------------------------------------------------------------------------

type JsonVal = string | number | boolean | null | JsonVal[] | { [k: string]: JsonVal };
type JsonObj = { [k: string]: JsonVal };

// ---------------------------------------------------------------------------
// Scalar conversion helpers
// ---------------------------------------------------------------------------

/** Convert a JSON scalar (string/number/bool) to the string form stored in BtNode. */
function scalarToString(v: JsonVal): string {
  if (v === true) return "TRUE";
  if (v === false) return "FALSE";
  if (typeof v === "number") return String(v);
  if (typeof v === "string") return v;
  throw new Error(`Unexpected scalar value: ${JSON.stringify(v)}`);
}

/** Convert a JSON config value to BtNode's string | string[] form. */
function configValueToNode(v: JsonVal): string | string[] {
  if (Array.isArray(v)) return v.map(scalarToString);
  return scalarToString(v);
}

// ---------------------------------------------------------------------------
// Recursive node parser
// ---------------------------------------------------------------------------

function parseNode(obj: JsonObj): BtNode {
  const type = obj["type"] as string;

  switch (type) {
    case "selector":
    case "sequence": {
      const children = ((obj["children"] as JsonVal[]) ?? []).map((c) => parseNode(c as JsonObj));
      return { kind: type as "selector" | "sequence", children };
    }

    case "parallel":
    case "subplan": {
      const children = ((obj["children"] as JsonVal[]) ?? []).map((c) => parseNode(c as JsonObj));
      const props: Record<string, unknown> = {};
      for (const prop of COMPOSITE_SCHEMAS[type] ?? []) {
        const raw = obj[prop.jsonKey];
        if (prop.type === "boolean") {
          props[prop.key] = Boolean(raw ?? prop.default);
        } else if (prop.type === "enum") {
          props[prop.key] = String(raw ?? prop.default);
        } else {
          // optional text — omit if absent
          if (raw != null) props[prop.key] = scalarToString(raw);
        }
      }
      return { kind: type, ...props, children } as BtNode;
    }

    case "decorator": {
      const config: Record<string, string | string[]> = {};
      const rawConfig = (obj["config"] ?? {}) as JsonObj;
      for (const [k, v] of Object.entries(rawConfig)) {
        config[k] = configValueToNode(v);
      }
      const child = obj["child"] ? parseNode(obj["child"] as JsonObj) : undefined;
      return {
        kind: "decorator",
        nodeType: String(obj["decorator"] ?? ""),
        child,
        config,
      };
    }

    case "leaf": {
      const rawArgs = (obj["args"] as JsonVal[]) ?? [];
      const args = rawArgs.map(scalarToString);
      return {
        kind: "leaf",
        behaviorType: String(obj["behavior"] ?? ""),
        args,
      };
    }

    case "subtree":
      return {
        kind: "subtree",
        behaviorType: String(obj["subtype"] ?? ""),
      };

    default:
      throw new Error(`Unknown BT JSON node type: "${type}"`);
  }
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/** Parse a .bt.json file's text content into a BtNode AST. */
export function parseJsonFile(jsonText: string): BtNode {
  const obj = JSON.parse(jsonText) as JsonObj;
  return parseNode(obj);
}
