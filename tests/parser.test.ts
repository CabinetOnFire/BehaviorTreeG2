import { parseFile } from "../src/parser/btParser";
import type { BtNode } from "../shared/types";

// ---------------------------------------------------------------------------
// Fixture 1: simple_hostile_combat
// ---------------------------------------------------------------------------

const FIXTURE_1 = `
/datum/bt_node/subtree/simple_hostile_combat
    behavior_nodes = BT_SELECTOR(\\
                        BT_DECORATOR(/datum/bt_node/decorator/bb_key_set,\\
                            BT_PARALLEL(BT_PARALLEL_FAILURE_ONE,\\
                                BT_LEAF(/datum/ai_behavior/basic_melee_attack/bt,\\
                                    BB_BASIC_MOB_CURRENT_TARGET, BB_TARGETING_STRATEGY, BB_BASIC_MOB_CURRENT_TARGET_HIDING_LOCATION\\
                                ),\\
                                BT_LEAF(/datum/ai_behavior/move_to_target,\\
                                    BB_BASIC_MOB_CURRENT_TARGET, 1\\
                                )\\
                            ),\\
                            "key" = BB_BASIC_MOB_CURRENT_TARGET,\\
                            "observed_keys" = list(BB_BASIC_MOB_CURRENT_TARGET),\\
                            "observer_abort" = BT_ABORT_SELF\\
                        ),\\
                        BT_LEAF(/datum/ai_behavior/find_potential_targets,\\
                            BB_BASIC_MOB_CURRENT_TARGET, BB_TARGETING_STRATEGY, BB_BASIC_MOB_CURRENT_TARGET_HIDING_LOCATION\\
                        )\\
                )
`;

const EXPECTED_1: BtNode = {
  kind: "selector",
  children: [
    {
      kind: "decorator",
      nodeType: "/datum/bt_node/decorator/bb_key_set",
      config: {
        key: "BB_BASIC_MOB_CURRENT_TARGET",
        observed_keys: ["BB_BASIC_MOB_CURRENT_TARGET"],
        observer_abort: "BT_ABORT_SELF",
      },
      child: {
        kind: "parallel",
        failurePolicy: "BT_PARALLEL_FAILURE_ONE",
        successPolicy: "BT_PARALLEL_SUCCESS_ALL",
        children: [
          {
            kind: "leaf",
            behaviorType: "/datum/ai_behavior/basic_melee_attack/bt",
            args: [
              "BB_BASIC_MOB_CURRENT_TARGET",
              "BB_TARGETING_STRATEGY",
              "BB_BASIC_MOB_CURRENT_TARGET_HIDING_LOCATION",
            ],
          },
          {
            kind: "leaf",
            behaviorType: "/datum/ai_behavior/move_to_target",
            args: ["BB_BASIC_MOB_CURRENT_TARGET", "1"],
          },
        ],
      },
    },
    {
      kind: "leaf",
      behaviorType: "/datum/ai_behavior/find_potential_targets",
      args: [
        "BB_BASIC_MOB_CURRENT_TARGET",
        "BB_TARGETING_STRATEGY",
        "BB_BASIC_MOB_CURRENT_TARGET_HIDING_LOCATION",
      ],
    },
  ],
};

// ---------------------------------------------------------------------------
// Fixture 2: escape_captivity
// ---------------------------------------------------------------------------

const FIXTURE_2 = `
/datum/bt_node/subtree/escape_captivity
    behavior_nodes = BT_SELECTOR(\\
                        BT_DECORATOR(/datum/bt_node/decorator/pawn_buckled_to_obj,\\
                            BT_SELECTOR(\\
                                BT_DECORATOR(/datum/bt_node/decorator/buckle_target_dangerous,\\
                                    BT_LEAF(/datum/ai_behavior/break_out_of_object/from_bb, BB_BASIC_MOB_ESCAPE_TARGET)\\
                                ),\\
                                BT_LEAF(/datum/ai_behavior/resist)\\
                            )\\
                        ),\\
                        BT_DECORATOR(/datum/bt_node/decorator/pawn_contained_in_obj,\\
                            BT_SELECTOR(\\
                                BT_DECORATOR(/datum/bt_node/decorator/container_attackable,\\
                                    BT_LEAF(/datum/ai_behavior/break_out_of_object/from_bb, BB_BASIC_MOB_ESCAPE_TARGET)\\
                                ),\\
                                BT_LEAF(/datum/ai_behavior/resist)\\
                            )\\
                        ),\\
                        BT_DECORATOR(/datum/bt_node/decorator/pawn_grabbed_by_enemy,\\
                            BT_LEAF(/datum/ai_behavior/resist)\\
                        ),\\
                        BT_DECORATOR(/datum/bt_node/decorator/pawn_is_restrained,\\
                            BT_LEAF(/datum/ai_behavior/resist)\\
                        )\\
            )
`;

// ---------------------------------------------------------------------------
// Fixture 3: escape_captivity/pacifist
// ---------------------------------------------------------------------------

