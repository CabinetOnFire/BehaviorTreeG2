import { parseJsonFile } from "../src/parser/btJsonParser";
import { serializeToJsonObject, serializeToJsonString } from "../src/serializer/btJsonSerializer";
import type { BtNode } from "../shared/types";
import { BT_PARALLEL_FAILURE_ANY, BT_PARALLEL_SUCCESS_ALL } from "../shared/btConstants";

describe("serializeToJsonObject", () => {
  it("serializes selector/sequence with children", () => {
    const node: BtNode = {
      kind: "sequence",
      children: [{ kind: "selector", children: [] }],
    };
    expect(serializeToJsonObject(node)).toEqual({
      type: "sequence",
      children: [{ type: "selector", children: [] }],
    });
  });

  it("serializes parallel fields back to snake_case json keys", () => {
    const node: BtNode = {
      kind: "parallel",
      failurePolicy: BT_PARALLEL_FAILURE_ANY,
      successPolicy: BT_PARALLEL_SUCCESS_ALL,
      repeatSecondary: true,
      finishOnPrimary: false,
      children: [],
    };
    expect(serializeToJsonObject(node)).toEqual({
      type: "parallel",
      failure_policy: BT_PARALLEL_FAILURE_ANY,
      success_policy: BT_PARALLEL_SUCCESS_ALL,
      repeat_secondary: true,
      finish_on_primary: false,
      children: [],
    });
  });

  it("omits optional text field when undefined", () => {
    const node: BtNode = {
      kind: "parallel",
      failurePolicy: BT_PARALLEL_FAILURE_ANY,
      successPolicy: BT_PARALLEL_SUCCESS_ALL,
      repeatSecondary: false,
      finishOnPrimary: true,
      children: [],
    };
    const out = serializeToJsonObject(node);
    expect(out).not.toHaveProperty("repeat_secondary_delay");
  });

  it("serializes leaf vars back with scalar conversion", () => {
    const node: BtNode = {
      kind: "leaf",
      behaviorType: "/datum/bt_node/ai_behavior/attack",
      vars: { enabled: "TRUE", count: "3", name: "foo", list_val: ["a", "b"] },
    };
    expect(serializeToJsonObject(node)).toEqual({
      type: "leaf",
      behavior: "/datum/bt_node/ai_behavior/attack",
      vars: { enabled: true, count: 3, name: "foo", list_val: ["a", "b"] },
    });
  });

  it("omits vars key entirely for leaf with no vars", () => {
    const node: BtNode = { kind: "leaf", behaviorType: "/datum/bt_node/ai_behavior/idle", vars: {} };
    expect(serializeToJsonObject(node)).toEqual({
      type: "leaf",
      behavior: "/datum/bt_node/ai_behavior/idle",
    });
  });

  it("serializes decorator with child and vars", () => {
    const node: BtNode = {
      kind: "decorator",
      nodeType: "/datum/bt_node/decorator/inverter",
      vars: { invert: "TRUE" },
      child: { kind: "leaf", behaviorType: "/datum/bt_node/ai_behavior/wait", vars: {} },
    };
    expect(serializeToJsonObject(node)).toEqual({
      type: "decorator",
      decorator: "/datum/bt_node/decorator/inverter",
      vars: { invert: true },
      child: { type: "leaf", behavior: "/datum/bt_node/ai_behavior/wait" },
    });
  });

  it("serializes subtree with override_id and bindings", () => {
    const node: BtNode = {
      kind: "subtree",
      behaviorType: "/datum/bt_node/subtree/combat",
      overrideId: "abc123",
      bindings: { target: "$bxyz1234" },
    };
    expect(serializeToJsonObject(node)).toEqual({
      type: "subtree",
      subtype: "/datum/bt_node/subtree/combat",
      override_id: "abc123",
      bindings: { target: "$bxyz1234" },
    });
  });

  it("includes dm_type and bindings prefix keys when supplied", () => {
    const node: BtNode = { kind: "selector", children: [] };
    const out = serializeToJsonObject(node, "/datum/bt_node/subtree/combat", {
      target: { label: "Target", default: "" },
    });
    expect(out).toEqual({
      dm_type: "/datum/bt_node/subtree/combat",
      bindings: { target: { label: "Target", default: "" } },
      type: "selector",
      children: [],
    });
  });

  it("serializeToJsonString produces tab-indented JSON with trailing newline", () => {
    const node: BtNode = { kind: "selector", children: [] };
    const text = serializeToJsonString(node);
    expect(text.endsWith("\n")).toBe(true);
    expect(text).toContain("\t\"type\"");
  });
});

describe("parser/serializer round-trip", () => {
  const cases: Array<{ name: string; obj: Record<string, unknown> }> = [
    {
      name: "nested selector/sequence/leaf",
      obj: {
        type: "selector",
        children: [
          {
            type: "sequence",
            children: [
              { type: "leaf", behavior: "/datum/bt_node/ai_behavior/find_target", vars: { range: 5 } },
            ],
          },
        ],
      },
    },
    {
      name: "parallel with all fields",
      obj: {
        type: "parallel",
        failure_policy: BT_PARALLEL_FAILURE_ANY,
        success_policy: BT_PARALLEL_SUCCESS_ALL,
        repeat_secondary: true,
        repeat_secondary_delay: "5",
        finish_on_primary: false,
        children: [],
      },
    },
    {
      name: "decorator with child",
      obj: {
        type: "decorator",
        decorator: "/datum/bt_node/decorator/inverter",
        vars: { invert: true },
        child: { type: "leaf", behavior: "/datum/bt_node/ai_behavior/wait", vars: {} },
      },
    },
    {
      name: "subtree with bindings",
      obj: {
        type: "subtree",
        subtype: "/datum/bt_node/subtree/combat",
        override_id: "id1",
        bindings: { target: "$b1" },
      },
    },
  ];

  for (const { name, obj } of cases) {
    it(`round-trips: ${name}`, () => {
      const { root, dmType, bindings } = parseJsonFile(JSON.stringify(obj));
      const out = serializeToJsonObject(root, dmType, bindings);
      const reparsed = parseJsonFile(JSON.stringify(out));
      expect(reparsed.root).toEqual(root);
    });
  }
});
