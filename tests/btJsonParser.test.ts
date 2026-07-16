import { parseJsonFile } from "../src/parser/btJsonParser";
import {
  BT_PARALLEL_FAILURE_ANY,
  BT_PARALLEL_SUCCESS_ALL,
  BT_SUBPLAN_LOOP_ON_SUCCESS,
  BT_SUBPLAN_LOOP_ON_FAILURE,
} from "../shared/btConstants";

describe("parseJsonFile", () => {
  it("parses a selector with children", () => {
    const { root } = parseJsonFile(
      JSON.stringify({
        type: "selector",
        children: [
          { type: "leaf", behavior: "/datum/bt_node/ai_behavior/find_target", vars: {} },
        ],
      }),
    );
    expect(root.kind).toBe("selector");
    if (root.kind !== "selector") throw new Error("unreachable");
    expect(root.children).toHaveLength(1);
    expect(root.children[0].kind).toBe("leaf");
  });

  it("parses a sequence with no children as empty array", () => {
    const { root } = parseJsonFile(JSON.stringify({ type: "sequence" }));
    expect(root.kind).toBe("sequence");
    if (root.kind !== "sequence") throw new Error("unreachable");
    expect(root.children).toEqual([]);
  });

  it("parses parallel with explicit schema fields", () => {
    const { root } = parseJsonFile(
      JSON.stringify({
        type: "parallel",
        failure_policy: BT_PARALLEL_FAILURE_ANY,
        success_policy: BT_PARALLEL_SUCCESS_ALL,
        repeat_secondary: true,
        repeat_secondary_delay: "5",
        finish_on_primary: false,
        children: [],
      }),
    );
    expect(root.kind).toBe("parallel");
    if (root.kind !== "parallel") throw new Error("unreachable");
    expect(root.failurePolicy).toBe(BT_PARALLEL_FAILURE_ANY);
    expect(root.successPolicy).toBe(BT_PARALLEL_SUCCESS_ALL);
    expect(root.repeatSecondary).toBe(true);
    expect(root.repeatSecondaryDelay).toBe("5");
    expect(root.finishOnPrimary).toBe(false);
  });

  it("applies parallel schema defaults when fields are absent", () => {
    const { root } = parseJsonFile(JSON.stringify({ type: "parallel", children: [] }));
    if (root.kind !== "parallel") throw new Error("unreachable");
    expect(root.repeatSecondary).toBe(false);
    expect(root.finishOnPrimary).toBe(true);
    expect(root.repeatSecondaryDelay).toBeUndefined();
  });

  it("parses subplan with schema fields", () => {
    const { root } = parseJsonFile(
      JSON.stringify({
        type: "subplan",
        success_policy: BT_SUBPLAN_LOOP_ON_SUCCESS,
        failure_policy: BT_SUBPLAN_LOOP_ON_FAILURE,
        loop_delay: "3",
        children: [],
      }),
    );
    if (root.kind !== "subplan") throw new Error("unreachable");
    expect(root.successPolicy).toBe(BT_SUBPLAN_LOOP_ON_SUCCESS);
    expect(root.failurePolicy).toBe(BT_SUBPLAN_LOOP_ON_FAILURE);
    expect(root.loopDelay).toBe("3");
  });

  it("parses leaf vars with scalar conversions", () => {
    const { root } = parseJsonFile(
      JSON.stringify({
        type: "leaf",
        behavior: "/datum/bt_node/ai_behavior/attack",
        vars: { enabled: true, disabled: false, count: 3, name: "foo", list_val: ["a", "b"] },
      }),
    );
    if (root.kind !== "leaf") throw new Error("unreachable");
    expect(root.behaviorType).toBe("/datum/bt_node/ai_behavior/attack");
    expect(root.vars).toEqual({
      enabled: "TRUE",
      disabled: "FALSE",
      count: "3",
      name: "foo",
      list_val: ["a", "b"],
    });
  });

  it("parses leaf with no vars object", () => {
    const { root } = parseJsonFile(
      JSON.stringify({ type: "leaf", behavior: "/datum/bt_node/ai_behavior/idle" }),
    );
    if (root.kind !== "leaf") throw new Error("unreachable");
    expect(root.vars).toEqual({});
  });

  it("parses decorator with child and vars", () => {
    const { root } = parseJsonFile(
      JSON.stringify({
        type: "decorator",
        decorator: "/datum/bt_node/decorator/inverter",
        vars: { invert: true },
        child: { type: "leaf", behavior: "/datum/bt_node/ai_behavior/wait", vars: {} },
      }),
    );
    if (root.kind !== "decorator") throw new Error("unreachable");
    expect(root.nodeType).toBe("/datum/bt_node/decorator/inverter");
    expect(root.vars).toEqual({ invert: "TRUE" });
    expect(root.child?.kind).toBe("leaf");
  });

  it("parses decorator with no child", () => {
    const { root } = parseJsonFile(
      JSON.stringify({ type: "decorator", decorator: "/datum/bt_node/decorator/x", vars: {} }),
    );
    if (root.kind !== "decorator") throw new Error("unreachable");
    expect(root.child).toBeUndefined();
  });

  it("parses subtree with override_id and bindings", () => {
    const { root } = parseJsonFile(
      JSON.stringify({
        type: "subtree",
        subtype: "/datum/bt_node/subtree/combat",
        override_id: "abc123",
        bindings: { target: "$bxyz1234" },
      }),
    );
    if (root.kind !== "subtree") throw new Error("unreachable");
    expect(root.behaviorType).toBe("/datum/bt_node/subtree/combat");
    expect(root.overrideId).toBe("abc123");
    expect(root.bindings).toEqual({ target: "$bxyz1234" });
  });

  it("parses subtree with no override_id or bindings", () => {
    const { root } = parseJsonFile(
      JSON.stringify({ type: "subtree", subtype: "/datum/bt_node/subtree/combat" }),
    );
    if (root.kind !== "subtree") throw new Error("unreachable");
    expect(root.overrideId).toBeUndefined();
    expect(root.bindings).toBeUndefined();
  });

  it("throws on unknown node type", () => {
    expect(() => parseJsonFile(JSON.stringify({ type: "bogus" }))).toThrow(
      /Unknown BT JSON node type/,
    );
  });

  it("extracts dm_type when present", () => {
    const { dmType } = parseJsonFile(
      JSON.stringify({ dm_type: "/datum/bt_node/subtree/combat", type: "selector", children: [] }),
    );
    expect(dmType).toBe("/datum/bt_node/subtree/combat");
  });

  it("omits dmType when dm_type is absent", () => {
    const { dmType } = parseJsonFile(JSON.stringify({ type: "selector", children: [] }));
    expect(dmType).toBeUndefined();
  });

  it("parses root-level binding declarations", () => {
    const { bindings } = parseJsonFile(
      JSON.stringify({
        type: "selector",
        children: [],
        bindings: { target: { label: "Target", default: "/mob/living" } },
      }),
    );
    expect(bindings).toEqual({ target: { label: "Target", default: "/mob/living" } });
  });

  it("omits bindings when none declared", () => {
    const { bindings } = parseJsonFile(JSON.stringify({ type: "selector", children: [] }));
    expect(bindings).toBeUndefined();
  });
});
