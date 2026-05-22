import { parseFile } from "../src/parser/btParser";
import { serialize } from "../src/serializer/btSerializer";

const FIXTURES = [
  // Fixture 1
  `
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
`,
  // Fixture 3 (simpler, good round-trip target)
  `
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
`,
];

describe("Serializer round-trip", () => {
  for (let i = 0; i < FIXTURES.length; i++) {
    it(`fixture ${i + 1}: parse → serialize → re-parse yields same AST`, () => {
      const original = parseFile(FIXTURES[i]);
      expect(original.length).toBeGreaterThan(0);

      for (const sub of original) {
        const serialized = serialize(sub.root);
        // Wrap in a minimal DM file to re-parse
        const wrapped = `${sub.typePath}\n\tbehavior_nodes = ${serialized}\n`;
        const reparsed = parseFile(wrapped);

        expect(reparsed.length).toBe(1);
        expect(reparsed[0].root).toEqual(sub.root);
      }
    });
  }
});

describe("Serializer — basic shapes", () => {
  it("serializes a flat leaf", () => {
    const s = serialize({ kind: "leaf", behaviorType: "/datum/ai_behavior/resist", args: [] });
    expect(s).toBe("BT_LEAF(/datum/ai_behavior/resist)");
  });

  it("serializes a leaf with args", () => {
    const s = serialize({
      kind: "leaf",
      behaviorType: "/datum/ai_behavior/move_to_target",
      args: ["BB_TARGET", "1"],
    });
    expect(s).toBe("BT_LEAF(/datum/ai_behavior/move_to_target, BB_TARGET, 1)");
  });

  it("serializes a selector with two leaves", () => {
    const s = serialize({
      kind: "selector",
      children: [
        { kind: "leaf", behaviorType: "/datum/ai_behavior/a", args: [] },
        { kind: "leaf", behaviorType: "/datum/ai_behavior/b", args: [] },
      ],
    });
    expect(s).toContain("BT_SELECTOR");
    expect(s).toContain("BT_LEAF(/datum/ai_behavior/a)");
    expect(s).toContain("BT_LEAF(/datum/ai_behavior/b)");
  });

  it("serializes a subtree reference", () => {
    const s = serialize({
      kind: "subtree",
      behaviorType: "/datum/bt_node/subtree/escape_captivity",
    });
    expect(s).toBe("BT_SUBTREE(/datum/bt_node/subtree/escape_captivity)");
  });

  it("serializes a selector containing two BT_SUBTREE refs", () => {
    const s = serialize({
      kind: "selector",
      children: [
        { kind: "subtree", behaviorType: "/datum/bt_node/subtree/escape_captivity" },
        { kind: "subtree", behaviorType: "/datum/bt_node/subtree/simple_hostile_combat" },
      ],
    });
    expect(s).toContain("BT_SELECTOR");
    expect(s).toContain("BT_SUBTREE(/datum/bt_node/subtree/escape_captivity)");
    expect(s).toContain("BT_SUBTREE(/datum/bt_node/subtree/simple_hostile_combat)");
  });
});

// ---------------------------------------------------------------------------
// Round-trip for fixture 4: ai_controller + BT_SUBTREE
// ---------------------------------------------------------------------------

const FIXTURE_4 = `
/datum/ai_controller/basic_controller/simple/simple_hostile
\tbehavior_nodes = BT_SELECTOR(\\
\t\tBT_SUBTREE(/datum/bt_node/subtree/escape_captivity),\\
\t\tBT_SUBTREE(/datum/bt_node/subtree/simple_hostile_combat),\\
\t)
`;

describe("Serializer round-trip — fixture 4 (ai_controller + BT_SUBTREE)", () => {
  it("parse → serialize → re-parse yields same AST", () => {
    const original = parseFile(FIXTURE_4);
    expect(original).toHaveLength(1);
    const sub = original[0];
    const serialized = serialize(sub.root);
    const wrapped = `${sub.typePath}\n\tbehavior_nodes = ${serialized}\n`;
    const reparsed = parseFile(wrapped);
    expect(reparsed).toHaveLength(1);
    expect(reparsed[0].root).toEqual(sub.root);
  });
});