const FIXTURE_3 = `
/datum/bt_node/subtree/escape_captivity/pacifist
    behavior_nodes = BT_SELECTOR(\\
        BT_DECORATOR(/datum/bt_node/decorator/pawn_buckled_to_obj,\\
            BT_LEAF(/datum/ai_behavior/resist)\\
        ),\\
        BT_DECORATOR(/datum/bt_node/decorator/pawn_contained_in_obj,\\
            BT_LEAF(/datum/ai_behavior/resist)\\
        ),\\
        BT_DECORATOR(/datum/bt_node/decorator/pawn_grabbed_by_enemy,\\
            BT_LEAF(/datum/ai_behavior/resist)\\
        ),\\
        BT_DECORATOR(/datum/bt_node/decorator/pawn_is_restrained,\\
            BT_LEAF(/datum/ai_behavior/resist)\\
        )\\
    )
`;

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("btParser — fixture 1: simple_hostile_combat", () => {
  it("parses to the correct typePath", () => {
    const results = parseFile(FIXTURE_1);
    expect(results).toHaveLength(1);
    expect(results[0].typePath).toBe("/datum/bt_node/subtree/simple_hostile_combat");
  });

  it("produces the expected AST", () => {
    const results = parseFile(FIXTURE_1);
    expect(results[0].root).toEqual(EXPECTED_1);
  });

  it("records non-zero startOffset and endOffset > startOffset", () => {
    const results = parseFile(FIXTURE_1);
    expect(results[0].startOffset).toBeGreaterThan(0);
    expect(results[0].endOffset).toBeGreaterThan(results[0].startOffset);
  });
});

describe("btParser — fixture 2: escape_captivity", () => {
  let results: ReturnType<typeof parseFile>;

  beforeEach(() => {
    results = parseFile(FIXTURE_2);
  });

  it("parses exactly one subtree", () => {
    expect(results).toHaveLength(1);
    expect(results[0].typePath).toBe("/datum/bt_node/subtree/escape_captivity");
  });

  it("root is a selector with 4 children", () => {
    const root = results[0].root;
    expect(root.kind).toBe("selector");
    if (root.kind === "selector") {
      expect(root.children).toHaveLength(4);
    }
  });

  it("all top-level children are decorators", () => {
    const root = results[0].root;
    if (root.kind !== "selector") return;
    for (const child of root.children) {
      expect(child.kind).toBe("decorator");
    }
  });

  it("first child: pawn_buckled_to_obj wraps a selector with stacked decorator", () => {
    const root = results[0].root;
    if (root.kind !== "selector") return;
    const first = root.children[0];
    expect(first.kind).toBe("decorator");
    if (first.kind !== "decorator") return;
    expect(first.nodeType).toBe("/datum/bt_node/decorator/pawn_buckled_to_obj");
    expect(first.child.kind).toBe("selector");
    if (first.child.kind !== "selector") return;
    expect(first.child.children).toHaveLength(2);
    expect(first.child.children[0].kind).toBe("decorator");
    expect(first.child.children[1].kind).toBe("leaf");
  });
});

describe("btParser — fixture 3: escape_captivity/pacifist", () => {
  it("parses typePath with sub-path correctly", () => {
    const results = parseFile(FIXTURE_3);
    expect(results).toHaveLength(1);
    expect(results[0].typePath).toBe("/datum/bt_node/subtree/escape_captivity/pacifist");
  });

  it("has 4 decorator children", () => {
    const results = parseFile(FIXTURE_3);
    const root = results[0].root;
    expect(root.kind).toBe("selector");
    if (root.kind === "selector") {
      expect(root.children).toHaveLength(4);
      expect(root.children.every((c) => c.kind === "decorator")).toBe(true);
    }
  });

  it("all decorator children wrap a leaf /datum/ai_behavior/resist", () => {
    const results = parseFile(FIXTURE_3);
    const root = results[0].root;
    if (root.kind !== "selector") return;
    for (const child of root.children) {
      if (child.kind !== "decorator") continue;
      expect(child.child.kind).toBe("leaf");
      if (child.child.kind === "leaf") {
        expect(child.child.behaviorType).toBe("/datum/ai_behavior/resist");
      }
    }
  });
});

describe("btParser — base type null assignment is skipped", () => {
  const BASE_TYPE_DM = `
/datum/bt_node/subtree
    var/list/behavior_nodes = null
`;

  it("does not emit a subtree for the base null declaration", () => {
    const results = parseFile(BASE_TYPE_DM);
    expect(results).toHaveLength(0);
  });
});

// ---------------------------------------------------------------------------
// Fixture 4: ai_controller with BT_SUBTREE references
// ---------------------------------------------------------------------------

const FIXTURE_4 = `
/datum/ai_controller/basic_controller/simple/simple_hostile
\tbehavior_nodes = BT_SELECTOR(\\
\t\tBT_SUBTREE(/datum/bt_node/subtree/escape_captivity),\\
\t\tBT_SUBTREE(/datum/bt_node/subtree/simple_hostile_combat),\\
\t)
`;

describe("btParser — fixture 4: ai_controller + BT_SUBTREE", () => {
  let results: ReturnType<typeof parseFile>;

  beforeAll(() => {
    results = parseFile(FIXTURE_4);
  });

  it("parses the ai_controller typePath", () => {
    expect(results).toHaveLength(1);
    expect(results[0].typePath).toBe(
      "/datum/ai_controller/basic_controller/simple/simple_hostile",
    );
  });

  it("root is a selector with 2 subtree children", () => {
    const root = results[0].root;
    expect(root.kind).toBe("selector");
    if (root.kind !== "selector") return;
    expect(root.children).toHaveLength(2);
    expect(root.children[0]).toEqual<BtNode>({
      kind: "subtree",
      behaviorType: "/datum/bt_node/subtree/escape_captivity",
    });
    expect(root.children[1]).toEqual<BtNode>({
      kind: "subtree",
      behaviorType: "/datum/bt_node/subtree/simple_hostile_combat",
    });
  });
});
