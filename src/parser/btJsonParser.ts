import type { BtBindingDeclarations, BtNode } from "../../shared/types";
import { COMPOSITE_SCHEMAS } from "../../shared/compositeSchema";

// JSON node shapes (as written in .bt.json files)

type JsonVal = string | number | boolean | null | JsonVal[] | { [k: string]: JsonVal };
type JsonObj = { [k: string]: JsonVal };

// Scalar conversion helpers

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

// Recursive node parser

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
      const vars: Record<string, string | string[]> = {};
      const rawVars = (obj["vars"] ?? {}) as JsonObj;
      for (const [k, v] of Object.entries(rawVars)) {
        vars[k] = configValueToNode(v);
      }
      const child = obj["child"] ? parseNode(obj["child"] as JsonObj) : undefined;
      return {
        kind: "decorator",
        nodeType: String(obj["decorator"] ?? ""),
        child,
        vars,
      };
    }

    case "leaf": {
      const vars: Record<string, string | string[]> = {};
      const rawVars = obj["vars"];
      if (rawVars && typeof rawVars === "object" && !Array.isArray(rawVars)) {
        for (const [k, v] of Object.entries(rawVars as JsonObj)) {
          vars[k] = configValueToNode(v);
        }
      }
      return {
        kind: "leaf",
        behaviorType: String(obj["behavior"] ?? ""),
        vars,
      };
    }

    case "subtree": {
      const subtree: Extract<BtNode, { kind: "subtree" }> = {
        kind: "subtree",
        behaviorType: String(obj["subtype"] ?? ""),
      };
      if (obj["override_id"] != null) subtree.overrideId = String(obj["override_id"]);
      if (
        obj["bindings"] != null &&
        typeof obj["bindings"] === "object" &&
        !Array.isArray(obj["bindings"])
      ) {
        const raw = obj["bindings"] as Record<string, JsonVal>;
        const bindings: Record<string, string> = {};
        for (const [k, v] of Object.entries(raw)) bindings[k] = String(v);
        if (Object.keys(bindings).length > 0) subtree.bindings = bindings;
      }
      return subtree;
    }

    default:
      throw new Error(`Unknown BT JSON node type: "${type}"`);
  }
}

/** Parse a .bt.json file's text content into a BtNode AST plus optional metadata. */
export function parseJsonFile(jsonText: string): {
  root: BtNode;
  dmType?: string;
  bindings?: BtBindingDeclarations;
} {
  const obj = JSON.parse(jsonText) as JsonObj;
  const root = parseNode(obj);
  const dmType =
    typeof obj["dm_type"] === "string" && obj["dm_type"] ? (obj["dm_type"] as string) : undefined;
  const bindings = _parseBindingDeclarations(obj);
  return { root, dmType, ...(bindings ? { bindings } : {}) };
}

function _parseBindingDeclarations(obj: JsonObj): BtBindingDeclarations | undefined {
  const raw = obj["bindings"];
  if (raw == null || typeof raw !== "object" || Array.isArray(raw)) return undefined;
  const decls = raw as Record<string, JsonVal>;
  const result: BtBindingDeclarations = {};
  for (const [name, entry] of Object.entries(decls)) {
    if (typeof entry === "object" && entry !== null && !Array.isArray(entry)) {
      const e = entry as Record<string, JsonVal>;
      result[name] = {
        label: typeof e["label"] === "string" ? e["label"] : name,
        default: typeof e["default"] !== "undefined" ? String(e["default"]) : "",
      };
    }
  }
  return Object.keys(result).length > 0 ? result : undefined;
}
