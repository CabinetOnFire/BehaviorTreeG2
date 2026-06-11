import type { BtBindingDeclarations, BtNode } from "../../shared/types";
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
      const result: JsonNode = { type: "decorator", decorator: node.nodeType };
      if (Object.keys(node.vars).length > 0) {
        const varsOut: Record<string, unknown> = {};
        for (const [k, v] of Object.entries(node.vars)) {
          varsOut[k] = configValueToJson(v);
        }
        result["vars"] = varsOut;
      }
      if (node.child) result["child"] = serializeNode(node.child);
      return result;
    }

    case "leaf": {
      const out: JsonNode = { type: "leaf", behavior: node.behaviorType };
      if (Object.keys(node.vars).length > 0) {
        const varsOut: Record<string, unknown> = {};
        for (const [k, v] of Object.entries(node.vars)) {
          varsOut[k] = configValueToJson(v);
        }
        out["vars"] = varsOut;
      }
      return out;
    }

    case "subtree": {
      const out: JsonNode = { type: "subtree", subtype: node.behaviorType };
      if (node.overrideId !== undefined) out["override_id"] = node.overrideId;
      if (node.bindings && Object.keys(node.bindings).length > 0) out["bindings"] = node.bindings;
      return out;
    }
  }
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/** Serialize a BtNode AST to the JSON object used in .bt.json files. */
export function serializeToJsonObject(node: BtNode, dmType?: string, bindings?: BtBindingDeclarations): JsonNode {
  const out = serializeNode(node);
  const prefix: JsonNode = {};
  if (dmType) prefix["dm_type"] = dmType;
  if (bindings && Object.keys(bindings).length > 0) prefix["bindings"] = bindings;
  return { ...prefix, ...out };
}

/** Serialize a BtNode AST to a formatted .bt.json string (tab-indented). */
export function serializeToJsonString(node: BtNode, dmType?: string, bindings?: BtBindingDeclarations): string {
  return JSON.stringify(serializeToJsonObject(node, dmType, bindings), null, "\t") + "\n";
}
