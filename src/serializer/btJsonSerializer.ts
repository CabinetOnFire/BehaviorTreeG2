import type { BtNode } from "../../shared/types";
import { COMPOSITE_SCHEMAS } from "../../shared/compositeSchema";

// ---------------------------------------------------------------------------
// Scalar conversion helpers — inverse of btJsonParser
// ---------------------------------------------------------------------------

/** Convert a BtNode scalar string back to an appropriate JSON value. */
function stringToJsonScalar(v: string): string | number | boolean {
  if (v === "TRUE") return true;
  if (v === "FALSE") return false;
  if (/^-?\d+(\.\d+)?$/.test(v)) return parseFloat(v);
  return v;
}

function configValueToJson(v: string | string[]): unknown {
  if (Array.isArray(v)) return v.map(stringToJsonScalar);
  return stringToJsonScalar(v);
}

// ---------------------------------------------------------------------------
// Recursive serializer
// ---------------------------------------------------------------------------

type JsonNode = Record<string, unknown>;

function serializeNode(node: BtNode): JsonNode {
  switch (node.kind) {
    case "selector":
    case "sequence":
      return {
        type: node.kind,
        children: node.children.map(serializeNode),
      };

    case "parallel":
    case "subplan": {
      const data = node as unknown as Record<string, unknown>;
      const out: JsonNode = { type: node.kind };
      for (const prop of COMPOSITE_SCHEMAS[node.kind] ?? []) {
        const val = data[prop.key];
        if (prop.type === "text") {
          if (val !== undefined) out[prop.jsonKey] = stringToJsonScalar(val as string);
        } else if (prop.type === "boolean") {
          out[prop.jsonKey] = val as boolean;
        } else {
          out[prop.jsonKey] = val as string;
        }
      }
      out["children"] = node.children.map(serializeNode);
      return out;
    }

    case "decorator": {
      const config: Record<string, unknown> = {};
      for (const [k, v] of Object.entries(node.config)) {
        config[k] = configValueToJson(v);
      }
      const result: JsonNode = {
        type: "decorator",
        decorator: node.nodeType,
        config,
      };
      if (node.child) result["child"] = serializeNode(node.child);
      return result;
    }

    case "leaf":
      return {
        type: "leaf",
        behavior: node.behaviorType,
        args: node.args.map(stringToJsonScalar),
      };

    case "subtree":
      return {
        type: "subtree",
        subtype: node.behaviorType,
      };
  }
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/** Serialize a BtNode AST to the JSON object used in .bt.json files. */
export function serializeToJsonObject(node: BtNode): JsonNode {
  return serializeNode(node);
}

/** Serialize a BtNode AST to a formatted .bt.json string (tab-indented). */
export function serializeToJsonString(node: BtNode): string {
  return JSON.stringify(serializeToJsonObject(node), null, "\t") + "\n";
}
